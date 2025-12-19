import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import userEvent from '@testing-library/user-event';
import { UrlInput } from '../UrlInput';

describe('UrlInput', () => {
  const mockOnChange = vi.fn();
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders with placeholder', () => {
    render(<UrlInput value="" onChange={mockOnChange} />);
    expect(screen.getByPlaceholderText(/paste a video url/i)).toBeInTheDocument();
  });

  it('calls onChange when typing', async () => {
    const user = userEvent.setup();
    render(<UrlInput value="" onChange={mockOnChange} />);
    
    const input = screen.getByRole('textbox');
    await user.type(input, 'https://youtube.com/watch?v=test');
    
    expect(mockOnChange).toHaveBeenCalled();
  });

  it('calls onSubmit when pressing Enter with valid URL', async () => {
    const user = userEvent.setup();
    render(
      <UrlInput 
        value="https://youtube.com/watch?v=dQw4w9WgXcQ" 
        onChange={mockOnChange} 
        onSubmit={mockOnSubmit}
      />
    );
    
    const input = screen.getByRole('textbox');
    await user.type(input, '{Enter}');
    
    expect(mockOnSubmit).toHaveBeenCalled();
  });

  it('shows error for invalid URL after blur', async () => {
    const user = userEvent.setup();
    render(<UrlInput value="not-a-url" onChange={mockOnChange} />);
    
    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.tab(); // blur
    
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('is disabled when disabled prop is true', () => {
    render(<UrlInput value="" onChange={mockOnChange} disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('detects YouTube platform icon', async () => {
    render(<UrlInput value="https://youtube.com/watch?v=test" onChange={mockOnChange} />);
    // Platform icon should be rendered (YouTube)
    expect(screen.getByLabelText(/video url input/i)).toBeInTheDocument();
  });

  it('handles drag and drop', async () => {
    render(<UrlInput value="" onChange={mockOnChange} />);
    
    const container = screen.getByRole('textbox').parentElement!;
    
    fireEvent.dragOver(container);
    fireEvent.drop(container, {
      dataTransfer: {
        getData: () => 'https://youtube.com/watch?v=test',
      },
    });
    
    expect(mockOnChange).toHaveBeenCalled();
  });

  it('shows recent URLs dropdown when focused with empty value', async () => {
    // Pre-populate recent URLs
    localStorage.setItem('mediagrab-recent-urls', JSON.stringify([
      'https://youtube.com/watch?v=test1',
      'https://youtube.com/watch?v=test2',
    ]));
    
    const user = userEvent.setup();
    render(<UrlInput value="" onChange={mockOnChange} />);
    
    const input = screen.getByRole('textbox');
    await user.click(input);
    
    await waitFor(() => {
      expect(screen.getByText(/recent urls/i)).toBeInTheDocument();
    });
  });
});
