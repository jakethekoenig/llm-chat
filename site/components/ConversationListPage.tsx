import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css'; // Correct the import path
import ConversationList from '../../chat-components/ConversationList';
import { Message as MessageType } from '../../chat-components/types/Message';

const ConversationListPage: React.FC = () => {
  const [conversations, setConversations] = useState<MessageType[]>([]);
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

  const handleConversationClick = (conversationId: string) => {
    navigate(`/conversations/${conversationId}`);
  };

  return (
    <div>
      <h2>Your Conversations</h2>
      <ConversationList conversations={conversations} onConversationClick={handleConversationClick} />
    </div>
  );
};

export default ConversationListPage;