import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Conversation from '../../chat-components/Conversation';
import ConversationList from '../../chat-components/ConversationList';
import OpenAI from 'openai';

jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ text: 'Mocked completion response' }]
        })
      }
    }))
  };
});

const messages = [
  { id: '1', content: 'Hello, world!', author: 'User', timestamp: new Date().toISOString(), parentId: null },
  { id: '2', content: 'Hi there!', author: 'User2', timestamp: new Date().toISOString(), parentId: '1' },
  { id: '3', content: 'How are you?', author: 'User', timestamp: new Date().toISOString(), parentId: '1' },
];

test('renders author messages with correct styles', async () => {
  render(<Conversation messages={messages} author="User" />);
  const authorMessage = await screen.findByTestId('message-container');
  expect(authorMessage).toHaveStyle('text-align: right');
  expect(authorMessage).toHaveStyle('background-color: #e0f7fa');
});
test('renders conversation with navigation and selection', async () => {
  const messages = [
    { id: '1', content: 'Hello, world!', author: 'User', timestamp: new Date().toISOString(), parentId: null },
    { id: '2', content: 'Hi there!', author: 'User2', timestamp: new Date().toISOString(), parentId: '1' },
    { id: '3', content: 'How are you?', author: 'User', timestamp: new Date().toISOString(), parentId: '1' },
  ];
  render(<Conversation messages={messages} author="User" />);
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
  render(<Conversation messages={messages} author="User" />);
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
  render(<Conversation messages={messages} author="User" />);
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
  expect(screen.getByText('Conversation 1 - User1')).toBeInTheDocument();
  expect(screen.getByText('Conversation 2 - User2')).toBeInTheDocument();
});

test('renders author messages with right justification and different background', () => {
  const messages = [
    { id: '1', content: 'Hello, world!', author: 'User', timestamp: new Date().toISOString(), parentId: null },
    { id: '2', content: 'Hi there!', author: 'User2', timestamp: new Date().toISOString(), parentId: '1' },
    { id: '3', content: 'How are you?', author: 'User', timestamp: new Date().toISOString(), parentId: '1' },
  ];
  render(<Conversation messages={messages} author="User" />);
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
  render(<Conversation messages={messages} author="User" />);
  const userMessage = screen.getByText('Hello from User').parentElement;
  const user2Message = screen.getByText('Hello from User2').parentElement;
  expect(userMessage).toHaveStyle('text-align: right');
  expect(user2Message).toHaveStyle('text-align: left');
});
