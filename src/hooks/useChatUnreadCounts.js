// src/hooks/useChatUnreadCounts.js
import { useState, useEffect, useRef, useMemo } from 'react'
import { subscribeToChatRoom } from '../services/chatService'

/**
 * Hook para obtener contadores de mensajes no leídos para múltiples servicios
 * 
 * ✅ CORREGIDO: Evita loops de suscripción usando refs estables
 * 
 * @param {Array} services - Lista de servicios
 * @param {string} userRole - 'restaurant' | 'driver'
 * @returns {Object} - { serviceId: unreadCount }
 */
export function useChatUnreadCounts(services, userRole) {
  const [unreadCounts, setUnreadCounts] = useState({})
  
  // ============================================
  // 🔒 REFS PARA EVITAR BUCLES
  // ============================================
  const subscriptionsRef = useRef({})  // { serviceId: unsubscribe }
  const prevServiceIdsRef = useRef('')  // String de IDs para comparar

  // Crear ID estable de servicios activos
  const activeServiceIds = useMemo(() => {
    if (!services || !Array.isArray(services)) return []
    
    return services
      .filter(s => 
        s && 
        s.id && 
        (s.status === 'pendiente' || s.status === 'asignado' || s.status === 'en_camino')
      )
      .map(s => s.id)
      .sort()
  }, [services])

  const activeServiceIdsString = activeServiceIds.join(',')

  useEffect(() => {
    if (!userRole || activeServiceIds.length === 0) return

    // Solo actualizar si cambiaron los IDs de servicios
    if (activeServiceIdsString === prevServiceIdsRef.current) {
      return
    }
    prevServiceIdsRef.current = activeServiceIdsString

    console.log('🔔 [useChatUnreadCounts] Servicios cambiaron:', activeServiceIds.length, activeServiceIds)

    // Limpiar suscripciones de servicios que ya no existen
    const currentIds = new Set(activeServiceIds)
    Object.keys(subscriptionsRef.current).forEach(serviceId => {
      if (!currentIds.has(serviceId)) {
        console.log('🧹 [useChatUnreadCounts] Limpiando suscripción:', serviceId)
        subscriptionsRef.current[serviceId]()
        delete subscriptionsRef.current[serviceId]
      }
    })

    // Crear nuevas suscripciones solo para servicios nuevos
    activeServiceIds.forEach(serviceId => {
      if (subscriptionsRef.current[serviceId]) return

      console.log('🔔 [useChatUnreadCounts] Suscribiendo a:', serviceId)

      const unsubscribe = subscribeToChatRoom(serviceId, (room) => {
        if (room) {
          const count = userRole === 'restaurant' 
            ? (room.unreadByRestaurant || 0)
            : (room.unreadByDriver || 0)
          
          console.log('📊 [useChatUnreadCounts] Actualización:', {
            serviceId,
            userRole,
            unreadByRestaurant: room.unreadByRestaurant,
            unreadByDriver: room.unreadByDriver,
            countForRole: count
          })
          
          setUnreadCounts(prev => {
            // Solo actualizar si el valor cambió
            if (prev[serviceId] === count) {
              console.log('⏭️ [useChatUnreadCounts] Sin cambios, skip update')
              return prev
            }
            console.log('✅ [useChatUnreadCounts] Actualizando contador:', serviceId, '→', count)
            return { ...prev, [serviceId]: count }
          })
        }
      })

      subscriptionsRef.current[serviceId] = unsubscribe
    })
  }, [activeServiceIdsString, activeServiceIds, userRole])

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      console.log('🧹 [useChatUnreadCounts] Cleanup - desmontando')
      Object.values(subscriptionsRef.current).forEach(unsub => unsub())
      subscriptionsRef.current = {}
    }
  }, [])

  console.log('📤 [useChatUnreadCounts] Retornando:', unreadCounts)
  return unreadCounts
}

export default useChatUnreadCounts