import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Message from '../src/components/Message';
import { CodeBlockRenderer } from '../src/renderers/CodeBlockRenderer';

test('renders message content', () => {
  render(<Message content="Test message" />);
  expect(screen.getByText('Test message')).toBeInTheDocument();
});

test('renders author and timestamp', () => {
  render(<Message content="Test message" author="Test Author" timestamp="2023-01-01T00:00:00Z" />);
  expect(screen.getByText('Test Author')).toBeInTheDocument();
  expect(screen.getByText(new Date('2023-01-01T00:00:00Z').toLocaleString())).toBeInTheDocument();
});

test('renders control buttons based on props', () => {
  const onCopy = jest.fn();
  render(<Message content="Test message" buttons={{ copy: true }} onCopy={onCopy} />);
  fireEvent.click(screen.getByText('Copy'));
  expect(onCopy).toHaveBeenCalled();
});

test('renders share button and triggers onShare', () => {
  const onShare = jest.fn();
  render(<Message content="Test message" buttons={{ share: true }} onShare={onShare} />);
  fireEvent.click(screen.getByText('Share'));
  expect(onShare).toHaveBeenCalled();
});

test('renders delete button and triggers onDelete', () => {
  const onDelete = jest.fn();
  render(<Message content="Test message" buttons={{ delete: true }} onDelete={onDelete} />);
  fireEvent.click(screen.getByText('Delete'));
  expect(onDelete).toHaveBeenCalled();
});

test('renders edit button and triggers onEdit', () => {
  const onEdit = jest.fn();
  render(<Message content="Test message" buttons={{ edit: true }} onEdit={onEdit} />);
  fireEvent.click(screen.getByText('Edit'));
  expect(onEdit).toHaveBeenCalled();
});

// Test for async iterator content
test('renders async iterator content', async () => {
  const asyncIterable = {
    async *[Symbol.asyncIterator]() {
      yield 'Hello, ';
      yield 'world!';
    },
  };

  render(<Message content={asyncIterable} />);
  expect(await screen.findByText((content, element) => content.startsWith('Hello, '))).toBeInTheDocument();
  expect(await screen.findByText('Hello, world!')).toBeInTheDocument();
});

// Test for async iterator content with delay
test('renders async iterator content with delay', async () => {
  const asyncIterable = {
    async *[Symbol.asyncIterator]() {
      yield 'Loading';
      await new Promise(resolve => setTimeout(resolve, 100));
      yield '...';
    },
  };

  render(<Message content={asyncIterable} />);
  expect(await screen.findByText('Loading')).toBeInTheDocument();
  expect(await screen.findByText('Loading...')).toBeInTheDocument();
});

// Test for code block rendering
test('renders code block content', () => {
  const renderers = [new CodeBlockRenderer()];
  const content = "```javascript\nconsole.log('Hello, World!');\n```";
  render(<Message content={content} renderers={renderers} />);
  expect(screen.getByText("console.log('Hello, World!');")).toBeInTheDocument();
});

test('renders multiple code blocks and text', () => {
  const renderers = [new CodeBlockRenderer()];
  const content = "Here is some text before the code block.\n```javascript\nconsole.log('Hello, World!');\nconsole.log('This is a second line.');\n```\nHere is some text between the code blocks.\n```python\nprint('Hello, World!')\nprint('This is a second line.')\n```\nHere is some text after the code block."
  render(<Message content={content} renderers={renderers} />);
  expect(screen.getByText("console.log('Hello, World!');")).toBeInTheDocument();
  expect(screen.getByText("print('Hello, World!')")).toBeInTheDocument();
});