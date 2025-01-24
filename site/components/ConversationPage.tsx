import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Conversation from '../../chat-components/Conversation';
import { Message as MessageType } from '../../chat-components/types/Message';
import { fetchWithAuth } from '../utils/api';
import '../App.css';

// TODO: Refactor interface so this co-ercion isn't necessary.
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

  useEffect(() => {
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

  const handleNewMessageSubmit = async function* (message: string) {
    try {
      setError(null);
      const mostRecentMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;
      const response = await fetchWithAuth(`/api/add_message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: message, conversationId: conversationId, parentId: mostRecentMessageId })
      });
      
      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      const newMessage = { 
        id: data.id, 
        content: message, 
        author: 'User', 
        timestamp: new Date().toISOString(), 
        parentId: mostRecentMessageId 
      };
      
      setMessages(prevMessages => [...prevMessages, newMessage]);
      
      // Yield the message content to support streaming interface
      yield message;
      
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
      yield 'Error: Failed to send message';
    }
  };

  return (
    <div>
      <h2>Conversation</h2>
      {error && <div className="error-message">{error}</div>}
      {isLoading ? (
        <div className="loading-message">Loading messages...</div>
      ) : (
        <Conversation messages={messages} onSubmit={handleNewMessageSubmit} author="User" />
      )}
    </div>
  );
}

export default ConversationPage;
