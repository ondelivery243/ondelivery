// src/pages/admin/Liquidaciones.jsx
import { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  useTheme,
  useMediaQuery,
  Tab,
  Tabs,
  LinearProgress,
  CircularProgress
} from '@mui/material'
import {
  AttachMoney as MoneyIcon,
  CheckCircle as CheckIcon,
  AccessTime as ClockIcon,
  Receipt as ReceiptIcon,
  Store as StoreIcon,
  TwoWheeler as BikeIcon,
  Payment as PaymentIcon,
  CalendarToday as CalendarIcon,
  Info as InfoIcon,
  ArrowDownward as CobrarIcon,
  ArrowUpward as PagarIcon
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

const formatRate = (rate) => {
  if (!rate || rate === 0) return '--'
  return new Intl.NumberFormat('es-VE', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }).format(rate)
}

const formatRateWithBs = (rate) => {
  if (!rate || rate === 0) return '--'
  return new Intl.NumberFormat('es-VE', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }).format(rate) + ' Bs/$'
}

const formatVES = (amount) => {
  if (!amount || amount === 0) return '0,00 Bs.'
  return new Intl.NumberFormat('es-VE', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }).format(amount) + ' Bs.'
}

const getMonday = (date) => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

const getSunday = (monday) => {
  const d = new Date(monday)
  d.setDate(d.getDate() + 6)
  return d
}

const formatWeekRange = (monday) => {
  const sunday = getSunday(monday)
  const options = { day: '2-digit', month: 'short' }
  return monday.toLocaleDateString('es-VE', options) + ' - ' + sunday.toLocaleDateString('es-VE', options)
}

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
      monday: monday,
      sunday: sunday,
      label: formatWeekRange(monday),
      isCurrent: i === 0
    })
  }
  
  return weeks
}

const filterServicesByWeek = (services, weekId) => {
  if (!weekId) return services
  
  const monday = new Date(weekId)
  monday.setHours(0, 0, 0, 0)
  
  const sunday = getSunday(monday)
  sunday.setHours(23, 59, 59, 999)
  
  return services.filter(service => {
    const createdAt = service.createdAt?.toDate?.()
    return createdAt && createdAt >= monday && createdAt <= sunday
  })
}

const isServiceDelivered = (service) => {
  if (!service.status) return false
  
  const statusLower = service.status.toLowerCase()
  return statusLower === 'entregado' || 
         statusLower === 'delivered' || 
         statusLower === 'completed' ||
         statusLower === 'completado'
}

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
  
  const [createDialog, setCreateDialog] = useState({ 
    open: false, 
    type: 'restaurante',
    entityId: '',
    weekId: '',
    serviceIds: []
  })
  const [payDialog, setPayDialog] = useState({ open: false, settlement: null })
  
  const [availableWeeks] = useState(generateWeeks())
  const currentYear = new Date().getFullYear()

  useEffect(() => {
    setLoading(true)
    
    const unsubSettlements = subscribeToSettlements((data) => {
      setSettlements(data)
    })
    
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
    
    const unsubExchangeRate = subscribeToExchangeRate((data) => {
      setExchangeRate(data)
    })
    
    return () => {
      unsubSettlements()
      unsubServices()
      unsubRestaurants()
      unsubDrivers()
      unsubExchangeRate()
    }
  }, [])

  const restaurantSettlements = settlements.filter(s => s.type === 'restaurante' || !s.type)
  const driverSettlements = settlements.filter(s => s.type === 'repartidor')

  // Servicios pendientes para RESTAURANTE (cobrar)
  // Usa settledRestaurant si existe, si no usa settled (compatibilidad hacia atrás)
  const unpaidServicesForRestaurant = services.filter(s => {
    const isDelivered = isServiceDelivered(s)
    const settledField = s.settledRestaurant !== undefined ? s.settledRestaurant : s.settled
    return isDelivered && !settledField
  })

  // Servicios pendientes para REPARTIDOR (pagar)
  // Usa settledDriver si existe, si no usa settled (compatibilidad hacia atrás)
  const unpaidServicesForDriver = services.filter(s => {
    const isDelivered = isServiceDelivered(s)
    const settledField = s.settledDriver !== undefined ? s.settledDriver : s.settled
    return isDelivered && !settledField && !!s.driverId
  })

  const pendingByRestaurant = unpaidServicesForRestaurant.reduce((acc, service) => {
    if (!service.restaurantId) return acc
    
    if (!acc[service.restaurantId]) {
      acc[service.restaurantId] = {
        restaurantId: service.restaurantId,
        restaurantName: service.restaurantName || restaurants.find(r => r.id === service.restaurantId)?.name || 'Sin nombre',
        services: [],
        totalUSD: 0
      }
    }
    acc[service.restaurantId].services.push(service)
    acc[service.restaurantId].totalUSD += service.deliveryFee || 0
    return acc
  }, {})

  const pendingByDriver = unpaidServicesForDriver.reduce((acc, service) => {
    if (!service.driverId) return acc
    
    if (!acc[service.driverId]) {
      acc[service.driverId] = {
        driverId: service.driverId,
        driverName: service.driverName || drivers.find(d => d.id === service.driverId)?.name || 'Sin nombre',
        services: [],
        totalUSD: 0
      }
    }
    acc[service.driverId].services.push(service)
    acc[service.driverId].totalUSD += service.driverEarnings || 0
    return acc
  }, {})

  const handleCreateSettlement = async () => {
    const { type, entityId, weekId } = createDialog
    
    if (!entityId) {
      enqueueSnackbar('Selecciona un ' + (type === 'restaurante' ? 'restaurante' : 'repartidor'), { variant: 'warning' })
      return
    }
    
    if (!weekId) {
      enqueueSnackbar('Selecciona una semana', { variant: 'warning' })
      return
    }
    
    const unpaidList = type === 'restaurante' ? unpaidServicesForRestaurant : unpaidServicesForDriver
    
    const weekServices = filterServicesByWeek(
      unpaidList.filter(s => 
        type === 'restaurante' 
          ? s.restaurantId === entityId 
          : s.driverId === entityId
      ),
      weekId
    )
    
    if (weekServices.length === 0) {
      enqueueSnackbar('No hay servicios para la semana seleccionada', { variant: 'warning' })
      return
    }
    
    setSaving(true)
    
    try {
      const serviceIds = weekServices.map(s => s.id)
      
      const totalUSD = type === 'restaurante'
        ? weekServices.reduce((sum, s) => sum + (s.deliveryFee || 0), 0)
        : weekServices.reduce((sum, s) => sum + (s.driverEarnings || 0), 0)
      
      const totalVES = totalUSD * exchangeRate.rate
      
      const selectedWeek = availableWeeks.find(w => w.id === weekId)
      const periodLabel = selectedWeek ? selectedWeek.label : ''
      
      const entityName = type === 'restaurante'
        ? restaurants.find(r => r.id === entityId)?.name || 'Restaurante'
        : drivers.find(d => d.id === entityId)?.name || 'Repartidor'
      
      const settlementData = {
        type,
        entityId,
        entityName,
        amount: totalUSD,
        amountVES: totalVES,
        exchangeRate: exchangeRate.rate,
        serviceCount: weekServices.length,
        serviceIds,
        period: 'Semana: ' + periodLabel,
        weekId
      }
      
      if (type === 'restaurante') {
        settlementData.restaurantId = entityId
        settlementData.restaurantName = entityName
      } else {
        settlementData.driverId = entityId
        settlementData.driverName = entityName
      }
      
      const result = await createSettlement(settlementData)
      
      if (result.success) {
        for (const serviceId of serviceIds) {
          if (type === 'restaurante') {
            await updateService(serviceId, { 
              settledRestaurant: true, 
              restaurantSettlementId: result.id 
            })
          } else {
            await updateService(serviceId, { 
              settledDriver: true, 
              driverSettlementId: result.id 
            })
          }
        }
        
        const actionText = type === 'restaurante' ? 'Cobrar' : 'Pagar'
        enqueueSnackbar('Liquidacion creada: $' + totalUSD.toFixed(2) + ' USD = ' + formatVES(totalVES) + ' (' + actionText + ')', { variant: 'success' })
        setCreateDialog({ open: false, type: 'restaurante', entityId: '', weekId: '', serviceIds: [] })
      } else {
        enqueueSnackbar(result.error || 'Error al crear liquidacion', { variant: 'error' })
      }
    } catch (error) {
      console.error('Error creando liquidacion:', error)
      enqueueSnackbar('Error al crear liquidacion: ' + error.message, { variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handlePaySettlement = async () => {
    if (!payDialog.settlement) return
    
    const result = await paySettlement(payDialog.settlement.id)
    
    if (result.success) {
      const actionText = payDialog.settlement.type === 'restaurante' ? 'Cobrado' : 'Pagado'
      enqueueSnackbar('Liquidacion marcada como ' + actionText, { variant: 'success' })
      setPayDialog({ open: false, settlement: null })
    } else {
      enqueueSnackbar('Error al procesar', { variant: 'error' })
    }
  }

  const pendingAmount = Object.values(tabValue === 0 ? pendingByRestaurant : pendingByDriver)
    .reduce((sum, p) => sum + p.totalUSD, 0)
  
  const pendingCount = tabValue === 0 ? unpaidServicesForRestaurant.length : unpaidServicesForDriver.length

  const displaySettlements = tabValue === 0 ? restaurantSettlements : driverSettlements

  const openCreateDialog = (type = 'restaurante', entityId = '', weekId = '') => {
    setCreateDialog({
      open: true,
      type,
      entityId,
      weekId: weekId || availableWeeks[0]?.id || '',
      serviceIds: []
    })
  }

  const getEntityServicesForWeek = (type, entityId, weekId) => {
    if (!entityId || !weekId) return []
    
    const unpaidList = type === 'restaurante' ? unpaidServicesForRestaurant : unpaidServicesForDriver
    
    const entityServices = unpaidList.filter(s => 
      type === 'restaurante' 
        ? s.restaurantId === entityId 
        : s.driverId === entityId
    )
    
    return filterServicesByWeek(entityServices, weekId)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {loading && <LinearProgress />}
      
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
        <Stack direction="row" spacing={1}>
          <Chip 
            icon={<MoneyIcon />} 
            label={'Tasa: ' + formatRateWithBs(exchangeRate.rate)}
            color="primary"
            variant="outlined"
          />
          <Button
            variant="contained"
            startIcon={<MoneyIcon />}
            onClick={() => openCreateDialog()}
          >
            Nueva Liquidacion
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2}>
        <Grid item xs={6} sm={3}>
          <Card sx={{ borderRadius: 2, bgcolor: 'warning.light', height: '100%' }}>
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <ClockIcon sx={{ color: 'warning.main', mb: 0.5 }} />
              <Typography variant="h5" fontWeight="bold" color="warning.dark">
                ${pendingAmount.toFixed(2)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Por {tabValue === 0 ? 'Cobrar' : 'Pagar'} ({pendingCount} servicios)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ borderRadius: 2, bgcolor: 'success.light', height: '100%' }}>
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <CheckIcon sx={{ color: 'success.main', mb: 0.5 }} />
              <Typography variant="h5" fontWeight="bold" color="success.dark">
                ${displaySettlements.filter(s => s.status === 'pagado').reduce((sum, s) => sum + (s.amount || 0), 0).toFixed(2)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Total {tabValue === 0 ? 'Cobrado' : 'Pagado'} (USD)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ borderRadius: 2, height: '100%' }}>
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <ReceiptIcon sx={{ color: 'primary.main', mb: 0.5 }} />
              <Typography variant="h5" fontWeight="bold">
                {displaySettlements.filter(s => s.status === 'pendiente').length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Pendientes de {tabValue === 0 ? 'Cobro' : 'Pago'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ borderRadius: 2, height: '100%' }}>
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <PaymentIcon sx={{ color: 'success.main', mb: 0.5 }} />
              <Typography variant="h5" fontWeight="bold">
                {displaySettlements.filter(s => s.status === 'pagado').length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {tabValue === 0 ? 'Cobradas' : 'Pagadas'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ borderRadius: 2 }}>
        <Tabs
          value={tabValue}
          onChange={(e, v) => setTabValue(v)}
          variant="fullWidth"
        >
          <Tab 
            icon={<StoreIcon />} 
            iconPosition="start"
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography>Restaurantes</Typography>
                <Chip 
                  size="small" 
                  label={Object.keys(pendingByRestaurant).length}
                  color="warning"
                />
              </Stack>
            }
          />
          <Tab 
            icon={<BikeIcon />} 
            iconPosition="start"
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography>Repartidores</Typography>
                <Chip 
                  size="small" 
                  label={Object.keys(pendingByDriver).length}
                  color="success"
                />
              </Stack>
            }
          />
        </Tabs>
      </Paper>

      <Card sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
            {tabValue === 0 ? 'Pendientes de Cobrar a Restaurantes' : 'Pendientes de Pagar a Repartidores'}
          </Typography>
          
          {Object.keys(tabValue === 0 ? pendingByRestaurant : pendingByDriver).length === 0 ? (
            <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
              <CheckIcon sx={{ fontSize: 32, color: 'success.main', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                No hay servicios pendientes de {tabValue === 0 ? 'cobrar a restaurantes' : 'pagar a repartidores'}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                Total servicios: {services.length} | 
                {tabValue === 0 
                  ? ` Pendientes cobro: ${unpaidServicesForRestaurant.length}` 
                  : ` Pendientes pago: ${unpaidServicesForDriver.length}`}
              </Typography>
            </Paper>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{tabValue === 0 ? 'Restaurante' : 'Repartidor'}</TableCell>
                    <TableCell align="center">Servicios</TableCell>
                    <TableCell align="right">Total USD</TableCell>
                    {exchangeRate.rate > 0 && <TableCell align="right">Equivalente Bs</TableCell>}
                    <TableCell align="right">Accion</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.values(tabValue === 0 ? pendingByRestaurant : pendingByDriver).map((item) => (
                    <TableRow key={item.restaurantId || item.driverId}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {item.restaurantName || item.driverName}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={item.services.length} size="small" />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold" color={tabValue === 0 ? 'warning.main' : 'success.main'}>
                          ${item.totalUSD.toFixed(2)}
                        </Typography>
                      </TableCell>
                      {exchangeRate.rate > 0 && (
                        <TableCell align="right">
                          <Typography variant="body2" color="text.secondary">
                            {formatVES(item.totalUSD * exchangeRate.rate)}
                          </Typography>
                        </TableCell>
                      )}
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          color={tabValue === 0 ? 'warning' : 'success'}
                          onClick={() => openCreateDialog(
                            tabValue === 0 ? 'restaurante' : 'repartidor',
                            item.restaurantId || item.driverId,
                            availableWeeks[0]?.id || ''
                          )}
                        >
                          {tabValue === 0 ? 'Cobrar' : 'Pagar'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
            Historial de Liquidaciones ({tabValue === 0 ? 'Restaurantes - Cobros' : 'Repartidores - Pagos'})
          </Typography>
          
          {displaySettlements.length === 0 ? (
            <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
              <ReceiptIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                No hay liquidaciones registradas
              </Typography>
            </Paper>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Fecha</TableCell>
                    <TableCell>{tabValue === 0 ? 'Restaurante' : 'Repartidor'}</TableCell>
                    {!isMobile && <TableCell>Periodo</TableCell>}
                    <TableCell align="center">Servicios</TableCell>
                    <TableCell align="right">Monto USD</TableCell>
                    {!isMobile && exchangeRate.rate > 0 && <TableCell align="right">Tasa</TableCell>}
                    <TableCell>Estado</TableCell>
                    <TableCell align="right">Accion</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {displaySettlements.map((settlement) => (
                    <TableRow key={settlement.id} hover>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(settlement.createdAt)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {settlement.restaurantName || settlement.driverName}
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
                        <Typography variant="body2">
                          {settlement.serviceCount || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold">
                          ${(settlement.amount || 0).toFixed(2)}
                        </Typography>
                      </TableCell>
                      {!isMobile && exchangeRate.rate > 0 && (
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {formatRate(settlement.exchangeRate)} Bs.
                          </Typography>
                        </TableCell>
                      )}
                      <TableCell>
                        <Chip
                          icon={settlement.status === 'pagado' ? <CheckIcon /> : <ClockIcon />}
                          label={settlement.status === 'pagado' 
                            ? (settlement.type === 'restaurante' ? 'Cobrado' : 'Pagado')
                            : 'Pendiente'}
                          size="small"
                          color={settlement.status === 'pagado' ? 'success' : 'warning'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        {settlement.status === 'pendiente' && (
                          <Button
                            size="small"
                            variant="contained"
                            color={settlement.type === 'restaurante' ? 'warning' : 'success'}
                            startIcon={settlement.type === 'restaurante' ? <CobrarIcon /> : <PagarIcon />}
                            onClick={() => setPayDialog({ open: true, settlement })}
                          >
                            {settlement.type === 'restaurante' ? 'Cobrar' : 'Pagar'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={createDialog.open}
        onClose={() => !saving && setCreateDialog({ open: false, type: 'restaurante', entityId: '', weekId: '', serviceIds: [] })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6">
              {createDialog.type === 'restaurante' ? 'Cobrar a Restaurante' : 'Pagar a Repartidor'}
            </Typography>
            <Chip 
              size="small" 
              icon={createDialog.type === 'restaurante' ? <CobrarIcon /> : <PagarIcon />}
              label={createDialog.type === 'restaurante' ? 'Para Cobrar' : 'Para Pagar'}
              color={createDialog.type === 'restaurante' ? 'warning' : 'success'}
            />
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Tipo de Liquidacion</InputLabel>
              <Select
                value={createDialog.type}
                label="Tipo de Liquidacion"
                onChange={(e) => setCreateDialog(prev => ({ ...prev, type: e.target.value, entityId: '' }))}
                disabled={saving}
              >
                <MenuItem value="restaurante">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CobrarIcon fontSize="small" sx={{ color: 'warning.main' }} />
                    <Typography>Restaurante</Typography>
                    <Typography variant="caption" color="text.secondary">(Cobrar comision)</Typography>
                  </Stack>
                </MenuItem>
                <MenuItem value="repartidor">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PagarIcon fontSize="small" sx={{ color: 'success.main' }} />
                    <Typography>Repartidor</Typography>
                    <Typography variant="caption" color="text.secondary">(Pagar ganancias)</Typography>
                  </Stack>
                </MenuItem>
              </Select>
            </FormControl>
            
            <FormControl fullWidth>
              <InputLabel>{createDialog.type === 'restaurante' ? 'Restaurante' : 'Repartidor'}</InputLabel>
              <Select
                value={createDialog.entityId}
                label={createDialog.type === 'restaurante' ? 'Restaurante' : 'Repartidor'}
                onChange={(e) => setCreateDialog(prev => ({ ...prev, entityId: e.target.value }))}
                disabled={saving}
              >
                {createDialog.type === 'restaurante' 
                  ? restaurants.map((restaurant) => {
                      const pending = pendingByRestaurant[restaurant.id]
                      return (
                        <MenuItem key={restaurant.id} value={restaurant.id}>
                          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
                            <Typography>{restaurant.name}</Typography>
                            {pending && (
                              <Chip 
                                size="small" 
                                label={pending.services.length + ' srv - $' + pending.totalUSD.toFixed(2)}
                                color="warning"
                                variant="outlined"
                              />
                            )}
                          </Stack>
                        </MenuItem>
                      )
                    })
                  : drivers.map((driver) => {
                      const pending = pendingByDriver[driver.id]
                      return (
                        <MenuItem key={driver.id} value={driver.id}>
                          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
                            <Typography>{driver.name}</Typography>
                            {pending && (
                              <Chip 
                                size="small" 
                                label={pending.services.length + ' srv - $' + pending.totalUSD.toFixed(2)}
                                color="success"
                                variant="outlined"
                              />
                            )}
                          </Stack>
                        </MenuItem>
                      )
                    })
                }
              </Select>
            </FormControl>
            
            <FormControl fullWidth required>
              <InputLabel>Semana *</InputLabel>
              <Select
                value={createDialog.weekId}
                label="Semana *"
                onChange={(e) => setCreateDialog(prev => ({ ...prev, weekId: e.target.value }))}
                disabled={saving}
              >
                {availableWeeks.map((week) => (
                  <MenuItem key={week.id} value={week.id}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CalendarIcon fontSize="small" />
                      <Typography variant="body2">{week.label}</Typography>
                      {week.isCurrent && (
                        <Chip label="Actual" size="small" color="primary" sx={{ ml: 1, height: 20 }} />
                      )}
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            {createDialog.entityId && createDialog.weekId && (
              <Paper sx={{ p: 2, bgcolor: createDialog.type === 'restaurante' ? 'warning.light' : 'success.light', borderRadius: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  {createDialog.type === 'restaurante' ? <CobrarIcon color="warning" /> : <PagarIcon color="success" />}
                  <Typography variant="subtitle2" fontWeight="bold">
                    {createDialog.type === 'restaurante' ? 'Resumen de Cobro' : 'Resumen de Pago'}
                  </Typography>
                </Stack>
                
                {(() => {
                  const weekServices = getEntityServicesForWeek(
                    createDialog.type,
                    createDialog.entityId,
                    createDialog.weekId
                  )
                  
                  const totalUSD = createDialog.type === 'restaurante'
                    ? weekServices.reduce((sum, s) => sum + (s.deliveryFee || 0), 0)
                    : weekServices.reduce((sum, s) => sum + (s.driverEarnings || 0), 0)
                  const totalVES = totalUSD * exchangeRate.rate
                  const actionText = createDialog.type === 'restaurante' ? 'Cobrar' : 'Pagar'
                  const actionColor = createDialog.type === 'restaurante' ? 'warning' : 'success'
                  
                  return (
                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">Servicios en la semana</Typography>
                        <Typography variant="body1" fontWeight="bold">{weekServices.length}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">Monto USD</Typography>
                        <Typography variant="body1" fontWeight="bold" color={actionColor + '.main'}>${totalUSD.toFixed(2)}</Typography>
                      </Grid>
                      {exchangeRate.rate > 0 && (
                        <>
                          <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary">
                              Tasa: {formatRate(exchangeRate.rate)} Bs.
                            </Typography>
                          </Grid>
                          <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary">
                              Equivalente en Bs
                            </Typography>
                            <Typography variant="body1" fontWeight="bold">{formatVES(totalVES)}</Typography>
                          </Grid>
                        </>
                      )}
                      <Grid item xs={12}>
                        <Chip 
                          size="small"
                          icon={createDialog.type === 'restaurante' ? <CobrarIcon /> : <PagarIcon />}
                          label={'Accion: ' + actionText}
                          color={actionColor}
                          sx={{ mt: 1 }}
                        />
                      </Grid>
                      {weekServices.length === 0 && (
                        <Grid item xs={12}>
                          <Typography variant="body2" color="error.main" sx={{ mt: 1 }}>
                            No hay servicios pendientes de {actionText.toLowerCase()} en la semana seleccionada
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Puede que ya se hayan liquidado estos servicios o no hay servicios en este rango de fechas.
                          </Typography>
                        </Grid>
                      )}
                    </Grid>
                  )
                })()}
              </Paper>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={() => setCreateDialog({ open: false, type: 'restaurante', entityId: '', weekId: '', serviceIds: [] })}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button 
            variant="contained" 
            onClick={handleCreateSettlement}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : (createDialog.type === 'restaurante' ? <CobrarIcon /> : <PagarIcon />)}
            color={createDialog.type === 'restaurante' ? 'warning' : 'success'}
          >
            {saving ? 'Creando...' : (createDialog.type === 'restaurante' ? 'Crear Cobro' : 'Crear Pago')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={payDialog.open}
        onClose={() => setPayDialog({ open: false, settlement: null })}
      >
        <DialogTitle>
          Confirmar {payDialog.settlement?.type === 'restaurante' ? 'Cobro' : 'Pago'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography>
              {payDialog.settlement?.type === 'restaurante' 
                ? 'Confirmas que el restaurante ha realizado el pago?'
                : 'Confirmas que se ha realizado el pago al repartidor?'}
            </Typography>
            
            {payDialog.settlement && (
              <Paper sx={{ p: 2, bgcolor: 'grey.100' }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      {payDialog.settlement.type === 'restaurante' ? 'Restaurante:' : 'Repartidor:'}
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {payDialog.settlement.restaurantName || payDialog.settlement.driverName}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Monto USD:</Typography>
                    <Typography variant="body2" fontWeight="bold" color="success.main">
                      ${(payDialog.settlement.amount || 0).toFixed(2)}
                    </Typography>
                  </Grid>
                  {payDialog.settlement.amountVES && (
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">Equivalente Bs:</Typography>
                      <Typography variant="body2" fontWeight="bold">{formatVES(payDialog.settlement.amountVES)}</Typography>
                    </Grid>
                  )}
                  {payDialog.settlement.exchangeRate && (
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">Tasa aplicada:</Typography>
                      <Typography variant="body2">{formatRate(payDialog.settlement.exchangeRate)} Bs.</Typography>
                    </Grid>
                  )}
                </Grid>
              </Paper>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setPayDialog({ open: false, settlement: null })}>
            Cancelar
          </Button>
          <Button 
            variant="contained" 
            color={payDialog.settlement?.type === 'restaurante' ? 'warning' : 'success'}
            startIcon={payDialog.settlement?.type === 'restaurante' ? <CobrarIcon /> : <PagarIcon />}
            onClick={handlePaySettlement}
          >
            Confirmar {payDialog.settlement?.type === 'restaurante' ? 'Cobro' : 'Pago'}
          </Button>
        </DialogActions>
      </Dialog>

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
          C {currentYear} Copyright. Desarrollado por Erick Simosa
        </Typography>
        <Typography variant="caption" color="text.secondary">
          ericksimosa@gmail.com - 0424 3036024
        </Typography>
      </Box>
    </Box>
  )
}