// src/pages/admin/Configuracion.jsx
import { useState, useEffect, useRef } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Divider,
  Stack,
  Avatar,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material'
import {
  Save as SaveIcon,
  Settings as SettingsIcon,
  Camera as CameraIcon,
  PhotoCamera as PhotoCameraIcon,
  Computer as ComputerIcon,
  Delete as DeleteIcon,
  LocationOn as LocationIcon
} from '@mui/icons-material'
import { useSnackbar } from 'notistack'
import { useStore } from '../../store/useStore'
import { getSettings, updateSettings, getUser, updateUser } from '../../services/firestore'
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
        name: name || 'foto-admin'
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

export default function Configuracion() {
  const { enqueueSnackbar } = useSnackbar()
  const { user } = useStore()
  const currentYear = new Date().getFullYear()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoMenuAnchor, setPhotoMenuAnchor] = useState(null)
  const [userData, setUserData] = useState(null)
  const [settings, setSettings] = useState({
    platformName: 'ON Delivery',
    adminEmail: 'admin@ondelivery.com',
    adminAddress: '',
    commissionRate: '20',
  })

  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  useEffect(() => {
    const loadData = async () => {
      if (!user?.uid) {
        setLoading(false)
        return
      }
      
      setLoading(true)
      try {
        // Cargar datos del usuario desde Firestore
        const userDataResult = await getUser(user.uid)
        if (userDataResult) {
          setUserData(userDataResult)
        } else {
          setUserData(user)
        }
        
        // Cargar configuración
        const settingsData = await getSettings()
        if (settingsData) {
          setSettings(prev => ({
            ...prev,
            ...settingsData,
            commissionRate: settingsData.commissionRate?.toString() || '20',
            adminAddress: settingsData.adminAddress || ''
          }))
        }
      } catch (error) {
        console.error('Error cargando configuración:', error)
        setUserData(user)
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
    setPhotoMenuAnchor(null)
  }

  // Subir imagen a ImgBB y guardar URL
  const handleImageUpload = async (file) => {
    if (!user?.uid) {
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

    setUploadingPhoto(true)

    try {
      // Subir a ImgBB
      const uploadResult = await uploadImageToImgBB(
        file,
        `foto-${user?.name?.toLowerCase().replace(/\s+/g, '-') || 'admin'}`
      )

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Error subiendo imagen')
      }

      // Guardar URL en Firestore
      const updateResult = await updateUser(user.uid, {
        photoUrl: uploadResult.url,
        photoThumbnail: uploadResult.thumbnail
      })

      if (updateResult.success) {
        setUserData(prev => ({
          ...prev,
          photoUrl: uploadResult.url,
          photoThumbnail: uploadResult.thumbnail
        }))
        enqueueSnackbar('Foto actualizada correctamente', { variant: 'success' })
      } else {
        throw new Error(updateResult.error || 'Error guardando en la base de datos')
      }
    } catch (error) {
      console.error('Error subiendo foto:', error)
      enqueueSnackbar(error.message || 'Error al subir la foto', { variant: 'error' })
    } finally {
      setUploadingPhoto(false)
    }
  }

  // Eliminar foto
  const handleDeletePhoto = async () => {
    if (!user?.uid) return

    setUploadingPhoto(true)

    try {
      const result = await updateUser(user.uid, {
        photoUrl: null,
        photoThumbnail: null
      })

      if (result.success) {
        setUserData(prev => ({
          ...prev,
          photoUrl: null,
          photoThumbnail: null
        }))
        enqueueSnackbar('Foto eliminada correctamente', { variant: 'success' })
      } else {
        throw new Error(result.error || 'Error eliminando foto')
      }
    } catch (error) {
      enqueueSnackbar('Error al eliminar la foto', { variant: 'error' })
    } finally {
      setUploadingPhoto(false)
      setPhotoMenuAnchor(null)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await updateSettings({
        ...settings,
        commissionRate: parseFloat(settings.commissionRate) || 20
      })
      
      if (result.success) {
        enqueueSnackbar('Configuración guardada correctamente', { variant: 'success' })
      } else {
        enqueueSnackbar('Error al guardar: ' + result.error, { variant: 'error' })
      }
    } catch (error) {
      enqueueSnackbar('Error al guardar configuración', { variant: 'error' })
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h5" fontWeight="bold">
            Configuración
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Ajustes generales de la plataforma
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving || loading}
        >
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
      </Stack>

      <Grid container spacing={3}>
        {/* Profile Card */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ textAlign: 'center', py: 3 }}>
              {/* Avatar con foto */}
              <Box sx={{ position: 'relative', display: 'inline-block', mb: 2 }}>
                <Avatar
                  src={userData?.photoUrl || undefined}
                  sx={{
                    width: 100,
                    height: 100,
                    mx: 'auto',
                    bgcolor: userData?.photoUrl ? 'transparent' : 'primary.main',
                    fontSize: '2.5rem',
                    border: userData?.photoUrl ? '3px solid' : 'none',
                    borderColor: 'primary.main'
                  }}
                >
                  {!userData?.photoUrl && (userData?.name?.charAt(0)?.toUpperCase() || 'A')}
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
                  onClick={(e) => setPhotoMenuAnchor(e.currentTarget)}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <CameraIcon fontSize="small" />
                  )}
                </IconButton>

                {/* Menu de opciones para foto */}
                <Menu
                  anchorEl={photoMenuAnchor}
                  open={Boolean(photoMenuAnchor)}
                  onClose={() => setPhotoMenuAnchor(null)}
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
                  {userData?.photoUrl && (
                    <MenuItem onClick={handleDeletePhoto} sx={{ color: 'error.main' }}>
                      <ListItemIcon>
                        <DeleteIcon fontSize="small" color="error" />
                      </ListItemIcon>
                      <ListItemText>Eliminar foto</ListItemText>
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

              <Typography variant="h6" fontWeight="bold">
                {userData?.name || 'Administrador'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {userData?.email || 'admin@ondelivery.com'}
              </Typography>
              {userData?.photoUrl && (
                <Typography variant="caption" color="primary" sx={{ display: 'block', mt: 0.5 }}>
                  Toca el ícono de cámara para cambiar la foto
                </Typography>
              )}
              <Typography variant="caption" color="primary" sx={{ display: 'block', mt: 1 }}>
                Super Administrador
              </Typography>
              
              <Divider sx={{ my: 2 }} />
              
              <Box sx={{ textAlign: 'left' }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Rol:</strong> Administrador Principal
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Permisos:</strong> Acceso total
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Estado:</strong> Activo
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Settings Form */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              {/* General Settings */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <SettingsIcon color="primary" />
                <Typography variant="h6" fontWeight="bold">
                  Configuración General
                </Typography>
              </Box>
              
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Nombre de la Plataforma"
                    value={settings.platformName}
                    onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
                    helperText="Este nombre aparecerá en la aplicación y notificaciones"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Email del Administrador"
                    type="email"
                    value={settings.adminEmail}
                    onChange={(e) => setSettings({ ...settings, adminEmail: e.target.value })}
                    helperText="Email para notificaciones importantes del sistema"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Dirección"
                    value={settings.adminAddress}
                    onChange={(e) => setSettings({ ...settings, adminAddress: e.target.value })}
                    helperText="Dirección del administrador o oficina principal"
                    multiline
                    rows={2}
                    InputProps={{
                      startAdornment: <LocationIcon color="action" sx={{ mr: 1, alignSelf: 'flex-start', mt: 1 }} />
                    }}
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }} />

              {/* Fee Settings */}
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                Tarifas y Comisiones
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Comisión de la Plataforma (%)"
                    type="number"
                    value={settings.commissionRate}
                    onChange={(e) => setSettings({ ...settings, commissionRate: e.target.value })}
                    InputProps={{
                      endAdornment: <Typography>%</Typography>
                    }}
                    helperText="Porcentaje que recibe la plataforma por cada servicio"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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