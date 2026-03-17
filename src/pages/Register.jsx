// src/pages/Register.jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  InputAdornment,
  IconButton,
  Divider,
  Grid,
  MenuItem,
  Stepper,
  Step,
  StepLabel,
  Alert,
  CircularProgress,
  useTheme,
  useMediaQuery,
  alpha
} from '@mui/material'
import {
  Email as EmailIcon,
  Lock as LockIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Visibility,
  VisibilityOff,
  TwoWheeler as BikeIcon,
  Badge as BadgeIcon,
  DirectionsBike as BikeTypeIcon,
  TwoWheeler as MotoIcon,
  DirectionsCar as CarIcon,
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  ArrowBack as BackIcon,
  ArrowForward as NextIcon,
  Check as CheckIcon
} from '@mui/icons-material'
import { useSnackbar } from 'notistack'
import { useThemeStore } from '../store/useStore'
import { registerDriver } from '../services/auth'

const steps = ['Datos Personales', 'Información del Vehículo', 'Crear Cuenta']

export default function Register() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { enqueueSnackbar } = useSnackbar()
  const { mode, toggleTheme } = useThemeStore()

  const [activeStep, setActiveStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Datos personales
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [dni, setDni] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Datos del vehículo
  const [vehicleType, setVehicleType] = useState('motocicleta')
  const [vehicleBrand, setVehicleBrand] = useState('')
  const [vehicleModel, setVehicleModel] = useState('')
  const [vehiclePlate, setVehiclePlate] = useState('')

  const vehicleTypes = [
    { value: 'motocicleta', label: 'Motocicleta', icon: <MotoIcon /> },
    { value: 'bicicleta', label: 'Bicicleta', icon: <BikeTypeIcon /> }
  ]

  const validateStep1 = () => {
    if (!name.trim()) {
      setError('El nombre es requerido')
      return false
    }
    if (!email.trim()) {
      setError('El correo es requerido')
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('El correo no es válido')
      return false
    }
    if (!phone.trim()) {
      setError('El teléfono es requerido')
      return false
    }
    if (!password) {
      setError('La contraseña es requerida')
      return false
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return false
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return false
    }
    return true
  }

  const validateStep2 = () => {
    if (!vehicleBrand.trim()) {
      setError('La marca del vehículo es requerida')
      return false
    }
    if (!vehicleModel.trim()) {
      setError('El modelo del vehículo es requerido')
      return false
    }
    return true
  }

  const handleNext = () => {
    setError('')
    
    if (activeStep === 0 && !validateStep1()) return
    if (activeStep === 1 && !validateStep2()) return
    
    if (activeStep === 1) {
      handleRegister()
    } else {
      setActiveStep((prev) => prev + 1)
    }
  }

  const handleBack = () => {
    setActiveStep((prev) => prev - 1)
    setError('')
  }

  const handleRegister = async () => {
    setLoading(true)
    setError('')

    try {
      const result = await registerDriver(email, password, {
        name,
        phone,
        dni,
        vehicleType,
        vehicleBrand,
        vehicleModel,
        vehiclePlate
      })

      if (result.success) {
        setSuccess(true)
        enqueueSnackbar('¡Registro exitoso! Espera la activación de tu cuenta.', { variant: 'success' })
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Error al registrar. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  // Pantalla de éxito
  if (success) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: mode === 'dark'
            ? 'linear-gradient(135deg, #1F2937 0%, #111827 50%, #1F2937 100%)'
            : 'linear-gradient(135deg, #FFF5F5 0%, #FFF0F0 50%, #FFF8F0 100%)',
          p: 2
        }}
      >
        <Card sx={{ maxWidth: 450, borderRadius: 3, width: '100%' }}>
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                bgcolor: 'success.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 3
              }}
            >
              <CheckIcon sx={{ fontSize: 48, color: 'white' }} />
            </Box>
            
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              ¡Registro Exitoso!
            </Typography>
            
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Tu cuenta ha sido creada correctamente. Un administrador debe activar tu cuenta para que puedas comenzar a trabajar.
            </Typography>

            <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
              <Typography variant="body2">
                <strong>Próximos pasos:</strong><br />
                1. Espera la activación de tu cuenta<br />
                2. Recibirás una notificación cuando estés activo<br />
                3. Podrás iniciar sesión y recibir servicios de delivery
              </Typography>
            </Alert>

            <Button
              variant="contained"
              fullWidth
              size="large"
              component={Link}
              to="/login"
            >
              Ir a Iniciar Sesión
            </Button>
          </CardContent>
        </Card>
      </Box>
    )
  }

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              required
              label="Nombre completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon color="action" />
                  </InputAdornment>
                )
              }}
            />
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  type="email"
                  label="Correo electrónico"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon color="action" />
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="Teléfono"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0414-1234567"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PhoneIcon color="action" />
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
            </Grid>

            <TextField
              fullWidth
              label="Cédula / DNI (opcional)"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <BadgeIcon color="action" />
                  </InputAdornment>
                )
              }}
            />

            <Divider sx={{ my: 1 }} />

            <TextField
              fullWidth
              required
              type={showPassword ? 'text' : 'password'}
              label="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              helperText="Mínimo 6 caracteres"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            <TextField
              fullWidth
              required
              type={showPassword ? 'text' : 'password'}
              label="Confirmar contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={!!(confirmPassword && password !== confirmPassword)}
              helperText={confirmPassword && password !== confirmPassword ? 'Las contraseñas no coinciden' : ''}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon color="action" />
                  </InputAdornment>
                )
              }}
            />
          </Box>
        )

      case 1:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="info" sx={{ mb: 1 }}>
              Esta información nos ayuda a asignarte los servicios más adecuados
            </Alert>

            <TextField
              fullWidth
              required
              select
              label="Tipo de vehículo"
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
            >
              {vehicleTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {type.icon}
                    {type.label}
                  </Box>
                </MenuItem>
              ))}
            </TextField>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="Marca del vehículo"
                  value={vehicleBrand}
                  onChange={(e) => setVehicleBrand(e.target.value)}
                  placeholder={vehicleType === 'motocicleta' ? 'Ej: Honda, Yamaha...' : 'Ej: Toyota, Ford...'}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="Modelo"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  placeholder="Ej: 2020, 2021..."
                />
              </Grid>
            </Grid>

            <TextField
              fullWidth
              label="Placa (opcional)"
              value={vehiclePlate}
              onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
              placeholder={vehicleType === 'bicicleta' ? 'No aplica para bicicletas' : 'Ej: ABC123'}
              disabled={vehicleType === 'bicicleta'}
            />

            <Box sx={{ 
              mt: 2, 
              p: 2, 
              bgcolor: alpha(theme.palette.info.main, 0.1), 
              borderRadius: 2,
              border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`
            }}>
              <Typography variant="subtitle2" color="info.main" gutterBottom>
                Importante
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Después de registrarte, un administrador debe activar tu cuenta. 
                Te notificaremos cuando tu cuenta esté lista para comenzar a trabajar.
              </Typography>
            </Box>
          </Box>
        )

      default:
        return null
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: mode === 'dark'
          ? 'linear-gradient(135deg, #1F2937 0%, #111827 50%, #1F2937 100%)'
          : 'linear-gradient(135deg, #FFF5F5 0%, #FFF0F0 50%, #FFF8F0 100%)',
        p: 2
      }}
    >
      {/* Theme Toggle Button */}
      <IconButton
        onClick={toggleTheme}
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          bgcolor: 'background.paper',
          boxShadow: 2,
          '&:hover': { bgcolor: 'background.paper' }
        }}
      >
        {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
      </IconButton>

      <Card
        sx={{
          width: '100%',
          maxWidth: { xs: 400, sm: 500 },
          borderRadius: 3,
          boxShadow: '0 8px 40px rgba(255, 107, 53, 0.15)'
        }}
      >
        <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
          {/* Logo y título */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
            <Box
              component="img"
              src="/logo-192.png"
              alt="ON Delivery Logo"
              sx={{
                width: { xs: 56, sm: 64 },
                height: { xs: 56, sm: 64 },
                borderRadius: 1.5,
                mb: 2,
                boxShadow: '0 4px 20px rgba(255, 107, 53, 0.3)'
              }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BikeIcon sx={{ color: 'success.main' }} />
              <Typography
                variant={isMobile ? 'h6' : 'h5'}
                fontWeight="bold"
              >
                Registro de Repartidor
              </Typography>
            </Box>
          </Box>

          {/* Stepper */}
          <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{isMobile ? '' : label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Form Content */}
          {renderStepContent(activeStep)}

          {/* Navigation Buttons */}
          <Box sx={{ display: 'flex', gap: 1, mt: 3 }}>
            {activeStep > 0 && (
              <Button
                variant="outlined"
                onClick={handleBack}
                startIcon={<BackIcon />}
                disabled={loading}
              >
                Atrás
              </Button>
            )}
            
            <Box sx={{ flex: '1 1 auto' }} />
            
            <Button
              variant="contained"
              onClick={handleNext}
              endIcon={activeStep === 1 ? <CheckIcon /> : <NextIcon />}
              disabled={loading}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : activeStep === 1 ? (
                'Registrarse'
              ) : (
                'Siguiente'
              )}
            </Button>
          </Box>

          {/* Link to Login */}
          <Divider sx={{ my: 3 }} />
          
          <Typography variant="body2" color="text.secondary" align="center">
            ¿Ya tienes cuenta?{' '}
            <Button
              component={Link}
              to="/login"
              variant="text"
              color="primary"
              sx={{ p: 0, minWidth: 'auto', verticalAlign: 'baseline' }}
            >
              Iniciar Sesión
            </Button>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}
