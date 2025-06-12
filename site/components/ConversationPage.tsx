import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Box } from '@mui/material';
import Conversation from '../../chat-components/Conversation';
import { Message as MessageType } from '../../chat-components/types/Message';
import { Conversation as ConversationType } from '../../chat-components/types/Conversation';
import { apiGet, apiPost, apiPut, apiDelete, ApiError } from '../utils/api';
import { useToast } from './ToastProvider';
import ErrorBoundary from './ErrorBoundary';
import { ConversationSkeleton, LoadingOverlay } from './SkeletonLoaders';
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showError, showSuccess } = useToast();

  useEffect(() => {
    const fetchConversationData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch conversation metadata and messages in parallel
        const [conversations, messages] = await Promise.all([
          apiGet('/api/conversations'),
          apiGet(`/api/conversations/${conversationId}/messages`)
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
        const apiError = error as ApiError;
        
        if (apiError.status === 404) {
          setError('Conversation not found or you do not have access to it.');
          showError('Conversation not found');
        } else if (apiError.code === 'NETWORK_ERROR') {
          setError('Network error. Please check your connection and try again.');
          showError('Network error - please check your connection');
        } else {
          setError('Failed to load conversation. Please try again later.');
          showError('Failed to load conversation');
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    if (conversationId) {
      fetchConversationData();
    }
  }, [conversationId, showError]);

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
    setIsSubmitting(true);
    setError(null);
    
    try {
      const mostRecentMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;
      
      const data = await apiPost('/api/add_message', {
        content: message,
        conversationId: conversationId,
        parentId: mostRecentMessageId
      });

      // Add UI-specific fields to the returned message
      const messageWithUiFields = {
        ...data,
        author: 'User'
      };
      
      setMessages(prevMessages => [...prevMessages, messageWithUiFields]);
      showSuccess('Message sent successfully');
      yield `You: ${message}\n\n`;
      
      // Now stream the AI response
      const streamResponse = await fetchWithAuth(`/api/get_completion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          parentId: data.id, 
          model: 'gpt-4o',
          temperature: 0.7 
        })
      });

      if (!streamResponse.ok) {
        throw new Error('Failed to get AI response');
      }

      const reader = streamResponse.body?.getReader();
      const decoder = new TextDecoder();
      let aiMessageId: string | null = null;
      let fullAiContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.error) {
                  throw new Error(data.error);
                }
                
                if (data.messageId && !aiMessageId) {
                  aiMessageId = data.messageId;
                  // Add empty AI message to messages list
                  const aiMessage = {
                    id: data.messageId,
                    content: '',
                    author: 'AI',
                    timestamp: new Date().toISOString(),
                    parentId: data.id
                  };
                  setMessages(prevMessages => [...prevMessages, aiMessage]);
                }
                
                if (data.chunk && aiMessageId) {
                  fullAiContent += data.chunk;
                  // Update the AI message content
                  setMessages(prevMessages => 
                    prevMessages.map(msg => 
                      msg.id === aiMessageId 
                        ? { ...msg, content: fullAiContent }
                        : msg
                    )
                  );
                  yield data.chunk;
                }
                
                if (data.isComplete) {
                  break;
                }
              } catch (parseError) {
                console.error('Error parsing stream data:', parseError);
              }
            }
          }
        }
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      const apiError = error as ApiError;
      
      let errorMessage = 'Failed to send message. Please try again.';
      
      if (apiError.code === 'NETWORK_ERROR') {
        errorMessage = 'Network error. Please check your connection.';
      } else if (apiError.code === 'VALIDATION_ERROR') {
        errorMessage = 'Message validation failed. Please check your input.';
      } else if (apiError.status === 401 || apiError.status === 403) {
        errorMessage = 'Authentication failed. Please sign in again.';
      }
      
      setError(errorMessage);
      showError(errorMessage);
      yield `Error: ${errorMessage}`;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    // Store original message for rollback
    const originalMessage = messages.find(msg => msg.id === messageId);
    if (!originalMessage) {
      const errorMsg = 'Message not found';
      showError(errorMsg);
      throw new Error(errorMsg);
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
      const updatedMessage = await apiPut(`/api/messages/${messageId}`, { 
        content: newContent 
      });
      
      // Update with server response
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === messageId 
            ? { ...msg, content: updatedMessage.content, timestamp: updatedMessage.timestamp }
            : msg
        )
      );
      
      showSuccess('Message updated successfully');
      
    } catch (error) {
      console.error('Error editing message:', error);
      const apiError = error as ApiError;
      
      // Rollback optimistic update
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === messageId ? originalMessage : msg
        )
      );
      
      let errorMessage = 'Failed to edit message. Please try again.';
      if (apiError.code === 'NETWORK_ERROR') {
        errorMessage = 'Network error. Please check your connection.';
      } else if (apiError.status === 401 || apiError.status === 403) {
        errorMessage = 'Authentication failed. Please sign in again.';
      } else if (apiError.status === 404) {
        errorMessage = 'Message not found.';
      }
      
      setError(errorMessage);
      showError(errorMessage);
      throw error;
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    // Store original messages for rollback
    const originalMessages = [...messages];

    // Optimistic update - remove message
    setMessages(prevMessages => prevMessages.filter(msg => msg.id !== messageId));

    try {
      await apiDelete(`/api/messages/${messageId}`);
      showSuccess('Message deleted successfully');
      
    } catch (error) {
      console.error('Error deleting message:', error);
      const apiError = error as ApiError;
      
      // Rollback optimistic update
      setMessages(originalMessages);
      
      let errorMessage = 'Failed to delete message. Please try again.';
      if (apiError.code === 'NETWORK_ERROR') {
        errorMessage = 'Network error. Please check your connection.';
      } else if (apiError.status === 401 || apiError.status === 403) {
        errorMessage = 'Authentication failed. Please sign in again.';
      } else if (apiError.status === 404) {
        errorMessage = 'Message not found.';
      }
      
      setError(errorMessage);
      showError(errorMessage);
      throw error;
    }
  };

  return (
    <ErrorBoundary>
      <Box sx={{ p: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
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
        
        <LoadingOverlay 
          isLoading={isLoading} 
          skeleton={<ConversationSkeleton />}
        >
          <Conversation 
            messages={messages} 
            onSubmit={handleNewMessageSubmit} 
            author="User"
            onEdit={handleEditMessage}
            onDelete={handleDeleteMessage}
          />
        </LoadingOverlay>
        
        {isSubmitting && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Sending message...
          </Alert>
        )}
      </Box>
    </ErrorBoundary>
  );
}

export default ConversationPage;
