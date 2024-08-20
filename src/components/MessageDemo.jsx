import React from 'react';
import Message from './Message';

const MessageDemo = () => {
  return (
    <div>
      <h2>Message Component Demo</h2>
      <Message content="Hello, World!" author="John Doe" timestamp={new Date().toISOString()} />
    </div>
  );
};

export default MessageDemo;