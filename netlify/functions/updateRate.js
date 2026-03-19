// netlify/functions/updateRate.js
import admin from 'firebase-admin';

const ALCAMBIO_API_URL = 'https://api-alcambio.onrender.com/tasas';
const TIMEOUT_MS = 30000; // 30 segundos

let db = null;

function initializeFirebase() {
  if (db) return true;
  try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error("Falta FIREBASE_SERVICE_ACCOUNT");
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    db = admin.firestore();
    return true;
  } catch (error) { 
    console.error("Error Firebase:", error.message); 
    return false; 
  }
}

const securityHeaders = { 
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: securityHeaders, body: '' };
  }

  if (!initializeFirebase()) return { 
    statusCode: 500, 
    body: JSON.stringify({ error: 'Error Firebase' }), 
    headers: securityHeaders 
  };

  try {
    const configRef = db.collection('settings').doc('app_config');
    const docSnap = await configRef.get();
    const currentRate = docSnap.exists ? (docSnap.data().exchangeRate || 0) : 0;

    console.log('🔄 Obteniendo tasa desde API...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(ALCAMBIO_API_URL, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`Error API: ${response.status}`);

    const data = await response.json();
    console.log('📦 Respuesta API:', JSON.stringify(data));
    
    // La API devuelve: { tasas: { dolar: 451.50, euro: 520.64, usdt: 666.19 } }
    const newRate = data?.tasas?.dolar;
    
    if (!newRate || typeof newRate !== 'number') {
      throw new Error(`Formato inesperado - no se encontro dolar. Respuesta: ${JSON.stringify(data)}`);
    }

    if (newRate < 1 || newRate > 1000) return { 
      statusCode: 200, 
      body: JSON.stringify({ success: false, message: 'Tasa fuera de rango' }), 
      headers: securityHeaders 
    };

    const currentFormatted = parseFloat(currentRate).toFixed(2);
    const newFormatted = parseFloat(newRate).toFixed(2);

    if (currentFormatted === newFormatted) {
      return { 
        statusCode: 200, 
        body: JSON.stringify({ success: true, message: 'Sin cambios', rate: newRate }), 
        headers: securityHeaders 
      };
    }

    await configRef.set({
      exchangeRate: newRate,
      lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
      previousRate: currentRate,
      source: 'api-alcambio.onrender.com'
    }, { merge: true });

    console.log('✅ Tasa actualizada:', newRate);

    return { 
      statusCode: 200, 
      body: JSON.stringify({ success: true, updated: true, rate: newRate }), 
      headers: securityHeaders 
    };

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.name === 'AbortError') return { 
      statusCode: 504, 
      body: JSON.stringify({ error: 'Timeout - la API tardó demasiado' }), 
      headers: securityHeaders 
    };
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: error.message }), 
      headers: securityHeaders 
    };
  }
};