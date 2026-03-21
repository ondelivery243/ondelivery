// src/pages/restaurante/Perfil.jsx
import { useState, useEffect, useRef } from 'react'
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  useMediaQuery,
  alpha,
  IconButton,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material'
import {
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Store as StoreIcon,
  Edit as EditIcon,
  Camera as CameraIcon,
  CheckCircle as CheckIcon,
  Lock as LockIcon,
  LocationOn as LocationIcon,
  PhotoCamera as PhotoCameraIcon,
  Computer as ComputerIcon,
  Delete as DeleteIcon
} from '@mui/icons-material'
import { useSnackbar } from 'notistack'
import { useStore } from '../../store/useStore'
import { 
  getRestaurantByUserId, 
  updateRestaurant
} from '../../services/firestore'
import { updatePassword } from 'firebase/auth'
import { auth } from '../../config/firebase'
import { RIDERY_COLORS } from '../../theme/theme'

// Función para subir imagen a ImgBB vía Netlify Function
const uploadImageToImgBB = async (file, name) => {
  try {
    // Convertir archivo a base64
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        // Remover el prefijo data:image/...;base64,
        const base64String = reader.result.split(',')[1]
        resolve(base64String)
      }
      reader.onerror = (error) => reject(error)
    })

    // Llamar a la Netlify Function
    const response = await fetch('/.netlify/functions/uploadImage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: base64,
        name: name || 'logo-restaurante'
      })
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Error subiendo imagen')
    }

    return {
      success: true,
      url: result.url,
      thumbnail: result.thumbnail
    }
  } catch (error) {
    console.error('Error subiendo imagen:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export default function RestaurantePerfil() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { enqueueSnackbar } = useSnackbar()
  const { user } = useStore()
  
  const [restaurantData, setRestaurantData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [editDialog, setEditDialog] = useState({ open: false, field: '', value: '' })
  const [passwordDialog, setPasswordDialog] = useState({ open: false, newPassword: '', confirmPassword: '' })
  const [logoMenuAnchor, setLogoMenuAnchor] = useState(null)
  
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const currentYear = new Date().getFullYear()

  // Cargar datos reales
  useEffect(() => {
    const loadData = async () => {
      if (!user?.uid) return
      
      setLoading(true)
      try {
        const restaurant = await getRestaurantByUserId(user.uid)
        if (restaurant) {
          setRestaurantData(restaurant)
        } else {
          setRestaurantData({
            name: user.name || 'Mi Restaurante',
            email: user.email,
            phone: user.phone || '',
            address: '',
            contactName: user.name || '',
            active: user.active || false
          })
        }
      } catch (error) {
        console.error('Error cargando datos:', error)
        enqueueSnackbar('Error al cargar los datos', { variant: 'error' })
      }
      setLoading(false)
    }
    
    loadData()
  }, [user])

  // Manejar selección de imagen desde archivo
  const handleFileSelect = (event) => {
    const file = event.target.files?.[0]
    if (file) {
      handleImageUpload(file)
    }
    // Resetear el input
    event.target.value = ''
    setLogoMenuAnchor(null)
  }

  // Subir imagen a ImgBB y guardar URL
  const handleImageUpload = async (file) => {
    if (!restaurantData?.id) {
      enqueueSnackbar('No se pueden guardar los cambios', { variant: 'error' })
      return
    }

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      enqueueSnackbar('Por favor selecciona una imagen válida', { variant: 'error' })
      return
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      enqueueSnackbar('La imagen no puede superar los 5MB', { variant: 'error' })
      return
    }

    setUploadingLogo(true)

    try {
      // Subir a ImgBB
      const uploadResult = await uploadImageToImgBB(
        file,
        `logo-${restaurantData.name?.toLowerCase().replace(/\s+/g, '-') || 'restaurante'}`
      )

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Error subiendo imagen')
      }

      // Guardar URL en Firestore
      const updateResult = await updateRestaurant(restaurantData.id, {
        logoUrl: uploadResult.url,
        logoThumbnail: uploadResult.thumbnail
      })

      if (updateResult.success) {
        setRestaurantData(prev => ({
          ...prev,
          logoUrl: uploadResult.url,
          logoThumbnail: uploadResult.thumbnail
        }))
        enqueueSnackbar('Logo actualizado correctamente', { variant: 'success' })
      } else {
        throw new Error(updateResult.error || 'Error guardando en la base de datos')
      }
    } catch (error) {
      console.error('Error subiendo logo:', error)
      enqueueSnackbar(error.message || 'Error al subir el logo', { variant: 'error' })
    } finally {
      setUploadingLogo(false)
    }
  }

  // Eliminar logo
  const handleDeleteLogo = async () => {
    if (!restaurantData?.id) return

    setUploadingLogo(true)

    try {
      const result = await updateRestaurant(restaurantData.id, {
        logoUrl: null,
        logoThumbnail: null
      })

      if (result.success) {
        setRestaurantData(prev => ({
          ...prev,
          logoUrl: null,
          logoThumbnail: null
        }))
        enqueueSnackbar('Logo eliminado correctamente', { variant: 'success' })
      } else {
        throw new Error(result.error || 'Error eliminando logo')
      }
    } catch (error) {
      enqueueSnackbar('Error al eliminar el logo', { variant: 'error' })
    } finally {
      setUploadingLogo(false)
      setLogoMenuAnchor(null)
    }
  }

  // Guardar cambios
  const handleSaveField = async () => {
    if (!restaurantData?.id) {
      enqueueSnackbar('No se pueden guardar los cambios', { variant: 'error' })
      return
    }
    
    setSaving(true)
    
    const result = await updateRestaurant(restaurantData.id, { 
      [editDialog.field]: editDialog.value 
    })
    
    setSaving(false)
    
    if (result.success) {
      setRestaurantData(prev => ({ ...prev, [editDialog.field]: editDialog.value }))
      enqueueSnackbar('Datos actualizados correctamente', { variant: 'success' })
      setEditDialog({ open: false, field: '', value: '' })
    } else {
      enqueueSnackbar(result.error || 'Error al guardar', { variant: 'error' })
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
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, passwordDialog.newPassword)
      }
      enqueueSnackbar('Contraseña actualizada correctamente', { variant: 'success' })
      setPasswordDialog({ open: false, newPassword: '', confirmPassword: '' })
    } catch (error) {
      if (error.code === 'auth/requires-recent-login') {
        enqueueSnackbar('Por seguridad, vuelve a iniciar sesión antes de cambiar la contraseña', { variant: 'warning' })
      } else {
        enqueueSnackbar(error.message, { variant: 'error' })
      }
    }
    setSaving(false)
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
          Administra la información de tu restaurante
        </Typography>
      </Box>

      {/* Profile Card */}
      <Card sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Box sx={{ position: 'relative' }}>
              <Avatar
                src={restaurantData?.logoUrl || undefined}
                sx={{
                  width: { xs: 80, sm: 100 },
                  height: { xs: 80, sm: 100 },
                  bgcolor: restaurantData?.logoUrl ? 'transparent' : 'primary.main',
                  fontSize: { xs: '2rem', sm: '2.5rem' },
                  fontWeight: 'bold',
                  border: restaurantData?.logoUrl ? '3px solid' : 'none',
                  borderColor: 'primary.main'
                }}
              >
                {!restaurantData?.logoUrl && (
                  restaurantData?.name?.charAt(0)?.toUpperCase() || <StoreIcon sx={{ fontSize: 48 }} />
                )}
              </Avatar>
              
              {/* Botón de cámara */}
              <IconButton
                size="small"
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  bgcolor: 'primary.main',
                  color: 'white',
                  boxShadow: 2,
                  '&:hover': {
                    bgcolor: 'primary.dark'
                  }
                }}
                onClick={(e) => setLogoMenuAnchor(e.currentTarget)}
                disabled={uploadingLogo}
              >
                {uploadingLogo ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <CameraIcon fontSize="small" />
                )}
              </IconButton>

              {/* Menu de opciones para logo */}
              <Menu
                anchorEl={logoMenuAnchor}
                open={Boolean(logoMenuAnchor)}
                onClose={() => setLogoMenuAnchor(null)}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
              >
                <MenuItem onClick={() => cameraInputRef.current?.click()}>
                  <ListItemIcon>
                    <PhotoCameraIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Tomar foto</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => fileInputRef.current?.click()}>
                  <ListItemIcon>
                    <ComputerIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Subir desde galería</ListItemText>
                </MenuItem>
                {restaurantData?.logoUrl && (
                  <MenuItem onClick={handleDeleteLogo} sx={{ color: 'error.main' }}>
                    <ListItemIcon>
                      <DeleteIcon fontSize="small" color="error" />
                    </ListItemIcon>
                    <ListItemText>Eliminar logo</ListItemText>
                  </MenuItem>
                )}
              </Menu>

              {/* Input oculto para cámara */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />

              {/* Input oculto para archivo */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </Box>
            
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" fontWeight="bold">
                {restaurantData?.name || 'Mi Restaurante'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {restaurantData?.email || user?.email}
              </Typography>
              {restaurantData?.logoUrl && (
                <Typography variant="caption" color="primary" sx={{ display: 'block', mt: 0.5 }}>
                  Toca el ícono de cámara para cambiar el logo
                </Typography>
              )}
            </Box>

            {/* Status */}
            <Chip
              icon={restaurantData?.active ? <CheckIcon /> : null}
              label={restaurantData?.active ? 'Cuenta Activa' : 'Cuenta Inactiva'}
              color={restaurantData?.active ? 'success' : 'warning'}
              variant="outlined"
            />
          </Box>
        </CardContent>
      </Card>

      {/* Business Info */}
      <Card sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
            Información del Negocio
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
                <StoreIcon color="action" />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Nombre del restaurante
                  </Typography>
                  <Typography variant="body1">
                    {restaurantData?.name || 'No especificado'}
                  </Typography>
                </Box>
              </Box>
              <IconButton
                size="small"
                onClick={() => setEditDialog({
                  open: true,
                  field: 'name',
                  value: restaurantData?.name || ''
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
                    {restaurantData?.phone || 'No especificado'}
                  </Typography>
                </Box>
              </Box>
              <IconButton
                size="small"
                onClick={() => setEditDialog({
                  open: true,
                  field: 'phone',
                  value: restaurantData?.phone || ''
                })}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Paper>

            {/* Dirección */}
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
                <LocationIcon color="action" />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Dirección
                  </Typography>
                  <Typography variant="body1">
                    {restaurantData?.address || 'No especificado'}
                  </Typography>
                </Box>
              </Box>
              <IconButton
                size="small"
                onClick={() => setEditDialog({
                  open: true,
                  field: 'address',
                  value: restaurantData?.address || ''
                })}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Paper>

            {/* Contacto */}
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
                    Persona de contacto
                  </Typography>
                  <Typography variant="body1">
                    {restaurantData?.contactName || 'No especificado'}
                  </Typography>
                </Box>
              </Box>
              <IconButton
                size="small"
                onClick={() => setEditDialog({
                  open: true,
                  field: 'contactName',
                  value: restaurantData?.contactName || ''
                })}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Paper>

            {/* Email */}
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
                    {restaurantData?.email || user?.email}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Stack>
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
            onClick={() => setPasswordDialog({ open: true, newPassword: '', confirmPassword: '' })}
            startIcon={<LockIcon />}
          >
            Cambiar Contraseña
          </Button>
        </CardContent>
      </Card>

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

      {/* Edit Field Dialog */}
      <Dialog
        open={editDialog.open}
        onClose={() => setEditDialog({ open: false, field: '', value: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Editar {editDialog.field === 'name' ? 'Nombre' : 
                 editDialog.field === 'phone' ? 'Teléfono' :
                 editDialog.field === 'address' ? 'Dirección' : 'Contacto'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            value={editDialog.value}
            onChange={(e) => setEditDialog(prev => ({ ...prev, value: e.target.value }))}
            sx={{ mt: 1 }}
            label={
              editDialog.field === 'name' ? 'Nombre del restaurante' :
              editDialog.field === 'phone' ? 'Teléfono' :
              editDialog.field === 'address' ? 'Dirección' : 'Persona de contacto'
            }
            multiline={editDialog.field === 'address'}
            rows={editDialog.field === 'address' ? 2 : 1}
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
        onClose={() => setPasswordDialog({ open: false, newPassword: '', confirmPassword: '' })}
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
          <Button onClick={() => setPasswordDialog({ open: false, newPassword: '', confirmPassword: '' })}>
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