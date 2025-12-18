//! Download job management
//!
//! This module implements the download manager with state machine transitions
//! and single download constraint enforcement.
//!
//! **Validates: Requirements 1.5, 4.6**

use std::sync::Arc;
use tokio::process::Child;
use tokio::sync::{Mutex, RwLock};

use crate::models::{DownloadConfig, DownloadError, DownloadResult, DownloadState, ProgressEvent};

/// Active download job information
#[derive(Debug)]
pub struct ActiveDownload {
    /// The download configuration
    pub config: DownloadConfig,
    /// Path to the output file (set after download completes)
    pub output_path: Option<String>,
    /// Current retry attempt (0 = first attempt)
    pub retry_attempt: u32,
    /// Last error that caused a retry
    pub last_retry_error: Option<String>,
}

/// Download manager that enforces single download constraint and manages state
/// 
/// **Validates: Requirements 1.5, 4.6**
pub struct DownloadManager {
    /// Current download state (thread-safe read/write)
    state: RwLock<DownloadState>,
    /// Active download information (if any)
    active_download: RwLock<Option<ActiveDownload>>,
    /// Handle to the yt-dlp child process (for cancellation)
    process: Mutex<Option<Child>>,
    /// Last error message (for UI display)
    last_error: RwLock<Option<String>>,
    /// Last progress event
    last_progress: RwLock<Option<ProgressEvent>>,
}

impl DownloadManager {
    /// Creates a new download manager in idle state
    pub fn new() -> Self {
        Self {
            state: RwLock::new(DownloadState::Idle),
            active_download: RwLock::new(None),
            process: Mutex::new(None),
            last_error: RwLock::new(None),
            last_progress: RwLock::new(None),
        }
    }

    /// Gets the current download state
    pub async fn get_state(&self) -> DownloadState {
        *self.state.read().await
    }

    /// Checks if a download is currently active
    /// 
    /// **Validates: Requirements 1.5**
    pub async fn is_active(&self) -> bool {
        self.state.read().await.is_active()
    }


    /// Attempts to transition to a new state
    /// 
    /// Returns Ok(new_state) if the transition is valid, Err with the current state otherwise.
    /// 
    /// **Validates: Requirements 4.6**
    pub async fn transition_to(&self, target: DownloadState) -> Result<DownloadState, DownloadState> {
        let mut state = self.state.write().await;
        let current = *state;
        
        match current.transition_to(target) {
            Ok(new_state) => {
                *state = new_state;
                Ok(new_state)
            }
            Err(current_state) => Err(current_state),
        }
    }

    /// Attempts to start a new download
    /// 
    /// Returns an error if a download is already in progress.
    /// 
    /// **Validates: Requirements 1.5**
    pub async fn start_download(&self, config: DownloadConfig) -> Result<(), DownloadError> {
        // Check if we can start a new download
        let current_state = self.get_state().await;
        
        if current_state.is_active() {
            return Err(DownloadError::AlreadyDownloading);
        }
        
        // Transition to Starting state
        self.transition_to(DownloadState::Starting)
            .await
            .map_err(|_| DownloadError::AlreadyDownloading)?;
        
        // Store the active download info
        {
            let mut active = self.active_download.write().await;
            *active = Some(ActiveDownload {
                config,
                output_path: None,
                retry_attempt: 0,
                last_retry_error: None,
            });
        }
        
        // Clear any previous error
        {
            let mut error = self.last_error.write().await;
            *error = None;
        }
        
        // Clear previous progress
        {
            let mut progress = self.last_progress.write().await;
            *progress = None;
        }
        
        Ok(())
    }

    /// Sets the child process handle for cancellation support
    pub async fn set_process(&self, child: Child) {
        let mut process = self.process.lock().await;
        *process = Some(child);
    }

    /// Updates the progress event
    pub async fn update_progress(&self, event: ProgressEvent) {
        let mut progress = self.last_progress.write().await;
        *progress = Some(event);
    }

    /// Gets the last progress event
    pub async fn get_progress(&self) -> Option<ProgressEvent> {
        self.last_progress.read().await.clone()
    }

    /// Marks the download as completed successfully
    pub async fn complete(&self, file_path: String) -> Result<DownloadResult, DownloadError> {
        // Transition to Completed state
        self.transition_to(DownloadState::Completed)
            .await
            .map_err(|_| DownloadError::DownloadFailed("Invalid state transition".to_string()))?;
        
        // Update the output path
        {
            let mut active = self.active_download.write().await;
            if let Some(ref mut download) = *active {
                download.output_path = Some(file_path.clone());
            }
        }
        
        // Clear the process handle
        {
            let mut process = self.process.lock().await;
            *process = None;
        }
        
        Ok(DownloadResult {
            success: true,
            file_path: Some(file_path),
            error: None,
        })
    }


    /// Marks the download as failed with an error
    pub async fn fail(&self, error: DownloadError) -> DownloadResult {
        // Try to transition to Failed state (may fail if already in terminal state)
        let _ = self.transition_to(DownloadState::Failed).await;
        
        // Store the error message
        {
            let mut last_error = self.last_error.write().await;
            *last_error = Some(error.to_string());
        }
        
        // Clear the process handle
        {
            let mut process = self.process.lock().await;
            *process = None;
        }
        
        DownloadResult {
            success: false,
            file_path: None,
            error: Some(error.to_string()),
        }
    }

    /// Requests cancellation of the current download
    /// 
    /// **Validates: Requirements 1.4**
    pub async fn cancel(&self) -> Result<(), DownloadError> {
        let current_state = self.get_state().await;
        
        // Can only cancel from active states (except Cancelling)
        if !current_state.is_active() || current_state == DownloadState::Cancelling {
            return Err(DownloadError::GenericError("No active download to cancel".to_string()));
        }
        
        // Transition to Cancelling state
        self.transition_to(DownloadState::Cancelling)
            .await
            .map_err(|_| DownloadError::GenericError("Cannot cancel in current state".to_string()))?;
        
        // Kill the process if it exists
        {
            let mut process = self.process.lock().await;
            if let Some(ref mut child) = *process {
                // Try to kill the process
                let _ = child.kill().await;
            }
            *process = None;
        }
        
        // Transition to Cancelled state
        self.transition_to(DownloadState::Cancelled)
            .await
            .map_err(|_| DownloadError::GenericError("Failed to complete cancellation".to_string()))?;
        
        Ok(())
    }

    /// Resets the manager to idle state (for starting a new download)
    pub async fn reset(&self) -> Result<(), DownloadError> {
        let current_state = self.get_state().await;
        
        // Can only reset from terminal states
        if current_state.is_active() {
            return Err(DownloadError::AlreadyDownloading);
        }
        
        // Transition to Idle state
        self.transition_to(DownloadState::Idle)
            .await
            .map_err(|_| DownloadError::GenericError("Cannot reset in current state".to_string()))?;
        
        // Clear active download info
        {
            let mut active = self.active_download.write().await;
            *active = None;
        }
        
        // Clear error
        {
            let mut error = self.last_error.write().await;
            *error = None;
        }
        
        // Clear progress
        {
            let mut progress = self.last_progress.write().await;
            *progress = None;
        }
        
        Ok(())
    }

    /// Gets the active download configuration
    pub async fn get_active_download(&self) -> Option<DownloadConfig> {
        let active = self.active_download.read().await;
        active.as_ref().map(|d| d.config.clone())
    }

    /// Gets the last error message
    pub async fn get_last_error(&self) -> Option<String> {
        self.last_error.read().await.clone()
    }

    /// Gets the current retry attempt number
    pub async fn get_retry_attempt(&self) -> u32 {
        let active = self.active_download.read().await;
        active.as_ref().map(|d| d.retry_attempt).unwrap_or(0)
    }

    /// Increments the retry attempt counter and stores the error
    pub async fn increment_retry(&self, error: &DownloadError) {
        let mut active = self.active_download.write().await;
        if let Some(ref mut download) = *active {
            download.retry_attempt += 1;
            download.last_retry_error = Some(error.to_string());
        }
    }

    /// Prepares for a retry attempt by resetting state to Starting
    pub async fn prepare_retry(&self) -> Result<(), DownloadError> {
        // First transition to Idle, then to Starting
        let _ = self.transition_to(DownloadState::Idle).await;
        self.transition_to(DownloadState::Starting)
            .await
            .map_err(|_| DownloadError::GenericError("Cannot prepare for retry".to_string()))?;
        
        // Clear progress for fresh start
        {
            let mut progress = self.last_progress.write().await;
            *progress = None;
        }
        
        Ok(())
    }

    /// Transitions to downloading state (called when process starts successfully)
    pub async fn start_downloading(&self) -> Result<(), DownloadError> {
        self.transition_to(DownloadState::Downloading)
            .await
            .map_err(|_| DownloadError::GenericError("Invalid state transition".to_string()))?;
        Ok(())
    }

    /// Transitions to merging state
    pub async fn start_merging(&self) -> Result<(), DownloadError> {
        self.transition_to(DownloadState::Merging)
            .await
            .map_err(|_| DownloadError::GenericError("Invalid state transition".to_string()))?;
        Ok(())
    }
}

impl Default for DownloadManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Thread-safe wrapper for the download manager
pub type SharedDownloadManager = Arc<DownloadManager>;

/// Creates a new shared download manager
pub fn create_download_manager() -> SharedDownloadManager {
    Arc::new(DownloadManager::new())
}

#[cfg(test)]
mod tests;
