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
  Typography
} from '@mui/material'
import {
  Chat as ChatIcon,
  Close as CloseIcon
} from '@mui/icons-material'
import ChatWindow from './ChatWindow'
import { subscribeToChatRoom, markMessagesAsRead } from '../../services/chatService'

/**
 * ChatButton - Botón flotante para abrir el chat
 * NOTA: El sonido se maneja globalmente en el Dashboard
 */
export default function ChatButton({
  service,
  currentUser,
  otherParty,
  variant = 'fab',
  forceShowPulse = false, // ✅ NUEVA PROP para forzar animación desde el padre
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
  
  // Refs
  const prevUnreadCountRef = useRef(-1)
  const chatOpenRef = useRef(chatOpen)
  const subscriptionKeyRef = useRef(null)
  
  const serviceId = service?.id
  const currentUserId = currentUser?.id
  const currentUserRole = currentUser?.role

  // Mantener ref actualizado
  useEffect(() => {
    chatOpenRef.current = chatOpen
  }, [chatOpen])

  // 🔔 Suscribirse al chat room
  useEffect(() => {
    if (!serviceId || !currentUserId || !currentUserRole) return

    const subscriptionKey = `${serviceId}-${currentUserId}-${currentUserRole}`
    if (subscriptionKeyRef.current === subscriptionKey) return
    subscriptionKeyRef.current = subscriptionKey

    const unsubscribe = subscribeToChatRoom(serviceId, (room) => {
      if (room) {
        const count = currentUserRole === 'restaurant' 
          ? (room.unreadByRestaurant || 0)
          : (room.unreadByDriver || 0)
        
        // Detectar nuevos mensajes para mostrar preview local
        if (count > 0 && prevUnreadCountRef.current >= 0 && count > prevUnreadCountRef.current && !chatOpenRef.current) {
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
      subscriptionKeyRef.current = null
      unsubscribe()
    }
  }, [serviceId, currentUserId, currentUserRole])

  // ✅ MARCAR LEÍDOS AL ABRIR
  useEffect(() => {
    if (chatOpen && serviceId && currentUserRole) {
      prevUnreadCountRef.current = 0
      setShowNotification(false)
      
      markMessagesAsRead(serviceId, currentUserRole)
        .then(() => console.log('✅ [ChatButton] Mensajes marcados como leídos'))
        .catch(err => console.error('Error marcando leídos:', err))
    }
  }, [chatOpen, serviceId, currentUserRole])

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

  if (!serviceId || !currentUserId) return null

  const buttonColor = currentUserRole === 'restaurant' ? 'primary' : 'success'

  // Variante icon
  if (variant === 'icon') {
    return (
      <>
        <Tooltip title={unreadCount > 0 ? `${unreadCount} mensajes` : 'Chat'}>
          <IconButton onClick={handleOpenChat} size={size}>
            <Badge badgeContent={unreadCount} color="error">
              <ChatIcon 
                color={buttonColor} 
                sx={{ 
                  animation: unreadCount > 0 ? 'pulse 1.5s infinite' : 'none',
                  '@keyframes pulse': {
                    '0%': { transform: 'scale(1)', opacity: 1 },
                    '50%': { transform: 'scale(1.2)', opacity: 0.8 },
                    '100%': { transform: 'scale(1)', opacity: 1 },
                  }
                }} 
              />
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
          zIndex: 1100
        }}
      >
        <Badge 
          // ✅ Lógica visual: Mostrar si hay sin leer O si hay alerta forzada
          badgeContent={(unreadCount > 0 || forceShowPulse) ? Math.max(unreadCount, 1) : 0} 
          color="error"
        >
          <ChatIcon 
            sx={{ 
              // ✅ Pulso si hay sin leer O si hay alerta forzada
              animation: (unreadCount > 0 || forceShowPulse) ? 'pulse 1.5s infinite' : 'none',
              '@keyframes pulse': {
                '0%': { transform: 'scale(1)', opacity: 1 },
                '50%': { transform: 'scale(1.15)', opacity: 0.9 },
                '100%': { transform: 'scale(1)', opacity: 1 },
              }
            }} 
          />
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