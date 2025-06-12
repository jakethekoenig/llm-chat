import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Conversation from '../../chat-components/Conversation';
import { Message as MessageType } from '../../chat-components/types/Message';
import { fetchWithAuth } from '../utils/api';
import '../App.css';
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
        setMessages(data);
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

      const newMessage = await response.json();
      // Add UI-specific fields
      const messageWithUiFields = {
        ...newMessage,
        author: 'User'
      };
      
      setMessages(prevMessages => [...prevMessages, messageWithUiFields]);
      
      // Yield the message content to support streaming interface
      yield message;
      
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
      yield 'Error: Failed to send message';
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    // Store original message for rollback
    const originalMessage = messages.find(msg => msg.id === messageId);
    if (!originalMessage) {
      throw new Error('Message not found');
    }

    // Optimistic update
    setMessages(prevMessages => 
      prevMessages.map(msg => 
        msg.id === messageId 
          ? { ...msg, content: newContent, timestamp: new Date().toISOString() }
          : msg
      )
    );

    try {
      const response = await fetchWithAuth(`/api/messages/${messageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: newContent })
      });
      
      if (!response.ok) {
        throw new Error('Failed to edit message');
      }

      const updatedMessage = await response.json();
      // Update with server response
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === messageId 
            ? { ...msg, content: updatedMessage.content, timestamp: updatedMessage.timestamp }
            : msg
        )
      );
      
    } catch (error) {
      console.error('Error editing message:', error);
      // Rollback optimistic update
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === messageId ? originalMessage : msg
        )
      );
      setError('Failed to edit message. Please try again.');
      throw error;
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    // Store original messages for rollback
    const originalMessages = [...messages];

    // Optimistic update - remove message
    setMessages(prevMessages => prevMessages.filter(msg => msg.id !== messageId));

    try {
      const response = await fetchWithAuth(`/api/messages/${messageId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete message');
      }

      // Message successfully deleted, no need to update state again
      
    } catch (error) {
      console.error('Error deleting message:', error);
      // Rollback optimistic update
      setMessages(originalMessages);
      setError('Failed to delete message. Please try again.');
      throw error;
    }
  };

  return (
    <div>
      <h2>Conversation</h2>
      {error && <div className="error-message">{error}</div>}
      {isLoading ? (
        <div className="loading-message">Loading messages...</div>
      ) : (
        <Conversation 
          messages={messages} 
          onSubmit={handleNewMessageSubmit} 
          author="User"
          onEdit={handleEditMessage}
          onDelete={handleDeleteMessage}
        />
      )}
    </div>
  );
}

export default ConversationPage;
