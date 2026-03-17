// src/services/chatService.js
import { rtdb } from '../config/firebase'
import {
  ref,
  set,
  push,
  onValue,
  off,
  update,
  get,
  serverTimestamp,
  query,
  orderByChild,
  limitToLast
} from 'firebase/database'

// ============================================
// CHAT SERVICE - Tiempo Real con Firebase RTDB
// ============================================

const CHATS_PATH = 'chats'
const CHAT_MESSAGES_PATH = 'messages'

/**
 * Genera un ID único para el chat basado en el servicio
 * Formato: chat_{serviceId}
 */
export const getChatId = (serviceId) => {
  return `chat_${serviceId}`
}

/**
 * Crea o actualiza la metadata del chat
 */
export const createChatRoom = async (serviceId, serviceData, restaurantData, driverData) => {
  try {
    const chatId = getChatId(serviceId)
    const chatRef = ref(rtdb, `${CHATS_PATH}/${chatId}`)
    
    const chatData = {
      serviceId,
      restaurantId: serviceData.restaurantId,
      restaurantName: restaurantData?.name || serviceData.restaurantName,
      driverId: driverData?.id || serviceData.driverId,
      driverName: driverData?.name || serviceData.driverName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastMessage: null,
      lastMessageAt: null,
      unreadByRestaurant: 0,
      unreadByDriver: 0,
      status: 'active' // active, closed
    }
    
    await set(chatRef, chatData)
    return { success: true, chatId }
  } catch (error) {
    console.error('Error creando sala de chat:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Obtiene la información del chat
 */
export const getChatRoom = async (serviceId) => {
  try {
    const chatId = getChatId(serviceId)
    const chatRef = ref(rtdb, `${CHATS_PATH}/${chatId}`)
    const snapshot = await get(chatRef)
    
    if (snapshot.exists()) {
      return { id: chatId, ...snapshot.val() }
    }
    return null
  } catch (error) {
    console.error('Error obteniendo sala de chat:', error)
    return null
  }
}

/**
 * Envía un mensaje en el chat
 * @param {string} serviceId - ID del servicio
 * @param {string} senderId - ID del remitente
 * @param {string} senderName - Nombre del remitente
 * @param {string} senderRole - 'restaurant' o 'driver'
 * @param {string} message - Contenido del mensaje
 * @param {string} type - 'text', 'image', 'location', 'system'
 * @param {object} metadata - Datos adicionales (ubicación, imagen, etc.)
 */
export const sendMessage = async (serviceId, senderId, senderName, senderRole, message, type = 'text', metadata = null) => {
  try {
    const chatId = getChatId(serviceId)
    const messagesRef = ref(rtdb, `${CHATS_PATH}/${chatId}/${CHAT_MESSAGES_PATH}`)
    const chatRef = ref(rtdb, `${CHATS_PATH}/${chatId}`)
    
    // Crear el mensaje
    const newMessage = {
      id: push(messagesRef).key,
      senderId,
      senderName,
      senderRole,
      message,
      type,
      metadata,
      timestamp: Date.now(),
      read: false
    }
    
    // Guardar el mensaje
    await set(ref(rtdb, `${CHATS_PATH}/${chatId}/${CHAT_MESSAGES_PATH}/${newMessage.id}`), newMessage)
    
    // Actualizar último mensaje y contador de no leídos
    const updates = {
      lastMessage: message.substring(0, 100), // Limitar a 100 caracteres
      lastMessageAt: Date.now(),
      lastMessageBy: senderRole,
      updatedAt: Date.now()
    }
    
    // Incrementar contador de no leídos del otro participante
    if (senderRole === 'restaurant') {
      updates.unreadByDriver = (await getUnreadCount(serviceId, 'driver')) + 1
    } else {
      updates.unreadByRestaurant = (await getUnreadCount(serviceId, 'restaurant')) + 1
    }
    
    await update(chatRef, updates)
    
    return { success: true, messageId: newMessage.id }
  } catch (error) {
    console.error('Error enviando mensaje:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Suscribe a los mensajes del chat en tiempo real
 */
export const subscribeToMessages = (serviceId, callback) => {
  const chatId = getChatId(serviceId)
  const messagesRef = query(
    ref(rtdb, `${CHATS_PATH}/${chatId}/${CHAT_MESSAGES_PATH}`),
    orderByChild('timestamp')
  )
  
  const unsubscribe = onValue(messagesRef, (snapshot) => {
    const messages = []
    snapshot.forEach((child) => {
      messages.push({ id: child.key, ...child.val() })
    })
    // Ordenar por timestamp ascendente (más antiguos primero)
    messages.sort((a, b) => a.timestamp - b.timestamp)
    callback(messages)
  }, (error) => {
    console.error('Error en suscripción de mensajes:', error)
    callback([])
  })
  
  return () => off(messagesRef)
}

/**
 * Suscribe a la información del chat (metadata)
 */
export const subscribeToChatRoom = (serviceId, callback) => {
  const chatId = getChatId(serviceId)
  const chatRef = ref(rtdb, `${CHATS_PATH}/${chatId}`)
  
  const unsubscribe = onValue(chatRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({ id: chatId, ...snapshot.val() })
    } else {
      callback(null)
    }
  }, (error) => {
    console.error('Error en suscripción del chat:', error)
    callback(null)
  })
  
  return () => off(chatRef)
}

/**
 * Marca los mensajes como leídos
 */
export const markMessagesAsRead = async (serviceId, readerRole) => {
  try {
    const chatId = getChatId(serviceId)
    const chatRef = ref(rtdb, `${CHATS_PATH}/${chatId}`)
    const messagesRef = ref(rtdb, `${CHATS_PATH}/${chatId}/${CHAT_MESSAGES_PATH}`)
    
    // Obtener todos los mensajes
    const snapshot = await get(messagesRef)
    const updates = {}
    
    snapshot.forEach((child) => {
      const message = child.val()
      // Solo marcar como leídos los mensajes del otro participante
      if (message.senderRole !== readerRole && !message.read) {
        updates[`${child.key}/read`] = true
      }
    })
    
    // Actualizar mensajes
    if (Object.keys(updates).length > 0) {
      await update(messagesRef, updates)
    }
    
    // Resetear contador de no leídos
    const unreadUpdate = readerRole === 'restaurant' 
      ? { unreadByRestaurant: 0 }
      : { unreadByDriver: 0 }
    
    await update(chatRef, unreadUpdate)
    
    return { success: true }
  } catch (error) {
    console.error('Error marcando mensajes como leídos:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Obtiene el contador de mensajes no leídos
 */
export const getUnreadCount = async (serviceId, role) => {
  try {
    const chatId = getChatId(serviceId)
    const chatRef = ref(rtdb, `${CHATS_PATH}/${chatId}`)
    const snapshot = await get(chatRef)
    
    if (snapshot.exists()) {
      const data = snapshot.val()
      return role === 'restaurant' 
        ? (data.unreadByRestaurant || 0)
        : (data.unreadByDriver || 0)
    }
    return 0
  } catch (error) {
    console.error('Error obteniendo contador de no leídos:', error)
    return 0
  }
}

/**
 * Suscribe a todos los chats de un usuario (para lista de conversaciones)
 */
export const subscribeToUserChats = (userId, role, callback) => {
  const chatsRef = ref(rtdb, CHATS_PATH)
  
  const unsubscribe = onValue(chatsRef, (snapshot) => {
    const chats = []
    snapshot.forEach((child) => {
      const chat = { id: child.key, ...child.val() }
      // Filtrar por usuario según su rol
      const isParticipant = role === 'restaurant' 
        ? chat.restaurantId === userId
        : chat.driverId === userId
      
      if (isParticipant && chat.status === 'active') {
        chats.push(chat)
      }
    })
    // Ordenar por último mensaje (más recientes primero)
    chats.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0))
    callback(chats)
  }, (error) => {
    console.error('Error en suscripción de chats:', error)
    callback([])
  })
  
  return () => off(chatsRef)
}

/**
 * Cierra el chat (cuando el servicio se completa o cancela)
 */
export const closeChat = async (serviceId) => {
  try {
    const chatId = getChatId(serviceId)
    const chatRef = ref(rtdb, `${CHATS_PATH}/${chatId}`)
    
    await update(chatRef, {
      status: 'closed',
      closedAt: Date.now()
    })
    
    return { success: true }
  } catch (error) {
    console.error('Error cerrando chat:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Envía un mensaje de sistema (automático)
 */
export const sendSystemMessage = async (serviceId, message) => {
  try {
    const chatId = getChatId(serviceId)
    const messagesRef = ref(rtdb, `${CHATS_PATH}/${chatId}/${CHAT_MESSAGES_PATH}`)
    
    const systemMessage = {
      id: push(messagesRef).key,
      senderId: 'system',
      senderName: 'Sistema',
      senderRole: 'system',
      message,
      type: 'system',
      timestamp: Date.now(),
      read: true
    }
    
    await set(ref(rtdb, `${CHATS_PATH}/${chatId}/${CHAT_MESSAGES_PATH}/${systemMessage.id}`), systemMessage)
    
    // Actualizar último mensaje
    const chatRef = ref(rtdb, `${CHATS_PATH}/${chatId}`)
    await update(chatRef, {
      lastMessage: message,
      lastMessageAt: Date.now(),
      lastMessageBy: 'system',
      updatedAt: Date.now()
    })
    
    return { success: true }
  } catch (error) {
    console.error('Error enviando mensaje de sistema:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Formatea el timestamp para mostrar en el chat
 */
export const formatChatTime = (timestamp) => {
  if (!timestamp) return ''
  
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date
  
  // Si es menos de 24 horas, mostrar hora
  if (diff < 86400000) {
    return date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
  }
  
  // Si es más de 24 horas, mostrar fecha y hora
  return date.toLocaleDateString('es-VE', { 
    day: '2-digit', 
    month: '2-digit',
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

/**
 * Formatea el timestamp para la lista de conversaciones
 */
export const formatLastMessageTime = (timestamp) => {
  if (!timestamp) return ''
  
  const date = new Date(timestamp)
  const now = new Date()
  const diffDays = Math.floor((now - date) / 86400000)
  
  if (diffDays === 0) {
    return date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
  } else if (diffDays === 1) {
    return 'Ayer'
  } else if (diffDays < 7) {
    return date.toLocaleDateString('es-VE', { weekday: 'short' })
  } else {
    return date.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' })
  }
}
