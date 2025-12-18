//! Property tests for yt-dlp argument builder
//!
//! **Feature: MediaGrab, Property 4: yt-dlp Argument Builder Correctness**
//! **Validates: Requirements 2.3, 2.4**

use super::args::{ArgumentBuilder, FilenameTemplate};
use crate::models::DownloadConfig;
use proptest::prelude::*;

/// Generate arbitrary format values
fn arb_format() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("video-mp4".to_string()),
        Just("audio-mp3".to_string()),
        Just("audio-best".to_string()),
    ]
}

/// Generate arbitrary quality values
fn arb_quality() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("best".to_string()),
        Just("1080p".to_string()),
        Just("720p".to_string()),
    ]
}

/// Generate arbitrary browser values for cookies
fn arb_browser() -> impl Strategy<Value = Option<String>> {
    prop_oneof![
        Just(None),
        Just(Some("chrome".to_string())),
        Just(Some("firefox".to_string())),
        Just(Some("edge".to_string())),
        Just(Some("brave".to_string())),
    ]
}

/// Generate arbitrary filename templates
fn arb_filename_template() -> impl Strategy<Value = FilenameTemplate> {
    prop_oneof![
        Just(FilenameTemplate::TitleOnly),
        Just(FilenameTemplate::UploaderTitle),
        Just(FilenameTemplate::DateTitle),
    ]
}

/// Generate a valid download config
fn arb_download_config() -> impl Strategy<Value = DownloadConfig> {
    (
        "[a-zA-Z0-9]{5,20}".prop_map(|s| format!("https://youtube.com/watch?v={}", s)),
        arb_format(),
        arb_quality(),
        Just("C:\\Downloads".to_string()),
        any::<bool>(),
        arb_browser(),
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
                }
            },
        )
}


proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    /// **Feature: MediaGrab, Property 4: yt-dlp Argument Builder Correctness**
    ///
    /// For any valid combination of format (video/audio) and quality (best/1080p/720p),
    /// the argument builder SHALL produce a valid yt-dlp command-line argument array
    /// that includes the correct format selector string with fallback logic and audio
    /// extraction flags when applicable.
    ///
    /// **Validates: Requirements 2.3, 2.4**
    #[test]
    fn prop_argument_builder_produces_valid_format_selector(
        config in arb_download_config()
    ) {
        let builder = ArgumentBuilder::new(config.clone());
        let args = builder.build();

        // The arguments should always contain -f flag with format selector
        let f_index = args.iter().position(|a| a == "-f");
        prop_assert!(f_index.is_some(), "Arguments must contain -f flag");

        let format_selector = &args[f_index.unwrap() + 1];

        // Verify format selector based on format and quality
        match config.format.as_str() {
            "audio-mp3" | "audio-best" => {
                // Audio formats should use bestaudio selector
                prop_assert!(
                    format_selector.contains("bestaudio"),
                    "Audio format should use bestaudio selector, got: {}",
                    format_selector
                );
            }
            "video-mp4" => {
                match config.quality.as_str() {
                    "1080p" => {
                        // Should have height<=1080 constraint with fallback
                        prop_assert!(
                            format_selector.contains("height<=1080"),
                            "1080p quality should have height<=1080 constraint, got: {}",
                            format_selector
                        );
                        // Should have fallback logic (contains /)
                        prop_assert!(
                            format_selector.contains("/"),
                            "Format selector should have fallback logic, got: {}",
                            format_selector
                        );
                    }
                    "720p" => {
                        // Should have height<=720 constraint with fallback
                        prop_assert!(
                            format_selector.contains("height<=720"),
                            "720p quality should have height<=720 constraint, got: {}",
                            format_selector
                        );
                        // Should have fallback logic
                        prop_assert!(
                            format_selector.contains("/"),
                            "Format selector should have fallback logic, got: {}",
                            format_selector
                        );
                    }
                    "best" | _ => {
                        // Best quality should use bestvideo+bestaudio
                        prop_assert!(
                            format_selector.contains("bestvideo") && format_selector.contains("bestaudio"),
                            "Best quality should use bestvideo+bestaudio, got: {}",
                            format_selector
                        );
                    }
                }
            }
            _ => {
                // Unknown format defaults to video behavior
                prop_assert!(
                    format_selector.contains("bestvideo") || format_selector.contains("best"),
                    "Unknown format should default to video behavior, got: {}",
                    format_selector
                );
            }
        }
    }

    /// Property: Audio extraction flags are correctly set for audio formats
    ///
    /// **Validates: Requirements 2.3**
    #[test]
    fn prop_audio_extraction_flags_for_audio_formats(
        config in arb_download_config()
    ) {
        let builder = ArgumentBuilder::new(config.clone());
        let args = builder.build();

        let has_extract_audio = args.contains(&"-x".to_string());
        let has_audio_format_mp3 = args.windows(2).any(|w| w == ["--audio-format", "mp3"]);

        match config.format.as_str() {
            "audio-mp3" => {
                // MP3 format should have -x and --audio-format mp3
                prop_assert!(
                    has_extract_audio,
                    "audio-mp3 format should have -x flag"
                );
                prop_assert!(
                    has_audio_format_mp3,
                    "audio-mp3 format should have --audio-format mp3"
                );
            }
            "audio-best" => {
                // Best audio should have -x but NOT --audio-format (keep original)
                prop_assert!(
                    has_extract_audio,
                    "audio-best format should have -x flag"
                );
                prop_assert!(
                    !has_audio_format_mp3,
                    "audio-best format should NOT have --audio-format mp3"
                );
            }
            "video-mp4" | _ => {
                // Video formats should NOT have audio extraction
                prop_assert!(
                    !has_extract_audio,
                    "video format should NOT have -x flag"
                );
            }
        }
    }

    /// Property: Metadata and thumbnail embedding flags are always present
    ///
    /// **Validates: Requirements 12.1, 12.2**
    #[test]
    fn prop_metadata_and_thumbnail_flags_always_present(
        config in arb_download_config()
    ) {
        let builder = ArgumentBuilder::new(config);
        let args = builder.build();

        // Embed thumbnail should always be present (Requirement 12.1)
        prop_assert!(
            args.contains(&"--embed-thumbnail".to_string()),
            "Arguments should always contain --embed-thumbnail"
        );

        // Add metadata should always be present (Requirement 12.2)
        prop_assert!(
            args.contains(&"--add-metadata".to_string()),
            "Arguments should always contain --add-metadata"
        );
    }

    /// Property: Subtitle embedding is conditional on config
    ///
    /// **Validates: Requirements 12.4**
    #[test]
    fn prop_subtitle_embedding_conditional(
        config in arb_download_config()
    ) {
        let builder = ArgumentBuilder::new(config.clone());
        let args = builder.build();

        let has_embed_subs = args.contains(&"--embed-subs".to_string());

        if config.embed_subtitles {
            prop_assert!(
                has_embed_subs,
                "When embed_subtitles is true, --embed-subs should be present"
            );
        } else {
            prop_assert!(
                !has_embed_subs,
                "When embed_subtitles is false, --embed-subs should NOT be present"
            );
        }
    }

    /// Property: Cookies from browser is conditional on config
    ///
    /// **Validates: Requirements 13.1**
    #[test]
    fn prop_cookies_from_browser_conditional(
        config in arb_download_config()
    ) {
        let builder = ArgumentBuilder::new(config.clone());
        let args = builder.build();

        let has_cookies_flag = args.contains(&"--cookies-from-browser".to_string());

        match &config.cookies_from_browser {
            Some(browser) if !browser.is_empty() => {
                prop_assert!(
                    has_cookies_flag,
                    "When cookies_from_browser is set, --cookies-from-browser should be present"
                );
                // Verify the browser value follows the flag
                let cookie_index = args.iter().position(|a| a == "--cookies-from-browser");
                if let Some(idx) = cookie_index {
                    prop_assert_eq!(
                        &args[idx + 1],
                        browser,
                        "Browser value should match config"
                    );
                }
            }
            _ => {
                prop_assert!(
                    !has_cookies_flag,
                    "When cookies_from_browser is None/empty, --cookies-from-browser should NOT be present"
                );
            }
        }
    }

    /// Property: Filename template is correctly applied
    ///
    /// **Validates: Requirements 6.5**
    #[test]
    fn prop_filename_template_applied(
        config in arb_download_config(),
        template in arb_filename_template()
    ) {
        let builder = ArgumentBuilder::new(config)
            .with_filename_template(template.clone());
        let args = builder.build();

        // Find -o flag and verify template
        let o_index = args.iter().position(|a| a == "-o");
        prop_assert!(o_index.is_some(), "Arguments must contain -o flag");

        let output_template = &args[o_index.unwrap() + 1];
        let expected_template = template.to_template_string();

        prop_assert_eq!(
            output_template,
            expected_template,
            "Output template should match the configured template"
        );
    }

    /// Property: URL is always the first argument
    #[test]
    fn prop_url_is_first_argument(
        config in arb_download_config()
    ) {
        let builder = ArgumentBuilder::new(config.clone());
        let args = builder.build();

        prop_assert!(
            !args.is_empty(),
            "Arguments should not be empty"
        );
        prop_assert_eq!(
            &args[0],
            &config.url,
            "First argument should be the URL"
        );
    }

    /// Property: Video MP4 format includes merge output format
    #[test]
    fn prop_video_mp4_has_merge_output_format(
        config in arb_download_config()
    ) {
        let builder = ArgumentBuilder::new(config.clone());
        let args = builder.build();

        let has_merge_format = args.windows(2).any(|w| w == ["--merge-output-format", "mp4"]);

        if config.format == "video-mp4" {
            prop_assert!(
                has_merge_format,
                "video-mp4 format should have --merge-output-format mp4"
            );
        }
    }
}

#[cfg(test)]
mod unit_tests {
    use super::*;

    #[test]
    fn test_basic_video_download_args() {
        let config = DownloadConfig {
            url: "https://youtube.com/watch?v=test123".to_string(),
            format: "video-mp4".to_string(),
            quality: "best".to_string(),
            output_folder: "C:\\Downloads".to_string(),
            embed_subtitles: false,
            cookies_from_browser: None,
        };

        let builder = ArgumentBuilder::new(config);
        let args = builder.build();

        assert!(args.contains(&"https://youtube.com/watch?v=test123".to_string()));
        assert!(args.contains(&"-f".to_string()));
        assert!(args.contains(&"--embed-thumbnail".to_string()));
        assert!(args.contains(&"--add-metadata".to_string()));
        assert!(args.contains(&"--no-playlist".to_string()));
    }

    #[test]
    fn test_audio_mp3_extraction() {
        let config = DownloadConfig {
            url: "https://youtube.com/watch?v=test123".to_string(),
            format: "audio-mp3".to_string(),
            quality: "best".to_string(),
            output_folder: "C:\\Downloads".to_string(),
            embed_subtitles: false,
            cookies_from_browser: None,
        };

        let builder = ArgumentBuilder::new(config);
        let args = builder.build();

        assert!(args.contains(&"-x".to_string()));
        assert!(args.windows(2).any(|w| w == ["--audio-format", "mp3"]));
    }

    #[test]
    fn test_audio_best_no_reencode() {
        let config = DownloadConfig {
            url: "https://youtube.com/watch?v=test123".to_string(),
            format: "audio-best".to_string(),
            quality: "best".to_string(),
            output_folder: "C:\\Downloads".to_string(),
            embed_subtitles: false,
            cookies_from_browser: None,
        };

        let builder = ArgumentBuilder::new(config);
        let args = builder.build();

        assert!(args.contains(&"-x".to_string()));
        // Should NOT have --audio-format (keeps original)
        assert!(!args.windows(2).any(|w| w == ["--audio-format", "mp3"]));
    }

    #[test]
    fn test_quality_1080p_format_selector() {
        let config = DownloadConfig {
            url: "https://youtube.com/watch?v=test123".to_string(),
            format: "video-mp4".to_string(),
            quality: "1080p".to_string(),
            output_folder: "C:\\Downloads".to_string(),
            embed_subtitles: false,
            cookies_from_browser: None,
        };

        let builder = ArgumentBuilder::new(config);
        let format_selector = builder.get_format_selector();

        assert!(format_selector.contains("height<=1080"));
        assert!(format_selector.contains("bestvideo"));
        assert!(format_selector.contains("bestaudio"));
    }

    #[test]
    fn test_quality_720p_format_selector() {
        let config = DownloadConfig {
            url: "https://youtube.com/watch?v=test123".to_string(),
            format: "video-mp4".to_string(),
            quality: "720p".to_string(),
            output_folder: "C:\\Downloads".to_string(),
            embed_subtitles: false,
            cookies_from_browser: None,
        };

        let builder = ArgumentBuilder::new(config);
        let format_selector = builder.get_format_selector();

        assert!(format_selector.contains("height<=720"));
    }

    #[test]
    fn test_cookies_from_browser() {
        let config = DownloadConfig {
            url: "https://youtube.com/watch?v=test123".to_string(),
            format: "video-mp4".to_string(),
            quality: "best".to_string(),
            output_folder: "C:\\Downloads".to_string(),
            embed_subtitles: false,
            cookies_from_browser: Some("chrome".to_string()),
        };

        let builder = ArgumentBuilder::new(config);
        let args = builder.build();

        assert!(args.windows(2).any(|w| w == ["--cookies-from-browser", "chrome"]));
    }

    #[test]
    fn test_embed_subtitles() {
        let config = DownloadConfig {
            url: "https://youtube.com/watch?v=test123".to_string(),
            format: "video-mp4".to_string(),
            quality: "best".to_string(),
            output_folder: "C:\\Downloads".to_string(),
            embed_subtitles: true,
            cookies_from_browser: None,
        };

        let builder = ArgumentBuilder::new(config);
        let args = builder.build();

        assert!(args.contains(&"--embed-subs".to_string()));
        assert!(args.windows(2).any(|w| w == ["--sub-langs", "all"]));
    }

    #[test]
    fn test_ffmpeg_location() {
        let config = DownloadConfig {
            url: "https://youtube.com/watch?v=test123".to_string(),
            format: "video-mp4".to_string(),
            quality: "best".to_string(),
            output_folder: "C:\\Downloads".to_string(),
            embed_subtitles: false,
            cookies_from_browser: None,
        };

        let builder = ArgumentBuilder::new(config)
            .with_ffmpeg_location("C:\\ffmpeg\\bin".to_string());
        let args = builder.build();

        assert!(args.windows(2).any(|w| w == ["--ffmpeg-location", "C:\\ffmpeg\\bin"]));
    }

    #[test]
    fn test_filename_templates() {
        let config = DownloadConfig {
            url: "https://youtube.com/watch?v=test123".to_string(),
            format: "video-mp4".to_string(),
            quality: "best".to_string(),
            output_folder: "C:\\Downloads".to_string(),
            embed_subtitles: false,
            cookies_from_browser: None,
        };

        // Test TitleOnly
        let builder = ArgumentBuilder::new(config.clone())
            .with_filename_template(FilenameTemplate::TitleOnly);
        let args = builder.build();
        assert!(args.windows(2).any(|w| w == ["-o", "%(title)s.%(ext)s"]));

        // Test UploaderTitle
        let builder = ArgumentBuilder::new(config.clone())
            .with_filename_template(FilenameTemplate::UploaderTitle);
        let args = builder.build();
        assert!(args.windows(2).any(|w| w == ["-o", "%(uploader)s - %(title)s.%(ext)s"]));

        // Test DateTitle
        let builder = ArgumentBuilder::new(config)
            .with_filename_template(FilenameTemplate::DateTitle);
        let args = builder.build();
        assert!(args.windows(2).any(|w| w == ["-o", "%(upload_date)s - %(title)s.%(ext)s"]));
    }
}
