import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Conversation from '../../chat-components/Conversation';
import { Message as MessageType } from '../../chat-components/types/Message';
import { Conversation as ConversationType } from '../../chat-components/types/Conversation';
import { fetchWithAuth } from '../utils/api';
import '../App.css';
const ConversationPage: React.FC = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [conversationData, setConversationData] = useState<ConversationType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const [isUpdatingTitle, setIsUpdatingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchConversationData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch conversation metadata and messages in parallel
        const [conversationsResponse, messagesResponse] = await Promise.all([
          fetchWithAuth('/api/conversations'),
          fetchWithAuth(`/api/conversations/${conversationId}/messages`)
        ]);
        
        if (!conversationsResponse.ok || !messagesResponse.ok) {
          throw new Error('Failed to fetch conversation data');
        }
        
        const [conversations, messages] = await Promise.all([
          conversationsResponse.json(),
          messagesResponse.json()
        ]);
        
        // Find the current conversation
        const currentConversation = conversations.find((conv: ConversationType) => conv.id === conversationId);
        if (!currentConversation) {
          throw new Error('Conversation not found');
        }
        
        setConversationData(currentConversation);
        setMessages(messages);
      } catch (error) {
        console.error('Error fetching conversation data:', error);
        setError('Failed to load conversation. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchConversationData();
  }, [conversationId]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleEdit = () => {
    if (conversationData) {
      setIsEditingTitle(true);
      setEditingTitle(conversationData.title);
    }
  };

  const handleTitleSave = async () => {
    if (!conversationData || !conversationId || isUpdatingTitle) return;
    
    const trimmedTitle = editingTitle.trim();
    if (!trimmedTitle) {
      setIsEditingTitle(false);
      return;
    }

    setIsUpdatingTitle(true);
    try {
      const response = await fetchWithAuth(`/api/conversations/${conversationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: trimmedTitle })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update conversation title');
      }
      
      const updatedConversation = await response.json();
      setConversationData(prev => prev ? { ...prev, title: updatedConversation.title } : null);
      setIsEditingTitle(false);
    } catch (error) {
      console.error('Error updating conversation title:', error);
      setError('Failed to update conversation title. Please try again.');
    } finally {
      setIsUpdatingTitle(false);
    }
  };

  const handleTitleCancel = () => {
    setIsEditingTitle(false);
    setEditingTitle('');
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      handleTitleCancel();
    }
  };

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
      <div className="conversation-header">
        {isEditingTitle ? (
          <div className="title-edit-section">
            <input
              ref={titleInputRef}
              type="text"
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              onBlur={handleTitleSave}
              disabled={isUpdatingTitle}
              maxLength={200}
              className="conversation-title-input"
            />
            {isUpdatingTitle && <span className="updating-indicator">Saving...</span>}
          </div>
        ) : (
          <h2 
            className="conversation-title-header" 
            onClick={handleTitleEdit}
            title="Click to edit title"
          >
            {conversationData?.title || 'Loading...'}
          </h2>
        )}
      </div>
      {error && <div className="error-message">{error}</div>}
      {isLoading ? (
        <div className="loading-message">Loading conversation...</div>
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
