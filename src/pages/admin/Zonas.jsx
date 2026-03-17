// src/pages/admin/Zonas.jsx
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  useTheme,
  useMediaQuery,
  Paper,
  IconButton,
  InputAdornment,
  alpha
} from '@mui/material'
import {
  Add as AddIcon,
  LocationOn as LocationIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon
} from '@mui/icons-material'
import { useSnackbar } from 'notistack'
import { formatCurrency } from '../../store/useStore'
import { 
  subscribeToZones, 
  addZone, 
  updateZone,
  deleteZone
} from '../../services/firestore'

export default function AdminZonas() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { enqueueSnackbar } = useSnackbar()
  
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  const [editDialog, setEditDialog] = useState({ open: false, zone: null })
  const [deleteDialog, setDeleteDialog] = useState({ open: false, zone: null })
  
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    active: true
  })

  // Cargar datos
  useEffect(() => {
    setLoading(true)
    const unsubscribe = subscribeToZones((data) => {
      setZones(data)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  // Filtrar zonas
  const filteredZones = zones.filter(zone => 
    zone.name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Calcular tarifas min/max de forma segura
  const activeZones = zones.filter(z => z.active && z.price)
  const minPrice = activeZones.length > 0 
    ? Math.min(...activeZones.map(z => z.price)) 
    : 0
  const maxPrice = activeZones.length > 0 
    ? Math.max(...activeZones.map(z => z.price)) 
    : 0

  // Abrir diálogo de edición
  const handleOpenEdit = (zone = null) => {
    if (zone) {
      setFormData({
        name: zone.name || '',
        price: zone.price?.toString() || '',
        active: zone.active ?? true
      })
      setEditDialog({ open: true, zone })
    } else {
      setFormData({ name: '', price: '', active: true })
      setEditDialog({ open: true, zone: null })
    }
  }

  // Guardar zona
  const handleSave = async () => {
    if (!formData.name || !formData.price) {
      enqueueSnackbar('Nombre y precio son requeridos', { variant: 'warning' })
      return
    }
    
    const price = parseFloat(formData.price)
    if (isNaN(price) || price <= 0) {
      enqueueSnackbar('El precio debe ser un número mayor a 0', { variant: 'warning' })
      return
    }
    
    let result
    if (editDialog.zone) {
      result = await updateZone(editDialog.zone.id, { ...formData, price })
    } else {
      result = await addZone({ ...formData, price })
    }
    
    if (result.success) {
      enqueueSnackbar(
        editDialog.zone ? 'Zona actualizada' : 'Zona creada',
        { variant: 'success' }
      )
      setEditDialog({ open: false, zone: null })
    } else {
      enqueueSnackbar(result.error || 'Error al guardar', { variant: 'error' })
    }
  }

  // Toggle activo/inactivo
  const handleToggleActive = async (zone) => {
    const result = await updateZone(zone.id, { active: !zone.active })
    if (result.success) {
      enqueueSnackbar(
        zone.active ? 'Zona desactivada' : 'Zona activada',
        { variant: 'success' }
      )
    } else {
      enqueueSnackbar('Error al actualizar', { variant: 'error' })
    }
  }

  // Eliminar zona
  const handleDelete = async () => {
    if (!deleteDialog.zone) return
    
    const result = await deleteZone(deleteDialog.zone.id)
    if (result.success) {
      enqueueSnackbar('Zona eliminada', { variant: 'success' })
      setDeleteDialog({ open: false, zone: null })
    } else {
      enqueueSnackbar('Error al eliminar', { variant: 'error' })
    }
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
            Zonas de Entrega
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Configura las zonas y tarifas de delivery
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenEdit(null)}
        >
          Nueva Zona
        </Button>
      </Stack>

      {/* Stats */}
      <Grid container spacing={2}>
        <Grid item xs={6} sm={3}>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" fontWeight="bold" color="primary">
                {zones.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">Total Zonas</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" fontWeight="bold" color="success.main">
                {zones.filter(z => z.active).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">Activas</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" fontWeight="bold" color="primary">
                {formatCurrency(minPrice)}
              </Typography>
              <Typography variant="body2" color="text.secondary">Tarifa Mínima</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" fontWeight="bold" color="primary">
                {formatCurrency(maxPrice)}
              </Typography>
              <Typography variant="body2" color="text.secondary">Tarifa Máxima</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search */}
      <TextField
        fullWidth
        size="small"
        placeholder="Buscar zona..."
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

      {/* Zones Grid */}
      <Grid container spacing={2}>
        {filteredZones.map((zone) => (
          <Grid item xs={12} sm={6} md={4} key={zone.id}>
            <Card 
              sx={{ 
                borderRadius: 2,
                opacity: zone.active ? 1 : 0.6,
                transition: 'all 0.2s',
                '&:hover': {
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }
              }}
            >
              <CardContent sx={{ p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LocationIcon color={zone.active ? 'primary' : 'disabled'} />
                    <Typography variant="subtitle1" fontWeight="bold">
                      {zone.name}
                    </Typography>
                  </Box>
                  <Chip
                    label={zone.active ? 'Activa' : 'Inactiva'}
                    color={zone.active ? 'success' : 'default'}
                    size="small"
                    variant="outlined"
                  />
                </Stack>
                
                <Paper sx={{ p: 1.5, mt: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">Tarifa</Typography>
                  <Typography variant="h5" fontWeight="bold" color="primary">
                    {formatCurrency(zone.price)}
                  </Typography>
                </Paper>
                
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  <Button
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={() => handleOpenEdit(zone)}
                    fullWidth
                  >
                    Editar
                  </Button>
                  <Button
                    size="small"
                    color={zone.active ? 'warning' : 'success'}
                    onClick={() => handleToggleActive(zone)}
                  >
                    {zone.active ? 'Desactivar' : 'Activar'}
                  </Button>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => setDeleteDialog({ open: true, zone })}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {filteredZones.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <LocationIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            No se encontraron zonas
          </Typography>
        </Paper>
      )}

      {/* Edit Dialog */}
      <Dialog
        open={editDialog.open}
        onClose={() => setEditDialog({ open: false, zone: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editDialog.zone ? 'Editar Zona' : 'Nueva Zona'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              required
              label="Nombre de la Zona"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ej: Centro, La Trigaleña, etc."
            />
            <TextField
              fullWidth
              required
              label="Tarifa de Delivery"
              type="number"
              value={formData.price}
              onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>
              }}
              helperText="Precio en dólares"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.active}
                  onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                  color="success"
                />
              }
              label="Zona activa"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setEditDialog({ open: false, zone: null })}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleSave}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, zone: null })}
      >
        <DialogTitle>Eliminar Zona</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Estás seguro de eliminar la zona <strong>{deleteDialog.zone?.name}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setDeleteDialog({ open: false, zone: null })}>
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