import { useState, useEffect, useCallback, useRef } from 'react';

interface CacheEntry {
  url: string;
  blob: string; // base64 data URL
  timestamp: number;
}

const CACHE_KEY = 'mediagrab_thumbnail_cache';
const MAX_CACHE_SIZE = 50;
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Hook for caching thumbnails locally to avoid repeated fetches
 */
export function useThumbnailCache() {
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const [isInitialized, setIsInitialized] = useState(false);

  // Load cache from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (stored) {
        const entries: CacheEntry[] = JSON.parse(stored);
        const now = Date.now();
        // Filter out expired entries
        entries
          .filter(e => now - e.timestamp < CACHE_TTL)
          .forEach(e => cacheRef.current.set(e.url, e));
      }
    } catch (err) {
      console.warn('Failed to load thumbnail cache:', err);
    }
    setIsInitialized(true);
  }, []);

  // Save cache to localStorage
  const persistCache = useCallback(() => {
    try {
      const entries = Array.from(cacheRef.current.values());
      localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
    } catch (err) {
      console.warn('Failed to persist thumbnail cache:', err);
    }
  }, []);

  // Get cached thumbnail or fetch and cache it
  const getCachedThumbnail = useCallback(async (url: string): Promise<string | null> => {
    if (!url) return null;

    // Check cache first
    const cached = cacheRef.current.get(url);
    if (cached) {
      return cached.blob;
    }

    // Fetch and cache
    try {
      const response = await fetch(url);
      if (!response.ok) return null;

      const blob = await response.blob();
      const reader = new FileReader();
      
      return new Promise((resolve) => {
        reader.onloadend = () => {
          const base64 = reader.result as string;
          
          // Evict oldest entries if cache is full
          if (cacheRef.current.size >= MAX_CACHE_SIZE) {
            const oldest = Array.from(cacheRef.current.entries())
              .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
            if (oldest) {
              cacheRef.current.delete(oldest[0]);
            }
          }

          // Add to cache
          cacheRef.current.set(url, {
            url,
            blob: base64,
            timestamp: Date.now(),
          });
          
          persistCache();
          resolve(base64);
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }, [persistCache]);

  // Clear entire cache
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
    localStorage.removeItem(CACHE_KEY);
  }, []);

  return {
    getCachedThumbnail,
    clearCache,
    isInitialized,
    cacheSize: cacheRef.current.size,
  };
}
