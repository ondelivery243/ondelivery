// src/pages/restaurante/Dashboard.jsx
import { useState, useEffect, useRef, useMemo } from 'react'
import { alpha } from '@mui/material/styles'
import {
  Box, Card, CardContent, Typography, Button, TextField, Grid, Chip, Stack,
  Select, MenuItem, FormControl, InputAdornment, Dialog, DialogTitle, DialogContent,
  DialogActions, useTheme, useMediaQuery, Paper, LinearProgress, Collapse,
  IconButton, Tooltip, Tab, Tabs, Alert, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Skeleton, Autocomplete
} from '@mui/material'
import {
  Add as AddIcon, TwoWheeler as DeliveryIcon, LocationOn as LocationIcon,
  Person as PersonIcon, Phone as PhoneIcon, Inventory as PackageIcon,
  CheckCircle as CheckIcon, AccessTime as ClockIcon, Cancel as CancelIcon,
  ExpandMore as ExpandIcon, ExpandLess as CollapseIcon, Refresh as RefreshIcon,
  AttachMoney as MoneyIcon, Chat as ChatIcon, Star as StarIcon, Map as MapIcon,
  List as ListIcon, CalendarToday as CalendarIcon,
  Today as TodayIcon, DateRange as WeekIcon, CalendarMonth as MonthIcon,
  TrendingUp as TrendingUpIcon, ArrowForward as ArrowIcon, Update as UpdateIcon,
  Search as SearchIcon
} from '@mui/icons-material'
import { useSnackbar } from 'notistack'
import { formatCurrency, formatTime, formatDate, useRestaurantStore, useStore } from '../../store/useStore'
import { 
  subscribeToRestaurantServices, subscribeToZones, getRestaurantByUserId,
  getRestaurant, createService, getSettings
} from '../../services/firestore'
import { canRateService } from '../../services/ratingService'
import RestaurantChatManager from '../../components/chat/RestaurantChatManager'
import { RatingModal } from '../../components/rating'
import { ServiceTracker } from '../../components/tracking'
import VersionFooter from '../../components/common/VersionFooter'
import { useChatUnreadCounts } from '../../hooks/useChatUnreadCounts'

function TabPanel({ value, index, children }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null
}

// ============================================
// FUNCIONES AUXILIARES PARA PERÍODOS
// ============================================

/**
 * Obtiene el inicio del día actual (00:00:00)
 */
const getStartOfDay = () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

/**
 * Obtiene el inicio de la semana actual (Lunes 00:00:00)
 */
const getStartOfWeek = () => {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - diff)
  weekStart.setHours(0, 0, 0, 0)
  return weekStart
}

/**
 * Obtiene el inicio del mes actual (día 1, 00:00:00)
 */
const getStartOfMonth = () => {
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  return monthStart
}

/**
 * Verifica si una fecha está dentro de un período
 */
const isWithinPeriod = (timestamp, startDate) => {
  if (!timestamp) return false
  const date = timestamp?.toDate?.() || timestamp
  return date >= startDate
}

// ==================== FUNCIONES DE MANEJO SEMANAL ====================
const getMonday = (date) => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  monday.setHours(0, 0, 0, 0)
  return monday
}

const getSunday = (date) => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? 0 : 7)
  const sunday = new Date(d.setDate(diff))
  sunday.setHours(23, 59, 59, 999)
  return sunday
}

const formatWeekRange = () => {
  const monday = getMonday(new Date())
  const sunday = getSunday(new Date())
  const options = { day: 'numeric', month: 'short' }
  return `${monday.toLocaleDateString('es-VE', options)} - ${sunday.toLocaleDateString('es-VE', options)}`
}
// ====================================================================


export default function RestauranteDashboard() {
  const { enqueueSnackbar } = useSnackbar()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { restaurantData, setRestaurantData } = useRestaurantStore()
  const { user } = useStore()
  
  const [services, setServices] = useState([])
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [appSettings, setAppSettings] = useState({ commissionRate: 20, minDeliveryFee: 1.50 })
  const [activeTab, setActiveTab] = useState(0)
  const [trackingService, setTrackingService] = useState(null)
  const [ratingModal, setRatingModal] = useState({ open: false, service: null, driver: null })
  const [shownRatingModals, setShownRatingModals] = useState(new Set())
  const [statsTab, setStatsTab] = useState(0)
  const [openDialog, setOpenDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  
  const currentYear = new Date().getFullYear()
  
  const [nuevoServicio, setNuevoServicio] = useState({
    zona: '', direccion: '', cliente: '', telefono: '',
    metodoPago: 'efectivo', montoCobrar: '', pagaCon: '', notas: ''
  })

  // Calcular cambio
  const cambioCalculado = useMemo(() => {
    if (nuevoServicio.metodoPago !== 'efectivo') return 0
    const monto = parseFloat(nuevoServicio.montoCobrar) || 0
    const paga = parseFloat(nuevoServicio.pagaCon) || 0
    return paga > monto ? paga - monto : 0
  }, [nuevoServicio.metodoPago, nuevoServicio.montoCobrar, nuevoServicio.pagaCon])

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
        
        return () => { unsubZones(); unsubServices() }
      } else {
        setLoading(false)
      }
      
      return () => unsubZones()
    }
    
    loadData()
  }, [restaurantData, setRestaurantData, user])

  // ============================================
  // 📊 ESTADÍSTICAS CALCULADAS EN TIEMPO REAL
  // ============================================
  
  const stats = useMemo(() => {
    // Fechas de inicio de cada período
    const startOfDay = getStartOfDay()
    const startOfWeek = getStartOfWeek()
    const startOfMonth = getStartOfMonth()

    // Servicios por período
    const servicesToday = services.filter(s => isWithinPeriod(s.createdAt, startOfDay))
    const servicesThisWeek = services.filter(s => isWithinPeriod(s.createdAt, startOfWeek))
    const servicesThisMonth = services.filter(s => isWithinPeriod(s.createdAt, startOfMonth))

    // Servicios completados por período
    const completedToday = servicesToday.filter(s => s.status === 'entregado')
    const completedThisWeek = servicesThisWeek.filter(s => s.status === 'entregado')
    const completedThisMonth = servicesThisMonth.filter(s => s.status === 'entregado')

    // Por pagar (entregados y no liquidados) por período
    const toPayToday = completedToday.filter(s => {
      const settledField = s.settledRestaurant !== undefined ? s.settledRestaurant : s.settled
      return !settledField
    }).reduce((sum, s) => sum + (s.deliveryFee || 0), 0)

    const toPayThisWeek = completedThisWeek.filter(s => {
      const settledField = s.settledRestaurant !== undefined ? s.settledRestaurant : s.settled
      return !settledField
    }).reduce((sum, s) => sum + (s.deliveryFee || 0), 0)

    const paidThisMonth = completedThisMonth.filter(s => {
      const settledField = s.settledRestaurant !== undefined ? s.settledRestaurant : s.settled
      return settledField
    }).reduce((sum, s) => sum + (s.deliveryFee || 0), 0)

    // Total por pagar (todos los entregados no liquidados)
    const totalToPay = services.filter(s => {
      if (s.status !== 'entregado') return false
      const settledField = s.settledRestaurant !== undefined ? s.settledRestaurant : s.settled
      return !settledField
    }).reduce((sum, s) => sum + (s.deliveryFee || 0), 0)

    // Conteos por estado
    const pendingServices = services.filter(s => s.status === 'pendiente').length
    const inProgressServices = services.filter(s => ['asignado', 'en_camino'].includes(s.status)).length

    return {
      // Diario
      servicesToday: servicesToday.length,
      completedToday: completedToday.length,
      toPayToday,
      
      // Semanal
      servicesThisWeek: servicesThisWeek.length,
      completedThisWeek: completedThisWeek.length,
      toPayThisWeek,
      
      // Mensual
      servicesThisMonth: servicesThisMonth.length,
      completedThisMonth: completedThisMonth.length,
      paidThisMonth,
      
      // Estados actuales
      pendingServices,
      inProgressServices,
      
      // Total por pagar
      totalToPay
    }
  }, [services])

  // Tarjetas principales de estadísticas
  const mainStatsCards = useMemo(() => [
    { 
      title: 'Servicios Hoy', 
      value: stats.servicesToday, 
      subtitle: `${stats.completedToday} completados`,
      icon: PackageIcon, 
      bgColor: '#3B82F6'
    },
    { 
      title: 'Servicios Esta Semana', 
      value: stats.servicesThisWeek, 
      subtitle: `${stats.completedThisWeek} completados`,
      icon: WeekIcon, 
      bgColor: '#8B5CF6'
    },
    { 
      title: 'Servicios Este Mes', 
      value: stats.servicesThisMonth, 
      subtitle: `${stats.completedThisMonth} completados`,
      icon: MonthIcon, 
      bgColor: '#10B981'
    },
  ], [stats])

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
    
    if (nuevoServicio.metodoPago === 'efectivo') {
      if (!nuevoServicio.montoCobrar || parseFloat(nuevoServicio.montoCobrar) <= 0) {
        enqueueSnackbar('Debes ingresar el monto a cobrar', { variant: 'warning' })
        return
      }
      if (!nuevoServicio.pagaCon || parseFloat(nuevoServicio.pagaCon) <= 0) {
        enqueueSnackbar('Debes ingresar con cuánto paga el cliente', { variant: 'warning' })
        return
      }
      if (parseFloat(nuevoServicio.pagaCon) < parseFloat(nuevoServicio.montoCobrar)) {
        enqueueSnackbar('El monto que paga el cliente no puede ser menor al monto a cobrar', { variant: 'warning' })
        return
      }
    }

    setSaving(true)
    
    const zona = zones.find(z => z.id === nuevoServicio.zona)
    const deliveryFee = zona?.price || 0
    const commissionRate = appSettings.commissionRate || 20
    const platformFee = deliveryFee * (commissionRate / 100)
    const driverEarnings = deliveryFee - platformFee
    
    const amountToCollect = nuevoServicio.metodoPago === 'pagado' ? 0 : parseFloat(nuevoServicio.montoCobrar) || 0
    const paysWith = nuevoServicio.metodoPago === 'efectivo' ? parseFloat(nuevoServicio.pagaCon) || 0 : 0
    const changeAmount = paysWith > amountToCollect ? paysWith - amountToCollect : 0
    
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
      amountToCollect,
      paysWith,
      changeAmount,
      notes: nuevoServicio.notas,
      deliveryFee, commissionRate, platformFee, driverEarnings,
      settledRestaurant: false,
      settledDriver: false
    })
    
    setSaving(false)
    
    if (result.success) {
      enqueueSnackbar(`Servicio ${result.serviceId} creado. Costo: ${formatCurrency(deliveryFee)}`, { variant: 'success' })
      setOpenDialog(false)
      setNuevoServicio({ zona: '', direccion: '', cliente: '', telefono: '', metodoPago: 'efectivo', montoCobrar: '', pagaCon: '', notas: '' })
    } else {
      enqueueSnackbar(result.error || 'Error al crear servicio', { variant: 'error' })
    }
  }

  const getStatusConfig = (status) => {
    const configs = {
      pendiente: { color: 'warning', label: 'Pendiente', icon: <ClockIcon sx={{ fontSize: 14 }} /> },
      asignado: { color: 'info', label: 'Asignado', icon: <DeliveryIcon sx={{ fontSize: 14 }} /> },
      en_camino: { color: 'primary', label: 'En Camino', icon: <DeliveryIcon sx={{ fontSize: 14 }} /> },
      entregado: { color: 'success', label: 'Entregado', icon: <CheckIcon sx={{ fontSize: 14 }} /> },
      cancelado: { color: 'error', label: 'Cancelado', icon: <CancelIcon sx={{ fontSize: 14 }} /> },
      sin_repartidor: { color: 'error', label: 'Sin Repartidor', icon: <CancelIcon sx={{ fontSize: 14 }} /> }
    }
    return configs[status] || configs.pendiente
  }

  const serviciosRecientes = services.slice(0, 5)
  const serviciosActivos = services.filter(s => s.status === 'pendiente' || s.status === 'asignado' || s.status === 'en_camino' || s.status === 'sin_repartidor')
  const serviciosEnProceso = serviciosActivos
  
  // Hook para contadores de mensajes no leídos
  const chatUnreadCounts = useChatUnreadCounts(serviciosActivos, 'restaurant')

  const handleContactDriver = (phone) => {
    if (phone) window.open(`tel:${phone}`, '_self')
  }

  const handleRetryService = async (serviceId) => {
    try {
      const { retryService } = await import('../../services/firestore')
      const result = await retryService(serviceId)
      
      if (result.success) {
        enqueueSnackbar('Servicio republicado. Buscando repartidores...', { variant: 'success' })
      } else {
        enqueueSnackbar(result.error || 'Error al reintentar', { variant: 'error' })
      }
    } catch (error) {
      enqueueSnackbar('Error al reintentar servicio', { variant: 'error' })
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 3 }, minWidth: 0, width: '100%' }}>
      {loading && <LinearProgress />}
      
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
              <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold">Dashboard</Typography>
              <Typography variant="body2" color="text.secondary">Solicita y gestiona tus servicios de delivery</Typography>
            </Box>
            <Button variant="contained" size={isMobile ? 'medium' : 'large'} startIcon={<AddIcon />} onClick={() => setOpenDialog(true)} fullWidth={isMobile}>
              Nuevo Servicio
            </Button>
          </Stack>

          {/* ============================================ */}
          {/* TARJETAS PRINCIPALES - SERVICIOS POR PERÍODO */}
          {/* En móvil: una debajo de otra (xs=12), en desktop: lado a lado (sm=4) */}
          {/* ============================================ */}
          <Grid container spacing={{ xs: 1.5, sm: 3 }}>
            {mainStatsCards.map((stat, index) => (
              <Grid item xs={12} sm={4} key={index}>
                <Card 
                  sx={{ 
                    height: '100%', 
                    minWidth: 0, 
                    transition: 'all 0.2s'
                  }}
                >
                  <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                    {loading ? (
                      <Skeleton variant="rectangular" height={60} />
                    ) : (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.75rem' }, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {stat.title}
                          </Typography>
                          <Typography variant="h6" fontWeight="bold" sx={{ fontSize: { xs: '1.5rem', sm: '1.5rem' }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {stat.value}
                          </Typography>
                          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                            <TrendingUpIcon sx={{ fontSize: 14, color: 'success.main' }} />
                            <Typography variant="caption" sx={{ color: 'success.main', fontSize: '0.7rem' }}>
                              {stat.subtitle}
                            </Typography>
                          </Stack>
                        </Box>
                        <Box sx={{ width: { xs: 40, sm: 48 }, height: { xs: 40, sm: 48 }, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: stat.bgColor, color: 'white', flexShrink: 0, boxShadow: `0 4px 12px ${stat.bgColor}40` }}>
                          <stat.icon sx={{ fontSize: { xs: 20, sm: 24 } }} />
                        </Box>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* ============================================ */}
          {/* TARJETAS DE ESTADÍSTICAS POR PERÍODO */}
          {/* ============================================ */}
          <Card sx={{ minWidth: 0 }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant={isMobile ? 'subtitle2' : 'subtitle1'} fontWeight="bold">
                  Estadísticas por Período
                </Typography>
                <Chip 
                  icon={<UpdateIcon sx={{ fontSize: 14 }} />} 
                  label="Auto-actualiza" 
                  size="small" 
                  color="success" 
                  variant="outlined" 
                />
              </Stack>
              
              {/* Tabs para seleccionar período */}
              <Tabs 
                value={statsTab} 
                onChange={(e, v) => setStatsTab(v)} 
                sx={{ mb: 2, minHeight: 36 }}
                variant="fullWidth"
              >
                <Tab 
                  icon={<TodayIcon sx={{ fontSize: 18 }} />} 
                  label={isMobile ? '' : 'Hoy'} 
                  id={0}
                  sx={{ minHeight: 36, py: 0.5, fontSize: { xs: '0.7rem', sm: '0.875rem' } }}
                />
                <Tab 
                  icon={<WeekIcon sx={{ fontSize: 18 }} />} 
                  label={isMobile ? '' : 'Semana'} 
                  id={1}
                  sx={{ minHeight: 36, py: 0.5, fontSize: { xs: '0.7rem', sm: '0.875rem' } }}
                />
                <Tab 
                  icon={<MonthIcon sx={{ fontSize: 18 }} />} 
                  label={isMobile ? '' : 'Mes'} 
                  id={2}
                  sx={{ minHeight: 36, py: 0.5, fontSize: { xs: '0.7rem', sm: '0.875rem' } }}
                />
              </Tabs>

              {/* Contenido según tab seleccionado */}
              <Grid container spacing={{ xs: 1.5, sm: 2 }}>
                {/* DIARIO */}
                {statsTab === 0 && (
                  <>
                    <Grid item xs={6} sm={4}>
                      <Paper sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: alpha(theme.palette.primary.main, 0.1), borderRadius: 2, height: '100%' }}>
                        <Stack spacing={0.5}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                            Servicios Hoy
                          </Typography>
                          <Typography variant="h5" fontWeight="bold" color="primary" sx={{ fontSize: { xs: '1.25rem', sm: '1.75rem' } }}>
                            {stats.servicesToday}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' } }}>
                            Se reinicia mañana a las 12:00 a. m.
                          </Typography>
                        </Stack>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={4}>
                      <Paper sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: alpha(theme.palette.success.main, 0.1), borderRadius: 2, height: '100%' }}>
                        <Stack spacing={0.5}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                            Completados
                          </Typography>
                          <Typography variant="h5" fontWeight="bold" color="success.main" sx={{ fontSize: { xs: '1.25rem', sm: '1.75rem' } }}>
                            {stats.completedToday}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' } }}>
                            {stats.servicesToday > 0 ? Math.round((stats.completedToday / stats.servicesToday) * 100) : 0}% tasa de éxito
                          </Typography>
                        </Stack>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Paper sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: alpha(theme.palette.warning.main, 0.1), borderRadius: 2, height: '100%' }}>
                        <Stack spacing={0.5}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                            Acumulado Por Pagar Hoy
                          </Typography>
                          <Typography variant="h6" fontWeight="bold" color="warning.main" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                            {formatCurrency(stats.toPayToday)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' } }}>
                            Servicios entregados no liquidados
                          </Typography>
                        </Stack>
                      </Paper>
                    </Grid>
                  </>
                )}

                {/* SEMANAL */}
                {statsTab === 1 && (
                  <>
                    <Grid item xs={6} sm={4}>
                      <Paper sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: alpha(theme.palette.primary.main, 0.1), borderRadius: 2, height: '100%' }}>
                        <Stack spacing={0.5}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                            Servicios Semana
                          </Typography>
                          <Typography variant="h5" fontWeight="bold" color="primary" sx={{ fontSize: { xs: '1.25rem', sm: '1.75rem' } }}>
                            {stats.servicesThisWeek}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' } }}>
                            Desde lunes a las 12:00 a. m.
                          </Typography>
                        </Stack>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={4}>
                      <Paper sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: alpha(theme.palette.success.main, 0.1), borderRadius: 2, height: '100%' }}>
                        <Stack spacing={0.5}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                            Completados
                          </Typography>
                          <Typography variant="h5" fontWeight="bold" color="success.main" sx={{ fontSize: { xs: '1.25rem', sm: '1.75rem' } }}>
                            {stats.completedThisWeek}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' } }}>
                            {stats.servicesThisWeek > 0 ? Math.round((stats.completedThisWeek / stats.servicesThisWeek) * 100) : 0}% tasa de éxito
                          </Typography>
                        </Stack>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Paper sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: alpha(theme.palette.warning.main, 0.1), borderRadius: 2, height: '100%' }}>
                        <Stack spacing={0.5}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                            Por Pagar Esta Semana
                          </Typography>
                          <Typography variant="h6" fontWeight="bold" color="warning.main" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                            {formatCurrency(stats.toPayThisWeek)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' } }}>
                            Pendiente de liquidación
                          </Typography>
                        </Stack>
                      </Paper>
                    </Grid>
                  </>
                )}

                {/* MENSUAL */}
                {statsTab === 2 && (
                  <>
                    <Grid item xs={6} sm={4}>
                      <Paper sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: alpha(theme.palette.primary.main, 0.1), borderRadius: 2, height: '100%' }}>
                        <Stack spacing={0.5}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                            Servicios del Mes
                          </Typography>
                          <Typography variant="h5" fontWeight="bold" color="primary" sx={{ fontSize: { xs: '1.25rem', sm: '1.75rem' } }}>
                            {stats.servicesThisMonth}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' } }}>
                            Desde el 1° del mes
                          </Typography>
                        </Stack>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={4}>
                      <Paper sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: alpha(theme.palette.success.main, 0.1), borderRadius: 2, height: '100%' }}>
                        <Stack spacing={0.5}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                            Completados
                          </Typography>
                          <Typography variant="h5" fontWeight="bold" color="success.main" sx={{ fontSize: { xs: '1.25rem', sm: '1.75rem' } }}>
                            {stats.completedThisMonth}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' } }}>
                            {stats.servicesThisMonth > 0 ? Math.round((stats.completedThisMonth / stats.servicesThisMonth) * 100) : 0}% tasa de éxito
                          </Typography>
                        </Stack>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Paper sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: alpha(theme.palette.success.main, 0.1), borderRadius: 2, height: '100%' }}>
                        <Stack spacing={0.5}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                            Total Pagado en el Mes
                          </Typography>
                          <Typography variant="h6" fontWeight="bold" color="success.main" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                            {formatCurrency(stats.paidThisMonth)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' } }}>
                            Servicios liquidados
                          </Typography>
                        </Stack>
                      </Paper>
                    </Grid>
                  </>
                )}
              </Grid>
            </CardContent>
          </Card>

          {/* ============================================ */}
          {/* TABLA DE SERVICIOS RECIENTES */}
          {/* ============================================ */}
          <Card sx={{ minWidth: 0 }}>
            <CardContent sx={{ p: { xs: 1, sm: 2 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <PackageIcon color="primary" sx={{ fontSize: { xs: 18, sm: 24 } }} />
                  <Typography variant={isMobile ? 'subtitle2' : 'subtitle1'} fontWeight="bold">
                    Servicios Recientes
                  </Typography>
                </Stack>
              </Stack>

              {loading ? (
                <Skeleton variant="rectangular" height={200} />
              ) : serviciosRecientes.length === 0 ? (
                <Paper sx={{ p: { xs: 2, sm: 4 }, textAlign: 'center', bgcolor: 'grey.50' }}>
                  <PackageIcon sx={{ fontSize: { xs: 32, sm: 48 }, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">No hay servicios registrados</Typography>
                </Paper>
              ) : (
                <TableContainer sx={{ overflowX: 'auto', '&::-webkit-scrollbar': { height: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'grey.300', borderRadius: 3 } }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'medium', color: 'text.secondary', whiteSpace: 'nowrap', fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>ID</TableCell>
                        <TableCell sx={{ fontWeight: 'medium', color: 'text.secondary', whiteSpace: 'nowrap', fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>Cliente</TableCell>
                        {!isMobile && <TableCell sx={{ fontWeight: 'medium', color: 'text.secondary', fontSize: '0.875rem' }}>Zona</TableCell>}
                        <TableCell sx={{ fontWeight: 'medium', color: 'text.secondary', whiteSpace: 'nowrap', fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>Tarifa</TableCell>
                        <TableCell sx={{ fontWeight: 'medium', color: 'text.secondary', whiteSpace: 'nowrap', fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>Estado</TableCell>
                        {!isMobile && <TableCell sx={{ fontWeight: 'medium', color: 'text.secondary', fontSize: '0.875rem' }}>Hora</TableCell>}
                        <TableCell sx={{ fontWeight: 'medium', color: 'text.secondary', whiteSpace: 'nowrap', fontSize: { xs: '0.7rem', sm: '0.875rem' } }}></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {serviciosRecientes.map((service) => {
                        const statusConfig = getStatusConfig(service.status)
                        return (
                          <TableRow 
                            key={service.id} 
                            hover 
                            sx={{ '&:last-child td, &:last-child th': { border: 0 }, cursor: 'pointer' }} 
                            onClick={() => setExpandedId(expandedId === service.id ? null : service.id)}
                          >
                            <TableCell>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: { xs: '0.65rem', sm: '0.875rem' } }}>
                                {service.serviceId}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight="medium" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' }, maxWidth: { xs: 80, sm: 'none' }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {service.clientName || 'N/A'}
                              </Typography>
                            </TableCell>
                            {!isMobile && (
                              <TableCell>
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                                  {service.zoneName || 'N/A'}
                                </Typography>
                              </TableCell>
                            )}
                            <TableCell>
                              <Typography variant="body2" fontWeight="bold" color="error.main" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                                {formatCurrency(service.deliveryFee)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                icon={statusConfig.icon} 
                                label={statusConfig.label} 
                                size="small" 
                                color={statusConfig.color} 
                                variant="outlined" 
                                sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' }, height: { xs: 20, sm: 24 } }} 
                              />
                            </TableCell>
                            {!isMobile && (
                              <TableCell>
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                                  {formatTime(service.createdAt)}
                                </Typography>
                              </TableCell>
                            )}
                            <TableCell>
                              {service.status === 'entregado' && service.driverId && (
                                <Tooltip title="Calificar servicio">
                                  <IconButton 
                                    size="small" 
                                    color="warning" 
                                    onClick={(e) => { e.stopPropagation(); handleOpenRating(service) }}
                                    sx={{ bgcolor: 'warning.main', color: 'white', '&:hover': { bgcolor: 'warning.dark' } }}
                                  >
                                    <StarIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>

          {/* ============================================ */}
          {/* TARJETAS RÁPIDAS - ESTADOS ACTUALES */}
          {/* ============================================ */}
          <Grid container spacing={{ xs: 1.5, sm: 3 }}>
            <Grid item xs={4} sm={4}>
              <Card sx={{ background: 'linear-gradient(135deg, #F39C12 0%, #F5B041 100%)', color: 'white', height: '100%', minWidth: 0 }}>
                <CardContent sx={{ p: { xs: 1.5, sm: 2.5 }, textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ opacity: 0.9, fontSize: { xs: '0.65rem', sm: '0.8rem' } }}>Por Pagar</Typography>
                  <Typography variant="h5" fontWeight="bold" sx={{ fontSize: { xs: '1.25rem', sm: '1.75rem' }, mt: 0.5 }}>
                    {formatCurrency(stats.totalToPay)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={4} sm={4}>
              <Card sx={{ background: 'linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%)', color: 'white', height: '100%', minWidth: 0 }}>
                <CardContent sx={{ p: { xs: 1.5, sm: 2.5 }, textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ opacity: 0.9, fontSize: { xs: '0.65rem', sm: '0.8rem' } }}>Pendientes</Typography>
                  <Typography variant="h5" fontWeight="bold" sx={{ fontSize: { xs: '1.25rem', sm: '1.75rem' }, mt: 0.5 }}>
                    {stats.pendingServices}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={4} sm={4}>
              <Card sx={{ background: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)', color: 'white', height: '100%', minWidth: 0 }}>
                <CardContent sx={{ p: { xs: 1.5, sm: 2.5 }, textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ opacity: 0.9, fontSize: { xs: '0.65rem', sm: '0.8rem' } }}>En Proceso</Typography>
                  <Typography variant="h5" fontWeight="bold" sx={{ fontSize: { xs: '1.25rem', sm: '1.75rem' }, mt: 0.5 }}>
                    {stats.inProgressServices}
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
                  <Typography variant="subtitle1" fontWeight="bold">Servicios Activos ({serviciosActivos.length})</Typography>
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
                              <Typography variant="body2" fontWeight="bold" color="error.main">{formatCurrency(servicio.deliveryFee)}</Typography>
                            </Grid>
                            <Grid item xs={6} sm={1.5}>
                              <Chip icon={status.icon} label={status.label} size="small" color={status.color} />
                            </Grid>
                            <Grid item xs={12} sm={1.5} sx={{ textAlign: 'right' }}>
                              {servicio.status === 'sin_repartidor' ? (
                                <Tooltip title="Buscar repartidor">
                                  <IconButton size="small" color="warning"
                                    onClick={(e) => { e.stopPropagation(); handleRetryService(servicio.id) }}
                                    sx={{ bgcolor: 'warning.main', color: 'white' }}>
                                    <RefreshIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              ) : hasDriver && servicio.status !== 'entregado' && unreadCount > 0 ? (
                                <Chip 
                                  icon={<ChatIcon fontSize="small" />}
                                  label={`${unreadCount} nuevos`}
                                  size="small" 
                                  color="error"
                                  sx={{ animation: 'pulse 1.5s infinite', '@keyframes pulse': { '0%': { transform: 'scale(1)', opacity: 1 }, '50%': { transform: 'scale(1.05)', opacity: 0.9 }, '100%': { transform: 'scale(1)', opacity: 1 } } }}
                                />
                              ) : null}
                            </Grid>
                          </Grid>
                          {servicio.status === 'sin_repartidor' && (
                            <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                              <Alert severity="warning" sx={{ py: 0.5, borderRadius: 1 }}
                                action={<Button size="small" variant="outlined" color="warning" onClick={(e) => { e.stopPropagation(); handleRetryService(servicio.id) }}>Reintentar</Button>}>
                                <Typography variant="caption">No se encontró repartidor disponible</Typography>
                              </Alert>
                            </Box>
                          )}
                          {hasDriver && servicio.driverName && (
                            <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <DeliveryIcon fontSize="small" color="success" />
                                <Typography variant="caption" color="text.secondary">Repartidor: <strong>{servicio.driverName}</strong></Typography>
                              </Stack>
                            </Box>
                          )}

                          {/* Información de pago */}
                          {servicio.paymentMethod === 'pagado' && (
                            <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                              <Chip
                                size="small"
                                label="✅ Cliente ya pagó"
                                color="info"
                                variant="outlined"
                                sx={{ fontSize: '0.7rem' }}
                              />
                            </Box>
                          )}
                          {servicio.paymentMethod === 'efectivo' && servicio.paysWith > 0 && servicio.paysWith === servicio.amountToCollect && (
                            <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                              <Chip
                                size="small"
                                label="✅ Pago exacto"
                                color="success"
                                variant="outlined"
                                sx={{ fontSize: '0.7rem' }}
                              />
                            </Box>
                          )}
                          {servicio.paymentMethod === 'efectivo' && servicio.changeAmount > 0 && (
                            <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                              <Chip
                                size="small"
                                label={`💵 Cambio: $${servicio.changeAmount.toFixed(2)}`}
                                color="warning"
                                variant="outlined"
                                sx={{ fontSize: '0.7rem' }}
                              />
                              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                Pedir al restaurante
                              </Typography>
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
                      <ServiceTracker service={trackingService} onContactDriver={handleContactDriver} showMap={true} compact={isMobile} />
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
                
                {/* Zona de Entrega - MEJORADO CON AUTOCOMPLETE */}
                <Grid item xs={12}>
                  <Typography variant="body2" fontWeight="medium" sx={{ mb: 1.5 }}>Zona de Entrega *</Typography>
                  <Autocomplete
                    fullWidth
                    size={isMobile ? 'small' : 'medium'}
                    options={zones}
                    openOnFocus
                    getOptionLabel={(option) => `${option.name} - ${formatCurrency(option.price)}`}
                    value={zones.find(z => z.id === nuevoServicio.zona) || null}
                    onChange={(event, newValue) => {
                      setNuevoServicio({ 
                        ...nuevoServicio, 
                        zona: newValue ? newValue.id : '' 
                      })
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Selecciona o busca una zona"
                        placeholder="Escribe para filtrar..."
                        helperText="💡 Escribe para encontrar tu zona rápidamente"
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <InputAdornment position="start">
                              <SearchIcon color="action" />
                            </InputAdornment>
                          )
                        }}
                      />
                    )}
                    noOptionsText="No hay zonas disponibles"
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    renderOption={(props, option) => {
                      const { key, ...otherProps } = props;
                      return (
                        <li key={option.id} {...otherProps}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                            <Typography variant="body2" fontWeight="medium">{option.name}</Typography>
                            <Typography variant="body2" color="primary.main" fontWeight="bold">
                              {formatCurrency(option.price)}
                            </Typography>
                          </Box>
                        </li>
                      );
                    }}
                  />
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
                
                <Grid item xs={12}>
                  <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>Método de Pago *</Typography>
                  <FormControl fullWidth size={isMobile ? 'small' : 'medium'}>
                    <Select value={nuevoServicio.metodoPago} onChange={(e) => setNuevoServicio({ ...nuevoServicio, metodoPago: e.target.value, montoCobrar: '', pagaCon: '' })}>
                      <MenuItem value="efectivo">Efectivo</MenuItem>
                      <MenuItem value="pagado">Pagado</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                {nuevoServicio.metodoPago === 'efectivo' && (
                  <>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>Monto a Cobrar *</Typography>
                      <TextField fullWidth type="number" placeholder="Total a cobrar al cliente" value={nuevoServicio.montoCobrar}
                        onChange={(e) => setNuevoServicio({ ...nuevoServicio, montoCobrar: e.target.value })}
                        InputProps={{ startAdornment: <InputAdornment position="start"><MoneyIcon color="action" /></InputAdornment> }} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>Paga Con *</Typography>
                      <TextField fullWidth type="number" placeholder="Con cuánto paga el cliente" value={nuevoServicio.pagaCon}
                        onChange={(e) => setNuevoServicio({ ...nuevoServicio, pagaCon: e.target.value })}
                        error={parseFloat(nuevoServicio.pagaCon) > 0 && parseFloat(nuevoServicio.pagaCon) < parseFloat(nuevoServicio.montoCobrar)}
                        helperText={parseFloat(nuevoServicio.pagaCon) > 0 && parseFloat(nuevoServicio.pagaCon) < parseFloat(nuevoServicio.montoCobrar) ? 'No puede ser menor al monto a cobrar' : ''}
                        InputProps={{ startAdornment: <InputAdornment position="start"><MoneyIcon color="action" /></InputAdornment> }} />
                    </Grid>
                    
                    {cambioCalculado > 0 && (
                      <Grid item xs={12}>
                        <Paper sx={{ p: 2, bgcolor: 'warning.lighter', borderRadius: 2, border: 1, borderColor: 'warning.main' }}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography variant="body1" fontWeight="bold" color="warning.dark">
                              💵 Cambio a llevar: ${cambioCalculado.toFixed(2)}
                            </Typography>
                          </Stack>
                          <Typography variant="caption" color="warning.dark" sx={{ mt: 0.5, display: 'block' }}>
                            💡 El repartidor debe pedir este monto al restaurante
                          </Typography>
                        </Paper>
                      </Grid>
                    )}
                    
                    {parseFloat(nuevoServicio.pagaCon) > 0 && parseFloat(nuevoServicio.pagaCon) === parseFloat(nuevoServicio.montoCobrar) && (
                      <Grid item xs={12}>
                        <Paper sx={{ p: 2, bgcolor: 'success.lighter', borderRadius: 2, border: 1, borderColor: 'success.main' }}>
                          <Typography variant="body2" fontWeight="medium" color="success.dark">
                            ✅ Pago exacto - No requiere cambio
                          </Typography>
                        </Paper>
                      </Grid>
                    )}
                  </>
                )}
                
                {nuevoServicio.metodoPago === 'pagado' && (
                  <Grid item xs={12}>
                    <Paper sx={{ p: 2, bgcolor: 'info.lighter', borderRadius: 2, border: 1, borderColor: 'info.main' }}>
                      <Typography variant="body2" fontWeight="medium" color="info.dark">
                        ✅ Cliente ya pagó - Solo entregar pedido
                      </Typography>
                      <Typography variant="caption" color="info.dark" sx={{ mt: 0.5, display: 'block' }}>
                        El repartidor NO debe cobrar nada al cliente
                      </Typography>
                    </Paper>
                  </Grid>
                )}
                
                <Grid item xs={12}>
                  <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>Notas adicionales</Typography>
                  <TextField fullWidth placeholder="Instrucciones especiales, referencia, etc." value={nuevoServicio.notas}
                    onChange={(e) => setNuevoServicio({ ...nuevoServicio, notas: e.target.value })} multiline rows={2} />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setOpenDialog(false)} fullWidth={isMobile}>Cancelar</Button>
              <Button variant="contained" onClick={handleCrearServicio} fullWidth={isMobile} disabled={saving}>
                {saving ? 'Creando...' : 'Crear Servicio'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Chat unificado con Repartidor - Un solo botón flotante */}
          <RestaurantChatManager
            services={serviciosActivos}
            restaurantData={restaurantData}
            chatUnreadCounts={chatUnreadCounts}
          />

          {/* Modal de Calificación */}
          <RatingModal open={ratingModal.open} onClose={handleRatingSkip} service={ratingModal.service}
            driver={ratingModal.driver} restaurantId={restaurantData?.id} onRated={handleRatingComplete} />
        </>
      )}

      <VersionFooter />
    </Box>
  )
}