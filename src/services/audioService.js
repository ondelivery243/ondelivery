// src/services/audioService.js
// Servicio profesional de audio para notificaciones y sonidos de la aplicación
// Soluciona problemas de AudioContext, autoplay policies del navegador y HMR
// Versión 2.0 - Con soporte para HTML5 Audio como fallback

import { useState, useEffect, useCallback } from 'react'

// ============================================
// ESTADO GLOBAL DEL SERVICIO DE AUDIO
// ============================================
const AudioState = {
  context: null,
  isInitialized: false,
  isUnlocked: false,        // Si el usuario ha interactuado
  lastInteractionTime: 0,
  listeners: new Set(),     // Callbacks para cambios de estado
  audioElements: new Map(), // Caché de elementos de audio HTML5
}

// Configuración de sonidos usando frecuencias
const SOUND_CONFIG = {
  newService: {
    notes: [
      { freq: 880, time: 0, duration: 0.12 },
      { freq: 1100, time: 0.15, duration: 0.12 },
      { freq: 880, time: 0.30, duration: 0.12 },
      { freq: 1320, time: 0.45, duration: 0.15 }
    ],
    type: 'square',
    volume: 0.4
  },
  chatMessage: {
    notes: [
      { freq: 1200, time: 0, duration: 0.15 },
      { freq: 800, time: 0, duration: 0.20 }
    ],
    type: 'sine',
    volume: 0.35
  },
  success: {
    notes: [
      { freq: 523, time: 0, duration: 0.1 },
      { freq: 659, time: 0.1, duration: 0.1 },
      { freq: 784, time: 0.2, duration: 0.15 }
    ],
    type: 'sine',
    volume: 0.3
  },
  warning: {
    notes: [
      { freq: 440, time: 0, duration: 0.2 },
      { freq: 440, time: 0.25, duration: 0.2 }
    ],
    type: 'square',
    volume: 0.35
  }
}

// ============================================
// GESTIÓN DEL AUDIOCONTEXT
// ============================================

/**
 * Obtiene o crea el AudioContext
 * NOTA: Solo funciona después de un gesto de usuario
 */
const getAudioContext = () => {
  if (AudioState.context && AudioState.context.state !== 'closed') {
    return AudioState.context
  }

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    AudioState.context = new AudioContextClass()
    console.log('🔊 [AudioService] AudioContext creado, estado:', AudioState.context.state)
    return AudioState.context
  } catch (error) {
    console.error('❌ [AudioService] Error creando AudioContext:', error)
    return null
  }
}

/**
 * Verifica si el audio está disponible
 */
export const isAudioAvailable = () => {
  return AudioState.isUnlocked && (AudioState.context?.state === 'running' || AudioState.audioElements.size > 0)
}

/**
 * Obtiene el estado actual del audio
 */
export const getAudioStatus = () => ({
  isInitialized: AudioState.isInitialized,
  isUnlocked: AudioState.isUnlocked,
  contextState: AudioState.context?.state || 'unavailable',
  timeSinceInteraction: Date.now() - AudioState.lastInteractionTime
})

/**
 * Suscribe a cambios de estado del audio
 */
export const subscribeToAudioState = (callback) => {
  AudioState.listeners.add(callback)
  return () => AudioState.listeners.delete(callback)
}

/**
 * Notifica a todos los listeners de cambios
 */
const notifyListeners = () => {
  const status = getAudioStatus()
  AudioState.listeners.forEach(cb => {
    try { cb(status) } catch (e) { }
  })
}

// ============================================
// DESBLOQUEO DE AUDIO (CRÍTICO)
// ============================================

/**
 * Desbloquea el audio después de un gesto de usuario
 * Esta es la función CLAVE para que los sonidos funcionen
 */
export const unlockAudio = async () => {
  if (AudioState.isUnlocked && AudioState.context?.state === 'running') {
    console.log('✅ [AudioService] Audio ya desbloqueado')
    return true
  }

  console.log('🔓 [AudioService] Intentando desbloquear audio...')

  try {
    const ctx = getAudioContext()
    
    // Intentar con AudioContext primero
    if (ctx) {
      // Intentar resumir si está suspendido
      if (ctx.state === 'suspended') {
        console.log('🔊 [AudioService] Contexto suspendido, resumiendo...')
        await ctx.resume()
      }

      // Crear un buffer silencioso y reproducirlo
      // Esto "activa" el audio en el navegador
      const buffer = ctx.createBuffer(1, 1, 22050)
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.start(0)

      // Verificar que ahora está corriendo
      if (ctx.state === 'running') {
        AudioState.isUnlocked = true
        AudioState.isInitialized = true
        AudioState.lastInteractionTime = Date.now()
        console.log('✅ [AudioService] Audio DESBLOQUEADO correctamente via AudioContext')
        notifyListeners()
        return true
      }
    }

    // Fallback: Crear un Audio element silencioso y reproducirlo
    console.log('🔊 [AudioService] Intentando fallback con HTML5 Audio...')
    const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA')
    silentAudio.volume = 0.01
    
    const playPromise = silentAudio.play()
    if (playPromise !== undefined) {
      await playPromise
      AudioState.isUnlocked = true
      AudioState.isInitialized = true
      AudioState.lastInteractionTime = Date.now()
      console.log('✅ [AudioService] Audio DESBLOQUEADO correctamente via HTML5 Audio')
      notifyListeners()
      return true
    }

    console.warn('⚠️ [AudioService] No se pudo desbloquear el audio')
    return false
  } catch (error) {
    console.error('❌ [AudioService] Error desbloqueando audio:', error)
    
    // Último intento: crear audio element con datos base64
    try {
      const testAudio = new Audio()
      testAudio.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYNAAAAAAAAAAAAAAAAAAAA//tQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV'
      testAudio.volume = 0.01
      await testAudio.play()
      AudioState.isUnlocked = true
      AudioState.isInitialized = true
      console.log('✅ [AudioService] Audio DESBLOQUEADO via fallback extremo')
      return true
    } catch (e) {
      console.error('❌ [AudioService] Todos los métodos de desbloqueo fallaron')
      return false
    }
  }
}

// ============================================
// REPRODUCCIÓN DE SONIDOS - WEB AUDIO API
// ============================================

/**
 * Reproduce un sonido usando Web Audio API
 */
const playSoundWithWebAudio = async (config) => {
  try {
    const ctx = getAudioContext()
    if (!ctx || ctx.state !== 'running') {
      return false
    }

    const now = ctx.currentTime

    // Reproducir cada nota del sonido
    config.notes.forEach(note => {
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.type = config.type
      oscillator.frequency.setValueAtTime(note.freq, now + note.time)

      gainNode.gain.setValueAtTime(config.volume, now + note.time)
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + note.time + note.duration)

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.start(now + note.time)
      oscillator.stop(now + note.time + note.duration)
    })

    return true
  } catch (error) {
    console.error('❌ [AudioService] Error en Web Audio:', error)
    return false
  }
}

// ============================================
// REPRODUCCIÓN DE SONIDOS - HTML5 AUDIO FALLBACK
// ============================================

/**
 * Genera un sonido usando Oscillator y lo convierte a WAV
 * Simplificado: usa tonos predefinidos
 */
const generateToneDataUrl = (frequency, duration, volume = 0.3) => {
  // Generar WAV simple
  const sampleRate = 22050
  const numSamples = Math.floor(sampleRate * duration)
  const buffer = new ArrayBuffer(44 + numSamples * 2)
  const view = new DataView(buffer)
  
  // WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }
  
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + numSamples * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, numSamples * 2, true)
  
  // Generate sine wave
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate
    const sample = Math.sin(2 * Math.PI * frequency * t) * volume
    const envelope = Math.exp(-t * 3) // Decay
    const value = sample * envelope * 32767
    view.setInt16(44 + i * 2, value, true)
  }
  
  // Convert to base64
  const blob = new Blob([buffer], { type: 'audio/wav' })
  return URL.createObjectURL(blob)
}

/**
 * Reproduce un sonido usando HTML5 Audio como fallback
 */
const playSoundWithHTMLAudio = async (config) => {
  try {
    // Usar la primera nota del sonido
    const mainNote = config.notes[0]
    const audioUrl = generateToneDataUrl(mainNote.freq, mainNote.duration + 0.2, config.volume)
    
    const audio = new Audio(audioUrl)
    audio.volume = config.volume
    
    await audio.play()
    
    // Limpiar URL después de reproducir
    setTimeout(() => URL.revokeObjectURL(audioUrl), 1000)
    
    return true
  } catch (error) {
    console.error('❌ [AudioService] Error en HTML5 Audio:', error)
    return false
  }
}

// ============================================
// REPRODUCCIÓN DE SONIDOS - FUNCIÓN PRINCIPAL
// ============================================

/**
 * Reproduce un sonido usando la configuración predefinida
 * Intenta Web Audio API primero, luego HTML5 Audio como fallback
 */
const playSound = async (soundName) => {
  const config = SOUND_CONFIG[soundName]
  if (!config) {
    console.error(`❌ [AudioService] Sonido no encontrado: ${soundName}`)
    return false
  }

  // Verificar que el audio está desbloqueado
  if (!AudioState.isUnlocked) {
    console.warn('⚠️ [AudioService] Audio no desbloqueado. Intentando desbloquear...')
    const unlocked = await unlockAudio()
    if (!unlocked) {
      console.error('❌ [AudioService] No se pudo desbloquear el audio')
      return false
    }
  }

  // Intentar con Web Audio API primero
  if (AudioState.context?.state === 'running') {
    const success = await playSoundWithWebAudio(config)
    if (success) {
      console.log(`🔊 [AudioService] Sonido "${soundName}" reproducido via Web Audio`)
      return true
    }
  }

  // Fallback a HTML5 Audio
  const success = await playSoundWithHTMLAudio(config)
  if (success) {
    console.log(`🔊 [AudioService] Sonido "${soundName}" reproducido via HTML5 Audio`)
    return true
  }

  console.error(`❌ [AudioService] No se pudo reproducir el sonido "${soundName}"`)
  return false
}

// ============================================
// SONIDOS PÚBLICOS
// ============================================

/**
 * Reproduce el sonido de nuevo servicio
 */
export const playNewServiceSound = () => playSound('newService')

/**
 * Reproduce el sonido de nuevo mensaje de chat
 */
export const playChatMessageSound = () => playSound('chatMessage')

/**
 * Reproduce el sonido de éxito
 */
export const playSuccessSound = () => playSound('success')

/**
 * Reproduce el sonido de advertencia
 */
export const playWarningSound = () => playSound('warning')

// ============================================
// ALERTA CONTINUA (PARA NUEVOS SERVICIOS)
// ============================================
let alertIntervalId = null

/**
 * Inicia la alerta continua de nuevo servicio
 */
export const startServiceAlert = () => {
  if (alertIntervalId) {
    console.log('⚠️ [AudioService] Alerta ya está sonando')
    return
  }

  console.log('🔔 [AudioService] Iniciando alerta continua')

  // Reproducir inmediatamente
  playNewServiceSound()

  // Luego cada 3 segundos
  alertIntervalId = setInterval(() => {
    playNewServiceSound()
  }, 3000)
}

/**
 * Detiene la alerta continua
 */
export const stopServiceAlert = () => {
  if (alertIntervalId) {
    console.log('🔇 [AudioService] Deteniendo alerta continua')
    clearInterval(alertIntervalId)
    alertIntervalId = null
  }
}

/**
 * Verifica si la alerta está sonando
 */
export const isAlertActive = () => alertIntervalId !== null

// ============================================
// INICIALIZACIÓN AUTOMÁTICA
// ============================================

/**
 * Inicializa el servicio de audio
 * Debe llamarse desde el componente raíz de la aplicación
 */
export const initializeAudioService = () => {
  if (AudioState.isInitialized) {
    console.log('🔊 [AudioService] Ya inicializado')
    return
  }

  console.log('🔊 [AudioService] Inicializando servicio de audio...')

  // Crear el contexto (pero estará suspendido hasta que el usuario interactúe)
  getAudioContext()

  // Escuchar el primer gesto del usuario para desbloquear
  const handleUserInteraction = async (event) => {
    console.log(`👆 [AudioService] Interacción detectada: ${event.type}`)

    if (!AudioState.isUnlocked) {
      await unlockAudio()
    }

    // Remover listeners después del primer desbloqueo exitoso
    if (AudioState.isUnlocked) {
      document.removeEventListener('click', handleUserInteraction)
      document.removeEventListener('touchstart', handleUserInteraction)
      document.removeEventListener('touchend', handleUserInteraction)
      document.removeEventListener('keydown', handleUserInteraction)
      console.log('✅ [AudioService] Listeners de interacción removidos')
    }
  }

  // Agregar listeners para el primer gesto
  document.addEventListener('click', handleUserInteraction, { once: false, passive: true })
  document.addEventListener('touchstart', handleUserInteraction, { once: false, passive: true })
  document.addEventListener('touchend', handleUserInteraction, { once: false, passive: true })
  document.addEventListener('keydown', handleUserInteraction, { once: false, passive: true })

  AudioState.isInitialized = true
  notifyListeners()
}

/**
 * Hook para usar el servicio de audio en React
 */
export const useAudioService = () => {
  const [status, setStatus] = useState(getAudioStatus())

  useEffect(() => {
    initializeAudioService()
    const unsubscribe = subscribeToAudioState(setStatus)
    return unsubscribe
  }, [])

  return {
    ...status,
    playNewServiceSound,
    playChatMessageSound,
    playSuccessSound,
    playWarningSound,
    startServiceAlert,
    stopServiceAlert,
    isAlertActive,
    unlockAudio
  }
}

// Exportar todo
export default {
  initializeAudioService,
  unlockAudio,
  isAudioAvailable,
  getAudioStatus,
  subscribeToAudioState,
  playNewServiceSound,
  playChatMessageSound,
  playSuccessSound,
  playWarningSound,
  startServiceAlert,
  stopServiceAlert,
  isAlertActive,
  useAudioService
}
