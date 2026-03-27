// src/pages/admin/Reportes.jsx
import { useState, useEffect, useMemo } from 'react'
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Grid, 
  Stack, 
  Skeleton,
  Paper,
  useTheme,
  useMediaQuery,
  Chip,
  alpha,
  LinearProgress
} from '@mui/material'
import {
  Inventory as PackageIcon,
  AttachMoney as MoneyIcon,
  Store as StoreIcon,
  TwoWheeler as BikeIcon,
  TrendingUp as TrendingUpIcon,
  CalendarToday as CalendarIcon
} from '@mui/icons-material'
import { formatCurrency } from '../../store/useStore'
import { 
  subscribeToServices,
  subscribeToRestaurants,
  subscribeToDrivers
} from '../../services/firestore'
import { RIDERY_COLORS } from '../../theme/theme'

// ============================================
// FUNCIONES AUXILIARES FUERA DEL COMPONENTE
// ============================================

// Obtener el lunes de la semana actual
const getMondayOfWeek = (date) => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  monday.setHours(0, 0, 0, 0)
  return monday
}

// Obtener el primer día del mes
const getFirstDayOfMonth = (date) => {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0)
}

// Obtener inicio del día actual
const getStartOfToday = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
}

// Formatear rango de semana
const formatWeekRange = () => {
  const monday = getMondayOfWeek(new Date())
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  const options = { day: 'numeric', month: 'short' }
  return `${monday.toLocaleDateString('es-VE', options)} - ${sunday.toLocaleDateString('es-VE', options)}`
}

export default function Reportes() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  
  const [services, setServices] = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const currentYear = new Date().getFullYear()

  // ✅ SUSCRIPCIONES EN TIEMPO REAL
  useEffect(() => {
    setLoading(true)
    
    const unsubServices = subscribeToServices((data) => {
      setServices(data)
      setLoading(false)
    })
    
    const unsubRestaurants = subscribeToRestaurants((data) => {
      setRestaurants(data)
    })
    
    const unsubDrivers = subscribeToDrivers((data) => {
      setDrivers(data)
    })
    
    return () => {
      unsubServices()
      unsubRestaurants()
      unsubDrivers()
    }
  }, [])

  // ✅ ESTADÍSTICAS GENERALES - useMemo para tiempo real
  const stats = useMemo(() => {
    const now = new Date()
    const startOfMonth = getFirstDayOfMonth(now)
    const startOfToday = getStartOfToday()
    const startOfWeek = getMondayOfWeek(now)
    
    // Servicios entregados
    const deliveredServices = services.filter(s => s.status === 'entregado')
    
    // Servicios del mes actual
    const monthlyServices = deliveredServices.filter(s => {
      const createdAt = s.createdAt?.toDate?.()
      return createdAt && createdAt >= startOfMonth
    })
    
    // ✅ Servicios de la semana actual (desde el lunes)
    const weeklyServices = deliveredServices.filter(s => {
      const createdAt = s.createdAt?.toDate?.()
      return createdAt && createdAt >= startOfWeek
    })
    
    // Servicios de hoy
    const todayServices = services.filter(s => {
      const createdAt = s.createdAt?.toDate?.()
      return createdAt && createdAt >= startOfToday
    })
    
    // ✅ Ingresos del mes (comisiones de la plataforma)
    const monthlyRevenue = monthlyServices.reduce((sum, s) => sum + (s.platformFee || 0), 0)
    
    // ✅ Ingresos de la semana actual
    const weeklyRevenue = weeklyServices.reduce((sum, s) => sum + (s.platformFee || 0), 0)
    
    // Servicios completados hoy
    const completedToday = todayServices.filter(s => s.status === 'entregado').length
    
    // Servicios pendientes
    const pendingServices = services.filter(s => 
      s.status === 'pendiente' || s.status === 'sin_repartidor'
    ).length
    
    // Servicios en proceso
    const inProgressServices = services.filter(s => 
      s.status === 'asignado' || s.status === 'en_camino'
    ).length
    
    // Restaurantes activos
    const activeRestaurants = restaurants.filter(r => r.active).length
    
    // Repartidores activos
    const activeDrivers = drivers.filter(d => d.active).length
    
    return {
      totalServices: deliveredServices.length,
      monthlyRevenue,
      weeklyRevenue,
      weeklyServicesCount: weeklyServices.length,
      activeRestaurants,
      activeDrivers,
      pendingServices,
      inProgressServices,
      completedToday,
      servicesToday: todayServices.length
    }
  }, [services, restaurants, drivers])

  // ✅ DATOS SEMANALES - useMemo para tiempo real
  const weeklyData = useMemo(() => {
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
    const today = new Date()
    const mondayOfWeek = getMondayOfWeek(today)
    
    const weekData = []
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(mondayOfWeek)
      date.setDate(mondayOfWeek.getDate() + i)
      date.setHours(0, 0, 0, 0)
      
      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)
      
      const dayServices = services.filter(s => {
        const createdAt = s.createdAt?.toDate?.()
        return createdAt && createdAt >= date && createdAt < nextDate && s.status === 'entregado'
      })
      
      const ingresos = dayServices.reduce((sum, s) => sum + (s.platformFee || 0), 0)
      const isToday = date.toDateString() === today.toDateString()
      
      weekData.push({
        day: days[i],
        fecha: date.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' }),
        servicios: dayServices.length,
        ingresos,
        isToday,
        date: date
      })
    }
    
    return weekData
  }, [services])

  // ✅ TOP RESTAURANTES - useMemo para tiempo real
  const topRestaurants = useMemo(() => {
    const statsMap = {}
    
    services.forEach(service => {
      if (service.status === 'entregado' && service.restaurantId) {
        if (!statsMap[service.restaurantId]) {
          statsMap[service.restaurantId] = {
            id: service.restaurantId,
            name: service.restaurantName || 'N/A',
            services: 0
          }
        }
        statsMap[service.restaurantId].services++
      }
    })
    
    return Object.values(statsMap).sort((a, b) => b.services - a.services).slice(0, 5)
  }, [services])

  // ✅ TOP REPARTIDORES - useMemo para tiempo real
  const topDrivers = useMemo(() => {
    const statsMap = {}
    
    services.forEach(service => {
      if (service.status === 'entregado' && service.driverId) {
        if (!statsMap[service.driverId]) {
          statsMap[service.driverId] = {
            id: service.driverId,
            name: service.driverName || 'N/A',
            services: 0
          }
        }
        statsMap[service.driverId].services++
      }
    })
    
    return Object.values(statsMap).sort((a, b) => b.services - a.services).slice(0, 5)
  }, [services])

  // ✅ TOTALES DE LA SEMANA
  const weekTotals = useMemo(() => {
    return weeklyData.reduce((acc, day) => ({
      services: acc.services + day.servicios,
      ingresos: acc.ingresos + day.ingresos
    }), { services: 0, ingresos: 0 })
  }, [weeklyData])

  // ✅ TARJETAS DE ESTADÍSTICAS (5 tarjetas ahora)
  const statsCards = [
    { 
      title: 'Servicios Totales', 
      value: stats?.totalServices || 0, 
      icon: PackageIcon, 
      bgColor: '#3B82F6'
    },
    { 
      title: 'Ingresos del Mes', 
      value: formatCurrency(stats?.monthlyRevenue || 0), 
      icon: MoneyIcon, 
      bgColor: '#10B981'
    },
    { 
      title: 'Ingresos de la Semana', 
      value: formatCurrency(stats?.weeklyRevenue || 0), 
      icon: TrendingUpIcon, 
      bgColor: '#8B5CF6'
    },
    { 
      title: 'Restaurantes Activos', 
      value: stats?.activeRestaurants || 0, 
      icon: StoreIcon, 
      bgColor: '#06B6D4'
    },
    { 
      title: 'Repartidores Activos', 
      value: stats?.activeDrivers || 0, 
      icon: BikeIcon, 
      bgColor: '#F59E0B'
    },
  ]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {loading && <LinearProgress />}
      
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold">
            Reportes
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Métricas y estadísticas de la plataforma
          </Typography>
        </Box>
      </Stack>

      {/* Stats Cards - 5 tarjetas */}
      <Grid container spacing={{ xs: 2, sm: 3 }}>
        {statsCards.map((stat, index) => (
          <Grid item xs={6} sm={4} md={2.4} key={index}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                {loading ? (
                  <Skeleton variant="rectangular" height={60} />
                ) : (
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        {stat.title}
                      </Typography>
                      <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold">
                        {stat.value}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        width: { xs: 36, sm: 48 },
                        height: { xs: 36, sm: 48 },
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: stat.bgColor,
                        color: 'white',
                        boxShadow: `0 4px 12px ${stat.bgColor}40`
                      }}
                    >
                      <stat.icon sx={{ fontSize: { xs: 20, sm: 24 } }} />
                    </Box>
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Tarjeta Semana Actual */}
      <Card sx={{ 
        background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
        color: 'white'
      }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <CalendarIcon />
            <Typography variant="subtitle1" fontWeight="bold">
              Semana Actual
            </Typography>
          </Stack>
          <Typography variant="h6" fontWeight="medium">
            {formatWeekRange()}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.8, mt: 0.5 }}>
            Se reinicia cada lunes • {stats?.weeklyServicesCount || 0} servicios entregados
          </Typography>
        </CardContent>
      </Card>

      {/* Weekly Report - Ordenado Lunes a Domingo */}
      <Card>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold">
              Resumen Semanal (Lunes - Domingo)
            </Typography>
            {!loading && (
              <Stack direction="row" spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  Total: <strong>{weekTotals.services} servicios</strong>
                </Typography>
                <Typography variant="body2" color="success.main" fontWeight="bold">
                  {formatCurrency(weekTotals.ingresos)}
                </Typography>
              </Stack>
            )}
          </Stack>
          
          {loading ? (
            <Skeleton variant="rectangular" height={100} />
          ) : (
            <Grid container spacing={1}>
              {weeklyData.map((day, index) => (
                <Grid item xs={12} sm={6} md={1.7} key={index}>
                  <Paper 
                    variant="outlined" 
                    sx={{ 
                      textAlign: 'center', 
                      p: 1,
                      bgcolor: day.isToday 
                        ? alpha(theme.palette.primary.main, 0.1)
                        : day.servicios > 0 ? 'inherit' : 'grey.50',
                      border: day.isToday ? 2 : 1,
                      borderColor: day.isToday ? 'primary.main' : 'divider'
                    }}
                  >
                    {day.isToday && (
                      <Chip label="Hoy" size="small" color="primary" sx={{ mb: 0.5, height: 18, fontSize: '0.65rem' }} />
                    )}
                    <Typography variant="caption" color={day.isToday ? 'primary' : 'text.secondary'} fontWeight={day.isToday ? 'bold' : 'normal'}>
                      {day.day}
                    </Typography>
                    <Typography variant="caption" display="block" color="text.disabled">
                      {day.fecha}
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" color={day.servicios > 0 ? 'primary' : 'text.disabled'}>
                      {day.servicios}
                    </Typography>
                    <Typography variant="body2" color="success.main" fontWeight="medium">
                      {formatCurrency(day.ingresos)}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Top Restaurants & Drivers */}
      <Grid container spacing={{ xs: 2, sm: 3 }}>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <StoreIcon color="primary" />
                <Typography variant="subtitle1" fontWeight="bold">
                  Top Restaurantes
                </Typography>
              </Stack>
              
              {loading ? (
                <Skeleton variant="rectangular" height={150} />
              ) : topRestaurants.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
                  <StoreIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    No hay datos disponibles
                  </Typography>
                </Paper>
              ) : (
                <Stack spacing={1.5}>
                  {topRestaurants.map((restaurant, index) => (
                    <Stack 
                      key={restaurant.id || index} 
                      direction="row" 
                      justifyContent="space-between" 
                      alignItems="center"
                      sx={{
                        p: 1,
                        borderRadius: 1,
                        bgcolor: index === 0 ? 'success.light' : 'inherit'
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography 
                          variant="body2" 
                          fontWeight="bold" 
                          color={index === 0 ? 'success.dark' : 'text.secondary'}
                          sx={{ width: 20 }}
                        >
                          {index + 1}.
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {restaurant.name}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" fontWeight="bold" color="primary">
                        {restaurant.services} servicios
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <BikeIcon color="success" />
                <Typography variant="subtitle1" fontWeight="bold">
                  Top Repartidores
                </Typography>
              </Stack>
              
              {loading ? (
                <Skeleton variant="rectangular" height={150} />
              ) : topDrivers.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
                  <BikeIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    No hay datos disponibles
                  </Typography>
                </Paper>
              ) : (
                <Stack spacing={1.5}>
                  {topDrivers.map((driver, index) => (
                    <Stack 
                      key={driver.id || index} 
                      direction="row" 
                      justifyContent="space-between" 
                      alignItems="center"
                      sx={{
                        p: 1,
                        borderRadius: 1,
                        bgcolor: index === 0 ? 'warning.light' : 'inherit'
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography 
                          variant="body2" 
                          fontWeight="bold" 
                          color={index === 0 ? 'warning.dark' : 'text.secondary'}
                          sx={{ width: 20 }}
                        >
                          {index + 1}.
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {driver.name}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" fontWeight="bold" color="success.main">
                        {driver.services} servicios
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Additional Stats */}
      <Card>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
            Resumen de Estados
          </Typography>
          
          {loading ? (
            <Skeleton variant="rectangular" height={80} />
          ) : (
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.light' }}>
                  <Typography variant="h5" fontWeight="bold" color="warning.dark">
                    {stats?.pendingServices || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pendientes
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.light' }}>
                  <Typography variant="h5" fontWeight="bold" color="info.dark">
                    {stats?.inProgressServices || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    En Proceso
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light' }}>
                  <Typography variant="h5" fontWeight="bold" color="success.dark">
                    {stats?.completedToday || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Completados Hoy
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.light' }}>
                  <Typography variant="h5" fontWeight="bold" color="primary.dark">
                    {stats?.servicesToday || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Servicios Hoy
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          )}
        </CardContent>
      </Card>

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