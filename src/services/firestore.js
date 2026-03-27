// src/services/firestore.js
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  limit,
  startAfter,
  serverTimestamp,
  onSnapshot,
  Timestamp,
  addDoc,
  increment,
  writeBatch
} from 'firebase/firestore'
import { db } from '../config/firebase'

// ============================================
// UTILIDAD: Manejo de errores de permisos
// ============================================
const handleSnapshotError = (error) => {
  if (error.code === 'permission-denied' || error.message?.includes('permission')) {
    return
  }
  console.error('Error en snapshot:', error)
}

// ============================================
// ZONAS
// ============================================
export const ZONES_COLLECTION = 'zones'

export const getZones = async () => {
  try {
    const snapshot = await getDocs(collection(db, ZONES_COLLECTION))
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  } catch (error) {
    // Silenciar errores de permisos (normal al hacer logout)
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      return []
    }
    console.error('Error obteniendo zonas:', error)
    return []
  }
}

export const subscribeToZones = (callback) => {
  return onSnapshot(
    collection(db, ZONES_COLLECTION), 
    (snapshot) => {
      const zones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      callback(zones)
    },
    handleSnapshotError
  )
}

export const addZone = async (zoneData) => {
  try {
    const docRef = await addDoc(collection(db, ZONES_COLLECTION), {
      ...zoneData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    return { success: true, id: docRef.id }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const updateZone = async (zoneId, zoneData) => {
  try {
    await updateDoc(doc(db, ZONES_COLLECTION, zoneId), {
      ...zoneData,
      updatedAt: serverTimestamp()
    })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const deleteZone = async (zoneId) => {
  try {
    await deleteDoc(doc(db, ZONES_COLLECTION, zoneId))
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// RESTAURANTES
// ============================================
export const RESTAURANTS_COLLECTION = 'restaurants'

export const getRestaurants = async () => {
  try {
    const q = query(collection(db, RESTAURANTS_COLLECTION), orderBy('createdAt', 'desc'))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  } catch (error) {
    // Silenciar errores de permisos (normal al hacer logout)
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      return []
    }
    console.error('Error obteniendo restaurantes:', error)
    return []
  }
}

export const getRestaurant = async (restaurantId) => {
  try {
    const docSnap = await getDoc(doc(db, RESTAURANTS_COLLECTION, restaurantId))
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() }
    }
    return null
  } catch (error) {
    // Silenciar errores de permisos (normal al hacer logout)
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      return null
    }
    console.error('Error obteniendo restaurante:', error)
    return null
  }
}

export const getRestaurantByUserId = async (userId) => {
  try {
    const q = query(
      collection(db, RESTAURANTS_COLLECTION), 
      where('userId', '==', userId)
    )
    const snapshot = await getDocs(q)
    if (!snapshot.empty) {
      const doc = snapshot.docs[0]
      return { id: doc.id, ...doc.data() }
    }
    return null
  } catch (error) {
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      return null
    }
    console.error('Error obteniendo restaurante por userId:', error)
    return null
  }
}

export const subscribeToRestaurants = (callback) => {
  const q = query(collection(db, RESTAURANTS_COLLECTION), orderBy('createdAt', 'desc'))
  return onSnapshot(q, 
    (snapshot) => {
      const restaurants = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      callback(restaurants)
    },
    handleSnapshotError
  )
}

export const addRestaurant = async (restaurantData) => {
  try {
    const docRef = await addDoc(collection(db, RESTAURANTS_COLLECTION), {
      ...restaurantData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    return { success: true, id: docRef.id }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const updateRestaurant = async (restaurantId, restaurantData) => {
  try {
    await updateDoc(doc(db, RESTAURANTS_COLLECTION, restaurantId), {
      ...restaurantData,
      updatedAt: serverTimestamp()
    })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const toggleRestaurantActive = async (restaurantId, userId, active) => {
  try {
    const batch = writeBatch(db)
    batch.update(doc(db, RESTAURANTS_COLLECTION, restaurantId), {
      active,
      updatedAt: serverTimestamp()
    })
    batch.update(doc(db, USERS_COLLECTION, userId), {
      active,
      updatedAt: serverTimestamp()
    })
    await batch.commit()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const deleteRestaurant = async (restaurantId) => {
  try {
    await deleteDoc(doc(db, RESTAURANTS_COLLECTION, restaurantId))
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// REPARTIDORES
// ============================================
export const DRIVERS_COLLECTION = 'drivers'

export const getDrivers = async () => {
  try {
    const q = query(collection(db, DRIVERS_COLLECTION), orderBy('createdAt', 'desc'))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  } catch (error) {
    // Silenciar errores de permisos (normal al hacer logout)
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      return []
    }
    console.error('Error obteniendo repartidores:', error)
    return []
  }
}

export const getDriver = async (driverId) => {
  try {
    const docSnap = await getDoc(doc(db, DRIVERS_COLLECTION, driverId))
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() }
    }
    return null
  } catch (error) {
    // Silenciar errores de permisos (normal al hacer logout)
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      return null
    }
    console.error('Error obteniendo repartidor:', error)
    return null
  }
}

export const getDriverByUserId = async (userId) => {
  try {
    const q = query(
      collection(db, DRIVERS_COLLECTION), 
      where('userId', '==', userId)
    )
    const snapshot = await getDocs(q)
    if (!snapshot.empty) {
      const doc = snapshot.docs[0]
      return { id: doc.id, ...doc.data() }
    }
    return null
  } catch (error) {
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      return null
    }
    console.error('Error obteniendo repartidor por userId:', error)
    return null
  }
}

export const subscribeToDrivers = (callback) => {
  const q = query(collection(db, DRIVERS_COLLECTION), orderBy('createdAt', 'desc'))
  return onSnapshot(q, 
    (snapshot) => {
      const drivers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      callback(drivers)
    },
    handleSnapshotError
  )
}

export const subscribeToOnlineDrivers = (callback) => {
  const q = query(
    collection(db, DRIVERS_COLLECTION), 
    where('isOnline', '==', true),
    where('active', '==', true)
  )
  return onSnapshot(q, 
    (snapshot) => {
      const drivers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      callback(drivers)
    },
    handleSnapshotError
  )
}

export const addDriver = async (driverData) => {
  try {
    const docRef = await addDoc(collection(db, DRIVERS_COLLECTION), {
      ...driverData,
      isOnline: false,
      totalServices: 0,
      totalEarnings: 0,
      rating: 5.0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    return { success: true, id: docRef.id }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const updateDriver = async (driverId, driverData) => {
  try {
    await updateDoc(doc(db, DRIVERS_COLLECTION, driverId), {
      ...driverData,
      updatedAt: serverTimestamp()
    })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const toggleDriverActive = async (driverId, userId, active) => {
  try {
    const batch = writeBatch(db)
    batch.update(doc(db, DRIVERS_COLLECTION, driverId), {
      active,
      updatedAt: serverTimestamp()
    })
    batch.update(doc(db, USERS_COLLECTION, userId), {
      active,
      updatedAt: serverTimestamp()
    })
    await batch.commit()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const deleteDriver = async (driverId) => {
  try {
    await deleteDoc(doc(db, DRIVERS_COLLECTION, driverId))
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const setDriverOnline = async (driverId, isOnline) => {
  try {
    await updateDoc(doc(db, DRIVERS_COLLECTION, driverId), {
      isOnline,
      lastOnlineChange: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// SERVICIOS / PEDIDOS
// ============================================
export const SERVICES_COLLECTION = 'services'

export const getServices = async (filters = {}) => {
  try {
    let q = collection(db, SERVICES_COLLECTION)
    
    if (filters.status) {
      q = query(q, where('status', '==', filters.status))
    }
    if (filters.restaurantId) {
      q = query(q, where('restaurantId', '==', filters.restaurantId))
    }
    if (filters.driverId) {
      q = query(q, where('driverId', '==', filters.driverId))
    }
    
    q = query(q, orderBy('createdAt', 'desc'), limit(100))
    
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  } catch (error) {
    // Silenciar errores de permisos (normal al hacer logout)
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      return []
    }
    console.error('Error obteniendo servicios:', error)
    return []
  }
}

export const getService = async (serviceId) => {
  try {
    const docSnap = await getDoc(doc(db, SERVICES_COLLECTION, serviceId))
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() }
    }
    return null
  } catch (error) {
    // Silenciar errores de permisos (normal al hacer logout)
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      return null
    }
    console.error('Error obteniendo servicio:', error)
    return null
  }
}

export const subscribeToServices = (callback, filters = {}) => {
  let q = collection(db, SERVICES_COLLECTION)
  
  if (filters.status) {
    q = query(q, where('status', '==', filters.status))
  }
  if (filters.restaurantId) {
    q = query(q, where('restaurantId', '==', filters.restaurantId))
  }
  if (filters.driverId) {
    q = query(q, where('driverId', '==', filters.driverId))
  }
  
  q = query(q, orderBy('createdAt', 'desc'), limit(100))
  
  return onSnapshot(q, 
    (snapshot) => {
      const services = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      callback(services)
    },
    handleSnapshotError
  )
}

export const subscribeToPendingServices = (callback) => {
  const q = query(
    collection(db, SERVICES_COLLECTION),
    where('status', '==', 'pendiente'),
    orderBy('createdAt', 'desc')
  )
  
  return onSnapshot(q, 
    (snapshot) => {
      const services = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      callback(services)
    },
    handleSnapshotError
  )
}

export const subscribeToDriverServices = (driverId, callback) => {
  const q = query(
    collection(db, SERVICES_COLLECTION),
    where('driverId', '==', driverId),
    orderBy('createdAt', 'desc'),
    limit(50)
  )
  
  return onSnapshot(q, 
    (snapshot) => {
      const services = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      callback(services)
    },
    handleSnapshotError
  )
}

export const subscribeToRestaurantServices = (restaurantId, callback) => {
  const q = query(
    collection(db, SERVICES_COLLECTION),
    where('restaurantId', '==', restaurantId),
    orderBy('createdAt', 'desc'),
    limit(50)
  )
  
  return onSnapshot(q, 
    (snapshot) => {
      const services = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      callback(services)
    },
    handleSnapshotError
  )
}

// ============================================
// CREAR SERVICIO - CON BROADCAST
// ============================================
export const createService = async (serviceData) => {
  try {
    console.log('📝 Creando servicio...', serviceData)
    
    // Generar ID de servicio con formato: DDMMAAHHMM + iniciales del restaurante
    const now = new Date()
    const day = String(now.getDate()).padStart(2, '0')
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const year = String(now.getFullYear()).slice(-2)
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    
    const restaurantName = serviceData.restaurantName || ''
    const initials = restaurantName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 3)
      .padEnd(2, 'X')
    
    const serviceId = `${day}${month}${year}${hours}${minutes}${initials}`
    console.log('📋 Service ID generado:', serviceId)

    // Obtener ubicación y teléfono del restaurante
    let restaurantLocation = null
    let restaurantPhone = serviceData.restaurantPhone || null
    
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
            console.log('📍 Ubicación del restaurante:', restaurantLocation)
          }
          // Obtener teléfono del restaurante si no se proporcionó
          if (!restaurantPhone && rData.phone) {
            restaurantPhone = rData.phone
            console.log('📞 Teléfono del restaurante:', restaurantPhone)
          }
        }
      } catch (e) {
        console.log('⚠️ No se pudo obtener ubicación del restaurante:', e.message)
      }
    }

    // Si no hay ubicación, usar Maracay centro
    if (!restaurantLocation) {
      restaurantLocation = {
        latitude: 10.2647,
        longitude: -67.6084
      }
      console.log('⚠️ Usando ubicación por defecto (Maracay centro)')
    }

    // Crear el servicio en Firestore
    const docRef = await addDoc(collection(db, SERVICES_COLLECTION), {
      ...serviceData,
      serviceId,
      restaurantPhone,
      status: 'pendiente',
      broadcastStatus: 'pending',
      broadcastAttempts: 0,
      broadcastRadius: 0,
      restaurantLocation,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    console.log('✅ Servicio creado en Firestore:', docRef.id)

    // 📢 INICIAR BROADCAST para notificar repartidores
    console.log('📢 Iniciando broadcast...')
    
    try {
      const { createServiceBroadcast, startExpirationChecker } = await import('./broadcastService.js')
      
      // Iniciar el verificador de expiración global
      startExpirationChecker()
      
      const broadcastResult = await createServiceBroadcast(docRef.id, {
        ...serviceData,
        serviceId,
        restaurantPhone,
        restaurantLocation
      })
      
      if (broadcastResult.success) {
        console.log('✅ Broadcast iniciado correctamente')
      } else {
        console.error('❌ Error en broadcast:', broadcastResult.error)
      }
    } catch (broadcastError) {
      console.error('❌ Error importando/iniciando broadcast:', broadcastError)
    }

    return { success: true, id: docRef.id, serviceId }
  } catch (error) {
    console.error('❌ Error creando servicio:', error)
    return { success: false, error: error.message }
  }
}

export const updateService = async (serviceId, serviceData) => {
  try {
    await updateDoc(doc(db, SERVICES_COLLECTION, serviceId), {
      ...serviceData,
      updatedAt: serverTimestamp()
    })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const acceptService = async (serviceId, driverId, driverName) => {
  try {
    const serviceRef = doc(db, SERVICES_COLLECTION, serviceId)
    await updateDoc(serviceRef, {
      driverId,
      driverName,
      status: 'asignado',
      acceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    
    const serviceDoc = await getDoc(serviceRef)
    if (serviceDoc.exists()) {
      const serviceData = { id: serviceId, ...serviceDoc.data() }
      import('./notificationTriggers').then(({ triggerServiceAccepted }) => {
        triggerServiceAccepted(serviceData, { id: driverId, name: driverName })
      }).catch(() => {})
    }
    
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const startService = async (serviceId) => {
  try {
    const serviceRef = doc(db, SERVICES_COLLECTION, serviceId)
    await updateDoc(serviceRef, {
      status: 'en_camino',
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    
    const serviceDoc = await getDoc(serviceRef)
    if (serviceDoc.exists()) {
      const serviceData = { id: serviceId, ...serviceDoc.data() }
      import('./notificationTriggers').then(({ triggerServiceOnTheWay }) => {
        triggerServiceOnTheWay(serviceData)
      }).catch(() => {})
    }
    
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const completeService = async (serviceId, driverEarnings) => {
  try {
    const batch = writeBatch(db)
    
    const serviceRef = doc(db, SERVICES_COLLECTION, serviceId)
    batch.update(serviceRef, {
      status: 'entregado',
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    
    const serviceDoc = await getDoc(serviceRef)
    if (serviceDoc.exists() && serviceDoc.data().driverId) {
      const driverRef = doc(db, DRIVERS_COLLECTION, serviceDoc.data().driverId)
      batch.update(driverRef, {
        totalServices: increment(1),
        totalEarnings: increment(driverEarnings || 0),
        updatedAt: serverTimestamp()
      })
    }
    
    await batch.commit()
    
    if (serviceDoc.exists()) {
      const serviceData = { id: serviceId, ...serviceDoc.data() }
      import('./notificationTriggers').then(({ triggerServiceCompleted }) => {
        triggerServiceCompleted(serviceData)
      }).catch(() => {})
    }
    
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const cancelService = async (serviceId, reason = '', cancelledBy = 'system') => {
  try {
    const serviceRef = doc(db, SERVICES_COLLECTION, serviceId)
    await updateDoc(serviceRef, {
      status: 'cancelado',
      cancelReason: reason,
      cancelledBy,
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    
    const serviceDoc = await getDoc(serviceRef)
    if (serviceDoc.exists()) {
      const serviceData = { id: serviceId, ...serviceDoc.data() }
      import('./notificationTriggers').then(({ triggerServiceCancelled }) => {
        triggerServiceCancelled(serviceData, cancelledBy)
      }).catch(() => {})
    }
    
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// REINTENTAR SERVICIO (cuando no hay repartidor)
// ============================================
export const retryService = async (serviceId) => {
  try {
    console.log('🔄 Reintentando servicio:', serviceId)
    
    const serviceRef = doc(db, SERVICES_COLLECTION, serviceId)
    const serviceDoc = await getDoc(serviceRef)
    
    if (!serviceDoc.exists()) {
      return { success: false, error: 'Servicio no encontrado' }
    }
    
    const serviceData = serviceDoc.data()
    
    // Solo se puede reintentar si está sin repartidor o cancelado por falta de conductores
    if (!['sin_repartidor', 'pendiente'].includes(serviceData.status)) {
      return { success: false, error: 'El servicio no puede ser reintentado en su estado actual' }
    }
    
    // Resetear el estado del servicio
    await updateDoc(serviceRef, {
      status: 'pendiente',
      broadcastStatus: 'pending',
      broadcastAttempts: 0,
      broadcastRadius: 0,
      driverId: null,
      driverName: null,
      retryCount: (serviceData.retryCount || 0) + 1,
      retriedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    
    console.log('✅ Servicio reseteado, iniciando nuevo broadcast...')
    
    // Iniciar nuevo broadcast
    try {
      const { createServiceBroadcast } = await import('./broadcastService.js')
      const broadcastResult = await createServiceBroadcast(serviceId, {
        ...serviceData,
        restaurantLocation: serviceData.restaurantLocation || {
          latitude: 10.2647,
          longitude: -67.6084
        }
      })
      
      if (broadcastResult.success) {
        console.log('✅ Nuevo broadcast iniciado correctamente')
        return { success: true, message: 'Servicio republicado. Buscando repartidores...' }
      } else {
        console.error('❌ Error en nuevo broadcast:', broadcastResult.error)
        return { success: false, error: broadcastResult.error }
      }
    } catch (broadcastError) {
      console.error('❌ Error iniciando broadcast:', broadcastError)
      return { success: false, error: broadcastError.message }
    }
  } catch (error) {
    console.error('❌ Error reintentando servicio:', error)
    return { success: false, error: error.message }
  }
}

// ============================================
// LIQUIDACIONES
// ============================================
export const SETTLEMENTS_COLLECTION = 'settlements'

export const getSettlements = async (filters = {}) => {
  try {
    let q = collection(db, SETTLEMENTS_COLLECTION)
    
    if (filters.restaurantId) {
      q = query(q, where('restaurantId', '==', filters.restaurantId))
    }
    if (filters.driverId) {
      q = query(q, where('driverId', '==', filters.driverId))
    }
    if (filters.status) {
      q = query(q, where('status', '==', filters.status))
    }
    
    q = query(q, orderBy('createdAt', 'desc'))
    
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  } catch (error) {
    // Silenciar errores de permisos (normal al hacer logout)
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      return []
    }
    console.error('Error obteniendo liquidaciones:', error)
    return []
  }
}

export const subscribeToSettlements = (callback, filters = {}) => {
  let q = collection(db, SETTLEMENTS_COLLECTION)
  
  if (filters.restaurantId) {
    q = query(q, where('restaurantId', '==', filters.restaurantId))
  }
  if (filters.driverId) {
    q = query(q, where('driverId', '==', filters.driverId))
  }
  
  q = query(q, orderBy('createdAt', 'desc'))
  
  return onSnapshot(q, 
    (snapshot) => {
      const settlements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      callback(settlements)
    },
    handleSnapshotError
  )
}

export const createSettlement = async (settlementData) => {
  try {
    const docRef = await addDoc(collection(db, SETTLEMENTS_COLLECTION), {
      ...settlementData,
      status: 'pendiente',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    return { success: true, id: docRef.id }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const updateSettlement = async (settlementId, settlementData) => {
  try {
    await updateDoc(doc(db, SETTLEMENTS_COLLECTION, settlementId), {
      ...settlementData,
      updatedAt: serverTimestamp()
    })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const paySettlement = async (settlementId) => {
  try {
    await updateDoc(doc(db, SETTLEMENTS_COLLECTION, settlementId), {
      status: 'pagado',
      paidAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// ESTADÍSTICAS
// ============================================
export const getDashboardStats = async () => {
  try {
    const [restaurants, drivers, services] = await Promise.all([
      getRestaurants(),
      getDrivers(),
      getServices()
    ])
    
    const activeRestaurants = restaurants.filter(r => r.active).length
    const onlineDrivers = drivers.filter(d => d.isOnline && d.active).length
    const activeDrivers = drivers.filter(d => d.active).length
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const servicesToday = services.filter(s => {
      const createdAt = s.createdAt?.toDate?.()
      return createdAt && createdAt >= today
    })
    
    const pendingServices = services.filter(s => s.status === 'pendiente').length
    const inProgressServices = services.filter(s => s.status === 'en_camino').length
    const completedToday = servicesToday.filter(s => s.status === 'entregado').length
    
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    
    const monthlyServices = services.filter(s => {
      const createdAt = s.createdAt?.toDate?.()
      return createdAt && createdAt >= monthStart && s.status === 'entregado'
    })
    
    const monthlyRevenue = monthlyServices.reduce((sum, s) => sum + (s.platformFee || 0), 0)
    const todayRevenue = servicesToday
      .filter(s => s.status === 'entregado')
      .reduce((sum, s) => sum + (s.platformFee || 0), 0)
    
    return {
      activeRestaurants,
      onlineDrivers,
      activeDrivers,
      totalDrivers: drivers.length,
      totalRestaurants: restaurants.length,
      servicesToday: servicesToday.length,
      pendingServices,
      inProgressServices,
      completedToday,
      monthlyRevenue,
      todayRevenue
    }
  } catch (error) {
    // Silenciar errores de permisos (normal al hacer logout)
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      return null
    }
    console.error('Error obteniendo estadísticas:', error)
    return null
  }
}

export const getRestaurantStats = async (restaurantId) => {
  try {
    const services = await getServices({ restaurantId })
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const servicesToday = services.filter(s => {
      const createdAt = s.createdAt?.toDate?.()
      return createdAt && createdAt >= today
    })
    
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    
    const monthlyServices = services.filter(s => {
      const createdAt = s.createdAt?.toDate?.()
      return createdAt && createdAt >= monthStart
    })
    
    const monthlyTotal = monthlyServices.reduce((sum, s) => sum + (s.deliveryFee || 0), 0)
    const pendingPayment = services
      .filter(s => s.status === 'entregado' && !s.settled)
      .reduce((sum, s) => sum + (s.deliveryFee || 0), 0)
    
    return {
      servicesToday: servicesToday.length,
      monthlyServices: monthlyServices.length,
      monthlyTotal,
      pendingPayment,
      totalServices: services.length
    }
  } catch (error) {
    // Silenciar errores de permisos (normal al hacer logout)
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      return null
    }
    console.error('Error obteniendo estadísticas del restaurante:', error)
    return null
  }
}

export const getDriverStats = async (driverId) => {
  try {
    const services = await getServices({ driverId })
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const servicesToday = services.filter(s => {
      const createdAt = s.createdAt?.toDate?.()
      return createdAt && createdAt >= today
    })
    
    const completedToday = servicesToday.filter(s => s.status === 'entregado')
    const earningsToday = completedToday.reduce((sum, s) => sum + (s.driverEarnings || 0), 0)
    
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)
    
    const weeklyServices = services.filter(s => {
      const createdAt = s.createdAt?.toDate?.()
      return createdAt && createdAt >= weekStart && s.status === 'entregado'
    })
    
    const weeklyEarnings = weeklyServices.reduce((sum, s) => sum + (s.driverEarnings || 0), 0)
    
    const completedServices = services.filter(s => s.status === 'entregado')
    const totalEarnings = completedServices.reduce((sum, s) => sum + (s.driverEarnings || 0), 0)
    
    return {
      servicesToday: servicesToday.length,
      completedToday: completedToday.length,
      earningsToday,
      weeklyServices: weeklyServices.length,
      weeklyEarnings,
      totalServices: completedServices.length,
      totalEarnings,
      rating: services[0]?.driverRating || 5.0
    }
  } catch (error) {
    // Silenciar errores de permisos (normal al hacer logout)
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      return null
    }
    console.error('Error obteniendo estadísticas del repartidor:', error)
    return null
  }
}

// ============================================
// CONFIGURACIÓN
// ============================================
export const SETTINGS_COLLECTION = 'settings'

export const getSettings = async () => {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, 'app')
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      return docSnap.data()
    }
    return null
  } catch (error) {
    // Silenciar errores de permisos (normal al hacer logout)
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      return null
    }
    console.error('Error obteniendo configuración:', error)
    return null
  }
}

export const updateSettings = async (settingsData) => {
  try {
    await setDoc(doc(db, SETTINGS_COLLECTION, 'app'), {
      ...settingsData,
      updatedAt: serverTimestamp()
    }, { merge: true })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// USUARIOS
// ============================================
export const USERS_COLLECTION = 'users'

export const getUser = async (userId) => {
  try {
    const docSnap = await getDoc(doc(db, USERS_COLLECTION, userId))
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() }
    }
    return null
  } catch (error) {
    // Silenciar errores de permisos (normal al hacer logout)
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      return null
    }
    console.error('Error obteniendo usuario:', error)
    return null
  }
}

export const updateUser = async (userId, userData) => {
  try {
    await updateDoc(doc(db, USERS_COLLECTION, userId), {
      ...userData,
      updatedAt: serverTimestamp()
    })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// TASA DE CAMBIO (BCV)
// ============================================
export const APP_CONFIG_COLLECTION = 'settings'
export const APP_CONFIG_DOC = 'app_config'

export const getExchangeRate = async () => {
  try {
    const docRef = doc(db, APP_CONFIG_COLLECTION, APP_CONFIG_DOC)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      const data = docSnap.data()
      return {
        rate: data.exchangeRate || 0,
        lastUpdate: data.lastUpdate?.toDate?.() || null,
        previousRate: data.previousRate || 0,
        fechaValor: data.fechaValor || null,
        source: data.source || 'api-bcv-1vq1.onrender.com'
      }
    }
    return { rate: 0, lastUpdate: null, previousRate: 0, fechaValor: null }
  } catch (error) {
    // Silenciar errores de permisos (normal al hacer logout)
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      return { rate: 0, lastUpdate: null, previousRate: 0, fechaValor: null }
    }
    console.error('Error obteniendo tasa de cambio:', error)
    return { rate: 0, lastUpdate: null, previousRate: 0, fechaValor: null }
  }
}

export const subscribeToExchangeRate = (callback) => {
  const docRef = doc(db, APP_CONFIG_COLLECTION, APP_CONFIG_DOC)
  return onSnapshot(docRef, 
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data()
        callback({
          rate: data.exchangeRate || 0,
          lastUpdate: data.lastUpdate?.toDate?.() || null,
          previousRate: data.previousRate || 0,
          fechaValor: data.fechaValor || null,
          source: data.source || 'api-bcv-1vq1.onrender.com'
        })
      } else {
        callback({ rate: 0, lastUpdate: null, previousRate: 0, fechaValor: null })
      }
    },
    handleSnapshotError
  )
}

export const convertUsdToVes = (usdAmount, exchangeRate) => {
  if (!exchangeRate || exchangeRate <= 0) return 0
  return usdAmount * exchangeRate
}

export const formatVes = (amount) => {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'VES',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}