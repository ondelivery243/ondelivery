// src/services/locationService.js
// Servicio de rastreo GPS en tiempo real para repartidores
import { getDatabase, ref, set, onValue, off, remove, update, push, serverTimestamp } from 'firebase/database'
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore'
import { app } from '../config/firebase'

// Instancias de bases de datos
const db = getFirestore(app)
const rtdb = getDatabase(app)

// Colecciones en Realtime Database
const DRIVERS_LOCATIONS = 'drivers_locations'
const SERVICE_TRACKING = 'service_tracking'

// ============================================
// TRACKING DE UBICACIÓN DEL REPARTIDOR
// ============================================

/**
 * Iniciar el seguimiento de ubicación del repartidor
 * @param {string} driverId - ID del repartidor
 * @param {Function} onLocationUpdate - Callback cuando se actualiza la ubicación
 * @param {Function} onError - Callback para errores
 * @returns {Object} - Objeto con funciones de control
 */
export const startDriverTracking = (driverId, onLocationUpdate, onError) => {
  let watchId = null
  let lastPosition = null
  let updateInterval = null
  
  // Referencia en Realtime Database
  const locationRef = ref(rtdb, `${DRIVERS_LOCATIONS}/${driverId}`)
  
  // Configuración de geolocalización
  const geoOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 5000
  }

  // Función para actualizar ubicación en Firebase
  const updateLocation = async (position) => {
    const { latitude, longitude, heading, speed, accuracy } = position.coords
    const timestamp = Date.now()
    
    // Solo actualizar si la posición cambió significativamente (más de 5 metros)
    if (lastPosition) {
      const distance = calculateDistance(
        lastPosition.latitude,
        lastPosition.longitude,
        latitude,
        longitude
      )
      if (distance < 0.005 && accuracy > 50) { // Menos de 5m y baja precisión
        return
      }
    }

    lastPosition = { latitude, longitude }

    const locationData = {
      latitude,
      longitude,
      heading: heading || 0,
      speed: speed || 0,
      accuracy,
      timestamp,
      lastUpdate: new Date().toISOString()
    }

    try {
      await set(locationRef, locationData)
      if (onLocationUpdate) {
        onLocationUpdate(locationData)
      }
    } catch (error) {
      console.error('Error actualizando ubicación:', error)
      if (onError) onError(error)
    }
  }

  // Manejar errores de geolocalización
  const handleGeoError = (error) => {
    console.error('Error de geolocalización:', error)
    let errorMessage = 'Error desconocido'
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Permiso de ubicación denegado'
        break
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Ubicación no disponible'
        break
      case error.TIMEOUT:
        errorMessage = 'Tiempo de espera agotado'
        break
    }
    
    if (onError) onError(new Error(errorMessage))
  }

  // Iniciar watch de posición
  if ('geolocation' in navigator) {
    watchId = navigator.geolocation.watchPosition(
      updateLocation,
      handleGeoError,
      geoOptions
    )

    // Backup: actualizar cada 10 segundos si no hay cambios
    updateInterval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        updateLocation,
        handleGeoError,
        geoOptions
      )
    }, 10000)
  } else {
    if (onError) onError(new Error('Geolocalización no soportada'))
  }

  // Retornar funciones de control
  return {
    stop: async () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
      }
      if (updateInterval) {
        clearInterval(updateInterval)
      }
      // Marcar como offline en la base de datos
      try {
        await update(locationRef, {
          online: false,
          lastSeen: Date.now()
        })
      } catch (e) {
        console.error('Error marcando offline:', e)
      }
    },
    pause: async () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
        watchId = null
      }
      if (updateInterval) {
        clearInterval(updateInterval)
        updateInterval = null
      }
    },
    resume: () => {
      if (watchId === null) {
        watchId = navigator.geolocation.watchPosition(
          updateLocation,
          handleGeoError,
          geoOptions
        )
      }
      if (!updateInterval) {
        updateInterval = setInterval(() => {
          navigator.geolocation.getCurrentPosition(
            updateLocation,
            handleGeoError,
            geoOptions
          )
        }, 10000)
      }
    }
  }
}

/**
 * Detener el seguimiento y limpiar la ubicación
 * @param {string} driverId - ID del repartidor
 */
export const stopDriverTracking = async (driverId) => {
  const locationRef = ref(rtdb, `${DRIVERS_LOCATIONS}/${driverId}`)
  try {
    await remove(locationRef)
    console.log('Tracking detenido para:', driverId)
  } catch (error) {
    console.error('Error deteniendo tracking:', error)
  }
}

// ============================================
// ESCUCHAR UBICACIÓN DE REPARTIDOR (Para restaurantes/admin)
// ============================================

/**
 * Suscribirse a los cambios de ubicación de un repartidor
 * @param {string} driverId - ID del repartidor
 * @param {Function} onLocationChange - Callback con la nueva ubicación
 * @returns {Function} - Función para cancelar la suscripción
 */
export const subscribeToDriverLocation = (driverId, onLocationChange) => {
  const locationRef = ref(rtdb, `${DRIVERS_LOCATIONS}/${driverId}`)
  
  const unsubscribe = onValue(locationRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val()
      onLocationChange({
        driverId,
        ...data,
        isValid: Date.now() - data.timestamp < 60000 // Menos de 1 minuto
      })
    } else {
      onLocationChange(null)
    }
  }, (error) => {
    console.error('Error escuchando ubicación:', error)
    onLocationChange(null)
  })

  return () => off(locationRef, 'value', unsubscribe)
}

/**
 * Suscribirse a las ubicaciones de todos los repartidores online
 * @param {Function} onLocationsChange - Callback con todas las ubicaciones
 * @returns {Function} - Función para cancelar la suscripción
 */
export const subscribeToAllDriversLocations = (onLocationsChange) => {
  const locationsRef = ref(rtdb, DRIVERS_LOCATIONS)
  
  const unsubscribe = onValue(locationsRef, (snapshot) => {
    const locations = []
    if (snapshot.exists()) {
      snapshot.forEach((child) => {
        const data = child.val()
        // Solo incluir ubicaciones actualizadas en los últimos 2 minutos
        if (Date.now() - data.timestamp < 120000) {
          locations.push({
            driverId: child.key,
            ...data
          })
        }
      })
    }
    onLocationsChange(locations)
  }, (error) => {
    console.error('Error escuchando ubicaciones:', error)
    onLocationsChange([])
  })

  return () => off(locationsRef, 'value', unsubscribe)
}

// ============================================
// TRACKING DE SERVICIO ESPECÍFICO
// ============================================

/**
 * Iniciar tracking para un servicio específico
 * @param {string} serviceId - ID del servicio
 * @param {string} driverId - ID del repartidor
 * @param {Object} initialData - Datos iniciales del servicio
 */
export const startServiceTracking = async (serviceId, driverId, initialData) => {
  const trackingRef = ref(rtdb, `${SERVICE_TRACKING}/${serviceId}`)
  
  await set(trackingRef, {
    driverId,
    serviceId,
    restaurantId: initialData.restaurantId,
    restaurantLocation: initialData.restaurantLocation || null,
    deliveryLocation: initialData.deliveryLocation || null,
    status: 'in_progress',
    startedAt: Date.now(),
    route: [],
    estimatedArrival: null
  })
}

/**
 * Actualizar la ruta del servicio
 * @param {string} serviceId - ID del servicio
 * @param {Object} location - Ubicación actual {lat, lng}
 */
export const updateServiceRoute = async (serviceId, location) => {
  const routeRef = ref(rtdb, `${SERVICE_TRACKING}/${serviceId}/route`)
  const newPointRef = push(routeRef)
  
  await set(newPointRef, {
    latitude: location.latitude,
    longitude: location.longitude,
    timestamp: Date.now()
  })

  // Mantener solo los últimos 100 puntos para no sobrecargar
  // Esto se puede hacer con una Cloud Function o límite en el cliente
}

/**
 * Suscribirse al tracking de un servicio
 * @param {string} serviceId - ID del servicio
 * @param {Function} onTrackingUpdate - Callback con actualizaciones
 * @returns {Function} - Función para cancelar
 */
export const subscribeToServiceTracking = (serviceId, onTrackingUpdate) => {
  const trackingRef = ref(rtdb, `${SERVICE_TRACKING}/${serviceId}`)
  
  const unsubscribe = onValue(trackingRef, (snapshot) => {
    if (snapshot.exists()) {
      onTrackingUpdate(snapshot.val())
    } else {
      onTrackingUpdate(null)
    }
  })

  return () => off(trackingRef, 'value', unsubscribe)
}

/**
 * Finalizar tracking de servicio
 * @param {string} serviceId - ID del servicio
 */
export const endServiceTracking = async (serviceId) => {
  const trackingRef = ref(rtdb, `${SERVICE_TRACKING}/${serviceId}`)
  
  // Guardar en Firestore antes de eliminar (historial)
  // Opcional: mover a una colección de historial
  
  await remove(trackingRef)
}

// ============================================
// UTILIDADES DE GEOLOCALIZACIÓN
// ============================================

/**
 * Calcular distancia entre dos puntos (Haversine)
 * @param {number} lat1 - Latitud punto 1
 * @param {number} lon1 - Longitud punto 1
 * @param {number} lat2 - Latitud punto 2
 * @param {number} lon2 - Longitud punto 2
 * @returns {number} - Distancia en kilómetros
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371 // Radio de la Tierra en km
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

const toRad = (deg) => deg * (Math.PI / 180)

/**
 * Calcular tiempo estimado de llegada
 * @param {Object} currentLocation - {latitude, longitude, speed}
 * @param {Object} destination - {latitude, longitude}
 * @returns {Object} - {distance: km, time: minutos}
 */
export const calculateETA = (currentLocation, destination) => {
  const distance = calculateDistance(
    currentLocation.latitude,
    currentLocation.longitude,
    destination.latitude,
    destination.longitude
  )
  
  // Velocidad promedio en ciudad: 25 km/h
  const avgSpeedKmh = 25
  const timeMinutes = (distance / avgSpeedKmh) * 60
  
  return {
    distance: distance.toFixed(2),
    time: Math.ceil(timeMinutes),
    arrivalTime: new Date(Date.now() + timeMinutes * 60000)
  }
}

/**
 * Geocodificar dirección a coordenadas
 * @param {string} address - Dirección a geocodificar
 * @returns {Promise<Object>} - {latitude, longitude}
 */
export const geocodeAddress = async (address) => {
  try {
    const response = await fetch(
      `/.netlify/functions/geocode?address=${encodeURIComponent(address)}`
    )
    const data = await response.json()
    
    if (data.success && data.location) {
      return {
        latitude: data.location.lat,
        longitude: data.location.lng
      }
    }
    return null
  } catch (error) {
    console.error('Error geocodificando:', error)
    return null
  }
}

/**
 * Obtener dirección desde coordenadas (reverse geocoding)
 * @param {number} latitude 
 * @param {number} longitude 
 * @returns {Promise<string>} - Dirección formateada
 */
export const reverseGeocode = async (latitude, longitude) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
    )
    const data = await response.json()
    
    if (data && data.display_name) {
      return data.display_name
    }
    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
  } catch (error) {
    console.error('Error en reverse geocoding:', error)
    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
  }
}

/**
 * Abrir en Google Maps
 * @param {number} latitude 
 * @param {number} longitude 
 * @param {string} label - Etiqueta opcional
 */
export const openInGoogleMaps = (latitude, longitude, label = '') => {
  const url = label
    ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}&query_place_id=${encodeURIComponent(label)}`
    : `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
  window.open(url, '_blank')
}

/**
 * Abrir navegación en Google Maps
 * @param {number} destLat 
 * @param {number} destLng 
 */
export const navigateTo = (destLat, destLng) => {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`
  window.open(url, '_blank')
}

// ============================================
// EXPORTAR TODO
// ============================================
export default {
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
