import { useState, useEffect } from 'react'
import { alpha } from '@mui/material/styles'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Grid,
  Chip,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  useMediaQuery,
  Paper,
  LinearProgress,
  Collapse,
  IconButton,
  Tooltip
} from '@mui/material'
import {
  Add as AddIcon,
  TwoWheeler as DeliveryIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Inventory as PackageIcon,
  CheckCircle as CheckIcon,
  AccessTime as ClockIcon,
  Cancel as CancelIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Refresh as RefreshIcon,
  AttachMoney as MoneyIcon,
  Chat as ChatIcon,
  Star as StarIcon
} from '@mui/icons-material'
import { useSnackbar } from 'notistack'
import { formatCurrency, formatTime, formatDate, useRestaurantStore, useStore } from '../../store/useStore'
import { 
  subscribeToRestaurantServices,
  subscribeToZones,
  getRestaurantByUserId,
  getRestaurantStats,
  createService
} from '../../services/firestore'
import { canRateService } from '../../services/ratingService'
import { ChatButton } from '../../components/chat'
import { RatingModal, RatingBadge } from '../../components/rating'

export default function RestauranteDashboard() {
  const { enqueueSnackbar } = useSnackbar()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { restaurantData, setRestaurantData } = useRestaurantStore()
  const { user } = useStore()
  
  const [services, setServices] = useState([])
  const [zones, setZones] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [chatService, setChatService] = useState(null)
  
  // Rating modal state
  const [ratingModal, setRatingModal] = useState({ open: false, service: null, driver: null })
  
  const [openDialog, setOpenDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  
  const [nuevoServicio, setNuevoServicio] = useState({
    zona: '',
    direccion: '',
    cliente: '',
    telefono: '',
    metodoPago: 'efectivo',
    montoCobrar: '',
    notas: ''
  })

  // Cargar datos del restaurante y suscribirse a servicios
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      
      // Cargar zonas disponibles
      const unsubZones = subscribeToZones((zonesData) => {
        setZones(zonesData.filter(z => z.active))
      })
      
      // Cargar datos del restaurante si no están en el store
      let restaurant = restaurantData
      if (!restaurant) {
        // Intentar obtener el restaurantId del localStorage temporalmente
        // En producción esto vendría del usuario autenticado
        const storedRestaurantId = localStorage.getItem('restaurantId')
        if (storedRestaurantId) {
          restaurant = await getRestaurantByUserId(storedRestaurantId)
          if (restaurant) {
            setRestaurantData(restaurant)
          }
        }
      }
      
      // Suscribirse a servicios del restaurante
      if (restaurant?.id) {
        const unsubServices = subscribeToRestaurantServices(restaurant.id, (servicesData) => {
          setServices(servicesData)
          setLoading(false)
        })
        
        // Cargar estadísticas
        const statsData = await getRestaurantStats(restaurant.id)
        setStats(statsData)
        
        return () => {
          unsubZones()
          unsubServices()
        }
      } else {
        setLoading(false)
      }
      
      return () => {
        unsubZones()
      }
    }
    
    loadData()
  }, [restaurantData, setRestaurantData])

  // Recargar estadísticas cuando cambien los servicios
  useEffect(() => {
    const loadStats = async () => {
      if (restaurantData?.id) {
        const statsData = await getRestaurantStats(restaurantData.id)
        setStats(statsData)
      }
    }
    if (services.length > 0) {
      loadStats()
    }
  }, [services, restaurantData])

  // Detectar servicios recién entregados para mostrar modal de calificación
  useEffect(() => {
    const checkForRating = async () => {
      if (!restaurantData?.id || ratingModal.open) return
      
      // Buscar servicios entregados en los últimos 5 minutos que no hayan sido calificados
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
      
      const recentlyCompleted = services.find(async (service) => {
        if (service.status !== 'entregado') return false
        if (!service.driverId) return false
        
        const completedAt = service.completedAt?.toDate?.() || service.updatedAt?.toDate?.()
        if (!completedAt || completedAt < fiveMinutesAgo) return false
        
        // Verificar si ya fue calificado
        const canRate = await canRateService(service.id, restaurantData.id)
        return canRate
      })
      
      if (recentlyCompleted) {
        setRatingModal({
          open: true,
          service: recentlyCompleted,
          driver: {
            id: recentlyCompleted.driverId,
            name: recentlyCompleted.driverName,
            rating: recentlyCompleted.driverRating,
            totalServices: recentlyCompleted.driverTotalServices
          }
        })
      }
    }
    
    checkForRating()
  }, [services, restaurantData?.id, ratingModal.open])

  // Función para abrir manualmente el modal de calificación
  const handleOpenRating = async (service) => {
    if (!restaurantData?.id) return
    
    const canRate = await canRateService(service.id, restaurantData.id)
    if (!canRate) {
      enqueueSnackbar('Ya calificaste este servicio', { variant: 'info' })
      return
    }
    
    setRatingModal({
      open: true,
      service,
      driver: {
        id: service.driverId,
        name: service.driverName,
        rating: service.driverRating,
        totalServices: service.driverTotalServices
      }
    })
  }

  // Función al completar calificación
  const handleRatingComplete = () => {
    setRatingModal({ open: false, service: null, driver: null })
  }

  // Crear nuevo servicio
  const handleCrearServicio = async () => {
    if (!nuevoServicio.zona || !nuevoServicio.direccion) {
      enqueueSnackbar('Por favor completa los campos requeridos', { variant: 'warning' })
      return
    }

    if (!restaurantData?.id) {
      enqueueSnackbar('Error: No se encontraron datos del restaurante', { variant: 'error' })
      return
    }

    setSaving(true)
    
    const zona = zones.find(z => z.id === nuevoServicio.zona)
    
    // Calcular tarifas
    const deliveryFee = zona?.price || 0
    const platformFee = deliveryFee * 0.2 // 20% para la plataforma
    const driverEarnings = deliveryFee - platformFee
    
    const result = await createService({
      restaurantId: restaurantData.id,
      restaurantName: restaurantData.name,
      restaurantAddress: restaurantData.address || '',
      zoneId: nuevoServicio.zona,
      zoneName: zona?.name || '',
      deliveryAddress: nuevoServicio.direccion,
      clientName: nuevoServicio.cliente,
      clientPhone: nuevoServicio.telefono,
      paymentMethod: nuevoServicio.metodoPago,
      amountToCollect: parseFloat(nuevoServicio.montoCobrar) || 0,
      notes: nuevoServicio.notas,
      deliveryFee,
      platformFee,
      driverEarnings,
      settled: false
    })
    
    setSaving(false)
    
    if (result.success) {
      enqueueSnackbar(`Servicio ${result.serviceId} creado. Tarifa: ${formatCurrency(deliveryFee)}`, { variant: 'success' })
      setOpenDialog(false)
      setNuevoServicio({ zona: '', direccion: '', cliente: '', telefono: '', metodoPago: 'efectivo', montoCobrar: '', notas: '' })
    } else {
      enqueueSnackbar(result.error || 'Error al crear servicio', { variant: 'error' })
    }
  }

  // Obtener configuración de estado
  const getStatusConfig = (status) => {
    const configs = {
      pendiente: { color: 'warning', label: 'Pendiente', icon: <ClockIcon /> },
      asignado: { color: 'info', label: 'Asignado', icon: <DeliveryIcon /> },
      en_camino: { color: 'primary', label: 'En Camino', icon: <DeliveryIcon /> },
      entregado: { color: 'success', label: 'Entregado', icon: <CheckIcon /> },
      cancelado: { color: 'error', label: 'Cancelado', icon: <CancelIcon /> }
    }
    return configs[status] || configs.pendiente
  }

  // Servicios recientes (últimos 5)
  const serviciosRecientes = services.slice(0, 5)
  
  // Servicios activos (pendientes, asignados, en camino)
  const serviciosActivos = services.filter(s => 
    s.status === 'pendiente' || s.status === 'asignado' || s.status === 'en_camino'
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {loading && <LinearProgress />}
      
      {/* Header */}
      <Stack 
        direction={{ xs: 'column', sm: 'row' }} 
        justifyContent="space-between" 
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={{ xs: 1, sm: 0 }}
      >
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold">
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Solicita y gestiona tus servicios de delivery
          </Typography>
        </Box>
        <Button
          variant="contained"
          size={isMobile ? 'medium' : 'large'}
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
          fullWidth={isMobile}
        >
          Nuevo Servicio
        </Button>
      </Stack>

      {/* Stats Cards */}
      <Grid container spacing={{ xs: 1.5, sm: 3 }}>
        <Grid item xs={4}>
          <Card sx={{ bgcolor: 'primary.main', color: 'white', height: '100%' }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 }, textAlign: 'center' }}>
              <Typography variant={isMobile ? 'caption' : 'body2'} sx={{ opacity: 0.9 }}>
                Servicios Hoy
              </Typography>
              <Typography variant={isMobile ? 'h5' : 'h3'} fontWeight="bold">
                {stats?.servicesToday || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4}>
          <Card sx={{ bgcolor: 'success.main', color: 'white', height: '100%' }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 }, textAlign: 'center' }}>
              <Typography variant={isMobile ? 'caption' : 'body2'} sx={{ opacity: 0.9 }}>
                Total del Mes
              </Typography>
              <Typography variant={isMobile ? 'h5' : 'h3'} fontWeight="bold">
                {formatCurrency(stats?.monthlyTotal || 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4}>
          <Card sx={{ bgcolor: 'warning.main', color: 'white', height: '100%' }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 }, textAlign: 'center' }}>
              <Typography variant={isMobile ? 'caption' : 'body2'} sx={{ opacity: 0.9 }}>
                Por Pagar
              </Typography>
              <Typography variant={isMobile ? 'h5' : 'h3'} fontWeight="bold">
                {formatCurrency(stats?.pendingPayment || 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Servicios Activos */}
      {serviciosActivos.length > 0 && (
        <Card sx={{ borderRadius: 2, border: 2, borderColor: 'primary.light' }}>
          <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <DeliveryIcon color="primary" />
              <Typography variant="subtitle1" fontWeight="bold">
                Servicios Activos ({serviciosActivos.length})
              </Typography>
            </Stack>
            <Stack spacing={1.5}>
              {serviciosActivos.map((servicio) => {
                const status = getStatusConfig(servicio.status)
                const hasDriver = servicio.driverId && servicio.status !== 'pendiente'
                return (
                  <Paper
                    key={servicio.id}
                    variant="outlined"
                    sx={{
                      p: { xs: 1.5, sm: 2 },
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.primary.main, 0.02)
                    }}
                  >
                    <Grid container spacing={1} alignItems="center">
                      <Grid item xs={12} sm={3}>
                        <Typography variant="subtitle2" fontWeight="bold">
                          ID: {servicio.serviceId}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatTime(servicio.createdAt)}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <LocationIcon fontSize="small" color="action" sx={{ fontSize: 16 }} />
                          <Typography variant="body2" noWrap>
                            {servicio.zoneName} - {servicio.deliveryAddress}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6} sm={2}>
                        <Typography variant="body2" fontWeight="bold" color="primary">
                          {formatCurrency(servicio.deliveryFee)}
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sm={1.5}>
                        <Chip
                          icon={status.icon}
                          label={status.label}
                          size="small"
                          color={status.color}
                          sx={{ 
                            fontSize: { xs: '0.65rem', sm: '0.75rem' },
                            height: { xs: 24, sm: 28 },
                            '& .MuiChip-label': { 
                              px: { xs: 0.5, sm: 1 },
                              whiteSpace: 'nowrap'
                            }
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={1.5} sx={{ textAlign: 'right' }}>
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          {hasDriver && servicio.status !== 'entregado' && (
                            <Tooltip title="Chat con repartidor">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => setChatService(servicio)}
                                sx={{ 
                                  bgcolor: 'primary.main', 
                                  color: 'white',
                                  '&:hover': { bgcolor: 'primary.dark' }
                                }}
                              >
                                <ChatIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {servicio.status === 'entregado' && servicio.driverId && (
                            <Tooltip title="Calificar servicio">
                              <IconButton
                                size="small"
                                color="warning"
                                onClick={() => handleOpenRating(servicio)}
                                sx={{ 
                                  bgcolor: 'warning.main', 
                                  color: 'white',
                                  '&:hover': { bgcolor: 'warning.dark' }
                                }}
                              >
                                <StarIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </Grid>
                    </Grid>
                    {hasDriver && servicio.driverName && (
                      <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <BikeIcon fontSize="small" color="success" />
                          <Typography variant="caption" color="text.secondary">
                            Repartidor: <strong>{servicio.driverName}</strong>
                          </Typography>
                        </Stack>
                      </Box>
                    )}
                  </Paper>
                )
              })}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Recent Services */}
      <Card>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <PackageIcon color="primary" />
              <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold">
                Servicios Recientes
              </Typography>
            </Stack>
          </Stack>
          
          {serviciosRecientes.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
              <PackageIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                No hay servicios registrados
              </Typography>
              <Typography variant="caption" color="text.disabled">
                Crea tu primer servicio de delivery
              </Typography>
            </Paper>
          ) : (
            <Stack spacing={{ xs: 1, sm: 2 }}>
              {serviciosRecientes.map((servicio) => {
                const status = getStatusConfig(servicio.status)
                const isExpanded = expandedId === servicio.id
                
                return (
                  <Card key={servicio.id} variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
                      {/* Layout para móvil - fila superior con ID y estado */}
                      {isMobile ? (
                        <>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                            <Box>
                              <Typography variant="subtitle2" fontWeight="bold">
                                ID: {servicio.serviceId}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatDate(servicio.createdAt)} - {formatTime(servicio.createdAt)}
                              </Typography>
                            </Box>
                            <Chip
                              icon={status.icon}
                              label={status.label}
                              size="small"
                              color={status.color}
                              sx={{ 
                                fontSize: '0.7rem',
                                height: 26,
                                '& .MuiChip-label': { 
                                  px: 0.75,
                                  whiteSpace: 'nowrap'
                                }
                              }}
                            />
                          </Stack>
                          
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, minWidth: 0 }}>
                              <LocationIcon fontSize="small" color="action" sx={{ fontSize: 14 }} />
                              <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                                {servicio.zoneName} - {servicio.deliveryAddress}
                              </Typography>
                            </Box>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Typography variant="body2" fontWeight="bold" color="primary">
                                {formatCurrency(servicio.deliveryFee)}
                              </Typography>
                              <IconButton
                                size="small"
                                onClick={() => setExpandedId(isExpanded ? null : servicio.id)}
                              >
                                {isExpanded ? <CollapseIcon fontSize="small" /> : <ExpandIcon fontSize="small" />}
                              </IconButton>
                            </Stack>
                          </Stack>
                        </>
                      ) : (
                        /* Layout para desktop */
                        <Grid container spacing={2} alignItems="center">
                          <Grid item xs={12} sm={3}>
                            <Typography variant="subtitle2" fontWeight="bold">
                              ID: {servicio.serviceId}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(servicio.createdAt)} - {formatTime(servicio.createdAt)}
                            </Typography>
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <LocationIcon fontSize="small" color="action" sx={{ fontSize: 18 }} />
                              <Typography variant="body2" noWrap>
                                {servicio.zoneName} - {servicio.deliveryAddress}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={6} sm={2}>
                            <Typography variant="body2" fontWeight="bold" color="primary">
                              {formatCurrency(servicio.deliveryFee)}
                            </Typography>
                          </Grid>
                          <Grid item xs={6} sm={2}>
                            <Chip
                              icon={status.icon}
                              label={status.label}
                              size="small"
                              color={status.color}
                              sx={{ 
                                fontSize: '0.75rem',
                                height: 28,
                                '& .MuiChip-label': { 
                                  px: 1,
                                  whiteSpace: 'nowrap'
                                }
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} sm={1} sx={{ textAlign: 'right' }}>
                            <IconButton
                              size="small"
                              onClick={() => setExpandedId(isExpanded ? null : servicio.id)}
                            >
                              {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
                            </IconButton>
                          </Grid>
                        </Grid>
                      )}
                      
                      {/* Detalles expandidos */}
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
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">Cliente</Typography>
                              <Typography variant="body2">{servicio.clientName || 'No especificado'}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">Teléfono</Typography>
                              <Typography variant="body2">{servicio.clientPhone || '-'}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">Método de pago</Typography>
                              <Typography variant="body2">
                                {servicio.paymentMethod === 'efectivo' ? 'Efectivo' : 
                                 servicio.paymentMethod === 'transferencia' ? 'Transferencia' : 'Pagado'}
                              </Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">Repartidor</Typography>
                              <Typography variant="body2">{servicio.driverName || 'Sin asignar'}</Typography>
                            </Grid>
                            {servicio.notes && (
                              <Grid item xs={12}>
                                <Typography variant="caption" color="text.secondary">Notas</Typography>
                                <Typography variant="body2">{servicio.notes}</Typography>
                              </Grid>
                            )}
                          </Grid>
                        </Paper>
                      </Collapse>
                    </CardContent>
                  </Card>
                )
              })}
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* New Service Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)} 
        maxWidth="sm" 
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <DeliveryIcon color="primary" />
            <Typography variant="h6" fontWeight="bold">Solicitar Nuevo Servicio</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <FormControl fullWidth required size={isMobile ? 'small' : 'medium'}>
                <InputLabel>Zona de Entrega</InputLabel>
                <Select
                  value={nuevoServicio.zona}
                  label="Zona de Entrega"
                  onChange={(e) => setNuevoServicio({ ...nuevoServicio, zona: e.target.value })}
                >
                  {zones.map((zona) => (
                    <MenuItem key={zona.id} value={zona.id}>
                      {zona.name} - {formatCurrency(zona.price)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Dirección de Entrega"
                placeholder="Dirección completa del cliente"
                value={nuevoServicio.direccion}
                onChange={(e) => setNuevoServicio({ ...nuevoServicio, direccion: e.target.value })}
                multiline
                rows={2}
                size={isMobile ? 'small' : 'medium'}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Nombre del Cliente"
                placeholder="Opcional"
                value={nuevoServicio.cliente}
                onChange={(e) => setNuevoServicio({ ...nuevoServicio, cliente: e.target.value })}
                size={isMobile ? 'small' : 'medium'}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon color="action" fontSize={isMobile ? 'small' : 'medium'} />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Teléfono"
                placeholder="Opcional"
                value={nuevoServicio.telefono}
                onChange={(e) => setNuevoServicio({ ...nuevoServicio, telefono: e.target.value })}
                size={isMobile ? 'small' : 'medium'}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PhoneIcon color="action" fontSize={isMobile ? 'small' : 'medium'} />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size={isMobile ? 'small' : 'medium'}>
                <InputLabel>Método de Pago</InputLabel>
                <Select
                  value={nuevoServicio.metodoPago}
                  label="Método de Pago"
                  onChange={(e) => setNuevoServicio({ ...nuevoServicio, metodoPago: e.target.value })}
                >
                  <MenuItem value="efectivo">Efectivo</MenuItem>
                  <MenuItem value="transferencia">Transferencia</MenuItem>
                  <MenuItem value="pagado">Pagado Online</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Monto a Cobrar"
                type="number"
                placeholder="Si es en efectivo"
                value={nuevoServicio.montoCobrar}
                onChange={(e) => setNuevoServicio({ ...nuevoServicio, montoCobrar: e.target.value })}
                size={isMobile ? 'small' : 'medium'}
                disabled={nuevoServicio.metodoPago === 'pagado'}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <MoneyIcon color="action" fontSize={isMobile ? 'small' : 'medium'} />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notas Adicionales"
                placeholder="Instrucciones especiales para la entrega"
                value={nuevoServicio.notas}
                onChange={(e) => setNuevoServicio({ ...nuevoServicio, notas: e.target.value })}
                multiline
                rows={2}
                size={isMobile ? 'small' : 'medium'}
              />
            </Grid>
          </Grid>

          {nuevoServicio.zona && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'primary.light', borderRadius: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="primary.dark">
                Tarifa del servicio:
              </Typography>
              <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight="bold" color="primary">
                {formatCurrency(zones.find(z => z.id === nuevoServicio.zona)?.price || 0)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Incluye: {formatCurrency((zones.find(z => z.id === nuevoServicio.zona)?.price || 0) * 0.8)} para el repartidor
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: { xs: 1.5, sm: 2 }, gap: 1 }}>
          <Button onClick={() => setOpenDialog(false)} fullWidth={isMobile}>
            Cancelar
          </Button>
          <Button 
            variant="contained" 
            onClick={handleCrearServicio} 
            fullWidth={isMobile}
            disabled={saving}
          >
            {saving ? 'Creando...' : 'Crear Servicio'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Chat con Repartidor */}
      {chatService && (
        <ChatButton
          service={chatService}
          currentUser={{
            id: restaurantData?.id,
            name: restaurantData?.name,
            role: 'restaurant'
          }}
          otherParty={{
            name: chatService.driverName,
            role: 'driver'
          }}
          variant="fab"
          onChatClose={() => setChatService(null)}
        />
      )}

      {/* Modal de Calificación */}
      <RatingModal
        open={ratingModal.open}
        onClose={() => setRatingModal({ open: false, service: null, driver: null })}
        service={ratingModal.service}
        driver={ratingModal.driver}
        restaurantId={restaurantData?.id}
        onRated={handleRatingComplete}
      />
    </Box>
  )
}