// src/pages/admin/Dashboard.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { alpha } from '@mui/material/styles'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Stack,
  Skeleton,
  useTheme,
  useMediaQuery,
  Paper,
  IconButton,
  Tooltip,
  CircularProgress,
  Divider,
  Tabs,
  Tab
} from '@mui/material'
import {
  Store as StoreIcon,
  TwoWheeler as BikeIcon,
  Inventory as PackageIcon,
  AttachMoney as MoneyIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  CheckCircle as CheckIcon,
  AccessTime as ClockIcon,
  Cancel as CancelIcon,
  ArrowForward as ArrowIcon,
  Refresh as RefreshIcon,
  TwoWheeler as DeliveryIcon,
  CurrencyExchange as ExchangeIcon,
  Update as UpdateIcon,
  CalendarToday as CalendarIcon,
  Today as TodayIcon,
  DateRange as WeekIcon,
  CalendarMonth as MonthIcon
} from '@mui/icons-material'
import { useSnackbar } from 'notistack'
import { formatCurrency, formatDate, formatTime } from '../../store/useStore'
import { 
  subscribeToServices, 
  subscribeToRestaurants, 
  subscribeToDrivers,
  subscribeToExchangeRate,
  formatVes
} from '../../services/firestore'
import VersionFooter from '../../components/common/VersionFooter'

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
 * La semana va de Lunes a Domingo
 */
const getStartOfWeek = () => {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0 = Domingo, 1 = Lunes, etc.
  // Si es domingo (0), retroceder 6 días para llegar al lunes
  // Si es otro día, retroceder (dayOfWeek - 1) días para llegar al lunes
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

/**
 * Formatea fecha de última actualización
 */
const formatUpdateDate = (date) => {
  if (!date) return ''
  const weekday = date.toLocaleDateString('es-VE', { weekday: 'long' })
  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1)
  const dateStr = date.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: '2-digit' })
  const timeStr = date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true })
  return `${capitalizedWeekday} ${dateStr} | ${timeStr}`
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function AdminDashboard() {
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { enqueueSnackbar } = useSnackbar()
  
  // ============================================================
  // CONFIGURACIÓN: Mostrar/ocultar botón de actualizar tasa
  // ============================================================
  const mostrarBotonActualizar = false

  // ============================================================
  // ESTADOS - DATOS EN TIEMPO REAL
  // ============================================================
  const [services, setServices] = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [drivers, setDrivers] = useState([])
  const [exchangeRate, setExchangeRate] = useState({ rate: 0, lastUpdate: null })
  const [fechaValor, setFechaValor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshingRate, setRefreshingRate] = useState(false)
  
  // Estado para rastrear cuando REALMENTE cambió la tasa
  const [rateUpdateDisplay, setRateUpdateDisplay] = useState({ date: null, rate: null })
  const prevRateRef = useRef(0)
  
  // Tab seleccionada para estadísticas
  const [statsTab, setStatsTab] = useState(0)

  // ============================================================
  // SUSCRIPCIONES EN TIEMPO REAL
  // ============================================================
  useEffect(() => {
    setLoading(true)
    
    const unsubServices = subscribeToServices((data) => setServices(data))
    const unsubRestaurants = subscribeToRestaurants((data) => setRestaurants(data))
    const unsubDrivers = subscribeToDrivers((data) => setDrivers(data))
    const unsubExchangeRate = subscribeToExchangeRate((data) => {
      setExchangeRate(data)
      
      if (data.fechaValor) {
        setFechaValor(data.fechaValor)
      }
      
      // Solo actualizar la fecha mostrada si el VALOR de la tasa cambió
      if (data.rate && data.rate !== prevRateRef.current) {
        prevRateRef.current = data.rate
        setRateUpdateDisplay({ date: data.lastUpdate, rate: data.rate })
      }
    })
    
    setLoading(false)
    
    return () => {
      unsubServices()
      unsubRestaurants()
      unsubDrivers()
      unsubExchangeRate()
    }
  }, [])

  // ============================================================
  // ESTADÍSTICAS CALCULADAS EN TIEMPO REAL
  // ============================================================
  
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

    // Ingresos (platformFee) por período
    const revenueToday = completedToday.reduce((sum, s) => sum + (s.platformFee || 0), 0)
    const revenueThisWeek = completedThisWeek.reduce((sum, s) => sum + (s.platformFee || 0), 0)
    const revenueThisMonth = completedThisMonth.reduce((sum, s) => sum + (s.platformFee || 0), 0)

    // Conteos por estado
    const pendingServices = services.filter(s => s.status === 'pendiente').length
    const inProgressServices = services.filter(s => ['asignado', 'en_camino'].includes(s.status)).length
    const cancelledToday = servicesToday.filter(s => s.status === 'cancelado').length

    // Restaurantes y Repartidores
    const activeRestaurants = restaurants.filter(r => r.active).length
    const totalRestaurants = restaurants.length
    const onlineDrivers = drivers.filter(d => d.isOnline && d.active).length
    const activeDrivers = drivers.filter(d => d.active).length
    const totalDrivers = drivers.length

    return {
      // Diario
      servicesToday: servicesToday.length,
      completedToday: completedToday.length,
      revenueToday,
      cancelledToday,
      
      // Semanal
      servicesThisWeek: servicesThisWeek.length,
      completedThisWeek: completedThisWeek.length,
      revenueThisWeek,
      
      // Mensual
      servicesThisMonth: servicesThisMonth.length,
      completedThisMonth: completedThisMonth.length,
      revenueThisMonth,
      
      // Estados actuales
      pendingServices,
      inProgressServices,
      
      // Restaurantes
      activeRestaurants,
      totalRestaurants,
      
      // Repartidores
      onlineDrivers,
      activeDrivers,
      totalDrivers,
      
      // Períodos (para mostrar en UI)
      periods: {
        dayStart: startOfDay,
        weekStart: startOfWeek,
        monthStart: startOfMonth
      }
    }
  }, [services, restaurants, drivers])

  // ============================================================
  // TARJETAS DE ESTADÍSTICAS PRINCIPALES (en tiempo real)
  // ============================================================
  
  const mainStatsCards = useMemo(() => [
    { 
      title: 'Restaurantes Activos', 
      value: stats.activeRestaurants, 
      total: stats.totalRestaurants, 
      subtitle: `de ${stats.totalRestaurants} total`,
      icon: StoreIcon, 
      bgColor: '#FF6B35', 
      path: '/admin/restaurantes' 
    },
    { 
      title: 'Repartidores Online', 
      value: stats.onlineDrivers, 
      total: stats.activeDrivers, 
      subtitle: `${stats.activeDrivers} activos`,
      icon: BikeIcon, 
      bgColor: '#10B981', 
      path: '/admin/repartidores' 
    },
    { 
      title: 'Servicios Hoy', 
      value: stats.servicesToday, 
      subtitle: `${stats.completedToday} completados`,
      icon: PackageIcon, 
      bgColor: '#3B82F6', 
      path: '/admin/servicios' 
    },
    { 
      title: 'Ingresos del Mes', 
      value: formatCurrency(stats.revenueThisMonth), 
      subtitle: `Semana: ${formatCurrency(stats.revenueThisWeek)}`,
      icon: MoneyIcon, 
      bgColor: '#8B5CF6', 
      path: '/admin/reportes' 
    },
  ], [stats])

  // ============================================================
  // HANDLERS
  // ============================================================
  
  const handleRefreshRate = async () => {
    setRefreshingRate(true)
    try {
      const response = await fetch('/.netlify/functions/updateRate', { method: 'POST' })
      const data = await response.json()
      
      if (data.success) {
        if (data.updated) {
          enqueueSnackbar(`Tasa actualizada: ${data.rate.toFixed(2)} Bs/$`, { variant: 'success' })
        } else {
          enqueueSnackbar('La tasa se mantiene sin cambios', { variant: 'info' })
        }
      } else {
        enqueueSnackbar('Error: ' + (data.error || data.message), { variant: 'error' })
      }
    } catch (error) {
      enqueueSnackbar('Error al actualizar la tasa', { variant: 'error' })
    }
    setRefreshingRate(false)
  }

  // ============================================================
  // CONFIGURACIÓN DE ESTADOS
  // ============================================================
  
  const getStatusConfig = (status) => {
    switch (status) {
      case 'entregado': return { color: 'success', icon: <CheckIcon sx={{ fontSize: 14 }} />, label: 'Entregado' }
      case 'en_camino': return { color: 'primary', icon: <DeliveryIcon sx={{ fontSize: 14 }} />, label: 'En Camino' }
      case 'asignado': return { color: 'info', icon: <DeliveryIcon sx={{ fontSize: 14 }} />, label: 'Asignado' }
      case 'pendiente': return { color: 'warning', icon: <ClockIcon sx={{ fontSize: 14 }} />, label: 'Pendiente' }
      case 'cancelado': return { color: 'error', icon: <CancelIcon sx={{ fontSize: 14 }} />, label: 'Cancelado' }
      default: return { color: 'default', icon: null, label: status }
    }
  }

  const recentServices = services.slice(0, 5)

  const formatExchangeRate = (rate) => {
    if (!rate || rate === 0) return '--'
    return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rate)
  }

  // ============================================================
  // RENDER
  // ============================================================
  
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 3 }, minWidth: 0, width: '100%' }}>
      
      {/* ============================================ */}
      {/* TARJETA DE TASA DE CAMBIO */}
      {/* ============================================ */}
      <Card sx={{ background: 'linear-gradient(135deg, #1a237e 0%, #283593 50%, #3949ab 100%)', color: 'white', minWidth: 0 }}>
        <CardContent sx={{ p: { xs: 1.5, sm: 3 } }}>
          <Stack direction="row" spacing={{ xs: 1, sm: 2 }} alignItems="center" justifyContent="space-between">
            
            {/* Contenido Izquierdo: Icono + Textos */}
            <Stack direction="row" spacing={{ xs: 1, sm: 2 }} alignItems="center">
              <Box sx={{ width: { xs: 40, sm: 56 }, height: { xs: 40, sm: 56 }, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.2)' }}>
                <ExchangeIcon sx={{ fontSize: { xs: 24, sm: 32 } }} />
              </Box>
              
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ opacity: 0.8, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                  Tasa del Día
                </Typography>
                <Typography variant="h5" fontWeight="bold" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                  {formatExchangeRate(exchangeRate.rate)} Bs/$                 </Typography>
              
                {rateUpdateDisplay.date && (
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ opacity: 0.9, mt: 0.5 }}>
                    <UpdateIcon sx={{ fontSize: 14 }} />
                    <Typography variant="body2" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                      Actualizado: {formatUpdateDate(rateUpdateDisplay.date)}
                    </Typography>
                  </Stack>
                )}
                
                {fechaValor && (
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ opacity: 0.9, mt: 0.5 }}>
                    <CalendarIcon sx={{ fontSize: 14 }} />
                    <Typography variant="body2" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                      Fecha Valor: {fechaValor}
                    </Typography>
                  </Stack>
                )}
              </Box>
            </Stack>

            {/* Botón Derecho (Condicional) */}
            {mostrarBotonActualizar && (
              <Tooltip title={refreshingRate ? "Actualizando..." : "Actualizar tasa desde API"}>
                <span>
                  <IconButton 
                    onClick={handleRefreshRate}
                    disabled={refreshingRate}
                    sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
                  >
                    {refreshingRate ? <CircularProgress size={24} color="inherit" /> : <RefreshIcon />}
                  </IconButton>
                </span>
              </Tooltip>
            )}
            
          </Stack>
        </CardContent>
      </Card>

      {/* ============================================ */}
      {/* TARJETAS PRINCIPALES */}
      {/* ============================================ */}
      <Grid container spacing={{ xs: 1.5, sm: 3 }}>
        {mainStatsCards.map((stat, index) => (
          <Grid item xs={6} md={3} key={index}>
            <Card 
              sx={{ 
                height: '100%', 
                minWidth: 0, 
                cursor: 'pointer', 
                transition: 'all 0.2s', 
                '&:hover': { boxShadow: '0 8px 24px rgba(0,0,0,0.12)', transform: 'translateY(-2px)' } 
              }} 
              onClick={() => navigate(stat.path)}
            >
              <CardContent sx={{ p: { xs: 1, sm: 2 } }}>
                {loading ? (
                  <Skeleton variant="rectangular" height={60} />
                ) : (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' }, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {stat.title}
                      </Typography>
                      <Typography variant="h6" fontWeight="bold" sx={{ fontSize: { xs: '1.1rem', sm: '1.5rem' }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {stat.value}
                      </Typography>
                      {!isMobile && stat.subtitle && (
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                          <TrendingUpIcon sx={{ fontSize: 14, color: 'success.main' }} />
                          <Typography variant="caption" sx={{ color: 'success.main', fontSize: '0.7rem' }}>
                            {stat.subtitle}
                          </Typography>
                        </Stack>
                      )}
                    </Box>
                    <Box sx={{ width: { xs: 32, sm: 48 }, height: { xs: 32, sm: 48 }, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: stat.bgColor, color: 'white', flexShrink: 0, boxShadow: `0 4px 12px ${stat.bgColor}40` }}>
                      <stat.icon sx={{ fontSize: { xs: 16, sm: 24 } }} />
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
                <Grid item xs={6} sm={3}>
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
                <Grid item xs={6} sm={3}>
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
                <Grid item xs={6} sm={3}>
                  <Paper sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: alpha(theme.palette.warning.main, 0.1), borderRadius: 2, height: '100%' }}>
                    <Stack spacing={0.5}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                        Ingresos Hoy
                      </Typography>
                      <Typography variant="h6" fontWeight="bold" color="warning.main" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                        {formatCurrency(stats.revenueToday)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' } }}>
                        Comisión plataforma
                      </Typography>
                    </Stack>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Paper sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: alpha(theme.palette.error.main, 0.1), borderRadius: 2, height: '100%' }}>
                    <Stack spacing={0.5}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                        Cancelados
                      </Typography>
                      <Typography variant="h5" fontWeight="bold" color="error.main" sx={{ fontSize: { xs: '1.25rem', sm: '1.75rem' } }}>
                        {stats.cancelledToday}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' } }}>
                        {stats.servicesToday > 0 ? Math.round((stats.cancelledToday / stats.servicesToday) * 100) : 0}% tasa cancelación
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
                        Ingresos Semana
                      </Typography>
                      <Typography variant="h6" fontWeight="bold" color="warning.main" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                        {formatCurrency(stats.revenueThisWeek)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' } }}>
                        Promedio: {formatCurrency(stats.revenueThisWeek / (stats.completedThisWeek || 1))} / servicio
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
                  <Paper sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: alpha(theme.palette.warning.main, 0.1), borderRadius: 2, height: '100%' }}>
                    <Stack spacing={0.5}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                        Ingresos del Mes
                      </Typography>
                      <Typography variant="h6" fontWeight="bold" color="warning.main" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                        {formatCurrency(stats.revenueThisMonth)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' } }}>
                        Promedio: {formatCurrency(stats.revenueThisMonth / (stats.completedThisMonth || 1))} / servicio
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
            <Chip 
              label="Ver todos" 
              variant="outlined" 
              size="small" 
              onClick={() => navigate('/admin/servicios')} 
              onDelete={() => navigate('/admin/servicios')} 
              deleteIcon={<ArrowIcon />} 
              clickable 
              sx={{ fontSize: { xs: '0.7rem', sm: '0.8rem' } }} 
            />
          </Stack>

          {loading ? (
            <Skeleton variant="rectangular" height={200} />
          ) : recentServices.length === 0 ? (
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
                    <TableCell sx={{ fontWeight: 'medium', color: 'text.secondary', whiteSpace: 'nowrap', fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>Restaurante</TableCell>
                    {!isMobile && <TableCell sx={{ fontWeight: 'medium', color: 'text.secondary', fontSize: '0.875rem' }}>Zona</TableCell>}
                    <TableCell sx={{ fontWeight: 'medium', color: 'text.secondary', whiteSpace: 'nowrap', fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>Monto</TableCell>
                    <TableCell sx={{ fontWeight: 'medium', color: 'text.secondary', whiteSpace: 'nowrap', fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>Estado</TableCell>
                    {!isMobile && <TableCell sx={{ fontWeight: 'medium', color: 'text.secondary', fontSize: '0.875rem' }}>Hora</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentServices.map((service) => {
                    const statusConfig = getStatusConfig(service.status)
                    return (
                      <TableRow 
                        key={service.id} 
                        hover 
                        sx={{ '&:last-child td, &:last-child th': { border: 0 }, cursor: 'pointer' }} 
                        onClick={() => navigate(`/admin/servicios?id=${service.id}`)}
                      >
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: { xs: '0.65rem', sm: '0.875rem' } }}>
                            {service.serviceId}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' }, maxWidth: { xs: 80, sm: 'none' }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {service.restaurantName || 'N/A'}
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
                          <Typography variant="body2" fontWeight="bold" color="primary" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
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
          <Card sx={{ background: 'linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%)', color: 'white', height: '100%', minWidth: 0 }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2.5 }, textAlign: 'center' }}>
              <Typography variant="caption" sx={{ opacity: 0.9, fontSize: { xs: '0.65rem', sm: '0.8rem' } }}>Comisión Hoy</Typography>
              <Typography variant="h5" fontWeight="bold" sx={{ fontSize: { xs: '1.25rem', sm: '1.75rem' }, mt: 0.5 }}>
                {formatCurrency(stats.revenueToday)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4} sm={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #F39C12 0%, #F5B041 100%)', color: 'white', height: '100%', minWidth: 0 }}>
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

      {/* ============================================ */}
      {/* REPARTIDORES ONLINE */}
      {/* ============================================ */}
      {!isMobile && (
        <Card>
          <CardContent sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <BikeIcon color="success" />
                <Typography variant="subtitle1" fontWeight="bold">Repartidores Online</Typography>
              </Stack>
              <Chip 
                icon={<UpdateIcon sx={{ fontSize: 14 }} />} 
                label={`${drivers.filter(d => d.isOnline).length} activos`} 
                color="success" 
                size="small" 
              />
            </Stack>
            <Grid container spacing={1}>
              {drivers.filter(d => d.isOnline).slice(0, 6).map((driver) => (
                <Grid item key={driver.id}>
                  <Paper sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1, borderRadius: 2, bgcolor: alpha(theme.palette.success.main, 0.1) }}>
                    <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: 'success.main', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.8rem', fontWeight: 'bold' }}>
                      {driver.name?.charAt(0) || 'R'}
                    </Box>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">{driver.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{driver.totalServices || 0} servicios</Typography>
                    </Box>
                  </Paper>
                </Grid>
              ))}
              {drivers.filter(d => d.isOnline).length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No hay repartidores en línea</Typography>
              )}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Footer con versión */}
      <VersionFooter />
    </Box>
  )
}