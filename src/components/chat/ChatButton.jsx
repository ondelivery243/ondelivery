// src/components/chat/ChatButton.jsx
import { useState, useEffect, useRef } from 'react'
import {
  IconButton,
  Badge,
  Tooltip,
  Fab,
  useTheme,
  useMediaQuery,
  Box,
  Typography,
  Chip
} from '@mui/material'
import {
  Chat as ChatIcon,
  Close as CloseIcon
} from '@mui/icons-material'
import ChatWindow from './ChatWindow'
import { subscribeToChatRoom, subscribeToMessages } from '../../services/chatService'

// Sonido de notificación
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator1 = audioContext.createOscillator()
    const oscillator2 = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator1.type = 'sine'
    oscillator1.frequency.setValueAtTime(880, audioContext.currentTime)
    oscillator1.frequency.setValueAtTime(1108.73, audioContext.currentTime + 0.1)
    
    oscillator2.type = 'sine'
    oscillator2.frequency.setValueAtTime(1108.73, audioContext.currentTime + 0.15)
    oscillator2.frequency.setValueAtTime(1318.51, audioContext.currentTime + 0.25)
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
    
    oscillator1.connect(gainNode)
    oscillator2.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator1.start(audioContext.currentTime)
    oscillator1.stop(audioContext.currentTime + 0.15)
    oscillator2.start(audioContext.currentTime + 0.15)
    oscillator2.stop(audioContext.currentTime + 0.4)
    
    setTimeout(() => audioContext.close(), 500)
  } catch (error) {
    console.log('No se pudo reproducir sonido:', error)
  }
}

/**
 * ChatButton - Botón flotante para abrir el chat con notificaciones
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
  const [showNotification, setShowNotification] = useState(false)
  const [lastMessagePreview, setLastMessagePreview] = useState('')
  
  // Refs para evitar loops
  const prevUnreadCountRef = useRef(-1)
  const chatOpenRef = useRef(chatOpen)
  const subscriptionKeyRef = useRef(null)
  
  // ⚠️ CRÍTICO: Extraer valores primitivos para usar como dependencias estables
  const serviceId = service?.id
  const currentUserId = currentUser?.id
  const currentUserRole = currentUser?.role

  // Mantener ref actualizado
  useEffect(() => {
    chatOpenRef.current = chatOpen
  }, [chatOpen])

  // 🔔 Suscribirse al chat room - SOLO cuando cambien los valores primitivos
  useEffect(() => {
    if (!serviceId || !currentUserId || !currentUserRole) {
      return
    }

    // Crear clave única para esta suscripción
    const subscriptionKey = `${serviceId}-${currentUserId}-${currentUserRole}`
    
    // Evitar re-suscribirse si la clave es la misma
    if (subscriptionKeyRef.current === subscriptionKey) {
      return
    }
    subscriptionKeyRef.current = subscriptionKey

    console.log('🔔 ChatButton: Suscribiendo a:', serviceId)

    const unsubscribe = subscribeToChatRoom(serviceId, (room) => {
      if (room) {
        const count = currentUserRole === 'restaurant' 
          ? (room.unreadByRestaurant || 0)
          : (room.unreadByDriver || 0)
        
        // Detectar nuevos mensajes
        if (count > 0 && prevUnreadCountRef.current >= 0 && count > prevUnreadCountRef.current && !chatOpenRef.current) {
          playNotificationSound()
          setLastMessagePreview(room.lastMessage || 'Nuevo mensaje')
          setShowNotification(true)
          if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200])
          }
        }
        
        prevUnreadCountRef.current = count
        setUnreadCount(count)
      }
    })

    return () => {
      console.log('🧹 ChatButton: Limpiando suscripción')
      subscriptionKeyRef.current = null
      unsubscribe()
    }
  }, [serviceId, currentUserId, currentUserRole])

  // Resetear cuando se abre el chat
  useEffect(() => {
    if (chatOpen) {
      prevUnreadCountRef.current = 0
      setShowNotification(false)
    }
  }, [chatOpen])

  // Cerrar notificación automáticamente
  useEffect(() => {
    if (showNotification) {
      const timer = setTimeout(() => setShowNotification(false), 4000)
      return () => clearTimeout(timer)
    }
  }, [showNotification])

  // Handlers
  const handleOpenChat = () => {
    setChatOpen(true)
    setShowNotification(false)
    onChatOpen?.()
  }

  const handleCloseChat = () => {
    setChatOpen(false)
    onChatClose?.()
  }

  // No mostrar si no hay datos
  if (!serviceId || !currentUserId) return null

  const buttonColor = currentUserRole === 'restaurant' ? 'primary' : 'success'

  // Variante icon
  if (variant === 'icon') {
    return (
      <>
        <Tooltip title={unreadCount > 0 ? `${unreadCount} mensajes` : 'Chat'}>
          <IconButton onClick={handleOpenChat} size={size}>
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
        />
      </>
    )
  }

  // Variante chip
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
            bottom: isMobile ? 160 : 120,
            right: 24,
            zIndex: 1200,
            animation: 'slideInUp 0.3s ease-out',
            '@keyframes slideInUp': {
              '0%': { transform: 'translateY(20px)', opacity: 0 },
              '100%': { transform: 'translateY(0)', opacity: 1 }
            }
          }}
        >
          <Box
            sx={{
              borderRadius: 3,
              boxShadow: 4,
              maxWidth: 280,
              cursor: 'pointer',
              bgcolor: buttonColor === 'primary' ? 'primary.main' : 'success.main',
              color: 'white',
              p: 2,
            }}
            onClick={handleOpenChat}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2" fontWeight="bold">
                💬 {otherParty?.name || 'Chat'}
              </Typography>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowNotification(false)
                }}
                sx={{ color: 'white', p: 0.5 }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
              {lastMessagePreview.substring(0, 50)}{lastMessagePreview.length > 50 ? '...' : ''}
            </Typography>
          </Box>
        </Box>
      )}

      {/* FAB Button */}
      <Fab
        color={buttonColor}
        size={isMobile ? 'medium' : 'large'}
        onClick={handleOpenChat}
        sx={{
          position: 'fixed',
          bottom: isMobile ? 80 : 24,
          right: 24,
          zIndex: 1100,
          ...(unreadCount > 0 && {
            animation: 'pulse 2s infinite',
            '@keyframes pulse': {
              '0%': { boxShadow: '0 0 0 0 rgba(76, 175, 80, 0.7)' },
              '70%': { boxShadow: '0 0 0 15px rgba(76, 175, 80, 0)' },
              '100%': { boxShadow: '0 0 0 0 rgba(76, 175, 80, 0)' }
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
      />
    </>
  )
}