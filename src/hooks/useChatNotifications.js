// src/hooks/useChatNotifications.js
import { useEffect, useRef } from 'react'
import { subscribeToChatRoom } from '../services/chatService'
import { playChatMessageSound } from '../services/audioService'

/**
 * Hook para reproducir sonido cuando llegan nuevos mensajes
 * Usar cuando el chat está cerrado
 *
 * ✅ CORREGIDO: Ahora acepta un RefObject para el estado del chat
 * para evitar problemas de stale closure
 *
 * @param {Array} services - Lista de servicios a monitorear
 * @param {string} userRole - 'restaurant' o 'driver'
 * @param {React.MutableRefObject<boolean>} chatOpenRef - Ref al estado del chat (¡debe ser un ref!)
 */
export function useChatNotifications(services, userRole, chatOpenRef) {
  const subscriptionsRef = useRef({})
  const lastUnreadRef = useRef({})  // { serviceId: lastUnreadCount }
  const prevServiceIdsRef = useRef('')

  useEffect(() => {
    console.log('🔔 [useChatNotifications] Ejecutando efecto:', {
      servicesCount: services?.length || 0,
      userRole,
      hasChatOpenRef: !!chatOpenRef
    })

    if (!services || !userRole) {
      console.log('⚠️ [useChatNotifications] Sin servicios o userRole, saliendo')
      return
    }

    // Filtrar servicios activos con conductor
    const activeServices = services.filter(s => {
      const hasDriver = s.driverId
      const isValidStatus = s.status !== 'pendiente' && s.status !== 'cancelado' && s.status !== 'entregado'
      console.log('🔍 [useChatNotifications] Filtrando servicio:', {
        id: s.id,
        driverId: s.driverId,
        status: s.status,
        hasDriver,
        isValidStatus,
        include: hasDriver && isValidStatus
      })
      return hasDriver && isValidStatus
    })

    console.log('📋 [useChatNotifications] Servicios activos después del filtro:', activeServices.length)

    // Crear string de IDs para comparar
    const serviceIdsString = activeServices.map(s => s.id).sort().join(',')

    // Si no cambiaron los servicios, no hacer nada
    if (serviceIdsString === prevServiceIdsRef.current) {
      console.log('⏭️ [useChatNotifications] Servicios sin cambios, skip')
      return
    }
    prevServiceIdsRef.current = serviceIdsString

    console.log('🔔 [useChatNotifications] Servicios cambiaron:', activeServices.length)

    // Limpiar suscripciones de servicios que ya no existen
    const currentIds = new Set(activeServices.map(s => s.id))
    Object.keys(subscriptionsRef.current).forEach(serviceId => {
      if (!currentIds.has(serviceId)) {
        console.log('🧹 [useChatNotifications] Limpiando suscripción:', serviceId)
        subscriptionsRef.current[serviceId]()
        delete subscriptionsRef.current[serviceId]
        delete lastUnreadRef.current[serviceId]
      }
    })

    // Crear nuevas suscripciones
    activeServices.forEach(service => {
      const serviceId = service.id
      if (subscriptionsRef.current[serviceId]) return

      // Inicializar en -1 para no disparar en la primera carga
      lastUnreadRef.current[serviceId] = -1

      console.log('🔔 [useChatNotifications] Suscribiendo a:', serviceId)

      const unsubscribe = subscribeToChatRoom(serviceId, (room) => {
        if (!room) return

        // Obtener contador según rol
        const currentUnread = userRole === 'restaurant'
          ? (room.unreadByRestaurant || 0)
          : (room.unreadByDriver || 0)

        const prevUnread = lastUnreadRef.current[serviceId]
        const isChatOpen = chatOpenRef?.current ?? false

        console.log('📊 [useChatNotifications] Check:', {
          serviceId,
          currentUnread,
          prevUnread,
          isChatOpen,
          userRole
        })

        // 🔊 Detectar incremento de mensajes no leídos
        // Solo reproducir sonido si:
        // 1. Ya habíamos recibido al menos una actualización (prevUnread >= 0)
        // 2. El contador aumentó (currentUnread > prevUnread)
        // 3. El chat está cerrado
        if (prevUnread >= 0 && currentUnread > prevUnread && !isChatOpen) {
          console.log('🔊 [useChatNotifications] 🔔 NUEVO MENSAJE - Reproduciendo sonido!')
          playChatMessageSound()

          // Notificación del navegador
          if (Notification.permission === 'granted') {
            try {
              const senderName = userRole === 'restaurant'
                ? (service.driverName || 'el Repartidor')
                : (service.restaurantName || 'el Restaurante')

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
        lastUnreadRef.current[serviceId] = currentUnread
      })

      subscriptionsRef.current[serviceId] = unsubscribe
    })
  }, [services, userRole, chatOpenRef])

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      console.log('🧹 [useChatNotifications] Cleanup - desmontando')
      Object.values(subscriptionsRef.current).forEach(unsub => unsub())
      subscriptionsRef.current = {}
      lastUnreadRef.current = {}
    }
  }, [])
}

export default useChatNotifications