// src/pages/admin/Repartidores.jsx
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
  Tooltip
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
  Edit as EditIcon,
  Delete as DeleteIcon,
  FilterList as FilterIcon,
  Assignment as AssignIcon,
  Refresh as RefreshIcon
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
  completeService
} from '../../services/firestore'

export default function AdminServicios() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { enqueueSnackbar } = useSnackbar()
  
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
    notes: ''
  })

  // Cargar datos
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

  // Filtrar servicios
  const filteredServices = services.filter(service => {
    const matchesStatus = statusFilter === 'todos' || service.status === statusFilter
    const matchesSearch = !searchTerm || 
      service.serviceId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.restaurantName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.zoneName?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesStatus && matchesSearch
  })

  // Paginación
  const paginatedServices = filteredServices.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  )

  // Configuración de estados
  const getStatusConfig = (status) => {
    const configs = {
      pendiente: { color: 'warning', label: 'Pendiente', icon: <ClockIcon /> },
      asignado: { color: 'info', label: 'Asignado', icon: <AssignIcon /> },
      en_camino: { color: 'primary', label: 'En Camino', icon: <DeliveryIcon /> },
      entregado: { color: 'success', label: 'Entregado', icon: <CheckIcon /> },
      cancelado: { color: 'error', label: 'Cancelado', icon: <CancelIcon /> }
    }
    return configs[status] || configs.pendiente
  }

  // Tabs
  const tabs = [
    { value: 'todos', label: 'Todos', count: services.length },
    { value: 'pendiente', label: 'Pendientes', count: services.filter(s => s.status === 'pendiente').length },
    { value: 'asignado', label: 'Asignados', count: services.filter(s => s.status === 'asignado').length },
    { value: 'en_camino', label: 'En Camino', count: services.filter(s => s.status === 'en_camino').length },
    { value: 'entregado', label: 'Entregados', count: services.filter(s => s.status === 'entregado').length },
    { value: 'cancelado', label: 'Cancelados', count: services.filter(s => s.status === 'cancelado').length }
  ]

  // Crear nuevo servicio
  const handleCreateService = async () => {
    if (!newService.restaurantId || !newService.zoneId || !newService.deliveryAddress) {
      enqueueSnackbar('Completa todos los campos requeridos', { variant: 'warning' })
      return
    }
    
    const restaurant = restaurants.find(r => r.id === newService.restaurantId)
    const zone = zones.find(z => z.id === newService.zoneId)
    
    // Calcular tarifas
    const deliveryFee = zone?.price || 0
    const platformFee = deliveryFee * 0.2 // 20% para la plataforma
    const driverEarnings = deliveryFee - platformFee
    
    const result = await createService({
      ...newService,
      restaurantName: restaurant?.name || '',
      restaurantAddress: restaurant?.address || '',
      zoneName: zone?.name || '',
      deliveryFee,
      platformFee,
      driverEarnings,
      amountToCollect: parseFloat(newService.amountToCollect) || 0,
      settled: false
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

  // Cambiar estado
  const handleUpdateStatus = async (serviceId, newStatus) => {
    const result = await updateService(serviceId, { status: newStatus })
    if (result.success) {
      enqueueSnackbar('Estado actualizado', { variant: 'success' })
    } else {
      enqueueSnackbar('Error al actualizar estado', { variant: 'error' })
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
                <TableCell>Monto</TableCell>
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
                    <TableRow
                      key={service.id}
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
                          {service.status === 'pendiente' && (
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
      >
        <DialogTitle>Crear Nuevo Servicio</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel>Restaurante</InputLabel>
              <Select
                value={newService.restaurantId}
                label="Restaurante"
                onChange={(e) => {
                  const restaurant = restaurants.find(r => r.id === e.target.value)
                  setNewService(prev => ({
                    ...prev,
                    restaurantId: e.target.value,
                    restaurantName: restaurant?.name || ''
                  }))
                }}
              >
                {restaurants.filter(r => r.active).map((restaurant) => (
                  <MenuItem key={restaurant.id} value={restaurant.id}>
                    {restaurant.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl fullWidth required>
              <InputLabel>Zona de Entrega</InputLabel>
              <Select
                value={newService.zoneId}
                label="Zona de Entrega"
                onChange={(e) => {
                  const zone = zones.find(z => z.id === e.target.value)
                  setNewService(prev => ({
                    ...prev,
                    zoneId: e.target.value,
                    zoneName: zone?.name || ''
                  }))
                }}
              >
                {zones.filter(z => z.active).map((zone) => (
                  <MenuItem key={zone.id} value={zone.id}>
                    {zone.name} - {formatCurrency(zone.price)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <TextField
              fullWidth
              required
              label="Dirección de Entrega"
              value={newService.deliveryAddress}
              onChange={(e) => setNewService(prev => ({ ...prev, deliveryAddress: e.target.value }))}
              multiline
              rows={2}
            />
            
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Nombre del Cliente"
                  value={newService.clientName}
                  onChange={(e) => setNewService(prev => ({ ...prev, clientName: e.target.value }))}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Teléfono"
                  value={newService.clientPhone}
                  onChange={(e) => setNewService(prev => ({ ...prev, clientPhone: e.target.value }))}
                />
              </Grid>
            </Grid>
            
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Método de Pago</InputLabel>
                  <Select
                    value={newService.paymentMethod}
                    label="Método de Pago"
                    onChange={(e) => setNewService(prev => ({ ...prev, paymentMethod: e.target.value }))}
                  >
                    <MenuItem value="efectivo">Efectivo</MenuItem>
                    <MenuItem value="transferencia">Transferencia</MenuItem>
                    <MenuItem value="pagado">Pagado Online</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Monto a Cobrar"
                  type="number"
                  value={newService.amountToCollect}
                  onChange={(e) => setNewService(prev => ({ ...prev, amountToCollect: e.target.value }))}
                  disabled={newService.paymentMethod === 'pagado'}
                />
              </Grid>
            </Grid>
            
            <TextField
              fullWidth
              label="Notas Adicionales"
              value={newService.notes}
              onChange={(e) => setNewService(prev => ({ ...prev, notes: e.target.value }))}
              multiline
              rows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setNewServiceDialog(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleCreateService}>
            Crear Servicio
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign Driver Dialog */}
      <Dialog
        open={assignDialog.open}
        onClose={() => setAssignDialog({ open: false, service: null, selectedDriver: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Asignar Repartidor</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Servicio: {assignDialog.service?.serviceId}
          </Typography>
          <FormControl fullWidth>
            <InputLabel>Seleccionar Repartidor</InputLabel>
            <Select
              value={assignDialog.selectedDriver}
              label="Seleccionar Repartidor"
              onChange={(e) => setAssignDialog(prev => ({ ...prev, selectedDriver: e.target.value }))}
            >
              <MenuItem value="">
                <em>-- Seleccionar --</em>
              </MenuItem>
              {drivers.filter(d => d.active && d.isOnline).map((driver) => (
                <MenuItem key={driver.id} value={driver.id}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Chip label="Online" color="success" size="small" />
                    <span>{driver.name}</span>
                    <Typography variant="caption" color="text.secondary">
                      ({driver.totalServices || 0} servicios)
                    </Typography>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {drivers.filter(d => d.active && d.isOnline).length === 0 && (
            <Typography variant="body2" color="warning.main" sx={{ mt: 2 }}>
              No hay repartidores disponibles en este momento
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setAssignDialog({ open: false, service: null, selectedDriver: '' })}>
            Cancelar
          </Button>
          <Button 
            variant="contained" 
            onClick={handleAssignDriver}
            disabled={!assignDialog.selectedDriver}
          >
            Asignar
          </Button>
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
            ¿Estás seguro de cancelar el servicio {cancelDialog.service?.serviceId}?
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
    </Box>
  )
}
