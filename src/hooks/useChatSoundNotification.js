// src/hooks/useChatSoundNotification.js
import { useEffect, useRef } from 'react'
import { subscribeToChatRoom } from '../services/chatService'
import { playChatMessageSound } from '../services/audioService'

/**
 * Hook dedicado para reproducir sonido cuando llegan nuevos mensajes
 * con el chat cerrado.
 *
 * ✅ CARACTERÍSTICAS:
 * - Funciona independientemente del estado del componente padre
 * - Usa refs para evitar re-renders innecesarios
 * - Detecta incrementos en el contador de no leídos
 *
 * @param {string} serviceId - ID del servicio a monitorear
 * @param {string} userRole - 'restaurant' o 'driver'
 * @param {React.MutableRefObject<boolean>} chatOpenRef - Ref al estado del chat
 */
export function useChatSoundNotification(serviceId, userRole, chatOpenRef) {
  const subscriptionRef = useRef(null)
  const lastUnreadRef = useRef(-1)
  const lastServiceIdRef = useRef(null)

  useEffect(() => {
    // Validar parámetros
    if (!serviceId || !userRole) {
      return
    }

    // Si el servicio cambió, resetear todo
    if (lastServiceIdRef.current !== serviceId) {
      // Limpiar suscripción anterior si existe
      if (subscriptionRef.current) {
        console.log('🧹 [useChatSoundNotification] Limpiando suscripción anterior')
        subscriptionRef.current()
        subscriptionRef.current = null
      }
      lastServiceIdRef.current = serviceId
      lastUnreadRef.current = -1
    }

    // Si ya tenemos una suscripción para este servicio, no crear otra
    if (subscriptionRef.current) {
      return
    }

    console.log('🔔 [useChatSoundNotification] Suscribiendo a:', serviceId)

    const unsubscribe = subscribeToChatRoom(serviceId, (room) => {
      if (!room) return

      // Obtener contador según rol
      const currentUnread = userRole === 'restaurant'
        ? (room.unreadByRestaurant || 0)
        : (room.unreadByDriver || 0)

      const prevUnread = lastUnreadRef.current
      const isChatOpen = chatOpenRef?.current ?? false

      console.log('📊 [useChatSoundNotification] Check:', {
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
        console.log('🔊 [useChatSoundNotification] 🔔 NUEVO MENSAJE - Reproduciendo sonido!')
        playChatMessageSound()

        // Opcional: Notificación del navegador
        if (Notification.permission === 'granted') {
          try {
            const senderName = userRole === 'restaurant'
              ? 'el Repartidor'
              : 'el Restaurante'

            new Notification(`💬 Nuevo mensaje de ${senderName}`, {
              body: room.lastMessage?.substring(0, 80) || 'Tienes un nuevo mensaje',
              icon: '/logo-192.png',
              tag: `chat-${serviceId}`,
              renotify: true
            })
          } catch (e) {
            console.log('No se pudo mostrar notificación del navegador')
          }
        }
      }

      // Siempre actualizar el último valor
      lastUnreadRef.current = currentUnread
    })

    subscriptionRef.current = unsubscribe

    // Cleanup
    return () => {
      if (subscriptionRef.current) {
        console.log('🧹 [useChatSoundNotification] Limpiando suscripción')
        subscriptionRef.current()
        subscriptionRef.current = null
      }
    }
  }, [serviceId, userRole, chatOpenRef])

  // Función para resetear el contador (llamar al marcar como leídos)
  const resetUnread = () => {
    lastUnreadRef.current = 0
  }

  return { resetUnread }
}

export default useChatSoundNotification