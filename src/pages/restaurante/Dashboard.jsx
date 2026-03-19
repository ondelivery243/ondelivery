import { useState, useEffect, useRef } from 'react'
import { alpha } from '@mui/material/styles'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Grid,
  Chip,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  useMediaQuery,
  Paper,
  LinearProgress,
  Collapse,
  IconButton,
  Tooltip,
  Tab,
  Tabs,
  Badge,
  Alert
} from '@mui/material'
import {
  Add as AddIcon,
  TwoWheeler as DeliveryIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Inventory as PackageIcon,
  CheckCircle as CheckIcon,
  AccessTime as ClockIcon,
  Cancel as CancelIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Refresh as RefreshIcon,
  AttachMoney as MoneyIcon,
  Chat as ChatIcon,
  Star as StarIcon,
  Map as MapIcon,
  List as ListIcon,
  Notifications as NotificationIcon,
  Circle as CircleIcon
} from '@mui/icons-material'
import { useSnackbar } from 'notistack'
import { formatCurrency, formatTime, formatDate, useRestaurantStore, useStore } from '../../store/useStore'
import { 
  subscribeToRestaurantServices,
  subscribeToZones,
  getRestaurantByUserId,
  getRestaurant,
  getRestaurantStats,
  createService,
  getSettings  // ✅ AGREGAR ESTA IMPORTACIÓN
} from '../../services/firestore'
import { canRateService } from '../../services/ratingService'
import { ChatButton } from '../../components/chat'
import { RatingModal, RatingBadge } from '../../components/rating'
import { ServiceTracker } from '../../components/tracking'
import { subscribeToChatRoom } from '../../services/chatService'

// Componente para tabs
function TabPanel({ value, index, children }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null
}

// Sonido de notificación
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime)
    oscillator.frequency.setValueAtTime(1108.73, audioContext.currentTime + 0.1)
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.3)
    
    setTimeout(() => audioContext.close(), 500)
  } catch (e) {
    console.log('Audio no disponible')
  }
}

export default function RestauranteDashboard() {
  const { enqueueSnackbar } = useSnackbar()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { restaurantData, setRestaurantData } = useRestaurantStore()
  const { user } = useStore()
  
  const [services, setServices] = useState([])
  const [zones, setZones] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [chatService, setChatService] = useState(null)
  
  // ✅ AGREGAR: Estado para configuración de la app
  const [appSettings, setAppSettings] = useState({
    commissionRate: 20,
    minDeliveryFee: 1.50
  })
  
  // Tab state para vista de servicios activos
  const [activeTab, setActiveTab] = useState(0)
  
  // Servicio seleccionado para ver en el tracker
  const [trackingService, setTrackingService] = useState(null)
  
  // Rating modal state
  const [ratingModal, setRatingModal] = useState({ 
    open: false, 
    service: null, 
    driver: null 
  })
  const [shownRatingModals, setShownRatingModals] = useState(new Set())
  
  // Chat notifications state
  const [chatUnreadCounts, setChatUnreadCounts] = useState({}) // { serviceId: count }
  const [showChatAlert, setShowChatAlert] = useState(false)
  const [lastChatMessage, setLastChatMessage] = useState(null)
  const chatUnsubscribers = useRef([])
  const prevUnreadTotal = useRef(0)
  
  const [openDialog, setOpenDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  
  const [nuevoServicio, setNuevoServicio] = useState({
    zona: '',
    direccion: '',
    cliente: '',
    telefono: '',
    metodoPago: 'efectivo',
    montoCobrar: '',
    notas: ''
  })

  // ✅ AGREGAR: Cargar configuración de la app
  useEffect(() => {
    const loadAppSettings = async () => {
      try {
        const settings = await getSettings()
        if (settings) {
          console.log('📋 Configuración cargada:', settings)
          setAppSettings({
            commissionRate: settings.commissionRate || 20,
            minDeliveryFee: settings.minDeliveryFee || 1.50
          })
        }
      } catch (error) {
        console.error('Error cargando configuración:', error)
      }
    }
    loadAppSettings()
  }, [])

  // Cargar datos del restaurante y suscribirse a servicios
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      
      console.log('🔍 Dashboard - Usuario actual:', user)
      console.log('🔍 Dashboard - restaurantData actual:', restaurantData)
      
      // Cargar zonas disponibles
      const unsubZones = subscribeToZones((zonesData) => {
        setZones(zonesData.filter(z => z.active))
      })
      
      // Cargar datos del restaurante si no están en el store
      let restaurant = restaurantData
      if (!restaurant && user) {
        console.log('🔍 Buscando restaurante - user.restaurantId:', user.restaurantId)
        console.log('🔍 Buscando restaurante - user.uid:', user.uid)
        
        if (user.restaurantId) {
          console.log('🔍 Buscando por restaurantId:', user.restaurantId)
          restaurant = await getRestaurant(user.restaurantId)
          console.log('🔍 Resultado getRestaurant:', restaurant)
        } else {
          console.log('🔍 Buscando por userId:', user.uid)
          restaurant = await getRestaurantByUserId(user.uid)
          console.log('🔍 Resultado getRestaurantByUserId:', restaurant)
        }
        
        if (restaurant) {
          console.log('✅ Restaurante encontrado:', restaurant)
          setRestaurantData(restaurant)
        } else {
          console.log('❌ No se encontró restaurante')
        }
      }
      
      // Suscribirse a servicios del restaurante
      if (restaurant?.id) {
        console.log('🔍 Suscribiéndose a servicios del restaurante:', restaurant.id)
        const unsubServices = subscribeToRestaurantServices(restaurant.id, (servicesData) => {
          console.log('📦 Servicios recibidos:', servicesData.length)
          setServices(servicesData)
          setLoading(false)
        })
        
        // Cargar estadísticas
        const statsData = await getRestaurantStats(restaurant.id)
        setStats(statsData)
        
        return () => {
          unsubZones()
          unsubServices()
        }
      } else {
        console.log('⚠️ No hay restaurante para suscribirse a servicios')
        setLoading(false)
      }
      
      return () => {
        unsubZones()
      }
    }
    
    loadData()
  }, [restaurantData, setRestaurantData, user])

  // Suscribirse a notificaciones de chat de servicios activos
  useEffect(() => {
    // Limpiar suscripciones anteriores
    chatUnsubscribers.current.forEach(unsub => unsub())
    chatUnsubscribers.current = []
    
    // Solo suscribirse a servicios activos
    const activeServices = services.filter(s => 
      s.status === 'pendiente' || s.status === 'asignado' || s.status === 'en_camino'
    )
    
    activeServices.forEach(service => {
      const unsubscribe = subscribeToChatRoom(service.id, (room) => {
        if (room) {
          const unreadCount = room.unreadByRestaurant || 0
          
          setChatUnreadCounts(prev => {
            const newCounts = { ...prev }
            const prevCount = prev[service.id] || 0
            
            // Detectar nuevo mensaje (aumentó el contador)
            if (unreadCount > prevCount && prevCount !== 0 && !chatService?.id) {
              // Sonido de notificación
              playNotificationSound()
              
              // Vibrar en móvil
              if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200])
              }
              
              // Mostrar alerta
              setLastChatMessage({
                serviceName: service.driverName || service.zoneName,
                message: room.lastMessage,
                serviceId: service.id
              })
              setShowChatAlert(true)
              
              // Notificación del sistema
              if (Notification.permission === 'granted') {
                new Notification('💬 Nuevo mensaje', {
                  body: `${service.driverName || 'Repartidor'}: ${room.lastMessage?.substring(0, 50)}...`,
                  icon: '/icon-192.png'
                })
              }
            }
            
            newCounts[service.id] = unreadCount
            return newCounts
          })
        }
      })
      
      chatUnsubscribers.current.push(unsubscribe)
    })
    
    return () => {
      chatUnsubscribers.current.forEach(unsub => unsub())
      chatUnsubscribers.current = []
    }
  }, [services, chatService])

  // Calcular total de mensajes no leídos
  const totalUnread = Object.values(chatUnreadCounts).reduce((sum, count) => sum + count, 0)

  // Recargar estadísticas cuando cambien los servicios
  useEffect(() => {
    const loadStats = async () => {
      if (restaurantData?.id) {
        const statsData = await getRestaurantStats(restaurantData.id)
        setStats(statsData)
      }
    }
    if (services.length > 0) {
      loadStats()
    }
  }, [services, restaurantData])

  // Detectar servicios recién entregados para mostrar modal de calificación
  useEffect(() => {
    const checkForRating = async () => {
      if (!restaurantData?.id || ratingModal.open) return
      
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
      
      for (const service of services) {
        if (service.status !== 'entregado') continue
        if (!service.driverId) continue
        if (shownRatingModals.has(service.id)) continue
        
        const completedAt = service.completedAt?.toDate?.() || service.updatedAt?.toDate?.()
        if (!completedAt || completedAt < fiveMinutesAgo) continue
        
        try {
          const canRate = await canRateService(service.id, restaurantData.id)
          if (canRate) {
            console.log('⭐ Servicio para calificar encontrado:', service.serviceId)
            
            setRatingModal({
              open: true,
              service: {
                ...service,
                id: service.id
              },
              driver: {
                id: service.driverId,
                name: service.driverName || 'Repartidor',
                rating: service.driverRating,
                totalServices: service.driverTotalServices
              }
            })
            setShownRatingModals(prev => new Set([...prev, service.id]))
            break
          }
        } catch (error) {
          console.error('Error verificando calificación:', error)
        }
      }
    }
    
    checkForRating()
  }, [services, restaurantData?.id, ratingModal.open, shownRatingModals])

  // Función para abrir manualmente el modal de calificación
  const handleOpenRating = async (service) => {
    if (!restaurantData?.id) {
      enqueueSnackbar('Error: No hay datos del restaurante', { variant: 'error' })
      return
    }
    
    if (!service?.id) {
      enqueueSnackbar('Error: Servicio no válido', { variant: 'error' })
      return
    }
    
    if (!service?.driverId) {
      enqueueSnackbar('Este servicio no tiene repartidor asignado', { variant: 'warning' })
      return
    }
    
    try {
      const canRate = await canRateService(service.id, restaurantData.id)
      if (!canRate) {
        enqueueSnackbar('Ya calificaste este servicio', { variant: 'info' })
        return
      }
      
      setRatingModal({
        open: true,
        service: { ...service, id: service.id },
        driver: {
          id: service.driverId,
          name: service.driverName || 'Repartidor',
          rating: service.driverRating,
          totalServices: service.driverTotalServices
        }
      })
    } catch (error) {
      console.error('Error al abrir calificación:', error)
      enqueueSnackbar('Error al verificar calificación', { variant: 'error' })
    }
  }

  const handleRatingComplete = () => {
    if (ratingModal.service?.id) {
      setShownRatingModals(prev => new Set([...prev, ratingModal.service.id]))
    }
    setRatingModal({ open: false, service: null, driver: null })
  }

  const handleRatingSkip = () => {
    if (ratingModal.service?.id) {
      setShownRatingModals(prev => new Set([...prev, ratingModal.service.id]))
    }
    setRatingModal({ open: false, service: null, driver: null })
  }

  // ✅ CORREGIDO: Usar configuración del admin
  const handleCrearServicio = async () => {
    if (!nuevoServicio.zona || !nuevoServicio.direccion) {
      enqueueSnackbar('Por favor completa los campos requeridos', { variant: 'warning' })
      return
    }

    if (!restaurantData?.id) {
      enqueueSnackbar('Error: No se encontraron datos del restaurante', { variant: 'error' })
      return
    }

    setSaving(true)
    
    const zona = zones.find(z => z.id === nuevoServicio.zona)
    
    // ✅ CORREGIDO: Usar commissionRate de la configuración
    const deliveryFee = zona?.price || 0
    const commissionRate = appSettings.commissionRate || 20
    const platformFee = deliveryFee * (commissionRate / 100)
    const driverEarnings = deliveryFee - platformFee
    
    console.log('💰 Creando servicio con comisión:', {
      deliveryFee,
      commissionRate,
      platformFee,
      driverEarnings
    })
    
    const result = await createService({
      restaurantId: restaurantData.id,
      restaurantName: restaurantData.name,
      restaurantAddress: restaurantData.address || '',
      zoneId: nuevoServicio.zona,
      zoneName: zona?.name || '',
      deliveryAddress: nuevoServicio.direccion,
      clientName: nuevoServicio.cliente,
      clientPhone: nuevoServicio.telefono,
      paymentMethod: nuevoServicio.metodoPago,
      amountToCollect: parseFloat(nuevoServicio.montoCobrar) || 0,
      notes: nuevoServicio.notas,
      deliveryFee,
      commissionRate,  // ✅ GUARDAR la tasa usada
      platformFee,
      driverEarnings,
      settled: false
    })
    
    setSaving(false)
    
    if (result.success) {
      enqueueSnackbar(`Servicio ${result.serviceId} creado. Tarifa: ${formatCurrency(deliveryFee)}`, { variant: 'success' })
      setOpenDialog(false)
      setNuevoServicio({ zona: '', direccion: '', cliente: '', telefono: '', metodoPago: 'efectivo', montoCobrar: '', notas: '' })
    } else {
      enqueueSnackbar(result.error || 'Error al crear servicio', { variant: 'error' })
    }
  }

  const getStatusConfig = (status) => {
    const configs = {
      pendiente: { color: 'warning', label: 'Pendiente', icon: <ClockIcon /> },
      asignado: { color: 'info', label: 'Asignado', icon: <DeliveryIcon /> },
      en_camino: { color: 'primary', label: 'En Camino', icon: <DeliveryIcon /> },
      entregado: { color: 'success', label: 'Entregado', icon: <CheckIcon /> },
      cancelado: { color: 'error', label: 'Cancelado', icon: <CancelIcon /> }
    }
    return configs[status] || configs.pendiente
  }

  const serviciosRecientes = services.slice(0, 5)
  
  const serviciosActivos = services.filter(s => 
    s.status === 'pendiente' || s.status === 'asignado' || s.status === 'en_camino'
  )

  const handleContactDriver = (phone) => {
    if (phone) {
      window.open(`tel:${phone}`, '_self')
    }
  }

  // Abrir chat desde notificación
  const handleOpenChatFromAlert = (serviceId) => {
    const service = services.find(s => s.id === serviceId)
    if (service) {
      setChatService(service)
      setShowChatAlert(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {loading && <LinearProgress />}
      
      {/* Alerta de nuevo mensaje */}
      {showChatAlert && lastChatMessage && (
        <Alert
          severity="info"
          icon={<ChatIcon />}
          sx={{ 
            borderRadius: 2,
            animation: 'slideIn 0.3s ease-out',
            '@keyframes slideIn': {
              '0%': { transform: 'translateY(-20px)', opacity: 0 },
              '100%': { transform: 'translateY(0)', opacity: 1 }
            }
          }}
          action={
            <Stack direction="row" spacing={1}>
              <Button 
                size="small" 
                variant="outlined"
                onClick={() => handleOpenChatFromAlert(lastChatMessage.serviceId)}
              >
                Ver
              </Button>
              <IconButton size="small" onClick={() => setShowChatAlert(false)}>
                <CollapseIcon />
              </IconButton>
            </Stack>
          }
        >
          <Typography variant="subtitle2" fontWeight="bold">
            💬 Nuevo mensaje de {lastChatMessage.serviceName}
          </Typography>
          <Typography variant="body2">
            {lastChatMessage.message?.substring(0, 60)}...
          </Typography>
        </Alert>
      )}
      
      {/* Sin datos de restaurante */}
      {!loading && !restaurantData && (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <DeliveryIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No se encontraron datos del restaurante
            </Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
              Si acabas de registrarte, espera a que un administrador active tu cuenta.
            </Typography>
            <Typography variant="caption" color="text.disabled">
              Usuario: {user?.email || 'No disponible'}
            </Typography>
          </CardContent>
        </Card>
      )}
      
      {/* Contenido principal */}
      {restaurantData && (
        <>
          {/* Header */}
          <Stack 
            direction={{ xs: 'column', sm: 'row' }} 
            justifyContent="space-between" 
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            spacing={{ xs: 1, sm: 0 }}
          >
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold">
                  Dashboard
                </Typography>
                {totalUnread > 0 && (
                  <Badge badgeContent={totalUnread} color="error">
                    <NotificationIcon color="primary" />
                  </Badge>
                )}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Solicita y gestiona tus servicios de delivery
              </Typography>
            </Box>
            <Button
              variant="contained"
              size={isMobile ? 'medium' : 'large'}
              startIcon={<AddIcon />}
              onClick={() => setOpenDialog(true)}
              fullWidth={isMobile}
            >
              Nuevo Servicio
            </Button>
          </Stack>

          {/* Stats Cards */}
          <Grid container spacing={{ xs: 1.5, sm: 3 }}>
            <Grid item xs={4}>
              <Card sx={{ bgcolor: 'primary.main', color: 'white', height: '100%' }}>
                <CardContent sx={{ p: { xs: 1.5, sm: 2 }, textAlign: 'center' }}>
                  <Typography variant={isMobile ? 'caption' : 'body2'} sx={{ opacity: 0.9 }}>
                    Servicios Hoy
                  </Typography>
                  <Typography variant={isMobile ? 'h5' : 'h3'} fontWeight="bold">
                    {stats?.servicesToday || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={4}>
              <Card sx={{ bgcolor: 'success.main', color: 'white', height: '100%' }}>
                <CardContent sx={{ p: { xs: 1.5, sm: 2 }, textAlign: 'center' }}>
                  <Typography variant={isMobile ? 'caption' : 'body2'} sx={{ opacity: 0.9 }}>
                    Total del Mes
                  </Typography>
                  <Typography variant={isMobile ? 'h5' : 'h3'} fontWeight="bold">
                    {formatCurrency(stats?.monthlyTotal || 0)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={4}>
              <Card sx={{ bgcolor: 'warning.main', color: 'white', height: '100%' }}>
                <CardContent sx={{ p: { xs: 1.5, sm: 2 }, textAlign: 'center' }}>
                  <Typography variant={isMobile ? 'caption' : 'body2'} sx={{ opacity: 0.9 }}>
                    Por Pagar
                  </Typography>
                  <Typography variant={isMobile ? 'h5' : 'h3'} fontWeight="bold">
                    {formatCurrency(stats?.pendingPayment || 0)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Servicios Activos con Tabs */}
          {serviciosActivos.length > 0 && (
            <Card sx={{ borderRadius: 2, border: 2, borderColor: 'primary.light' }}>
              <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                  <DeliveryIcon color="primary" />
                  <Typography variant="subtitle1" fontWeight="bold">
                    Servicios Activos ({serviciosActivos.length})
                  </Typography>
                  {totalUnread > 0 && (
                    <Chip 
                      icon={<ChatIcon />}
                      label={`${totalUnread} mensajes`}
                      color="error"
                      size="small"
                      sx={{ ml: 1 }}
                    />
                  )}
                </Stack>
                
                <Tabs 
                  value={activeTab} 
                  onChange={(e, v) => setActiveTab(v)}
                  variant="fullWidth"
                  sx={{ mb: 2 }}
                >
                  <Tab icon={<ListIcon />} label="Lista" id="tab-0" />
                  <Tab icon={<MapIcon />} label="Seguimiento" id="tab-1" />
                </Tabs>
                
                {/* Tab Panel: Lista de servicios */}
                <TabPanel value={activeTab} index={0}>
                  <Stack spacing={1.5}>
                    {serviciosActivos.map((servicio) => {
                      const status = getStatusConfig(servicio.status)
                      const hasDriver = servicio.driverId && servicio.status !== 'pendiente'
                      const unreadCount = chatUnreadCounts[servicio.id] || 0
                      
                      return (
                        <Paper
                          key={servicio.id}
                          variant="outlined"
                          sx={{
                            p: { xs: 1.5, sm: 2 },
                            borderRadius: 2,
                            bgcolor: unreadCount > 0 
                              ? alpha(theme.palette.error.main, 0.05)
                              : alpha(theme.palette.primary.main, 0.02),
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            border: unreadCount > 0 ? 2 : 1,
                            borderColor: unreadCount > 0 ? 'error.main' : 'divider',
                            '&:hover': {
                              bgcolor: unreadCount > 0 
                                ? alpha(theme.palette.error.main, 0.1)
                                : alpha(theme.palette.primary.main, 0.05),
                              borderColor: unreadCount > 0 ? 'error.main' : 'primary.main'
                            }
                          }}
                          onClick={() => {
                            setTrackingService(servicio)
                            setActiveTab(1)
                          }}
                        >
                          <Grid container spacing={1} alignItems="center">
                            <Grid item xs={12} sm={3}>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="subtitle2" fontWeight="bold">
                                  ID: {servicio.serviceId}
                                </Typography>
                                {unreadCount > 0 && (
                                  <Badge badgeContent={unreadCount} color="error">
                                    <ChatIcon fontSize="small" color="error" />
                                  </Badge>
                                )}
                              </Stack>
                              <Typography variant="caption" color="text.secondary">
                                {formatTime(servicio.createdAt)}
                              </Typography>
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <LocationIcon fontSize="small" color="action" sx={{ fontSize: 16 }} />
                                <Typography variant="body2" noWrap>
                                  {servicio.zoneName} - {servicio.deliveryAddress}
                                </Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={6} sm={2}>
                              <Typography variant="body2" fontWeight="bold" color="primary">
                                {formatCurrency(servicio.deliveryFee)}
                              </Typography>
                            </Grid>
                            <Grid item xs={6} sm={1.5}>
                              <Chip
                                icon={status.icon}
                                label={status.label}
                                size="small"
                                color={status.color}
                                sx={{ 
                                  fontSize: { xs: '0.65rem', sm: '0.75rem' },
                                  height: { xs: 24, sm: 28 },
                                  '& .MuiChip-label': { px: { xs: 0.5, sm: 1 }, whiteSpace: 'nowrap' }
                                }}
                              />
                            </Grid>
                            <Grid item xs={12} sm={1.5} sx={{ textAlign: 'right' }}>
                              <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                {hasDriver && servicio.status !== 'entregado' && (
                                  <Tooltip title={unreadCount > 0 ? `${unreadCount} mensajes nuevos` : 'Chat'}>
                                    <IconButton
                                      size="small"
                                      color={unreadCount > 0 ? 'error' : 'primary'}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setChatService(servicio)
                                      }}
                                      sx={{ 
                                        bgcolor: unreadCount > 0 ? 'error.main' : 'primary.main', 
                                        color: 'white',
                                        '&:hover': { bgcolor: unreadCount > 0 ? 'error.dark' : 'primary.dark' },
                                        ...(unreadCount > 0 && {
                                          animation: 'pulse 1.5s infinite'
                                        })
                                      }}
                                    >
                                      <ChatIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Stack>
                            </Grid>
                          </Grid>
                          {hasDriver && servicio.driverName && (
                            <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <DeliveryIcon fontSize="small" color="success" />
                                <Typography variant="caption" color="text.secondary">
                                  Repartidor: <strong>{servicio.driverName}</strong>
                                </Typography>
                                {unreadCount > 0 && (
                                  <Chip 
                                    label={`${unreadCount} nuevos`}
                                    size="small"
                                    color="error"
                                    sx={{ height: 20, fontSize: '0.65rem' }}
                                  />
                                )}
                              </Stack>
                            </Box>
                          )}
                        </Paper>
                      )
                    })}
                  </Stack>
                </TabPanel>
                
                {/* Tab Panel: Seguimiento */}
                <TabPanel value={activeTab} index={1}>
                  {trackingService ? (
                    <Box>
                      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                        <InputLabel>Seleccionar servicio para seguir</InputLabel>
                        <Select
                          value={trackingService.id}
                          label="Seleccionar servicio para seguir"
                          onChange={(e) => {
                            const selected = serviciosActivos.find(s => s.id === e.target.value)
                            setTrackingService(selected)
                          }}
                        >
                          {serviciosActivos.map((servicio) => {
                            const unread = chatUnreadCounts[servicio.id] || 0
                            return (
                              <MenuItem key={servicio.id} value={servicio.id}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  ID: {servicio.serviceId} - {servicio.zoneName}
                                  {unread > 0 && (
                                    <Chip label={`${unread}`} size="small" color="error" />
                                  )}
                                </Stack>
                              </MenuItem>
                            )
                          })}
                        </Select>
                      </FormControl>
                      
                      <ServiceTracker
                        service={trackingService}
                        onContactDriver={handleContactDriver}
                        onChatDriver={(driverId) => setChatService(trackingService)}
                        showMap={true}
                        compact={isMobile}
                      />
                    </Box>
                  ) : (
                    <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
                      <MapIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                      <Typography variant="body2" color="text.secondary">
                        Selecciona un servicio para ver el seguimiento
                      </Typography>
                    </Paper>
                  )}
                </TabPanel>
              </CardContent>
            </Card>
          )}

          {/* Recent Services */}
          <Card>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PackageIcon color="primary" />
                  <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold">
                    Servicios Recientes
                  </Typography>
                </Stack>
              </Stack>
              
              {serviciosRecientes.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
                  <PackageIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    No hay servicios registrados
                  </Typography>
                </Paper>
              ) : (
                <Stack spacing={{ xs: 1, sm: 2 }}>
                  {serviciosRecientes.map((servicio) => {
                    const status = getStatusConfig(servicio.status)
                    const isExpanded = expandedId === servicio.id
                    
                    return (
                      <Card key={servicio.id} variant="outlined" sx={{ borderRadius: 2 }}>
                        <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
                          {isMobile ? (
                            <>
                              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                <Box>
                                  <Typography variant="subtitle2" fontWeight="bold">
                                    ID: {servicio.serviceId}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {formatDate(servicio.createdAt)} - {formatTime(servicio.createdAt)}
                                  </Typography>
                                </Box>
                                <Chip
                                  icon={status.icon}
                                  label={status.label}
                                  size="small"
                                  color={status.color}
                                  sx={{ fontSize: '0.7rem', height: 26, '& .MuiChip-label': { px: 0.75 } }}
                                />
                              </Stack>
                              
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, minWidth: 0 }}>
                                  <LocationIcon fontSize="small" color="action" sx={{ fontSize: 14 }} />
                                  <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                                    {servicio.zoneName} - {servicio.deliveryAddress}
                                  </Typography>
                                </Box>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                  <Typography variant="body2" fontWeight="bold" color="primary">
                                    {formatCurrency(servicio.deliveryFee)}
                                  </Typography>
                                  <IconButton size="small" onClick={() => setExpandedId(isExpanded ? null : servicio.id)}>
                                    {isExpanded ? <CollapseIcon fontSize="small" /> : <ExpandIcon fontSize="small" />}
                                  </IconButton>
                                </Stack>
                              </Stack>
                            </>
                          ) : (
                            <Grid container spacing={2} alignItems="center">
                              <Grid item xs={12} sm={3}>
                                <Typography variant="subtitle2" fontWeight="bold">
                                  ID: {servicio.serviceId}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {formatDate(servicio.createdAt)} - {formatTime(servicio.createdAt)}
                                </Typography>
                              </Grid>
                              <Grid item xs={12} sm={4}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <LocationIcon fontSize="small" color="action" sx={{ fontSize: 18 }} />
                                  <Typography variant="body2" noWrap>
                                    {servicio.zoneName} - {servicio.deliveryAddress}
                                  </Typography>
                                </Box>
                              </Grid>
                              <Grid item xs={6} sm={2}>
                                <Typography variant="body2" fontWeight="bold" color="primary">
                                  {formatCurrency(servicio.deliveryFee)}
                                </Typography>
                              </Grid>
                              <Grid item xs={6} sm={2}>
                                <Chip
                                  icon={status.icon}
                                  label={status.label}
                                  size="small"
                                  color={status.color}
                                  sx={{ fontSize: '0.75rem', height: 28, '& .MuiChip-label': { px: 1 } }}
                                />
                              </Grid>
                              <Grid item xs={12} sm={1} sx={{ textAlign: 'right' }}>
                                <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                  {servicio.status === 'entregado' && servicio.driverId && (
                                    <Tooltip title="Calificar servicio">
                                      <IconButton
                                        size="small"
                                        color="warning"
                                        onClick={() => handleOpenRating(servicio)}
                                        sx={{ bgcolor: 'warning.main', color: 'white', '&:hover': { bgcolor: 'warning.dark' } }}
                                      >
                                        <StarIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                  <IconButton size="small" onClick={() => setExpandedId(isExpanded ? null : servicio.id)}>
                                    {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
                                  </IconButton>
                                </Stack>
                              </Grid>
                            </Grid>
                          )}
                          
                          <Collapse in={isExpanded}>
                            <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                              <Grid container spacing={2}>
                                <Grid item xs={6}>
                                  <Typography variant="caption" color="text.secondary">Cliente</Typography>
                                  <Typography variant="body2">{servicio.clientName || 'No especificado'}</Typography>
                                </Grid>
                                <Grid item xs={6}>
                                  <Typography variant="caption" color="text.secondary">Teléfono</Typography>
                                  <Typography variant="body2">{servicio.clientPhone || '-'}</Typography>
                                </Grid>
                                <Grid item xs={6}>
                                  <Typography variant="caption" color="text.secondary">Método de pago</Typography>
                                  <Typography variant="body2">
                                    {servicio.paymentMethod === 'efectivo' ? 'Efectivo' : 
                                     servicio.paymentMethod === 'transferencia' ? 'Transferencia' : 'Pagado'}
                                  </Typography>
                                </Grid>
                                <Grid item xs={6}>
                                  <Typography variant="caption" color="text.secondary">Repartidor</Typography>
                                  <Typography variant="body2">{servicio.driverName || 'Sin asignar'}</Typography>
                                </Grid>
                                {servicio.notes && (
                                  <Grid item xs={12}>
                                    <Typography variant="caption" color="text.secondary">Notas</Typography>
                                    <Typography variant="body2">{servicio.notes}</Typography>
                                  </Grid>
                                )}
                              </Grid>
                            </Paper>
                          </Collapse>
                        </CardContent>
                      </Card>
                    )
                  })}
                </Stack>
              )}
            </CardContent>
          </Card>

          {/* New Service Dialog */}
          <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
            <DialogTitle sx={{ pb: 1 }}>
              <Stack direction="row" alignItems="center" gap={1}>
                <DeliveryIcon color="primary" />
                <Typography variant="h6" fontWeight="bold">Solicitar Nuevo Servicio</Typography>
              </Stack>
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ mt: 0.5 }}>
                <Grid item xs={12}>
                  <FormControl fullWidth required size={isMobile ? 'small' : 'medium'}>
                    <InputLabel>Zona de Entrega</InputLabel>
                    <Select
                      value={nuevoServicio.zona}
                      label="Zona de Entrega"
                      onChange={(e) => setNuevoServicio({ ...nuevoServicio, zona: e.target.value })}
                    >
                      {zones.map((zona) => (
                        <MenuItem key={zona.id} value={zona.id}>
                          {zona.name} - {formatCurrency(zona.price)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth required label="Dirección de Entrega" placeholder="Dirección completa del cliente"
                    value={nuevoServicio.direccion}
                    onChange={(e) => setNuevoServicio({ ...nuevoServicio, direccion: e.target.value })}
                    multiline rows={2} size={isMobile ? 'small' : 'medium'}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth label="Nombre del Cliente" placeholder="Opcional"
                    value={nuevoServicio.cliente}
                    onChange={(e) => setNuevoServicio({ ...nuevoServicio, cliente: e.target.value })}
                    size={isMobile ? 'small' : 'medium'}
                    InputProps={{ startAdornment: <InputAdornment position="start"><PersonIcon color="action" fontSize={isMobile ? 'small' : 'medium'} /></InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth label="Teléfono" placeholder="Opcional"
                    value={nuevoServicio.telefono}
                    onChange={(e) => setNuevoServicio({ ...nuevoServicio, telefono: e.target.value })}
                    size={isMobile ? 'small' : 'medium'}
                    InputProps={{ startAdornment: <InputAdornment position="start"><PhoneIcon color="action" fontSize={isMobile ? 'small' : 'medium'} /></InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size={isMobile ? 'small' : 'medium'}>
                    <InputLabel>Método de Pago</InputLabel>
                    <Select
                      value={nuevoServicio.metodoPago}
                      label="Método de Pago"
                      onChange={(e) => setNuevoServicio({ ...nuevoServicio, metodoPago: e.target.value })}
                    >
                      <MenuItem value="efectivo">Efectivo</MenuItem>
                      <MenuItem value="transferencia">Transferencia</MenuItem>
                      <MenuItem value="pagado">Pagado Online</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth label="Monto a Cobrar" type="number" placeholder="Si es en efectivo"
                    value={nuevoServicio.montoCobrar}
                    onChange={(e) => setNuevoServicio({ ...nuevoServicio, montoCobrar: e.target.value })}
                    size={isMobile ? 'small' : 'medium'}
                    disabled={nuevoServicio.metodoPago === 'pagado'}
                    InputProps={{ startAdornment: <InputAdornment position="start"><MoneyIcon color="action" fontSize={isMobile ? 'small' : 'medium'} /></InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth label="Notas Adicionales" placeholder="Instrucciones especiales para la entrega"
                    value={nuevoServicio.notas}
                    onChange={(e) => setNuevoServicio({ ...nuevoServicio, notas: e.target.value })}
                    multiline rows={2} size={isMobile ? 'small' : 'medium'}
                  />
                </Grid>
              </Grid>

              {nuevoServicio.zona && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'primary.light', borderRadius: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="primary.dark">Tarifa del servicio:</Typography>
                  <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight="bold" color="primary">
                    {formatCurrency(zones.find(z => z.id === nuevoServicio.zona)?.price || 0)}
                  </Typography>
                  {/* ✅ CORREGIDO: Usar la tasa configurada */}
                  <Typography variant="caption" color="text.secondary">
                    Incluye: {formatCurrency((zones.find(z => z.id === nuevoServicio.zona)?.price || 0) * (1 - appSettings.commissionRate / 100))} para el repartidor
                    ({100 - appSettings.commissionRate}%)
                  </Typography>
                </Box>
              )}
            </DialogContent>
            <DialogActions sx={{ p: { xs: 1.5, sm: 2 }, gap: 1 }}>
              <Button onClick={() => setOpenDialog(false)} fullWidth={isMobile}>Cancelar</Button>
              <Button variant="contained" onClick={handleCrearServicio} fullWidth={isMobile} disabled={saving}>
                {saving ? 'Creando...' : 'Crear Servicio'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Chat con Repartidor */}
          {chatService && (
            <ChatButton
              service={chatService}
              currentUser={{ id: restaurantData?.id, name: restaurantData?.name, role: 'restaurant' }}
              otherParty={{ name: chatService.driverName, role: 'driver' }}
              variant="fab"
              onChatClose={() => setChatService(null)}
            />
          )}

          {/* Modal de Calificación */}
          <RatingModal
            open={ratingModal.open}
            onClose={handleRatingSkip}
            service={ratingModal.service}
            driver={ratingModal.driver}
            restaurantId={restaurantData?.id}
            onRated={handleRatingComplete}
          />
        </>
      )}
    </Box>
  )
}