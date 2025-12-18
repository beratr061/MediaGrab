//! Preferences load/save commands
//!
//! Implements persistence of user preferences using tauri-plugin-store.
//! Requirements: 9.1, 9.2, 9.3, 9.4

use serde::{Deserialize, Serialize};
use tauri_plugin_store::StoreExt;

/// User preferences - persisted settings
/// Matches TypeScript Preferences interface
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Preferences {
    /// Output folder path for downloads
    pub output_folder: String,
    /// Output format (video-mp4, audio-mp3, audio-best)
    pub format: String,
    /// Quality setting (best, 1080p, 720p)
    pub quality: String,
    /// Whether to embed subtitles
    pub embed_subtitles: bool,
    /// Browser to import cookies from (chrome, firefox, edge, etc.)
    pub cookies_from_browser: Option<String>,
    /// Whether to check for yt-dlp updates on startup
    #[serde(default = "default_check_updates")]
    pub check_updates_on_startup: bool,
    /// Whether proxy is enabled
    #[serde(default)]
    pub proxy_enabled: bool,
    /// Proxy URL (e.g., "http://127.0.0.1:8080" or "socks5://127.0.0.1:1080")
    #[serde(default)]
    pub proxy_url: Option<String>,
}

fn default_check_updates() -> bool {
    true
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            output_folder: get_default_downloads_folder(),
            format: "video-mp4".to_string(),
            quality: "best".to_string(),
            embed_subtitles: false,
            cookies_from_browser: None,
            check_updates_on_startup: true,
            proxy_enabled: false,
            proxy_url: None,
        }
    }
}

/// Get the default downloads folder for the current user
fn get_default_downloads_folder() -> String {
    dirs::download_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| {
            dirs::home_dir()
                .map(|p| p.join("Downloads").to_string_lossy().to_string())
                .unwrap_or_else(|| "C:\\Downloads".to_string())
        })
}


const STORE_PATH: &str = "preferences.json";
const PREFERENCES_KEY: &str = "preferences";

/// Load user preferences from persistent storage
/// 
/// Requirements: 9.3 - Restore previously saved preferences on launch
#[tauri::command]
pub async fn load_preferences(app: tauri::AppHandle) -> Result<Preferences, String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| format!("Failed to open preferences store: {}", e))?;
    
    match store.get(PREFERENCES_KEY) {
        Some(value) => {
            serde_json::from_value(value.clone())
                .map_err(|e| format!("Failed to parse preferences: {}", e))
        }
        None => {
            // Return default preferences if none saved
            Ok(Preferences::default())
        }
    }
}

/// Save user preferences to persistent storage
/// 
/// Requirements: 9.1, 9.2 - Persist output folder, format, and quality selections
#[tauri::command]
pub async fn save_preferences(
    preferences: Preferences,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| format!("Failed to open preferences store: {}", e))?;
    
    let value = serde_json::to_value(&preferences)
        .map_err(|e| format!("Failed to serialize preferences: {}", e))?;
    
    store.set(PREFERENCES_KEY, value);
    
    store
        .save()
        .map_err(|e| format!("Failed to save preferences: {}", e))?;
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_preferences() {
        let prefs = Preferences::default();
        assert_eq!(prefs.format, "video-mp4");
        assert_eq!(prefs.quality, "best");
        assert!(!prefs.embed_subtitles);
        assert!(prefs.cookies_from_browser.is_none());
        assert!(prefs.check_updates_on_startup);
    }

    #[test]
    fn test_preferences_serialization() {
        let prefs = Preferences {
            output_folder: "C:\\Downloads".to_string(),
            format: "audio-mp3".to_string(),
            quality: "720p".to_string(),
            embed_subtitles: true,
            cookies_from_browser: Some("chrome".to_string()),
            check_updates_on_startup: false,
        };
        
        let json = serde_json::to_string(&prefs).unwrap();
        let parsed: Preferences = serde_json::from_str(&json).unwrap();
        
        assert_eq!(prefs, parsed);
    }
    
    #[test]
    fn test_preferences_deserialization_with_missing_check_updates() {
        // Test that old preferences without checkUpdatesOnStartup still deserialize
        let json = r#"{
            "outputFolder": "C:\\Downloads",
            "format": "video-mp4",
            "quality": "best",
            "embedSubtitles": false,
            "cookiesFromBrowser": null
        }"#;
        
        let parsed: Preferences = serde_json::from_str(json).unwrap();
        
        // Should default to true
        assert!(parsed.check_updates_on_startup);
    }
}
