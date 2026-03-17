// src/pages/admin/AdminLayout.jsx
import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  useMediaQuery,
  useTheme,
  alpha
} from '@mui/material'
import {
  Dashboard as DashboardIcon,
  Store as StoreIcon,
  TwoWheeler as BikeIcon,
  LocationOn as LocationIcon,
  Inventory as PackageIcon,
  AttachMoney as MoneyIcon,
  Assessment as ReportIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon
} from '@mui/icons-material'
import { useSnackbar } from 'notistack'
import { useStore } from '../../store/useStore'
import { 
  subscribeToRestaurants, 
  subscribeToDrivers,
  subscribeToServices,
  subscribeToSettlements,
} from '../../services/firestore'

const DRAWER_WIDTH = 280

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useTheme()
  const { enqueueSnackbar } = useSnackbar()
  const { user, logout } = useStore()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [drawerOpen, setDrawerOpen] = useState(false)
  
  // State for dynamic badge counts
  const [badgeCounts, setBadgeCounts] = useState({
    restaurants: 0,
    repartidores: 0,
    services: 0,
    liquidations: 0
  })

  // Subscribe to real-time data for badges
  useEffect(() => {
    const unsubRestaurants = subscribeToRestaurants((data) => {
      const pending = data.filter(r => !r.active).length
      setBadgeCounts(prev => ({ ...prev, restaurants: pending }))
    })
    
    const unsubDrivers = subscribeToDrivers((data) => {
      const pending = data.filter(d => !d.active).length
      setBadgeCounts(prev => ({ ...prev, repartidores: pending }))
    })
    
    const unsubServices = subscribeToServices((data) => {
      const pending = data.filter(s => s.status === 'pendiente').length
      setBadgeCounts(prev => ({ ...prev, services: pending }))
    })
    
    const unsubSettlements = subscribeToSettlements((data) => {
      const pending = data.filter(s => s.status === 'pendiente').length
      setBadgeCounts(prev => ({ ...prev, liquidations: pending }))
    })
    
    return () => {
      unsubRestaurants()
      unsubDrivers()
      unsubServices()
      unsubSettlements()
    }
  }, [user])
  
  const handleLogout = () => {
    logout()
    navigate('/login')
    enqueueSnackbar('Sesión cerrada correctamente', { variant: 'info' })
  }
  
  const handleDrawerToggle = () => setDrawerOpen(!drawerOpen)
  
  const handleNavigation = (path) => {
    navigate(path)
    if (isMobile) setDrawerOpen(false)
  }
  
  const isActive = (path) => {
    return location.pathname === path
  }
  
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon, path: '/admin/dashboard' },
    { 
      id: 'restaurantes', 
      label: 'Restaurantes', 
      icon: StoreIcon, 
      path: '/admin/restaurantes',
      badge: badgeCounts.restaurants
    },
    { 
      id: 'repartidores', 
      label: 'Repartidores', 
      icon: BikeIcon, 
      path: '/admin/repartidores',
      badge: badgeCounts.repartidores
    },
    { 
      id: 'zonas', 
      label: 'Zonas', 
      icon: LocationIcon, 
      path: '/admin/zonas' 
    },
    { 
      id: 'servicios', 
      label: 'Servicios', 
      icon: PackageIcon, 
      path: '/admin/servicios',
      badge: badgeCounts.services
    },
    { 
      id: 'liquidaciones', 
      label: 'Liquidaciones', 
      icon: MoneyIcon, 
      path: '/admin/liquidaciones',
      badge: badgeCounts.liquidations
    },
    { 
      id: 'reportes', 
      label: 'Reportes', 
      icon: ReportIcon, 
      path: '/admin/reportes' 
    },
    { 
      id: 'configuracion', 
      label: 'Configuración', 
      icon: SettingsIcon, 
      path: '/admin/configuracion' 
    }
  ]

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo Header */}
      <Box sx={{ 
        p: 2.5, 
        display: 'flex', 
        alignItems: 'center', 
        gap: 2, 
        borderBottom: 1, 
        borderColor: 'divider' 
      }}>
        <Box
          component="img"
          src="/logo-192.png"
          alt="ON Delivery"
          sx={{
            width: 48,
            height: 48,
            borderRadius: 1.5,
            boxShadow: '0 4px 12px rgba(255, 107, 53, 0.3)'
          }}
        />
        <Box>
          <Typography variant="h6" fontWeight="bold" sx={{
            background: 'linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent'
          }}>
            ON Delivery
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Panel de Administración
          </Typography>
        </Box>
      </Box>
      
      {/* Navigation */}
      <List sx={{ flex: 1, p: 1.5, overflowY: 'auto' }}>
        {menuItems.map((item) => (
          <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => handleNavigation(item.path)}
              selected={isActive(item.path)}
              sx={{
                borderRadius: 2,
                py: 1.5,
                px: 2,
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'white',
                  '&:hover': { bgcolor: 'primary.dark' },
                  '& .MuiListItemIcon-root': { color: 'white' }
                }
              }}
            >
              <ListItemIcon sx={{ 
                color: isActive(item.path) ? 'white' : alpha(theme.palette.primary.main, 0.7),
                minWidth: 40
              }}>
                <item.icon />
              </ListItemIcon>
              
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontWeight: 500 }}
              />
              
              {item.badge > 0 && (
                <Box
                  sx={{
                    minWidth: 24,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 1.5,
                    bgcolor: isActive(item.path) ? 'rgba(255,255,255,0.2)' : 'primary.main',
                    color: 'white',
                    px: 1
                  }}
                >
                  <Typography variant="caption" fontWeight="bold">
                    {item.badge}
                  </Typography>
                </Box>
              )}
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      
      <Divider />
      
      {/* User & Logout */}
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
            {user?.name?.charAt(0) || 'A'}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight="bold" noWrap>
              {user?.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {user?.email}
            </Typography>
          </Box>
        </Box>
        
        <ListItemButton 
          onClick={handleLogout} 
          sx={{ 
            borderRadius: 2, 
            color: 'error.main',
            '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.1) }
          }}
        >
          <ListItemIcon sx={{ color: 'error.main', minWidth: 40 }}>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText primary="Cerrar sesión" />
        </ListItemButton>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'grey.50' }}>
      {/* Mobile Drawer */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={drawerOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': { 
              width: DRAWER_WIDTH, 
              boxSizing: 'border-box',
              borderRight: 1, 
              borderColor: 'divider' 
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}
      
      {/* Desktop Sidebar */}
      {!isMobile && (
        <Box
          component="nav"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            borderRight: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            height: '100vh',
            position: 'sticky',
            top: 0
          }}
        >
          {drawerContent}
        </Box>
      )}
      
      {/* Main Content */}
      <Box sx={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        minHeight: '100vh',
        minWidth: 0, // Importante para evitar overflow
        width: '100%'
      }}>
        {/* Top AppBar */}
        <AppBar 
          position="sticky" 
          elevation={0} 
          sx={{ 
            bgcolor: 'background.paper', 
            borderBottom: 1, 
            borderColor: 'divider' 
          }}
        >
          <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
            {isMobile && (
              <IconButton 
                edge="start" 
                onClick={handleDrawerToggle} 
                sx={{ color: 'text.primary', mr: 1 }}
              >
                <MenuIcon />
              </IconButton>
            )}
            
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              {isMobile && (
                <>
                  <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32, fontSize: '0.9rem' }}>
                    {user?.name?.charAt(0) || 'A'}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" fontWeight="bold" color="text.primary" noWrap>
                      Panel Admin
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }} noWrap>
                      {user?.email}
                    </Typography>
                  </Box>
                </>
              )}
              {!isMobile && (
                <Typography variant="h6" color="text.primary">
                  {menuItems.find(item => isActive(item.path))?.label || 'Dashboard'}
                </Typography>
              )}
            </Box>
          </Toolbar>
        </AppBar>
        
        {/* Page Content */}
        <Box 
          component="main" 
          sx={{ 
            flex: 1, 
            p: { xs: 1.5, sm: 3 },
            bgcolor: 'grey.50',
            minWidth: 0,
            width: '100%',
            overflow: 'hidden'
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}