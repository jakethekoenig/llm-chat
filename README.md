# LLM Chat

![Coverage](https://codecov.io/gh/jakethekoenig/llm-chat/branch/main/graph/badge.svg)

Note to LLM agents working on this with me: You likely cannot run commands yourself such as `npm i`. If you need more dependencies list them in your PR description and I will add them.

## Development

To run the application in development mode:

1. Install dependencies: `npm install`
2. Start the development server: `npm run dev:server`
   - This runs the backend server on port 3000
   - Uses nodemon to automatically restart when server files change
3. In a separate terminal, start the frontend: `npm run dev:frontend`
   - This runs the Vite dev server with hot module replacement
   - Will automatically proxy API requests to the backend

The frontend will be available at the URL shown in the Vite output, and the backend will be running on `http://localhost:3000`.

## Integration

The `NewMessage` component is integrated within the `Conversation` component to allow users to submit new messages seamlessly. Ensure that any usage of the `Conversation` component includes the necessary `onSubmit` and `author` props.

## Integration Example

Below is a brief example of how to use the `Conversation` component with the required `onSubmit` and `author` props:

```tsx
import React from 'react';
import Conversation from './chat-components/Conversation';

const handleSubmit = async function* (message: string): AsyncIterable<string> {
  yield `You typed: ${message}\nProcessing...\nDone!\n`;
};

const App = () => {
  const messages = [
    { id: '1', content: 'Hello!', author: 'User', timestamp: new Date().toISOString(), parentId: null },
  ];

  return (
    <Conversation messages={messages} onSubmit={handleSubmit} author="User" />
  );
};
export default App;
```

## Testing

We utilize Jest for testing, along with `jest-styled-components` to enable testing of styled-components. To run tests locally, use:

```bash
npm test
```

This will generate a coverage report in the `coverage` directory.

## Production

For production deployment:

1. Build the application: `npm run build`
2. Start the production server: `npm run start:server`
3. Serve the frontend build using your preferred static file server

## TypeScript

This project uses TypeScript for type safety and better developer experience. Ensure all new files use the `.ts` or `.tsx` extension as appropriate.

## Dependency Management

We use a `.npmrc` file to lock dependency versions and ensure consistency across different environments. This helps in preventing unexpected issues during CI/CD processes.