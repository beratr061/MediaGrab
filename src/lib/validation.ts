/**
 * URL validation and sanitization utilities
 * Requirements: 1.2 - WHEN a user enters an empty URL THEN MediaGrab SHALL display an error message
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedUrl?: string;
}

// Allowed protocols for media URLs
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

// Known dangerous URL patterns
const DANGEROUS_PATTERNS = [
  /javascript:/i,
  /data:/i,
  /vbscript:/i,
  /file:/i,
  /<script/i,
  /%3Cscript/i,
  /on\w+\s*=/i, // onclick=, onerror=, etc.
];

// Common video platform domains (for validation hints, not restrictions)
const KNOWN_VIDEO_PLATFORMS = [
  'youtube.com', 'youtu.be', 'www.youtube.com',
  'vimeo.com', 'www.vimeo.com',
  'dailymotion.com', 'www.dailymotion.com',
  'twitch.tv', 'www.twitch.tv', 'clips.twitch.tv',
  'twitter.com', 'x.com', 'www.twitter.com',
  'facebook.com', 'www.facebook.com', 'fb.watch',
  'instagram.com', 'www.instagram.com',
  'tiktok.com', 'www.tiktok.com',
  'reddit.com', 'www.reddit.com',
  'soundcloud.com', 'www.soundcloud.com',
  'bandcamp.com',
  'bilibili.com', 'www.bilibili.com',
  'nicovideo.jp', 'www.nicovideo.jp',
];

/**
 * Sanitizes a URL by removing potentially dangerous content
 */
export function sanitizeUrl(url: string): string {
  let sanitized = url.trim();
  
  // Remove null bytes and other control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Remove leading/trailing whitespace and newlines
  sanitized = sanitized.replace(/^[\s\n\r]+|[\s\n\r]+$/g, '');
  
  // Decode any double-encoded characters (prevent bypass attempts)
  try {
    // Only decode if it looks encoded
    if (sanitized.includes('%')) {
      const decoded = decodeURIComponent(sanitized);
      // Check if decoded version is safe
      if (!DANGEROUS_PATTERNS.some(p => p.test(decoded))) {
        sanitized = decoded;
      }
    }
  } catch {
    // If decoding fails, keep original
  }
  
  // Remove any HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  // Normalize multiple slashes (except after protocol)
  sanitized = sanitized.replace(/([^:])\/\/+/g, '$1/');
  
  return sanitized;
}

/**
 * Checks if a URL contains dangerous patterns
 */
export function containsDangerousPatterns(url: string): boolean {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Validates URL protocol
 */
export function hasValidProtocol(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_PROTOCOLS.includes(parsed.protocol);
  } catch {
    // If URL parsing fails, check manually
    const lowerUrl = url.toLowerCase();
    return lowerUrl.startsWith('http://') || lowerUrl.startsWith('https://');
  }
}

/**
 * Checks if URL is from a known video platform
 */
export function isKnownPlatform(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return KNOWN_VIDEO_PLATFORMS.some(platform => 
      hostname === platform || hostname.endsWith('.' + platform)
    );
  } catch {
    return false;
  }
}

/**
 * Validates URL structure
 */
export function isValidUrlStructure(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Must have a valid hostname
    if (!parsed.hostname || parsed.hostname.length < 3) {
      return false;
    }
    // Hostname should have at least one dot (except localhost)
    if (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost') {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates a URL input for the download form.
 * 
 * Security checks:
 * - Empty/whitespace validation
 * - Dangerous pattern detection (XSS, injection)
 * - Protocol validation (http/https only)
 * - URL structure validation
 * - Sanitization of input
 * 
 * @param url - The URL string to validate
 * @returns ValidationResult with isValid flag, optional error, and sanitized URL
 */
export function validateUrl(url: string): ValidationResult {
  // Check for empty or whitespace-only strings
  if (!url || url.trim().length === 0) {
    return {
      isValid: false,
      error: 'Please enter a URL',
    };
  }

  // Sanitize the URL
  const sanitizedUrl = sanitizeUrl(url);

  // Check for dangerous patterns
  if (containsDangerousPatterns(sanitizedUrl)) {
    return {
      isValid: false,
      error: 'URL contains invalid characters',
    };
  }

  // Check URL length (prevent DoS with extremely long URLs)
  if (sanitizedUrl.length > 2048) {
    return {
      isValid: false,
      error: 'URL is too long',
    };
  }

  // Add protocol if missing (assume https)
  let urlWithProtocol = sanitizedUrl;
  if (!sanitizedUrl.match(/^https?:\/\//i)) {
    urlWithProtocol = 'https://' + sanitizedUrl;
  }

  // Validate protocol
  if (!hasValidProtocol(urlWithProtocol)) {
    return {
      isValid: false,
      error: 'Only HTTP and HTTPS URLs are supported',
    };
  }

  // Validate URL structure
  if (!isValidUrlStructure(urlWithProtocol)) {
    return {
      isValid: false,
      error: 'Invalid URL format',
    };
  }

  // URL is valid - return with sanitized version
  return {
    isValid: true,
    sanitizedUrl: urlWithProtocol,
  };
}

/**
 * Validates multiple URLs (for batch operations)
 */
export function validateUrls(urls: string[]): { valid: string[]; invalid: { url: string; error: string }[] } {
  const valid: string[] = [];
  const invalid: { url: string; error: string }[] = [];

  for (const url of urls) {
    const result = validateUrl(url);
    if (result.isValid && result.sanitizedUrl) {
      valid.push(result.sanitizedUrl);
    } else {
      invalid.push({ url, error: result.error || 'Invalid URL' });
    }
  }

  return { valid, invalid };
}
