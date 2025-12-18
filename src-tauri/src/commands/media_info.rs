//! Media info fetching command
//!
//! This module implements the Tauri command for fetching media metadata
//! using yt-dlp --simulate -J.
//!
//! **Validates: Requirements 12.3**

use std::process::Stdio;

use crate::models::{DownloadError, MediaInfo};
use crate::utils::create_hidden_async_command;

/// Fetches media information from a URL using yt-dlp
///
/// Runs `yt-dlp --simulate -J <url>` to get JSON metadata without downloading.
///
/// **Validates: Requirements 12.3**
#[tauri::command]
pub async fn fetch_media_info(url: String) -> Result<MediaInfo, String> {
    if url.trim().is_empty() {
        return Err(DownloadError::InvalidUrl("URL cannot be empty".to_string()).to_string());
    }

    // Run yt-dlp with --simulate -J to get JSON metadata (hidden window)
    let output = create_hidden_async_command("yt-dlp")
        .args(["--simulate", "-J", "--no-playlist", &url])
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

    let thumbnail = json["thumbnail"]
        .as_str()
        .map(|s| s.to_string());

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

/// Parses yt-dlp stderr to extract a user-friendly error message
fn parse_ytdlp_error(stderr: &str) -> String {
    let stderr_lower = stderr.to_lowercase();
    
    if stderr_lower.contains("private video") || stderr_lower.contains("video is private") {
        return DownloadError::PrivateVideo.to_string();
    }
    
    if stderr_lower.contains("age") && (stderr_lower.contains("restricted") || stderr_lower.contains("verify") || stderr_lower.contains("confirm")) {
        return DownloadError::AgeRestricted.to_string();
    }
    
    if stderr_lower.contains("not available") && stderr_lower.contains("country") {
        return DownloadError::RegionLocked.to_string();
    }
    
    if stderr_lower.contains("video unavailable") || stderr_lower.contains("does not exist") {
        return DownloadError::NotFound.to_string();
    }
    
    if stderr_lower.contains("unable to download") || stderr_lower.contains("connection") {
        return DownloadError::NetworkError(stderr.lines().next().unwrap_or("Network error").to_string()).to_string();
    }
    
    // Return the first line of stderr as a generic error
    stderr.lines()
        .find(|line| line.contains("ERROR"))
        .unwrap_or(stderr.lines().next().unwrap_or("Unknown error"))
        .to_string()
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
        assert!(error.contains("private"));
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
        assert!(error.contains("not found"));
    }
}
