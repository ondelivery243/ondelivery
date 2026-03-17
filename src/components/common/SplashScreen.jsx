// src/components/common/SplashScreen.jsx
import { Box, CircularProgress, Typography } from '@mui/material'
import { TwoWheeler as DeliveryIcon } from '@mui/icons-material'

const SplashScreen = ({ message = 'Cargando...' }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        bgcolor: 'background.default',
        gap: 3,
      }}
    >
      <Box
        component="img"
        src="/logo-192.png"
        alt="ON Delivery"
        sx={{
          width: 80,
          height: 80,
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(255, 107, 53, 0.3)'
        }}
      />
      <Box sx={{ textAlign: 'center' }}>
        <Typography
          variant="h4"
          fontWeight="bold"
          sx={{
            background: 'linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent'
          }}
        >
          ON Delivery
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Maracay, Venezuela
        </Typography>
      </Box>
      <CircularProgress size={32} sx={{ color: 'primary.main' }} />
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Box>
  )
}

export default SplashScreen
