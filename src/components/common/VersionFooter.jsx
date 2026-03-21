// src/components/common/VersionFooter.jsx
// Footer con versión de la app - Componente reutilizable
import { Box, Typography, Chip } from '@mui/material'
import { RIDERY_COLORS } from '../../theme/theme'
import { APP_CONFIG } from '../../config/version'

export default function VersionFooter() {
  const currentYear = new Date().getFullYear()

  return (
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
      <Chip
        label={`v${APP_CONFIG.version}`}
        size="small"
        sx={{
          height: 20,
          fontSize: '0.65rem',
          fontWeight: 'bold',
          bgcolor: 'primary.main',
          color: 'white',
          mb: 1
        }}
      />

      {/* Copyright */}
      <Typography variant="caption" color="text.secondary" display="block">
        © {currentYear} Copyright. Desarrollado por Erick Simosa
      </Typography>
      <Typography variant="caption" color="text.secondary">
        ericksimosa@gmail.com - 0424 3036024
      </Typography>
    </Box>
  )
}