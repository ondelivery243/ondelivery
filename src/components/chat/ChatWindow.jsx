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

/**
 * ChatWindow - Componente de chat en tiempo real
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
  
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const isSubscribedRef = useRef(false)
  const isInitializedRef = useRef(false)
  const markingAsReadRef = useRef(false)

  // Usar valores primitivos estables
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

  // 🔄 Inicializar chat room SOLO UNA VEZ
  useEffect(() => {
    if (!serviceId || !currentUserId || !currentUserRole) return

    if (isInitializedRef.current) return
    isInitializedRef.current = true

    const initChat = async () => {
      console.log('🚀 ChatWindow: Inicializando chat para servicio:', serviceId)
      setLoading(true)
      
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
      setLoading(false)
    }
    
    initChat()
  // ✅ Corregido: Usar dependencias primitivas estables
  }, [serviceId, currentUserId, currentUserName, currentUserRole])

  // 📨 Suscribirse a mensajes
  useEffect(() => {
    if (!serviceId) return

    if (isSubscribedRef.current) return
    isSubscribedRef.current = true

    const unsubscribe = subscribeToMessages(serviceId, (msgs) => {
      setMessages(msgs)
      setLoading(false)
      setTimeout(scrollToBottom, 100)
    })

    return () => {
      isSubscribedRef.current = false
      unsubscribe()
    }
  }, [serviceId, scrollToBottom])

  // 📋 Suscribirse a cambios del chat room
  useEffect(() => {
    if (!serviceId || !currentUserRole) return

    const unsubscribe = subscribeToChatRoom(serviceId, (room) => {
      setChatRoom(room)
    })

    return () => unsubscribe()
  }, [serviceId, currentUserRole])

  // Marcar mensajes como leídos cuando el chat está abierto
  useEffect(() => {
    const markAsRead = async () => {
      if (open && serviceId && currentUserRole && messages.length > 0 && !markingAsReadRef.current) {
        markingAsReadRef.current = true
        await markMessagesAsRead(serviceId, currentUserRole)
        setTimeout(() => { markingAsReadRef.current = false }, 500)
      }
    }
    
    markAsRead()
  }, [open, serviceId, currentUserRole, messages.length])

  // Scroll inicial
  useEffect(() => {
    if (!loading && messages.length > 0) scrollToBottom()
  }, [loading, messages.length, scrollToBottom])

  // Resetear cuando se cierra
  useEffect(() => {
    if (!open) {
      isInitializedRef.current = false
      isSubscribedRef.current = false
      markingAsReadRef.current = false
    }
  }, [open])

  // Enviar mensaje
  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending || !serviceId || !currentUserId || !currentUserName || !currentUserRole) return
    
    setSending(true)
    const messageText = newMessage.trim()
    setNewMessage('')
    
    const result = await sendMessage(
      serviceId,
      currentUserId,
      currentUserName,
      currentUserRole,
      messageText
    )
    
    setSending(false)
    
    if (!result.success) {
      enqueueSnackbar('Error al enviar mensaje', { variant: 'error' })
      setNewMessage(messageText)
    }
    
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

  // Modo mini
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

  // Modo completo
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