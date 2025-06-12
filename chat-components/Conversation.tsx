import React, { useState, useEffect } from 'react';
import Message from './Message';
import { Message as MessageType } from './types/Message';
import NewMessage from './NewMessage'; // Ensure this path is correct

interface ConversationProps {
  messages: MessageType[];
  onSubmit: (message: string) => AsyncIterable<string>;
  author: string;
  onEdit?: (messageId: string, newContent: string) => Promise<void>;
  onDelete?: (messageId: string) => Promise<void>;
}

const Conversation: React.FC<ConversationProps> = ({ messages, onSubmit, author, onEdit, onDelete }) => {
  // TODO: Refactor messages to be a map
  const getChildren = (_messages: MessageType[], parentId: string | null): MessageType[] => {
    return _messages.filter(message => message.parentId === parentId);
  }

  const getMessage = (_messages: MessageType[], id: string): MessageType | null => {
    return _messages.find(message => message.id === id) || null;
  }
  const [selectedChildIndex, setSelectedChildIndex] = useState<{ [key: string]: string }>({});


  const setChildren = (_messages: MessageType[]) => {
     setSelectedChildIndex(prevState => {
        const newState = { ...prevState };
        for (const message of _messages) {
          if (newState[message.id] === undefined) {
            const children = getChildren(_messages, message.id);
            if (children.length > 0) {
              newState[message.id] = children[0].id;
            }
          }
        }
        return newState;
      });
  }

  useEffect(() => {
    setChildren(messages);
  }, [messages]);

  const incrementSelectedChildIndex = (id: string | null | undefined) => {
      if (id != null && id != undefined)
          setSelectedChildIndex(prevState => {
            const children = getChildren(messages, id);
            const currentSelected = prevState[id];
            const currentSelectedIndex = children.findIndex(child => child.id === currentSelected);
            if (currentSelectedIndex < children.length - 1) {
              return {
                ...prevState,
                [id]: children[currentSelectedIndex + 1].id
              };
            }
            return prevState;
          });
  }

  const decrementSelectedChildIndex = (id: string | null | undefined) => {
      if (id !== null && id !== undefined)
          setSelectedChildIndex(prevState => {
            const children = getChildren(messages, id);
            const currentSelected = prevState[id];
            const currentSelectedIndex = children.findIndex(child => child.id === currentSelected);
            if (currentSelectedIndex > 0) {
              return {
                ...prevState,
                [id]: children[currentSelectedIndex - 1].id
              };
            }
            return prevState;
          });
  }

  const renderMessages = (_messages: MessageType[], currentId: string | null = null, parentId: string | null = null): JSX.Element => {
    if (currentId === null) {
      return <></>;
    }
    const childMessages = getChildren(_messages, parentId);
    const currentIndex = childMessages.findIndex(message => message.id === currentId);
    const totalSiblings = childMessages.length;
    const currentMessage = getMessage(_messages, currentId) as MessageType;
    const childrenHaveSiblings = getChildren(_messages, currentId).length > 1;
    if (!currentMessage) {
      return (<></>);
    } else {
        return (<>
            <Message
              content={currentMessage.content}
              author={currentMessage.author}
              timestamp={currentMessage.timestamp}
              id={currentMessage.id}
              conversationId={currentMessage.conversationId}
              userId={currentMessage.userId}
              parentId={currentMessage.parentId}
              onPrev={() => decrementSelectedChildIndex(currentMessage.parentId)}
              onNext={() => incrementSelectedChildIndex(currentMessage.parentId)}
              hasSiblings={totalSiblings > 1}
              currentIndex={currentIndex}
              totalSiblings={totalSiblings}
              $isAuthor={currentMessage.author === author}
              onEdit={onEdit}
              onDelete={onDelete}
            />
            {renderMessages(_messages, selectedChildIndex[currentId], currentId)}
        </>);
    }
  };

  // TODO: Enforce that there is always at least one parent
  const parentMessages = getChildren(messages, null);
  const hasSiblings = parentMessages.length > 1;

  return (
    <div>
      {renderMessages(messages, parentMessages[0]?.id || '', null)}
      <div style={{ marginTop: '16px' }}>
        <NewMessage onSubmit={onSubmit} />
      </div>
    </div>
  );
};

export default Conversation;
