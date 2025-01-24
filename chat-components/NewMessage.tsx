// chat-components/NewMessage.tsx
import React, { useState, useCallback } from 'react';
import { fetchStreamingCompletion } from '../site/utils/api';

interface NewMessageProps {
  conversationId: number;
  parentId?: number;
  onMessageComplete?: (messageId: number) => void;
}

const NewMessage: React.FC<NewMessageProps> = ({ conversationId, parentId, onMessageComplete }) => {
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (inputValue.trim() === '') return;
    
    setLoading(true);
    setStreamingContent('');
    setError(null);

    try {
      await fetchStreamingCompletion(
        parentId || -1,
        'gpt-4', // TODO: Make model configurable
        0.7, // TODO: Make temperature configurable
        {
          onChunk: ({ chunk }) => {
            setStreamingContent(prev => prev + chunk);
          },
          onDone: ({ messageId }) => {
            setLoading(false);
            onMessageComplete?.(messageId);
          },
          onError: (error) => {
            setError(error.message);
            setLoading(false);
          },
        }
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
      setLoading(false);
    } finally {
      setInputValue('');
    }
  }, [inputValue, parentId, onMessageComplete]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
          style={{
            width: '100%',
            padding: '8px',
            resize: 'vertical',
            minHeight: '40px',
            maxHeight: '200px',
          }}
          disabled={loading}
        />
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            padding: '8px 16px',
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? 'Sending...' : 'Send'}
        </button>
      </div>
      {streamingContent && (
        <div style={{ marginTop: '8px', whiteSpace: 'pre-wrap' }}>
          {streamingContent}
        </div>
      )}
      {error && (
        <div style={{ marginTop: '8px', color: 'red' }}>
          Error: {error}
        </div>
      )}
    </div>
  );
};

export default NewMessage;