// src/__tests__/LatexRenderer.test.tsx
import { LatexRenderer } from '../chat-components/renderers/LatexRenderer';
import { MathJax } from 'better-react-mathjax';

describe('LatexRenderer', () => {
  let renderer: LatexRenderer;

  beforeEach(() => {
    renderer = new LatexRenderer();
  });

  test('detectStartSequence finds $$', () => {
    const result = renderer.detectStartSequence('Hello $$latex', 0);
    expect(result).toEqual([6, 8]);
  });

  test('detectStartSequence finds \\(', () => {
    const result = renderer.detectStartSequence('Hello \\(latex', 0);
    expect(result).toEqual([6, 8]);
  });

  test('detectStartSequence finds \\[', () => {
    const result = renderer.detectStartSequence('Hello \\[latex', 0);
    expect(result).toEqual([6, 8]);
  });

  test('detectEndSequence finds $$', () => {
    const result = renderer.detectEndSequence('latex$$', 0);
    expect(result).toEqual([5, 7]);
  });

  test('detectEndSequence finds \\)', () => {
    const result = renderer.detectEndSequence('latex\\)', 0);
    expect(result).toEqual([5, 7]);
  });

  test('detectEndSequence finds \\]', () => {
    const result = renderer.detectEndSequence('latex\\]', 0);
    expect(result).toEqual([5, 7]);
  });

  test('detectStartSequence finds first occurrence among $$, \\(, \\[', () => {
    const result = renderer.detectStartSequence('Hello \\(latex$$', 0);
    expect(result).toEqual([6, 8]);
  });

  test('detectEndSequence finds first occurrence among $$, \\), \\]', () => {
    const result = renderer.detectEndSequence('latex$$ more text \\)', 0);
    expect(result).toEqual([5, 7]);
  });

  test('detectStartSequence finds first occurrence among \\[, $$, \\(', () => {
    const result = renderer.detectStartSequence('Hello \\[latex$$', 0);
    expect(result).toEqual([6, 8]);
  });

  test('detectEndSequence finds first occurrence among \\], $$, \\)', () => {
    const result = renderer.detectEndSequence('latex\\] more text $$', 0);
    expect(result).toEqual([5, 7]);
  });

  test('detectStartSequence finds first occurrence among $$, \\[, \\(', () => {
    const result = renderer.detectStartSequence('Hello $$latex\\(', 0);
    expect(result).toEqual([6, 8]);
  });

  test('detectEndSequence finds first occurrence among $$, \\], \\)', () => {
    const result = renderer.detectEndSequence('latex$$ more text \\]', 0);
    expect(result).toEqual([5, 7]);
  });

  test('render wraps content in span', () => {
    const result = renderer.render('E=mc^2', 0, 6);
    expect(result).toEqual(<MathJax dynamic>{'E=mc^2'}</MathJax>);
  });
});