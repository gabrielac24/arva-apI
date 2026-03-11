const admin = require('firebase-admin');

// ¡OJO AQUÍ! Cambia 'nombre-de-tu-archivo.json' por el nombre EXACTO 
// del archivo de credenciales que descargaste de Firebase.
const serviceAccount = require('./clavearva.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;