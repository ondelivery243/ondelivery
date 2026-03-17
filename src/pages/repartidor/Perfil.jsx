// src/pages/repartidor/Perfil.jsx
import { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Avatar,
  Chip,
  Stack,
  Paper,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  useTheme,
  useMediaQuery,
  alpha,
  IconButton,
  CircularProgress
} from '@mui/material'
import {
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  TwoWheeler as BikeIcon,
  Star as StarIcon,
  Edit as EditIcon,
  Camera as CameraIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Lock as LockIcon,
  DirectionsBike as BicycleIcon,
  Moped as MopedIcon
} from '@mui/icons-material'
import { useSnackbar } from 'notistack'
import { useStore, formatCurrency } from '../../store/useStore'
import { 
  getDriverByUserId, 
  updateDriver
} from '../../services/firestore'
import { updatePassword } from 'firebase/auth'
import { auth } from '../../config/firebase'
import { RatingWidget } from '../../components/rating'

export default function RepartidorPerfil() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { enqueueSnackbar } = useSnackbar()
  const { user } = useStore()
  
  const [driverData, setDriverData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editDialog, setEditDialog] = useState({ open: false, field: '', value: '' })
  const [passwordDialog, setPasswordDialog] = useState({ open: false, currentPassword: '', newPassword: '', confirmPassword: '' })

  // Cargar datos reales
  useEffect(() => {
    const loadData = async () => {
      if (!user?.uid) return
      
      setLoading(true)
      try {
        const driver = await getDriverByUserId(user.uid)
        setDriverData(driver)
      } catch (error) {
        console.error('Error cargando datos:', error)
        enqueueSnackbar('Error al cargar los datos', { variant: 'error' })
      }
      setLoading(false)
    }
    
    loadData()
  }, [user])

  // Guardar cambios
  const handleSaveField = async () => {
    if (!driverData?.id) {
      enqueueSnackbar('No se pueden guardar los cambios', { variant: 'error' })
      return
    }
    
    setSaving(true)
    
    const result = await updateDriver(driverData.id, { [editDialog.field]: editDialog.value })
    
    setSaving(false)
    
    if (result?.success) {
      setDriverData(prev => ({ ...prev, [editDialog.field]: editDialog.value }))
      enqueueSnackbar('Datos actualizados correctamente', { variant: 'success' })
      setEditDialog({ open: false, field: '', value: '' })
    } else {
      enqueueSnackbar(result?.error || 'Error al guardar', { variant: 'error' })
    }
  }

  // Cambiar contraseña
  const handleChangePassword = async () => {
    if (passwordDialog.newPassword !== passwordDialog.confirmPassword) {
      enqueueSnackbar('Las contraseñas no coinciden', { variant: 'error' })
      return
    }
    
    if (passwordDialog.newPassword.length < 6) {
      enqueueSnackbar('La contraseña debe tener al menos 6 caracteres', { variant: 'error' })
      return
    }
    
    setSaving(true)
    try {
      await updatePassword(auth.currentUser, passwordDialog.newPassword)
      enqueueSnackbar('Contraseña actualizada correctamente', { variant: 'success' })
      setPasswordDialog({ open: false, currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error) {
      console.error('Error changing password:', error)
      if (error.code === 'auth/requires-recent-login') {
        enqueueSnackbar('Por seguridad, vuelve a iniciar sesión antes de cambiar la contraseña', { variant: 'warning' })
      } else {
        enqueueSnackbar(error.message, { variant: 'error' })
      }
    }
    setSaving(false)
  }

  // Obtener icono del vehículo
  const getVehicleIcon = (type) => {
    if (type === 'bicicleta') return <BicycleIcon />
    return <MopedIcon />
  }

  // Obtener emoji del vehículo
  const getVehicleEmoji = (type) => {
    if (type === 'bicicleta') return '🚲'
    return '🏍️'
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Header */}
      <Box>
        <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold">
          Mi Perfil
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Administra tu información personal
        </Typography>
      </Box>

      {/* Profile Card */}
      <Card sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Box sx={{ position: 'relative' }}>
              <Avatar
                sx={{
                  width: { xs: 80, sm: 100 },
                  height: { xs: 80, sm: 100 },
                  bgcolor: 'success.main',
                  fontSize: { xs: '2rem', sm: '2.5rem' },
                  fontWeight: 'bold'
                }}
              >
                {driverData?.name?.charAt(0)?.toUpperCase() || user?.name?.charAt(0)?.toUpperCase() || 'R'}
              </Avatar>
              <IconButton
                size="small"
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  bgcolor: 'background.paper',
                  boxShadow: 1
                }}
              >
                <CameraIcon fontSize="small" />
              </IconButton>
            </Box>
            
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" fontWeight="bold">
                {driverData?.name || user?.name || 'Repartidor'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {driverData?.email || user?.email}
              </Typography>
            </Box>

            {/* Rating y stats */}
            <Stack direction="row" spacing={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <StarIcon sx={{ color: 'warning.main', fontSize: 20 }} />
                  <Typography variant="h6" fontWeight="bold">
                    {driverData?.rating?.toFixed(1) || '5.0'}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Calificación
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" fontWeight="bold" color="success.main">
                  {driverData?.totalServices || 0}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Servicios
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" fontWeight="bold" color="primary">
                  {formatCurrency(driverData?.totalEarnings || 0)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Ganancias
                </Typography>
              </Box>
            </Stack>

            {/* Status */}
            <Chip
              icon={driverData?.active ? <CheckIcon /> : <WarningIcon />}
              label={driverData?.active ? 'Cuenta Activa' : 'Cuenta Inactiva'}
              color={driverData?.active ? 'success' : 'warning'}
              variant="outlined"
            />
          </Box>
        </CardContent>
      </Card>

      {/* Rating Widget - Solo si tiene calificaciones */}
      {driverData?.id && driverData?.totalRatings > 0 && (
        <RatingWidget
          driverId={driverData.id}
          driverData={driverData}
          showReviews={true}
        />
      )}

      {/* Personal Info */}
      <Card sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
            Información Personal
          </Typography>

          <Stack spacing={2}>
            {/* Nombre */}
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderRadius: 2
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <PersonIcon color="action" />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Nombre completo
                  </Typography>
                  <Typography variant="body1">
                    {driverData?.name || user?.name || 'No especificado'}
                  </Typography>
                </Box>
              </Box>
              <IconButton
                size="small"
                onClick={() => setEditDialog({
                  open: true,
                  field: 'name',
                  value: driverData?.name || user?.name || ''
                })}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Paper>

            {/* Teléfono */}
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderRadius: 2
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <PhoneIcon color="action" />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Teléfono
                  </Typography>
                  <Typography variant="body1">
                    {driverData?.phone || user?.phone || 'No especificado'}
                  </Typography>
                </Box>
              </Box>
              <IconButton
                size="small"
                onClick={() => setEditDialog({
                  open: true,
                  field: 'phone',
                  value: driverData?.phone || user?.phone || ''
                })}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Paper>

            {/* DNI */}
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderRadius: 2
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <PersonIcon color="action" />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Cédula / DNI
                  </Typography>
                  <Typography variant="body1">
                    {driverData?.dni || 'No especificado'}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {/* Email (no editable directamente) */}
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderRadius: 2
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <EmailIcon color="action" />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Correo electrónico
                  </Typography>
                  <Typography variant="body1">
                    {driverData?.email || user?.email}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Stack>
        </CardContent>
      </Card>

      {/* Vehicle Info */}
      <Card sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
            <BikeIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Vehículo
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Tipo</Typography>
              <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {getVehicleEmoji(driverData?.vehicleType)} {driverData?.vehicleType === 'bicicleta' ? 'Bicicleta' : 'Motocicleta'}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Marca</Typography>
              <Typography variant="body1">{driverData?.vehicleBrand || 'No especificado'}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Modelo</Typography>
              <Typography variant="body1">{driverData?.vehicleModel || 'No especificado'}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Placa</Typography>
              <Typography variant="body1" fontWeight="bold">
                {driverData?.vehicleType === 'bicicleta' ? 'No aplica' : (driverData?.vehiclePlate || 'No especificado')}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Security */}
      <Card sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
            <LockIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Seguridad
          </Typography>

          <Button
            variant="outlined"
            fullWidth
            onClick={() => setPasswordDialog({ open: true, currentPassword: '', newPassword: '', confirmPassword: '' })}
            startIcon={<LockIcon />}
          >
            Cambiar Contraseña
          </Button>
        </CardContent>
      </Card>

      {/* App Info */}
      <Paper sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
        <Typography variant="caption" color="text.secondary" align="center" display="block">
          ON Delivery v1.0.0
        </Typography>
        <Typography variant="caption" color="text.disabled" align="center" display="block">
          © 2024 ON Delivery - Maracay, Venezuela
        </Typography>
      </Paper>

      {/* Edit Field Dialog */}
      <Dialog
        open={editDialog.open}
        onClose={() => setEditDialog({ open: false, field: '', value: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Editar {editDialog.field === 'name' ? 'Nombre' : 'Teléfono'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            value={editDialog.value}
            onChange={(e) => setEditDialog(prev => ({ ...prev, value: e.target.value }))}
            sx={{ mt: 1 }}
            label={editDialog.field === 'name' ? 'Nombre completo' : 'Teléfono'}
            type={editDialog.field === 'phone' ? 'tel' : 'text'}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setEditDialog({ open: false, field: '', value: '' })}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveField}
            disabled={saving || !editDialog.value}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Password Dialog */}
      <Dialog
        open={passwordDialog.open}
        onClose={() => setPasswordDialog({ open: false, currentPassword: '', newPassword: '', confirmPassword: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Cambiar Contraseña</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Nueva contraseña"
              type="password"
              value={passwordDialog.newPassword}
              onChange={(e) => setPasswordDialog(prev => ({ ...prev, newPassword: e.target.value }))}
              helperText="Mínimo 6 caracteres"
            />
            <TextField
              fullWidth
              label="Confirmar nueva contraseña"
              type="password"
              value={passwordDialog.confirmPassword}
              onChange={(e) => setPasswordDialog(prev => ({ ...prev, confirmPassword: e.target.value }))}
              error={passwordDialog.newPassword !== passwordDialog.confirmPassword && passwordDialog.confirmPassword !== ''}
              helperText={passwordDialog.newPassword !== passwordDialog.confirmPassword && passwordDialog.confirmPassword !== '' ? 'Las contraseñas no coinciden' : ''}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setPasswordDialog({ open: false, currentPassword: '', newPassword: '', confirmPassword: '' })}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleChangePassword}
            disabled={saving || !passwordDialog.newPassword || !passwordDialog.confirmPassword}
          >
            {saving ? 'Cambiando...' : 'Cambiar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
