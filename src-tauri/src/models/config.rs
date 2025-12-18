//! Download configuration types

use serde::{Deserialize, Serialize};

/// Media information fetched from a URL
/// 
/// **Validates: Requirements 12.3**
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaInfo {
    /// Video/audio title
    pub title: String,
    /// Thumbnail URL
    pub thumbnail: Option<String>,
    /// Duration in seconds
    pub duration: Option<f64>,
    /// Channel/uploader name
    pub uploader: Option<String>,
    /// Approximate file size in bytes
    pub filesize_approx: Option<u64>,
}

/// Download configuration sent from frontend
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadConfig {
    /// The URL to download from
    pub url: String,
    /// Output format (video-mp4, audio-mp3, audio-best)
    pub format: String,
    /// Quality setting (best, 1080p, 720p)
    pub quality: String,
    /// Output folder path
    pub output_folder: String,
    /// Whether to embed subtitles
    pub embed_subtitles: bool,
    /// Browser to import cookies from (chrome, firefox, edge, etc.)
    pub cookies_from_browser: Option<String>,
}

/// Result of a download operation
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadResult {
    /// Whether the download succeeded
    pub success: bool,
    /// Path to the downloaded file (if successful)
    pub file_path: Option<String>,
    /// Error message (if failed)
    pub error: Option<String>,
}
