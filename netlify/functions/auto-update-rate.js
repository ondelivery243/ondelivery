// netlify/functions/auto-update-rate.js
import admin from 'firebase-admin';

const API_URL = 'https://api-alcambio.onrender.com/tasas';

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

// Horarios de operación (hora Venezuela)
const WAKE_UP_HOUR = 14;      // 2:00 PM
const WAKE_UP_MINUTE = 58;    // 14:58
const START_HOUR = 15;        // 3:00 PM
const END_HOUR = 22;          // 10:00 PM
const UPDATE_INTERVAL = 3;    // Cada 3 minutos

export const handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: securityHeaders, body: '' };
  }

  if (!initializeFirebase()) return { 
    statusCode: 500, 
    body: JSON.stringify({ error: 'Error Firebase' }), 
    headers: securityHeaders 
  };

  const now = new Date();
  // Hora Venezuela (UTC-4)
  const vesTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Caracas" }));
  const currentHour = vesTime.getHours();
  const currentMinute = vesTime.getMinutes();
  const currentDay = vesTime.getDay(); // 0=domingo, 6=sabado

  // Solo trabajamos de lunes a viernes (1-5)
  const isWeekday = currentDay >= 1 && currentDay <= 5;

  // ----------------------------------------------------------------
  // 14:58 LUNES A VIERNES: DESPERTAR API (PING)
  // ----------------------------------------------------------------
  if (isWeekday && currentHour === WAKE_UP_HOUR && currentMinute === WAKE_UP_MINUTE) {
    console.log(`⏰ ${currentHour}:${currentMinute} - Enviando ping para despertar Render...`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      await fetch(API_URL, { signal: controller.signal });
      clearTimeout(timeoutId);
    } catch (e) {
      // Esperado: timeout o error. La API está despertando.
    }
    
    console.log("✅ Ping enviado. API despertando...");
    
    return { 
      statusCode: 200, 
      headers: securityHeaders,
      body: JSON.stringify({ 
        action: "wake-up", 
        time: `${currentHour}:${currentMinute}`,
        message: "API despertando para el horario de actualización" 
      }) 
    };
  }

  // ----------------------------------------------------------------
  // 15:00 - 22:00 LUNES A VIERNES: ACTUALIZAR TASA CADA 3 MIN
  // ----------------------------------------------------------------
  const isInUpdateWindow = isWeekday && currentHour >= START_HOUR && currentHour <= END_HOUR;
  const shouldUpdateNow = currentMinute % UPDATE_INTERVAL === 0;

  if (isInUpdateWindow && shouldUpdateNow) {
    console.log(`📊 ${currentHour}:${currentMinute} - Verificando tasa del dolar...`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      
      const response = await fetch(API_URL, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

      const data = await response.json();
      const rate = data?.tasas?.dolar;

      if (!rate || isNaN(parseFloat(rate))) {
        throw new Error(`Valor dolar inválido recibido`);
      }

      // Obtener tasa anterior
      const docSnap = await db.collection('settings').doc('app_config').get();
      const previousRate = docSnap.exists ? (docSnap.data().exchangeRate || 0) : 0;

      // ✅ CAMBIO: Comparar tasas con 2 decimales
      const previousFormatted = parseFloat(previousRate).toFixed(2);
      const newFormatted = parseFloat(rate).toFixed(2);

      // ✅ SOLO ESCRIBIR EN FIREBASE SI LA TASA CAMBIÓ
      if (previousFormatted === newFormatted) {
        console.log(`💤 Tasa sin cambios: ${rate} Bs/$ (no se escribe en Firebase)`);
        return { 
          statusCode: 200, 
          headers: securityHeaders,
          body: JSON.stringify({ 
            success: true, 
            updated: false,
            rate: parseFloat(rate),
            previousRate: parseFloat(previousRate),
            time: `${currentHour}:${String(currentMinute).padStart(2, '0')}`,
            message: `Tasa sin cambios: ${rate} Bs/$`
          }) 
        };
      }

      // ✅ LA TASA CAMBIÓ - Escribir en Firestore
      await db.collection('settings').doc('app_config').set({
        exchangeRate: Number(rate),
        lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
        previousRate: previousRate,
        source: 'api-alcambio.onrender.com'
      }, { merge: true });

      console.log(`✅ Tasa ACTUALIZADA: ${rate} Bs/$ (anterior: ${previousRate})`);
      
      return { 
        statusCode: 200, 
        headers: securityHeaders,
        body: JSON.stringify({ 
          success: true, 
          updated: true,
          rate: parseFloat(rate),
          previousRate: parseFloat(previousRate),
          time: `${currentHour}:${String(currentMinute).padStart(2, '0')}`,
          message: `Tasa actualizada: ${rate} Bs/$`
        }) 
      };

    } catch (error) {
      console.error("❌ Error actualizando tasa:", error.message);
      return { 
        statusCode: 500, 
        headers: securityHeaders,
        body: JSON.stringify({ error: error.toString() }) 
      };
    }
  }

  // ----------------------------------------------------------------
  // FUERA DE HORARIO: NO HACER NADA
  // ----------------------------------------------------------------
  const statusMessage = {
    weekday: isWeekday ? 'Sí' : 'No',
    currentTime: `${currentHour}:${String(currentMinute).padStart(2, '0')}`,
    updateWindow: `${START_HOUR}:00 - ${END_HOUR}:00`,
    nextAction: isWeekday ? 
      (currentHour < WAKE_UP_HOUR ? `Esperando ${WAKE_UP_HOUR}:${WAKE_UP_MINUTE} para despertar API` :
       currentHour < START_HOUR ? `Esperando ${START_HOUR}:00 para comenzar actualizaciones` :
       currentHour > END_HOUR ? `Esperando próximo día hábil` :
       `Próxima actualización en minuto ${Math.ceil(currentMinute / UPDATE_INTERVAL) * UPDATE_INTERVAL}`) :
      'Esperando día hábil (Lunes a Viernes)'
  };

  console.log(`💤 Fuera de horario de actualización. ${statusMessage.nextAction}`);

  return { 
    statusCode: 200, 
    headers: securityHeaders,
    body: JSON.stringify({ 
      action: "idle",
      status: statusMessage
    }) 
  };
};