import React, { useCallback } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Message from '../../chat-components/Message';
import { CodeBlockRenderer } from '../../chat-components/renderers/CodeBlockRenderer';
import { ArtifactRenderer } from '../../chat-components/renderers/ArtifactRenderer';
import { MessageConfigProvider, MessageConfig, defaultConfig } from '../../chat-components/MessageConfigContext';
import { Renderer } from '../../chat-components/renderers/Renderer';
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

test('renders author and timestamp', () => {
  renderWithConfig(<Message id="test-id-2" content="Test message" author="Test Author" timestamp="2023-01-01T00:00:00Z" currentIndex={0} totalSiblings={2} />);
  expect(screen.getByText('Test Author')).toBeInTheDocument();
  expect(screen.getByText(new Date('2023-01-01T00:00:00Z').toLocaleString())).toBeInTheDocument();
});

test('renders artifact content and opens side panel', async () => {
  const content = '<artifact>Artifact Content</artifact>';
  const renderers = [new ArtifactRenderer({ tagName: 'artifact' })];
  renderWithConfig(<Message id="test-id-17" content={content} renderers={renderers} />);
  
  const artifactElement = screen.getByText('Artifact Content');
  expect(artifactElement).toBeInTheDocument();
  expect(artifactElement).toHaveClass('artifact-content');
  
  fireEvent.click(artifactElement);
  
  const sidePanel = screen.getByRole('complementary', { name: /artifact content/i });
  expect(sidePanel).toHaveClass('side-panel');
  
  const backdrop = screen.getByTestId('side-panel-backdrop');
  expect(backdrop).toBeInTheDocument();
  
  const closeButton = screen.getByRole('button', { name: /close/i });
  fireEvent.click(closeButton);
  
  await waitFor(() => {
    expect(sidePanel).not.toBeInTheDocument();
    expect(backdrop).not.toBeInTheDocument();
  });
});

test('renders HTML content in artifact safely', () => {
  const htmlContent = '<artifact><div>Safe <b>HTML</b></div><script>alert("unsafe")</script></artifact>';
  const renderers = [new ArtifactRenderer({ tagName: 'artifact' })];
  renderWithConfig(<Message id="test-id-18" content={htmlContent} renderers={renderers} />);
  
  const artifactElement = screen.getByText(/Safe HTML/);
  expect(artifactElement).toBeInTheDocument();
  
  fireEvent.click(artifactElement);
  
  const sidePanel = screen.getByRole('complementary', { name: /artifact content/i });
  const renderedContent = sidePanel.querySelector('.artifact-rendered-content');
  
  expect(renderedContent).toHaveTextContent(/Safe HTML/);
  expect(renderedContent?.innerHTML).not.toContain('script');
  expect(renderedContent?.innerHTML).toContain('<b>HTML</b>');
});

test('renders control buttons based on props', async () => {
  const content = 'Test message';
  const onCopy = jest.fn();
  renderWithConfig(<Message id="test-id-3" content={content} buttons={{ copy: 'enabled' }} onCopy={onCopy} currentIndex={0} totalSiblings={1} />);
  const copyButton = screen.getByText('Copy');
  await fireEvent.click(copyButton);
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith(content);
  expect(onCopy).toHaveBeenCalled();
});

test('renders share button and triggers onShare', async () => {
  const onShare = jest.fn();
  renderWithConfig(<Message id="test-id-4" content="Test message" buttons={{ share: 'enabled' }} onShare={onShare} />);
  await fireEvent.click(screen.getByText('Share'));
  expect(onShare).toHaveBeenCalled();
});

test('renders delete button and triggers onDelete', async () => {
  const onDelete = jest.fn();
  renderWithConfig(<Message id="test-id-5" content="Test message" buttons={{ delete: 'enabled' }} onDelete={onDelete} />);
  await fireEvent.click(screen.getByText('Delete'));
  expect(onDelete).toHaveBeenCalled();
});

test('renders edit button and triggers onEdit', async () => {
  const onEdit = jest.fn();
  renderWithConfig(<Message id="test-id-6" content="Test message" buttons={{ edit: 'enabled' }} onEdit={onEdit} />);
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

test('renders content without end sequence', () => {
  const renderers = [new CodeBlockRenderer()];
  const content = "```javascript\nconsole.log('Hello, World!');";
  renderWithConfig(<Message id="test-id-15" content={content} renderers={renderers as Renderer[]} currentIndex={0} totalSiblings={1} />);
  expect(screen.getByText("console")).toBeInTheDocument();
  expect(screen.getByText("log")).toBeInTheDocument();
});

test('renders code block content', () => {
  const renderers = [new CodeBlockRenderer()];
  const content = "```javascript\nconsole.log('Hello, World!');\n```";
  renderWithConfig(<Message id="test-id-9" content={content} renderers={renderers as Renderer[]} currentIndex={0} totalSiblings={1} />);
  expect(screen.getByText("console")).toBeInTheDocument();
  expect(screen.getByText("log")).toBeInTheDocument();
});

test('renders multiple code blocks and text without duplication', () => {
  const renderers = [new CodeBlockRenderer()];
  const content = "Here is some text before the code block.\n```javascript\nconsole.log('Hello, World!');\nconsole.log('This is a second line.');\n```\nHere is some text between the code blocks.\n```python\nprint('Hello, World!')\nprint('This is a second line.')\n```\nHere is some text after the code block."
  renderWithConfig(<Message id="test-id-10" content={content} renderers={renderers as Renderer[]} currentIndex={0} totalSiblings={1} />);
  expect(screen.getByText("Here is some text before the code block.")).toBeInTheDocument();
  expect(screen.getByText("Here is some text between the code blocks.")).toBeInTheDocument();
  expect(screen.getByText("Here is some text after the code block.")).toBeInTheDocument();
  expect(screen.getAllByText(/console/)).toHaveLength(2);
  expect(screen.getAllByText(/log/)).toHaveLength(2);
  expect(screen.getAllByText(/'This is a second line.'/)).toHaveLength(2);
  expect(screen.getAllByText(/print/)).toHaveLength(2);
  expect(screen.getByTestId('message-container')).toBeInTheDocument();
});

test('copies message content to clipboard', async () => {
  const content = 'Test message to copy';
  const onCopy = jest.fn();
  renderWithConfig(<Message id="test-id-11" content={content} buttons={{ copy: 'enabled' }} onCopy={onCopy} />);
  const copyButton = screen.getByText('Copy');
  await fireEvent.click(copyButton);
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith(content);
  expect(onCopy).toHaveBeenCalled();
});

test('renders menu-ed buttons and triggers respective actions', async () => {
  jest.useFakeTimers();
  renderWithConfig(<Message id="test-id-11" content="Test message" buttons={{ copy: 'menu-ed', share: 'menu-ed', delete: 'menu-ed', edit: 'menu-ed' }} />);
  expect(screen.getByText('Menu')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Menu'));
  await waitFor(() => {
    expect(screen.getByText('Copy')).toBeInTheDocument();
    expect(screen.getByText('Share')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });
});

test('renders message with all buttons', async () => {
  const onCopy = jest.fn();
  const onShare = jest.fn();
  const onDelete = jest.fn();
  const onEdit = jest.fn();
  renderWithConfig(<Message id="test-id-12" content="Test message" buttons={{ copy: 'enabled', share: 'enabled', delete: 'enabled', edit: 'enabled' }} onCopy={onCopy} onShare={onShare} onDelete={onDelete} onEdit={onEdit} />);
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
  renderWithConfig(<Message id="test-id-13" content="Test message" />, { buttons: { copy: 'disabled', share: 'disabled', delete: 'disabled', edit: 'disabled' } });
  expect(screen.queryByText('Copy')).not.toBeInTheDocument();
  expect(screen.queryByText('Share')).not.toBeInTheDocument();
  expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  expect(screen.queryByText('Edit')).not.toBeInTheDocument();
});

test('renders message with only copy button', async () => {
  const onCopy = jest.fn();
  renderWithConfig(<Message id="test-id-14" content="Test message" buttons={{ copy: 'enabled' }} onCopy={onCopy} />, { buttons: { copy: 'enabled', share: 'disabled', delete: 'disabled', edit: 'disabled' } });
  expect(screen.getByText('Copy')).toBeInTheDocument();
  expect(screen.queryByText('Share')).not.toBeInTheDocument();
  expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  expect(screen.queryByText('Edit')).not.toBeInTheDocument();
});

test('renders plain text when no start sequence is found', () => {
  const content = "This is a plain text without code block.";
  renderWithConfig(<Message id="test-id-16" content={content} />);
  expect(screen.getByText(content)).toBeInTheDocument();
});

const messages = [
  { id: '1', content: 'Hello, world!', author: 'User', timestamp: new Date().toISOString(), parentId: null },
  { id: '2', content: 'Hi there!', author: 'User2', timestamp: new Date().toISOString(), parentId: '1' },
  { id: '3', content: 'How are you?', author: 'User', timestamp: new Date().toISOString(), parentId: '1' },
];

test('renders menu-ed buttons and triggers respective actions', async () => {
  renderWithConfig(<Message id="test-id-11" content="Test message" buttons={{ copy: 'menu-ed', share: 'menu-ed', delete: 'menu-ed', edit: 'menu-ed' }} />);
  expect(screen.getByText('Menu')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Menu'));
  await waitFor(() => {
    expect(screen.getByText('Copy')).toBeInTheDocument();
    expect(screen.getByText('Share')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });
});

test('renders message with right justification and different background for author', () => {
  renderWithConfig(<Message id="test-id-17" content="Test message" author="Test Author" $isAuthor={true} />);
  const messageContainer = screen.getByTestId('message-container');
  expect(messageContainer).toHaveStyle('text-align: right');
  expect(messageContainer).toHaveStyle('background-color: #e0f7fa');
  // Ensure $isAuthor is not passed to DOM
  expect(messageContainer).not.toHaveAttribute('$isAuthor');
});

test('does not pass $isAuthor prop to DOM', () => {
  renderWithConfig(<Message id="test-id-20" content="Another test message" author="AuthorUser" $isAuthor={true} />);
  const messageContainer = screen.getByTestId('message-container');
  expect(messageContainer).not.toHaveAttribute('$isAuthor');
});

test('does not pass transient props to DOM elements', () => {
  renderWithConfig(<Message id="test-id-19" content="Test message" $isAuthor={true} />);
  const messageContainer = screen.getByTestId('message-container');
  expect(messageContainer).not.toHaveAttribute('$isAuthor');
});