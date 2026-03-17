// src/pages/admin/Configuracion.jsx
import { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Switch,
  FormControlLabel,
  Divider,
  Stack,
  Avatar,
  CircularProgress,
  Paper
} from '@mui/material'
import {
  Save as SaveIcon,
  Settings as SettingsIcon
} from '@mui/icons-material'
import { useSnackbar } from 'notistack'
import { useStore } from '../../store/useStore'
import { getSettings, updateSettings } from '../../services/firestore'

export default function Configuracion() {
  const { enqueueSnackbar } = useSnackbar()
  const { user } = useStore()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    platformName: 'ON Delivery',
    adminEmail: 'admin@ondelivery.com',
    commissionRate: '20',
    minDeliveryFee: '1.50',
    notificationsEnabled: true,
    autoAssignDrivers: false,
    requireApproval: true,
  })

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true)
      try {
        const settingsData = await getSettings()
        if (settingsData) {
          setSettings(prev => ({
            ...prev,
            ...settingsData,
            commissionRate: settingsData.commissionRate?.toString() || '20',
            minDeliveryFee: settingsData.minDeliveryFee?.toString() || '1.50'
          }))
        }
      } catch (error) {
        console.error('Error cargando configuración:', error)
      }
      setLoading(false)
    }
    
    loadSettings()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await updateSettings({
        ...settings,
        commissionRate: parseFloat(settings.commissionRate) || 20,
        minDeliveryFee: parseFloat(settings.minDeliveryFee) || 1.50
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

      {loading ? (
        <Card>
          <CardContent sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {/* Profile Card */}
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                <Avatar
                  sx={{
                    width: 80,
                    height: 80,
                    mx: 'auto',
                    mb: 2,
                    bgcolor: 'primary.main',
                    fontSize: '2rem'
                  }}
                >
                  {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                </Avatar>
                <Typography variant="h6" fontWeight="bold">
                  {user?.name || 'Administrador'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {user?.email || 'admin@ondelivery.com'}
                </Typography>
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
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Tarifa Mínima de Delivery ($)"
                      type="number"
                      value={settings.minDeliveryFee}
                      onChange={(e) => setSettings({ ...settings, minDeliveryFee: e.target.value })}
                      InputProps={{
                        startAdornment: <Typography>$</Typography>
                      }}
                      helperText="Monto mínimo para cualquier entrega"
                    />
                  </Grid>
                </Grid>

                <Divider sx={{ my: 3 }} />

                {/* Features Settings */}
                <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                  Funcionalidades
                </Typography>
                <Stack spacing={2}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.notificationsEnabled}
                          onChange={(e) => setSettings({ ...settings, notificationsEnabled: e.target.checked })}
                          color="primary"
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            Habilitar notificaciones push
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Enviar notificaciones a restaurantes y repartidores sobre nuevos servicios
                          </Typography>
                        </Box>
                      }
                    />
                  </Paper>
                  
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.autoAssignDrivers}
                          onChange={(e) => setSettings({ ...settings, autoAssignDrivers: e.target.checked })}
                          color="primary"
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            Asignar repartidores automáticamente
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            El sistema asignará automáticamente el repartidor más cercano disponible
                          </Typography>
                        </Box>
                      }
                    />
                  </Paper>
                  
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.requireApproval}
                          onChange={(e) => setSettings({ ...settings, requireApproval: e.target.checked })}
                          color="primary"
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            Requerir aprobación para nuevos usuarios
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Los nuevos restaurantes y repartidores deben ser aprobados por el admin antes de operar
                          </Typography>
                        </Box>
                      }
                    />
                  </Paper>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  )
}
