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

    // Submit the new message
    const addResponse = await fetch(`/api/add_message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ content: message, conversationId: conversationId, parentId: mostRecentMessageId })
    });
    const addData = await addResponse.json();
    const newMessage = { id: addData.id, content: message, author: 'User', timestamp: new Date().toISOString(), parentId: mostRecentMessageId };
    setMessages(prevMessages => [...prevMessages, newMessage]);

    // Connect to the streaming endpoint
    const streamResponse = await fetch(`/api/get_completion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ model: 'gpt-4', parentId: addData.id, temperature: 0.7 })
    });

    if (!streamResponse.body) {
      throw new Error('No stream available');
    }

    const reader = streamResponse.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let done = false;
    let fullContent = '';

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        setMessages(prevMessages => {
          const updatedMessages = [...prevMessages];
          const lastMessage = updatedMessages[updatedMessages.length - 1];
          if (lastMessage.id === addData.id) {
            return [...updatedMessages.slice(0, -1), { ...lastMessage, content: lastMessage.content + chunk }];
          }
          return updatedMessages;
        });
      }
    }
  };

  return (
    <div>
      <h2>Conversation</h2>
      <Conversation messages={messages} onSubmit={handleNewMessageSubmit} author="User" />
    </div>
  );
}

export default ConversationPage;
