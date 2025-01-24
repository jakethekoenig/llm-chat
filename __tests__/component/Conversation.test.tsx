import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Conversation from '../../chat-components/Conversation';
import ConversationList from '../../chat-components/ConversationList';

import { fetchStreamingCompletion, StreamingOptions } from '../../site/utils/api';

const mockFetchStreamingCompletion = jest.fn(async (parentId, model, temperature, options) => {
  // Simulate streaming response
  options.onChunk?.({ chunk: 'Test response chunk', messageId: 1 });
  options.onDone?.({ messageId: 1 });
  return Promise.resolve();
});

jest.mock('../../site/utils/api', () => ({
  fetchStreamingCompletion: (...args: Parameters<typeof mockFetchStreamingCompletion>) => 
    mockFetchStreamingCompletion(...args)
}));

const mockOnMessageComplete = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchStreamingCompletion.mockClear();
  mockOnMessageComplete.mockClear();
});

const messages = [
  { id: '1', content: 'Hello, world!', author: 'User', timestamp: new Date().toISOString(), parentId: null },
  { id: '2', content: 'Hi there!', author: 'User2', timestamp: new Date().toISOString(), parentId: '1' },
  { id: '3', content: 'How are you?', author: 'User', timestamp: new Date().toISOString(), parentId: '1' },
];

test('renders conversation messages', () => {
  render(
    <Conversation 
      messages={messages} 
      author="TestUser" 
      conversationId={1}
      onMessageComplete={mockOnMessageComplete}
    />
  );
  expect(screen.getByText('Hi there!')).toBeInTheDocument();
});
test('renders author messages with correct styles', async () => {
  render(
    <Conversation 
      messages={messages} 
      author="User" 
      conversationId={1}
      onMessageComplete={mockOnMessageComplete}
    />
  );
  const authorMessage = await screen.findAllByTestId('message-container');
  expect(authorMessage[0]).toHaveStyle('text-align: right');
  expect(authorMessage[0]).toHaveStyle('background-color: #e0f7fa');
});
test('renders conversation with navigation and selection', async () => {
  const messages = [
    { id: '1', content: 'Hello, world!', author: 'User', timestamp: new Date().toISOString(), parentId: null },
    { id: '2', content: 'Hi there!', author: 'User2', timestamp: new Date().toISOString(), parentId: '1' },
    { id: '3', content: 'How are you?', author: 'User', timestamp: new Date().toISOString(), parentId: '1' },
  ];
  render(
    <Conversation 
      messages={messages} 
      author="TestUser" 
      conversationId={1}
      onMessageComplete={mockOnMessageComplete}
    />
  );
  expect(screen.getByText('Hello, world!')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Hello, world!'));
  expect(screen.getByText('Hi there!')).toBeInTheDocument();
  expect(screen.getAllByText('<')[0]).toBeInTheDocument();
  expect(screen.getAllByText('>')[0]).toBeInTheDocument();
  expect(screen.getByText('1 / 2')).toBeInTheDocument();
  await fireEvent.click(screen.getAllByText('>')[0]);
  expect(screen.getByText('How are you?')).toBeInTheDocument();
  expect(screen.getByText('2 / 2')).toBeInTheDocument();
  expect(screen.getAllByText('>')[0]).toBeDisabled();
  await fireEvent.click(screen.getAllByText('<')[0]);
  expect(screen.getByText('Hi there!')).toBeInTheDocument();
  expect(screen.getByText('1 / 2')).toBeInTheDocument();
  expect(screen.getAllByText('<')[0]).toBeDisabled();
});

test('selects the first child by default', () => {
  const messages = [
    { id: '1', content: 'Hello, world!', author: 'User', timestamp: new Date().toISOString(), parentId: null },
    { id: '2', content: 'Hi there!', author: 'User2', timestamp: new Date().toISOString(), parentId: '1' },
    { id: '3', content: 'How are you?', author: 'User', timestamp: new Date().toISOString(), parentId: '1' },
  ];
  render(
    <Conversation 
      messages={messages} 
      author="User" 
      conversationId={1}
      onMessageComplete={mockOnMessageComplete}
    />
  );
  expect(screen.getByText('Hi there!')).toBeInTheDocument();
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
  render(
    <Conversation 
      messages={messages} 
      author="User" 
      conversationId={1}
      onMessageComplete={mockOnMessageComplete}
    />
  );
  expect(screen.getByText('Hello, world!')).toBeInTheDocument();
  expect(screen.getByText('Hi there!')).toBeInTheDocument();
  fireEvent.click(screen.getAllByText('>')[0]);
  expect(screen.getByText('How are you?')).toBeInTheDocument();
  expect(screen.queryByText('Hi there!')).not.toBeInTheDocument();
  expect(screen.getByText('I am doing well!')).toBeInTheDocument();
  expect(screen.getByText('2 / 2')).toBeInTheDocument();
  fireEvent.click(screen.getAllByText('<')[0]);
  expect(screen.queryByText('How are you?')).not.toBeInTheDocument();
  expect(screen.getByText('Hi there!')).toBeInTheDocument();
  expect(screen.queryByText('I am doing well!')).not.toBeInTheDocument();
  expect(screen.getAllByText('1 / 2')).toHaveLength(2);
});

test('renders conversation list', () => {
  const conversations = [
    { id: '1', content: 'Conversation 1', author: 'User1', timestamp: new Date().toISOString(), parentId: null },
    { id: '2', content: 'Conversation 2', author: 'User2', timestamp: new Date().toISOString(), parentId: null },
  ];
  render(<ConversationList conversations={conversations} onConversationClick={() => {}} />);
  const conversation1 = screen.getByText('Conversation 1');
  const author1 = screen.getByText('User1');
  const conversation2 = screen.getByText('Conversation 2');
  const author2 = screen.getByText('User2');
  expect(conversation1).toBeInTheDocument();
  expect(author1).toBeInTheDocument();
  expect(conversation2).toBeInTheDocument();
  expect(author2).toBeInTheDocument();
});

test('handles new message input and submission', async () => {
  render(
    <Conversation 
      messages={messages} 
      author="TestUser" 
      conversationId={1}
      onMessageComplete={mockOnMessageComplete}
    />
  );
  
  const input = screen.getByPlaceholderText('Type your message... (Press Enter to send, Shift+Enter for new line)');
  const sendButton = screen.getByText('Send');

  // Simulate user typing a new message
  fireEvent.change(input, { target: { value: 'Test message' } });
  expect(input).toHaveValue('Test message');

  // Simulate clicking the send button
  fireEvent.click(sendButton);
  
  // Wait for streaming to complete
  await waitFor(() => {
    expect(screen.getByText('Test response chunk')).toBeInTheDocument();
    expect(mockOnMessageComplete).toHaveBeenCalledWith(1);
    expect(input).toHaveValue('');
  });
});

test('submits a new message and updates the conversation', async () => {
  render(
    <Conversation 
      messages={messages} 
      author="TestUser" 
      conversationId={1}
      onMessageComplete={mockOnMessageComplete}
    />
  );
  
  const input = screen.getByPlaceholderText('Type your message... (Press Enter to send, Shift+Enter for new line)');
  fireEvent.change(input, {
    target: { value: 'New message' }
  });
  fireEvent.click(screen.getByText('Send'));
  
  // Wait for streaming to complete
  await waitFor(() => {
    expect(screen.getByText('Test response chunk')).toBeInTheDocument();
    expect(mockOnMessageComplete).toHaveBeenCalledWith(1);
    expect(input).toHaveValue('');
  });
});

test('renders author messages with right justification and different background', () => {
  const messages = [
    { id: '1', content: 'Hello, world!', author: 'User', timestamp: new Date().toISOString(), parentId: null },
    { id: '2', content: 'Hi there!', author: 'User2', timestamp: new Date().toISOString(), parentId: '1' },
    { id: '3', content: 'How are you?', author: 'User', timestamp: new Date().toISOString(), parentId: '1' },
  ];
  render(
    <Conversation 
      messages={messages} 
      author="User" 
      conversationId={1}
      onMessageComplete={mockOnMessageComplete}
    />
  );
  const authorMessages = screen.getAllByText('User');
  authorMessages.forEach(message => {
    expect(message.parentElement).toHaveStyle('text-align: right');
    expect(message.parentElement).toHaveStyle('background-color: #e0f7fa');
  });
});

test('passes isAuthor prop correctly to Message components', () => {
  const messages = [
    { id: '1', content: 'Hello from User', author: 'User', timestamp: new Date().toISOString(), parentId: null },
    { id: '2', content: 'Hello from User2', author: 'User2', timestamp: new Date().toISOString(), parentId: '1' },
  ];
  render(
    <Conversation 
      messages={messages} 
      author="User" 
      conversationId={1}
      onMessageComplete={mockOnMessageComplete}
    />
  );
  const userMessage = screen.getByText('Hello from User').parentElement?.parentElement;
  const user2Message = screen.getByText('Hello from User2').parentElement?.parentElement;
  expect(userMessage).toHaveStyle('text-align: right');
  expect(userMessage).toHaveStyle('background-color: #e0f7fa');
  expect(user2Message).toHaveStyle('text-align: left');
  expect(user2Message).toHaveStyle('background-color: #fff');
});

test('renders NewMessage component within Conversation', async () => {
  render(
    <Conversation 
      messages={messages} 
      author="User" 
      conversationId={1}
      onMessageComplete={mockOnMessageComplete}
    />
  );
  const newMessageInput = screen.getByPlaceholderText('Type your message... (Press Enter to send, Shift+Enter for new line)');
  const sendButton = screen.getByText('Send');

  expect(newMessageInput).toBeInTheDocument();
  expect(sendButton).toBeInTheDocument();

  // Test Enter key submission
  fireEvent.change(newMessageInput, { target: { value: 'Test message' } });
  fireEvent.keyDown(newMessageInput, { key: 'Enter', code: 'Enter' });

  // Wait for streaming to complete
  await waitFor(() => {
    expect(screen.getByText('Test response chunk')).toBeInTheDocument();
    expect(mockOnMessageComplete).toHaveBeenCalledWith(1);
    expect(newMessageInput).toHaveValue('');
  });

  // Test that Shift+Enter doesn't submit
  fireEvent.change(newMessageInput, { target: { value: 'Test message 2' } });
  fireEvent.keyDown(newMessageInput, { key: 'Enter', code: 'Enter', shiftKey: true });

  expect(newMessageInput).toHaveValue('Test message 2');
  expect(mockOnMessageComplete).toHaveBeenCalledTimes(1); // Should not have been called again
});
