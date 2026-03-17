// netlify/functions/updateRate.js
import admin from 'firebase-admin';

const BCV_API_URL = 'https://bcv.justcarlux.dev/api/v1/rates';
const TIMEOUT_MS = 8000;

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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(BCV_API_URL, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`Error API: ${response.status}`);

    const data = await response.json();
    if (!data?.rates?.usd || typeof data.rates.usd !== 'number') throw new Error('Formato inesperado');

    const newRate = data.rates.usd;
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
      source: 'bcv.justcarlux.dev'
    }, { merge: true });

    return { 
      statusCode: 200, 
      body: JSON.stringify({ success: true, updated: true, rate: newRate }), 
      headers: securityHeaders 
    };

  } catch (error) {
    if (error.name === 'AbortError') return { 
      statusCode: 504, 
      body: JSON.stringify({ error: 'Timeout' }), 
      headers: securityHeaders 
    };
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: error.message }), 
      headers: securityHeaders 
    };
  }
};
