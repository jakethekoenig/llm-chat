import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, TextField, Stack, Typography, Card, CardContent } from '@mui/material';
import '../App.css';
import ConversationList from '../../chat-components/ConversationList';
import { Conversation as ConversationType } from '../../chat-components/types/Conversation';
import { apiGet, apiPost, ApiError } from '../utils/api';
import { useToast } from './ToastProvider';
import ErrorBoundary from './ErrorBoundary';
import { ConversationListSkeleton, LoadingOverlay, FormSkeleton } from './SkeletonLoaders';

// Component to display the list of conversations
const ConversationListPage: React.FC = () => {
  // State to store the list of conversations
  const [conversations, setConversations] = useState<ConversationType[]>([]);
  // State to store any error messages
  const [error, setError] = useState<string | null>(null);
  // State to track loading status
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const navigate = useNavigate();
  const { showError, showSuccess } = useToast();

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        setIsLoadingConversations(true);
        setError(null);
        const data = await apiGet('/api/conversations');
        setConversations(data);
      } catch (error) {
        console.error('Error fetching conversations:', error);
        const apiError = error as ApiError;
        
        let errorMessage = 'Failed to load conversations.';
        
        if (apiError.code === 'NETWORK_ERROR') {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (apiError.status === 401 || apiError.status === 403) {
          errorMessage = 'Authentication failed. Please sign in again.';
        }
        
        setError(errorMessage);
        showError(errorMessage);
      } finally {
        setIsLoadingConversations(false);
      }
    };
    fetchConversations();
  }, [showError]);

  // State to store the initial message for a new conversation
  const [initialMessage, setInitialMessage] = useState('');
  // State to store the model type
  const [model, setModel] = useState('gpt-4o');
  // State to store the temperature setting
  const [temperature, setTemperature] = useState(0.0);
  const [isLoading, setIsLoading] = useState(false);

  const handleConversationClick = (conversationId: string) => {
    navigate(`/conversations/${conversationId}`);
  };

  const handleCreateConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await apiPost('/api/create_conversation', {
        initialMessage,
        model,
        temperature
      });
      
      if (data.conversationId) {
        // Add the new conversation to the list
        const newConversation: ConversationType = {
          id: data.conversationId,
          title: 'New Conversation',
          userId: '', // This will be filled by the server when we fetch conversations again
          messages: []
        };
        setConversations([...conversations, newConversation]);
        showSuccess('Conversation created successfully');
        navigate(`/conversations/${data.conversationId}`);
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      const apiError = error as ApiError;
      
      let errorMessage = 'An unexpected error occurred while creating the conversation.';
      
      if (apiError.code === 'NETWORK_ERROR') {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (apiError.code === 'VALIDATION_ERROR') {
        errorMessage = 'Please check your input and try again.';
      } else if (apiError.status === 401 || apiError.status === 403) {
        errorMessage = 'Authentication failed. Please sign in again.';
      } else if (apiError.message) {
        errorMessage = apiError.message;
      }
      
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setIsLoading(false);
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
          isLoading={isLoadingConversations} 
          skeleton={<ConversationListSkeleton />}
        >
          <>
            <Typography variant="h4" component="h2" gutterBottom>
              Your Conversations
            </Typography>
            
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Start New Conversation
                </Typography>
                
                <form onSubmit={handleCreateConversation}>
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      label="Initial Message"
                      value={initialMessage}
                      onChange={(e) => setInitialMessage(e.target.value)}
                      placeholder="Type your message here..."
                      required
                      multiline
                      rows={3}
                      variant="outlined"
                    />
                    
                    <TextField
                      fullWidth
                      label="Model"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="e.g., gpt-4o"
                      required
                      variant="outlined"
                    />
                    
                    <TextField
                      fullWidth
                      label="Temperature"
                      type="number"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      placeholder="0.0 - 2.0"
                      required
                      variant="outlined"
                      inputProps={{
                        min: 0,
                        max: 2,
                        step: 0.1
                      }}
                    />
                    
                    <Button 
                      type="submit" 
                      variant="contained" 
                      disabled={isLoading}
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      {isLoading ? 'Creating...' : 'Create Conversation'}
                    </Button>
                  </Stack>
                </form>
              </CardContent>
            </Card>
            
            <ConversationList 
              conversations={conversations} 
              onConversationClick={handleConversationClick} 
            />
          </>
        </LoadingOverlay>
      </Box>
    </ErrorBoundary>
  );
}; // End of ConversationListPage

export default ConversationListPage;