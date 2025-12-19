import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/test-utils';
import { FormatSelector } from '../FormatSelector';

describe('FormatSelector', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with current value', () => {
    render(
      <FormatSelector value="video-mp4" onChange={mockOnChange} />
    );
    expect(screen.getByText(/video \(mp4\)/i)).toBeInTheDocument();
  });

  it('shows all format options when clicked', async () => {
    render(
      <FormatSelector value="video-mp4" onChange={mockOnChange} />
    );
    
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);
    
    // Check for some format options
    expect(screen.getByText(/audio \(mp3\)/i)).toBeInTheDocument();
    expect(screen.getByText(/video \(webm\)/i)).toBeInTheDocument();
  });

  it('calls onChange when selecting a format', async () => {
    render(
      <FormatSelector value="video-mp4" onChange={mockOnChange} />
    );
    
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);
    
    const mp3Option = screen.getByText(/audio \(mp3\)/i);
    fireEvent.click(mp3Option);
    
    expect(mockOnChange).toHaveBeenCalledWith('audio-mp3');
  });

  it('respects disabled prop', () => {
    render(
      <FormatSelector value="video-mp4" onChange={mockOnChange} disabled />
    );
    
    const trigger = screen.getByRole('combobox');
    // When disabled, clicking should not open dropdown
    fireEvent.click(trigger);
    
    // The dropdown should not open when disabled
    expect(screen.queryByText(/audio \(mp3\)/i)).not.toBeInTheDocument();
  });

  it('has accessible label', () => {
    render(
      <FormatSelector value="video-mp4" onChange={mockOnChange} />
    );
    expect(screen.getByLabelText(/select download format/i)).toBeInTheDocument();
  });
});
