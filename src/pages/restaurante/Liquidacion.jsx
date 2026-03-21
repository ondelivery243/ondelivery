// src/pages/restaurante/Liquidacion.jsx
import { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Stack,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
  useMediaQuery,
  alpha,
  Button,
  LinearProgress
} from '@mui/material'
import {
  AttachMoney as MoneyIcon,
  Receipt as ReceiptIcon,
  CheckCircle as CheckIcon,
  AccessTime as ClockIcon,
  Inventory as PackageIcon
} from '@mui/icons-material'
import { formatCurrency, formatDate, useRestaurantStore, useStore } from '../../store/useStore'
import { subscribeToSettlements, subscribeToRestaurantServices, getRestaurantByUserId, getRestaurant } from '../../services/firestore'
import { RIDERY_COLORS } from '../../theme/theme'

// ============================================
// 📅 FUNCIONES DE MANEJO SEMANAL
// ============================================

// Obtener lunes de la semana
const getMonday = (date) => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

// Obtener domingo de la semana
const getSunday = (monday) => {
  const d = new Date(monday)
  d.setDate(d.getDate() + 6)
  return d
}

// Formatear rango de semana
const formatWeekRange = (monday) => {
  const sunday = getSunday(monday)
  const options = { day: '2-digit', month: 'short' }
  return monday.toLocaleDateString('es-VE', options) + ' - ' + sunday.toLocaleDateString('es-VE', options)
}

// Obtener la semana actual
const getCurrentWeekId = () => {
  const monday = getMonday(new Date())
  return monday.toISOString().split('T')[0]
}

export default function RestauranteLiquidacion() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { restaurantData, setRestaurantData } = useRestaurantStore()
  const { user } = useStore()
  
  const [settlements, setSettlements] = useState([])
  const [services, setServices] = useState([])
  const [pendingAmount, setPendingAmount] = useState(0)
  const [totalPaid, setTotalPaid] = useState(0)
  const [loading, setLoading] = useState(true)
  const currentYear = new Date().getFullYear()
  const currentWeekId = getCurrentWeekId()

  // Cargar datos en tiempo real
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      
      let restaurant = restaurantData
      if (!restaurant && user) {
        if (user.restaurantId) {
          restaurant = await getRestaurant(user.restaurantId)
        } else {
          restaurant = await getRestaurantByUserId(user.uid)
        }
        if (restaurant) {
          setRestaurantData(restaurant)
        }
      }
      
      if (restaurant?.id) {
        // Cargar liquidaciones en tiempo real
        const unsubSettlements = subscribeToSettlements((data) => {
          const restaurantSettlements = data.filter(s => s.restaurantId === restaurant.id)
          setSettlements(restaurantSettlements)
          
          // Calcular total pagado
          const paid = restaurantSettlements
            .filter(s => s.status === 'pagado')
            .reduce((sum, s) => sum + (s.amount || 0), 0)
          setTotalPaid(paid)
        })
        
        // Cargar servicios en tiempo real para calcular pendiente
        const unsubServices = subscribeToRestaurantServices(restaurant.id, (servicesData) => {
          // Usar settledRestaurant si existe, si no usar settled (compatibilidad)
          const unpaid = servicesData
            .filter(s => {
              const isDelivered = s.status === 'entregado'
              const settledField = s.settledRestaurant !== undefined ? s.settledRestaurant : s.settled
              return isDelivered && !settledField
            })
            .reduce((sum, s) => sum + (s.deliveryFee || 0), 0)
          setPendingAmount(unpaid)
          setServices(servicesData)
          setLoading(false)
        })
        
        return () => {
          unsubSettlements()
          unsubServices()
        }
      } else {
        setLoading(false)
      }
    }
    
    loadData()
  }, [restaurantData, setRestaurantData, user])

  // Servicios pendientes de liquidar
  const pendingServices = services.filter(s => {
    const isDelivered = s.status === 'entregado'
    const settledField = s.settledRestaurant !== undefined ? s.settledRestaurant : s.settled
    return isDelivered && !settledField
  })

  // Calcular total de la semana actual
  const getWeekTotal = () => {
    const monday = new Date(currentWeekId)
    monday.setHours(0, 0, 0, 0)
    
    const sunday = getSunday(monday)
    sunday.setHours(23, 59, 59, 999)
    
    return services
      .filter(s => {
        const isDelivered = s.status === 'entregado'
        const createdAt = s.createdAt?.toDate?.()
        const inWeek = createdAt && createdAt >= monday && createdAt <= sunday
        return isDelivered && inWeek
      })
      .reduce((sum, s) => sum + (s.deliveryFee || 0), 0)
  }

  // Calcular servicios de la semana actual
  const getWeekServicesCount = () => {
    const monday = new Date(currentWeekId)
    monday.setHours(0, 0, 0, 0)
    
    const sunday = getSunday(monday)
    sunday.setHours(23, 59, 59, 999)
    
    return services.filter(s => {
      const isDelivered = s.status === 'entregado'
      const createdAt = s.createdAt?.toDate?.()
      return isDelivered && createdAt && createdAt >= monday && createdAt <= sunday
    }).length
  }

  const weekTotal = getWeekTotal()
  const weekServicesCount = getWeekServicesCount()
  const currentWeekRange = formatWeekRange(getMonday(new Date()))

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <LinearProgress />
        <Typography variant="body2" color="text.secondary">Cargando liquidaciones...</Typography>
      </Box>
    )
  }

  if (!restaurantData) {
    return (
      <Card sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          <MoneyIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No hay datos del restaurante
          </Typography>
          <Typography variant="body2" color="text.disabled">
            Si acabas de registrarte, espera a que un administrador active tu cuenta.
          </Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Header */}
      <Box>
        <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold">
          Liquidaciones
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Estado de pagos y liquidaciones
        </Typography>
      </Box>

      {/* Tarjeta de Semana Actual */}
      <Card sx={{ borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.1), border: 1, borderColor: 'primary.main' }}>
        <CardContent sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="caption" color="text.secondary">
                Semana Actual
              </Typography>
              <Typography variant="body2" fontWeight="bold" color="primary.main">
                {currentWeekRange}
              </Typography>
            </Box>
            <Chip 
              icon={<ClockIcon />} 
              label="En curso" 
              color="primary" 
              size="small" 
            />
          </Stack>
        </CardContent>
      </Card>

      {/* Stats Cards - Esta Semana */}
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Card sx={{ borderRadius: 2, bgcolor: 'info.light', height: '100%' }}>
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <MoneyIcon sx={{ color: 'info.main', mb: 0.5 }} />
              <Typography variant="h5" fontWeight="bold" color="info.dark">
                {formatCurrency(weekTotal)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Pagado Esta Semana
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6}>
          <Card sx={{ borderRadius: 2, bgcolor: 'success.light', height: '100%' }}>
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <PackageIcon sx={{ color: 'success.main', mb: 0.5 }} />
              <Typography variant="h5" fontWeight="bold" color="success.dark">
                {weekServicesCount}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Servicios Esta Semana
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Summary Cards */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderRadius: 2, bgcolor: 'warning.light', height: '100%' }}>
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <ClockIcon sx={{ color: 'warning.main', fontSize: 32, mb: 1 }} />
              <Typography variant="h4" fontWeight="bold" color="warning.dark">
                {formatCurrency(pendingAmount)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Por Pagar
              </Typography>
              <Typography variant="caption" color="text.disabled">
                {pendingServices.length} servicios pendientes
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderRadius: 2, bgcolor: 'success.light', height: '100%' }}>
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <CheckIcon sx={{ color: 'success.main', fontSize: 32, mb: 1 }} />
              <Typography variant="h4" fontWeight="bold" color="success.dark">
                {formatCurrency(totalPaid)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Pagado
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderRadius: 2, height: '100%' }}>
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <MoneyIcon sx={{ color: 'primary.main', fontSize: 32, mb: 1 }} />
              <Typography variant="h4" fontWeight="bold" color="primary">
                {settlements.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Liquidaciones
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Pending Services */}
      {pendingServices.length > 0 && (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <ClockIcon color="warning" />
                <Typography variant="subtitle1" fontWeight="bold">
                  Servicios Pendientes de Pagar
                </Typography>
              </Stack>
              <Chip label={`${pendingServices.length} servicios`} color="warning" size="small" />
            </Stack>
            
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Fecha</TableCell>
                    {!isMobile && <TableCell>Zona</TableCell>}
                    <TableCell align="right">Monto</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingServices.slice(0, 10).map((service) => (
                    <TableRow key={service.id}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {service.serviceId}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(service.createdAt)}
                        </Typography>
                      </TableCell>
                      {!isMobile && (
                        <TableCell>
                          <Typography variant="body2">{service.zoneName}</Typography>
                        </TableCell>
                      )}
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold" color="warning.main">
                          {formatCurrency(service.deliveryFee)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            {pendingServices.length > 10 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
                Mostrando 10 de {pendingServices.length} servicios pendientes
              </Typography>
            )}
          </CardContent>
        </Card>
      )}

      {/* Settlements History */}
      <Card sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <ReceiptIcon color="primary" />
              <Typography variant="subtitle1" fontWeight="bold">
                Historial de Liquidaciones
              </Typography>
            </Stack>
          </Stack>
          
          {settlements.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
              <ReceiptIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                No hay liquidaciones registradas
              </Typography>
            </Paper>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Fecha</TableCell>
                    {!isMobile && <TableCell>Período</TableCell>}
                    <TableCell>Servicios</TableCell>
                    <TableCell align="right">Monto</TableCell>
                    <TableCell>Estado</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {settlements.map((settlement) => (
                    <TableRow key={settlement.id}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {settlement.id?.slice(-8).toUpperCase()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(settlement.createdAt)}
                        </Typography>
                      </TableCell>
                      {!isMobile && (
                        <TableCell>
                          <Typography variant="body2">
                            {settlement.period || '-'}
                          </Typography>
                        </TableCell>
                      )}
                      <TableCell>
                        <Typography variant="body2">
                          {settlement.serviceCount || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold">
                          {formatCurrency(settlement.amount)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={settlement.status === 'pagado' ? <CheckIcon /> : <ClockIcon />}
                          label={settlement.status === 'pagado' ? 'Pagado' : 'Pendiente'}
                          size="small"
                          color={settlement.status === 'pagado' ? 'success' : 'warning'}
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Info Box */}
      <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.info.main, 0.05), borderRadius: 2 }}>
        <Typography variant="body2" color="text.secondary">
          <strong>Información:</strong> Las liquidaciones se procesan semanalmente. 
          El monto pendiente será incluido en la próxima liquidación programada.
          Para consultas sobre pagos, contacta a administración.
        </Typography>
      </Paper>

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