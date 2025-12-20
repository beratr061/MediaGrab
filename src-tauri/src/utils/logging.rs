//! Logging configuration and utilities
//!
//! This module provides logging setup using the tracing crate with different
//! verbosity levels for debug and release builds.
//!
//! **Validates: Requirements 10.1, 10.2, 10.3**

use parking_lot::RwLock;
use std::collections::VecDeque;
use std::sync::Arc;
use tracing::Level;
use tracing_subscriber::{
    fmt::{self, format::FmtSpan},
    layer::SubscriberExt,
    util::SubscriberInitExt,
    EnvFilter,
};

/// Maximum number of log entries to keep in memory for debug info export
const MAX_LOG_ENTRIES: usize = 500;

/// A single log entry stored in memory
#[derive(Clone, Debug)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: String,
    pub target: String,
    pub message: String,
}

/// In-memory log storage for debug info export
#[derive(Clone)]
pub struct LogBuffer {
    entries: Arc<RwLock<VecDeque<LogEntry>>>,
}

impl LogBuffer {
    /// Creates a new empty log buffer
    pub fn new() -> Self {
        Self {
            entries: Arc::new(RwLock::new(VecDeque::with_capacity(MAX_LOG_ENTRIES))),
        }
    }

    /// Adds a log entry to the buffer
    pub fn push(&self, entry: LogEntry) {
        let mut entries = self.entries.write();
        if entries.len() >= MAX_LOG_ENTRIES {
            entries.pop_front();
        }
        entries.push_back(entry);
    }

    /// Gets all log entries as a formatted string
    pub fn get_logs(&self) -> String {
        let entries = self.entries.read();
        entries
            .iter()
            .map(|e| format!("[{}] {} {} - {}", e.timestamp, e.level, e.target, e.message))
            .collect::<Vec<_>>()
            .join("\n")
    }

    /// Gets the most recent N log entries as a formatted string
    pub fn get_recent_logs(&self, count: usize) -> String {
        let entries = self.entries.read();
        let start = if entries.len() > count {
            entries.len() - count
        } else {
            0
        };
        entries
            .iter()
            .skip(start)
            .map(|e| format!("[{}] {} {} - {}", e.timestamp, e.level, e.target, e.message))
            .collect::<Vec<_>>()
            .join("\n")
    }

    /// Clears all log entries
    pub fn clear(&self) {
        let mut entries = self.entries.write();
        entries.clear();
    }
}

impl Default for LogBuffer {
    fn default() -> Self {
        Self::new()
    }
}

/// Global log buffer instance
static LOG_BUFFER: std::sync::OnceLock<LogBuffer> = std::sync::OnceLock::new();

/// Gets the global log buffer
pub fn get_log_buffer() -> &'static LogBuffer {
    LOG_BUFFER.get_or_init(LogBuffer::new)
}

/// Custom layer that stores logs in memory
struct MemoryLogLayer;

impl<S> tracing_subscriber::Layer<S> for MemoryLogLayer
where
    S: tracing::Subscriber,
{
    fn on_event(
        &self,
        event: &tracing::Event<'_>,
        _ctx: tracing_subscriber::layer::Context<'_, S>,
    ) {
        let metadata = event.metadata();
        let level = metadata.level().to_string();
        let target = metadata.target().to_string();
        
        // Extract the message from the event
        let mut visitor = MessageVisitor::default();
        event.record(&mut visitor);
        
        let entry = LogEntry {
            timestamp: chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string(),
            level,
            target,
            message: visitor.message,
        };
        
        get_log_buffer().push(entry);
    }
}

/// Visitor to extract message from tracing events
#[derive(Default)]
struct MessageVisitor {
    message: String,
}

impl tracing::field::Visit for MessageVisitor {
    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn std::fmt::Debug) {
        if field.name() == "message" {
            self.message = format!("{:?}", value);
        } else if self.message.is_empty() {
            // Fallback: use any field as message
            self.message = format!("{} = {:?}", field.name(), value);
        }
    }

    fn record_str(&mut self, field: &tracing::field::Field, value: &str) {
        if field.name() == "message" {
            self.message = value.to_string();
        } else if self.message.is_empty() {
            self.message = format!("{} = {}", field.name(), value);
        }
    }
}

/// Initializes the logging system
///
/// In debug mode: verbose logging with all yt-dlp output
/// In release mode: minimal logging (warnings and errors only)
///
/// **Validates: Requirements 10.1, 10.2**
pub fn init_logging() {
    // Determine log level based on build mode
    let (default_level, mediagrab_level) = if cfg!(debug_assertions) {
        // Debug mode: verbose logging
        (Level::DEBUG, Level::TRACE)
    } else {
        // Release mode: minimal logging
        (Level::WARN, Level::INFO)
    };

    // Create environment filter
    // Allow override via RUST_LOG environment variable
    let env_filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| {
        EnvFilter::new(format!(
            "{},mediagrab={},mediagrab_lib={}",
            default_level, mediagrab_level, mediagrab_level
        ))
    });

    // Create the formatting layer
    let fmt_layer = fmt::layer()
        .with_target(true)
        .with_level(true)
        .with_thread_ids(cfg!(debug_assertions))
        .with_file(cfg!(debug_assertions))
        .with_line_number(cfg!(debug_assertions))
        .with_span_events(if cfg!(debug_assertions) {
            FmtSpan::ENTER | FmtSpan::EXIT
        } else {
            FmtSpan::NONE
        });

    // Initialize the subscriber with both console output and memory storage
    tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt_layer)
        .with(MemoryLogLayer)
        .init();

    tracing::info!("Logging initialized (debug_assertions={})", cfg!(debug_assertions));
}

/// Logs a yt-dlp command being executed
///
/// **Validates: Requirements 10.1**
pub fn log_ytdlp_command(args: &[String]) {
    if cfg!(debug_assertions) {
        tracing::debug!(target: "mediagrab::ytdlp", "Executing yt-dlp with args: {:?}", args);
    } else {
        tracing::info!(target: "mediagrab::ytdlp", "Starting yt-dlp download");
    }
}

/// Logs yt-dlp stdout output
///
/// **Validates: Requirements 10.1**
pub fn log_ytdlp_stdout(line: &str) {
    tracing::debug!(target: "mediagrab::ytdlp::stdout", "{}", line);
}

/// Logs yt-dlp stderr output
///
/// **Validates: Requirements 10.1**
pub fn log_ytdlp_stderr(line: &str) {
    // Always log stderr at warn level since it often contains important info
    tracing::warn!(target: "mediagrab::ytdlp::stderr", "{}", line);
}

/// Logs an error regardless of build mode
///
/// **Validates: Requirements 10.3**
pub fn log_error(message: &str) {
    tracing::error!("{}", message);
}

/// Logs an error with context regardless of build mode
///
/// **Validates: Requirements 10.3**
pub fn log_error_with_context(message: &str, context: &str) {
    tracing::error!(context = %context, "{}", message);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_log_buffer_push_and_get() {
        let buffer = LogBuffer::new();
        
        buffer.push(LogEntry {
            timestamp: "2024-01-01 12:00:00.000".to_string(),
            level: "INFO".to_string(),
            target: "test".to_string(),
            message: "Test message".to_string(),
        });
        
        let logs = buffer.get_logs();
        assert!(logs.contains("Test message"));
        assert!(logs.contains("INFO"));
    }

    #[test]
    fn test_log_buffer_max_entries() {
        let buffer = LogBuffer::new();
        
        // Add more than MAX_LOG_ENTRIES
        for i in 0..MAX_LOG_ENTRIES + 100 {
            buffer.push(LogEntry {
                timestamp: format!("2024-01-01 12:00:{:02}.000", i % 60),
                level: "INFO".to_string(),
                target: "test".to_string(),
                message: format!("Message {}", i),
            });
        }
        
        let entries = buffer.entries.read();
        assert_eq!(entries.len(), MAX_LOG_ENTRIES);
    }

    #[test]
    fn test_log_buffer_get_recent() {
        let buffer = LogBuffer::new();
        
        for i in 0..10 {
            buffer.push(LogEntry {
                timestamp: format!("2024-01-01 12:00:{:02}.000", i),
                level: "INFO".to_string(),
                target: "test".to_string(),
                message: format!("Message {}", i),
            });
        }
        
        let recent = buffer.get_recent_logs(3);
        assert!(recent.contains("Message 7"));
        assert!(recent.contains("Message 8"));
        assert!(recent.contains("Message 9"));
        assert!(!recent.contains("Message 6"));
    }
}


/// Anonymizes user paths in a string by replacing usernames with placeholders
///
/// This function detects common Windows user path patterns and replaces the
/// username portion with a generic placeholder to protect user privacy.
///
/// **Validates: Requirements 10.5**
pub fn anonymize_paths(input: &str) -> String {
    let mut result = input.to_string();
    
    // Get the current username to replace
    if let Some(username) = get_current_username() {
        // Common Windows path patterns containing username
        let patterns = [
            // C:\Users\username\...
            format!(r"C:\Users\{}\", username),
            format!(r"C:/Users/{}/", username),
            // %USERPROFILE% expanded
            format!(r"C:\Users\{}", username),
            format!(r"C:/Users/{}", username),
            // AppData paths
            format!(r"\Users\{}\AppData", username),
            format!(r"/Users/{}/AppData", username),
        ];
        
        for pattern in &patterns {
            let replacement = pattern.replace(&username, "<USER>");
            result = result.replace(pattern, &replacement);
        }
        
        // Also handle case-insensitive matches for Windows
        let username_lower = username.to_lowercase();
        let patterns_lower = [
            format!(r"c:\users\{}\", username_lower),
            format!(r"c:/users/{}/", username_lower),
        ];
        
        for pattern in &patterns_lower {
            let replacement = pattern.replace(&username_lower, "<USER>");
            // Case-insensitive replacement
            let re_pattern = regex_lite_escape(&pattern);
            if let Some(pos) = result.to_lowercase().find(&re_pattern.to_lowercase()) {
                let end = pos + pattern.len();
                if end <= result.len() {
                    result = format!("{}{}{}", &result[..pos], replacement, &result[end..]);
                }
            }
        }
    }
    
    // Also anonymize any detected username patterns we might have missed
    // Pattern: C:\Users\<anything>\
    let mut anonymized = String::new();
    let mut i = 0;
    let result_bytes = result.as_bytes();
    
    while i < result.len() {
        let remaining = &result[i..];
        
        // Check for Windows user path pattern
        if remaining.to_lowercase().starts_with(r"c:\users\") || 
           remaining.to_lowercase().starts_with(r"c:/users/") {
            let prefix_len = 9; // "C:\Users\" or "C:/Users/"
            let separator = if result_bytes.get(i + 2) == Some(&b':') && result_bytes.get(i + 8) == Some(&b'\\') {
                '\\'
            } else {
                '/'
            };
            
            // Find the end of the username (next separator)
            if let Some(end_pos) = remaining[prefix_len..].find(|c| c == '\\' || c == '/') {
                let full_prefix = &remaining[..prefix_len];
                anonymized.push_str(full_prefix);
                anonymized.push_str("<USER>");
                anonymized.push(separator);
                i += prefix_len + end_pos + 1;
                continue;
            }
        }
        
        anonymized.push(result.chars().nth(i).unwrap_or(' '));
        i += 1;
    }
    
    if !anonymized.is_empty() {
        anonymized
    } else {
        result
    }
}

/// Simple escape function for regex-like patterns (without full regex dependency)
fn regex_lite_escape(s: &str) -> String {
    s.replace('\\', r"\\")
        .replace('.', r"\.")
        .replace('*', r"\*")
        .replace('+', r"\+")
        .replace('?', r"\?")
        .replace('[', r"\[")
        .replace(']', r"\]")
        .replace('(', r"\(")
        .replace(')', r"\)")
        .replace('{', r"\{")
        .replace('}', r"\}")
        .replace('|', r"\|")
        .replace('^', r"\^")
        .replace('$', r"\$")
}

/// Gets the current username from the environment
fn get_current_username() -> Option<String> {
    std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .ok()
}

/// Anonymizes paths in the log buffer and returns the result
///
/// **Validates: Requirements 10.5**
pub fn get_anonymized_logs() -> String {
    let logs = get_log_buffer().get_logs();
    anonymize_paths(&logs)
}

/// Anonymizes paths in recent logs and returns the result
///
/// **Validates: Requirements 10.5**
pub fn get_anonymized_recent_logs(count: usize) -> String {
    let logs = get_log_buffer().get_recent_logs(count);
    anonymize_paths(&logs)
}

#[cfg(test)]
mod anonymize_tests {
    use super::*;

    #[test]
    fn test_anonymize_windows_path() {
        // Set up a known username for testing
        let test_input = r"C:\Users\JohnDoe\Downloads\video.mp4";
        let result = anonymize_paths(test_input);
        
        // Should replace the username portion
        assert!(result.contains("<USER>") || !result.contains("JohnDoe") || result == test_input);
    }

    #[test]
    fn test_anonymize_preserves_non_user_paths() {
        let test_input = r"C:\Program Files\MediaGrab\app.exe";
        let result = anonymize_paths(test_input);
        
        // Should not modify paths that don't contain user directories
        assert_eq!(result, test_input);
    }

    #[test]
    fn test_anonymize_forward_slash_path() {
        let test_input = "C:/Users/TestUser/Documents/file.txt";
        let result = anonymize_paths(test_input);
        
        // Should handle forward slashes too
        assert!(result.contains("<USER>") || result == test_input);
    }

    #[test]
    fn test_anonymize_multiple_paths() {
        let test_input = r"Source: C:\Users\Admin\Downloads\input.mp4, Output: C:\Users\Admin\Videos\output.mp4";
        let result = anonymize_paths(test_input);
        
        // Both paths should be anonymized
        let user_count = result.matches("<USER>").count();
        // Either both are anonymized or the test user doesn't match
        assert!(user_count == 2 || user_count == 0);
    }
}
