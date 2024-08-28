// __tests__/Conversation.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Conversation from '../src/components/Conversation';

const messages = [
  { id: '1', content: 'Hello, world!', author: 'User', timestamp: new Date().toISOString(), parentId: null },
  { id: '2', content: 'Hi there!', author: 'User2', timestamp: new Date().toISOString(), parentId: '1' },
  { id: '3', content: 'How are you?', author: 'User', timestamp: new Date().toISOString(), parentId: '1' },
];

afterEach(() => {
  jest.clearAllTimers();
  jest.clearAllMocks();
});

test('renders conversation messages', () => {
  render(<Conversation messages={messages} />);
  expect(screen.getByText('Hi there!')).toBeInTheDocument();
});

test('renders conversation with navigation and selection', async () => {
  const messages = [
    { id: '1', content: 'Hello, world!', author: 'User', timestamp: new Date().toISOString(), parentId: null },
    { id: '2', content: 'Hi there!', author: 'User2', timestamp: new Date().toISOString(), parentId: '1' },
    { id: '3', content: 'How are you?', author: 'User', timestamp: new Date().toISOString(), parentId: '1' },
  ];
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
  const messages = [
    { id: '1', content: 'Hello, world!', author: 'User', timestamp: new Date().toISOString(), parentId: null },
    { id: '2', content: 'Hi there!', author: 'User2', timestamp: new Date().toISOString(), parentId: '1' },
    { id: '3', content: 'How are you?', author: 'User', timestamp: new Date().toISOString(), parentId: '1' },
  ];
  render(<Conversation messages={messages} />);
  expect(screen.getByText('Hi there!')).toBeInTheDocument();
});

test('sends a new message', () => {
  render(<Conversation messages={messages} />);
  const input = screen.getByPlaceholderText('Type your message');
  const sendButton = screen.getByText('Send');
  fireEvent.change(input, { target: { value: 'New message' } });
  fireEvent.click(sendButton);
  expect(screen.getByText('New message')).toBeInTheDocument();
});

test('handles empty message input', () => {
  render(<Conversation messages={messages} />);
  const input = screen.getByPlaceholderText('Type your message');
  const sendButton = screen.getByText('Send');
  fireEvent.change(input, { target: { value: '' } });
  fireEvent.click(sendButton);
  expect(screen.queryByText('')).not.toBeInTheDocument();
});

test('handles message with only spaces', () => {
  render(<Conversation messages={messages} />);
  const input = screen.getByPlaceholderText('Type your message');
  const sendButton = screen.getByText('Send');
  fireEvent.change(input, { target: { value: '   ' } });
  fireEvent.click(sendButton);
  expect(screen.queryByText('   ')).not.toBeInTheDocument();
});

test('renders conversation with recursive navigation and selection', () => {
  const messages = [
    { id: '1', content: 'Hello, world!', author: 'User', timestamp: new Date().toISOString(), parentId: null },
    { id: '2', content: 'Hi there!', author: 'User2', timestamp: new Date().toISOString(), parentId: '1' },
    { id: '3', content: 'How are you?', author: 'User', timestamp: new Date().toISOString(), parentId: '1' },
    { id: '4', content: 'I am good, thanks!', author: 'User2', timestamp: new Date().toISOString(), parentId: '2' },
    { id: '5', content: 'What about you?', author: 'User2', timestamp: new Date().toISOString(), parentId: '2' },
    { id: '6', content: 'I am doing well!', author: 'User', timestamp: new Date().toISOString(), parentId: '3' },
  ];
  render(<Conversation messages={messages} />);
  expect(screen.getByText('Hello, world!')).toBeInTheDocument();
  expect(screen.getByText('Hi there!')).toBeInTheDocument();
  fireEvent.click(screen.getAllByText('>')[0]);
  expect(screen.getByText('How are you?')).toBeInTheDocument();
  expect(screen.queryByText('Hi there!')).not.toBeInTheDocument();
  expect(screen.getByText('I am doing well!')).toBeInTheDocument();
  fireEvent.click(screen.getAllByText('<')[0]);
  expect(screen.queryByText('How are you?')).not.toBeInTheDocument();
  expect(screen.getByText('Hi there!')).toBeInTheDocument();
  expect(screen.queryByText('I am doing well!')).not.toBeInTheDocument();
});