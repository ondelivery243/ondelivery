// src/components/tracking/LiveMap.jsx
import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Box, Paper, Typography, Chip, Stack, IconButton, Tooltip, alpha, useTheme } from '@mui/material'
import {
  LocalShipping as DeliveryIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as CenterIcon
} from '@mui/icons-material'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

// Fix para los iconos de Leaflet en Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Iconos personalizados
const createDriverIcon = (heading = 0) => {
  return L.divIcon({
    className: 'driver-marker',
    html: `
      <div style="
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #10B981;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        transform: rotate(${heading}deg);
        transition: transform 0.3s ease;
      ">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
          <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
        </svg>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  })
}

const restaurantIcon = L.divIcon({
  className: 'restaurant-marker',
  html: `
    <div style="
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #FF6B35;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    ">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
      </svg>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
})

const destinationIcon = L.divIcon({
  className: 'destination-marker',
  html: `
    <div style="
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #EF4444;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    ">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
      </svg>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
})

// Componente para centrar el mapa
const MapCenterer = ({ center, zoom }) => {
  const map = useMap()
  
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom || 15, { duration: 0.5 })
    }
  }, [center, zoom, map])
  
  return null
}

// Controles del mapa
const MapControls = ({ onCenter }) => {
  const map = useMap()
  
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5
      }}
    >
      <Tooltip title="Centrar">
        <IconButton
          size="small"
          onClick={onCenter}
          sx={{ bgcolor: 'white', boxShadow: 2, '&:hover': { bgcolor: 'grey.100' } }}
        >
          <CenterIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Acercar">
        <IconButton
          size="small"
          onClick={() => map.zoomIn()}
          sx={{ bgcolor: 'white', boxShadow: 2, '&:hover': { bgcolor: 'grey.100' } }}
        >
          <ZoomInIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Alejar">
        <IconButton
          size="small"
          onClick={() => map.zoomOut()}
          sx={{ bgcolor: 'white', boxShadow: 2, '&:hover': { bgcolor: 'grey.100' } }}
        >
          <ZoomOutIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  )
}

/**
 * Componente principal LiveMap
 * @param {Object} driverLocation - {latitude, longitude, heading, speed, timestamp}
 * @param {Object} restaurantLocation - {latitude, longitude}
 * @param {Object} destinationLocation - {latitude, longitude}
 * @param {Array} route - Array de puntos de la ruta [{lat, lng}]
 * @param {boolean} showDriver - Mostrar ubicación del conductor
 * @param {boolean} showRoute - Mostrar ruta
 */
const LiveMap = ({
  driverLocation,
  restaurantLocation,
  destinationLocation,
  route = [],
  showDriver = true,
  showRoute = true,
  onMapReady,
  height = 400,
  interactive = true
}) => {
  const theme = useTheme()
  const mapRef = useRef(null)
  const [mapCenter, setMapCenter] = useState([10.2549, -67.5984]) // Maracay por defecto
  
  // Actualizar centro cuando cambia la ubicación del conductor
  useEffect(() => {
    if (driverLocation?.latitude && driverLocation?.longitude) {
      setMapCenter([driverLocation.latitude, driverLocation.longitude])
    } else if (restaurantLocation?.latitude && restaurantLocation?.longitude) {
      setMapCenter([restaurantLocation.latitude, restaurantLocation.longitude])
    }
  }, [driverLocation, restaurantLocation])

  // Centrar en conductor
  const handleCenter = () => {
    if (driverLocation?.latitude && driverLocation?.longitude) {
      setMapCenter([driverLocation.latitude, driverLocation.longitude])
    }
  }

  // Calcular tiempo desde última actualización
  const getLastUpdateText = () => {
    if (!driverLocation?.timestamp) return 'Sin datos'
    return `Hace ${formatDistanceToNow(new Date(driverLocation.timestamp), { locale: es })}`
  }

  // Verificar si la ubicación es válida (menos de 2 minutos)
  const isLocationValid = () => {
    if (!driverLocation?.timestamp) return false
    return Date.now() - driverLocation.timestamp < 120000
  }

  return (
    <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden' }}>
      {/* Header con info del tracking */}
      {driverLocation && (
        <Paper
          elevation={0}
          sx={{
            position: 'absolute',
            top: 10,
            left: 10,
            zIndex: 1000,
            p: 1.5,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.background.paper, 0.95),
            backdropFilter: 'blur(4px)'
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <DeliveryIcon color={isLocationValid() ? 'success' : 'disabled'} />
            <Box>
              <Typography variant="subtitle2" fontWeight="bold">
                {isLocationValid() ? 'En camino' : 'Sin senal'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {getLastUpdateText()}
              </Typography>
            </Box>
            {driverLocation.speed > 0 && (
              <Chip
                label={`${(driverLocation.speed * 3.6).toFixed(0)} km/h`}
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
          </Stack>
        </Paper>
      )}

      {/* Mapa */}
      <MapContainer
        center={mapCenter}
        zoom={15}
        style={{ height, width: '100%', zIndex: 1 }}
        scrollWheelZoom={interactive}
        dragging={interactive}
        zoomControl={false}
        whenCreated={(map) => {
          mapRef.current = map
          if (onMapReady) onMapReady(map)
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapCenterer center={mapCenter} />

        {/* Restaurante */}
        {restaurantLocation?.latitude && restaurantLocation?.longitude && (
          <Marker
            position={[restaurantLocation.latitude, restaurantLocation.longitude]}
            icon={restaurantIcon}
          >
            <Popup>
              <Typography variant="subtitle2" fontWeight="bold">
                Punto de recogida
              </Typography>
            </Popup>
          </Marker>
        )}

        {/* Destino */}
        {destinationLocation?.latitude && destinationLocation?.longitude && (
          <Marker
            position={[destinationLocation.latitude, destinationLocation.longitude]}
            icon={destinationIcon}
          >
            <Popup>
              <Typography variant="subtitle2" fontWeight="bold">
                Punto de entrega
              </Typography>
            </Popup>
          </Marker>
        )}

        {/* Ruta */}
        {showRoute && route.length > 1 && (
          <Polyline
            positions={route.map(p => [p.latitude || p.lat, p.longitude || p.lng])}
            color="#10B981"
            weight={4}
            opacity={0.8}
            dashArray="5, 10"
          />
        )}

        {/* Conductor */}
        {showDriver && driverLocation?.latitude && driverLocation?.longitude && (
          <>
            {/* Circulo de precision */}
            {driverLocation.accuracy && (
              <Circle
                center={[driverLocation.latitude, driverLocation.longitude]}
                radius={driverLocation.accuracy}
                pathOptions={{
                  color: '#10B981',
                  fillColor: '#10B981',
                  fillOpacity: 0.1,
                  weight: 1
                }}
              />
            )}
            {/* Marcador del conductor */}
            <Marker
              position={[driverLocation.latitude, driverLocation.longitude]}
              icon={createDriverIcon(driverLocation.heading)}
            >
              <Popup>
                <Box sx={{ p: 1 }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                    Repartidor
                  </Typography>
                  {driverLocation.speed > 0 && (
                    <Typography variant="body2">
                      Velocidad: {(driverLocation.speed * 3.6).toFixed(1)} km/h
                    </Typography>
                  )}
                  <Typography variant="body2" color="text.secondary">
                    {getLastUpdateText()}
                  </Typography>
                </Box>
              </Popup>
            </Marker>
          </>
        )}

        {/* Controles */}
        {interactive && (
          <MapControls onCenter={handleCenter} />
        )}
      </MapContainer>
    </Box>
  )
}

export default LiveMap

// Exportar tambien iconos para uso externo
export { createDriverIcon, restaurantIcon, destinationIcon }
