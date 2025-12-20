//! yt-dlp output parser
//!
//! This module handles parsing of yt-dlp stdout progress output and stderr error messages.
//! 
//! Progress format expected from --progress-template:
//! `download:45.2%|12345678|52345678|2.5MiB/s|00:12`
//! 
//! Where downloaded and total bytes are raw numbers (not formatted strings).
//!
//! **Validates: Requirements 4.2, 4.5, 6.3**

use crate::models::{DownloadError, ProgressEvent};

/// Result of parsing a progress line
#[derive(Debug, Clone, PartialEq)]
pub enum ParsedLine {
    /// A progress update during download
    Progress(ProgressEvent),
    /// Merging state detected
    Merging,
    /// Line could not be parsed (not an error, just not progress data)
    Unknown,
}

/// Parse a single line of yt-dlp stdout output
///
/// Handles two formats:
/// 1. Default yt-dlp format: `[download]  45.2% of  52.3MiB at  2.5MiB/s ETA 00:12`
/// 2. Pipe-delimited format: `45.2%|12345678|52345678|2.5MiB/s|00:12`
///
/// Note: For fragment-based downloads, percentage may be "NA"
pub fn parse_progress_line(line: &str) -> ParsedLine {
    let line = line.trim();
    
    // Check for merging state
    if line.contains("[Merger]") || line.contains("Merging") || line.contains("[ffmpeg]") {
        return ParsedLine::Merging;
    }
    
    // Try to parse default yt-dlp download format first
    // Format: [download]  45.2% of  52.3MiB at  2.5MiB/s ETA 00:12
    if line.starts_with("[download]") && line.contains('%') {
        return parse_default_download_line(line);
    }
    
    // Try pipe-delimited format (legacy/custom template)
    if line.contains('|') && !line.starts_with('[') {
        return parse_pipe_delimited_line(line);
    }
    
    // Also check for "download:" prefix (custom template output)
    if line.starts_with("download:") {
        let data = &line[9..]; // Skip "download:"
        if data.contains('|') {
            return parse_pipe_delimited_line(data);
        }
    }
    
    ParsedLine::Unknown
}

/// Parse default yt-dlp download format
/// Format: [download]  45.2% of  52.3MiB at  2.5MiB/s ETA 00:12
fn parse_default_download_line(line: &str) -> ParsedLine {
    // Remove [download] prefix
    let content = line.trim_start_matches("[download]").trim();
    
    // Skip non-progress lines like "[download] Destination: ..."
    if content.starts_with("Destination:") || content.starts_with("Resuming") || 
       content.contains("has already been downloaded") {
        return ParsedLine::Unknown;
    }
    
    // Try to extract percentage
    let percentage = if let Some(pct_end) = content.find('%') {
        let pct_str = &content[..pct_end].trim();
        parse_percentage(pct_str)
    } else {
        return ParsedLine::Unknown;
    };
    
    // Extract speed (look for "at" followed by speed)
    let speed = if let Some(at_pos) = content.find(" at ") {
        let after_at = &content[at_pos + 4..];
        // Speed ends at space before ETA or end of string
        if let Some(eta_pos) = after_at.find(" ETA") {
            after_at[..eta_pos].trim().to_string()
        } else if let Some(space_pos) = after_at.find(' ') {
            after_at[..space_pos].trim().to_string()
        } else {
            after_at.trim().to_string()
        }
    } else {
        "--".to_string()
    };
    
    // Extract ETA (look for "ETA" followed by time)
    let eta_seconds = if let Some(eta_pos) = content.find("ETA ") {
        let after_eta = &content[eta_pos + 4..];
        let eta_str = after_eta.split_whitespace().next().unwrap_or("");
        parse_eta(eta_str)
    } else {
        None
    };
    
    // Extract total size (look for "of" followed by size)
    let (downloaded_bytes, total_bytes) = if let Some(of_pos) = content.find(" of ") {
        let after_of = &content[of_pos + 4..];
        // Size ends at " at " or space
        let size_str = if let Some(at_pos) = after_of.find(" at ") {
            &after_of[..at_pos]
        } else {
            after_of.split_whitespace().next().unwrap_or("")
        };
        let total = parse_bytes_raw_or_formatted_optional(size_str);
        // Calculate downloaded from percentage
        let downloaded = if let Some(t) = total {
            ((percentage / 100.0) * t as f64) as u64
        } else {
            0
        };
        (downloaded, total)
    } else {
        (0, None)
    };
    
    ParsedLine::Progress(ProgressEvent {
        percentage,
        downloaded_bytes,
        total_bytes,
        speed,
        eta_seconds,
        status: "downloading".to_string(),
    })
}

/// Parse pipe-delimited progress format
/// Format: 45.2%|12345678|52345678|2.5MiB/s|00:12
fn parse_pipe_delimited_line(data: &str) -> ParsedLine {
    let parts: Vec<&str> = data.split('|').collect();
    
    if parts.len() < 5 {
        return ParsedLine::Unknown;
    }
    
    // Parse percentage (e.g., "45.2" or "NA" -> 0.0)
    let percentage = parse_percentage(parts[0]);
    
    // Parse downloaded bytes - now raw number or formatted string
    let downloaded_bytes = parse_bytes_raw_or_formatted(parts[1]);
    
    // Parse total bytes - now raw number or formatted string, or "NA"/"None" -> None
    let total_bytes = parse_bytes_raw_or_formatted_optional(parts[2]);
    
    // Speed string (keep as-is, e.g., "2.5MiB/s")
    let speed = clean_speed_string(parts[3]);
    
    // Parse ETA (e.g., "00:12" -> 12 seconds, or "N/A"/"Unknown" -> None)
    let eta_seconds = parse_eta(parts[4]);
    
    // Calculate percentage from bytes if percentage is NA but we have both byte values
    let final_percentage = if percentage == 0.0 && downloaded_bytes > 0 {
        if let Some(total) = total_bytes {
            if total > 0 {
                ((downloaded_bytes as f64 / total as f64) * 100.0).min(100.0)
            } else {
                percentage
            }
        } else {
            percentage
        }
    } else {
        percentage
    };
    
    ParsedLine::Progress(ProgressEvent {
        percentage: final_percentage,
        downloaded_bytes,
        total_bytes,
        speed,
        eta_seconds,
        status: "downloading".to_string(),
    })
}


/// Parse percentage string like "45.2%", "45.2", " 45.2%", or "NA" to f64
fn parse_percentage(s: &str) -> f64 {
    let s = s.trim();
    
    // Handle NA/Unknown values
    if s.eq_ignore_ascii_case("na") || s.eq_ignore_ascii_case("n/a") || s.eq_ignore_ascii_case("unknown") {
        return 0.0;
    }
    
    // Remove % suffix if present
    let s = s.trim_end_matches('%');
    s.trim().parse::<f64>().unwrap_or(0.0).clamp(0.0, 100.0)
}

/// Parse raw byte number or formatted string like "23.5MiB" to u64 bytes
fn parse_bytes_raw_or_formatted(s: &str) -> u64 {
    parse_bytes_raw_or_formatted_optional(s).unwrap_or(0)
}

/// Parse raw byte number or formatted string to Option<u64> bytes
/// Returns None for "N/A", "NA", "Unknown", "None", or unparseable values
fn parse_bytes_raw_or_formatted_optional(s: &str) -> Option<u64> {
    let s = s.trim();
    
    // Handle N/A, NA, Unknown, None
    if s.eq_ignore_ascii_case("n/a") 
        || s.eq_ignore_ascii_case("na")
        || s.eq_ignore_ascii_case("unknown") 
        || s.eq_ignore_ascii_case("none")
        || s.is_empty() 
    {
        return None;
    }
    
    // First try to parse as raw number (most common case now)
    if let Ok(bytes) = s.parse::<u64>() {
        return Some(bytes);
    }
    
    // Also try parsing as float (yt-dlp sometimes outputs decimals)
    if let Ok(bytes) = s.parse::<f64>() {
        return Some(bytes as u64);
    }
    
    // Fall back to formatted string parsing (e.g., "23.5MiB")
    let (num_str, unit) = extract_number_and_unit(s);
    
    let num: f64 = num_str.parse().ok()?;
    
    let multiplier: u64 = match unit.to_lowercase().as_str() {
        "b" | "" => 1,
        "kib" | "kb" | "k" => 1024,
        "mib" | "mb" | "m" => 1024 * 1024,
        "gib" | "gb" | "g" => 1024 * 1024 * 1024,
        "tib" | "tb" | "t" => 1024 * 1024 * 1024 * 1024,
        _ => 1,
    };
    
    Some((num * multiplier as f64) as u64)
}

/// Clean speed string - remove extra whitespace and handle "Unknown" values
fn clean_speed_string(s: &str) -> String {
    let s = s.trim();
    if s.eq_ignore_ascii_case("unknown") || s.eq_ignore_ascii_case("n/a") || s.eq_ignore_ascii_case("na") {
        return "--".to_string();
    }
    s.to_string()
}

/// Parse raw byte number or formatted string to Option<u64> bytes (legacy support)
/// Returns None for "N/A", "NA", "Unknown", "None", or unparseable values
#[allow(dead_code)]
fn parse_bytes_optional(s: &str) -> Option<u64> {
    parse_bytes_raw_or_formatted_optional(s)
}

/// Extract number and unit from a string like "23.5MiB"
fn extract_number_and_unit(s: &str) -> (&str, &str) {
    let s = s.trim();
    
    // Find where the number ends
    let num_end = s
        .char_indices()
        .find(|(_, c)| !c.is_ascii_digit() && *c != '.' && *c != '-')
        .map(|(i, _)| i)
        .unwrap_or(s.len());
    
    (&s[..num_end], &s[num_end..])
}

/// Parse ETA string like "00:12" or "01:23:45" to seconds
/// Returns None for "N/A", "Unknown", or unparseable values
fn parse_eta(s: &str) -> Option<u64> {
    let s = s.trim();
    
    // Handle N/A or Unknown
    if s.eq_ignore_ascii_case("n/a") || s.eq_ignore_ascii_case("unknown") || s.is_empty() {
        return None;
    }
    
    // Parse time format: HH:MM:SS or MM:SS or SS
    let parts: Vec<&str> = s.split(':').collect();
    
    match parts.len() {
        1 => parts[0].parse().ok(),
        2 => {
            let mins: u64 = parts[0].parse().ok()?;
            let secs: u64 = parts[1].parse().ok()?;
            Some(mins * 60 + secs)
        }
        3 => {
            let hours: u64 = parts[0].parse().ok()?;
            let mins: u64 = parts[1].parse().ok()?;
            let secs: u64 = parts[2].parse().ok()?;
            Some(hours * 3600 + mins * 60 + secs)
        }
        _ => None,
    }
}

/// Error category for parsed yt-dlp errors
#[derive(Debug, Clone, PartialEq)]
pub enum ErrorCategory {
    PrivateVideo,
    AgeRestricted,
    RegionLocked,
    NetworkError,
    NotFound,
    GenericError,
}

/// Parsed error from yt-dlp stderr
#[derive(Debug, Clone)]
pub struct ParsedError {
    pub category: ErrorCategory,
    pub message: String,
}

/// Parse yt-dlp stderr output to extract and categorize errors
///
/// **Validates: Requirements 6.3**
pub fn parse_error_line(line: &str) -> Option<ParsedError> {
    let line = line.trim();
    
    // Skip empty lines
    if line.is_empty() {
        return None;
    }
    
    // Look for ERROR: prefix (yt-dlp error format)
    let error_msg = if line.starts_with("ERROR:") {
        line[6..].trim()
    } else if line.contains("ERROR:") {
        // Sometimes prefixed with other info
        line.split("ERROR:").nth(1)?.trim()
    } else {
        // Not an error line
        return None;
    };
    
    // Categorize the error
    let category = categorize_error(error_msg);
    let message = create_user_friendly_message(error_msg, &category);
    
    Some(ParsedError { category, message })
}


/// Categorize an error message into a known category
fn categorize_error(msg: &str) -> ErrorCategory {
    let msg_lower = msg.to_lowercase();
    
    // Private video patterns
    if msg_lower.contains("private video")
        || msg_lower.contains("video is private")
        || msg_lower.contains("this video is private")
    {
        return ErrorCategory::PrivateVideo;
    }
    
    // Age restricted patterns
    if msg_lower.contains("age-restricted")
        || msg_lower.contains("age restricted")
        || msg_lower.contains("sign in to confirm your age")
        || msg_lower.contains("login required")
        || msg_lower.contains("sign in")
    {
        return ErrorCategory::AgeRestricted;
    }
    
    // Region locked patterns
    if msg_lower.contains("not available in your country")
        || msg_lower.contains("geo-restricted")
        || msg_lower.contains("geo restricted")
        || msg_lower.contains("blocked in your country")
        || msg_lower.contains("region")
    {
        return ErrorCategory::RegionLocked;
    }
    
    // Network error patterns
    if msg_lower.contains("network")
        || msg_lower.contains("connection")
        || msg_lower.contains("timeout")
        || msg_lower.contains("timed out")
        || msg_lower.contains("unable to download")
        || msg_lower.contains("http error")
        || msg_lower.contains("urlopen error")
        || msg_lower.contains("ssl")
        || msg_lower.contains("certificate")
    {
        return ErrorCategory::NetworkError;
    }
    
    // Not found patterns
    if msg_lower.contains("video unavailable")
        || msg_lower.contains("not found")
        || msg_lower.contains("does not exist")
        || msg_lower.contains("has been removed")
        || msg_lower.contains("deleted")
        || msg_lower.contains("no video formats found")
        || msg_lower.contains("unsupported url")
    {
        return ErrorCategory::NotFound;
    }
    
    ErrorCategory::GenericError
}

/// Create a user-friendly error message based on category
fn create_user_friendly_message(original_msg: &str, category: &ErrorCategory) -> String {
    match category {
        ErrorCategory::PrivateVideo => {
            "This video is private. You may need to sign in with browser cookies to access it.".to_string()
        }
        ErrorCategory::AgeRestricted => {
            "This content is age-restricted. Try enabling browser cookie import in settings.".to_string()
        }
        ErrorCategory::RegionLocked => {
            "This content is not available in your region.".to_string()
        }
        ErrorCategory::NetworkError => {
            format!("Network error: {}. Please check your internet connection and try again.", 
                truncate_message(original_msg, 100))
        }
        ErrorCategory::NotFound => {
            "Video not found. The URL may be invalid or the content may have been removed.".to_string()
        }
        ErrorCategory::GenericError => {
            truncate_message(original_msg, 200)
        }
    }
}

/// Truncate a message to a maximum length, adding ellipsis if needed
fn truncate_message(msg: &str, max_len: usize) -> String {
    if msg.len() <= max_len {
        msg.to_string()
    } else {
        format!("{}...", &msg[..max_len - 3])
    }
}

/// Convert ParsedError to DownloadError
impl From<ParsedError> for DownloadError {
    fn from(parsed: ParsedError) -> Self {
        match parsed.category {
            ErrorCategory::PrivateVideo => DownloadError::PrivateVideo,
            ErrorCategory::AgeRestricted => DownloadError::AgeRestricted,
            ErrorCategory::RegionLocked => DownloadError::RegionLocked,
            ErrorCategory::NetworkError => DownloadError::NetworkError(parsed.message),
            ErrorCategory::NotFound => DownloadError::NotFound,
            ErrorCategory::GenericError => DownloadError::GenericError(parsed.message),
        }
    }
}

#[cfg(test)]
mod tests {
    //! Property tests for yt-dlp progress parser
    //!
    //! **Feature: MediaGrab, Property 5: Progress Parser Correctness**
    //! **Validates: Requirements 4.2, 4.5**

    use super::*;
    use proptest::prelude::*;

    /// Generate a valid percentage value (0-100)
    fn arb_percentage() -> impl Strategy<Value = f64> {
        (0.0..=100.0f64).prop_map(|p| (p * 10.0).round() / 10.0) // Round to 1 decimal
    }

    /// Generate a valid byte size string
    fn arb_byte_string() -> impl Strategy<Value = String> {
        prop_oneof![
            (0.0..1000.0f64).prop_map(|n| format!("{:.1}B", n)),
            (0.0..1000.0f64).prop_map(|n| format!("{:.1}KiB", n)),
            (0.0..1000.0f64).prop_map(|n| format!("{:.2}MiB", n)),
            (0.0..100.0f64).prop_map(|n| format!("{:.2}GiB", n)),
        ]
    }

    /// Generate a valid or N/A byte string
    fn arb_byte_string_optional() -> impl Strategy<Value = String> {
        prop_oneof![
            arb_byte_string(),
            Just("N/A".to_string()),
            Just("Unknown".to_string()),
        ]
    }

    /// Generate a valid speed string
    fn arb_speed_string() -> impl Strategy<Value = String> {
        prop_oneof![
            (0.0..100.0f64).prop_map(|n| format!("{:.1}KiB/s", n)),
            (0.0..100.0f64).prop_map(|n| format!("{:.2}MiB/s", n)),
            (0.0..10.0f64).prop_map(|n| format!("{:.2}GiB/s", n)),
        ]
    }

    /// Generate a valid ETA string (MM:SS or HH:MM:SS format)
    fn arb_eta_string() -> impl Strategy<Value = String> {
        prop_oneof![
            (0u64..60, 0u64..60).prop_map(|(m, s)| format!("{:02}:{:02}", m, s)),
            (0u64..24, 0u64..60, 0u64..60).prop_map(|(h, m, s)| format!("{:02}:{:02}:{:02}", h, m, s)),
            Just("N/A".to_string()),
        ]
    }

    /// Generate a valid progress line
    fn arb_progress_line() -> impl Strategy<Value = (String, f64, String, String, String, String)> {
        (
            arb_percentage(),
            arb_byte_string(),
            arb_byte_string_optional(),
            arb_speed_string(),
            arb_eta_string(),
        )
            .prop_map(|(pct, downloaded, total, speed, eta)| {
                let line = format!("download:{}%|{}|{}|{}|{}", pct, downloaded, total, speed, eta);
                (line, pct, downloaded, total, speed, eta)
            })
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(100))]

        /// **Feature: MediaGrab, Property 5: Progress Parser Correctness**
        ///
        /// For any valid yt-dlp progress output line matching the expected template format,
        /// the parser SHALL extract percentage, speed, and ETA values correctly.
        /// The parsed percentage SHALL be between 0 and 100 inclusive.
        ///
        /// **Validates: Requirements 4.2, 4.5**
        #[test]
        fn prop_progress_parser_extracts_valid_percentage(
            (line, expected_pct, _, _, _, _) in arb_progress_line()
        ) {
            let result = parse_progress_line(&line);
            
            match result {
                ParsedLine::Progress(event) => {
                    // Percentage should be between 0 and 100
                    prop_assert!(
                        event.percentage >= 0.0 && event.percentage <= 100.0,
                        "Percentage {} should be between 0 and 100",
                        event.percentage
                    );
                    
                    // Percentage should match expected (within floating point tolerance)
                    prop_assert!(
                        (event.percentage - expected_pct).abs() < 0.01,
                        "Parsed percentage {} should match expected {}",
                        event.percentage,
                        expected_pct
                    );
                    
                    // Status should be "downloading"
                    prop_assert_eq!(
                        event.status,
                        "downloading",
                        "Status should be 'downloading'"
                    );
                }
                other => {
                    prop_assert!(false, "Expected Progress, got {:?}", other);
                }
            }
        }

        /// Property: Speed string is preserved correctly
        ///
        /// **Validates: Requirements 4.2**
        #[test]
        fn prop_progress_parser_preserves_speed_string(
            (line, _, _, _, expected_speed, _) in arb_progress_line()
        ) {
            let result = parse_progress_line(&line);
            
            if let ParsedLine::Progress(event) = result {
                prop_assert_eq!(
                    event.speed.trim(),
                    expected_speed.trim(),
                    "Speed string should be preserved"
                );
            }
        }

        /// Property: ETA is correctly parsed to seconds
        ///
        /// **Validates: Requirements 4.2**
        #[test]
        fn prop_progress_parser_parses_eta_correctly(
            (line, _, _, _, _, eta_str) in arb_progress_line()
        ) {
            let result = parse_progress_line(&line);
            
            if let ParsedLine::Progress(event) = result {
                // If ETA was N/A, it should be None
                if eta_str == "N/A" {
                    prop_assert!(
                        event.eta_seconds.is_none(),
                        "ETA should be None for N/A input"
                    );
                } else {
                    // Otherwise it should be Some with correct value
                    prop_assert!(
                        event.eta_seconds.is_some(),
                        "ETA should be Some for valid time string"
                    );
                }
            }
        }

        /// Property: Non-progress lines return Unknown
        #[test]
        fn prop_non_progress_lines_return_unknown(
            line in "[a-zA-Z0-9 ]{1,50}"
        ) {
            // Lines not starting with "download:" should return Unknown
            if !line.starts_with("download:") {
                let result = parse_progress_line(&line);
                prop_assert!(
                    matches!(result, ParsedLine::Unknown),
                    "Non-progress line should return Unknown, got {:?}",
                    result
                );
            }
        }

        /// Property: Merging lines are detected correctly
        #[test]
        fn prop_merging_lines_detected(
            prefix in "[a-zA-Z0-9 ]{0,20}",
            suffix in "[a-zA-Z0-9 ]{0,20}"
        ) {
            let merger_line = format!("{}[Merger]{}", prefix, suffix);
            let ffmpeg_line = format!("{}[ffmpeg]{}", prefix, suffix);
            let merging_line = format!("{}Merging{}", prefix, suffix);
            
            prop_assert!(
                matches!(parse_progress_line(&merger_line), ParsedLine::Merging),
                "[Merger] line should be detected as Merging"
            );
            prop_assert!(
                matches!(parse_progress_line(&ffmpeg_line), ParsedLine::Merging),
                "[ffmpeg] line should be detected as Merging"
            );
            prop_assert!(
                matches!(parse_progress_line(&merging_line), ParsedLine::Merging),
                "Merging line should be detected as Merging"
            );
        }
    }

    #[test]
    fn test_parse_basic_progress_line() {
        let line = "download:45.2|23.5MiB|52.1MiB|2.5MiB/s|00:12";
        let result = parse_progress_line(line);
        
        if let ParsedLine::Progress(event) = result {
            assert!((event.percentage - 45.2).abs() < 0.01);
            assert_eq!(event.speed, "2.5MiB/s");
            assert_eq!(event.eta_seconds, Some(12));
            assert_eq!(event.status, "downloading");
        } else {
            panic!("Expected Progress, got {:?}", result);
        }
    }

    #[test]
    fn test_parse_progress_without_prefix() {
        // yt-dlp outputs progress without "download:" prefix
        let line = "45.2|24641536|54525952|2.5MiB/s|00:12";
        let result = parse_progress_line(line);
        
        if let ParsedLine::Progress(event) = result {
            assert!((event.percentage - 45.2).abs() < 0.01);
            assert_eq!(event.downloaded_bytes, 24641536);
            assert_eq!(event.total_bytes, Some(54525952));
            assert_eq!(event.speed, "2.5MiB/s");
            assert_eq!(event.eta_seconds, Some(12));
        } else {
            panic!("Expected Progress, got {:?}", result);
        }
    }

    #[test]
    fn test_parse_progress_with_na_percentage() {
        // Fragment-based downloads have NA percentage
        let line = "NA|111672|392544|125.62KiB/s|Unknown";
        let result = parse_progress_line(line);
        
        if let ParsedLine::Progress(event) = result {
            // Should calculate percentage from bytes: 111672/392544 ≈ 28.4%
            assert!(event.percentage > 28.0 && event.percentage < 29.0);
            assert_eq!(event.downloaded_bytes, 111672);
            assert_eq!(event.total_bytes, Some(392544));
            assert_eq!(event.speed, "125.62KiB/s");
            assert!(event.eta_seconds.is_none());
        } else {
            panic!("Expected Progress, got {:?}", result);
        }
    }

    #[test]
    fn test_parse_progress_with_na_total() {
        // When total is unknown
        let line = "NA|111672|NA|125.62KiB/s|Unknown";
        let result = parse_progress_line(line);
        
        if let ParsedLine::Progress(event) = result {
            assert_eq!(event.percentage, 0.0); // Can't calculate without total
            assert_eq!(event.downloaded_bytes, 111672);
            assert!(event.total_bytes.is_none());
        } else {
            panic!("Expected Progress, got {:?}", result);
        }
    }

    #[test]
    fn test_parse_real_ytdlp_output() {
        // Real output from yt-dlp with leading spaces in speed
        let line = "NA|1024|NA|   1.48KiB/s|Unknown";
        let result = parse_progress_line(line);
        
        if let ParsedLine::Progress(event) = result {
            assert_eq!(event.downloaded_bytes, 1024);
            assert!(event.total_bytes.is_none());
            assert_eq!(event.speed, "1.48KiB/s"); // Should be trimmed
            assert!(event.eta_seconds.is_none());
        } else {
            panic!("Expected Progress, got {:?}", result);
        }
    }

    #[test]
    fn test_parse_final_progress_line() {
        // Final line when download completes - has total bytes
        let line = "NA|392544|392544|971.05KiB/s|NA";
        let result = parse_progress_line(line);
        
        if let ParsedLine::Progress(event) = result {
            assert_eq!(event.downloaded_bytes, 392544);
            assert_eq!(event.total_bytes, Some(392544));
            // Should calculate 100% since downloaded == total
            assert!((event.percentage - 100.0).abs() < 0.01);
        } else {
            panic!("Expected Progress, got {:?}", result);
        }
    }

    #[test]
    fn test_parse_progress_with_raw_bytes() {
        // New format with raw byte numbers
        let line = "download:45.2%|24641536|54525952|2.5MiB/s|00:12";
        let result = parse_progress_line(line);
        
        if let ParsedLine::Progress(event) = result {
            assert!((event.percentage - 45.2).abs() < 0.01);
            assert_eq!(event.downloaded_bytes, 24641536);
            assert_eq!(event.total_bytes, Some(54525952));
            assert_eq!(event.speed, "2.5MiB/s");
            assert_eq!(event.eta_seconds, Some(12));
            assert_eq!(event.status, "downloading");
        } else {
            panic!("Expected Progress, got {:?}", result);
        }
    }

    #[test]
    fn test_parse_progress_with_none_total() {
        // yt-dlp outputs "None" when total is unknown
        let line = "download:10.0%|5242880|None|1.0MiB/s|N/A";
        let result = parse_progress_line(line);
        
        if let ParsedLine::Progress(event) = result {
            assert!((event.percentage - 10.0).abs() < 0.01);
            assert_eq!(event.downloaded_bytes, 5242880);
            assert!(event.total_bytes.is_none());
            assert!(event.eta_seconds.is_none());
        } else {
            panic!("Expected Progress, got {:?}", result);
        }
    }

    #[test]
    fn test_parse_progress_with_na_values() {
        let line = "download:10.0%|5.0MiB|N/A|1.0MiB/s|N/A";
        let result = parse_progress_line(line);
        
        if let ParsedLine::Progress(event) = result {
            assert!((event.percentage - 10.0).abs() < 0.01);
            assert!(event.total_bytes.is_none());
            assert!(event.eta_seconds.is_none());
        } else {
            panic!("Expected Progress, got {:?}", result);
        }
    }

    #[test]
    fn test_parse_eta_formats() {
        // MM:SS format
        assert_eq!(parse_eta("01:30"), Some(90));
        
        // HH:MM:SS format
        assert_eq!(parse_eta("01:30:45"), Some(5445));
        
        // Just seconds
        assert_eq!(parse_eta("45"), Some(45));
        
        // N/A
        assert_eq!(parse_eta("N/A"), None);
    }

    #[test]
    fn test_parse_bytes() {
        assert_eq!(parse_bytes_optional("100B"), Some(100));
        assert_eq!(parse_bytes_optional("1KiB"), Some(1024));
        assert_eq!(parse_bytes_optional("1MiB"), Some(1024 * 1024));
        assert_eq!(parse_bytes_optional("1GiB"), Some(1024 * 1024 * 1024));
        assert_eq!(parse_bytes_optional("N/A"), None);
    }

    #[test]
    fn test_merging_detection() {
        assert!(matches!(parse_progress_line("[Merger] Merging formats"), ParsedLine::Merging));
        assert!(matches!(parse_progress_line("[ffmpeg] Converting"), ParsedLine::Merging));
        assert!(matches!(parse_progress_line("Merging video and audio"), ParsedLine::Merging));
    }

    #[test]
    fn test_unknown_lines() {
        assert!(matches!(parse_progress_line(""), ParsedLine::Unknown));
        assert!(matches!(parse_progress_line("random text"), ParsedLine::Unknown));
        assert!(matches!(parse_progress_line("[info] Downloading"), ParsedLine::Unknown));
    }

    #[test]
    fn test_percentage_clamping() {
        // Test that percentage is clamped to 0-100
        let line = "download:150.0%|100MiB|100MiB|0B/s|00:00";
        if let ParsedLine::Progress(event) = parse_progress_line(line) {
            assert!(event.percentage <= 100.0);
        }
        
        let line = "download:-10.0%|0MiB|100MiB|1MiB/s|01:00";
        if let ParsedLine::Progress(event) = parse_progress_line(line) {
            assert!(event.percentage >= 0.0);
        }
    }

    // ============================================
    // Error Parser Unit Tests
    // ============================================

    #[test]
    fn test_parse_private_video_error() {
        let line = "ERROR: Video is private";
        let result = parse_error_line(line);
        assert!(result.is_some());
        let parsed = result.unwrap();
        assert_eq!(parsed.category, ErrorCategory::PrivateVideo);
        assert!(!parsed.message.is_empty());
    }

    #[test]
    fn test_parse_age_restricted_error() {
        let line = "ERROR: Sign in to confirm your age";
        let result = parse_error_line(line);
        assert!(result.is_some());
        let parsed = result.unwrap();
        assert_eq!(parsed.category, ErrorCategory::AgeRestricted);
    }

    #[test]
    fn test_parse_region_locked_error() {
        let line = "ERROR: Video not available in your country";
        let result = parse_error_line(line);
        assert!(result.is_some());
        let parsed = result.unwrap();
        assert_eq!(parsed.category, ErrorCategory::RegionLocked);
    }

    #[test]
    fn test_parse_network_error() {
        let line = "ERROR: Unable to download webpage: Connection timed out";
        let result = parse_error_line(line);
        assert!(result.is_some());
        let parsed = result.unwrap();
        assert_eq!(parsed.category, ErrorCategory::NetworkError);
    }

    #[test]
    fn test_parse_not_found_error() {
        let line = "ERROR: Video unavailable";
        let result = parse_error_line(line);
        assert!(result.is_some());
        let parsed = result.unwrap();
        assert_eq!(parsed.category, ErrorCategory::NotFound);
    }

    #[test]
    fn test_parse_generic_error() {
        let line = "ERROR: Some unknown error occurred";
        let result = parse_error_line(line);
        assert!(result.is_some());
        let parsed = result.unwrap();
        assert_eq!(parsed.category, ErrorCategory::GenericError);
    }

    #[test]
    fn test_non_error_lines_return_none() {
        assert!(parse_error_line("").is_none());
        assert!(parse_error_line("random text").is_none());
        assert!(parse_error_line("[info] Downloading").is_none());
        assert!(parse_error_line("WARNING: Something").is_none());
    }

    #[test]
    fn test_error_with_prefix() {
        let line = "[youtube] abc123: ERROR: Video is private";
        let result = parse_error_line(line);
        assert!(result.is_some());
        let parsed = result.unwrap();
        assert_eq!(parsed.category, ErrorCategory::PrivateVideo);
    }

    #[test]
    fn test_error_to_download_error_conversion() {
        let parsed = ParsedError {
            category: ErrorCategory::PrivateVideo,
            message: "Test message".to_string(),
        };
        let download_error: DownloadError = parsed.into();
        assert!(matches!(download_error, DownloadError::PrivateVideo));

        let parsed = ParsedError {
            category: ErrorCategory::NetworkError,
            message: "Network failed".to_string(),
        };
        let download_error: DownloadError = parsed.into();
        assert!(matches!(download_error, DownloadError::NetworkError(_)));
    }

    // ============================================
    // Error Parser Property Tests
    // **Feature: MediaGrab, Property 6: Error Message Parsing and Categorization**
    // **Validates: Requirements 6.3**
    // ============================================

    /// Generate error messages for each category
    fn arb_private_video_error() -> impl Strategy<Value = String> {
        prop_oneof![
            Just("Video is private".to_string()),
            Just("This video is private".to_string()),
            Just("Private video".to_string()),
        ]
    }

    fn arb_age_restricted_error() -> impl Strategy<Value = String> {
        prop_oneof![
            Just("Sign in to confirm your age".to_string()),
            Just("Age-restricted video".to_string()),
            Just("Age restricted content".to_string()),
            Just("Login required".to_string()),
        ]
    }

    fn arb_region_locked_error() -> impl Strategy<Value = String> {
        prop_oneof![
            Just("Video not available in your country".to_string()),
            Just("Geo-restricted content".to_string()),
            Just("Blocked in your country".to_string()),
            Just("This content is region locked".to_string()),
        ]
    }

    fn arb_network_error() -> impl Strategy<Value = String> {
        prop_oneof![
            Just("Network error occurred".to_string()),
            Just("Connection timed out".to_string()),
            Just("Unable to download webpage".to_string()),
            Just("HTTP Error 503".to_string()),
            Just("SSL certificate error".to_string()),
        ]
    }

    fn arb_not_found_error() -> impl Strategy<Value = String> {
        prop_oneof![
            Just("Video unavailable".to_string()),
            Just("Video not found".to_string()),
            Just("Video does not exist".to_string()),
            Just("Video has been removed".to_string()),
            Just("No video formats found".to_string()),
            Just("Unsupported URL".to_string()),
        ]
    }

    fn arb_generic_error() -> impl Strategy<Value = String> {
        // Generate random error messages that don't match any specific category
        "[a-zA-Z0-9 ]{10,50}".prop_filter("must not match known patterns", |s| {
            let lower = s.to_lowercase();
            !lower.contains("private")
                && !lower.contains("age")
                && !lower.contains("sign in")
                && !lower.contains("login")
                && !lower.contains("region")
                && !lower.contains("country")
                && !lower.contains("geo")
                && !lower.contains("network")
                && !lower.contains("connection")
                && !lower.contains("timeout")
                && !lower.contains("http")
                && !lower.contains("ssl")
                && !lower.contains("unavailable")
                && !lower.contains("not found")
                && !lower.contains("removed")
                && !lower.contains("deleted")
                && !lower.contains("unsupported")
        })
    }

    /// Generate a categorized error with its expected category
    fn arb_categorized_error() -> impl Strategy<Value = (String, ErrorCategory)> {
        prop_oneof![
            arb_private_video_error().prop_map(|msg| (msg, ErrorCategory::PrivateVideo)),
            arb_age_restricted_error().prop_map(|msg| (msg, ErrorCategory::AgeRestricted)),
            arb_region_locked_error().prop_map(|msg| (msg, ErrorCategory::RegionLocked)),
            arb_network_error().prop_map(|msg| (msg, ErrorCategory::NetworkError)),
            arb_not_found_error().prop_map(|msg| (msg, ErrorCategory::NotFound)),
            arb_generic_error().prop_map(|msg| (msg, ErrorCategory::GenericError)),
        ]
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(100))]

        /// **Feature: MediaGrab, Property 6: Error Message Parsing and Categorization**
        ///
        /// For any yt-dlp stderr output containing an error message, the error parser
        /// SHALL extract a non-empty, user-readable error description and categorize it
        /// into one of: PrivateVideo, AgeRestricted, RegionLocked, NetworkError, NotFound,
        /// or GenericError.
        ///
        /// **Validates: Requirements 6.3**
        #[test]
        fn prop_error_parser_extracts_non_empty_message(
            (error_msg, expected_category) in arb_categorized_error()
        ) {
            let line = format!("ERROR: {}", error_msg);
            let result = parse_error_line(&line);
            
            // Should successfully parse
            prop_assert!(
                result.is_some(),
                "Error line should be parsed: {}",
                line
            );
            
            let parsed = result.unwrap();
            
            // Message should be non-empty
            prop_assert!(
                !parsed.message.is_empty(),
                "Parsed message should not be empty"
            );
            
            // Category should match expected
            prop_assert_eq!(
                parsed.category,
                expected_category,
                "Category should match expected for error: {}",
                error_msg
            );
        }

        /// Property: Error parser returns valid category for any ERROR: line
        ///
        /// **Validates: Requirements 6.3**
        #[test]
        fn prop_error_parser_always_returns_valid_category(
            // Filter out whitespace-only strings as they're not realistic error messages
            error_msg in "[a-zA-Z0-9 ]{1,100}".prop_filter(
                "must contain non-whitespace",
                |s| s.trim().len() > 0
            )
        ) {
            let line = format!("ERROR: {}", error_msg);
            let result = parse_error_line(&line);
            
            // Should always parse ERROR: lines
            prop_assert!(
                result.is_some(),
                "ERROR: lines should always be parsed"
            );
            
            let parsed = result.unwrap();
            
            // Category should be one of the valid categories
            let valid_categories = [
                ErrorCategory::PrivateVideo,
                ErrorCategory::AgeRestricted,
                ErrorCategory::RegionLocked,
                ErrorCategory::NetworkError,
                ErrorCategory::NotFound,
                ErrorCategory::GenericError,
            ];
            
            prop_assert!(
                valid_categories.contains(&parsed.category),
                "Category should be valid"
            );
            
            // Message should never be empty
            prop_assert!(
                !parsed.message.is_empty(),
                "Message should not be empty"
            );
        }

        /// Property: Non-error lines return None
        ///
        /// **Validates: Requirements 6.3**
        #[test]
        fn prop_non_error_lines_return_none(
            line in "[a-zA-Z0-9 \\[\\]]{1,100}"
        ) {
            // Lines without ERROR: should return None
            if !line.contains("ERROR:") {
                let result = parse_error_line(&line);
                prop_assert!(
                    result.is_none(),
                    "Non-error line should return None: {}",
                    line
                );
            }
        }

        /// Property: Error parser handles prefixed error lines
        ///
        /// **Validates: Requirements 6.3**
        #[test]
        fn prop_error_parser_handles_prefixed_lines(
            prefix in "[a-zA-Z0-9\\[\\] ]{0,30}",
            (error_msg, expected_category) in arb_categorized_error()
        ) {
            let line = format!("{} ERROR: {}", prefix, error_msg);
            let result = parse_error_line(&line);
            
            // Should successfully parse prefixed error lines
            prop_assert!(
                result.is_some(),
                "Prefixed error line should be parsed: {}",
                line
            );
            
            let parsed = result.unwrap();
            
            // Category should still match
            prop_assert_eq!(
                parsed.category,
                expected_category,
                "Category should match for prefixed error: {}",
                line
            );
        }
    }
}
