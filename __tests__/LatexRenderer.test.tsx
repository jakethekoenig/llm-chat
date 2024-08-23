// __tests__/LatexRenderer.test.tsx

import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LatexRenderer } from '../src/renderers/LatexRenderer';

test('renders latex content correctly', () => {
  const renderer = new LatexRenderer();
  const content = "$$E=mc^2$$";
  const renderedContent = renderer.render(content);
  const { getByText } = render(renderedContent);
  expect(getByText("E=mc^2")).toBeInTheDocument();
});