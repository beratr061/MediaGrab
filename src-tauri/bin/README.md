# External Binaries for MediaGrab

This directory contains the external executables bundled with MediaGrab.

## Required Files

For Windows (x86_64), place the following files in this directory:

- `yt-dlp-x86_64-pc-windows-msvc.exe` - yt-dlp executable
- `ffmpeg-x86_64-pc-windows-msvc.exe` - ffmpeg executable  
- `ffprobe-x86_64-pc-windows-msvc.exe` - ffprobe executable

## Naming Convention

Tauri requires sidecar binaries to follow a specific naming convention:
`<binary-name>-<target-triple>[.exe]`

For Windows x86_64:
- Target triple: `x86_64-pc-windows-msvc`

## Download Links

- **yt-dlp**: https://github.com/yt-dlp/yt-dlp/releases
  - Download `yt-dlp.exe` and rename to `yt-dlp-x86_64-pc-windows-msvc.exe`

- **ffmpeg/ffprobe**: https://github.com/BtbN/FFmpeg-Builds/releases
  - Download the Windows build (e.g., `ffmpeg-master-latest-win64-gpl.zip`)
  - Extract `ffmpeg.exe` and rename to `ffmpeg-x86_64-pc-windows-msvc.exe`
  - Extract `ffprobe.exe` and rename to `ffprobe-x86_64-pc-windows-msvc.exe`

## Development Note

During development, if these binaries are not present, the application will
attempt to use system-installed versions from PATH. For production builds,
these binaries must be present.
