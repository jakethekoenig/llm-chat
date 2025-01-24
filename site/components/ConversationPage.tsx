import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Conversation from '../../chat-components/Conversation';
import NewMessage from '../../chat-components/NewMessage';
import { Message as MessageType } from '../../chat-components/types/Message';
import { fetchWithAuth } from '../utils/api';
import '../App.css';

function snakeToCamelCase(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(snakeToCamelCase);
  }

  return Object.keys(obj).reduce((acc, key) => {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    acc[camelKey] = snakeToCamelCase(obj[key]);
    return acc;
  }, {});
}

const ConversationPage: React.FC = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (conversationId === 'new') {
      setIsLoading(false);
      return;
    }

    const fetchMessages = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetchWithAuth(`/api/conversations/${conversationId}/messages`);
        if (!response.ok) {
          throw new Error('Failed to fetch messages');
        }
        const data = await response.json();
        setMessages(snakeToCamelCase(data));
      } catch (error) {
        console.error('Error fetching messages:', error);
        setError('Failed to load messages. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchMessages();
  }, [conversationId]);

  const handleNewMessageSubmit = async (message: string, options: { model: string; temperature: number; getCompletion: boolean }) => {
    const mostRecentMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;
    
    try {
      setError(null);
      const response = await fetchWithAuth('/api/add_message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: message,
          conversationId: conversationId === 'new' ? null : conversationId,
          parentId: mostRecentMessageId,
          model: options.model,
          temperature: options.temperature,
          getCompletion: options.getCompletion
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();

      if (conversationId === 'new') {
        // If this is a new conversation, redirect to the newly created conversation
        navigate(`/conversations/${data.conversationId}`);
        return new ReadableStream();
      }

      setMessages(prevMessages => [...prevMessages, {
        id: data.id,
        content: message,
        author: 'User',
        timestamp: new Date().toISOString(),
        parentId: mostRecentMessageId
      }]);

      if (options.getCompletion) {
        // Return a stream for the completion
        const completionResponse = await fetchWithAuth('/api/get_completion_for_message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messageId: data.id,
            model: options.model,
            temperature: options.temperature
          })
        });

        if (!completionResponse.ok) {
          throw new Error('Failed to get completion');
        }

        return completionResponse.body;
      }

      return new ReadableStream();
    } catch (error) {
      console.error('Error submitting message:', error);
      setError('Failed to send message. Please try again.');
      throw error;
    }
  };

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <h2>{conversationId === 'new' ? 'New Conversation' : 'Conversation'}</h2>
        {conversationId === 'new' && (
          <button
            onClick={() => navigate('/conversations')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            ← Back to Conversations
          </button>
        )}
      </div>
      {error && <div className="error-message">{error}</div>}
      {isLoading ? (
        <div className="loading-message">Loading messages...</div>
      ) : conversationId === 'new' ? (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <NewMessage onSubmit={handleNewMessageSubmit} />
        </div>
      ) : (
        <Conversation
          messages={messages}
          onSubmit={(message) => handleNewMessageSubmit(message, { model: 'gpt-4', temperature: 0.7, getCompletion: true })}
          author="User"
        />
      )}
    </div>
  );
};

export default ConversationPage;
