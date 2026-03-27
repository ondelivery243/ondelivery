// src/App.jsx
import { useEffect, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { SnackbarProvider } from 'notistack'
import { Box, CircularProgress } from '@mui/material'

// Store
import { useStore } from './store/useStore'

// Services
import { initializeNotifications, onForegroundMessage, showLocalNotification } from './services/notifications'

// Contexts
import { DriverTrackingProvider } from './contexts/DriverTrackingContext'

// Components
import ErrorBoundary from './components/common/ErrorBoundary'
import SplashScreen from './components/common/SplashScreen'
import InstallPWA from './components/common/InstallPWA'
import UpdatePWA from './components/common/UpdatePWA'

// Pages
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import RegisterRestaurant from './pages/RegisterRestaurant'

// Admin Pages
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/Dashboard'
import AdminRestaurantes from './pages/admin/Restaurantes'
import AdminRepartidores from './pages/admin/Repartidores'
import AdminZonas from './pages/admin/Zonas'
import AdminServicios from './pages/admin/Servicios'
import AdminLiquidaciones from './pages/admin/Liquidaciones'
import AdminReportes from './pages/admin/Reportes'
import AdminHistorial from './pages/admin/Historial'
import AdminConfiguracion from './pages/admin/Configuracion'

// Restaurante Pages
import RestauranteLayout from './pages/restaurante/RestauranteLayout'
import RestauranteDashboard from './pages/restaurante/Dashboard'
import RestauranteHistorial from './pages/restaurante/Historial'
import RestauranteLiquidacion from './pages/restaurante/Liquidacion'
import RestaurantePerfil from './pages/restaurante/Perfil'

// Repartidor Pages
import RepartidorLayout from './pages/repartidor/RepartidorLayout'
import RepartidorDashboard from './pages/repartidor/Dashboard'
import RepartidorHistorial from './pages/repartidor/Historial'
import RepartidorPerfil from './pages/repartidor/Perfil'

// Componente para inicializar notificaciones
const NotificationInitializer = () => {
  const { user } = useStore()
  
  // Refs para evitar inicialización duplicada
  const initializedRef = useRef(false)
  const currentUserIdRef = useRef(null)
  const unsubscribeRef = useRef(null)

  useEffect(() => {
    // Si no hay usuario, limpiar y salir
    if (!user?.uid) {
      initializedRef.current = false
      currentUserIdRef.current = null
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
      return
    }

    // Si ya está inicializado para este usuario, no hacer nada
    if (initializedRef.current && currentUserIdRef.current === user.uid) {
      return
    }

    // Si cambió de usuario, limpiar la suscripción anterior
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }

    // Marcar como inicializado para este usuario
    currentUserIdRef.current = user.uid
    
    console.log('🔔 Inicializando notificaciones para:', user.uid)
    
    initializeNotifications(user.uid).then(result => {
      if (result.success) {
        console.log('✅ Notificaciones configuradas')
        initializedRef.current = true
      } else {
        console.log('⚠️ Notificaciones no configuradas:', result.error || result.reason)
      }
    })

    unsubscribeRef.current = onForegroundMessage((payload) => {
      console.log('📩 Notificación recibida:', payload)
      showLocalNotification(
        payload.notification?.title || 'ON Delivery',
        {
          body: payload.notification?.body || '',
          data: payload.data
        }
      )
    })

    // Cleanup
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
  }, [user?.uid])

  return null
}

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useStore()

  if (loading) {
    return <SplashScreen message="Verificando sesión..." />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const dashboardRoutes = {
      admin: '/admin',
      restaurante: '/restaurante',
      repartidor: '/repartidor'
    }
    return <Navigate to={dashboardRoutes[user.role] || '/login'} replace />
  }

  return children
}

function App() {
  const { loading } = useStore()

  if (loading) {
    return <SplashScreen message="Cargando ON Delivery..." />
  }

  return (
    <ErrorBoundary>
      <SnackbarProvider 
        maxSnack={3} 
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <DriverTrackingProvider>
          <NotificationInitializer />
          <Routes>
            {/* Public */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/registro/repartidor" element={<Register />} />
            <Route path="/registro/restaurante" element={<RegisterRestaurant />} />
            
            {/* Admin */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="restaurantes" element={<AdminRestaurantes />} />
              <Route path="repartidores" element={<AdminRepartidores />} />
              <Route path="zonas" element={<AdminZonas />} />
              <Route path="servicios" element={<AdminServicios />} />
              <Route path="liquidaciones" element={<AdminLiquidaciones />} />
              <Route path="reportes" element={<AdminReportes />} />
              <Route path="historial" element={<AdminHistorial />} />
              <Route path="configuracion" element={<AdminConfiguracion />} />
            </Route>
            
            {/* Restaurante */}
            <Route 
              path="/restaurante" 
              element={
                <ProtectedRoute allowedRoles={['restaurante']}>
                  <RestauranteLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<RestauranteDashboard />} />
              <Route path="historial" element={<RestauranteHistorial />} />
              <Route path="liquidacion" element={<RestauranteLiquidacion />} />
              <Route path="perfil" element={<RestaurantePerfil />} />
            </Route>
            
            {/* Repartidor */}
            <Route 
              path="/repartidor" 
              element={
                <ProtectedRoute allowedRoles={['repartidor']}>
                  <RepartidorLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<RepartidorDashboard />} />
              <Route path="historial" element={<RepartidorHistorial />} />
              <Route path="perfil" element={<RepartidorPerfil />} />
            </Route>
            
            {/* 404 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </DriverTrackingProvider>
        
        <InstallPWA />
        <UpdatePWA />
      </SnackbarProvider>
    </ErrorBoundary>
  )
}

export default App