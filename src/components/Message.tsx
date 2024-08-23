import React, { useEffect, useState, useRef } from 'react';
import styled from 'styled-components';
import { Button } from '@mui/material';
import { ContentCopy as CopyIcon, Share as ShareIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { useMessageConfig } from './MessageConfigContext';
import { Renderer } from '../renderers/Renderer';
import { LatexRenderer } from '../renderers/LatexRenderer';
import { Message as MessageType } from '../types/Message';

interface MessageProps extends MessageType {}

const MessageContainer = styled.div.attrs<{ 'data-testid': string }>(props => ({
  'data-testid': props['data-testid'],
}))<{ theme: { primaryColor: string; secondaryColor: string; mode: 'light' | 'dark' } }>`
  border: 1px solid ${props => props.theme.primaryColor};
  padding: 16px;
  margin: 8px 0;
  border-radius: 8px;
  background-color: ${props => props.theme.mode === 'light' ? '#FFFFFF' : '#333333'};
  color: ${props => props.theme.mode === 'light' ? '#000000' : '#FFFFFF'};
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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayedContent);
      if (onCopy) await onCopy();
    } catch (error) {
      console.error('Failed to copy text: ', error);
    }
  };

  const renderContent = (content: string) => {
    let start = 0;
    const elements: JSX.Element[] = [];
    while (start < content.length) {
      let matchedRenderer = null;
      let startSeq: [number, number] | null = null;
      for (const renderer of renderers) {
        startSeq = renderer.detectStartSequence(content, start) as [number, number] | null;
        if (startSeq) {
          matchedRenderer = renderer;
          break;
        }
      }
      if (!startSeq || !matchedRenderer) {
        elements.push(<span key={`plain-${start}`}>{content.slice(start)}</span>);
        break;
      }
      if (startSeq[0] > start) {
        elements.push(<span key={`plain-${start}`}>{content.slice(start, startSeq[0])}</span>);
      }
      const endSeq = matchedRenderer.detectEndSequence(content, startSeq[1]) as [number, number] | null;
      if (!endSeq) {
        elements.push(<span key={`rendered-${startSeq[0]}`}>{matchedRenderer.render(content, startSeq[0], content.length)}</span>);
        break;
      }
      if (endSeq !== null) {
        elements.push(<span key={`rendered-${startSeq[0]}`}>{matchedRenderer.render(content, startSeq[0], endSeq[1])}</span>);
        start = endSeq[1];
      } else {
        elements.push(<span key={`plain-${start}`}>{content.slice(start)}</span>);
        break;
      }
    }
    return elements;
  };
  const mergedButtons = { ...globalConfig.buttons, ...buttons };

  return (
    <MessageContainer theme={globalConfig.theme} data-testid="message-container">
      <MessageContent>{renderContent(displayedContent)}</MessageContent>
      {author && <MessageAuthor>{author}</MessageAuthor>}
      {timestamp && <MessageTimestamp>{new Date(timestamp).toLocaleString()}</MessageTimestamp>}
      <ButtonContainer>
        {mergedButtons.copy && <Button onClick={handleCopy} startIcon={<CopyIcon />}>Copy</Button>}
        {mergedButtons.share && <Button onClick={onShare} startIcon={<ShareIcon />}>Share</Button>}
        {mergedButtons.delete && <Button onClick={onDelete} startIcon={<DeleteIcon />}>Delete</Button>}
        {mergedButtons.edit && <Button onClick={onEdit} startIcon={<EditIcon />}>Edit</Button>}
      </ButtonContainer>
    </MessageContainer>
  );
};

export default Message;
