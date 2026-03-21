// src/components/common/UpdatePWA.jsx
// Componente para notificar y gestionar actualizaciones de la PWA
import { useState, useEffect, useCallback } from 'react'
import {
  Snackbar,
  Paper,
  Box,
  Typography,
  Button,
  IconButton,
  Slide,
  CircularProgress,
  Chip
} from '@mui/material'
import {
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Download as DownloadIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material'
import { RIDERY_COLORS } from '../../theme/theme'
import { APP_CONFIG } from '../../config/version'

// Versión actual de la app (se actualiza con cada release)
const APP_VERSION = APP_CONFIG.version

function SlideTransition(props) {
  return <Slide {...props} direction="down" />
}

export default function UpdatePWA() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [updateComplete, setUpdateComplete] = useState(false)
  const [registration, setRegistration] = useState(null)

  // Función para actualizar la PWA
  const updateServiceWorker = useCallback(async () => {
    if (!registration || !registration.waiting) {
      // Si no hay SW esperando, recargar la página directamente
      window.location.reload()
      return
    }

    setUpdating(true)

    try {
      // Enviar mensaje al SW para que se active
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })

      // Escuchar cuando el nuevo SW tome control
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setUpdateComplete(true)
        setUpdating(false)
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      })
    } catch (error) {
      console.error('Error actualizando SW:', error)
      setUpdating(false)
      // Fallback: recargar la página
      window.location.reload()
    }
  }, [registration])

  // Cerrar notificación
  const handleClose = useCallback(() => {
    setNeedRefresh(false)
    setOfflineReady(false)
    setUpdateComplete(false)
  }, [])

  // Registrar eventos del Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Escuchar cuando el SW está listo para actualizar
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg)

        // Verificar si hay una actualización pendiente
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Hay una nueva versión disponible
                setNeedRefresh(true)
              }
            })
          }
        })

        // Verificar si ya hay un SW esperando (actualización pendiente)
        if (reg.waiting) {
          setNeedRefresh(true)
        }
      })

      // Escuchar mensajes del SW
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SW_UPDATED') {
          setNeedRefresh(true)
        }
      })

      // Eventos de vite-plugin-pwa
      window.addEventListener('sw-ready', () => {
        console.log('✅ Service Worker listo')
      })

      window.addEventListener('sw-registered', (event) => {
        console.log('✅ Service Worker registrado', event.detail)
      })

      window.addEventListener('sw-update-found', () => {
        console.log('🔄 Nueva versión disponible')
        setNeedRefresh(true)
      })

      window.addEventListener('sw-offline-ready', () => {
        console.log('📡 App lista para uso offline')
        setOfflineReady(true)
        // Auto-ocultar después de 3 segundos
        setTimeout(() => setOfflineReady(false), 3000)
      })
    }

    // Guardar versión en localStorage para comparación
    const storedVersion = localStorage.getItem('app_version')
    if (storedVersion !== APP_VERSION) {
      localStorage.setItem('app_version', APP_VERSION)
      console.log(`📱 Versión de la app: ${APP_VERSION}`)
    }
  }, [])

  // No mostrar nada si no hay actualizaciones
  if (!needRefresh && !offlineReady && !updateComplete) {
    return null
  }

  // Banner de actualización completa (antes de recargar)
  if (updateComplete) {
    return (
      <Snackbar
        open={true}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        TransitionComponent={SlideTransition}
        sx={{ top: { xs: 70, sm: 80 } }}
      >
        <Paper
          elevation={4}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            p: 2,
            borderRadius: 3,
            bgcolor: 'success.main',
            color: 'white'
          }}
        >
          <CheckIcon />
          <Typography variant="subtitle2" fontWeight="bold">
            ¡Actualización completada! Recargando...
          </Typography>
        </Paper>
      </Snackbar>
    )
  }

  // Banner de app lista offline
  if (offlineReady && !needRefresh) {
    return (
      <Snackbar
        open={offlineReady}
        onClose={handleClose}
        autoHideDuration={3000}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        TransitionComponent={SlideTransition}
        sx={{ top: { xs: 70, sm: 80 } }}
      >
        <Paper
          elevation={4}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            p: 2,
            borderRadius: 3,
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'success.main'
          }}
        >
          <CheckIcon color="success" />
          <Typography variant="subtitle2">
            App lista para usar sin conexión
          </Typography>
        </Paper>
      </Snackbar>
    )
  }

  // Banner de actualización disponible
  return (
    <Snackbar
      open={needRefresh}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      TransitionComponent={SlideTransition}
      sx={{ top: { xs: 70, sm: 80 } }}
    >
      <Paper
        elevation={4}
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: 'center',
          gap: 2,
          p: 2,
          borderRadius: 3,
          bgcolor: 'background.paper',
          border: 2,
          borderColor: 'primary.main',
          maxWidth: { xs: 'calc(100% - 32px)', sm: 450 }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: 2,
              background: RIDERY_COLORS.gradientPrimary
            }}
          >
            <DownloadIcon sx={{ color: 'white', fontSize: 24 }} />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold">
                Nueva versión disponible
              </Typography>
              <Chip
                label={`v${APP_VERSION}`}
                size="small"
                color="primary"
                sx={{ height: 20, fontSize: '0.65rem' }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              Actualiza para obtener las últimas mejoras
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, width: { xs: '100%', sm: 'auto' } }}>
          <Button
            variant="outlined"
            size="small"
            onClick={handleClose}
            sx={{ flex: { xs: 1, sm: 'none' } }}
          >
            Después
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={updating ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
            onClick={updateServiceWorker}
            disabled={updating}
            sx={{
              flex: { xs: 1, sm: 'none' },
              background: RIDERY_COLORS.gradientPrimary,
              fontWeight: 'bold'
            }}
          >
            {updating ? 'Actualizando...' : 'Actualizar ahora'}
          </Button>
        </Box>
      </Paper>
    </Snackbar>
  )
}

// Exportar versión para uso en otros componentes
export { APP_VERSION }