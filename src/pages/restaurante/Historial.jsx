// src/pages/restaurante/Historial.jsx
import { useState, useEffect } from 'react'
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
  IconButton,
  Tab,
  Tabs,
  useTheme,
  useMediaQuery,
  alpha,
  Collapse,
  LinearProgress
} from '@mui/material'
import {
  Search as SearchIcon,
  Inventory as PackageIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  AccessTime as ClockIcon,
  TwoWheeler as BikeIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  LocationOn as LocationIcon,
  AttachMoney as MoneyIcon
} from '@mui/icons-material'
import { formatCurrency, formatDate, formatTime, useRestaurantStore, useStore } from '../../store/useStore'
import { subscribeToRestaurantServices, getRestaurantByUserId, getRestaurant } from '../../services/firestore'
import { RIDERY_COLORS } from '../../theme/theme'

export default function RestauranteHistorial() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { restaurantData, setRestaurantData } = useRestaurantStore()
  const { user } = useStore()
  
  const [services, setServices] = useState([])
  const [filteredServices, setFilteredServices] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [expandedId, setExpandedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const currentYear = new Date().getFullYear()

  // Cargar datos del restaurante
  useEffect(() => {
    const loadRestaurant = async () => {
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
        const unsubscribe = subscribeToRestaurantServices(restaurant.id, (servicesData) => {
          setServices(servicesData)
          setLoading(false)
        })
        return () => unsubscribe()
      } else {
        setLoading(false)
      }
    }
    
    loadRestaurant()
  }, [restaurantData, setRestaurantData, user])

  // Filtrar servicios
  useEffect(() => {
    let filtered = [...services]
    
    if (statusFilter !== 'todos') {
      filtered = filtered.filter(s => s.status === statusFilter)
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(s =>
        s.serviceId?.toLowerCase().includes(term) ||
        s.zoneName?.toLowerCase().includes(term) ||
        s.deliveryAddress?.toLowerCase().includes(term) ||
        s.clientName?.toLowerCase().includes(term)
      )
    }
    
    setFilteredServices(filtered)
  }, [services, searchTerm, statusFilter])

  // Configuración de estados
  const getStatusConfig = (status) => {
    const configs = {
      pendiente: { color: 'warning', label: 'Pendiente', icon: <ClockIcon /> },
      asignado: { color: 'info', label: 'Asignado', icon: <BikeIcon /> },
      en_camino: { color: 'primary', label: 'En Camino', icon: <BikeIcon /> },
      entregado: { color: 'success', label: 'Entregado', icon: <CheckIcon /> },
      cancelado: { color: 'error', label: 'Cancelado', icon: <CancelIcon /> }
    }
    return configs[status] || configs.pendiente
  }

  // Calcular totales en tiempo real
  const totalPagado = services
    .filter(s => s.status === 'entregado')
    .reduce((sum, s) => sum + (s.deliveryFee || 0), 0)

  const totalServicios = services.filter(s => s.status === 'entregado').length

  // Tabs
  const tabs = [
    { value: 'todos', label: 'Todos', count: services.length },
    { value: 'entregado', label: 'Entregados', count: services.filter(s => s.status === 'entregado').length },
    { value: 'en_camino', label: 'En camino', count: services.filter(s => s.status === 'en_camino' || s.status === 'asignado').length },
    { value: 'cancelado', label: 'Cancelados', count: services.filter(s => s.status === 'cancelado').length }
  ]

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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Header */}
      <Box>
        <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold">
          Historial de Servicios
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Revisa todos tus servicios realizados
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Card sx={{ borderRadius: 2, bgcolor: 'warning.light' }}>
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <MoneyIcon sx={{ color: 'warning.dark', mb: 0.5 }} />
              <Typography variant="h5" fontWeight="bold" color="warning.dark">
                {formatCurrency(totalPagado)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Total Pagado
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6}>
          <Card sx={{ borderRadius: 2, bgcolor: 'success.light' }}>
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <PackageIcon sx={{ color: 'success.main', mb: 0.5 }} />
              <Typography variant="h5" fontWeight="bold" color="success.dark">
                {totalServicios}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Servicios Completados
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search */}
      <TextField
        fullWidth
        size="small"
        placeholder="Buscar por ID, zona, dirección..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon color="action" />
            </InputAdornment>
          ),
          endAdornment: searchTerm && (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setSearchTerm('')}>
                <CancelIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          )
        }}
      />

      {/* Tabs */}
      <Paper sx={{ borderRadius: 2 }}>
        <Tabs
          value={statusFilter}
          onChange={(e, v) => setStatusFilter(v)}
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

      {/* Services List */}
      <Stack spacing={1.5}>
        {filteredServices.length === 0 ? (
          <Card sx={{ borderRadius: 2, py: 4 }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <PackageIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body1" color="text.secondary">
                No se encontraron servicios
              </Typography>
            </CardContent>
          </Card>
        ) : (
          filteredServices.map((service) => {
            const statusConfig = getStatusConfig(service.status)
            const isExpanded = expandedId === service.id
            
            return (
              <Card
                key={service.id}
                sx={{ borderRadius: 2, cursor: 'pointer' }}
                onClick={() => setExpandedId(isExpanded ? null : service.id)}
              >
                <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {service.serviceId}
                      </Typography>
                      <Chip
                        icon={statusConfig.icon}
                        label={statusConfig.label}
                        size="small"
                        color={statusConfig.color}
                        variant="outlined"
                        sx={{ height: 22, fontSize: '0.7rem' }}
                      />
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" fontWeight="bold" color="warning.main">
                        {formatCurrency(service.deliveryFee)}
                      </Typography>
                      {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
                    </Stack>
                  </Stack>

                  <Grid container spacing={1}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        <LocationIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                        {service.zoneName} - {service.deliveryAddress}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        <BikeIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                        Repartidor: {service.driverName || 'Sin asignar'}
                      </Typography>
                    </Grid>
                  </Grid>

                  <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block' }}>
                    {formatDate(service.createdAt)} - {formatTime(service.createdAt)}
                  </Typography>

                  {/* Expanded Details */}
                  <Collapse in={isExpanded}>
                    <Paper
                      variant="outlined"
                      sx={{ p: 2, mt: 2, bgcolor: alpha(theme.palette.primary.main, 0.02) }}
                    >
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">Cliente</Typography>
                          <Typography variant="body2">{service.clientName || 'No especificado'}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">Teléfono</Typography>
                          <Typography variant="body2">{service.clientPhone || '-'}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">Método de pago</Typography>
                          <Typography variant="body2">
                            {service.paymentMethod === 'efectivo' ? 'Efectivo' : 
                             service.paymentMethod === 'transferencia' ? 'Transferencia' : 'Pagado'}
                          </Typography>
                        </Grid>
                        {service.paymentMethod === 'efectivo' && (
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">Monto cobrado</Typography>
                            <Typography variant="body2" fontWeight="bold">
                              {formatCurrency(service.amountToCollect || 0)}
                            </Typography>
                          </Grid>
                        )}
                        {service.notes && (
                          <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary">Notas</Typography>
                            <Typography variant="body2">{service.notes}</Typography>
                          </Grid>
                        )}
                      </Grid>
                    </Paper>
                  </Collapse>
                </CardContent>
              </Card>
            )
          })
        )}
      </Stack>

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