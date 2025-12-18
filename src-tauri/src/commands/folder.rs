//! Folder picker and validation commands

use fs2::available_space;
use fs2::total_space;
use std::fs;
use std::path::Path;
use tauri_plugin_dialog::DialogExt;

use crate::utils::create_hidden_command;

/// Open native folder picker dialog and return selected path
#[tauri::command]
pub async fn pick_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let folder = app
        .dialog()
        .file()
        .set_title("Select Download Folder")
        .blocking_pick_folder();
    
    match folder {
        Some(path) => Ok(Some(path.to_string())),
        None => Ok(None), // User cancelled
    }
}

/// Open native file picker dialog for cookies.txt file
#[tauri::command]
pub async fn pick_cookies_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let file = app
        .dialog()
        .file()
        .set_title("Select Cookies File")
        .add_filter("Cookies File", &["txt"])
        .blocking_pick_file();
    
    match file {
        Some(path) => Ok(Some(path.to_string())),
        None => Ok(None), // User cancelled
    }
}

/// Check if a folder is accessible (exists and writable)
#[tauri::command]
pub fn check_folder_accessible(path: String) -> Result<bool, String> {
    let folder_path = Path::new(&path);
    
    // Check if path exists
    if !folder_path.exists() {
        return Err(format!("Folder does not exist: {}", path));
    }
    
    // Check if it's a directory
    if !folder_path.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }
    
    // Check write permissions by attempting to create a temp file
    let test_file = folder_path.join(".mediagrab_write_test");
    match fs::write(&test_file, b"test") {
        Ok(_) => {
            // Clean up test file
            let _ = fs::remove_file(&test_file);
            Ok(true)
        }
        Err(e) => Err(format!("Cannot write to folder: {}", e)),
    }
}

/// Disk space information
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskSpaceInfo {
    /// Available space in bytes
    pub available_bytes: u64,
    /// Total space in bytes
    pub total_bytes: u64,
    /// Whether there's enough space for the estimated file size
    pub has_enough_space: bool,
    /// Human-readable available space
    pub available_formatted: String,
}

/// Check available disk space for a folder
#[tauri::command]
pub fn check_disk_space(path: String, estimated_size_bytes: Option<u64>) -> Result<DiskSpaceInfo, String> {
    let folder_path = Path::new(&path);
    
    if !folder_path.exists() {
        return Err(format!("Folder does not exist: {}", path));
    }
    
    // Get available and total space using fs2
    let available = available_space(folder_path)
        .map_err(|e| format!("Failed to get available disk space: {}", e))?;
    
    let total = total_space(folder_path)
        .map_err(|e| format!("Failed to get total disk space: {}", e))?;
    
    let has_enough_space = match estimated_size_bytes {
        Some(size) => available > size,
        None => true, // If no estimate, assume enough space
    };
    
    Ok(DiskSpaceInfo {
        available_bytes: available,
        total_bytes: total,
        has_enough_space,
        available_formatted: format_bytes(available),
    })
}

/// Format bytes into human-readable string
fn format_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;
    const TB: u64 = GB * 1024;
    
    if bytes >= TB {
        format!("{:.2} TB", bytes as f64 / TB as f64)
    } else if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

/// Validate folder before download - checks accessibility and disk space
#[tauri::command]
pub fn validate_folder_for_download(
    path: String,
    estimated_size_bytes: Option<u64>,
) -> Result<FolderValidationResult, String> {
    // Check accessibility first
    let is_accessible = check_folder_accessible(path.clone())?;
    
    // Then check disk space
    let disk_space = check_disk_space(path.clone(), estimated_size_bytes)?;
    
    let warning = if !disk_space.has_enough_space {
        Some(format!(
            "Low disk space: only {} available",
            disk_space.available_formatted
        ))
    } else {
        None
    };
    
    Ok(FolderValidationResult {
        is_valid: is_accessible && disk_space.has_enough_space,
        is_accessible,
        disk_space,
        warning,
    })
}

/// Result of folder validation
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderValidationResult {
    /// Whether the folder is valid for download
    pub is_valid: bool,
    /// Whether the folder is accessible (exists and writable)
    pub is_accessible: bool,
    /// Disk space information
    pub disk_space: DiskSpaceInfo,
    /// Warning message if any
    pub warning: Option<String>,
}


/// Open a folder in Windows Explorer
/// Requirements: 4.3 - Display buttons to open the output folder
#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    let folder_path = Path::new(&path);
    
    if !folder_path.exists() {
        return Err(format!("Folder does not exist: {}", path));
    }
    
    if !folder_path.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }
    
    // Use Windows explorer to open the folder (hidden command window)
    create_hidden_command("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Failed to open folder: {}", e))?;
    
    Ok(())
}

/// Open a file with the default system application
/// Requirements: 4.3 - Display buttons to play the file
#[tauri::command]
pub fn open_file(path: String) -> Result<(), String> {
    let file_path = Path::new(&path);
    
    if !file_path.exists() {
        return Err(format!("File does not exist: {}", path));
    }
    
    if !file_path.is_file() {
        return Err(format!("Path is not a file: {}", path));
    }
    
    // Use Windows 'start' command to open file with default application
    // We use cmd /c start "" "path" to handle paths with spaces (hidden command window)
    create_hidden_command("cmd")
        .args(["/c", "start", "", &path])
        .spawn()
        .map_err(|e| format!("Failed to open file: {}", e))?;
    
    Ok(())
}
