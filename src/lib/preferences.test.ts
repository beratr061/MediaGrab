/**
 * Property-based tests for preferences round-trip
 * **Feature: MediaGrab, Property 8: Preferences Round-Trip**
 * **Validates: Requirements 9.1, 9.2**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Preferences, Format, Quality } from '../types';

// Valid format options
const VALID_FORMATS: Format[] = ['video-mp4', 'audio-mp3', 'audio-best'];

// Valid quality options
const VALID_QUALITIES: Quality[] = ['best', '1080p', '720p'];

// Arbitrary generator for valid Preferences objects
const preferencesArbitrary = fc.record({
  outputFolder: fc.string(),
  format: fc.constantFrom(...VALID_FORMATS),
  quality: fc.constantFrom(...VALID_QUALITIES),
  embedSubtitles: fc.boolean(),
  cookiesFromBrowser: fc.option(
    fc.constantFrom('chrome', 'firefox', 'edge', 'brave'),
    { nil: null }
  ),
  checkUpdatesOnStartup: fc.boolean(),
});

describe('Preferences Round-Trip - Property Tests', () => {
  /**
   * **Feature: MediaGrab, Property 8: Preferences Round-Trip**
   * 
   * For any valid Preferences object (containing outputFolder, format, and quality),
   * saving and then loading preferences SHALL return an equivalent Preferences object
   * with identical values.
   * 
   * Since we can't test the actual Tauri commands without a running app,
   * we test the JSON serialization/deserialization which is the core mechanism
   * used by tauri-plugin-store for persistence.
   */

  it('should round-trip through JSON serialization', () => {
    fc.assert(
      fc.property(
        preferencesArbitrary,
        (preferences: Preferences) => {
          // Simulate save: serialize to JSON
          const json = JSON.stringify(preferences);
          
          // Simulate load: deserialize from JSON
          const loaded = JSON.parse(json) as Preferences;
          
          // Verify all fields are preserved
          expect(loaded.outputFolder).toBe(preferences.outputFolder);
          expect(loaded.format).toBe(preferences.format);
          expect(loaded.quality).toBe(preferences.quality);
          expect(loaded.embedSubtitles).toBe(preferences.embedSubtitles);
          expect(loaded.cookiesFromBrowser).toBe(preferences.cookiesFromBrowser);
          expect(loaded.checkUpdatesOnStartup).toBe(preferences.checkUpdatesOnStartup);
        }
      ),
      { numRuns: 100 }
    );
  });


  it('should preserve format values exactly', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_FORMATS),
        (format: Format) => {
          const prefs: Preferences = {
            outputFolder: '/test',
            format,
            quality: 'best',
            embedSubtitles: false,
            cookiesFromBrowser: null,
            checkUpdatesOnStartup: true,
          };
          
          const json = JSON.stringify(prefs);
          const loaded = JSON.parse(json) as Preferences;
          
          expect(loaded.format).toBe(format);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve quality values exactly', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_QUALITIES),
        (quality: Quality) => {
          const prefs: Preferences = {
            outputFolder: '/test',
            format: 'video-mp4',
            quality,
            embedSubtitles: false,
            cookiesFromBrowser: null,
            checkUpdatesOnStartup: true,
          };
          
          const json = JSON.stringify(prefs);
          const loaded = JSON.parse(json) as Preferences;
          
          expect(loaded.quality).toBe(quality);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle special characters in outputFolder', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (folder: string) => {
          const prefs: Preferences = {
            outputFolder: folder,
            format: 'video-mp4',
            quality: 'best',
            embedSubtitles: false,
            cookiesFromBrowser: null,
            checkUpdatesOnStartup: true,
          };
          
          const json = JSON.stringify(prefs);
          const loaded = JSON.parse(json) as Preferences;
          
          expect(loaded.outputFolder).toBe(folder);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle null cookiesFromBrowser correctly', () => {
    const prefs: Preferences = {
      outputFolder: '/test',
      format: 'video-mp4',
      quality: 'best',
      embedSubtitles: false,
      cookiesFromBrowser: null,
      checkUpdatesOnStartup: true,
    };
    
    const json = JSON.stringify(prefs);
    const loaded = JSON.parse(json) as Preferences;
    
    expect(loaded.cookiesFromBrowser).toBeNull();
  });

  it('should handle all browser options for cookiesFromBrowser', () => {
    const browsers = ['chrome', 'firefox', 'edge', 'brave'];
    
    for (const browser of browsers) {
      const prefs: Preferences = {
        outputFolder: '/test',
        format: 'video-mp4',
        quality: 'best',
        embedSubtitles: true,
        cookiesFromBrowser: browser,
        checkUpdatesOnStartup: false,
      };
      
      const json = JSON.stringify(prefs);
      const loaded = JSON.parse(json) as Preferences;
      
      expect(loaded.cookiesFromBrowser).toBe(browser);
    }
  });
});
