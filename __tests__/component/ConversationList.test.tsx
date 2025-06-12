// __tests__/component/ConversationList.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConversationList from '../../chat-components/ConversationList';
import '@testing-library/jest-dom';

const mockConversations = [
  { 
    id: '1', 
    title: 'Conversation One', 
    userId: 'user1',
    messages: [
      {
        id: '1',
        content: 'Hello',
        timestamp: new Date().toISOString(),
        conversationId: '1',
        userId: 'user1',
        parentId: null
      }
    ]
  },
  { 
    id: '2', 
    title: 'Conversation Two', 
    userId: 'user2',
    messages: [
      {
        id: '2',
        content: 'Hi there',
        timestamp: new Date().toISOString(),
        conversationId: '2',
        userId: 'user2',
        parentId: null
      },
      {
        id: '3',
        content: 'How are you?',
        timestamp: new Date().toISOString(),
        conversationId: '2',
        userId: 'user2',
        parentId: null
      }
    ]
  },
];

test('renders conversation list correctly', () => {
  const mockClick = jest.fn();
  render(<ConversationList conversations={mockConversations} onConversationClick={mockClick} />);
  expect(screen.getByText('Conversation One')).toBeInTheDocument();
  expect(screen.getByText('Conversation Two')).toBeInTheDocument();
  expect(screen.getByText('1 messages')).toBeInTheDocument();
  expect(screen.getByText('2 messages')).toBeInTheDocument();
});

test('handles conversation click', () => {
  const mockClick = jest.fn();
  render(<ConversationList conversations={mockConversations} onConversationClick={mockClick} />);
  fireEvent.click(screen.getByText('Conversation One'));
  expect(mockClick).toHaveBeenCalledWith('1');
});

test('handles conversation click on li element when no title update callback', () => {
  const mockClick = jest.fn();
  render(<ConversationList conversations={mockConversations} onConversationClick={mockClick} />);
  const liElement = screen.getByText('Conversation One').closest('li');
  fireEvent.click(liElement!);
  expect(mockClick).toHaveBeenCalledWith('1');
});

test('handles title editing when onTitleUpdate is provided', async () => {
  const mockClick = jest.fn();
  const mockTitleUpdate = jest.fn().mockResolvedValue(true);
  render(
    <ConversationList 
      conversations={mockConversations} 
      onConversationClick={mockClick}
      onTitleUpdate={mockTitleUpdate}
    />
  );
  
  // Title should be editable
  const titleElement = screen.getByText('Conversation One');
  expect(titleElement).toHaveClass('editable');
  
  // Click on title should start editing
  fireEvent.click(titleElement);
  
  // Should show input field
  const input = screen.getByDisplayValue('Conversation One');
  expect(input).toBeInTheDocument();
  
  // Change the title
  fireEvent.change(input, { target: { value: 'Updated Title' } });
  
  // Press Enter to save
  fireEvent.keyDown(input, { key: 'Enter' });
  
  expect(mockTitleUpdate).toHaveBeenCalledWith('1', 'Updated Title');
});

test('cancels title editing on Escape key', () => {
  const mockClick = jest.fn();
  const mockTitleUpdate = jest.fn().mockResolvedValue(true);
  render(
    <ConversationList 
      conversations={mockConversations} 
      onConversationClick={mockClick}
      onTitleUpdate={mockTitleUpdate}
    />
  );
  
  // Click on title to start editing
  fireEvent.click(screen.getByText('Conversation One'));
  
  // Should show input field
  const input = screen.getByDisplayValue('Conversation One');
  
  // Press Escape to cancel
  fireEvent.keyDown(input, { key: 'Escape' });
  
  // Should return to normal display
  expect(screen.getByText('Conversation One')).toBeInTheDocument();
  expect(mockTitleUpdate).not.toHaveBeenCalled();
});

test('does not trigger conversation click when editing title', () => {
  const mockClick = jest.fn();
  const mockTitleUpdate = jest.fn().mockResolvedValue(true);
  render(
    <ConversationList 
      conversations={mockConversations} 
      onConversationClick={mockClick}
      onTitleUpdate={mockTitleUpdate}
    />
  );
  
  // Click on title should not trigger conversation click, should start editing instead
  fireEvent.click(screen.getByText('Conversation One'));
  expect(mockClick).not.toHaveBeenCalled();
  
  // Now we should be in edit mode, so let's cancel and test meta click
  fireEvent.keyDown(screen.getByDisplayValue('Conversation One'), { key: 'Escape' });
  
  // Click on meta should trigger conversation click
  fireEvent.click(screen.getByText('1 messages'));
  expect(mockClick).toHaveBeenCalledWith('1');
});

test('saves title on blur', async () => {
  const mockClick = jest.fn();
  const mockTitleUpdate = jest.fn().mockResolvedValue(true);
  render(
    <ConversationList 
      conversations={mockConversations} 
      onConversationClick={mockClick}
      onTitleUpdate={mockTitleUpdate}
    />
  );
  
  // Click on title to start editing
  fireEvent.click(screen.getByText('Conversation One'));
  
  // Change the title
  const input = screen.getByDisplayValue('Conversation One');
  fireEvent.change(input, { target: { value: 'Updated Title' } });
  
  // Blur to save
  fireEvent.blur(input);
  
  await waitFor(() => {
    expect(mockTitleUpdate).toHaveBeenCalledWith('1', 'Updated Title');
  });
});

test('does not save empty title', async () => {
  const mockClick = jest.fn();
  const mockTitleUpdate = jest.fn().mockResolvedValue(true);
  render(
    <ConversationList 
      conversations={mockConversations} 
      onConversationClick={mockClick}
      onTitleUpdate={mockTitleUpdate}
    />
  );
  
  // Click on title to start editing
  fireEvent.click(screen.getByText('Conversation One'));
  
  // Clear the title
  const input = screen.getByDisplayValue('Conversation One');
  fireEvent.change(input, { target: { value: '   ' } }); // whitespace only
  
  // Press Enter to save
  fireEvent.keyDown(input, { key: 'Enter' });
  
  // Should not call update with empty title
  expect(mockTitleUpdate).not.toHaveBeenCalled();
  // Should exit editing mode
  expect(screen.getByText('Conversation One')).toBeInTheDocument();
});

test('handles title update failure', async () => {
  const mockClick = jest.fn();
  const mockTitleUpdate = jest.fn().mockResolvedValue(false);
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  
  render(
    <ConversationList 
      conversations={mockConversations} 
      onConversationClick={mockClick}
      onTitleUpdate={mockTitleUpdate}
    />
  );
  
  // Click on title to start editing
  fireEvent.click(screen.getByText('Conversation One'));
  
  // Change the title
  const input = screen.getByDisplayValue('Conversation One');
  fireEvent.change(input, { target: { value: 'Failed Title' } });
  
  // Press Enter to save
  fireEvent.keyDown(input, { key: 'Enter' });
  
  await waitFor(() => {
    expect(mockTitleUpdate).toHaveBeenCalledWith('1', 'Failed Title');
  });
  
  consoleErrorSpy.mockRestore();
});

test('shows updating indicator during title save', async () => {
  const mockClick = jest.fn();
  let resolveUpdate: (value: boolean) => void;
  const mockTitleUpdate = jest.fn(() => new Promise<boolean>((resolve) => {
    resolveUpdate = resolve;
  }));
  
  render(
    <ConversationList 
      conversations={mockConversations} 
      onConversationClick={mockClick}
      onTitleUpdate={mockTitleUpdate}
    />
  );
  
  // Click on title to start editing
  fireEvent.click(screen.getByText('Conversation One'));
  
  // Change the title
  const input = screen.getByDisplayValue('Conversation One');
  fireEvent.change(input, { target: { value: 'Updating Title' } });
  
  // Press Enter to save
  fireEvent.keyDown(input, { key: 'Enter' });
  
  // Should show updating indicator
  await waitFor(() => {
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });
  
  // Resolve the promise
  resolveUpdate!(true);
  
  // Wait for update to complete
  await waitFor(() => {
    expect(screen.getByText('Conversation One')).toBeInTheDocument();
  });
});

test('prevents multiple saves when already updating', async () => {
  const mockClick = jest.fn();
  let resolveUpdate: (value: boolean) => void;
  const mockTitleUpdate = jest.fn(() => new Promise<boolean>((resolve) => {
    resolveUpdate = resolve;
  }));
  
  render(
    <ConversationList 
      conversations={mockConversations} 
      onConversationClick={mockClick}
      onTitleUpdate={mockTitleUpdate}
    />
  );
  
  // Click on title to start editing
  fireEvent.click(screen.getByText('Conversation One'));
  
  // Change the title
  const input = screen.getByDisplayValue('Conversation One');
  fireEvent.change(input, { target: { value: 'Updating Title' } });
  
  // Press Enter to save
  fireEvent.keyDown(input, { key: 'Enter' });
  
  // Try to save again while updating
  fireEvent.keyDown(input, { key: 'Enter' });
  
  // Should only be called once
  await waitFor(() => {
    expect(mockTitleUpdate).toHaveBeenCalledTimes(1);
  });
  
  // Resolve the promise
  resolveUpdate!(true);
  
  // Wait for completion
  await waitFor(() => {
    expect(screen.getByText('Conversation One')).toBeInTheDocument();
  });
});

test('disables input while updating', async () => {
  const mockClick = jest.fn();
  let resolveUpdate: (value: boolean) => void;
  const mockTitleUpdate = jest.fn(() => new Promise<boolean>((resolve) => {
    resolveUpdate = resolve;
  }));
  
  render(
    <ConversationList 
      conversations={mockConversations} 
      onConversationClick={mockClick}
      onTitleUpdate={mockTitleUpdate}
    />
  );
  
  // Click on title to start editing
  fireEvent.click(screen.getByText('Conversation One'));
  
  // Change the title
  const input = screen.getByDisplayValue('Conversation One');
  fireEvent.change(input, { target: { value: 'Updating Title' } });
  
  // Press Enter to save
  fireEvent.keyDown(input, { key: 'Enter' });
  
  // Input should be disabled
  await waitFor(() => {
    expect(input).toBeDisabled();
  });
  
  // Resolve the promise
  resolveUpdate!(true);
  
  // Wait for completion
  await waitFor(() => {
    expect(screen.getByText('Conversation One')).toBeInTheDocument();
  });
});

test('does not trigger conversation click when onTitleUpdate is provided and clicking li', () => {
  const mockClick = jest.fn();
  const mockTitleUpdate = jest.fn().mockResolvedValue(true);
  render(
    <ConversationList 
      conversations={mockConversations} 
      onConversationClick={mockClick}
      onTitleUpdate={mockTitleUpdate}
    />
  );
  
  // Click on li element should not trigger conversation click when onTitleUpdate is provided
  const liElement = screen.getByText('Conversation One').closest('li');
  fireEvent.click(liElement!);
  expect(mockClick).not.toHaveBeenCalled();
});

test('handles editing existing conversation while another is being edited', async () => {
  const mockClick = jest.fn();
  const mockTitleUpdate = jest.fn().mockResolvedValue(true);
  render(
    <ConversationList 
      conversations={mockConversations} 
      onConversationClick={mockClick}
      onTitleUpdate={mockTitleUpdate}
    />
  );
  
  // Start editing first conversation
  fireEvent.click(screen.getByText('Conversation One'));
  expect(screen.getByDisplayValue('Conversation One')).toBeInTheDocument();
  
  // Try to edit second conversation
  fireEvent.click(screen.getByText('Conversation Two'));
  
  // Should now be editing the second conversation
  await waitFor(() => {
    expect(screen.getByDisplayValue('Conversation Two')).toBeInTheDocument();
  });
  // First conversation should not be in edit mode
  expect(screen.queryByDisplayValue('Conversation One')).not.toBeInTheDocument();
});