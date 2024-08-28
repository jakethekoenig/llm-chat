import React, { useState, useEffect } from 'react';
import Message from './Message';
import { Message as MessageType } from '../types/Message';
import MakeMessage from './MakeMessage';

interface ConversationProps {
  messages: MessageType[];
}

const Conversation: React.FC<ConversationProps> = ({ messages: initialMessages }) => {
  const [messages, setMessages] = useState<MessageType[]>(initialMessages);
  // TODO: Refactor messages to be a map
  const getChildren = (messages: MessageType[], parentId: string | null): MessageType[] => {
    return messages.filter(message => message.parentId === parentId);
  }

  const getMessage = (initialMessages: MessageType[], id: string): MessageType | null => {
    return initialMessages.find(message => message.id === id) || null;
  }
  const [selectedChildIndex, setSelectedChildIndex] = useState<{ [key: string]: string }>({});

  const handleSend = (content: string) => {
    const newMessage: MessageType = {
      id: (initialMessages.length + 1).toString(),
      content,
      author: 'User',
      timestamp: new Date().toISOString(),
      parentId: null,
    };
    setMessages([...initialMessages, newMessage]);
  };

  const setChildren = () => {
     setSelectedChildIndex(prevState => {
        const newState = { ...prevState };
        for (const message of initialMessages) {
          if (newState[message.id] === undefined) {
            const children = getChildren(initialMessages, message.id);
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
  }, [initialMessages]);

  const incrementSelectedChildIndex = (id: string | null | undefined) => {
      if (id != null && id != undefined)
          setSelectedChildIndex(prevState => {
            const children = getChildren(initialMessages, id);
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
            const children = getChildren(initialMessages, id);
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

  const renderMessages = (messages: MessageType[], currentId: string | null = null, hasSiblings: boolean = false): JSX.Element => {
    if (currentId === null) {
      return <></>;
    }
    const childMessages = getChildren(messages, currentId);
    let selectedChild = null;
    if (childMessages.length > 0) {
      selectedChild = getMessage(messages, selectedChildIndex[currentId])?.id;
    }

    const currentIndex = selectedChildIndex[currentId || 'root'] || 0;
    const currentMessage = getMessage(messages, currentId) as MessageType;
    const childrenHaveSiblings = childMessages.length > 1;

    return (<>
        <Message
          {...currentMessage}
          onPrev={() => decrementSelectedChildIndex(currentMessage.parentId)}
          onNext={() => incrementSelectedChildIndex(currentMessage.parentId)}
          hasSiblings={hasSiblings}
        />
        {renderMessages(messages, selectedChild, childrenHaveSiblings)}
    </>);

  // TODO: Enforce that there is always at least one parent
  const parentMessages = getChildren(initialMessages, null);

  return (
    <div>
      {renderMessages(initialMessages, parentMessages[0].id, parentMessages.length > 1)}
      <MakeMessage onSend={handleSend} />
    </div>
  );
};

export { Conversation };
