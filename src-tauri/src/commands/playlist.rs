//! Playlist handling commands
//!
//! Implements playlist detection and video listing using yt-dlp.

use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tauri_plugin_store::StoreExt;

use crate::utils::create_hidden_async_command;

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

/// A single video entry in a playlist
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistEntry {
    /// Video ID
    pub id: String,
    /// Video title
    pub title: String,
    /// Video URL
    pub url: String,
    /// Thumbnail URL
    pub thumbnail: Option<String>,
    /// Duration in seconds
    pub duration: Option<f64>,
    /// Position in playlist (1-indexed)
    pub playlist_index: u32,
    /// Uploader/channel name
    pub uploader: Option<String>,
}

/// Playlist information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistInfo {
    /// Playlist ID
    pub id: String,
    /// Playlist title
    pub title: String,
    /// Playlist URL
    pub url: String,
    /// Playlist thumbnail
    pub thumbnail: Option<String>,
    /// Channel/uploader name
    pub uploader: Option<String>,
    /// Total number of videos
    pub video_count: u32,
    /// List of videos in the playlist
    pub entries: Vec<PlaylistEntry>,
}

/// Check if a URL is a playlist
#[tauri::command]
pub async fn check_is_playlist(url: String, app: tauri::AppHandle) -> Result<bool, String> {
    if url.trim().is_empty() {
        return Ok(false);
    }

    // Common playlist URL patterns
    let url_lower = url.to_lowercase();
    
    // YouTube playlist patterns
    if url_lower.contains("youtube.com") || url_lower.contains("youtu.be") {
        if url_lower.contains("list=") {
            return Ok(true);
        }
        if url_lower.contains("/playlist") {
            return Ok(true);
        }
    }

    // Get cookies settings from preferences
    let (cookies_file_path, cookies_from_browser) = get_cookies_from_preferences(&app);

    // Build command arguments
    let mut args = vec!["--flat-playlist", "-J", "--no-download"];
    
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

    // For other sites, use yt-dlp to check
    let output = create_hidden_async_command("yt-dlp")
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("Failed to check URL: {}", e))?;

    if !output.status.success() {
        return Ok(false);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let json: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|_| "Failed to parse response")?;

    // Check if it's a playlist by looking for _type field
    Ok(json["_type"].as_str() == Some("playlist"))
}

/// Fetch playlist information and video list
#[tauri::command]
pub async fn fetch_playlist_info(url: String, app: tauri::AppHandle) -> Result<PlaylistInfo, String> {
    if url.trim().is_empty() {
        return Err("URL cannot be empty".to_string());
    }

    // Get cookies settings from preferences
    let (cookies_file_path, cookies_from_browser) = get_cookies_from_preferences(&app);

    // Build command arguments
    let mut args = vec!["--flat-playlist", "-J", "--no-download"];
    
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

    // Use --flat-playlist to get playlist info without downloading video details
    let output = create_hidden_async_command("yt-dlp")
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("Failed to fetch playlist: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to fetch playlist: {}", stderr.lines().next().unwrap_or("Unknown error")));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_playlist_json(&stdout)
}

/// Parse playlist JSON from yt-dlp
fn parse_playlist_json(json_str: &str) -> Result<PlaylistInfo, String> {
    let json: serde_json::Value = serde_json::from_str(json_str)
        .map_err(|e| format!("Failed to parse playlist info: {}", e))?;

    // Check if this is actually a playlist
    let playlist_type = json["_type"].as_str().unwrap_or("");
    if playlist_type != "playlist" {
        return Err("URL is not a playlist".to_string());
    }

    let id = json["id"].as_str().unwrap_or("").to_string();
    let title = json["title"].as_str().unwrap_or("Unknown Playlist").to_string();
    let url = json["webpage_url"].as_str()
        .or_else(|| json["url"].as_str())
        .unwrap_or("")
        .to_string();
    let thumbnail = json["thumbnail"].as_str().map(|s| s.to_string());
    let uploader = json["uploader"].as_str()
        .or_else(|| json["channel"].as_str())
        .map(|s| s.to_string());

    // Parse entries
    let entries: Vec<PlaylistEntry> = json["entries"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .enumerate()
                .filter_map(|(idx, entry)| {
                    // Skip unavailable videos
                    if entry["title"].as_str() == Some("[Deleted video]") ||
                       entry["title"].as_str() == Some("[Private video]") {
                        return None;
                    }

                    let video_id = entry["id"].as_str()?.to_string();
                    let video_title = entry["title"].as_str().unwrap_or("Unknown").to_string();
                    
                    // Build video URL
                    let video_url = entry["url"].as_str()
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| format!("https://www.youtube.com/watch?v={}", video_id));

                    Some(PlaylistEntry {
                        id: video_id,
                        title: video_title,
                        url: video_url,
                        thumbnail: entry["thumbnail"].as_str().map(|s| s.to_string()),
                        duration: entry["duration"].as_f64(),
                        playlist_index: (idx + 1) as u32,
                        uploader: entry["uploader"].as_str()
                            .or_else(|| entry["channel"].as_str())
                            .map(|s| s.to_string()),
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    let video_count = entries.len() as u32;

    Ok(PlaylistInfo {
        id,
        title,
        url,
        thumbnail,
        uploader,
        video_count,
        entries,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_playlist_json() {
        let json = r#"{
            "_type": "playlist",
            "id": "PLtest123",
            "title": "Test Playlist",
            "webpage_url": "https://www.youtube.com/playlist?list=PLtest123",
            "uploader": "Test Channel",
            "entries": [
                {
                    "id": "video1",
                    "title": "First Video",
                    "url": "https://www.youtube.com/watch?v=video1",
                    "duration": 120.0
                },
                {
                    "id": "video2",
                    "title": "Second Video",
                    "url": "https://www.youtube.com/watch?v=video2",
                    "duration": 180.0
                }
            ]
        }"#;

        let info = parse_playlist_json(json).unwrap();
        assert_eq!(info.id, "PLtest123");
        assert_eq!(info.title, "Test Playlist");
        assert_eq!(info.video_count, 2);
        assert_eq!(info.entries.len(), 2);
        assert_eq!(info.entries[0].title, "First Video");
        assert_eq!(info.entries[1].playlist_index, 2);
    }

    #[test]
    fn test_parse_playlist_skips_deleted() {
        let json = r#"{
            "_type": "playlist",
            "id": "PLtest",
            "title": "Test",
            "entries": [
                {"id": "v1", "title": "Good Video"},
                {"id": "v2", "title": "[Deleted video]"},
                {"id": "v3", "title": "[Private video]"},
                {"id": "v4", "title": "Another Good Video"}
            ]
        }"#;

        let info = parse_playlist_json(json).unwrap();
        assert_eq!(info.video_count, 2);
        assert_eq!(info.entries[0].title, "Good Video");
        assert_eq!(info.entries[1].title, "Another Good Video");
    }

    #[test]
    fn test_not_a_playlist() {
        let json = r#"{
            "_type": "video",
            "id": "abc123",
            "title": "Single Video"
        }"#;

        let result = parse_playlist_json(json);
        assert!(result.is_err());
    }
}
