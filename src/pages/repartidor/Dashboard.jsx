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
  Badge
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
  Info as InfoIcon,
  Timer as TimerIcon,
  Notifications as NotificationIcon,
  Close as CloseIcon
} from '@mui/icons-material'
import { useSnackbar } from 'notistack'
import { useStore, useDriverStore, formatCurrency } from '../../store/useStore'
import {
  subscribeToPendingServices,
  subscribeToDriverServices,
  acceptService,
  startService,
  completeService,
  setDriverOnline,
  getDriverStats,
  getDriverByUserId,
  getSettings
} from '../../services/firestore'
import { useDriverTracking } from '../../hooks/useDriverTracking'
import LiveMap from '../../components/tracking/LiveMap'
import { ChatButton } from '../../components/chat'
import { RIDERY_COLORS } from '../../theme/theme'
import { useAvailableServices } from '../../hooks/useAvailableServices'
import { BROADCAST_CONFIG } from '../../services/broadcastService'
import VersionFooter from '../../components/common/VersionFooter'
import { useChatUnreadCounts } from '../../hooks/useChatUnreadCounts'
import { useChatNotifications } from '../../hooks/useChatNotifications'
// 🔊 SERVICIO DE AUDIO PROFESIONAL
import {
  unlockAudio,
  playNewServiceSound,
  startServiceAlert,
  stopServiceAlert,
  useAudioService
} from '../../services/audioService'

// Función helper para calcular ganancias
const calculateDriverEarnings = (service, commissionRate = 20) => {
  if (service.driverEarnings !== undefined && service.driverEarnings !== null) {
    return service.driverEarnings
  }
  const deliveryFee = service.deliveryFee || 0
  const rate = service.commissionRate || commissionRate
  return deliveryFee * (1 - rate / 100)
}

// ============================================
// COMPONENTE: TARJETA DE SERVICIO BROADCAST
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
  const progress = useMemo(() => {
    return Math.max(0, Math.min(100, (timeRemaining / totalTime) * 100))
  }, [timeRemaining, totalTime])

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1000) {
          clearInterval(timer)
          return 0
        }
        return prev - 1000
      })
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
            <Button
              variant="outlined"
              fullWidth
              onClick={handleReject}
              disabled={isAccepting || timeRemaining === 0}
              sx={{
                py: 1.5,
                borderColor: theme.palette.error.main,
                color: theme.palette.error.main,
                '&:hover': { borderColor: theme.palette.error.dark, backgroundColor: alpha(theme.palette.error.main, 0.1) }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CancelIcon fontSize="small" /> Rechazar
              </Box>
            </Button>
            <Button
              variant="contained"
              fullWidth
              onClick={handleAccept}
              disabled={isAccepting || timeRemaining === 0}
              sx={{ py: 1.5, backgroundColor: theme.palette.success.main, color: '#000', fontWeight: 'bold', fontSize: '1rem' }}
            >
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

          <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontStyle: 'italic' }}>
            La dirección exacta se mostrará al aceptar
          </Typography>
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
  const { isOnline, setIsOnline, currentService, setCurrentService } = useDriverStore()

  const [pendingServices, setPendingServices] = useState([])
  const [myServices, setMyServices] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedService, setSelectedService] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState({ open: false, type: '', service: null })
  const [driverData, setDriverData] = useState(null)
  const [showMap, setShowMap] = useState(false)
  const [showGpsDetails, setShowGpsDetails] = useState(false)
  const [gettingLocation, setGettingLocation] = useState(false)
  const [appSettings, setAppSettings] = useState({ commissionRate: 20, minDeliveryFee: 1.50 })
  const [useBroadcast, setUseBroadcast] = useState(true)

  const prevServicesCountRef = useRef(0)

  // 🔧 REFS para el chat
  const chatOpenRef = useRef(false)  // Usar ref para pasar al hook de notificaciones
  const isInitializedRef = useRef(false)

  // 🔊 INICIALIZAR SERVICIO DE AUDIO
  const audioStatus = useAudioService()

  const {
    isTracking, currentLocation, error: gpsError, permissionStatus,
    startTracking, stopTracking, forceGetLocation
  } = useDriverTracking(driverData, currentService)

  const {
    availableServices: broadcastServices,
    loading: broadcastLoading,
    acceptingServiceId,
    acceptService: acceptBroadcastService,
    rejectService: rejectBroadcastService,
    hasAvailableServices: hasBroadcastServices
  } = useAvailableServices(driverData?.id, currentLocation, isOnline && useBroadcast)

  // 💬 HOOKS DE CHAT
  // Servicios para el chat (solo el servicio activo)
  const servicesForChat = currentService ? [currentService] : []

  // Contadores de mensajes no leídos
  const chatUnreadCounts = useChatUnreadCounts(servicesForChat, 'driver')

  // 🔔 Notificaciones de chat (sonido cuando chat cerrado)
  // ✅ CORREGIDO: Pasamos el ref, no el valor
  useChatNotifications(servicesForChat, 'driver', chatOpenRef)

  // 🔔 DETECTAR NUEVOS SERVICIOS
  useEffect(() => {
    const currentCount = broadcastServices.length
    const prevCount = prevServicesCountRef.current

    if (currentCount > 0 && prevCount === 0) {
      console.log('🚨 [Dashboard] Detectado nuevo servicio, llamando a startServiceAlert');
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

  // Cargar configuración
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

  // Cargar datos del repartidor
  useEffect(() => {
    if (isInitializedRef.current) return

    const loadDriverData = async () => {
      if (user?.uid) {
        const driver = await getDriverByUserId(user.uid)
        setDriverData(driver)

        const savedOnlineState = driver?.isOnline || false
        setIsOnline(savedOnlineState)

        isInitializedRef.current = true
      }
    }
    loadDriverData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Reactivar GPS
  const gpsActivationAttempted = useRef(false)

  useEffect(() => {
    if (gpsActivationAttempted.current) return

    if (driverData?.id && isOnline && !isTracking) {
      gpsActivationAttempted.current = true
      startTracking().catch(() => gpsActivationAttempted.current = false)
    }
  }, [driverData, isOnline, isTracking, startTracking])

  // Suscribirse a servicios pendientes (backup)
  useEffect(() => {
    if (!isOnline || !driverData?.id || useBroadcast) return

    const unsubscribe = subscribeToPendingServices((services) => {
      const available = services.filter(s => !s.driverId)
      setPendingServices(available)

      if (available.length > 0 && !currentService) {
        playNewServiceSound()
        if (navigator.vibrate) navigator.vibrate([200, 100, 200])

        try {
          if (Notification.permission === 'granted') {
            new Notification('¡Nuevo servicio disponible!', {
              body: `Tienes ${available.length} servicio(s) esperando`,
              icon: '/logo-192.png'
            })
          }
        } catch (e) {}
      }
    })

    return () => unsubscribe()
  }, [isOnline, driverData, currentService, useBroadcast])

  // Suscribirse a mis servicios
  useEffect(() => {
    if (!driverData?.id) return

    const unsubscribe = subscribeToDriverServices(driverData.id, (services) => {
      setMyServices(services)
      const active = services.find(s => s.status === 'asignado' || s.status === 'en_camino')
      setCurrentService(active || null)
    })

    return () => unsubscribe()
  }, [driverData, setCurrentService])

  // Cargar estadísticas
  const loadStats = useCallback(async () => {
    if (!driverData?.id) return
    const statsData = await getDriverStats(driverData.id)
    setStats(statsData)
  }, [driverData])

  useEffect(() => {
    loadStats()
  }, [loadStats, myServices])

  // Toggle Online/Offline
  const handleToggleOnline = async () => {
    if (!driverData?.id) {
      enqueueSnackbar('Error: No se encontró tu perfil', { variant: 'error' })
      return
    }

    console.log('👆 [Click] Botón Online/Offline presionado. Desbloqueando audio...');
    await unlockAudio()

    setLoading(true)

    try {
      const newOnlineState = !isOnline
      const result = await setDriverOnline(driverData.id, newOnlineState)

      if (result.success) {
        setIsOnline(newOnlineState)

        if (newOnlineState) {
          await startTracking()
          enqueueSnackbar('¡Estás en línea! GPS activado.', { variant: 'success' })
        } else {
          await stopTracking()
          stopServiceAlert()
          enqueueSnackbar('Saliste del sistema. GPS desactivado.', { variant: 'info' })
        }
      } else {
        enqueueSnackbar('Error al cambiar estado', { variant: 'error' })
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
      enqueueSnackbar('¡Servicio aceptado! Dirígete al restaurante', { variant: 'success' })
    } else {
      enqueueSnackbar(result.error || 'No se pudo aceptar el servicio', { variant: 'error' })
    }
  }

  const handleRejectBroadcastService = async (serviceId) => {
    if (!driverData?.id) return
    const result = await rejectBroadcastService(serviceId)
    if (result.success) {
      enqueueSnackbar('Servicio rechazado', { variant: 'info' })
    } else {
      enqueueSnackbar(result.error || 'No se pudo rechazar el servicio', { variant: 'error' })
    }
  }

  const handleAcceptService = async (service) => {
    if (!driverData?.id) return
    setLoading(true)
    const result = await acceptService(service.id, driverData.id, driverData.name || user?.name)
    setLoading(false)
    if (result.success) {
      enqueueSnackbar('¡Servicio aceptado!', { variant: 'success' })
      setSelectedService(null)
      setPendingServices(prev => prev.filter(s => s.id !== service.id))
    } else {
      enqueueSnackbar(result.error || 'Error al aceptar', { variant: 'error' })
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

  // ✅ HANDLERS: Tracking de estado del chat
  const handleChatOpen = () => {
    console.log('👁️ [Chat] Abriendo chat');
    chatOpenRef.current = true
  }

  const handleChatClose = () => {
    console.log('👁️ [Chat] Cerrando chat');
    chatOpenRef.current = false
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pb: { xs: 10, sm: 4 } }}>
      {loading && <LinearProgress />}

      {/* Profile Card */}
      <Card sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ width: 56, height: 56, bgcolor: 'success.main', fontSize: '1.5rem', fontWeight: 'bold', borderRadius: 2 }}>
              {user?.name?.charAt(0) || 'R'}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" fontWeight="bold">{driverData?.name || user?.name || 'Repartidor'}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <StarIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                <Typography variant="body2" color="warning.main">{driverData?.rating?.toFixed(1) || '5.0'}</Typography>
                <Typography variant="body2" color="text.secondary">({driverData?.totalServices || 0} servicios)</Typography>
              </Box>
            </Box>
            <Chip label={isOnline ? 'En línea' : 'Fuera de línea'} color={isOnline ? 'success' : 'default'} size="small" />
          </Box>
        </CardContent>
      </Card>

      {!isOnline && (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          <Typography variant="subtitle2" fontWeight="bold">Bienvenido, {driverData?.name || user?.name || 'Repartidor'}</Typography>
          <Typography variant="body2">Presiona el botón de abajo para ponerte en línea. El GPS se activará automáticamente.</Typography>
        </Alert>
      )}

      <Button fullWidth size="large" variant="contained" onClick={handleToggleOnline} disabled={loading}
        sx={{
          py: 3,
          borderRadius: 2,
          bgcolor: isOnline ? 'success.main' : 'grey.700',
          fontSize: '1rem',
          '@keyframes pulse': {
            '0%': { transform: 'scale(1)' },
            '50%': { transform: 'scale(1.1)' },
            '100%': { transform: 'scale(1)' },
          }
        }}
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PowerIcon sx={{ animation: isOnline ? 'pulse 1s infinite' : 'none' }} />}>
        {loading ? 'PROCESANDO...' : isOnline ? 'ESTÁS EN LÍNEA' : 'PONERSE EN LÍNEA'}
      </Button>

      {/* GPS Status */}
      {isOnline && (
        <>
          {permissionStatus?.granted === false && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold">Permiso de ubicación denegado</Typography>
              <Typography variant="body2">1. Haz clic en el candado en la barra de direcciones<br/>2. Permite el acceso a tu ubicación<br/>3. Recarga la página</Typography>
            </Alert>
          )}

          <Card sx={{
            borderRadius: 2,
            bgcolor: alpha(theme.palette[gpsState.color]?.main || theme.palette.grey[500], 0.1),
            border: 1,
            borderColor: `${gpsState.color}.main`,
            '@keyframes pulse': {
              '0%': { transform: 'scale(1)', opacity: 1 },
              '50%': { transform: 'scale(1.15)', opacity: 0.8 },
              '100%': { transform: 'scale(1)', opacity: 1 },
            }
          }}>
            <CardContent sx={{ py: 2, px: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1.5} alignItems="center">
                  {gpsState.status === 'active' ? <GpsIcon color="success" sx={{ animation: 'pulse 1.5s infinite ease-in-out', fontSize: 28 }} />
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
                    <IconButton size="small" onClick={handleForceGetLocation} color="primary" disabled={gettingLocation}
                      sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                      {gettingLocation ? <CircularProgress size={20} color="primary" /> : <MyLocationIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Ver detalles">
                    <IconButton size="small" onClick={() => setShowGpsDetails(!showGpsDetails)}>
                      {showGpsDetails ? <CollapseIcon fontSize="small" /> : <ExpandIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Ver mapa">
                    <IconButton size="small" onClick={() => setShowMap(!showMap)} color="primary">
                      <MapIcon fontSize="small" />
                    </IconButton>
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

      {showMap && isOnline && (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent sx={{ p: 0 }}>
            <LiveMap driverLocation={currentLocation} height={isMobile ? 250 : 300} interactive={true} showRoute={false} showDriver={!!currentLocation} />
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <Grid container spacing={{ xs: 1, sm: 2 }}>
        <Grid item xs={4}>
          <Card sx={{ textAlign: 'center', borderRadius: 2, height: '100%' }}>
            <CardContent sx={{ py: 2 }}>
              <MoneyIcon sx={{ color: 'success.main', mb: 0.5 }} />
              <Typography variant="h6" fontWeight="bold">{formatCurrency(stats?.totalEarnings || 0)}</Typography>
              <Typography variant="caption" color="text.secondary">Total Ganado</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4}>
          <Card sx={{ textAlign: 'center', borderRadius: 2, height: '100%' }}>
            <CardContent sx={{ py: 2 }}>
              <BikeIcon sx={{ color: 'info.main', mb: 0.5 }} />
              <Typography variant="h6" fontWeight="bold">{stats?.totalServices || 0}</Typography>
              <Typography variant="caption" color="text.secondary">Servicios</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4}>
          <Card sx={{ textAlign: 'center', borderRadius: 2, height: '100%' }}>
            <CardContent sx={{ py: 2 }}>
              <StarIcon sx={{ color: 'warning.main', mb: 0.5 }} />
              <Typography variant="h6" fontWeight="bold">{driverData?.rating?.toFixed(1) || '5.0'}</Typography>
              <Typography variant="caption" color="text.secondary">Rating</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Current Active Service */}
      {currentService && (
        <Card sx={{ borderRadius: 2, border: 2, borderColor: 'primary.main' }}>
          <CardHeader
            avatar={<BikeIcon color="primary" />}
            title={
              <Typography variant="subtitle1" fontWeight="bold" color="primary">
                SERVICIO ACTIVO
              </Typography>
            }
            subheader={`ID: ${currentService.serviceId}`}
            action={
              <Chip
                label={getStatusConfig(currentService.status).label}
                color={getStatusConfig(currentService.status).color}
                size="small"
              />
            }
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

            {/* ============================================ */}
            {/* INFORMACIÓN DE PAGO */}
            {/* ============================================ */}
            {currentService.paymentMethod === 'pagado' && (
              <Paper sx={{ p: 2, mt: 2, bgcolor: alpha(theme.palette.info.main, 0.1), borderRadius: 2, border: 1, borderColor: 'info.main' }}>
                <Typography variant="body2" fontWeight="medium" color="info.dark">
                  ✅ Cliente ya pagó - Solo entregar pedido
                </Typography>
                <Typography variant="caption" color="info.dark" sx={{ mt: 0.5, display: 'block' }}>
                  El repartidor NO debe cobrar nada al cliente
                </Typography>
              </Paper>
            )}

            {currentService.paymentMethod === 'efectivo' && currentService.paysWith > 0 && currentService.paysWith === currentService.amountToCollect && (
              <Paper sx={{ p: 2, mt: 2, bgcolor: alpha(theme.palette.success.main, 0.1), borderRadius: 2, border: 1, borderColor: 'success.main' }}>
                <Typography variant="body2" fontWeight="medium" color="success.dark">
                  ✅ Pago exacto - No requiere cambio
                </Typography>
                <Typography variant="caption" color="success.dark" sx={{ mt: 0.5, display: 'block' }}>
                  El cliente pagará ${currentService.amountToCollect?.toFixed(2) || '0.00'} exacto
                </Typography>
              </Paper>
            )}

            {currentService.paymentMethod === 'efectivo' && currentService.changeAmount > 0 && (
              <Paper sx={{ p: 2, mt: 2, bgcolor: alpha(theme.palette.warning.main, 0.1), borderRadius: 2, border: 1, borderColor: 'warning.main' }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="h6" fontWeight="bold" color="warning.dark">
                    💵 Cambio a llevar: ${currentService.changeAmount.toFixed(2)}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="warning.dark" sx={{ mt: 0.5, display: 'block' }}>
                  💡 El repartidor debe pedir este monto al restaurante
                </Typography>
                <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                  <Typography variant="caption" color="text.secondary">
                    Cliente paga: ${currentService.paysWith?.toFixed(2) || '0.00'} • A cobrar: ${currentService.amountToCollect?.toFixed(2) || '0.00'}
                  </Typography>
                </Box>
              </Paper>
            )}

            {currentService.paymentMethod === 'efectivo' && !currentService.changeAmount && currentService.amountToCollect > 0 && (
              <Paper sx={{ p: 2, mt: 2, bgcolor: alpha(theme.palette.warning.main, 0.1), borderRadius: 2, border: 1, borderColor: 'warning.main' }}>
                <Typography variant="body2" fontWeight="medium" color="warning.dark">
                  💵 Cobrar al cliente: ${currentService.amountToCollect?.toFixed(2) || '0.00'}
                </Typography>
              </Paper>
            )}

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
                <IconButton onClick={() => {
                  const address = encodeURIComponent(currentService.deliveryAddress + ', Maracay, Venezuela')
                  window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank')
                }} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                  <LocationIcon color="primary" />
                </IconButton>
              </Tooltip>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Servicios disponibles - Broadcast */}
      {isOnline && !currentService && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <NotificationIcon sx={{ color: 'primary.main' }} />
              Servicios Disponibles
            </Typography>
            {broadcastServices.length > 0 && (
              <Chip label={`${broadcastServices.length} disponible${broadcastServices.length > 1 ? 's' : ''}`} color="primary" size="small" />
            )}
          </Box>

          {broadcastLoading && broadcastServices.length === 0 && (
            <Card sx={{ p: 3, textAlign: 'center' }}>
              <CircularProgress size={32} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Buscando servicios...</Typography>
            </Card>
          )}

          {broadcastServices.length === 0 && !broadcastLoading && (
            <Card sx={{ p: 3, textAlign: 'center', bgcolor: alpha(theme.palette.info.main, 0.1) }}>
              <BikeIcon sx={{ fontSize: 48, color: 'info.main', mb: 1 }} />
              <Typography variant="body1" color="text.secondary">
                No hay servicios disponibles en tu zona por ahora.
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Te notificaremos cuando llegue uno nuevo.
              </Typography>
            </Card>
          )}

          {broadcastServices.map(service => (
            <BroadcastNotificationCard
              key={service.id || service.serviceId}
              service={service}
              onAccept={handleAcceptBroadcastService}
              onReject={handleRejectBroadcastService}
              isAccepting={acceptingServiceId === (service.serviceId || service.id)}
              commissionRate={appSettings.commissionRate}
            />
          ))}
        </Box>
      )}

      {/* Confirm Dialog */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ open: false, type: '', service: null })}>
        <DialogTitle>
          {confirmDialog.type === 'complete' ? '¿Completar entrega?' : '¿Aceptar servicio?'}
        </DialogTitle>
        <DialogContent>
          {confirmDialog.type === 'complete' ? (
            <Typography>¿Confirmas que has entregado el pedido al cliente?</Typography>
          ) : (
            <Typography>¿Deseas aceptar este servicio?</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, type: '', service: null })}>Cancelar</Button>
          <Button
            variant="contained"
            color={confirmDialog.type === 'complete' ? 'success' : 'primary'}
            onClick={() => {
              if (confirmDialog.type === 'complete') {
                handleCompleteService(confirmDialog.service)
              } else {
                handleAcceptService(confirmDialog.service)
              }
            }}
          >
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Chat Button */}
      {currentService && driverData && (
        <ChatButton
          service={currentService}
          currentUser={{
            id: driverData.id,
            name: driverData.name,
            role: 'driver'
          }}
          otherParty={{
            name: currentService.restaurantName || 'Restaurante'
          }}
          unreadCount={chatUnreadCounts[currentService.id] || 0}
          variant="fab"
          onChatOpen={handleChatOpen}
          onChatClose={handleChatClose}
        />
      )}

      <VersionFooter />
    </Box>
  )
}
