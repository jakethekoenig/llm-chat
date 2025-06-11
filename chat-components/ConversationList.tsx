// chat-components/ConversationList.tsx
import React from 'react';
import { Conversation as ConversationType } from './types/Conversation';

interface ConversationListProps {
  conversations: ConversationType[];
  onConversationClick: (id: string) => void;
}

const ConversationList: React.FC<ConversationListProps> = ({ conversations, onConversationClick }) => {
  return (
    <div className="conversation-list">
      <h2>Conversations</h2>
      {conversations.length > 0 ? (
        <ul>
          {conversations.map(conversation => (
            <li key={conversation.id} onClick={() => onConversationClick(conversation.id)}>
              <div className="conversation-item">
                <span className="conversation-title">{conversation.title}</span>
                <span className="conversation-meta">
                  {conversation.messages && conversation.messages.length > 0 
                    ? `${conversation.messages.length} messages`
                    : 'No messages'
                  }
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p>No conversations available.</p>
      )}
    </div>
  );
};

export default ConversationList;