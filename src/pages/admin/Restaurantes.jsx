// src/pages/admin/Restaurantes.jsx
import { useState, useEffect, useMemo } from 'react'
import { alpha } from '@mui/material/styles'
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
  Alert
} from '@mui/material'
import {
  Search as SearchIcon,
  Store as StoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  HourglassEmpty as PendingIcon
} from '@mui/icons-material'
import { useSnackbar } from 'notistack'
import { 
  subscribeToRestaurants, 
  updateRestaurant,
  toggleRestaurantActive,
  deleteRestaurant
} from '../../services/firestore'
import { RIDERY_COLORS } from '../../theme/theme'

export default function AdminRestaurantes() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { enqueueSnackbar } = useSnackbar()
  const currentYear = new Date().getFullYear()
  
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  
  const [editDialog, setEditDialog] = useState({ open: false, restaurant: null })
  const [deleteDialog, setDeleteDialog] = useState({ open: false, restaurant: null })
  const [anchorEl, setAnchorEl] = useState(null)
  const [selectedRestaurant, setSelectedRestaurant] = useState(null)
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    contactName: '',
    active: true
  })

  // ============================================
  // SUSCRIPCIÓN EN TIEMPO REAL
  // ============================================
  useEffect(() => {
    setLoading(true)
    const unsubscribe = subscribeToRestaurants((data) => {
      setRestaurants(data)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  // ============================================
  // ESTADÍSTICAS CALCULADAS (OPTIMIZADO)
  // ============================================
  const stats = useMemo(() => ({
    total: restaurants.length,
    active: restaurants.filter(r => r.active).length,
    pending: restaurants.filter(r => !r.active).length,
    withServices: restaurants.filter(r => r.totalServices > 0).length
  }), [restaurants])

  // ============================================
  // FILTRADO (OPTIMIZADO)
  // ============================================
  const filteredRestaurants = useMemo(() => {
    if (!searchTerm) return restaurants
    
    const term = searchTerm.toLowerCase()
    return restaurants.filter(restaurant => 
      restaurant.name?.toLowerCase().includes(term) ||
      restaurant.email?.toLowerCase().includes(term) ||
      restaurant.phone?.includes(searchTerm)
    )
  }, [restaurants, searchTerm])

  // ============================================
  // PAGINACIÓN
  // ============================================
  const paginatedRestaurants = useMemo(() => {
    return filteredRestaurants.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    )
  }, [filteredRestaurants, page, rowsPerPage])

  // ============================================
  // HANDLERS
  // ============================================
  
  // Abrir diálogo de edición
  const handleOpenEdit = (restaurant) => {
    setFormData({
      name: restaurant.name || '',
      phone: restaurant.phone || '',
      address: restaurant.address || '',
      contactName: restaurant.contactName || '',
      active: restaurant.active ?? false
    })
    setEditDialog({ open: true, restaurant })
    setAnchorEl(null)
  }

  // Guardar cambios
  const handleSave = async () => {
    if (!formData.name) {
      enqueueSnackbar('El nombre es requerido', { variant: 'warning' })
      return
    }
    
    const result = await updateRestaurant(editDialog.restaurant.id, formData)
    if (result.success) {
      enqueueSnackbar('Restaurante actualizado', { variant: 'success' })
      setEditDialog({ open: false, restaurant: null })
    } else {
      enqueueSnackbar(result.error || 'Error al guardar', { variant: 'error' })
    }
  }

  // Toggle activo/inactivo (activar cuenta)
  const handleToggleActive = async (restaurant) => {
    if (!restaurant.userId) {
      enqueueSnackbar('Este restaurante no tiene usuario vinculado', { variant: 'error' })
      return
    }
    
    const result = await toggleRestaurantActive(restaurant.id, restaurant.userId, !restaurant.active)
    if (result.success) {
      enqueueSnackbar(
        restaurant.active ? 'Restaurante desactivado' : '¡Restaurante activado! Ya puede iniciar sesión.',
        { variant: 'success' }
      )
    } else {
      enqueueSnackbar('Error al actualizar: ' + result.error, { variant: 'error' })
    }
  }

  // Eliminar restaurante
  const handleDelete = async () => {
    if (!deleteDialog.restaurant) return
    
    const result = await deleteRestaurant(deleteDialog.restaurant.id)
    if (result.success) {
      enqueueSnackbar('Restaurante eliminado', { variant: 'success' })
      setDeleteDialog({ open: false, restaurant: null })
    } else {
      enqueueSnackbar('Error al eliminar', { variant: 'error' })
    }
  }

  // Menú de acciones
  const handleMenuOpen = (event, restaurant) => {
    setAnchorEl(event.currentTarget)
    setSelectedRestaurant(restaurant)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
    setSelectedRestaurant(null)
  }

  // Resetear página cuando cambia el filtro
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value)
    setPage(0)
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
            Restaurantes
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Los restaurantes se registran ellos mismos. Activa su cuenta para que puedan operar.
          </Typography>
        </Box>
      </Stack>

      {/* Stats Cards */}
      <Grid container spacing={2}>
        <Grid item xs={4} sm={3}>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" fontWeight="bold" color="primary">
                {stats.total}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4} sm={3}>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" fontWeight="bold" color="success.main">
                {stats.active}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Activos
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4} sm={3}>
          <Card sx={{ borderRadius: 2, bgcolor: 'warning.light' }}>
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" fontWeight="bold" color="warning.dark">
                {stats.pending}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Pendientes
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" fontWeight="bold">
                {stats.withServices}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Con servicios
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Alert para pendientes */}
      {stats.pending > 0 && (
        <Alert severity="warning" icon={<PendingIcon />}>
          Hay <strong>{stats.pending} restaurante(s)</strong> pendientes de activación. 
          Revisa sus datos y actívalos para que puedan iniciar sesión.
        </Alert>
      )}

      {/* Search */}
      <TextField
        fullWidth
        size="small"
        placeholder="Buscar por nombre, email o teléfono..."
        value={searchTerm}
        onChange={handleSearchChange}
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
                <TableCell>Restaurante</TableCell>
                <TableCell>Teléfono</TableCell>
                {!isMobile && <TableCell>Dirección</TableCell>}
                <TableCell>Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      Cargando...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : paginatedRestaurants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <StoreIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      No hay restaurantes registrados
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Los restaurantes se registran desde la página de registro
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRestaurants.map((restaurant) => (
                  <TableRow 
                    key={restaurant.id} 
                    hover
                    sx={{ 
                      bgcolor: !restaurant.active ? alpha(theme.palette.warning.main, 0.05) : 'inherit'
                    }}
                  >
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar
                          sx={{
                            bgcolor: restaurant.active ? 'primary.main' : 'warning.main',
                            width: 40,
                            height: 40
                          }}
                        >
                          {restaurant.name?.charAt(0)?.toUpperCase() || 'R'}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {restaurant.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {restaurant.email}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {restaurant.phone || '-'}
                      </Typography>
                    </TableCell>
                    {!isMobile && (
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                          {restaurant.address || '-'}
                        </Typography>
                      </TableCell>
                    )}
                    <TableCell>
                      <Chip
                        icon={restaurant.active ? <CheckIcon /> : <PendingIcon />}
                        label={restaurant.active ? 'Activo' : 'Pendiente'}
                        color={restaurant.active ? 'success' : 'warning'}
                        size="small"
                        variant="outlined"
                        onClick={() => handleToggleActive(restaurant)}
                        clickable
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, restaurant)}
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
          count={filteredRestaurants.length}
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
        <MenuItem onClick={() => handleOpenEdit(selectedRestaurant)}>
          <EditIcon sx={{ mr: 1, fontSize: 20 }} />
          Editar
        </MenuItem>
        <MenuItem onClick={() => { handleToggleActive(selectedRestaurant); handleMenuClose(); }}>
          {selectedRestaurant?.active ? (
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
            setDeleteDialog({ open: true, restaurant: selectedRestaurant })
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
        onClose={() => setEditDialog({ open: false, restaurant: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Editar Restaurante
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              required
              label="Nombre del Restaurante"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
            <TextField
              fullWidth
              label="Teléfono"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            />
            <TextField
              fullWidth
              label="Nombre del Contacto"
              value={formData.contactName}
              onChange={(e) => setFormData(prev => ({ ...prev, contactName: e.target.value }))}
            />
            <TextField
              fullWidth
              label="Dirección"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              multiline
              rows={2}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.active}
                  onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                  color="success"
                />
              }
              label={<Typography variant="body2"><strong>{formData.active ? "Activo" : "Inactivo"}</strong> - {formData.active ? "Puede iniciar sesión y crear servicios" : "No puede iniciar sesión"}</Typography>}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setEditDialog({ open: false, restaurant: null })}>
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
        onClose={() => setDeleteDialog({ open: false, restaurant: null })}
      >
        <DialogTitle>Confirmar Eliminación</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Estás seguro de eliminar el restaurante <strong>{deleteDialog.restaurant?.name}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Esta acción no se puede deshacer. El usuario ya no podrá iniciar sesión.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setDeleteDialog({ open: false, restaurant: null })}>
            Cancelar
          </Button>
          <Button variant="contained" color="error" onClick={handleDelete}>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Footer Info */}
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