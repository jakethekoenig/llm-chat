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

test('renders share button and triggers onShare', () => {
  const onShare = jest.fn();
  render(<Message content="Test message" buttons={{ share: true }} onShare={onShare} />);
  fireEvent.click(screen.getByText('Share'));
  expect(onShare).toHaveBeenCalled();
});

test('renders delete button and triggers onDelete', () => {
  const onDelete = jest.fn();
  render(<Message content="Test message" buttons={{ delete: true }} onDelete={onDelete} />);
  fireEvent.click(screen.getByText('Delete'));
  expect(onDelete).toHaveBeenCalled();
});

test('renders edit button and triggers onEdit', () => {
  const onEdit = jest.fn();
  render(<Message content="Test message" buttons={{ edit: true }} onEdit={onEdit} />);
  fireEvent.click(screen.getByText('Edit'));
  expect(onEdit).toHaveBeenCalled();
});
