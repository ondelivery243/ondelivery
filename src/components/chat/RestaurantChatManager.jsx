// src/components/chat/RestaurantChatManager.jsx
import { useState, useEffect, useRef } from 'react'
import {
  Fab,
  Badge,
  Box,
  Typography,
  Paper,
  Stack,
  IconButton,
  Collapse,
  Chip,
  useTheme,
  useMediaQuery,
  alpha
} from '@mui/material'
import {
  Chat as ChatIcon,
  Close as CloseIcon,
  TwoWheeler as DeliveryIcon
} from '@mui/icons-material'
import ChatWindow from './ChatWindow'
import { subscribeToChatRoom, markMessagesAsRead } from '../../services/chatService'
import { playChatMessageSound } from '../../services/audioService'

/**
 * RestaurantChatManager - Gestor unificado de chat para restaurantes
 *
 * ✅ Características:
 * - Un solo botón flotante (FAB) para todos los chats
 * - Badge con total de mensajes no leídos
 * - 🔊 Reproduce sonido cuando llega mensaje con chat cerrado
 * - Selector de servicios al hacer clic
 *
 * 🔒 CORREGIDO: Suscripción independiente que NO se reinicia al abrir/cerrar chat
 */
export default function RestaurantChatManager({
  services = [],
  restaurantData,
  chatUnreadCounts = {}
}) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [isSelectorOpen, setIsSelectorOpen] = useState(false)
  const [selectedService, setSelectedService] = useState(null)
  const [chatOpen, setChatOpen] = useState(false)

  // ============================================
  // 🔒 REFS PARA EVITAR BUCLES Y MANTENER SUSCRIPCIÓN
  // ============================================
  const subscriptionsRef = useRef({}) // { serviceId: unsubscribe }
  const lastUnreadRef = useRef({})    // { serviceId: count }
  const prevServiceIdsRef = useRef('')
  const chatOpenRef = useRef(false)   // 🔧 Usar ref para chatOpen

  // Mantener chatOpenRef actualizado
  useEffect(() => {
    chatOpenRef.current = chatOpen
  }, [chatOpen])

  // Servicios con conductor
  const servicesWithDriver = services.filter(s => s.driverId && s.status !== 'pendiente')

  // Total de mensajes no leídos
  const totalUnread = servicesWithDriver.reduce((sum, s) => sum + (chatUnreadCounts[s.id] || 0), 0)

  // Crear ID estable para comparar
  const serviceIdsString = servicesWithDriver.map(s => s.id).sort().join(',')

  // ============================================
  // 🔔 SUSCRIPCIONES PARA SONIDO CON CHAT CERRADO
  // Esta suscripción es INDEPENDIENTE del estado del chat
  // ============================================
  useEffect(() => {
    // Solo actualizar si cambiaron los servicios
    if (serviceIdsString === prevServiceIdsRef.current) {
      return
    }
    prevServiceIdsRef.current = serviceIdsString

    console.log('🔔 [RestaurantChatManager] Servicios cambiaron:', serviceIdsString)

    // Limpiar suscripciones de servicios que ya no existen
    const currentIds = new Set(servicesWithDriver.map(s => s.id))
    Object.keys(subscriptionsRef.current).forEach(serviceId => {
      if (!currentIds.has(serviceId)) {
        console.log('🧹 [RestaurantChatManager] Limpiando suscripción:', serviceId)
        subscriptionsRef.current[serviceId]()
        delete subscriptionsRef.current[serviceId]
        delete lastUnreadRef.current[serviceId]
      }
    })

    // Crear nuevas suscripciones
    servicesWithDriver.forEach(service => {
      const serviceId = service.id
      if (subscriptionsRef.current[serviceId]) return

      // Inicializar en -1 para no disparar en la primera carga
      lastUnreadRef.current[serviceId] = -1

      console.log('🔔 [RestaurantChatManager] Suscribiendo a:', serviceId)

      const unsubscribe = subscribeToChatRoom(serviceId, (room) => {
        if (!room) return

        const currentUnread = room.unreadByRestaurant || 0
        const prevUnread = lastUnreadRef.current[serviceId]
        const isChatOpen = chatOpenRef.current

        console.log('📊 [RestaurantChatManager] Check:', {
          serviceId,
          currentUnread,
          prevUnread,
          isChatOpen
        })

        // 🔊 Detectar incremento de mensajes no leídos
        // Solo reproducir sonido si:
        // 1. Ya habíamos recibido al menos una actualización (prevUnread >= 0)
        // 2. El contador aumentó (currentUnread > prevUnread)
        // 3. El chat está cerrado
        if (prevUnread >= 0 && currentUnread > prevUnread && !isChatOpen) {
          console.log('🔊 [RestaurantChatManager] 🔔 NUEVO MENSAJE - Reproduciendo sonido!')
          playChatMessageSound()

          // Notificación del navegador
          if (Notification.permission === 'granted') {
            try {
              new Notification(`💬 Nuevo mensaje del Repartidor`, {
                body: room.lastMessage?.substring(0, 80) || 'Tienes un nuevo mensaje',
                icon: '/logo-192.png',
                tag: `chat-${serviceId}`,
                renotify: true
              })
            } catch (e) {
              console.log('No se pudo mostrar notificación')
            }
          }
        }

        // Siempre actualizar el último valor
        lastUnreadRef.current[serviceId] = currentUnread
      })

      subscriptionsRef.current[serviceId] = unsubscribe
    })

    // Cleanup SOLO cuando cambian los servicios o se desmonta el componente
    // NO limpiar cuando se abre/cierra el chat
    return () => {
      console.log('🧹 [RestaurantChatManager] Cleanup - servicios cambiaron o desmontando')
      Object.values(subscriptionsRef.current).forEach(unsub => unsub())
      subscriptionsRef.current = {}
    }
  }, [serviceIdsString])  // 🔧 NO incluir chatOpen aquí - eso causa el problema

  // Cerrar selector cuando se abre el chat
  useEffect(() => {
    if (chatOpen) {
      setIsSelectorOpen(false)
    }
  }, [chatOpen])

  // Marcar como leídos cuando se abre el chat
  useEffect(() => {
    if (chatOpen && selectedService?.id) {
      console.log('✅ [RestaurantChatManager] Chat abierto, marcando mensajes como leídos')
      markMessagesAsRead(selectedService.id, 'restaurant')
        .then(() => {
          console.log('✅ [RestaurantChatManager] Mensajes marcados como leídos')
          lastUnreadRef.current[selectedService.id] = 0
        })
        .catch(err => console.error('❌ Error marcando leídos:', err))
    }
  }, [chatOpen, selectedService?.id])

  // Handlers
  const handleFabClick = () => {
    if (selectedService) {
      setChatOpen(true)
    } else if (servicesWithDriver.length === 1) {
      setSelectedService(servicesWithDriver[0])
      setChatOpen(true)
    } else {
      setIsSelectorOpen(!isSelectorOpen)
    }
  }

  const handleSelectService = (service) => {
    console.log('👆 [RestaurantChatManager] Seleccionando servicio:', service.id)
    setSelectedService(service)
    setIsSelectorOpen(false)
    setChatOpen(true)
  }

  const handleCloseChat = () => {
    console.log('👆 [RestaurantChatManager] Cerrando chat')
    setChatOpen(false)
  }

  // No mostrar si no hay servicios con conductor
  if (servicesWithDriver.length === 0) return null

  // Animación de pulso cuando hay mensajes
  const pulseAnimation = totalUnread > 0 ? {
    animation: 'pulse 1.5s infinite',
    '@keyframes pulse': {
      '0%': { transform: 'scale(1)', opacity: 1 },
      '50%': { transform: 'scale(1.1)', opacity: 0.9 },
      '100%': { transform: 'scale(1)', opacity: 1 },
    }
  } : {}

  return (
    <>
      {/* Selector de servicios */}
      <Collapse in={isSelectorOpen}>
        <Paper
          elevation={4}
          sx={{
            position: 'fixed',
            bottom: isMobile ? 150 : 100,
            right: 24,
            zIndex: 1100,
            borderRadius: 3,
            maxWidth: 320,
            width: isMobile ? 'calc(100% - 48px)' : 'auto',
            maxHeight: 300,
            overflow: 'auto'
          }}
        >
          <Box sx={{ p: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold" color="primary">
                Seleccionar Chat
              </Typography>
              <IconButton size="small" onClick={() => setIsSelectorOpen(false)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>

            <Stack spacing={1}>
              {servicesWithDriver.map((service) => {
                const unread = chatUnreadCounts[service.id] || 0
                return (
                  <Paper
                    key={service.id}
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      bgcolor: unread > 0 ? alpha(theme.palette.error.main, 0.05) : 'transparent',
                      borderColor: unread > 0 ? 'error.main' : 'divider',
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.1)
                      }
                    }}
                    onClick={() => handleSelectService(service)}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <DeliveryIcon color="success" fontSize="small" />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight="medium" noWrap>
                          {service.driverName || 'Repartidor'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Servicio {service.serviceId}
                        </Typography>
                      </Box>
                      {unread > 0 && (
                        <Chip
                          label={unread}
                          size="small"
                          color="error"
                          sx={{ height: 24, minWidth: 24 }}
                        />
                      )}
                    </Stack>
                  </Paper>
                )
              })}
            </Stack>
          </Box>
        </Paper>
      </Collapse>

      {/* FAB Button */}
      <Fab
        color="primary"
        size={isMobile ? 'medium' : 'large'}
        onClick={handleFabClick}
        sx={{
          position: 'fixed',
          bottom: isMobile ? 80 : 24,
          right: 24,
          zIndex: 1100,
          ...pulseAnimation
        }}
      >
        <Badge
          badgeContent={totalUnread > 0 ? totalUnread : 0}
          color="error"
          max={99}
        >
          <ChatIcon />
        </Badge>
      </Fab>

      {/* Ventana de chat */}
      {selectedService && (
        <ChatWindow
          service={selectedService}
          currentUser={{
            id: restaurantData?.id,
            name: restaurantData?.name,
            role: 'restaurant'
          }}
          otherParty={{
            name: selectedService.driverName,
            role: 'driver'
          }}
          open={chatOpen}
          onClose={handleCloseChat}
          miniMode={true}
        />
      )}
    </>
  )
}