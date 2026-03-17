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
  DarkMode as DarkModeIcon
} from '@mui/icons-material'
import { useSnackbar } from 'notistack'
import { useStore, useThemeStore } from '../store/useStore'
import { loginUser } from '../services/auth'

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
          maxWidth: { xs: 360, sm: 420 },
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
                width: { xs: 64, sm: 80 },
                height: { xs: 64, sm: 80 },
                borderRadius: 2,
                mb: 2,
                boxShadow: '0 4px 20px rgba(255, 107, 53, 0.3)'
              }}
            />
            <Typography
              variant={isMobile ? 'h5' : 'h4'}
              fontWeight="bold"
              sx={{
                background: 'linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent'
              }}
            >
              ON Delivery
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Plataforma de gestión de repartos
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
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size={isMobile ? 'medium' : 'large'}
              disabled={loading}
              sx={{ mt: 3, py: 1.5 }}
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
                  borderColor: '#3B82F6',
                  color: '#3B82F6',
                  '&:hover': { borderColor: '#3B82F6', bgcolor: alpha('#3B82F6', 0.05) }
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
                  borderColor: '#10B981',
                  color: '#10B981',
                  '&:hover': { borderColor: '#10B981', bgcolor: alpha('#10B981', 0.05) }
                }}
              >
                Repartidor
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  )
}
