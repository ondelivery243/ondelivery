// src/pages/repartidor/RepartidorLayout.jsx
import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Card,
  CardContent,
  Button,
  Grid,
  BottomNavigation,
  BottomNavigationAction,
  Chip,
  Paper,
  useTheme,
  useMediaQuery,
  alpha,
  LinearProgress
} from '@mui/material'
import {
  Dashboard as DashboardIcon,
  Inventory as PackageIcon,
  History as HistoryIcon,
  Person as PersonIcon,
  Logout as LogoutIcon,
  Share as ShareIcon,
  PowerSettingsNew as PowerIcon,
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon
} from '@mui/icons-material'
import { useSnackbar } from 'notistack'
import { useStore, useThemeStore, useDriverStore } from '../../store/useStore'
import { getDriverByUserId } from '../../services/firestore'
import { useDriverTracking } from '../../contexts/DriverTrackingContext'

export default function RepartidorLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { enqueueSnackbar } = useSnackbar()
  const { user, logout } = useStore()
  const { mode, toggleTheme } = useThemeStore()
  const { setIsOnline } = useDriverStore()

  const [driverData, setDriverData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [navValue, setNavValue] = useState(0)

  // Hook de tracking GPS (desde contexto global)
  const {
    isOnline: contextIsOnline,
    goOnline,
    goOffline
  } = useDriverTracking()

  // Sincronizar estado del contexto con el store local
  useEffect(() => {
    setIsOnline(contextIsOnline)
  }, [contextIsOnline, setIsOnline])

  // Cargar datos del repartidor
  useEffect(() => {
    const loadDriverData = async () => {
      if (user?.uid) {
        const driver = await getDriverByUserId(user.uid)
        setDriverData(driver)
      }
    }
    loadDriverData()
  }, [user])

  // Determinar tab activo
  useEffect(() => {
    const path = location.pathname
    if (path.includes('/historial')) setNavValue(1)
    else if (path.includes('/perfil')) setNavValue(2)
    else setNavValue(0)
  }, [location.pathname])

  // Toggle online/offline - USA EL CONTEXTO
  const handleToggleOnline = async () => {
    if (!driverData?.id) {
      enqueueSnackbar('Error: No se encontró tu perfil de repartidor', { variant: 'error' })
      return
    }
    
    setLoading(true)
    
    try {
      if (!contextIsOnline) {
        const success = await goOnline()
        if (success) {
          enqueueSnackbar('¡Ahora estás en línea!', { variant: 'success' })
        }
      } else {
        const success = await goOffline()
        if (success) {
          enqueueSnackbar('Saliste del sistema', { variant: 'info' })
        }
      }
    } catch (error) {
      console.error('Error:', error)
      enqueueSnackbar('Error al cambiar estado', { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // Función para compartir por WhatsApp
  const handleShare = () => {
    const message = `🛵 ON Delivery - Transforma la gestión de tus deliveries

Control. Historial. Liquidaciones. Todo en un solo lugar.

Únete a la nueva era del delivery.

👉 https://on-delivery.netlify.app/`
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
    enqueueSnackbar('Sesión cerrada', { variant: 'info' })
  }

  const getNavIcon = (index) => {
    const icons = [<DashboardIcon />, <HistoryIcon />, <PersonIcon />]
    return icons[index]
  }

  const getNavLabel = (index) => {
    const labels = ['Inicio', 'Historial', 'Perfil']
    return labels[index]
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: 'background.default',
      pb: 10
    }}>
      {loading && <LinearProgress sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }} />}
      
      {/* Header */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}
      >
        <Toolbar sx={{ py: 0.5 }}>
          <Box
            component="img"
            src="/logo-192.png"
            alt="ON Delivery"
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1.5,
              mr: 1.5,
              boxShadow: '0 2px 8px rgba(255, 107, 53, 0.3)'
            }}
          />
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" fontWeight="bold" color="text.primary">
              ON Delivery
            </Typography>
            <Typography variant="caption" sx={{ color: contextIsOnline ? 'success.main' : 'text.secondary' }}>
              {contextIsOnline ? '🟢 En línea' : '🔴 Fuera de línea'}
            </Typography>
          </Box>
          
          {/* Quick Online Toggle */}
          <Button
            size="small"
            variant={contextIsOnline ? 'contained' : 'outlined'}
            color={contextIsOnline ? 'success' : 'primary'}
            onClick={handleToggleOnline}
            disabled={loading}
            startIcon={<PowerIcon sx={{ fontSize: 16 }} />}
            sx={{ 
              mr: 1,
              display: { xs: 'none', sm: 'flex' },
              minWidth: 'auto',
              px: 1.5
            }}
          >
            {contextIsOnline ? 'Online' : 'Offline'}
          </Button>
          
          <IconButton onClick={toggleTheme} sx={{ color: 'text.primary' }} size="small">
            {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </IconButton>
          <IconButton onClick={handleShare} sx={{ color: 'text.primary' }} size="small">
            <ShareIcon fontSize="small" />
          </IconButton>
          <IconButton sx={{ color: 'text.primary' }} onClick={handleLogout} size="small">
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Page Content */}
      <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Outlet />
      </Box>

      {/* Bottom Navigation */}
      <Paper
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          zIndex: 1000
        }}
      >
        <BottomNavigation
          value={navValue}
          onChange={(_, newValue) => {
            setNavValue(newValue)
            const routes = ['/repartidor/dashboard', '/repartidor/historial', '/repartidor/perfil']
            navigate(routes[newValue] || '/repartidor/dashboard')
          }}
          sx={{ bgcolor: 'transparent' }}
        >
          {[0, 1, 2].map((index) => (
            <BottomNavigationAction
              key={index}
              icon={getNavIcon(index)}
              label={getNavLabel(index)}
              sx={{ 
                color: 'text.secondary', 
                '&.Mui-selected': { color: 'primary.main' } 
              }}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  )
}