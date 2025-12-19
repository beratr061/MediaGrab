import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../Toast';

// Test component that uses the toast hook
function TestComponent() {
  const { success, error, warning, info, toasts } = useToast();
  
  return (
    <div>
      <button onClick={() => success('Success!', 'Operation completed')}>
        Show Success
      </button>
      <button onClick={() => error('Error!', 'Something went wrong')}>
        Show Error
      </button>
      <button onClick={() => warning('Warning!', 'Be careful')}>
        Show Warning
      </button>
      <button onClick={() => info('Info', 'Just so you know')}>
        Show Info
      </button>
      <div data-testid="toast-count">{toasts.length}</div>
    </div>
  );
}

describe('Toast', () => {
  it('renders success toast', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    
    fireEvent.click(screen.getByText('Show Success'));
    
    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(screen.getByText('Operation completed')).toBeInTheDocument();
  });

  it('renders error toast', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    
    fireEvent.click(screen.getByText('Show Error'));
    
    expect(screen.getByText('Error!')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders warning toast', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    
    fireEvent.click(screen.getByText('Show Warning'));
    
    expect(screen.getByText('Warning!')).toBeInTheDocument();
    expect(screen.getByText('Be careful')).toBeInTheDocument();
  });

  it('renders info toast', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    
    fireEvent.click(screen.getByText('Show Info'));
    
    expect(screen.getByText('Info')).toBeInTheDocument();
    expect(screen.getByText('Just so you know')).toBeInTheDocument();
  });

  it('can show multiple toasts', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    
    fireEvent.click(screen.getByText('Show Success'));
    fireEvent.click(screen.getByText('Show Error'));
    fireEvent.click(screen.getByText('Show Warning'));
    
    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(screen.getByText('Error!')).toBeInTheDocument();
    expect(screen.getByText('Warning!')).toBeInTheDocument();
    expect(screen.getByTestId('toast-count')).toHaveTextContent('3');
  });

  it('has accessible role', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    
    fireEvent.click(screen.getByText('Show Info'));
    
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('has dismiss button', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    
    fireEvent.click(screen.getByText('Show Success'));
    
    expect(screen.getByLabelText('Dismiss')).toBeInTheDocument();
  });

  it('throws error when useToast is used outside provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useToast must be used within ToastProvider');
    
    consoleError.mockRestore();
  });
});
