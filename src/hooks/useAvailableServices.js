// src/hooks/useAvailableServices.js
// Hook para suscribirse a servicios disponibles para repartidores
import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  subscribeToAvailableServices as subscribeToServices,
  acceptServiceBroadcast,
  rejectServiceBroadcast,
  BROADCAST_CONFIG 
} from '../services/broadcastService'

/**
 * Hook para manejar servicios disponibles para el repartidor
 * @param {string} driverId - ID del repartidor
 * @param {object} driverLocation - { latitude, longitude } del repartidor
 * @param {boolean} isOnline - Si el repartidor está online
 */
export const useAvailableServices = (driverId, driverLocation, isOnline) => {
  const [availableServices, setAvailableServices] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [acceptingServiceId, setAcceptingServiceId] = useState(null)
  
  const unsubscribeRef = useRef(null)
  const expirationCheckRef = useRef(null)
  const initialLoadDoneRef = useRef(false)
  const mountedRef = useRef(true)
  const lastLocationRef = useRef(null)

  // Efecto para trackear si el componente está montado
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Suscribirse a servicios cuando el driver está online y tiene ubicación
  useEffect(() => {
    // Verificar si la ubicación cambió significativamente (más de 100m)
    const locationChanged = !lastLocationRef.current || 
      (driverLocation?.latitude && driverLocation?.longitude && (
        Math.abs(lastLocationRef.current.latitude - driverLocation.latitude) > 0.001 ||
        Math.abs(lastLocationRef.current.longitude - driverLocation.longitude) > 0.001
      ))

    // Actualizar referencia de ubicación
    if (driverLocation?.latitude && driverLocation?.longitude) {
      lastLocationRef.current = {
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude
      }
    }

    // Limpiar suscripción anterior
    if (unsubscribeRef.current) {
      console.log('🧹 Limpiando suscripción anterior de servicios')
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }

    // Solo suscribir si está online y tiene ubicación válida
    if (!isOnline || !driverId || !driverLocation?.latitude || !driverLocation?.longitude) {
      if (mountedRef.current) {
        setAvailableServices([])
        setLoading(false)
      }
      return
    }

    console.log('🔔 Suscribiendo a servicios disponibles...', { 
      driverId, 
      location: driverLocation,
      isOnline 
    })

    // Solo mostrar loading en la primera carga, no en cada actualización
    if (!initialLoadDoneRef.current && mountedRef.current) {
      setLoading(true)
    }

    // Suscribirse a servicios disponibles
    unsubscribeRef.current = subscribeToServices(
      driverId,
      driverLocation,
      (services) => {
        if (!mountedRef.current) return
        
        // Filtrar servicios no expirados
        const now = Date.now()
        const activeServices = services.filter(s => {
          const expiresAt = s.attemptExpiresAt || (s.attemptStartedAt + BROADCAST_CONFIG.WINDOW_DURATION)
          return now < expiresAt
        })
        
        console.log(`📦 Servicios disponibles: ${activeServices.length}`)
        
        setAvailableServices(activeServices)
        setLoading(false)
        setError(null)
        initialLoadDoneRef.current = true
      }
    )

    return () => {
      if (unsubscribeRef.current) {
        console.log('🧹 Cleanup: desuscribiendo de servicios')
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
  }, [driverId, driverLocation?.latitude, driverLocation?.longitude, isOnline])

  // Verificar expiraciones periódicamente
  useEffect(() => {
    if (availableServices.length === 0) return

    const checkExpirations = () => {
      if (!mountedRef.current) return
      
      const now = Date.now()
      const activeServices = availableServices.filter(s => {
        const expiresAt = s.attemptExpiresAt || (s.attemptStartedAt + BROADCAST_CONFIG.WINDOW_DURATION)
        return now < expiresAt
      })

      if (activeServices.length !== availableServices.length) {
        console.log(`⏰ ${availableServices.length - activeServices.length} servicios expirados`)
        setAvailableServices(activeServices)
      }
    }

    expirationCheckRef.current = setInterval(checkExpirations, 1000)

    return () => {
      if (expirationCheckRef.current) {
        clearInterval(expirationCheckRef.current)
      }
    }
  }, [availableServices])

  // Función para aceptar un servicio
  const acceptService = useCallback(async (serviceId, driverName) => {
    if (!serviceId || !driverId) {
      return { success: false, error: 'Datos incompletos' }
    }

    console.log('✅ Aceptando servicio:', serviceId, 'para driver:', driverName)
    setAcceptingServiceId(serviceId)
    setError(null)

    try {
      const result = await acceptServiceBroadcast(serviceId, driverId, driverName)

      if (!mountedRef.current) return result

      if (result.success) {
        console.log('✅ Servicio aceptado exitosamente')
        // Remover TODOS los servicios de la lista local (solo puede tener uno activo)
        setAvailableServices([])
      } else {
        console.log('❌ Error aceptando servicio:', result.error)
        setError(result.error || 'Error al aceptar servicio')
        // Si el error es que ya no está disponible, removerlo de la lista
        if (result.reason === 'accepted' || result.error?.includes('no disponible')) {
          setAvailableServices(prev => prev.filter(s => s.serviceId !== serviceId && s.id !== serviceId))
        }
      }

      return result
    } catch (err) {
      if (!mountedRef.current) return { success: false, error: err.message }
      
      console.error('❌ Excepción aceptando servicio:', err)
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      if (mountedRef.current) {
        setAcceptingServiceId(null)
      }
    }
  }, [driverId])

  // Función para rechazar un servicio (notificar al sistema)
  const rejectService = useCallback(async (serviceId) => {
    if (!serviceId || !driverId) {
      return { success: false, error: 'Datos incompletos' }
    }

    console.log('❌ Rechazando servicio:', serviceId)

    try {
      const result = await rejectServiceBroadcast(serviceId, driverId)

      if (!mountedRef.current) return result

      if (result.success) {
        // Remover el servicio de la lista local
        setAvailableServices(prev => prev.filter(s => s.serviceId !== serviceId && s.id !== serviceId))
      }

      return result
    } catch (err) {
      console.error('Error rechazando servicio:', err)
      return { success: false, error: err.message }
    }
  }, [driverId])

  // Función para ignorar un servicio (solo removerlo localmente, sin notificar)
  const ignoreService = useCallback((serviceId) => {
    console.log('🔕 Ignorando servicio:', serviceId)
    setAvailableServices(prev => prev.filter(s => s.serviceId !== serviceId && s.id !== serviceId))
  }, [])

  // Obtener el servicio más cercano
  const getClosestService = useCallback(() => {
    if (availableServices.length === 0) return null
    return availableServices[0] // Ya están ordenados por distancia
  }, [availableServices])

  // Función para limpiar errores
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    availableServices,
    loading,
    error,
    acceptingServiceId,
    acceptService,
    rejectService,
    ignoreService,
    getClosestService,
    clearError,
    hasAvailableServices: availableServices.length > 0
  }
}

export default useAvailableServices