// src/components/common/VersionFooter.jsx
// Footer con versión de la app - Componente reutilizable
import { useState } from 'react'
import { Box, Typography, Chip, IconButton, Tooltip, Snackbar, Alert } from '@mui/material'
import {
  Refresh as RefreshIcon,
  CheckCircle as CheckIcon,
  NewReleases as NewVersionIcon
} from '@mui/icons-material'
import { RIDERY_COLORS } from '../../theme/theme'
import { APP_CONFIG } from '../../config/version'

export default function VersionFooter() {
  const currentYear = new Date().getFullYear()
  const [checking, setChecking] = useState(false)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' })

  // Verificar si hay actualización pendiente
  const checkForUpdates = async () => {
    if (!('serviceWorker' in navigator)) {
      setSnackbar({ open: true, message: 'Actualizaciones no disponibles en este navegador', severity: 'warning' })
      return
    }

    setChecking(true)

    try {
      const registration = await navigator.serviceWorker.getRegistration()
      
      if (!registration) {
        setSnackbar({ open: true, message: 'No hay Service Worker registrado', severity: 'warning' })
        setChecking(false)
        return
      }

      // Forzar búsqueda de actualizaciones
      await registration.update()

      // Esperar un momento para ver si hay actualización
      setTimeout(() => {
        if (registration.waiting) {
          // Hay una actualización pendiente
          setSnackbar({ 
            open: true, 
            message: '¡Nueva versión disponible! El banner aparecerá en breve.', 
            severity: 'info' 
          })
        } else if (registration.installing) {
          // Se está instalando una actualización
          setSnackbar({ 
            open: true, 
            message: 'Descargando actualización...', 
            severity: 'info' 
          })
        } else {
          // Estamos actualizados
          setSnackbar({ 
            open: true, 
            message: '✅ Estás usando la versión más reciente', 
            severity: 'success' 
          })
        }
        setChecking(false)
      }, 1500)

    } catch (error) {
      console.error('Error buscando actualizaciones:', error)
      setSnackbar({ open: true, message: 'Error al buscar actualizaciones', severity: 'error' })
      setChecking(false)
    }
  }

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false })
  }

  return (
    <>
      <Box sx={{ mt: 2, py: 3, textAlign: 'center' }}>
        {/* Logo y nombre */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
          <Box
            component="img"
            src="/logo-192.png"
            alt="ON Delivery"
            sx={{ width: 28, height: 28, borderRadius: 1 }}
          />
          <Typography
            variant="subtitle2"
            fontWeight="bold"
            sx={{
              background: RIDERY_COLORS.gradientPrimary,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent'
            }}
          >
            ON Delivery
          </Typography>
        </Box>

        {/* Versión de la app */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 1 }}>
          <Chip
            label={`v${APP_CONFIG.version}`}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.65rem',
              fontWeight: 'bold',
              bgcolor: 'primary.main',
              color: 'white'
            }}
          />
          <Tooltip title={checking ? "Buscando..." : "Buscar actualizaciones"}>
            <IconButton
              size="small"
              onClick={checkForUpdates}
              disabled={checking}
              sx={{ ml: 0.5, width: 20, height: 20 }}
            >
              <RefreshIcon 
                sx={{ 
                  fontSize: 14,
                  animation: checking ? 'spin 1s linear infinite' : 'none'
                }} 
              />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Copyright */}
        <Typography variant="caption" color="text.secondary" display="block">
          © {currentYear} Copyright. Desarrollado por Erick Simosa
        </Typography>
        <Typography variant="caption" color="text.secondary">
          ericksimosa@gmail.com - 0424 3036024
        </Typography>
      </Box>

      {/* Snackbar para feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity} 
          sx={{ width: '100%' }}
          icon={snackbar.severity === 'success' ? <CheckIcon /> : <NewVersionIcon />}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* CSS para animación de spin */}
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </>
  )
}