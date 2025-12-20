//! Process spawning and control
//!
//! This module handles spawning yt-dlp as a child process, streaming output,
//! and handling process termination.
//!
//! **Validates: Requirements 1.1, 1.4, 11.3**

use std::path::Path;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Child;
use tokio::sync::mpsc;

use crate::download::args::ArgumentBuilder;
use crate::download::parser::{parse_error_line, parse_progress_line, ParsedLine};
use crate::models::{DownloadConfig, DownloadError, ProgressEvent};
use crate::utils::logging::{log_ytdlp_command, log_ytdlp_stdout, log_ytdlp_stderr};

/// Output from the yt-dlp process
#[derive(Debug, Clone)]
pub enum ProcessOutput {
    /// Progress update
    Progress(ProgressEvent),
    /// Merging state detected
    Merging,
    /// Error detected in stderr
    Error(DownloadError),
    /// Final file path detected from --print after_move:filepath
    FilePath(String),
    /// Process completed successfully
    Completed(String), // file path
    /// Process exited with error code
    ExitError(i32),
    /// Process was terminated
    Terminated,
}

/// Configuration for spawning yt-dlp
pub struct SpawnConfig {
    /// Path to yt-dlp executable
    pub ytdlp_path: String,
    /// Path to ffmpeg directory (optional)
    pub ffmpeg_location: Option<String>,
}

impl Default for SpawnConfig {
    fn default() -> Self {
        Self {
            ytdlp_path: "yt-dlp".to_string(),
            ffmpeg_location: None,
        }
    }
}

/// Spawns yt-dlp process with the given configuration
///
/// **Validates: Requirements 1.1, 11.3**
pub async fn spawn_ytdlp(
    config: &DownloadConfig,
    spawn_config: &SpawnConfig,
) -> Result<Child, DownloadError> {
    // Build arguments
    let mut builder = ArgumentBuilder::new(config.clone());
    
    if let Some(ref ffmpeg_path) = spawn_config.ffmpeg_location {
        builder = builder.with_ffmpeg_location(ffmpeg_path.clone());
    }
    
    // Add proxy if configured
    if let Some(ref proxy) = config.proxy_url {
        builder = builder.with_proxy(Some(proxy.clone()));
    }
    
    let args = builder.build();
    
    // Verify output folder exists and is accessible
    let output_path = Path::new(&config.output_folder);
    if !output_path.exists() {
        return Err(DownloadError::FolderNotAccessible(format!(
            "Output folder does not exist: {}",
            config.output_folder
        )));
    }
    
    if !output_path.is_dir() {
        return Err(DownloadError::FolderNotAccessible(format!(
            "Output path is not a directory: {}",
            config.output_folder
        )));
    }

    // Log the command being executed
    // **Validates: Requirements 10.1**
    log_ytdlp_command(&args);

    // Spawn the process with hidden window
    // Set working directory to output folder (Requirement 11.3)
    let mut command = crate::utils::create_hidden_async_command(&spawn_config.ytdlp_path);
    command
        .args(&args[..])
        .current_dir(&config.output_folder)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true); // Ensure process is killed when handle is dropped

    let child = command.spawn().map_err(|e| {
            let error = if e.kind() == std::io::ErrorKind::NotFound {
                DownloadError::ExecutableNotFound(spawn_config.ytdlp_path.clone())
            } else {
                DownloadError::ProcessSpawnError(e.to_string())
            };
            tracing::error!("Failed to spawn yt-dlp: {}", error);
            error
        })?;
    
    tracing::info!("yt-dlp process spawned successfully");
    Ok(child)
}

/// Streams output from a yt-dlp process and sends parsed events through a channel
///
/// This function takes ownership of the child process and streams its output
/// until completion or termination.
///
/// **Validates: Requirements 1.1, 1.4**
pub async fn stream_process_output(
    mut child: Child,
    tx: mpsc::Sender<ProcessOutput>,
) -> Result<(), DownloadError> {
    tracing::info!("stream_process_output: Starting to capture process output");
    
    let stdout = match child.stdout.take() {
        Some(stdout) => {
            tracing::info!("stream_process_output: stdout captured successfully");
            stdout
        }
        None => {
            tracing::error!("stream_process_output: Failed to capture stdout - it was None!");
            return Err(DownloadError::ProcessSpawnError("Failed to capture stdout".to_string()));
        }
    };
    
    let stderr = match child.stderr.take() {
        Some(stderr) => {
            tracing::info!("stream_process_output: stderr captured successfully");
            stderr
        }
        None => {
            tracing::error!("stream_process_output: Failed to capture stderr - it was None!");
            return Err(DownloadError::ProcessSpawnError("Failed to capture stderr".to_string()));
        }
    };
    
    let mut stderr_reader = BufReader::new(stderr).lines();
    
    tracing::info!("stream_process_output: Created buffered readers, starting read tasks");
    
    let tx_stdout = tx.clone();
    let tx_stderr = tx.clone();
    
    // Spawn task to read stdout
    // Note: yt-dlp uses \r for progress updates on Windows, so we need custom line handling
    // **Validates: Requirements 10.1**
    let stdout_task = tokio::spawn(async move {
        use tokio::io::AsyncReadExt;
        let mut buffer = Vec::new();
        let mut byte = [0u8; 1];
        let mut stdout_inner = BufReader::new(stdout);
        
        loop {
            match stdout_inner.read(&mut byte).await {
                Ok(0) => break, // EOF
                Ok(_) => {
                    if byte[0] == b'\n' || byte[0] == b'\r' {
                        if !buffer.is_empty() {
                            if let Ok(line) = String::from_utf8(buffer.clone()) {
                                let line = line.trim();
                                if !line.is_empty() {
                                    // Log stdout output
                                    log_ytdlp_stdout(line);
                                    
                                    let parsed = parse_progress_line(line);
                                    
                                    match parsed {
                                        ParsedLine::Progress(event) => {
                                            tracing::debug!("Progress: {}%", event.percentage);
                                            let _ = tx_stdout.send(ProcessOutput::Progress(event)).await;
                                        }
                                        ParsedLine::Merging => {
                                            tracing::info!("Merging state detected");
                                            let _ = tx_stdout.send(ProcessOutput::Merging).await;
                                        }
                                        ParsedLine::Unknown => {
                                            // Check if this line is the final filepath
                                            if is_valid_filepath(line) {
                                                tracing::info!("Detected file path: {}", line);
                                                let _ = tx_stdout.send(ProcessOutput::FilePath(line.to_string())).await;
                                            }
                                        }
                                    }
                                }
                            }
                            buffer.clear();
                        }
                    } else {
                        buffer.push(byte[0]);
                    }
                }
                Err(_) => break,
            }
        }
    });
                        }
                    } else {
                        buffer.push(byte[0]);
                    }
                }
                Err(_) => break,
            }
        }
    });
    
    // Spawn task to read stderr
    // **Validates: Requirements 10.1**
    // Note: Also parse progress from stderr as some yt-dlp versions output progress there
    let stderr_task = tokio::spawn(async move {
        while let Ok(Some(line)) = stderr_reader.next_line().await {
            // Log stderr output (always logged as it often contains important info)
            log_ytdlp_stderr(&line);
            
            // First try to parse as progress (some yt-dlp versions output progress to stderr)
            let parsed = parse_progress_line(&line);
            match parsed {
                ParsedLine::Progress(event) => {
                    tracing::info!("Progress event (from stderr): {}% speed={}", event.percentage, event.speed);
                    let _ = tx_stderr.send(ProcessOutput::Progress(event)).await;
                    continue;
                }
                ParsedLine::Merging => {
                    tracing::info!("Merging state detected (from stderr)");
                    let _ = tx_stderr.send(ProcessOutput::Merging).await;
                    continue;
                }
                ParsedLine::Unknown => {
                    // Not progress, try to parse as error
                }
            }
            
            // Try to parse as error
            if let Some(parsed_error) = parse_error_line(&line) {
                let download_error: DownloadError = parsed_error.into();
                let _ = tx_stderr.send(ProcessOutput::Error(download_error)).await;
            }
        }
    });
    
    // Wait for both readers to complete
    let _ = tokio::join!(stdout_task, stderr_task);
    
    // Wait for process to exit
    match child.wait().await {
        Ok(status) => {
            if status.success() {
                // Process completed successfully
                // Note: The actual file path should be tracked separately
                let _ = tx.send(ProcessOutput::Completed(String::new())).await;
            } else {
                let code = status.code().unwrap_or(-1);
                if code == -1 || code == 137 || code == 9 {
                    // Process was terminated (SIGKILL on Unix, or similar on Windows)
                    let _ = tx.send(ProcessOutput::Terminated).await;
                } else {
                    let _ = tx.send(ProcessOutput::ExitError(code)).await;
                }
            }
        }
        Err(e) => {
            let _ = tx.send(ProcessOutput::Error(
                DownloadError::ProcessSpawnError(e.to_string())
            )).await;
        }
    }
    
    Ok(())
}

/// Checks if a line looks like a valid file path (from --print after_move:filepath)
fn is_valid_filepath(line: &str) -> bool {
    let path = Path::new(line);
    
    // Must be an absolute path
    if !path.is_absolute() {
        return false;
    }
    
    // Must have a file extension (media files always have extensions)
    if path.extension().is_none() {
        return false;
    }
    
    // Should not contain yt-dlp output markers
    if line.contains('[') || line.contains(']') || line.contains("download:") {
        return false;
    }
    
    // Check for common media extensions
    let ext = path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();
    
    matches!(ext.as_str(), 
        "mp4" | "mkv" | "webm" | "avi" | "mov" | "flv" |
        "mp3" | "m4a" | "opus" | "ogg" | "wav" | "flac" | "aac"
    )
}

/// Extracts the output file path from yt-dlp output lines
#[allow(dead_code)]
fn extract_output_path(line: &str) -> Option<String> {
    // Pattern: [download] Destination: /path/to/file.mp4
    if line.contains("[download] Destination:") {
        return line.split("Destination:").nth(1).map(|s| s.trim().to_string());
    }
    
    // Pattern: [Merger] Merging formats into "/path/to/file.mp4"
    if line.contains("[Merger] Merging formats into") {
        return line
            .split("into")
            .nth(1)
            .map(|s| s.trim().trim_matches('"').to_string());
    }
    
    None
}

/// Kills a child process
///
/// **Validates: Requirements 1.4**
pub async fn kill_process(child: &mut Child) -> Result<(), DownloadError> {
    child.kill().await.map_err(|e| {
        DownloadError::GenericError(format!("Failed to kill process: {}", e))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_output_path_destination() {
        let line = "[download] Destination: C:\\Downloads\\video.mp4";
        let path = extract_output_path(line);
        assert_eq!(path, Some("C:\\Downloads\\video.mp4".to_string()));
    }

    #[test]
    fn test_extract_output_path_merger() {
        let line = "[Merger] Merging formats into \"C:\\Downloads\\video.mp4\"";
        let path = extract_output_path(line);
        assert_eq!(path, Some("C:\\Downloads\\video.mp4".to_string()));
    }

    #[test]
    fn test_extract_output_path_no_match() {
        let line = "[info] Downloading video";
        let path = extract_output_path(line);
        assert!(path.is_none());
    }

    #[test]
    fn test_spawn_config_default() {
        let config = SpawnConfig::default();
        assert_eq!(config.ytdlp_path, "yt-dlp");
        assert!(config.ffmpeg_location.is_none());
    }
}
