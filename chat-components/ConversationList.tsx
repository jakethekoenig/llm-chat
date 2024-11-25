// chat-components/ConversationList.tsx
import React from 'react';
import { Message as MessageType } from './types/Message';

interface ConversationListProps {
  conversations: MessageType[];
  onConversationClick: (id: string) => void;
}

const ConversationList: React.FC<ConversationListProps> = ({ conversations, onConversationClick }) => {
  return (
    <div>
      <h2>Conversations</h2>
      <ul>
        {conversations.map(conversation => (
          <li key={conversation.id} onClick={() => onConversationClick(conversation.id)}>
            <>
              {conversation.content} - {conversation.author}
            </>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ConversationList;