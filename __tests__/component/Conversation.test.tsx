import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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

const mockOnSubmit = jest.fn(async function* (message: string, options: { model: string; temperature: number; getCompletion: boolean }) {
  yield `You typed: ${message}\nProcessing with ${options.model} at temperature ${options.temperature}...\nDone!\n`;
});

const messages = [
  { id: '1', content: 'Hello, world!', author: 'User', timestamp: new Date().toISOString(), parentId: null },
  { id: '2', content: 'Hi there!', author: 'User2', timestamp: new Date().toISOString(), parentId: '1' },
  { id: '3', content: 'How are you?', author: 'User', timestamp: new Date().toISOString(), parentId: '1' },
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
    { id: '1', content: 'Hello, world!', author: 'User', timestamp: new Date().toISOString(), parentId: null },
    { id: '2', content: 'Hi there!', author: 'User2', timestamp: new Date().toISOString(), parentId: '1' },
    { id: '3', content: 'How are you?', author: 'User', timestamp: new Date().toISOString(), parentId: '1' },
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
    { id: '1', content: 'Hello, world!', author: 'User', timestamp: new Date().toISOString(), parentId: null },
    { id: '2', content: 'Hi there!', author: 'User2', timestamp: new Date().toISOString(), parentId: '1' },
    { id: '3', content: 'How are you?', author: 'User', timestamp: new Date().toISOString(), parentId: '1' },
  ];
  render(<Conversation messages={messages} author="User" onSubmit={mockOnSubmit} />);
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
  render(<Conversation messages={messages} author="TestUser" onSubmit={mockOnSubmit} />);
  
  const input = screen.getByPlaceholderText('Type your message...');
  const sendButton = screen.getByText('Send');

  // Simulate user typing a new message
  fireEvent.change(input, { target: { value: 'Test message' } });
  expect(input).toHaveValue('Test message');

  // Simulate clicking the send button
  fireEvent.click(sendButton);
  
  // Verify that onSubmit was called with the correct message and default options
  await waitFor(() => expect(mockOnSubmit).toHaveBeenCalledWith('Test message', {
    model: 'gpt-4',
    temperature: 0.7,
    getCompletion: true
  }));
});

test('submits a new message and updates the conversation', async () => {
  render(<Conversation messages={messages} onSubmit={mockOnSubmit} author="TestUser" />);
  fireEvent.change(screen.getByPlaceholderText('Type your message...'), { target: { value: 'New message' } });
  fireEvent.click(screen.getByText('Send'));
  await waitFor(() => expect(mockOnSubmit).toHaveBeenCalledWith('New message', {
    model: 'gpt-4',
    temperature: 0.7,
    getCompletion: true
  }));
});

test('renders author messages with right justification and different background', () => {
  const messages = [
    { id: '1', content: 'Hello, world!', author: 'User', timestamp: new Date().toISOString(), parentId: null },
    { id: '2', content: 'Hi there!', author: 'User2', timestamp: new Date().toISOString(), parentId: '1' },
    { id: '3', content: 'How are you?', author: 'User', timestamp: new Date().toISOString(), parentId: '1' },
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
    { id: '1', content: 'Hello from User', author: 'User', timestamp: new Date().toISOString(), parentId: null },
    { id: '2', content: 'Hello from User2', author: 'User2', timestamp: new Date().toISOString(), parentId: '1' },
  ];
  render(<Conversation messages={messages} author="User" onSubmit={mockOnSubmit} />);
  const userMessage = screen.getByText('Hello from User').parentElement?.parentElement;
  const user2Message = screen.getByText('Hello from User2').parentElement?.parentElement;
  expect(userMessage).toHaveStyle('text-align: right');
  expect(userMessage).toHaveStyle('background-color: #e0f7fa');
  expect(user2Message).toHaveStyle('text-align: left');
  expect(user2Message).toHaveStyle('background-color: #fff');
});

test('renders NewMessage component within Conversation with model and temperature controls', () => {
  render(<Conversation messages={messages} author="User" onSubmit={mockOnSubmit} />);
  const newMessageInput = screen.getByPlaceholderText('Type your message...');
  const sendButton = screen.getByText('Send');
  const modelSelect = screen.getByRole('combobox', { name: /model/i });
  const temperatureSelect = screen.getByRole('combobox', { name: /temperature/i });

  expect(newMessageInput).toBeInTheDocument();
  expect(sendButton).toBeInTheDocument();
  expect(modelSelect).toBeInTheDocument();
  expect(temperatureSelect).toBeInTheDocument();

  // Test model selection
  fireEvent.change(modelSelect, { target: { value: 'gpt-3.5-turbo' } });
  expect(modelSelect).toHaveValue('gpt-3.5-turbo');

  // Test temperature selection
  fireEvent.change(temperatureSelect, { target: { value: '0.5' } });
  expect(temperatureSelect).toHaveValue('0.5');
});

test('handles sending message without completion and dropdown interactions', async () => {
  render(<Conversation messages={messages} author="User" onSubmit={mockOnSubmit} />);
  const newMessageInput = screen.getByPlaceholderText('Type your message...');
  const sendButtonElement = screen.getByTestId('send-button');

  // Test dropdown opening and closing
  fireEvent.contextMenu(sendButtonElement);
  const sendWithoutCompletionButton = screen.getByText('Send without completion');
  expect(sendWithoutCompletionButton).toBeInTheDocument();

  // Test clicking outside dropdown
  const outsideDiv = document.createElement('div');
  document.body.appendChild(outsideDiv);
  await act(async () => {
    fireEvent.mouseDown(outsideDiv);
  });
  await waitFor(() => {
    expect(screen.queryByTestId('send-options-dropdown')).not.toBeInTheDocument();
  });

  // Test reopening dropdown
  fireEvent.contextMenu(sendButtonElement);
  expect(screen.getByTestId('send-options-dropdown')).toBeInTheDocument();

  // Test ESC key
  await act(async () => {
    fireEvent.keyDown(document, { key: 'Escape' });
  });
  await waitFor(() => {
    expect(screen.queryByText('Send without completion')).not.toBeInTheDocument();
  });

  // Test model and temperature changes
  fireEvent.contextMenu(sendButtonElement);
  const modelSelect = screen.getByLabelText('model');
  const temperatureSelect = screen.getByLabelText('temperature');

  await act(async () => {
    fireEvent.change(modelSelect, { target: { value: 'gpt-3.5-turbo' } });
    fireEvent.change(temperatureSelect, { target: { value: '0.5' } });
  });

  // Test sending with custom settings
  fireEvent.change(newMessageInput, { target: { value: 'Test with custom settings' } });
  fireEvent.click(screen.getByText('Send without completion'));

  // Wait for the message to be sent and input to be cleared
  await waitFor(() => {
    expect(mockOnSubmit).toHaveBeenCalledWith('Test with custom settings', {
      model: 'gpt-3.5-turbo',
      temperature: 0.5,
      getCompletion: false
    });
    expect(newMessageInput).toHaveValue('');
  });
});

test('handles model and temperature changes with validation', async () => {
  render(<Conversation messages={messages} author="User" onSubmit={mockOnSubmit} />);
  const modelSelect = screen.getByLabelText('model');
  const temperatureSelect = screen.getByLabelText('temperature');
  const newMessageInput = screen.getByPlaceholderText('Type your message...');
  const sendButton = screen.getByText('Send');

  // Test model change
  fireEvent.change(modelSelect, { target: { value: 'gpt-3.5-turbo' } });
  expect(modelSelect).toHaveValue('gpt-3.5-turbo');

  // Test temperature change
  fireEvent.change(temperatureSelect, { target: { value: '0.5' } });
  expect(temperatureSelect).toHaveValue('0.5');

  // Test sending with changed options
  fireEvent.change(newMessageInput, { target: { value: 'Test with options' } });
  fireEvent.click(sendButton);

  await waitFor(() => expect(mockOnSubmit).toHaveBeenCalledWith('Test with options', {
    model: 'gpt-3.5-turbo',
    temperature: 0.5,
    getCompletion: true
  }));
});

test('handles loading state during message submission', async () => {
  render(<Conversation messages={messages} author="User" onSubmit={mockOnSubmit} />);
  const newMessageInput = screen.getByPlaceholderText('Type your message...');
  const sendButton = screen.getByText('Send');

  // Start submission
  fireEvent.change(newMessageInput, { target: { value: 'Test loading' } });
  fireEvent.click(sendButton);

  // Verify loading state
  expect(sendButton).toBeDisabled();
  expect(newMessageInput).toBeDisabled();
  expect(screen.getByText('Sending...')).toBeInTheDocument();

  // Wait for submission to complete
  await waitFor(() => {
    expect(sendButton).not.toBeDisabled();
    expect(newMessageInput).not.toBeDisabled();
    expect(screen.getByText('Send')).toBeInTheDocument();
  });
});
