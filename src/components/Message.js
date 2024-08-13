import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { Button } from '@mui/material';
import { Copy as CopyIcon, Share as ShareIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';

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

const Message = ({ content, author, timestamp, buttons, onCopy, onShare, onDelete, onEdit }) => {
  return (
    <MessageContainer>
      <MessageContent>{content}</MessageContent>
      {author && <MessageAuthor>{author}</MessageAuthor>}
      {timestamp && <MessageTimestamp>{new Date(timestamp).toLocaleString()}</MessageTimestamp>}
      <ButtonContainer>
        {buttons.copy && <Button onClick={onCopy} startIcon={<CopyIcon />}>Copy</Button>}
        {buttons.share && <Button onClick={onShare} startIcon={<ShareIcon />}>Share</Button>}
        {buttons.delete && <Button onClick={onDelete} startIcon={<DeleteIcon />}>Delete</Button>}
        {buttons.edit && <Button onClick={onEdit} startIcon={<EditIcon />}>Edit</Button>}
      </ButtonContainer>
    </MessageContainer>
  );
};

Message.propTypes = {
  content: PropTypes.string.isRequired,
  author: PropTypes.string,
  timestamp: PropTypes.string,
  buttons: PropTypes.shape({
    copy: PropTypes.bool,
    share: PropTypes.bool,
    delete: PropTypes.bool,
    edit: PropTypes.bool,
  }),
  onCopy: PropTypes.func,
  onShare: PropTypes.func,
  onDelete: PropTypes.func,
  onEdit: PropTypes.func,
};

Message.defaultProps = {
  buttons: {
    copy: false,
    share: false,
    delete: false,
    edit: false,
  },
};

export default Message;