// src/renderers/LatexRenderer.tsx
import React from 'react';
import { Renderer } from './Renderer';
import { MathJaxContext, MathJax } from 'better-react-mathjax';
import DOMPurify from 'dompurify';

export class LatexRenderer implements Renderer {
  detectStartSequence(content: string, startIndex: number): number | [number, number] {
    const startSequences = ['$$', '\\(', '\\['];
    for (const seq of startSequences) {
      const start = content.indexOf(seq, startIndex);
      if (start !== -1) {
        return [start, start + seq.length];
      }
    }
    return -1;
  }

  detectEndSequence(content: string, startIndex: number): number | [number, number] {
    const endSequences = ['$$', '\\)', '\\]'];
    for (const seq of endSequences) {
      const end = content.indexOf(seq, startIndex);
      if (end !== -1) {
        return [end, end + seq.length];
      }
    }
    return -1;
  }

  render(content: string, startIndex: number, endIndex: number): string {
    const latexContent = DOMPurify.sanitize(content.slice(startIndex, endIndex).replace(/^(\$\$|\\\(|\\\[)|(\$\$|\\\)|\\\])$/g, ''));
    return `<span class="mathjax-latex">${latexContent}</span>`;
  }

  initializeMathJax() {
    if (typeof window !== 'undefined' && (window as any).MathJax) {
      (window as any).MathJax.typeset();
    }
  }
}