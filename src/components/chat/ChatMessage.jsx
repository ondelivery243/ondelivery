// src/components/chat/ChatMessage.jsx
import { memo } from 'react'
import {
  Box,
  Typography,
  Paper,
  Avatar,
  Chip,
  Stack
} from '@mui/material'
import {
  Person as PersonIcon,
  Store as StoreIcon,
  TwoWheeler as BikeIcon,
  Info as InfoIcon,
  Check as CheckIcon,
  DoneAll as DoneAllIcon,
  LocationOn as LocationIcon
} from '@mui/icons-material'
import { formatChatTime } from '../../services/chatService'

const ChatMessage = memo(function ChatMessage({ 
  message, 
  currentUserId, 
  showAvatar = true 
}) {
  const {
    senderId,
    senderName,
    senderRole,
    message: text,
    type,
    metadata,
    timestamp,
    read
  } = message

  const isCurrentUser = senderId === currentUserId
  const isSystem = senderRole === 'system'

  // Mensaje de sistema
  if (isSystem) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', my: 1 }}>
        <Chip
          icon={<InfoIcon />}
          label={text}
          size="small"
          sx={{
            bgcolor: 'grey.200',
            color: 'text.secondary',
            fontSize: '0.75rem',
            '& .MuiChip-icon': { fontSize: 16 }
          }}
        />
      </Box>
    )
  }

  // Mensaje de ubicación
  if (type === 'location' && metadata) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: isCurrentUser ? 'flex-end' : 'flex-start',
        mb: 1.5
      }}>
        <Box sx={{ maxWidth: '80%', display: 'flex', flexDirection: isCurrentUser ? 'row-reverse' : 'row', gap: 1 }}>
          {showAvatar && !isCurrentUser && (
            <Avatar 
              sx={{ 
                width: 28, 
                height: 28, 
                bgcolor: senderRole === 'restaurant' ? 'primary.main' : 'success.main',
                fontSize: '0.75rem'
              }}
            >
              {senderRole === 'restaurant' ? <StoreIcon sx={{ fontSize: 16 }} /> : <BikeIcon sx={{ fontSize: 16 }} />}
            </Avatar>
          )}
          <Box>
            {!isCurrentUser && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                {senderName}
              </Typography>
            )}
            <Paper
              component="a"
              href={`https://www.google.com/maps?q=${metadata.latitude},${metadata.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                p: 1.5,
                bgcolor: isCurrentUser ? 'primary.main' : 'grey.100',
                color: isCurrentUser ? 'white' : 'text.primary',
                borderRadius: 2,
                borderTopLeftRadius: isCurrentUser ? 8 : 4,
                borderTopRightRadius: isCurrentUser ? 4 : 8,
                display: 'block',
                textDecoration: 'none',
                cursor: 'pointer',
                '&:hover': { opacity: 0.9 }
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <LocationIcon sx={{ fontSize: 20 }} />
                <Typography variant="body2" fontWeight="medium">Ver ubicación</Typography>
              </Stack>
              {metadata.address && (
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.8 }}>
                  {metadata.address}
                </Typography>
              )}
            </Paper>
            <Stack direction="row" spacing={0.5} alignItems="center" justifyContent={isCurrentUser ? 'flex-end' : 'flex-start'} sx={{ mt: 0.5 }}>
              <Typography variant="caption" color="text.disabled">{formatChatTime(timestamp)}</Typography>
              {isCurrentUser && (read ? <DoneAllIcon sx={{ fontSize: 14, color: 'primary.main' }} /> : <CheckIcon sx={{ fontSize: 14, color: 'text.disabled' }} />)}
            </Stack>
          </Box>
        </Box>
      </Box>
    )
  }

  // Mensaje de texto normal (Estilo WhatsApp)
  return (
    <Box sx={{ display: 'flex', justifyContent: isCurrentUser ? 'flex-end' : 'flex-start', mb: 1.5 }}>
      <Box sx={{ maxWidth: '80%', display: 'flex', flexDirection: isCurrentUser ? 'row-reverse' : 'row', gap: 1 }}>
        {showAvatar && !isCurrentUser && (
          <Avatar sx={{ width: 28, height: 28, bgcolor: senderRole === 'restaurant' ? 'primary.main' : 'success.main', fontSize: '0.75rem' }}>
            {senderRole === 'restaurant' ? <StoreIcon sx={{ fontSize: 16 }} /> : <BikeIcon sx={{ fontSize: 16 }} />}
          </Avatar>
        )}
        <Box>
          {!isCurrentUser && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>{senderName}</Typography>
          )}
          <Paper
            sx={{
              px: 1.5,
              py: 1,
              bgcolor: isCurrentUser ? 'primary.main' : 'grey.100',
              color: isCurrentUser ? 'white' : 'text.primary',
              borderRadius: 2,
              borderTopLeftRadius: isCurrentUser ? 8 : 4,
              borderTopRightRadius: isCurrentUser ? 4 : 8,
              wordBreak: 'break-word'
            }}
          >
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{text}</Typography>
          </Paper>
          <Stack direction="row" spacing={0.5} alignItems="center" justifyContent={isCurrentUser ? 'flex-end' : 'flex-start'} sx={{ mt: 0.5 }}>
            <Typography variant="caption" color="text.disabled">{formatChatTime(timestamp)}</Typography>
            {isCurrentUser && (read ? <DoneAllIcon sx={{ fontSize: 14, color: 'primary.main' }} /> : <CheckIcon sx={{ fontSize: 14, color: 'text.disabled' }} />)}
          </Stack>
        </Box>
      </Box>
    </Box>
  )
})

export default ChatMessage