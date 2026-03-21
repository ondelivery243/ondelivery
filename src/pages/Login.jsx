// src/pages/Login.jsx
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
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
  AppBar,
  Toolbar,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  useMediaQuery,
  alpha
} from '@mui/material'
import {
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  Store as StoreIcon,
  TwoWheeler as BikeIcon,
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  Home as HomeIcon,
  Key as KeyIcon
} from '@mui/icons-material'
import { useSnackbar } from 'notistack'
import { useStore, useThemeStore } from '../store/useStore'
import { loginUser } from '../services/auth'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../config/firebase'
import { RIDERY_COLORS } from '../theme/theme'

export default function Login() {
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { enqueueSnackbar } = useSnackbar()
  const { setUser } = useStore()
  const { mode, toggleTheme } = useThemeStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // Estado para recuperación de contraseña
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  const handleEmailLogin = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      enqueueSnackbar('Por favor completa todos los campos', { variant: 'warning' })
      return
    }

    setLoading(true)
    try {
      const result = await loginUser(email, password)
      if (result.success) {
        setUser(result.user)
        enqueueSnackbar(`¡Bienvenido, ${result.user.name}!`, { variant: 'success' })
        const routes = {
          admin: '/admin',
          restaurante: '/restaurante',
          repartidor: '/repartidor'
        }
        navigate(routes[result.user.role] || '/')
      } else {
        enqueueSnackbar(result.error, { variant: 'error' })
      }
    } catch (error) {
      enqueueSnackbar('Error al iniciar sesión', { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // Función para enviar email de recuperación
  const handlePasswordReset = async () => {
    if (!resetEmail) {
      enqueueSnackbar('Por favor ingresa tu correo electrónico', { variant: 'warning' })
      return
    }

    setResetLoading(true)
    try {
      await sendPasswordResetEmail(auth, resetEmail)
      enqueueSnackbar('Se ha enviado un correo para restablecer tu contraseña', { variant: 'success' })
      setResetDialogOpen(false)
      setResetEmail('')
    } catch (error) {
      console.error('Error sending password reset:', error)
      if (error.code === 'auth/user-not-found') {
        enqueueSnackbar('No existe una cuenta con este correo', { variant: 'error' })
      } else if (error.code === 'auth/invalid-email') {
        enqueueSnackbar('Correo electrónico inválido', { variant: 'error' })
      } else {
        enqueueSnackbar('Error al enviar el correo. Intenta de nuevo.', { variant: 'error' })
      }
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header - Igual que Landing pero sin botón Registrarse */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: mode === 'dark' ? 'rgba(18, 18, 18, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderBottom: 1,
          borderColor: mode === 'dark' ? '#333333' : '#E0E0E0'
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 1, sm: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
            <Box
              component="img"
              src="/logo-192.png"
              alt="ON Delivery"
              sx={{ 
                width: { xs: 32, sm: 40 }, 
                height: { xs: 32, sm: 40 }, 
                borderRadius: 1.5, 
                boxShadow: '0 4px 12px rgba(0, 200, 83, 0.4)' 
              }}
            />
            {/* Nombre ON Delivery SIEMPRE visible */}
            <Typography
              variant={isMobile ? 'subtitle1' : 'h6'}
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

          <Stack direction="row" spacing={0.5} alignItems="center">
            <IconButton onClick={toggleTheme} sx={{ color: 'text.primary' }}>
              {mode === 'dark' ? <DarkModeIcon /> : <LightModeIcon />}
            </IconButton>
            
            {/* Botón Home - Para regresar al Landing */}
            <IconButton
              onClick={() => navigate('/')}
              sx={{ color: 'text.primary' }}
              title="Inicio"
            >
              <HomeIcon />
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box
        sx={{
          pt: 10,
          pb: 4,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: mode === 'dark'
            ? `linear-gradient(180deg, ${RIDERY_COLORS.darkPaper} 0%, ${RIDERY_COLORS.darkBg} 100%)`
            : 'linear-gradient(180deg, #E8F5E9 0%, #FAFAFA 100%)',
          p: 2
        }}
      >
        <Card
          sx={{
            width: '100%',
            maxWidth: { xs: 360, sm: 420 },
            borderRadius: 3,
            boxShadow: '0 8px 40px rgba(0, 200, 83, 0.15)'
          }}
        >
          <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
            {/* Título */}
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Typography
                variant={isMobile ? 'h5' : 'h4'}
                fontWeight="bold"
                color="text.primary"
                gutterBottom
              >
                Iniciar Sesión
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Ingresa tus credenciales para continuar
              </Typography>
            </Box>

            {/* Formulario */}
            <Box component="form" onSubmit={handleEmailLogin} autoComplete="on">
              <TextField
                fullWidth
                label="Correo electrónico"
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                size={isMobile ? 'small' : 'medium'}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon color="action" fontSize={isMobile ? 'small' : 'medium'} />
                    </InputAdornment>
                  )
                }}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Contraseña"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                size={isMobile ? 'small' : 'medium'}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon color="action" fontSize={isMobile ? 'small' : 'medium'} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        size={isMobile ? 'small' : 'medium'}
                      >
                        {showPassword ? <VisibilityOff fontSize={isMobile ? 'small' : 'medium'} /> : <Visibility fontSize={isMobile ? 'small' : 'medium'} />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
              
              {/* Link de recuperar contraseña */}
              <Box sx={{ textAlign: 'right', mt: 1 }}>
                <Button
                  type="button"
                  size="small"
                  onClick={() => {
                    setResetEmail(email)
                    setResetDialogOpen(true)
                  }}
                  sx={{ 
                    textTransform: 'none',
                    color: 'primary.main',
                    fontWeight: 'medium',
                    p: 0,
                    minWidth: 'auto',
                    '&:hover': {
                      background: 'transparent',
                      textDecoration: 'underline'
                    }
                  }}
                >
                  ¿Olvidaste tu contraseña?
                </Button>
              </Box>

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size={isMobile ? 'medium' : 'large'}
                disabled={loading}
                sx={{ 
                  mt: 2, 
                  py: 1.5,
                  background: RIDERY_COLORS.gradientPrimary,
                  boxShadow: RIDERY_COLORS.shadowGreen,
                  '&:hover': {
                    background: `linear-gradient(135deg, ${RIDERY_COLORS.primaryLight} 0%, ${RIDERY_COLORS.primary} 100%)`,
                  }
                }}
              >
                {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </Button>
            </Box>

            {/* Link de registro */}
            <Divider sx={{ my: 3 }} />
            
            <Typography variant="body2" color="text.secondary" align="center" gutterBottom>
              ¿No tienes cuenta? Regístrate como:
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Button
                  component={Link}
                  to="/registro/restaurante"
                  variant="outlined"
                  fullWidth
                  startIcon={<StoreIcon />}
                  sx={{ 
                    py: 1.5,
                    borderColor: '#FF6B35',
                    color: '#FF6B35',
                    '&:hover': { borderColor: '#FF8C5A', bgcolor: alpha('#FF6B35', 0.05) }
                  }}
                >
                  Restaurante
                </Button>
              </Grid>
              <Grid item xs={6}>
                <Button
                  component={Link}
                  to="/registro/repartidor"
                  variant="outlined"
                  fullWidth
                  startIcon={<BikeIcon />}
                  sx={{ 
                    py: 1.5,
                    borderColor: RIDERY_COLORS.primary,
                    color: RIDERY_COLORS.primary,
                    '&:hover': { borderColor: RIDERY_COLORS.primaryLight, bgcolor: alpha(RIDERY_COLORS.primary, 0.05) }
                  }}
                >
                  Repartidor
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Box>

      {/* Dialog para recuperar contraseña */}
      <Dialog
        open={resetDialogOpen}
        onClose={() => setResetDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <KeyIcon color="primary" />
          Recuperar Contraseña
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Correo electrónico"
            type="email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailIcon color="action" />
                </InputAdornment>
              )
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handlePasswordReset()
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setResetDialogOpen(false)} disabled={resetLoading}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handlePasswordReset}
            disabled={resetLoading || !resetEmail}
            startIcon={resetLoading ? null : <EmailIcon />}
          >
            {resetLoading ? 'Enviando...' : 'Enviar Enlace'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}