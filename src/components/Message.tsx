import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Button } from '@mui/material';
import { ContentCopy as CopyIcon, Share as ShareIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { useMessageConfig } from './MessageConfigContext';

interface MessageProps {
  content: string | AsyncIterable<string>;
  author?: string;
  timestamp?: string;
  buttons?: {
    copy?: boolean;
    share?: boolean;
    delete?: boolean;
    edit?: boolean;
  };
  onCopy?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
}

const MessageContainer = styled.div`
  border: 1px solid #ccc;
  padding: 16px;
  margin: 8px 0;
  border-radius: 8px;
`;

const MessageContent = styled.p`
  margin: 0;
`;

const MessageAuthor = styled.span`
  font-weight: bold;
`;

const MessageTimestamp = styled.span`
  font-size: 0.8em;
  color: #666;
`;

const ButtonContainer = styled.div`
  margin-top: 8px;
  display: flex;
  gap: 8px;
`;

const Message: React.FC<MessageProps> = ({ content, author, timestamp, buttons = {}, onCopy, onShare, onDelete, onEdit }) => {
  const globalConfig = useMessageConfig();
  const [displayedContent, setDisplayedContent] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    if (typeof content === 'string') {
      setDisplayedContent(content);
    } else {
      const iterateContent = async () => {
        let accumulatedContent = '';
        for await (const chunk of content) {
          if (!isMounted) break;
          accumulatedContent += chunk;
          setDisplayedContent(accumulatedContent);
        }
      };
      iterateContent();
    }
    return () => {
      isMounted = false;
    };
  }, [content]);

  const mergedButtons = { ...globalConfig.buttons, ...buttons };

  return (
    <MessageContainer>
      <MessageContent>{displayedContent}</MessageContent>
      {author && <MessageAuthor>{author}</MessageAuthor>}
      {timestamp && <MessageTimestamp>{new Date(timestamp).toLocaleString()}</MessageTimestamp>}
      <ButtonContainer>
        {mergedButtons.copy && <Button onClick={onCopy} startIcon={<CopyIcon />}>Copy</Button>}
        {mergedButtons.share && <Button onClick={onShare} startIcon={<ShareIcon />}>Share</Button>}
        {mergedButtons.delete && <Button onClick={onDelete} startIcon={<DeleteIcon />}>Delete</Button>}
        {mergedButtons.edit && <Button onClick={onEdit} startIcon={<EditIcon />}>Edit</Button>}
      </ButtonContainer>
    </MessageContainer>
  );
};

export default Message;