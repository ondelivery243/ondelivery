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
  Tooltip,
  Divider,
  CircularProgress,
  Alert
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
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Chat as ChatIcon,
  MyLocation as MyLocationIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material'
import { useSnackbar } from 'notistack'
import { useStore, useDriverStore, formatCurrency } from '../../store/useStore'
import { 
  subscribeToPendingServices, 
  subscribeToDriverServices,
  acceptService,
  startService,
  completeService,
  setDriverOnline,
  getDriverStats,
  getDriverByUserId,
  getSettings
} from '../../services/firestore'
import { useDriverTracking } from '../../hooks/useDriverTracking'
import LiveMap from '../../components/tracking/LiveMap'
import { ChatButton } from '../../components/chat'
import { RIDERY_COLORS } from '../../theme/theme'

// Función helper para calcular ganancias
const calculateDriverEarnings = (service, commissionRate = 20) => {
  if (service.driverEarnings !== undefined && service.driverEarnings !== null) {
    return service.driverEarnings
  }
  const deliveryFee = service.deliveryFee || 0
  const rate = service.commissionRate || commissionRate
  return deliveryFee * (1 - rate / 100)
}

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
  const [gettingLocation, setGettingLocation] = useState(false)
  const [appSettings, setAppSettings] = useState({
    commissionRate: 20,
    minDeliveryFee: 1.50
  })

  // Hook de tracking GPS
  const {
    isTracking,
    currentLocation,
    error: gpsError,
    permissionStatus,
    startTracking,
    stopTracking,
    forceGetLocation
  } = useDriverTracking(driverData, currentService)

  // Cargar configuración
  useEffect(() => {
    const loadSettings = async () => {
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
    loadSettings()
  }, [])

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

  // Suscribirse a servicios pendientes
  useEffect(() => {
    if (!isOnline || !driverData?.id) return
    
    const unsubscribe = subscribeToPendingServices((services) => {
      const available = services.filter(s => !s.driverId)
      setPendingServices(available)
      
      if (available.length > 0 && !currentService) {
        try {
          if (Notification.permission === 'granted') {
            new Notification('¡Nuevo servicio disponible!', {
              body: `Tienes ${available.length} servicio(s) esperando`,
              icon: '/logo-192.png'
            })
          }
        } catch (e) {}
      }
    })
    
    return () => unsubscribe()
  }, [isOnline, driverData, currentService])

  // Suscribirse a mis servicios
  useEffect(() => {
    if (!driverData?.id) return
    
    const unsubscribe = subscribeToDriverServices(driverData.id, (services) => {
      setMyServices(services)
      
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
      enqueueSnackbar('Error: No se encontró tu perfil', { variant: 'error' })
      return
    }
    
    setLoading(true)
    
    try {
      const newOnlineState = !isOnline
      const result = await setDriverOnline(driverData.id, newOnlineState)
      
      if (result.success) {
        setIsOnline(newOnlineState)
        
        if (newOnlineState) {
          await startTracking()
          enqueueSnackbar('¡Estás en línea!', { variant: 'success' })
        } else {
          await stopTracking()
          enqueueSnackbar('Saliste del sistema', { variant: 'info' })
        }
      } else {
        enqueueSnackbar('Error al cambiar estado', { variant: 'error' })
      }
    } catch (error) {
      console.error('Error:', error)
      enqueueSnackbar('Error al cambiar estado', { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // Forzar obtención de ubicación
  const handleForceGetLocation = async () => {
    setGettingLocation(true)
    await forceGetLocation()
    setGettingLocation(false)
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
      enqueueSnackbar(result.error || 'Error al aceptar', { variant: 'error' })
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
      enqueueSnackbar('Error al iniciar', { variant: 'error' })
    }
  }

  // Completar entrega
  const handleCompleteService = async (service) => {
    setLoading(true)
    const earnings = calculateDriverEarnings(service, appSettings.commissionRate)
    const result = await completeService(service.id, earnings)
    setLoading(false)
    
    if (result.success) {
      enqueueSnackbar(`¡Completado! Ganaste ${formatCurrency(earnings)}`, { variant: 'success' })
      setConfirmDialog({ open: false, type: '', service: null })
    } else {
      enqueueSnackbar('Error al completar', { variant: 'error' })
    }
  }

  // Estado del servicio
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

  // Determinar estado del GPS
  const getGpsState = () => {
    if (permissionStatus?.granted === false) {
      return { status: 'denied', label: 'Permiso denegado', color: 'error' }
    }
    if (currentLocation) {
      return { status: 'active', label: 'GPS Activo', color: 'success' }
    }
    if (isTracking) {
      return { status: 'searching', label: 'Buscando señal...', color: 'warning' }
    }
    return { status: 'inactive', label: 'GPS Inactivo', color: 'default' }
  }

  const gpsState = getGpsState()

  // Año actual dinámico
  const currentYear = new Date().getFullYear()

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {loading && <LinearProgress />}
      
      {/* Profile Card */}
      <Card sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ width: 56, height: 56, bgcolor: 'success.main', fontSize: '1.5rem', fontWeight: 'bold', borderRadius: 2 }}>
              {user?.name?.charAt(0) || 'R'}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" fontWeight="bold">
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
            <Chip label={isOnline ? 'En línea' : 'Fuera de línea'} color={isOnline ? 'success' : 'default'} size="small" />
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
          py: 3,
          borderRadius: 2,
          bgcolor: isOnline ? 'success.main' : 'grey.700',
          fontSize: '1rem',
          '&:hover': { bgcolor: isOnline ? 'success.dark' : 'grey.600' }
        }}
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PowerIcon sx={{ animation: isOnline ? 'pulse 1s infinite' : 'none' }} />}
      >
        {loading ? 'PROCESANDO...' : isOnline ? 'ESTÁS EN LÍNEA' : 'PONERSE EN LÍNEA'}
      </Button>

      {/* GPS Status Card */}
      {isOnline && (
        <>
          {/* Alerta si permiso denegado */}
          {permissionStatus?.granted === false && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold">Permiso de ubicación denegado</Typography>
              <Typography variant="body2">
                1. Haz clic en el candado/info en la barra de direcciones<br/>
                2. Permite el acceso a tu ubicación<br/>
                3. Recarga la página
              </Typography>
            </Alert>
          )}
          
          <Card 
            sx={{ 
              borderRadius: 2,
              bgcolor: alpha(theme.palette[gpsState.color]?.main || theme.palette.grey[500], 0.1),
              border: 1,
              borderColor: `${gpsState.color}.main`
            }}
          >
            <CardContent sx={{ py: 2, px: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1.5} alignItems="center">
                  {gpsState.status === 'active' ? (
                    <GpsIcon color="success" sx={{ animation: 'pulse 1.5s infinite', fontSize: 28 }} />
                  ) : gpsState.status === 'searching' ? (
                    <CircularProgress size={28} color="warning" />
                  ) : gpsState.status === 'denied' ? (
                    <GpsOffIcon color="error" sx={{ fontSize: 28 }} />
                  ) : (
                    <GpsOffIcon color="disabled" sx={{ fontSize: 28 }} />
                  )}
                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold" color={`${gpsState.color}.main`}>
                      {gpsState.label}
                    </Typography>
                    {currentLocation && (
                      <Typography variant="caption" color="text.secondary">
                        {currentLocation.speed > 0 && `${(currentLocation.speed * 3.6).toFixed(0)} km/h`}
                        {currentLocation.accuracy && ` • Precisión: ${currentLocation.accuracy.toFixed(0)}m`}
                      </Typography>
                    )}
                    {!currentLocation && gpsState.status === 'searching' && (
                      <Typography variant="caption" color="text.secondary">
                        El GPS puede tardar unos segundos...
                      </Typography>
                    )}
                  </Box>
                </Stack>
                
                <Stack direction="row" spacing={0.5}>
                  <Tooltip title="Obtener ubicación ahora">
                    <span>
                      <IconButton 
                        size="small" 
                        onClick={handleForceGetLocation} 
                        color="primary"
                        disabled={gettingLocation}
                        sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}
                      >
                        {gettingLocation ? <CircularProgress size={20} color="primary" /> : <MyLocationIcon fontSize="small" />}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Ver detalles">
                    <IconButton size="small" onClick={() => setShowGpsDetails(!showGpsDetails)}>
                      {showGpsDetails ? <CollapseIcon fontSize="small" /> : <ExpandIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Ver mapa">
                    <IconButton size="small" onClick={() => setShowMap(!showMap)} color="primary">
                      <MapIcon fontSize="small" />
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
                      <Typography variant="caption" color="text.secondary">Precisión</Typography>
                      <Typography variant="body2">
                        {currentLocation?.accuracy ? `${currentLocation.accuracy.toFixed(0)}m` : '--'}
                      </Typography>
                    </Grid>
                  </Grid>
                  
                  {!currentLocation && (
                    <Paper sx={{ p: 2, mt: 2, bgcolor: alpha(theme.palette.info.main, 0.1), borderRadius: 2 }}>
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        <InfoIcon color="info" fontSize="small" />
                        <Box>
                          <Typography variant="caption" fontWeight="bold" color="info.main">
                            Si el GPS no funciona:
                          </Typography>
                          <Typography variant="caption" display="block" color="text.secondary">
                            • Sal al exterior o cerca de una ventana
                          </Typography>
                          <Typography variant="caption" display="block" color="text.secondary">
                            • Verifica que el GPS del dispositivo esté activado
                          </Typography>
                          <Typography variant="caption" display="block" color="text.secondary">
                            • Usa el botón de actualizar ubicación
                          </Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  )}
                </Box>
              </Collapse>
            </CardContent>
          </Card>
        </>
      )}

      {/* Live Map */}
      {showMap && isOnline && (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent sx={{ p: 0 }}>
            <LiveMap
              driverLocation={currentLocation}
              height={isMobile ? 250 : 300}
              interactive={true}
              showRoute={false}
              showDriver={!!currentLocation}
            />
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <Grid container spacing={{ xs: 1, sm: 2 }}>
        <Grid item xs={4}>
          <Card sx={{ textAlign: 'center', borderRadius: 2, height: '100%' }}>
            <CardContent sx={{ py: 2 }}>
              <MoneyIcon sx={{ color: 'success.main', mb: 0.5 }} />
              <Typography variant="h6" fontWeight="bold">
                {formatCurrency(stats?.totalEarnings || 0)}
              </Typography>
              <Typography variant="caption" color="text.secondary">Total Ganado</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4}>
          <Card sx={{ textAlign: 'center', borderRadius: 2, height: '100%' }}>
            <CardContent sx={{ py: 2 }}>
              <BikeIcon sx={{ color: 'info.main', mb: 0.5 }} />
              <Typography variant="h6" fontWeight="bold">{stats?.totalServices || 0}</Typography>
              <Typography variant="caption" color="text.secondary">Servicios</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4}>
          <Card sx={{ textAlign: 'center', borderRadius: 2, height: '100%' }}>
            <CardContent sx={{ py: 2 }}>
              <StarIcon sx={{ color: 'warning.main', mb: 0.5 }} />
              <Typography variant="h6" fontWeight="bold">{driverData?.rating?.toFixed(1) || '5.0'}</Typography>
              <Typography variant="caption" color="text.secondary">Rating</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Current Active Service */}
      {currentService && (
        <Card sx={{ borderRadius: 2, border: 2, borderColor: 'primary.main' }}>
          <CardHeader
            avatar={<BikeIcon color="primary" />}
            title={<Typography variant="subtitle1" fontWeight="bold" color="primary">SERVICIO ACTIVO</Typography>}
            subheader={`ID: ${currentService.serviceId}`}
            action={<Chip label={getStatusConfig(currentService.status).label} color={getStatusConfig(currentService.status).color} size="small" />}
          />
          <CardContent sx={{ pt: 0 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                  <Typography variant="caption" color="text.secondary"><StoreIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />Recoger en:</Typography>
                  <Typography variant="subtitle2" fontWeight="bold">{currentService.restaurantName}</Typography>
                  <Typography variant="body2" color="text.secondary">{currentService.restaurantAddress}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.info.main, 0.1) }}>
                  <Typography variant="caption" color="text.secondary"><LocationIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />Entregar en:</Typography>
                  <Typography variant="subtitle2" fontWeight="bold">{currentService.zoneName}</Typography>
                  <Typography variant="body2" color="text.secondary">{currentService.deliveryAddress}</Typography>
                </Paper>
              </Grid>
            </Grid>

            {/* Ganancias */}
            <Card sx={{ mt: 2, bgcolor: 'success.main', borderRadius: 2 }}>
              <CardContent sx={{ py: 2 }}>
                <Typography variant="body2" sx={{ color: 'success.light', mb: 1, textAlign: 'center' }}>Tu ganancia</Typography>
                <Typography variant="h4" fontWeight="bold" color="white" textAlign="center">
                  {formatCurrency(calculateDriverEarnings(currentService, appSettings.commissionRate))}
                </Typography>
              </CardContent>
            </Card>

            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              {currentService.status === 'asignado' && (
                <Button fullWidth variant="contained" color="primary" size="large" startIcon={<NavigationIcon />} onClick={() => handleStartDelivery(currentService)} disabled={loading}>
                  INICIAR VIAJE
                </Button>
              )}
              {currentService.status === 'en_camino' && (
                <Button fullWidth variant="contained" color="success" size="large" startIcon={<CheckIcon />} onClick={() => setConfirmDialog({ open: true, type: 'complete', service: currentService })} disabled={loading}>
                  COMPLETAR ENTREGA
                </Button>
              )}
              <Tooltip title="Abrir en Maps">
                <IconButton
                  onClick={() => {
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

      {/* Pending Services */}
      {isOnline && !currentService && pendingServices.length > 0 && (
        <Box>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>Servicios Disponibles ({pendingServices.length})</Typography>
          <Stack spacing={2}>
            {pendingServices.slice(0, 3).map((service) => {
              const earnings = calculateDriverEarnings(service, appSettings.commissionRate)
              return (
                <Card key={service.id} sx={{ borderRadius: 2, border: 2, borderColor: 'warning.main', cursor: 'pointer', '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.15)' } }} onClick={() => setSelectedService(service)}>
                  <CardContent sx={{ p: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="subtitle2" fontWeight="bold">{service.serviceId}</Typography>
                      <Chip label={`Ganancia: ${formatCurrency(earnings)}`} color="success" size="small" />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" noWrap><StoreIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />{service.restaurantName}</Typography>
                    <Typography variant="body2" color="text.secondary" noWrap><LocationIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />{service.zoneName} - {service.deliveryAddress}</Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                      <Button fullWidth variant="contained" color="success" size="small" startIcon={<CheckIcon />} onClick={(e) => { e.stopPropagation(); handleAcceptService(service) }} disabled={loading}>ACEPTAR</Button>
                      <Button fullWidth variant="outlined" size="small" onClick={(e) => { e.stopPropagation(); setPendingServices(prev => prev.filter(s => s.id !== service.id)) }}>Ignorar</Button>
                    </Stack>
                  </CardContent>
                </Card>
              )
            })}
          </Stack>
        </Box>
      )}

      {/* Today's Stats */}
      <Card sx={{ borderRadius: 2 }}>
        <CardHeader
          avatar={<MoneyIcon color="success" />}
          title={<Typography variant="subtitle1" fontWeight="bold" color="success.main">Ganancias de Hoy</Typography>}
          action={<IconButton onClick={loadStats} size="small"><RefreshIcon /></IconButton>}
        />
        <CardContent>
          <Typography variant="h4" fontWeight="bold" color="success.main">{formatCurrency(stats?.earningsToday || 0)}</Typography>
          <Stack direction="row" justifyContent="space-between" sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Box><Typography variant="caption" color="text.secondary">Servicios hoy</Typography><Typography variant="body2" fontWeight="bold">{stats?.completedToday || 0}</Typography></Box>
            <Box><Typography variant="caption" color="text.secondary">Esta semana</Typography><Typography variant="body2" fontWeight="bold">{formatCurrency(stats?.weeklyEarnings || 0)}</Typography></Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ open: false, type: '', service: null })} maxWidth="sm" fullWidth>
        <DialogTitle>¿Completar entrega?</DialogTitle>
        <DialogContent>
          {confirmDialog.service && (
            <Card sx={{ p: 2, mt: 2, bgcolor: 'success.light' }}>
              <Typography variant="body2">Ganancia: <strong>{formatCurrency(calculateDriverEarnings(confirmDialog.service, appSettings.commissionRate))}</strong></Typography>
            </Card>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setConfirmDialog({ open: false, type: '', service: null })} fullWidth>Cancelar</Button>
          <Button variant="contained" color="success" onClick={() => handleCompleteService(confirmDialog.service)} disabled={loading} fullWidth>Confirmar</Button>
        </DialogActions>
      </Dialog>

      {/* Service Detail Dialog */}
      <Dialog open={!!selectedService} onClose={() => setSelectedService(null)} maxWidth="sm" fullWidth>
        {selectedService && (
          <>
            <DialogTitle>Detalle del Servicio <Chip label={selectedService.serviceId} size="small" sx={{ ml: 1 }} /></DialogTitle>
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
              </Grid>
              <Card sx={{ p: 2, mt: 2, bgcolor: 'success.main', textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: 'success.light' }}>Tu ganancia</Typography>
                <Typography variant="h4" fontWeight="bold" color="white">{formatCurrency(calculateDriverEarnings(selectedService, appSettings.commissionRate))}</Typography>
              </Card>
            </DialogContent>
            <DialogActions sx={{ p: 2, gap: 1 }}>
              <Button onClick={() => setSelectedService(null)} fullWidth>Cancelar</Button>
              <Button variant="contained" color="success" onClick={() => handleAcceptService(selectedService)} disabled={loading} fullWidth>Aceptar Servicio</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Chat FAB */}
      {currentService && <ChatButton service={currentService} currentUser={{ id: driverData?.id, name: driverData?.name || user?.name, role: 'driver' }} otherParty={{ name: currentService.restaurantName, role: 'restaurant' }} variant="fab" />}

      {/* Footer Info */}
      <Box sx={{ mt: 3, py: 3, textAlign: 'center' }}>
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