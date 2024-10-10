import * as React from 'react';
import { useState } from 'react';
import Message from '../../chat-components/Message';
import Conversation from '../../chat-components/Conversation';
import ConversationList from '../../chat-components/ConversationList';
import { CodeBlockRenderer } from '../../chat-components/renderers/CodeBlockRenderer';
import { LatexRenderer } from '../../chat-components/renderers/LatexRenderer';
import { MessageConfigProvider } from '../../chat-components/MessageConfigContext';
import { Message as MessageType } from '../../chat-components/types/Message';

const MessageDemo = () => {
  const [streamingContent, setStreamingContent] = useState<AsyncIterable<string> | null>(null);
  const [tab, setTab] = useState<'messages' | 'conversation' | 'conversationList'>('messages');
  const startStreaming = async function* (): AsyncIterable<string> {
    const content = [
      'Here is some text before the code block.\n',
      '```javascript\n',
      "console.log('Hello, World!');\n",
      "console.log('This is a second line.');\n",
      '```\n',
      'Here is some text between the code blocks.\n',
      '```python\n',
      "print('Hello, World!')\n",
      "print('This is a second line.')\n",
      '```\n',
      'Here is some text after the code block.\n',
      'Here is some math: \\(E=mc^2\\).\n',
      'Here is a display math block:\n',
      '$$\\int_0^\\infty e^{-x^2} dx = ',
      '\\frac{\\sqrt{\\pi}}{2}.$$\n',
    ];
    for (const chunk of content) {
      yield chunk;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  const exampleMessage = `\`\`\`python\nprint(1)\nprint(2)\n\`\`\`\nHere's an example with inline math \\(E=mc^2\\), display math $$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2},$$ and bracketed math \\[\\sum_{n=1}^\\infty \\frac{1}{n^2} = \\frac{\\pi^2}{6}.\\] \nAnd one more final formula: \\(\\frac{d}{dx}\\left(\\int_{0}^{x} f(u) \\, du\\right) = f(x)\\).`;

  const renderers = [new CodeBlockRenderer(), new LatexRenderer()];

  const messages: MessageType[] = [
    { id: '1', content: 'Hello, world!', author: 'User', timestamp: new Date().toISOString(), parentId: null },
    { id: '2', content: 'Hi there!', author: 'User2', timestamp: new Date().toISOString(), parentId: '1' },
    { id: '3', content: 'How are you?', author: 'User', timestamp: new Date().toISOString(), parentId: '1' },
    { id: '4', content: 'I am good, thanks!', author: 'User2', timestamp: new Date().toISOString(), parentId: '2' },
    { id: '5', content: 'What about you?', author: 'User2', timestamp: new Date().toISOString(), parentId: '2' },
    { id: '6', content: 'I am doing well!', author: 'User', timestamp: new Date().toISOString(), parentId: '3' },
    { id: '7', content: 'Great to hear!', author: 'User2', timestamp: new Date().toISOString(), parentId: '6' },
    { id: '8', content: 'User-specific message for demonstration.', author: 'User', timestamp: new Date().toISOString(), parentId: '7' },
  ];

  const conversations: MessageType[] = [
    { id: '1', content: 'Conversation 1', author: 'User1', timestamp: new Date().toISOString(), parentId: null },
    { id: '2', content: 'Conversation 2', author: 'User2', timestamp: new Date().toISOString(), parentId: null },
  ];

  return (
    <MessageConfigProvider config={{ buttons: { copy: 'enabled', share: 'enabled', delete: 'enabled', edit: 'enabled' }, theme: { primaryColor: '#007BFF', secondaryColor: '#6C757D', mode: 'light' } }}>
      <div>
        <h2>Message Component Demo</h2>
        <button onClick={() => setTab('messages')}>Messages</button>
        <button onClick={() => setTab('conversation')}>Conversation</button>
        <button onClick={() => setTab('conversationList')}>Conversation List</button>
        {tab === 'messages' && (
          <>
          <Message id="1" content={exampleMessage} author="John Doe" timestamp={new Date().toISOString()} renderers={renderers} buttons={{ copy: 'enabled', share: 'enabled', delete: 'enabled', edit: 'enabled' }} />
          <Message id="2" content="No buttons example" author="Jane Doe" timestamp={new Date().toISOString()} buttons={{ copy: 'disabled', share: 'disabled', delete: 'disabled', edit: 'disabled' }} />
          <button onClick={() => setStreamingContent(startStreaming())}>Start Streaming</button>
          {streamingContent && <Message id="3" content={streamingContent} author="Streamer" timestamp={new Date().toISOString()} renderers={renderers} buttons={{ copy: 'enabled', share: 'menu-ed', delete: 'menu-ed', edit: 'menu-ed' }} />}
        </>
      )}
      {tab === 'conversation' && <Conversation messages={messages} author="User" />}
      {tab === 'conversationList' && <ConversationList conversations={conversations} />}
    </div>
  </MessageConfigProvider>
  );
};
export default MessageDemo;
