// Netlify Function: Geocoding
// Convierte direcciones a coordenadas usando OpenStreetMap Nominatim

export const handler = async (event) => {
  // Solo permitir GET
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Método no permitido' })
    }
  }

  try {
    const { address } = event.queryStringParameters || {}

    if (!address) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Dirección requerida' })
      }
    }

    // Usar Nominatim de OpenStreetMap (gratis, sin API key)
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=ve`

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ON-Delivery-Maracay/1.0'
      }
    })

    if (!response.ok) {
      throw new Error('Error en el servicio de geocoding')
    }

    const data = await response.json()

    if (data.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Dirección no encontrada' })
      }
    }

    const result = data[0]

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        display_name: result.display_name
      })
    }
  } catch (error) {
    console.error('Error en geocoding:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    }
  }
}
