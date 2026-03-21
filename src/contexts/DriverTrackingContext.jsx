// src/contexts/DriverTrackingContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useSnackbar } from 'notistack'
import { 
  checkGeolocationPermission,
  getCurrentPosition,
  startDriverTracking, 
  setDriverOffline,
  setDriverOnlineRTDB,
  calculateETA,
  geocodeAddress
} from '../services/locationService'
import { useStore } from '../store/useStore'

const DriverTrackingContext = createContext(null)

/**
 * Contexto global para el tracking GPS del repartidor
 * 
 * El GPS permanece ACTIVO mientras el driver está ONLINE.
 * No se detiene al navegar entre páginas porque el contexto es global.
 */
export const DriverTrackingProvider = ({ children }) => {
  const { enqueueSnackbar } = useSnackbar()
  const { user } = useStore()
  
  // Estado
  const [driverData, setDriverData] = useState(null)
  const [isOnline, setIsOnline] = useState(false)
  const [isTracking, setIsTracking] = useState(false)
  const [currentLocation, setCurrentLocation] = useState(null)
  const [error, setError] = useState(null)
  const [permissionStatus, setPermissionStatus] = useState(null)
  
  // Refs
  const trackingControl = useRef(null)
  const driverIdRef = useRef(null)
  const isOnlineRef = useRef(false)
  const isMounted = useRef(true)

  // Mantener refs actualizados
  useEffect(() => {
    driverIdRef.current = driverData?.id
  }, [driverData?.id])

  useEffect(() => {
    isOnlineRef.current = isOnline
  }, [isOnline])

  // Solo cargar datos si es repartidor
  useEffect(() => {
    const loadDriverData = async () => {
      // Solo procesar si es repartidor
      if (!user?.uid || user?.role !== 'repartidor') {
        setDriverData(null)
        setIsOnline(false)
        setIsTracking(false)
        return
      }

      console.log('🔄 Cargando datos del repartidor en contexto global...')
      
      const data = {
        id: user.driverId || user.uid,
        name: user.name || 'Repartidor',
        email: user.email,
        photoURL: user.photoURL,
        phone: user.phone
      }
      
      setDriverData(data)
      
      // Iniciar como OFFLINE por seguridad
      try {
        await setDriverOffline(data.id)
        console.log('✅ Repartidor iniciado como OFFLINE (seguridad)')
      } catch (e) {
        console.log('⚠️ Error marcando offline inicial:', e.message)
      }
    }

    loadDriverData()
  }, [user])

  // Verificar permisos
  useEffect(() => {
    if (user?.role !== 'repartidor') return
    
    const checkPermission = async () => {
      const result = await checkGeolocationPermission()
      if (isMounted.current) {
        setPermissionStatus(result)
        if (result.granted === false) {
          setError(result.reason)
        }
      }
    }
    checkPermission()
  }, [user])

  // Evento de cierre de app
  useEffect(() => {
    if (user?.role !== 'repartidor') return

    const handlePageHide = () => {
      console.log('📱 pagehide detectado - cerrando app')
      // El onDisconnect de Firebase se encarga automáticamente
    }

    window.addEventListener('pagehide', handlePageHide)
    
    return () => {
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [user])

  // PONERSE ONLINE
  const goOnline = useCallback(async () => {
    if (!driverData?.id) {
      enqueueSnackbar('No hay datos del conductor', { variant: 'error' })
      return false
    }

    console.log('🟢 Activando modo online...')

    try {
      const permCheck = await checkGeolocationPermission()
      if (permCheck.granted === false) {
        setError(permCheck.reason)
        enqueueSnackbar(permCheck.reason, { variant: 'error' })
        return false
      }

      // Marcar online en Firebase
      await setDriverOnlineRTDB(driverData.id, {
        name: driverData.name,
        phone: driverData.phone
      })

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
        },
        (err) => {
          console.error('❌ Error de tracking:', err.message)
          if (isMounted.current && err.message.includes('denegado')) {
            setError(err.message)
            enqueueSnackbar(err.message, { variant: 'error' })
          }
        }
      )

      setIsOnline(true)
      setIsTracking(true)
      setError(null)
      
      enqueueSnackbar('Estás en línea', { variant: 'success' })
      return true
    } catch (error) {
      console.error('❌ Error activando online:', error)
      enqueueSnackbar('Error al activar: ' + error.message, { variant: 'error' })
      return false
    }
  }, [driverData, enqueueSnackbar])

  // PONERSE OFFLINE
  const goOffline = useCallback(async () => {
    console.log('🔴 Desactivando modo online...')

    try {
      if (trackingControl.current) {
        await trackingControl.current.stop(true)
        trackingControl.current = null
      }

      setIsOnline(false)
      setIsTracking(false)
      setCurrentLocation(null)
      
      enqueueSnackbar('Estás fuera de línea', { variant: 'info' })
      return true
    } catch (error) {
      console.error('❌ Error desactivando:', error)
      return false
    }
  }, [enqueueSnackbar])

  // FORZAR ACTUALIZACIÓN DE UBICACIÓN
  const forceGetLocation = useCallback(async () => {
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
      enqueueSnackbar('No se pudo obtener la ubicación', { variant: 'warning' })
    }
    return null
  }, [enqueueSnackbar])

  // CLEANUP
  useEffect(() => {
    isMounted.current = true
    
    return () => {
      console.log('🧹 DriverTrackingContext cleanup')
      isMounted.current = false
      
      if (trackingControl.current && isOnlineRef.current) {
        trackingControl.current.stop(true).catch(() => {})
      }
    }
  }, [])

  const value = {
    driverData,
    isOnline,
    isTracking,
    currentLocation,
    error,
    permissionStatus,
    goOnline,
    goOffline,
    forceGetLocation,
    calculateETA: (destination) => {
      if (!currentLocation || !destination) return null
      return calculateETA(currentLocation, destination)
    },
    geocode: async (address) => {
      return await geocodeAddress(address)
    }
  }

  return (
    <DriverTrackingContext.Provider value={value}>
      {children}
    </DriverTrackingContext.Provider>
  )
}

export const useDriverTracking = () => {
  const context = useContext(DriverTrackingContext)
  if (!context) {
    throw new Error('useDriverTracking debe usarse dentro de DriverTrackingProvider')
  }
  return context
}

export default DriverTrackingContext