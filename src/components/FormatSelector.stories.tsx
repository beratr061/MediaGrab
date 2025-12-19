import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { FormatSelector } from './FormatSelector';
import type { Format } from '@/types';

const meta: Meta<typeof FormatSelector> = {
  title: 'Components/FormatSelector',
  component: FormatSelector,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    value: {
      control: 'select',
      options: [
        'video-mp4',
        'video-webm',
        'video-mkv',
        'audio-mp3',
        'audio-aac',
        'audio-opus',
        'audio-flac',
        'audio-wav',
        'audio-best',
      ],
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '300px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

function FormatSelectorWrapper(props: Partial<React.ComponentProps<typeof FormatSelector>>) {
  const [value, setValue] = useState<Format>(props.value || 'video-mp4');
  return <FormatSelector {...props} value={value} onChange={setValue} />;
}

export const Default: Story = {
  render: (args) => <FormatSelectorWrapper {...args} />,
  args: {
    value: 'video-mp4',
  },
};

export const VideoMP4: Story = {
  render: (args) => <FormatSelectorWrapper {...args} />,
  args: {
    value: 'video-mp4',
  },
};

export const VideoWebM: Story = {
  render: (args) => <FormatSelectorWrapper {...args} />,
  args: {
    value: 'video-webm',
  },
};

export const AudioMP3: Story = {
  render: (args) => <FormatSelectorWrapper {...args} />,
  args: {
    value: 'audio-mp3',
  },
};

export const AudioFLAC: Story = {
  render: (args) => <FormatSelectorWrapper {...args} />,
  args: {
    value: 'audio-flac',
  },
};

export const Disabled: Story = {
  render: (args) => <FormatSelectorWrapper {...args} />,
  args: {
    value: 'video-mp4',
    disabled: true,
  },
};
