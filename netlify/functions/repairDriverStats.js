// netlify/functions/repairDriverStats.js
import admin from 'firebase-admin';

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

/**
 * Función para reparar las estadísticas de los repartidores
 * Recalcula totalServices y totalEarnings basándose en los servicios reales
 */
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
    console.log('🔧 Iniciando reparación de estadísticas de repartidores...');

    // 1. Obtener todos los servicios completados
    const servicesSnapshot = await db.collection('services')
      .where('status', '==', 'entregado')
      .get();

    console.log(`📦 Servicios completados encontrados: ${servicesSnapshot.size}`);

    // 2. Agrupar servicios por driverId
    const driverStats = {};
    
    servicesSnapshot.docs.forEach(doc => {
      const service = doc.data();
      const driverId = service.driverId;
      
      if (driverId) {
        if (!driverStats[driverId]) {
          driverStats[driverId] = {
            totalServices: 0,
            totalEarnings: 0
          };
        }
        driverStats[driverId].totalServices += 1;
        driverStats[driverId].totalEarnings += service.driverEarnings || 0;
      }
    });

    // 3. Obtener todos los repartidores
    const driversSnapshot = await db.collection('drivers').get();
    const batch = db.batch();
    let updatedCount = 0;
    const results = [];

    driversSnapshot.docs.forEach(doc => {
      const driverId = doc.id;
      const driverData = doc.data();
      const realStats = driverStats[driverId] || { totalServices: 0, totalEarnings: 0 };
      
      const currentServices = driverData.totalServices || 0;
      const currentEarnings = driverData.totalEarnings || 0;
      
      // Solo actualizar si hay diferencia
      if (currentServices !== realStats.totalServices || currentEarnings !== realStats.totalEarnings) {
        const driverRef = db.collection('drivers').doc(driverId);
        batch.update(driverRef, {
          totalServices: realStats.totalServices,
          totalEarnings: realStats.totalEarnings,
          statsRepairedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        updatedCount++;
        results.push({
          driverId,
          driverName: driverData.name,
          before: { totalServices: currentServices, totalEarnings: currentEarnings },
          after: { totalServices: realStats.totalServices, totalEarnings: realStats.totalEarnings }
        });
        
        console.log(`📝 ${driverData.name}: ${currentServices} → ${realStats.totalServices} servicios`);
      }
    });

    // 4. Ejecutar batch si hay cambios
    if (updatedCount > 0) {
      await batch.commit();
      console.log(`✅ ${updatedCount} repartidores actualizados`);
    } else {
      console.log('✅ Todos los contadores están correctos');
    }

    return { 
      statusCode: 200, 
      body: JSON.stringify({ 
        success: true,
        message: `Reparación completada. ${updatedCount} repartidores actualizados.`,
        servicesAnalyzed: servicesSnapshot.size,
        driversUpdated: updatedCount,
        details: results
      }), 
      headers: securityHeaders 
    };

  } catch (error) {
    console.error('❌ Error en reparación:', error.message);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: error.message }), 
      headers: securityHeaders 
    };
  }
};