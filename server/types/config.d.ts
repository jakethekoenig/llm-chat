// server/types/config.d.ts
declare module 'config' {
  const apiKeys: {
    openai: string;
    anthropic: string;
  };
  export default { apiKeys };
}