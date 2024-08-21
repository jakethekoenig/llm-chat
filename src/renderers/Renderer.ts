export interface Renderer {
  detectStartSequence(content: string): boolean;
  detectEndSequence(content: string): boolean;
  render(content: string): JSX.Element;
}