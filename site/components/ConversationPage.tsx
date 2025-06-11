import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Box } from '@mui/material';
import Conversation from '../../chat-components/Conversation';
import { Message as MessageType } from '../../chat-components/types/Message';
import { apiGet, apiPost, ApiError } from '../utils/api';
import { useToast } from './ToastProvider';
import ErrorBoundary from './ErrorBoundary';
import { ConversationSkeleton, LoadingOverlay } from './SkeletonLoaders';
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showError, showSuccess } = useToast();

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiGet(`/api/conversations/${conversationId}/messages`);
        setMessages(snakeToCamelCase(data));
      } catch (error) {
        console.error('Error fetching messages:', error);
        const apiError = error as ApiError;
        
        if (apiError.status === 404) {
          setError('Conversation not found or you do not have access to it.');
          showError('Conversation not found');
        } else if (apiError.code === 'NETWORK_ERROR') {
          setError('Network error. Please check your connection and try again.');
          showError('Network error - please check your connection');
        } else {
          setError('Failed to load messages. Please try again later.');
          showError('Failed to load messages');
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    if (conversationId) {
      fetchMessages();
    }
  }, [conversationId, showError]);

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

      const newMessage = { 
        id: data.id, 
        content: message, 
        author: 'User', 
        timestamp: new Date().toISOString(), 
        parentId: mostRecentMessageId 
      };
      
      setMessages(prevMessages => [...prevMessages, newMessage]);
      showSuccess('Message sent successfully');
      
      // Yield the message content to support streaming interface
      yield message;
      
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

  return (
    <ErrorBoundary>
      <Box sx={{ p: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <LoadingOverlay 
          isLoading={isLoading} 
          skeleton={<ConversationSkeleton />}
        >
          <Conversation 
            messages={messages} 
            onSubmit={handleNewMessageSubmit} 
            author="User" 
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
