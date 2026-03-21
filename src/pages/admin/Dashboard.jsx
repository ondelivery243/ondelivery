// src/pages/admin/Dashboard.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
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
  CircularProgress
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
  Update as UpdateIcon
} from '@mui/icons-material'
import { useSnackbar } from 'notistack'
import { formatCurrency, formatDate, formatTime } from '../../store/useStore'
import { 
  subscribeToServices, 
  subscribeToRestaurants, 
  subscribeToDrivers,
  subscribeToExchangeRate,
  getDashboardStats,
  formatVes
} from '../../services/firestore'
import { RIDERY_COLORS } from '../../theme/theme'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { enqueueSnackbar } = useSnackbar()
  
  // ============================================================
  // 👇 MODIFICA ESTA LÍNEA PARA MOSTRAR U OCULTAR EL BOTÓN
  // Cambia a 'false' para ocultar el icono de actualizar tasa
  const mostrarBotonActualizar = false; 
  // ============================================================

  const [stats, setStats] = useState(null)
  const [services, setServices] = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [drivers, setDrivers] = useState([])
  const [exchangeRate, setExchangeRate] = useState({ rate: 0, lastUpdate: null })
  const [loading, setLoading] = useState(true)
  const [refreshingRate, setRefreshingRate] = useState(false)
  
  // Estado para rastrear cuando REALMENTE cambió la tasa
  const [rateUpdateDisplay, setRateUpdateDisplay] = useState({ date: null, rate: null })
  const prevRateRef = useRef(0)
  const currentYear = new Date().getFullYear()

  // Cargar datos
  useEffect(() => {
    setLoading(true)
    
    const unsubServices = subscribeToServices((data) => setServices(data))
    const unsubRestaurants = subscribeToRestaurants((data) => setRestaurants(data))
    const unsubDrivers = subscribeToDrivers((data) => setDrivers(data))
    const unsubExchangeRate = subscribeToExchangeRate((data) => {
      setExchangeRate(data)
      
      // Solo actualizar la fecha mostrada si el VALOR de la tasa cambió
      if (data.rate && data.rate !== prevRateRef.current) {
        prevRateRef.current = data.rate
        setRateUpdateDisplay({ date: data.lastUpdate, rate: data.rate })
      }
    })
    
    loadStats()
    setLoading(false)
    
    return () => {
      unsubServices()
      unsubRestaurants()
      unsubDrivers()
      unsubExchangeRate()
    }
  }, [])

  const loadStats = useCallback(async () => {
    const statsData = await getDashboardStats()
    setStats(statsData)
  }, [])

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

  const statsCards = [
    { title: 'Restaurantes Activos', value: stats?.activeRestaurants || 0, total: stats?.totalRestaurants || 0, change: stats?.activeRestaurants > 0 ? '+activos' : '', trend: 'up', icon: StoreIcon, bgColor: '#FF6B35', path: '/admin/restaurantes' },
    { title: 'Repartidores Online', value: stats?.onlineDrivers || 0, total: stats?.activeDrivers || 0, change: stats?.onlineDrivers > 0 ? 'trabajando' : '', trend: 'up', icon: BikeIcon, bgColor: '#10B981', path: '/admin/repartidores' },
    { title: 'Servicios Hoy', value: stats?.servicesToday || 0, change: stats?.completedToday ? `${stats.completedToday} completados` : '', trend: 'up', icon: PackageIcon, bgColor: '#3B82F6', path: '/admin/servicios' },
    { title: 'Ingresos del Mes', value: formatCurrency(stats?.monthlyRevenue || 0), change: stats?.todayRevenue ? `Hoy: ${formatCurrency(stats.todayRevenue)}` : '', trend: 'up', icon: MoneyIcon, bgColor: '#8B5CF6', path: '/admin/reportes' },
  ]

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

  const formatUpdateDate = (date) => {
    if (!date) return ''
    const weekday = date.toLocaleDateString('es-VE', { weekday: 'long' })
    const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1)
    const dateStr = date.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: '2-digit' })
    const timeStr = date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true })
    return `${capitalizedWeekday} ${dateStr} | ${timeStr}`
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 3 }, minWidth: 0, width: '100%' }}>
      
      {/* Exchange Rate Card - Tasa del Día */}
      <Card sx={{ background: 'linear-gradient(135deg, #1a237e 0%, #283593 50%, #3949ab 100%)', color: 'white', minWidth: 0 }}>
        <CardContent sx={{ p: { xs: 1.5, sm: 3 } }}>
          <Stack direction="row" spacing={{ xs: 1, sm: 2 }} alignItems="center" justifyContent="space-between">
            
            {/* Contenido Izquierdo: Icono + Textos */}
            <Stack direction="row" spacing={{ xs: 1, sm: 2 }} alignItems="center">
              <Box sx={{ width: { xs: 40, sm: 56 }, height: { xs: 40, sm: 56 }, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.2)' }}>
                <ExchangeIcon sx={{ fontSize: { xs: 24, sm: 32 } }} />
              </Box>
              
              {/* Bloque de Texto: Título, Valor y Fecha */}
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ opacity: 0.8, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                  Tasa del Día
                </Typography>
                <Typography variant="h5" fontWeight="bold" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                  {formatExchangeRate(exchangeRate.rate)} Bs/$                 </Typography>
              
                {/* Fecha - Solo se actualiza cuando el VALOR cambia */}
                {rateUpdateDisplay.date && (
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ opacity: 0.9, mt: 0.5 }}>
                    <UpdateIcon sx={{ fontSize: 14 }} />
                    <Typography variant="body2" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                      Actualizado: {formatUpdateDate(rateUpdateDisplay.date)}
                    </Typography>
                  </Stack>
                )}
              </Box>
            </Stack>

            {/* Botón Derecho (Condicional) */}
            {mostrarBotonActualizar && (
              <Tooltip title="Actualizar tasa desde API">
                <IconButton 
                  onClick={handleRefreshRate}
                  disabled={refreshingRate}
                  sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
                >
                  {refreshingRate ? <CircularProgress size={24} color="inherit" /> : <RefreshIcon />}
                </IconButton>
              </Tooltip>
            )}
            
          </Stack>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <Grid container spacing={{ xs: 1.5, sm: 3 }}>
        {statsCards.map((stat, index) => (
          <Grid item xs={6} md={3} key={index}>
            <Card sx={{ height: '100%', minWidth: 0, cursor: 'pointer', transition: 'all 0.2s', '&:hover': { boxShadow: '0 8px 24px rgba(0,0,0,0.12)', transform: 'translateY(-2px)' } }} onClick={() => navigate(stat.path)}>
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
                      {!isMobile && stat.change && (
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                          {stat.trend === 'up' ? <TrendingUpIcon sx={{ fontSize: 14, color: 'success.main' }} /> : <TrendingDownIcon sx={{ fontSize: 14, color: 'error.main' }} />}
                          <Typography variant="caption" sx={{ color: stat.trend === 'up' ? 'success.main' : 'error.main', fontSize: '0.7rem' }}>
                            {stat.change}
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

      {/* Recent Services Table */}
      <Card sx={{ minWidth: 0 }}>
        <CardContent sx={{ p: { xs: 1, sm: 2 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <PackageIcon color="primary" sx={{ fontSize: { xs: 18, sm: 24 } }} />
              <Typography variant={isMobile ? 'subtitle2' : 'subtitle1'} fontWeight="bold">
                Servicios Recientes
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.5}>
              <IconButton size="small" onClick={loadStats}>
                <RefreshIcon fontSize="small" />
              </IconButton>
              <Chip label="Ver todos" variant="outlined" size="small" onClick={() => navigate('/admin/servicios')} onDelete={() => navigate('/admin/servicios')} deleteIcon={<ArrowIcon />} clickable sx={{ fontSize: { xs: '0.7rem', sm: '0.8rem' } }} />
            </Stack>
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
                      <TableRow key={service.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 }, cursor: 'pointer' }} onClick={() => navigate(`/admin/servicios?id=${service.id}`)}>
                        <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: { xs: '0.65rem', sm: '0.875rem' } }}>{service.serviceId}</Typography></TableCell>
                        <TableCell><Typography variant="body2" fontWeight="medium" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' }, maxWidth: { xs: 80, sm: 'none' }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{service.restaurantName || 'N/A'}</Typography></TableCell>
                        {!isMobile && <TableCell><Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>{service.zoneName || 'N/A'}</Typography></TableCell>}
                        <TableCell><Typography variant="body2" fontWeight="bold" color="primary" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>{formatCurrency(service.deliveryFee)}</Typography></TableCell>
                        <TableCell><Chip icon={statusConfig.icon} label={statusConfig.label} size="small" color={statusConfig.color} variant="outlined" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' }, height: { xs: 20, sm: 24 } }} /></TableCell>
                        {!isMobile && <TableCell><Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>{formatTime(service.createdAt)}</Typography></TableCell>}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats Cards */}
      <Grid container spacing={{ xs: 1.5, sm: 3 }}>
        <Grid item xs={4} sm={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%)', color: 'white', height: '100%', minWidth: 0 }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2.5 }, textAlign: 'center' }}>
              <Typography variant="caption" sx={{ opacity: 0.9, fontSize: { xs: '0.65rem', sm: '0.8rem' } }}>Comisión Hoy</Typography>
              <Typography variant="h5" fontWeight="bold" sx={{ fontSize: { xs: '1.25rem', sm: '1.75rem' }, mt: 0.5 }}>{formatCurrency(stats?.todayRevenue || 0)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4} sm={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #F39C12 0%, #F5B041 100%)', color: 'white', height: '100%', minWidth: 0 }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2.5 }, textAlign: 'center' }}>
              <Typography variant="caption" sx={{ opacity: 0.9, fontSize: { xs: '0.65rem', sm: '0.8rem' } }}>Pendientes</Typography>
              <Typography variant="h5" fontWeight="bold" sx={{ fontSize: { xs: '1.25rem', sm: '1.75rem' }, mt: 0.5 }}>{stats?.pendingServices || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4} sm={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)', color: 'white', height: '100%', minWidth: 0 }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2.5 }, textAlign: 'center' }}>
              <Typography variant="caption" sx={{ opacity: 0.9, fontSize: { xs: '0.65rem', sm: '0.8rem' } }}>En Proceso</Typography>
              <Typography variant="h5" fontWeight="bold" sx={{ fontSize: { xs: '1.25rem', sm: '1.75rem' }, mt: 0.5 }}>{stats?.inProgressServices || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Online Drivers */}
      {!isMobile && (
        <Card>
          <CardContent sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <BikeIcon color="success" />
                <Typography variant="subtitle1" fontWeight="bold">Repartidores Online</Typography>
              </Stack>
              <Chip label={`${drivers.filter(d => d.isOnline).length} activos`} color="success" size="small" />
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
              {drivers.filter(d => d.isOnline).length === 0 && <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No hay repartidores en línea</Typography>}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Footer Info */}
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