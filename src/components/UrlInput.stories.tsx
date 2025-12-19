import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { UrlInput } from './UrlInput';

const meta: Meta<typeof UrlInput> = {
  title: 'Components/UrlInput',
  component: UrlInput,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
  },
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

// Wrapper component to handle state
function UrlInputWrapper(props: Partial<React.ComponentProps<typeof UrlInput>>) {
  const [value, setValue] = useState(props.value || '');
  return <UrlInput {...props} value={value} onChange={setValue} />;
}

export const Default: Story = {
  render: (args) => <UrlInputWrapper {...args} />,
  args: {},
};

export const WithValue: Story = {
  render: (args) => <UrlInputWrapper {...args} />,
  args: {
    value: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
  },
};

export const Disabled: Story = {
  render: (args) => <UrlInputWrapper {...args} />,
  args: {
    disabled: true,
    value: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
  },
};

export const WithInvalidUrl: Story = {
  render: (args) => <UrlInputWrapper {...args} />,
  args: {
    value: 'not-a-valid-url',
  },
};

export const YouTubeUrl: Story = {
  render: (args) => <UrlInputWrapper {...args} />,
  args: {
    value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  },
};

export const VimeoUrl: Story = {
  render: (args) => <UrlInputWrapper {...args} />,
  args: {
    value: 'https://vimeo.com/123456789',
  },
};

export const TwitchUrl: Story = {
  render: (args) => <UrlInputWrapper {...args} />,
  args: {
    value: 'https://www.twitch.tv/videos/123456789',
  },
};
