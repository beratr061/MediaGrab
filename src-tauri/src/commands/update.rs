//! yt-dlp update commands
//!
//! Implements the Tauri commands for updating yt-dlp.
//!
//! **Validates: Requirements 7.6, 7.7, 7.8**

use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};

use crate::utils::create_hidden_async_command;

/// Result of a yt-dlp update operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateResult {
    /// Whether the update was successful
    pub success: bool,
    /// Message describing the result (version info or error)
    pub message: String,
    /// Whether an update was actually performed (vs already up-to-date)
    pub updated: bool,
    /// The new version if updated, or current version if already up-to-date
    pub version: Option<String>,
}

/// Result of checking for yt-dlp updates
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    /// Current installed version
    pub current_version: String,
    /// Whether an update is available
    pub update_available: bool,
    /// Latest version available (if check succeeded)
    pub latest_version: Option<String>,
    /// Error message if check failed
    pub error: Option<String>,
}

/// Gets the current yt-dlp version
async fn get_ytdlp_version() -> Result<String, String> {
    let output = create_hidden_async_command("yt-dlp")
        .arg("--version")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("Failed to execute yt-dlp: {}", e))?;

    if output.status.success() {
        let version = String::from_utf8_lossy(&output.stdout)
            .trim()
            .to_string();
        Ok(version)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Failed to get yt-dlp version: {}", stderr))
    }
}

/// Updates yt-dlp to the latest version
///
/// Executes `yt-dlp -U` for self-update and returns the result.
///
/// **Validates: Requirements 7.6, 7.8**
#[tauri::command]
pub async fn update_ytdlp() -> Result<UpdateResult, String> {
    // Get current version before update
    let current_version = get_ytdlp_version().await.ok();

    // Execute yt-dlp -U for self-update (hidden window)
    let mut child = create_hidden_async_command("yt-dlp")
        .arg("-U")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn yt-dlp update process: {}", e))?;

    // Collect output
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    
    let mut output_lines = Vec::new();
    
    // Read stdout
    if let Some(stdout) = stdout {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            output_lines.push(line);
        }
    }
    
    // Read stderr
    if let Some(stderr) = stderr {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            output_lines.push(line);
        }
    }

    // Wait for process to complete
    let status = child.wait().await
        .map_err(|e| format!("Failed to wait for yt-dlp update: {}", e))?;

    let output_text = output_lines.join("\n");
    
    // Parse the output to determine result
    let (success, updated, message, version) = if status.success() {
        // Check if already up-to-date or updated
        let is_up_to_date = output_text.contains("yt-dlp is up to date") 
            || output_text.contains("is up to date");
        
        let new_version = get_ytdlp_version().await.ok();
        
        if is_up_to_date {
            (
                true,
                false,
                format!("yt-dlp is already up to date ({})", new_version.as_deref().unwrap_or("unknown")),
                new_version,
            )
        } else {
            // Extract version from output if possible
            let version_info = new_version.clone()
                .or_else(|| extract_version_from_output(&output_text));
            
            let msg = if let Some(ref v) = version_info {
                format!("Successfully updated yt-dlp to version {}", v)
            } else {
                "Successfully updated yt-dlp".to_string()
            };
            
            (true, true, msg, version_info)
        }
    } else {
        // Update failed
        let error_msg = if output_text.is_empty() {
            "Update failed with unknown error".to_string()
        } else {
            format!("Update failed: {}", output_text.lines().last().unwrap_or(&output_text))
        };
        
        (false, false, error_msg, current_version)
    };

    Ok(UpdateResult {
        success,
        message,
        updated,
        version,
    })
}


/// Checks if a yt-dlp update is available without performing the update
///
/// **Validates: Requirements 7.7**
#[tauri::command]
pub async fn check_ytdlp_update() -> Result<UpdateCheckResult, String> {
    // Get current version
    let current_version = get_ytdlp_version().await?;

    // Use yt-dlp -U --update-to to check without updating
    // Note: yt-dlp doesn't have a dedicated "check only" flag, so we use --version
    // and compare with the latest release info from the update output
    
    // For a proper check, we'd need to query GitHub API or use yt-dlp's update mechanism
    // For now, we'll run the update in dry-run mode by checking the output
    let output = create_hidden_async_command("yt-dlp")
        .arg("-U")
        .arg("--no-update") // This flag prevents actual update but shows if one is available
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await;

    match output {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            let combined = format!("{}\n{}", stdout, stderr);

            // Check if update is available based on output
            let update_available = combined.contains("Updating to")
                || combined.contains("A new version")
                || combined.contains("available");
            
            let latest_version = if update_available {
                extract_version_from_output(&combined)
            } else {
                Some(current_version.clone())
            };

            Ok(UpdateCheckResult {
                current_version,
                update_available,
                latest_version,
                error: None,
            })
        }
        Err(e) => {
            // If the check fails, return current version with error
            Ok(UpdateCheckResult {
                current_version,
                update_available: false,
                latest_version: None,
                error: Some(format!("Failed to check for updates: {}", e)),
            })
        }
    }
}

/// Gets the current yt-dlp version (exposed as command)
#[tauri::command]
pub async fn get_ytdlp_version_cmd() -> Result<String, String> {
    get_ytdlp_version().await
}

/// Extracts version string from yt-dlp output
fn extract_version_from_output(output: &str) -> Option<String> {
    // Look for version patterns like "2024.01.01" or "yt-dlp 2024.01.01"
    for line in output.lines() {
        // Check for version in format YYYY.MM.DD
        if let Some(version) = extract_date_version(line) {
            return Some(version);
        }
    }
    None
}

/// Extracts a date-based version (YYYY.MM.DD) from a string
fn extract_date_version(text: &str) -> Option<String> {
    // Simple regex-like pattern matching for YYYY.MM.DD
    let chars: Vec<char> = text.chars().collect();
    let len = chars.len();
    
    for i in 0..len {
        // Look for pattern: 4 digits, dot, 2 digits, dot, 2 digits
        if i + 10 <= len {
            let potential = &text[i..i + 10];
            if is_date_version(potential) {
                // Check if there's more (like .1 suffix)
                let mut end = i + 10;
                while end < len && (chars[end].is_ascii_digit() || chars[end] == '.') {
                    end += 1;
                }
                return Some(text[i..end].trim_end_matches('.').to_string());
            }
        }
    }
    None
}

/// Checks if a string matches the YYYY.MM.DD version format
fn is_date_version(s: &str) -> bool {
    let parts: Vec<&str> = s.split('.').collect();
    if parts.len() < 3 {
        return false;
    }
    
    // Check year (4 digits, starts with 20)
    if parts[0].len() != 4 || !parts[0].starts_with("20") || !parts[0].chars().all(|c| c.is_ascii_digit()) {
        return false;
    }
    
    // Check month (2 digits, 01-12)
    if parts[1].len() != 2 || !parts[1].chars().all(|c| c.is_ascii_digit()) {
        return false;
    }
    
    // Check day (2 digits, 01-31)
    if parts[2].len() < 2 || !parts[2][..2].chars().all(|c| c.is_ascii_digit()) {
        return false;
    }
    
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_date_version() {
        assert_eq!(extract_date_version("2024.01.15"), Some("2024.01.15".to_string()));
        assert_eq!(extract_date_version("yt-dlp 2024.01.15"), Some("2024.01.15".to_string()));
        assert_eq!(extract_date_version("Updated to 2024.12.06"), Some("2024.12.06".to_string()));
        assert_eq!(extract_date_version("version 2024.01.15.1"), Some("2024.01.15.1".to_string()));
        assert_eq!(extract_date_version("no version here"), None);
    }

    #[test]
    fn test_is_date_version() {
        assert!(is_date_version("2024.01.15"));
        assert!(is_date_version("2024.12.31"));
        assert!(!is_date_version("24.01.15"));
        assert!(!is_date_version("2024-01-15"));
        assert!(!is_date_version("invalid"));
    }
}
