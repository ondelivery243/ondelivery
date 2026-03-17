// src/hooks/useNotifications.js
// Hook para manejar notificaciones push en la aplicación

import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { 
  initializeNotifications, 
  onForegroundMessage,
  showLocalNotification 
} from '../services/notifications'

export const useNotifications = () => {
  const { user } = useStore()
  const [initialized, setInitialized] = useState(false)
  const [permission, setPermission] = useState(Notification.permission)

  // Inicializar notificaciones cuando el usuario hace login
  useEffect(() => {
    const setupNotifications = async () => {
      if (user && user.uid && !initialized) {
        console.log('🔔 Inicializando notificaciones para:', user.uid)
        
        try {
          const result = await initializeNotifications(user.uid)
          
          if (result.success) {
            console.log('✅ Notificaciones configuradas')
            setInitialized(true)
          } else {
            console.log('⚠️ No se pudieron configurar notificaciones:', result.error)
          }
        } catch (error) {
          console.error('❌ Error inicializando notificaciones:', error)
        }
      }
    }

    setupNotifications()
  }, [user, initialized])

  // Escuchar mensajes en primer plano
  useEffect(() => {
    const unsubscribe = onForegroundMessage((payload) => {
      console.log('📩 Notificación recibida:', payload)
      
      // Mostrar notificación local
      const title = payload.notification?.title || 'ON Delivery'
      const body = payload.notification?.body || ''
      
      showLocalNotification(title, {
        body,
        icon: '/logo-192.png',
        data: payload.data
      })
    })

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe()
      }
    }
  }, [])

  // Actualizar estado de permiso
  useEffect(() => {
    const checkPermission = () => {
      setPermission(Notification.permission)
    }
    
    // Verificar permiso inicial
    checkPermission()
    
    // Verificar cuando cambia el permiso
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'notifications' }).then((status) => {
        status.onchange = checkPermission
      })
    }
  }, [])

  // Función para solicitar permiso manualmente
  const requestPermission = async () => {
    if (user?.uid) {
      const result = await initializeNotifications(user.uid)
      if (result.success) {
        setInitialized(true)
        setPermission('granted')
      }
      return result
    }
    return { success: false, error: 'No hay usuario logueado' }
  }

  return {
    initialized,
    permission,
    requestPermission,
    isSupported: 'Notification' in window && 'serviceWorker' in navigator
  }
}

export default useNotifications
