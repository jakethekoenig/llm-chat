import * as React from 'react';
import { useState } from 'react';
import Message from './Message';
import Conversation from './Conversation';
import { CodeBlockRenderer } from '../renderers/CodeBlockRenderer';
import { LatexRenderer } from '../renderers/LatexRenderer';
import { MessageConfigProvider } from './MessageConfigContext';
import { Message as MessageType } from '../types/Message';

const MessageDemo = () => {
  const [streamingContent, setStreamingContent] = useState<AsyncIterable<string> | null>(null);
  const [tab, setTab] = useState<'messages' | 'conversation'>('messages');
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
      'Here is some text after the code block.'
    ];
    for (const chunk of content) {
      yield chunk;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };

  const exampleMessage = `Here's an example with inline math \\(E=mc^2\\), display math $$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$, and bracketed math \\[\\sum_{n=1}^\\infty \\frac{1}{n^2} = \\frac{\\pi^2}{6}\\].`;

  const renderers = [new CodeBlockRenderer(), new LatexRenderer()];

  const messages: MessageType[] = [
    { id: '1', content: 'Hello, world!', author: 'User', timestamp: new Date().toISOString(), parentId: null },
    { id: '2', content: 'Hi there!', author: 'User2', timestamp: new Date().toISOString(), parentId: '1' },
    { id: '3', content: 'How are you?', author: 'User', timestamp: new Date().toISOString(), parentId: '2' },
  ];

  return (
    <MessageConfigProvider config={{ buttons: { copy: true, share: true, delete: true, edit: true }, theme: { primaryColor: '#007BFF', secondaryColor: '#6C757D', mode: 'light' } }}>
      <div>
        <h2>Message Component Demo</h2>
        <button onClick={() => setTab('messages')}>Messages</button>
        <button onClick={() => setTab('conversation')}>Conversation</button>
        {tab === 'messages' && (
          <>
          <Message content={exampleMessage} author="John Doe" timestamp={new Date().toISOString()} renderers={renderers} buttons={{ copy: true, share: true, delete: true, edit: true }} />
          <Message content="No buttons example" author="Jane Doe" timestamp={new Date().toISOString()} buttons={{ copy: false, share: false, delete: false, edit: false }} />
          <button onClick={() => setStreamingContent(startStreaming())}>Start Streaming</button>
          {streamingContent && <Message content={streamingContent} author="Streamer" timestamp={new Date().toISOString()} renderers={renderers} buttons={{ copy: true, share: true, delete: true, edit: true }} />}
        </>
      )}
      {tab === 'conversation' && <Conversation messages={messages} />}
    </div>
  </MessageConfigProvider>
  );
};

export default MessageDemo;
