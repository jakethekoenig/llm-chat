import { isGeminiModel } from '../../server/helpers/messageHelpers';

describe('Gemini Model Detection', () => {
  test('should detect Gemini models correctly', () => {
    expect(isGeminiModel('gemini-pro')).toBe(true);
    expect(isGeminiModel('gemini-1.5-pro')).toBe(true);
    expect(isGeminiModel('Gemini-Flash')).toBe(true);
    expect(isGeminiModel('text-bison')).toBe(true);
    expect(isGeminiModel('chat-bison')).toBe(true);
    expect(isGeminiModel('palm-2')).toBe(true);
    
    expect(isGeminiModel('gpt-4')).toBe(false);
    expect(isGeminiModel('claude-3')).toBe(false);
    expect(isGeminiModel('davinci')).toBe(false);
  });
});
