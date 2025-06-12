import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Conversation from '../../chat-components/Conversation';
import { Message as MessageType } from '../../chat-components/types/Message';
import { fetchWithAuth } from '../utils/api';
import '../App.css';
const ConversationPage: React.FC = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetchWithAuth(`/api/conversations/${conversationId}/messages`);
        if (!response.ok) {
          throw new Error('Failed to fetch messages');
        }
        const data = await response.json();
        setMessages(data);
      } catch (error) {
        console.error('Error fetching messages:', error);
        setError('Failed to load messages. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchMessages();
  }, [conversationId]);

  const handleNewMessageSubmit = async function* (message: string) {
    try {
      setError(null);
      const mostRecentMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;
      
      // First, send the user message
      const response = await fetchWithAuth(`/api/add_message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: message, conversationId: conversationId, parentId: mostRecentMessageId })
      });
      
      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const newMessage = await response.json();
      const messageWithUiFields = {
        ...newMessage,
        author: 'User'
      };
      
      setMessages(prevMessages => [...prevMessages, messageWithUiFields]);
      yield `You: ${message}\n\n`;
      
      // Now stream the AI response
      const streamResponse = await fetchWithAuth(`/api/get_completion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          parentId: newMessage.id, 
          model: 'gpt-4o',
          temperature: 0.7 
        })
      });

      if (!streamResponse.ok) {
        throw new Error('Failed to get AI response');
      }

      const reader = streamResponse.body?.getReader();
      const decoder = new TextDecoder();
      let aiMessageId: string | null = null;
      let fullAiContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.error) {
                  throw new Error(data.error);
                }
                
                if (data.messageId && !aiMessageId) {
                  aiMessageId = data.messageId;
                  // Add empty AI message to messages list
                  const aiMessage = {
                    id: data.messageId,
                    content: '',
                    author: 'AI',
                    timestamp: new Date().toISOString(),
                    parentId: newMessage.id
                  };
                  setMessages(prevMessages => [...prevMessages, aiMessage]);
                }
                
                if (data.chunk && aiMessageId) {
                  fullAiContent += data.chunk;
                  // Update the AI message content
                  setMessages(prevMessages => 
                    prevMessages.map(msg => 
                      msg.id === aiMessageId 
                        ? { ...msg, content: fullAiContent }
                        : msg
                    )
                  );
                  yield data.chunk;
                }
                
                if (data.isComplete) {
                  break;
                }
              } catch (parseError) {
                console.error('Error parsing stream data:', parseError);
              }
            }
          }
        }
      }
      
    } catch (error) {
      console.error('Error in conversation:', error);
      setError('Failed to process message. Please try again.');
      yield 'Error: Failed to process message';
    }
  };

  return (
    <div>
      <h2>Conversation</h2>
      {error && <div className="error-message">{error}</div>}
      {isLoading ? (
        <div className="loading-message">Loading messages...</div>
      ) : (
        <Conversation messages={messages} onSubmit={handleNewMessageSubmit} author="User" />
      )}
    </div>
  );
}

export default ConversationPage;
