// src/components/ConversationList.tsx
import React from 'react';
import { Message as MessageType } from '../types/Message';

interface ConversationListProps {
  conversations: MessageType[];
}

const ConversationList: React.FC<ConversationListProps> = ({ conversations }) => {
  return (
    <div>
      <h2>Conversations</h2>
      <ul>
        {conversations.map(conversation => (
          <li key={conversation.id}>
            {conversation.content} - {conversation.author}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ConversationList;