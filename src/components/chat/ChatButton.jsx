// src/components/chat/ChatButton.jsx
import { useState, useEffect, useRef } from 'react'
import {
  IconButton,
  Badge,
  Tooltip,
  Fab,
  useTheme,
  useMediaQuery,
  alpha,
  Snackbar,
  Alert,
  Box,
  Typography,
  Chip
} from '@mui/material'
import {
  Chat as ChatIcon,
  ChatBubble as ChatBubbleIcon,
  Close as CloseIcon
} from '@mui/icons-material'
import ChatWindow from './ChatWindow'
import { subscribeToChatRoom, getUnreadCount, subscribeToMessages } from '../../services/chatService'

// Crear contexto de audio para el sonido de notificación
const playNotificationSound = () => {
  try {
    // Crear contexto de audio
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    
    // Crear osciladores para un sonido agradable
    const oscillator1 = audioContext.createOscillator()
    const oscillator2 = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    // Configurar osciladores
    oscillator1.type = 'sine'
    oscillator1.frequency.setValueAtTime(880, audioContext.currentTime) // La5
    oscillator1.frequency.setValueAtTime(1108.73, audioContext.currentTime + 0.1) // Do#6
    
    oscillator2.type = 'sine'
    oscillator2.frequency.setValueAtTime(1108.73, audioContext.currentTime + 0.15) // Do#6
    oscillator2.frequency.setValueAtTime(1318.51, audioContext.currentTime + 0.25) // Mi6
    
    // Configurar volumen
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
    
    // Conectar nodos
    oscillator1.connect(gainNode)
    oscillator2.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    // Reproducir
    oscillator1.start(audioContext.currentTime)
    oscillator1.stop(audioContext.currentTime + 0.15)
    oscillator2.start(audioContext.currentTime + 0.15)
    oscillator2.stop(audioContext.currentTime + 0.4)
    
    // Cerrar contexto después de reproducir
    setTimeout(() => {
      audioContext.close()
    }, 500)
  } catch (error) {
    console.log('No se pudo reproducir sonido:', error)
  }
}

/**
 * ChatButton - Botón flotante para abrir el chat con notificaciones
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
  const [showNotification, setShowNotification] = useState(false)
  const [lastMessagePreview, setLastMessagePreview] = useState('')
  
  // Referencia para rastrear mensajes previos
  const prevUnreadCount = useRef(0)
  const prevMessageCount = useRef(0)

  // Suscribirse a cambios en el chat room
  useEffect(() => {
    if (!service?.id || !currentUser?.role) return

    const unsubscribe = subscribeToChatRoom(service.id, (room) => {
      setChatRoom(room)
      if (room) {
        const count = currentUser.role === 'restaurant' 
          ? (room.unreadByRestaurant || 0)
          : (room.unreadByDriver || 0)
        
        // Detectar si hay nuevos mensajes (el contador aumentó)
        if (count > prevUnreadCount.current && prevUnreadCount.current !== 0 && !chatOpen) {
          // Reproducir sonido de notificación
          playNotificationSound()
          
          // Mostrar notificación visual
          setLastMessagePreview(room.lastMessage || 'Nuevo mensaje')
          setShowNotification(true)
          
          // Vibrar en móviles
          if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200])
          }
        }
        
        prevUnreadCount.current = count
        setUnreadCount(count)
      }
    })

    return () => unsubscribe()
  }, [service?.id, currentUser?.role, chatOpen])

  // Suscribirse a mensajes para detectar nuevos
  useEffect(() => {
    if (!service?.id || chatOpen) return

    const unsubscribe = subscribeToMessages(service.id, (messages) => {
      // Detectar si llegaron nuevos mensajes
      if (messages.length > prevMessageCount.current && prevMessageCount.current > 0) {
        const lastMessage = messages[messages.length - 1]
        // Solo notificar si no es nuestro propio mensaje
        if (lastMessage && lastMessage.senderId !== currentUser?.id) {
          setLastMessagePreview(lastMessage.message || 'Nuevo mensaje')
        }
      }
      prevMessageCount.current = messages.length
    })

    return () => unsubscribe()
  }, [service?.id, currentUser?.id, chatOpen])

  // Cerrar notificación automáticamente
  useEffect(() => {
    if (showNotification) {
      const timer = setTimeout(() => {
        setShowNotification(false)
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [showNotification])

  // Abrir chat
  const handleOpenChat = () => {
    setChatOpen(true)
    setShowNotification(false)
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
      {/* Notificación flotante */}
      {showNotification && unreadCount > 0 && !chatOpen && (
        <Box
          sx={{
            position: 'fixed',
            bottom: isMobile ? 140 : 100,
            right: 24,
            zIndex: 1100,
            animation: 'slideInUp 0.3s ease-out',
            '@keyframes slideInUp': {
              '0%': { transform: 'translateY(20px)', opacity: 0 },
              '100%': { transform: 'translateY(0)', opacity: 1 }
            }
          }}
        >
          <Alert
            severity="info"
            sx={{
              borderRadius: 3,
              boxShadow: 4,
              maxWidth: 280,
              cursor: 'pointer',
              bgcolor: buttonColor === 'primary' ? 'primary.main' : 'success.main',
              color: 'white',
              '& .MuiAlert-icon': { color: 'white' },
              '& .MuiAlert-action': { color: 'white' }
            }}
            onClick={handleOpenChat}
            action={
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowNotification(false)
                }}
                sx={{ color: 'white' }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            }
          >
            <Typography variant="subtitle2" fontWeight="bold" sx={{ color: 'white' }}>
              💬 {otherParty?.name || 'Chat'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'white', opacity: 0.9, mt: 0.5 }}>
              {lastMessagePreview.substring(0, 50)}{lastMessagePreview.length > 50 ? '...' : ''}
            </Typography>
          </Alert>
        </Box>
      )}

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
              '70%': { boxShadow: '0 0 0 15px rgba(25, 118, 210, 0)' },
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