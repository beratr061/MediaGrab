/**
 * Mock Tauri APIs for browser development
 * This allows running `npm run dev` without Tauri
 */

// Check if running in Tauri - check multiple indicators
export const isTauri = typeof window !== 'undefined' && (
  '__TAURI__' in window || 
  '__TAURI_INTERNALS__' in window ||
  window.location.protocol === 'tauri:' ||
  window.location.protocol === 'https:' && window.location.hostname === 'tauri.localhost'
);

// Mock data
const mockPreferences = {
  outputFolder: 'C:\\Downloads',
  format: 'video-mp4',
  quality: 'best',
  embedSubtitles: false,
  cookiesFromBrowser: null,
  checkUpdatesOnStartup: true,
  checkAppUpdatesOnStartup: true,
  proxyEnabled: false,
  proxyUrl: null,
  filenameTemplate: null,
  cookiesFilePath: null,
  bandwidthLimit: null,
  scheduledDownloads: null,
};

const mockQueue: any[] = [];
const mockHistory: any[] = [];
let mockQueueId = 1;

// Mock invoke function
export async function mockInvoke(cmd: string, args?: any): Promise<any> {
  console.log(`[Mock] invoke: ${cmd}`, args);
  
  switch (cmd) {
    case 'load_preferences':
      return mockPreferences;
    
    case 'save_preferences':
      Object.assign(mockPreferences, args?.preferences);
      return null;
    
    case 'queue_get_all':
      return mockQueue;
    
    case 'queue_add':
      const newItem = {
        id: mockQueueId++,
        config: args?.config,
        status: 'pending',
        progress: 0,
        speed: '--',
        etaSeconds: null,
        error: null,
        filePath: null,
        title: args?.config?.url || 'Mock Video',
        thumbnail: null,
      };
      mockQueue.push(newItem);
      return newItem;
    
    case 'queue_remove':
      const removeIdx = mockQueue.findIndex(i => i.id === args?.id);
      if (removeIdx >= 0) mockQueue.splice(removeIdx, 1);
      return null;
    
    case 'queue_cancel':
      const cancelItem = mockQueue.find(i => i.id === args?.id);
      if (cancelItem) cancelItem.status = 'cancelled';
      return null;
    
    case 'queue_clear_completed':
      const toRemove = mockQueue.filter(i => 
        i.status === 'completed' || i.status === 'failed' || i.status === 'cancelled'
      );
      toRemove.forEach(item => {
        const idx = mockQueue.indexOf(item);
        if (idx >= 0) mockQueue.splice(idx, 1);
      });
      return null;
    
    case 'history_get_all':
      return mockHistory;
    
    case 'history_get_stats':
      return {
        totalDownloads: mockHistory.length,
        successfulDownloads: mockHistory.filter(i => i.status === 'completed').length,
        failedDownloads: mockHistory.filter(i => i.status === 'failed').length,
        totalBytesDownloaded: 0,
        totalDurationSeconds: 0,
      };
    
    case 'history_add':
      mockHistory.unshift(args?.item);
      return null;
    
    case 'history_remove':
      const histIdx = mockHistory.findIndex(i => i.id === args?.id);
      if (histIdx >= 0) mockHistory.splice(histIdx, 1);
      return null;
    
    case 'history_clear':
      mockHistory.length = 0;
      return null;
    
    case 'pick_folder':
      return 'C:\\Downloads\\MediaGrab';
    
    case 'check_executables':
      return {
        allAvailable: true,
        ytdlpAvailable: true,
        ffmpegAvailable: true,
        ffprobeAvailable: true,
        error: null,
        ytdlpVersion: '2024.01.01',
        ffmpegVersion: '6.0',
      };
    
    case 'fetch_media_info':
      // Simulate delay
      await new Promise(r => setTimeout(r, 1000));
      return {
        title: 'Mock Video Title - Sample Content',
        thumbnail: 'https://picsum.photos/320/180',
        duration: 325,
        uploader: 'Mock Channel',
        filesizeApprox: 150000000,
      };
    
    case 'start_download':
      // Simulate download progress
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('tauri-mock-progress', {
          detail: { percentage: 25, speed: '2.5 MB/s', etaSeconds: 45, status: 'downloading' }
        }));
      }, 1000);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('tauri-mock-progress', {
          detail: { percentage: 50, speed: '3.1 MB/s', etaSeconds: 30, status: 'downloading' }
        }));
      }, 2000);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('tauri-mock-progress', {
          detail: { percentage: 75, speed: '2.8 MB/s', etaSeconds: 15, status: 'downloading' }
        }));
      }, 3000);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('tauri-mock-progress', {
          detail: { percentage: 100, speed: '--', etaSeconds: 0, status: 'merging' }
        }));
      }, 4000);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('tauri-mock-complete', {
          detail: { success: true, filePath: 'C:\\Downloads\\video.mp4' }
        }));
      }, 5000);
      return null;
    
    case 'cancel_download':
      return null;
    
    default:
      console.warn(`[Mock] Unhandled command: ${cmd}`);
      return null;
  }
}

// Mock listen function
export async function mockListen(event: string, handler: (event: any) => void): Promise<() => void> {
  console.log(`[Mock] listen: ${event}`);
  
  const wrappedHandler = (e: CustomEvent) => {
    handler({ payload: e.detail });
  };
  
  if (event === 'download-progress') {
    window.addEventListener('tauri-mock-progress', wrappedHandler as EventListener);
    return () => window.removeEventListener('tauri-mock-progress', wrappedHandler as EventListener);
  }
  
  if (event === 'download-complete') {
    window.addEventListener('tauri-mock-complete', wrappedHandler as EventListener);
    return () => window.removeEventListener('tauri-mock-complete', wrappedHandler as EventListener);
  }
  
  return () => {};
}

// Mock emit function
export async function mockEmit(event: string, payload?: any): Promise<void> {
  console.log(`[Mock] emit: ${event}`, payload);
}
