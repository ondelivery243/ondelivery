// public/firebase-messaging-sw.js
// Service Worker para Firebase Cloud Messaging
// Este archivo permite recibir notificaciones cuando la app está en segundo plano

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js')

// Configuración de Firebase
firebase.initializeApp({
  apiKey: "AIzaSyBvnHxA7wSYDkZnpzHXIMUxCas8872jheU",
  authDomain: "ondelivery-0243.firebaseapp.com",
  projectId: "ondelivery-0243",
  storageBucket: "ondelivery-0243.firebasestorage.app",
  messagingSenderId: "49907880119",
  appId: "1:49907880119:web:b72302b9a7eadc2113bd32"
})

// Inicializar Messaging
const messaging = firebase.messaging()

// Manejar mensajes en segundo plano
messaging.onBackgroundMessage((payload) => {
  console.log('[Firebase SW] Mensaje recibido en segundo plano:', payload)

  const notificationTitle = payload.notification?.title || 'ON Delivery'
  const notificationOptions = {
    body: payload.notification?.body || 'Tienes una nueva notificación',
    icon: '/logo-192.png',
    badge: '/logo-192.png',
    tag: payload.data?.tag || 'default',
    data: payload.data || {},
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: 'Abrir'
      },
      {
        action: 'close',
        title: 'Cerrar'
      }
    ]
  }

  self.registration.showNotification(notificationTitle, notificationOptions)
})

// Manejar clic en notificación
self.addEventListener('notificationclick', (event) => {
  console.log('[Firebase SW] Clic en notificación:', event)

  event.notification.close()

  // Abrir la aplicación o enfocar si ya está abierta
  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Si ya hay una ventana abierta, enfocarla
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus()
          }
        }
        // Si no hay ventana abierta, abrir una nueva
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen)
        }
      })
  )
})
