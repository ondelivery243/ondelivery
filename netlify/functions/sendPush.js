// netlify/functions/sendPush.js
// =====================================================
// Netlify Function: Send Push Notification
// =====================================================
// Envía notificaciones push usando Firebase Cloud Messaging
// a través de Firebase Admin SDK

import admin from 'firebase-admin'

// Inicializar Firebase Admin (solo una vez)
let db = null
let messaging = null

function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    db = admin.firestore()
    messaging = admin.messaging()
    return true
  }

  try {
    // Obtener Service Account desde variable de entorno
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT
    
    if (!serviceAccountJson) {
      console.error('FIREBASE_SERVICE_ACCOUNT no configurado')
      return false
    }

    // Parsear el JSON de Service Account
    const serviceAccount = JSON.parse(serviceAccountJson)

    // Inicializar Firebase Admin
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    })

    db = admin.firestore()
    messaging = admin.messaging()
    return true
  } catch (error) {
    console.error('Error inicializando Firebase Admin:', error.message)
    return false
  }
}

// Headers de seguridad y CORS
const securityHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

export const handler = async (event) => {
  // Manejar preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: securityHeaders,
      body: ''
    }
  }

  // Solo permitir POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: securityHeaders,
      body: JSON.stringify({ error: 'Método no permitido. Use POST.' })
    }
  }

  // Inicializar Firebase Admin
  if (!initializeFirebaseAdmin()) {
    return {
      statusCode: 500,
      headers: securityHeaders,
      body: JSON.stringify({ error: 'Error de configuración del servidor' })
    }
  }

  try {
    // Parsear el body de la petición
    const body = JSON.parse(event.body || '{}')
    const { 
      userId, 
      title, 
      body: messageBody, 
      data = {},
      token: directToken // Opción para enviar directamente a un token
    } = body

    // Validar parámetros requeridos
    if (!title || !messageBody) {
      return {
        statusCode: 400,
        headers: securityHeaders,
        body: JSON.stringify({ error: 'Se requieren title y body' })
      }
    }

    let targetToken = directToken

    // Si no se proporciona token directo, buscar por userId
    if (!targetToken && userId) {
      const tokenDoc = await db.collection('userTokens').doc(userId).get()
      
      if (!tokenDoc.exists) {
        return {
          statusCode: 404,
          headers: securityHeaders,
          body: JSON.stringify({ error: 'Token de usuario no encontrado. El usuario debe autorizar notificaciones.' })
        }
      }

      targetToken = tokenDoc.data().token
    }

    if (!targetToken) {
      return {
        statusCode: 400,
        headers: securityHeaders,
        body: JSON.stringify({ error: 'Se requiere userId o token' })
      }
    }

    // Construir mensaje de notificación
    const message = {
      token: targetToken,
      notification: {
        title: title,
        body: messageBody
      },
      data: {
        // Convertir todos los valores de data a string (requerido por FCM)
        ...Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)])
        ),
        timestamp: String(Date.now())
      },
      webpush: {
        notification: {
          icon: '/logo-192.png',
          badge: '/logo-192.png',
          requireInteraction: true,
          actions: [
            { action: 'open', title: 'Abrir' },
            { action: 'close', title: 'Cerrar' }
          ]
        },
        fcmOptions: {
          link: data.url || '/'
        }
      }
    }

    // Enviar notificación
    const messageId = await messaging.send(message)

    console.log('Notificación enviada exitosamente:', messageId)

    return {
      statusCode: 200,
      headers: securityHeaders,
      body: JSON.stringify({
        success: true,
        messageId: messageId,
        message: 'Notificación enviada exitosamente'
      })
    }

  } catch (error) {
    console.error('Error enviando notificación:', error)

    // Manejar errores específicos de FCM
    let errorMessage = error.message
    let statusCode = 500

    if (error.code === 'messaging/invalid-registration-token') {
      errorMessage = 'Token de registro inválido'
      statusCode = 400
    } else if (error.code === 'messaging/registration-token-not-registered') {
      errorMessage = 'El token no está registrado'
      statusCode = 404
    }

    return {
      statusCode: statusCode,
      headers: securityHeaders,
      body: JSON.stringify({ 
        error: errorMessage,
        code: error.code || 'unknown'
      })
    }
  }
}

// =====================================================
// CÓMO USAR ESTA FUNCIÓN
// =====================================================
// 
// Enviar notificación a un usuario (por userId):
// 
// fetch('/.netlify/functions/sendPush', {
//   method: 'POST',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify({
//     userId: 'abc123',
//     title: '¡Nuevo Servicio!',
//     body: 'Tienes un nuevo pedido disponible',
//     data: { 
//       type: 'NEW_SERVICE',
//       serviceId: 'xyz789' 
//     }
//   })
// })
//
// Enviar notificación a un token específico:
//
// fetch('/.netlify/functions/sendPush', {
//   method: 'POST',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify({
//     token: 'fcm-token-aqui',
//     title: 'Título',
//     body: 'Mensaje',
//     data: { key: 'value' }
//   })
// })
