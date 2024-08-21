import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Button } from '@mui/material';
import { ContentCopy as CopyIcon, Share as ShareIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { useMessageConfig } from './MessageConfigContext';
import { Renderer } from '../renderers/Renderer';

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
  renderers?: Renderer[];
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

const Message: React.FC<MessageProps> = ({ content, author, timestamp, buttons = {}, onCopy, onShare, onDelete, onEdit, renderers = [] }) => {
  const globalConfig = useMessageConfig();
  const [displayedContent, setDisplayedContent] = useState<JSX.Element | string>('');

  useEffect(() => {
    let isMounted = true;
    const processContent = async (content: string | AsyncIterable<string>) => {
      let accumulatedContent = '';
      const renderContent = (content: string) => {
        let start = 0;
        while (start < content.length) {
          let matchedRenderer = null;
          let startSeq = null;
          for (const renderer of renderers) {
            startSeq = renderer.detectStartSequence(content, start);
            if (typeof startSeq !== 'number') {
              matchedRenderer = renderer;
              break;
            }
          }
          if (!matchedRenderer || typeof startSeq === 'number') {
            start = startSeq || content.length;
            continue;
          }
          const endSeq = matchedRenderer.detectEndSequence(content, startSeq[1]);
          if (typeof endSeq === 'number') {
            start = endSeq;
            continue;
          }
          return matchedRenderer.render(content, startSeq[0], endSeq[1]);
        }
        return content;
      };
      if (typeof content === 'string') {
        setDisplayedContent(renderContent(content));
      } else {
        for await (const chunk of content) {
          if (!isMounted) break;
          accumulatedContent += chunk;
          setDisplayedContent(renderContent(accumulatedContent));
        }
      }
    };

    processContent(content);

    return () => {
      isMounted = false;
    };
  }, [content, renderers]);

  const mergedButtons = { ...globalConfig.buttons, ...buttons };

  return (
    <MessageContainer>
      <MessageContent dangerouslySetInnerHTML={{ __html: displayedContent }} />
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