// netlify/functions/uploadImage.js
// Netlify Function: Upload Image to ImgBB
// Sube imágenes a ImgBB (alternativa gratuita a Firebase Storage)

const IMGBB_API_KEY = process.env.IMGBB_API_KEY

export const handler = async (event) => {
  // Solo permitir POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Método no permitido' })
    }
  }

  try {
    const body = JSON.parse(event.body)
    const { image, name } = body

    if (!image) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Imagen requerida (base64)' })
      }
    }

    if (!IMGBB_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'IMGBB_API_KEY no configurada' })
      }
    }

    // Subir a ImgBB
    const formData = new URLSearchParams()
    formData.append('image', image)
    if (name) {
      formData.append('name', name)
    }

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Error subiendo imagen')
    }

    const result = await response.json()

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        url: result.data.url,
        delete_url: result.data.delete_url,
        thumbnail: result.data.thumb?.url
      })
    }
  } catch (error) {
    console.error('Error subiendo imagen:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    }
  }
}
