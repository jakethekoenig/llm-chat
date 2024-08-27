import React from 'react';
import Message from '../components/Message';

export default {
  title: 'Components/Message',
  component: Message,
};

const Template = (args: any) => <Message {...args} />;

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
  config: {
    theme: {
      primaryColor: '#007BFF',
      secondaryColor: '#6C757D',
      mode: 'light',
    },
  },
};

export const StreamingContent = Template.bind({});
StreamingContent.args = {
  content: (async function* (): AsyncGenerator<string, void, unknown> {
    yield 'Hello, ';
    await new Promise(resolve => setTimeout(resolve, 1000));
    yield 'world!';
  })(),
  author: 'Streamer',
  timestamp: new Date().toISOString(),
  buttons: {
    copy: true,
    share: true,
    delete: false,
    edit: true,
  },
  onCopy: () => console.log('Copy clicked'),
  onShare: () => console.log('Share clicked'),
  onEdit: () => console.log('Edit clicked'),
  config: {
    theme: {
      primaryColor: '#007BFF',
      secondaryColor: '#6C757D',
      mode: 'light',
    },
  },
};

export const NoButtons = Template.bind({});
NoButtons.args = {
  content: 'No buttons example',
  author: 'Jane Doe',
  timestamp: new Date().toISOString(),
  buttons: {},
};