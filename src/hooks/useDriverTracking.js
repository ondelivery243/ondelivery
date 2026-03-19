// src/hooks/useDriverTracking.js
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSnackbar } from 'notistack'
import { 
  checkGeolocationPermission,
  getCurrentPosition,
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
 * NOTA: El driver permanece ONLINE aunque cambie de pestaña
 * Solo se desconecta cuando cierra la app (onDisconnect de Firebase)
 */
export const useDriverTracking = (driverData, currentService = null) => {
  const { enqueueSnackbar } = useSnackbar()
  
  // Estado
  const [isTracking, setIsTracking] = useState(false)
  const [currentLocation, setCurrentLocation] = useState(null)
  const [error, setError] = useState(null)
  const [permissionStatus, setPermissionStatus] = useState(null)
  const [isInitialized, setIsInitialized] = useState(false)
  
  // Refs
  const trackingControl = useRef(null)
  const lastServiceId = useRef(null)
  const isMounted = useRef(true)
  const locationRetryRef = useRef(null)

  // Verificar permisos al montar
  useEffect(() => {
    const checkPermission = async () => {
      console.log('🔍 useDriverTracking: Verificando permisos...')
      const result = await checkGeolocationPermission()
      console.log('📋 Resultado permisos:', result)
      if (isMounted.current) {
        setPermissionStatus(result)
        if (result.granted === false) {
          setError(result.reason)
        }
      }
    }
    checkPermission()
  }, [])

  // Iniciar tracking
  const startTracking = useCallback(async () => {
    console.log('🚀 startTracking llamado, driverData:', driverData?.id)
    
    if (!driverData?.id) {
      const err = new Error('No hay datos del conductor')
      console.error('❌', err.message)
      setError(err.message)
      return Promise.reject(err)
    }

    isMounted.current = true

    const permCheck = await checkGeolocationPermission()
    
    if (permCheck.granted === false) {
      setError(permCheck.reason)
      enqueueSnackbar(permCheck.reason, { variant: 'error' })
      return Promise.reject(new Error(permCheck.reason))
    }

    setError(null)
    setIsTracking(true)
    setIsInitialized(true)
    
    // Obtener ubicación inicial
    try {
      const position = await getCurrentPosition()
      if (isMounted.current && position) {
        setCurrentLocation(position)
      }
    } catch (err) {
      console.log('⚠️ Primera ubicación no disponible:', err.message)
    }

    // Iniciar tracking continuo
    console.log('👁️ Iniciando tracking continuo...')
    trackingControl.current = startDriverTracking(
      driverData.id,
      (location) => {
        if (isMounted.current) {
          setCurrentLocation(location)
          setError(null)
        }
        
        if (currentService?.id && currentService.id !== lastServiceId.current) {
          updateServiceRoute(currentService.id, location)
        }
      },
      (err) => {
        console.error('❌ Error de tracking:', err.message)
        if (isMounted.current) {
          if (err.message.includes('denegado') || err.message.includes('PERMISSION')) {
            setError(err.message)
            setIsTracking(false)
            enqueueSnackbar(err.message, { variant: 'error' })
          }
        }
      }
    )

    // Tracking de servicio si hay uno activo
    if (currentService?.id) {
      startServiceTracking(currentService.id, driverData.id, {
        restaurantId: currentService.restaurantId,
        restaurantLocation: currentService.restaurantLocation,
        deliveryLocation: currentService.deliveryLocation
      }).catch(() => {})
      lastServiceId.current = currentService.id
    }

    enqueueSnackbar('GPS activado', { variant: 'success' })
    return Promise.resolve()
  }, [driverData, currentService, enqueueSnackbar])

  // Detener tracking
  const stopTracking = useCallback(async () => {
    console.log('🛑 stopTracking llamado')
    isMounted.current = false
    setIsTracking(false)
    setCurrentLocation(null)
    
    if (locationRetryRef.current) {
      clearTimeout(locationRetryRef.current)
      locationRetryRef.current = null
    }
    
    if (trackingControl.current) {
      try {
        await trackingControl.current.stop()
      } catch (e) {}
      trackingControl.current = null
    }
    
    if (driverData?.id) {
      try {
        await stopDriverTracking(driverData.id)
      } catch (e) {}
    }
    
    if (lastServiceId.current) {
      try {
        await endServiceTracking(lastServiceId.current)
      } catch (e) {}
      lastServiceId.current = null
    }
    
    enqueueSnackbar('GPS desactivado', { variant: 'info' })
  }, [driverData, enqueueSnackbar])

  // Forzar obtención de ubicación
  const forceGetLocation = useCallback(async () => {
    isMounted.current = true
    
    try {
      const position = await getCurrentPosition({ timeout: 20000 })
      if (isMounted.current && position) {
        setCurrentLocation(position)
        setError(null)
        enqueueSnackbar('Ubicación actualizada', { variant: 'success' })
        return position
      }
    } catch (err) {
      console.error('❌ Error en forceGetLocation:', err.message)
      if (isMounted.current) {
        if (err.message === 'PERMISSION_DENIED') {
          setError('Permiso de ubicación denegado')
          enqueueSnackbar('Habilita el permiso de ubicación', { variant: 'error' })
        } else {
          enqueueSnackbar('No se pudo obtener la ubicación', { variant: 'warning' })
        }
      }
    }
    return null
  }, [enqueueSnackbar])

  // Pausar/reanudar
  const pauseTracking = useCallback(async () => {
    if (trackingControl.current?.pause) {
      await trackingControl.current.pause()
      setIsTracking(false)
    }
  }, [])

  const resumeTracking = useCallback(() => {
    isMounted.current = true
    if (trackingControl.current?.resume) {
      trackingControl.current.resume()
      setIsTracking(true)
    } else {
      startTracking()
    }
  }, [startTracking])

  const getETA = useCallback((destination) => {
    if (!currentLocation || !destination) return null
    return calculateETA(currentLocation, destination)
  }, [currentLocation])

  const geocode = useCallback(async (address) => {
    return await geocodeAddress(address)
  }, [])

  // Cleanup
  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
      if (trackingControl.current) {
        trackingControl.current.stop().catch(() => {})
      }
      if (locationRetryRef.current) {
        clearTimeout(locationRetryRef.current)
      }
    }
  }, [])

  // Cambio de servicio
  useEffect(() => {
    if (isTracking && currentService?.id && currentService.id !== lastServiceId.current) {
      if (lastServiceId.current) {
        endServiceTracking(lastServiceId.current).catch(() => {})
      }
      startServiceTracking(currentService.id, driverData?.id, {
        restaurantId: currentService.restaurantId,
        restaurantLocation: currentService.restaurantLocation,
        deliveryLocation: currentService.deliveryLocation
      }).catch(() => {})
      lastServiceId.current = currentService.id
    }
  }, [currentService, driverData, isTracking])

  return {
    isTracking,
    currentLocation,
    error,
    permissionStatus,
    isInitialized,
    startTracking,
    stopTracking,
    pauseTracking,
    resumeTracking,
    forceGetLocation,
    getETA,
    geocode
  }
}

/**
 * Hook para monitorear ubicación de conductor
 */
export const useDriverMonitor = (driverId, serviceId = null) => {
  const [driverLocation, setDriverLocation] = useState(null)
  const [serviceTracking, setServiceTracking] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  useEffect(() => {
    if (!driverId) return

    import('../services/locationService').then(({ 
      subscribeToDriverLocation,
      subscribeToServiceTracking 
    }) => {
      if (!isMounted.current) return
      
      const unsubLocation = subscribeToDriverLocation(driverId, (location) => {
        if (isMounted.current) {
          setDriverLocation(location)
          setIsConnected(!!location?.isValid)
          setLastUpdate(location?.timestamp || null)
        }
      })

      let unsubService = null
      if (serviceId) {
        unsubService = subscribeToServiceTracking(serviceId, (tracking) => {
          if (isMounted.current) {
            setServiceTracking(tracking)
          }
        })
      }

      return () => {
        unsubLocation?.()
        unsubService?.()
      }
    })
  }, [driverId, serviceId])

  const getETA = useCallback((destination) => {
    if (!driverLocation || !destination) return null
    return calculateETA(driverLocation, destination)
  }, [driverLocation])

  return { driverLocation, serviceTracking, isConnected, lastUpdate, getETA }
}

export default useDriverTracking