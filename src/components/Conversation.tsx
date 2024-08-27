import React, { useState, useEffect } from 'react';
import Message from './Message';
import { Message as MessageType } from '../types/Message';

interface ConversationProps {
  messages: MessageType[];
}

const Conversation: React.FC<ConversationProps> = ({ messages }) => {
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [childIndex, setChildIndex] = useState<{ [key: string]: number }>({});

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
        setChildIndex(prev => ({ ...prev, [selectedMessageId]: 0 }));
      }
    }
  }, [selectedMessageId, messages]);

  const handleSelectMessage = (messageId: string) => {
    setSelectedMessageId(messageId);
    setChildIndex({});
  };

  const renderMessages = (messages: MessageType[], parentId: string | null = null): JSX.Element[] => {
    const filteredMessages = messages.filter(message => message.parentId === parentId);
    if (filteredMessages.length === 0) return [];

    const currentIndex = childIndex[parentId || 'root'] || 0;
    const currentMessage = filteredMessages[currentIndex];
    const hasSiblings = filteredMessages.length > 1;

    return [
      <div key={currentMessage.id}>
        <Message
          {...currentMessage}
          onClick={() => handleSelectMessage(currentMessage.id)}
          onPrev={() => setChildIndex(prev => ({ ...prev, [parentId || 'root']: Math.max(0, currentIndex - 1) }))}
          onNext={() => setChildIndex(prev => ({ ...prev, [parentId || 'root']: Math.min(filteredMessages.length - 1, currentIndex + 1) }))}
          hasSiblings={hasSiblings}
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