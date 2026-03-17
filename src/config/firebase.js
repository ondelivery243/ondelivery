// src/config/firebase.js
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getMessaging, isSupported } from 'firebase/messaging'
import { getStorage } from 'firebase/storage'
import { getDatabase } from 'firebase/database'

// Configuración de Firebase desde variables de entorno
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  // URL de Realtime Database (configurar en Firebase Console)
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL
}

// Inicializar Firebase
const app = initializeApp(firebaseConfig)

// Servicios
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const rtdb = getDatabase(app)

// Messaging (solo si es soportado en el navegador)
export const getMessagingInstance = async () => {
  if (await isSupported()) {
    return getMessaging(app)
  }
  return null
}

export default app
