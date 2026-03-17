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
  Collapse
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
  Store as StoreIcon,
  AttachMoney as MoneyIcon
} from '@mui/icons-material'
import { formatCurrency, formatDate, formatTime } from '../../store/useStore'
import { subscribeToRestaurantServices } from '../../services/firestore'

export default function RestauranteHistorial() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  
  const [services, setServices] = useState([])
  const [filteredServices, setFilteredServices] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [expandedId, setExpandedId] = useState(null)

  // Cargar servicios
  useEffect(() => {
    const restaurantId = localStorage.getItem('restaurantId') || 'demo_restaurant'
    const unsubscribe = subscribeToRestaurantServices(restaurantId, (servicesData) => {
      setServices(servicesData)
    })
    return () => unsubscribe()
  }, [])

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

  // Calcular totales
  const totalGastado = filteredServices
    .filter(s => s.status === 'entregado')
    .reduce((sum, s) => sum + (s.deliveryFee || 0), 0)

  const totalServicios = filteredServices.filter(s => s.status === 'entregado').length

  // Tabs
  const tabs = [
    { value: 'todos', label: 'Todos', count: services.length },
    { value: 'entregado', label: 'Entregados', count: services.filter(s => s.status === 'entregado').length },
    { value: 'en_camino', label: 'En camino', count: services.filter(s => s.status === 'en_camino' || s.status === 'asignado').length },
    { value: 'cancelado', label: 'Cancelados', count: services.filter(s => s.status === 'cancelado').length }
  ]

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
          <Card sx={{ borderRadius: 2, bgcolor: 'primary.light' }}>
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <MoneyIcon sx={{ color: 'primary.main', mb: 0.5 }} />
              <Typography variant="h5" fontWeight="bold" color="primary.dark">
                {formatCurrency(totalGastado)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Total Gastado
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
                      <Typography variant="body2" fontWeight="bold" color="primary">
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
    </Box>
  )
}
