// src/services/broadcastService.js
// Servicio de broadcast para notificar repartidores sobre nuevos servicios
import { rtdb, db } from '../config/firebase'
import {
  ref,
  set,
  onValue,
  off,
  update,
  get,
  remove,
  onDisconnect
} from 'firebase/database'
import {
  collection,
  doc,
  updateDoc,
  getDoc,
  serverTimestamp
} from 'firebase/firestore'

// ============================================
// CONSTANTES DE CONFIGURACIÓN
// ============================================
export const BROADCAST_CONFIG = {
  INITIAL_RADIUS: 3000,      // 3km primer intento
  SECOND_RADIUS: 5000,       // 5km segundo intento
  MAX_RADIUS: 8000,          // 8km tercer intento (máximo)
  WINDOW_DURATION: 45000,    // 45 segundos para aceptar
  RETRY_DELAY: 20000,        // 20 segundos entre intentos
  MAX_ATTEMPTS: 3            // Máximo 3 intentos
}

const BROADCAST_PATH = 'service_broadcasts'
const DRIVERS_LOCATION_PATH = 'drivers_locations'

// ============================================
// EXPIRATION CHECKER - NUEVO!
// ============================================
let expirationCheckerInterval = null

/**
 * Inicia el verificador de expiración de broadcasts
 * Se ejecuta cada 5 segundos para verificar broadcasts expirados
 */
export const startExpirationChecker = () => {
  if (expirationCheckerInterval) {
    console.log('⚠️ Expiration checker ya está corriendo')
    return
  }

  console.log('🕐 Iniciando verificador de expiración de broadcasts')

  expirationCheckerInterval = setInterval(async () => {
    try {
      const broadcastsRef = ref(rtdb, BROADCAST_PATH)
      const snapshot = await get(broadcastsRef)

      if (!snapshot.exists()) return

      const now = Date.now()

      snapshot.forEach((child) => {
        const data = child.val()

        // Solo verificar broadcasts activos
        if (data.status !== 'broadcasting') return

        // Verificar si expiró
        if (now > data.attemptExpiresAt) {
          console.log(`⏰ Broadcast expirado detectado: ${child.key}`)
          checkBroadcastExpiration(child.key)
        }
      })
    } catch (error) {
      console.error('❌ Error en expiration checker:', error)
    }
  }, 5000) // Cada 5 segundos
}

/**
 * Detiene el verificador de expiración
 */
export const stopExpirationChecker = () => {
  if (expirationCheckerInterval) {
    clearInterval(expirationCheckerInterval)
    expirationCheckerInterval = null
    console.log('🛑 Expiration checker detenido')
  }
}

// ============================================
// FUNCIONES DE UTILIDAD
// ============================================

/**
 * Calcula la distancia entre dos puntos (Haversine)
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999
  
  const R = 6371 // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c // Distancia en km
}

/**
 * Obtiene el radio según el intento
 */
const getRadiusForAttempt = (attempt) => {
  switch (attempt) {
    case 1: return BROADCAST_CONFIG.INITIAL_RADIUS
    case 2: return BROADCAST_CONFIG.SECOND_RADIUS
    case 3: return BROADCAST_CONFIG.MAX_RADIUS
    default: return BROADCAST_CONFIG.MAX_RADIUS
  }
}

// ============================================
// OBTENER REPARTIDORES CERCANOS
// ============================================

/**
 * Obtiene todos los repartidores online y los ordena por cercanía
 */
export const getNearbyOnlineDrivers = async (restaurantLocation, radiusMeters) => {
  try {
    console.log('🔍 Buscando repartidores cercanos...', { restaurantLocation, radiusMeters })

    if (!restaurantLocation?.latitude || !restaurantLocation?.longitude) {
      console.log('⚠️ No hay ubicación válida del restaurante')
      return []
    }

    // Obtener ubicaciones de repartidores en Realtime Database
    const locationsRef = ref(rtdb, DRIVERS_LOCATION_PATH)
    const snapshot = await get(locationsRef)

    if (!snapshot.exists()) {
      console.log('⚠️ No hay ubicaciones de repartidores en RTDB')
      return []
    }

    const drivers = []
    const now = Date.now()
    const maxAge = 300000 // 5 minutos máximo sin actualizar

    snapshot.forEach((child) => {
      const data = child.val()

      // Verificar que la ubicación es reciente
      if (!data.timestamp || now - data.timestamp > maxAge) {
        return
      }

      // Verificar que tiene coordenadas válidas
      if (!data.latitude || !data.longitude) {
        return
      }

      // Calcular distancia al restaurante
      const distance = calculateDistance(
        restaurantLocation.latitude,
        restaurantLocation.longitude,
        data.latitude,
        data.longitude
      )

      // Convertir a metros
      const distanceMeters = distance * 1000

      // Filtrar por radio
      if (distanceMeters <= radiusMeters) {
        drivers.push({
          id: child.key,
          latitude: data.latitude,
          longitude: data.longitude,
          distance: distance,
          distanceMeters: distanceMeters,
          lastUpdate: data.timestamp
        })
      }
    })

    // Ordenar por cercanía (más cerca primero)
    drivers.sort((a, b) => a.distance - b.distance)

    console.log(`✅ Encontrados ${drivers.length} repartidores en radio de ${radiusMeters}m`)
    return drivers
  } catch (error) {
    console.error('❌ Error obteniendo repartidores cercanos:', error)
    return []
  }
}

/**
 * Obtiene datos completos de los repartidores (nombre, etc)
 */
const getDriverDetails = async (driverIds) => {
  try {
    const drivers = []

    for (const driverId of driverIds) {
      try {
        const docRef = doc(db, 'drivers', driverId)
        const docSnap = await getDoc(docRef)

        if (docSnap.exists()) {
          const data = docSnap.data()
          // Solo incluir repartidores activos y online
          if (data.active !== false && data.isOnline) {
            drivers.push({
              id: driverId,
              name: data.name || 'Repartidor',
              phone: data.phone || '',
              rating: data.rating || 5.0,
              totalServices: data.totalServices || 0
            })
          }
        }
      } catch (e) {
        console.log(`⚠️ No se pudo obtener info del driver ${driverId}`)
      }
    }

    return drivers
  } catch (error) {
    console.error('❌ Error obteniendo detalles de repartidores:', error)
    return []
  }
}

// ============================================
// CREAR BROADCAST DE SERVICIO
// ============================================

/**
 * Inicia un nuevo broadcast de servicio
 */
export const createServiceBroadcast = async (serviceId, serviceData) => {
  try {
    console.log('📢 Creando broadcast para servicio:', serviceId)
    console.log('📦 Datos del servicio:', serviceData)

    // Obtener ubicación del restaurante
    let restaurantLocation = serviceData.restaurantLocation

    // Si no hay ubicación, intentar obtenerla del restaurante en Firestore
    if (!restaurantLocation?.latitude || !restaurantLocation?.longitude) {
      if (serviceData.restaurantId) {
        try {
          const restaurantDoc = await getDoc(doc(db, 'restaurants', serviceData.restaurantId))
          if (restaurantDoc.exists()) {
            const rData = restaurantDoc.data()
            if (rData.latitude && rData.longitude) {
              restaurantLocation = {
                latitude: rData.latitude,
                longitude: rData.longitude
              }
              console.log('📍 Ubicación obtenida del restaurante:', restaurantLocation)
            }
          }
        } catch (e) {
          console.log('⚠️ No se pudo obtener ubicación del restaurante:', e.message)
        }
      }
    }

    // Si aún no hay ubicación, usar Maracay centro
    if (!restaurantLocation?.latitude || !restaurantLocation?.longitude) {
      restaurantLocation = {
        latitude: 10.2647,
        longitude: -67.6084
      }
      console.log('⚠️ Usando ubicación por defecto (Maracay centro)')
    }

    // Crear documento de broadcast en Realtime Database
    const broadcastRef = ref(rtdb, `${BROADCAST_PATH}/${serviceId}`)

    const broadcastData = {
      serviceId,
      restaurantId: serviceData.restaurantId || '',
      restaurantName: serviceData.restaurantName || 'Restaurante',
      restaurantLocation,
      zoneId: serviceData.zoneId || '',
      zoneName: serviceData.zoneName || '',
      deliveryFee: serviceData.deliveryFee || 0,
      driverEarnings: serviceData.driverEarnings || 0,

      // Estado del broadcast
      status: 'broadcasting',
      currentAttempt: 1,
      maxAttempts: BROADCAST_CONFIG.MAX_ATTEMPTS,
      currentRadius: BROADCAST_CONFIG.INITIAL_RADIUS,

      // Timestamps
      createdAt: Date.now(),
      attemptStartedAt: Date.now(),
      attemptExpiresAt: Date.now() + BROADCAST_CONFIG.WINDOW_DURATION,

      // Configuración
      windowDuration: BROADCAST_CONFIG.WINDOW_DURATION,
      retryDelay: BROADCAST_CONFIG.RETRY_DELAY,

      // Drivers notificados
      notifiedDrivers: {},

      // Quién aceptó (si aplica)
      acceptedBy: null,
      acceptedAt: null
    }

    await set(broadcastRef, broadcastData)
    console.log('✅ Broadcast creado en RTDB')

    // Actualizar el servicio en Firestore
    try {
      await updateDoc(doc(db, 'services', serviceId), {
        broadcastStatus: 'active',
        broadcastAttempts: 1,
        broadcastRadius: BROADCAST_CONFIG.INITIAL_RADIUS,
        broadcastStartedAt: serverTimestamp()
      })
      console.log('✅ Servicio actualizado en Firestore')
    } catch (e) {
      console.log('⚠️ No se pudo actualizar servicio en Firestore:', e.message)
    }

    // Iniciar el primer ciclo de notificación
    await runBroadcastCycle(serviceId, 1)

    // Iniciar el verificador de expiración si no está corriendo
    startExpirationChecker()

    return { success: true, broadcastData }
  } catch (error) {
    console.error('❌ Error creando broadcast:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Ejecuta un ciclo de broadcast (notificar repartidores)
 */
export const runBroadcastCycle = async (serviceId, attempt) => {
  try {
    console.log(`🔄 Ejecutando broadcast ciclo ${attempt} para servicio:`, serviceId)

    // Obtener datos del broadcast
    const broadcastRef = ref(rtdb, `${BROADCAST_PATH}/${serviceId}`)
    const snapshot = await get(broadcastRef)

    if (!snapshot.exists()) {
      console.log('⚠️ No existe el broadcast')
      return { success: false, error: 'Broadcast not found' }
    }

    const broadcastData = snapshot.val()

    // Verificar que no haya sido aceptado ya
    if (broadcastData.status === 'accepted') {
      console.log('✅ Servicio ya fue aceptado')
      return { success: true, alreadyAccepted: true }
    }

    // Obtener radio para este intento
    const radius = getRadiusForAttempt(attempt)
    console.log(`📍 Usando radio de ${radius}m para intento ${attempt}`)

    // Obtener repartidores cercanos
    const nearbyDrivers = await getNearbyOnlineDrivers(
      broadcastData.restaurantLocation,
      radius
    )

    if (nearbyDrivers.length === 0) {
      console.log('⚠️ No hay repartidores en el área')

      await update(broadcastRef, {
        currentAttempt: attempt,
        currentRadius: radius,
        attemptStartedAt: Date.now(),
        attemptExpiresAt: Date.now() + BROADCAST_CONFIG.WINDOW_DURATION,
        [`attempt${attempt}`]: {
          radius,
          driversCount: 0,
          startedAt: Date.now(),
          status: 'no_drivers'
        }
      })

      return { success: true, driversCount: 0 }
    }

    // Obtener detalles de los repartidores
    const driverIds = nearbyDrivers.map(d => d.id)
    const driverDetails = await getDriverDetails(driverIds)

    console.log(`📢 ${driverDetails.length} repartidores activos encontrados`)

    // Crear objeto de drivers notificados con su distancia
    const notifiedDrivers = {}
    nearbyDrivers.forEach(driver => {
      notifiedDrivers[driver.id] = {
        distance: driver.distance,
        distanceMeters: driver.distanceMeters,
        notifiedAt: Date.now()
      }
    })

    // Actualizar broadcast
    await update(broadcastRef, {
      currentAttempt: attempt,
      currentRadius: radius,
      attemptStartedAt: Date.now(),
      attemptExpiresAt: Date.now() + BROADCAST_CONFIG.WINDOW_DURATION,
      notifiedDrivers,
      [`attempt${attempt}`]: {
        radius,
        driversCount: driverDetails.length,
        startedAt: Date.now(),
        expiresAt: Date.now() + BROADCAST_CONFIG.WINDOW_DURATION,
        status: 'notifying'
      }
    })

    console.log(`✅ ${driverDetails.length} repartidores notificados`)

    return {
      success: true,
      driversCount: driverDetails.length,
      drivers: driverDetails,
      expiresAt: Date.now() + BROADCAST_CONFIG.WINDOW_DURATION
    }
  } catch (error) {
    console.error('❌ Error en ciclo de broadcast:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Repartidor acepta el servicio
 */
export const acceptServiceBroadcast = async (serviceId, driverId, driverName) => {
  try {
    console.log(`✅ Repartidor ${driverName} aceptando servicio ${serviceId}`)

    const broadcastRef = ref(rtdb, `${BROADCAST_PATH}/${serviceId}`)
    const snapshot = await get(broadcastRef)

    if (!snapshot.exists()) {
      console.log('⚠️ Broadcast no encontrado')
      return { success: false, error: 'Servicio no disponible' }
    }

    const broadcastData = snapshot.val()

    if (broadcastData.status !== 'broadcasting') {
      console.log('⚠️ Servicio ya no está disponible:', broadcastData.status)
      return { success: false, error: 'Servicio ya no disponible', reason: broadcastData.status }
    }

    if (Date.now() > broadcastData.attemptExpiresAt) {
      console.log('⚠️ Tiempo expirado')
      return { success: false, error: 'Tiempo expirado' }
    }

    // Marcar como aceptado en RTDB
    await update(broadcastRef, {
      status: 'accepted',
      acceptedBy: driverId,
      acceptedByName: driverName,
      acceptedAt: Date.now()
    })

    // Actualizar servicio en Firestore
    await updateDoc(doc(db, 'services', serviceId), {
      driverId,
      driverName,
      status: 'asignado',
      acceptedAt: serverTimestamp(),
      broadcastStatus: 'accepted',
      updatedAt: serverTimestamp()
    })

    console.log('✅ Servicio asignado exitosamente a:', driverName)

    // 🆕 Crear el chat automáticamente
    try {
      const { createChatRoom } = await import('./chatService.js')
      await createChatRoom(serviceId, broadcastData, null, { id: driverId, name: driverName })
      console.log('✅ Chat creado automáticamente')
    } catch (chatError) {
      console.log('⚠️ No se pudo crear el chat:', chatError.message)
    }

    return { success: true }
  } catch (error) {
    console.error('❌ Error aceptando servicio:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Repartidor rechaza el servicio
 * Registra el rechazo y verifica si debe hacer retry con otros drivers
 */
export const rejectServiceBroadcast = async (serviceId, driverId) => {
  try {
    console.log(`❌ Repartidor ${driverId} rechazando servicio ${serviceId}`)

    const broadcastRef = ref(rtdb, `${BROADCAST_PATH}/${serviceId}`)
    const snapshot = await get(broadcastRef)

    if (!snapshot.exists()) {
      return { success: false, error: 'Servicio no disponible' }
    }

    const broadcastData = snapshot.val()

    if (broadcastData.status !== 'broadcasting') {
      return { success: false, error: 'Servicio ya no disponible' }
    }

    // Registrar rechazo
    const rejectedDrivers = broadcastData.rejectedDrivers || {}
    rejectedDrivers[driverId] = {
      rejectedAt: Date.now()
    }

    // Remover de notifiedDrivers
    const notifiedDrivers = broadcastData.notifiedDrivers || {}
    delete notifiedDrivers[driverId]

    // Contar cuántos drivers quedan disponibles
    const remainingDrivers = Object.keys(notifiedDrivers).filter(
      id => !rejectedDrivers[id]
    )

    console.log(`📊 Drivers restantes disponibles: ${remainingDrivers.length}`)

    // Actualizar broadcast
    // NOTA: No usar puntos (.) en las claves de RTDB
    // rejectedDrivers ya contiene el registro del rechazo con timestamp
    await update(broadcastRef, {
      rejectedDrivers,
      notifiedDrivers
    })

    // Si no quedan drivers disponibles, intentar siguiente ciclo inmediatamente
    if (remainingDrivers.length === 0) {
      console.log('⚠️ No quedan drivers disponibles, iniciando siguiente intento...')
      
      if (broadcastData.currentAttempt < broadcastData.maxAttempts) {
        // Esperar un momento y hacer retry
        setTimeout(async () => {
          const nextAttempt = broadcastData.currentAttempt + 1
          console.log(`🔄 Iniciando intento ${nextAttempt} por rechazo masivo`)
          await runBroadcastCycle(serviceId, nextAttempt)
        }, 2000)
      } else {
        // Se agotaron los intentos
        await update(broadcastRef, {
          status: 'no_drivers',
          expiredAt: Date.now(),
          expireReason: 'all_drivers_rejected'
        })

        await updateDoc(doc(db, 'services', serviceId), {
          broadcastStatus: 'no_drivers',
          status: 'sin_repartidor',
          updatedAt: serverTimestamp()
        })
      }
    }

    return { success: true }
  } catch (error) {
    console.error('❌ Error rechazando servicio:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Verifica y maneja expiración del broadcast
 */
export const checkBroadcastExpiration = async (serviceId) => {
  try {
    const broadcastRef = ref(rtdb, `${BROADCAST_PATH}/${serviceId}`)
    const snapshot = await get(broadcastRef)

    if (!snapshot.exists()) return { expired: false }

    const data = snapshot.val()

    if (data.status !== 'broadcasting') {
      return { expired: false, status: data.status }
    }

    const now = Date.now()

    if (now > data.attemptExpiresAt) {
      console.log(`⏰ Intento ${data.currentAttempt} expirado para servicio ${serviceId}`)

      if (data.currentAttempt < data.maxAttempts) {
        console.log(`⏳ Esperando ${BROADCAST_CONFIG.RETRY_DELAY / 1000}s para reintentar...`)

        // Actualizar estado mientras espera
        await update(broadcastRef, {
          status: 'retrying',
          retryingAt: now
        })

        setTimeout(async () => {
          const nextAttempt = data.currentAttempt + 1
          console.log(`🔄 Iniciando intento ${nextAttempt}`)
          
          // Resetear estado a broadcasting antes del nuevo intento
          await update(broadcastRef, { status: 'broadcasting' })
          await runBroadcastCycle(serviceId, nextAttempt)
        }, BROADCAST_CONFIG.RETRY_DELAY)

        return { expired: true, retryScheduled: true, nextAttempt: data.currentAttempt + 1 }
      } else {
        console.log('❌ Se agotaron los intentos de broadcast')

        await update(broadcastRef, {
          status: 'expired',
          expiredAt: now,
          expireReason: 'no_drivers_available'
        })

        await updateDoc(doc(db, 'services', serviceId), {
          broadcastStatus: 'expired',
          status: 'sin_repartidor',
          updatedAt: serverTimestamp()
        })

        return { expired: true, maxAttemptsReached: true }
      }
    }

    return { expired: false }
  } catch (error) {
    console.error('❌ Error verificando expiración:', error)
    return { expired: false, error: error.message }
  }
}

// ============================================
// SUSCRIPCIONES EN TIEMPO REAL
// ============================================

/**
 * Suscribe a un repartidor para recibir notificaciones de servicios
 */
export const subscribeToAvailableServices = (driverId, driverLocation, callback) => {
  console.log('🔔 Suscribiendo a servicios disponibles para:', driverId)

  const broadcastsRef = ref(rtdb, BROADCAST_PATH)

  const unsubscribe = onValue(broadcastsRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([])
      return
    }

    const availableServices = []
    const now = Date.now()

    snapshot.forEach((child) => {
      const data = child.val()

      // Solo broadcasts activos
      if (data.status !== 'broadcasting') return

      // Verificar que no haya expirado
      if (now > data.attemptExpiresAt) return

      // Verificar que este driver esté en la lista de notificados
      if (!data.notifiedDrivers || !data.notifiedDrivers[driverId]) return

      // Verificar que no haya rechazado este servicio
      if (data.rejectedDrivers && data.rejectedDrivers[driverId]) return

      // Calcular tiempo restante
      const timeRemaining = Math.max(0, data.attemptExpiresAt - now)

      // Calcular distancia desde el driver
      let distance = 0
      if (driverLocation?.latitude && driverLocation?.longitude) {
        distance = calculateDistance(
          driverLocation.latitude,
          driverLocation.longitude,
          data.restaurantLocation?.latitude,
          data.restaurantLocation?.longitude
        )
      }

      availableServices.push({
        id: child.key,
        serviceId: data.serviceId,
        restaurantId: data.restaurantId,
        restaurantName: data.restaurantName,
        zoneName: data.zoneName,
        deliveryFee: data.deliveryFee,
        driverEarnings: data.driverEarnings,
        distance: distance,
        distanceMeters: distance * 1000,
        timeRemaining,
        currentAttempt: data.currentAttempt,
        currentRadius: data.currentRadius,
        createdAt: data.createdAt,
        attemptStartedAt: data.attemptStartedAt,
        attemptExpiresAt: data.attemptExpiresAt
      })
    })

    // Ordenar por cercanía
    availableServices.sort((a, b) => a.distance - b.distance)

    callback(availableServices)
  })

  return () => off(broadcastsRef)
}

/**
 * Suscribe al estado de un broadcast específico
 */
export const subscribeToBroadcast = (serviceId, callback) => {
  const broadcastRef = ref(rtdb, `${BROADCAST_PATH}/${serviceId}`)

  const unsubscribe = onValue(broadcastRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({ id: serviceId, ...snapshot.val() })
    } else {
      callback(null)
    }
  })

  return () => off(broadcastRef)
}

/**
 * Cancela un broadcast
 */
export const cancelServiceBroadcast = async (serviceId) => {
  try {
    const broadcastRef = ref(rtdb, `${BROADCAST_PATH}/${serviceId}`)

    await update(broadcastRef, {
      status: 'cancelled',
      cancelledAt: Date.now()
    })

    setTimeout(() => {
      remove(broadcastRef).catch(() => {})
    }, 60000)

    return { success: true }
  } catch (error) {
    console.error('❌ Error cancelando broadcast:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Limpia broadcasts antiguos
 */
export const cleanupOldBroadcasts = async () => {
  try {
    const broadcastsRef = ref(rtdb, BROADCAST_PATH)
    const snapshot = await get(broadcastsRef)

    if (!snapshot.exists()) return

    const now = Date.now()
    const maxAge = 3600000 // 1 hora

    snapshot.forEach((child) => {
      const data = child.val()

      if (data.status !== 'broadcasting' && now - data.createdAt > maxAge) {
        remove(ref(rtdb, `${BROADCAST_PATH}/${child.key}`)).catch(() => {})
      }
    })
  } catch (error) {
    console.error('❌ Error limpiando broadcasts:', error)
  }
}

export default {
  createServiceBroadcast,
  runBroadcastCycle,
  acceptServiceBroadcast,
  rejectServiceBroadcast,
  checkBroadcastExpiration,
  subscribeToAvailableServices,
  subscribeToBroadcast,
  cancelServiceBroadcast,
  getNearbyOnlineDrivers,
  calculateDistance,
  cleanupOldBroadcasts,
  startExpirationChecker,
  stopExpirationChecker,
  BROADCAST_CONFIG
}