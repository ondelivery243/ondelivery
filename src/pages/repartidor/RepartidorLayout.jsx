// src/pages/repartidor/RepartidorLayout.jsx
import { useState, useEffect, useRef } from 'react'
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
import { getDriverByUserId, setDriverOnline } from '../../services/firestore'
import { setDriverOffline } from '../../services/locationService'

export default function RepartidorLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { enqueueSnackbar } = useSnackbar()
  const { user, logout } = useStore()
  const { mode, toggleTheme } = useThemeStore()
  const { isOnline, setIsOnline } = useDriverStore()

  const [driverData, setDriverData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [navValue, setNavValue] = useState(0)
  
  const isInitializedRef = useRef(false)

  // Cargar datos del repartidor
  useEffect(() => {
    if (isInitializedRef.current) return
    
    const loadDriverData = async () => {
      if (user?.uid) {
        const driver = await getDriverByUserId(user.uid)
        setDriverData(driver)
        if (driver) {
          setIsOnline(driver.isOnline || false)
        }
        isInitializedRef.current = true
      }
    }
    loadDriverData()
  }, [user, setIsOnline])

  // Determinar tab activo
  useEffect(() => {
    const path = location.pathname
    if (path.includes('/historial')) setNavValue(1)
    else if (path.includes('/perfil')) setNavValue(2)
    else setNavValue(0)
  }, [location.pathname])

  const handleToggleOnline = async () => {
    if (!driverData?.id) {
      enqueueSnackbar('Error: No se encontró tu perfil de repartidor', { variant: 'error' })
      return
    }
    
    setLoading(true)
    const result = await setDriverOnline(driverData.id, !isOnline)
    setLoading(false)
    
    if (result.success) {
      setIsOnline(!isOnline)
      enqueueSnackbar(
        isOnline ? 'Saliste del sistema' : '¡Ahora estás en línea!', 
        { variant: isOnline ? 'info' : 'success' }
      )
    } else {
      enqueueSnackbar('Error al cambiar estado', { variant: 'error' })
    }
  }

  const handleShare = () => {
    const message = `🛵 ON Delivery - Transforma la gestión de tus deliveries

Control. Historial. Liquidaciones. Todo en un solo lugar.

Únete a la nueva era del delivery.

👉 https://on-delivery.netlify.app/`
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
  }

  // ✅ SINCRONIZAR Firestore al cerrar ventana/pestaña
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (isOnline && driverData?.id) {
        console.log('🚪 [Layout] Cerrando ventana - marcando offline en Firestore')
        try {
          await setDriverOnline(driverData.id, false)
          console.log('✅ [Layout] Firestore actualizado a offline')
        } catch (e) {
          console.error('❌ [Layout] Error sincronizando:', e)
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isOnline, driverData?.id])

  // ✅ Logout con sincronización ANTES de cerrar sesión
  const handleLogout = async () => {
    if (isOnline && driverData?.id) {
      try {
        console.log('🚪 [Logout] Marcando driver offline antes de cerrar sesión...')
        await setDriverOnline(driverData.id, false)
        await setDriverOffline(driverData.id)
        console.log('✅ [Logout] Driver marcado offline en ambas bases de datos')
      } catch (e) {
        console.error('❌ [Logout] Error marcando offline:', e)
      }
    }
    
    setIsOnline(false)
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
            <Typography variant="caption" sx={{ color: isOnline ? 'success.main' : 'text.secondary' }}>
              {isOnline ? '🟢 En línea' : '🔴 Fuera de línea'}
            </Typography>
          </Box>
          
          {/* Quick Online Toggle */}
          <Button
            size="small"
            variant={isOnline ? 'contained' : 'outlined'}
            color={isOnline ? 'success' : 'primary'}
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
            {isOnline ? 'Online' : 'Offline'}
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