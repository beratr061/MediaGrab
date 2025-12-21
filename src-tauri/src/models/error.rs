//! Error types for application operations
//!
//! This module provides comprehensive error types for all application domains.
//! Each error type is serializable for frontend communication.

use serde::{Deserialize, Serialize};
use thiserror::Error;

// ============================================
// Download Errors
// ============================================

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
    
    #[error("Rate limited - please wait and try again")]
    RateLimited,
    
    #[error("Authentication required")]
    AuthenticationRequired,
    
    #[error("Unsupported URL: {0}")]
    UnsupportedUrl(String),
    
    #[error("Timeout: {0}")]
    Timeout(String),
    
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
            DownloadError::RateLimited => "rate_limit",
            DownloadError::AuthenticationRequired => "auth",
            DownloadError::UnsupportedUrl(_) => "validation",
            DownloadError::Timeout(_) => "network",
            DownloadError::GenericError(_) => "generic",
        }
    }
    
    /// Check if this error type supports retry
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            DownloadError::NetworkError(_) 
            | DownloadError::DownloadFailed(_)
            | DownloadError::RateLimited
            | DownloadError::Timeout(_)
        )
    }

    /// Get suggested action for the error
    pub fn suggested_action(&self) -> Option<&'static str> {
        match self {
            DownloadError::PrivateVideo => Some("Ensure you have access to this video"),
            DownloadError::AgeRestricted => Some("Enable cookie import in settings"),
            DownloadError::AuthenticationRequired => Some("Enable cookie import in settings"),
            DownloadError::RateLimited => Some("Wait a few minutes before retrying"),
            DownloadError::NetworkError(_) => Some("Check your internet connection"),
            DownloadError::FolderNotAccessible(_) => Some("Choose a different output folder"),
            DownloadError::ExecutableNotFound(_) => Some("Reinstall the application"),
            _ => None,
        }
    }
}

// ============================================
// Filesystem Errors
// ============================================

/// Filesystem operation errors
#[derive(Debug, Clone, Error, Serialize)]
#[serde(tag = "type", content = "message")]
pub enum FilesystemError {
    #[error("Folder does not exist: {0}")]
    FolderNotFound(String),
    
    #[error("Path is not a directory: {0}")]
    NotADirectory(String),
    
    #[error("Cannot write to folder: {0}")]
    NotWritable(String),
    
    #[error("File does not exist: {0}")]
    FileNotFound(String),
    
    #[error("Path is not a file: {0}")]
    NotAFile(String),
    
    #[error("Failed to get disk space: {0}")]
    DiskSpaceError(String),
    
    #[error("Failed to open file/folder: {0}")]
    OpenError(String),
    
    #[error("Permission denied: {0}")]
    PermissionDenied(String),
}

impl FilesystemError {
    /// Convert to String for backward compatibility with Tauri commands
    pub fn to_command_error(&self) -> String {
        self.to_string()
    }
}

// ============================================
// Preferences Errors
// ============================================

/// Preferences storage errors
#[derive(Debug, Clone, Error, Serialize)]
#[serde(tag = "type", content = "message")]
pub enum PreferencesError {
    #[error("Failed to open preferences store: {0}")]
    StoreOpenError(String),
    
    #[error("Failed to parse preferences: {0}")]
    ParseError(String),
    
    #[error("Failed to serialize preferences: {0}")]
    SerializeError(String),
    
    #[error("Failed to save preferences: {0}")]
    SaveError(String),
}

impl PreferencesError {
    /// Convert to String for backward compatibility
    pub fn to_command_error(&self) -> String {
        self.to_string()
    }
}

// ============================================
// Update Errors
// ============================================

/// yt-dlp and app update errors
#[derive(Debug, Clone, Error, Serialize)]
#[serde(tag = "type", content = "message")]
pub enum UpdateError {
    #[error("Failed to execute yt-dlp: {0}")]
    ExecutionError(String),
    
    #[error("Failed to spawn update process: {0}")]
    SpawnError(String),
    
    #[error("Failed to get version: {0}")]
    VersionError(String),
    
    #[error("Update failed: {0}")]
    UpdateFailed(String),
    
    #[error("Update check failed: {0}")]
    CheckFailed(String),
    
    #[error("App updater is not configured")]
    UpdaterNotConfigured,
    
    #[error("Network error during update: {0}")]
    NetworkError(String),
}

impl UpdateError {
    /// Convert to String for backward compatibility
    pub fn to_command_error(&self) -> String {
        self.to_string()
    }
}

// ============================================
// Queue Errors
// ============================================

/// Download queue operation errors
#[derive(Debug, Clone, Error, Serialize)]
#[serde(tag = "type", content = "message")]
pub enum QueueError {
    #[error("Queue item not found: {0}")]
    ItemNotFound(u64),
    
    #[error("Item cannot be cancelled (status: {0})")]
    CannotCancel(String),
    
    #[error("Item cannot be removed (status: {0})")]
    CannotRemove(String),
    
    #[error("Failed to save history: {0}")]
    HistorySaveError(String),
    
    #[error("Queue is full (max {0} items)")]
    QueueFull(usize),
    
    #[error("Invalid queue operation: {0}")]
    InvalidOperation(String),
}

impl QueueError {
    /// Convert to String for backward compatibility
    pub fn to_command_error(&self) -> String {
        self.to_string()
    }
}

// ============================================
// Media Info Errors
// ============================================

/// Media information fetching errors
#[derive(Debug, Clone, Error, Serialize)]
#[serde(tag = "type", content = "message")]
pub enum MediaInfoError {
    #[error("URL cannot be empty")]
    EmptyUrl,
    
    #[error("Failed to parse media info: {0}")]
    ParseError(String),
    
    #[error("Unsupported URL format: {0}")]
    UnsupportedUrl(String),
    
    #[error("Failed to fetch info: {0}")]
    FetchError(String),
    
    #[error("{0}")]
    Download(String), // Wraps DownloadError as string for simplicity
}

impl MediaInfoError {
    /// Convert to String for backward compatibility
    pub fn to_command_error(&self) -> String {
        self.to_string()
    }
    
    /// Create from a DownloadError
    pub fn from_download_error(err: DownloadError) -> Self {
        MediaInfoError::Download(err.to_string())
    }
}

// ============================================
// Unified App Error (for future use)
// ============================================

/// Unified application error type
/// 
/// This can be used as the return type for commands that may produce
/// different types of errors. Currently provided for future migration.
#[derive(Debug, Clone, Error, Serialize)]
#[serde(tag = "domain", content = "error")]
pub enum AppError {
    #[error("{0}")]
    Download(DownloadError),
    
    #[error("{0}")]
    Filesystem(FilesystemError),
    
    #[error("{0}")]
    Preferences(PreferencesError),
    
    #[error("{0}")]
    Update(UpdateError),
    
    #[error("{0}")]
    Queue(QueueError),
    
    #[error("{0}")]
    MediaInfo(MediaInfoError),
}

impl From<DownloadError> for AppError {
    fn from(err: DownloadError) -> Self {
        AppError::Download(err)
    }
}

impl From<FilesystemError> for AppError {
    fn from(err: FilesystemError) -> Self {
        AppError::Filesystem(err)
    }
}

impl From<PreferencesError> for AppError {
    fn from(err: PreferencesError) -> Self {
        AppError::Preferences(err)
    }
}

impl From<UpdateError> for AppError {
    fn from(err: UpdateError) -> Self {
        AppError::Update(err)
    }
}

impl From<QueueError> for AppError {
    fn from(err: QueueError) -> Self {
        AppError::Queue(err)
    }
}

impl From<MediaInfoError> for AppError {
    fn from(err: MediaInfoError) -> Self {
        AppError::MediaInfo(err)
    }
}

/// Convert AppError to String for backward compatibility with existing commands
impl From<AppError> for String {
    fn from(err: AppError) -> Self {
        err.to_string()
    }
}

// ============================================
// Retry Configuration
// ============================================

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

// ============================================
// Error Parsing Utilities
// ============================================

/// Parse yt-dlp stderr to create appropriate DownloadError
pub fn parse_ytdlp_error(stderr: &str) -> DownloadError {
    let stderr_lower = stderr.to_lowercase();
    
    if stderr_lower.contains("private video") || stderr_lower.contains("video is private") {
        return DownloadError::PrivateVideo;
    }
    
    if stderr_lower.contains("age") && (stderr_lower.contains("restricted") || stderr_lower.contains("verify") || stderr_lower.contains("confirm")) {
        return DownloadError::AgeRestricted;
    }
    
    if stderr_lower.contains("not available") && stderr_lower.contains("country") {
        return DownloadError::RegionLocked;
    }
    
    if stderr_lower.contains("video unavailable") || stderr_lower.contains("does not exist") {
        return DownloadError::NotFound;
    }
    
    if stderr_lower.contains("rate limit") || stderr_lower.contains("429") || stderr_lower.contains("too many requests") {
        return DownloadError::RateLimited;
    }
    
    if stderr_lower.contains("sign in") || stderr_lower.contains("login") || stderr_lower.contains("authentication") {
        return DownloadError::AuthenticationRequired;
    }
    
    if stderr_lower.contains("unsupported url") || stderr_lower.contains("no video formats") {
        let url = stderr.lines()
            .find(|line| line.contains("http"))
            .map(|s| s.to_string())
            .unwrap_or_else(|| "Unknown URL".to_string());
        return DownloadError::UnsupportedUrl(url);
    }
    
    if stderr_lower.contains("timed out") || stderr_lower.contains("timeout") {
        return DownloadError::Timeout(stderr.lines().next().unwrap_or("Connection timed out").to_string());
    }
    
    if stderr_lower.contains("unable to download") || stderr_lower.contains("connection") || stderr_lower.contains("network") {
        return DownloadError::NetworkError(stderr.lines().next().unwrap_or("Network error").to_string());
    }
    
    // Return the first ERROR line or generic error
    let error_line = stderr.lines()
        .find(|line| line.contains("ERROR"))
        .unwrap_or(stderr.lines().next().unwrap_or("Unknown error"));
    
    DownloadError::GenericError(error_line.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_download_error_category() {
        assert_eq!(DownloadError::InvalidUrl("test".into()).category(), "validation");
        assert_eq!(DownloadError::NetworkError("test".into()).category(), "network");
        assert_eq!(DownloadError::PrivateVideo.category(), "access");
        assert_eq!(DownloadError::RateLimited.category(), "rate_limit");
    }

    #[test]
    fn test_download_error_retryable() {
        assert!(DownloadError::NetworkError("test".into()).is_retryable());
        assert!(DownloadError::RateLimited.is_retryable());
        assert!(DownloadError::Timeout("test".into()).is_retryable());
        assert!(!DownloadError::PrivateVideo.is_retryable());
        assert!(!DownloadError::InvalidUrl("test".into()).is_retryable());
    }

    #[test]
    fn test_parse_ytdlp_error_private() {
        let stderr = "ERROR: [youtube] abc123: Private video. Sign in if you've been granted access";
        let error = parse_ytdlp_error(stderr);
        assert!(matches!(error, DownloadError::PrivateVideo));
    }

    #[test]
    fn test_parse_ytdlp_error_rate_limit() {
        let stderr = "ERROR: HTTP Error 429: Too Many Requests";
        let error = parse_ytdlp_error(stderr);
        assert!(matches!(error, DownloadError::RateLimited));
    }

    #[test]
    fn test_parse_ytdlp_error_network() {
        let stderr = "ERROR: Unable to download webpage: Connection refused";
        let error = parse_ytdlp_error(stderr);
        assert!(matches!(error, DownloadError::NetworkError(_)));
    }

    #[test]
    fn test_app_error_conversion() {
        let download_err = DownloadError::NotFound;
        let app_err: AppError = download_err.into();
        assert!(matches!(app_err, AppError::Download(DownloadError::NotFound)));
        
        let err_string: String = app_err.into();
        assert!(err_string.contains("not found"));
    }

    #[test]
    fn test_retry_config_delay() {
        let config = RetryConfig::default();
        assert_eq!(config.delay_for_attempt(0), 1000);
        assert_eq!(config.delay_for_attempt(1), 2000);
        assert_eq!(config.delay_for_attempt(2), 4000);
        assert_eq!(config.delay_for_attempt(10), 30000); // Capped at max
    }

    #[test]
    fn test_filesystem_error() {
        let err = FilesystemError::FolderNotFound("/path/to/folder".into());
        assert!(err.to_string().contains("does not exist"));
        assert!(err.to_command_error().contains("does not exist"));
    }

    #[test]
    fn test_suggested_action() {
        assert!(DownloadError::PrivateVideo.suggested_action().is_some());
        assert!(DownloadError::AgeRestricted.suggested_action().is_some());
        assert!(DownloadError::NotFound.suggested_action().is_none());
    }
}

