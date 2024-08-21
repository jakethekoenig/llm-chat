import * as React from 'react';
import { useState } from 'react';
import Message from './Message';
import { CodeBlockRenderer } from '../renderers/CodeBlockRenderer';

const MessageDemo = () => {
  const [streamingContent, setStreamingContent] = useState<AsyncIterable<string> | null>(null);

  const startStreaming = async function* (): AsyncIterable<string> {
    const text = 'Streaming content...';
    for (let i = 0; i < text.length; i++) {
      yield text[i];
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  const renderers = [new CodeBlockRenderer()];

  return (
    <div>
      <h2>Message Component Demo</h2>
      <Message content="```javascript\nconsole.log('Hello, World!');\n```" author="John Doe" timestamp={new Date().toISOString()} renderers={renderers} />
      <Message content="No buttons example" author="Jane Doe" timestamp={new Date().toISOString()} buttons={{}} />
      <button onClick={() => setStreamingContent(startStreaming())}>Start Streaming</button>
      {streamingContent && <Message content={streamingContent} author="Streamer" timestamp={new Date().toISOString()} renderers={renderers} />}
    </div>
  );
};

export default MessageDemo;