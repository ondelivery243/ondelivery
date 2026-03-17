// src/components/notifications/NotificationToast.jsx
import { Box, Typography, Chip, alpha, useTheme } from '@mui/material'
import {
  CheckCircle as SuccessIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  LocalShipping as DeliveryIcon,
  Store as StoreIcon,
  AttachMoney as MoneyIcon,
  Notifications as NotificationIcon
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'

/**
 * Configuración de iconos y colores por tipo de notificación
 */
const getNotificationConfig = (type, theme) => {
  const configs = {
    NEW_SERVICE: {
      icon: <DeliveryIcon />,
      color: theme.palette.info.main,
      bgColor: alpha(theme.palette.info.main, 0.1)
    },
    SERVICE_ACCEPTED: {
      icon: <SuccessIcon />,
      color: theme.palette.success.main,
      bgColor: alpha(theme.palette.success.main, 0.1)
    },
    DRIVER_ON_WAY: {
      icon: <DeliveryIcon />,
      color: theme.palette.primary.main,
      bgColor: alpha(theme.palette.primary.main, 0.1)
    },
    SERVICE_COMPLETED: {
      icon: <SuccessIcon />,
      color: theme.palette.success.main,
      bgColor: alpha(theme.palette.success.main, 0.1)
    },
    SERVICE_CANCELLED: {
      icon: <WarningIcon />,
      color: theme.palette.warning.main,
      bgColor: alpha(theme.palette.warning.main, 0.1)
    },
    SETTLEMENT_READY: {
      icon: <MoneyIcon />,
      color: theme.palette.success.main,
      bgColor: alpha(theme.palette.success.main, 0.1)
    },
    NEW_RESTAURANT: {
      icon: <StoreIcon />,
      color: theme.palette.info.main,
      bgColor: alpha(theme.palette.info.main, 0.1)
    },
    NEW_DRIVER: {
      icon: <DeliveryIcon />,
      color: theme.palette.info.main,
      bgColor: alpha(theme.palette.info.main, 0.1)
    }
  }
  return configs[type] || {
    icon: <NotificationIcon />,
    color: theme.palette.grey[500],
    bgColor: alpha(theme.palette.grey[500], 0.1)
  }
}

/**
 * Componente individual de notificación para lista
 */
export const NotificationItem = ({ notification, onMarkRead, onAction }) => {
  const theme = useTheme()
  const navigate = useNavigate()
  const config = getNotificationConfig(notification.type, theme)

  const handleClick = () => {
    if (notification.data?.url) {
      navigate(notification.data.url)
    }
    onMarkRead?.(notification.id)
  }

  const formatTime = (timestamp) => {
    if (!timestamp) return ''
    const date = timestamp.toDate?.() || new Date(timestamp)
    const now = new Date()
    const diff = Math.floor((now - date) / 1000)

    if (diff < 60) return 'Ahora'
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`
    return date.toLocaleDateString('es-VE')
  }

  return (
    <Box
      onClick={handleClick}
      sx={{
        p: 2,
        cursor: 'pointer',
        bgcolor: notification.read ? 'transparent' : config.bgColor,
        borderLeft: notification.read ? 'none' : `4px solid ${config.color}`,
        transition: 'all 0.2s',
        '&:hover': {
          bgcolor: alpha(config.color, 0.05)
        }
      }}
    >
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            bgcolor: config.bgColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: config.color,
            flexShrink: 0
          }}
        >
          {config.icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Typography
              variant="subtitle2"
              fontWeight={notification.read ? 'normal' : 'bold'}
              sx={{ color: notification.read ? 'text.secondary' : 'text.primary' }}
            >
              {notification.title}
            </Typography>
            <Typography variant="caption" color="text.disabled">
              {formatTime(notification.createdAt)}
            </Typography>
          </Box>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mt: 0.5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical'
            }}
          >
            {notification.body}
          </Typography>
          {notification.data?.serviceCode && (
            <Chip
              label={notification.data.serviceCode}
              size="small"
              sx={{ mt: 1, fontSize: '0.7rem' }}
            />
          )}
        </Box>
      </Box>
    </Box>
  )
}

/**
 * Componente de badge de notificaciones no leídas
 */
export const NotificationBadge = ({ count }) => {
  if (!count || count === 0) return null

  return (
    <Box
      sx={{
        position: 'absolute',
        top: -4,
        right: -4,
        minWidth: 18,
        height: 18,
        borderRadius: '50%',
        bgcolor: 'error.main',
        color: 'white',
        fontSize: '0.7rem',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 0.5,
        boxShadow: 2
      }}
    >
      {count > 99 ? '99+' : count}
    </Box>
  )
}

/**
 * Componente para mostrar notificación vacía
 */
export const EmptyNotifications = () => (
  <Box
    sx={{
      p: 4,
      textAlign: 'center',
      color: 'text.secondary'
    }}
  >
    <NotificationIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
    <Typography variant="body2">No hay notificaciones</Typography>
  </Box>
)

export default NotificationItem
