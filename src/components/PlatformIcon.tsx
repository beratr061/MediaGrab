import { memo } from "react";
import { cn } from "@/lib/utils";

export type Platform = 
  | "youtube" 
  | "vimeo" 
  | "twitter" 
  | "tiktok" 
  | "instagram" 
  | "facebook" 
  | "twitch" 
  | "dailymotion"
  | "soundcloud"
  | "spotify"
  | "reddit"
  | "unknown";

interface PlatformConfig {
  name: string;
  color: string;
  bgColor: string;
  patterns: RegExp[];
}

const PLATFORMS: Record<Platform, PlatformConfig> = {
  youtube: {
    name: "YouTube",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    patterns: [/youtube\.com/, /youtu\.be/, /youtube-nocookie\.com/],
  },
  vimeo: {
    name: "Vimeo",
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    patterns: [/vimeo\.com/],
  },
  twitter: {
    name: "X (Twitter)",
    color: "text-foreground",
    bgColor: "bg-foreground/10",
    patterns: [/twitter\.com/, /x\.com/],
  },
  tiktok: {
    name: "TikTok",
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
    patterns: [/tiktok\.com/, /vm\.tiktok\.com/],
  },
  instagram: {
    name: "Instagram",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    patterns: [/instagram\.com/, /instagr\.am/],
  },
  facebook: {
    name: "Facebook",
    color: "text-blue-600",
    bgColor: "bg-blue-600/10",
    patterns: [/facebook\.com/, /fb\.watch/, /fb\.com/],
  },
  twitch: {
    name: "Twitch",
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
    patterns: [/twitch\.tv/, /clips\.twitch\.tv/],
  },
  dailymotion: {
    name: "Dailymotion",
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    patterns: [/dailymotion\.com/, /dai\.ly/],
  },
  soundcloud: {
    name: "SoundCloud",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    patterns: [/soundcloud\.com/],
  },
  spotify: {
    name: "Spotify",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    patterns: [/spotify\.com/, /open\.spotify\.com/],
  },
  reddit: {
    name: "Reddit",
    color: "text-orange-600",
    bgColor: "bg-orange-600/10",
    patterns: [/reddit\.com/, /v\.redd\.it/],
  },
  unknown: {
    name: "Unknown",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    patterns: [],
  },
};

export function detectPlatform(url: string): Platform {
  const lowerUrl = url.toLowerCase();
  
  for (const [platform, config] of Object.entries(PLATFORMS)) {
    if (platform === "unknown") continue;
    if (config.patterns.some((pattern) => pattern.test(lowerUrl))) {
      return platform as Platform;
    }
  }
  
  return "unknown";
}

interface PlatformIconProps {
  platform: Platform;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export const PlatformIcon = memo(function PlatformIcon({
  platform,
  size = "md",
  showLabel = false,
  className,
}: PlatformIconProps) {
  const config = PLATFORMS[platform];
  
  const sizeClasses = {
    sm: "h-4 w-4 text-[10px]",
    md: "h-6 w-6 text-xs",
    lg: "h-8 w-8 text-sm",
  };

  if (platform === "unknown") {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-md font-bold",
          config.bgColor,
          config.color,
          sizeClasses[size]
        )}
        title={config.name}
      >
        {platform === "youtube" && <YouTubeIcon />}
        {platform === "vimeo" && <VimeoIcon />}
        {platform === "twitter" && <TwitterIcon />}
        {platform === "tiktok" && <TikTokIcon />}
        {platform === "instagram" && <InstagramIcon />}
        {platform === "facebook" && <FacebookIcon />}
        {platform === "twitch" && <TwitchIcon />}
        {platform === "dailymotion" && <DailymotionIcon />}
        {platform === "soundcloud" && <SoundCloudIcon />}
        {platform === "spotify" && <SpotifyIcon />}
        {platform === "reddit" && <RedditIcon />}
      </div>
      {showLabel && (
        <span className={cn("text-sm font-medium", config.color)}>
          {config.name}
        </span>
      )}
    </div>
  );
});

// Simple SVG icons for each platform
function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full p-1">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

function VimeoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full p-1">
      <path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881L5.322 11.4C4.603 8.816 3.834 7.522 3.01 7.522c-.179 0-.806.378-1.881 1.132L0 7.197c1.185-1.044 2.351-2.084 3.501-3.128C5.08 2.701 6.266 1.984 7.055 1.91c1.867-.18 3.016 1.1 3.447 3.838.465 2.953.789 4.789.971 5.507.539 2.45 1.131 3.674 1.776 3.674.502 0 1.256-.796 2.265-2.385 1.004-1.589 1.54-2.797 1.612-3.628.144-1.371-.395-2.061-1.614-2.061-.574 0-1.167.121-1.777.391 1.186-3.868 3.434-5.757 6.762-5.637 2.473.06 3.628 1.664 3.493 4.797l-.013.01z"/>
    </svg>
  );
}

function TwitterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full p-1.5">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full p-1">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full p-1">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full p-1">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

function TwitchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full p-1">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
    </svg>
  );
}

function DailymotionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full p-1">
      <path d="M12.006 13.237c-1.61 0-2.907 1.313-2.907 2.927 0 1.617 1.297 2.927 2.907 2.927 1.613 0 2.91-1.31 2.91-2.927 0-1.614-1.297-2.927-2.91-2.927zm7.017-9.03c-.26-.26-.63-.41-1.01-.41h-3.39c-.38 0-.75.15-1.01.41-.26.26-.41.63-.41 1.01v6.39c-.78-.78-1.87-1.27-3.08-1.27-2.42 0-4.38 1.96-4.38 4.38s1.96 4.38 4.38 4.38c2.42 0 4.38-1.96 4.38-4.38V5.627h2.52v.01c.38 0 .75-.15 1.01-.41.26-.26.41-.63.41-1.01 0-.38-.15-.75-.41-1.01z"/>
    </svg>
  );
}

function SoundCloudIcon() {
  return (
    <svg viewBox="0 0 143 64" fill="currentColor" className="h-full w-full p-0.5">
      <path d="M142.984,44.993 C142.383,55.703 133.445,64.035 122.719,63.886 L74.008,63.886 C71.778,63.865 69.977,62.056 69.967,59.825 L69.967,7.378 C69.894,5.536 70.962,3.839 72.655,3.108 C72.655,3.108 77.135,0 86.572,0 C92.337,-0.007 97.996,1.548 102.949,4.499 C110.763,9.097 116.295,16.758 118.2,25.623 C119.881,25.147 121.62,24.91 123.367,24.917 C128.66,24.884 133.739,27.004 137.438,30.789 C141.138,34.575 143.14,39.702 142.984,44.993 Z M63.885,10.695 C65.353,28.483 66.421,44.707 63.885,62.437 C63.797,63.239 63.119,63.846 62.312,63.846 C61.505,63.846 60.828,63.239 60.739,62.437 C58.375,44.859 59.405,28.33 60.739,10.695 C60.673,10.092 60.957,9.504 61.471,9.181 C61.986,8.859 62.639,8.859 63.153,9.181 C63.667,9.504 63.952,10.092 63.885,10.695 Z M54.029,62.456 C53.905,63.265 53.208,63.864 52.389,63.864 C51.57,63.864 50.873,63.265 50.75,62.456 C48.986,47.287 48.986,31.965 50.75,16.796 C50.84,15.954 51.551,15.315 52.399,15.315 C53.246,15.315 53.957,15.954 54.048,16.796 C56.005,31.953 55.999,47.3 54.029,62.456 Z M44.153,15.252 C45.755,31.552 46.479,46.155 44.134,62.418 C44.134,63.291 43.426,64 42.552,64 C41.678,64 40.969,63.291 40.969,62.418 C38.701,46.365 39.463,31.342 40.969,15.252 C41.058,14.44 41.744,13.825 42.561,13.825 C43.378,13.825 44.064,14.44 44.153,15.252 Z M34.259,62.475 C34.169,63.297 33.475,63.92 32.648,63.92 C31.821,63.92 31.126,63.297 31.037,62.475 C29.216,48.324 29.216,33.997 31.037,19.846 C31.037,18.941 31.771,18.207 32.676,18.207 C33.582,18.207 34.316,18.941 34.316,19.846 C36.251,33.991 36.232,48.335 34.259,62.475 Z M24.383,30.503 C26.881,41.561 25.756,51.322 24.288,62.589 C24.169,63.339 23.522,63.891 22.763,63.891 C22.003,63.891 21.357,63.339 21.238,62.589 C19.903,51.474 18.797,41.485 21.142,30.503 C21.142,29.608 21.868,28.883 22.763,28.883 C23.658,28.883 24.383,29.608 24.383,30.503 Z M14.527,28.826 C16.815,40.15 16.071,49.74 14.47,61.102 C14.279,62.78 11.4,62.799 11.248,61.102 C9.799,49.911 9.112,40.036 11.191,28.826 C11.282,27.973 12.001,27.327 12.859,27.327 C13.716,27.327 14.436,27.973 14.527,28.826 Z M4.575,34.316 C6.977,41.828 6.157,47.928 4.48,55.631 C4.392,56.422 3.723,57.021 2.926,57.021 C2.129,57.021 1.46,56.422 1.372,55.631 C-0.077,48.081 -0.668,41.847 1.239,34.316 C1.33,33.464 2.05,32.817 2.907,32.817 C3.764,32.817 4.484,33.464 4.575,34.316 Z"/>
    </svg>
  );
}

function SpotifyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full p-1">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  );
}

function RedditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full p-1">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
    </svg>
  );
}

// Supported platforms list for empty state
export const SUPPORTED_PLATFORMS: Platform[] = [
  "youtube",
  "vimeo",
  "twitter",
  "tiktok",
  "instagram",
  "facebook",
  "twitch",
  "dailymotion",
  "soundcloud",
  "reddit",
];
