// src/services/auth.js
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore'
import { auth, db } from '../config/firebase'

// Roles disponibles
export const ROLES = {
  ADMIN: 'admin',
  RESTAURANTE: 'restaurante',
  REPARTIDOR: 'repartidor'
}

// Registrar nuevo usuario (genérico)
export const registerUser = async (email, password, userData) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    const user = userCredential.user

    // Crear documento del usuario en Firestore
    await setDoc(doc(db, 'users', user.uid), {
      email,
      ...userData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      active: false // Pendiente de activación por defecto
    })

    // Actualizar displayName si se proporciona
    if (userData.name) {
      await updateProfile(user, { displayName: userData.name })
    }

    return { success: true, user, uid: user.uid }
  } catch (error) {
    console.error('Error registrando usuario:', error)
    return { success: false, error: error.message }
  }
}

// ============================================
// REGISTRO DE RESTAURANTE (auto-registro)
// ============================================
export const registerRestaurant = async (email, password, restaurantData) => {
  try {
    // 1. Crear usuario en Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    const user = userCredential.user

    // 2. Crear documento en 'users' con rol restaurante (pendiente de activación)
    await setDoc(doc(db, 'users', user.uid), {
      email,
      name: restaurantData.name,
      phone: restaurantData.phone || '',
      role: 'restaurante',
      active: false, // Pendiente de activación por el admin
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    // 3. Crear documento en 'restaurants' con el userId vinculado
    const restaurantDoc = await addDoc(collection(db, 'restaurants'), {
      userId: user.uid,
      name: restaurantData.name,
      email: email,
      phone: restaurantData.phone || '',
      address: restaurantData.address || '',
      contactName: restaurantData.contactName || '',
      category: restaurantData.category || 'General',
      description: restaurantData.description || '',
      active: false, // Pendiente de activación
      commission: 15, // Comisión por defecto
      totalServices: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    // 4. Actualizar el documento de usuario con el restaurantId
    await setDoc(doc(db, 'users', user.uid), {
      restaurantId: restaurantDoc.id
    }, { merge: true })

    // Actualizar displayName
    await updateProfile(user, { displayName: restaurantData.name })

    // Cerrar sesión después del registro (debe esperar activación)
    await signOut(auth)

    return { 
      success: true, 
      uid: user.uid,
      restaurantId: restaurantDoc.id,
      message: 'Registro exitoso. Un administrador debe activar tu cuenta.'
    }
  } catch (error) {
    console.error('Error registrando restaurante:', error)
    
    let errorMessage = error.message
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'Este correo ya está registrado'
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'La contraseña debe tener al menos 6 caracteres'
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'El correo electrónico no es válido'
    }
    
    return { success: false, error: errorMessage }
  }
}

// ============================================
// REGISTRO DE REPARTIDOR (auto-registro)
// ============================================
export const registerDriver = async (email, password, driverData) => {
  try {
    // 1. Crear usuario en Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    const user = userCredential.user

    // 2. Crear documento en 'users' con rol repartidor (pendiente de activación)
    await setDoc(doc(db, 'users', user.uid), {
      email,
      name: driverData.name,
      phone: driverData.phone,
      role: 'repartidor',
      active: false, // Pendiente de activación por el admin
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    // 3. Crear documento en 'drivers' con el userId vinculado
    const driverDoc = await addDoc(collection(db, 'drivers'), {
      userId: user.uid,
      name: driverData.name,
      email: email,
      phone: driverData.phone,
      dni: driverData.dni || '',
      vehicleType: driverData.vehicleType || 'motocicleta',
      vehicleBrand: driverData.vehicleBrand || '',
      vehicleModel: driverData.vehicleModel || '',
      vehiclePlate: driverData.vehiclePlate || '',
      active: false, // Pendiente de activación
      isOnline: false,
      totalServices: 0,
      totalEarnings: 0,
      rating: 5.0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    // 4. Actualizar el documento de usuario con el driverId
    await setDoc(doc(db, 'users', user.uid), {
      driverId: driverDoc.id
    }, { merge: true })

    // Actualizar displayName
    await updateProfile(user, { displayName: driverData.name })

    // Cerrar sesión después del registro (debe esperar activación)
    await signOut(auth)

    return { 
      success: true, 
      uid: user.uid,
      driverId: driverDoc.id,
      message: 'Registro exitoso. Un administrador debe activar tu cuenta.'
    }
  } catch (error) {
    console.error('Error registrando repartidor:', error)
    
    // Mensajes de error más amigables
    let errorMessage = error.message
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'Este correo ya está registrado'
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'La contraseña debe tener al menos 6 caracteres'
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'El correo electrónico no es válido'
    }
    
    return { success: false, error: errorMessage }
  }
}

// ============================================
// INICIAR SESIÓN
// ============================================
export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    const user = userCredential.user

    // Obtener datos adicionales del usuario
    const userDoc = await getDoc(doc(db, 'users', user.uid))
    
    if (!userDoc.exists()) {
      await signOut(auth)
      return { success: false, error: 'Usuario no encontrado en la base de datos' }
    }

    const userData = userDoc.data()

    if (!userData.active) {
      await signOut(auth)
      return { success: false, error: 'Tu cuenta está pendiente de activación. Un administrador debe aprobar tu registro.' }
    }

    // Actualizar último acceso
    await setDoc(doc(db, 'users', user.uid), {
      lastLogin: serverTimestamp()
    }, { merge: true })

    return { 
      success: true, 
      user: {
        uid: user.uid,
        email: user.email,
        ...userData
      }
    }
  } catch (error) {
    console.error('Error iniciando sesión:', error)
    
    // Mensajes de error más amigables
    let errorMessage = 'Error al iniciar sesión'
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'Usuario no encontrado'
    } else if (error.code === 'auth/wrong-password') {
      errorMessage = 'Contraseña incorrecta'
    } else if (error.code === 'auth/invalid-credential') {
      errorMessage = 'Credenciales inválidas'
    }
    
    return { success: false, error: errorMessage }
  }
}

// ============================================
// CERRAR SESIÓN
// ============================================
export const logoutUser = async () => {
  try {
    await signOut(auth)
    return { success: true }
  } catch (error) {
    console.error('Error cerrando sesión:', error)
    return { success: false, error: error.message }
  }
}

// ============================================
// RECUPERAR CONTRASEÑA
// ============================================
export const resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email)
    return { success: true }
  } catch (error) {
    console.error('Error enviando email de recuperación:', error)
    
    let errorMessage = 'Error al enviar el email'
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'No existe una cuenta con este correo'
    }
    
    return { success: false, error: errorMessage }
  }
}

// ============================================
// OBSERVADOR DE AUTENTICACIÓN
// ============================================
export const subscribeToAuthChanges = (callback) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      if (userDoc.exists()) {
        callback({
          uid: user.uid,
          email: user.email,
          ...userDoc.data()
        })
      } else {
        callback(null)
      }
    } else {
      callback(null)
    }
  })
}

// ============================================
// OBTENER USUARIO ACTUAL
// ============================================
export const getCurrentUser = async () => {
  const user = auth.currentUser
  if (!user) return null

  const userDoc = await getDoc(doc(db, 'users', user.uid))
  if (!userDoc.exists()) return null

  return {
    uid: user.uid,
    email: user.email,
    ...userDoc.data()
  }
}
