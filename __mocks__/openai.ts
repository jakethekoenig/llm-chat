// Mock implementation for OpenAI client
let mockChatResponse = {
  choices: [{ message: { role: "assistant", content: 'Mocked completion response' }}]
};

let mockCompletionResponse = {
  choices: [{ text: 'Mocked completion response' }]
};

const mockCreate = jest.fn().mockImplementation(() => Promise.resolve(mockChatResponse));
const mockCompletionCreate = jest.fn().mockImplementation(() => Promise.resolve(mockCompletionResponse));

const OpenAI = jest.fn().mockImplementation(() => ({
  chat: {
    completions: {
      create: mockCreate
    }
  },
  completions: {
    create: mockCompletionCreate
  }
}));

// Helper functions to control mock behavior
export const setMockChatResponse = (response: any) => {
  mockChatResponse = response;
};

export const setMockCompletionResponse = (response: any) => {
  mockCompletionResponse = response;
};

export const getMockCreate = () => mockCreate;
export const getMockCompletionCreate = () => mockCompletionCreate;

export { OpenAI };
export default { OpenAI };