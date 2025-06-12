import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css';
import './ConversationListPage.css';
import ConversationList from '../../chat-components/ConversationList';
import { Conversation as ConversationType } from '../../chat-components/types/Conversation';
import { fetchWithAuth } from '../utils/api';

// Component to display the list of conversations
const ConversationListPage: React.FC = () => {
  // State to store the list of conversations
  const [conversations, setConversations] = useState<ConversationType[]>([]);
  // State to store any error messages
  const [error, setError] = useState<string | null>(null);
  // State to track loading status
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        setIsLoadingConversations(true);
        const response = await fetchWithAuth('/api/conversations');
        if (!response.ok) {
          throw new Error('Failed to fetch conversations');
        }
        const data = await response.json();
        setConversations(data);
      } catch (error) {
        console.error('Error fetching conversations:', error);
        setError('Failed to load conversations.');
      } finally {
        setIsLoadingConversations(false);
      }
    };
    fetchConversations();
  }, []);

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

  const handleTitleUpdate = async (conversationId: string, newTitle: string): Promise<boolean> => {
    try {
      const response = await fetchWithAuth(`/api/conversations/${conversationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: newTitle })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update conversation title');
      }
      
      const updatedConversation = await response.json();
      
      // Update the local conversations state
      setConversations(prev => 
        prev.map(conv => 
          conv.id === conversationId 
            ? { ...conv, title: updatedConversation.title }
            : conv
        )
      );
      
      return true;
    } catch (error) {
      console.error('Error updating conversation title:', error);
      setError('Failed to update conversation title. Please try again.');
      return false;
    }
  };

  const handleCreateConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null); // Clear previous errors
    try {
      const response = await fetchWithAuth('/api/create_conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ initialMessage, model, temperature })
      });
      const data = await response.json();
      if (response.ok && data.conversationId) {
        // Navigate to the new conversation - we'll refetch conversations when user returns to list
        // This avoids the need to guess the generated title here
        navigate(`/conversations/${data.conversationId}`);
      } else {
        setError(`Error creating conversation: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(error);
      setError('An unexpected error occurred while creating the conversation.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2>Your Conversations</h2>
      {error && <div className="error-message">{error}</div>}
      {isLoadingConversations ? (
        <div className="loading-message">Loading conversations...</div>
      ) : (
        <>
          <form onSubmit={handleCreateConversation}>
        {isLoading && <p>Creating conversation...</p>}
        <input
          type="text"
          value={initialMessage}
          onChange={(e) => setInitialMessage(e.target.value)}
          placeholder="Initial Message"
          required
          className="form-input"
        />
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="Model"
          required
          className="form-input"
        />
        <input
          type="number"
          value={temperature}
          onChange={(e) => setTemperature(parseFloat(e.target.value))}
          placeholder="Temperature"
          required
          className="form-input"
        />
            <button type="submit" disabled={isLoading}>Create Conversation</button>
          </form>
          <ConversationList 
            conversations={conversations} 
            onConversationClick={handleConversationClick}
            onTitleUpdate={handleTitleUpdate}
          />
        </>
      )}
    </div>
  );
}; // End of ConversationListPage

export default ConversationListPage;