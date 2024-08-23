export interface Renderer {
  detectStartSequence(content: string, startIndex: number): [number, number] | null;
  detectEndSequence(content: string, startIndex: number): [number, number] | null;
  render(content: string, startIndex: number, endIndex: number): React.ReactNode;
}