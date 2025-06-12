import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css';
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
        // Add the new conversation to the list
        const newConversation: ConversationType = {
          id: data.conversationId,
          title: 'New Conversation',
          userId: '', // This will be filled by the server when we fetch conversations again
          messages: []
        };
        setConversations([...conversations, newConversation]);
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
          <ConversationList conversations={conversations} onConversationClick={handleConversationClick} />
        </>
      )}
    </div>
  );
}; // End of ConversationListPage

export default ConversationListPage;