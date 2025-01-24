import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css';
import ConversationList from '../../chat-components/ConversationList';
import { Message as MessageType } from '../../chat-components/types/Message';

const ConversationListPage: React.FC = () => {
  const [conversations, setConversations] = useState<MessageType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        setIsLoadingConversations(true);
        const response = await fetch('/api/conversations', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        if (!response.ok) {
          throw new Error('Failed to fetch conversations');
        }
        const data = await response.json();
        setConversations(data.map((conversation: any) => ({
          id: conversation.id,
          content: conversation.title || conversation.content || 'Untitled Conversation',
          author: conversation.author || 'Unknown'
        })));
      } catch (error) {
        console.error('Error fetching conversations:', error);
        setError('Failed to load conversations.');
      } finally {
        setIsLoadingConversations(false);
      }
    };
    fetchConversations();
  }, []);

  const handleConversationClick = (conversationId: string) => {
    navigate(`/conversations/${conversationId}`);
  };

  const handleNewConversation = () => {
    navigate('/conversations/new');
  };

  return (
    <div>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h2>Your Conversations</h2>
        <button
          onClick={handleNewConversation}
          style={{
            padding: '8px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          New Conversation
        </button>
      </div>
      {error && <p className="error-message">{error}</p>}
      {isLoadingConversations ? (
        <p>Loading conversations...</p>
      ) : (
        <ConversationList conversations={conversations} onConversationClick={handleConversationClick} />
      )}
    </div>
  );
};

export default ConversationListPage;