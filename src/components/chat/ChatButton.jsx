// src/components/chat/ChatButton.jsx
import { useState, useEffect, useRef } from 'react'
import {
  IconButton,
  Badge,
  Tooltip,
  Fab,
  useTheme,
  useMediaQuery
} from '@mui/material'
import {
  Chat as ChatIcon,
  Close as CloseIcon
} from '@mui/icons-material'
import ChatWindow from './ChatWindow'
import { markMessagesAsRead, subscribeToChatRoom } from '../../services/chatService'
import { playChatMessageSound } from '../../services/audioService'

/**
 * ChatButton - Botón flotante para abrir el chat
 *
 * ✅ Características:
 * - Badge con contador de no leídos
 * - 🔊 Reproduce sonido cuando llega mensaje con chat cerrado (si no hay hook externo)
 * - Marca mensajes como leídos al abrir
 * - Abre ChatWindow al hacer clic
 *
 * NOTA: El sonido con chat cerrado se maneja en:
 * - useChatNotifications (para el repartidor en Dashboard)
 * - RestaurantChatManager (para el restaurante)
 * Este componente tiene su propia lógica de sonido como backup
 */
export default function ChatButton({
  service,
  currentUser,
  otherParty,
  unreadCount = 0,
  variant = 'fab',
  onChatOpen,
  onChatClose,
  size = 'medium',
  disableSound = false  // Desactivar sonido si se maneja externamente
}) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [chatOpen, setChatOpen] = useState(false)

  // ============================================
  // 🔒 REFS PARA EVITAR BUCLES Y MANTENER SUSCRIPCIÓN
  // ============================================
  const subscriptionRef = useRef(null)
  const lastUnreadRef = useRef(-1)
  const serviceIdRef = useRef(null)
  const chatOpenRef = useRef(false)  // 🔧 Usar ref para chatOpen

  // Mantener chatOpenRef actualizado
  useEffect(() => {
    chatOpenRef.current = chatOpen
  }, [chatOpen])

  const serviceId = service?.id
  const currentUserId = currentUser?.id
  const currentUserRole = currentUser?.role

  // ============================================
  // 🔔 SUSCRIPCIÓN PARA SONIDO CON CHAT CERRADO
  // Solo si disableSound es false
  // ============================================
  useEffect(() => {
    // Si el sonido está desactivado, no crear suscripción
    if (disableSound || !serviceId || !currentUserRole) return

    // Solo suscribir si cambió el servicio
    if (serviceIdRef.current === serviceId) return
    serviceIdRef.current = serviceId

    // Limpiar suscripción anterior
    if (subscriptionRef.current) {
      subscriptionRef.current()
      subscriptionRef.current = null
    }

    // Resetear el último unread para este nuevo servicio
    lastUnreadRef.current = -1

    console.log('🔔 [ChatButton] Suscribiendo a chat room para sonido:', serviceId)

    const unsubscribe = subscribeToChatRoom(serviceId, (room) => {
      if (!room) return

      // Obtener contador según rol
      const currentUnread = currentUserRole === 'restaurant'
        ? (room.unreadByRestaurant || 0)
        : (room.unreadByDriver || 0)

      const prevUnread = lastUnreadRef.current

      console.log('📊 [ChatButton] Unread check:', {
        serviceId,
        currentUnread,
        prevUnread,
        chatOpen: chatOpenRef.current
      })

      // 🔊 Detectar incremento de mensajes no leídos
      // Solo reproducir sonido si:
      // 1. Ya habíamos recibido al menos una actualización (prevUnread >= 0)
      // 2. El contador aumentó
      // 3. El chat está cerrado (usar ref)
      if (prevUnread >= 0 && currentUnread > prevUnread && !chatOpenRef.current) {
        console.log('🔊 [ChatButton] Nuevo mensaje con chat cerrado - reproduciendo sonido')
        playChatMessageSound()
      }

      lastUnreadRef.current = currentUnread
    })

    subscriptionRef.current = unsubscribe

    return () => {
      if (subscriptionRef.current) {
        console.log('🧹 [ChatButton] Limpiando suscripción - componente desmontado')
        subscriptionRef.current()
        subscriptionRef.current = null
      }
    }
  }, [disableSound, serviceId, currentUserRole])

  // Marcar como leídos al abrir chat
  useEffect(() => {
    if (chatOpen && serviceId && currentUserRole) {
      console.log('✅ [ChatButton] Chat abierto, marcando mensajes como leídos')
      markMessagesAsRead(serviceId, currentUserRole)
        .then(() => {
          console.log('✅ [ChatButton] Mensajes marcados como leídos en Firebase')
          lastUnreadRef.current = 0
        })
        .catch(err => console.error('❌ [ChatButton] Error marcando leídos:', err))
    }
  }, [chatOpen, serviceId, currentUserRole])

  // Handlers
  const handleOpenChat = () => {
    console.log('👆 [ChatButton] Abriendo chat')
    setChatOpen(true)
    onChatOpen?.()
  }

  const handleCloseChat = () => {
    console.log('👆 [ChatButton] Cerrando chat')
    setChatOpen(false)
    onChatClose?.()
  }

  if (!serviceId || !currentUserId) return null

  const buttonColor = currentUserRole === 'restaurant' ? 'primary' : 'success'

  // Animación de pulso
  const pulseAnimation = unreadCount > 0 ? {
    animation: 'pulse 1.5s infinite',
    '@keyframes pulse': {
      '0%': { transform: 'scale(1)', opacity: 1 },
      '50%': { transform: 'scale(1.15)', opacity: 0.9 },
      '100%': { transform: 'scale(1)', opacity: 1 },
    }
  } : {}

  // ============================================
  // 📱 VARIANTE ICON (para usar dentro de listas)
  // ============================================
  if (variant === 'icon') {
    return (
      <>
        <Tooltip title={unreadCount > 0 ? `${unreadCount} mensajes sin leer` : 'Chat'}>
          <IconButton onClick={handleOpenChat} size={size}>
            <Badge badgeContent={unreadCount > 0 ? unreadCount : 0} color="error">
              <ChatIcon
                color={buttonColor}
                sx={pulseAnimation}
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

  // ============================================
  // 📱 VARIANTE FAB (botón flotante)
  // ============================================
  return (
    <>
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
          ...pulseAnimation
        }}
      >
        <Badge
          badgeContent={unreadCount > 0 ? unreadCount : 0}
          color="error"
        >
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