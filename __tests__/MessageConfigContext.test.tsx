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
    <MessageConfigProvider config={{ buttons: { copy: true, share: true, delete: true, edit: true } }}>
      <TestComponent />
    </MessageConfigProvider>
  );
  expect(screen.getByText('Copy Button Enabled')).toBeInTheDocument();
  expect(screen.getByText('Share Button Enabled')).toBeInTheDocument();
  expect(screen.getByText('Delete Button Enabled')).toBeInTheDocument();
  expect(screen.getByText('Edit Button Enabled')).toBeInTheDocument();
});

test('overrides default configuration', () => {
  render(
    <MessageConfigProvider config={{ buttons: { copy: false, share: false, delete: false, edit: false } }}>
      <TestComponent />
    </MessageConfigProvider>
  );
  expect(screen.queryByText('Copy Button Enabled')).not.toBeInTheDocument();
  expect(screen.queryByText('Share Button Enabled')).not.toBeInTheDocument();
  expect(screen.queryByText('Delete Button Enabled')).not.toBeInTheDocument();
  expect(screen.queryByText('Edit Button Enabled')).not.toBeInTheDocument();
});

render(
  <MessageConfigProvider config={{ buttons: { copy: 'menu-ed', share: 'menu-ed', delete: 'menu-ed', edit: 'menu-ed' } }}>
    <TestComponent />
  </MessageConfigProvider>
);
expect(screen.getByText('Menu')).toBeInTheDocument();
fireEvent.click(screen.getByText('Menu'));
expect(screen.getByText('Copy')).toBeInTheDocument();
expect(screen.getByText('Share')).toBeInTheDocument();
expect(screen.getByText('Delete')).toBeInTheDocument();
expect(screen.getByText('Edit')).toBeInTheDocument();