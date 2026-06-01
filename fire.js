const admin = require('firebase-admin');

// 🔒 Le decimos al código que busque las llaves en el "aire" (Variables de Entorno)
const serviceAccount = {
  project_id: process.env.FIREBASE_PROJECT_ID,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  // Limpieza extrema: convierte \n en saltos reales, quita comillas y espacios extra
  private_key: process.env.FIREBASE_PRIVATE_KEY 
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/"/g, '').trim() 
    : undefined,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;