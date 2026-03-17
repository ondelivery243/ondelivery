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
  Chip,
  Divider,
  useMediaQuery,
  useTheme,
  alpha
} from '@mui/material'
import {
  Dashboard as DashboardIcon,
  Inventory as PackageIcon,
  History as HistoryIcon,
  AttachMoney as MoneyIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Notifications as NotificationsIcon,
  Menu as MenuIcon,
  Store as StoreIcon,
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon
} from '@mui/icons-material'
import { useSnackbar } from 'notistack'
import { useStore, useThemeStore, useRestaurantStore } from '../../store/useStore'
import { getRestaurantByUserId } from '../../services/firestore'

const DRAWER_WIDTH = 260

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon, path: '/restaurante/dashboard' },
  { id: 'historial', label: 'Historial', icon: HistoryIcon, path: '/restaurante/historial' },
  { id: 'liquidacion', label: 'Liquidación', icon: MoneyIcon, path: '/restaurante/liquidacion' },
  { id: 'perfil', label: 'Mi Perfil', icon: PersonIcon, path: '/restaurante/perfil' },
]

export default function RestauranteLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useTheme()
  const { enqueueSnackbar } = useSnackbar()
  const { user, logout } = useStore()
  const { mode, toggleTheme } = useThemeStore()
  const { restaurantData, setRestaurantData, clearRestaurantData } = useRestaurantStore()

  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Cargar datos del restaurante desde Firestore
  useEffect(() => {
    const loadRestaurantData = async () => {
      if (user?.uid && !restaurantData) {
        const restaurant = await getRestaurantByUserId(user.uid)
        if (restaurant) {
          setRestaurantData(restaurant)
        }
      }
    }
    loadRestaurantData()
  }, [user, restaurantData, setRestaurantData])

  const handleLogout = () => {
    clearRestaurantData()
    logout()
    navigate('/login')
    enqueueSnackbar('Sesión cerrada correctamente', { variant: 'info' })
  }

  const isActive = (path) => location.pathname === path

  const handleDrawerToggle = () => setDrawerOpen(!drawerOpen)

  const handleNavigation = (path) => {
    navigate(path)
    if (isMobile) setDrawerOpen(false)
  }

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.paper' }}>
      {/* Logo Header */}
      <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box
          component="img"
          src="/logo-192.png"
          alt="ON Delivery"
          sx={{
            width: 44,
            height: 44,
            borderRadius: 1.5,
            boxShadow: '0 4px 12px rgba(255, 107, 53, 0.3)'
          }}
        />
        <Box>
          <Typography variant="subtitle1" fontWeight="bold" sx={{
            background: 'linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%)',
            backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent'
          }}>
            ON Delivery
          </Typography>
          <Typography variant="caption" color="text.secondary">Panel de Restaurante</Typography>
        </Box>
      </Box>

      {/* User Info */}
      <Box sx={{ p: 2, bgcolor: alpha(theme.palette.primary.light, 0.1), display: 'flex', alignItems: 'center', gap: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40, borderRadius: 2, border: '2px solid', borderColor: 'primary.light' }}>
          <StoreIcon sx={{ fontSize: 20 }} />
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight="bold" noWrap>{restaurantData?.name || user?.name || 'Mi Restaurante'}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>{user?.email || 'restaurante@ondelivery.com'}</Typography>
        </Box>
      </Box>

      {/* Navigation */}
      <List sx={{ flex: 1, p: 1.5, overflowY: 'auto' }}>
        {menuItems.map((item) => {
          const active = isActive(item.path)
          return (
            <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => handleNavigation(item.path)}
                selected={active}
                sx={{
                  borderRadius: 2, py: 1.25, px: 2,
                  '&.Mui-selected': { bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' }, '& .MuiListItemIcon-root': { color: 'white' } },
                  '&:hover': { bgcolor: active ? 'primary.dark' : alpha(theme.palette.primary.main, 0.08) }
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}><item.icon fontSize="small" /></ListItemIcon>
                <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: active ? 'bold' : 'medium', fontSize: '0.9rem' }} />
              </ListItemButton>
            </ListItem>
          )
        })}
      </List>

      <Divider />

      {/* Theme Toggle & Logout */}
      <Box sx={{ p: 2 }}>
        <ListItemButton
          onClick={toggleTheme}
          sx={{ borderRadius: 2, py: 1.25, px: 2, mb: 1 }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText primary={mode === 'dark' ? 'Modo Claro' : 'Modo Oscuro'} primaryTypographyProps={{ fontWeight: 'medium' }} />
        </ListItemButton>
        <ListItemButton onClick={handleLogout} sx={{ borderRadius: 2, py: 1.25, px: 2, color: 'error.main', '&:hover': { bgcolor: alpha(theme.palette.error.light, 0.1) } }}>
          <ListItemIcon sx={{ minWidth: 40, color: 'error.main' }}><LogoutIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Cerrar Sesión" primaryTypographyProps={{ fontWeight: 'medium' }} />
        </ListItemButton>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Mobile Drawer */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={drawerOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', borderRight: 1, borderColor: 'divider' } }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Desktop Drawer - Always visible */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              borderRight: 1,
              borderColor: 'divider'
            }
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0, width: '100%' }}>
        {/* Top AppBar */}
        <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
          <Toolbar sx={{ gap: 1 }}>
            {isMobile && (
              <IconButton edge="start" onClick={handleDrawerToggle} sx={{ color: 'text.primary' }}>
                <MenuIcon />
              </IconButton>
            )}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold" color="text.primary" noWrap>
                Panel de Restaurante
              </Typography>
              {!isMobile && <Typography variant="body2" color="text.secondary">Gestiona tus servicios de delivery</Typography>}
            </Box>
            <IconButton onClick={toggleTheme} sx={{ color: 'text.primary' }}>
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
            <IconButton sx={{ color: 'text.primary' }}>
              <NotificationsIcon />
            </IconButton>
          </Toolbar>
        </AppBar>

        {/* Page Content */}
        <Box sx={{ flexGrow: 1, p: { xs: 2, sm: 3 }, overflow: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
