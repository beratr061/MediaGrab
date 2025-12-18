// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

pub mod commands;
pub mod download;
pub mod models;
pub mod utils;

use commands::debug::{copy_debug_info, get_recent_logs};
use commands::download::{cancel_download, get_download_state, reset_download, start_download};
use commands::executables::{check_executables, get_executable_paths};
use commands::folder::{
    check_disk_space, check_folder_accessible, open_file, open_folder, pick_folder,
    validate_folder_for_download,
};
use commands::history::{history_add, history_clear, history_get_all, history_get_stats, history_remove};
use commands::media_info::fetch_media_info;
use commands::playlist::{check_is_playlist, fetch_playlist_info};
use commands::preferences::{load_preferences, save_preferences};
use commands::subtitles::fetch_subtitles;
use commands::queue::{
    queue_add, queue_cancel, queue_clear_completed, queue_get_all, queue_move_down, queue_move_up,
    queue_remove, setup_queue_events, start_queue_processor,
};
use commands::update::{check_app_update, check_ytdlp_update, get_app_version, get_ytdlp_version_cmd, install_app_update, update_ytdlp};
use download::{create_download_manager, create_download_queue, SharedDownloadManager};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, RunEvent, WindowEvent,
};
use tauri_plugin_store::StoreExt;
use utils::logging;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Sets up the system tray with menu items
/// 
/// **Validates: Requirements 4.9**
fn setup_system_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Create menu items
    let show_item = MenuItem::with_id(app, "show", "Show MediaGrab", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    
    // Create the menu
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;
    
    // Build the tray icon
    let _tray = TrayIconBuilder::with_id("main-tray")
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                }
                "quit" => {
                    // Terminate any active download before quitting
                    let download_manager = app.state::<SharedDownloadManager>();
                    let manager = download_manager.inner().clone();
                    
                    // Use blocking task to cancel download
                    tauri::async_runtime::block_on(async {
                        if manager.is_active().await {
                            let _ = manager.cancel().await;
                        }
                    });
                    
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            // Show window on left click
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Some(window) = tray.app_handle().get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;
    
    Ok(())
}

/// Event name for update availability notification
const EVENT_UPDATE_AVAILABLE: &str = "ytdlp-update-available";

/// Event name for missing executables notification
const EVENT_EXECUTABLES_MISSING: &str = "executables-missing";





/// Payload for update available event
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateAvailableEvent {
    current_version: String,
    latest_version: Option<String>,
}

/// Payload for missing executables event
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ExecutablesMissingEvent {
    ytdlp_available: bool,
    ffmpeg_available: bool,
    ffprobe_available: bool,
    error: String,
}





/// Checks for required executables on startup
/// 
/// **Validates: Requirements 6.1, 11.6**
async fn check_executables_on_startup(app: tauri::AppHandle) {
    // Small delay to let the app fully initialize
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    
    match commands::executables::check_executables(app.clone()).await {
        Ok(result) => {
            if !result.all_available {
                tracing::warn!("Missing executables detected: {:?}", result.error);
                
                // Emit event to frontend
                let _ = app.emit(EVENT_EXECUTABLES_MISSING, ExecutablesMissingEvent {
                    ytdlp_available: result.ytdlp_available,
                    ffmpeg_available: result.ffmpeg_available,
                    ffprobe_available: result.ffprobe_available,
                    error: result.error.unwrap_or_else(|| "Unknown error".to_string()),
                });
            } else {
                tracing::info!(
                    "All executables available. yt-dlp: {:?}, ffmpeg: {:?}",
                    result.ytdlp_version,
                    result.ffmpeg_version
                );
            }
        }
        Err(e) => {
            tracing::error!("Failed to check executables: {}", e);
            let _ = app.emit(EVENT_EXECUTABLES_MISSING, ExecutablesMissingEvent {
                ytdlp_available: false,
                ffmpeg_available: false,
                ffprobe_available: false,
                error: e,
            });
        }
    }
}



/// Checks for yt-dlp updates on startup if enabled in preferences
/// 
/// **Validates: Requirements 7.7**
async fn check_for_updates_on_startup(app: tauri::AppHandle) {
    // Small delay to let the app fully initialize
    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
    
    // Check if update check is enabled in preferences
    let check_enabled = match app.store("preferences.json") {
        Ok(store) => {
            match store.get("preferences") {
                Some(value) => {
                    value.get("checkUpdatesOnStartup")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(true) // Default to true if not set
                }
                None => true, // Default to true if no preferences
            }
        }
        Err(_) => true, // Default to true if store fails
    };
    
    if !check_enabled {
        return;
    }
    
    // Perform the update check
    match commands::update::check_ytdlp_update().await {
        Ok(result) => {
            if result.update_available {
                // Emit event to frontend
                let _ = app.emit(EVENT_UPDATE_AVAILABLE, UpdateAvailableEvent {
                    current_version: result.current_version,
                    latest_version: result.latest_version,
                });
            }
        }
        Err(e) => {
            // Log error but don't bother the user
            eprintln!("Failed to check for yt-dlp updates: {}", e);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging system
    // **Validates: Requirements 10.1, 10.2**
    logging::init_logging();
    tracing::info!("MediaGrab starting up");
    
    let download_manager = create_download_manager();
    let manager_for_exit = download_manager.clone();

    // Create queue event channel
    let (queue_event_tx, queue_event_rx) = tokio::sync::mpsc::unbounded_channel();

    // Create download queue with max 3 concurrent downloads
    let download_queue = create_download_queue(3, queue_event_tx);
    let queue_for_processor = download_queue.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(download_manager)
        .manage(download_queue)
        .setup(move |app| {
            // Set up system tray
            setup_system_tray(app)?;

            // Set up queue event forwarding to frontend
            let app_handle_queue = app.handle().clone();
            setup_queue_events(app_handle_queue, queue_event_rx);

            // Start queue processor
            let app_handle_processor = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                start_queue_processor(app_handle_processor, queue_for_processor).await;
            });

            // Spawn background executable check
            // **Validates: Requirements 6.1, 11.6**
            let app_handle_exec = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                check_executables_on_startup(app_handle_exec).await;
            });

            // Spawn background yt-dlp update check
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                check_for_updates_on_startup(app_handle).await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            load_preferences,
            save_preferences,
            start_download,
            cancel_download,
            get_download_state,
            reset_download,
            fetch_media_info,
            pick_folder,
            check_folder_accessible,
            check_disk_space,
            validate_folder_for_download,
            open_folder,
            open_file,
            update_ytdlp,
            check_ytdlp_update,
            get_ytdlp_version_cmd,
            copy_debug_info,
            get_recent_logs,
            check_executables,
            get_executable_paths,
            // Queue commands
            queue_add,
            queue_get_all,
            queue_cancel,
            queue_remove,
            queue_clear_completed,
            queue_move_up,
            queue_move_down,
            // History commands
            history_add,
            history_get_all,
            history_get_stats,
            history_remove,
            history_clear,
            // Playlist commands
            check_is_playlist,
            fetch_playlist_info,
            // Subtitle commands
            fetch_subtitles,
            // App update commands
            check_app_update,
            install_app_update,
            get_app_version
        ])
        .on_window_event(|window, event| {
            // Handle window close - minimize to tray instead of closing
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Hide the window instead of closing
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_app_handle, event| {
            // Handle application exit
            // **Validates: Requirements 1.6**
            if let RunEvent::Exit = event {
                let manager = manager_for_exit.clone();
                
                // Terminate any active download before exiting
                tauri::async_runtime::block_on(async {
                    if manager.is_active().await {
                        let _ = manager.cancel().await;
                    }
                });
            }
            
            // Handle ExitRequested to ensure cleanup
            if let RunEvent::ExitRequested { .. } = event {
                let manager = manager_for_exit.clone();
                
                // Terminate any active download
                tauri::async_runtime::block_on(async {
                    if manager.is_active().await {
                        let _ = manager.cancel().await;
                    }
                });
                
                // Allow the exit to proceed
                // Note: We don't call api.prevent_exit() so the app will exit
            }
        });
}
