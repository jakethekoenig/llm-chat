import React, { useState } from 'react';
import Message from './Message';

const MessageDemo = () => {
  const [streamingContent, setStreamingContent] = useState<AsyncIterable<string> | null>(null);

  const startStreaming = async function* () {
    const text = 'Streaming content...';
    for (let i = 0; i < text.length; i++) {
      yield text[i];
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  return (
    <div>
      <h2>Message Component Demo</h2>
      <Message content="Hello, World!" author="John Doe" timestamp={new Date().toISOString()} />
      <Message content="No buttons example" author="Jane Doe" timestamp={new Date().toISOString()} buttons={{}} />
      <button onClick={() => setStreamingContent(startStreaming())}>Start Streaming</button>
      {streamingContent && <Message content={streamingContent} author="Streamer" timestamp={new Date().toISOString()} />}
    </div>
  );
};

export default MessageDemo;