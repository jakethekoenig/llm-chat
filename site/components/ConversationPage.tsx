import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Conversation from '../../chat-components/Conversation';
import { Message as MessageType } from '../../chat-components/types/Message';
import '../App.css';

const ConversationPage: React.FC = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [title, setTitle] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(0.7);

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

  const handleCreateConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    const response = await fetch('/create_conversation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ title, initialMessage, model, temperature })
    });
    const data = await response.json();
    if (response.ok) {
      setMessages([...messages, { id: data.initialMessageId, content: initialMessage }, { id: data.completionMessageId, content: 'Generated completion' }]);
    } else {
      console.error(data);
    }
  };

  return (
    <div>
      <h2>Conversation</h2>
      <form onSubmit={handleCreateConversation}>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" required />
        <input type="text" value={initialMessage} onChange={(e) => setInitialMessage(e.target.value)} placeholder="Initial Message" required />
        <input type="text" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model" required />
        <input type="number" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} placeholder="Temperature" required />
        <button type="submit">Create Conversation</button>
      </form>
      <Conversation messages={messages} />
    </div>
  );
};

export default ConversationPage;