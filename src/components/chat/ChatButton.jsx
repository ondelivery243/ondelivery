// src/components/chat/ChatButton.jsx
import { useState, useEffect } from 'react'
import {
  IconButton,
  Badge,
  Tooltip,
  Fab,
  useTheme,
  useMediaQuery,
  alpha
} from '@mui/material'
import {
  Chat as ChatIcon,
  ChatBubble as ChatBubbleIcon
} from '@mui/icons-material'
import ChatWindow from './ChatWindow'
import { subscribeToChatRoom, getUnreadCount } from '../../services/chatService'

/**
 * ChatButton - Botón flotante para abrir el chat
 * 
 * @param {object} service - Datos del servicio
 * @param {object} currentUser - Usuario actual { id, name, role }
 * @param {object} otherParty - Datos de la otra parte { name, role }
 * @param {string} variant - 'fab' | 'icon' | 'chip'
 */
export default function ChatButton({
  service,
  currentUser,
  otherParty,
  variant = 'fab',
  onChatOpen,
  onChatClose,
  size = 'medium'
}) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  
  const [chatOpen, setChatOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [chatRoom, setChatRoom] = useState(null)
  const [expanded, setExpanded] = useState(true)

  // Suscribirse a cambios en el chat room
  useEffect(() => {
    if (!service?.id || !currentUser?.role) return

    const unsubscribe = subscribeToChatRoom(service.id, (room) => {
      setChatRoom(room)
      if (room) {
        const count = currentUser.role === 'restaurant' 
          ? (room.unreadByRestaurant || 0)
          : (room.unreadByDriver || 0)
        setUnreadCount(count)
      }
    })

    return () => unsubscribe()
  }, [service?.id, currentUser?.role])

  // Abrir chat
  const handleOpenChat = () => {
    setChatOpen(true)
    onChatOpen?.()
  }

  // Cerrar chat
  const handleCloseChat = () => {
    setChatOpen(false)
    onChatClose?.()
  }

  // Toggle expandir/colapsar
  const handleToggleExpand = () => {
    setExpanded(!expanded)
  }

  // No mostrar si no hay servicio o usuario
  if (!service?.id || !currentUser?.id) return null

  const buttonColor = currentUser.role === 'restaurant' ? 'primary' : 'success'

  // Renderizar según variante
  if (variant === 'icon') {
    return (
      <>
        <Tooltip title={unreadCount > 0 ? `${unreadCount} mensajes nuevos` : 'Chat'}>
          <IconButton
            onClick={handleOpenChat}
            size={size}
            sx={{
              position: 'relative',
              ...(unreadCount > 0 && {
                animation: 'pulse 2s infinite'
              })
            }}
          >
            <Badge badgeContent={unreadCount} color="error">
              <ChatIcon color={buttonColor} />
            </Badge>
          </IconButton>
        </Tooltip>

        <ChatWindow
          service={service}
          currentUser={currentUser}
          otherParty={otherParty}
          open={chatOpen}
          onClose={handleCloseChat}
          miniMode={isMobile}
          expanded={expanded}
          onToggleExpand={handleToggleExpand}
        />
      </>
    )
  }

  if (variant === 'chip') {
    return (
      <>
        <Badge badgeContent={unreadCount} color="error">
          <Chip
            icon={<ChatIcon />}
            label="Chat"
            onClick={handleOpenChat}
            color={buttonColor}
            size={size === 'small' ? 'small' : 'medium'}
            sx={{ cursor: 'pointer' }}
          />
        </Badge>

        <ChatWindow
          service={service}
          currentUser={currentUser}
          otherParty={otherParty}
          open={chatOpen}
          onClose={handleCloseChat}
          miniMode={isMobile}
          expanded={expanded}
          onToggleExpand={handleToggleExpand}
        />
      </>
    )
  }

  // Variante FAB por defecto
  return (
    <>
      <Fab
        color={buttonColor}
        size={isMobile ? 'medium' : 'large'}
        onClick={handleOpenChat}
        sx={{
          position: 'fixed',
          bottom: isMobile ? 72 : 24,
          right: 24,
          zIndex: 1000,
          ...(unreadCount > 0 && {
            animation: 'pulse 2s infinite',
            '@keyframes pulse': {
              '0%': { boxShadow: '0 0 0 0 rgba(25, 118, 210, 0.7)' },
              '70%': { boxShadow: '0 0 0 10px rgba(25, 118, 210, 0)' },
              '100%': { boxShadow: '0 0 0 0 rgba(25, 118, 210, 0)' }
            }
          })
        }}
      >
        <Badge badgeContent={unreadCount} color="error">
          <ChatIcon />
        </Badge>
      </Fab>

      <ChatWindow
        service={service}
        currentUser={currentUser}
        otherParty={otherParty}
        open={chatOpen}
        onClose={handleCloseChat}
        miniMode={true}
        expanded={expanded}
        onToggleExpand={handleToggleExpand}
      />
    </>
  )
}

// Importar Chip
import { Chip } from '@mui/material'
