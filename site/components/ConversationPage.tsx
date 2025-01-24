import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Conversation from '../../chat-components/Conversation';
import NewMessage from '../../chat-components/NewMessage';
import { Message as MessageType } from '../../chat-components/types/Message';
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
  const navigate = useNavigate();

  useEffect(() => {
    if (conversationId === 'new') return;

    const fetchMessages = async () => {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setMessages(snakeToCamelCase(data));
    };
    fetchMessages();
  }, [conversationId]);

  const handleNewMessageSubmit = async (message: string, options: { model: string; temperature: number; getCompletion: boolean }) => {
    const mostRecentMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;
    
    try {
      const response = await fetch('/api/add_message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
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
        const completionResponse = await fetch('/api/get_completion_for_message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            messageId: data.id,
            model: options.model,
            temperature: options.temperature
          })
        });

        return completionResponse.body;
      }

      return new ReadableStream();
    } catch (error) {
      console.error('Error submitting message:', error);
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
      {conversationId === 'new' ? (
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
