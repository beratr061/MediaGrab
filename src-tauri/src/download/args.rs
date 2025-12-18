//! yt-dlp argument builder module
//!
//! Builds command-line arguments for yt-dlp based on download configuration.
//! Requirements: 2.3, 2.4, 2.5, 12.1, 12.2, 12.4, 13.1, 6.5

use crate::models::DownloadConfig;

/// Converts a user-friendly filename template to yt-dlp format
/// 
/// Supported placeholders:
/// - {title} -> %(title)s
/// - {uploader} -> %(uploader)s
/// - {channel} -> %(channel)s
/// - {date} -> %(upload_date)s
/// - {quality} -> %(height)sp
/// - {resolution} -> %(resolution)s
/// - {duration} -> %(duration)s
/// - {id} -> %(id)s
/// - {playlist_index} -> %(playlist_index)s
/// - {ext} -> %(ext)s (automatically added if not present)
pub fn convert_template_to_ytdlp(template: &str) -> String {
    let mut result = template.to_string();
    
    // Replace user-friendly placeholders with yt-dlp format
    result = result.replace("{title}", "%(title)s");
    result = result.replace("{uploader}", "%(uploader)s");
    result = result.replace("{channel}", "%(channel)s");
    result = result.replace("{date}", "%(upload_date)s");
    result = result.replace("{quality}", "%(height)sp");
    result = result.replace("{resolution}", "%(resolution)s");
    result = result.replace("{duration}", "%(duration)s");
    result = result.replace("{id}", "%(id)s");
    result = result.replace("{playlist_index}", "%(playlist_index)s");
    result = result.replace("{ext}", "%(ext)s");
    
    // Ensure extension is present
    if !result.contains("%(ext)s") {
        result.push_str(".%(ext)s");
    }
    
    result
}

/// Default filename template
pub const DEFAULT_FILENAME_TEMPLATE: &str = "{title}";

/// Builds yt-dlp command-line arguments from download configuration
pub struct ArgumentBuilder {
    config: DownloadConfig,
    ffmpeg_location: Option<String>,
    proxy_url: Option<String>,
}

impl ArgumentBuilder {
    /// Creates a new argument builder with the given configuration
    pub fn new(config: DownloadConfig) -> Self {
        Self {
            config,
            ffmpeg_location: None,
            proxy_url: None,
        }
    }

    /// Sets the proxy URL
    pub fn with_proxy(mut self, proxy_url: Option<String>) -> Self {
        self.proxy_url = proxy_url;
        self
    }

    /// Sets the ffmpeg location path
    pub fn with_ffmpeg_location(mut self, path: String) -> Self {
        self.ffmpeg_location = Some(path);
        self
    }
    
    /// Gets the filename template string for yt-dlp
    fn get_filename_template(&self) -> String {
        match &self.config.filename_template {
            Some(template) if !template.is_empty() => convert_template_to_ytdlp(template),
            _ => "%(title)s.%(ext)s".to_string(), // Default template
        }
    }

    /// Builds the format selector string based on format and quality settings
    /// 
    /// Requirements 2.3, 2.4, 2.5:
    /// - Video formats use quality-specific selectors with fallback
    /// - Audio formats use appropriate extraction flags
    fn build_format_selector(&self) -> String {
        match self.config.format.as_str() {
            // Audio formats - all use bestaudio selector
            "audio-mp3" | "audio-aac" | "audio-opus" | "audio-flac" | "audio-wav" | "audio-best" => {
                "bestaudio/best".to_string()
            }
            // Video formats - use quality-specific selector
            "video-mp4" | "video-webm" | "video-mkv" | _ => {
                match self.config.quality.as_str() {
                    "1080p" => {
                        "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best".to_string()
                    }
                    "720p" => {
                        "bestvideo[height<=720]+bestaudio/best[height<=720]/best".to_string()
                    }
                    "best" | _ => {
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
        args.push(self.get_filename_template());

        // Audio extraction and format conversion
        match self.config.format.as_str() {
            "audio-mp3" => {
                args.push("-x".to_string());
                args.push("--audio-format".to_string());
                args.push("mp3".to_string());
                args.push("--audio-quality".to_string());
                args.push("0".to_string()); // Best quality
            }
            "audio-aac" => {
                args.push("-x".to_string());
                args.push("--audio-format".to_string());
                args.push("m4a".to_string()); // AAC in M4A container
                args.push("--audio-quality".to_string());
                args.push("0".to_string());
            }
            "audio-opus" => {
                args.push("-x".to_string());
                args.push("--audio-format".to_string());
                args.push("opus".to_string());
                args.push("--audio-quality".to_string());
                args.push("0".to_string());
            }
            "audio-flac" => {
                args.push("-x".to_string());
                args.push("--audio-format".to_string());
                args.push("flac".to_string());
            }
            "audio-wav" => {
                args.push("-x".to_string());
                args.push("--audio-format".to_string());
                args.push("wav".to_string());
            }
            "audio-best" => {
                args.push("-x".to_string()); // Extract audio, keep original format
            }
            _ => {} // Video formats don't need audio extraction
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

        // Proxy if specified
        if let Some(ref proxy) = self.proxy_url {
            if !proxy.is_empty() {
                args.push("--proxy".to_string());
                args.push(proxy.clone());
            }
        }

        // Merge output format for video formats
        match self.config.format.as_str() {
            "video-mp4" => {
                args.push("--merge-output-format".to_string());
                args.push("mp4".to_string());
            }
            "video-webm" => {
                args.push("--merge-output-format".to_string());
                args.push("webm".to_string());
            }
            "video-mkv" => {
                args.push("--merge-output-format".to_string());
                args.push("mkv".to_string());
            }
            _ => {} // Audio formats don't need merge output format
        }

        // Progress template for structured output parsing
        args.push("--progress-template".to_string());
        args.push("download:%(progress._percent_str)s|%(progress._downloaded_bytes_str)s|%(progress._total_bytes_str)s|%(progress._speed_str)s|%(progress._eta_str)s".to_string());

        // Print the final filename after download (for reliable file path detection)
        args.push("--print".to_string());
        args.push("after_move:filepath".to_string());

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

        // Resume support: continue partially downloaded files
        // This is default behavior but we make it explicit
        args.push("--continue".to_string());
        
        // Keep partial files on error/interrupt for resume capability
        args.push("--keep-fragments".to_string());
        
        // Retry fragment downloads on network errors
        args.push("--fragment-retries".to_string());
        args.push("10".to_string());
        
        // Retry on HTTP errors (5xx, 429, etc.)
        args.push("--retries".to_string());
        args.push("10".to_string());

        args
    }

    /// Returns just the format selector string (useful for testing)
    pub fn get_format_selector(&self) -> String {
        self.build_format_selector()
    }

    /// Checks if audio extraction is enabled based on format
    pub fn is_audio_extraction(&self) -> bool {
        matches!(
            self.config.format.as_str(),
            "audio-mp3" | "audio-best" | "audio-flac" | "audio-wav" | "audio-aac" | "audio-opus"
        )
    }
}


