// src/pages/admin/Historial.jsx
import { useState, useEffect, useMemo } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Paper,
  Divider,
  Stack
} from '@mui/material'
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  GetApp as DownloadIcon,
  Visibility as ViewIcon,
  Close as CloseIcon,
  TwoWheeler as BikeIcon,
  Restaurant as RestaurantIcon,
  Person as PersonIcon,
  AccessTime as TimeIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Check as CheckIcon,
  Cancel as CancelIcon,
  Schedule as PendingIcon,
  LocalShipping as ShippingIcon,
  AttachMoney as MoneyIcon
} from '@mui/icons-material'
import { useSnackbar } from 'notistack'
import { subscribeToServices, subscribeToRestaurants, subscribeToDrivers } from '../../services/firestore'
import { format } from 'date-fns'

const STATUS_CONFIG = {
  pendiente: { label: 'Pendiente', color: 'warning', icon: PendingIcon },
  asignado: { label: 'Asignado', color: 'info', icon: BikeIcon },
  en_camino: { label: 'En camino', color: 'primary', icon: ShippingIcon },
  entregado: { label: 'Entregado', color: 'success', icon: CheckIcon },
  cancelado: { label: 'Cancelado', color: 'error', icon: CancelIcon },
  sin_repartidor: { label: 'Sin repartidor', color: 'error', icon: CancelIcon }
}

export default function AdminHistorial() {
  const { enqueueSnackbar } = useSnackbar()
  
  // Data
  const [services, setServices] = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [restaurantFilter, setRestaurantFilter] = useState('')
  const [driverFilter, setDriverFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  
  // Pagination
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  
  // Detail modal
  const [selectedService, setSelectedService] = useState(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  
  // Load data
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
  
  // Helper functions
  const getRestaurantName = (restaurantId) => {
    if (!restaurantId) return 'N/A'
    const restaurant = restaurants.find(r => r.id === restaurantId)
    return restaurant?.name || 'N/A'
  }
  
  const getDriverName = (driverId) => {
    if (!driverId) return 'Sin asignar'
    const driver = drivers.find(d => d.id === driverId)
    return driver?.name || 'N/A'
  }
  
  // Formato de fecha: 27/03/2026 12:59 p. m.
  const formatDateTime = (timestamp) => {
    if (!timestamp) return 'N/A'
    try {
      const date = timestamp?.seconds 
        ? new Date(timestamp.seconds * 1000) 
        : new Date(timestamp)
      
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      let hours = date.getHours()
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const ampm = hours >= 12 ? 'p. m.' : 'a. m.'
      hours = hours % 12
      hours = hours ? hours : 12
      
      return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`
    } catch {
      return 'N/A'
    }
  }
  
  // Formato de moneda sin "RD" duplicado
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null || isNaN(amount)) return '$0.00'
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP',
      minimumFractionDigits: 2
    }).format(amount).replace('RD$', '$')
  }
  
  // Filtered services
  const filteredServices = useMemo(() => {
    return services.filter(service => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const restaurantName = getRestaurantName(service.restaurantId)?.toLowerCase() || ''
        const driverName = getDriverName(service.driverId)?.toLowerCase() || ''
        const clientName = service.clientName?.toLowerCase() || ''
        const serviceId = service.serviceId?.toLowerCase() || ''
        const phone = service.clientPhone?.toLowerCase() || ''
        const address = service.deliveryAddress?.toLowerCase() || ''
        
        const matchesSearch = 
          restaurantName.includes(query) || 
          driverName.includes(query) || 
          clientName.includes(query) ||
          serviceId.includes(query) ||
          phone.includes(query) ||
          address.includes(query)
        
        if (!matchesSearch) return false
      }
      
      if (statusFilter && service.status !== statusFilter) return false
      if (restaurantFilter && service.restaurantId !== restaurantFilter) return false
      if (driverFilter && service.driverId !== driverFilter) return false
      
      if (dateFrom) {
        const serviceDate = new Date(service.createdAt?.seconds * 1000 || service.createdAt)
        const filterDate = new Date(dateFrom)
        filterDate.setHours(0, 0, 0, 0)
        if (serviceDate < filterDate) return false
      }
      
      if (dateTo) {
        const serviceDate = new Date(service.createdAt?.seconds * 1000 || service.createdAt)
        const filterDate = new Date(dateTo)
        filterDate.setHours(23, 59, 59, 999)
        if (serviceDate > filterDate) return false
      }
      
      return true
    }).sort((a, b) => {
      const dateA = new Date(a.createdAt?.seconds * 1000 || a.createdAt)
      const dateB = new Date(b.createdAt?.seconds * 1000 || b.createdAt)
      return dateB - dateA
    })
  }, [services, searchQuery, statusFilter, restaurantFilter, driverFilter, dateFrom, dateTo])
  
  // Stats - con ganancia de repartidor
  const stats = useMemo(() => {
    const completed = filteredServices.filter(s => s.status === 'entregado')
    const totalDeliveryFees = filteredServices.reduce((sum, s) => sum + (s.deliveryFee || 0), 0)
    const totalDriverEarnings = filteredServices.reduce((sum, s) => sum + (s.driverEarnings || 0), 0)
    
    return {
      total: filteredServices.length,
      completed: completed.length,
      totalDeliveryFees,
      totalDriverEarnings
    }
  }, [filteredServices])
  
  // Handlers
  const handleViewDetail = (service) => {
    setSelectedService(service)
    setDetailModalOpen(true)
  }
  
  const handleCloseDetail = () => {
    setDetailModalOpen(false)
    setSelectedService(null)
  }
  
  const handleChangePage = (event, newPage) => {
    setPage(newPage)
  }
  
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }
  
  const handleClearFilters = () => {
    setSearchQuery('')
    setStatusFilter('')
    setRestaurantFilter('')
    setDriverFilter('')
    setDateFrom('')
    setDateTo('')
    setPage(0)
  }
  
  const handleExportCSV = () => {
    if (filteredServices.length === 0) {
      enqueueSnackbar('No hay datos para exportar', { variant: 'warning' })
      return
    }
    
    const headers = ['ID', 'Fecha', 'Restaurante', 'Repartidor', 'Cliente', 'Teléfono', 'Estado', 'Ganancia Repartidor', 'Tarifa Delivery']
    const rows = filteredServices.map(s => [
      s.serviceId || s.id,
      formatDateTime(s.createdAt),
      getRestaurantName(s.restaurantId),
      getDriverName(s.driverId),
      s.clientName || 'N/A',
      s.clientPhone || 'N/A',
      STATUS_CONFIG[s.status]?.label || s.status,
      s.driverEarnings || 0,
      s.deliveryFee || 0
    ])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `historial_servicios_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`
    link.click()
    
    enqueueSnackbar('Archivo CSV descargado', { variant: 'success' })
  }
  
  // Paginated data
  const paginatedServices = filteredServices.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  )
  
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">
            Historial de Servicios
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Consulta y filtra todos los servicios del sistema
          </Typography>
        </Box>
        
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleExportCSV}
          disabled={filteredServices.length === 0}
        >
          Exportar CSV
        </Button>
      </Box>
      
      {/* Quick Stats - 4 tarjetas */}
      <Grid container spacing={2}>
        <Grid item xs={6} sm={3}>
          <Card elevation={0} sx={{ bgcolor: 'grey.100', height: '100%' }}>
            <CardContent sx={{ py: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" fontWeight="medium">
                Total Servicios
              </Typography>
              <Typography variant="h4" fontWeight="bold" sx={{ mt: 0.5 }}>
                {stats.total}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card elevation={0} sx={{ bgcolor: '#dcfce7', height: '100%' }}>
            <CardContent sx={{ py: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" fontWeight="medium">
                Entregados
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="success.main" sx={{ mt: 0.5 }}>
                {stats.completed}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card elevation={0} sx={{ bgcolor: '#e0e7ff', height: '100%' }}>
            <CardContent sx={{ py: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" fontWeight="medium">
                Ganancia Repartidores
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="primary.main" sx={{ mt: 0.5 }}>
                {formatCurrency(stats.totalDriverEarnings)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card elevation={0} sx={{ bgcolor: '#fef3c7', height: '100%' }}>
            <CardContent sx={{ py: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" fontWeight="medium">
                Tarifas Delivery
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="warning.main" sx={{ mt: 0.5 }}>
                {formatCurrency(stats.totalDeliveryFees)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Filters - distribuidos en filas completas */}
      <Card elevation={0}>
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <FilterIcon color="primary" />
            <Typography variant="subtitle1" fontWeight="bold">
              Filtros de Búsqueda
            </Typography>
          </Box>
          
          {/* Fila 1: Búsqueda completa */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                placeholder="Buscar por ID, restaurante, cliente, teléfono o dirección..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
          </Grid>
          
          {/* Fila 2: Filtros desplegables */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel id="status-label">Estado</InputLabel>
                <Select
                  labelId="status-label"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  label="Estado"
                >
                  <MenuItem value="">Todos los estados</MenuItem>
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <MenuItem key={key} value={key}>{config.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel id="restaurant-label">Restaurante</InputLabel>
                <Select
                  labelId="restaurant-label"
                  value={restaurantFilter}
                  onChange={(e) => setRestaurantFilter(e.target.value)}
                  label="Restaurante"
                >
                  <MenuItem value="">Todos los restaurantes</MenuItem>
                  {restaurants.map((r) => (
                    <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel id="driver-label">Repartidor</InputLabel>
                <Select
                  labelId="driver-label"
                  value={driverFilter}
                  onChange={(e) => setDriverFilter(e.target.value)}
                  label="Repartidor"
                >
                  <MenuItem value="">Todos los repartidores</MenuItem>
                  {drivers.filter(d => d.active).map((d) => (
                    <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          
          {/* Fila 3: Fechas y botón limpiar */}
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="Fecha desde"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="Fecha hasta"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <Button
                fullWidth
                variant="outlined"
                onClick={handleClearFilters}
                sx={{ height: 40 }}
              >
                Limpiar filtros
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      
      {/* Table */}
      <Card elevation={0}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Fecha</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Restaurante</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Repartidor</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Cliente</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Estado</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">Ganancia Rep.</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">Tarifa</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">Cargando...</Typography>
                  </TableCell>
                </TableRow>
              ) : paginatedServices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No se encontraron servicios con los filtros seleccionados
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedServices.map((service) => {
                  const statusConfig = STATUS_CONFIG[service.status] || {}
                  const StatusIcon = statusConfig.icon || PendingIcon
                  
                  return (
                    <TableRow key={service.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {service.serviceId || service.id?.substring(0, 8)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDateTime(service.createdAt)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {getRestaurantName(service.restaurantId)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {getDriverName(service.driverId)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {service.clientName || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={statusConfig.label || service.status}
                          color={statusConfig.color || 'default'}
                          icon={<StatusIcon sx={{ fontSize: 16 }} />}
                          sx={{ minWidth: 100 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="medium" color="primary.main">
                          {formatCurrency(service.driverEarnings)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="text.secondary">
                          {formatCurrency(service.deliveryFee)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => handleViewDetail(service)}
                          color="primary"
                        >
                          <ViewIcon />
                        </IconButton>
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
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[5, 10, 25, 50]}
          labelRowsPerPage="Filas por página:"
          labelDisplayedRows={({ from, to, count }) => 
            `${from}-${to} de ${count !== -1 ? count : `más de ${to}`}`
          }
        />
      </Card>
      
      {/* Detail Modal */}
      <Dialog
        open={detailModalOpen}
        onClose={handleCloseDetail}
        maxWidth="sm"
        fullWidth
      >
        {selectedService && (
          <>
            <DialogTitle sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              pb: 1
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <BikeIcon color="primary" sx={{ fontSize: 28 }} />
                <Box>
                  <Typography variant="h6" fontWeight="bold" component="div">
                    Detalle del Servicio
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    ID: {selectedService.serviceId || selectedService.id}
                  </Typography>
                </Box>
              </Box>
              <IconButton onClick={handleCloseDetail} size="small">
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            
            <Divider />
            
            <DialogContent sx={{ py: 3 }}>
              {/* Status Banner */}
              <Box sx={{ mb: 3 }}>
                <Chip
                  label={STATUS_CONFIG[selectedService.status]?.label || selectedService.status}
                  color={STATUS_CONFIG[selectedService.status]?.color || 'default'}
                  sx={{ fontSize: '1rem', py: 2.5, px: 1 }}
                />
              </Box>
              
              {/* Info Grid - 2x2 bien alineado */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <TimeIcon color="primary" fontSize="small" sx={{ mt: 0.5 }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight="medium">
                          Fecha y Hora
                        </Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {formatDateTime(selectedService.createdAt)}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                </Grid>
                
                <Grid item xs={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <RestaurantIcon color="primary" fontSize="small" sx={{ mt: 0.5 }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight="medium">
                          Restaurante
                        </Typography>
                        <Typography variant="body1" fontWeight="medium" noWrap>
                          {getRestaurantName(selectedService.restaurantId)}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                </Grid>
                
                <Grid item xs={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <BikeIcon color="primary" fontSize="small" sx={{ mt: 0.5 }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight="medium">
                          Repartidor
                        </Typography>
                        <Typography variant="body1" fontWeight="medium" noWrap>
                          {getDriverName(selectedService.driverId)}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                </Grid>
                
                <Grid item xs={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <PersonIcon color="primary" fontSize="small" sx={{ mt: 0.5 }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight="medium">
                          Cliente
                        </Typography>
                        <Typography variant="body1" fontWeight="medium" noWrap>
                          {selectedService.clientName || 'No especificado'}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                </Grid>
              </Grid>
              
              {/* Customer Details */}
              <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1.5 }}>
                Datos del Cliente
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PersonIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      <strong>Nombre:</strong> {selectedService.clientName || 'No especificado'}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PhoneIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      <strong>Teléfono:</strong> {selectedService.clientPhone || 'No especificado'}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <LocationIcon fontSize="small" color="action" sx={{ mt: 0.3 }} />
                    <Typography variant="body2">
                      <strong>Dirección:</strong> {selectedService.deliveryAddress || 'No especificada'}
                    </Typography>
                  </Stack>
                </Stack>
              </Paper>
              
              {/* Zone Info */}
              {selectedService.zoneName && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
                    Zona de Entrega
                  </Typography>
                  <Chip 
                    icon={<LocationIcon />}
                    label={selectedService.zoneName} 
                    variant="outlined"
                  />
                </Box>
              )}
              
              {/* Notes */}
              {selectedService.notes && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
                    Notas
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="body2">
                      {selectedService.notes}
                    </Typography>
                  </Paper>
                </Box>
              )}
              
              {/* Payment Summary */}
              <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1.5 }}>
                Resumen de Pago
              </Typography>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Método de Pago
                    </Typography>
                    <Chip 
                      size="small" 
                      label={selectedService.paymentMethod === 'efectivo' ? 'Efectivo' : 
                             selectedService.paymentMethod === 'pagado' ? 'Pagado' : 
                             selectedService.paymentMethod || 'N/A'}
                      variant="outlined"
                    />
                  </Stack>
                  
                  <Divider />
                  
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Monto a Cobrar
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {formatCurrency(selectedService.amountToCollect)}
                    </Typography>
                  </Stack>
                  
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Tarifa de Delivery
                    </Typography>
                    <Typography variant="body1">
                      {formatCurrency(selectedService.deliveryFee)}
                    </Typography>
                  </Stack>
                  
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Ganancia Repartidor
                    </Typography>
                    <Typography variant="body1" fontWeight="medium" color="primary.main">
                      {formatCurrency(selectedService.driverEarnings)}
                    </Typography>
                  </Stack>
                  
                  {selectedService.paysWith > 0 && (
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" color="text.secondary">
                        Paga Con
                      </Typography>
                      <Typography variant="body1">
                        {formatCurrency(selectedService.paysWith)}
                      </Typography>
                    </Stack>
                  )}
                  
                  {selectedService.changeAmount > 0 && (
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" color="text.secondary">
                        Cambio
                      </Typography>
                      <Typography variant="body1" color="error">
                        {formatCurrency(selectedService.changeAmount)}
                      </Typography>
                    </Stack>
                  )}
                </Stack>
              </Paper>
            </DialogContent>
            
            <Divider />
            
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={handleCloseDetail} variant="contained">
                Cerrar
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  )
}