//! Queue management commands
//!
//! Tauri commands for managing the download queue.

use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_notification::NotificationExt;
use tokio::sync::mpsc;

use crate::download::queue::{QueueEvent, QueueItem, QueueItemId, QueueItemStatus, SharedDownloadQueue};
use crate::download::{spawn_ytdlp, stream_process_output, ProcessOutput, SpawnConfig};
use crate::models::{DownloadConfig, DownloadError};
use crate::utils::paths;

/// Event name for queue updates
const EVENT_QUEUE_UPDATE: &str = "queue-update";

/// Adds a URL to the download queue
#[tauri::command]
pub async fn queue_add(
    config: DownloadConfig,
    queue: State<'_, SharedDownloadQueue>,
) -> Result<QueueItem, String> {
    let item = queue.add(config).await;
    Ok(item)
}

/// Gets all items in the queue
#[tauri::command]
pub async fn queue_get_all(queue: State<'_, SharedDownloadQueue>) -> Result<Vec<QueueItem>, String> {
    Ok(queue.get_all().await)
}

/// Cancels a specific queue item
#[tauri::command]
pub async fn queue_cancel(
    id: QueueItemId,
    queue: State<'_, SharedDownloadQueue>,
) -> Result<(), String> {
    queue.cancel(id).await.map_err(|e| e.to_string())
}

/// Removes a completed/failed/cancelled item from the queue
#[tauri::command]
pub async fn queue_remove(
    id: QueueItemId,
    queue: State<'_, SharedDownloadQueue>,
) -> Result<(), String> {
    queue.remove(id).await.map_err(|e| e.to_string())
}

/// Clears all completed/failed/cancelled items
#[tauri::command]
pub async fn queue_clear_completed(queue: State<'_, SharedDownloadQueue>) -> Result<(), String> {
    queue.clear_completed().await;
    Ok(())
}

/// Moves an item up in the queue
#[tauri::command]
pub async fn queue_move_up(
    id: QueueItemId,
    queue: State<'_, SharedDownloadQueue>,
) -> Result<(), String> {
    queue.move_up(id).await;
    Ok(())
}

/// Moves an item down in the queue
#[tauri::command]
pub async fn queue_move_down(
    id: QueueItemId,
    queue: State<'_, SharedDownloadQueue>,
) -> Result<(), String> {
    queue.move_down(id).await;
    Ok(())
}

/// Starts processing the queue
pub async fn start_queue_processor(app: AppHandle, queue: SharedDownloadQueue) {
    let semaphore = queue.semaphore();

    loop {
        // Wait for a permit (respects max concurrent limit)
        let permit = semaphore.clone().acquire_owned().await;
        if permit.is_err() {
            break;
        }
        let _permit = permit.unwrap();

        // Check if there are pending items
        if !queue.has_pending().await {
            // No pending items, wait a bit and check again
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            continue;
        }

        // Get next item
        let item = match queue.pop_next().await {
            Some(item) => item,
            None => continue,
        };

        let queue_clone = queue.clone();
        let app_clone = app.clone();

        // Spawn download task
        tokio::spawn(async move {
            process_queue_item(app_clone, queue_clone, item).await;
            // Permit is dropped here, allowing another download to start
        });
    }
}

/// Processes a single queue item
async fn process_queue_item(app: AppHandle, queue: SharedDownloadQueue, item: QueueItem) {
    let id = item.id;
    let config = item.config.clone();

    // Resolve executable paths
    let exec_paths = match paths::resolve_executable_paths(&app) {
        Ok(paths) => paths,
        Err(e) => {
            queue.fail(id, e).await;
            return;
        }
    };

    // Spawn the yt-dlp process
    let spawn_config = SpawnConfig {
        ytdlp_path: exec_paths.ytdlp.to_string_lossy().to_string(),
        ffmpeg_location: Some(exec_paths.ffmpeg_dir.to_string_lossy().to_string()),
    };

    let child = match spawn_ytdlp(&config, &spawn_config).await {
        Ok(child) => child,
        Err(e) => {
            queue.fail(id, e).await;
            return;
        }
    };

    // Create channel for process output
    let (tx, mut rx) = mpsc::channel::<ProcessOutput>(100);
    let output_folder = config.output_folder.clone();

    // Spawn task to stream process output
    tokio::spawn(async move {
        let _ = stream_process_output(child, tx).await;
    });

    // Track detected file path
    let mut detected_file_path: Option<String> = None;

    // Handle process output
    while let Some(output) = rx.recv().await {
        // Check if cancelled
        if let Some(current) = queue.get(id).await {
            if current.status == QueueItemStatus::Cancelled {
                break;
            }
        }

        match output {
            ProcessOutput::Progress(event) => {
                queue.update_progress(id, &event).await;
            }
            ProcessOutput::Merging => {
                queue.update_status(id, QueueItemStatus::Merging).await;
            }
            ProcessOutput::FilePath(path) => {
                detected_file_path = Some(path);
            }
            ProcessOutput::Error(error) => {
                queue.fail(id, error).await;
                send_notification(&app, "Download Failed", &config.url, false);
                return;
            }
            ProcessOutput::Completed(_) => {
                let file_path = detected_file_path
                    .clone()
                    .unwrap_or_else(|| find_latest_file_sync(&output_folder).unwrap_or_default());

                queue.complete(id, file_path.clone()).await;

                // Extract filename for notification
                let title = std::path::Path::new(&file_path)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("Media file");
                send_notification(&app, "Download Complete", title, true);
                return;
            }
            ProcessOutput::ExitError(code) => {
                let error = DownloadError::DownloadFailed(format!("Process exited with code {}", code));
                queue.fail(id, error).await;
                send_notification(&app, "Download Failed", &config.url, false);
                return;
            }
            ProcessOutput::Terminated => {
                // Process was killed (cancelled)
                return;
            }
        }
    }
}

/// Sends a notification
fn send_notification(app: &AppHandle, title: &str, body: &str, _success: bool) {
    // Check if window is minimized/not focused
    let should_notify = if let Some(window) = app.get_webview_window("main") {
        !window.is_focused().unwrap_or(true) || window.is_minimized().unwrap_or(false)
    } else {
        true
    };

    if should_notify {
        let _ = app.notification().builder().title(title).body(body).show();
    }
}

/// Finds the most recently modified file in a directory (sync version)
fn find_latest_file_sync(folder: &str) -> Option<String> {
    use std::fs;
    use std::path::Path;

    let path = Path::new(folder);
    if !path.is_dir() {
        return None;
    }

    let entries = fs::read_dir(path).ok()?;
    let mut latest: Option<(std::time::SystemTime, String)> = None;

    for entry in entries.flatten() {
        let metadata = entry.metadata().ok()?;
        if metadata.is_file() {
            let modified = metadata.modified().ok()?;
            let path_str = entry.path().to_string_lossy().to_string();

            if path_str.ends_with(".part") || path_str.ends_with(".ytdl") {
                continue;
            }

            match &latest {
                None => latest = Some((modified, path_str)),
                Some((prev_time, _)) if modified > *prev_time => {
                    latest = Some((modified, path_str));
                }
                _ => {}
            }
        }
    }

    latest.map(|(_, path)| path)
}

/// Sets up the queue event listener to forward events to frontend
pub fn setup_queue_events(app: AppHandle, mut event_rx: mpsc::UnboundedReceiver<QueueEvent>) {
    tokio::spawn(async move {
        while let Some(event) = event_rx.recv().await {
            let _ = app.emit(EVENT_QUEUE_UPDATE, &event);
        }
    });
}
