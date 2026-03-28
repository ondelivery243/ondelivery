// src/components/chat/ChatWindow.jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Paper,
  Stack,
  Avatar,
  Chip,
  Divider,
  CircularProgress,
  Fade,
  Slide,
  useTheme,
  useMediaQuery,
  alpha,
  Badge
} from '@mui/material'
import {
  Send as SendIcon,
  Close as CloseIcon,
  ExpandLess as ExpandIcon,
  ExpandMore as CollapseIcon,
  Store as StoreIcon,
  TwoWheeler as BikeIcon,
  Chat as ChatIcon,
  AttachFile as AttachIcon,
  LocationOn as LocationIcon,
  Circle as CircleIcon
} from '@mui/icons-material'
import { useSnackbar } from 'notistack'
import ChatMessage from './ChatMessage'
import {
  sendMessage,
  subscribeToMessages,
  subscribeToChatRoom,
  markMessagesAsRead,
  createChatRoom,
  getChatRoom
} from '../../services/chatService'
import { playChatMessageSound } from '../../services/audioService'

/**
 * ChatWindow - Componente de chat en tiempo real
 * 
 * ✅ CORREGIDO: 
 * - Evita bucle infinito de suscripciones
 * - Detecta correctamente mensajes nuevos
 * - Reproduce sonido con chat abierto
 */
export default function ChatWindow({
  service,
  currentUser,
  otherParty,
  open = true,
  onClose,
  miniMode = false,
  expanded = true,
  onToggleExpand
}) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { enqueueSnackbar } = useSnackbar()
  
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [chatRoom, setChatRoom] = useState(null)
  
  // ============================================
  // 🔒 REFS
  // ============================================
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const messagesContainerRef = useRef(null)
  
  // Tracking de suscripciones activas
  const activeSubscriptionsRef = useRef({
    messages: null,
    chatRoom: null
  })
  
  // Tracking del servicio actual
  const currentServiceIdRef = useRef(null)
  
  // 🔧 CORREGIDO: Tracking del último mensaje usando timestamp + ID
  const lastProcessedMessageRef = useRef({ id: null, timestamp: 0 })
  
  // Flag para saber si ya se cargaron los mensajes iniciales
  const initialLoadDoneRef = useRef(false)

  // Valores primitivos estables
  const serviceId = service?.id
  const currentUserId = currentUser?.id
  const currentUserName = currentUser?.name
  const currentUserRole = currentUser?.role

  // Scroll automático
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  // ============================================
  // 🔄 INICIALIZACIÓN Y SUSCRIPCIÓN PRINCIPAL
  // ============================================
  useEffect(() => {
    // Validaciones iniciales
    if (!serviceId || !currentUserId || !currentUserRole) {
      console.log('⚠️ [ChatWindow] Faltan datos requeridos:', { serviceId, currentUserId, currentUserRole })
      return
    }

    // 🚨 CRÍTICO: Solo inicializar si cambió el serviceId
    if (currentServiceIdRef.current === serviceId) {
      console.log('✅ [ChatWindow] Ya suscrito a servicio:', serviceId)
      return
    }

    console.log('🚀 [ChatWindow] Inicializando chat para servicio:', serviceId)
    
    // Limpiar suscripciones anteriores
    if (activeSubscriptionsRef.current.messages) {
      console.log('🧹 [ChatWindow] Limpiando suscripción de mensajes anterior')
      activeSubscriptionsRef.current.messages()
      activeSubscriptionsRef.current.messages = null
    }
    if (activeSubscriptionsRef.current.chatRoom) {
      console.log('🧹 [ChatWindow] Limpiando suscripción de chatRoom anterior')
      activeSubscriptionsRef.current.chatRoom()
      activeSubscriptionsRef.current.chatRoom = null
    }

    // Actualizar el servicio actual
    currentServiceIdRef.current = serviceId
    lastProcessedMessageRef.current = { id: null, timestamp: 0 }
    initialLoadDoneRef.current = false
    setLoading(true)

    // Inicializar chat room
    const initChat = async () => {
      try {
        let existingChat = await getChatRoom(serviceId)
        
        if (!existingChat) {
          const result = await createChatRoom(
            serviceId,
            service,
            currentUserRole === 'restaurant' ? { name: currentUserName } : null,
            currentUserRole === 'driver' ? { id: currentUserId, name: currentUserName } : null
          )
          
          if (result.success) {
            existingChat = await getChatRoom(serviceId)
          }
        }
        
        setChatRoom(existingChat)
        console.log('✅ [ChatWindow] Chat room inicializado:', existingChat?.id)
      } catch (error) {
        console.error('❌ [ChatWindow] Error inicializando chat:', error)
      }
      
      setLoading(false)
    }
    
    initChat()

    // ============================================
    // 📨 SUSCRIPCIÓN A MENSAJES
    // ============================================
    console.log('🔔 [ChatWindow] Suscribiendo a mensajes:', serviceId)
    
    const unsubMessages = subscribeToMessages(serviceId, (msgs) => {
      // Detectar si hay mensajes nuevos del otro participante
      if (msgs.length > 0) {
        const lastMessage = msgs[msgs.length - 1]
        const isFromOther = lastMessage.senderRole !== currentUserRole
        
        // 🔧 CORREGIDO: Detectar mensaje realmente nuevo
        const isNewMessage = lastMessage.id !== lastProcessedMessageRef.current.id &&
                            lastMessage.timestamp > lastProcessedMessageRef.current.timestamp
        
        console.log('📨 [ChatWindow] Mensaje recibido:', {
          id: lastMessage.id,
          timestamp: lastMessage.timestamp,
          senderRole: lastMessage.senderRole,
          isFromOther,
          isNewMessage,
          initialLoadDone: initialLoadDoneRef.current,
          lastProcessed: lastProcessedMessageRef.current
        })
        
        // 🔊 Reproducir sonido cuando:
        // 1. Ya se hizo la carga inicial
        // 2. El mensaje es del otro participante
        // 3. Es un mensaje nuevo (no procesado antes)
        // 4. El chat está abierto
        if (initialLoadDoneRef.current && isFromOther && isNewMessage && open) {
          console.log('🔊 [ChatWindow] 🔔 NUEVO MENSAJE con chat abierto - reproduciendo sonido')
          playChatMessageSound()
        }
        
        // Actualizar referencia del último mensaje procesado
        lastProcessedMessageRef.current = {
          id: lastMessage.id,
          timestamp: lastMessage.timestamp
        }
        
        // Marcar que ya se hizo la carga inicial
        if (!initialLoadDoneRef.current) {
          initialLoadDoneRef.current = true
          console.log('✅ [ChatWindow] Carga inicial completada')
        }
      }
      
      setMessages(msgs)
      setLoading(false)
      
      // Scroll al final después de recibir mensajes
      setTimeout(scrollToBottom, 100)
    })

    activeSubscriptionsRef.current.messages = unsubMessages

    // ============================================
    // 📋 SUSCRIPCIÓN AL CHAT ROOM
    // ============================================
    console.log('🔔 [ChatWindow] Suscribiendo a chat room:', serviceId)
    
    const unsubChatRoom = subscribeToChatRoom(serviceId, (room) => {
      console.log('📋 [ChatWindow] Chat room actualizado:', room?.id)
      setChatRoom(room)
    })

    activeSubscriptionsRef.current.chatRoom = unsubChatRoom

    // Cleanup
    return () => {
      console.log('🧹 [ChatWindow] Cleanup - desmontando componente')
      
      if (activeSubscriptionsRef.current.messages) {
        activeSubscriptionsRef.current.messages()
        activeSubscriptionsRef.current.messages = null
      }
      if (activeSubscriptionsRef.current.chatRoom) {
        activeSubscriptionsRef.current.chatRoom()
        activeSubscriptionsRef.current.chatRoom = null
      }
      
      currentServiceIdRef.current = null
      initialLoadDoneRef.current = false
    }
  }, [serviceId, currentUserId, currentUserName, currentUserRole, open, scrollToBottom])

  // ============================================
  // ✅ MARCAR MENSAJES COMO LEÍDOS
  // ============================================
  useEffect(() => {
    if (open && serviceId && currentUserRole && messages.length > 0) {
      console.log('📖 [ChatWindow] Marcando mensajes como leídos')
      markMessagesAsRead(serviceId, currentUserRole)
        .then(() => console.log('✅ [ChatWindow] Mensajes marcados como leídos'))
        .catch(err => console.error('❌ [ChatWindow] Error marcando leídos:', err))
    }
  }, [open, serviceId, currentUserRole, messages.length])

  // Scroll inicial cuando cargan los mensajes
  useEffect(() => {
    if (!loading && messages.length > 0) {
      scrollToBottom()
    }
  }, [loading, messages.length, scrollToBottom])

  // ============================================
  // 📤 ENVIAR MENSAJE
  // ============================================
  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending || !serviceId || !currentUserId || !currentUserName || !currentUserRole) return
    
    setSending(true)
    const messageText = newMessage.trim()
    setNewMessage('')
    
    try {
      const result = await sendMessage(
        serviceId,
        currentUserId,
        currentUserName,
        currentUserRole,
        messageText
      )
      
      if (!result.success) {
        enqueueSnackbar('Error al enviar mensaje', { variant: 'error' })
        setNewMessage(messageText)
      }
    } catch (error) {
      console.error('Error enviando mensaje:', error)
      enqueueSnackbar('Error al enviar mensaje', { variant: 'error' })
      setNewMessage(messageText)
    }
    
    setSending(false)
    inputRef.current?.focus()
  }

  // Manejar tecla Enter
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Contador de no leídos
  const unreadCount = currentUserRole === 'restaurant' 
    ? (chatRoom?.unreadByRestaurant || 0)
    : (chatRoom?.unreadByDriver || 0)

  if (!open) return null

  // ============================================
  // 📱 MODO MINI (FLOTANTE)
  // ============================================
  if (miniMode) {
    return (
      <Slide direction="up" in={open} mountOnEnter unmountOnExit>
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            width: isMobile ? 'calc(100% - 32px)' : 360,
            maxWidth: 400,
            borderRadius: 2,
            overflow: 'hidden',
            zIndex: 1200,
            display: 'flex',
            flexDirection: 'column',
            transition: 'all 0.3s ease'
          }}
        >
          {/* Header */}
          <Box
            sx={{
              bgcolor: currentUserRole === 'restaurant' ? 'primary.main' : 'success.main',
              color: 'white',
              p: 1.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
            onClick={onToggleExpand}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Badge badgeContent={unreadCount} color="error">
                <ChatIcon />
              </Badge>
              <Box>
                <Typography variant="subtitle2" fontWeight="bold">
                  {otherParty?.name || 'Chat'}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  {currentUserRole === 'restaurant' ? 'Repartidor' : 'Restaurante'}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={0.5}>
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onToggleExpand?.() }}>
                {expanded ? <CollapseIcon sx={{ color: 'white' }} /> : <ExpandIcon sx={{ color: 'white' }} />}
              </IconButton>
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onClose?.() }}>
                <CloseIcon sx={{ color: 'white' }} />
              </IconButton>
            </Stack>
          </Box>

          {/* Content */}
          <Fade in={expanded}>
            <Box sx={{ height: expanded ? 350 : 0, display: 'flex', flexDirection: 'column' }}>
              {/* Messages */}
              <Box
                ref={messagesContainerRef}
                sx={{
                  flex: 1,
                  overflow: 'auto',
                  p: 1.5,
                  bgcolor: alpha(theme.palette.grey[100], 0.5)
                }}
              >
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : messages.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <ChatIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      Inicia la conversación
                    </Typography>
                  </Box>
                ) : (
                  messages.map((msg) => (
                    <ChatMessage
                      key={msg.id}
                      message={msg}
                      currentUserId={currentUserId}
                      showAvatar={true}
                    />
                  ))
                )}
                <div ref={messagesEndRef} />
              </Box>

              {/* Input */}
              <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
                <Stack direction="row" spacing={1}>
                  <TextField
                    inputRef={inputRef}
                    fullWidth
                    size="small"
                    placeholder="Escribe un mensaje..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    multiline
                    maxRows={3}
                    disabled={sending}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 3,
                        bgcolor: 'grey.50'
                      }
                    }}
                  />
                  <IconButton
                    color="primary"
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sending}
                    sx={{
                      bgcolor: 'primary.main',
                      color: 'white',
                      '&:hover': { bgcolor: 'primary.dark' },
                      '&.Mui-disabled': { bgcolor: 'grey.300', color: 'grey.500' }
                    }}
                  >
                    {sending ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                  </IconButton>
                </Stack>
              </Box>
            </Box>
          </Fade>
        </Paper>
      </Slide>
    )
  }

  // ============================================
  // 📋 MODO COMPLETO
  // ============================================
  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <Box
        sx={{
          bgcolor: currentUserRole === 'restaurant' ? 'primary.main' : 'success.main',
          color: 'white',
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
            {otherParty?.role === 'restaurant' || currentUserRole === 'driver' ? (
              <StoreIcon />
            ) : (
              <BikeIcon />
            )}
          </Avatar>
          <Box>
            <Typography variant="subtitle1" fontWeight="bold">
              {otherParty?.name || 'Chat del servicio'}
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <CircleIcon sx={{ fontSize: 8, color: 'success.light' }} />
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {currentUserRole === 'restaurant' ? 'Repartidor' : 'Restaurante'} • Servicio {service?.serviceId}
              </Typography>
            </Stack>
          </Box>
        </Stack>
        {onClose && (
          <IconButton size="small" onClick={onClose}>
            <CloseIcon sx={{ color: 'white' }} />
          </IconButton>
        )}
      </Box>

      {/* Service info bar */}
      {service && (
        <Box sx={{ px: 2, py: 1, bgcolor: alpha(theme.palette.primary.main, 0.05), borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            Entregar en: <strong>{service.zoneName} - {service.deliveryAddress}</strong>
          </Typography>
        </Box>
      )}

      {/* Messages */}
      <Box
        ref={messagesContainerRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          bgcolor: alpha(theme.palette.grey[100], 0.3)
        }}
      >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : messages.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <ChatIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="body1" color="text.secondary" gutterBottom>
              No hay mensajes aún
            </Typography>
            <Typography variant="body2" color="text.disabled">
              Envía un mensaje para iniciar la conversación
            </Typography>
          </Box>
        ) : (
          messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              currentUserId={currentUserId}
              showAvatar={true}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Input */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Stack direction="row" spacing={1} alignItems="flex-end">
          <TextField
            inputRef={inputRef}
            fullWidth
            size="small"
            placeholder="Escribe un mensaje..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            multiline
            maxRows={4}
            disabled={sending}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 3,
                bgcolor: 'grey.50'
              }
            }}
          />
          <IconButton
            color="primary"
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || sending}
            sx={{
              bgcolor: 'primary.main',
              color: 'white',
              p: 1.2,
              '&:hover': { bgcolor: 'primary.dark' },
              '&.Mui-disabled': { bgcolor: 'grey.300', color: 'grey.500' }
            }}
          >
            {sending ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
          </IconButton>
        </Stack>
      </Box>
    </Paper>
  )
}