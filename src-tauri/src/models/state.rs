//! Download state machine

use serde::Serialize;

/// Download job state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum DownloadState {
    /// No active download
    Idle,
    /// Fetching media info
    Analyzing,
    /// Starting the download process
    Starting,
    /// Actively downloading
    Downloading,
    /// Merging video and audio streams
    Merging,
    /// Download completed successfully
    Completed,
    /// Download was cancelled by user
    Cancelled,
    /// Cancellation in progress
    Cancelling,
    /// Download failed with error
    Failed,
}

impl DownloadState {
    /// Check if a transition to the target state is valid
    pub fn can_transition_to(&self, target: DownloadState) -> bool {
        use DownloadState::*;
        
        matches!(
            (self, target),
            // From Idle
            (Idle, Analyzing) |
            (Idle, Starting) |
            // From Analyzing
            (Analyzing, Idle) |
            (Analyzing, Starting) |
            (Analyzing, Failed) |
            // From Starting
            (Starting, Downloading) |
            (Starting, Failed) |
            // From Downloading
            (Downloading, Merging) |
            (Downloading, Completed) |
            (Downloading, Cancelling) |
            (Downloading, Failed) |
            // From Merging
            (Merging, Completed) |
            (Merging, Cancelling) |
            (Merging, Failed) |
            // From Cancelling
            (Cancelling, Cancelled) |
            // Reset transitions
            (Completed, Idle) |
            (Cancelled, Idle) |
            (Failed, Idle)
        )
    }
    
    /// Attempt to transition to a new state
    /// Returns Ok(new_state) if valid, Err(current_state) if invalid
    pub fn transition_to(self, target: DownloadState) -> Result<DownloadState, DownloadState> {
        if self.can_transition_to(target) {
            Ok(target)
        } else {
            Err(self)
        }
    }
    
    /// Check if a download is currently active (not in a terminal or idle state)
    pub fn is_active(&self) -> bool {
        use DownloadState::*;
        matches!(self, Analyzing | Starting | Downloading | Merging | Cancelling)
    }
}

impl Default for DownloadState {
    fn default() -> Self {
        DownloadState::Idle
    }
}

#[cfg(test)]
#[path = "tests.rs"]
mod tests;
