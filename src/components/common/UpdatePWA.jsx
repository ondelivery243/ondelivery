// src/components/common/UpdatePWA.jsx
// Componente minimalista para notificar actualizaciones automáticas
import { useState, useEffect } from 'react'
import { Snackbar, Paper, Typography } from '@mui/material'
import { CheckCircle as CheckIcon } from '@mui/icons-material'
import { APP_CONFIG } from '../../config/version'

export default function UpdatePWA() {
  const [showUpdated, setShowUpdated] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      import('virtual:pwa-register').then(({ registerSW }) => {
        registerSW({
          immediate: true,
          
          onOfflineReady() {
            // Mostrar mensaje solo si es una actualización (versión cambió)
            const lastVersion = localStorage.getItem('sw_version')
            const currentVersion = APP_CONFIG.version
            
            if (lastVersion && lastVersion !== currentVersion) {
              console.log(`🔄 App actualizada: v${lastVersion} → v${currentVersion}`)
              setShowUpdated(true)
              setTimeout(() => setShowUpdated(false), 3000)
            }
            
            localStorage.setItem('sw_version', currentVersion)
          },
          
          onRegistered() {
            console.log(`✅ Service Worker registrado - v${APP_CONFIG.version}`)
            localStorage.setItem('sw_version', APP_CONFIG.version)
          },
          
          onRegisterError(error) {
            console.error('❌ Error registrando SW:', error)
          }
        })
      }).catch(() => {
        // Silenciar error en desarrollo
      })
    }
  }, [])

  if (!showUpdated) return null

  return (
    <Snackbar
      open={showUpdated}
      autoHideDuration={3000}
      onClose={() => setShowUpdated(false)}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ top: { xs: 70, sm: 80 } }}
    >
      <Paper
        elevation={4}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 1.5,
          borderRadius: 2,
          bgcolor: 'success.main',
          color: 'white'
        }}
      >
        <CheckIcon fontSize="small" />
        <Typography variant="body2" fontWeight="medium">
          App actualizada a v{APP_CONFIG.version}
        </Typography>
      </Paper>
    </Snackbar>
  )
}