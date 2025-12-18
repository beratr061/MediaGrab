/**
 * URL validation utility
 * Requirements: 1.2 - WHEN a user enters an empty URL THEN MediaGrab SHALL display an error message
 * 
 * Note: Actual URL validity is determined by yt-dlp at runtime.
 * This validator only checks for non-empty input.
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates a URL input for the download form.
 * 
 * Per Property 1 (URL Validation Correctness):
 * - Empty strings are invalid
 * - Non-empty URLs are accepted for yt-dlp processing
 * 
 * @param url - The URL string to validate
 * @returns ValidationResult with isValid flag and optional error message
 */
export function validateUrl(url: string): ValidationResult {
  // Check for empty or whitespace-only strings
  if (!url || url.trim().length === 0) {
    return {
      isValid: false,
      error: 'Please enter a URL',
    };
  }

  // Non-empty URLs are accepted - yt-dlp will validate the actual URL
  return {
    isValid: true,
  };
}
