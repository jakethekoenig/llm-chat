# LLM Chat

![Coverage](https://codecov.io/gh/jakethekoenig/llm-chat/branch/main/graph/badge.svg)

Note to LLM agents working on this with me: You likely cannot run commands yourself such as `npm i`. If you need more dependencies list them in your PR description and I will add them.

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

## Running the Server

To run the server, follow these steps:

1. Install dependencies: `npm install`
2. Start the server: `npm run start`

The server will be running on `http://localhost:3000`.

## Running the Test Website

To run the test website, follow these steps:

1. Install dependencies: `npm install`
2. Start the dev server: `npm run dev`
3. Open the provided localhost URL in your browser

This test website serves as a living documentation of our components, making it easier to visualize and interact with them as we develop.
```bash
npm test
```

This will also generate a coverage report in the `coverage` directory.

## Running the Server

To run the server, follow these steps:

1. Install dependencies: `npm install`
2. Start the server: `npm run start`

The server will be running on `http://localhost:3000`.

## Running the Test Website

To run the test website, follow these steps:

1. Install dependencies: `npm install`
2. Start the dev server: `npm run dev`
3. Open the provided localhost URL in your browser

This test website serves as a living documentation of our components, making it easier to visualize and interact with them as we develop.