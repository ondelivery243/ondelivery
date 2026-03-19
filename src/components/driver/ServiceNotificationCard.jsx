// src/components/driver/ServiceNotificationCard.jsx
// Tarjeta de notificación de servicio con countdown
import React, { useState, useEffect, useMemo } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  LinearProgress,
  Chip,
  IconButton,
  Fade,
  Skeleton
} from '@mui/material'
import {
  LocationOn as LocationIcon,
  LocalShipping as DeliveryIcon,
  Timer as TimerIcon,
  Close as CloseIcon,
  Check as CheckIcon,
  AccessTime as AccessTimeIcon
} from '@mui/icons-material'
import { BROADCAST_CONFIG } from '../../services/broadcastService'

/**
 * Componente de tarjeta de notificación de servicio
 * @param {object} service - Datos del servicio disponible
 * @param {function} onAccept - Callback cuando se acepta el servicio
 * @param {function} onIgnore - Callback cuando se ignora el servicio
 * @param {boolean} isAccepting - Si se está procesando la aceptación
 */
const ServiceNotificationCard = ({ 
  service, 
  onAccept, 
  onIgnore, 
  isAccepting = false 
}) => {
  const [timeRemaining, setTimeRemaining] = useState(service.timeRemaining || 0)
  const [isExiting, setIsExiting] = useState(false)

  // Calcular progreso
  const totalTime = BROADCAST_CONFIG.WINDOW_DURATION
  const progress = useMemo(() => {
    return Math.max(0, Math.min(100, (timeRemaining / totalTime) * 100))
  }, [timeRemaining, totalTime])

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1000) {
          clearInterval(timer)
          return 0
        }
        return prev - 1000
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Formatear tiempo restante
  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  // Colores según tiempo restante
  const getProgressColor = () => {
    if (progress > 60) return 'success'
    if (progress > 30) return 'warning'
    return 'error'
  }

  // Formatear distancia
  const formatDistance = (distanceKm) => {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)}m`
    }
    return `${distanceKm.toFixed(1)}km`
  }

  // Manejar aceptar
  const handleAccept = () => {
    setIsExiting(true)
    setTimeout(() => {
      onAccept?.(service.serviceId)
    }, 200)
  }

  // Manejar ignorar
  const handleIgnore = () => {
    setIsExiting(true)
    setTimeout(() => {
      onIgnore?.(service.serviceId)
    }, 200)
  }

  // Cuando el tiempo se acaba
  useEffect(() => {
    if (timeRemaining === 0 && !isExiting) {
      handleIgnore()
    }
  }, [timeRemaining])

  return (
    <Fade in={!isExiting} timeout={200}>
      <Card
        sx={{
          mb: 2,
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          border: '2px solid',
          borderColor: progress > 30 ? '#00d9ff' : '#ff4757',
          borderRadius: 2,
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0, 217, 255, 0.15)',
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 12px 40px rgba(0, 217, 255, 0.25)'
          }
        }}
      >
        {/* Barra de progreso superior */}
        <LinearProgress
          variant="determinate"
          value={progress}
          color={getProgressColor()}
          sx={{
            height: 6,
            backgroundColor: 'rgba(255,255,255,0.1)',
            '& .MuiLinearProgress-bar': {
              transition: 'none'
            }
          }}
        />

        <CardContent sx={{ p: 2.5 }}>
          {/* Header con tiempo y botón cerrar */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TimerIcon sx={{ color: progress > 30 ? '#00d9ff' : '#ff4757', fontSize: 20 }} />
              <Typography
                variant="h5"
                fontWeight="bold"
                sx={{ 
                  color: progress > 30 ? '#00d9ff' : '#ff4757',
                  fontFamily: 'monospace'
                }}
              >
                {formatTime(timeRemaining)}
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={handleIgnore}
              sx={{ color: 'rgba(255,255,255,0.5)' }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* Zona */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <LocationIcon sx={{ color: '#00d9ff', fontSize: 18 }} />
            <Typography variant="body1" color="white" fontWeight="medium">
              {service.zoneName || 'Zona no especificada'}
            </Typography>
          </Box>

          {/* Distancia y tarifa */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Chip
              icon={<DeliveryIcon sx={{ fontSize: 16 }} />}
              label={formatDistance(service.distance)}
              size="small"
              sx={{
                backgroundColor: 'rgba(0, 217, 255, 0.15)',
                color: '#00d9ff',
                border: '1px solid rgba(0, 217, 255, 0.3)',
                '& .MuiChip-icon': { color: '#00d9ff' }
              }}
            />
            <Chip
              icon={<AccessTimeIcon sx={{ fontSize: 16 }} />}
              label={`Intento ${service.currentAttempt || 1}`}
              size="small"
              sx={{
                backgroundColor: 'rgba(255, 165, 0, 0.15)',
                color: '#ffa500',
                border: '1px solid rgba(255, 165, 0, 0.3)',
                '& .MuiChip-icon': { color: '#ffa500' }
              }}
            />
          </Box>

          {/* Tarifa del repartidor */}
          <Box
            sx={{
              p: 1.5,
              borderRadius: 1,
              backgroundColor: 'rgba(0, 255, 136, 0.1)',
              border: '1px solid rgba(0, 255, 136, 0.2)',
              mb: 2
            }}
          >
            <Typography variant="caption" color="rgba(255,255,255,0.6)">
              Tu ganancia
            </Typography>
            <Typography variant="h6" color="#00ff88" fontWeight="bold">
              ${service.driverEarnings?.toFixed(2) || '0.00'}
            </Typography>
          </Box>

          {/* Botones de acción */}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              variant="contained"
              fullWidth
              onClick={handleAccept}
              disabled={isAccepting || timeRemaining === 0}
              sx={{
                py: 1.5,
                backgroundColor: '#00ff88',
                color: '#000',
                fontWeight: 'bold',
                fontSize: '1rem',
                '&:hover': {
                  backgroundColor: '#00cc6a'
                },
                '&:disabled': {
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.3)'
                }
              }}
            >
              {isAccepting ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    component="span"
                    sx={{
                      width: 16,
                      height: 16,
                      border: '2px solid',
                      borderColor: 'currentColor',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      '@keyframes spin': {
                        '0%': { transform: 'rotate(0deg)' },
                        '100%': { transform: 'rotate(360deg)' }
                      }
                    }}
                  />
                  Aceptando...
                </Box>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckIcon fontSize="small" />
                  Aceptar Servicio
                </Box>
              )}
            </Button>
          </Box>

          {/* Nota sobre dirección */}
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mt: 1.5,
              color: 'rgba(255,255,255,0.5)',
              textAlign: 'center',
              fontStyle: 'italic'
            }}
          >
            La dirección exacta se mostrará al aceptar
          </Typography>
        </CardContent>
      </Card>
    </Fade>
  )
}

export default ServiceNotificationCardS