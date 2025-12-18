//! Error types for download operations

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Categorized download errors
#[derive(Debug, Clone, Error, Serialize)]
#[serde(tag = "type", content = "message")]
pub enum DownloadError {
    #[error("Invalid URL: {0}")]
    InvalidUrl(String),
    
    #[error("Download already in progress")]
    AlreadyDownloading,
    
    #[error("Failed to spawn yt-dlp: {0}")]
    ProcessSpawnError(String),
    
    #[error("Download failed: {0}")]
    DownloadFailed(String),
    
    #[error("Output folder not accessible: {0}")]
    FolderNotAccessible(String),
    
    #[error("Bundled executable not found: {0}")]
    ExecutableNotFound(String),
    
    #[error("Video is private")]
    PrivateVideo,
    
    #[error("Age restricted content - try enabling cookie import")]
    AgeRestricted,
    
    #[error("Content not available in your region")]
    RegionLocked,
    
    #[error("Network error: {0}")]
    NetworkError(String),
    
    #[error("Video not found")]
    NotFound,
    
    #[error("{0}")]
    GenericError(String),
}

impl DownloadError {
    /// Get the error category for UI display
    pub fn category(&self) -> &'static str {
        match self {
            DownloadError::InvalidUrl(_) => "validation",
            DownloadError::AlreadyDownloading => "state",
            DownloadError::ProcessSpawnError(_) => "process",
            DownloadError::DownloadFailed(_) => "download",
            DownloadError::FolderNotAccessible(_) => "filesystem",
            DownloadError::ExecutableNotFound(_) => "dependency",
            DownloadError::PrivateVideo => "access",
            DownloadError::AgeRestricted => "access",
            DownloadError::RegionLocked => "access",
            DownloadError::NetworkError(_) => "network",
            DownloadError::NotFound => "not_found",
            DownloadError::GenericError(_) => "generic",
        }
    }
    
    /// Check if this error type supports retry
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            DownloadError::NetworkError(_) | DownloadError::DownloadFailed(_)
        )
    }
}

/// Retry configuration for failed downloads
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RetryConfig {
    /// Maximum number of retry attempts
    pub max_retries: u32,
    /// Initial delay between retries in milliseconds
    pub initial_delay_ms: u64,
    /// Maximum delay between retries in milliseconds
    pub max_delay_ms: u64,
    /// Backoff multiplier (delay = initial_delay * multiplier^attempt)
    pub backoff_multiplier: f64,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_retries: 3,
            initial_delay_ms: 1000,    // 1 second
            max_delay_ms: 30000,       // 30 seconds
            backoff_multiplier: 2.0,
        }
    }
}

impl RetryConfig {
    /// Calculate delay for a given attempt number (0-indexed)
    pub fn delay_for_attempt(&self, attempt: u32) -> u64 {
        let delay = self.initial_delay_ms as f64 * self.backoff_multiplier.powi(attempt as i32);
        (delay as u64).min(self.max_delay_ms)
    }
}
