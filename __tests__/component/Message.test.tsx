import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Message from '../../chat-components/Message';
import { MessageConfigProvider, defaultConfig, MessageConfig } from '../../chat-components/MessageConfigContext';

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockImplementation(() => Promise.resolve()),
  },
});

const defaultProps = {
  id: '1',
  content: 'Test message content',
  conversationId: '1',
  userId: '1',
  timestamp: '2023-01-01T00:00:00Z',
  parentId: null,
};

const renderMessage = (props = {}, config: MessageConfig = defaultConfig) => {
  return render(
    <MessageConfigProvider config={config}>
      <Message {...defaultProps} {...props} />
    </MessageConfigProvider>
  );
};

describe('Message Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders basic message content', () => {
    renderMessage();
    expect(screen.getByText('Test message content')).toBeInTheDocument();
  });

  test('renders with author', () => {
    renderMessage({ author: 'John Doe' });
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  test('renders timestamp correctly', () => {
    renderMessage();
    expect(screen.getByText('1/1/2023, 12:00:00 AM')).toBeInTheDocument();
  });

  test('applies author styling when $isAuthor is true', () => {
    renderMessage({ $isAuthor: true });
    const container = screen.getByTestId('message-container');
    expect(container).toHaveStyle('text-align: right');
    expect(container).toHaveStyle('background-color: #e0f7fa');
  });

  test('applies non-author styling when $isAuthor is false', () => {
    renderMessage({ $isAuthor: false });
    const container = screen.getByTestId('message-container');
    expect(container).toHaveStyle('text-align: left');
    expect(container).toHaveStyle('background-color: #FFFFFF');
  });

  test('renders copy button and handles copy action', async () => {
    const onCopy = jest.fn();
    renderMessage({ onCopy });
    
    const copyButton = screen.getByText('Copy');
    expect(copyButton).toBeInTheDocument();
    
    fireEvent.click(copyButton);
    
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Test message content');
      expect(onCopy).toHaveBeenCalled();
    });
  });

  test('handles copy error gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(new Error('Copy failed'));
    
    renderMessage();
    
    const copyButton = screen.getByText('Copy');
    fireEvent.click(copyButton);
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to copy text: ', expect.any(Error));
    });
    
    consoleSpy.mockRestore();
  });

  test('renders and handles share button', () => {
    const onShare = jest.fn();
    renderMessage({ onShare });
    
    const shareButton = screen.getByText('Share');
    expect(shareButton).toBeInTheDocument();
    
    fireEvent.click(shareButton);
    expect(onShare).toHaveBeenCalled();
  });

  test('renders and handles delete button', () => {
    const onDelete = jest.fn();
    const config: MessageConfig = {
      ...defaultConfig,
      buttons: { ...defaultConfig.buttons, delete: 'enabled' },
    };
    renderMessage({ onDelete }, config);
    
    const deleteButton = screen.getByText('Delete');
    expect(deleteButton).toBeInTheDocument();
    
    fireEvent.click(deleteButton);
    expect(onDelete).toHaveBeenCalled();
  });

  test('renders and handles edit button', () => {
    const onEdit = jest.fn();
    renderMessage({ onEdit });
    
    const editButton = screen.getByText('Edit');
    expect(editButton).toBeInTheDocument();
    
    fireEvent.click(editButton);
    expect(onEdit).toHaveBeenCalled();
  });

  test('handles click action', () => {
    const onClick = jest.fn();
    renderMessage({ onClick });
    
    const container = screen.getByTestId('message-container');
    fireEvent.click(container);
    expect(onClick).toHaveBeenCalled();
  });

  test('renders navigation buttons when hasSiblings is true', () => {
    const onPrev = jest.fn();
    const onNext = jest.fn();
    renderMessage({ 
      hasSiblings: true, 
      currentIndex: 1, 
      totalSiblings: 3,
      onPrev,
      onNext 
    });
    
    expect(screen.getByText('<')).toBeInTheDocument();
    expect(screen.getByText('>')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  test('handles navigation button clicks', () => {
    const onPrev = jest.fn();
    const onNext = jest.fn();
    renderMessage({ 
      hasSiblings: true, 
      currentIndex: 1, 
      totalSiblings: 3,
      onPrev,
      onNext 
    });
    
    fireEvent.click(screen.getByText('<'));
    expect(onPrev).toHaveBeenCalled();
    
    fireEvent.click(screen.getByText('>'));
    expect(onNext).toHaveBeenCalled();
  });

  test('disables prev button at first index', () => {
    renderMessage({ 
      hasSiblings: true, 
      currentIndex: 0, 
      totalSiblings: 3,
      onPrev: jest.fn(),
      onNext: jest.fn() 
    });
    
    const prevButton = screen.getByText('<');
    expect(prevButton).toBeDisabled();
  });

  test('disables next button at last index', () => {
    renderMessage({ 
      hasSiblings: true, 
      currentIndex: 2, 
      totalSiblings: 3,
      onPrev: jest.fn(),
      onNext: jest.fn() 
    });
    
    const nextButton = screen.getByText('>');
    expect(nextButton).toBeDisabled();
  });

  test('hides navigation when hasSiblings is false', () => {
    renderMessage({ hasSiblings: false });
    
    expect(screen.queryByText('<')).not.toBeInTheDocument();
    expect(screen.queryByText('>')).not.toBeInTheDocument();
  });

  test('renders menu when buttons are set to menu-ed', () => {
    const config: MessageConfig = {
      ...defaultConfig,
      buttons: { copy: 'menu-ed', share: 'menu-ed', delete: 'disabled', edit: 'disabled' },
    };
    
    renderMessage({}, config);
    
    expect(screen.getByText('Menu')).toBeInTheDocument();
    expect(screen.queryByText('Copy')).not.toBeInTheDocument();
    expect(screen.queryByText('Share')).not.toBeInTheDocument();
  });

  test('opens and closes menu', () => {
    const config: MessageConfig = {
      ...defaultConfig,
      buttons: { copy: 'menu-ed', share: 'disabled', delete: 'disabled', edit: 'disabled' },
    };
    
    renderMessage({}, config);
    
    const menuButton = screen.getByText('Menu');
    fireEvent.click(menuButton);
    
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem')).toBeInTheDocument();
  });

  test('handles menu item clicks', async () => {
    const config: MessageConfig = {
      ...defaultConfig,
      buttons: { copy: 'menu-ed', share: 'menu-ed', delete: 'disabled', edit: 'disabled' },
    };
    
    const onShare = jest.fn();
    renderMessage({ onShare }, config);
    
    const menuButton = screen.getByText('Menu');
    fireEvent.click(menuButton);
    
    const shareMenuItem = screen.getByText('Share');
    fireEvent.click(shareMenuItem);
    
    expect(onShare).toHaveBeenCalled();
  });

  test('hides buttons when set to disabled', () => {
    const config: MessageConfig = {
      ...defaultConfig,
      buttons: { copy: 'disabled', share: 'disabled', delete: 'disabled', edit: 'disabled' },
    };
    
    renderMessage({}, config);
    
    expect(screen.queryByText('Copy')).not.toBeInTheDocument();
    expect(screen.queryByText('Share')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.queryByText('Menu')).not.toBeInTheDocument();
  });

  test('applies dark theme styling', () => {
    const darkConfig: MessageConfig = {
      theme: { primaryColor: '#000', secondaryColor: '#fff', mode: 'dark' },
      buttons: defaultConfig.buttons,
    };
    
    renderMessage({ $isAuthor: false }, darkConfig);
    
    const container = screen.getByTestId('message-container');
    expect(container).toHaveStyle('background-color: #333333');
    expect(container).toHaveStyle('color: #FFFFFF');
  });

  test('updates content when prop changes', async () => {
    const { rerender } = renderMessage({ content: 'Original content' });
    
    expect(screen.getByText('Original content')).toBeInTheDocument();
    
    rerender(
      <MessageConfigProvider config={defaultConfig}>
        <Message {...defaultProps} content="Updated content" />
      </MessageConfigProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Updated content')).toBeInTheDocument();
    });
  });

  test('renders without timestamp when not provided', () => {
    renderMessage({ timestamp: undefined });
    expect(screen.queryByText(/\d+\/\d+\/\d+/)).not.toBeInTheDocument();
  });

  test('renders without author when not provided', () => {
    renderMessage({ author: undefined });
    expect(screen.getByText('Test message content')).toBeInTheDocument();
    // Should not have any author name displayed
    const container = screen.getByTestId('message-container');
    // Check that there's no separate author element by looking for the <br> that precedes author
    expect(container.innerHTML).not.toContain('<br>');
  });
});
