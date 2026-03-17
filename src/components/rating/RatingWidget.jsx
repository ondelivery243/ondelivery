// src/components/rating/RatingWidget.jsx
import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Paper,
  Stack,
  LinearProgress,
  Avatar,
  Divider,
  Skeleton,
  Chip
} from '@mui/material'
import {
  Star as StarIcon,
  TwoWheeler as BikeIcon,
  Store as StoreIcon
} from '@mui/icons-material'
import { MiniStarRating } from './StarRating'
import {
  getDriverRatings,
  getDriverRatingStats,
  subscribeToDriverRatings,
  formatRelativeTime,
  RATING_TAGS
} from '../../services/ratingService'

/**
 * RatingWidget - Widget completo de calificaciones para perfil de repartidor
 * 
 * @param {string} driverId - ID del repartidor
 * @param {object} driverData - Datos del repartidor (rating, totalRatings)
 * @param {boolean} showReviews - Mostrar últimas reseñas
 * @param {boolean} compact - Modo compacto
 */
export default function RatingWidget({
  driverId,
  driverData,
  showReviews = true,
  compact = false
}) {
  const [stats, setStats] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  // Cargar estadísticas y reviews
  useEffect(() => {
    if (!driverId) return

    const loadData = async () => {
      setLoading(true)
      
      // Cargar estadísticas
      const statsData = await getDriverRatingStats(driverId)
      setStats(statsData)

      // Cargar últimas reviews
      if (showReviews) {
        const ratingsData = await getDriverRatings(driverId, 5)
        setReviews(ratingsData)
      }
      
      setLoading(false)
    }

    loadData()

    // Suscribirse a cambios en tiempo real
    const unsubscribe = subscribeToDriverRatings(driverId, (newReviews) => {
      setReviews(newReviews)
    })

    return () => unsubscribe()
  }, [driverId, showReviews])

  // Modo compacto - solo muestra el rating
  if (compact) {
    return (
      <MiniStarRating
        value={driverData?.rating || stats?.average || 0}
        total={driverData?.totalRatings || stats?.total || 0}
        size="medium"
      />
    )
  }

  if (loading) {
    return (
      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <Skeleton variant="text" width={100} height={40} />
        <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 1, mt: 1 }} />
      </Paper>
    )
  }

  const average = driverData?.rating || stats?.average || 0
  const total = driverData?.totalRatings || stats?.total || 0
  const distribution = stats?.distribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }

  return (
    <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
      {/* Header con rating principal */}
      <Box
        sx={{
          p: 3,
          bgcolor: 'primary.main',
          color: 'white',
          textAlign: 'center'
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, mb: 1 }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <StarIcon
              key={star}
              sx={{
                fontSize: 28,
                color: star <= Math.round(average) ? 'warning.main' : 'rgba(255,255,255,0.3)'
              }}
            />
          ))}
        </Box>
        <Typography variant="h3" fontWeight="bold">
          {average.toFixed(1)}
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.8 }}>
          {total} calificacion{total !== 1 ? 'es' : ''}
        </Typography>
      </Box>

      {/* Distribución */}
      <Box sx={{ p: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
          Distribución
        </Typography>
        
        {[5, 4, 3, 2, 1].map((stars) => {
          const count = distribution[stars] || 0
          const percentage = total > 0 ? (count / total) * 100 : 0
          
          return (
            <Box
              key={stars}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mb: 0.5
              }}
            >
              <Typography variant="body2" sx={{ width: 20, textAlign: 'right' }}>
                {stars}
              </Typography>
              <StarIcon sx={{ fontSize: 16, color: 'warning.main' }} />
              <LinearProgress
                variant="determinate"
                value={percentage}
                sx={{
                  flex: 1,
                  height: 8,
                  borderRadius: 4,
                  bgcolor: 'grey.200',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: stars >= 4 ? 'success.main' : stars >= 3 ? 'warning.main' : 'error.main',
                    borderRadius: 4
                  }
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ width: 40 }}>
                {percentage > 0 ? `${percentage.toFixed(0)}%` : '0%'}
              </Typography>
            </Box>
          )
        })}
      </Box>

      {/* Últimas reseñas */}
      {showReviews && reviews.length > 0 && (
        <>
          <Divider />
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
              Últimas Reseñas
            </Typography>
            
            <Stack spacing={2}>
              {reviews.slice(0, 5).map((review) => (
                <ReviewItem key={review.id} review={review} />
              ))}
            </Stack>
          </Box>
        </>
      )}

      {/* Sin reviews */}
      {showReviews && reviews.length === 0 && (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <StarIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            Aún no hay calificaciones
          </Typography>
        </Box>
      )}
    </Paper>
  )
}

/**
 * ReviewItem - Item individual de reseña
 */
function ReviewItem({ review }) {
  // Encontrar tags del review
  const reviewTags = (review.tags || []).map(tagId => {
    const allTags = [...RATING_TAGS.positive, ...RATING_TAGS.negative]
    return allTags.find(t => t.id === tagId)
  }).filter(Boolean)

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderRadius: 2,
        bgcolor: 'grey.50'
      }}
    >
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.light' }}>
          <StoreIcon sx={{ fontSize: 18 }} />
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <StarIcon
                  key={star}
                  sx={{
                    fontSize: 14,
                    color: star <= review.rating ? 'warning.main' : 'grey.300'
                  }}
                />
              ))}
            </Box>
            <Typography variant="caption" color="text.disabled">
              {formatRelativeTime(review.createdAt)}
            </Typography>
          </Stack>
          
          {review.comment && (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              "{review.comment}"
            </Typography>
          )}
          
          {reviewTags.length > 0 && (
            <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {reviewTags.map(tag => (
                <Chip
                  key={tag.id}
                  label={`${tag.emoji} ${tag.label}`}
                  size="small"
                  sx={{ 
                    height: 20, 
                    fontSize: '0.65rem',
                    '& .MuiChip-label': { px: 0.75 }
                  }}
                />
              ))}
            </Box>
          )}
        </Box>
      </Stack>
    </Paper>
  )
}

/**
 * RatingBadge - Badge compacto para mostrar en cards
 */
export function RatingBadge({ rating, size = 'medium' }) {
  const fontSize = size === 'small' ? '0.75rem' : '0.875rem'
  const iconSize = size === 'small' ? 14 : 16

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        bgcolor: rating >= 4 ? 'success.light' : rating >= 3 ? 'warning.light' : 'grey.100',
        px: 1,
        py: 0.25,
        borderRadius: 1
      }}
    >
      <StarIcon sx={{ fontSize: iconSize, color: 'warning.main' }} />
      <Typography
        variant="body2"
        fontWeight="bold"
        sx={{ fontSize }}
      >
        {rating.toFixed(1)}
      </Typography>
    </Box>
  )
}
