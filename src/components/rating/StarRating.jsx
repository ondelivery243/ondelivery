// src/components/rating/StarRating.jsx
import { useState } from 'react'
import { Box, Typography, useTheme } from '@mui/material'
import { Star as StarIcon, StarBorder as StarBorderIcon } from '@mui/icons-material'

/**
 * StarRating - Componente de estrellas para calificar
 * 
 * @param {number} value - Valor actual (0-5)
 * @param {function} onChange - Callback cuando cambia el valor
 * @param {boolean} readOnly - Si es solo lectura (para mostrar calificaciones)
 * @param {string} size - Tamaño: 'small' | 'medium' | 'large'
 * @param {boolean} showValue - Mostrar el valor numérico
 * @param {boolean} showLabel - Mostrar etiqueta descriptiva
 */
export default function StarRating({
  value = 0,
  onChange,
  readOnly = false,
  size = 'medium',
  showValue = false,
  showLabel = false,
  compact = false
}) {
  const theme = useTheme()
  const [hoverValue, setHoverValue] = useState(0)

  // Tamaños configurables
  const sizes = {
    small: { star: 20, gap: 0.25, fontSize: '0.75rem' },
    medium: { star: 28, gap: 0.5, fontSize: '0.875rem' },
    large: { star: 40, gap: 0.75, fontSize: '1.25rem' }
  }

  const config = sizes[size] || sizes.medium

  // Obtener etiqueta según el valor
  const getLabel = (val) => {
    const labels = {
      0: 'Sin calificar',
      1: 'Muy malo',
      2: 'Malo',
      3: 'Regular',
      4: 'Bueno',
      5: 'Excelente'
    }
    return labels[Math.round(val)] || 'Sin calificar'
  }

  // Color según el valor
  const getStarColor = (val) => {
    if (val >= 4) return theme.palette.warning.main // Amarillo/oro para alto
    if (val >= 3) return theme.palette.warning.light
    if (val >= 2) return theme.palette.grey[400]
    return theme.palette.grey[300]
  }

  // Manejar click en estrella
  const handleClick = (starIndex) => {
    if (readOnly) return
    onChange?.(starIndex)
  }

  // Manejar hover
  const handleMouseEnter = (starIndex) => {
    if (readOnly) return
    setHoverValue(starIndex)
  }

  const handleMouseLeave = () => {
    if (readOnly) return
    setHoverValue(0)
  }

  // Valor actual a mostrar (hover o real)
  const displayValue = hoverValue || value

  // Modo compacto (muestra estrellas pequeñas con valor)
  if (compact) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <StarIcon sx={{ fontSize: 16, color: 'warning.main' }} />
        <Typography variant="body2" fontWeight="bold">
          {value.toFixed(1)}
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      {/* Estrellas */}
      <Box
        sx={{
          display: 'flex',
          gap: config.gap,
          cursor: readOnly ? 'default' : 'pointer'
        }}
        onMouseLeave={handleMouseLeave}
      >
        {[1, 2, 3, 4, 5].map((starIndex) => {
          const isFilled = starIndex <= displayValue
          const isHalfFilled = !isFilled && starIndex - 0.5 <= displayValue

          return (
            <Box
              key={starIndex}
              onClick={() => handleClick(starIndex)}
              onMouseEnter={() => handleMouseEnter(starIndex)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 0.1s ease',
                '&:hover': readOnly ? {} : {
                  transform: 'scale(1.1)'
                }
              }}
            >
              {isFilled ? (
                <StarIcon
                  sx={{
                    fontSize: config.star,
                    color: getStarColor(displayValue),
                    transition: 'color 0.2s ease'
                  }}
                />
              ) : isHalfFilled ? (
                // Estrella media (usando clip-path)
                <Box sx={{ position: 'relative' }}>
                  <StarBorderIcon
                    sx={{
                      fontSize: config.star,
                      color: theme.palette.grey[300],
                      position: 'absolute'
                    }}
                  />
                  <StarIcon
                    sx={{
                      fontSize: config.star,
                      color: getStarColor(displayValue),
                      clipPath: 'polygon(0 0, 50% 0, 50% 100%, 0 100%)'
                    }}
                  />
                </Box>
              ) : (
                <StarBorderIcon
                  sx={{
                    fontSize: config.star,
                    color: theme.palette.grey[300]
                  }}
                />
              )}
            </Box>
          )
        })}
      </Box>

      {/* Valor numérico */}
      {showValue && (
        <Typography
          variant="h6"
          fontWeight="bold"
          sx={{ color: getStarColor(value) }}
        >
          {value.toFixed(1)}
        </Typography>
      )}

      {/* Etiqueta descriptiva */}
      {showLabel && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontSize: config.fontSize }}
        >
          {getLabel(displayValue)}
        </Typography>
      )}
    </Box>
  )
}

/**
 * MiniStarRating - Versión compacta para listas
 */
export function MiniStarRating({ value = 0, total = 0, size = 'small' }) {
  const starSize = size === 'small' ? 14 : 18

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <StarIcon sx={{ fontSize: starSize, color: 'warning.main' }} />
      <Typography variant="body2" fontWeight="bold" color="text.primary">
        {value.toFixed(1)}
      </Typography>
      {total > 0 && (
        <Typography variant="caption" color="text.secondary">
          ({total})
        </Typography>
      )}
    </Box>
  )
}
