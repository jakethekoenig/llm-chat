import React from 'react';
import { Renderer } from './Renderer';
import hljs from 'highlight.js';
import 'highlight.js/styles/default.css';

export class CodeBlockRenderer implements Renderer {
  detectStartSequence(content: string, startIndex: number): number | [number, number] {
    const start = content.indexOf('```', startIndex);
    return start === -1 ? -1 : [start, start + 3];
  }

  detectEndSequence(content: string, startIndex: number): number | [number, number] {
    const end = content.indexOf('```', startIndex);
    return end === -1 ? -1 : [end, end + 3];
  }

  render(content: string, startIndex: number, endIndex: number): string {
    const language = content.slice(startIndex + 3, content.indexOf('\n', startIndex)).trim();
    const code = content.slice(content.indexOf('\n', startIndex) + 1, endIndex - 3).trim();
    const highlightedCode = language ? hljs.highlight(code, { language }).value : hljs.highlightAuto(code).value;
    return `<pre><code class="hljs ${language}">${highlightedCode}</code></pre>`;
  }
}