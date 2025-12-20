//! Queue management commands
//!
//! Tauri commands for managing the download queue.

use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_store::StoreExt;
use tokio::sync::mpsc;

use crate::commands::history::{HistoryItem, DownloadStats};
use crate::download::queue::{QueueEvent, QueueItem, QueueItemId, QueueItemStatus, SharedDownloadQueue};
use crate::download::{spawn_ytdlp, stream_process_output, ProcessOutput, SpawnConfig};
use crate::models::{DownloadConfig, DownloadError};
use crate::utils::paths;

const HISTORY_STORE_PATH: &str = "history.json";
const HISTORY_KEY: &str = "downloads";
const STATS_KEY: &str = "stats";
const MAX_HISTORY_ITEMS: usize = 500;

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

/// Reorders items in the queue
#[tauri::command]
pub async fn queue_reorder(
    ids: Vec<QueueItemId>,
    queue: State<'_, SharedDownloadQueue>,
) -> Result<(), String> {
    queue.reorder(ids).await;
    Ok(())
}

/// Pauses all pending downloads
#[tauri::command]
pub async fn queue_pause_all(
    queue: State<'_, SharedDownloadQueue>,
) -> Result<(), String> {
    queue.pause_all().await;
    Ok(())
}

/// Resumes all paused downloads
#[tauri::command]
pub async fn queue_resume_all(
    queue: State<'_, SharedDownloadQueue>,
) -> Result<(), String> {
    queue.resume_all().await;
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
            queue.fail(id, e.clone()).await;
            add_to_history_internal(&app, &config, &item, None, "failed", Some(&e.to_string())).await;
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
            queue.fail(id, e.clone()).await;
            add_to_history_internal(&app, &config, &item, None, "failed", Some(&e.to_string())).await;
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
                let error_str = error.to_string();
                queue.fail(id, error).await;
                add_to_history_internal(&app, &config, &item, None, "failed", Some(&error_str)).await;
                send_notification(&app, "Download Failed", &config.url, false);
                return;
            }
            ProcessOutput::Completed(_) => {
                let file_path = detected_file_path
                    .clone()
                    .unwrap_or_else(|| find_latest_file_sync(&output_folder).unwrap_or_default());

                queue.complete(id, file_path.clone()).await;
                
                // Add to history
                add_to_history_internal(&app, &config, &item, Some(&file_path), "completed", None).await;

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
                let error_str = error.to_string();
                queue.fail(id, error).await;
                add_to_history_internal(&app, &config, &item, None, "failed", Some(&error_str)).await;
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

/// Internal function to add download to history
async fn add_to_history_internal(
    app: &AppHandle,
    config: &DownloadConfig,
    item: &QueueItem,
    file_path: Option<&str>,
    status: &str,
    error: Option<&str>,
) {
    let history_item = HistoryItem {
        id: format!("{}-{}", chrono::Utc::now().timestamp_millis(), item.id),
        url: config.url.clone(),
        title: item.title.clone().unwrap_or_else(|| "Unknown".to_string()),
        thumbnail: item.thumbnail.clone(),
        format: format!("{:?}", config.format).to_lowercase().replace("\"", ""),
        quality: format!("{:?}", config.quality).to_lowercase().replace("\"", ""),
        file_path: file_path.map(|s| s.to_string()),
        file_size: get_file_size(file_path),
        duration: None,
        downloaded_at: chrono::Utc::now().timestamp(),
        status: status.to_string(),
        error: error.map(|s| s.to_string()),
    };

    if let Err(e) = save_history_item(app, history_item).await {
        tracing::error!("Failed to save to history: {}", e);
    }
}

/// Gets file size if path exists
fn get_file_size(path: Option<&str>) -> Option<u64> {
    path.and_then(|p| std::fs::metadata(p).ok()).map(|m| m.len())
}

/// Saves a history item to the store
async fn save_history_item(app: &AppHandle, item: HistoryItem) -> Result<(), String> {
    let store = app
        .store(HISTORY_STORE_PATH)
        .map_err(|e| format!("Failed to open history store: {}", e))?;

    // Get existing history
    let mut history: Vec<HistoryItem> = match store.get(HISTORY_KEY) {
        Some(value) => serde_json::from_value(value.clone()).unwrap_or_default(),
        None => Vec::new(),
    };

    // Add new item at the beginning
    history.insert(0, item.clone());

    // Trim to max size
    if history.len() > MAX_HISTORY_ITEMS {
        history.truncate(MAX_HISTORY_ITEMS);
    }

    // Save history
    let value = serde_json::to_value(&history)
        .map_err(|e| format!("Failed to serialize history: {}", e))?;
    store.set(HISTORY_KEY, value);

    // Update stats
    let mut stats: DownloadStats = match store.get(STATS_KEY) {
        Some(value) => serde_json::from_value(value.clone()).unwrap_or_default(),
        None => DownloadStats::default(),
    };

    stats.total_downloads += 1;
    if item.status == "completed" {
        stats.successful_downloads += 1;
        if let Some(size) = item.file_size {
            stats.total_bytes_downloaded += size;
        }
        if let Some(duration) = item.duration {
            stats.total_duration_seconds += duration;
        }
    } else {
        stats.failed_downloads += 1;
    }

    let stats_value = serde_json::to_value(&stats)
        .map_err(|e| format!("Failed to serialize stats: {}", e))?;
    store.set(STATS_KEY, stats_value);

    store
        .save()
        .map_err(|e| format!("Failed to save history: {}", e))?;

    Ok(())
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
    
    // Valid media extensions
    let media_extensions = [
        ".mp4", ".mkv", ".webm", ".avi", ".mov", ".flv",
        ".mp3", ".m4a", ".aac", ".opus", ".flac", ".wav", ".ogg"
    ];
    
    let mut latest: Option<(std::time::SystemTime, String)> = None;

    for entry in entries.flatten() {
        let metadata = entry.metadata().ok()?;
        if metadata.is_file() {
            let path_str = entry.path().to_string_lossy().to_string();
            let path_lower = path_str.to_lowercase();

            // Skip partial files and non-media files
            if path_lower.ends_with(".part") || path_lower.ends_with(".ytdl") {
                continue;
            }
            
            // Only accept media files
            let is_media = media_extensions.iter().any(|ext| path_lower.ends_with(ext));
            if !is_media {
                continue;
            }

            let modified = metadata.modified().ok()?;

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
    tauri::async_runtime::spawn(async move {
        while let Some(event) = event_rx.recv().await {
            let _ = app.emit(EVENT_QUEUE_UPDATE, &event);
        }
    });
}
