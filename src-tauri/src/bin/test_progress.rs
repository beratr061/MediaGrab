//! Test binary to debug yt-dlp progress parsing

use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

// Import the parser
use mediagrab_lib::download::parser::{parse_progress_line, ParsedLine};

#[cfg(windows)]
fn create_hidden_command(program: &str) -> Command {
    #[allow(unused_imports)]
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    
    let mut cmd = Command::new(program);
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

#[cfg(not(windows))]
fn create_hidden_command(program: &str) -> Command {
    Command::new(program)
}

#[tokio::main]
async fn main() {
    let ytdlp_path = std::env::var("APPDATA")
        .map(|p| format!("{}\\com.mediagrab\\bin\\yt-dlp.exe", p))
        .unwrap_or_else(|_| "yt-dlp".to_string());
    
    let url = "https://www.youtube.com/watch?v=jNQXAC9IVRw";
    let temp_dir = std::env::temp_dir().join("ytdlp_rust_test2");
    std::fs::create_dir_all(&temp_dir).unwrap();
    
    println!("Using yt-dlp: {}", ytdlp_path);
    println!("Output dir: {:?}", temp_dir);
    println!("URL: {}", url);
    println!("Using CREATE_NO_WINDOW flag: true");
    println!("---");
    
    let mut child = create_hidden_command(&ytdlp_path)
        .args([
            url,
            "-f", "worst",
            "-o", &format!("{}\\%(title)s.%(ext)s", temp_dir.display()),
            "--progress-template", "%(progress.percentage)s|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress._speed_str)s|%(progress._eta_str)s",
            "--newline",
            "--no-warnings",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("Failed to spawn yt-dlp");
    
    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    
    let mut stdout_reader = BufReader::new(stdout).lines();
    let mut stderr_reader = BufReader::new(stderr).lines();
    
    // Read stdout
    let stdout_task = tokio::spawn(async move {
        let mut line_count = 0;
        let mut progress_count = 0;
        while let Ok(Some(line)) = stdout_reader.next_line().await {
            line_count += 1;
            
            // Parse the line using our parser
            let parsed = parse_progress_line(&line);
            
            match &parsed {
                ParsedLine::Progress(event) => {
                    progress_count += 1;
                    println!("[PROGRESS {}] {}% | {} bytes | speed={} | eta={:?}", 
                        progress_count, 
                        event.percentage, 
                        event.downloaded_bytes,
                        event.speed,
                        event.eta_seconds
                    );
                }
                ParsedLine::Merging => {
                    println!("[MERGING] {}", line);
                }
                ParsedLine::Unknown => {
                    println!("[OTHER] {}", line);
                }
            }
        }
        println!("---");
        println!("STDOUT finished: {} lines, {} progress events", line_count, progress_count);
    });
    
    // Read stderr
    let stderr_task = tokio::spawn(async move {
        while let Ok(Some(line)) = stderr_reader.next_line().await {
            println!("[STDERR] {}", line);
        }
    });
    
    let _ = tokio::join!(stdout_task, stderr_task);
    
    let status = child.wait().await.unwrap();
    println!("Process exited with: {:?}", status);
}
