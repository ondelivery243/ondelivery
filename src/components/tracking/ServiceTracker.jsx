// src/components/tracking/ServiceTracker.jsx
import { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Stack,
  Paper,
  LinearProgress,
  Button,
  useTheme,
  alpha,
  Skeleton
} from '@mui/material'
import {
  Store as StoreIcon,
  LocationOn as LocationIcon,
  TwoWheeler as BikeIcon,
  AccessTime as ClockIcon,
  CheckCircle as CheckIcon,
  Navigation as NavigationIcon,
  Phone as PhoneIcon,
  Message as MessageIcon
} from '@mui/icons-material'
import { formatDistanceToNow, format } from 'date-fns'
import { es } from 'date-fns/locale'
import LiveMap from './LiveMap'
import { subscribeToDriverLocation, calculateETA } from '../../services/locationService'

/**
 * Componente para rastrear un servicio en tiempo real
 * @param {Object} service - Datos del servicio
 * @param {string} service.id - ID del servicio
 * @param {string} service.serviceId - Código del servicio
 * @param {string} service.status - Estado actual
 * @param {string} service.driverId - ID del repartidor
 * @param {string} service.driverName - Nombre del repartidor
 * @param {string} service.restaurantAddress - Dirección del restaurante
 * @param {string} service.deliveryAddress - Dirección de entrega
 * @param {string} service.zoneName - Zona de entrega
 * @param {Object} service.restaurantLocation - {latitude, longitude}
 * @param {Object} service.deliveryLocation - {latitude, longitude}
 * @param {Object} service.driverPhone - Teléfono del repartidor
 * @param {Function} onContactDriver - Callback para contactar al repartidor
 * @param {Function} onChatDriver - Callback para abrir chat
 */
const ServiceTracker = ({
  service,
  onContactDriver,
  onChatDriver,
  showMap = true,
  compact = false
}) => {
  const theme = useTheme()
  const [driverLocation, setDriverLocation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [eta, setEta] = useState(null)

  // Suscribirse a la ubicación del repartidor
  useEffect(() => {
    if (!service?.driverId || service.status === 'entregado') {
      setLoading(false)
      return
    }

    setLoading(true)
    const unsubscribe = subscribeToDriverLocation(service.driverId, (location) => {
      setDriverLocation(location)
      setLoading(false)
      
      // Calcular ETA si hay destino
      if (location && service.deliveryLocation) {
        const etaResult = calculateETA(location, service.deliveryLocation)
        setEta(etaResult)
      }
    })

    return () => unsubscribe()
  }, [service?.driverId, service?.status, service?.deliveryLocation])

  // Configuración de estados
  const statusConfig = {
    pendiente: {
      label: 'Buscando repartidor',
      color: 'warning',
      icon: <ClockIcon />,
      progress: 10,
      description: 'Tu pedido está esperando ser asignado a un repartidor'
    },
    asignado: {
      label: 'Repartidor asignado',
      color: 'info',
      icon: <BikeIcon />,
      progress: 30,
      description: 'El repartidor va camino al restaurante'
    },
    en_camino: {
      label: 'En camino',
      color: 'primary',
      icon: <NavigationIcon />,
      progress: 60,
      description: 'El repartidor tiene tu pedido y va camino a la entrega'
    },
    entregado: {
      label: 'Entregado',
      color: 'success',
      icon: <CheckIcon />,
      progress: 100,
      description: 'Tu pedido ha sido entregado exitosamente'
    },
    cancelado: {
      label: 'Cancelado',
      color: 'error',
      icon: <ClockIcon />,
      progress: 0,
      description: 'El servicio fue cancelado'
    }
  }

  const currentStatus = statusConfig[service?.status] || statusConfig.pendiente

  // Timeline de progreso
  const timelineSteps = [
    { key: 'pendiente', label: 'Recibido', time: service?.createdAt },
    { key: 'asignado', label: 'Asignado', time: service?.acceptedAt },
    { key: 'en_camino', label: 'En camino', time: service?.startedAt },
    { key: 'entregado', label: 'Entregado', time: service?.completedAt }
  ]

  const currentStepIndex = timelineSteps.findIndex(s => s.key === service?.status)

  if (!service) {
    return (
      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card sx={{ borderRadius: 2, overflow: 'hidden' }}>
      {/* Header con estado */}
      <Box
        sx={{
          bgcolor: alpha(theme.palette[currentStatus.color]?.main || theme.palette.primary.main, 0.1),
          p: 2,
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              {currentStatus.icon}
              <Typography variant="subtitle1" fontWeight="bold">
                {currentStatus.label}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {currentStatus.description}
            </Typography>
          </Box>
          {eta && service.status === 'en_camino' && (
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary">
                Llegada estimada
              </Typography>
              <Typography variant="h6" fontWeight="bold" color="primary">
                {eta.time} min
              </Typography>
            </Box>
          )}
        </Stack>
        
        {/* Barra de progreso */}
        <LinearProgress
          variant="determinate"
          value={currentStatus.progress}
          sx={{
            mt: 2,
            height: 6,
            borderRadius: 3,
            bgcolor: alpha(theme.palette[currentStatus.color]?.main || theme.palette.primary.main, 0.2),
            '& .MuiLinearProgress-bar': {
              borderRadius: 3
            }
          }}
        />
      </Box>

      {/* Timeline */}
      {!compact && (
        <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
          <Stack direction="row" justifyContent="space-between">
            {timelineSteps.map((step, index) => {
              const isCompleted = index <= currentStepIndex
              const isCurrent = index === currentStepIndex
              
              return (
                <Box
                  key={step.key}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    flex: 1
                  }}
                >
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      bgcolor: isCompleted ? 'primary.main' : 'grey.300',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 0.5
                    }}
                  >
                    {isCompleted && (
                      <CheckIcon sx={{ fontSize: 14, color: 'white' }} />
                    )}
                  </Box>
                  <Typography
                    variant="caption"
                    color={isCurrent ? 'primary' : 'text.secondary'}
                    fontWeight={isCurrent ? 'bold' : 'normal'}
                  >
                    {step.label}
                  </Typography>
                  {step.time && (
                    <Typography variant="caption" color="text.disabled" fontSize="0.65rem">
                      {format(new Date(step.time.toDate?.() || step.time), 'HH:mm')}
                    </Typography>
                  )}
                </Box>
              )
            })}
          </Stack>
        </Box>
      )}

      {/* Mapa en vivo */}
      {showMap && driverLocation && service.status !== 'entregado' && (
        <Box sx={{ position: 'relative' }}>
          <LiveMap
            driverLocation={driverLocation}
            restaurantLocation={service.restaurantLocation}
            destinationLocation={service.deliveryLocation}
            height={compact ? 200 : 300}
            interactive={!compact}
            showDriver={true}
            showRoute={service.status === 'en_camino'}
          />
          
          {/* Overlay con info del conductor */}
          <Paper
            elevation={0}
            sx={{
              position: 'absolute',
              bottom: 10,
              left: 10,
              right: 10,
              p: 1.5,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.background.paper, 0.95),
              backdropFilter: 'blur(4px)'
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={1} alignItems="center">
                <BikeIcon color="primary" />
                <Box>
                  <Typography variant="subtitle2" fontWeight="bold">
                    {service.driverName}
                  </Typography>
                  {driverLocation.speed > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      {(driverLocation.speed * 3.6).toFixed(0)} km/h
                    </Typography>
                  )}
                </Box>
              </Stack>
              
              <Stack direction="row" spacing={1}>
                {service.driverPhone && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<PhoneIcon />}
                    onClick={() => onContactDriver?.(service.driverPhone)}
                  >
                    Llamar
                  </Button>
                )}
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<MessageIcon />}
                  onClick={() => onChatDriver?.(service.driverId)}
                >
                  Chat
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Box>
      )}

      {/* Info del servicio */}
      <CardContent>
        <Stack spacing={2}>
          {/* Direcciones */}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                <Typography variant="caption" color="text.secondary">
                  <StoreIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                  Recoger en
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {service.restaurantName || 'Restaurante'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {service.restaurantAddress}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.error.main, 0.05) }}>
                <Typography variant="caption" color="text.secondary">
                  <LocationIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                  Entregar en
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {service.zoneName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {service.deliveryAddress}
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Cliente y método de pago */}
          {(service.clientName || service.paymentMethod) && (
            <Stack direction="row" spacing={2}>
              {service.clientName && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Cliente</Typography>
                  <Typography variant="body2">{service.clientName}</Typography>
                </Box>
              )}
              {service.paymentMethod && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Pago</Typography>
                  <Typography variant="body2">
                    {service.paymentMethod === 'efectivo' ? 'Efectivo' : 
                     service.paymentMethod === 'transferencia' ? 'Transferencia' : 'Pagado'}
                  </Typography>
                </Box>
              )}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}

// Importar Grid para el componente
import { Grid } from '@mui/material'

export default ServiceTracker
