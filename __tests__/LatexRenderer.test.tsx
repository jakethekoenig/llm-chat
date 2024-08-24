// __tests__/LatexRenderer.test.tsx

import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MathJaxContext } from 'better-react-mathjax';
import { LatexRenderer } from '../src/renderers/LatexRenderer';

test('renders latex content correctly', () => {
  const renderer = new LatexRenderer();
  const content = "$$E=mc^2$$";
  const renderedContent = renderer.render(content, 0, content.length);
  const { getByText } = render(
    <MathJaxContext>
      {renderedContent}
    </MathJaxContext>
  );
  expect(getByText("E=mc^2")).toBeInTheDocument();
});