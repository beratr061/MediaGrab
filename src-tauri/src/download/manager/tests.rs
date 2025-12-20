//! Property tests for download manager
//!
//! **Feature: MediaGrab, Property 3: Single Download Constraint**
//! **Validates: Requirements 1.5**

use super::*;
use proptest::prelude::*;

/// Generate arbitrary download configurations
fn arb_download_config() -> impl Strategy<Value = DownloadConfig> {
    (
        "[a-zA-Z0-9]{5,20}".prop_map(|s| format!("https://youtube.com/watch?v={}", s)),
        prop_oneof![
            Just("video-mp4".to_string()),
            Just("audio-mp3".to_string()),
            Just("audio-best".to_string()),
        ],
        prop_oneof![
            Just("best".to_string()),
            Just("1080p".to_string()),
            Just("720p".to_string()),
        ],
        Just("C:\\Downloads".to_string()),
        any::<bool>(),
        prop_oneof![
            Just(None),
            Just(Some("chrome".to_string())),
            Just(Some("firefox".to_string())),
        ],
    )
        .prop_map(
            |(url, format, quality, output_folder, embed_subtitles, cookies_from_browser)| {
                DownloadConfig {
                    url,
                    format,
                    quality,
                    output_folder,
                    embed_subtitles,
                    cookies_from_browser,
                    filename_template: None,
                    proxy_url: None,
                    cookies_file_path: None,
                }
            },
        )
}

fn create_test_config() -> DownloadConfig {
    DownloadConfig {
        url: "https://youtube.com/watch?v=test".to_string(),
        format: "video-mp4".to_string(),
        quality: "best".to_string(),
        output_folder: "C:\\Downloads".to_string(),
        embed_subtitles: false,
        cookies_from_browser: None,
        filename_template: None,
        proxy_url: None,
        cookies_file_path: None,
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    /// **Feature: MediaGrab, Property 3: Single Download Constraint**
    ///
    /// For any download manager state where a download is active (state is not 'idle',
    /// 'completed', 'cancelled', or 'failed'), attempting to start a new download
    /// SHALL fail and return an error without affecting the current download.
    ///
    /// **Validates: Requirements 1.5**
    #[test]
    fn prop_single_download_constraint(
        config1 in arb_download_config(),
        config2 in arb_download_config()
    ) {
        // Use tokio runtime for async tests
        let rt = tokio::runtime::Runtime::new().unwrap();
        
        rt.block_on(async {
            let manager = DownloadManager::new();
            
            // Start first download
            let result1 = manager.start_download(config1.clone()).await;
            prop_assert!(result1.is_ok(), "First download should start successfully");
            
            // Verify state is Starting (active)
            let state = manager.get_state().await;
            prop_assert!(state.is_active(), "State should be active after starting download");
            
            // Attempt to start second download while first is active
            let result2 = manager.start_download(config2).await;
            
            // Second download should fail with AlreadyDownloading error
            prop_assert!(
                result2.is_err(),
                "Second download should fail when one is already active"
            );
            
            if let Err(error) = result2 {
                prop_assert!(
                    matches!(error, DownloadError::AlreadyDownloading),
                    "Error should be AlreadyDownloading, got: {:?}",
                    error
                );
            }
            
            // Original download config should be preserved
            let active_config = manager.get_active_download().await;
            prop_assert!(active_config.is_some(), "Active download should still exist");
            prop_assert_eq!(
                active_config.unwrap().url,
                config1.url,
                "Original download URL should be preserved"
            );
            
            Ok(())
        })?;
    }

    /// Property: Can start new download after previous completes
    #[test]
    fn prop_can_start_after_completion(
        config1 in arb_download_config(),
        config2 in arb_download_config()
    ) {
        let rt = tokio::runtime::Runtime::new().unwrap();
        
        rt.block_on(async {
            let manager = DownloadManager::new();
            
            // Start and complete first download
            manager.start_download(config1).await.unwrap();
            manager.start_downloading().await.unwrap();
            manager.complete("C:\\Downloads\\video.mp4".to_string()).await.unwrap();
            
            // Reset to idle
            manager.reset().await.unwrap();
            
            // Should be able to start second download
            let result = manager.start_download(config2).await;
            prop_assert!(result.is_ok(), "Should be able to start download after completion and reset");
            
            Ok(())
        })?;
    }

    /// Property: Can start new download after previous fails
    #[test]
    fn prop_can_start_after_failure(
        config1 in arb_download_config(),
        config2 in arb_download_config()
    ) {
        let rt = tokio::runtime::Runtime::new().unwrap();
        
        rt.block_on(async {
            let manager = DownloadManager::new();
            
            // Start and fail first download
            manager.start_download(config1).await.unwrap();
            manager.start_downloading().await.unwrap();
            manager.fail(DownloadError::NetworkError("Test error".to_string())).await;
            
            // Reset to idle
            manager.reset().await.unwrap();
            
            // Should be able to start second download
            let result = manager.start_download(config2).await;
            prop_assert!(result.is_ok(), "Should be able to start download after failure and reset");
            
            Ok(())
        })?;
    }

    /// Property: Can start new download after previous is cancelled
    #[test]
    fn prop_can_start_after_cancellation(
        config1 in arb_download_config(),
        config2 in arb_download_config()
    ) {
        let rt = tokio::runtime::Runtime::new().unwrap();
        
        rt.block_on(async {
            let manager = DownloadManager::new();
            
            // Start and cancel first download
            manager.start_download(config1).await.unwrap();
            manager.start_downloading().await.unwrap();
            manager.cancel().await.unwrap();
            
            // Reset to idle
            manager.reset().await.unwrap();
            
            // Should be able to start second download
            let result = manager.start_download(config2).await;
            prop_assert!(result.is_ok(), "Should be able to start download after cancellation and reset");
            
            Ok(())
        })?;
    }
}

#[cfg(test)]
mod unit_tests {
    use super::*;

    #[tokio::test]
    async fn test_new_manager_is_idle() {
        let manager = DownloadManager::new();
        assert_eq!(manager.get_state().await, DownloadState::Idle);
        assert!(!manager.is_active().await);
    }

    #[tokio::test]
    async fn test_start_download_transitions_to_starting() {
        let manager = DownloadManager::new();
        let config = create_test_config();

        manager.start_download(config).await.unwrap();
        assert_eq!(manager.get_state().await, DownloadState::Starting);
        assert!(manager.is_active().await);
    }

    #[tokio::test]
    async fn test_cannot_start_while_active() {
        let manager = DownloadManager::new();
        let config1 = create_test_config();
        let mut config2 = create_test_config();
        config2.url = "https://youtube.com/watch?v=test2".to_string();
        config2.format = "audio-mp3".to_string();

        manager.start_download(config1).await.unwrap();
        let result = manager.start_download(config2).await;
        
        assert!(matches!(result, Err(DownloadError::AlreadyDownloading)));
    }

    #[tokio::test]
    async fn test_complete_download_flow() {
        let manager = DownloadManager::new();
        let config = create_test_config();

        // Start download
        manager.start_download(config).await.unwrap();
        assert_eq!(manager.get_state().await, DownloadState::Starting);

        // Transition to downloading
        manager.start_downloading().await.unwrap();
        assert_eq!(manager.get_state().await, DownloadState::Downloading);

        // Transition to merging
        manager.start_merging().await.unwrap();
        assert_eq!(manager.get_state().await, DownloadState::Merging);

        // Complete
        let result = manager.complete("C:\\Downloads\\video.mp4".to_string()).await.unwrap();
        assert!(result.success);
        assert_eq!(result.file_path, Some("C:\\Downloads\\video.mp4".to_string()));
        assert_eq!(manager.get_state().await, DownloadState::Completed);
    }

    #[tokio::test]
    async fn test_cancel_download() {
        let manager = DownloadManager::new();
        let config = create_test_config();

        manager.start_download(config).await.unwrap();
        manager.start_downloading().await.unwrap();
        
        manager.cancel().await.unwrap();
        assert_eq!(manager.get_state().await, DownloadState::Cancelled);
    }

    #[tokio::test]
    async fn test_fail_download() {
        let manager = DownloadManager::new();
        let config = create_test_config();

        manager.start_download(config).await.unwrap();
        manager.start_downloading().await.unwrap();
        
        let result = manager.fail(DownloadError::NetworkError("Connection failed".to_string())).await;
        assert!(!result.success);
        assert!(result.error.is_some());
        assert_eq!(manager.get_state().await, DownloadState::Failed);
    }

    #[tokio::test]
    async fn test_reset_after_completion() {
        let manager = DownloadManager::new();
        let config = create_test_config();

        manager.start_download(config).await.unwrap();
        manager.start_downloading().await.unwrap();
        manager.complete("C:\\Downloads\\video.mp4".to_string()).await.unwrap();
        
        manager.reset().await.unwrap();
        assert_eq!(manager.get_state().await, DownloadState::Idle);
        assert!(manager.get_active_download().await.is_none());
    }

    #[tokio::test]
    async fn test_cannot_reset_while_active() {
        let manager = DownloadManager::new();
        let config = create_test_config();

        manager.start_download(config).await.unwrap();
        manager.start_downloading().await.unwrap();
        
        let result = manager.reset().await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_progress_update() {
        let manager = DownloadManager::new();
        
        let progress = ProgressEvent {
            percentage: 50.0,
            downloaded_bytes: 1024 * 1024,
            total_bytes: Some(2 * 1024 * 1024),
            speed: "1.0MiB/s".to_string(),
            eta_seconds: Some(60),
            status: "downloading".to_string(),
        };
        
        manager.update_progress(progress.clone()).await;
        
        let retrieved = manager.get_progress().await;
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().percentage, 50.0);
    }
}
