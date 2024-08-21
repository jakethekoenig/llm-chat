import React, { useState } from 'react';
import Message from './Message';
import { Message as MessageType } from '../types/Message';
import { Button } from '@mui/material';

interface ConversationProps {
  messages: MessageType[];
}

const Conversation: React.FC<ConversationProps> = ({ messages }) => {
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [childIndex, setChildIndex] = useState<{ [key: string]: number }>({});

  const handleSelectMessage = (messageId: string) => {
    setSelectedMessageId(messageId);
    setChildIndex({});
  };

  const renderMessages = (messages: MessageType[], parentId: string | null = null): JSX.Element[] => {
    const filteredMessages = messages.filter(message => message.parentId === parentId);
    if (filteredMessages.length === 0) return [];

    const currentIndex = childIndex[parentId || 'root'] || 0;
    const currentMessage = filteredMessages[currentIndex];

    return [
      <div key={currentMessage.id}>
        <Message {...currentMessage} onClick={() => handleSelectMessage(currentMessage.id)} />
        {selectedMessageId === currentMessage.id && (
          <div>
            {renderMessages(messages, currentMessage.id)}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <Button
            onClick={() => setChildIndex(prev => ({ ...prev, [parentId || 'root']: (currentIndex - 1 + filteredMessages.length) % filteredMessages.length }))}
            disabled={filteredMessages.length <= 1}
          >
            &lt;
          </Button>
          <Button
            onClick={() => setChildIndex(prev => ({ ...prev, [parentId || 'root']: (currentIndex + 1) % filteredMessages.length }))}
            disabled={filteredMessages.length <= 1}
          >
            &gt;
          </Button>
        </div>
      </div>
    ];
  };

  return <div>{renderMessages(messages)}</div>;
};

export default Conversation;