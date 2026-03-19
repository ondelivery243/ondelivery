// src/components/rating/RatingModal.jsx
import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  TextField,
  Chip,
  Stack,
  Avatar,
  Paper,
  CircularProgress,
  Fade,
  Divider,
  IconButton,
  Alert
} from '@mui/material'
import {
  Close as CloseIcon,
  Send as SendIcon,
  Check as CheckIcon,
  TwoWheeler as BikeIcon,
  EmojiEvents as TrophyIcon,
  Warning as WarningIcon
} from '@mui/icons-material'
import { useSnackbar } from 'notistack'
import StarRating from './StarRating'
import { submitRating, RATING_TAGS, getRatingLabel } from '../../services/ratingService'

/**
 * RatingModal - Modal para calificar un servicio completado
 * 
 * @param {boolean} open - Si el modal está abierto
 * @param {function} onClose - Callback para cerrar (SIEMPRE disponible)
 * @param {object} service - Datos del servicio
 * @param {object} driver - Datos del repartidor
 * @param {string} restaurantId - ID del restaurante
 * @param {function} onRated - Callback después de calificar
 */
export default function RatingModal({
  open,
  onClose,
  service,
  driver,
  restaurantId,
  onRated
}) {
  const { enqueueSnackbar } = useSnackbar()
  
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [validationError, setValidationError] = useState(null)

  // Resetear estado cuando se abre el modal
  useEffect(() => {
    if (open) {
      setRating(0)
      setComment('')
      setSelectedTags([])
      setSubmitted(false)
      setValidationError(null)
      
      // Validar datos al abrir
      console.log('📋 RatingModal abierto con:')
      console.log('  - service:', service)
      console.log('  - driver:', driver)
      console.log('  - restaurantId:', restaurantId)
      
      if (!service?.id) {
        setValidationError('No se encontró información del servicio')
      } else if (!driver?.id) {
        setValidationError('No se encontró información del repartidor')
      } else if (!restaurantId) {
        setValidationError('No se encontró información del restaurante')
      }
    }
  }, [open, service, driver, restaurantId])

  // Tags disponibles según el rating
  const availableTags = rating >= 3 
    ? RATING_TAGS.positive 
    : rating > 0 
      ? [...RATING_TAGS.positive.slice(0, 2), ...RATING_TAGS.negative]
      : []

  // Toggle tag selection
  const handleTagToggle = (tagId) => {
    setSelectedTags(prev => 
      prev.includes(tagId)
        ? prev.filter(t => t !== tagId)
        : [...prev, tagId]
    )
  }

  // Enviar calificación
  const handleSubmit = async () => {
    // Validaciones
    if (rating === 0) {
      enqueueSnackbar('Por favor selecciona una calificación', { variant: 'warning' })
      return
    }

    // Validar datos mínimos
    if (!service?.id) {
      enqueueSnackbar('Error: No se encontró el ID del servicio', { variant: 'error' })
      return
    }
    
    if (!driver?.id) {
      enqueueSnackbar('Error: No se encontró el ID del repartidor', { variant: 'error' })
      return
    }
    
    if (!restaurantId) {
      enqueueSnackbar('Error: No se encontró el ID del restaurante', { variant: 'error' })
      return
    }

    setSubmitting(true)

    try {
      const result = await submitRating(
        service.id,
        restaurantId,
        driver.id,
        rating,
        comment,
        selectedTags
      )

      if (result.success) {
        setSubmitted(true)
        enqueueSnackbar('¡Gracias por tu calificación!', { variant: 'success' })
        
        // Callback después de 1.5 segundos
        setTimeout(() => {
          onRated?.()
          onClose()
        }, 1500)
      } else {
        enqueueSnackbar(result.error || 'Error al enviar calificación', { variant: 'error' })
      }
    } catch (error) {
      console.error('Error enviando calificación:', error)
      enqueueSnackbar('Error al enviar calificación', { variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  // Cerrar sin calificar - SIEMPRE disponible
  const handleSkip = () => {
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose} // Permite cerrar haciendo clic fuera
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={false}
      PaperProps={{
        sx: { borderRadius: 3 }
      }}
    >
      {/* Header - SIEMPRE con botón de cerrar */}
      <DialogTitle sx={{ textAlign: 'center', pb: 0 }}>
        <IconButton
          onClick={onClose}
          sx={{ 
            position: 'absolute', 
            right: 8, 
            top: 8,
            bgcolor: 'grey.100',
            '&:hover': { bgcolor: 'grey.200' }
          }}
        >
          <CloseIcon />
        </IconButton>
        
        {submitted ? (
          <Fade in={submitted}>
            <Box sx={{ py: 2 }}>
              <TrophyIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
              <Typography variant="h6" fontWeight="bold" color="success.main">
                ¡Calificación Enviada!
              </Typography>
            </Box>
          </Fade>
        ) : (
          <Box sx={{ py: 1 }}>
            <Typography variant="h6" fontWeight="bold" color="primary">
              🎉 ¡Servicio Completado!
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              ¿Cómo fue tu experiencia?
            </Typography>
          </Box>
        )}
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {submitted ? (
          <Fade in={submitted}>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                Tu opinión ayuda a mejorar el servicio
              </Typography>
            </Box>
          </Fade>
        ) : validationError ? (
          // Mostrar error de validación pero permitir cerrar
          <Box sx={{ py: 3 }}>
            <Alert 
              severity="warning" 
              icon={<WarningIcon />}
              sx={{ mb: 2 }}
            >
              {validationError}
            </Alert>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Puedes cerrar este mensaje y volver más tarde.
            </Typography>
          </Box>
        ) : (
          <>
            {/* Info del repartidor */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                mb: 3,
                bgcolor: 'grey.50',
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 2
              }}
            >
              <Avatar
                sx={{
                  width: 56,
                  height: 56,
                  bgcolor: 'success.main',
                  fontSize: '1.5rem'
                }}
              >
                {driver?.name?.charAt(0) || <BikeIcon />}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  {driver?.name || 'Repartidor'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Servicio: {service?.serviceId || 'N/A'}
                </Typography>
              </Box>
              {driver?.rating && (
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body2" fontWeight="bold">
                    ⭐ {driver.rating.toFixed(1)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {driver.totalServices || 0} entregas
                  </Typography>
                </Box>
              )}
            </Paper>

            {/* Estrellas */}
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <StarRating
                value={rating}
                onChange={setRating}
                size="large"
                showLabel
              />
            </Box>

            {/* Tags */}
            {rating > 0 && (
              <Fade in={rating > 0}>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    ¿Qué destacaría? (opcional)
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {availableTags.map((tag) => (
                      <Chip
                        key={tag.id}
                        label={`${tag.emoji} ${tag.label}`}
                        onClick={() => handleTagToggle(tag.id)}
                        variant={selectedTags.includes(tag.id) ? 'filled' : 'outlined'}
                        color={selectedTags.includes(tag.id) ? 'primary' : 'default'}
                        sx={{
                          borderRadius: 2,
                          '&:hover': {
                            bgcolor: 'primary.light'
                          }
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              </Fade>
            )}

            {/* Comentario */}
            {rating > 0 && (
              <Fade in={rating > 0}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="Comentario adicional (opcional)..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  inputProps={{ maxLength: 200 }}
                  helperText={`${comment.length}/200`}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                />
              </Fade>
            )}
          </>
        )}
      </DialogContent>

      {/* Actions - SIEMPRE visible para poder cerrar */}
      {!submitted && (
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button
            onClick={handleSkip}
            fullWidth
            disabled={submitting}
            variant="outlined"
          >
            {validationError ? 'Cerrar' : 'Omitir'}
          </Button>
          {!validationError && (
            <Button
              variant="contained"
              onClick={handleSubmit}
              fullWidth
              disabled={rating === 0 || submitting}
              startIcon={submitting ? <CircularProgress size={20} /> : <SendIcon />}
              sx={{ borderRadius: 2 }}
            >
              {submitting ? 'Enviando...' : 'Enviar Calificación'}
            </Button>
          )}
        </DialogActions>
      )}
    </Dialog>
  )
}