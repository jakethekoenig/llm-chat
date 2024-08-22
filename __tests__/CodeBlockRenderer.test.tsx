import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CodeBlockRenderer } from '../src/renderers/CodeBlockRenderer';

test('renders code block correctly', () => {
  const renderer = new CodeBlockRenderer();
  const content = "```javascript\nconsole.log('Hello, World!');\n```";
  const startSeq = renderer.detectStartSequence(content, 0);
  const endSeq = renderer.detectEndSequence(content, Array.isArray(startSeq) ? startSeq[1] : startSeq);
  const renderedContent = renderer.render(content, Array.isArray(startSeq) ? startSeq[0] : startSeq, Array.isArray(endSeq) ? endSeq[1] : endSeq);

  render(<div dangerouslySetInnerHTML={{ __html: renderedContent }} />);
  expect(screen.getByText("console")).toBeInTheDocument();
  expect(screen.getByText("log")).toBeInTheDocument();
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
  const endSeq = renderer.detectEndSequence(content, Array.isArray(startSeq) ? startSeq[1] : startSeq);
  expect(endSeq).toEqual([44, 47]);
});

test('handles no start sequence', () => {
  const renderer = new CodeBlockRenderer();
  const content = "console.log('Hello, World!');";
  const startSeq = renderer.detectStartSequence(content, 0);
  expect(startSeq).toEqual(content.length);
});

test('handles no end sequence', () => {
  const renderer = new CodeBlockRenderer();
  const content = "```javascript\nconsole.log('Hello, World!');";
  const startSeq = renderer.detectStartSequence(content, 0);
  const endSeq = renderer.detectEndSequence(content, Array.isArray(startSeq) ? startSeq[1] : startSeq);
  expect(endSeq).toEqual(content.length);
});