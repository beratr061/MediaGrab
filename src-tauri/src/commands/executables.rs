//! Executable check commands
//!
//! This module implements commands for checking and managing bundled executables.
//!
//! **Validates: Requirements 6.1, 11.6**

use tauri::AppHandle;

use crate::utils::paths::{
    self, YTDLP_NAME, FFMPEG_NAME, FFPROBE_NAME,
};

/// Result of executable check
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutableCheckResult {
    /// Whether all executables are available
    pub all_available: bool,
    /// yt-dlp availability
    pub ytdlp_available: bool,
    /// ffmpeg availability
    pub ffmpeg_available: bool,
    /// ffprobe availability
    pub ffprobe_available: bool,
    /// Error message if any executable is missing
    pub error: Option<String>,
    /// yt-dlp version if available
    pub ytdlp_version: Option<String>,
    /// ffmpeg version if available
    pub ffmpeg_version: Option<String>,
}

/// Checks if all required executables are available
///
/// This command should be called on application startup to verify
/// that yt-dlp and ffmpeg are available.
///
/// **Validates: Requirements 6.1, 11.6**
#[tauri::command]
pub async fn check_executables(app: AppHandle) -> Result<ExecutableCheckResult, String> {
    let mut result = ExecutableCheckResult {
        all_available: false,
        ytdlp_available: false,
        ffmpeg_available: false,
        ffprobe_available: false,
        error: None,
        ytdlp_version: None,
        ffmpeg_version: None,
    };
    
    // Try to resolve all executable paths
    match paths::resolve_executable_paths(&app) {
        Ok(exec_paths) => {
            result.ytdlp_available = exec_paths.ytdlp.exists() || 
                which::which(format!("{}.exe", YTDLP_NAME)).is_ok() ||
                which::which(YTDLP_NAME).is_ok();
            result.ffmpeg_available = exec_paths.ffmpeg.exists() ||
                which::which(format!("{}.exe", FFMPEG_NAME)).is_ok() ||
                which::which(FFMPEG_NAME).is_ok();
            result.ffprobe_available = exec_paths.ffprobe.exists() ||
                which::which(format!("{}.exe", FFPROBE_NAME)).is_ok() ||
                which::which(FFPROBE_NAME).is_ok();
            
            // Get versions if available
            if result.ytdlp_available {
                if let Ok(version) = paths::get_ytdlp_version(&exec_paths.ytdlp).await {
                    result.ytdlp_version = Some(version);
                }
            }
            
            if result.ffmpeg_available {
                if let Ok(version) = paths::get_ffmpeg_version(&exec_paths.ffmpeg).await {
                    result.ffmpeg_version = Some(version);
                }
            }
            
            result.all_available = result.ytdlp_available && 
                                   result.ffmpeg_available && 
                                   result.ffprobe_available;
            
            if !result.all_available {
                let mut missing = Vec::new();
                if !result.ytdlp_available {
                    missing.push("yt-dlp");
                }
                if !result.ffmpeg_available {
                    missing.push("ffmpeg");
                }
                if !result.ffprobe_available {
                    missing.push("ffprobe");
                }
                result.error = Some(format!(
                    "Missing required executables: {}. Please ensure they are installed or bundled with the application.",
                    missing.join(", ")
                ));
            }
        }
        Err(e) => {
            result.error = Some(e.to_string());
        }
    }
    
    Ok(result)
}

/// Gets the paths to all executables
///
/// Returns the resolved paths for yt-dlp, ffmpeg, and ffprobe.
#[tauri::command]
pub async fn get_executable_paths(app: AppHandle) -> Result<ExecutablePathsResponse, String> {
    let exec_paths = paths::resolve_executable_paths(&app)
        .map_err(|e| e.to_string())?;
    
    Ok(ExecutablePathsResponse {
        ytdlp: exec_paths.ytdlp.to_string_lossy().to_string(),
        ffmpeg: exec_paths.ffmpeg.to_string_lossy().to_string(),
        ffprobe: exec_paths.ffprobe.to_string_lossy().to_string(),
        ffmpeg_dir: exec_paths.ffmpeg_dir.to_string_lossy().to_string(),
    })
}

/// Response for get_executable_paths command
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutablePathsResponse {
    pub ytdlp: String,
    pub ffmpeg: String,
    pub ffprobe: String,
    pub ffmpeg_dir: String,
}
