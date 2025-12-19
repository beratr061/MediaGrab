import type { Meta, StoryObj } from '@storybook/react';
import { ToastProvider, useToast } from './Toast';
import { Button } from './ui/button';

const meta: Meta = {
  title: 'Components/Toast',
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <ToastProvider>
        <div style={{ padding: '2rem', minHeight: '400px' }}>
          <Story />
        </div>
      </ToastProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

function ToastDemo() {
  const { success, error, warning, info } = useToast();

  return (
    <div className="flex flex-wrap gap-4">
      <Button onClick={() => success('Success!', 'Your download has completed.')}>
        Show Success
      </Button>
      <Button 
        variant="destructive" 
        onClick={() => error('Error!', 'Failed to download the video.')}
      >
        Show Error
      </Button>
      <Button 
        variant="outline" 
        onClick={() => warning('Warning', 'Your disk space is running low.')}
      >
        Show Warning
      </Button>
      <Button 
        variant="secondary" 
        onClick={() => info('Info', 'A new version is available.')}
      >
        Show Info
      </Button>
    </div>
  );
}

export const AllTypes: Story = {
  render: () => <ToastDemo />,
};

function SuccessToastDemo() {
  const { success } = useToast();
  return (
    <Button onClick={() => success('Download Complete', 'video.mp4 has been saved.')}>
      Trigger Success Toast
    </Button>
  );
}

export const Success: Story = {
  render: () => <SuccessToastDemo />,
};

function ErrorToastDemo() {
  const { error } = useToast();
  return (
    <Button 
      variant="destructive"
      onClick={() => error('Download Failed', 'Network error occurred. Please try again.')}
    >
      Trigger Error Toast
    </Button>
  );
}

export const Error: Story = {
  render: () => <ErrorToastDemo />,
};

function WarningToastDemo() {
  const { warning } = useToast();
  return (
    <Button 
      variant="outline"
      onClick={() => warning('Low Disk Space', 'Only 500MB remaining.')}
    >
      Trigger Warning Toast
    </Button>
  );
}

export const Warning: Story = {
  render: () => <WarningToastDemo />,
};

function InfoToastDemo() {
  const { info } = useToast();
  return (
    <Button 
      variant="secondary"
      onClick={() => info('Update Available', 'Version 2.0 is ready to install.')}
    >
      Trigger Info Toast
    </Button>
  );
}

export const Info: Story = {
  render: () => <InfoToastDemo />,
};

function MultipleToastsDemo() {
  const { success, error, warning, info } = useToast();
  
  const showAll = () => {
    success('First Toast', 'This is the first toast');
    setTimeout(() => error('Second Toast', 'This is the second toast'), 200);
    setTimeout(() => warning('Third Toast', 'This is the third toast'), 400);
    setTimeout(() => info('Fourth Toast', 'This is the fourth toast'), 600);
  };

  return (
    <Button onClick={showAll}>
      Show Multiple Toasts
    </Button>
  );
}

export const MultipleToasts: Story = {
  render: () => <MultipleToastsDemo />,
};
