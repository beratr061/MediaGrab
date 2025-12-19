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
export type Format = 
  // Video formats
  | 'video-mp4' 
  | 'video-webm' 
  | 'video-mkv'
  // Audio formats  
  | 'audio-mp3' 
  | 'audio-best'
  | 'audio-flac'
  | 'audio-wav'
  | 'audio-aac'
  | 'audio-opus';

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
  filenameTemplate?: string | null; // Custom filename template
  proxyUrl?: string | null; // Proxy URL (e.g., "http://127.0.0.1:8080")
  cookiesFilePath?: string | null; // Path to custom cookies.txt file
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
  checkAppUpdatesOnStartup: boolean;
  // Proxy settings
  proxyEnabled: boolean;
  proxyUrl: string | null; // e.g., "http://127.0.0.1:8080" or "socks5://127.0.0.1:1080"
  // Filename template
  filenameTemplate: string | null; // e.g., "{title} - {uploader} [{quality}]"
  // Custom cookies file
  cookiesFilePath: string | null; // Path to cookies.txt file (Netscape format)
  // Bandwidth limiting (KB/s, 0 = unlimited)
  bandwidthLimit: number | null;
  // Scheduled downloads
  scheduledDownloads: ScheduledDownload[] | null;
}

// Scheduled download configuration
export interface ScheduledDownload {
  id: string;
  url: string;
  format: Format;
  quality: Quality;
  scheduledTime: number; // Unix timestamp
  enabled: boolean;
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

// Retry event from backend
export interface RetryEvent {
  attempt: number;
  maxRetries: number;
  delayMs: number;
  error: string;
}


// ============================================
// History System Types
// ============================================

// History item - a completed download record
export interface HistoryItem {
  id: string;
  url: string;
  title: string;
  thumbnail: string | null;
  format: string;
  quality: string;
  filePath: string | null;
  fileSize: number | null;
  duration: number | null;
  downloadedAt: number; // Unix timestamp
  status: 'completed' | 'failed';
  error: string | null;
}

// Download statistics
export interface DownloadStats {
  totalDownloads: number;
  successfulDownloads: number;
  failedDownloads: number;
  totalBytesDownloaded: number;
  totalDurationSeconds: number;
}


// ============================================
// Playlist System Types
// ============================================

// A single video entry in a playlist
export interface PlaylistEntry {
  id: string;
  title: string;
  url: string;
  thumbnail: string | null;
  duration: number | null;
  playlistIndex: number;
  uploader: string | null;
}

// Playlist information
export interface PlaylistInfo {
  id: string;
  title: string;
  url: string;
  thumbnail: string | null;
  uploader: string | null;
  videoCount: number;
  entries: PlaylistEntry[];
}


// ============================================
// Subtitle System Types
// ============================================

// A single subtitle track
export interface SubtitleTrack {
  langCode: string;
  langName: string;
  isAutomatic: boolean;
  formats: string[];
}

// Subtitle information for a video
export interface SubtitleInfo {
  subtitles: SubtitleTrack[];
  automaticCaptions: SubtitleTrack[];
  hasSubtitles: boolean;
}

// Subtitle download options
export interface SubtitleOptions {
  downloadSubtitles: boolean;
  embedSubtitles: boolean;
  languages: string[];
  format: 'srt' | 'vtt' | 'ass';
  includeAuto: boolean;
}
