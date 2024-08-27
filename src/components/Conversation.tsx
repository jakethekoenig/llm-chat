import React, { useState, useEffect } from 'react';
import Message from './Message';
import { Message as MessageType } from '../types/Message';
import { Button } from '@mui/material';

interface ConversationProps {
  messages: MessageType[];
}

const Conversation: React.FC<ConversationProps> = ({ messages }) => {
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [childIndex, setChildIndex] = useState<{ [key: string]: number }>({});
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  useEffect(() => {
    const rootChildren = messages.filter(message => message.parentId === null);
    if (rootChildren.length > 0) {
      setSelectedMessageId(rootChildren[0].id);
    }
  }, [messages]);

  useEffect(() => {
    if (selectedMessageId) {
      const children = messages.filter(message => message.parentId === selectedMessageId);
      if (children.length > 0) {
        setSelectedChildId(children[0].id);
        setChildIndex(prev => ({ ...prev, [selectedMessageId]: 0 }));
      }
    }
  }, [selectedMessageId, messages]);

  useEffect(() => {
    if (selectedChildId) {
      const children = messages.filter(message => message.parentId === selectedChildId);
      if (children.length > 0) {
        setChildIndex(prev => ({ ...prev, [selectedChildId]: 0 }));
      }
    }
  }, [selectedChildId, messages]);

  const handleSelectMessage = (messageId: string) => {
    setSelectedMessageId(messageId);
    setChildIndex({});
    setSelectedChildId(null);
  };

  const renderMessages = (messages: MessageType[], parentId: string | null = null): JSX.Element[] => {
    const filteredMessages = messages.filter(message => message.parentId === parentId);
    if (filteredMessages.length === 0) return [];

    const currentIndex = childIndex[parentId || 'root'] || 0;
    const currentMessage = filteredMessages[currentIndex];
    return [
      <div key={currentMessage.id}>
        <Message
          {...currentMessage}
          onClick={() => handleSelectMessage(currentMessage.id)}
          onPrev={() => setChildIndex(prev => ({ ...prev, [parentId || 'root']: Math.max(0, currentIndex - 1) }))}
          onNext={() => setChildIndex(prev => ({ ...prev, [parentId || 'root']: Math.min(filteredMessages.length - 1, currentIndex + 1) }))}
        />
        {selectedMessageId === currentMessage.id && (
          <div>
            {renderMessages(messages, currentMessage.id)}
          </div>
        )}
      </div>
    ];
  };
  return <div>{renderMessages(messages)}</div>;
};
export default Conversation;