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
  Avatar,
  Switch,
  FormControlLabel,
  useTheme,
  useMediaQuery,
  Menu,
  MenuItem,
  Paper,
  Divider
} from '@mui/material'
import {
  Search as SearchIcon,
  TwoWheeler as BikeIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Star as StarIcon,
  PowerSettingsNew as PowerIcon
} from '@mui/icons-material'
import { useSnackbar } from 'notistack'
import { formatCurrency, formatDate } from '../../store/useStore'
import { 
  subscribeToDrivers, 
  addDriver, 
  updateDriver,
  toggleDriverActive,
  deleteDriver,
  setDriverOnline
} from '../../services/firestore'

export default function AdminRepartidores() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { enqueueSnackbar } = useSnackbar()
  
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  
  const [editDialog, setEditDialog] = useState({ open: false, driver: null })
  const [deleteDialog, setDeleteDialog] = useState({ open: false, driver: null })
  const [anchorEl, setAnchorEl] = useState(null)
  const [selectedDriver, setSelectedDriver] = useState(null)
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    dni: '',
    vehicleType: 'motocicleta',
    vehicleBrand: '',
    vehicleModel: '',
    vehiclePlate: '',
    active: true
  })

  // Cargar datos
  useEffect(() => {
    setLoading(true)
    const unsubscribe = subscribeToDrivers((data) => {
      setDrivers(data)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  // Filtrar repartidores
  const filteredDrivers = drivers.filter(driver => {
    return !searchTerm || 
      driver.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.phone?.includes(searchTerm) ||
      driver.vehiclePlate?.toLowerCase().includes(searchTerm.toLowerCase())
  })

  // Paginación
  const paginatedDrivers = filteredDrivers.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  )

  // Abrir diálogo de edición
  const handleOpenEdit = (driver = null) => {
    if (driver) {
      setFormData({
        name: driver.name || '',
        email: driver.email || '',
        phone: driver.phone || '',
        dni: driver.dni || '',
        vehicleType: driver.vehicleType || 'motocicleta',
        vehicleBrand: driver.vehicleBrand || '',
        vehicleModel: driver.vehicleModel || '',
        vehiclePlate: driver.vehiclePlate || '',
        active: driver.active ?? true
      })
      setEditDialog({ open: true, driver })
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        dni: '',
        vehicleType: 'motocicleta',
        vehicleBrand: '',
        vehicleModel: '',
        vehiclePlate: '',
        active: true
      })
      setEditDialog({ open: true, driver: null })
    }
    setAnchorEl(null)
  }

  // Guardar repartidor
  const handleSave = async () => {
    if (!formData.name || !formData.phone) {
      enqueueSnackbar('Nombre y teléfono son requeridos', { variant: 'warning' })
      return
    }
    
    let result
    if (editDialog.driver) {
      result = await updateDriver(editDialog.driver.id, formData)
    } else {
      result = await addDriver(formData)
    }
    
    if (result.success) {
      enqueueSnackbar(
        editDialog.driver ? 'Repartidor actualizado' : 'Repartidor creado',
        { variant: 'success' }
      )
      setEditDialog({ open: false, driver: null })
    } else {
      enqueueSnackbar(result.error || 'Error al guardar', { variant: 'error' })
    }
  }

  // Toggle activo/inactivo
  const handleToggleActive = async (driver) => {
    if (!driver.userId) {
      enqueueSnackbar('Este repartidor no tiene usuario vinculado', { variant: 'error' })
      return
    }
    
    const result = await toggleDriverActive(driver.id, driver.userId, !driver.active)
    if (result.success) {
      enqueueSnackbar(
        driver.active ? 'Repartidor desactivado' : '¡Repartidor activado! Ya puede iniciar sesión.',
        { variant: 'success' }
      )
    } else {
      enqueueSnackbar('Error al actualizar: ' + result.error, { variant: 'error' })
    }
  }

  // Toggle online/offline
  const handleToggleOnline = async (driver) => {
    const result = await setDriverOnline(driver.id, !driver.isOnline)
    if (result.success) {
      enqueueSnackbar(
        driver.isOnline ? 'Repartidor puesto offline' : 'Repartidor puesto online',
        { variant: 'success' }
      )
    } else {
      enqueueSnackbar('Error al actualizar', { variant: 'error' })
    }
    setAnchorEl(null)
  }

  // Eliminar repartidor
  const handleDelete = async () => {
    if (!deleteDialog.driver) return
    
    const result = await deleteDriver(deleteDialog.driver.id)
    if (result.success) {
      enqueueSnackbar('Repartidor eliminado', { variant: 'success' })
      setDeleteDialog({ open: false, driver: null })
    } else {
      enqueueSnackbar('Error al eliminar', { variant: 'error' })
    }
  }

  // Menú de acciones
  const handleMenuOpen = (event, driver) => {
    setAnchorEl(event.currentTarget)
    setSelectedDriver(driver)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
    setSelectedDriver(null)
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
            Repartidores
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestiona el equipo de repartidores (se registran por sí mismos)
          </Typography>
        </Box>
      </Stack>

      {/* Stats Cards */}
      <Grid container spacing={2}>
        <Grid item xs={6} sm={3}>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" fontWeight="bold" color="primary">
                {drivers.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ borderRadius: 2, bgcolor: 'success.light' }}>
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" fontWeight="bold" color="success.dark">
                {drivers.filter(d => d.isOnline && d.active).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Online
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" fontWeight="bold" color="success.main">
                {drivers.filter(d => d.active).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Activos
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" fontWeight="bold" color="warning.main">
                {drivers.filter(d => d.totalServices > 0).reduce((sum, d) => sum + (d.totalServices || 0), 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Servicios totales
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search */}
      <TextField
        fullWidth
        size="small"
        placeholder="Buscar por nombre, teléfono o placa..."
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

      {/* Table */}
      <Card>
        <TableContainer>
          <Table size={isMobile ? 'small' : 'medium'}>
            <TableHead>
              <TableRow>
                <TableCell>Repartidor</TableCell>
                {!isMobile && <TableCell>Vehículo</TableCell>}
                <TableCell>Teléfono</TableCell>
                {!isMobile && <TableCell>Rating</TableCell>}
                <TableCell>Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedDrivers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <BikeIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      No se encontraron repartidores
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedDrivers.map((driver) => (
                  <TableRow key={driver.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar
                          sx={{
                            bgcolor: driver.isOnline 
                              ? 'success.main' 
                              : driver.active 
                                ? 'primary.main' 
                                : 'grey.400',
                            width: 40,
                            height: 40
                          }}
                        >
                          {driver.name?.charAt(0)?.toUpperCase() || 'R'}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {driver.name}
                          </Typography>
                          {!isMobile && (
                            <Typography variant="caption" color="text.secondary">
                              {driver.totalServices || 0} servicios
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    </TableCell>
                    {!isMobile && (
                      <TableCell>
                        <Box>
                          <Typography variant="body2">
                            {driver.vehicleType === 'motocicleta' ? '🏍️' : '🚗'} {driver.vehicleBrand} {driver.vehicleModel}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {driver.vehiclePlate || '-'}
                          </Typography>
                        </Box>
                      </TableCell>
                    )}
                    <TableCell>
                      <Typography variant="body2">
                        {driver.phone || '-'}
                      </Typography>
                    </TableCell>
                    {!isMobile && (
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <StarIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                          <Typography variant="body2" fontWeight="medium">
                            {driver.rating?.toFixed(1) || '5.0'}
                          </Typography>
                        </Stack>
                      </TableCell>
                    )}
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        <Chip
                          icon={driver.isOnline ? <PowerIcon /> : <CancelIcon />}
                          label={driver.isOnline ? 'Online' : 'Offline'}
                          color={driver.isOnline ? 'success' : 'default'}
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          icon={driver.active ? <CheckIcon /> : <CancelIcon />}
                          label={driver.active ? 'Activo' : 'Inactivo'}
                          color={driver.active ? 'primary' : 'default'}
                          size="small"
                          variant="outlined"
                          onClick={() => handleToggleActive(driver)}
                          clickable
                        />
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, driver)}
                      >
                        <MoreIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          component="div"
          count={filteredDrivers.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10))
            setPage(0)
          }}
          rowsPerPageOptions={[5, 10, 25]}
          labelRowsPerPage="Filas por página"
        />
      </Card>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleOpenEdit(selectedDriver)}>
          <EditIcon sx={{ mr: 1, fontSize: 20 }} />
          Editar
        </MenuItem>
        <MenuItem onClick={() => handleToggleOnline(selectedDriver)}>
          {selectedDriver?.isOnline ? (
            <>
              <CancelIcon sx={{ mr: 1, fontSize: 20 }} />
              Poner Offline
            </>
          ) : (
            <>
              <PowerIcon sx={{ mr: 1, fontSize: 20 }} />
              Poner Online
            </>
          )}
        </MenuItem>
        <MenuItem onClick={() => handleToggleActive(selectedDriver)}>
          {selectedDriver?.active ? (
            <>
              <CancelIcon sx={{ mr: 1, fontSize: 20 }} />
              Desactivar
            </>
          ) : (
            <>
              <CheckIcon sx={{ mr: 1, fontSize: 20 }} />
              Activar
            </>
          )}
        </MenuItem>
        <MenuItem 
          onClick={() => {
            setDeleteDialog({ open: true, driver: selectedDriver })
            handleMenuClose()
          }}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1, fontSize: 20 }} />
          Eliminar
        </MenuItem>
      </Menu>

      {/* Edit Dialog */}
      <Dialog
        open={editDialog.open}
        onClose={() => setEditDialog({ open: false, driver: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Editar Repartidor
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Datos Personales */}
            <TextField
              fullWidth
              required
              label="Nombre completo"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="Teléfono"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </Grid>
            </Grid>
            
            <TextField
              fullWidth
              label="Cédula / DNI"
              value={formData.dni}
              onChange={(e) => setFormData(prev => ({ ...prev, dni: e.target.value }))}
            />
            
            <Divider />
            
            {/* Información del Vehículo */}
            <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 'bold' }}>
              Información del Vehículo
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="Tipo de vehículo"
                  value={formData.vehicleType}
                  onChange={(e) => setFormData(prev => ({ ...prev, vehicleType: e.target.value }))}
                >
                  <MenuItem value="motocicleta">Motocicleta</MenuItem>
                  <MenuItem value="bicicleta">Bicicleta</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Marca"
                  value={formData.vehicleBrand}
                  onChange={(e) => setFormData(prev => ({ ...prev, vehicleBrand: e.target.value }))}
                />
              </Grid>
            </Grid>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Modelo"
                  value={formData.vehicleModel}
                  onChange={(e) => setFormData(prev => ({ ...prev, vehicleModel: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Placa"
                  value={formData.vehiclePlate}
                  onChange={(e) => setFormData(prev => ({ ...prev, vehiclePlate: e.target.value }))}
                  disabled={formData.vehicleType === 'bicicleta'}
                  helperText={formData.vehicleType === 'bicicleta' ? 'No aplica para bicicletas' : ''}
                />
              </Grid>
            </Grid>
            
            <Divider />
            
            {/* Estado */}
            <FormControlLabel
              control={
                <Switch
                  checked={formData.active}
                  onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                  color="success"
                />
              }
              label={<Typography variant="body2"><strong>{formData.active ? "Activo" : "Inactivo"}</strong> - {formData.active ? "Puede iniciar sesión y recibir servicios" : "No puede iniciar sesión"}</Typography>}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setEditDialog({ open: false, driver: null })}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleSave}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, driver: null })}
      >
        <DialogTitle>Confirmar Eliminación</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Estás seguro de eliminar al repartidor <strong>{deleteDialog.driver?.name}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setDeleteDialog({ open: false, driver: null })}>
            Cancelar
          </Button>
          <Button variant="contained" color="error" onClick={handleDelete}>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
