import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Message from '../src/components/Message';
import { CodeBlockRenderer } from '../src/renderers/CodeBlockRenderer';
import { Renderer } from '../src/renderers/Renderer';
import { MessageConfigProvider, MessageConfig, defaultConfig } from '../src/components/MessageConfigContext';

beforeAll(() => {
  Object.assign(navigator, {
    clipboard: {
      writeText: jest.fn().mockResolvedValue(undefined),
      readText: jest.fn().mockResolvedValue(''),
    },
  });
});

beforeEach(() => {
  jest.clearAllMocks();
});

const renderWithConfig = (ui: React.ReactElement, config: Partial<MessageConfig> = {}) => {
  const fullConfig: MessageConfig = { ...defaultConfig, ...config };
  return render(
    <MessageConfigProvider config={fullConfig}>
      {ui}
    </MessageConfigProvider>
  );
};

test('renders message content', () => {
  renderWithConfig(<Message id="test-id-1" content="Test message" />);
  expect(screen.getByText('Test message')).toBeInTheDocument();
});

test('renders author and timestamp', () => {
  renderWithConfig(<Message id="test-id-2" content="Test message" author="Test Author" timestamp="2023-01-01T00:00:00Z" />);
  expect(screen.getByText('Test Author')).toBeInTheDocument();
  expect(screen.getByText(new Date('2023-01-01T00:00:00Z').toLocaleString())).toBeInTheDocument();
});

test('renders control buttons based on props', async () => {
  const content = 'Test message';
  const onCopy = jest.fn();
  renderWithConfig(<Message id="test-id-3" content={content} buttons={{ copy: true }} onCopy={onCopy} />);
  const copyButton = screen.getByText('Copy');
  await fireEvent.click(copyButton);
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith(content);
  expect(onCopy).toHaveBeenCalled();
});

test('renders share button and triggers onShare', async () => {
  const onShare = jest.fn();
  renderWithConfig(<Message id="test-id-4" content="Test message" buttons={{ share: true }} onShare={onShare} />);
  await fireEvent.click(screen.getByText('Share'));
  expect(onShare).toHaveBeenCalled();
});

test('renders delete button and triggers onDelete', async () => {
  const onDelete = jest.fn();
  renderWithConfig(<Message id="test-id-5" content="Test message" buttons={{ delete: true }} onDelete={onDelete} />);
  await fireEvent.click(screen.getByText('Delete'));
  expect(onDelete).toHaveBeenCalled();
});

test('renders edit button and triggers onEdit', async () => {
  const onEdit = jest.fn();
  renderWithConfig(<Message id="test-id-6" content="Test message" buttons={{ edit: true }} onEdit={onEdit} />);
  await fireEvent.click(screen.getByText('Edit'));
  expect(onEdit).toHaveBeenCalled();
});

test('renders async iterator content', async () => {
  const asyncIterable = {
    async *[Symbol.asyncIterator]() {
      yield 'Hello, ';
      yield 'world!';
    },
  };

  renderWithConfig(<Message id="test-id-7" content={asyncIterable} />);
  await waitFor(() => {
    expect(screen.getByText((content) => content.startsWith('Hello, '))).toBeInTheDocument();
  });
  await waitFor(() => {
    expect(screen.getByText('Hello, world!')).toBeInTheDocument();
  });
});

test('renders async iterator content with delay', async () => {
  const asyncIterable = {
    async *[Symbol.asyncIterator]() {
      yield 'Loading';
      await new Promise(resolve => setTimeout(resolve, 100));
      yield '...';
    },
  };

  renderWithConfig(<Message id="test-id-8" content={asyncIterable} />);
  await waitFor(() => {
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });
  await waitFor(() => {
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});

test('renders code block content', () => {
  const renderers = [new CodeBlockRenderer()];
  const content = "```javascript\nconsole.log('Hello, World!');\n```";
  renderWithConfig(<Message id="test-id-9" content={content} renderers={renderers as Renderer[]} />);
  expect(screen.getByText("console")).toBeInTheDocument();
  expect(screen.getByText("log")).toBeInTheDocument();
});

test('renders multiple code blocks and text without duplication', () => {
  const renderers = [new CodeBlockRenderer()];
  const content = "Here is some text before the code block.\n```javascript\nconsole.log('Hello, World!');\nconsole.log('This is a second line.');\n```\nHere is some text between the code blocks.\n```python\nprint('Hello, World!')\nprint('This is a second line.')\n```\nHere is some text after the code block."
  renderWithConfig(<Message id="test-id-10" content={content} renderers={renderers as Renderer[]} />);
  expect(screen.getByText("Here is some text before the code block.")).toBeInTheDocument();
  expect(screen.getByText("Here is some text between the code blocks.")).toBeInTheDocument();
  expect(screen.getByText("Here is some text after the code block.")).toBeInTheDocument();
  expect(screen.getAllByText("console")).toHaveLength(2)
  expect(screen.getAllByText("log")).toHaveLength(2)
  expect(screen.getAllByText("'This is a second line.'")).toHaveLength(2)
  expect(screen.getAllByText("print")).toHaveLength(2)
  expect(screen.getByTestId('message-container')).toBeInTheDocument();
});

test('copies message content to clipboard', async () => {
  const content = 'Test message to copy';
  renderWithConfig(<Message id="test-id-11" content={content} buttons={{ copy: true }} />);
  const copyButton = screen.getByText('Copy');
  await fireEvent.click(copyButton);
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith(content);
});

test('renders message with all buttons', async () => {
  const onCopy = jest.fn();
  const onShare = jest.fn();
  const onDelete = jest.fn();
  const onEdit = jest.fn();
  renderWithConfig(<Message id="test-id-12" content="Test message" buttons={{ copy: true, share: true, delete: true, edit: true }} onCopy={onCopy} onShare={onShare} onDelete={onDelete} onEdit={onEdit} />);
  await fireEvent.click(screen.getByText('Copy'));
  expect(onCopy).toHaveBeenCalled();
  await fireEvent.click(screen.getByText('Share'));
  expect(onShare).toHaveBeenCalled();
  await fireEvent.click(screen.getByText('Delete'));
  expect(onDelete).toHaveBeenCalled();
  await fireEvent.click(screen.getByText('Edit'));
  expect(onEdit).toHaveBeenCalled();
});

test('renders message with no buttons', async () => {
  renderWithConfig(<Message id="test-id-13" content="Test message" />, { buttons: { copy: false, share: false, delete: false, edit: false } });
  expect(screen.queryByText('Copy')).not.toBeInTheDocument();
  expect(screen.queryByText('Share')).not.toBeInTheDocument();
  expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  expect(screen.queryByText('Edit')).not.toBeInTheDocument();
});

test('renders message with only copy button', async () => {
  const onCopy = jest.fn();
  renderWithConfig(<Message id="test-id-14" content="Test message" buttons={{ copy: true }} onCopy={onCopy} />, { buttons: { copy: true, share: false, delete: false, edit: false } });
  expect(screen.getByText('Copy')).toBeInTheDocument();
  expect(screen.queryByText('Share')).not.toBeInTheDocument();
  expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  expect(screen.queryByText('Edit')).not.toBeInTheDocument();
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
  renderWithConfig(<Message id="test-id-11" content={asyncIterable} renderers={renderers as Renderer[]} />);
  await waitFor(() => {
    expect(screen.getByText("Here is some text before the code block.")).toBeInTheDocument();
  });
  await waitFor(() => {
    expect(screen.getAllByText((content, element) => element !== null && element.tagName.toLowerCase() === 'span' && content.includes("console"))).toHaveLength(2);
  });
  await waitFor(() => {
    expect(screen.getAllByText((content, element) => element !== null && element.tagName.toLowerCase() === 'span' && content.includes("log"))).toHaveLength(2);
  });
  await waitFor(() => {
    expect(screen.getByText("Here is some text after the code block.")).toBeInTheDocument();
  });
});
