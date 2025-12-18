/**
 * Property-based tests for filename sanitization
 * **Feature: MediaGrab, Property 7: Filename Sanitization**
 * **Validates: Requirements 6.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { sanitizeFilename } from './sanitize';

// Characters invalid for Windows filenames
const INVALID_CHARS = ['\\', '/', ':', '*', '?', '"', '<', '>', '|'];

describe('Filename Sanitization - Property Tests', () => {
  /**
   * **Feature: MediaGrab, Property 7: Filename Sanitization**
   * 
   * For any string containing characters invalid for Windows filenames 
   * (\ / : * ? " < > |), the sanitizer SHALL produce a valid Windows filename 
   * by replacing or removing invalid characters. The output SHALL never be empty 
   * and SHALL preserve as much of the original meaning as possible.
   */

  it('should never produce an empty string', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (input) => {
          const result = sanitizeFilename(input);
          expect(result.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should remove all invalid Windows filename characters', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (input) => {
          const result = sanitizeFilename(input);
          // Check that none of the invalid characters remain
          for (const char of INVALID_CHARS) {
            expect(result).not.toContain(char);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle strings containing only invalid characters', () => {
    fc.assert(
      fc.property(
        // Generate strings containing only invalid characters
        fc.array(fc.constantFrom(...INVALID_CHARS), { minLength: 1 })
          .map(chars => chars.join('')),
        (invalidOnlyString) => {
          const result = sanitizeFilename(invalidOnlyString);
          // Should still produce a valid non-empty result
          expect(result.length).toBeGreaterThan(0);
          // Should not contain any invalid characters
          for (const char of INVALID_CHARS) {
            expect(result).not.toContain(char);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve valid characters', () => {
    fc.assert(
      fc.property(
        // Generate strings with only valid filename characters
        fc.string().filter(s => {
          // Filter to strings that don't contain invalid chars and aren't empty
          const trimmed = s.trim().replace(/\.+$/, '');
          return s.length > 0 && 
                 trimmed.length > 0 &&
                 !INVALID_CHARS.some(c => s.includes(c)) &&
                 // Exclude reserved Windows names
                 !['CON', 'PRN', 'AUX', 'NUL'].includes(trimmed.toUpperCase()) &&
                 !trimmed.toUpperCase().match(/^(COM|LPT)[1-9]$/);
        }),
        (validString) => {
          const result = sanitizeFilename(validString);
          // Valid strings should be preserved (trimmed and trailing dots removed)
          const expected = validString.trim().replace(/\.+$/, '');
          expect(result).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle mixed valid and invalid characters', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
          fc.constantFrom(...INVALID_CHARS),
          fc.string({ minLength: 1 }).filter(s => s.trim().length > 0)
        ),
        ([prefix, invalidChar, suffix]) => {
          const input = prefix + invalidChar + suffix;
          const result = sanitizeFilename(input);
          
          // Result should not contain the invalid character
          expect(result).not.toContain(invalidChar);
          // Result should not be empty
          expect(result.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
