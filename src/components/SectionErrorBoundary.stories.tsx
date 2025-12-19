import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { SectionErrorBoundary } from './SectionErrorBoundary';
import { Button } from './ui/button';

const meta: Meta<typeof SectionErrorBoundary> = {
  title: 'Components/SectionErrorBoundary',
  component: SectionErrorBoundary,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['card', 'inline', 'minimal'],
    },
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

// Component that can throw an error on demand
function ErrorThrower({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('This is a simulated error for demonstration purposes');
  }
  return (
    <div className="p-4 bg-muted rounded-lg">
      <p>This content is working normally.</p>
    </div>
  );
}

function InteractiveDemo({ variant }: { variant?: 'card' | 'inline' | 'minimal' }) {
  const [shouldThrow, setShouldThrow] = useState(false);
  const [key, setKey] = useState(0);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button 
          variant="destructive" 
          onClick={() => setShouldThrow(true)}
          disabled={shouldThrow}
        >
          Trigger Error
        </Button>
        <Button 
          variant="outline" 
          onClick={() => {
            setShouldThrow(false);
            setKey(k => k + 1);
          }}
        >
          Reset
        </Button>
      </div>
      <SectionErrorBoundary 
        key={key} 
        variant={variant} 
        sectionName="Demo Section"
      >
        <ErrorThrower shouldThrow={shouldThrow} />
      </SectionErrorBoundary>
    </div>
  );
}

export const CardVariant: Story = {
  render: () => <InteractiveDemo variant="card" />,
};

export const InlineVariant: Story = {
  render: () => <InteractiveDemo variant="inline" />,
};

export const MinimalVariant: Story = {
  render: () => <InteractiveDemo variant="minimal" />,
};

export const WithCustomFallback: Story = {
  render: () => {
    const [shouldThrow, setShouldThrow] = useState(false);
    const [key, setKey] = useState(0);

    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button 
            variant="destructive" 
            onClick={() => setShouldThrow(true)}
            disabled={shouldThrow}
          >
            Trigger Error
          </Button>
          <Button 
            variant="outline" 
            onClick={() => {
              setShouldThrow(false);
              setKey(k => k + 1);
            }}
          >
            Reset
          </Button>
        </div>
        <SectionErrorBoundary 
          key={key}
          fallback={
            <div className="p-6 bg-purple-100 dark:bg-purple-900/20 rounded-lg text-center">
              <p className="text-purple-700 dark:text-purple-300 font-medium">
                🎨 Custom fallback UI
              </p>
              <p className="text-sm text-purple-600 dark:text-purple-400 mt-2">
                You can provide any React node as a fallback
              </p>
            </div>
          }
        >
          <ErrorThrower shouldThrow={shouldThrow} />
        </SectionErrorBoundary>
      </div>
    );
  },
};

export const WorkingState: Story = {
  render: () => (
    <SectionErrorBoundary variant="card" sectionName="Working Section">
      <div className="p-6 bg-green-100 dark:bg-green-900/20 rounded-lg">
        <p className="text-green-700 dark:text-green-300">
          ✅ This section is working correctly
        </p>
      </div>
    </SectionErrorBoundary>
  ),
};
