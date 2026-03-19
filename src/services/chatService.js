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
  serverTimestamp
} from 'firebase/database'

// ============================================
// CHAT SERVICE - Tiempo Real con Firebase RTDB
// ============================================

const CHATS_PATH = 'chats'
const CHAT_MESSAGES_PATH = 'messages'

/**
 * Genera un ID único para el chat basado en el servicio
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
      restaurantId: serviceData?.restaurantId,
      restaurantName: restaurantData?.name || serviceData?.restaurantName || 'Restaurante',
      driverId: driverData?.id || serviceData?.driverId,
      driverName: driverData?.name || serviceData?.driverName || 'Repartidor',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastMessage: null,
      lastMessageAt: null,
      unreadByRestaurant: 0,
      unreadByDriver: 0,
      status: 'active'
    }
    
    await set(chatRef, chatData)
    console.log('✅ Chat room creado:', chatId)
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
      console.log('✅ Chat room encontrado:', chatId)
      return { id: chatId, ...snapshot.val() }
    }
    console.log('📭 Chat room no existe:', chatId)
    return null
  } catch (error) {
    console.error('Error obteniendo sala de chat:', error)
    return null
  }
}

/**
 * Envía un mensaje en el chat
 */
export const sendMessage = async (serviceId, senderId, senderName, senderRole, message, type = 'text', metadata = null) => {
  try {
    const chatId = getChatId(serviceId)
    const messagesRef = ref(rtdb, `${CHATS_PATH}/${chatId}/${CHAT_MESSAGES_PATH}`)
    const chatRef = ref(rtdb, `${CHATS_PATH}/${chatId}`)
    
    // Crear el mensaje
    const newMessageRef = push(messagesRef)
    const newMessage = {
      id: newMessageRef.key,
      senderId,
      senderName: senderName || 'Usuario',
      senderRole,
      message,
      type,
      metadata,
      timestamp: Date.now(),
      read: false
    }
    
    // Guardar el mensaje
    await set(newMessageRef, newMessage)
    console.log('✅ Mensaje guardado:', newMessage.id)
    
    // Actualizar último mensaje y contador de no leídos
    const currentRoom = await getChatRoom(serviceId)
    const updates = {
      lastMessage: message.substring(0, 100),
      lastMessageAt: Date.now(),
      lastMessageBy: senderRole,
      updatedAt: Date.now()
    }
    
    // Incrementar contador de no leídos del otro participante
    if (senderRole === 'restaurant') {
      updates.unreadByDriver = (currentRoom?.unreadByDriver || 0) + 1
    } else {
      updates.unreadByRestaurant = (currentRoom?.unreadByRestaurant || 0) + 1
    }
    
    await update(chatRef, updates)
    console.log('✅ Chat actualizado')
    
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
  const messagesRef = ref(rtdb, `${CHATS_PATH}/${chatId}/${CHAT_MESSAGES_PATH}`)
  
  console.log('🔔 Suscribiendo a mensajes:', chatId)
  
  const unsubscribe = onValue(messagesRef, (snapshot) => {
    const messages = []
    snapshot.forEach((child) => {
      messages.push({ id: child.key, ...child.val() })
    })
    // Ordenar por timestamp ascendente
    messages.sort((a, b) => a.timestamp - b.timestamp)
    callback(messages)
  }, (error) => {
    console.error('Error en suscripción de mensajes:', error)
    callback([])
  })
  
  return () => {
    console.log('🚫 Desuscribiendo de mensajes:', chatId)
    off(messagesRef)
  }
}

/**
 * Suscribe a la información del chat (metadata)
 */
export const subscribeToChatRoom = (serviceId, callback) => {
  const chatId = getChatId(serviceId)
  const chatRef = ref(rtdb, `${CHATS_PATH}/${chatId}`)
  
  console.log('🔔 Suscribiendo a chat room:', chatId)
  
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
  
  return () => {
    console.log('🚫 Desuscribiendo de chat room:', chatId)
    off(chatRef)
  }
}

/**
 * Marca los mensajes como leídos
 * Actualiza tanto el contador como el campo 'read' de cada mensaje
 */
export const markMessagesAsRead = async (serviceId, readerRole) => {
  try {
    const chatId = getChatId(serviceId)
    const chatRef = ref(rtdb, `${CHATS_PATH}/${chatId}`)
    const messagesRef = ref(rtdb, `${CHATS_PATH}/${chatId}/${CHAT_MESSAGES_PATH}`)
    
    // 1. Obtener todos los mensajes
    const messagesSnapshot = await get(messagesRef)
    
    if (messagesSnapshot.exists()) {
      const updates = {}
      const senderRole = readerRole === 'restaurant' ? 'driver' : 'restaurant'
      
      // 2. Marcar como leídos solo los mensajes del OTRO participante
      messagesSnapshot.forEach((child) => {
        const msgData = child.val()
        // Solo marcar mensajes que NO son del lector actual y que no han sido leídos
        if (msgData.senderRole === senderRole && msgData.read === false) {
          updates[`${child.key}/read`] = true
        }
      })
      
      // 3. Actualizar mensajes si hay cambios
      if (Object.keys(updates).length > 0) {
        await update(messagesRef, updates)
        console.log(`✅ ${Object.keys(updates).length} mensajes marcados como leídos`)
      }
    }
    
    // 4. Resetear contador de no leídos
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
 * Suscribe a todos los chats de un usuario
 */
export const subscribeToUserChats = (userId, role, callback) => {
  const chatsRef = ref(rtdb, CHATS_PATH)
  
  const unsubscribe = onValue(chatsRef, (snapshot) => {
    const chats = []
    snapshot.forEach((child) => {
      const chat = { id: child.key, ...child.val() }
      const isParticipant = role === 'restaurant' 
        ? chat.restaurantId === userId
        : chat.driverId === userId
      
      if (isParticipant && chat.status === 'active') {
        chats.push(chat)
      }
    })
    chats.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0))
    callback(chats)
  }, (error) => {
    console.error('Error en suscripción de chats:', error)
    callback([])
  })
  
  return () => off(chatsRef)
}

/**
 * Cierra el chat
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
 * Envía un mensaje de sistema
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
  
  if (diff < 86400000) {
    return date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
  }
  
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