import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import Message from '../src/components/Message';
import { CodeBlockRenderer } from '../src/renderers/CodeBlockRenderer';
import { Renderer } from '../src/renderers/Renderer';

beforeAll(() => {
  Object.assign(navigator, {
    clipboard: {
      writeText: jest.fn().mockResolvedValue(undefined),
      readText: jest.fn().mockResolvedValue(''),
    },
  });
});

beforeEach(() => {
  navigator.clipboard.writeText.mockClear();
  navigator.clipboard.readText.mockClear();
});

test('renders message content', () => {
  render(<Message id="test-id-1" content="Test message" />);
  expect(screen.getByText('Test message')).toBeInTheDocument();
});
test('renders author and timestamp', () => {
  render(<Message id="test-id-2" content="Test message" author="Test Author" timestamp="2023-01-01T00:00:00Z" />);
  expect(screen.getByText('Test Author')).toBeInTheDocument();
  expect(screen.getByText(new Date('2023-01-01T00:00:00Z').toLocaleString())).toBeInTheDocument();
});

test('renders control buttons based on props', async () => {
  const content = 'Test message';
  const onCopy = jest.fn();
  render(<Message id="test-id-3" content={content} buttons={{ copy: true }} onCopy={onCopy} />);
  await navigator.clipboard.writeText(''); // Clear clipboard before test
  const copyButton = screen.getByText('Copy');
  fireEvent.click(copyButton);
  const clipboardContent = await navigator.clipboard.readText();
  expect(clipboardContent).toBe(content);
  expect(onCopy).toHaveBeenCalled();
});

test('renders share button and triggers onShare', () => {
  const onShare = jest.fn();
  render(<Message id="test-id-4" content="Test message" buttons={{ share: true }} onShare={onShare} />);
  fireEvent.click(screen.getByText('Share'));
  expect(onShare).toHaveBeenCalled();
});

test('renders delete button and triggers onDelete', () => {
  const onDelete = jest.fn();
  render(<Message id="test-id-5" content="Test message" buttons={{ delete: true }} onDelete={onDelete} />);
  fireEvent.click(screen.getByText('Delete'));
  expect(onDelete).toHaveBeenCalled();
});

test('renders edit button and triggers onEdit', () => {
  const onEdit = jest.fn();
  render(<Message id="test-id-6" content="Test message" buttons={{ edit: true }} onEdit={onEdit} />);
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

  render(<Message id="test-id-7" content={asyncIterable} />);
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

  render(<Message id="test-id-8" content={asyncIterable} />);
  expect(await screen.findByText('Loading')).toBeInTheDocument();
  expect(await screen.findByText('Loading...')).toBeInTheDocument();
});

// Test for code block rendering
test('renders code block content', () => {
  const renderers = [new CodeBlockRenderer()];
  const content = "```javascript\nconsole.log('Hello, World!');\n```";
  render(<Message id="test-id-9" content={content} renderers={renderers as Renderer[]} />);
  expect(screen.getByText("console")).toBeInTheDocument();
  expect(screen.getByText("log")).toBeInTheDocument();
});

test('renders multiple code blocks and text without duplication', () => {
  const renderers = [new CodeBlockRenderer()];
  const content = "Here is some text before the code block.\n```javascript\nconsole.log('Hello, World!');\nconsole.log('This is a second line.');\n```\nHere is some text between the code blocks.\n```python\nprint('Hello, World!')\nprint('This is a second line.')\n```\nHere is some text after the code block."
  render(<Message id="test-id-10" content={content} renderers={renderers as Renderer[]} />);
  expect(screen.getByText("Here is some text before the code block.")).toBeInTheDocument();
  expect(screen.getByText("Here is some text between the code blocks.")).toBeInTheDocument();
  expect(screen.getByText("Here is some text after the code block.")).toBeInTheDocument();
  expect(screen.getAllByText("console")).toHaveLength(2)
  expect(screen.getAllByText("log")).toHaveLength(2)
  expect(screen.getAllByText("'This is a second line.'")).toHaveLength(2)
  expect(screen.getAllByText("print")).toHaveLength(2)
});

beforeEach(() => {
  navigator.clipboard.writeText.mockClear();
  navigator.clipboard.readText.mockClear();
});

test('copies message content to clipboard', async () => {
  const content = 'Test message to copy';
  await navigator.clipboard.writeText(''); // Clear clipboard before test
  render(<Message id="test-id-11" content={content} buttons={{ copy: true }} />);
  const copyButton = screen.getByText('Copy');
  fireEvent.click(copyButton);
  const clipboardContent = await navigator.clipboard.readText();
  expect(clipboardContent).toBe(content);
});

test('renders message with all buttons', async () => {
  const onCopy = jest.fn();
  const onShare = jest.fn();
  const onDelete = jest.fn();
  const onEdit = jest.fn();
  render(<Message id="test-id-12" content="Test message" buttons={{ copy: true, share: true, delete: true, edit: true }} onCopy={onCopy} onShare={onShare} onDelete={onDelete} onEdit={onEdit} />);
  fireEvent.click(screen.getByText('Copy'));
  expect(onCopy).toHaveBeenCalled();
  fireEvent.click(screen.getByText('Share'));
  expect(onShare).toHaveBeenCalled();
  fireEvent.click(screen.getByText('Delete'));
  expect(onDelete).toHaveBeenCalled();
  fireEvent.click(screen.getByText('Edit'));
  expect(onEdit).toHaveBeenCalled();
});

test('renders message with no buttons', async () => {
  render(<Message id="test-id-13" content="Test message" />);
  expect(screen.queryByText('Copy')).not.toBeInTheDocument();
  expect(screen.queryByText('Share')).not.toBeInTheDocument();
  expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  expect(screen.queryByText('Edit')).not.toBeInTheDocument();
});

test('renders message with only copy button', async () => {
  const onCopy = jest.fn();
  render(<Message id="test-id-14" content="Test message" buttons={{ copy: true }} onCopy={onCopy} />);
  expect(screen.getByText('Copy')).toBeInTheDocument();
  expect(screen.queryByText('Share')).not.toBeInTheDocument();
  expect(screen.queryByText('Delete')).not toBeInTheDocument();
  expect(screen.queryByText('Edit')).not toBeInTheDocument();
});

test('renders code block content during streaming', async () => {
  const asyncIterable = {
    async *[Symbol.asyncIterator]() {
      yield 'Here is some text before the code block.\n';
      yield '```javascript\n';
      yield 'console.log(\'Hello, World!\');\n';
      yield 'console.log(\'This is a second line.\');\n';
      yield '```\n';
      yield 'Here is some text after the code block.';
    },
  };
  const renderers = [new CodeBlockRenderer()];
  render(<Message id="test-id-11" content={asyncIterable} renderers={renderers as Renderer[]} />);
  expect(await screen.findByText("Here is some text before the code block.")).toBeInTheDocument();
  expect(await screen.findAllByText((content, element) => element !== null && element.tagName.toLowerCase() === 'span' && content.includes("console"))).toHaveLength(2);
  expect(await screen.findAllByText((content, element) => element !== null && element.tagName.toLowerCase() === 'span' && content.includes("log"))).toHaveLength(2);
  expect(await screen.findByText("Here is some text after the code block.")).toBeInTheDocument();
});
