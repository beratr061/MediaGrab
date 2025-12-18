/**
 * Filename sanitization utility for Windows compatibility
 * Requirements: 6.4 - WHEN generating output filenames THEN MediaGrab SHALL sanitize 
 * special characters to ensure Windows filesystem compatibility
 */

// Characters invalid for Windows filenames: \ / : * ? " < > |
const INVALID_CHARS_REGEX = /[\\/:*?"<>|]/g;

// Reserved Windows filenames (case-insensitive)
const RESERVED_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

/**
 * Sanitizes a filename for Windows filesystem compatibility.
 * 
 * Per Property 7 (Filename Sanitization):
 * - Replaces invalid characters (\ / : * ? " < > |) with underscores
 * - Output is never empty
 * - Preserves as much of the original meaning as possible
 * 
 * @param filename - The filename to sanitize
 * @returns A valid Windows filename
 */
export function sanitizeFilename(filename: string): string {
  // Handle empty or whitespace-only input
  if (!filename || filename.trim().length === 0) {
    return 'untitled';
  }

  // Replace invalid characters with underscores
  let sanitized = filename.replace(INVALID_CHARS_REGEX, '_');

  // Trim leading/trailing whitespace and dots (Windows doesn't allow trailing dots)
  sanitized = sanitized.trim().replace(/\.+$/, '');

  // Handle reserved Windows filenames
  const parts = sanitized.split('.');
  const baseName = (parts[0] ?? '').toUpperCase();
  if (RESERVED_NAMES.has(baseName)) {
    sanitized = '_' + sanitized;
  }

  // Ensure result is not empty after sanitization
  if (sanitized.length === 0) {
    return 'untitled';
  }

  return sanitized;
}
