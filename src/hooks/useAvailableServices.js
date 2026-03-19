// src/hooks/useAvailableServices.js
// Hook para suscribirse a servicios disponibles para repartidores
import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  subscribeToAvailableServices, 
  acceptServiceBroadcast,
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

  // Suscribirse a servicios cuando el driver está online y tiene ubicación
  useEffect(() => {
    // Limpiar suscripción anterior
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }

    // Solo suscribir si está online y tiene ubicación válida
    if (!isOnline || !driverId || !driverLocation?.latitude || !driverLocation?.longitude) {
      setAvailableServices([])
      return
    }

    setLoading(true)

    // Suscribirse a servicios disponibles
    unsubscribeRef.current = subscribeToAvailableServices(
      driverId,
      driverLocation,
      (services) => {
        // Filtrar servicios no expirados
        const now = Date.now()
        const activeServices = services.filter(s => {
          const expiresAt = s.attemptExpiresAt || (s.attemptStartedAt + BROADCAST_CONFIG.WINDOW_DURATION)
          return now < expiresAt
        })
        
        setAvailableServices(activeServices)
        setLoading(false)
        setError(null)
      }
    )

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
  }, [driverId, driverLocation?.latitude, driverLocation?.longitude, isOnline])

  // Verificar expiraciones periódicamente
  useEffect(() => {
    if (availableServices.length === 0) return

    const checkExpirations = () => {
      const now = Date.now()
      const activeServices = availableServices.filter(s => {
        const expiresAt = s.attemptExpiresAt || (s.attemptStartedAt + BROADCAST_CONFIG.WINDOW_DURATION)
        return now < expiresAt
      })

      if (activeServices.length !== availableServices.length) {
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

    setAcceptingServiceId(serviceId)
    setError(null)

    try {
      const result = await acceptServiceBroadcast(serviceId, driverId, driverName)

      if (result.success) {
        // Remover el servicio de la lista local
        setAvailableServices(prev => prev.filter(s => s.serviceId !== serviceId && s.id !== serviceId))
      } else {
        setError(result.error || 'Error al aceptar servicio')
      }

      return result
    } catch (err) {
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setAcceptingServiceId(null)
    }
  }, [driverId])

  // Función para ignorar un servicio (removerlo localmente)
  const ignoreService = useCallback((serviceId) => {
    setAvailableServices(prev => prev.filter(s => s.serviceId !== serviceId && s.id !== serviceId))
  }, [])

  // Obtener el servicio más cercano
  const getClosestService = useCallback(() => {
    if (availableServices.length === 0) return null
    return availableServices[0] // Ya están ordenados por distancia
  }, [availableServices])

  return {
    availableServices,
    loading,
    error,
    acceptingServiceId,
    acceptService,
    ignoreService,
    getClosestService,
    hasAvailableServices: availableServices.length > 0
  }
}

export default useAvailableServices