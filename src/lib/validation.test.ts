/**
 * Property-based tests for URL validation
 * **Feature: MediaGrab, Property 1: URL Validation Correctness**
 * **Validates: Requirements 1.2**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateUrl } from './validation';

describe('URL Validation - Property Tests', () => {
  /**
   * **Feature: MediaGrab, Property 1: URL Validation Correctness**
   * 
   * For any string input, the URL validator SHALL correctly identify 
   * empty strings as invalid. Non-empty URLs SHALL be accepted for 
   * yt-dlp processing (actual URL validity is determined by yt-dlp at runtime).
   */

  it('should reject empty strings', () => {
    // Empty string is always invalid
    const result = validateUrl('');
    expect(result.isValid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should reject whitespace-only strings', () => {
    fc.assert(
      fc.property(
        // Generate strings containing only whitespace characters
        fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1 })
          .map(chars => chars.join('')),
        (whitespaceString) => {
          const result = validateUrl(whitespaceString);
          expect(result.isValid).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should accept any non-empty, non-whitespace-only string', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary strings that contain at least one non-whitespace character
        fc.string().filter(s => s.trim().length > 0),
        (nonEmptyString) => {
          const result = validateUrl(nonEmptyString);
          expect(result.isValid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should accept typical URL-like strings', () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        (url) => {
          const result = validateUrl(url);
          expect(result.isValid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});
