import * as React from 'react';
import { useState } from 'react';
import Message from './Message';
import { CodeBlockRenderer } from '../renderers/CodeBlockRenderer';
import { LatexRenderer } from '../renderers/LatexRenderer';

const MessageDemo = () => {
  const [streamingContent, setStreamingContent] = useState<AsyncIterable<string> | null>(null);

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

  const exampleMessage = `Here's an example with inline math \\(E=mc^2\\), display math $$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$, and bracketed math \\[\\sum_{n=1}^\\infty \\frac{1}{n^2} = \\frac{\\pi^2}{6}\\].`;

  const renderers = [new CodeBlockRenderer(), new LatexRenderer()];

  return (
    <div>
      <h2>Message Component Demo</h2>
      <Message content={content} author="John Doe" timestamp={new Date().toISOString()} renderers={renderers} />
      <Message content={exampleMessage} author="Jane Doe" timestamp={new Date().toISOString()} renderers={renderers} />
      <button onClick={() => setStreamingContent(startStreaming())}>Start Streaming</button>
      {streamingContent && <Message content={streamingContent} author="Streamer" timestamp={new Date().toISOString()} renderers={renderers} />}
    </div>
  );
};

export default MessageDemo;