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

  it('should accept valid URL-like strings', () => {
    fc.assert(
      fc.property(
        // Generate strings that look like valid URLs
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

  it('should reject invalid URL structures', () => {
    // Single characters or strings without valid URL structure should be rejected
    const invalidInputs = [':', '!', 'abc', 'test', 'no-dots'];
    for (const input of invalidInputs) {
      const result = validateUrl(input);
      expect(result.isValid).toBe(false);
    }
  });
});
