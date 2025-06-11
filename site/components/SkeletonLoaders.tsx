import React from 'react';
import { Skeleton, Box, Card, CardContent, Stack, Divider } from '@mui/material';

// Generic skeleton for text lines
export const TextSkeleton: React.FC<{ lines?: number; width?: string | number }> = ({ 
  lines = 3, 
  width = '100%' 
}) => (
  <Box sx={{ width }}>
    {Array.from({ length: lines }, (_, index) => (
      <Skeleton
        key={index}
        variant="text"
        sx={{
          fontSize: '1rem',
          width: index === lines - 1 ? '60%' : '100%', // Last line shorter
          mb: 0.5
        }}
      />
    ))}
  </Box>
);

// Skeleton for a single message
export const MessageSkeleton: React.FC<{ isUser?: boolean }> = ({ isUser = false }) => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      mb: 2
    }}
  >
    <Card
      sx={{
        maxWidth: '70%',
        minWidth: '200px',
        bgcolor: isUser ? 'primary.light' : 'grey.100'
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Skeleton variant="circular" width={24} height={24} sx={{ mr: 1 }} />
          <Skeleton variant="text" width={80} sx={{ fontSize: '0.875rem' }} />
        </Box>
        <TextSkeleton lines={isUser ? 1 : 3} />
        <Skeleton variant="text" width={60} sx={{ fontSize: '0.75rem', mt: 1 }} />
      </CardContent>
    </Card>
  </Box>
);

// Skeleton for conversation view (multiple messages)
export const ConversationSkeleton: React.FC = () => (
  <Box sx={{ p: 2 }}>
    <Skeleton variant="text" width={200} sx={{ fontSize: '1.5rem', mb: 3 }} />
    <Stack spacing={2}>
      <MessageSkeleton isUser={true} />
      <MessageSkeleton isUser={false} />
      <MessageSkeleton isUser={true} />
      <MessageSkeleton isUser={false} />
    </Stack>
  </Box>
);

// Skeleton for conversation list item
export const ConversationListItemSkeleton: React.FC = () => (
  <Card sx={{ mb: 1, cursor: 'pointer' }}>
    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Skeleton variant="circular" width={32} height={32} sx={{ mr: 2 }} />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="60%" sx={{ fontSize: '1rem' }} />
          <Skeleton variant="text" width="40%" sx={{ fontSize: '0.875rem' }} />
        </Box>
      </Box>
      <TextSkeleton lines={2} />
    </CardContent>
  </Card>
);

// Skeleton for full conversation list
export const ConversationListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <Box sx={{ p: 2 }}>
    <Skeleton variant="text" width={250} sx={{ fontSize: '1.5rem', mb: 3 }} />
    
    {/* New conversation form skeleton */}
    <Card sx={{ mb: 3, p: 2 }}>
      <Stack spacing={2}>
        <Skeleton variant="rectangular" height={40} />
        <Skeleton variant="rectangular" height={40} />
        <Skeleton variant="rectangular" height={40} />
        <Skeleton variant="rectangular" width={150} height={36} />
      </Stack>
    </Card>
    
    <Divider sx={{ mb: 2 }} />
    
    {/* Conversation list items */}
    {Array.from({ length: count }, (_, index) => (
      <ConversationListItemSkeleton key={index} />
    ))}
  </Box>
);

// Skeleton for form inputs
export const FormSkeleton: React.FC<{ fields?: number }> = ({ fields = 3 }) => (
  <Stack spacing={2} sx={{ maxWidth: 400 }}>
    <Skeleton variant="text" width={200} sx={{ fontSize: '1.5rem', mb: 2 }} />
    {Array.from({ length: fields }, (_, index) => (
      <Skeleton key={index} variant="rectangular" height={56} />
    ))}
    <Skeleton variant="rectangular" width={120} height={40} />
  </Stack>
);

// Loading overlay for specific components
export const LoadingOverlay: React.FC<{ 
  isLoading: boolean; 
  children: React.ReactNode;
  skeleton?: React.ReactNode;
}> = ({ isLoading, children, skeleton }) => {
  if (isLoading) {
    return <>{skeleton}</>;
  }
  return <>{children}</>;
};
