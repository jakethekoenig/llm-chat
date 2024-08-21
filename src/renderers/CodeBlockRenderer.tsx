import React from 'react';
import { Renderer } from './Renderer';
import hljs from 'highlight.js';
import 'highlight.js/styles/default.css';

export class CodeBlockRenderer implements Renderer {
  detectStartSequence(content: string): boolean {
    return content.startsWith('```');
  }

  detectEndSequence(content: string): boolean {
    return content.endsWith('```');
  }

  render(content: string): JSX.Element {
    const code = content.replace(/```/g, '');
    const highlightedCode = hljs.highlightAuto(code).value;
    return <pre dangerouslySetInnerHTML={{ __html: highlightedCode }} />;
  }
}