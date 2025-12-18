//! yt-dlp argument builder module
//!
//! Builds command-line arguments for yt-dlp based on download configuration.
//! Requirements: 2.3, 2.4, 2.5, 12.1, 12.2, 12.4, 13.1, 6.5

use crate::models::DownloadConfig;

/// Filename template options
#[derive(Debug, Clone, PartialEq)]
pub enum FilenameTemplate {
    /// Just the title: "Video Title.ext"
    TitleOnly,
    /// Uploader and title: "Channel Name - Video Title.ext"
    UploaderTitle,
    /// Date and title: "20231215 - Video Title.ext"
    DateTitle,
}

impl Default for FilenameTemplate {
    fn default() -> Self {
        FilenameTemplate::TitleOnly
    }
}

impl FilenameTemplate {
    /// Returns the yt-dlp output template string
    pub fn to_template_string(&self) -> &'static str {
        match self {
            FilenameTemplate::TitleOnly => "%(title)s.%(ext)s",
            FilenameTemplate::UploaderTitle => "%(uploader)s - %(title)s.%(ext)s",
            FilenameTemplate::DateTitle => "%(upload_date)s - %(title)s.%(ext)s",
        }
    }
}

/// Builds yt-dlp command-line arguments from download configuration
pub struct ArgumentBuilder {
    config: DownloadConfig,
    filename_template: FilenameTemplate,
    ffmpeg_location: Option<String>,
}

impl ArgumentBuilder {
    /// Creates a new argument builder with the given configuration
    pub fn new(config: DownloadConfig) -> Self {
        Self {
            config,
            filename_template: FilenameTemplate::default(),
            ffmpeg_location: None,
        }
    }

    /// Sets the filename template
    pub fn with_filename_template(mut self, template: FilenameTemplate) -> Self {
        self.filename_template = template;
        self
    }


    /// Sets the ffmpeg location path
    pub fn with_ffmpeg_location(mut self, path: String) -> Self {
        self.ffmpeg_location = Some(path);
        self
    }

    /// Builds the format selector string based on format and quality settings
    /// 
    /// Requirements 2.3, 2.4, 2.5:
    /// - Video formats use quality-specific selectors with fallback
    /// - Audio formats use appropriate extraction flags
    fn build_format_selector(&self) -> String {
        match self.config.format.as_str() {
            "audio-mp3" => {
                // Best audio, will be converted to MP3
                "bestaudio/best".to_string()
            }
            "audio-best" => {
                // Best audio without re-encoding (Requirement 2.5)
                "bestaudio/best".to_string()
            }
            "video-mp4" | _ => {
                // Video format with quality-specific selector and fallback logic
                match self.config.quality.as_str() {
                    "1080p" => {
                        // Try 1080p, fallback to best available at or below 1080p, then any best
                        "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best".to_string()
                    }
                    "720p" => {
                        // Try 720p, fallback to best available at or below 720p, then any best
                        "bestvideo[height<=720]+bestaudio/best[height<=720]/best".to_string()
                    }
                    "best" | _ => {
                        // Best available quality
                        "bestvideo+bestaudio/best".to_string()
                    }
                }
            }
        }
    }

    /// Builds the complete argument list for yt-dlp
    pub fn build(&self) -> Vec<String> {
        let mut args: Vec<String> = Vec::new();

        // URL is always first positional argument
        args.push(self.config.url.clone());

        // Format selector (Requirements 2.3, 2.4)
        args.push("-f".to_string());
        args.push(self.build_format_selector());

        // Output template (Requirement 6.5)
        args.push("-o".to_string());
        args.push(self.filename_template.to_template_string().to_string());

        // Audio extraction for audio formats (Requirement 2.3)
        if self.config.format == "audio-mp3" {
            args.push("-x".to_string()); // Extract audio
            args.push("--audio-format".to_string());
            args.push("mp3".to_string());
        } else if self.config.format == "audio-best" {
            args.push("-x".to_string()); // Extract audio, keep original format
        }

        // Embed thumbnail (Requirement 12.1)
        args.push("--embed-thumbnail".to_string());

        // Embed metadata (Requirement 12.2)
        args.push("--add-metadata".to_string());

        // Embed subtitles if enabled (Requirement 12.4)
        if self.config.embed_subtitles {
            args.push("--embed-subs".to_string());
            args.push("--sub-langs".to_string());
            args.push("all".to_string());
        }

        // Cookies from browser if specified (Requirement 13.1)
        if let Some(ref browser) = self.config.cookies_from_browser {
            if !browser.is_empty() {
                args.push("--cookies-from-browser".to_string());
                args.push(browser.clone());
            }
        }

        // FFmpeg location if specified (Requirement 7.4)
        if let Some(ref ffmpeg_path) = self.ffmpeg_location {
            args.push("--ffmpeg-location".to_string());
            args.push(ffmpeg_path.clone());
        }

        // Merge output format for video (ensures MP4 container)
        if self.config.format == "video-mp4" {
            args.push("--merge-output-format".to_string());
            args.push("mp4".to_string());
        }

        // Progress template for structured output parsing
        args.push("--progress-template".to_string());
        args.push("download:%(progress._percent_str)s|%(progress._downloaded_bytes_str)s|%(progress._total_bytes_str)s|%(progress._speed_str)s|%(progress._eta_str)s".to_string());

        // No playlist - download single video only
        args.push("--no-playlist".to_string());

        // Windows-safe filenames - replace invalid characters (Requirement 6.4)
        args.push("--windows-filenames".to_string());

        // Force UTF-8 encoding for output to avoid cp1254 issues on Turkish Windows
        args.push("--encoding".to_string());
        args.push("utf-8".to_string());

        // Suppress non-critical warnings (nsig extraction, SABR streaming notices)
        // These are informational and don't affect download success
        args.push("--no-warnings".to_string());

        args
    }

    /// Returns just the format selector string (useful for testing)
    pub fn get_format_selector(&self) -> String {
        self.build_format_selector()
    }

    /// Checks if audio extraction is enabled based on format
    pub fn is_audio_extraction(&self) -> bool {
        matches!(self.config.format.as_str(), "audio-mp3" | "audio-best")
    }
}


