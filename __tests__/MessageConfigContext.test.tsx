import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MessageConfigProvider, useMessageConfig } from '../src/components/MessageConfigContext';

const TestComponent: React.FC = () => {
  const config = useMessageConfig();
  return (
    <div>
      {config.buttons.copy && <span>Copy Button Enabled</span>}
      {config.buttons.share && <span>Share Button Enabled</span>}
      {config.buttons.delete && <span>Delete Button Enabled</span>}
      {config.buttons.edit && <span>Edit Button Enabled</span>}
    </div>
  );
};

test('provides default configuration', () => {
  render(
    <MessageConfigProvider config={{ buttons: { copy: true, share: true, delete: true, edit: true }, theme: { primaryColor: '#000000', secondaryColor: '#FFFFFF', mode: 'light' } }}>
      <TestComponent />
    </MessageConfigProvider>
  );
  expect(screen.getByText('Copy Button Enabled')).toBeInTheDocument();
  expect(screen.getByText('Share Button Enabled')).toBeInTheDocument();
  expect(screen.getByText('Delete Button Enabled')).toBeInTheDocument();
  expect(screen.getByText('Edit Button Enabled')).toBeInTheDocument();
});

test('provides default theme configuration', () => {
  render(
    <MessageConfigProvider config={{ buttons: { copy: true, share: true, delete: true, edit: true }, theme: { primaryColor: '#000000', secondaryColor: '#FFFFFF', mode: 'light' } }}>
      <div data-testid="message-container">
        <TestComponent />
      </div>
    </MessageConfigProvider>
  );
  const container = screen.getByTestId('message-container');
  expect(container).toHaveStyle('background-color: #FFFFFF');
  expect(container).toHaveStyle('color: #000000');
});

test('overrides default configuration', () => {
  render(
    <MessageConfigProvider config={{ buttons: { copy: false, share: false, delete: false, edit: false }, theme: { primaryColor: '#000000', secondaryColor: '#FFFFFF', mode: 'light' } }}>
      <div data-testid="message-container">
        <TestComponent />
      </div>
    </MessageConfigProvider>
  );
  const container = screen.getByTestId('message-container');
  expect(container).toHaveStyle('background-color: #FFFFFF');
  expect(container).toHaveStyle('color: #000000');
});

test('overrides default theme configuration', () => {
  render(
    <MessageConfigProvider config={{ buttons: { copy: true, share: true, delete: true, edit: true }, theme: { primaryColor: '#FF0000', secondaryColor: '#00FF00', mode: 'dark' } }}>
      <div data-testid="message-container">
        <TestComponent />
      </div>
    </MessageConfigProvider>
  );
  const container = screen.getByTestId('message-container');
  expect(container).toHaveStyle('background-color: #333333');
  expect(container).toHaveStyle('color: #FFFFFF');
});