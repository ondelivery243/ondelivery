// src/pages/admin/Servicios.jsx
import { useState, useEffect, useMemo, Fragment } from 'react'
import {
  Box,
  Card,
  Typography,
  Button,
  Grid,
  Chip,
  Stack,
  TextField,
  InputAdornment,
  IconButton,
  Tab,
  Tabs,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  useTheme,
  useMediaQuery,
  alpha,
  Collapse,
  Tooltip,
  Divider,
  Alert
} from '@mui/material'
import {
  Search as SearchIcon,
  Add as AddIcon,
  Inventory as PackageIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  AccessTime as ClockIcon,
  TwoWheeler as DeliveryIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Assignment as AssignIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  AttachMoney as MoneyIcon,
  Notes as NotesIcon,
  Warning as WarningIcon
} from '@mui/icons-material'
import { useSnackbar } from 'notistack'
import { formatCurrency, formatDate, formatTime } from '../../store/useStore'
import { 
  subscribeToServices, 
  subscribeToDrivers,
  subscribeToRestaurants,
  subscribeToZones,
  createService,
  updateService,
  acceptService,
  cancelService,
  getSettings
} from '../../services/firestore'
import { RIDERY_COLORS } from '../../theme/theme'

// Configuración de estados (fuera del componente para evitar recreación)
const STATUS_CONFIG = {
  pendiente: { color: 'warning', label: 'Pendiente', icon: <ClockIcon /> },
  asignado: { color: 'info', label: 'Asignado', icon: <AssignIcon /> },
  en_camino: { color: 'primary', label: 'En Camino', icon: <DeliveryIcon /> },
  entregado: { color: 'success', label: 'Entregado', icon: <CheckIcon /> },
  cancelado: { color: 'error', label: 'Cancelado', icon: <CancelIcon /> },
  sin_repartidor: { color: 'error', label: 'Sin Repartidor', icon: <WarningIcon /> }
}

const getStatusConfig = (status) => STATUS_CONFIG[status] || STATUS_CONFIG.pendiente

export default function AdminServicios() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { enqueueSnackbar } = useSnackbar()
  const currentYear = new Date().getFullYear()
  
  const [services, setServices] = useState([])
  const [drivers, setDrivers] = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [expandedId, setExpandedId] = useState(null)
  
  const [newServiceDialog, setNewServiceDialog] = useState(false)
  const [assignDialog, setAssignDialog] = useState({ open: false, service: null, selectedDriver: '' })
  const [cancelDialog, setCancelDialog] = useState({ open: false, service: null, reason: '' })
  
  // Configuración de la app (comisión dinámica)
  const [appSettings, setAppSettings] = useState({ 
    commissionRate: 20, 
    minDeliveryFee: 1.50 
  })
  
  const [newService, setNewService] = useState({
    restaurantId: '',
    restaurantName: '',
    zoneId: '',
    zoneName: '',
    deliveryAddress: '',
    clientName: '',
    clientPhone: '',
    paymentMethod: 'efectivo',
    amountToCollect: '',
    paysWith: '',
    notes: ''
  })

  // Calcular cambio
  const changeAmount = useMemo(() => {
    if (newService.paymentMethod !== 'efectivo') return 0
    const amount = parseFloat(newService.amountToCollect) || 0
    const pays = parseFloat(newService.paysWith) || 0
    return pays > amount ? pays - amount : 0
  }, [newService.paymentMethod, newService.amountToCollect, newService.paysWith])

  // Cargar configuración de la app
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

  // Cargar datos en tiempo real
  useEffect(() => {
    setLoading(true)
    
    const unsubServices = subscribeToServices((data) => {
      setServices(data)
      setLoading(false)
    })
    
    const unsubDrivers = subscribeToDrivers((data) => {
      setDrivers(data)
    })
    
    const unsubRestaurants = subscribeToRestaurants((data) => {
      setRestaurants(data)
    })
    
    const unsubZones = subscribeToZones((data) => {
      setZones(data)
    })
    
    return () => {
      unsubServices()
      unsubDrivers()
      unsubRestaurants()
      unsubZones()
    }
  }, [])

  // Estadísticas memorizadas
  const stats = useMemo(() => {
    const total = services.length
    const pendientes = services.filter(s => s.status === 'pendiente' || s.status === 'sin_repartidor').length
    const asignados = services.filter(s => s.status === 'asignado').length
    const enCamino = services.filter(s => s.status === 'en_camino').length
    const entregados = services.filter(s => s.status === 'entregado').length
    const cancelados = services.filter(s => s.status === 'cancelado').length
    
    return { total, pendientes, asignados, enCamino, entregados, cancelados }
  }, [services])

  // Tabs memorizados
  const tabs = useMemo(() => [
    { value: 'todos', label: 'Todos', count: stats.total },
    { value: 'pendiente', label: 'Pendientes', count: stats.pendientes },
    { value: 'asignado', label: 'Asignados', count: stats.asignados },
    { value: 'en_camino', label: 'En Camino', count: stats.enCamino },
    { value: 'entregado', label: 'Entregados', count: stats.entregados },
    { value: 'cancelado', label: 'Cancelados', count: stats.cancelados }
  ], [stats])

  // Filtrar servicios memorizado
  const filteredServices = useMemo(() => {
    return services.filter(service => {
      const matchesStatus = statusFilter === 'todos' || service.status === statusFilter
      const matchesSearch = !searchTerm || 
        service.serviceId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.restaurantName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.zoneName?.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesStatus && matchesSearch
    })
  }, [services, statusFilter, searchTerm])

  // Paginación memorizada
  const paginatedServices = useMemo(() => {
    return filteredServices.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    )
  }, [filteredServices, page, rowsPerPage])

  // Restaurantes activos memorizado
  const activeRestaurants = useMemo(() => {
    return restaurants.filter(r => r.active)
  }, [restaurants])

  // Zonas activas memorizado
  const activeZones = useMemo(() => {
    return zones.filter(z => z.active)
  }, [zones])

  // Solo repartidores online memorizado
  const onlineDrivers = useMemo(() => {
    return drivers.filter(d => d.active && d.isOnline)
  }, [drivers])

  // Crear nuevo servicio - CON COMISIÓN DINÁMICA
  const handleCreateService = async () => {
    // Validar campos obligatorios
    if (!newService.restaurantId) {
      enqueueSnackbar('Selecciona un restaurante', { variant: 'warning' })
      return
    }
    if (!newService.zoneId) {
      enqueueSnackbar('Selecciona una zona de entrega', { variant: 'warning' })
      return
    }
    if (!newService.deliveryAddress?.trim()) {
      enqueueSnackbar('Ingresa la dirección de entrega', { variant: 'warning' })
      return
    }
    if (!newService.clientName?.trim()) {
      enqueueSnackbar('Ingresa el nombre del cliente', { variant: 'warning' })
      return
    }
    if (!newService.clientPhone?.trim()) {
      enqueueSnackbar('Ingresa el teléfono del cliente', { variant: 'warning' })
      return
    }
    
    // Validar campos de pago según método
    if (newService.paymentMethod === 'efectivo') {
      if (!newService.amountToCollect || parseFloat(newService.amountToCollect) <= 0) {
        enqueueSnackbar('Ingresa el monto a cobrar', { variant: 'warning' })
        return
      }
      if (!newService.paysWith || parseFloat(newService.paysWith) <= 0) {
        enqueueSnackbar('Ingresa con cuánto paga el cliente', { variant: 'warning' })
        return
      }
      if (parseFloat(newService.paysWith) < parseFloat(newService.amountToCollect)) {
        enqueueSnackbar('El monto que paga el cliente no puede ser menor al monto a cobrar', { variant: 'warning' })
        return
      }
    }
    
    const restaurant = restaurants.find(r => r.id === newService.restaurantId)
    const zone = zones.find(z => z.id === newService.zoneId)
    
    // Calcular tarifas CON COMISIÓN DINÁMICA
    const deliveryFee = zone?.price || 0
    const commissionRate = appSettings.commissionRate || 20
    const platformFee = deliveryFee * (commissionRate / 100)
    const driverEarnings = deliveryFee - platformFee
    
    // Calcular cambio
    const amountToCollect = newService.paymentMethod === 'pagado' ? 0 : parseFloat(newService.amountToCollect) || 0
    const paysWith = newService.paymentMethod === 'efectivo' ? parseFloat(newService.paysWith) || 0 : 0
    const changeAmt = paysWith > amountToCollect ? paysWith - amountToCollect : 0
    
    const result = await createService({
      ...newService,
      restaurantName: restaurant?.name || '',
      restaurantAddress: restaurant?.address || '',
      zoneName: zone?.name || '',
      deliveryFee,
      commissionRate,
      platformFee,
      driverEarnings,
      amountToCollect,
      paysWith,
      changeAmount: changeAmt,
      settledRestaurant: false,
      settledDriver: false
    })
    
    if (result.success) {
      enqueueSnackbar(`Servicio ${result.serviceId} creado exitosamente`, { variant: 'success' })
      setNewServiceDialog(false)
      setNewService({
        restaurantId: '',
        restaurantName: '',
        zoneId: '',
        zoneName: '',
        deliveryAddress: '',
        clientName: '',
        clientPhone: '',
        paymentMethod: 'efectivo',
        amountToCollect: '',
        paysWith: '',
        notes: ''
      })
    } else {
      enqueueSnackbar(result.error || 'Error al crear servicio', { variant: 'error' })
    }
  }

  // Asignar repartidor
  const handleAssignDriver = async () => {
    if (!assignDialog.selectedDriver) {
      enqueueSnackbar('Selecciona un repartidor', { variant: 'warning' })
      return
    }
    
    const driver = drivers.find(d => d.id === assignDialog.selectedDriver)
    const result = await acceptService(
      assignDialog.service.id, 
      assignDialog.selectedDriver, 
      driver?.name || ''
    )
    
    if (result.success) {
      enqueueSnackbar('Repartidor asignado correctamente', { variant: 'success' })
      setAssignDialog({ open: false, service: null, selectedDriver: '' })
    } else {
      enqueueSnackbar('Error al asignar repartidor', { variant: 'error' })
    }
  }

  // Cancelar servicio
  const handleCancelService = async () => {
    const result = await cancelService(cancelDialog.service.id, cancelDialog.reason)
    
    if (result.success) {
      enqueueSnackbar('Servicio cancelado', { variant: 'success' })
      setCancelDialog({ open: false, service: null, reason: '' })
    } else {
      enqueueSnackbar('Error al cancelar servicio', { variant: 'error' })
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Header */}
      <Stack 
        direction={{ xs: 'column', sm: 'row' }} 
        justifyContent="space-between" 
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={1}
      >
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold">
            Gestión de Servicios
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Administra todos los servicios de delivery
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setNewServiceDialog(true)}
        >
          Nuevo Servicio
        </Button>
      </Stack>

      {/* Search and Filters */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          fullWidth
          size="small"
          placeholder="Buscar por ID, restaurante, cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            )
          }}
        />
      </Stack>

      {/* Tabs */}
      <Paper sx={{ borderRadius: 2 }}>
        <Tabs
          value={statusFilter}
          onChange={(e, v) => { setStatusFilter(v); setPage(0); }}
          variant="scrollable"
          scrollButtons="auto"
        >
          {tabs.map((tab) => (
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

      {/* Services Table */}
      <Card>
        <TableContainer>
          <Table size={isMobile ? 'small' : 'medium'}>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Restaurante</TableCell>
                {!isMobile && <TableCell>Zona</TableCell>}
                <TableCell>Tarifa</TableCell>
                <TableCell>Estado</TableCell>
                {!isMobile && <TableCell>Repartidor</TableCell>}
                <TableCell>Fecha</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedServices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <PackageIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      No se encontraron servicios
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedServices.map((service) => {
                  const statusConfig = getStatusConfig(service.status)
                  const isExpanded = expandedId === service.id
                  
                  return (
                    <Fragment key={service.id}>
                      <TableRow
                        hover
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {service.serviceId}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {service.restaurantName}
                          </Typography>
                        </TableCell>
                        {!isMobile && (
                          <TableCell>
                            <Typography variant="body2">{service.zoneName}</Typography>
                          </TableCell>
                        )}
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold" color="primary">
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
                          />
                        </TableCell>
                        {!isMobile && (
                          <TableCell>
                            <Typography variant="body2">
                              {service.driverName || '-'}
                            </Typography>
                          </TableCell>
                        )}
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {formatDate(service.createdAt)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            {/* Mostrar asignar para pendiente Y sin_repartidor */}
                            {(service.status === 'pendiente' || service.status === 'sin_repartidor') && (
                              <Tooltip title="Asignar repartidor">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setAssignDialog({ open: true, service, selectedDriver: '' })
                                  }}
                                >
                                  <AssignIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {service.status !== 'cancelado' && service.status !== 'entregado' && (
                              <Tooltip title="Cancelar">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setCancelDialog({ open: true, service, reason: '' })
                                  }}
                                >
                                  <CancelIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <IconButton
                              size="small"
                              onClick={() => setExpandedId(isExpanded ? null : service.id)}
                            >
                              {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
                            </IconButton>
                          </Stack>
                        </TableCell>
                      </TableRow>
                      
                      {/* Fila expandida con detalles */}
                      <TableRow>
                        <TableCell colSpan={8} sx={{ py: 0 }}>
                          <Collapse in={isExpanded}>
                            <Paper sx={{ p: 2, m: 1, bgcolor: alpha(theme.palette.primary.main, 0.02), borderRadius: 2 }}>
                              <Grid container spacing={2}>
                                {/* Cliente y Teléfono */}
                                <Grid item xs={12} sm={6} md={3}>
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    <PersonIcon fontSize="small" color="action" />
                                    <Box>
                                      <Typography variant="caption" color="text.secondary">Cliente</Typography>
                                      <Typography variant="body2" fontWeight="medium">{service.clientName || '-'}</Typography>
                                    </Box>
                                  </Stack>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    <PhoneIcon fontSize="small" color="action" />
                                    <Box>
                                      <Typography variant="caption" color="text.secondary">Teléfono</Typography>
                                      <Typography variant="body2" fontWeight="medium">{service.clientPhone || '-'}</Typography>
                                    </Box>
                                  </Stack>
                                </Grid>
                                
                                {/* Dirección */}
                                <Grid item xs={12} sm={12} md={6}>
                                  <Stack direction="row" spacing={1} alignItems="flex-start">
                                    <LocationIcon fontSize="small" color="action" sx={{ mt: 0.3 }} />
                                    <Box>
                                      <Typography variant="caption" color="text.secondary">Dirección de entrega</Typography>
                                      <Typography variant="body2">{service.deliveryAddress || '-'}</Typography>
                                    </Box>
                                  </Stack>
                                </Grid>
                                
                                <Grid item xs={12}>
                                  <Divider sx={{ my: 1 }} />
                                </Grid>
                                
                                {/* Información de pago */}
                                <Grid item xs={6} sm={3}>
                                  <Typography variant="caption" color="text.secondary">Método de pago</Typography>
                                  <Typography variant="body2" fontWeight="medium">
                                    {service.paymentMethod === 'efectivo' ? '💵 Efectivo' : '✅ Pagado'}
                                  </Typography>
                                </Grid>
                                
                                {service.paymentMethod === 'efectivo' && (
                                  <>
                                    <Grid item xs={6} sm={2}>
                                      <Typography variant="caption" color="text.secondary">A cobrar</Typography>
                                      <Typography variant="body2" fontWeight="bold" color="warning.main">
                                        ${service.amountToCollect?.toFixed(2) || '0.00'}
                                      </Typography>
                                    </Grid>
                                    <Grid item xs={6} sm={2}>
                                      <Typography variant="caption" color="text.secondary">Paga con</Typography>
                                      <Typography variant="body2">
                                        ${service.paysWith?.toFixed(2) || '0.00'}
                                      </Typography>
                                    </Grid>
                                    <Grid item xs={6} sm={2}>
                                      <Typography variant="caption" color="text.secondary">Cambio</Typography>
                                      <Typography variant="body2" fontWeight="bold" color="info.main">
                                        ${service.changeAmount?.toFixed(2) || '0.00'}
                                      </Typography>
                                    </Grid>
                                  </>
                                )}
                                
                                {/* Tarifas */}
                                <Grid item xs={6} sm={3}>
                                  <Typography variant="caption" color="text.secondary">Tarifa delivery</Typography>
                                  <Typography variant="body2" fontWeight="bold" color="primary">
                                    {formatCurrency(service.deliveryFee)}
                                  </Typography>
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                  <Typography variant="caption" color="text.secondary">Comisión ({service.commissionRate || 20}%)</Typography>
                                  <Typography variant="body2" color="error.main">
                                    -{formatCurrency(service.platformFee)}
                                  </Typography>
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                  <Typography variant="caption" color="text.secondary">Ganancia repartidor</Typography>
                                  <Typography variant="body2" fontWeight="bold" color="success.main">
                                    {formatCurrency(service.driverEarnings)}
                                  </Typography>
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                  <Typography variant="caption" color="text.secondary">Repartidor</Typography>
                                  <Typography variant="body2" fontWeight="medium">
                                    {service.driverName || 'Sin asignar'}
                                  </Typography>
                                </Grid>
                                
                                {/* Notas */}
                                {service.notes && (
                                  <Grid item xs={12}>
                                    <Divider sx={{ my: 1 }} />
                                    <Stack direction="row" spacing={1} alignItems="flex-start">
                                      <NotesIcon fontSize="small" color="action" />
                                      <Box>
                                        <Typography variant="caption" color="text.secondary">Notas</Typography>
                                        <Typography variant="body2">{service.notes}</Typography>
                                      </Box>
                                    </Stack>
                                  </Grid>
                                )}
                              </Grid>
                            </Paper>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          component="div"
          count={filteredServices.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10))
            setPage(0)
          }}
          rowsPerPageOptions={[5, 10, 25]}
          labelRowsPerPage="Filas por página"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
        />
      </Card>

      {/* New Service Dialog */}
      <Dialog
        open={newServiceDialog}
        onClose={() => setNewServiceDialog(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <PackageIcon color="primary" />
            <Typography variant="h6" fontWeight="bold">Crear Nuevo Servicio</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ mt: 0.5 }}>
            {/* Restaurante */}
            <Grid item xs={12}>
              <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>Restaurante *</Typography>
              <FormControl fullWidth size={isMobile ? 'small' : 'medium'} required>
                <Select
                  value={newService.restaurantId}
                  onChange={(e) => {
                    const restaurant = restaurants.find(r => r.id === e.target.value)
                    setNewService(prev => ({
                      ...prev,
                      restaurantId: e.target.value,
                      restaurantName: restaurant?.name || ''
                    }))
                  }}
                  displayEmpty
                  renderValue={(value) => {
                    if (!value) return <Typography color="text.disabled">Selecciona un restaurante</Typography>
                    const restaurant = restaurants.find(r => r.id === value)
                    return restaurant?.name || ''
                  }}
                >
                  {activeRestaurants.map((restaurant) => (
                    <MenuItem key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            {/* Zona de Entrega */}
            <Grid item xs={12}>
              <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>Zona de Entrega *</Typography>
              <FormControl fullWidth size={isMobile ? 'small' : 'medium'} required>
                <Select
                  value={newService.zoneId}
                  onChange={(e) => {
                    const zone = zones.find(z => z.id === e.target.value)
                    setNewService(prev => ({
                      ...prev,
                      zoneId: e.target.value,
                      zoneName: zone?.name || ''
                    }))
                  }}
                  displayEmpty
                  renderValue={(value) => {
                    if (!value) return <Typography color="text.disabled">Selecciona una zona</Typography>
                    const zone = zones.find(z => z.id === value)
                    return zone ? `${zone.name} - ${formatCurrency(zone.price)}` : ''
                  }}
                >
                  {activeZones.map((zone) => (
                    <MenuItem key={zone.id} value={zone.id}>
                      {zone.name} - {formatCurrency(zone.price)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            {/* Dirección de Entrega */}
            <Grid item xs={12}>
              <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>Dirección de Entrega *</Typography>
              <TextField
                fullWidth
                size={isMobile ? 'small' : 'medium'}
                placeholder="Dirección completa del cliente"
                value={newService.deliveryAddress}
                onChange={(e) => setNewService(prev => ({ ...prev, deliveryAddress: e.target.value }))}
                multiline
                rows={2}
              />
            </Grid>
            
            {/* Nombre y Teléfono */}
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>Nombre del Cliente *</Typography>
              <TextField
                fullWidth
                size={isMobile ? 'small' : 'medium'}
                placeholder="Nombre completo"
                value={newService.clientName}
                onChange={(e) => setNewService(prev => ({ ...prev, clientName: e.target.value }))}
                InputProps={{ startAdornment: <InputAdornment position="start"><PersonIcon color="action" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>Teléfono *</Typography>
              <TextField
                fullWidth
                size={isMobile ? 'small' : 'medium'}
                placeholder="Número de teléfono"
                value={newService.clientPhone}
                onChange={(e) => setNewService(prev => ({ ...prev, clientPhone: e.target.value }))}
                InputProps={{ startAdornment: <InputAdornment position="start"><PhoneIcon color="action" /></InputAdornment> }}
              />
            </Grid>
            
            {/* Método de Pago */}
            <Grid item xs={12}>
              <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>Método de Pago *</Typography>
              <FormControl fullWidth size={isMobile ? 'small' : 'medium'}>
                <Select
                  value={newService.paymentMethod}
                  onChange={(e) => setNewService(prev => ({ ...prev, paymentMethod: e.target.value, amountToCollect: '', paysWith: '' }))}
                >
                  <MenuItem value="efectivo">Efectivo</MenuItem>
                  <MenuItem value="pagado">Pagado</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            {/* Campos de pago - Solo si es Efectivo */}
            {newService.paymentMethod === 'efectivo' && (
              <>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>Monto a Cobrar *</Typography>
                  <TextField
                    fullWidth
                    size={isMobile ? 'small' : 'medium'}
                    type="number"
                    placeholder="Total a cobrar al cliente"
                    value={newService.amountToCollect}
                    onChange={(e) => setNewService(prev => ({ ...prev, amountToCollect: e.target.value }))}
                    InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>Paga Con *</Typography>
                  <TextField
                    fullWidth
                    size={isMobile ? 'small' : 'medium'}
                    type="number"
                    placeholder="Con cuánto paga el cliente"
                    value={newService.paysWith}
                    onChange={(e) => setNewService(prev => ({ ...prev, paysWith: e.target.value }))}
                    error={parseFloat(newService.paysWith) > 0 && parseFloat(newService.paysWith) < parseFloat(newService.amountToCollect)}
                    helperText={parseFloat(newService.paysWith) > 0 && parseFloat(newService.paysWith) < parseFloat(newService.amountToCollect) ? 'No puede ser menor al monto a cobrar' : ''}
                    InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                  />
                </Grid>
                
                {/* Indicador de cambio */}
                {changeAmount > 0 && (
                  <Grid item xs={12}>
                    <Paper sx={{ p: 2, bgcolor: 'warning.lighter', borderRadius: 2, border: 1, borderColor: 'warning.main' }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography variant="body1" fontWeight="bold" color="warning.dark">
                          💵 Cambio a llevar: ${changeAmount.toFixed(2)}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="warning.dark" sx={{ mt: 0.5, display: 'block' }}>
                        💡 El repartidor debe pedir este monto al restaurante
                      </Typography>
                    </Paper>
                  </Grid>
                )}
                
                {parseFloat(newService.paysWith) > 0 && parseFloat(newService.paysWith) === parseFloat(newService.amountToCollect) && (
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
            
            {/* Mensaje cuando es Pagado */}
            {newService.paymentMethod === 'pagado' && (
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
            
            {/* Notas */}
            <Grid item xs={12}>
              <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>Notas adicionales</Typography>
              <TextField
                fullWidth
                size={isMobile ? 'small' : 'medium'}
                placeholder="Instrucciones especiales, referencia, etc."
                value={newService.notes}
                onChange={(e) => setNewService(prev => ({ ...prev, notes: e.target.value }))}
                multiline
                rows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setNewServiceDialog(false)} fullWidth={isMobile}>Cancelar</Button>
          <Button variant="contained" onClick={handleCreateService} fullWidth={isMobile}>
            Crear Servicio
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign Driver Dialog - Con mensaje claro cuando no hay conductores */}
      <Dialog
        open={assignDialog.open}
        onClose={() => setAssignDialog({ open: false, service: null, selectedDriver: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <AssignIcon color="primary" />
            <Typography variant="h6">Asignar Repartidor</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Servicio: <strong>{assignDialog.service?.serviceId}</strong>
          </Typography>
          
          {onlineDrivers.length === 0 ? (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                ⚠️ No hay repartidores disponibles
              </Typography>
              <Typography variant="body2">
                No hay repartidores online en este momento. Intenta más tarde o contacta a un repartidor directamente.
              </Typography>
            </Alert>
          ) : (
            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel>Seleccionar Repartidor Online</InputLabel>
              <Select
                value={assignDialog.selectedDriver}
                label="Seleccionar Repartidor Online"
                onChange={(e) => setAssignDialog(prev => ({ ...prev, selectedDriver: e.target.value }))}
              >
                <MenuItem value="">
                  <em>-- Seleccionar --</em>
                </MenuItem>
                {onlineDrivers.map((driver) => (
                  <MenuItem key={driver.id} value={driver.id}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Chip label="Online" color="success" size="small" sx={{ minWidth: 60 }} />
                      <span>{driver.name}</span>
                      <Typography variant="caption" color="text.secondary">
                        ({driver.totalServices || 0} servicios)
                      </Typography>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setAssignDialog({ open: false, service: null, selectedDriver: '' })}>
            {onlineDrivers.length === 0 ? 'Cerrar' : 'Cancelar'}
          </Button>
          {onlineDrivers.length > 0 && (
            <Button 
              variant="contained" 
              onClick={handleAssignDriver}
              disabled={!assignDialog.selectedDriver}
            >
              Asignar
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog
        open={cancelDialog.open}
        onClose={() => setCancelDialog({ open: false, service: null, reason: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Cancelar Servicio</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            ¿Estás seguro de cancelar el servicio <strong>{cancelDialog.service?.serviceId}</strong>?
          </Typography>
          <TextField
            fullWidth
            label="Motivo de cancelación"
            value={cancelDialog.reason}
            onChange={(e) => setCancelDialog(prev => ({ ...prev, reason: e.target.value }))}
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setCancelDialog({ open: false, service: null, reason: '' })}>
            No cancelar
          </Button>
          <Button variant="contained" color="error" onClick={handleCancelService}>
            Confirmar Cancelación
          </Button>
        </DialogActions>
      </Dialog>

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