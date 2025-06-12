// __tests__/component/ConversationList.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
  render(<ConversationList conversations={mockConversations} onConversationClick={jest.fn()} />);
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