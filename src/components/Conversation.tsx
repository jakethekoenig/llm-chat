import React, { useState, useEffect } from 'react';
import Message from './Message';
import { Message as MessageType } from '../types/Message';

interface ConversationProps {
  messages: { [key: string]: MessageType }; // Change to map of IDs to messages
}

const Conversation: React.FC<ConversationProps> = ({ messages }) => {
  const getChildren = (message: MessageType): MessageType[] => {
    return Object.values(message.children || {});
  }

  const getMessage = (id: string): MessageType | null => {
    return messages[id] || null;
  }
  const [selectedChildIndex, setSelectedChildIndex] = useState<{ [key: string]: string }>({});

  const setChildren = () => {
     setSelectedChildIndex(prevState => {
        const newState = { ...prevState };
        for (const message of Object.values(messages)) {
          if (newState[message.id as string] === undefined) {
            const children = getChildren(message);
            if (children.length > 0) {
              newState[message.id as string] = children[0]?.id;
            }
          }
        }
        return newState;
      });
  }

  useEffect(() => {
    setChildren();
  }, [messages]);

  const incrementSelectedChildIndex = (id: string | null | undefined) => {
      if (id != null && id != undefined)
          setSelectedChildIndex(prevState => {
            const children = getChildren(getMessage(id)!);
            const currentSelected = prevState[id] || '';
            const currentSelectedIndex = children.findIndex(child => child.id === currentSelected);
            if (currentSelectedIndex < children.length - 1) {
              return {
                ...prevState,
                [id]: children[currentSelectedIndex + 1]?.id
              };
            }
            return prevState;
          });
  }

  const decrementSelectedChildIndex = (id: string | null | undefined) => {
      if (id !== null && id !== undefined)
          setSelectedChildIndex(prevState => {
            const children = getChildren(getMessage(id)!);
            const currentSelected = prevState[id] || '';
            const currentSelectedIndex = children.findIndex(child => child.id === currentSelected);
            if (currentSelectedIndex > 0) {
              return {
                ...prevState,
                [id]: children[currentSelectedIndex - 1]?.id
              };
            }
            return prevState;
          });
  }

  const renderMessages = (currentId: string | null = null, hasSiblings: boolean = false): JSX.Element => {
    if (currentId === null) {
      return <></>;
    }
    const currentMessage = getMessage(currentId);
    if (!currentMessage) {
      return <></>;
    }
    const childMessages = getChildren(currentMessage);
    let selectedChild = null;
    if (childMessages.length > 0) {
      selectedChild = getMessage(selectedChildIndex[currentId])?.id;
    }

    const childrenHaveSiblings = childMessages.length > 1;

    return (<>
        <Message
          {...currentMessage}
          onPrev={() => decrementSelectedChildIndex(currentMessage.parentId)}
          onNext={() => incrementSelectedChildIndex(currentMessage.parentId)}
          hasSiblings={hasSiblings}
        />
        {renderMessages(selectedChild, childrenHaveSiblings)}
    </>);
  };

  const parentMessages = Object.values(messages).filter(message => message.parentId === null);
  const hasSiblings = parentMessages.length > 1;

  return <div>{renderMessages(parentMessages[0]?.id, hasSiblings)}</div>;
};

export default Conversation;
