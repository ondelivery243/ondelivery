// src/services/notifications.js
import { getMessagingInstance } from '../config/firebase'
import { 
  getToken, 
  onMessage, 
  deleteToken 
} from 'firebase/messaging'
import { doc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../config/firebase'

// VAPID key para web push (debe configurarse en Firebase Console)
// Si no está en variables de entorno, usar la clave directa
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || 'BK5hyc3eRd_hVksdUbjVJTXhnktF_lh9JDeNSJzkg6TgHvzoBqmLRhf5lr2aNaRoGVmzxmFuF0WgUxz-8TgkHKo'

// Registrar Service Worker para Firebase Messaging
const registerServiceWorker = async () => {
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
      console.log('✅ Service Worker registrado:', registration.scope)
      return registration
    }
  } catch (error) {
    console.error('❌ Error registrando Service Worker:', error)
  }
  return null
}

// Solicitar permisos de notificación
export const requestNotificationPermission = async () => {
  try {
    console.log('🔔 Solicitando permisos de notificación...')
    
    const messaging = await getMessagingInstance()
    if (!messaging) {
      console.log('⚠️ Messaging no soportado en este navegador')
      return { granted: false, token: null }
    }

    // Verificar si ya hay permiso
    if (Notification.permission === 'granted') {
      console.log('✅ Permiso ya concedido')
    } else if (Notification.permission === 'denied') {
      console.log('❌ Permiso denegado por el usuario')
      return { granted: false, token: null, reason: 'denied' }
    } else {
      // Solicitar permiso
      const permission = await Notification.requestPermission()
      console.log('📱 Resultado de solicitud:', permission)
      
      if (permission !== 'granted') {
        return { granted: false, token: null, reason: 'not_granted' }
      }
    }

    // Registrar Service Worker
    const registration = await registerServiceWorker()
    
    // Obtener token FCM
    console.log('🔑 Obteniendo token FCM con VAPID Key...')
    const token = await getToken(messaging, { 
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration || undefined
    })
    
    if (token) {
      console.log('✅ Token FCM obtenido:', token.substring(0, 20) + '...')
      return { granted: true, token }
    } else {
      console.log('❌ No se pudo obtener el token')
      return { granted: false, token: null }
    }
  } catch (error) {
    console.error('❌ Error solicitando permisos de notificación:', error)
    return { granted: false, token: null, error: error.message }
  }
}

// Guardar token del usuario en Firestore
export const saveUserToken = async (userId, token) => {
  try {
    console.log('💾 Guardando token en Firestore para usuario:', userId)
    await setDoc(doc(db, 'userTokens', userId), {
      token,
      updatedAt: new Date(),
      platform: 'web',
      userAgent: navigator.userAgent
    })
    console.log('✅ Token guardado exitosamente')
    return { success: true }
  } catch (error) {
    console.error('❌ Error guardando token:', error)
    return { success: false, error: error.message }
  }
}

// Eliminar token del usuario
export const removeUserToken = async (userId) => {
  try {
    await deleteDoc(doc(db, 'userTokens', userId))
    return { success: true }
  } catch (error) {
    console.error('❌ Error eliminando token:', error)
    return { success: false, error: error.message }
  }
}

// Escuchar mensajes en primer plano
export const onForegroundMessage = (callback) => {
  getMessagingInstance().then((messaging) => {
    if (messaging) {
      onMessage(messaging, (payload) => {
        console.log('📩 Mensaje recibido en primer plano:', payload)
        callback(payload)
      })
    }
  })
}

// Inicializar notificaciones para un usuario
export const initializeNotifications = async (userId) => {
  console.log('🚀 Inicializando notificaciones para usuario:', userId)
  
  const { granted, token, error, reason } = await requestNotificationPermission()
  
  if (granted && token && userId) {
    const saveResult = await saveUserToken(userId, token)
    
    if (saveResult.success) {
      console.log('🎉 Notificaciones inicializadas correctamente')
      return { success: true, token }
    } else {
      return { success: false, error: saveResult.error }
    }
  }
  
  return { success: false, error: error || reason || 'unknown' }
}

// Mostrar notificación local
export const showLocalNotification = (title, options = {}) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/logo-192.png',
      badge: '/logo-192.png',
      ...options
    })
  }
}

// Tipos de notificaciones predefinidas
export const NotificationTypes = {
  NEW_SERVICE: {
    title: '¡Nuevo Servicio!',
    icon: '📦'
  },
  SERVICE_ACCEPTED: {
    title: 'Servicio Aceptado',
    icon: '✅'
  },
  SERVICE_COMPLETED: {
    title: 'Servicio Completado',
    icon: '🎉'
  },
  SERVICE_CANCELLED: {
    title: 'Servicio Cancelado',
    icon: '❌'
  },
  SETTLEMENT_READY: {
    title: 'Liquidación Lista',
    icon: '💰'
  }
}

// Enviar notificación formateada
export const sendTypedNotification = (type, body, data = {}) => {
  const notificationType = NotificationTypes[type] || { title: 'ON Delivery', icon: '🔔' }
  
  showLocalNotification(notificationType.title, {
    body,
    icon: '/logo-192.png',
    tag: type,
    data,
    requireInteraction: type === 'NEW_SERVICE'
  })
}

export default {
  requestNotificationPermission,
  saveUserToken,
  removeUserToken,
  onForegroundMessage,
  initializeNotifications,
  showLocalNotification,
  sendTypedNotification,
  NotificationTypes
}
