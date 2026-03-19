// src/services/notificationTriggers.js
// Sistema de notificaciones automáticas con triggers para eventos del servicio

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  addDoc,
  updateDoc,
  onSnapshot
} from 'firebase/firestore'
import { db } from '../config/firebase'

// ============================================
// COLECCIONES
// ============================================
const NOTIFICATIONS_COLLECTION = 'notifications'
const USER_TOKENS_COLLECTION = 'userTokens'

// ============================================
// TIPOS DE NOTIFICACIONES
// ============================================
export const NotificationTypes = {
  // Para repartidores
  NEW_SERVICE: {
    type: 'NEW_SERVICE',
    title: '¡Nuevo Servicio Disponible!',
    body: 'Tienes un nuevo pedido esperando ser entregado',
    icon: '📦',
    sound: 'new_service',
    priority: 'high'
  },
  SERVICE_CANCELLED: {
    type: 'SERVICE_CANCELLED',
    title: 'Servicio Cancelado',
    body: 'Un servicio que tenías asignado ha sido cancelado',
    icon: '❌',
    sound: 'cancel',
    priority: 'high'
  },
  
  // Para restaurantes
  SERVICE_ACCEPTED: {
    type: 'SERVICE_ACCEPTED',
    title: '¡Repartidor Asignado!',
    body: 'Tu pedido ha sido asignado a un repartidor',
    icon: '✅',
    sound: 'success',
    priority: 'high'
  },
  DRIVER_ON_WAY: {
    type: 'DRIVER_ON_WAY',
    title: 'Repartidor en Camino',
    body: 'El repartidor va hacia el punto de entrega',
    icon: '🛵',
    sound: 'update',
    priority: 'normal'
  },
  SERVICE_COMPLETED: {
    type: 'SERVICE_COMPLETED',
    title: '¡Pedido Entregado!',
    body: 'Tu pedido ha sido entregado exitosamente',
    icon: '🎉',
    sound: 'success',
    priority: 'high'
  },
  SETTLEMENT_READY: {
    type: 'SETTLEMENT_READY',
    title: 'Liquidación Lista',
    body: 'Tienes una liquidación pendiente por cobrar',
    icon: '💰',
    sound: 'money',
    priority: 'high'
  },
  
  // Para administradores
  NEW_RESTAURANT: {
    type: 'NEW_RESTAURANT',
    title: 'Nuevo Restaurante Registrado',
    body: 'Un nuevo restaurante solicita activación',
    icon: '🏪',
    sound: 'new',
    priority: 'normal'
  },
  NEW_DRIVER: {
    type: 'NEW_DRIVER',
    title: 'Nuevo Repartidor Registrado',
    body: 'Un nuevo repartidor solicita activación',
    icon: '🏍️',
    sound: 'new',
    priority: 'normal'
  }
}

// ============================================
// FUNCIÓN PRINCIPAL: ENVIAR NOTIFICACIÓN
// ============================================

/**
 * Enviar una notificación push a uno o más usuarios
 * @param {string|string[]} userIds - ID(s) del usuario destino
 * @param {Object} notificationType - Tipo de notificación (de NotificationTypes)
 * @param {Object} data - Datos adicionales para la notificación
 */
export const sendNotification = async (userIds, notificationType, data = {}) => {
  try {
    const userIdArray = Array.isArray(userIds) ? userIds : [userIds]
    
    // Crear notificación en Firestore para cada usuario
    const notificationPromises = userIdArray.map(async (userId) => {
      // Intentar guardar en colección de notificaciones (puede fallar por permisos)
      try {
        const notificationRef = await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
          userId,
          type: notificationType.type,
          title: notificationType.title,
          body: typeof notificationType.body === 'function' 
            ? notificationType.body(data) 
            : notificationType.body,
          icon: notificationType.icon,
          sound: notificationType.sound,
          priority: notificationType.priority,
          data,
          read: false,
          createdAt: serverTimestamp()
        })

        // Enviar push notification via Netlify Function (opcional)
        try {
          await sendPushNotification(userId, {
            title: notificationType.title,
            body: typeof notificationType.body === 'function' 
              ? notificationType.body(data) 
              : notificationType.body,
            data: {
              type: notificationType.type,
              notificationId: notificationRef.id,
              ...data
            }
          })
        } catch (pushError) {
          // Push notification falló, pero no es crítico
          console.log('⚠️ Push notification no enviada:', pushError.message)
        }

        return notificationRef.id
      } catch (firestoreError) {
        // Si falla Firestore, solo log y continuar
        console.log('⚠️ No se pudo guardar notificación en Firestore:', firestoreError.message)
        return null
      }
    })

    const notificationIds = await Promise.all(notificationPromises)
    const successCount = notificationIds.filter(id => id !== null).length
    
    if (successCount > 0) {
      console.log(`✅ ${successCount} notificación(es) enviada(s)`)
    }
    
    return { success: true, notificationIds }
  } catch (error) {
    // No bloquear el flujo principal si las notificaciones fallan
    console.log('⚠️ Notificaciones no disponibles:', error.message)
    return { success: false, error: error.message, silent: true }
  }
}

/**
 * Enviar push notification via Netlify Function
 */
const sendPushNotification = async (userId, payload) => {
  try {
    const response = await fetch('/.netlify/functions/sendPush', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        title: payload.title,
        body: payload.body,
        data: payload.data
      })
    })

    const result = await response.json()
    return result
  } catch (error) {
    console.log('Error enviando push:', error)
    return { success: false, error: error.message }
  }
}

// ============================================
// TRIGGERS AUTOMÁTICOS
// ============================================

/**
 * Trigger: Nuevo servicio creado
 * Notificar a todos los repartidores online
 */
export const triggerNewService = async (serviceData) => {
  try {
    // Obtener repartidores online
    const driversQuery = query(
      collection(db, 'drivers'),
      where('isOnline', '==', true),
      where('active', '==', true)
    )
    
    const driversSnapshot = await getDocs(driversQuery)
    const onlineDriverIds = driversSnapshot.docs
      .map(doc => doc.data().userId)
      .filter(Boolean)

    if (onlineDriverIds.length === 0) {
      console.log('⚠️ No hay repartidores online para notificar')
      return { success: false, reason: 'no_drivers_online' }
    }

    // Enviar notificación
    return await sendNotification(onlineDriverIds, NotificationTypes.NEW_SERVICE, {
      serviceId: serviceData.id,
      serviceCode: serviceData.serviceId,
      restaurantName: serviceData.restaurantName,
      zoneName: serviceData.zoneName,
      earnings: serviceData.driverEarnings,
      url: '/repartidor'
    })
  } catch (error) {
    console.log('Error en triggerNewService:', error.message)
    return { success: false, error: error.message, silent: true }
  }
}

/**
 * Trigger: Servicio aceptado por repartidor
 * Notificar al restaurante
 */
export const triggerServiceAccepted = async (serviceData, driverData) => {
  try {
    // Obtener el userId del restaurante
    const restaurantDoc = await getDoc(doc(db, 'restaurants', serviceData.restaurantId))
    if (!restaurantDoc.exists()) {
      return { success: false, reason: 'restaurant_not_found' }
    }

    const restaurantUserId = restaurantDoc.data().userId
    if (!restaurantUserId) {
      return { success: false, reason: 'no_user_id' }
    }

    return await sendNotification(restaurantUserId, {
      ...NotificationTypes.SERVICE_ACCEPTED,
      body: `${driverData.name} ha tomado tu pedido`
    }, {
      serviceId: serviceData.id,
      serviceCode: serviceData.serviceId,
      driverName: driverData.name,
      driverPhone: driverData.phone,
      driverId: driverData.id,
      url: '/restaurante'
    })
  } catch (error) {
    console.log('Error en triggerServiceAccepted:', error.message)
    return { success: false, error: error.message, silent: true }
  }
}

/**
 * Trigger: Servicio en camino
 * Notificar al restaurante que el repartidor está en camino
 */
export const triggerServiceOnTheWay = async (serviceData) => {
  try {
    const restaurantDoc = await getDoc(doc(db, 'restaurants', serviceData.restaurantId))
    if (!restaurantDoc.exists()) {
      return { success: false, reason: 'restaurant_not_found' }
    }

    const restaurantUserId = restaurantDoc.data().userId
    if (!restaurantUserId) {
      return { success: false, reason: 'no_user_id' }
    }

    return await sendNotification(restaurantUserId, {
      ...NotificationTypes.DRIVER_ON_WAY,
      body: `Tu pedido está en camino a ${serviceData.zoneName}`
    }, {
      serviceId: serviceData.id,
      serviceCode: serviceData.serviceId,
      zoneName: serviceData.zoneName,
      deliveryAddress: serviceData.deliveryAddress,
      url: '/restaurante'
    })
  } catch (error) {
    console.log('Error en triggerServiceOnTheWay:', error.message)
    return { success: false, error: error.message, silent: true }
  }
}

/**
 * Trigger: Servicio completado
 * Notificar al restaurante
 */
export const triggerServiceCompleted = async (serviceData) => {
  try {
    const restaurantDoc = await getDoc(doc(db, 'restaurants', serviceData.restaurantId))
    if (!restaurantDoc.exists()) {
      return { success: false, reason: 'restaurant_not_found' }
    }

    const restaurantUserId = restaurantDoc.data().userId
    if (!restaurantUserId) {
      return { success: false, reason: 'no_user_id' }
    }

    return await sendNotification(restaurantUserId, NotificationTypes.SERVICE_COMPLETED, {
      serviceId: serviceData.id,
      serviceCode: serviceData.serviceId,
      zoneName: serviceData.zoneName,
      url: '/restaurante'
    })
  } catch (error) {
    console.log('Error en triggerServiceCompleted:', error.message)
    return { success: false, error: error.message, silent: true }
  }
}

/**
 * Trigger: Servicio cancelado
 * Notificar al restaurante y/o repartidor según el estado
 */
export const triggerServiceCancelled = async (serviceData, cancelledBy) => {
  try {
    const notifications = []

    // Notificar al restaurante
    const restaurantDoc = await getDoc(doc(db, 'restaurants', serviceData.restaurantId))
    if (restaurantDoc.exists()) {
      const restaurantUserId = restaurantDoc.data().userId
      if (restaurantUserId) {
        notifications.push(
          sendNotification(restaurantUserId, NotificationTypes.SERVICE_CANCELLED, {
            serviceId: serviceData.id,
            serviceCode: serviceData.serviceId,
            cancelledBy,
            reason: serviceData.cancelReason,
            url: '/restaurante'
          })
        )
      }
    }

    // Notificar al repartidor si estaba asignado
    if (serviceData.driverId) {
      const driverDoc = await getDoc(doc(db, 'drivers', serviceData.driverId))
      if (driverDoc.exists()) {
        const driverUserId = driverDoc.data().userId
        if (driverUserId) {
          notifications.push(
            sendNotification(driverUserId, NotificationTypes.SERVICE_CANCELLED, {
              serviceId: serviceData.id,
              serviceCode: serviceData.serviceId,
              cancelledBy,
              reason: serviceData.cancelReason,
              url: '/repartidor'
            })
          )
        }
      }
    }

    await Promise.all(notifications)
    return { success: true }
  } catch (error) {
    console.log('Error en triggerServiceCancelled:', error.message)
    return { success: false, error: error.message, silent: true }
  }
}

/**
 * Trigger: Nueva liquidación disponible
 */
export const triggerSettlementReady = async (userId, settlementData) => {
  return await sendNotification(userId, NotificationTypes.SETTLEMENT_READY, {
    settlementId: settlementData.id,
    amount: settlementData.amount,
    url: '/restaurante/liquidacion'
  })
}

// ============================================
// SUSCRIPCIÓN A NOTIFICACIONES EN TIEMPO REAL
// ============================================

/**
 * Suscribirse a las notificaciones del usuario
 */
export const subscribeToNotifications = (userId, callback) => {
  const q = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('userId', '==', userId),
    where('read', '==', false)
  )

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    callback(notifications)
  }, (error) => {
    console.log('⚠️ Suscripción a notificaciones no disponible:', error.message)
    callback([])
  })
}

/**
 * Marcar notificación como leída
 */
export const markNotificationRead = async (notificationId) => {
  try {
    await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationId), {
      read: true,
      readAt: serverTimestamp()
    })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Marcar todas las notificaciones como leídas
 */
export const markAllNotificationsRead = async (userId) => {
  try {
    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where('userId', '==', userId),
      where('read', '==', false)
    )
    
    const snapshot = await getDocs(q)
    const updates = snapshot.docs.map(doc => 
      updateDoc(doc.ref, { read: true, readAt: serverTimestamp() })
    )
    
    await Promise.all(updates)
    return { success: true, count: updates.length }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// EXPORTAR TODO
// ============================================
export default {
  NotificationTypes,
  sendNotification,
  triggerNewService,
  triggerServiceAccepted,
  triggerServiceOnTheWay,
  triggerServiceCompleted,
  triggerServiceCancelled,
  triggerSettlementReady,
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead
}