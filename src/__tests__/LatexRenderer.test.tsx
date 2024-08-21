// src/__tests__/LatexRenderer.test.tsx
import { LatexRenderer } from '../renderers/LatexRenderer';

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

  test('render wraps content in span', () => {
    const result = renderer.render('E=mc^2', 0, 6);
    expect(result).toBe('<span class="mathjax-latex">E=mc^2</span>');
  });

  test('initializeMathJax calls MathJax.typeset', () => {
    const mockMathJax = { typeset: jest.fn() };
    (window as any).MathJax = mockMathJax;
    renderer.initializeMathJax();
    expect(mockMathJax.typeset).toHaveBeenCalled();
  });
});