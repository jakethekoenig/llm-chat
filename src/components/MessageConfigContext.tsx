import React, { createContext, useContext, ReactNode } from 'react';

export interface MessageConfig {
  buttons: {
    copy: boolean;
    share: boolean;
    delete: boolean;
    edit: boolean;
  };
  // Add other global configuration options here
}

const defaultConfig: MessageConfig = {
  buttons: {
    copy: true,
    share: true,
    delete: true,
    edit: true,
  },
  // Add other default values here
};

const MessageConfigContext = createContext<MessageConfig>(defaultConfig);

export const MessageConfigProvider: React.FC<{ config: MessageConfig; children: ReactNode }> = ({ config, children }) => {
  return <MessageConfigContext.Provider value={config}>{children}</MessageConfigContext.Provider>;
};

export const useMessageConfig = () => useContext(MessageConfigContext);
