// src/components/common/UpdatePWA.jsx
// Componente para notificar y gestionar actualizaciones de la PWA
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Snackbar,
  Paper,
  Box,
  Typography,
  Button,
  Slide,
  CircularProgress,
  Chip
} from '@mui/material'
import {
  Refresh as RefreshIcon,
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
  
  // Refs para evitar problemas de listeners duplicados
  const updateServiceWorkerRef = useRef(null)
  const timeoutRef = useRef(null)

  // Función para actualizar la PWA
  const updateServiceWorker = useCallback(() => {
    if (updateServiceWorkerRef.current) {
      setUpdating(true)
      
      // Timeout de seguridad: si después de 10 segundos no hay respuesta, recargar
      timeoutRef.current = setTimeout(() => {
        console.log('⏱️ Timeout de actualización, recargando...')
        window.location.reload()
      }, 10000)
      
      // Llamar a la función de actualización registrada por vite-plugin-pwa
      updateServiceWorkerRef.current()
    } else {
      // Fallback: recargar directamente
      window.location.reload()
    }
  }, [])

  // Cerrar notificación
  const handleClose = useCallback(() => {
    setNeedRefresh(false)
    setOfflineReady(false)
    setUpdateComplete(false)
  }, [])

  // Registrar el Service Worker usando vite-plugin-pwa
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Importar dinámicamente el módulo virtual de vite-plugin-pwa
      import('virtual:pwa-register').then(({ registerSW }) => {
        const updateSW = registerSW({
          immediate: true,
          
          onNeedRefresh() {
            console.log('🔄 Nueva versión disponible')
            setNeedRefresh(true)
          },
          
          onOfflineReady() {
            console.log('📡 App lista para uso offline')
            setOfflineReady(true)
            // Auto-ocultar después de 3 segundos
            setTimeout(() => setOfflineReady(false), 3000)
          },
          
          onRegistered(registration) {
            console.log('✅ Service Worker registrado')
            
            // Verificar si ya hay una actualización pendiente
            if (registration?.waiting) {
              setNeedRefresh(true)
            }
          },
          
          onRegisterError(error) {
            console.error('❌ Error registrando SW:', error)
          }
        })
        
        // Guardar la función de actualización
        updateServiceWorkerRef.current = updateSW
      }).catch((error) => {
        console.error('❌ Error importando virtual:pwa-register:', error)
        
        // Fallback: método manual si el virtual module no está disponible
        navigator.serviceWorker.ready.then((reg) => {
          if (reg.waiting) {
            setNeedRefresh(true)
          }
          
          // Escuchar actualizaciones
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setNeedRefresh(true)
                }
              })
            }
          })
        })
      })

      // Escuchar cuando el nuevo SW toma control
      const handleControllerChange = () => {
        console.log('✅ Nuevo Service Worker activado')
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        setUpdateComplete(true)
        setUpdating(false)
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      }
      
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
      
      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
      }
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