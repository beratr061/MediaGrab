//! Debug information commands
//!
//! This module provides commands for collecting and copying debug information
//! to help diagnose issues.
//!
//! **Validates: Requirements 10.4, 10.5**

use serde::Serialize;
use sysinfo::System;
use tauri_plugin_clipboard_manager::ClipboardExt;

use crate::utils::logging::{get_anonymized_recent_logs, anonymize_paths};
use crate::utils::create_hidden_command;

/// Debug information structure
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DebugInfo {
    /// Application version
    pub app_version: String,
    /// Operating system information
    pub os_info: String,
    /// Windows version
    pub windows_version: String,
    /// yt-dlp version (if available)
    pub ytdlp_version: Option<String>,
    /// ffmpeg version (if available)
    pub ffmpeg_version: Option<String>,
    /// Recent logs (anonymized)
    pub recent_logs: String,
    /// System memory info
    pub memory_info: String,
}

/// Gets the yt-dlp version by running yt-dlp --version
fn get_ytdlp_version() -> Option<String> {
    match create_hidden_command("yt-dlp").arg("--version").output() {
        Ok(output) => {
            if output.status.success() {
                Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
            } else {
                None
            }
        }
        Err(_) => None,
    }
}

/// Gets the ffmpeg version by running ffmpeg -version
fn get_ffmpeg_version() -> Option<String> {
    match create_hidden_command("ffmpeg").arg("-version").output() {
        Ok(output) => {
            if output.status.success() {
                // Extract just the first line which contains the version
                let full_output = String::from_utf8_lossy(&output.stdout);
                full_output.lines().next().map(|s| s.to_string())
            } else {
                None
            }
        }
        Err(_) => None,
    }
}

/// Gets Windows version information
fn get_windows_version() -> String {
    let mut sys = System::new();
    sys.refresh_all();
    
    let os_name = System::name().unwrap_or_else(|| "Unknown".to_string());
    let os_version = System::os_version().unwrap_or_else(|| "Unknown".to_string());
    let kernel_version = System::kernel_version().unwrap_or_else(|| "Unknown".to_string());
    
    format!("{} {} (Build {})", os_name, os_version, kernel_version)
}

/// Gets system memory information
fn get_memory_info() -> String {
    let mut sys = System::new();
    sys.refresh_memory();
    
    let total_memory = sys.total_memory() / 1024 / 1024; // Convert to MB
    let used_memory = sys.used_memory() / 1024 / 1024;
    let available_memory = sys.available_memory() / 1024 / 1024;
    
    format!(
        "Total: {} MB, Used: {} MB, Available: {} MB",
        total_memory, used_memory, available_memory
    )
}

/// Collects debug information and copies it to the clipboard
///
/// **Validates: Requirements 10.4, 10.5**
#[tauri::command]
pub async fn copy_debug_info(app: tauri::AppHandle) -> Result<DebugInfo, String> {
    tracing::info!("Collecting debug information");
    
    // Get app version from Cargo.toml
    let app_version = env!("CARGO_PKG_VERSION").to_string();
    
    // Get OS info
    let os_info = format!(
        "{} {}",
        std::env::consts::OS,
        std::env::consts::ARCH
    );
    
    // Get Windows version
    let windows_version = get_windows_version();
    
    // Get yt-dlp version
    let ytdlp_version = get_ytdlp_version();
    
    // Get ffmpeg version
    let ffmpeg_version = get_ffmpeg_version();
    
    // Get recent logs (anonymized)
    let recent_logs = get_anonymized_recent_logs(100);
    
    // Get memory info
    let memory_info = get_memory_info();
    
    let debug_info = DebugInfo {
        app_version: app_version.clone(),
        os_info: os_info.clone(),
        windows_version: windows_version.clone(),
        ytdlp_version: ytdlp_version.clone(),
        ffmpeg_version: ffmpeg_version.clone(),
        recent_logs: recent_logs.clone(),
        memory_info: memory_info.clone(),
    };
    
    // Format the debug info as a string for clipboard
    let debug_text = format_debug_info(&debug_info);
    
    // Copy to clipboard using Tauri plugin
    app.clipboard()
        .write_text(&debug_text)
        .map_err(|e| format!("Failed to copy to clipboard: {}", e))?;
    
    tracing::info!("Debug information copied to clipboard");
    
    Ok(debug_info)
}

/// Formats debug info as a readable string
fn format_debug_info(info: &DebugInfo) -> String {
    let mut output = String::new();
    
    output.push_str("=== MediaGrab Debug Information ===\n\n");
    
    output.push_str(&format!("App Version: {}\n", info.app_version));
    output.push_str(&format!("OS: {}\n", info.os_info));
    output.push_str(&format!("Windows Version: {}\n", info.windows_version));
    output.push_str(&format!("Memory: {}\n", info.memory_info));
    
    output.push_str(&format!(
        "yt-dlp Version: {}\n",
        info.ytdlp_version.as_deref().unwrap_or("Not found")
    ));
    output.push_str(&format!(
        "ffmpeg Version: {}\n",
        info.ffmpeg_version.as_deref().unwrap_or("Not found")
    ));
    
    output.push_str("\n=== Recent Logs ===\n\n");
    
    if info.recent_logs.is_empty() {
        output.push_str("No recent logs available.\n");
    } else {
        output.push_str(&info.recent_logs);
    }
    
    output.push_str("\n\n=== End of Debug Information ===\n");
    
    // Anonymize the entire output one more time to catch any missed paths
    anonymize_paths(&output)
}

/// Gets recent logs (anonymized) without copying to clipboard
///
/// **Validates: Requirements 10.4, 10.5**
#[tauri::command]
pub fn get_recent_logs(count: Option<usize>) -> String {
    let log_count = count.unwrap_or(50);
    get_anonymized_recent_logs(log_count)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_debug_info() {
        let info = DebugInfo {
            app_version: "0.1.0".to_string(),
            os_info: "windows x86_64".to_string(),
            windows_version: "Windows 11 23H2".to_string(),
            ytdlp_version: Some("2024.01.01".to_string()),
            ffmpeg_version: Some("ffmpeg version 6.0".to_string()),
            recent_logs: "Test log entry".to_string(),
            memory_info: "Total: 16384 MB, Used: 8192 MB, Available: 8192 MB".to_string(),
        };
        
        let formatted = format_debug_info(&info);
        
        assert!(formatted.contains("MediaGrab Debug Information"));
        assert!(formatted.contains("0.1.0"));
        assert!(formatted.contains("windows x86_64"));
        assert!(formatted.contains("2024.01.01"));
        assert!(formatted.contains("Test log entry"));
    }

    #[test]
    fn test_format_debug_info_missing_versions() {
        let info = DebugInfo {
            app_version: "0.1.0".to_string(),
            os_info: "windows x86_64".to_string(),
            windows_version: "Windows 11".to_string(),
            ytdlp_version: None,
            ffmpeg_version: None,
            recent_logs: String::new(),
            memory_info: "Total: 8192 MB".to_string(),
        };
        
        let formatted = format_debug_info(&info);
        
        assert!(formatted.contains("Not found"));
        assert!(formatted.contains("No recent logs available"));
    }
}
