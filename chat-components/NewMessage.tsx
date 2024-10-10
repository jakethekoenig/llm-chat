// chat-components/NewMessage.tsx
import React, { useState } from 'react';

interface NewMessageProps {
  onSubmit: (message: string) => AsyncIterable<string>;
}

const NewMessage: React.FC<NewMessageProps> = ({ onSubmit }) => {
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string>('');

  const handleSubmit = async () => {
    if (inputValue.trim() === '') return;
    setLoading(true);
    setStreamingContent('');
    try {
      const iterator = onSubmit(inputValue);
      for await (const chunk of iterator) {
        setStreamingContent(prev => prev + chunk);
      }
    } catch (error) {
      console.error('Error submitting message:', error);
      setStreamingContent('Error submitting message.');
    } finally {
      setLoading(false);
      setInputValue('');
    }
  };

  return (
    <div style={{ marginTop: '16px' }}>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="Type your message..."
        style={{ width: '80%', padding: '8px' }}
        disabled={loading}
      />
      <button onClick={handleSubmit} disabled={loading} style={{ padding: '8px 16px', marginLeft: '8px' }}>
        {loading ? 'Sending...' : 'Send'}
      </button>
      {streamingContent && <div style={{ marginTop: '8px' }}>{streamingContent}</div>}
    </div>
  );
};

export default NewMessage;