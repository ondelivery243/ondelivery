// src/services/locationService.js
// Servicio de rastreo GPS en tiempo real para repartidores
import { ref, set, onValue, off, remove, update, push, onDisconnect } from 'firebase/database'
import { rtdb, auth } from '../config/firebase'

// Colecciones en Realtime Database
const DRIVERS_LOCATIONS = 'drivers_locations'
const SERVICE_TRACKING = 'service_tracking'

// ============================================
// VERIFICAR PERMISOS DE GEOLOCALIZACIÓN
// ============================================

export const checkGeolocationPermission = async () => {
  console.log('🔍 Verificando permisos de geolocalización...')
  
  if (!('geolocation' in navigator)) {
    console.error('❌ Geolocalización no soportada')
    return { granted: false, reason: 'Geolocalización no soportada en este navegador' }
  }

  if (!('permissions' in navigator)) {
    console.log('⚠️ API de permisos no disponible, intentando directamente...')
    return { granted: true, reason: 'Intentando obtener ubicación...' }
  }

  try {
    const result = await navigator.permissions.query({ name: 'geolocation' })
    console.log('📋 Estado del permiso:', result.state)
    
    if (result.state === 'granted') {
      return { granted: true, reason: 'Permiso concedido' }
    } else if (result.state === 'prompt') {
      return { granted: null, reason: 'Se solicitará permiso' }
    } else {
      return { granted: false, reason: 'Permiso denegado. Habilita la ubicación en la configuración del navegador.' }
    }
  } catch (e) {
    console.log('⚠️ Error verificando permisos:', e.message)
    return { granted: true, reason: 'Intentando obtener ubicación...' }
  }
}

// ============================================
// OBTENER UBICACIÓN (una vez) - MEJORADO
// ============================================

export const getCurrentPosition = (options = {}) => {
  return new Promise((resolve, reject) => {
    console.log('📍 getCurrentPosition iniciado...')
    
    if (!('geolocation' in navigator)) {
      console.error('❌ Geolocalización no soportada')
      reject(new Error('Geolocalización no soportada en este navegador'))
      return
    }

    const defaultOptions = {
      enableHighAccuracy: false,
      timeout: 10000,  // 10 segundos
      maximumAge: 300000  // 5 minutos de caché
    }

    const finalOptions = { ...defaultOptions, ...options }
    console.log('📍 Opciones:', finalOptions)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('✅ Ubicación obtenida:', {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        })
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          timestamp: Date.now()
        })
      },
      (error) => {
        console.error('❌ Error de geolocalización:', error.code, error.message)
        let message = 'Error desconocido'
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'PERMISSION_DENIED'
            break
          case error.POSITION_UNAVAILABLE:
            message = 'POSITION_UNAVAILABLE'
            break
          case error.TIMEOUT:
            message = 'TIMEOUT'
            break
        }
        reject(new Error(message))
      },
      finalOptions
    )
  })
}

// ============================================
// CONFIGURAR AUTO-DESCONEXIÓN
// ============================================

export const setupAutoDisconnect = (driverId) => {
  if (!driverId || !auth.currentUser) {
    console.log('⚠️ No se puede configurar auto-desconexión: sin driverId o sin auth')
    return null
  }

  console.log('🔧 Configurando auto-desconexión para driver:', driverId)
  
  const locationRef = ref(rtdb, `${DRIVERS_LOCATIONS}/${driverId}`)
  
  // Configurar onDisconnect para marcar offline cuando se pierda conexión
  const disconnectHandler = onDisconnect(locationRef)
  
  disconnectHandler.update({
    online: false,
    lastSeen: Date.now(),
    disconnectedAt: new Date().toISOString()
  }).then(() => {
    console.log('✅ Auto-desconexión configurada correctamente')
  }).catch((error) => {
    console.error('❌ Error configurando auto-desconexión:', error.message)
  })

  return disconnectHandler
}

// ============================================
// CANCELAR AUTO-DESCONEXIÓN
// ============================================

export const cancelAutoDisconnect = async (driverId) => {
  if (!driverId) return
  
  console.log('🚫 Cancelando auto-desconexión para driver:', driverId)
  
  const locationRef = ref(rtdb, `${DRIVERS_LOCATIONS}/${driverId}`)
  
  try {
    // Cancelar el onDisconnect
    await onDisconnect(locationRef).cancel()
    console.log('✅ Auto-desconexión cancelada')
  } catch (error) {
    console.error('❌ Error cancelando auto-desconexión:', error.message)
  }
}

// ============================================
// MARCAR DRIVER COMO OFFLINE
// ============================================

export const setDriverOffline = async (driverId) => {
  if (!driverId || !auth.currentUser) {
    console.log('⚠️ No se puede marcar offline: sin driverId o sin auth')
    return false
  }

  console.log('🔴 Marcando driver como offline:', driverId)
  
  const locationRef = ref(rtdb, `${DRIVERS_LOCATIONS}/${driverId}`)
  
  try {
    await update(locationRef, {
      online: false,
      lastSeen: Date.now(),
      disconnectedAt: new Date().toISOString()
    })
    console.log('✅ Driver marcado como offline en RTDB')
    return true
  } catch (error) {
    console.error('❌ Error marcando driver offline:', error.message)
    return false
  }
}

// ============================================
// MARCAR DRIVER COMO ONLINE
// ============================================

export const setDriverOnlineRTDB = async (driverId, locationData = {}) => {
  if (!driverId || !auth.currentUser) {
    console.log('⚠️ No se puede marcar online: sin driverId o sin auth')
    return false
  }

  console.log('🟢 Marcando driver como online:', driverId)
  
  const locationRef = ref(rtdb, `${DRIVERS_LOCATIONS}/${driverId}`)
  
  try {
    await update(locationRef, {
      ...locationData,
      online: true,
      lastSeen: Date.now(),
      connectedAt: new Date().toISOString()
    })
    console.log('✅ Driver marcado como online en RTDB')
    return true
  } catch (error) {
    console.error('❌ Error marcando driver online:', error.message)
    return false
  }
}

// ============================================
// TRACKING CONTINUO - MEJORADO CON AUTO-DESCONEXIÓN
// ============================================

export const startDriverTracking = (driverId, onLocationUpdate, onError) => {
  console.log('🚀 Iniciando tracking para driver:', driverId)
  
  let watchId = null
  let lastPosition = null
  let updateInterval = null
  let isStopped = false
  let retryCount = 0
  const MAX_RETRIES = 5
  
  const locationRef = ref(rtdb, `${DRIVERS_LOCATIONS}/${driverId}`)
  
  const isAuthenticated = () => !!auth.currentUser

  // ✅ CONFIGURAR AUTO-DESCONEXIÓN AL INICIAR
  const disconnectHandler = onDisconnect(locationRef)
  disconnectHandler.update({
    online: false,
    lastSeen: Date.now(),
    disconnectedAt: new Date().toISOString()
  }).then(() => {
    console.log('✅ Auto-desconexión configurada')
  }).catch((error) => {
    console.error('❌ Error configurando auto-desconexión:', error.message)
  })

  const updateLocation = async (position) => {
    if (isStopped || !isAuthenticated()) {
      console.log('⏭️ Skip update - stopped or not authenticated')
      return
    }

    retryCount = 0 // Resetear contador al tener éxito
    
    const { latitude, longitude, heading, speed, accuracy } = position.coords || position
    const timestamp = Date.now()

    // Solo actualizar si cambió significativamente
    if (lastPosition) {
      const distance = calculateDistance(
        lastPosition.latitude, lastPosition.longitude,
        latitude, longitude
      )
      if (distance < 0.010 && accuracy > 100) {
        console.log('⏭️ Skip update - misma posición')
        return
      }
    }

    lastPosition = { latitude, longitude }
    console.log('📍 Actualizando ubicación:', { latitude, longitude, accuracy })

    const locationData = {
      latitude,
      longitude,
      heading: heading || 0,
      speed: speed || 0,
      accuracy: accuracy || 0,
      timestamp,
      lastUpdate: new Date().toISOString(),
      online: true  // ✅ SIEMPRE MARCAR ONLINE AL ACTUALIZAR
    }

    try {
      await set(locationRef, locationData)
      console.log('✅ Ubicación guardada en Firebase')
      if (onLocationUpdate && !isStopped) {
        onLocationUpdate(locationData)
      }
    } catch (error) {
      console.error('❌ Error guardando ubicación:', error.message)
    }
  }

  const handleError = (error) => {
    if (isStopped) return
    
    retryCount++
    console.log(`⚠️ Error GPS, reintento ${retryCount} de ${MAX_RETRIES}:`, error?.message || error)
    
    if (retryCount < MAX_RETRIES) {
      // Intentar con opciones aún más permisivas
      setTimeout(() => {
        if (!isStopped) {
          console.log('🔄 Reintentando con baja precisión...')
          navigator.geolocation.getCurrentPosition(
            updateLocation,
            (err) => {
              console.log('❌ Reintento fallido:', err.message)
              if (retryCount >= MAX_RETRIES - 1 && onError) {
                onError(new Error('No se pudo obtener ubicación después de varios intentos'))
              }
            },
            {
              enableHighAccuracy: false,
              timeout: 30000,
              maximumAge: 600000  // 10 minutos
            }
          )
        }
      }, 2000)
    } else if (onError) {
      if (error?.code === 1 || error?.message === 'PERMISSION_DENIED') {
        onError(new Error('Permiso de ubicación denegado. Habilita el GPS en tu navegador.'))
      } else if (error?.code === 2 || error?.message === 'POSITION_UNAVAILABLE') {
        onError(new Error('Ubicación no disponible. Verifica que el GPS del dispositivo esté activado.'))
      } else if (error?.code === 3 || error?.message === 'TIMEOUT') {
        onError(new Error('El GPS está tardando demasiado. Intenta salir al exterior.'))
      } else {
        onError(new Error('Error de GPS desconocido'))
      }
    }
  }

  // INICIAR: Intentar obtener ubicación inmediatamente
  const startWatching = () => {
    if (isStopped) return

    console.log('🎯 Iniciando obtención de ubicación...')
    
    // Primero obtener ubicación única con opciones permisivas
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        console.log('✅ Primera ubicación obtenida')
        updateLocation(pos)
        
        // Luego iniciar watch continuo
        console.log('👁️ Iniciando watchPosition continuo...')
        watchId = navigator.geolocation.watchPosition(
          updateLocation,
          handleError,
          {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 0
          }
        )
      },
      handleError,
      {
        enableHighAccuracy: false,  // Baja precisión primero para obtener algo
        timeout: 15000,
        maximumAge: 300000  // Aceptar caché de hasta 5 minutos
      }
    )
  }

  startWatching()

  // Intervalo de respaldo cada 20 segundos
  updateInterval = setInterval(() => {
    if (isStopped || !isAuthenticated()) {
      clearInterval(updateInterval)
      return
    }
    
    console.log('⏰ Respaldo: obteniendo ubicación...')
    navigator.geolocation.getCurrentPosition(
      updateLocation,
      () => {},
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    )
  }, 20000)

  return {
    stop: async () => {
      console.log('🛑 Deteniendo tracking...')
      isStopped = true
      
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
        watchId = null
      }
      if (updateInterval) {
        clearInterval(updateInterval)
        updateInterval = null
      }
      
      // ✅ CANCELAR AUTO-DESCONEXIÓN Y MARCAR OFFLINE MANUALMENTE
      try {
        await disconnectHandler.cancel()
        console.log('✅ Auto-desconexión cancelada')
      } catch (e) {
        console.log('⚠️ Error cancelando auto-desconexión:', e.message)
      }
      
      if (isAuthenticated()) {
        try {
          await update(locationRef, { online: false, lastSeen: Date.now() })
          console.log('✅ Ubicación marcada offline')
        } catch (e) {
          console.log('⚠️ Error marcando offline:', e.message)
        }
      }
    },
    pause: () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
        watchId = null
      }
    },
    resume: startWatching
  }
}

export const stopDriverTracking = async (driverId) => {
  if (!auth.currentUser) return
  const locationRef = ref(rtdb, `${DRIVERS_LOCATIONS}/${driverId}`)
  try {
    await remove(locationRef)
  } catch (e) {}
}

// ============================================
// SUSCRIPCIONES
// ============================================

export const subscribeToDriverLocation = (driverId, onLocationChange) => {
  const locationRef = ref(rtdb, `${DRIVERS_LOCATIONS}/${driverId}`)
  
  const unsubscribe = onValue(locationRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val()
      onLocationChange({
        driverId,
        ...data,
        isValid: Date.now() - data.timestamp < 60000
      })
    } else {
      onLocationChange(null)
    }
  }, () => onLocationChange(null))

  return () => off(locationRef, 'value', unsubscribe)
}

export const subscribeToAllDriversLocations = (onLocationsChange) => {
  const locationsRef = ref(rtdb, DRIVERS_LOCATIONS)
  
  const unsubscribe = onValue(locationsRef, (snapshot) => {
    const locations = []
    if (snapshot.exists()) {
      snapshot.forEach((child) => {
        const data = child.val()
        if (Date.now() - data.timestamp < 120000) {
          locations.push({ driverId: child.key, ...data })
        }
      })
    }
    onLocationsChange(locations)
  }, () => onLocationsChange([]))

  return () => off(locationsRef, 'value', unsubscribe)
}

// ============================================
// TRACKING DE SERVICIO
// ============================================

export const startServiceTracking = async (serviceId, driverId, initialData) => {
  if (!auth.currentUser) return
  const trackingRef = ref(rtdb, `${SERVICE_TRACKING}/${serviceId}`)
  try {
    await set(trackingRef, {
      driverId, serviceId,
      restaurantId: initialData.restaurantId,
      status: 'in_progress',
      startedAt: Date.now()
    })
  } catch (e) {}
}

export const updateServiceRoute = async (serviceId, location) => {
  if (!auth.currentUser) return
  try {
    const routeRef = ref(rtdb, `${SERVICE_TRACKING}/${serviceId}/route`)
    const newPointRef = push(routeRef)
    await set(newPointRef, {
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp: Date.now()
    })
  } catch (e) {}
}

export const subscribeToServiceTracking = (serviceId, onTrackingUpdate) => {
  const trackingRef = ref(rtdb, `${SERVICE_TRACKING}/${serviceId}`)
  const unsubscribe = onValue(trackingRef, 
    (snapshot) => onTrackingUpdate(snapshot.exists() ? snapshot.val() : null),
    () => onTrackingUpdate(null)
  )
  return () => off(trackingRef, 'value', unsubscribe)
}

export const endServiceTracking = async (serviceId) => {
  if (!auth.currentUser) return
  try {
    await remove(ref(rtdb, `${SERVICE_TRACKING}/${serviceId}`))
  } catch (e) {}
}

// ============================================
// UTILIDADES
// ============================================

export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

export const calculateETA = (current, destination) => {
  const distance = calculateDistance(current.latitude, current.longitude, destination.latitude, destination.longitude)
  const timeMinutes = (distance / 25) * 60
  return {
    distance: distance.toFixed(2),
    time: Math.ceil(timeMinutes),
    arrivalTime: new Date(Date.now() + timeMinutes * 60000)
  }
}

export const geocodeAddress = async (address) => {
  try {
    const response = await fetch(`/.netlify/functions/geocode?address=${encodeURIComponent(address)}`)
    const data = await response.json()
    if (data.success && data.location) {
      return { latitude: data.location.lat, longitude: data.location.lng }
    }
    return null
  } catch (e) {
    return null
  }
}

export const reverseGeocode = async (lat, lng) => {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
    const data = await response.json()
    return data?.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`
  } catch (e) {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
  }
}

export const openInGoogleMaps = (lat, lng, label = '') => {
  const url = label
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${encodeURIComponent(label)}`
    : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
  window.open(url, '_blank')
}

export const navigateTo = (destLat, destLng) => {
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`, '_blank')
}

export default {
  checkGeolocationPermission,
  getCurrentPosition,
  setupAutoDisconnect,
  cancelAutoDisconnect,
  setDriverOffline,
  setDriverOnlineRTDB,
  startDriverTracking,
  stopDriverTracking,
  subscribeToDriverLocation,
  subscribeToAllDriversLocations,
  startServiceTracking,
  updateServiceRoute,
  subscribeToServiceTracking,
  endServiceTracking,
  calculateDistance,
  calculateETA,
  geocodeAddress,
  reverseGeocode,
  openInGoogleMaps,
  navigateTo
}