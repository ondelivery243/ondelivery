// src/pages/Landing.jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  AppBar,
  Toolbar,
  Chip,
  Stack,
  IconButton,
  useTheme,
  Skeleton
} from '@mui/material'
import {
  Store as StoreIcon,
  TwoWheeler as BikeIcon,
  AdminPanelSettings as AdminIcon,
  CheckCircle as CheckIcon,
  LocationOn as LocationIcon,
  ArrowForward as ArrowIcon,
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon
} from '@mui/icons-material'
import { useStore, formatCurrency, useThemeStore } from '../store/useStore'
import { getZones } from '../services/firestore'
import { RIDERY_COLORS } from '../theme/theme'

export default function Landing() {
  const navigate = useNavigate()
  const theme = useTheme()
  const { user } = useStore()
  const { mode, toggleTheme } = useThemeStore()
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)

  // Cargar zonas desde Firestore (lectura pública)
  useEffect(() => {
    const fetchZones = async () => {
      try {
        const fetchedZones = await getZones()
        const activeZones = fetchedZones.filter(zone => zone.active)
        setZones(activeZones)
      } catch (error) {
        console.error('Error cargando zonas:', error)
        setZones([])
      } finally {
        setLoading(false)
      }
    }
    fetchZones()
  }, [])

  // Redirigir si ya está logueado
  useEffect(() => {
    if (user) {
      const routes = {
        admin: '/admin',
        restaurante: '/restaurante',
        repartidor: '/repartidor'
      }
      navigate(routes[user.role] || '/login', { replace: true })
    }
  }, [user, navigate])

  const features = [
    {
      icon: <StoreIcon sx={{ fontSize: 32 }} />,
      title: 'Para Restaurantes',
      description: 'Solicita servicios de delivery cuando los necesites. Sin costos fijos mensuales.',
      color: 'primary',
      benefits: [
        'Solicita repartidores bajo demanda',
        'Paga solo por servicio realizado',
        'Tracking en tiempo real',
        'Historial de pedidos completo'
      ]
    },
    {
      icon: <BikeIcon sx={{ fontSize: 32 }} />,
      title: 'Para Repartidores',
      description: 'Trabaja cuando quieras, gana por cada entrega. Flexibilidad total.',
      color: 'success',
      benefits: [
        'Horario flexible (online/offline)',
        'Recibe notificaciones instantáneas',
        'Liquidación semanal garantizada',
        'Navegación GPS integrada'
      ]
    },
    {
      icon: <AdminIcon sx={{ fontSize: 32 }} />,
      title: 'Administración Central',
      description: 'Control total de la operación con métricas en tiempo real.',
      color: 'secondary',
      benefits: [
        'Gestión de zonas y tarifas',
        'Control de liquidaciones',
        'Reportes y estadísticas',
        'Panel de administración completo'
      ]
    }
  ]

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
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
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              component="img"
              src="/logo-192.png"
              alt="ON Delivery"
              sx={{ 
                width: 40, 
                height: 40, 
                borderRadius: 1.5, 
                boxShadow: '0 4px 12px rgba(0, 200, 83, 0.4)' 
              }}
            />
            <Typography
              variant="h6"
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

          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton onClick={toggleTheme} sx={{ color: 'text.primary' }}>
              {mode === 'dark' ? <DarkModeIcon /> : <LightModeIcon />}
            </IconButton>
            <Button
              variant="text"
              onClick={() => navigate('/login')}
              sx={{ color: 'text.primary', fontWeight: 600 }}
            >
              Iniciar Sesión
            </Button>
            <Button
              variant="contained"
              onClick={() => navigate('/login')}
              sx={{
                background: RIDERY_COLORS.gradientPrimary,
                boxShadow: RIDERY_COLORS.shadowGreen,
                '&:hover': {
                  background: `linear-gradient(135deg, ${RIDERY_COLORS.primaryLight} 0%, ${RIDERY_COLORS.primary} 100%)`,
                }
              }}
            >
              Registrarse
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Hero Section */}
      <Box
        sx={{
          pt: { xs: 15, md: 20 },
          pb: { xs: 8, md: 12 },
          background: mode === 'dark'
            ? `linear-gradient(180deg, ${RIDERY_COLORS.darkPaper} 0%, ${RIDERY_COLORS.darkBg} 100%)`
            : 'linear-gradient(180deg, #E8F5E9 0%, #FAFAFA 100%)'
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography
              variant="h2"
              fontWeight="bold"
              sx={{
                fontSize: { xs: '2.5rem', md: '3.5rem' },
                mb: 3,
                color: 'text.primary'
              }}
            >
              Sistema de Delivery{' '}
              <Box
                component="span"
                sx={{
                  background: RIDERY_COLORS.gradientPrimary,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  color: 'transparent'
                }}
              >
                Multiempresa
              </Box>
            </Typography>

            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ maxWidth: 600, mx: 'auto', mb: 4 }}
            >
              Conectamos restaurantes de Maracay con repartidores confiables.
              Gestiona tus entregas de forma eficiente y en tiempo real.
            </Typography>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              justifyContent="center"
            >
              <Button
                variant="contained"
                size="large"
                startIcon={<StoreIcon />}
                endIcon={<ArrowIcon />}
                onClick={() => navigate('/login')}
                sx={{ 
                  py: 2, 
                  px: 4,
                  background: RIDERY_COLORS.gradientPrimary,
                  boxShadow: RIDERY_COLORS.shadowGreen,
                  '&:hover': {
                    background: `linear-gradient(135deg, ${RIDERY_COLORS.primaryLight} 0%, ${RIDERY_COLORS.primary} 100%)`,
                  }
                }}
              >
                Soy Restaurante
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<BikeIcon />}
                endIcon={<ArrowIcon />}
                onClick={() => navigate('/login')}
                sx={{ 
                  py: 2, 
                  px: 4,
                  borderColor: RIDERY_COLORS.primary,
                  color: RIDERY_COLORS.primary,
                  '&:hover': {
                    borderColor: RIDERY_COLORS.primaryLight,
                    bgcolor: 'rgba(0, 200, 83, 0.08)',
                  }
                }}
              >
                Soy Repartidor
              </Button>
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* Features Section */}
      <Box sx={{ py: 8, bgcolor: 'background.paper' }}>
        <Container maxWidth="lg">
          <Typography
            variant="h3"
            fontWeight="bold"
            align="center"
            sx={{ mb: 6, color: 'text.primary' }}
          >
            ¿Cómo funciona ON Delivery?
          </Typography>

          <Grid container spacing={4}>
            {features.map((feature, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Card
                  elevation={0}
                  sx={{
                    height: '100%',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 3,
                    transition: 'all 0.3s',
                    '&:hover': {
                      boxShadow: mode === 'dark' 
                        ? '0 8px 30px rgba(0, 200, 83, 0.2)' 
                        : '0 8px 30px rgba(0, 200, 83, 0.15)',
                      transform: 'translateY(-4px)',
                      borderColor: RIDERY_COLORS.primary
                    }
                  }}
                >
                  <CardContent sx={{ p: 4 }}>
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: 2,
                        background: feature.color === 'primary' 
                          ? RIDERY_COLORS.gradientPrimary 
                          : feature.color === 'success' 
                            ? RIDERY_COLORS.gradientPrimary 
                            : RIDERY_COLORS.gradientSecondary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 3,
                        color: 'white',
                        boxShadow: feature.color === 'secondary'
                          ? RIDERY_COLORS.shadowYellow
                          : RIDERY_COLORS.shadowGreen
                      }}
                    >
                      {feature.icon}
                    </Box>

                    <Typography variant="h5" fontWeight="bold" gutterBottom color="text.primary">
                      {feature.title}
                    </Typography>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      {feature.description}
                    </Typography>

                    <Stack spacing={1}>
                      {feature.benefits.map((benefit, i) => (
                        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CheckIcon sx={{ fontSize: 18, color: RIDERY_COLORS.primary }} />
                          <Typography variant="body2" color="text.primary">{benefit}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Coverage Section */}
      <Box sx={{ py: 8, bgcolor: 'background.default' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography variant="h3" fontWeight="bold" gutterBottom color="text.primary">
              Cobertura en Maracay
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Zonas disponibles para entrega y sus tarifas
            </Typography>
          </Box>

          {loading ? (
            <Grid container spacing={2} justifyContent="center">
              {[1, 2, 3, 4, 5].map((i) => (
                <Grid item xs={6} sm={4} md={2.4} key={i}>
                  <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 2 }} />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Grid container spacing={2} justifyContent="center">
              {zones.slice(0, 10).map((zone) => (
                <Grid item xs={6} sm={4} md={2.4} key={zone.id}>
                  <Card
                    elevation={0}
                    sx={{
                      textAlign: 'center',
                      p: 2,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 2,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        borderColor: RIDERY_COLORS.primary,
                        bgcolor: 'rgba(0, 200, 83, 0.08)',
                        transform: 'scale(1.02)'
                      }
                    }}
                  >
                    <LocationIcon sx={{ color: RIDERY_COLORS.primary, mb: 1 }} />
                    <Typography variant="subtitle2" fontWeight="bold" color="text.primary">
                      {zone.name}
                    </Typography>
                    <Chip
                      label={formatCurrency(zone.price)}
                      size="small"
                      sx={{ 
                        mt: 1,
                        background: RIDERY_COLORS.gradientPrimary,
                        color: 'white',
                        fontWeight: 600
                      }}
                    />
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Container>
      </Box>

      {/* CTA Section */}
      <Box
        sx={{
          py: 10,
          background: RIDERY_COLORS.gradientPrimary
        }}
      >
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center', color: 'white' }}>
            <Typography variant="h3" fontWeight="bold" gutterBottom>
              ¿Listo para empezar?
            </Typography>
            <Typography variant="h6" sx={{ mb: 4, opacity: 0.9 }}>
              Únete a la red de delivery más completa de Maracay
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/login')}
              sx={{
                bgcolor: 'white',
                color: RIDERY_COLORS.primary,
                py: 2,
                px: 6,
                fontWeight: 700,
                borderRadius: 25,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                '&:hover': {
                  bgcolor: 'grey.100',
                  transform: 'scale(1.02)'
                }
              }}
            >
              Comenzar Ahora
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ py: 6, bgcolor: mode === 'dark' ? '#0A0A0A' : '#1E1E1E', color: 'white' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
              <Box
                component="img"
                src="/logo-192.png"
                alt="ON Delivery"
                sx={{ width: 40, height: 40, borderRadius: 1.5, boxShadow: RIDERY_COLORS.shadowGreen }}
              />
              <Typography 
                variant="h6" 
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
            <Typography variant="body2" color="grey.400" sx={{ mb: 2 }}>
              Plataforma de delivery multiempresa para Maracay, Venezuela
            </Typography>
            <Typography variant="caption" color="grey.500">
              © 2024 ON Delivery. Todos los derechos reservados.
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  )
}
