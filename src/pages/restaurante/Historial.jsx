// src/pages/restaurante/Historial.jsx
import { useState, useEffect, useMemo } from 'react'
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  useTheme,
  useMediaQuery,
  alpha,
  LinearProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material'
import {
  Search as SearchIcon,
  Inventory as PackageIcon,
  Check as CheckIcon,
  Cancel as CancelIcon,
  Schedule as PendingIcon,
  TwoWheeler as BikeIcon,
  LocationOn as LocationIcon,
  Phone as PhoneIcon,
  Person as PersonIcon,
  AccessTime as TimeIcon,
  FilterList as FilterIcon,
  GetApp as DownloadIcon,
  Visibility as ViewIcon,
  Close as CloseIcon,
  LocalShipping as ShippingIcon
} from '@mui/icons-material'
import { useRestaurantStore, useStore } from '../../store/useStore'
import { subscribeToRestaurantServices, getRestaurantByUserId, getRestaurant } from '../../services/firestore'
import { RIDERY_COLORS } from '../../theme/theme'
import { format } from 'date-fns'

// ============================================
// 📅 FUNCIONES DE MANEJO SEMANAL
// ============================================

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

const getCurrentWeekId = () => {
  const monday = getMonday(new Date())
  return monday.toISOString().split('T')[0]
}

// ============================================
// 📊 CONFIGURACIÓN DE ESTADOS
// ============================================

const STATUS_CONFIG = {
  pendiente: { label: 'Pendiente', color: 'warning', icon: PendingIcon },
  asignado: { label: 'Asignado', color: 'info', icon: BikeIcon },
  en_camino: { label: 'En camino', color: 'primary', icon: ShippingIcon },
  entregado: { label: 'Entregado', color: 'success', icon: CheckIcon },
  cancelado: { label: 'Cancelado', color: 'error', icon: CancelIcon },
  sin_repartidor: { label: 'Sin repartidor', color: 'error', icon: CancelIcon }
}

export default function RestauranteHistorial() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { restaurantData, setRestaurantData } = useRestaurantStore()
  const { user } = useStore()
  
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Filtros
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  
  // Paginación
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  
  // Modal detalle
  const [selectedService, setSelectedService] = useState(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  
  const currentYear = new Date().getFullYear()
  const currentWeekId = getCurrentWeekId()

  // Cargar datos - TIEMPO REAL
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
        const unsubServices = subscribeToRestaurantServices(restaurant.id, (servicesData) => {
          setServices(servicesData)
          setLoading(false)
        })
        
        return () => {
          unsubServices()
        }
      } else {
        setLoading(false)
      }
    }
    
    loadData()
  }, [restaurantData, setRestaurantData, user])

  // ============================================
  // 📝 FUNCIONES DE FORMATO
  // ============================================
  
  // Formato de moneda manual - SIEMPRE muestra $5.00
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null || isNaN(amount)) return '$0.00'
    const num = Number(amount)
    return '$' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
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

  // ============================================
  // 📊 ESTADÍSTICAS Y FILTRADO
  // ============================================
  
  const filteredServices = useMemo(() => {
    return services.filter(service => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const serviceId = service.serviceId?.toLowerCase() || ''
        const clientName = service.clientName?.toLowerCase() || ''
        const phone = service.clientPhone?.toLowerCase() || ''
        const address = service.deliveryAddress?.toLowerCase() || ''
        const zone = service.zoneName?.toLowerCase() || ''
        const driverName = service.driverName?.toLowerCase() || ''
        
        const matchesSearch = 
          serviceId.includes(query) ||
          clientName.includes(query) ||
          phone.includes(query) ||
          address.includes(query) ||
          zone.includes(query) ||
          driverName.includes(query)
        
        if (!matchesSearch) return false
      }
      
      if (statusFilter && service.status !== statusFilter) return false
      
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
  }, [services, searchQuery, statusFilter, dateFrom, dateTo])
  
  const stats = useMemo(() => {
    const delivered = filteredServices.filter(s => s.status === 'entregado')
    const totalFees = delivered.reduce((sum, s) => sum + (s.deliveryFee || 0), 0)
    
    const monday = new Date(currentWeekId)
    monday.setHours(0, 0, 0, 0)
    const sunday = getSunday(monday)
    sunday.setHours(23, 59, 59, 999)
    
    const weekServices = services.filter(s => {
      const isDelivered = s.status === 'entregado'
      const createdAt = s.createdAt?.seconds ? new Date(s.createdAt.seconds * 1000) : new Date(s.createdAt)
      return isDelivered && createdAt >= monday && createdAt <= sunday
    })
    
    const weekTotal = weekServices.reduce((sum, s) => sum + (s.deliveryFee || 0), 0)
    
    const allTimeDelivered = services.filter(s => s.status === 'entregado')
    const allTimeTotal = allTimeDelivered.reduce((sum, s) => sum + (s.deliveryFee || 0), 0)
    
    return {
      total: filteredServices.length,
      delivered: delivered.length,
      totalFees,
      weekServices: weekServices.length,
      weekTotal,
      allTimeServices: allTimeDelivered.length,
      allTimeTotal
    }
  }, [filteredServices, services, currentWeekId])

  // ============================================
  // 🔧 HANDLERS
  // ============================================
  
  const handleViewDetail = (service) => {
    setSelectedService(service)
    setDetailModalOpen(true)
  }
  
  const handleCloseDetail = () => {
    setDetailModalOpen(false)
    setSelectedService(null)
  }
  
  const handleClearFilters = () => {
    setSearchQuery('')
    setStatusFilter('')
    setDateFrom('')
    setDateTo('')
    setPage(0)
  }
  
  const handleExportCSV = () => {
    if (filteredServices.length === 0) return
    
    const headers = ['ID', 'Fecha', 'Zona', 'Cliente', 'Teléfono', 'Dirección', 'Repartidor', 'Estado', 'Tarifa Delivery']
    const rows = filteredServices.map(s => [
      s.serviceId || s.id,
      formatDateTime(s.createdAt),
      s.zoneName || 'N/A',
      s.clientName || 'N/A',
      s.clientPhone || 'N/A',
      s.deliveryAddress || 'N/A',
      s.driverName || 'Sin asignar',
      STATUS_CONFIG[s.status]?.label || s.status,
      s.deliveryFee || 0
    ])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `mis_servicios_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`
    link.click()
  }
  
  const handleChangePage = (event, newPage) => {
    setPage(newPage)
  }
  
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }
  
  const paginatedServices = filteredServices.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  )

  // ============================================
  // 🎨 RENDER
  // ============================================
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <LinearProgress />
        <Typography variant="body2" color="text.secondary">Cargando historial...</Typography>
      </Box>
    )
  }

  if (!restaurantData) {
    return (
      <Card sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          <PackageIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">
            Historial de Servicios
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Consulta todos tus servicios realizados
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

      {/* Quick Stats */}
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
                {stats.delivered}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card elevation={0} sx={{ bgcolor: '#dbeafe', height: '100%' }}>
            <CardContent sx={{ py: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" fontWeight="medium">
                Esta Semana
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="primary.main" sx={{ mt: 0.5 }}>
                {formatCurrency(stats.weekTotal)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card elevation={0} sx={{ bgcolor: '#fef3c7', height: '100%' }}>
            <CardContent sx={{ py: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" fontWeight="medium">
                Total Histórico
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="warning.main" sx={{ mt: 0.5 }}>
                {formatCurrency(stats.allTimeTotal)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Semana actual */}
      <Card elevation={0} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
        <CardContent sx={{ py: 1.5 }}>
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
              icon={<PackageIcon />} 
              label={`${stats.weekServices} servicios`} 
              color="primary" 
              size="small" 
            />
          </Stack>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card elevation={0}>
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <FilterIcon color="primary" />
            <Typography variant="subtitle1" fontWeight="bold">
              Filtros de Búsqueda
            </Typography>
          </Box>
          
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                placeholder="Buscar por ID, cliente, teléfono, dirección o repartidor..."
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
          
          <Grid container spacing={2} alignItems="center">
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
            <Grid item xs={12} sm={2}>
              <Button
                fullWidth
                variant="outlined"
                onClick={handleClearFilters}
                sx={{ height: 40 }}
              >
                Limpiar
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
                <TableCell sx={{ fontWeight: 'bold' }}>Zona</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Cliente</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Repartidor</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Estado</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">Tarifa</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedServices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
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
                          {service.zoneName || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {service.clientName || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {service.driverName || 'Sin asignar'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={statusConfig.label || service.status}
                          color={statusConfig.color || 'default'}
                          icon={<StatusIcon sx={{ fontSize: 16 }} />}
                          sx={{ minWidth: 90 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="medium" color="success.main">
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

      {/* Detail Modal - PANTALLA COMPLETA EN MÓVIL */}
      <Dialog
        open={detailModalOpen}
        onClose={handleCloseDetail}
        fullScreen={isMobile}
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
              
              {/* Info Grid - UNA COLUMNA EN MÓVIL */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <TimeIcon color="primary" fontSize="small" sx={{ mt: 0.5 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight="medium">
                          Fecha y Hora
                        </Typography>
                        <Typography variant="body1" fontWeight="medium" sx={{ wordBreak: 'break-word' }}>
                          {formatDateTime(selectedService.createdAt)}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <LocationIcon color="primary" fontSize="small" sx={{ mt: 0.5 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight="medium">
                          Zona
                        </Typography>
                        <Typography variant="body1" fontWeight="medium" sx={{ wordBreak: 'break-word' }}>
                          {selectedService.zoneName || 'N/A'}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <BikeIcon color="primary" fontSize="small" sx={{ mt: 0.5 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight="medium">
                          Repartidor
                        </Typography>
                        <Typography variant="body1" fontWeight="medium" sx={{ wordBreak: 'break-word' }}>
                          {selectedService.driverName || 'Sin asignar'}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <PersonIcon color="primary" fontSize="small" sx={{ mt: 0.5 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight="medium">
                          Cliente
                        </Typography>
                        <Typography variant="body1" fontWeight="medium" sx={{ wordBreak: 'break-word' }}>
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
                  <Box>
                    <Typography variant="body2">
                      <strong>Nombre:</strong> {selectedService.clientName || 'No especificado'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2">
                      <strong>Teléfono:</strong> {selectedService.clientPhone || 'No especificado'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                      <strong>Dirección:</strong> {selectedService.deliveryAddress || 'No especificada'}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
              
              {/* Notes */}
              {selectedService.notes && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
                    Notas
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
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
                    <Typography variant="body1" fontWeight="medium" color="success.main">
                      {formatCurrency(selectedService.deliveryFee)}
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
              <Button onClick={handleCloseDetail} variant="contained" fullWidth={isMobile}>
                Cerrar
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

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