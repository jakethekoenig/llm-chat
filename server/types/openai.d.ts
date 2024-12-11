declare module 'openai' {
  export class Configuration {
    constructor(config: { apiKey: string });
  }

  export class OpenAIApi {
    constructor(configuration: Configuration);
    createChatCompletion(params: any): Promise<any>;
  }

  export default OpenAIApi;
}