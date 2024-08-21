import React from 'react';
import { Renderer } from './Renderer';
import hljs from 'highlight.js';
import 'highlight.js/styles/default.css';

export class CodeBlockRenderer implements Renderer {
  detectStartSequence(content: string, startIndex: number): number | [number, number] {
    const start = content.indexOf('```', startIndex);
    return start === -1 ? content.length : [start, start + 3];
  }

  detectEndSequence(content: string, startIndex: number): number | [number, number] {
    const end = content.indexOf('```', startIndex);
    return end === -1 ? content.length : [end, end + 3];
  }

  render(content: string, startIndex: number, endIndex: number): string {
    const code = content.slice(startIndex + 3, endIndex - 3).trim();
    const highlightedCode = hljs.highlightAuto(code).value;
    return `<pre><code>${highlightedCode}</code></pre>`;
  }
}