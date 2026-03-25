// src/config/version.js
// Archivo centralizado para la versión de la aplicación
// Actualizar este archivo con cada release

export const APP_CONFIG = {
  version: '1.1.5',
  buildDate: new Date().toISOString().split('T')[0],
  releaseNotes: [
        "Mejoras y correcciones de errores",
        "Actualización de seguridad",
        "Optimización de rendimiento"
    ]
}

// Función para obtener la versión actual
export const getAppVersion = () => APP_CONFIG.version

// Función para mostrar info de versión en consola
export const logAppInfo = () => {
  console.log('%c🚀 ON Delivery', 'font-size: 24px; font-weight: bold; color: #00C853;')
  console.log(`%cVersión: ${APP_CONFIG.version}`, 'font-size: 12px; color: #888;')
  console.log(`%cBuild: ${APP_CONFIG.buildDate}`, 'font-size: 12px; color: #888;')
}

// Auto-log en desarrollo
if (import.meta.env.DEV) {
  logAppInfo()
}

export default APP_CONFIG
