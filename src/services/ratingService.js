// src/services/ratingService.js
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc,
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  onSnapshot,
  increment
} from 'firebase/firestore'
import { db } from '../config/firebase'

// ============================================
// RATING SERVICE - Sistema de Calificaciones
// ============================================

export const RATINGS_COLLECTION = 'ratings'

// Tags predefinidos para calificaciones
export const RATING_TAGS = {
  positive: [
    { id: 'puntual', label: 'Puntual', emoji: '⏰' },
    { id: 'amable', label: 'Amable', emoji: '😊' },
    { id: 'cuidadoso', label: 'Cuidadoso', emoji: '📦' },
    { id: 'rapido', label: 'Rápido', emoji: '🚀' },
    { id: 'comunicativo', label: 'Comunicativo', emoji: '💬' },
    { id: 'profesional', label: 'Profesional', emoji: '👔' }
  ],
  negative: [
    { id: 'tardo_mucho', label: 'Tardó mucho', emoji: '⏳' },
    { id: 'mala_actitud', label: 'Mala actitud', emoji: '😤' },
    { id: 'descuidado', label: 'Descuidado', emoji: '💔' },
    { id: 'no_comunico', label: 'No comunicó', emoji: '📵' }
  ]
}

/**
 * Enviar una calificación para un servicio completado
 * @param {string} serviceId - ID del servicio
 * @param {string} restaurantId - ID del restaurante que califica
 * @param {string} driverId - ID del repartidor calificado
 * @param {number} rating - Calificación de 1 a 5
 * @param {string} comment - Comentario opcional
 * @param {array} tags - Tags seleccionados
 */
export const submitRating = async (serviceId, restaurantId, driverId, rating, comment = '', tags = []) => {
  try {
    // Verificar que no exista calificación previa para este servicio
    const existingRating = await getRatingByService(serviceId, restaurantId)
    if (existingRating) {
      return { success: false, error: 'Ya calificaste este servicio' }
    }

    // Validar rating
    if (rating < 1 || rating > 5) {
      return { success: false, error: 'La calificación debe ser entre 1 y 5' }
    }

    // Crear la calificación
    const ratingData = {
      serviceId,
      restaurantId,
      driverId,
      rating,
      comment: comment.trim(),
      tags,
      createdAt: serverTimestamp()
    }

    const docRef = await addDoc(collection(db, RATINGS_COLLECTION), ratingData)

    // Actualizar promedio del repartidor
    await updateDriverRating(driverId, rating)

    return { success: true, id: docRef.id }
  } catch (error) {
    console.error('Error enviando calificación:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Actualizar el promedio de calificación del repartidor
 */
const updateDriverRating = async (driverId, newRating) => {
  try {
    const driverRef = doc(db, 'drivers', driverId)
    const driverDoc = await getDoc(driverRef)

    if (!driverDoc.exists()) {
      console.error('Repartidor no encontrado')
      return
    }

    const driverData = driverDoc.data()
    const currentTotal = driverData.totalRatings || 0
    const currentSum = driverData.ratingSum || 0

    // Calcular nuevo promedio
    const newTotal = currentTotal + 1
    const newSum = currentSum + newRating
    const newAverage = newSum / newTotal

    // Actualizar documento del repartidor
    await updateDoc(driverRef, {
      rating: Math.round(newAverage * 10) / 10, // Redondear a 1 decimal
      totalRatings: newTotal,
      ratingSum: newSum,
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('Error actualizando promedio del repartidor:', error)
  }
}

/**
 * Obtener calificación por servicio y restaurante
 */
export const getRatingByService = async (serviceId, restaurantId) => {
  try {
    const q = query(
      collection(db, RATINGS_COLLECTION),
      where('serviceId', '==', serviceId),
      where('restaurantId', '==', restaurantId)
    )
    const snapshot = await getDocs(q)
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0]
      return { id: doc.id, ...doc.data() }
    }
    return null
  } catch (error) {
    console.error('Error obteniendo calificación:', error)
    return null
  }
}

/**
 * Verificar si un servicio puede ser calificado
 */
export const canRateService = async (serviceId, restaurantId) => {
  try {
    const existingRating = await getRatingByService(serviceId, restaurantId)
    return !existingRating
  } catch (error) {
    console.error('Error verificando calificación:', error)
    return false
  }
}

/**
 * Obtener calificaciones de un repartidor
 */
export const getDriverRatings = async (driverId, limitCount = 10) => {
  try {
    const q = query(
      collection(db, RATINGS_COLLECTION),
      where('driverId', '==', driverId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  } catch (error) {
    console.error('Error obteniendo calificaciones del repartidor:', error)
    return []
  }
}

/**
 * Suscribirse a calificaciones de un repartidor en tiempo real
 */
export const subscribeToDriverRatings = (driverId, callback, limitCount = 10) => {
  const q = query(
    collection(db, RATINGS_COLLECTION),
    where('driverId', '==', driverId),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  )

  return onSnapshot(q, (snapshot) => {
    const ratings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    callback(ratings)
  }, (error) => {
    console.error('Error en suscripción de calificaciones:', error)
    callback([])
  })
}

/**
 * Obtener estadísticas de calificaciones de un repartidor
 */
export const getDriverRatingStats = async (driverId) => {
  try {
    const q = query(
      collection(db, RATINGS_COLLECTION),
      where('driverId', '==', driverId)
    )
    const snapshot = await getDocs(q)

    if (snapshot.empty) {
      return {
        average: 0,
        total: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
      }
    }

    const ratings = snapshot.docs.map(doc => doc.data().rating)
    const total = ratings.length
    const sum = ratings.reduce((acc, r) => acc + r, 0)
    const average = sum / total

    // Calcular distribución
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    ratings.forEach(r => {
      if (distribution[r] !== undefined) {
        distribution[r]++
      }
    })

    return {
      average: Math.round(average * 10) / 10,
      total,
      distribution
    }
  } catch (error) {
    console.error('Error obteniendo estadísticas de calificación:', error)
    return null
  }
}

/**
 * Formatear fecha relativa para mostrar en reseñas
 */
export const formatRelativeTime = (timestamp) => {
  if (!timestamp) return ''

  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  const now = new Date()
  const diff = now - date

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Hace un momento'
  if (minutes < 60) return `Hace ${minutes} min`
  if (hours < 24) return `Hace ${hours} hora${hours > 1 ? 's' : ''}`
  if (days < 7) return `Hace ${days} día${days > 1 ? 's' : ''}`
  
  return date.toLocaleDateString('es-VE', { 
    day: 'numeric', 
    month: 'short' 
  })
}

/**
 * Obtener etiqueta de rating
 */
export const getRatingLabel = (rating) => {
  const labels = {
    1: 'Muy malo',
    2: 'Malo',
    3: 'Regular',
    4: 'Bueno',
    5: 'Excelente'
  }
  return labels[Math.round(rating)] || 'Sin calificar'
}

/**
 * Obtener color según rating
 */
export const getRatingColor = (rating) => {
  if (rating >= 4.5) return 'success'
  if (rating >= 3.5) return 'primary'
  if (rating >= 2.5) return 'warning'
  return 'error'
}
