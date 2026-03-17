// src/pages/repartidor/Dashboard.jsx
import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  Grid,
  Chip,
  Stack,
  Paper,
  Avatar,
  IconButton,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  useMediaQuery,
  alpha,
  Collapse,
  Fab,
  Tooltip
} from '@mui/material'
import {
  PowerSettingsNew as PowerIcon,
  LocationOn as LocationIcon,
  Store as StoreIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  AttachMoney as MoneyIcon,
  TwoWheeler as BikeIcon,
  Star as StarIcon,
  Navigation as NavigationIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  AccessTime as ClockIcon,
  Refresh as RefreshIcon,
  GpsFixed as GpsIcon,
  GpsOff as GpsOffIcon,
  Map as MapIcon,
  Speed as SpeedIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Chat as ChatIcon
} from '@mui/icons-material'
import { useSnackbar } from 'notistack'
import { useStore, useDriverStore, formatCurrency, formatTime, formatDate } from '../../store/useStore'
import { 
  subscribeToPendingServices, 
  subscribeToDriverServices,
  acceptService,
  startService,
  completeService,
  setDriverOnline,
  getDriverStats,
  getDriverByUserId
} from '../../services/firestore'
import { useDriverTracking } from '../../hooks/useDriverTracking'
import LiveMap from '../../components/tracking/LiveMap'
import { ChatButton } from '../../components/chat'

export default function RepartidorDashboard() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { enqueueSnackbar } = useSnackbar()
  const { user } = useStore()
  const { isOnline, setIsOnline, currentService, setCurrentService } = useDriverStore()
  
  const [pendingServices, setPendingServices] = useState([])
  const [myServices, setMyServices] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedService, setSelectedService] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState({ open: false, type: '', service: null })
  const [driverData, setDriverData] = useState(null)
  const [showMap, setShowMap] = useState(false)
  const [showGpsDetails, setShowGpsDetails] = useState(false)

  // Hook de tracking GPS
  const {
    isTracking,
    currentLocation,
    error: gpsError,
    startTracking,
    stopTracking,
    getETA
  } = useDriverTracking(driverData, currentService)

  // Cargar datos del repartidor
  useEffect(() => {
    const loadDriverData = async () => {
      if (user?.uid) {
        const driver = await getDriverByUserId(user.uid)
        setDriverData(driver)
        if (driver) {
          setIsOnline(driver.isOnline || false)
        }
      }
    }
    loadDriverData()
  }, [user, setIsOnline])

  // Suscribirse a servicios pendientes cuando está online
  useEffect(() => {
    if (!isOnline || !driverData?.id) return
    
    const unsubscribe = subscribeToPendingServices((services) => {
      // Filtrar servicios que no tengan driver asignado
      const available = services.filter(s => !s.driverId)
      setPendingServices(available)
      
      // Reproducir sonido si hay nuevos servicios
      if (available.length > 0 && !currentService) {
        try {
          // Notificación del navegador
          if (Notification.permission === 'granted') {
            new Notification('¡Nuevo servicio disponible!', {
              body: `Tienes ${available.length} servicio(s) esperando`,
              icon: '/logo-192.png'
            })
          }
        } catch (e) {
          console.log('Notification not supported')
        }
      }
    })
    
    return () => unsubscribe()
  }, [isOnline, driverData, currentService])

  // Suscribirse a mis servicios asignados
  useEffect(() => {
    if (!driverData?.id) return
    
    const unsubscribe = subscribeToDriverServices(driverData.id, (services) => {
      setMyServices(services)
      
      // Encontrar servicio activo (asignado o en camino)
      const active = services.find(s => 
        s.status === 'asignado' || s.status === 'en_camino'
      )
      setCurrentService(active || null)
    })
    
    return () => unsubscribe()
  }, [driverData, setCurrentService])

  // Cargar estadísticas
  const loadStats = useCallback(async () => {
    if (!driverData?.id) return
    const statsData = await getDriverStats(driverData.id)
    setStats(statsData)
  }, [driverData])

  useEffect(() => {
    loadStats()
  }, [loadStats, myServices])

  // Toggle online/offline
  const handleToggleOnline = async () => {
    if (!driverData?.id) {
      enqueueSnackbar('Error: No se encontró tu perfil de repartidor', { variant: 'error' })
      return
    }
    
    setLoading(true)
    const result = await setDriverOnline(driverData.id, !isOnline)
    setLoading(false)
    
    if (result.success) {
      setIsOnline(!isOnline)
      
      // Iniciar/detener tracking GPS
      if (!isOnline) {
        // Va a ponerse online - iniciar tracking
        await startTracking()
        enqueueSnackbar('¡Ahora estás en línea! GPS activado', { variant: 'success' })
      } else {
        // Va a salir - detener tracking
        await stopTracking()
        enqueueSnackbar('Saliste del sistema', { variant: 'info' })
      }
    } else {
      enqueueSnackbar('Error al cambiar estado', { variant: 'error' })
    }
  }

  // Aceptar servicio
  const handleAcceptService = async (service) => {
    if (!driverData?.id) return
    
    setLoading(true)
    const result = await acceptService(service.id, driverData.id, driverData.name || user?.name)
    setLoading(false)
    
    if (result.success) {
      enqueueSnackbar('¡Servicio aceptado!', { variant: 'success' })
      setSelectedService(null)
      setPendingServices(prev => prev.filter(s => s.id !== service.id))
    } else {
      enqueueSnackbar(result.error || 'Error al aceptar servicio', { variant: 'error' })
    }
  }

  // Iniciar entrega
  const handleStartDelivery = async (service) => {
    setLoading(true)
    const result = await startService(service.id)
    setLoading(false)
    
    if (result.success) {
      enqueueSnackbar('¡Viaje iniciado!', { variant: 'success' })
    } else {
      enqueueSnackbar('Error al iniciar viaje', { variant: 'error' })
    }
  }

  // Completar entrega
  const handleCompleteService = async (service) => {
    setLoading(true)
    const result = await completeService(service.id, service.driverEarnings)
    setLoading(false)
    
    if (result.success) {
      enqueueSnackbar('¡Servicio completado!', { variant: 'success' })
      setConfirmDialog({ open: false, type: '', service: null })
    } else {
      enqueueSnackbar('Error al completar servicio', { variant: 'error' })
    }
  }

  // Obtener configuración de estado
  const getStatusConfig = (status) => {
    const configs = {
      pendiente: { color: 'warning', label: 'Pendiente', icon: <ClockIcon /> },
      asignado: { color: 'info', label: 'Asignado', icon: <CheckIcon /> },
      en_camino: { color: 'primary', label: 'En Camino', icon: <BikeIcon /> },
      entregado: { color: 'success', label: 'Entregado', icon: <CheckIcon /> },
      cancelado: { color: 'error', label: 'Cancelado', icon: <CancelIcon /> }
    }
    return configs[status] || configs.pendiente
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {loading && <LinearProgress />}
      
      {/* Profile Card */}
      <Card sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              sx={{
                width: { xs: 48, sm: 56 },
                height: { xs: 48, sm: 56 },
                bgcolor: 'success.main',
                fontSize: { xs: '1.2rem', sm: '1.5rem' },
                fontWeight: 'bold',
                borderRadius: 2
              }}
            >
              {user?.name?.charAt(0) || 'R'}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold" noWrap>
                {driverData?.name || user?.name || 'Repartidor'}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <StarIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                <Typography variant="body2" color="warning.main">
                  {driverData?.rating?.toFixed(1) || '5.0'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ({driverData?.totalServices || 0} servicios)
                </Typography>
              </Box>
            </Box>
            <Chip
              label={isOnline ? 'En línea' : 'Fuera de línea'}
              color={isOnline ? 'success' : 'default'}
              size="small"
            />
          </Box>
        </CardContent>
      </Card>

      {/* Online/Offline Button */}
      <Button
        fullWidth
        size="large"
        variant="contained"
        onClick={handleToggleOnline}
        disabled={loading}
        sx={{
          py: { xs: 2, sm: 3 },
          borderRadius: 2,
          bgcolor: isOnline ? 'success.main' : 'grey.700',
          fontSize: { xs: '0.9rem', sm: '1rem' },
          '&:hover': {
            bgcolor: isOnline ? 'success.dark' : 'grey.600'
          }
        }}
        startIcon={<PowerIcon sx={{ animation: isOnline ? 'pulse 1s infinite' : 'none' }} />}
      >
        {isOnline ? 'ESTÁS EN LÍNEA' : 'PONERSE EN LÍNEA'}
      </Button>

      {/* GPS Status Card - Nuevo */}
      {isOnline && (
        <Card 
          sx={{ 
            borderRadius: 2,
            bgcolor: isTracking ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.warning.main, 0.1),
            border: 1,
            borderColor: isTracking ? 'success.main' : 'warning.main'
          }}
        >
          <CardContent sx={{ py: 1.5, px: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={1} alignItems="center">
                {isTracking ? (
                  <GpsIcon color="success" sx={{ animation: 'pulse 1.5s infinite' }} />
                ) : (
                  <GpsOffIcon color="warning" />
                )}
                <Box>
                  <Typography variant="subtitle2" fontWeight="bold">
                    {isTracking ? 'GPS Activo' : 'GPS Inactivo'}
                  </Typography>
                  {currentLocation && (
                    <Typography variant="caption" color="text.secondary">
                      {currentLocation.speed > 0 && `${(currentLocation.speed * 3.6).toFixed(0)} km/h`}
                      {currentLocation.accuracy && ` - Precisión: ${currentLocation.accuracy.toFixed(0)}m`}
                    </Typography>
                  )}
                </Box>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Tooltip title={showGpsDetails ? "Ocultar detalles" : "Ver detalles"}>
                  <IconButton size="small" onClick={() => setShowGpsDetails(!showGpsDetails)}>
                    {showGpsDetails ? <CollapseIcon /> : <ExpandIcon />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Ver mapa">
                  <IconButton size="small" onClick={() => setShowMap(!showMap)} color="primary">
                    <MapIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
            
            {/* GPS Details */}
            <Collapse in={showGpsDetails}>
              <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Latitud</Typography>
                    <Typography variant="body2" fontFamily="monospace">
                      {currentLocation?.latitude?.toFixed(6) || '--'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Longitud</Typography>
                    <Typography variant="body2" fontFamily="monospace">
                      {currentLocation?.longitude?.toFixed(6) || '--'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Velocidad</Typography>
                    <Typography variant="body2">
                      {currentLocation?.speed ? `${(currentLocation.speed * 3.6).toFixed(1)} km/h` : '0 km/h'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Dirección</Typography>
                    <Typography variant="body2">
                      {currentLocation?.heading ? `${currentLocation.heading.toFixed(0)}°` : '--'}
                    </Typography>
                  </Grid>
                </Grid>
                {gpsError && (
                  <Typography variant="caption" color="error.main" sx={{ mt: 1, display: 'block' }}>
                    Error: {gpsError}
                  </Typography>
                )}
              </Box>
            </Collapse>
          </CardContent>
        </Card>
      )}

      {/* Live Map - Nuevo */}
      {showMap && isOnline && (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent sx={{ p: 0 }}>
            <LiveMap
              driverLocation={currentLocation}
              height={isMobile ? 250 : 300}
              interactive={true}
              showRoute={false}
              showDriver={isTracking}
            />
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <Grid container spacing={{ xs: 1, sm: 2 }}>
        <Grid item xs={4}>
          <Card sx={{ textAlign: 'center', borderRadius: 2, height: '100%' }}>
            <CardContent sx={{ py: { xs: 1.5, sm: 2 }, px: 1 }}>
              <MoneyIcon sx={{ color: 'success.main', mb: 0.5, fontSize: { xs: 20, sm: 24 } }} />
              <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold">
                {formatCurrency(stats?.totalEarnings || 0)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Total Ganado
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4}>
          <Card sx={{ textAlign: 'center', borderRadius: 2, height: '100%' }}>
            <CardContent sx={{ py: { xs: 1.5, sm: 2 }, px: 1 }}>
              <BikeIcon sx={{ color: 'info.main', mb: 0.5, fontSize: { xs: 20, sm: 24 } }} />
              <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold">
                {stats?.totalServices || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Servicios
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4}>
          <Card sx={{ textAlign: 'center', borderRadius: 2, height: '100%' }}>
            <CardContent sx={{ py: { xs: 1.5, sm: 2 }, px: 1 }}>
              <StarIcon sx={{ color: 'warning.main', mb: 0.5, fontSize: { xs: 20, sm: 24 } }} />
              <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold">
                {driverData?.rating?.toFixed(1) || '5.0'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Rating
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Current Active Service */}
      {currentService && (
        <Card sx={{ borderRadius: 2, border: 2, borderColor: 'primary.main' }}>
          <CardHeader
            avatar={<BikeIcon color="primary" />}
            title={
              <Typography variant="subtitle1" fontWeight="bold" color="primary">
                SERVICIO ACTIVO
              </Typography>
            }
            subheader={`ID: ${currentService.serviceId}`}
            action={
              <Chip 
                label={getStatusConfig(currentService.status).label} 
                color={getStatusConfig(currentService.status).color}
                size="small"
              />
            }
          />
          <CardContent sx={{ pt: 0 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                  <Typography variant="caption" color="text.secondary">
                    <StoreIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                    Recoger en:
                  </Typography>
                  <Typography variant="subtitle2" fontWeight="bold">
                    {currentService.restaurantName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {currentService.restaurantAddress}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.info.main, 0.1) }}>
                  <Typography variant="caption" color="text.secondary">
                    <LocationIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                    Entregar en:
                  </Typography>
                  <Typography variant="subtitle2" fontWeight="bold">
                    {currentService.zoneName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {currentService.deliveryAddress}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            <Box sx={{ mt: 2, p: 1.5, bgcolor: 'success.main', borderRadius: 2, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'success.light' }}>
                Tu ganancia
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="white">
                {formatCurrency(currentService.driverEarnings)}
              </Typography>
            </Box>

            {currentService.clientName && (
              <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  <PersonIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                  {currentService.clientName}
                </Typography>
                {currentService.clientPhone && (
                  <Typography variant="body2" color="text.secondary">
                    <PhoneIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                    {currentService.clientPhone}
                  </Typography>
                )}
              </Stack>
            )}

            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              {currentService.status === 'asignado' && (
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  size="large"
                  startIcon={<NavigationIcon />}
                  onClick={() => handleStartDelivery(currentService)}
                  disabled={loading}
                >
                  INICIAR VIAJE
                </Button>
              )}
              {currentService.status === 'en_camino' && (
                <Button
                  fullWidth
                  variant="contained"
                  color="success"
                  size="large"
                  startIcon={<CheckIcon />}
                  onClick={() => setConfirmDialog({ open: true, type: 'complete', service: currentService })}
                  disabled={loading}
                >
                  COMPLETAR ENTREGA
                </Button>
              )}
              <Tooltip title="Chat con restaurante">
                <IconButton
                  onClick={() => {}}
                  sx={{ 
                    bgcolor: 'success.main', 
                    color: 'white',
                    '&:hover': { bgcolor: 'success.dark' }
                  }}
                >
                  <ChatIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Abrir en Maps">
                <IconButton
                  onClick={() => {
                    // Abrir en Google Maps
                    const address = encodeURIComponent(currentService.deliveryAddress + ', Maracay, Venezuela')
                    window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank')
                  }}
                  sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}
                >
                  <LocationIcon color="primary" />
                </IconButton>
              </Tooltip>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Pending Services (when online and no active service) */}
      {isOnline && !currentService && pendingServices.length > 0 && (
        <Box>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
            Servicios Disponibles ({pendingServices.length})
          </Typography>
          <Stack spacing={2}>
            {pendingServices.slice(0, 3).map((service) => (
              <Card
                key={service.id}
                sx={{
                  borderRadius: 2,
                  border: 2,
                  borderColor: 'warning.main',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }
                }}
                onClick={() => setSelectedService(service)}
              >
                <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {service.serviceId}
                    </Typography>
                    <Chip label={formatCurrency(service.driverEarnings)} color="success" size="small" />
                  </Stack>
                  
                  <Typography variant="body2" color="text.secondary" noWrap>
                    <StoreIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                    {service.restaurantName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    <LocationIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                    {service.zoneName} - {service.deliveryAddress}
                  </Typography>

                  <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                    <Button
                      fullWidth
                      variant="contained"
                      color="success"
                      size="small"
                      startIcon={<CheckIcon />}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAcceptService(service)
                      }}
                      disabled={loading}
                    >
                      ACEPTAR
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPendingServices(prev => prev.filter(s => s.id !== service.id))
                      }}
                    >
                      Ignorar
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Box>
      )}

      {/* Today's Stats */}
      <Card sx={{ borderRadius: 2 }}>
        <CardHeader
          avatar={<MoneyIcon color="success" />}
          title={
            <Typography variant="subtitle1" fontWeight="bold" color="success.main">
              Ganancias de Hoy
            </Typography>
          }
          action={
            <IconButton onClick={loadStats} size="small">
              <RefreshIcon />
            </IconButton>
          }
        />
        <CardContent>
          <Typography variant="h4" fontWeight="bold" color="success.main">
            {formatCurrency(stats?.earningsToday || 0)}
          </Typography>
          <Stack direction="row" justifyContent="space-between" sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Servicios hoy</Typography>
              <Typography variant="body2" fontWeight="bold">{stats?.completedToday || 0}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Esta semana</Typography>
              <Typography variant="body2" fontWeight="bold">{formatCurrency(stats?.weeklyEarnings || 0)}</Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, type: '', service: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {confirmDialog.type === 'complete' ? '¿Completar entrega?' : '¿Estás seguro?'}
        </DialogTitle>
        <DialogContent>
          {confirmDialog.type === 'complete' && confirmDialog.service && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Confirmar que la entrega fue completada exitosamente.
              </Typography>
              <Paper sx={{ p: 2, mt: 2, bgcolor: 'success.light' }}>
                <Typography variant="body2">Ganancia: <strong>{formatCurrency(confirmDialog.service.driverEarnings)}</strong></Typography>
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={() => setConfirmDialog({ open: false, type: '', service: null })}
            fullWidth
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={() => handleCompleteService(confirmDialog.service)}
            disabled={loading}
            fullWidth
          >
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Service Detail Dialog */}
      <Dialog
        open={!!selectedService}
        onClose={() => setSelectedService(null)}
        maxWidth="sm"
        fullWidth
      >
        {selectedService && (
          <>
            <DialogTitle>
              Detalle del Servicio
              <Chip label={selectedService.serviceId} size="small" sx={{ ml: 1 }} />
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                    <Typography variant="caption" color="text.secondary">Restaurante</Typography>
                    <Typography variant="subtitle1" fontWeight="bold">{selectedService.restaurantName}</Typography>
                    <Typography variant="body2" color="text.secondary">{selectedService.restaurantAddress}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12}>
                  <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.info.main, 0.1) }}>
                    <Typography variant="caption" color="text.secondary">Entregar en</Typography>
                    <Typography variant="subtitle1" fontWeight="bold">{selectedService.zoneName}</Typography>
                    <Typography variant="body2" color="text.secondary">{selectedService.deliveryAddress}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Método de pago</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {selectedService.paymentMethod === 'efectivo' ? 'Efectivo' : 'Pagado'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Monto a cobrar</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {formatCurrency(selectedService.amountToCollect || 0)}
                  </Typography>
                </Grid>
              </Grid>
              
              <Paper sx={{ p: 2, mt: 2, bgcolor: 'success.main', textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: 'success.light' }}>Tu ganancia</Typography>
                <Typography variant="h4" fontWeight="bold" color="white">
                  {formatCurrency(selectedService.driverEarnings)}
                </Typography>
              </Paper>
            </DialogContent>
            <DialogActions sx={{ p: 2, gap: 1 }}>
              <Button onClick={() => setSelectedService(null)} fullWidth>
                Cancelar
              </Button>
              <Button
                variant="contained"
                color="success"
                onClick={() => {
                  handleAcceptService(selectedService)
                }}
                disabled={loading}
                fullWidth
              >
                Aceptar Servicio
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Chat con Restaurante - cuando hay servicio activo */}
      {currentService && (
        <ChatButton
          service={currentService}
          currentUser={{
            id: driverData?.id,
            name: driverData?.name || user?.name,
            role: 'driver'
          }}
          otherParty={{
            name: currentService.restaurantName,
            role: 'restaurant'
          }}
          variant="fab"
        />
      )}
    </Box>
  )
}
