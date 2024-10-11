import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Conversation from '../../chat-components/Conversation';
import { Message as MessageType } from '../../chat-components/types/Message';
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

  useEffect(() => {
    const fetchMessages = async () => {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setMessages(snakeToCamelCase(data));
    };
    fetchMessages();
  }, [conversationId]);

  const handleNewMessageSubmit = async function* (message: string): AsyncIterable<string> {
    const mostRecentMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;
    const response = await fetch(`/api/add_message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ content: message, conversationId: conversationId, parentId: mostRecentMessageId })
    });
    const data = await response.json();
    setMessages(prevMessages => [...prevMessages, { id: data.id, content: message, author: 'User', timestamp: new Date().toISOString(), parentId: mostRecentMessageId }]);
    yield `You typed: ${message}\nProcessing...\nDone!\n`;
  };

  return (
    <div>
      <h2>Conversation</h2>
      <Conversation messages={messages} onSubmit={handleNewMessageSubmit} author="User" />
    </div>
  );
}

export default ConversationPage;
