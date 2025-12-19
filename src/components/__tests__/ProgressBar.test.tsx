import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test/test-utils';
import { ProgressBar } from '../ProgressBar';
import type { ProgressEvent } from '@/types';

describe('ProgressBar', () => {
  const mockProgress: ProgressEvent = {
    percentage: 50,
    speed: '5.2 MB/s',
    etaSeconds: 120,
    status: 'downloading',
    downloadedBytes: 52428800,
    totalBytes: 104857600,
  };

  it('renders progress percentage', () => {
    render(<ProgressBar progress={mockProgress} />);
    expect(screen.getByText('50.0%')).toBeInTheDocument();
  });

  it('renders speed', () => {
    render(<ProgressBar progress={mockProgress} />);
    expect(screen.getByText('5.2 MB/s')).toBeInTheDocument();
  });

  it('renders ETA in correct format', () => {
    render(<ProgressBar progress={mockProgress} />);
    expect(screen.getByText('ETA: 2:00')).toBeInTheDocument();
  });

  it('renders file size info', () => {
    render(<ProgressBar progress={mockProgress} />);
    expect(screen.getByText(/50\.0 MB/)).toBeInTheDocument();
    expect(screen.getByText(/100\.0 MB/)).toBeInTheDocument();
  });

  it('shows merging state', () => {
    const mergingProgress: ProgressEvent = {
      ...mockProgress,
      status: 'merging',
    };
    render(<ProgressBar progress={mergingProgress} />);
    expect(screen.getByText('Merging...')).toBeInTheDocument();
  });

  it('handles null progress gracefully', () => {
    render(<ProgressBar progress={null} />);
    expect(screen.getByText('0.0%')).toBeInTheDocument();
    expect(screen.getByText('ETA: --:--')).toBeInTheDocument();
  });

  it('formats hours in ETA when needed', () => {
    const longProgress: ProgressEvent = {
      ...mockProgress,
      etaSeconds: 3700, // 1 hour, 1 minute, 40 seconds
    };
    render(<ProgressBar progress={longProgress} />);
    expect(screen.getByText('ETA: 1:01:40')).toBeInTheDocument();
  });

  it('hides speed graph when showSpeedGraph is false', () => {
    render(<ProgressBar progress={mockProgress} showSpeedGraph={false} />);
    // SpeedGraph should not be rendered
    expect(screen.queryByTestId('speed-graph')).not.toBeInTheDocument();
  });
});
