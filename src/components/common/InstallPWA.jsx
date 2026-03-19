// src/components/common/InstallPWA.jsx
import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Snackbar,
  Typography,
  IconButton,
  Slide,
  Paper
} from '@mui/material'
import {
  InstallMobile as InstallIcon,
  Close as CloseIcon,
  Android as AndroidIcon,
  Apple as IosIcon
} from '@mui/icons-material'

// Detectar si es iOS
const isIos = () => {
  const userAgent = window.navigator.userAgent.toLowerCase()
  return /iphone|ipad|ipod/.test(userAgent)
}

// Detectar si ya está instalado
const isInstalled = () => {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true
}

function SlideTransition(props) {
  return <Slide {...props} direction="up" />
}

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [showIosInstructions, setShowIosInstructions] = useState(false)

  useEffect(() => {
    // Si ya está instalado, no mostrar nada
    if (isInstalled()) return

    // Android/Desktop: escuchar el evento beforeinstallprompt
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      // Mostrar después de 5 segundos para no interrumpir
      setTimeout(() => setShowPrompt(true), 5000)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // iOS: mostrar instrucciones después de un tiempo
    if (isIos() && !isInstalled()) {
      setTimeout(() => setShowIosInstructions(true), 10000)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      console.log('PWA instalada correctamente')
    }

    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  const handleClose = () => {
    setShowPrompt(false)
    setShowIosInstructions(false)
  }

  // Android/Desktop prompt - Simplificado
  if (showPrompt && deferredPrompt) {
    return (
      <Snackbar
        open={showPrompt}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: { xs: 80, sm: 24 } }}
        TransitionComponent={SlideTransition}
      >
        <Paper
          elevation={3}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            p: 2,
            borderRadius: 3,
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'primary.light'
          }}
        >
          <Box
            component="img"
            src="/logo-192.png"
            alt="ON Delivery"
            sx={{ width: 48, height: 48, borderRadius: 2 }}
          />
          <Typography variant="subtitle2" fontWeight="bold">
            Instalar ON Delivery
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<InstallIcon />}
            onClick={handleInstall}
          >
            Instalar
          </Button>
          <IconButton size="small" onClick={handleClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Paper>
      </Snackbar>
    )
  }

  // iOS instructions - Simplificado
  if (showIosInstructions && isIos()) {
    return (
      <Snackbar
        open={showIosInstructions}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: { xs: 80, sm: 24 } }}
        TransitionComponent={SlideTransition}
      >
        <Paper
          elevation={3}
          sx={{
            p: 2,
            borderRadius: 3,
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'primary.light',
            maxWidth: 320
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <IosIcon color="primary" />
            <Typography variant="subtitle2" fontWeight="bold">
              Instalar ON Delivery
            </Typography>
            <IconButton size="small" onClick={handleClose} sx={{ ml: 'auto' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="body2" color="text.secondary">1.</Typography>
            <Typography variant="body2">Toca el botón</Typography>
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                bgcolor: 'grey.100',
                borderRadius: 1,
                fontSize: 14
              }}
            >
              ⬆️
            </Box>
            <Typography variant="body2">Compartir</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">2.</Typography>
            <Typography variant="body2">Selecciona "Agregar a pantalla de inicio"</Typography>
          </Box>
        </Paper>
      </Snackbar>
    )
  }

  return null
}