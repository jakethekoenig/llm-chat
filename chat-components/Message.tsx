import React, { useEffect, useState, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { Button, Menu, MenuItem } from '@mui/material';
import { ContentCopy as CopyIcon, Share as ShareIcon, Delete as DeleteIcon, Edit as EditIcon, MoreVert as MoreVertIcon } from '@mui/icons-material';
import { useMessageConfig } from './MessageConfigContext';
import { Renderer } from './renderers/Renderer';
import { Message as MessageType } from './types/Message';

interface MessageProps extends MessageType {
  hasSiblings?: boolean;
  currentIndex?: number;
  totalSiblings?: number;
  isAuthor?: boolean; // New prop
}

const NavigationButtons = ({ onPrev, onNext, hasSiblings, currentIndex = 0, totalSiblings = 0 }: { onPrev: () => void, onNext: () => void, hasSiblings: boolean | undefined, currentIndex: number, totalSiblings: number }) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
    {hasSiblings && <Button onClick={onPrev} disabled={currentIndex === 0}>&lt;</Button>}
    {hasSiblings && <span>{currentIndex + 1} / {totalSiblings}</span>}
    {hasSiblings && <Button onClick={onNext} disabled={currentIndex === totalSiblings - 1}>&gt;</Button>}
  </div>
);

const MessageContainer = styled.div.attrs<{ 'data-testid': string }>(props => ({
  'data-testid': props['data-testid'],
}))<{ theme: { primaryColor: string; secondaryColor: string; mode: 'light' | 'dark' }, isAuthor?: boolean }>`
  border: 1px solid ${props => props.theme.primaryColor};
  padding: 16px;
  margin: 8px 0;
  border-radius: 8px;
  background-color: ${props => props.isAuthor ? '#e0f7fa' : (props.theme.mode === 'light' ? '#FFFFFF' : '#333333')}; // Change background color if isAuthor
  color: ${props => props.theme.mode === 'light' ? '#000000' : '#FFFFFF'};
  text-align: ${props => props.isAuthor ? 'right' : 'left'}; // Right-justify if isAuthor
`;

const MessageContent = styled.span`
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

const Message: React.FC<MessageProps> = ({ content, author, timestamp, buttons = {}, onCopy, onShare, onDelete, onEdit, renderers = [], onClick, onPrev, onNext, hasSiblings, currentIndex = 0, totalSiblings = 0 }) => {
  const globalConfig = useMessageConfig();
  const [displayedContent, setDisplayedContent] = useState<string>('');
  const isMountedRef = useRef(true);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);

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

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
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
  const finalButtons = {
    copy: mergedButtons.copy !== 'disabled' ? mergedButtons.copy : false,
    share: mergedButtons.share !== 'disabled' ? mergedButtons.share : false,
    delete: mergedButtons.delete !== 'disabled' ? mergedButtons.delete : false,
    edit: mergedButtons.edit !== 'disabled' ? mergedButtons.edit : false,
  };

  return (
    <MessageContainer theme={globalConfig.theme} data-testid="message-container" onClick={onClick} isAuthor={isAuthor}>
      <MessageContent>{renderContent(displayedContent)}</MessageContent>
      {author && <><br></br><MessageAuthor>{author}</MessageAuthor></>}
      {timestamp && <MessageTimestamp>{new Date(timestamp).toLocaleString()}</MessageTimestamp>}
      <ButtonContainer>
        {finalButtons.copy === 'enabled' && <Button onClick={handleCopy} startIcon={<CopyIcon />}>Copy</Button>}
        {finalButtons.share === 'enabled' && <Button onClick={onShare} startIcon={<ShareIcon />}>Share</Button>}
        {finalButtons.delete === 'enabled' && <Button onClick={onDelete} startIcon={<DeleteIcon />}>Delete</Button>}
        {finalButtons.edit === 'enabled' && <Button onClick={onEdit} startIcon={<EditIcon />}>Edit</Button>}
        {(finalButtons.copy === 'menu-ed' || finalButtons.share === 'menu-ed' || finalButtons.delete === 'menu-ed' || finalButtons.edit === 'menu-ed') && (
          <>
            <Button startIcon={<MoreVertIcon />} onClick={handleMenuOpen}>
              Menu
            </Button>
            <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={handleMenuClose}>
              {finalButtons.copy === 'menu-ed' && <MenuItem onClick={handleCopy}>Copy</MenuItem>}
              {finalButtons.share === 'menu-ed' && <MenuItem onClick={onShare}>Share</MenuItem>}
              {finalButtons.delete === 'menu-ed' && <MenuItem onClick={onDelete}>Delete</MenuItem>}
              {finalButtons.edit === 'menu-ed' && <MenuItem onClick={onEdit}>Edit</MenuItem>}
            </Menu>
          </>
        )}
      </ButtonContainer>
      {onPrev && onNext && (
        <NavigationButtons onPrev={onPrev} onNext={onNext} hasSiblings={hasSiblings} currentIndex={currentIndex} totalSiblings={totalSiblings} />
      )}
    </MessageContainer>
  );
};
export default Message;
