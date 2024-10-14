import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css'; // Correct the import path
import ConversationList from '../../chat-components/ConversationList';
import { Message as MessageType } from '../../chat-components/types/Message';

// Component to display the list of conversations
const ConversationListPage: React.FC = () => {
  // State to store the list of conversations
  const [conversations, setConversations] = useState<MessageType[]>([]);
  // State to store any error messages
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const response = await fetch('/api/conversations', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const data = await response.json();
        setConversations(data.map((conversation: any) => ({
          id: conversation.id,
          content: conversation.content as string,
          author: conversation.author || 'Unknown'
        })));
      } catch (error) {
        console.error('Error fetching conversations:', error);
        setError('Failed to load conversations.');
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
      const response = await fetch('/api/create_conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ initialMessage, model, temperature })
      });
      const data = await response.json();
      if (response.ok && data.conversationId) {
        setConversations([...conversations, { id: data.conversationId, content: initialMessage as string }]);
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
      {error && <p className="error-message">{error}</p>}
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
    </div>
  );
}; // End of ConversationListPage

export default ConversationListPage;