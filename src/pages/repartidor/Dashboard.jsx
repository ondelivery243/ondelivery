// src/pages/repartidor/Dashboard.jsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  Grid,
  Chip,
  Stack,
  Paper,
  Avatar,
  IconButton,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  useMediaQuery,
  alpha,
  Collapse,
  Tooltip,
  CircularProgress,
  Alert,
  Fade,
  Skeleton
} from '@mui/material'
import {
  PowerSettingsNew as PowerIcon,
  LocationOn as LocationIcon,
  Store as StoreIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  AttachMoney as MoneyIcon,
  TwoWheeler as BikeIcon,
  Star as StarIcon,
  Navigation as NavigationIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  AccessTime as ClockIcon,
  Refresh as RefreshIcon,
  GpsFixed as GpsIcon,
  GpsOff as GpsOffIcon,
  Map as MapIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Chat as ChatIcon,
  MyLocation as MyLocationIcon,
  Timer as TimerIcon,
  Notifications as NotificationIcon,
  Close as CloseIcon
} from '@mui/icons-material'
import { useSnackbar } from 'notistack'
import { doc, onSnapshot, collection, query, where, orderBy, limit } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { useStore, useDriverStore, formatCurrency } from '../../store/useStore'
import { 
  startService,
  completeService,
  getSettings
} from '../../services/firestore'
import { useDriverTracking } from '../../contexts/DriverTrackingContext'
import LiveMap from '../../components/tracking/LiveMap'
import { ChatButton } from '../../components/chat'
import { useAvailableServices } from '../../hooks/useAvailableServices'
import { subscribeToChatRoom } from '../../services/chatService'
import { BROADCAST_CONFIG } from '../../services/broadcastService'
import VersionFooter from '../../components/common/VersionFooter'

// ============================================
// 🔊 SISTEMA DE SONIDOS
// ============================================
let audioContextInstance = null
let alertIntervalId = null

const initAudioContext = () => {
  if (!audioContextInstance || audioContextInstance.state === 'closed') {
    audioContextInstance = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (audioContextInstance.state === 'suspended') {
    audioContextInstance.resume()
  }
  return audioContextInstance
}

const playNewServiceSound = () => {
  try {
    const ctx = initAudioContext()
    const now = ctx.currentTime
    const notes = [
      { freq: 880, time: 0, duration: 0.12 },
      { freq: 1100, time: 0.15, duration: 0.12 },
      { freq: 880, time: 0.30, duration: 0.12 },
      { freq: 1320, time: 0.45, duration: 0.15 }
    ]
    notes.forEach(note => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(note.freq, now + note.time)
      gain.gain.setValueAtTime(0.35, now + note.time)
      gain.gain.exponentialRampToValueAtTime(0.01, now + note.time + note.duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + note.time)
      osc.stop(now + note.time + note.duration)
    })
  } catch (e) {}
}

const startServiceAlert = () => {
  if (alertIntervalId) return
  playNewServiceSound()
  alertIntervalId = setInterval(playNewServiceSound, 3000)
}

const stopServiceAlert = () => {
  if (alertIntervalId) {
    clearInterval(alertIntervalId)
    alertIntervalId = null
  }
}

const playChatMessageSound = () => {
  try {
    const ctx = initAudioContext()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1200, now)
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.15)
    gain.gain.setValueAtTime(0.3, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.25)
  } catch (e) {}
}

const initAudioOnFirstInteraction = () => {
  initAudioContext()
  document.removeEventListener('click', initAudioOnFirstInteraction)
  document.removeEventListener('touchstart', initAudioOnFirstInteraction)
  document.removeEventListener('keydown', initAudioOnFirstInteraction)
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', initAudioOnFirstInteraction, { once: true })
  document.addEventListener('touchstart', initAudioOnFirstInteraction, { once: true })
  document.addEventListener('keydown', initAudioOnFirstInteraction, { once: true })
}

// ============================================
// UTILIDADES
// ============================================

const calculateDriverEarnings = (service, commissionRate = 20) => {
  if (service.driverEarnings !== undefined && service.driverEarnings !== null) {
    return service.driverEarnings
  }
  const deliveryFee = service.deliveryFee || 0
  const rate = service.commissionRate || commissionRate
  return deliveryFee * (1 - rate / 100)
}

const formatDate = (timestamp) => {
  if (!timestamp) return '--'
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return 'Ahora'
  if (diffMins < 60) return `Hace ${diffMins}m`
  if (diffHours < 24) return `Hace ${diffHours}h`
  if (diffDays < 7) return `Hace ${diffDays}d`
  return date.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })
}

// Obtener lunes de la semana actual
const getCurrentWeekMonday = () => {
  const today = new Date()
  const day = today.getDay()
  const diff = today.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(today.setDate(diff))
  monday.setHours(0, 0, 0, 0)
  return monday
}

// Verificar si un servicio está en la semana actual
const isInCurrentWeek = (timestamp) => {
  if (!timestamp) return false
  const monday = getCurrentWeekMonday()
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp)
  return date >= monday && date <= sunday
}

// ============================================
// COMPONENTE: TARJETA BROADCAST
// ============================================
const BroadcastNotificationCard = ({ 
  service, 
  onAccept, 
  onReject, 
  isAccepting = false,
  commissionRate = 20 
}) => {
  const [timeRemaining, setTimeRemaining] = useState(service.timeRemaining || 45000)
  const [isExiting, setIsExiting] = useState(false)
  const theme = useTheme()

  const totalTime = BROADCAST_CONFIG.WINDOW_DURATION
  const progress = useMemo(() => Math.max(0, Math.min(100, (timeRemaining / totalTime) * 100)), [timeRemaining, totalTime])

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(prev => prev <= 1000 ? 0 : prev - 1000)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const getProgressColor = () => {
    if (progress > 60) return 'success'
    if (progress > 30) return 'warning'
    return 'error'
  }

  const formatDistance = (distanceKm) => {
    if (!distanceKm) return '--'
    if (distanceKm < 1) return `${Math.round(distanceKm * 1000)}m`
    return `${distanceKm.toFixed(1)}km`
  }

  const earnings = calculateDriverEarnings(service, commissionRate)

  const handleAccept = () => {
    setIsExiting(true)
    stopServiceAlert()
    setTimeout(() => onAccept?.(service.serviceId || service.id), 200)
  }

  const handleReject = () => {
    setIsExiting(true)
    stopServiceAlert()
    setTimeout(() => onReject?.(service.serviceId || service.id), 200)
  }

  useEffect(() => {
    if (timeRemaining === 0 && !isExiting) handleReject()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRemaining])

  return (
    <Fade in={!isExiting} timeout={200}>
      <Card sx={{
        mb: 2,
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        border: '2px solid',
        borderColor: progress > 30 ? theme.palette.primary.main : theme.palette.error.main,
        borderRadius: 2,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0, 217, 255, 0.15)'
      }}>
        <LinearProgress variant="determinate" value={progress} color={getProgressColor()} sx={{ height: 6 }} />
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TimerIcon sx={{ color: progress > 30 ? theme.palette.primary.main : theme.palette.error.main, fontSize: 20 }} />
              <Typography variant="h5" fontWeight="bold" sx={{ 
                color: progress > 30 ? theme.palette.primary.main : theme.palette.error.main,
                fontFamily: 'monospace'
              }}>
                {formatTime(timeRemaining)}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <StoreIcon sx={{ color: theme.palette.primary.main, fontSize: 18 }} />
            <Typography variant="body1" color="white" fontWeight="medium">
              {service.restaurantName || 'Restaurante'}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <LocationIcon sx={{ color: theme.palette.info.main, fontSize: 18 }} />
            <Typography variant="body2" color="rgba(255,255,255,0.8)">
              {service.zoneName || 'Zona no especificada'}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Chip icon={<BikeIcon sx={{ fontSize: 16 }} />} label={formatDistance(service.distance)} size="small"
              sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.15), color: theme.palette.primary.main }} />
            <Chip icon={<ClockIcon sx={{ fontSize: 16 }} />} label={`Radio: ${(service.currentRadius || 3000) / 1000}km`} size="small"
              sx={{ backgroundColor: alpha(theme.palette.info.main, 0.15), color: theme.palette.info.main }} />
          </Box>

          <Box sx={{ p: 1.5, borderRadius: 1, backgroundColor: alpha(theme.palette.success.main, 0.1), mb: 2 }}>
            <Typography variant="caption" color="rgba(255,255,255,0.6)">Tu ganancia</Typography>
            <Typography variant="h6" color={theme.palette.success.main} fontWeight="bold">
              {formatCurrency(earnings)}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Button variant="outlined" fullWidth onClick={handleReject} disabled={isAccepting || timeRemaining === 0}
              sx={{ py: 1.5, borderColor: theme.palette.error.main, color: theme.palette.error.main,
                '&:hover': { borderColor: theme.palette.error.dark, backgroundColor: alpha(theme.palette.error.main, 0.1) } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CancelIcon fontSize="small" /> Rechazar
              </Box>
            </Button>
            <Button variant="contained" fullWidth onClick={handleAccept} disabled={isAccepting || timeRemaining === 0}
              sx={{ py: 1.5, backgroundColor: theme.palette.success.main, color: '#000', fontWeight: 'bold', fontSize: '1rem' }}>
              {isAccepting ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={16} color="inherit" /> Aceptando...
                </Box>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckIcon fontSize="small" /> Aceptar
                </Box>
              )}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Fade>
  )
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function RepartidorDashboard() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { enqueueSnackbar } = useSnackbar()
  const { user } = useStore()
  const { currentService, setCurrentService } = useDriverStore()
  
  const [myServices, setMyServices] = useState([])
  const [stats, setStats] = useState({ 
    totalEarnings: 0, 
    totalServices: 0, 
    todayEarnings: 0, 
    todayServices: 0,
    weekEarnings: 0,
    weekServices: 0,
    avgRating: 5.0,
    ratingCount: 0
  })
  const [loading, setLoading] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState({ open: false, type: '', service: null })
  const [driverData, setDriverData] = useState(null)
  const [showMap, setShowMap] = useState(false)
  const [showGpsDetails, setShowGpsDetails] = useState(false)
  const [gettingLocation, setGettingLocation] = useState(false)
  const [appSettings, setAppSettings] = useState({ commissionRate: 20, minDeliveryFee: 1.50 })
  const [useBroadcast, setUseBroadcast] = useState(true)
  
  const prevServicesCountRef = useRef(0)
  const chatPrevUnreadRef = useRef(0)
  const chatOpenRef = useRef(false)

  const {
    isTracking, 
    currentLocation, 
    error: gpsError, 
    permissionStatus,
    goOnline, 
    goOffline, 
    forceGetLocation, 
    isOnline: contextIsOnline
  } = useDriverTracking()

  const { setIsOnline } = useDriverStore()
  
  useEffect(() => {
    setIsOnline(contextIsOnline)
  }, [contextIsOnline, setIsOnline])

  const {
    availableServices: broadcastServices,
    loading: broadcastLoading,
    acceptingServiceId,
    acceptService: acceptBroadcastService,
    rejectService: rejectBroadcastService,
    hasAvailableServices: hasBroadcastServices
  } = useAvailableServices(driverData?.id, currentLocation, contextIsOnline && useBroadcast)

  // ============================================
  // ✅ SUSCRIPCIÓN AL DRIVER (solo datos básicos)
  // ============================================
  useEffect(() => {
    if (!user?.driverId) return

    const driverRef = doc(db, 'drivers', user.driverId)
    
    const unsubscribe = onSnapshot(driverRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data()
        setDriverData({ id: doc.id, ...data })
      } else {
        setDriverData(null)
      }
    })

    return () => unsubscribe()
  }, [user?.driverId])

  // ============================================
  // ✅ SUSCRIPCIÓN A SERVICIOS - CALCULAR STATS REALES
  // ============================================
  useEffect(() => {
    if (!driverData?.id) return

    const servicesQuery = query(
      collection(db, 'services'),
      where('driverId', '==', driverData.id),
      orderBy('createdAt', 'desc'),
      limit(200)
    )
    
    const unsubscribe = onSnapshot(servicesQuery, (snapshot) => {
      const services = []
      
      // Stats totales
      let totalEarnings = 0
      let totalServices = 0
      let ratingSum = 0
      let ratingCount = 0
      
      // Stats de hoy
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      let todayEarnings = 0
      let todayServices = 0
      
      // Stats de la SEMANA actual
      const weekMonday = getCurrentWeekMonday()
      const weekSunday = new Date(weekMonday)
      weekSunday.setDate(weekSunday.getDate() + 6)
      weekSunday.setHours(23, 59, 59, 999)
      let weekEarnings = 0
      let weekServices = 0

      snapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() }
        services.push(data)
        
        // Solo contar servicios ENTREGADOS
        if (data.status === 'entregado') {
          totalServices++
          const earnings = calculateDriverEarnings(data, appSettings.commissionRate)
          totalEarnings += earnings
          
          // Rating
          if (data.driverRating && data.driverRating > 0) {
            ratingSum += data.driverRating
            ratingCount++
          }
          
          // Estadísticas de hoy
          const completedDate = data.completedAt?.toDate?.() || new Date(data.completedAt)
          if (completedDate >= today) {
            todayServices++
            todayEarnings += earnings
          }
          
          // Estadísticas de la semana
          if (completedDate >= weekMonday && completedDate <= weekSunday) {
            weekServices++
            weekEarnings += earnings
          }
        }
      })

      // Rating promedio
      const avgRating = ratingCount > 0 ? ratingSum / ratingCount : 5.0

      console.log('📊 Stats calculados:', {
        totalServices,
        totalEarnings: totalEarnings.toFixed(2),
        weekServices,
        weekEarnings: weekEarnings.toFixed(2),
        avgRating: avgRating.toFixed(1),
        ratingCount
      })
      
      setMyServices(services)
      setStats({
        totalEarnings,
        totalServices,
        todayEarnings,
        todayServices,
        weekEarnings,
        weekServices,
        avgRating,
        ratingCount
      })
      
      // Servicio activo
      const active = services.find(s => s.status === 'asignado' || s.status === 'en_camino')
      setCurrentService(active || null)
    })

    return () => unsubscribe()
  }, [driverData?.id, appSettings.commissionRate, setCurrentService])

  // Detectar nuevos servicios
  useEffect(() => {
    const currentCount = broadcastServices.length
    const prevCount = prevServicesCountRef.current

    if (currentCount > 0 && prevCount === 0) {
      startServiceAlert()
      if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200])
      if (Notification.permission === 'granted') {
        try {
          new Notification('🚴 ¡Nuevo servicio disponible!', {
            body: `Tienes ${currentCount} servicio(s) esperando`,
            icon: '/logo-192.png',
            tag: 'new-service',
            requireInteraction: true
          })
        } catch (e) {}
      }
    } else if (currentCount === 0 && prevCount > 0) {
      stopServiceAlert()
    }

    prevServicesCountRef.current = currentCount
  }, [broadcastServices.length])

  // Chat
  useEffect(() => {
    if (!currentService?.id) {
      chatPrevUnreadRef.current = 0
      return
    }

    const unsubscribe = subscribeToChatRoom(currentService.id, (room) => {
      if (room && !chatOpenRef.current) {
        const unreadCount = room.unreadByDriver || 0
        const prevCount = chatPrevUnreadRef.current
        if (unreadCount > prevCount && prevCount > 0) {
          playChatMessageSound()
          if (navigator.vibrate) navigator.vibrate([100, 50, 100])
          enqueueSnackbar('💬 Nuevo mensaje del restaurante', { variant: 'info', autoHideDuration: 3000 })
        }
        chatPrevUnreadRef.current = unreadCount
      }
    })

    return () => unsubscribe()
  }, [currentService?.id, enqueueSnackbar])

  // Configuración
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await getSettings()
        if (settings) {
          setAppSettings({
            commissionRate: settings.commissionRate || 20,
            minDeliveryFee: settings.minDeliveryFee || 1.50
          })
        }
      } catch (error) {
        console.error('Error cargando configuración:', error)
      }
    }
    loadSettings()
  }, [])

  // Handlers
  const handleToggleOnline = async () => {
    if (!driverData?.id) {
      enqueueSnackbar('Error: No se encontró tu perfil', { variant: 'error' })
      return
    }
    
    setLoading(true)
    
    try {
      if (!contextIsOnline) {
        const success = await goOnline()
        if (success) enqueueSnackbar('¡Estás en línea!', { variant: 'success' })
      } else {
        const success = await goOffline()
        if (success) {
          stopServiceAlert()
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

  const handleForceGetLocation = async () => {
    setGettingLocation(true)
    await forceGetLocation()
    setGettingLocation(false)
  }

  const handleAcceptBroadcastService = async (serviceId) => {
    if (!driverData?.id) return
    const result = await acceptBroadcastService(serviceId, driverData.name || user?.name)
    if (result.success) {
      enqueueSnackbar('¡Servicio aceptado!', { variant: 'success' })
    } else {
      enqueueSnackbar(result.error || 'No se pudo aceptar', { variant: 'error' })
    }
  }

  const handleRejectBroadcastService = async (serviceId) => {
    if (!driverData?.id) return
    const result = await rejectBroadcastService(serviceId)
    if (result.success) {
      enqueueSnackbar('Servicio rechazado', { variant: 'info' })
    } else {
      enqueueSnackbar(result.error || 'No se pudo rechazar', { variant: 'error' })
    }
  }

  const handleStartDelivery = async (service) => {
    setLoading(true)
    const result = await startService(service.id)
    setLoading(false)
    if (result.success) {
      enqueueSnackbar('¡Viaje iniciado!', { variant: 'success' })
    } else {
      enqueueSnackbar('Error al iniciar', { variant: 'error' })
    }
  }

  const handleCompleteService = async (service) => {
    setLoading(true)
    const earnings = calculateDriverEarnings(service, appSettings.commissionRate)
    const result = await completeService(service.id, earnings)
    setLoading(false)
    if (result.success) {
      enqueueSnackbar(`¡Completado! Ganaste ${formatCurrency(earnings)}`, { variant: 'success' })
      setConfirmDialog({ open: false, type: '', service: null })
    } else {
      enqueueSnackbar('Error al completar', { variant: 'error' })
    }
  }

  const getStatusConfig = (status) => {
    const configs = {
      pendiente: { color: 'warning', label: 'Pendiente', icon: <ClockIcon /> },
      asignado: { color: 'info', label: 'Asignado', icon: <CheckIcon /> },
      en_camino: { color: 'primary', label: 'En Camino', icon: <BikeIcon /> },
      entregado: { color: 'success', label: 'Entregado', icon: <CheckIcon /> },
      cancelado: { color: 'error', label: 'Cancelado', icon: <CancelIcon /> }
    }
    return configs[status] || configs.pendiente
  }

  const getGpsState = () => {
    if (permissionStatus?.granted === false) return { status: 'denied', label: 'Permiso denegado', color: 'error' }
    if (currentLocation) return { status: 'active', label: 'GPS Activo', color: 'success' }
    if (isTracking) return { status: 'searching', label: 'Buscando señal...', color: 'warning' }
    return { status: 'inactive', label: 'GPS Inactivo', color: 'default' }
  }

  const gpsState = getGpsState()

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {loading && <LinearProgress />}
      
      {/* Profile Card */}
      <Card sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ width: 56, height: 56, bgcolor: 'success.main', fontSize: '1.5rem', fontWeight: 'bold', borderRadius: 2 }}>
              {driverData?.name?.charAt(0) || user?.name?.charAt(0) || 'R'}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" fontWeight="bold">{driverData?.name || user?.name || 'Repartidor'}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <StarIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                <Typography variant="body2" color="warning.main">
                  {stats.avgRating.toFixed(1)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ({stats.ratingCount > 0 ? stats.ratingCount : 'sin calificaciones'})
                </Typography>
              </Box>
            </Box>
            <Chip label={contextIsOnline ? 'En línea' : 'Fuera de línea'} color={contextIsOnline ? 'success' : 'default'} size="small" />
          </Box>
        </CardContent>
      </Card>

      {!contextIsOnline && (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          <Typography variant="subtitle2" fontWeight="bold">Bienvenido, {driverData?.name || user?.name || 'Repartidor'}</Typography>
          <Typography variant="body2">Presiona el botón de abajo para ponerte en línea.</Typography>
        </Alert>
      )}

      <Button fullWidth size="large" variant="contained" onClick={handleToggleOnline} disabled={loading}
        sx={{ py: 3, borderRadius: 2, bgcolor: contextIsOnline ? 'success.main' : 'grey.700', fontSize: '1rem' }}
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PowerIcon sx={{ animation: contextIsOnline ? 'pulse 1s infinite' : 'none' }} />}>
        {loading ? 'PROCESANDO...' : contextIsOnline ? 'ESTÁS EN LÍNEA' : 'PONERSE EN LÍNEA'}
      </Button>

      {/* GPS Status */}
      {contextIsOnline && (
        <>
          {permissionStatus?.granted === false && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold">Permiso de ubicación denegado</Typography>
              <Typography variant="body2">Habilita el acceso a ubicación en la configuración del navegador.</Typography>
            </Alert>
          )}
          
          <Card sx={{ borderRadius: 2, bgcolor: alpha(theme.palette[gpsState.color]?.main || theme.palette.grey[500], 0.1), border: 1, borderColor: `${gpsState.color}.main` }}>
            <CardContent sx={{ py: 2, px: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1.5} alignItems="center">
                  {gpsState.status === 'active' ? <GpsIcon color="success" sx={{ animation: 'pulse 1.5s infinite', fontSize: 28 }} />
                    : gpsState.status === 'searching' ? <CircularProgress size={28} color="warning" />
                    : gpsState.status === 'denied' ? <GpsOffIcon color="error" sx={{ fontSize: 28 }} />
                    : <GpsOffIcon color="disabled" sx={{ fontSize: 28 }} />}
                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold" color={`${gpsState.color}.main`}>{gpsState.label}</Typography>
                    {currentLocation && (
                      <Typography variant="caption" color="text.secondary">
                        {currentLocation.speed > 0 && `${(currentLocation.speed * 3.6).toFixed(0)} km/h`}
                        {currentLocation.accuracy && ` • Precisión: ${currentLocation.accuracy.toFixed(0)}m`}
                      </Typography>
                    )}
                  </Box>
                </Stack>
                <Stack direction="row" spacing={0.5}>
                  <Tooltip title="Obtener ubicación">
                    <span>
                      <IconButton size="small" onClick={handleForceGetLocation} color="primary" disabled={gettingLocation}
                        sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                        {gettingLocation ? <CircularProgress size={20} color="primary" /> : <MyLocationIcon fontSize="small" />}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Ver detalles">
                    <span>
                      <IconButton size="small" onClick={() => setShowGpsDetails(!showGpsDetails)}>
                        {showGpsDetails ? <CollapseIcon fontSize="small" /> : <ExpandIcon fontSize="small" />}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Ver mapa">
                    <span>
                      <IconButton size="small" onClick={() => setShowMap(!showMap)} color="primary">
                        <MapIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Stack>
              
              <Collapse in={showGpsDetails}>
                <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                  <Grid container spacing={2}>
                    <Grid item xs={6}><Typography variant="caption" color="text.secondary">Latitud</Typography><Typography variant="body2" fontFamily="monospace">{currentLocation?.latitude?.toFixed(6) || '--'}</Typography></Grid>
                    <Grid item xs={6}><Typography variant="caption" color="text.secondary">Longitud</Typography><Typography variant="body2" fontFamily="monospace">{currentLocation?.longitude?.toFixed(6) || '--'}</Typography></Grid>
                  </Grid>
                </Box>
              </Collapse>
            </CardContent>
          </Card>
        </>
      )}

      {showMap && contextIsOnline && (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent sx={{ p: 0 }}>
            <LiveMap driverLocation={currentLocation} height={isMobile ? 250 : 300} interactive={true} showRoute={false} showDriver={!!currentLocation} />
          </CardContent>
        </Card>
      )}

      {/* Stats de la SEMANA */}
      <Grid container spacing={{ xs: 1, sm: 2 }}>
        <Grid item xs={4}>
          <Card sx={{ textAlign: 'center', borderRadius: 2, height: '100%' }}>
            <CardContent sx={{ py: 2 }}>
              <MoneyIcon sx={{ color: 'success.main', mb: 0.5 }} />
              <Typography variant="h6" fontWeight="bold">{formatCurrency(stats.weekEarnings)}</Typography>
              <Typography variant="caption" color="text.secondary">Esta Semana</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4}>
          <Card sx={{ textAlign: 'center', borderRadius: 2, height: '100%' }}>
            <CardContent sx={{ py: 2 }}>
              <BikeIcon sx={{ color: 'info.main', mb: 0.5 }} />
              <Typography variant="h6" fontWeight="bold">{stats.weekServices}</Typography>
              <Typography variant="caption" color="text.secondary">Servicios Semana</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4}>
          <Card sx={{ textAlign: 'center', borderRadius: 2, height: '100%' }}>
            <CardContent sx={{ py: 2 }}>
              <StarIcon sx={{ color: 'warning.main', mb: 0.5 }} />
              <Typography variant="h6" fontWeight="bold">{stats.avgRating.toFixed(1)}</Typography>
              <Typography variant="caption" color="text.secondary">
                {stats.ratingCount > 0 ? `${stats.ratingCount} calif.` : 'Sin calif.'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Current Active Service */}
      {currentService && (
        <Card sx={{ borderRadius: 2, border: 2, borderColor: 'primary.main' }}>
          <CardHeader
            avatar={<BikeIcon color="primary" />}
            title={<Typography variant="subtitle1" fontWeight="bold" color="primary">SERVICIO ACTIVO</Typography>}
            subheader={`ID: ${currentService.serviceId}`}
            action={<Chip label={getStatusConfig(currentService.status).label} color={getStatusConfig(currentService.status).color} size="small" />}
          />
          <CardContent sx={{ pt: 0 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                  <Typography variant="caption" color="text.secondary"><StoreIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />Recoger en:</Typography>
                  <Typography variant="subtitle2" fontWeight="bold">{currentService.restaurantName}</Typography>
                  <Typography variant="body2" color="text.secondary">{currentService.restaurantAddress}</Typography>
                  {currentService.restaurantPhone && (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        <PhoneIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                        {currentService.restaurantPhone}
                      </Typography>
                      <IconButton size="small" color="success" onClick={() => window.open(`tel:${currentService.restaurantPhone}`, '_self')}
                        sx={{ bgcolor: 'success.main', color: 'white', '&:hover': { bgcolor: 'success.dark' } }}>
                        <PhoneIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  )}
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.info.main, 0.1) }}>
                  <Typography variant="caption" color="text.secondary"><LocationIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />Entregar en:</Typography>
                  <Typography variant="subtitle2" fontWeight="bold">{currentService.zoneName}</Typography>
                  <Typography variant="body2" color="text.secondary">{currentService.deliveryAddress}</Typography>
                </Paper>
              </Grid>
              
              {(currentService.clientName || currentService.clientPhone) && (
                <Grid item xs={12}>
                  <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
                    <Typography variant="caption" color="text.secondary"><PersonIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />Datos del cliente:</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
                      <Box>
                        {currentService.clientName && <Typography variant="subtitle2" fontWeight="bold">{currentService.clientName}</Typography>}
                        {currentService.clientPhone && <Typography variant="body2" color="text.secondary">{currentService.clientPhone}</Typography>}
                      </Box>
                      {currentService.clientPhone && (
                        <IconButton color="success" onClick={() => window.open(`tel:${currentService.clientPhone}`, '_self')}
                          sx={{ bgcolor: 'success.main', color: 'white', '&:hover': { bgcolor: 'success.dark' } }}>
                          <PhoneIcon />
                        </IconButton>
                      )}
                    </Box>
                  </Paper>
                </Grid>
              )}
            </Grid>

            <Card sx={{ mt: 2, bgcolor: 'success.main', borderRadius: 2 }}>
              <CardContent sx={{ py: 2 }}>
                <Typography variant="body2" sx={{ color: 'success.light', mb: 1, textAlign: 'center' }}>Tu ganancia</Typography>
                <Typography variant="h4" fontWeight="bold" color="white" textAlign="center">
                  {formatCurrency(calculateDriverEarnings(currentService, appSettings.commissionRate))}
                </Typography>
              </CardContent>
            </Card>

            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              {currentService.status === 'asignado' && (
                <Button fullWidth variant="contained" color="primary" size="large" startIcon={<NavigationIcon />} onClick={() => handleStartDelivery(currentService)} disabled={loading}>
                  INICIAR VIAJE
                </Button>
              )}
              {currentService.status === 'en_camino' && (
                <Button fullWidth variant="contained" color="success" size="large" startIcon={<CheckIcon />} onClick={() => setConfirmDialog({ open: true, type: 'complete', service: currentService })} disabled={loading}>
                  COMPLETAR ENTREGA
                </Button>
              )}
              <Tooltip title="Abrir en Maps">
                <span>
                  <IconButton onClick={() => {
                    const address = encodeURIComponent(currentService.deliveryAddress + ', Maracay, Venezuela')
                    window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank')
                  }} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                    <LocationIcon color="primary" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Servicios disponibles */}
      {contextIsOnline && !currentService && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <NotificationIcon sx={{ color: theme.palette.primary.main }} /> Servicios en tu zona
            </Typography>
            {hasBroadcastServices && (
              <Chip label={broadcastServices.length} size="small" sx={{ bgcolor: theme.palette.error.main, color: 'white', fontWeight: 'bold' }} />
            )}
          </Box>

          {useBroadcast && broadcastLoading && !hasBroadcastServices ? (
            <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
          ) : useBroadcast && hasBroadcastServices ? (
            <Box>
              {broadcastServices.map((service) => (
                <BroadcastNotificationCard
                  key={service.serviceId || service.id}
                  service={service}
                  onAccept={handleAcceptBroadcastService}
                  onReject={handleRejectBroadcastService}
                  isAccepting={acceptingServiceId === service.serviceId}
                  commissionRate={appSettings.commissionRate}
                />
              ))}
            </Box>
          ) : useBroadcast && contextIsOnline && !currentService ? (
            <Card sx={{ p: 4, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 2 }}>
              <BikeIcon sx={{ fontSize: 60, color: 'rgba(255,255,255,0.2)', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>Sin servicios cercanos</Typography>
              <Typography variant="body2" color="text.disabled">Te notificaremos cuando haya un nuevo pedido en tu zona</Typography>
            </Card>
          ) : null}
        </Box>
      )}

      {/* Ganancias de Hoy */}
      <Card sx={{ borderRadius: 2 }}>
        <CardHeader avatar={<MoneyIcon color="success" />} title={<Typography variant="subtitle1" fontWeight="bold" color="success.main">Ganancias de Hoy</Typography>} />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h5" fontWeight="bold" color="success.main">{formatCurrency(stats.todayEarnings)}</Typography>
                <Typography variant="caption" color="text.secondary">Total del día</Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h5" fontWeight="bold">{stats.todayServices}</Typography>
                <Typography variant="caption" color="text.secondary">Servicios</Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Historial Reciente */}
      <Card sx={{ borderRadius: 2 }}>
        <CardHeader avatar={<ClockIcon color="primary" />} title={<Typography variant="subtitle1" fontWeight="bold">Historial Reciente</Typography>} />
        <CardContent sx={{ pt: 0 }}>
          {myServices.filter(s => s.status === 'entregado').slice(0, 5).length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <BikeIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">No hay servicios completados</Typography>
            </Box>
          ) : (
            <Stack spacing={1}>
              {myServices.filter(s => s.status === 'entregado').slice(0, 5).map((service) => {
                const status = getStatusConfig(service.status)
                return (
                  <Paper key={service.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Grid container spacing={1} alignItems="center">
                      <Grid item xs={3}>
                        <Typography variant="body2" fontWeight="bold">{service.serviceId}</Typography>
                        <Typography variant="caption" color="text.secondary">{formatDate(service.completedAt || service.createdAt)}</Typography>
                      </Grid>
                      <Grid item xs={5}>
                        <Typography variant="body2" noWrap>{service.zoneName}</Typography>
                      </Grid>
                      <Grid item xs={2}>
                        <Typography variant="body2" fontWeight="bold" color="success.main">{formatCurrency(calculateDriverEarnings(service, appSettings.commissionRate))}</Typography>
                      </Grid>
                      <Grid item xs={2}>
                        <Chip icon={status.icon} label={status.label} size="small" color={status.color} />
                      </Grid>
                    </Grid>
                  </Paper>
                )
              })}
            </Stack>
          )}
        </CardContent>
      </Card>

      <VersionFooter />

      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ open: false, type: '', service: null })}>
        <DialogTitle>Confirmar acción</DialogTitle>
        <DialogContent>
          {confirmDialog.type === 'complete' && (
            <Typography>¿Confirmas que has entregado el pedido? Ganarás {formatCurrency(calculateDriverEarnings(confirmDialog.service, appSettings.commissionRate))}</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, type: '', service: null })}>Cancelar</Button>
          <Button variant="contained" color="success" onClick={() => handleCompleteService(confirmDialog.service)} disabled={loading}>
            {loading ? <CircularProgress size={20} /> : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>

      {currentService && (
        <Dialog open={!!currentService && !confirmDialog.open} onClose={() => {}} maxWidth="sm" fullWidth fullScreen={isMobile}>
          <DialogTitle>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="subtitle1" fontWeight="bold">Chat del Servicio</Typography>
                <Typography variant="caption" color="text.secondary">{currentService.restaurantName || 'Restaurante'}</Typography>
              </Box>
              <IconButton onClick={() => setCurrentService(null)}><CloseIcon /></IconButton>
            </Stack>
          </DialogTitle>
          <DialogContent sx={{ p: 0 }}>
            <ChatButton serviceId={currentService.id} driverId={driverData?.id} restaurantId={currentService.restaurantId} />
          </DialogContent>
        </Dialog>
      )}
    </Box>
  )
}