// server/types/config.d.ts
declare module 'config' {
  const apiKeys: {
    openai: string;
  };
  export default { apiKeys };
}