import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CodeBlockRenderer } from '../src/renderers/CodeBlockRenderer';

test('renders code block correctly', () => {
  const renderer = new CodeBlockRenderer();
  const content = "```javascript\nconsole.log('Hello, World!');\n```";
  const startSeq = renderer.detectStartSequence(content, 0);
  if (startSeq !== null) {
    const endSeq = renderer.detectEndSequence(content, startSeq[1]);
    if (endSeq !== null) {
      const renderedContent = renderer.render(content, startSeq[0], endSeq[1]);

      render(renderedContent);
      expect(screen.getByText("console")).toBeInTheDocument();
      expect(screen.getByText("log")).toBeInTheDocument();
    }
  }
});

test('detects start sequence correctly', () => {
  const renderer = new CodeBlockRenderer();
  const content = "```javascript\nconsole.log('Hello, World!');\n```";
  const startSeq = renderer.detectStartSequence(content, 0);
  expect(startSeq).toEqual([0, 3]);
});

test('detects end sequence correctly', () => {
  const renderer = new CodeBlockRenderer();
  const content = "```javascript\nconsole.log('Hello, World!');\n```";
  const startSeq = renderer.detectStartSequence(content, 0);
  if (startSeq !== null) {
    const endSeq = renderer.detectEndSequence(content, startSeq[1]);
    if (endSeq !== null) {
      expect(endSeq).toEqual([44, 47]);
    }
  }
});

test('handles no start sequence', () => {
  const renderer = new CodeBlockRenderer();
  const content = "console.log('Hello, World!');";
  const startSeq = renderer.detectStartSequence(content, 0);
  expect(startSeq).toBeNull();
});

test('handles no end sequence', () => {
  const renderer = new CodeBlockRenderer();
  const content = "```javascript\nconsole.log('Hello, World!');";
  const startSeq = renderer.detectStartSequence(content, 0);
  if (startSeq !== null) {
    const endSeq = renderer.detectEndSequence(content, startSeq[1]);
    expect(endSeq).toBeNull();
  }
});