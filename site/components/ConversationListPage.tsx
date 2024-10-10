import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css'; // Correct the import path
import ConversationList from '../../chat-components/ConversationList';
import { Message as MessageType } from '../../chat-components/types/Message';

const ConversationListPage: React.FC = () => {
  const [conversations, setConversations] = useState<MessageType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchConversations = async () => {
      const response = await fetch('/api/conversations', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setConversations(data);
    };
    fetchConversations();
  }, []);

  const [initialMessage, setInitialMessage] = useState('');
  const [model, setModel] = useState('gpt-4o');
  const [temperature, setTemperature] = useState(0.0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      if (response.ok) {
        setConversations([...conversations, { id: data.conversationId, content: initialMessage }]);
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
        <input type="text" value={initialMessage} onChange={(e) => setInitialMessage(e.target.value)} placeholder="Initial Message" required />
        <input type="text" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model" required />
        <input type="number" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} placeholder="Temperature" required />
        <button type="submit" disabled={isLoading}>Create Conversation</button>
      </form>
      <ConversationList conversations={conversations} onConversationClick={handleConversationClick} />
    </div>
  );
};

export default ConversationListPage;