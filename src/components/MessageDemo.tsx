import * as React from 'react';
import { useState } from 'react';
import Message from './Message';
import Conversation from './Conversation';
import { CodeBlockRenderer } from '../renderers/CodeBlockRenderer';
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

  const content = "Here is some text before the code block.\n```javascript\nconsole.log('Hello, World!');\nconsole.log('This is a second line.');\n```\nHere is some text between the code blocks.\n```python\nprint('Hello, World!')\nprint('This is a second line.')\n```\nHere is some text after the code block.";

  const renderers = [new CodeBlockRenderer()];

  const messages: MessageType[] = [
    { id: '1', content: 'Hello, world!', author: 'User', timestamp: new Date().toISOString(), parentId: null },
    { id: '2', content: 'Hi there!', author: 'User2', timestamp: new Date().toISOString(), parentId: '1' },
    { id: '3', content: 'How are you?', author: 'User', timestamp: new Date().toISOString(), parentId: '1' },
    { id: '4', content: 'I am good, thanks!', author: 'User2', timestamp: new Date().toISOString(), parentId: '2' },
    { id: '5', content: 'What about you?', author: 'User2', timestamp: new Date().toISOString(), parentId: '2' },
    { id: '6', content: 'I am doing well!', author: 'User', timestamp: new Date().toISOString(), parentId: '3' },
  ];

  return (
    <div>
      <h2>Message Component Demo</h2>
      <button onClick={() => setTab('messages')}>Messages</button>
      <button onClick={() => setTab('conversation')}>Conversation</button>
      {tab === 'messages' && (
        <>
          <Message content={content} author="John Doe" timestamp={new Date().toISOString()} renderers={renderers} />
          <Message content="No buttons example" author="Jane Doe" timestamp={new Date().toISOString()} buttons={{}} />
          <button onClick={() => setStreamingContent(startStreaming())}>Start Streaming</button>
          {streamingContent && <Message content={streamingContent} author="Streamer" timestamp={new Date().toISOString()} renderers={renderers} />}
        </>
      )}
      {tab === 'conversation' && <Conversation messages={messages} />}
    </div>
  );
};

export default MessageDemo;