const admin = require('firebase-admin');

// 🔒 Le decimos al código que busque las llaves en el "aire" (Variables de Entorno)
const serviceAccount = {
  project_id: process.env.FIREBASE_PROJECT_ID,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  // Esta línea mágica arregla los saltos de línea de la llave privada
  private_key: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;