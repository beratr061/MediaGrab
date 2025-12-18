//! Progress event types

use serde::Serialize;

/// Progress event emitted during download
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEvent {
    /// Download percentage (0-100)
    pub percentage: f64,
    /// Bytes downloaded so far
    pub downloaded_bytes: u64,
    /// Total bytes (if known)
    pub total_bytes: Option<u64>,
    /// Download speed string (e.g., "2.5MiB/s")
    pub speed: String,
    /// Estimated time remaining in seconds
    pub eta_seconds: Option<u64>,
    /// Current status ("downloading" or "merging")
    pub status: String,
}
