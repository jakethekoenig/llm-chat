export interface Renderer {
  detectStartSequence(content: string, startIndex: number): number | [number, number];
  detectEndSequence(content: string, startIndex: number): number | [number, number];
  render(content: string, startIndex: number, endIndex: number): string;
}