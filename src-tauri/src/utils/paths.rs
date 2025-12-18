//! Bundled executable path resolution
//!
//! This module handles locating bundled executables (yt-dlp, ffmpeg, ffprobe)
//! at runtime and copying them to a user-writable location for update support.
//!
//! **Validates: Requirements 7.3, 11.2**

use std::fs;
use std::path::{Path, PathBuf};
use std::io;

use tauri::Manager;

use crate::models::DownloadError;

/// Application identifier for data directory
const APP_IDENTIFIER: &str = "com.mediagrab";

/// Subdirectory for executables
const BIN_DIR: &str = "bin";

/// Executable names (without extension)
pub const YTDLP_NAME: &str = "yt-dlp";
pub const FFMPEG_NAME: &str = "ffmpeg";
pub const FFPROBE_NAME: &str = "ffprobe";

/// Result of executable resolution
#[derive(Debug, Clone)]
pub struct ExecutablePaths {
    /// Path to yt-dlp executable
    pub ytdlp: PathBuf,
    /// Path to ffmpeg executable
    pub ffmpeg: PathBuf,
    /// Path to ffprobe executable
    pub ffprobe: PathBuf,
    /// Directory containing ffmpeg (for --ffmpeg-location flag)
    pub ffmpeg_dir: PathBuf,
}

/// Gets the application data directory (%APPDATA%\com.mediagrab)
///
/// **Validates: Requirements 7.3**
pub fn get_app_data_dir() -> Result<PathBuf, DownloadError> {
    dirs::data_dir()
        .map(|p| p.join(APP_IDENTIFIER))
        .ok_or_else(|| {
            DownloadError::GenericError("Could not determine application data directory".to_string())
        })
}

/// Gets the user-writable bin directory (%APPDATA%\com.mediagrab\bin)
///
/// **Validates: Requirements 7.3**
pub fn get_user_bin_dir() -> Result<PathBuf, DownloadError> {
    get_app_data_dir().map(|p| p.join(BIN_DIR))
}

/// Gets the executable extension for the current platform
fn get_exe_extension() -> &'static str {
    if cfg!(windows) {
        ".exe"
    } else {
        ""
    }
}

/// Gets the target triple for the current platform
fn get_target_triple() -> &'static str {
    if cfg!(all(target_os = "windows", target_arch = "x86_64")) {
        "x86_64-pc-windows-msvc"
    } else if cfg!(all(target_os = "windows", target_arch = "aarch64")) {
        "aarch64-pc-windows-msvc"
    } else if cfg!(all(target_os = "macos", target_arch = "x86_64")) {
        "x86_64-apple-darwin"
    } else if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
        "aarch64-apple-darwin"
    } else if cfg!(all(target_os = "linux", target_arch = "x86_64")) {
        "x86_64-unknown-linux-gnu"
    } else {
        "unknown"
    }
}

/// Builds the sidecar binary name with target triple
fn get_sidecar_name(base_name: &str) -> String {
    let ext = get_exe_extension();
    let triple = get_target_triple();
    format!("{}-{}{}", base_name, triple, ext)
}

/// Gets the path to a bundled sidecar executable
///
/// In development, this looks in src-tauri/bin/
/// In production, this looks relative to the executable
fn get_bundled_executable_path(app_handle: &tauri::AppHandle, name: &str) -> Option<PathBuf> {
    let sidecar_name = get_sidecar_name(name);
    let simple_name = if cfg!(windows) {
        format!("{}.exe", name)
    } else {
        name.to_string()
    };
    
    // Get the resource directory
    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        // Try sidecar name first (with target triple)
        let sidecar_path = resource_dir.join(&sidecar_name);
        if sidecar_path.exists() {
            tracing::debug!("Found bundled executable at: {:?}", sidecar_path);
            return Some(sidecar_path);
        }
        // Try simple name
        let simple_path = resource_dir.join(&simple_name);
        if simple_path.exists() {
            tracing::debug!("Found bundled executable (simple name) at: {:?}", simple_path);
            return Some(simple_path);
        }
    }
    
    // Fallback: check in the directory containing the executable
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            // Try sidecar name
            let bin_path = exe_dir.join(&sidecar_name);
            if bin_path.exists() {
                tracing::debug!("Found executable in exe dir: {:?}", bin_path);
                return Some(bin_path);
            }
            // Try simple name (NSIS installer puts executables here with simple names)
            let simple_path = exe_dir.join(&simple_name);
            if simple_path.exists() {
                tracing::debug!("Found executable (simple name) in exe dir: {:?}", simple_path);
                return Some(simple_path);
            }
        }
    }
    
    None
}

/// Gets the path to an executable in the user bin directory
fn get_user_executable_path(name: &str) -> Result<PathBuf, DownloadError> {
    let ext = get_exe_extension();
    let user_bin = get_user_bin_dir()?;
    Ok(user_bin.join(format!("{}{}", name, ext)))
}

/// Copies a file from source to destination, creating parent directories if needed
fn copy_executable(src: &Path, dst: &Path) -> io::Result<()> {
    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(src, dst)?;
    
    // On Unix, make the file executable
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(dst)?.permissions();
        perms.set_mode(0o755);
        fs::set_permissions(dst, perms)?;
    }
    
    Ok(())
}

/// Ensures an executable exists in the user bin directory
///
/// If the executable doesn't exist in user bin, copies from bundled location.
/// Returns the path to the executable.
///
/// **Validates: Requirements 7.3, 11.2**
fn ensure_executable(
    app_handle: &tauri::AppHandle,
    name: &str,
) -> Result<PathBuf, DownloadError> {
    let user_path = get_user_executable_path(name)?;
    
    // If already exists in user directory, use it
    if user_path.exists() {
        tracing::debug!("Using existing executable: {:?}", user_path);
        return Ok(user_path);
    }
    
    // Try to find bundled executable
    if let Some(bundled_path) = get_bundled_executable_path(app_handle, name) {
        tracing::info!("Copying bundled {} to user directory", name);
        copy_executable(&bundled_path, &user_path).map_err(|e| {
            DownloadError::GenericError(format!(
                "Failed to copy {} to user directory: {}",
                name, e
            ))
        })?;
        return Ok(user_path);
    }
    
    // Fallback: try system PATH (for development)
    let exe_name = if cfg!(windows) {
        format!("{}.exe", name)
    } else {
        name.to_string()
    };
    
    if which::which(&exe_name).is_ok() {
        tracing::warn!(
            "Using system {} from PATH (bundled executable not found)",
            name
        );
        return Ok(PathBuf::from(&exe_name));
    }
    
    Err(DownloadError::ExecutableNotFound(name.to_string()))
}

/// Resolves all executable paths, copying bundled executables to user directory if needed
///
/// This function should be called on application startup to ensure all
/// executables are available in the user-writable location.
///
/// **Validates: Requirements 7.3, 11.2**
pub fn resolve_executable_paths(
    app_handle: &tauri::AppHandle,
) -> Result<ExecutablePaths, DownloadError> {
    let ytdlp = ensure_executable(app_handle, YTDLP_NAME)?;
    let ffmpeg = ensure_executable(app_handle, FFMPEG_NAME)?;
    let ffprobe = ensure_executable(app_handle, FFPROBE_NAME)?;
    
    // Get the directory containing ffmpeg for --ffmpeg-location
    let ffmpeg_dir = ffmpeg
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."));
    
    Ok(ExecutablePaths {
        ytdlp,
        ffmpeg,
        ffprobe,
        ffmpeg_dir,
    })
}

/// Checks if all required executables are available
///
/// Returns Ok(()) if all executables are found, or an error describing what's missing.
///
/// **Validates: Requirements 6.1, 11.6**
pub fn check_executables(app_handle: &tauri::AppHandle) -> Result<(), DownloadError> {
    let mut missing = Vec::new();
    
    // Check each executable
    for name in [YTDLP_NAME, FFMPEG_NAME, FFPROBE_NAME] {
        if ensure_executable(app_handle, name).is_err() {
            missing.push(name);
        }
    }
    
    if missing.is_empty() {
        Ok(())
    } else {
        Err(DownloadError::ExecutableNotFound(format!(
            "Missing required executables: {}",
            missing.join(", ")
        )))
    }
}

/// Gets the version of yt-dlp
///
/// Returns the version string or an error if yt-dlp is not available.
pub async fn get_ytdlp_version(ytdlp_path: &Path) -> Result<String, DownloadError> {
    use super::create_hidden_async_command;
    
    let output = create_hidden_async_command(ytdlp_path.to_str().unwrap_or("yt-dlp"))
        .arg("--version")
        .output()
        .await
        .map_err(|e| DownloadError::ExecutableNotFound(format!("Failed to run yt-dlp: {}", e)))?;
    
    if output.status.success() {
        let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(version)
    } else {
        Err(DownloadError::ExecutableNotFound(
            "yt-dlp returned non-zero exit code".to_string(),
        ))
    }
}

/// Gets the version of ffmpeg
///
/// Returns the version string or an error if ffmpeg is not available.
pub async fn get_ffmpeg_version(ffmpeg_path: &Path) -> Result<String, DownloadError> {
    use super::create_hidden_async_command;
    
    let output = create_hidden_async_command(ffmpeg_path.to_str().unwrap_or("ffmpeg"))
        .arg("-version")
        .output()
        .await
        .map_err(|e| DownloadError::ExecutableNotFound(format!("Failed to run ffmpeg: {}", e)))?;
    
    if output.status.success() {
        // ffmpeg -version outputs multiple lines, get the first one
        let full_output = String::from_utf8_lossy(&output.stdout);
        let version = full_output.lines().next().unwrap_or("unknown").to_string();
        Ok(version)
    } else {
        Err(DownloadError::ExecutableNotFound(
            "ffmpeg returned non-zero exit code".to_string(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_exe_extension() {
        let ext = get_exe_extension();
        if cfg!(windows) {
            assert_eq!(ext, ".exe");
        } else {
            assert_eq!(ext, "");
        }
    }

    #[test]
    fn test_get_target_triple() {
        let triple = get_target_triple();
        assert!(!triple.is_empty());
        // On Windows x64, should be x86_64-pc-windows-msvc
        if cfg!(all(target_os = "windows", target_arch = "x86_64")) {
            assert_eq!(triple, "x86_64-pc-windows-msvc");
        }
    }

    #[test]
    fn test_get_sidecar_name() {
        let name = get_sidecar_name("yt-dlp");
        if cfg!(all(target_os = "windows", target_arch = "x86_64")) {
            assert_eq!(name, "yt-dlp-x86_64-pc-windows-msvc.exe");
        }
    }

    #[test]
    fn test_get_app_data_dir() {
        let result = get_app_data_dir();
        assert!(result.is_ok());
        let path = result.unwrap();
        assert!(path.ends_with(APP_IDENTIFIER));
    }

    #[test]
    fn test_get_user_bin_dir() {
        let result = get_user_bin_dir();
        assert!(result.is_ok());
        let path = result.unwrap();
        assert!(path.ends_with(BIN_DIR));
    }

    #[test]
    fn test_get_user_executable_path() {
        let result = get_user_executable_path(YTDLP_NAME);
        assert!(result.is_ok());
        let path = result.unwrap();
        if cfg!(windows) {
            assert!(path.to_string_lossy().ends_with("yt-dlp.exe"));
        } else {
            assert!(path.to_string_lossy().ends_with("yt-dlp"));
        }
    }
}
