import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Message from '../src/components/Message';

test('renders message content', () => {
  render(<Message content="Test message" />);
  expect(screen.getByText('Test message')).toBeInTheDocument();
});

test('renders author and timestamp', () => {
  render(<Message content="Test message" author="Test Author" timestamp="2023-01-01T00:00:00Z" />);
  expect(screen.getByText('Test Author')).toBeInTheDocument();
  expect(screen.getByText(new Date('2023-01-01T00:00:00Z').toLocaleString())).toBeInTheDocument();
});

test('renders control buttons based on props', () => {
  const onCopy = jest.fn();
  render(<Message content="Test message" buttons={{ copy: true }} onCopy={onCopy} />);
  fireEvent.click(screen.getByText('Copy'));
  expect(onCopy).toHaveBeenCalled();
});
