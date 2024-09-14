import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Conversation from '../../chat-components/Conversation';
import { Message as MessageType } from '../../chat-components/types/Message';
import NewMessage from './NewMessage';

const ConversationPage: React.FC = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [messages, setMessages] = useState<MessageType[]>([]);

  useEffect(() => {
    const fetchMessages = async () => {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setMessages(data);
    };
    fetchMessages();
  }, [conversationId]);

  const handleNewMessageSubmit = async function* (message: string): AsyncIterable<string> {
    // Simulate async message processing
    const content = [
      `You typed: ${message}\n`,
      'Processing...\n',
      'Done!\n'
    ];
    for (const chunk of content) {
      yield chunk;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  return (
    <div>
      <h2>Conversation</h2>
      <Conversation messages={messages} />
    </div>
  );

export default ConversationPage;