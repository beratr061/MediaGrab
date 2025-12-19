import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useUIStore } from '../uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    // Reset store state
    useUIStore.setState({
      isSettingsOpen: false,
      isQueueOpen: false,
      isHistoryOpen: false,
      isPlaylistOpen: false,
      isBatchImportOpen: false,
      isScheduleOpen: false,
      isGlobalDragOver: false,
    });
  });

  it('has correct initial state', () => {
    const state = useUIStore.getState();
    expect(state.isSettingsOpen).toBe(false);
    expect(state.isQueueOpen).toBe(false);
    expect(state.isHistoryOpen).toBe(false);
    expect(state.isPlaylistOpen).toBe(false);
    expect(state.isBatchImportOpen).toBe(false);
    expect(state.isScheduleOpen).toBe(false);
    expect(state.isGlobalDragOver).toBe(false);
  });

  describe('Settings panel', () => {
    it('opens settings', () => {
      act(() => {
        useUIStore.getState().openSettings();
      });
      expect(useUIStore.getState().isSettingsOpen).toBe(true);
    });

    it('closes settings', () => {
      useUIStore.setState({ isSettingsOpen: true });
      act(() => {
        useUIStore.getState().closeSettings();
      });
      expect(useUIStore.getState().isSettingsOpen).toBe(false);
    });

    it('toggles settings', () => {
      expect(useUIStore.getState().isSettingsOpen).toBe(false);
      
      act(() => {
        useUIStore.getState().toggleSettings();
      });
      expect(useUIStore.getState().isSettingsOpen).toBe(true);
      
      act(() => {
        useUIStore.getState().toggleSettings();
      });
      expect(useUIStore.getState().isSettingsOpen).toBe(false);
    });
  });

  describe('Queue panel', () => {
    it('opens queue', () => {
      act(() => {
        useUIStore.getState().openQueue();
      });
      expect(useUIStore.getState().isQueueOpen).toBe(true);
    });

    it('closes queue', () => {
      useUIStore.setState({ isQueueOpen: true });
      act(() => {
        useUIStore.getState().closeQueue();
      });
      expect(useUIStore.getState().isQueueOpen).toBe(false);
    });
  });

  describe('History panel', () => {
    it('opens history', () => {
      act(() => {
        useUIStore.getState().openHistory();
      });
      expect(useUIStore.getState().isHistoryOpen).toBe(true);
    });

    it('closes history', () => {
      useUIStore.setState({ isHistoryOpen: true });
      act(() => {
        useUIStore.getState().closeHistory();
      });
      expect(useUIStore.getState().isHistoryOpen).toBe(false);
    });
  });

  describe('Batch import modal', () => {
    it('opens batch import', () => {
      act(() => {
        useUIStore.getState().openBatchImport();
      });
      expect(useUIStore.getState().isBatchImportOpen).toBe(true);
    });

    it('closes batch import', () => {
      useUIStore.setState({ isBatchImportOpen: true });
      act(() => {
        useUIStore.getState().closeBatchImport();
      });
      expect(useUIStore.getState().isBatchImportOpen).toBe(false);
    });
  });

  describe('Global drag over', () => {
    it('sets global drag over state', () => {
      act(() => {
        useUIStore.getState().setGlobalDragOver(true);
      });
      expect(useUIStore.getState().isGlobalDragOver).toBe(true);
      
      act(() => {
        useUIStore.getState().setGlobalDragOver(false);
      });
      expect(useUIStore.getState().isGlobalDragOver).toBe(false);
    });
  });

  describe('Close all panels', () => {
    it('closes all panels at once', () => {
      useUIStore.setState({
        isSettingsOpen: true,
        isQueueOpen: true,
        isHistoryOpen: true,
        isPlaylistOpen: true,
        isBatchImportOpen: true,
        isScheduleOpen: true,
      });

      act(() => {
        useUIStore.getState().closeAllPanels();
      });

      const state = useUIStore.getState();
      expect(state.isSettingsOpen).toBe(false);
      expect(state.isQueueOpen).toBe(false);
      expect(state.isHistoryOpen).toBe(false);
      expect(state.isPlaylistOpen).toBe(false);
      expect(state.isBatchImportOpen).toBe(false);
      expect(state.isScheduleOpen).toBe(false);
    });
  });
});
