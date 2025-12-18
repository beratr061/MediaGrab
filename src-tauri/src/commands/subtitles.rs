//! Subtitle handling commands
//!
//! Implements subtitle listing and download options using yt-dlp.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Stdio;

use crate::utils::create_hidden_async_command;

/// A single subtitle track
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleTrack {
    /// Language code (e.g., "en", "tr", "de")
    pub lang_code: String,
    /// Language name (e.g., "English", "Turkish")
    pub lang_name: String,
    /// Whether this is auto-generated
    pub is_automatic: bool,
    /// Available formats for this subtitle
    pub formats: Vec<String>,
}

/// Subtitle information for a video
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleInfo {
    /// Available manual subtitles
    pub subtitles: Vec<SubtitleTrack>,
    /// Available auto-generated subtitles
    pub automatic_captions: Vec<SubtitleTrack>,
    /// Whether any subtitles are available
    pub has_subtitles: bool,
}

/// Subtitle download options
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleOptions {
    /// Whether to download subtitles
    pub download_subtitles: bool,
    /// Whether to embed subtitles in video
    pub embed_subtitles: bool,
    /// Selected language codes (empty = all)
    pub languages: Vec<String>,
    /// Output format: "srt", "vtt", "ass", or "best"
    pub format: String,
    /// Whether to include auto-generated captions
    pub include_auto: bool,
}

impl Default for SubtitleOptions {
    fn default() -> Self {
        Self {
            download_subtitles: false,
            embed_subtitles: false,
            languages: vec![],
            format: "srt".to_string(),
            include_auto: false,
        }
    }
}

/// Fetch available subtitles for a URL
#[tauri::command]
pub async fn fetch_subtitles(url: String) -> Result<SubtitleInfo, String> {
    if url.trim().is_empty() {
        return Err("URL cannot be empty".to_string());
    }

    // Use yt-dlp to list subtitles
    let output = create_hidden_async_command("yt-dlp")
        .args([
            "--list-subs",
            "-J",
            "--no-download",
            "--no-playlist",
            &url,
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("Failed to fetch subtitles: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "Failed to fetch subtitles: {}",
            stderr.lines().next().unwrap_or("Unknown error")
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_subtitle_json(&stdout)
}

/// Parse subtitle JSON from yt-dlp
fn parse_subtitle_json(json_str: &str) -> Result<SubtitleInfo, String> {
    let json: serde_json::Value =
        serde_json::from_str(json_str).map_err(|e| format!("Failed to parse subtitle info: {}", e))?;

    let mut subtitles = Vec::new();
    let mut automatic_captions = Vec::new();

    // Parse manual subtitles
    if let Some(subs) = json["subtitles"].as_object() {
        for (lang_code, formats) in subs {
            if let Some(formats_arr) = formats.as_array() {
                let track = parse_subtitle_track(lang_code, formats_arr, false);
                if !track.formats.is_empty() {
                    subtitles.push(track);
                }
            }
        }
    }

    // Parse automatic captions
    if let Some(auto_caps) = json["automatic_captions"].as_object() {
        for (lang_code, formats) in auto_caps {
            if let Some(formats_arr) = formats.as_array() {
                let track = parse_subtitle_track(lang_code, formats_arr, true);
                if !track.formats.is_empty() {
                    automatic_captions.push(track);
                }
            }
        }
    }

    // Sort by language code
    subtitles.sort_by(|a, b| a.lang_code.cmp(&b.lang_code));
    automatic_captions.sort_by(|a, b| a.lang_code.cmp(&b.lang_code));

    let has_subtitles = !subtitles.is_empty() || !automatic_captions.is_empty();

    Ok(SubtitleInfo {
        subtitles,
        automatic_captions,
        has_subtitles,
    })
}

/// Parse a single subtitle track from JSON
fn parse_subtitle_track(lang_code: &str, formats: &[serde_json::Value], is_automatic: bool) -> SubtitleTrack {
    let mut available_formats = Vec::new();

    for format in formats {
        if let Some(ext) = format["ext"].as_str() {
            if !available_formats.contains(&ext.to_string()) {
                available_formats.push(ext.to_string());
            }
        }
    }

    // Get language name from first format entry
    let lang_name = formats
        .first()
        .and_then(|f| f["name"].as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| get_language_name(lang_code));

    SubtitleTrack {
        lang_code: lang_code.to_string(),
        lang_name,
        is_automatic,
        formats: available_formats,
    }
}

/// Get human-readable language name from code
fn get_language_name(code: &str) -> String {
    let languages: HashMap<&str, &str> = [
        ("en", "English"),
        ("tr", "Türkçe"),
        ("de", "Deutsch"),
        ("fr", "Français"),
        ("es", "Español"),
        ("it", "Italiano"),
        ("pt", "Português"),
        ("ru", "Русский"),
        ("ja", "日本語"),
        ("ko", "한국어"),
        ("zh", "中文"),
        ("ar", "العربية"),
        ("hi", "हिन्दी"),
        ("nl", "Nederlands"),
        ("pl", "Polski"),
        ("sv", "Svenska"),
        ("no", "Norsk"),
        ("da", "Dansk"),
        ("fi", "Suomi"),
        ("cs", "Čeština"),
        ("el", "Ελληνικά"),
        ("he", "עברית"),
        ("th", "ไทย"),
        ("vi", "Tiếng Việt"),
        ("id", "Bahasa Indonesia"),
        ("ms", "Bahasa Melayu"),
        ("uk", "Українська"),
        ("ro", "Română"),
        ("hu", "Magyar"),
        ("bg", "Български"),
        ("hr", "Hrvatski"),
        ("sk", "Slovenčina"),
        ("sl", "Slovenščina"),
        ("sr", "Српски"),
        ("lt", "Lietuvių"),
        ("lv", "Latviešu"),
        ("et", "Eesti"),
    ]
    .into_iter()
    .collect();

    languages
        .get(code.split('-').next().unwrap_or(code))
        .map(|s| s.to_string())
        .unwrap_or_else(|| code.to_uppercase())
}

/// Build yt-dlp arguments for subtitle options
pub fn build_subtitle_args(options: &SubtitleOptions) -> Vec<String> {
    let mut args = Vec::new();

    if !options.download_subtitles && !options.embed_subtitles {
        return args;
    }

    // Write subtitles to file
    if options.download_subtitles {
        args.push("--write-subs".to_string());
        
        if options.include_auto {
            args.push("--write-auto-subs".to_string());
        }
    }

    // Embed subtitles in video
    if options.embed_subtitles {
        args.push("--embed-subs".to_string());
    }

    // Language selection
    if !options.languages.is_empty() {
        args.push("--sub-langs".to_string());
        args.push(options.languages.join(","));
    } else {
        args.push("--sub-langs".to_string());
        args.push("all".to_string());
    }

    // Output format
    if options.download_subtitles {
        args.push("--sub-format".to_string());
        match options.format.as_str() {
            "srt" => args.push("srt/best".to_string()),
            "vtt" => args.push("vtt/best".to_string()),
            "ass" => args.push("ass/best".to_string()),
            _ => args.push("srt/best".to_string()),
        }

        // Convert to requested format if needed
        args.push("--convert-subs".to_string());
        args.push(options.format.clone());
    }

    args
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_language_name() {
        assert_eq!(get_language_name("en"), "English");
        assert_eq!(get_language_name("tr"), "Türkçe");
        assert_eq!(get_language_name("en-US"), "English");
        assert_eq!(get_language_name("unknown"), "UNKNOWN");
    }

    #[test]
    fn test_build_subtitle_args_disabled() {
        let options = SubtitleOptions::default();
        let args = build_subtitle_args(&options);
        assert!(args.is_empty());
    }

    #[test]
    fn test_build_subtitle_args_download() {
        let options = SubtitleOptions {
            download_subtitles: true,
            embed_subtitles: false,
            languages: vec!["en".to_string(), "tr".to_string()],
            format: "srt".to_string(),
            include_auto: false,
        };
        let args = build_subtitle_args(&options);
        assert!(args.contains(&"--write-subs".to_string()));
        assert!(args.contains(&"--sub-langs".to_string()));
        assert!(args.contains(&"en,tr".to_string()));
        assert!(args.contains(&"--convert-subs".to_string()));
    }

    #[test]
    fn test_build_subtitle_args_embed() {
        let options = SubtitleOptions {
            download_subtitles: false,
            embed_subtitles: true,
            languages: vec![],
            format: "srt".to_string(),
            include_auto: false,
        };
        let args = build_subtitle_args(&options);
        assert!(args.contains(&"--embed-subs".to_string()));
        assert!(args.contains(&"all".to_string()));
    }

    #[test]
    fn test_build_subtitle_args_with_auto() {
        let options = SubtitleOptions {
            download_subtitles: true,
            embed_subtitles: false,
            languages: vec![],
            format: "vtt".to_string(),
            include_auto: true,
        };
        let args = build_subtitle_args(&options);
        assert!(args.contains(&"--write-auto-subs".to_string()));
        assert!(args.contains(&"vtt".to_string()));
    }
}
