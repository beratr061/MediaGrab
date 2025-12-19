/**
 * Tauri API wrapper with browser fallback
 * Uses real Tauri APIs when running in Tauri, mock APIs in browser
 */

import { isTauri, mockInvoke, mockListen, mockEmit } from './tauri-mock';

// Re-export isTauri for convenience
export { isTauri };

// Invoke wrapper
export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    return tauriInvoke<T>(cmd, args);
  }
  return mockInvoke(cmd, args) as Promise<T>;
}

// Listen wrapper
export async function listen<T>(
  event: string,
  handler: (event: { payload: T }) => void
): Promise<() => void> {
  if (isTauri) {
    const { listen: tauriListen } = await import('@tauri-apps/api/event');
    return tauriListen<T>(event, handler);
  }
  return mockListen(event, handler);
}

// Emit wrapper
export async function emit(event: string, payload?: unknown): Promise<void> {
  if (isTauri) {
    const { emit: tauriEmit } = await import('@tauri-apps/api/event');
    return tauriEmit(event, payload);
  }
  return mockEmit(event, payload);
}

// Opener wrapper
export const opener = {
  async open(path: string): Promise<void> {
    if (isTauri) {
      const { open } = await import('@tauri-apps/plugin-opener');
      return open(path);
    }
    // In browser, open in new tab
    window.open(path, '_blank');
  },
  
  async reveal(path: string): Promise<void> {
    if (isTauri) {
      const { reveal } = await import('@tauri-apps/plugin-opener');
      return reveal(path);
    }
    console.log('[Mock] reveal:', path);
    alert(`Would open folder: ${path}`);
  },
};
