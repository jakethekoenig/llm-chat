import React from 'react';
import { Renderer } from './Renderer';
import hljs from 'highlight.js';
import 'highlight.js/styles/default.css';

export class CodeBlockRenderer implements Renderer {
  detectStartSequence(content: string, startIndex: number): [number, number] | null {
    const start = content.indexOf('```', startIndex);
    return start === -1 ? null : [start, start + 3];
  }

  detectEndSequence(content: string, startIndex: number): [number, number] | null {
    const end = content.indexOf('```', startIndex);
    return end === -1 ? null : [end, end + 3];
  }
  render(content: string, startIndex: number, endIndex: number): React.ReactNode {
    const language = content.slice(startIndex + 3, content.indexOf('\n', startIndex)).trim();
    const code = content.slice(content.indexOf('\n', startIndex) + 1, endIndex - 3).trim();
    const validLanguage = hljs.getLanguage(language) ? language : 'plaintext';
    const highlightedCode = hljs.highlight(code, { language: validLanguage }).value;
    return <pre><code className={`hljs ${validLanguage}`} dangerouslySetInnerHTML={{ __html: highlightedCode }} /></pre>;
  }
}