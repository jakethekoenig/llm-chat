import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConversationList from '../../chat-components/ConversationList';
import { Message as MessageType } from '../../chat-components/types/Message';

describe('ConversationList', () => {
  const mockConversations: MessageType[] = [
    { id: '1', content: 'Test Conversation 1', author: 'User 1', timestamp: new Date().toISOString(), parentId: null },
    { id: '2', content: 'Test Conversation 2', author: 'User 2', timestamp: new Date().toISOString(), parentId: null }
  ];

  test('renders conversation list with correct content', () => {
    const onConversationClick = jest.fn();
    render(<ConversationList conversations={mockConversations} onConversationClick={onConversationClick} />);

    expect(screen.getByText('Conversations')).toBeInTheDocument();
    expect(screen.getByText(/Test Conversation 1 - User 1/)).toBeInTheDocument();
    expect(screen.getByText(/Test Conversation 2 - User 2/)).toBeInTheDocument();
  });

  test('calls onConversationClick when conversation is clicked', () => {
    const onConversationClick = jest.fn();
    render(<ConversationList conversations={mockConversations} onConversationClick={onConversationClick} />);

    fireEvent.click(screen.getByText(/Test Conversation 1 - User 1/));
    expect(onConversationClick).toHaveBeenCalledWith('1');

    fireEvent.click(screen.getByText(/Test Conversation 2 - User 2/));
    expect(onConversationClick).toHaveBeenCalledWith('2');
  });

  test('renders empty list when no conversations provided', () => {
    const onConversationClick = jest.fn();
    render(<ConversationList conversations={[]} onConversationClick={onConversationClick} />);

    expect(screen.getByText('Conversations')).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  test('renders conversations with null parentId', () => {
    const conversationsWithNull = [
      { id: '1', content: 'Test 1', author: 'User 1', timestamp: new Date().toISOString(), parentId: null },
      { id: '2', content: 'Test 2', author: 'User 2', timestamp: new Date().toISOString(), parentId: undefined }
    ];
    const onConversationClick = jest.fn();
    render(<ConversationList conversations={conversationsWithNull} onConversationClick={onConversationClick} />);

    expect(screen.getByText(/Test 1 - User 1/)).toBeInTheDocument();
    expect(screen.getByText(/Test 2 - User 2/)).toBeInTheDocument();
  });

  test('handles click on conversation with undefined parentId', () => {
    const conversationsWithUndefined = [
      { id: '1', content: 'Test 1', author: 'User 1', timestamp: new Date().toISOString(), parentId: undefined }
    ];
    const onConversationClick = jest.fn();
    render(<ConversationList conversations={conversationsWithUndefined} onConversationClick={onConversationClick} />);

    fireEvent.click(screen.getByText(/Test 1 - User 1/));
    expect(onConversationClick).toHaveBeenCalledWith('1');
  });
});