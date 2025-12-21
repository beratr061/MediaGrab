//! Media info fetching command
//!
//! This module implements the Tauri command for fetching media metadata
//! using yt-dlp --simulate -J.
//!
//! **Validates: Requirements 12.3**

use std::process::Stdio;

use crate::models::{DownloadError, MediaInfo};
use crate::utils::create_hidden_async_command;
use tauri_plugin_store::StoreExt;

/// Fetches media information from a URL using yt-dlp
///
/// Runs `yt-dlp --simulate -J <url>` to get JSON metadata without downloading.
/// Uses cookies from preferences if available (for Instagram, etc.)
///
/// **Validates: Requirements 12.3**
#[tauri::command]
pub async fn fetch_media_info(url: String, app: tauri::AppHandle) -> Result<MediaInfo, String> {
    if url.trim().is_empty() {
        return Err(DownloadError::InvalidUrl("URL cannot be empty".to_string()).to_string());
    }

    // Get cookies settings from preferences
    let (cookies_file_path, cookies_from_browser) = get_cookies_from_preferences(&app);

    // Build command arguments
    let mut args = vec!["--simulate", "-J", "--no-playlist"];
    
    // Add cookies arguments if available
    let cookies_file_arg: String;
    let cookies_browser_arg: String;
    
    if let Some(ref file_path) = cookies_file_path {
        cookies_file_arg = file_path.clone();
        args.push("--cookies");
        args.push(&cookies_file_arg);
    } else if let Some(ref browser) = cookies_from_browser {
        cookies_browser_arg = browser.clone();
        args.push("--cookies-from-browser");
        args.push(&cookies_browser_arg);
    }
    
    args.push(&url);

    // Run yt-dlp with --simulate -J to get JSON metadata (hidden window)
    let output = create_hidden_async_command("yt-dlp")
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                DownloadError::ExecutableNotFound("yt-dlp".to_string()).to_string()
            } else {
                DownloadError::ProcessSpawnError(e.to_string()).to_string()
            }
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(parse_ytdlp_error(&stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_media_info_json(&stdout)
}

/// Parses the JSON output from yt-dlp -J into MediaInfo
fn parse_media_info_json(json_str: &str) -> Result<MediaInfo, String> {
    let json: serde_json::Value = serde_json::from_str(json_str)
        .map_err(|e| format!("Failed to parse media info: {}", e))?;

    let title = json["title"]
        .as_str()
        .unwrap_or("Unknown Title")
        .to_string();

    // Try multiple sources for thumbnail:
    // 1. Direct thumbnail field
    // 2. thumbnails array (last item is usually highest quality)
    // 3. For Instagram: display_url field
    let thumbnail = json["thumbnail"]
        .as_str()
        .map(|s| s.to_string())
        .or_else(|| {
            // Try thumbnails array - get the last (highest quality) one
            json["thumbnails"]
                .as_array()
                .and_then(|arr| {
                    arr.iter()
                        .rev()
                        .find_map(|t| t["url"].as_str().map(|s| s.to_string()))
                })
        })
        .or_else(|| {
            // Instagram specific: display_url
            json["display_url"].as_str().map(|s| s.to_string())
        });

    let duration = json["duration"].as_f64();

    let uploader = json["uploader"]
        .as_str()
        .or_else(|| json["channel"].as_str())
        .map(|s| s.to_string());

    // Try multiple fields for file size approximation
    let filesize_approx = json["filesize_approx"]
        .as_u64()
        .or_else(|| json["filesize"].as_u64())
        .or_else(|| {
            // Calculate from formats if available
            json["formats"]
                .as_array()
                .and_then(|formats| {
                    formats.iter()
                        .filter_map(|f| f["filesize"].as_u64().or_else(|| f["filesize_approx"].as_u64()))
                        .max()
                })
        });

    Ok(MediaInfo {
        title,
        thumbnail,
        duration,
        uploader,
        filesize_approx,
    })
}

/// Gets cookies settings from preferences store
fn get_cookies_from_preferences(app: &tauri::AppHandle) -> (Option<String>, Option<String>) {
    let store = match app.store("preferences.json") {
        Ok(s) => s,
        Err(_) => return (None, None),
    };

    let prefs = match store.get("preferences") {
        Some(v) => v,
        None => return (None, None),
    };

    let cookies_file_path = prefs
        .get("cookiesFilePath")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());

    let cookies_from_browser = prefs
        .get("cookiesFromBrowser")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());

    (cookies_file_path, cookies_from_browser)
}

/// Parses yt-dlp stderr to extract a user-friendly error message
/// Uses the centralized error parser from models::error
fn parse_ytdlp_error(stderr: &str) -> String {
    crate::models::error::parse_ytdlp_error(stderr).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_media_info_json_complete() {
        let json = r#"{
            "title": "Test Video",
            "thumbnail": "https://example.com/thumb.jpg",
            "duration": 120.5,
            "uploader": "Test Channel",
            "filesize_approx": 1048576
        }"#;

        let info = parse_media_info_json(json).unwrap();
        assert_eq!(info.title, "Test Video");
        assert_eq!(info.thumbnail, Some("https://example.com/thumb.jpg".to_string()));
        assert_eq!(info.duration, Some(120.5));
        assert_eq!(info.uploader, Some("Test Channel".to_string()));
        assert_eq!(info.filesize_approx, Some(1048576));
    }

    #[test]
    fn test_parse_media_info_json_minimal() {
        let json = r#"{
            "title": "Minimal Video"
        }"#;

        let info = parse_media_info_json(json).unwrap();
        assert_eq!(info.title, "Minimal Video");
        assert!(info.thumbnail.is_none());
        assert!(info.duration.is_none());
        assert!(info.uploader.is_none());
        assert!(info.filesize_approx.is_none());
    }

    #[test]
    fn test_parse_media_info_json_with_channel() {
        let json = r#"{
            "title": "Test",
            "channel": "Channel Name"
        }"#;

        let info = parse_media_info_json(json).unwrap();
        assert_eq!(info.uploader, Some("Channel Name".to_string()));
    }

    #[test]
    fn test_parse_media_info_json_missing_title() {
        let json = r#"{}"#;

        let info = parse_media_info_json(json).unwrap();
        assert_eq!(info.title, "Unknown Title");
    }

    #[test]
    fn test_parse_ytdlp_error_private() {
        let stderr = "ERROR: [youtube] abc123: Private video. Sign in if you've been granted access";
        let error = parse_ytdlp_error(stderr);
        // Should contain "private" from DownloadError::PrivateVideo message
        assert!(error.to_lowercase().contains("private"), "Expected 'private' in error: {}", error);
    }

    #[test]
    fn test_parse_ytdlp_error_age_restricted() {
        let stderr = "ERROR: Sign in to confirm your age";
        let error = parse_ytdlp_error(stderr);
        // The error message comes from DownloadError::AgeRestricted which contains "Age restricted"
        assert!(error.to_lowercase().contains("age restricted"), "Expected 'age restricted' in error: {}", error);
    }

    #[test]
    fn test_parse_ytdlp_error_not_found() {
        let stderr = "ERROR: Video unavailable";
        let error = parse_ytdlp_error(stderr);
        // Should contain "not found" from DownloadError::NotFound message
        assert!(error.to_lowercase().contains("not found"), "Expected 'not found' in error: {}", error);
    }
}
