import React from 'react';
import Message from '../components/Message';

export default {
  title: 'Components/Message',
  component: Message,
};

const Template = (args) => <Message {...args} />;

export const Default = Template.bind({});
Default.args = {
  content: 'Hello, world!',
  author: 'User',
  timestamp: new Date().toISOString(),
  buttons: {
    copy: true,
    share: true,
    delete: false,
    edit: true,
  },
  onCopy: () => console.log('Copy clicked'),
  onShare: () => console.log('Share clicked'),
  onDelete: () => console.log('Delete clicked'),
  onEdit: () => console.log('Edit clicked'),
};