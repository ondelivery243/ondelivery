// src/pages/repartidor/Historial.jsx
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
  TextField,
  InputAdornment,
  IconButton,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
  useMediaQuery,
  alpha,
  Collapse,
  LinearProgress
} from '@mui/material'
import {
  Search as SearchIcon,
  Inventory as PackageIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  AccessTime as ClockIcon,
  TwoWheeler as BikeIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  LocationOn as LocationIcon,
  Store as StoreIcon,
  AttachMoney as MoneyIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon
} from '@mui/icons-material'
import { useStore, formatCurrency, formatDate, formatTime } from '../../store/useStore'
import { subscribeToDriverServices, getDriverByUserId, subscribeToSettlements } from '../../services/firestore'
import { RIDERY_COLORS } from '../../theme/theme'

// Formatear monto en Bolivares
const formatVES = (amount) => {
  if (!amount || amount === 0) return '0,00 Bs.'
  return new Intl.NumberFormat('es-VE', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }).format(amount) + ' Bs.'
}

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

export default function RepartidorHistorial() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { user } = useStore()
  
  const [services, setServices] = useState([])
  const [filteredServices, setFilteredServices] = useState([])
  const [settlements, setSettlements] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [expandedId, setExpandedId] = useState(null)
  const [driverData, setDriverData] = useState(null)
  const [mainTab, setMainTab] = useState(0) // 0: Servicios, 1: Liquidaciones
  const [loading, setLoading] = useState(true)

  const currentYear = new Date().getFullYear()
  const currentWeekId = getCurrentWeekId()

  // Cargar datos del repartidor y suscribirse a servicios y liquidaciones
  useEffect(() => {
    const loadData = async () => {
      if (user?.uid) {
        const driver = await getDriverByUserId(user.uid)
        setDriverData(driver)
        
        if (driver?.id) {
          setLoading(true)
          
          // Suscribirse a servicios
          const unsubServices = subscribeToDriverServices(driver.id, (servicesData) => {
            setServices(servicesData)
          })
          
          // Suscribirse a liquidaciones
          const unsubSettlements = subscribeToSettlements((allSettlements) => {
            // Filtrar solo liquidaciones de este repartidor
            const driverSettlements = allSettlements.filter(s => 
              s.driverId === driver.id || 
              (s.type === 'repartidor' && s.entityId === driver.id)
            )
            setSettlements(driverSettlements)
            setLoading(false)
          })
          
          return () => {
            unsubServices()
            unsubSettlements()
          }
        }
      }
    }
    loadData()
  }, [user])

  // Filtrar servicios
  useEffect(() => {
    let filtered = [...services]
    
    // Filtro por estado
    if (statusFilter !== 'todos') {
      filtered = filtered.filter(s => s.status === statusFilter)
    }
    
    // Filtro por búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(s =>
        s.serviceId?.toLowerCase().includes(term) ||
        s.restaurantName?.toLowerCase().includes(term) ||
        s.zoneName?.toLowerCase().includes(term) ||
        s.deliveryAddress?.toLowerCase().includes(term) ||
        s.clientName?.toLowerCase().includes(term)
      )
    }
    
    setFilteredServices(filtered)
  }, [services, searchTerm, statusFilter])

  // Configuración de estados
  const getStatusConfig = (status) => {
    const configs = {
      pendiente: { color: 'warning', label: 'Pendiente', icon: <ClockIcon /> },
      asignado: { color: 'info', label: 'Asignado', icon: <BikeIcon /> },
      en_camino: { color: 'primary', label: 'En Camino', icon: <BikeIcon /> },
      entregado: { color: 'success', label: 'Entregado', icon: <CheckIcon /> },
      cancelado: { color: 'error', label: 'Cancelado', icon: <CancelIcon /> }
    }
    return configs[status] || configs.pendiente
  }

  // Calcular totales de servicios
  const totalEarnings = filteredServices
    .filter(s => s.status === 'entregado')
    .reduce((sum, s) => sum + (s.driverEarnings || 0), 0)

  const totalServices = filteredServices.filter(s => s.status === 'entregado').length

  // Calcular totales de liquidaciones
  const totalPaid = settlements
    .filter(s => s.status === 'pagado')
    .reduce((sum, s) => sum + (s.amount || 0), 0)

  const totalPending = settlements
    .filter(s => s.status === 'pendiente')
    .reduce((sum, s) => sum + (s.amount || 0), 0)

  // Servicios pendientes de liquidar (entregados y no settledDriver)
  const pendingServices = services.filter(s => {
    const isDelivered = s.status === 'entregado'
    const notSettled = !s.settledDriver
    return isDelivered && notSettled
  })

  // Calcular ganancias de la semana actual
  const getWeekEarnings = () => {
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
      .reduce((sum, s) => sum + (s.driverEarnings || 0), 0)
  }

  const weekEarnings = getWeekEarnings()

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

  const weekServicesCount = getWeekServicesCount()

  // Tabs para filtro de estado (servicios)
  const serviceTabs = [
    { value: 'todos', label: 'Todos', count: services.length },
    { value: 'entregado', label: 'Entregados', count: services.filter(s => s.status === 'entregado').length },
    { value: 'en_camino', label: 'En camino', count: services.filter(s => s.status === 'en_camino').length },
    { value: 'cancelado', label: 'Cancelados', count: services.filter(s => s.status === 'cancelado').length }
  ]

  // Tabs principales
  const mainTabs = [
    { 
      value: 0, 
      label: 'Servicios', 
      icon: <PackageIcon />,
      count: services.length 
    },
    { 
      value: 1, 
      label: 'Liquidaciones', 
      icon: <ReceiptIcon />,
      count: settlements.length 
    }
  ]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Header */}
      <Box>
        <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold">
          {mainTab === 0 ? 'Historial de Servicios' : 'Mis Liquidaciones'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {mainTab === 0 ? 'Revisa todos tus servicios realizados' : 'Estado de tus pagos y liquidaciones'}
        </Typography>
      </Box>

      {/* Main Tabs */}
      <Paper sx={{ borderRadius: 2 }}>
        <Tabs
          value={mainTab}
          onChange={(e, v) => setMainTab(v)}
          variant="fullWidth"
        >
          {mainTabs.map((tab) => (
            <Tab
              key={tab.value}
              icon={tab.icon}
              iconPosition="start"
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>{tab.label}</span>
                  <Chip label={tab.count} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                </Stack>
              }
            />
          ))}
        </Tabs>
      </Paper>

      {loading && mainTab === 1 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <LinearProgress />
          <Typography variant="body2" color="text.secondary">Cargando liquidaciones...</Typography>
        </Box>
      ) : mainTab === 0 ? (
        // ==================== TAB SERVICIOS ====================
        <>
          {/* Stats Cards - Semana Actual */}
          <Card sx={{ borderRadius: 2, bgcolor: 'primary.light' }}>
            <CardContent sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Semana Actual
                  </Typography>
                  <Typography variant="body2" fontWeight="bold" color="primary.main">
                    {formatWeekRange(getMonday(new Date()))}
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
          
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Card sx={{ borderRadius: 2, bgcolor: 'success.light' }}>
                <CardContent sx={{ p: 2, textAlign: 'center' }}>
                  <MoneyIcon sx={{ color: 'success.main', mb: 0.5 }} />
                  <Typography variant="h5" fontWeight="bold" color="success.dark">
                    {formatCurrency(weekEarnings)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Ganado Esta Semana
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6}>
              <Card sx={{ borderRadius: 2, bgcolor: 'info.light' }}>
                <CardContent sx={{ p: 2, textAlign: 'center' }}>
                  <PackageIcon sx={{ color: 'info.main', mb: 0.5 }} />
                  <Typography variant="h5" fontWeight="bold" color="info.dark">
                    {weekServicesCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Servicios Esta Semana
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Stats Cards - Totales Históricos */}
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Card sx={{ borderRadius: 2 }}>
                <CardContent sx={{ p: 2, textAlign: 'center' }}>
                  <MoneyIcon sx={{ color: 'success.main', mb: 0.5 }} />
                  <Typography variant="h6" fontWeight="bold">
                    {formatCurrency(totalEarnings)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Total Histórico
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6}>
              <Card sx={{ borderRadius: 2 }}>
                <CardContent sx={{ p: 2, textAlign: 'center' }}>
                  <PackageIcon sx={{ color: 'info.main', mb: 0.5 }} />
                  <Typography variant="h6" fontWeight="bold">
                    {totalServices}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Total Servicios
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Search */}
          <TextField
            fullWidth
            size="small"
            placeholder="Buscar por ID, restaurante, zona..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: searchTerm && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchTerm('')}>
                    <CancelIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              )
            }}
          />

          {/* Status Tabs */}
          <Paper sx={{ borderRadius: 2 }}>
            <Tabs
              value={statusFilter}
              onChange={(e, v) => setStatusFilter(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                '& .MuiTab-root': {
                  minWidth: 'auto',
                  px: 2
                }
              }}
            >
              {serviceTabs.map((tab) => (
                <Tab
                  key={tab.value}
                  value={tab.value}
                  label={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <span>{tab.label}</span>
                      <Chip label={tab.count} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                    </Stack>
                  }
                />
              ))}
            </Tabs>
          </Paper>

          {/* Services List */}
          <Stack spacing={1.5}>
            {filteredServices.length === 0 ? (
              <Card sx={{ borderRadius: 2, py: 4 }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <PackageIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body1" color="text.secondary">
                    No se encontraron servicios
                  </Typography>
                  {searchTerm && (
                    <Typography variant="body2" color="text.disabled">
                      Intenta con otra búsqueda
                    </Typography>
                  )}
                </CardContent>
              </Card>
            ) : (
              filteredServices.map((service) => {
                const statusConfig = getStatusConfig(service.status)
                const isExpanded = expandedId === service.id
                
                return (
                  <Card
                    key={service.id}
                    sx={{
                      borderRadius: 2,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }
                    }}
                    onClick={() => setExpandedId(isExpanded ? null : service.id)}
                  >
                    <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                      {/* Header Row */}
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ mb: 1 }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {service.serviceId}
                          </Typography>
                          <Chip
                            icon={statusConfig.icon}
                            label={statusConfig.label}
                            size="small"
                            color={statusConfig.color}
                            variant="outlined"
                            sx={{ height: 22, fontSize: '0.7rem' }}
                          />
                        </Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {service.status === 'entregado' && (
                            <Typography variant="body2" fontWeight="bold" color="success.main">
                              {formatCurrency(service.driverEarnings)}
                            </Typography>
                          )}
                          {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
                        </Stack>
                      </Stack>

                      {/* Info Row */}
                      <Grid container spacing={1}>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            <StoreIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                            {service.restaurantName}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            <LocationIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                            {service.zoneName}
                          </Typography>
                        </Grid>
                      </Grid>

                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ mt: 1 }}
                      >
                        <Typography variant="caption" color="text.disabled">
                          {formatDate(service.createdAt)} - {formatTime(service.createdAt)}
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          Tarifa: {formatCurrency(service.deliveryFee)}
                        </Typography>
                      </Stack>

                      {/* Expanded Details */}
                      <Collapse in={isExpanded}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 2,
                            mt: 2,
                            bgcolor: alpha(theme.palette.primary.main, 0.02)
                          }}
                        >
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="caption" color="text.secondary">
                                Dirección de entrega
                              </Typography>
                              <Typography variant="body2">
                                {service.deliveryAddress}
                              </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="caption" color="text.secondary">
                                Cliente
                              </Typography>
                              <Typography variant="body2">
                                {service.clientName || 'No especificado'}
                              </Typography>
                              {service.clientPhone && (
                                <Typography variant="body2" color="text.secondary">
                                  {service.clientPhone}
                                </Typography>
                              )}
                            </Grid>
                            {service.notes && (
                              <Grid item xs={12}>
                                <Typography variant="caption" color="text.secondary">
                                  Notas
                                </Typography>
                                <Typography variant="body2">
                                  {service.notes}
                                </Typography>
                              </Grid>
                            )}
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">
                                Método de pago
                              </Typography>
                              <Typography variant="body2">
                                {service.paymentMethod === 'efectivo' ? 'Efectivo' : 'Pagado online'}
                              </Typography>
                            </Grid>
                            {service.paymentMethod === 'efectivo' && service.amountToCollect > 0 && (
                              <Grid item xs={6}>
                                <Typography variant="caption" color="text.secondary">
                                  Monto a cobrar
                                </Typography>
                                <Typography variant="body2" fontWeight="bold">
                                  {formatCurrency(service.amountToCollect)}
                                </Typography>
                              </Grid>
                            )}
                            {service.status === 'entregado' && (
                              <Grid item xs={12}>
                                <Paper sx={{ p: 1.5, bgcolor: 'success.light', textAlign: 'center' }}>
                                  <Typography variant="body2" color="success.dark">
                                    Tu ganancia: <strong>{formatCurrency(service.driverEarnings)}</strong>
                                  </Typography>
                                </Paper>
                              </Grid>
                            )}
                            {service.status === 'cancelado' && service.cancelReason && (
                              <Grid item xs={12}>
                                <Paper sx={{ p: 1.5, bgcolor: 'error.light' }}>
                                  <Typography variant="caption" color="error.dark">
                                    Motivo de cancelación:
                                  </Typography>
                                  <Typography variant="body2" color="error.dark">
                                    {service.cancelReason}
                                  </Typography>
                                </Paper>
                              </Grid>
                            )}
                          </Grid>
                        </Paper>
                      </Collapse>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </Stack>
        </>
      ) : (
        // ==================== TAB LIQUIDACIONES ====================
        <>
          {/* Stats Cards */}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Card sx={{ borderRadius: 2, bgcolor: 'warning.light', height: '100%' }}>
                <CardContent sx={{ p: 2, textAlign: 'center' }}>
                  <ClockIcon sx={{ color: 'warning.main', fontSize: 32, mb: 1 }} />
                  <Typography variant="h4" fontWeight="bold" color="warning.dark">
                    {formatCurrency(totalPending)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Por Cobrar
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    {settlements.filter(s => s.status === 'pendiente').length} liquidaciones pendientes
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
              <Card sx={{ borderRadius: 2, bgcolor: 'info.light', height: '100%' }}>
                <CardContent sx={{ p: 2, textAlign: 'center' }}>
                  <MoneyIcon sx={{ color: 'info.main', fontSize: 32, mb: 1 }} />
                  <Typography variant="h4" fontWeight="bold" color="info.dark">
                    {formatCurrency(weekEarnings)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Esta Semana
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    {pendingServices.length} servicios pendientes de liquidar
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Servicios pendientes de liquidar */}
          {pendingServices.length > 0 && (
            <Card sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <ClockIcon color="warning" />
                    <Typography variant="subtitle1" fontWeight="bold">
                      Servicios Pendientes de Liquidar
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
                        {!isMobile && <TableCell>Restaurante</TableCell>}
                        <TableCell align="right">Tu Ganancia</TableCell>
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
                              <Typography variant="body2">{service.restaurantName}</Typography>
                            </TableCell>
                          )}
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="bold" color="success.main">
                              {formatCurrency(service.driverEarnings)}
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

          {/* Historial de Liquidaciones */}
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
                  <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 1 }}>
                    Las liquidaciones se procesan semanalmente
                  </Typography>
                </Paper>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Fecha</TableCell>
                        {!isMobile && <TableCell>Período</TableCell>}
                        <TableCell align="center">Servicios</TableCell>
                        <TableCell align="right">Monto USD</TableCell>
                        {!isMobile && <TableCell align="right">Equivalente Bs</TableCell>}
                        <TableCell>Estado</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {settlements.map((settlement) => (
                        <TableRow key={settlement.id} hover>
                          <TableCell>
                            <Typography variant="body2">
                              {formatDate(settlement.createdAt)}
                            </Typography>
                          </TableCell>
                          {!isMobile && (
                            <TableCell>
                              <Typography variant="body2" color="text.secondary">
                                {settlement.period || '-'}
                              </Typography>
                            </TableCell>
                          )}
                          <TableCell align="center">
                            <Chip 
                              label={settlement.serviceCount || '-'} 
                              size="small" 
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="bold" color="success.main">
                              {formatCurrency(settlement.amount)}
                            </Typography>
                          </TableCell>
                          {!isMobile && (
                            <TableCell align="right">
                              <Typography variant="body2" color="text.secondary">
                                {settlement.amountVES ? formatVES(settlement.amountVES) : '-'}
                              </Typography>
                            </TableCell>
                          )}
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
        </>
      )}

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