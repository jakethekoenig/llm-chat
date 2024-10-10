# Roadmap

## Frontend

A variety of react components that are necessary to build a chat interface. All components flexible and customizable.
- A message component
    - [ ] Display text, author and timestamp.
    - [ ] Controls: Edit, delete, regenerate (allow the user to select the model).
    - [ ] Share button: Can share whole conversation or the message and ancestors.
    - [ ] Code and latex blocks pretty printed. All blocks collapsible and have a copy button.
        - [ ] This needs to work with streaming. E.g. if the model outputs ```python then everything that follows streamed highlighted until closed with ```. Same with latex.
        - [ ] \(, $, $$ all detected and supported.
    - [ ] Support images

### Global Configuration
```tsx
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import { MessageConfigProvider } from './components/MessageConfigContext';

const globalConfig = {
  buttons: {
    copy: true,
    share: false,
    delete: true,
    edit: true,
  },
  // Add other global configuration options here
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MessageConfigProvider config={globalConfig}>
      <App />
    </MessageConfigProvider>
  </React.StrictMode>
);
```

### Local Configuration
```tsx
<Message
  content="Hello, world!"
  author="User"
  timestamp={new Date().toISOString()}
  buttons={{
    copy: true,
    share: true,
    delete: false,
    edit: true
  }}
  onCopy={() => console.log('Copy clicked')}
  onShare={() => console.log('Share clicked')}
  onEdit={() => console.log('Edit clicked')}
/>
```

LLM chats are unique from human chats in a number of fundamental ways:
* The LLM responds immediately whereas a human may take time to respond. In general time is an important component to understand human chats largely absent in LLM chats.
* It makes sense for the human to be able to edit both their own messages and the LLM's messages.
* Time travel makes more sense. Once you send a message to a human they may have seen it and it then becomes an important part of understanding the causal flow of the conversation. 
* Conversations tend to be goal oriented and include artifacts like code blocks and images. Therefore sharing is more likely to be valuable.

- A chat component
    - Two views:
        - [ ] Standard view: Messages are displayed in a linear fashion.
            - Users could still regenerate messages and branch. If a message has alternatives there should be little arrows in the bottom right the user can use to click through
        - [ ] Tree view: All messages in the conversation are displayed. Pinch zoom and panning should be supported.
    - [ ] Easy to switch between the two views from a message which anchors what you actually see when you switch.

- Chats component
    - [ ] A list of chats. Each chat has a title, a preview of the last message, and a timestamp.
    - [ ] Ability to create a new chat.
    - [ ] Ability to delete a chat.
    - [ ] Ability to search for a chat.
    - [ ] Ability to sort chats by last message, last message author, and last message timestamp.
    - [ ] A view where you see the chats not chronologically but in a two dimensional grid where their proximity is determined by embedding. So you can see your history and see your "programming cluster" and your "philosophy cluster" and your "personal cluster" etc.

## Backend
- [ ] Data model for the messages and chats.:
    - [ ] Chat:
        - id
        - content
        - author
        - timestamp
        - generation parameters
        - parent
        - system message
        - conversation_id
Who has permissions to view a conversation also needs to be tracked.