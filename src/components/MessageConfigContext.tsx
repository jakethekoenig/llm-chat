import React, { createContext, useContext, ReactNode } from 'react';

export interface MessageConfig {
  buttons: {
    copy: 'enabled' | 'disabled' | 'menu-ed';
    share: 'enabled' | 'disabled' | 'menu-ed';
    delete: 'enabled' | 'disabled' | 'menu-ed';
    edit: 'enabled' | 'disabled' | 'menu-ed';
  };
  theme: {
    primaryColor: string;
    secondaryColor: string;
    mode: 'light' | 'dark';
  };
}

export const defaultConfig: MessageConfig = {
  buttons: {
    copy: 'enabled',
    share: 'enabled',
    delete: 'enabled',
    edit: 'enabled',
  },
  theme: {
    primaryColor: '#000000',
    secondaryColor: '#FFFFFF',
    mode: 'light',
  },
};

const MessageConfigContext = createContext<MessageConfig>(defaultConfig);

export const MessageConfigProvider: React.FC<{ config: MessageConfig; children: ReactNode }> = ({ config, children }) => {
  return <MessageConfigContext.Provider value={config}>{children}</MessageConfigContext.Provider>;
};

export const useMessageConfig = () => useContext(MessageConfigContext);
