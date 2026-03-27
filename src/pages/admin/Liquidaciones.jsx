// src/pages/admin/Liquidaciones.jsx
import { useState, useEffect, useMemo } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Stack,
  Paper,
  useTheme,
  useMediaQuery,
  Tab,
  Tabs,
  LinearProgress,
  CircularProgress,
  Collapse,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider
} from '@mui/material'
import {
  AttachMoney as MoneyIcon,
  CheckCircle as CheckIcon,
  AccessTime as ClockIcon,
  Receipt as ReceiptIcon,
  Store as StoreIcon,
  TwoWheeler as BikeIcon,
  CalendarToday as CalendarIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Warning as WarningIcon,
  History as HistoryIcon
} from '@mui/icons-material'
import { useSnackbar } from 'notistack'
import { formatCurrency, formatDate } from '../../store/useStore'
import { 
  subscribeToSettlements,
  subscribeToServices,
  subscribeToRestaurants,
  subscribeToDrivers,
  subscribeToExchangeRate,
  createSettlement,
  updateService,
  paySettlement
} from '../../services/firestore'
import { RIDERY_COLORS } from '../../theme/theme'

// ============================================
// FUNCIONES FUERA DEL COMPONENTE
// ============================================

const formatVES = (amount) => {
  if (!amount || amount === 0) return '0,00 Bs.'
  return new Intl.NumberFormat('es-VE', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }).format(amount) + ' Bs.'
}

const formatRateWithBs = (rate) => {
  if (!rate || rate === 0) return '--'
  return new Intl.NumberFormat('es-VE', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }).format(rate) + ' Bs/$'
}

const getMonday = (date) => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  monday.setHours(0, 0, 0, 0)
  return monday
}

const getSunday = (monday) => {
  const d = new Date(monday)
  d.setDate(d.getDate() + 6)
  d.setHours(23, 59, 59, 999)
  return d
}

const formatWeekRange = (monday) => {
  const sunday = getSunday(monday)
  const options = { day: 'numeric', month: 'short' }
  return `${monday.toLocaleDateString('es-VE', options)} - ${sunday.toLocaleDateString('es-VE', options)}`
}

const getWeekId = (date) => {
  const monday = getMonday(date)
  return monday.toISOString().split('T')[0]
}

// Generar últimas 8 semanas
const generateWeeks = () => {
  const weeks = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  for (let i = 0; i < 8; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - (i * 7))
    const monday = getMonday(date)
    const sunday = getSunday(monday)
    
    weeks.push({
      id: monday.toISOString().split('T')[0],
      monday,
      sunday,
      label: formatWeekRange(monday),
      isCurrent: i === 0
    })
  }
  
  return weeks
}

const isServiceDelivered = (service) => {
  if (!service.status) return false
  const statusLower = service.status.toLowerCase()
  return statusLower === 'entregado' || 
         statusLower === 'delivered' || 
         statusLower === 'completed' ||
         statusLower === 'completado'
}

// Determinar si la semana ya terminó (es domingo noche o después)
const isWeekEnded = (weekMonday) => {
  const now = new Date()
  const sunday = getSunday(weekMonday)
  return now > sunday
}

// Formatear fecha corta
const formatShortDate = (timestamp) => {
  if (!timestamp) return '--'
  const date = timestamp.toDate?.() || new Date(timestamp)
  return date.toLocaleDateString('es-VE', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  })
}

// Constante de semanas
const WEEKS = generateWeeks()
const CURRENT_WEEK_ID = getWeekId(new Date())

export default function AdminLiquidaciones() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { enqueueSnackbar } = useSnackbar()
  
  const [settlements, setSettlements] = useState([])
  const [services, setServices] = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [tabValue, setTabValue] = useState(0)
  const [exchangeRate, setExchangeRate] = useState({ rate: 0, lastUpdate: null })
  const [saving, setSaving] = useState(false)
  const [expandedWeeks, setExpandedWeeks] = useState({ [CURRENT_WEEK_ID]: true })
  const [confirmDialog, setConfirmDialog] = useState({ open: false, settlement: null })
  
  const currentYear = new Date().getFullYear()

  // Suscripciones en tiempo real
  useEffect(() => {
    setLoading(true)
    
    const unsubSettlements = subscribeToSettlements((data) => setSettlements(data))
    const unsubServices = subscribeToServices((data) => {
      setServices(data)
      setLoading(false)
    })
    const unsubRestaurants = subscribeToRestaurants((data) => setRestaurants(data))
    const unsubDrivers = subscribeToDrivers((data) => setDrivers(data))
    const unsubExchangeRate = subscribeToExchangeRate((data) => setExchangeRate(data))
    
    return () => {
      unsubSettlements()
      unsubServices()
      unsubRestaurants()
      unsubDrivers()
      unsubExchangeRate()
    }
  }, [])

  // ============================================
  // CÁLCULOS MEMOIZADOS
  // ============================================

  // Filtrar liquidaciones por tipo
  const restaurantSettlements = useMemo(() => 
    settlements.filter(s => s.type === 'restaurante' || !s.type),
    [settlements]
  )
  
  const driverSettlements = useMemo(() => 
    settlements.filter(s => s.type === 'repartidor'),
    [settlements]
  )

  // Servicios entregados por semana y entidad
  const servicesByWeekAndEntity = useMemo(() => {
    const result = {}
    
    WEEKS.forEach(week => {
      result[week.id] = {
        restaurants: {},
        drivers: {}
      }
    })
    
    services.forEach(service => {
      if (!isServiceDelivered(service)) return
      
      const createdAt = service.createdAt?.toDate?.()
      if (!createdAt) return
      
      const weekId = getWeekId(createdAt)
      if (!result[weekId]) return
      
      // Agrupar por restaurante
      if (service.restaurantId) {
        if (!result[weekId].restaurants[service.restaurantId]) {
          result[weekId].restaurants[service.restaurantId] = {
            restaurantId: service.restaurantId,
            restaurantName: service.restaurantName || restaurants.find(r => r.id === service.restaurantId)?.name || 'Sin nombre',
            services: [],
            totalUSD: 0,
            settled: false,
            settlementId: null
          }
        }
        result[weekId].restaurants[service.restaurantId].services.push(service)
        result[weekId].restaurants[service.restaurantId].totalUSD += service.deliveryFee || 0
        
        const settledField = service.settledRestaurant !== undefined ? service.settledRestaurant : service.settled
        if (settledField) {
          result[weekId].restaurants[service.restaurantId].settled = true
          result[weekId].restaurants[service.restaurantId].settlementId = service.restaurantSettlementId
        }
      }
      
      // Agrupar por repartidor
      if (service.driverId) {
        if (!result[weekId].drivers[service.driverId]) {
          result[weekId].drivers[service.driverId] = {
            driverId: service.driverId,
            driverName: service.driverName || drivers.find(d => d.id === service.driverId)?.name || 'Sin nombre',
            services: [],
            totalUSD: 0,
            settled: false,
            settlementId: null
          }
        }
        result[weekId].drivers[service.driverId].services.push(service)
        result[weekId].drivers[service.driverId].totalUSD += service.driverEarnings || 0
        
        const settledField = service.settledDriver !== undefined ? service.settledDriver : service.settled
        if (settledField) {
          result[weekId].drivers[service.driverId].settled = true
          result[weekId].drivers[service.driverId].settlementId = service.driverSettlementId
        }
      }
    })
    
    return result
  }, [services, restaurants, drivers])

  // Liquidaciones por semana
  const settlementsByWeek = useMemo(() => {
    const result = {}
    
    WEEKS.forEach(week => {
      result[week.id] = {
        restaurants: [],
        drivers: []
      }
    })
    
    restaurantSettlements.forEach(settlement => {
      if (settlement.weekId && result[settlement.weekId]) {
        result[settlement.weekId].restaurants.push(settlement)
      }
    })
    
    driverSettlements.forEach(settlement => {
      if (settlement.weekId && result[settlement.weekId]) {
        result[settlement.weekId].drivers.push(settlement)
      }
    })
    
    return result
  }, [restaurantSettlements, driverSettlements])

  // Datos de cada semana con estado (SOLO semanas con servicios)
  const weeksData = useMemo(() => {
    return WEEKS.map(week => {
      const weekServices = servicesByWeekAndEntity[week.id] || { restaurants: {}, drivers: {} }
      const weekSettlements = settlementsByWeek[week.id] || { restaurants: [], drivers: [] }
      const isEnded = isWeekEnded(week.monday)
      
      // Datos para restaurantes
      const restaurantEntities = Object.values(weekServices.restaurants)
      const totalRestaurantUSD = restaurantEntities.reduce((sum, e) => sum + e.totalUSD, 0)
      const restaurantServicesCount = restaurantEntities.reduce((sum, e) => sum + e.services.length, 0)
      const pendingRestaurantEntities = restaurantEntities.filter(e => !e.settled)
      const pendingRestaurantUSD = pendingRestaurantEntities.reduce((sum, e) => sum + e.totalUSD, 0)
      
      // Estado restaurantes
      let restaurantStatus = 'empty'
      let restaurantStatusColor = 'grey'
      if (week.isCurrent && !isEnded) {
        if (restaurantServicesCount > 0) {
          restaurantStatus = 'current'
          restaurantStatusColor = 'primary'
        }
      } else if (weekSettlements.restaurants.some(s => s.status === 'pagado')) {
        restaurantStatus = 'paid'
        restaurantStatusColor = 'success'
      } else if (weekSettlements.restaurants.some(s => s.status === 'pendiente')) {
        restaurantStatus = 'pending_confirmation'
        restaurantStatusColor = 'warning'
      } else if (pendingRestaurantUSD > 0) {
        restaurantStatus = 'pending_settlement'
        restaurantStatusColor = 'error'
      }
      
      // Datos para repartidores
      const driverEntities = Object.values(weekServices.drivers)
      const totalDriverUSD = driverEntities.reduce((sum, e) => sum + e.totalUSD, 0)
      const driverServicesCount = driverEntities.reduce((sum, e) => sum + e.services.length, 0)
      const pendingDriverEntities = driverEntities.filter(e => !e.settled)
      const pendingDriverUSD = pendingDriverEntities.reduce((sum, e) => sum + e.totalUSD, 0)
      
      // Estado repartidores
      let driverStatus = 'empty'
      let driverStatusColor = 'grey'
      if (week.isCurrent && !isEnded) {
        if (driverServicesCount > 0) {
          driverStatus = 'current'
          driverStatusColor = 'primary'
        }
      } else if (weekSettlements.drivers.some(s => s.status === 'pagado')) {
        driverStatus = 'paid'
        driverStatusColor = 'success'
      } else if (weekSettlements.drivers.some(s => s.status === 'pendiente')) {
        driverStatus = 'pending_confirmation'
        driverStatusColor = 'warning'
      } else if (pendingDriverUSD > 0) {
        driverStatus = 'pending_settlement'
        driverStatusColor = 'error'
      }
      
      return {
        ...week,
        isEnded,
        hasServices: restaurantServicesCount > 0 || driverServicesCount > 0,
        restaurants: {
          entities: restaurantEntities,
          totalUSD: totalRestaurantUSD,
          servicesCount: restaurantServicesCount,
          pendingEntities: pendingRestaurantEntities,
          pendingUSD: pendingRestaurantUSD,
          settlements: weekSettlements.restaurants,
          status: restaurantStatus,
          statusColor: restaurantStatusColor
        },
        drivers: {
          entities: driverEntities,
          totalUSD: totalDriverUSD,
          servicesCount: driverServicesCount,
          pendingEntities: pendingDriverEntities,
          pendingUSD: pendingDriverUSD,
          settlements: weekSettlements.drivers,
          status: driverStatus,
          statusColor: driverStatusColor
        }
      }
    }).filter(week => week.hasServices) // FILTRAR: Solo semanas con servicios
  }, [servicesByWeekAndEntity, settlementsByWeek])

  // Estadísticas resumen
  const stats = useMemo(() => {
    let pendingSettlement = { count: 0, amount: 0 }
    let pendingConfirmation = { count: 0, amount: 0 }
    let paid = { count: 0, amount: 0 }
    
    weeksData.forEach(week => {
      const data = tabValue === 0 ? week.restaurants : week.drivers
      
      if (data.status === 'pending_settlement') {
        pendingSettlement.count++
        pendingSettlement.amount += data.pendingUSD
      } else if (data.status === 'pending_confirmation') {
        pendingConfirmation.count++
        pendingConfirmation.amount += data.settlements.reduce((sum, s) => sum + (s.amount || 0), 0)
      } else if (data.status === 'paid') {
        paid.count++
        paid.amount += data.settlements.reduce((sum, s) => sum + (s.amount || 0), 0)
      }
    })
    
    return { pendingSettlement, pendingConfirmation, paid }
  }, [weeksData, tabValue])

  // Historial de liquidaciones pagadas
  const paidSettlementsHistory = useMemo(() => {
    const allSettlements = tabValue === 0 ? restaurantSettlements : driverSettlements
    return allSettlements
      .filter(s => s.status === 'pagado')
      .sort((a, b) => {
        const dateA = a.paidAt?.toDate?.() || a.updatedAt?.toDate?.() || new Date(0)
        const dateB = b.paidAt?.toDate?.() || b.updatedAt?.toDate?.() || new Date(0)
        return dateB - dateA
      })
  }, [restaurantSettlements, driverSettlements, tabValue])

  // ============================================
  // HANDLERS
  // ============================================

  const handleCreateSettlement = async (weekId, type) => {
    const weekData = weeksData.find(w => w.id === weekId)
    if (!weekData) return
    
    const entities = type === 'restaurante' ? weekData.restaurants.pendingEntities : weekData.drivers.pendingEntities
    
    if (entities.length === 0) {
      enqueueSnackbar('No hay entidades pendientes para liquidar', { variant: 'warning' })
      return
    }
    
    setSaving(true)
    
    try {
      let totalUSD = 0
      const serviceIds = []
      
      entities.forEach(entity => {
        totalUSD += entity.totalUSD
        entity.services.forEach(s => serviceIds.push(s.id))
      })
      
      const totalVES = totalUSD * exchangeRate.rate
      const week = WEEKS.find(w => w.id === weekId)
      
      // Crear liquidación por cada entidad
      for (const entity of entities) {
        const entityTotalUSD = entity.totalUSD
        const entityTotalVES = entityTotalUSD * exchangeRate.rate
        
        const settlementData = {
          type,
          entityId: entity.restaurantId || entity.driverId,
          entityName: entity.restaurantName || entity.driverName,
          amount: entityTotalUSD,
          amountVES: entityTotalVES,
          exchangeRate: exchangeRate.rate,
          serviceCount: entity.services.length,
          serviceIds: entity.services.map(s => s.id),
          period: 'Semana: ' + week.label,
          weekId
        }
        
        if (type === 'restaurante') {
          settlementData.restaurantId = entity.restaurantId
          settlementData.restaurantName = entity.restaurantName
        } else {
          settlementData.driverId = entity.driverId
          settlementData.driverName = entity.driverName
        }
        
        const result = await createSettlement(settlementData)
        
        if (result.success) {
          for (const serviceId of entity.services.map(s => s.id)) {
            if (type === 'restaurante') {
              await updateService(serviceId, { settledRestaurant: true, restaurantSettlementId: result.id })
            } else {
              await updateService(serviceId, { settledDriver: true, driverSettlementId: result.id })
            }
          }
        }
      }
      
      enqueueSnackbar(`Liquidación creada: $${totalUSD.toFixed(2)} = ${formatVES(totalVES)}`, { variant: 'success' })
    } catch (error) {
      console.error('Error:', error)
      enqueueSnackbar('Error al crear liquidación: ' + error.message, { variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmSettlement = async () => {
    if (!confirmDialog.settlement) return
    
    const result = await paySettlement(confirmDialog.settlement.id)
    
    if (result.success) {
      const actionText = confirmDialog.settlement.type === 'restaurante' ? 'Cobrado' : 'Pagado'
      enqueueSnackbar(`Liquidación marcada como ${actionText}`, { variant: 'success' })
      setConfirmDialog({ open: false, settlement: null })
    } else {
      enqueueSnackbar('Error al procesar', { variant: 'error' })
    }
  }

  const toggleWeek = (weekId) => {
    setExpandedWeeks(prev => ({ ...prev, [weekId]: !prev[weekId] }))
  }

  // ============================================
  // HELPERS RENDER
  // ============================================

  const getStatusConfig = (status) => {
    const configs = {
      empty: { icon: '—', label: 'Sin servicios', color: 'text.disabled', bgColor: 'grey.100' },
      current: { icon: '🔵', label: 'En curso', color: 'primary.main', bgColor: 'primary.light' },
      pending_settlement: { icon: '🟠', label: 'Por liquidar', color: 'error.main', bgColor: 'error.light' },
      pending_confirmation: { icon: '🟡', label: 'Pendiente de cobro', color: 'warning.main', bgColor: 'warning.light' },
      paid: { icon: '✅', label: 'Cobrado', color: 'success.main', bgColor: 'success.light' }
    }
    
    if (tabValue === 1 && status === 'pending_confirmation') {
      configs.pending_confirmation.label = 'Pendiente de pago'
    }
    if (tabValue === 1 && status === 'paid') {
      configs.paid.label = 'Pagado'
    }
    
    return configs[status] || configs.empty
  }

  const currentData = tabValue === 0 ? 'restaurants' : 'drivers'
  const actionText = tabValue === 0 ? { verb: 'Cobrar', noun: 'Cobrado' } : { verb: 'Pagar', noun: 'Pagado' }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {loading && <LinearProgress />}
      
      {/* Header */}
      <Stack 
        direction={{ xs: 'column', sm: 'row' }} 
        justifyContent="space-between" 
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={1}
      >
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold">
            Liquidaciones
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestiona los cobros a restaurantes y pagos a repartidores
          </Typography>
        </Box>
        <Chip 
          icon={<MoneyIcon />} 
          label={'Tasa: ' + formatRateWithBs(exchangeRate.rate)}
          color="primary"
          variant="outlined"
        />
      </Stack>

      {/* Tarjetas Resumen */}
      <Grid container spacing={2}>
        <Grid item xs={4}>
          <Card sx={{ borderRadius: 2, bgcolor: 'error.light', height: '100%' }}>
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <WarningIcon sx={{ color: 'error.main', mb: 0.5 }} />
              <Typography variant="h5" fontWeight="bold" color="error.dark">
                ${stats.pendingSettlement.amount.toFixed(2)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Por Liquidar ({stats.pendingSettlement.count} sem.)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4}>
          <Card sx={{ borderRadius: 2, bgcolor: 'warning.light', height: '100%' }}>
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <ClockIcon sx={{ color: 'warning.main', mb: 0.5 }} />
              <Typography variant="h5" fontWeight="bold" color="warning.dark">
                ${stats.pendingConfirmation.amount.toFixed(2)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Pendiente Confirm. ({stats.pendingConfirmation.count} sem.)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4}>
          <Card sx={{ borderRadius: 2, bgcolor: 'success.light', height: '100%' }}>
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <CheckIcon sx={{ color: 'success.main', mb: 0.5 }} />
              <Typography variant="h5" fontWeight="bold" color="success.dark">
                ${stats.paid.amount.toFixed(2)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {actionText.noun} ({stats.paid.count} sem.)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ borderRadius: 2 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} variant="fullWidth">
          <Tab 
            icon={<StoreIcon />} 
            iconPosition="start"
            label={<Typography>Restaurantes</Typography>}
          />
          <Tab 
            icon={<BikeIcon />} 
            iconPosition="start"
            label={<Typography>Repartidores</Typography>}
          />
        </Tabs>
      </Paper>

      {/* Lista de Semanas (Solo con servicios) */}
      {weeksData.length > 0 ? (
        <Stack spacing={2}>
          {weeksData.map((week) => {
            const data = week[currentData]
            const statusConfig = getStatusConfig(data.status)
            const isExpanded = expandedWeeks[week.id]
            
            return (
              <Card key={week.id} sx={{ borderRadius: 2 }}>
                {/* Header de la semana */}
                <Stack 
                  direction="row" 
                  alignItems="center" 
                  justifyContent="space-between"
                  sx={{ 
                    p: 2, 
                    cursor: 'pointer',
                    bgcolor: statusConfig.bgColor,
                    '&:hover': { opacity: 0.9 }
                  }}
                  onClick={() => toggleWeek(week.id)}
                >
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <CalendarIcon color="action" />
                    <Box>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {week.isCurrent ? '📅 SEMANA ACTUAL • ' : '📅 SEMANA '}
                        {week.label}
                      </Typography>
                      {data.servicesCount > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          {data.servicesCount} servicios • ${data.totalUSD.toFixed(2)}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Chip 
                      size="small"
                      label={`${statusConfig.icon} ${statusConfig.label}`}
                      sx={{ 
                        fontWeight: 'medium',
                        color: statusConfig.color,
                        bgcolor: 'white'
                      }}
                    />
                    <IconButton size="small">
                      {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
                    </IconButton>
                  </Stack>
                </Stack>
                
                {/* Contenido expandido */}
                <Collapse in={isExpanded}>
                  <CardContent sx={{ pt: 2 }}>
                    {/* Mensaje semana actual en curso */}
                    {week.isCurrent && !week.isEnded && (
                      <Paper sx={{ p: 2, mb: 2, bgcolor: 'primary.light', borderRadius: 2 }}>
                        <Typography variant="body2" color="primary.dark">
                          🔵 La semana está en curso. La liquidación estará disponible el domingo noche.
                        </Typography>
                      </Paper>
                    )}
                    
                    {/* Entidades de la semana */}
                    {data.entities.length > 0 && (
                      <Stack spacing={1}>
                        {data.entities.map((entity) => {
                          const entitySettlement = data.settlements.find(s => s.entityId === (entity.restaurantId || entity.driverId))
                          const isSettled = entity.settled || entitySettlement
                          
                          return (
                            <Paper 
                              key={entity.restaurantId || entity.driverId}
                              variant="outlined"
                              sx={{ p: 1.5, borderRadius: 2 }}
                            >
                              <Grid container spacing={1} alignItems="center">
                                <Grid item xs={12} sm={4}>
                                  <Typography variant="body2" fontWeight="medium">
                                    🏪 {entity.restaurantName || entity.driverName}
                                  </Typography>
                                </Grid>
                                <Grid item xs={6} sm={2}>
                                  <Typography variant="caption" color="text.secondary">
                                    Servicios
                                  </Typography>
                                  <Typography variant="body2">
                                    {entity.services.length}
                                  </Typography>
                                </Grid>
                                <Grid item xs={6} sm={2}>
                                  <Typography variant="caption" color="text.secondary">
                                    Total USD
                                  </Typography>
                                  <Typography variant="body2" fontWeight="bold">
                                    ${entity.totalUSD.toFixed(2)}
                                  </Typography>
                                </Grid>
                                <Grid item xs={12} sm={4} sx={{ textAlign: 'right' }}>
                                  {isSettled && entitySettlement ? (
                                    <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                                      <Typography variant="caption" color="text.secondary">
                                        = {formatVES(entitySettlement.amountVES)}
                                      </Typography>
                                      {entitySettlement.status === 'pendiente' ? (
                                        <Button
                                          size="small"
                                          variant="contained"
                                          color="warning"
                                          onClick={() => setConfirmDialog({ open: true, settlement: entitySettlement })}
                                        >
                                          Confirmar
                                        </Button>
                                      ) : (
                                        <Chip 
                                          size="small" 
                                          icon={<CheckIcon />} 
                                          label={actionText.noun}
                                          color="success"
                                        />
                                      )}
                                    </Stack>
                                  ) : !isSettled && week.isEnded ? (
                                    <Typography variant="caption" color="error.main">
                                      Pendiente
                                    </Typography>
                                  ) : null}
                                </Grid>
                              </Grid>
                            </Paper>
                          )
                        })}
                      </Stack>
                    )}
                    
                    {/* Total y acciones */}
                    {data.entities.length > 0 && (
                      <Paper sx={{ p: 2, mt: 2, bgcolor: 'grey.100', borderRadius: 2 }}>
                        <Grid container spacing={2} alignItems="center">
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">
                              Total Semana
                            </Typography>
                            <Typography variant="h6" fontWeight="bold">
                              ${data.totalUSD.toFixed(2)}
                            </Typography>
                          </Grid>
                          <Grid item xs={6} sx={{ textAlign: 'right' }}>
                            {data.status === 'pending_settlement' && (
                              <Button
                                variant="contained"
                                color="error"
                                onClick={() => handleCreateSettlement(week.id, tabValue === 0 ? 'restaurante' : 'repartidor')}
                                disabled={saving}
                                startIcon={saving ? <CircularProgress size={16} /> : <MoneyIcon />}
                              >
                                Crear Liquidación
                              </Button>
                            )}
                            {data.status === 'pending_confirmation' && data.settlements.length > 0 && (
                              <Typography variant="caption" color="warning.main">
                                = {formatVES(data.settlements.reduce((sum, s) => sum + (s.amountVES || 0), 0))}
                              </Typography>
                            )}
                            {data.status === 'paid' && data.settlements.length > 0 && (
                              <Typography variant="body2" fontWeight="bold" color="success.main">
                                = {formatVES(data.settlements.reduce((sum, s) => sum + (s.amountVES || 0), 0))}
                              </Typography>
                            )}
                          </Grid>
                        </Grid>
                      </Paper>
                    )}
                  </CardContent>
                </Collapse>
              </Card>
            )
          })}
        </Stack>
      ) : (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
          <Typography variant="body1" color="text.secondary">
            No hay servicios registrados
          </Typography>
        </Paper>
      )}

      {/* Historial de Cobros/Pagos */}
      <Paper sx={{ borderRadius: 2, mt: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 2, pb: 1 }}>
          <HistoryIcon color="action" />
          <Typography variant="subtitle1" fontWeight="bold">
            Historial de {tabValue === 0 ? 'Cobros' : 'Pagos'}
          </Typography>
        </Stack>
        <Divider />
        
        {paidSettlementsHistory.length > 0 ? (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fecha</TableCell>
                  <TableCell>{tabValue === 0 ? 'Restaurante' : 'Repartidor'}</TableCell>
                  <TableCell align="center">Serv.</TableCell>
                  <TableCell align="right">Monto USD</TableCell>
                  <TableCell align="right">Equivalente Bs</TableCell>
                  <TableCell align="right">Tasa</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paidSettlementsHistory.map((settlement) => (
                  <TableRow key={settlement.id} hover>
                    <TableCell>
                      <Typography variant="body2">
                        {formatShortDate(settlement.paidAt || settlement.updatedAt)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {settlement.restaurantName || settlement.driverName || settlement.entityName}
                      </Typography>
                      {settlement.period && (
                        <Typography variant="caption" color="text.secondary">
                          {settlement.period}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Chip size="small" label={settlement.serviceCount || 0} />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="bold" color="success.main">
                        ${(settlement.amount || 0).toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        {formatVES(settlement.amountVES)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="caption" color="text.secondary">
                        {settlement.exchangeRate?.toFixed(2) || '--'} Bs/$                       </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No hay {tabValue === 0 ? 'cobros' : 'pagos'} registrados
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Diálogo Confirmar */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, settlement: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Confirmar {confirmDialog.settlement?.type === 'restaurante' ? 'Cobro' : 'Pago'}
        </DialogTitle>
        <DialogContent>
          {confirmDialog.settlement && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography>
                {confirmDialog.settlement.type === 'restaurante' 
                  ? '¿Confirmas que el restaurante ha realizado el pago?'
                  : '¿Confirmas que se ha realizado el pago al repartidor?'}
              </Typography>
              
              <Paper sx={{ p: 2, bgcolor: 'grey.100' }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      {confirmDialog.settlement.type === 'restaurante' ? 'Restaurante' : 'Repartidor'}
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {confirmDialog.settlement.restaurantName || confirmDialog.settlement.driverName}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Servicios</Typography>
                    <Typography variant="body2">{confirmDialog.settlement.serviceCount}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Monto USD</Typography>
                    <Typography variant="body2" fontWeight="bold" color="success.main">
                      ${(confirmDialog.settlement.amount || 0).toFixed(2)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Equivalente Bs</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {formatVES(confirmDialog.settlement.amountVES)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">
                      Tasa aplicada: {confirmDialog.settlement.exchangeRate?.toFixed(2) || '--'} Bs/$                     </Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setConfirmDialog({ open: false, settlement: null })}>
            Cancelar
          </Button>
          <Button 
            variant="contained" 
            color={confirmDialog.settlement?.type === 'restaurante' ? 'warning' : 'success'}
            onClick={handleConfirmSettlement}
          >
            Confirmar {confirmDialog.settlement?.type === 'restaurante' ? 'Cobro' : 'Pago'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Footer */}
      <Box sx={{ mt: 2, py: 3, textAlign: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
          <Box
            component="img"
            src="/logo-192.png"
            alt="ON Delivery"
            sx={{ width: 28, height: 28, borderRadius: 1 }}
          />
          <Typography
            variant="subtitle2"
            fontWeight="bold"
            sx={{
              background: RIDERY_COLORS.gradientPrimary,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent'
            }}
          >
            ON Delivery
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" display="block">
          © {currentYear} Copyright. Desarrollado por Erick Simosa
        </Typography>
        <Typography variant="caption" color="text.secondary">
          ericksimosa@gmail.com - 0424 3036024
        </Typography>
      </Box>
    </Box>
  )
}