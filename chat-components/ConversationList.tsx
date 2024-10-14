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
            <div className="conversation-item">
              <span className="conversation-title">{typeof conversation.content === 'string' ? conversation.content : 'Loading...'}</span>
              <span className="conversation-author">{conversation.author}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ConversationList;