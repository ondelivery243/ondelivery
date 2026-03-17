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
  TextField,
  Paper,
  useTheme,
  useMediaQuery,
  alpha,
  Tab,
  Tabs,
  LinearProgress
} from '@mui/material'
import {
  AttachMoney as MoneyIcon,
  CheckCircle as CheckIcon,
  AccessTime as ClockIcon,
  Receipt as ReceiptIcon,
  Store as StoreIcon,
  TwoWheeler as BikeIcon,
  Payment as PaymentIcon
} from '@mui/icons-material'
import { useSnackbar } from 'notistack'
import { formatCurrency, formatDate, formatTime } from '../../store/useStore'
import { 
  subscribeToSettlements,
  subscribeToServices,
  subscribeToRestaurants,
  subscribeToDrivers,
  createSettlement,
  updateSettlement,
  updateService,
  paySettlement
} from '../../services/firestore'

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
  
  const [createDialog, setCreateDialog] = useState({ 
    open: false, 
    type: 'restaurante',
    entityId: '',
    period: '',
    serviceIds: []
  })
  const [payDialog, setPayDialog] = useState({ open: false, settlement: null })

  // Cargar datos
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
    
    return () => {
      unsubSettlements()
      unsubServices()
      unsubRestaurants()
      unsubDrivers()
    }
  }, [])

  // Filtrar liquidaciones por tipo
  const restaurantSettlements = settlements.filter(s => s.type === 'restaurante' || !s.type)
  const driverSettlements = settlements.filter(s => s.type === 'repartidor')

  // Servicios pendientes de liquidar
  const unpaidServices = services.filter(s => 
    s.status === 'entregado' && !s.settled
  )

  // Agrupar servicios pendientes por restaurante
  const pendingByRestaurant = unpaidServices.reduce((acc, service) => {
    if (!acc[service.restaurantId]) {
      acc[service.restaurantId] = {
        restaurantId: service.restaurantId,
        restaurantName: service.restaurantName,
        services: [],
        total: 0
      }
    }
    acc[service.restaurantId].services.push(service)
    acc[service.restaurantId].total += service.deliveryFee || 0
    return acc
  }, {})

  // Agrupar servicios pendientes por repartidor
  const pendingByDriver = unpaidServices.reduce((acc, service) => {
    if (service.driverId) {
      if (!acc[service.driverId]) {
        acc[service.driverId] = {
          driverId: service.driverId,
          driverName: service.driverName,
          services: [],
          total: 0
        }
      }
      acc[service.driverId].services.push(service)
      acc[service.driverId].total += service.driverEarnings || 0
    }
    return acc
  }, {})

  // Crear liquidación
  const handleCreateSettlement = async () => {
    const { type, entityId, period } = createDialog
    
    if (!entityId) {
      enqueueSnackbar('Selecciona un ' + (type === 'restaurante' ? 'restaurante' : 'repartidor'), { variant: 'warning' })
      return
    }
    
    const pendingData = type === 'restaurante' 
      ? pendingByRestaurant[entityId] 
      : pendingByDriver[entityId]
    
    if (!pendingData || pendingData.services.length === 0) {
      enqueueSnackbar('No hay servicios pendientes para liquidar', { variant: 'warning' })
      return
    }
    
    const serviceIds = pendingData.services.map(s => s.id)
    
    const result = await createSettlement({
      type,
      entityId,
      entityName: pendingData.restaurantName || pendingData.driverName,
      restaurantId: type === 'restaurante' ? entityId : undefined,
      restaurantName: type === 'restaurante' ? pendingData.restaurantName : undefined,
      driverId: type === 'repartidor' ? entityId : undefined,
      driverName: type === 'repartidor' ? pendingData.driverName : undefined,
      amount: pendingData.total,
      serviceCount: pendingData.services.length,
      serviceIds,
      period
    })
    
    if (result.success) {
      // Marcar servicios como liquidados
      for (const serviceId of serviceIds) {
        await updateService(serviceId, { settled: true, settlementId: result.id })
      }
      
      enqueueSnackbar('Liquidación creada exitosamente', { variant: 'success' })
      setCreateDialog({ open: false, type: 'restaurante', entityId: '', period: '', serviceIds: [] })
    } else {
      enqueueSnackbar(result.error || 'Error al crear liquidación', { variant: 'error' })
    }
  }

  // Pagar liquidación
  const handlePaySettlement = async () => {
    if (!payDialog.settlement) return
    
    const result = await paySettlement(payDialog.settlement.id)
    
    if (result.success) {
      enqueueSnackbar('Liquidación marcada como pagada', { variant: 'success' })
      setPayDialog({ open: false, settlement: null })
    } else {
      enqueueSnackbar('Error al procesar pago', { variant: 'error' })
    }
  }

  // Estadísticas
  const pendingAmount = Object.values(tabValue === 0 ? pendingByRestaurant : pendingByDriver)
    .reduce((sum, p) => sum + p.total, 0)
  
  const pendingCount = Object.values(tabValue === 0 ? pendingByRestaurant : pendingByDriver)
    .reduce((sum, p) => sum + p.services.length, 0)

  const displaySettlements = tabValue === 0 ? restaurantSettlements : driverSettlements

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
            Gestiona los pagos a restaurantes y repartidores
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<MoneyIcon />}
          onClick={() => setCreateDialog({ ...createDialog, open: true })}
        >
          Nueva Liquidación
        </Button>
      </Stack>

      {/* Stats */}
      <Grid container spacing={2}>
        <Grid item xs={6} sm={3}>
          <Card sx={{ borderRadius: 2, bgcolor: 'warning.light', height: '100%' }}>
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <ClockIcon sx={{ color: 'warning.main', mb: 0.5 }} />
              <Typography variant="h5" fontWeight="bold" color="warning.dark">
                {formatCurrency(pendingAmount)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Por Liquidar ({pendingCount} servicios)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ borderRadius: 2, bgcolor: 'success.light', height: '100%' }}>
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <CheckIcon sx={{ color: 'success.main', mb: 0.5 }} />
              <Typography variant="h5" fontWeight="bold" color="success.dark">
                {formatCurrency(displaySettlements.filter(s => s.status === 'pagado').reduce((sum, s) => sum + (s.amount || 0), 0))}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Total Pagado
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
                Pendientes de Pago
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
                Pagadas
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ borderRadius: 2 }}>
        <Tabs
          value={tabValue}
          onChange={(e, v) => setTabValue(v)}
          variant="fullWidth"
        >
          <Tab 
            icon={<StoreIcon />} 
            label={`Restaurantes (${Object.keys(pendingByRestaurant).length})`} 
            iconPosition="start"
          />
          <Tab 
            icon={<BikeIcon />} 
            label={`Repartidores (${Object.keys(pendingByDriver).length})`} 
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {/* Pending Settlements */}
      <Card sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
            Pendientes de Liquidar
          </Typography>
          
          {Object.keys(tabValue === 0 ? pendingByRestaurant : pendingByDriver).length === 0 ? (
            <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
              <CheckIcon sx={{ fontSize: 32, color: 'success.main', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                No hay servicios pendientes de liquidar
              </Typography>
            </Paper>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{tabValue === 0 ? 'Restaurante' : 'Repartidor'}</TableCell>
                    <TableCell align="center">Servicios</TableCell>
                    <TableCell align="right">Monto</TableCell>
                    <TableCell align="right">Acción</TableCell>
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
                        <Typography variant="body2" fontWeight="bold" color="warning.main">
                          {formatCurrency(item.total)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setCreateDialog({
                            open: true,
                            type: tabValue === 0 ? 'restaurante' : 'repartidor',
                            entityId: item.restaurantId || item.driverId,
                            period: '',
                            serviceIds: item.services.map(s => s.id)
                          })}
                        >
                          Liquidar
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

      {/* Settlements History */}
      <Card sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
            Historial de Liquidaciones
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
                    {!isMobile && <TableCell>Período</TableCell>}
                    <TableCell align="center">Servicios</TableCell>
                    <TableCell align="right">Monto</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell align="right">Acción</TableCell>
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
                      <TableCell align="right">
                        {settlement.status === 'pendiente' && (
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            onClick={() => setPayDialog({ open: true, settlement })}
                          >
                            Pagar
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

      {/* Create Settlement Dialog */}
      <Dialog
        open={createDialog.open}
        onClose={() => setCreateDialog({ open: false, type: 'restaurante', entityId: '', period: '', serviceIds: [] })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Crear Nueva Liquidación</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Tipo de Liquidación</InputLabel>
              <Select
                value={createDialog.type}
                label="Tipo de Liquidación"
                onChange={(e) => setCreateDialog(prev => ({ ...prev, type: e.target.value, entityId: '' }))}
              >
                <MenuItem value="restaurante">Restaurante</MenuItem>
                <MenuItem value="repartidor">Repartidor</MenuItem>
              </Select>
            </FormControl>
            
            <FormControl fullWidth>
              <InputLabel>{createDialog.type === 'restaurante' ? 'Restaurante' : 'Repartidor'}</InputLabel>
              <Select
                value={createDialog.entityId}
                label={createDialog.type === 'restaurante' ? 'Restaurante' : 'Repartidor'}
                onChange={(e) => setCreateDialog(prev => ({ ...prev, entityId: e.target.value }))}
              >
                {createDialog.type === 'restaurante' 
                  ? Object.values(pendingByRestaurant).map((item) => (
                      <MenuItem key={item.restaurantId} value={item.restaurantId}>
                        {item.restaurantName} - {formatCurrency(item.total)} ({item.services.length} servicios)
                      </MenuItem>
                    ))
                  : Object.values(pendingByDriver).map((item) => (
                      <MenuItem key={item.driverId} value={item.driverId}>
                        {item.driverName} - {formatCurrency(item.total)} ({item.services.length} servicios)
                      </MenuItem>
                    ))
                }
              </Select>
            </FormControl>
            
            <TextField
              fullWidth
              label="Período (opcional)"
              placeholder="Ej: Enero 2024, Semana 5, etc."
              value={createDialog.period}
              onChange={(e) => setCreateDialog(prev => ({ ...prev, period: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setCreateDialog({ open: false, type: 'restaurante', entityId: '', period: '', serviceIds: [] })}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleCreateSettlement}>
            Crear Liquidación
          </Button>
        </DialogActions>
      </Dialog>

      {/* Pay Settlement Dialog */}
      <Dialog
        open={payDialog.open}
        onClose={() => setPayDialog({ open: false, settlement: null })}
      >
        <DialogTitle>Confirmar Pago</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Confirmas que se ha realizado el pago de <strong>{formatCurrency(payDialog.settlement?.amount)}</strong> 
            {' '}a <strong>{payDialog.settlement?.restaurantName || payDialog.settlement?.driverName}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setPayDialog({ open: false, settlement: null })}>
            Cancelar
          </Button>
          <Button variant="contained" color="success" onClick={handlePaySettlement}>
            Confirmar Pago
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
