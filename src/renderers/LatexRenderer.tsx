// src/renderers/LatexRenderer.tsx
import React from 'react';
import { Renderer } from './Renderer';
import DOMPurify from 'dompurify';

export class LatexRenderer implements Renderer {
  detectStartSequence(content: string, startIndex: number): [number, number] | null {
    const startSequences = ['$$', '\\(', '\\['];
    for (const seq of startSequences) {
      const start = content.indexOf(seq, startIndex);
      if (start !== -1) {
        return [start, start + seq.length];
      }
    }
    return null;
  }

  detectEndSequence(content: string, startIndex: number): [number, number] | null {
    const endSequences = ['$$', '\\)', '\\]'];
    for (const seq of endSequences) {
      const end = content.indexOf(seq, startIndex);
      if (end !== -1) {
        return [end, end + seq.length];
      }
    }
    return null;
  }

  render(content: string, startIndex: number, endIndex: number): React.ReactNode {
    const latexContent = DOMPurify.sanitize(content.slice(startIndex, endIndex).replace(/^(\$\$|\\\(|\\\[)|(\$\$|\\\)|\\\])$/g, ''));
    return <span className="mathjax-latex" dangerouslySetInnerHTML={{ __html: latexContent }} />;
  }

  initializeMathJax() {
    if (typeof window !== 'undefined' && (window as any).MathJax) {
      (window as any).MathJax.typeset();
    }
  }
}