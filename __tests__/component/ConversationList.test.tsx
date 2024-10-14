// __tests__/component/ConversationList.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ConversationList from '../../chat-components/ConversationList';
import '@testing-library/jest-dom';

const mockConversations = [
  { id: '1', content: 'Conversation One', author: 'User1' },
  { id: '2', content: 'Conversation Two', author: 'User2' },
];

test('renders conversation list correctly', () => {
  render(<ConversationList conversations={mockConversations} onConversationClick={jest.fn()} />);
  expect(screen.getByText('Conversation One')).toBeInTheDocument();
  expect(screen.getByText('Conversation Two')).toBeInTheDocument();
});

test('handles conversation click', () => {
  const mockClick = jest.fn();
  render(<ConversationList conversations={mockConversations} onConversationClick={mockClick} />);
  fireEvent.click(screen.getByText('Conversation One'));
  expect(mockClick).toHaveBeenCalledWith('1');
});