import React, { createContext, useContext, ReactNode } from 'react';

interface MessageConfig {
  buttons: {
    copy: 'enabled' | 'disabled' | 'menu-ed';
    share: 'enabled' | 'disabled' | 'menu-ed';
    delete: 'enabled' | 'disabled' | 'menu-ed';
    edit: 'enabled' | 'disabled' | 'menu-ed';
  };
  // Add other global configuration options here
}

const defaultConfig: MessageConfig = {
  buttons: {
    copy: 'enabled',
    share: 'enabled',
    delete: 'enabled',
    edit: 'enabled',
  },
  // Add other default values here
};

const MessageConfigContext = createContext<MessageConfig>(defaultConfig);

export const MessageConfigProvider: React.FC<{ config: MessageConfig; children: ReactNode }> = ({ config, children }) => {
  return <MessageConfigContext.Provider value={config}>{children}</MessageConfigContext.Provider>;
};

export const useMessageConfig = () => useContext(MessageConfigContext);