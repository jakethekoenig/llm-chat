import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Conversation from '../../chat-components/Conversation';
import ConversationList from '../../chat-components/ConversationList';

jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { role: "assistant", content: 'Mocked completion response' }}]
          })
        }
      }
    }))
  };
});

const mockOnSubmit = jest.fn(async function* (message: string) {
  yield `You typed: ${message}\nProcessing...\nDone!\n`;
});

// Helper function to create test messages with all required fields
const createTestMessage = (id: string, content: string, author: string, parentId: string | null = null) => ({
  id,
  content,
  author,
  timestamp: new Date().toISOString(),
  parentId,
  conversationId: '1',
  userId: author === 'User' ? '1' : '2'
});

const messages = [
  createTestMessage('1', 'Hello, world!', 'User'),
  createTestMessage('2', 'Hi there!', 'User2', '1'),
  createTestMessage('3', 'How are you?', 'User', '1'),
];

test('renders conversation messages', () => {
  render(<Conversation messages={messages} onSubmit={mockOnSubmit} author="TestUser" />);
  expect(screen.getByText('Hi there!')).toBeInTheDocument();
});
test('renders author messages with correct styles', async () => {
  render(<Conversation messages={messages} author="User" onSubmit={mockOnSubmit} />);
  const authorMessage = await screen.findAllByTestId('message-container');
  expect(authorMessage[0]).toHaveStyle('text-align: right');
  expect(authorMessage[0]).toHaveStyle('background-color: #e0f7fa');
});
test('renders conversation with navigation and selection', async () => {
  const messages = [
    createTestMessage('1', 'Hello, world!', 'User'),
    createTestMessage('2', 'Hi there!', 'User2', '1'),
    createTestMessage('3', 'How are you?', 'User', '1'),
  ];
  render(<Conversation messages={messages} onSubmit={mockOnSubmit} author="TestUser" />);
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
    createTestMessage('1', 'Hello, world!', 'User'),
    createTestMessage('2', 'Hi there!', 'User2', '1'),
    createTestMessage('3', 'How are you?', 'User', '1'),
  ];
  render(<Conversation messages={messages} author="User" onSubmit={mockOnSubmit} />);
  expect(screen.getByText('Hi there!')).toBeInTheDocument();
});

test('renders conversation with recursive navigation and selection', () => {
  const messages = [
    createTestMessage('1', 'Hello, world!', 'User'),
    createTestMessage('2', 'Hi there!', 'User2', '1'),
    createTestMessage('3', 'How are you?', 'User', '1'),
    createTestMessage('4', 'I am good, thanks!', 'User2', '2'),
    createTestMessage('5', 'What about you?', 'User2', '2'),
    createTestMessage('6', 'I am doing well!', 'User', '3'),
  ];
  render(<Conversation messages={messages} author="User" onSubmit={mockOnSubmit} />);
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
    { id: '1', title: 'Conversation 1', userId: '1', messages: [createTestMessage('1', 'Hello', 'User1')] },
    { id: '2', title: 'Conversation 2', userId: '2', messages: [createTestMessage('2', 'Hi', 'User2')] },
  ];
  render(<ConversationList conversations={conversations} onConversationClick={() => {}} />);
  const conversation1 = screen.getByText('Conversation 1');
  const messageCount1 = screen.getByText('1 messages');
  const conversation2 = screen.getByText('Conversation 2');
  const messageCount2 = screen.getByText('1 messages');
  expect(conversation1).toBeInTheDocument();
  expect(messageCount1).toBeInTheDocument();
  expect(conversation2).toBeInTheDocument();
  expect(messageCount2).toBeInTheDocument();
});

test('handles new message input and submission', async () => {
  render(<Conversation messages={messages} author="TestUser" onSubmit={mockOnSubmit} />);
  
  const input = screen.getByPlaceholderText('Type your message...');
  const sendButton = screen.getByText('Send');

  // Simulate user typing a new message
  fireEvent.change(input, { target: { value: 'Test message' } });
  expect(input).toHaveValue('Test message');

  // Simulate clicking the send button
  fireEvent.click(sendButton);
  
  // Verify that onSubmit was called with the correct message
  await waitFor(() => expect(mockOnSubmit).toHaveBeenCalledWith('Test message'));
});

test('submits a new message and updates the conversation', async () => {
  render(<Conversation messages={messages} onSubmit={mockOnSubmit} author="TestUser" />);
  fireEvent.change(screen.getByPlaceholderText('Type your message...'), { target: { value: 'New message' } });
  fireEvent.click(screen.getByText('Send'));
  await waitFor(() => expect(mockOnSubmit).toHaveBeenCalledWith('New message'));
});

test('renders author messages with right justification and different background', () => {
  const messages = [
    createTestMessage('1', 'Hello, world!', 'User'),
    createTestMessage('2', 'Hi there!', 'User2', '1'),
    createTestMessage('3', 'How are you?', 'User', '1'),
  ];
  render(<Conversation messages={messages} author="User" onSubmit={mockOnSubmit} />);
  const authorMessages = screen.getAllByText('User');
  authorMessages.forEach(message => {
    expect(message.parentElement).toHaveStyle('text-align: right');
    expect(message.parentElement).toHaveStyle('background-color: #e0f7fa');
  });
});

test('passes isAuthor prop correctly to Message components', () => {
  const messages = [
    createTestMessage('1', 'Hello from User', 'User'),
    createTestMessage('2', 'Hello from User2', 'User2', '1'),
  ];
  render(<Conversation messages={messages} author="User" onSubmit={mockOnSubmit} />);
  const userMessage = screen.getByText('Hello from User').parentElement?.parentElement;
  const user2Message = screen.getByText('Hello from User2').parentElement?.parentElement;
  expect(userMessage).toHaveStyle('text-align: right');
  expect(userMessage).toHaveStyle('background-color: #e0f7fa');
  expect(user2Message).toHaveStyle('text-align: left');
  expect(user2Message).toHaveStyle('background-color: #fff');
});

test('renders NewMessage component within Conversation', () => {
  render(<Conversation messages={messages} author="User" onSubmit={mockOnSubmit} />);
  const newMessageInput = screen.getByPlaceholderText('Type your message...');
  const sendButton = screen.getByText('Send');

  expect(newMessageInput).toBeInTheDocument();
  expect(sendButton).toBeInTheDocument();
});
