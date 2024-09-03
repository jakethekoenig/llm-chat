import React, { useState, useEffect } from 'react';
import Message from './Message';
import { Message as MessageType } from '../types/Message';

interface ConversationProps {
  messages: MessageType[];
}

const Conversation: React.FC<ConversationProps> = ({ messages }) => {
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

  const renderMessages = (messages: MessageType[], currentId: string | null = null, hasSiblings: boolean = false, siblingIndex: number = 0, totalSiblings: number = 0): JSX.Element => {
    if (currentId === null) {
      return <></>;
    }
    const childMessages = getChildren(messages, currentId);
    let selectedChild = null;
    if (childMessages.length > 0) {
      selectedChild = getMessage(messages, selectedChildIndex[currentId])?.id;
    }

    const currentIndex = siblingIndex;
    const currentMessage = getMessage(messages, currentId) as MessageType;
    const childrenHaveSiblings = childMessages.length > 1;

    return (<>
        <Message
          {...currentMessage}
          onPrev={() => decrementSelectedChildIndex(currentMessage.parentId)}
          onNext={() => incrementSelectedChildIndex(currentMessage.parentId)}
          hasSiblings={hasSiblings}
          currentIndex={currentIndex}
          totalSiblings={totalSiblings}
        />
        {renderMessages(messages, selectedChild, childrenHaveSiblings, siblingIndex + 1, totalSiblings)}
    </>);
  };

  // TODO: Enforce that there is always at least one parent
  const parentMessages = getChildren(messages, null);
  const hasSiblings = parentMessages.length > 1;

  return <div>{renderMessages(messages, parentMessages[0].id, hasSiblings, 0, parentMessages.length)}</div>;
};

export default Conversation;