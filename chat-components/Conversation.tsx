import React, { useState, useEffect } from 'react';
import Message from './Message';
import { Message as MessageType } from './types/Message';

interface ConversationProps {
  messages: MessageType[];
  author: string; // New prop
}

const Conversation: React.FC<ConversationProps> = ({ messages, author }) => {
  // TODO: Refactor messages to be a map
  const getChildren = (messages: MessageType[], parentId: string | null): MessageType[] => {
    return messages.filter(message => message.parentId === parentId);
  }

  const getMessage = (messages: MessageType[], id: string): MessageType | null => {
    return messages.find(message => message.id === id) || null;
  }
  const [selectedChildIndex, setSelectedChildIndex] = useState<{ [key: string]: string }>({});


  const setChildren = () => {
     setSelectedChildIndex(prevState => {
        const newState = { ...prevState };
        for (const message of messages) {
          if (newState[message.id] === undefined) {
            const children = getChildren(messages, message.id);
            if (children.length > 0) {
              newState[message.id] = children[0].id;
            }
          }
        }
        return newState;
      });
  }

  useEffect(() => {
    setChildren();
  }, []);

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

  const renderMessages = (messages: MessageType[], currentId: string | null = null, parentId: string | null = null): JSX.Element => {
    if (currentId === null) {
      return <></>;
    }
    const childMessages = getChildren(messages, parentId);
    const currentIndex = childMessages.findIndex(message => message.id === currentId);
    const totalSiblings = childMessages.length;
    const currentMessage = getMessage(messages, currentId) as MessageType;
    const childrenHaveSiblings = getChildren(messages, currentId).length > 1;

    return (<>
        <Message
          content={currentMessage.content}
          author={currentMessage.author}
          timestamp={currentMessage.timestamp}
          id={currentMessage.id}
          onPrev={() => decrementSelectedChildIndex(currentMessage.parentId)}
          onNext={() => incrementSelectedChildIndex(currentMessage.parentId)}
          hasSiblings={totalSiblings > 1}
          currentIndex={currentIndex}
          totalSiblings={totalSiblings}
          isAuthor={currentMessage.author === author}
        />
        {renderMessages(messages, selectedChildIndex[currentId], currentId)}
    </>);
  };

  // TODO: Enforce that there is always at least one parent
  const parentMessages = getChildren(messages, null);
  const hasSiblings = parentMessages.length > 1;

  return <div>{renderMessages(messages, parentMessages[0]?.id, null)}</div>;
};

export default Conversation;