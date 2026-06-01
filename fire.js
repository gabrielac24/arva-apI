const admin = require('firebase-admin');

// 🔒 Leemos TODA la configuración de golpe desde una sola variable
const serviceAccount = JSON.parse(process.env.FIREBASE_JSON_COMPLETO);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;