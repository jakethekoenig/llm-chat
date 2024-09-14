// site/components/NewMessage.tsx
import React, { useState } from 'react';

interface NewMessageProps {
  onSubmit: (message: string) => AsyncIterable<string>;
}

const NewMessage: React.FC<NewMessageProps> = ({ onSubmit }) => {
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string>('');

  const handleSubmit = async () => {
    setLoading(true);
    setStreamingContent('');
    const iterator = onSubmit(inputValue);
    for await (const chunk of iterator) {
      setStreamingContent(prev => prev + chunk);
    }
    setLoading(false);
  };

  return (
    <div>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="Type your message..."
      />
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? 'Loading...' : 'Send'}
      </button>
      <div>{streamingContent}</div>
    </div>
  );
};

export default NewMessage;