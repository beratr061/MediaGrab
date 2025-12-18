//! Download start/cancel commands
//!
//! This module implements the Tauri commands for starting and cancelling downloads.
//!
//! **Validates: Requirements 1.1, 1.4, 4.1, 4.2, 4.3**

use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_notification::NotificationExt;
use tokio::sync::mpsc;

use crate::download::{
    spawn_ytdlp, stream_process_output, ProcessOutput,
    SharedDownloadManager, SpawnConfig,
};
use crate::models::{DownloadConfig, DownloadError, DownloadResult, DownloadState, ProgressEvent, RetryConfig};
use crate::utils::paths;

/// Event names for frontend communication
const EVENT_PROGRESS: &str = "download-progress";
const EVENT_STATE_CHANGE: &str = "download-state-change";
const EVENT_ERROR: &str = "download-error";
const EVENT_COMPLETE: &str = "download-complete";

/// State change event payload
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct StateChangeEvent {
    state: DownloadState,
    file_path: Option<String>,
}

/// Retry event payload
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct RetryEvent {
    attempt: u32,
    max_retries: u32,
    delay_ms: u64,
    error: String,
}

const EVENT_RETRY: &str = "download-retry";

/// Starts a download with the given configuration
///
/// **Validates: Requirements 1.1, 1.5, 4.1, 4.2**
#[tauri::command]
pub async fn start_download(
    config: DownloadConfig,
    app: AppHandle,
    state: State<'_, SharedDownloadManager>,
) -> Result<DownloadResult, String> {
    let manager = state.inner().clone();
    
    // Try to start the download
    manager
        .start_download(config.clone())
        .await
        .map_err(|e| e.to_string())?;
    
    // Emit state change
    emit_state_change(&app, DownloadState::Starting, None);
    
    // Resolve executable paths
    // **Validates: Requirements 7.3, 11.2**
    let exec_paths = match paths::resolve_executable_paths(&app) {
        Ok(paths) => paths,
        Err(e) => {
            let result = manager.fail(e.clone()).await;
            emit_state_change(&app, DownloadState::Failed, None);
            emit_error(&app, &e.to_string());
            return Ok(result);
        }
    };
    
    // Spawn the yt-dlp process with resolved paths
    let spawn_config = SpawnConfig {
        ytdlp_path: exec_paths.ytdlp.to_string_lossy().to_string(),
        ffmpeg_location: Some(exec_paths.ffmpeg_dir.to_string_lossy().to_string()),
    };
    
    // Use retry configuration
    let retry_config = RetryConfig::default();
    
    let child = match spawn_download_with_retry(&config, &spawn_config, &manager, &app, &retry_config).await {
        Ok(child) => child,
        Err(e) => {
            let result = manager.fail(e.clone()).await;
            emit_state_change(&app, DownloadState::Failed, None);
            emit_error(&app, &e.to_string());
            return Ok(result);
        }
    };

    // Transition to downloading state
    if manager.start_downloading().await.is_err() {
        let result = manager.fail(DownloadError::GenericError("Failed to start download".to_string())).await;
        emit_state_change(&app, DownloadState::Failed, None);
        return Ok(result);
    }
    
    emit_state_change(&app, DownloadState::Downloading, None);
    
    // Create channel for process output
    let (tx, mut rx) = mpsc::channel::<ProcessOutput>(100);
    
    // Spawn task to stream process output
    let output_folder = config.output_folder.clone();
    
    tokio::spawn(async move {
        // Stream process output
        let _ = stream_process_output(child, tx).await;
    });
    
    // Handle process output events
    let manager_for_events = manager.clone();
    let app_for_events = app.clone();
    
    tokio::spawn(async move {
        // Track the detected file path from --print after_move:filepath
        let mut detected_file_path: Option<String> = None;
        
        while let Some(output) = rx.recv().await {
            match output {
                ProcessOutput::Progress(event) => {
                    // Update manager progress
                    manager_for_events.update_progress(event.clone()).await;
                    
                    // Emit progress event to frontend
                    emit_progress(&app_for_events, &event);
                    
                    // Update taskbar progress (Windows)
                    #[cfg(target_os = "windows")]
                    update_taskbar_progress(&app_for_events, event.percentage);
                }
                ProcessOutput::Merging => {
                    // Transition to merging state
                    if manager_for_events.start_merging().await.is_ok() {
                        emit_state_change(&app_for_events, DownloadState::Merging, None);
                        
                        // Emit a merging progress event
                        let merging_event = ProgressEvent {
                            percentage: 100.0,
                            downloaded_bytes: 0,
                            total_bytes: None,
                            speed: String::new(),
                            eta_seconds: None,
                            status: "merging".to_string(),
                        };
                        emit_progress(&app_for_events, &merging_event);
                    }
                }
                ProcessOutput::FilePath(path) => {
                    // Store the file path from --print after_move:filepath
                    tracing::info!("Detected output file path: {}", path);
                    detected_file_path = Some(path);
                }
                ProcessOutput::Error(error) => {
                    // Note: yt-dlp level retries are handled by --retries and --fragment-retries flags
                    // This error means all internal retries failed
                    let _ = manager_for_events.fail(error.clone()).await;
                    emit_state_change(&app_for_events, DownloadState::Failed, None);
                    emit_error(&app_for_events, &error.to_string());
                    
                    // Send failure notification if minimized
                    send_completion_notification(&app_for_events, "Download", false);
                }
                ProcessOutput::Completed(_) => {
                    // Use the detected file path from --print, fallback to find_latest_file
                    let file_path = detected_file_path.clone()
                        .or_else(|| {
                            // Fallback: try to find the latest file in output folder
                            // This is a sync operation but should be fast
                            tokio::task::block_in_place(|| {
                                find_latest_file_sync(&output_folder)
                            })
                        });
                    
                    if let Ok(result) = manager_for_events.complete(file_path.clone().unwrap_or_default()).await {
                        emit_state_change(&app_for_events, DownloadState::Completed, file_path.clone());
                        emit_complete(&app_for_events, &result);
                        
                        // Send Windows notification if minimized
                        // Extract filename from path for notification
                        let title = file_path
                            .as_ref()
                            .and_then(|p| std::path::Path::new(p).file_name())
                            .and_then(|n| n.to_str())
                            .unwrap_or("Media file");
                        send_completion_notification(&app_for_events, title, true);
                    }
                }
                ProcessOutput::ExitError(code) => {
                    let error = DownloadError::DownloadFailed(format!("Process exited with code {}", code));
                    let _ = manager_for_events.fail(error.clone()).await;
                    emit_state_change(&app_for_events, DownloadState::Failed, None);
                    emit_error(&app_for_events, &error.to_string());
                    
                    // Send failure notification if minimized
                    send_completion_notification(&app_for_events, "Download", false);
                }
                ProcessOutput::Terminated => {
                    // Process was killed (likely due to cancellation)
                    // State should already be Cancelled from cancel_download
                    let state = manager_for_events.get_state().await;
                    if state != DownloadState::Cancelled && state != DownloadState::Cancelling {
                        emit_state_change(&app_for_events, DownloadState::Cancelled, None);
                    }
                }
            }
        }
    });
    
    Ok(DownloadResult {
        success: true,
        file_path: None,
        error: None,
    })
}

/// Cancels the current download
///
/// **Validates: Requirements 1.4**
#[tauri::command]
pub async fn cancel_download(
    app: AppHandle,
    state: State<'_, SharedDownloadManager>,
) -> Result<(), String> {
    let manager = state.inner();
    
    // Emit cancelling state
    emit_state_change(&app, DownloadState::Cancelling, None);
    
    // Cancel the download
    manager.cancel().await.map_err(|e| e.to_string())?;
    
    // Emit cancelled state
    emit_state_change(&app, DownloadState::Cancelled, None);
    
    Ok(())
}

/// Gets the current download state
#[tauri::command]
pub async fn get_download_state(
    state: State<'_, SharedDownloadManager>,
) -> Result<DownloadState, String> {
    Ok(state.inner().get_state().await)
}

/// Resets the download manager to idle state
#[tauri::command]
pub async fn reset_download(
    app: AppHandle,
    state: State<'_, SharedDownloadManager>,
) -> Result<(), String> {
    state.inner().reset().await.map_err(|e| e.to_string())?;
    emit_state_change(&app, DownloadState::Idle, None);
    Ok(())
}


// Helper functions for emitting events

fn emit_progress(app: &AppHandle, event: &ProgressEvent) {
    let _ = app.emit(EVENT_PROGRESS, event);
}

fn emit_state_change(app: &AppHandle, state: DownloadState, file_path: Option<String>) {
    let _ = app.emit(EVENT_STATE_CHANGE, StateChangeEvent { state, file_path });
}

fn emit_error(app: &AppHandle, message: &str) {
    let _ = app.emit(EVENT_ERROR, message);
}

fn emit_complete(app: &AppHandle, result: &DownloadResult) {
    let _ = app.emit(EVENT_COMPLETE, result);
}

/// Updates the Windows taskbar progress indicator
#[cfg(target_os = "windows")]
fn update_taskbar_progress(_app: &AppHandle, _percentage: f64) {
    // Note: This requires additional Windows-specific implementation
    // using the ITaskbarList3 interface. For now, this is a placeholder.
    // The actual implementation would use windows-rs crate.
}

/// Sends a Windows native notification when download completes
/// Only sends notification if the application window is minimized
///
/// **Validates: Requirements 4.3**
fn send_completion_notification(app: &AppHandle, title: &str, success: bool) {
    // Check if window is minimized/not focused
    let should_notify = if let Some(window) = app.get_webview_window("main") {
        // Send notification if window is minimized or not focused
        !window.is_focused().unwrap_or(true) || window.is_minimized().unwrap_or(false)
    } else {
        true // If we can't get window state, send notification anyway
    };
    
    if should_notify {
        let notification_title = if success {
            "Download Complete"
        } else {
            "Download Failed"
        };
        
        let body = if success {
            format!("{} has been downloaded successfully.", title)
        } else {
            format!("Failed to download {}.", title)
        };
        
        let _ = app.notification()
            .builder()
            .title(notification_title)
            .body(&body)
            .show();
    }
}

/// Finds the most recently modified file in a directory (sync version for fallback)
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
            
            // Skip partial files
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

fn emit_retry(app: &AppHandle, event: &RetryEvent) {
    let _ = app.emit(EVENT_RETRY, event);
}

/// Spawns the download process with retry support
async fn spawn_download_with_retry(
    config: &DownloadConfig,
    spawn_config: &SpawnConfig,
    manager: &SharedDownloadManager,
    app: &AppHandle,
    retry_config: &RetryConfig,
) -> Result<tokio::process::Child, DownloadError> {
    loop {
        let attempt = manager.get_retry_attempt().await;
        
        match spawn_ytdlp(config, spawn_config).await {
            Ok(child) => return Ok(child),
            Err(e) => {
                // Check if error is retryable and we have attempts left
                if e.is_retryable() && attempt < retry_config.max_retries {
                    let delay = retry_config.delay_for_attempt(attempt);
                    
                    tracing::warn!(
                        "Download spawn failed (attempt {}/{}): {}. Retrying in {}ms...",
                        attempt + 1,
                        retry_config.max_retries,
                        e,
                        delay
                    );
                    
                    // Emit retry event to frontend
                    emit_retry(app, &RetryEvent {
                        attempt: attempt + 1,
                        max_retries: retry_config.max_retries,
                        delay_ms: delay,
                        error: e.to_string(),
                    });
                    
                    // Increment retry counter
                    manager.increment_retry(&e).await;
                    
                    // Wait before retrying
                    tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;
                    
                    // Prepare for retry
                    if manager.prepare_retry().await.is_err() {
                        return Err(e);
                    }
                    
                    emit_state_change(app, DownloadState::Starting, None);
                    continue;
                }
                
                return Err(e);
            }
        }
    }
}
