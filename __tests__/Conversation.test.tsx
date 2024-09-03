// __tests__/Conversation.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Conversation from '../src/components/Conversation';
import ConversationList from '../src/components/ConversationList';

const messages = {
  '1': { id: '1', content: 'Hello, world!', author: 'User', timestamp: new Date().toISOString(), parentId: null, children: {} },
  '2': { id: '2', content: 'Hi there!', author: 'User2', timestamp: new Date().toISOString(), parentId: '1', children: {} },
  '3': { id: '3', content: 'How are you?', author: 'User', timestamp: new Date().toISOString(), parentId: '1', children: {} },
};

test('renders conversation messages', () => {
  render(<Conversation messages={messages} />);
  expect(screen.getByText('Hello, world!')).toBeInTheDocument();
});

test('renders conversation with navigation and selection', async () => {
  const messages = {
    '1': { id: '1', content: 'Hello, world!', author: 'User', timestamp: new Date().toISOString(), parentId: null, children: {} },
    '2': { id: '2', content: 'Hi there!', author: 'User2', timestamp: new Date().toISOString(), parentId: '1', children: {} },
    '3': { id: '3', content: 'How are you?', author: 'User', timestamp: new Date().toISOString(), parentId: '1', children: {} },
  };
  render(<Conversation messages={messages} />);
  expect(screen.getByText('Hello, world!')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Hello, world!'));
  expect(screen.getByText('Hi there!')).toBeInTheDocument();
  expect(screen.getAllByText('<')[0]).toBeInTheDocument();
  expect(screen.getAllByText('>')[0]).toBeInTheDocument();
  await fireEvent.click(screen.getAllByText('>')[0]);
  expect(screen.getByText('How are you?')).toBeInTheDocument();
});

test('selects the first child by default', () => {
  const messages = {
    '1': { id: '1', content: 'Hello, world!', author: 'User', timestamp: new Date().toISOString(), parentId: null, children: {} },
    '2': { id: '2', content: 'Hi there!', author: 'User2', timestamp: new Date().toISOString(), parentId: '1', children: {} },
    '3': { id: '3', content: 'How are you?', author: 'User', timestamp: new Date().toISOString(), parentId: '1', children: {} },
  };
  render(<Conversation messages={messages} />);
  expect(screen.getByText('How are you?')).toBeInTheDocument();
});

test('renders conversation with recursive navigation and selection', () => {
  const messages = {
    '1': { id: '1', content: 'Hello, world!', author: 'User', timestamp: new Date().toISOString(), parentId: null, children: {} },
    '2': { id: '2', content: 'Hi there!', author: 'User2', timestamp: new Date().toISOString(), parentId: '1', children: {} },
    '3': { id: '3', content: 'How are you?', author: 'User', timestamp: new Date().toISOString(), parentId: '1', children: {} },
    '4': { id: '4', content: 'I am good, thanks!', author: 'User2', timestamp: new Date().toISOString(), parentId: '2', children: {} },
    '5': { id: '5', content: 'What about you?', author: 'User2', timestamp: new Date().toISOString(), parentId: '2', children: {} },
    '6': { id: '6', content: 'I am doing well!', author: 'User', timestamp: new Date().toISOString(), parentId: '3', children: {} },
  };
  render(<Conversation messages={messages} />);
  expect(screen.getByText('Hello, world!')).toBeInTheDocument();
  expect(screen.getByText('How are you?')).toBeInTheDocument();
  fireEvent.click(screen.getAllByText('>')[0]);
  expect(screen.getByText('I am good, thanks!')).toBeInTheDocument();
  expect(screen.queryByText('How are you?')).not.toBeInTheDocument();
  expect(screen.getByText('I am doing well!')).toBeInTheDocument();
  fireEvent.click(screen.getAllByText('<')[0]);
  expect(screen.getByText('How are you?')).toBeInTheDocument();
  expect(screen.getByText('How are you?')).toBeInTheDocument();
  expect(screen.getByText('How are you?')).toBeInTheDocument();
  expect(screen.queryByText('Hi there!')).not.toBeInTheDocument();
  expect(screen.getByText('How are you?')).toBeInTheDocument();
  expect(screen.queryByText('I am doing well!')).not.toBeInTheDocument();
});

test('renders conversation list', () => {
  const conversations = [
    { id: '1', content: 'Conversation 1', author: 'User1', timestamp: new Date().toISOString(), parentId: null },
    { id: '2', content: 'Conversation 2', author: 'User2', timestamp: new Date().toISOString(), parentId: null },
  ];
  render(<ConversationList conversations={conversations} />);
  expect(screen.getByText('Conversation 1 - User1')).toBeInTheDocument();
  expect(screen.getByText('Conversation 2 - User2')).toBeInTheDocument();
});