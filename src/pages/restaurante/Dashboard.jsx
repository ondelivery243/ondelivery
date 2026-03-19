// src/pages/restaurante/Dashboard.jsx
import { useState, useEffect, useRef } from 'react'
import { alpha } from '@mui/material/styles'
import {
  Box, Card, CardContent, Typography, Button, TextField, Grid, Chip, Stack,
  Select, MenuItem, FormControl, InputAdornment, Dialog, DialogTitle, DialogContent,
  DialogActions, useTheme, useMediaQuery, Paper, LinearProgress, Collapse,
  IconButton, Tooltip, Tab, Tabs, Badge, Alert
} from '@mui/material'
import {
  Add as AddIcon, TwoWheeler as DeliveryIcon, LocationOn as LocationIcon,
  Person as PersonIcon, Phone as PhoneIcon, Inventory as PackageIcon,
  CheckCircle as CheckIcon, AccessTime as ClockIcon, Cancel as CancelIcon,
  ExpandMore as ExpandIcon, ExpandLess as CollapseIcon, Refresh as RefreshIcon,
  AttachMoney as MoneyIcon, Chat as ChatIcon, Star as StarIcon, Map as MapIcon,
  List as ListIcon, Notifications as NotificationIcon
} from '@mui/icons-material'
import { useSnackbar } from 'notistack'
import { formatCurrency, formatTime, formatDate, useRestaurantStore, useStore } from '../../store/useStore'
import { 
  subscribeToRestaurantServices, subscribeToZones, getRestaurantByUserId,
  getRestaurant, getRestaurantStats, createService, getSettings
} from '../../services/firestore'
import { canRateService } from '../../services/ratingService'
import { ChatButton } from '../../components/chat'
import { RatingModal } from '../../components/rating'
import { ServiceTracker } from '../../components/tracking'
import { subscribeToChatRoom } from '../../services/chatService'

// Componente para tabs
function TabPanel({ value, index, children }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null
}

// ============================================
// 🔊 SONIDO DE NOTIFICACIÓN DE CHAT
// ============================================
let audioContextInstance = null

const initAudioContext = () => {
  if (!audioContextInstance || audioContextInstance.state === 'closed') {
    audioContextInstance = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (audioContextInstance.state === 'suspended') {
    audioContextInstance.resume()
  }
  return audioContextInstance
}

// 💬 SONIDO: NUEVO MENSAJE DE CHAT - "Ding" distintivo
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

    console.log('💬 Sonido de MENSAJE DE CHAT reproducido (Restaurante)')
  } catch (e) {
    console.log('❌ Error sonido chat:', e.message)
  }
}

// Inicializar audio en la primera interacción
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
  const [appSettings, setAppSettings] = useState({ commissionRate: 20, minDeliveryFee: 1.50 })
  const [activeTab, setActiveTab] = useState(0)
  const [trackingService, setTrackingService] = useState(null)
  const [ratingModal, setRatingModal] = useState({ open: false, service: null, driver: null })
  const [shownRatingModals, setShownRatingModals] = useState(new Set())
  const [chatUnreadCounts, setChatUnreadCounts] = useState({})
  const [showChatAlert, setShowChatAlert] = useState(false)
  const [lastChatMessage, setLastChatMessage] = useState(null)
  
  const chatUnsubscribers = useRef([])
  const chatOpenRef = useRef(false)
  const prevUnreadRef = useRef({}) // Objeto para rastrear conteos previos por servicio
  const servicesTrackedRef = useRef(new Set()) // Servicios que ya estamos trackeando
  
  const [openDialog, setOpenDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  
  const [nuevoServicio, setNuevoServicio] = useState({
    zona: '', direccion: '', cliente: '', telefono: '',
    metodoPago: 'efectivo', montoCobrar: '', notas: ''
  })

  // Cargar configuración
  useEffect(() => {
    const loadAppSettings = async () => {
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
    loadAppSettings()
  }, [])

  // Cargar datos del restaurante
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      
      const unsubZones = subscribeToZones((zonesData) => {
        setZones(zonesData.filter(z => z.active))
      })
      
      let restaurant = restaurantData
      if (!restaurant && user) {
        restaurant = user.restaurantId ? await getRestaurant(user.restaurantId) : await getRestaurantByUserId(user.uid)
        if (restaurant) setRestaurantData(restaurant)
      }
      
      if (restaurant?.id) {
        const unsubServices = subscribeToRestaurantServices(restaurant.id, (servicesData) => {
          setServices(servicesData)
          setLoading(false)
        })
        
        const statsData = await getRestaurantStats(restaurant.id)
        setStats(statsData)
        
        return () => { unsubZones(); unsubServices() }
      } else {
        setLoading(false)
      }
      
      return () => unsubZones()
    }
    
    loadData()
  }, [restaurantData, setRestaurantData, user])

  // 💬 SUSCRIPCIÓN A CHAT - Sonido cuando llega mensaje del repartidor
  useEffect(() => {
    chatUnsubscribers.current.forEach(unsub => unsub())
    chatUnsubscribers.current = []
    
    const activeServices = services.filter(s => 
      s.status === 'pendiente' || s.status === 'asignado' || s.status === 'en_camino'
    )
    
    activeServices.forEach(service => {
      const serviceId = service.id
      // Marcar que estamos empezando a trackear este servicio
      const wasAlreadyTracked = servicesTrackedRef.current.has(serviceId)
      
      const unsubscribe = subscribeToChatRoom(serviceId, (room) => {
        if (room) {
          const unreadCount = room.unreadByRestaurant || 0
          
          // Obtener conteo previo
          const prevCount = prevUnreadRef.current[serviceId] ?? 0
          
          // ✅ CORREGIDO: Detectar nuevo mensaje
          // - Ya estábamos trackeando este servicio (wasAlreadyTracked o ya tiene valor en prevUnreadRef)
          // - El contador aumentó
          // - El chat no está abierto
          const isAlreadyInitialized = wasAlreadyTracked || serviceId in prevUnreadRef.current
          const isNewMessage = isAlreadyInitialized && unreadCount > prevCount && !chatOpenRef.current
          
          if (isNewMessage) {
            console.log('💬 Nuevo mensaje detectado en servicio:', serviceId, 'prevCount:', prevCount, 'unreadCount:', unreadCount)
            
            playChatMessageSound()
            
            if (navigator.vibrate) {
              navigator.vibrate([200, 100, 200])
            }
            
            setLastChatMessage({
              serviceName: service.driverName || service.zoneName,
              message: room.lastMessage,
              serviceId: serviceId
            })
            setShowChatAlert(true)
            
            if (Notification.permission === 'granted') {
              try {
                new Notification('💬 Nuevo mensaje', {
                  body: `${service.driverName || 'Repartidor'}: ${room.lastMessage?.substring(0, 50)}...`,
                  icon: '/logo-192.png'
                })
              } catch (e) {}
            }
          }
          
          // Actualizar referencia previa y marcar como trackeado
          prevUnreadRef.current[serviceId] = unreadCount
          servicesTrackedRef.current.add(serviceId)
          
          // Actualizar estado de conteos
          setChatUnreadCounts(prev => ({
            ...prev,
            [serviceId]: unreadCount
          }))
        }
      })
      
      chatUnsubscribers.current.push(unsubscribe)
    })
    
    return () => {
      chatUnsubscribers.current.forEach(unsub => unsub())
      chatUnsubscribers.current = []
    }
  }, [services])

  const totalUnread = Object.values(chatUnreadCounts).reduce((sum, count) => sum + count, 0)

  // Recargar estadísticas
  useEffect(() => {
    const loadStats = async () => {
      if (restaurantData?.id) {
        const statsData = await getRestaurantStats(restaurantData.id)
        setStats(statsData)
      }
    }
    if (services.length > 0) loadStats()
  }, [services, restaurantData])

  // Detectar servicios para calificar
  useEffect(() => {
    const checkForRating = async () => {
      if (!restaurantData?.id || ratingModal.open) return
      
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
      
      for (const service of services) {
        if (service.status !== 'entregado' || !service.driverId) continue
        if (shownRatingModals.has(service.id)) continue
        
        const completedAt = service.completedAt?.toDate?.() || service.updatedAt?.toDate?.()
        if (!completedAt || completedAt < fiveMinutesAgo) continue
        
        try {
          const canRate = await canRateService(service.id, restaurantData.id)
          if (canRate) {
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

  const handleOpenRating = async (service) => {
    if (!restaurantData?.id || !service?.id || !service?.driverId) {
      enqueueSnackbar('Error al abrir calificación', { variant: 'error' })
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
      enqueueSnackbar('Error al verificar calificación', { variant: 'error' })
    }
  }

  const handleRatingComplete = () => {
    if (ratingModal.service?.id) setShownRatingModals(prev => new Set([...prev, ratingModal.service.id]))
    setRatingModal({ open: false, service: null, driver: null })
  }

  const handleRatingSkip = () => {
    if (ratingModal.service?.id) setShownRatingModals(prev => new Set([...prev, ratingModal.service.id]))
    setRatingModal({ open: false, service: null, driver: null })
  }

  // Crear servicio
  const handleCrearServicio = async () => {
    if (!nuevoServicio.zona) {
      enqueueSnackbar('Debes seleccionar una zona de entrega', { variant: 'warning' })
      return
    }
    if (!nuevoServicio.direccion?.trim()) {
      enqueueSnackbar('Debes ingresar la dirección de entrega', { variant: 'warning' })
      return
    }
    if (!nuevoServicio.cliente?.trim()) {
      enqueueSnackbar('Debes ingresar el nombre del cliente', { variant: 'warning' })
      return
    }
    if (!nuevoServicio.telefono?.trim()) {
      enqueueSnackbar('Debes ingresar el teléfono del cliente', { variant: 'warning' })
      return
    }
    if (!restaurantData?.id) {
      enqueueSnackbar('Error: No se encontraron datos del restaurante', { variant: 'error' })
      return
    }

    setSaving(true)
    
    const zona = zones.find(z => z.id === nuevoServicio.zona)
    const deliveryFee = zona?.price || 0
    const commissionRate = appSettings.commissionRate || 20
    const platformFee = deliveryFee * (commissionRate / 100)
    const driverEarnings = deliveryFee - platformFee
    
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
      deliveryFee, commissionRate, platformFee, driverEarnings, settled: false
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
  const serviciosActivos = services.filter(s => s.status === 'pendiente' || s.status === 'asignado' || s.status === 'en_camino')

  const handleContactDriver = (phone) => {
    if (phone) window.open(`tel:${phone}`, '_self')
  }

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
        <Alert severity="info" icon={<ChatIcon />} sx={{ borderRadius: 2 }}
          action={
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="outlined" onClick={() => handleOpenChatFromAlert(lastChatMessage.serviceId)}>Ver</Button>
              <IconButton size="small" onClick={() => setShowChatAlert(false)}><CollapseIcon /></IconButton>
            </Stack>
          }>
          <Typography variant="subtitle2" fontWeight="bold">💬 Nuevo mensaje de {lastChatMessage.serviceName}</Typography>
          <Typography variant="body2">{lastChatMessage.message?.substring(0, 60)}...</Typography>
        </Alert>
      )}
      
      {/* Sin datos de restaurante */}
      {!loading && !restaurantData && (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <DeliveryIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>No se encontraron datos del restaurante</Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>Si acabas de registrarte, espera a que un administrador active tu cuenta.</Typography>
            <Typography variant="caption" color="text.disabled">Usuario: {user?.email || 'No disponible'}</Typography>
          </CardContent>
        </Card>
      )}
      
      {/* Contenido principal */}
      {restaurantData && (
        <>
          {/* Header */}
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={{ xs: 1, sm: 0 }}>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold">Dashboard</Typography>
                {totalUnread > 0 && <Badge badgeContent={totalUnread} color="error"><NotificationIcon color="primary" /></Badge>}
              </Stack>
              <Typography variant="body2" color="text.secondary">Solicita y gestiona tus servicios de delivery</Typography>
            </Box>
            <Button variant="contained" size={isMobile ? 'medium' : 'large'} startIcon={<AddIcon />} onClick={() => setOpenDialog(true)} fullWidth={isMobile}>
              Nuevo Servicio
            </Button>
          </Stack>

          {/* Stats Cards */}
          <Grid container spacing={{ xs: 1.5, sm: 3 }}>
            <Grid item xs={4}>
              <Card sx={{ bgcolor: 'primary.main', color: 'white', height: '100%' }}>
                <CardContent sx={{ p: { xs: 1.5, sm: 2 }, textAlign: 'center' }}>
                  <Typography variant={isMobile ? 'caption' : 'body2'} sx={{ opacity: 0.9 }}>Servicios Hoy</Typography>
                  <Typography variant={isMobile ? 'h5' : 'h3'} fontWeight="bold">{stats?.servicesToday || 0}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={4}>
              <Card sx={{ bgcolor: 'success.main', color: 'white', height: '100%' }}>
                <CardContent sx={{ p: { xs: 1.5, sm: 2 }, textAlign: 'center' }}>
                  <Typography variant={isMobile ? 'caption' : 'body2'} sx={{ opacity: 0.9 }}>Total del Mes</Typography>
                  <Typography variant={isMobile ? 'h5' : 'h3'} fontWeight="bold">{formatCurrency(stats?.monthlyTotal || 0)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={4}>
              <Card sx={{ bgcolor: 'warning.main', color: 'white', height: '100%' }}>
                <CardContent sx={{ p: { xs: 1.5, sm: 2 }, textAlign: 'center' }}>
                  <Typography variant={isMobile ? 'caption' : 'body2'} sx={{ opacity: 0.9 }}>Por Pagar</Typography>
                  <Typography variant={isMobile ? 'h5' : 'h3'} fontWeight="bold">{formatCurrency(stats?.pendingPayment || 0)}</Typography>
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
                  <Typography variant="subtitle1" fontWeight="bold">Servicios Activos ({serviciosActivos.length})</Typography>
                  {totalUnread > 0 && <Chip icon={<ChatIcon />} label={`${totalUnread} mensajes`} color="error" size="small" sx={{ ml: 1 }} />}
                </Stack>
                
                <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} variant="fullWidth" sx={{ mb: 2 }}>
                  <Tab icon={<ListIcon />} label="Lista" />
                  <Tab icon={<MapIcon />} label="Seguimiento" />
                </Tabs>
                
                <TabPanel value={activeTab} index={0}>
                  <Stack spacing={1.5}>
                    {serviciosActivos.map((servicio) => {
                      const status = getStatusConfig(servicio.status)
                      const hasDriver = servicio.driverId && servicio.status !== 'pendiente'
                      const unreadCount = chatUnreadCounts[servicio.id] || 0
                      
                      return (
                        <Paper key={servicio.id} variant="outlined"
                          sx={{
                            p: { xs: 1.5, sm: 2 }, borderRadius: 2, cursor: 'pointer',
                            bgcolor: unreadCount > 0 ? alpha(theme.palette.error.main, 0.05) : alpha(theme.palette.primary.main, 0.02),
                            border: unreadCount > 0 ? 2 : 1, borderColor: unreadCount > 0 ? 'error.main' : 'divider'
                          }}
                          onClick={() => { setTrackingService(servicio); setActiveTab(1) }}>
                          <Grid container spacing={1} alignItems="center">
                            <Grid item xs={12} sm={3}>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="subtitle2" fontWeight="bold">ID: {servicio.serviceId}</Typography>
                                {unreadCount > 0 && <Badge badgeContent={unreadCount} color="error"><ChatIcon fontSize="small" color="error" /></Badge>}
                              </Stack>
                              <Typography variant="caption" color="text.secondary">{formatTime(servicio.createdAt)}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <LocationIcon fontSize="small" color="action" sx={{ fontSize: 16 }} />
                                <Typography variant="body2" noWrap>{servicio.zoneName} - {servicio.deliveryAddress}</Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={6} sm={2}>
                              <Typography variant="body2" fontWeight="bold" color="primary">{formatCurrency(servicio.deliveryFee)}</Typography>
                            </Grid>
                            <Grid item xs={6} sm={1.5}>
                              <Chip icon={status.icon} label={status.label} size="small" color={status.color} />
                            </Grid>
                            <Grid item xs={12} sm={1.5} sx={{ textAlign: 'right' }}>
                              {hasDriver && servicio.status !== 'entregado' && (
                                <Tooltip title={unreadCount > 0 ? `${unreadCount} mensajes nuevos` : 'Chat'}>
                                  <IconButton size="small" color={unreadCount > 0 ? 'error' : 'primary'}
                                    onClick={(e) => { e.stopPropagation(); setChatService(servicio) }}
                                    sx={{ bgcolor: unreadCount > 0 ? 'error.main' : 'primary.main', color: 'white' }}>
                                    <ChatIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Grid>
                          </Grid>
                          {hasDriver && servicio.driverName && (
                            <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <DeliveryIcon fontSize="small" color="success" />
                                <Typography variant="caption" color="text.secondary">Repartidor: <strong>{servicio.driverName}</strong></Typography>
                                {unreadCount > 0 && <Chip label={`${unreadCount} nuevos`} size="small" color="error" sx={{ height: 20, fontSize: '0.65rem' }} />}
                              </Stack>
                            </Box>
                          )}
                        </Paper>
                      )
                    })}
                  </Stack>
                </TabPanel>
                
                <TabPanel value={activeTab} index={1}>
                  {trackingService ? (
                    <Box>
                      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                        <Select value={trackingService.id} onChange={(e) => setTrackingService(serviciosActivos.find(s => s.id === e.target.value))}>
                          {serviciosActivos.map((s) => (
                            <MenuItem key={s.id} value={s.id}>ID: {s.serviceId} - {s.zoneName}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <ServiceTracker service={trackingService} onContactDriver={handleContactDriver} onChatDriver={() => setChatService(trackingService)} showMap={true} compact={isMobile} />
                    </Box>
                  ) : (
                    <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
                      <MapIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                      <Typography variant="body2" color="text.secondary">Selecciona un servicio para ver el seguimiento</Typography>
                    </Paper>
                  )}
                </TabPanel>
              </CardContent>
            </Card>
          )}

          {/* Servicios Recientes */}
          <Card>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PackageIcon color="primary" />
                  <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold">Servicios Recientes</Typography>
                </Stack>
              </Stack>
              
              {serviciosRecientes.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
                  <PackageIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">No hay servicios registrados</Typography>
                </Paper>
              ) : (
                <Stack spacing={{ xs: 1, sm: 2 }}>
                  {serviciosRecientes.map((servicio) => {
                    const status = getStatusConfig(servicio.status)
                    const isExpanded = expandedId === servicio.id
                    
                    return (
                      <Card key={servicio.id} variant="outlined" sx={{ borderRadius: 2 }}>
                        <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                          {isMobile ? (
                            <>
                              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                <Box>
                                  <Typography variant="subtitle2" fontWeight="bold">ID: {servicio.serviceId}</Typography>
                                  <Typography variant="caption" color="text.secondary">{formatDate(servicio.createdAt)} - {formatTime(servicio.createdAt)}</Typography>
                                </Box>
                                <Chip icon={status.icon} label={status.label} size="small" color={status.color} />
                              </Stack>
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, minWidth: 0 }}>
                                  <LocationIcon fontSize="small" color="action" sx={{ fontSize: 14 }} />
                                  <Typography variant="body2" noWrap sx={{ flex: 1 }}>{servicio.zoneName} - {servicio.deliveryAddress}</Typography>
                                </Box>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                  <Typography variant="body2" fontWeight="bold" color="primary">{formatCurrency(servicio.deliveryFee)}</Typography>
                                  <IconButton size="small" onClick={() => setExpandedId(isExpanded ? null : servicio.id)}>
                                    {isExpanded ? <CollapseIcon fontSize="small" /> : <ExpandIcon fontSize="small" />}
                                  </IconButton>
                                </Stack>
                              </Stack>
                            </>
                          ) : (
                            <Grid container spacing={2} alignItems="center">
                              <Grid item xs={12} sm={3}>
                                <Typography variant="subtitle2" fontWeight="bold">ID: {servicio.serviceId}</Typography>
                                <Typography variant="caption" color="text.secondary">{formatDate(servicio.createdAt)} - {formatTime(servicio.createdAt)}</Typography>
                              </Grid>
                              <Grid item xs={12} sm={4}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <LocationIcon fontSize="small" color="action" />
                                  <Typography variant="body2" noWrap>{servicio.zoneName} - {servicio.deliveryAddress}</Typography>
                                </Box>
                              </Grid>
                              <Grid item xs={6} sm={2}>
                                <Typography variant="body2" fontWeight="bold" color="primary">{formatCurrency(servicio.deliveryFee)}</Typography>
                              </Grid>
                              <Grid item xs={6} sm={2}>
                                <Chip icon={status.icon} label={status.label} size="small" color={status.color} />
                              </Grid>
                              <Grid item xs={12} sm={1} sx={{ textAlign: 'right' }}>
                                <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                  {servicio.status === 'entregado' && servicio.driverId && (
                                    <Tooltip title="Calificar servicio">
                                      <IconButton size="small" color="warning" onClick={() => handleOpenRating(servicio)}
                                        sx={{ bgcolor: 'warning.main', color: 'white' }}>
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
                                <Grid item xs={6}><Typography variant="caption" color="text.secondary">Cliente</Typography><Typography variant="body2">{servicio.clientName || 'No especificado'}</Typography></Grid>
                                <Grid item xs={6}><Typography variant="caption" color="text.secondary">Teléfono</Typography><Typography variant="body2">{servicio.clientPhone || '-'}</Typography></Grid>
                                <Grid item xs={6}><Typography variant="caption" color="text.secondary">Método de pago</Typography><Typography variant="body2">{servicio.paymentMethod === 'efectivo' ? 'Efectivo' : 'Pagado'}</Typography></Grid>
                                <Grid item xs={6}><Typography variant="caption" color="text.secondary">Repartidor</Typography><Typography variant="body2">{servicio.driverName || 'Sin asignar'}</Typography></Grid>
                                {servicio.notes && <Grid item xs={12}><Typography variant="caption" color="text.secondary">Notas</Typography><Typography variant="body2">{servicio.notes}</Typography></Grid>}
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
                  <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>Zona de Entrega *</Typography>
                  <FormControl fullWidth size={isMobile ? 'small' : 'medium'}>
                    <Select value={nuevoServicio.zona} onChange={(e) => setNuevoServicio({ ...nuevoServicio, zona: e.target.value })} displayEmpty
                      renderValue={(value) => {
                        if (!value) return <Typography color="text.disabled">Selecciona una zona</Typography>
                        const zona = zones.find(z => z.id === value)
                        return zona ? `${zona.name} - ${formatCurrency(zona.price)}` : ''
                      }}>
                      {zones.map((zona) => (
                        <MenuItem key={zona.id} value={zona.id}>{zona.name} - {formatCurrency(zona.price)}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>Dirección de Entrega *</Typography>
                  <TextField fullWidth placeholder="Dirección completa del cliente" value={nuevoServicio.direccion}
                    onChange={(e) => setNuevoServicio({ ...nuevoServicio, direccion: e.target.value })} multiline rows={2} />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>Nombre del Cliente *</Typography>
                  <TextField fullWidth placeholder="Nombre completo" value={nuevoServicio.cliente}
                    onChange={(e) => setNuevoServicio({ ...nuevoServicio, cliente: e.target.value })}
                    InputProps={{ startAdornment: <InputAdornment position="start"><PersonIcon color="action" /></InputAdornment> }} />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>Teléfono *</Typography>
                  <TextField fullWidth placeholder="Número de teléfono" value={nuevoServicio.telefono}
                    onChange={(e) => setNuevoServicio({ ...nuevoServicio, telefono: e.target.value })}
                    InputProps={{ startAdornment: <InputAdornment position="start"><PhoneIcon color="action" /></InputAdornment> }} />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>Método de Pago</Typography>
                  <FormControl fullWidth size={isMobile ? 'small' : 'medium'}>
                    <Select value={nuevoServicio.metodoPago} onChange={(e) => setNuevoServicio({ ...nuevoServicio, metodoPago: e.target.value })}>
                      <MenuItem value="efectivo">Efectivo</MenuItem>
                      <MenuItem value="pagado">Pagado</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>Monto a Cobrar</Typography>
                  <TextField fullWidth type="number" placeholder="Si es en efectivo" value={nuevoServicio.montoCobrar}
                    onChange={(e) => setNuevoServicio({ ...nuevoServicio, montoCobrar: e.target.value })}
                    disabled={nuevoServicio.metodoPago === 'pagado'}
                    InputProps={{ startAdornment: <InputAdornment position="start"><MoneyIcon color="action" /></InputAdornment> }} />
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>Notas Adicionales</Typography>
                  <TextField fullWidth placeholder="Instrucciones especiales para la entrega" value={nuevoServicio.notas}
                    onChange={(e) => setNuevoServicio({ ...nuevoServicio, notas: e.target.value })} multiline rows={2} />
                </Grid>
              </Grid>

              {nuevoServicio.zona && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'primary.light', borderRadius: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="primary.dark">Tarifa del servicio:</Typography>
                  <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight="bold" color="primary">
                    {formatCurrency(zones.find(z => z.id === nuevoServicio.zona)?.price || 0)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Repartidor recibe: {formatCurrency((zones.find(z => z.id === nuevoServicio.zona)?.price || 0) * (1 - appSettings.commissionRate / 100))} ({100 - appSettings.commissionRate}%)
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
              onChatOpenChange={(isOpen) => { chatOpenRef.current = isOpen }}
              onChatClose={() => setChatService(null)}
            />
          )}

          {/* Modal de Calificación */}
          <RatingModal open={ratingModal.open} onClose={handleRatingSkip} service={ratingModal.service}
            driver={ratingModal.driver} restaurantId={restaurantData?.id} onRated={handleRatingComplete} />
        </>
      )}
    </Box>
  )
}