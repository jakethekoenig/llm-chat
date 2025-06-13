// chat-components/ConversationList.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Conversation as ConversationType } from './types/Conversation';

interface ConversationListProps {
  conversations: ConversationType[];
  onConversationClick: (id: string) => void;
  onTitleUpdate?: (id: string, newTitle: string) => Promise<boolean>;
}

const ConversationList: React.FC<ConversationListProps> = ({ 
  conversations, 
  onConversationClick, 
  onTitleUpdate 
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleTitleClick = (e: React.MouseEvent, conversation: ConversationType) => {
    e.stopPropagation();
    if (onTitleUpdate) {
      setEditingId(conversation.id);
      setEditingTitle(conversation.title);
    }
  };

  const handleTitleSave = async () => {
    if (!editingId || !onTitleUpdate || isUpdating) return;
    
    const trimmedTitle = editingTitle.trim();
    if (!trimmedTitle) {
      setEditingId(null);
      return;
    }

    setIsUpdating(true);
    try {
      const success = await onTitleUpdate(editingId, trimmedTitle);
      if (success) {
        setEditingId(null);
      }
    } catch (error) {
      console.error('Failed to update title:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleTitleCancel = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      handleTitleCancel();
    }
  };

  return (
    <div className="conversation-list">
      <h2>Conversations</h2>
      {conversations.length > 0 ? (
        <ul>
          {conversations.map(conversation => (
            <li 
              key={conversation.id}
              onClick={() => !onTitleUpdate && editingId !== conversation.id && onConversationClick(conversation.id)}
            >
              <div className="conversation-item">
                {editingId === conversation.id ? (
                  <div className="title-edit-container">
                    <input
                      ref={inputRef}
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onBlur={handleTitleSave}
                      disabled={isUpdating}
                      maxLength={200}
                      className="title-edit-input"
                    />
                    {isUpdating && <span className="updating-indicator">Saving...</span>}
                  </div>
                ) : (
                  <span 
                    className={`conversation-title ${onTitleUpdate ? 'editable' : ''}`}
                    onClick={(e) => {
                      if (onTitleUpdate) {
                        e.stopPropagation();
                        handleTitleClick(e, conversation);
                      }
                    }}
                    title={onTitleUpdate ? 'Click to edit title' : undefined}
                  >
                    {conversation.title}
                  </span>
                )}
                <span 
                  className="conversation-meta"
                  onClick={(e) => {
                    if (onTitleUpdate) {
                      e.stopPropagation();
                    }
                    if (editingId !== conversation.id) {
                      onConversationClick(conversation.id);
                    }
                  }}
                >
                  {conversation.messages && conversation.messages.length > 0 ? (
                    <>
                      {`${conversation.messages.length} messages`}
                      {(() => {
                        const totalCost = conversation.messages.reduce((sum, msg) => 
                          sum + (msg.cost || 0), 0
                        );
                        return totalCost > 0 ? ` • $${totalCost.toFixed(6)}` : '';
                      })()}
                    </>
                  ) : 'No messages'}
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