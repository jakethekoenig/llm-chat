import React from 'react';
import Message from './Message';
import { Message as MessageType } from '../types/Message';

interface ConversationProps {
  messages: MessageType[];
}

const Conversation: React.FC<ConversationProps> = ({ messages }) => {
  const renderMessages = (messages: MessageType[], parentId: string | null = null): JSX.Element[] => {
    return messages
      .filter(message => message.parentId === parentId)
      .map(message => (
        <div key={message.id}>
          <Message {...message} />
          <div style={{ marginLeft: '20px' }}>
            {renderMessages(messages, message.id)}
          </div>
        </div>
      ));
  };

  return <div>{renderMessages(messages)}</div>;
};

export default Conversation;