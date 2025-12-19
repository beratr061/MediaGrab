import type { Meta, StoryObj } from '@storybook/react';
import { ProgressBar } from './ProgressBar';
import type { ProgressEvent } from '@/types';

const meta: Meta<typeof ProgressBar> = {
  title: 'Components/ProgressBar',
  component: ProgressBar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: '500px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

const baseProgress: ProgressEvent = {
  percentage: 50,
  speed: '5.2 MB/s',
  etaSeconds: 120,
  status: 'downloading',
  downloadedBytes: 52428800,
  totalBytes: 104857600,
};

export const Default: Story = {
  args: {
    progress: baseProgress,
  },
};

export const Starting: Story = {
  args: {
    progress: {
      ...baseProgress,
      percentage: 0,
      downloadedBytes: 0,
      speed: '--',
      etaSeconds: null,
    },
  },
};

export const InProgress: Story = {
  args: {
    progress: {
      ...baseProgress,
      percentage: 45,
      downloadedBytes: 47185920,
    },
  },
};

export const AlmostComplete: Story = {
  args: {
    progress: {
      ...baseProgress,
      percentage: 95,
      downloadedBytes: 99614720,
      etaSeconds: 5,
    },
  },
};

export const Complete: Story = {
  args: {
    progress: {
      ...baseProgress,
      percentage: 100,
      downloadedBytes: 104857600,
      etaSeconds: 0,
      status: 'completed',
    },
  },
};

export const Merging: Story = {
  args: {
    progress: {
      ...baseProgress,
      percentage: 100,
      status: 'merging',
      speed: '--',
      etaSeconds: null,
    },
  },
};

export const LongDuration: Story = {
  args: {
    progress: {
      ...baseProgress,
      percentage: 25,
      etaSeconds: 7200, // 2 hours
      speed: '1.2 MB/s',
    },
  },
};

export const SlowSpeed: Story = {
  args: {
    progress: {
      ...baseProgress,
      percentage: 30,
      speed: '256 KB/s',
      etaSeconds: 3600,
    },
  },
};

export const FastSpeed: Story = {
  args: {
    progress: {
      ...baseProgress,
      percentage: 60,
      speed: '25.8 MB/s',
      etaSeconds: 15,
    },
  },
};

export const NoSpeedGraph: Story = {
  args: {
    progress: baseProgress,
    showSpeedGraph: false,
  },
};

export const NullProgress: Story = {
  args: {
    progress: null,
  },
};
