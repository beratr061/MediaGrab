//! Download history commands
//!
//! Implements persistence of download history using tauri-plugin-store.

use serde::{Deserialize, Serialize};
use tauri_plugin_store::StoreExt;

const STORE_PATH: &str = "history.json";
const HISTORY_KEY: &str = "downloads";
const STATS_KEY: &str = "stats";
const MAX_HISTORY_ITEMS: usize = 500;

/// A single download history entry
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryItem {
    pub id: String,
    pub url: String,
    pub title: String,
    pub thumbnail: Option<String>,
    pub format: String,
    pub quality: String,
    pub file_path: Option<String>,
    pub file_size: Option<u64>,
    pub duration: Option<u64>,
    pub downloaded_at: i64, // Unix timestamp
    pub status: String,     // "completed" | "failed"
    pub error: Option<String>,
}

/// Download statistics
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DownloadStats {
    pub total_downloads: u64,
    pub successful_downloads: u64,
    pub failed_downloads: u64,
    pub total_bytes_downloaded: u64,
    pub total_duration_seconds: u64,
}

/// Add a download to history
#[tauri::command]
pub async fn history_add(item: HistoryItem, app: tauri::AppHandle) -> Result<(), String> {
    let store = app
        .store(STORE_PATH)
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

/// Get all download history
#[tauri::command]
pub async fn history_get_all(app: tauri::AppHandle) -> Result<Vec<HistoryItem>, String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| format!("Failed to open history store: {}", e))?;

    match store.get(HISTORY_KEY) {
        Some(value) => serde_json::from_value(value.clone())
            .map_err(|e| format!("Failed to parse history: {}", e)),
        None => Ok(Vec::new()),
    }
}

/// Get download statistics
#[tauri::command]
pub async fn history_get_stats(app: tauri::AppHandle) -> Result<DownloadStats, String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| format!("Failed to open history store: {}", e))?;

    match store.get(STATS_KEY) {
        Some(value) => serde_json::from_value(value.clone())
            .map_err(|e| format!("Failed to parse stats: {}", e)),
        None => Ok(DownloadStats::default()),
    }
}

/// Remove a single history item
#[tauri::command]
pub async fn history_remove(id: String, app: tauri::AppHandle) -> Result<(), String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| format!("Failed to open history store: {}", e))?;

    let mut history: Vec<HistoryItem> = match store.get(HISTORY_KEY) {
        Some(value) => serde_json::from_value(value.clone()).unwrap_or_default(),
        None => return Ok(()),
    };

    history.retain(|item| item.id != id);

    let value = serde_json::to_value(&history)
        .map_err(|e| format!("Failed to serialize history: {}", e))?;
    store.set(HISTORY_KEY, value);

    store
        .save()
        .map_err(|e| format!("Failed to save history: {}", e))?;

    Ok(())
}

/// Clear all history
#[tauri::command]
pub async fn history_clear(app: tauri::AppHandle) -> Result<(), String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| format!("Failed to open history store: {}", e))?;

    store.set(HISTORY_KEY, serde_json::json!([]));

    store
        .save()
        .map_err(|e| format!("Failed to save history: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_history_item_serialization() {
        let item = HistoryItem {
            id: "test-123".to_string(),
            url: "https://youtube.com/watch?v=test".to_string(),
            title: "Test Video".to_string(),
            thumbnail: Some("https://example.com/thumb.jpg".to_string()),
            format: "video-mp4".to_string(),
            quality: "1080p".to_string(),
            file_path: Some("C:\\Downloads\\test.mp4".to_string()),
            file_size: Some(1024 * 1024 * 100),
            duration: Some(300),
            downloaded_at: 1703001234,
            status: "completed".to_string(),
            error: None,
        };

        let json = serde_json::to_string(&item).unwrap();
        let parsed: HistoryItem = serde_json::from_str(&json).unwrap();

        assert_eq!(item.id, parsed.id);
        assert_eq!(item.title, parsed.title);
    }

    #[test]
    fn test_stats_default() {
        let stats = DownloadStats::default();
        assert_eq!(stats.total_downloads, 0);
        assert_eq!(stats.successful_downloads, 0);
        assert_eq!(stats.total_bytes_downloaded, 0);
    }
}
