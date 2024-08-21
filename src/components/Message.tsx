import React, { useEffect, useState, useRef } from 'react';
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
  const [displayedContent, setDisplayedContent] = useState<string>('');
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    setDisplayedContent(''); // Reset content when prop changes

    const processContent = async () => {
      if (typeof content === 'string') {
        setDisplayedContent(content);
      } else {
        for await (const chunk of content) {
          if (!isMountedRef.current) break;
          setDisplayedContent(prev => prev + chunk);
        }
      }
    };

    processContent();

    return () => {
      isMountedRef.current = false;
    };
  }, [content]);

  const renderContent = (content: string) => {
    let start = 0;
    const elements: JSX.Element[] = [];
    while (start < content.length) {
      let matchedRenderer = null;
      let startSeq = null;
      for (const renderer of renderers) {
        startSeq = renderer.detectStartSequence(content, start);
        if (typeof startSeq === 'number' || Array.isArray(startSeq)) {
          matchedRenderer = renderer;
          break;
        }
      }
      if (typeof startSeq === 'number' || Array.isArray(startSeq)) {
        elements.push(<span key={`plain-${start}`}>{content.slice(start, Array.isArray(startSeq) ? startSeq[0] : startSeq)}</span>);
        start = Array.isArray(startSeq) ? startSeq[1] : startSeq;
        continue;
      }
      if (!startSeq || !matchedRenderer) {
        elements.push(<span key={`plain-${start}`}>{content.slice(start)}</span>);
        break;
      }
      const endSeq = matchedRenderer.detectEndSequence(content, Array.isArray(startSeq) ? startSeq[1] : startSeq);
      if (typeof endSeq === 'number' || Array.isArray(endSeq)) {
        elements.push(<span key={`plain-${start}`}>{content.slice(start, Array.isArray(endSeq) ? endSeq[0] : endSeq)}</span>);
        start = Array.isArray(endSeq) ? endSeq[1] : endSeq;
        continue;
      }
      elements.push(<span key={`rendered-${start}`} dangerouslySetInnerHTML={{ __html: matchedRenderer.render(content, Array.isArray(startSeq) ? startSeq[0] : startSeq, Array.isArray(endSeq) ? endSeq[0] : endSeq) }} />);
      start = Array.isArray(endSeq) ? endSeq[1] : endSeq;
    }
    return elements;
  };
  const mergedButtons = { ...globalConfig.buttons, ...buttons };

  return (
    <MessageContainer>
      <MessageContent>{renderContent(displayedContent)}</MessageContent>
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
