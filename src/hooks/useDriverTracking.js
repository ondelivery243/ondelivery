// src/hooks/useDriverTracking.js
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSnackbar } from 'notistack'
import { 
  startDriverTracking, 
  stopDriverTracking,
  startServiceTracking,
  updateServiceRoute,
  endServiceTracking,
  calculateETA,
  geocodeAddress
} from '../services/locationService'

/**
 * Hook para manejar el tracking GPS del repartidor
 * @param {Object} driverData - Datos del conductor {id, name}
 * @param {Object} currentService - Servicio activo actual
 * @returns {Object} - Estado y funciones de control
 */
export const useDriverTracking = (driverData, currentService = null) => {
  const { enqueueSnackbar } = useSnackbar()
  
  // Estado
  const [isTracking, setIsTracking] = useState(false)
  const [currentLocation, setCurrentLocation] = useState(null)
  const [error, setError] = useState(null)
  const [isInitialized, setIsInitialized] = useState(false)
  
  // Refs
  const trackingControl = useRef(null)
  const lastServiceId = useRef(null)

  // Iniciar tracking cuando el conductor se pone online
  const startTracking = useCallback(async () => {
    if (!driverData?.id) {
      setError('No hay datos del conductor')
      return
    }

    setError(null)
    
    try {
      // Iniciar tracking de ubicación
      trackingControl.current = startDriverTracking(
        driverData.id,
        (location) => {
          setCurrentLocation(location)
          
          // Si hay un servicio activo, actualizar la ruta
          if (currentService?.id && currentService.id !== lastServiceId.current) {
            updateServiceRoute(currentService.id, location)
          }
        },
        (err) => {
          setError(err.message)
          enqueueSnackbar(`Error de ubicación: ${err.message}`, { variant: 'warning' })
        }
      )

      setIsTracking(true)
      setIsInitialized(true)
      
      // Si hay un servicio activo, iniciar tracking del servicio
      if (currentService?.id) {
        await startServiceTracking(currentService.id, driverData.id, {
          restaurantId: currentService.restaurantId,
          restaurantLocation: currentService.restaurantLocation,
          deliveryLocation: currentService.deliveryLocation
        })
        lastServiceId.current = currentService.id
      }

      enqueueSnackbar('Tracking GPS activado', { variant: 'success' })
    } catch (err) {
      setError(err.message)
      enqueueSnackbar('Error al iniciar tracking', { variant: 'error' })
    }
  }, [driverData, currentService, enqueueSnackbar])

  // Detener tracking
  const stopTracking = useCallback(async () => {
    if (trackingControl.current) {
      await trackingControl.current.stop()
      trackingControl.current = null
    }
    
    if (driverData?.id) {
      await stopDriverTracking(driverData.id)
    }
    
    // Finalizar tracking de servicio si hay uno activo
    if (lastServiceId.current) {
      await endServiceTracking(lastServiceId.current)
      lastServiceId.current = null
    }
    
    setIsTracking(false)
    setCurrentLocation(null)
    enqueueSnackbar('Tracking GPS desactivado', { variant: 'info' })
  }, [driverData, enqueueSnackbar])

  // Pausar tracking (mantener ubicación pero no actualizar)
  const pauseTracking = useCallback(async () => {
    if (trackingControl.current) {
      await trackingControl.current.pause()
      setIsTracking(false)
    }
  }, [])

  // Reanudar tracking
  const resumeTracking = useCallback(() => {
    if (trackingControl.current) {
      trackingControl.current.resume()
      setIsTracking(true)
    } else {
      startTracking()
    }
  }, [startTracking])

  // Calcular ETA a destino
  const getETA = useCallback((destination) => {
    if (!currentLocation || !destination) return null
    return calculateETA(currentLocation, destination)
  }, [currentLocation])

  // Geocodificar dirección
  const geocode = useCallback(async (address) => {
    return await geocodeAddress(address)
  }, [])

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (trackingControl.current) {
        trackingControl.current.stop()
      }
    }
  }, [])

  // Cambio de servicio activo
  useEffect(() => {
    if (isTracking && currentService?.id && currentService.id !== lastServiceId.current) {
      // Finalizar tracking anterior si existe
      if (lastServiceId.current) {
        endServiceTracking(lastServiceId.current)
      }
      
      // Iniciar nuevo tracking
      startServiceTracking(currentService.id, driverData.id, {
        restaurantId: currentService.restaurantId,
        restaurantLocation: currentService.restaurantLocation,
        deliveryLocation: currentService.deliveryLocation
      })
      
      lastServiceId.current = currentService.id
    }
  }, [currentService, driverData, isTracking])

  return {
    isTracking,
    currentLocation,
    error,
    isInitialized,
    startTracking,
    stopTracking,
    pauseTracking,
    resumeTracking,
    getETA,
    geocode
  }
}

/**
 * Hook para monitorear la ubicación de un conductor (para restaurantes/admin)
 * @param {string} driverId - ID del conductor a monitorear
 * @param {string} serviceId - ID del servicio (opcional)
 * @returns {Object} - Estado del tracking
 */
export const useDriverMonitor = (driverId, serviceId = null) => {
  const [driverLocation, setDriverLocation] = useState(null)
  const [serviceTracking, setServiceTracking] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)

  useEffect(() => {
    if (!driverId) return

    // Importar dinámicamente para evitar errores en SSR
    import('../services/locationService').then(({ 
      subscribeToDriverLocation,
      subscribeToServiceTracking 
    }) => {
      // Suscribirse a ubicación del conductor
      const unsubLocation = subscribeToDriverLocation(driverId, (location) => {
        setDriverLocation(location)
        setIsConnected(!!location?.isValid)
        setLastUpdate(location?.timestamp || null)
      })

      // Suscribirse a tracking del servicio si hay serviceId
      let unsubService = null
      if (serviceId) {
        unsubService = subscribeToServiceTracking(serviceId, (tracking) => {
          setServiceTracking(tracking)
        })
      }

      return () => {
        unsubLocation()
        if (unsubService) unsubService()
      }
    })
  }, [driverId, serviceId])

  // Calcular ETA si hay ubicación y destino
  const getETA = useCallback((destination) => {
    if (!driverLocation || !destination) return null
    return calculateETA(driverLocation, destination)
  }, [driverLocation])

  return {
    driverLocation,
    serviceTracking,
    isConnected,
    lastUpdate,
    getETA
  }
}

export default useDriverTracking
