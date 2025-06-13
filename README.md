# LLM Chat

![Coverage](https://codecov.io/gh/jakethekoenig/llm-chat/branch/main/graph/badge.svg)

Note to LLM agents working on this with me: You likely cannot run commands yourself such as `npm i`. If you need more dependencies list them in your PR description and I will add them.

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

We utilize Jest for testing, along with `jest-styled-components` to enable testing of styled-components. Ensure all dependencies are installed correctly.

### Configuration

- **jest-styled-components**: This package is used to test styled-components in our React application. It is included in `devDependencies` and configured in `jest.setup.ts`.

## Dependency Management

We use a `.npmrc` file to lock dependency versions and ensure consistency across different environments. This helps in preventing unexpected issues during CI/CD processes.
A library of components for building chat interfaces. This is just the beginning.

## TypeScript

This project uses TypeScript for type safety and better developer experience. Ensure all new files use the `.ts` or `.tsx` extension as appropriate.

## Running Tests

To run tests locally, use the following command:

```bash
npm test
```

This will also generate a coverage report in the `coverage` directory.

## Environment Setup

Before running the server, you need to set up your environment variables:

1. Copy the example environment file: `cp .env.example .env`
2. Edit `.env` and set the required values:
   - `SECRET_KEY`: A strong random secret (minimum 32 characters) for JWT tokens
   - `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `DEEPSEEK_API_KEY`: At least one LLM API key is required
   - `PORT`: Optional, defaults to 3000

### Required Environment Variables

- **SECRET_KEY**: Used for JWT token signing. Generate a strong random string (32+ characters)
- **API Keys**: Set at least one of these for LLM completions:
  - `OPENAI_API_KEY`: For GPT models
  - `ANTHROPIC_API_KEY`: For Claude models
  - `DEEPSEEK_API_KEY`: For DeepSeek models

### Example

```bash
# Generate a secure SECRET_KEY (32+ characters)
SECRET_KEY=your-super-secure-random-string-here-32-chars-minimum

# Add your API keys (at least one required)
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
DEEPSEEK_API_KEY=sk-your-deepseek-key-here

# Optional: Custom port
PORT=3000
```

## Running the Server

To run the server, follow these steps:

1. Install dependencies: `npm install`
2. Set up environment variables (see Environment Setup above)
3. Start the server: `npm run start`

The server will be running on `http://localhost:3000`.

### Security Features

The server includes several security features:
- Rate limiting (100 requests per 15 minutes, 5 auth attempts per 15 minutes)
- Security headers via Helmet.js
- Environment variable validation on startup
- No fallback secrets in production

## Running the Test Website

To run the test website, follow these steps:

1. Install dependencies: `npm install`
2. Start the dev server: `npm run dev`
3. Open the provided localhost URL in your browser

This test website serves as a living documentation of our components, making it easier to visualize and interact with them as we develop.