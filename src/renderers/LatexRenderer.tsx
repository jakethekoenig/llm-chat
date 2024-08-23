// src/renderers/LatexRenderer.tsx
import React from 'react';
import { Renderer } from './Renderer';
import DOMPurify from 'dompurify';
import { MathJax } from 'better-react-mathjax';

export class LatexRenderer implements Renderer {
  detectStartSequence(content: string, startIndex: number): [number, number] | null {
    const startSequences = ['$$', '\\(', '\\['];
    let firstMatch: [number, number] | null = null;
    for (const seq of startSequences) {
      const start = content.indexOf(seq, startIndex);
      if (start !== -1 && (firstMatch === null || start < firstMatch[0])) {
        firstMatch = [start, start + seq.length];
      }
    }
    return firstMatch;
  }

  detectEndSequence(content: string, startIndex: number): [number, number] | null {
    const endSequences = ['$$', '\\)', '\\]'];
    let firstMatch: [number, number] | null = null;
    for (const seq of endSequences) {
      const end = content.indexOf(seq, startIndex);
      if (end !== -1 && (firstMatch === null || end < firstMatch[0])) {
        firstMatch = [end, end + seq.length];
      }
    }
    return firstMatch;
  }

  render(content: string, startIndex: number, endIndex: number): React.ReactNode {
    const latexContent = DOMPurify.sanitize(content.slice(startIndex, endIndex));
    return <MathJax dynamic>{latexContent}</MathJax>;
  }
}
