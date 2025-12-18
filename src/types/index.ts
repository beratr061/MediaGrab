/**
 * TypeScript interfaces matching Rust backend types
 * Requirements: Data Models from design.md
 */

// Download Job State - matches Rust DownloadState enum
export type DownloadState =
  | 'idle'
  | 'analyzing'    // Fetching media info
  | 'starting'
  | 'downloading'
  | 'merging'
  | 'completed'
  | 'cancelled'
  | 'cancelling'
  | 'failed';

// Format options - matches Rust format handling
export type Format = 'video-mp4' | 'audio-mp3' | 'audio-best';

// Quality options - matches Rust quality handling
export type Quality = 'best' | '1080p' | '720p';

// Media info fetched from URL
export interface MediaInfo {
  title: string;
  thumbnail: string | null;
  duration: number | null;
  uploader: string | null;
  filesizeApprox: number | null; // For disk space check
}

// Download configuration sent to backend
export interface DownloadConfig {
  url: string;
  format: Format;
  quality: Quality;
  outputFolder: string;
  embedSubtitles: boolean;
  cookiesFromBrowser: string | null; // 'chrome' | 'firefox' | 'edge' | null
}

// Progress event from backend
// Note: Backend parser strips "%" from yt-dlp output and converts to number
export interface ProgressEvent {
  percentage: number;        // 0-100 (parsed from yt-dlp string like "45.2%")
  downloadedBytes: number;
  totalBytes: number | null;
  speed: string;             // e.g., "2.5MiB/s"
  etaSeconds: number | null;
  status: 'downloading' | 'merging';
}

// Download result from backend
export interface DownloadResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

// User preferences - persisted settings
export interface Preferences {
  outputFolder: string;
  format: Format;
  quality: Quality;
  embedSubtitles: boolean;
  cookiesFromBrowser: string | null;
  checkUpdatesOnStartup: boolean;
}

// Disk space information from backend
export interface DiskSpaceInfo {
  availableBytes: number;
  totalBytes: number;
  hasEnoughSpace: boolean;
  availableFormatted: string;
}

// Folder validation result from backend
export interface FolderValidationResult {
  isValid: boolean;
  isAccessible: boolean;
  diskSpace: DiskSpaceInfo;
  warning: string | null;
}

// yt-dlp update result from backend
export interface UpdateResult {
  success: boolean;
  message: string;
  updated: boolean;
  version: string | null;
}

// yt-dlp update check result from backend
export interface UpdateCheckResult {
  currentVersion: string;
  updateAvailable: boolean;
  latestVersion: string | null;
  error: string | null;
}


// Debug information from backend
export interface DebugInfo {
  appVersion: string;
  osInfo: string;
  windowsVersion: string;
  ytdlpVersion: string | null;
  ffmpegVersion: string | null;
  recentLogs: string;
  memoryInfo: string;
}

// Executable check result from backend
// **Validates: Requirements 6.1, 11.6**
export interface ExecutableCheckResult {
  allAvailable: boolean;
  ytdlpAvailable: boolean;
  ffmpegAvailable: boolean;
  ffprobeAvailable: boolean;
  error: string | null;
  ytdlpVersion: string | null;
  ffmpegVersion: string | null;
}

// Executable paths from backend
export interface ExecutablePaths {
  ytdlp: string;
  ffmpeg: string;
  ffprobe: string;
  ffmpegDir: string;
}

// Event payload for missing executables
export interface ExecutablesMissingEvent {
  ytdlpAvailable: boolean;
  ffmpegAvailable: boolean;
  ffprobeAvailable: boolean;
  error: string;
}


// ============================================
// Queue System Types
// ============================================

// Queue item status
export type QueueItemStatus =
  | 'pending'
  | 'downloading'
  | 'merging'
  | 'completed'
  | 'failed'
  | 'cancelled';

// Queue item
export interface QueueItem {
  id: number;
  config: DownloadConfig;
  status: QueueItemStatus;
  progress: number;
  speed: string;
  etaSeconds: number | null;
  error: string | null;
  filePath: string | null;
  title: string | null;
  thumbnail: string | null;
}

// Queue event types
export type QueueEvent =
  | { type: 'itemAdded'; item: QueueItem }
  | { type: 'itemUpdated'; item: QueueItem }
  | { type: 'itemRemoved'; id: number }
  | { type: 'queueCleared' };
