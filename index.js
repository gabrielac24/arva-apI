const express = require('express')
const PORT = process.env.PORT || 5000
var app = express();
var fire = require('./fire') // Aquí se conecta con tu clave de Firebase
var cors = require('cors');
var bodyParser = require('body-parser');

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Pantalla de inicio de la API
app.get('/', (req, res) => {
  res.send(
    '<h1>API Express & Firebase - Proyecto ARVA</h1>' +
    '<ul>' +
    '<li><p><b>GET /ver</b> - Historial completo</p></li>' +
    '<li><p><b>GET /valor</b> - Última lectura</p></li>' +
    '<li><p><b>GET /grafica</b> - Últimos 10 registros</p></li>' +
    '<li><p><b>POST /insertar</b> => {temperatura_ambiental, humedad_ambiental, humedad_suelo, nivel_luz, ph_suelo}</p></li>' +
    '</ul>'
  )
})

// Ver todos los datos (Historial completo)
app.get('/ver', (req, res) => {
  const db = fire.firestore();
  var wholeData = []
  db.collection('Lecturas_ARVA').orderBy('fecha', 'asc').get()
    .then(snapshot => {
      snapshot.forEach(doc => {
        wholeData.push(doc.data())
      });
      console.log("Enviando historial completo...");
      res.send(wholeData)
    })
    .catch(error => {
      console.log('Error!', error);
      res.status(500).send(error);
  })
})

// Ver solo la última lectura (Ideal para la pantalla principal de la App)
app.get('/valor', (req, res) => {
  const db = fire.firestore();
  var wholeData = []
  db.collection('Lecturas_ARVA').limit(1).orderBy('fecha','desc').get()
    .then(snapshot => {
      snapshot.forEach(doc => {
        wholeData.push(doc.data())
      });
      res.send(wholeData)
    })
    .catch(error => {
      console.log('Error!', error);
      res.status(500).send(error);
  })
})

// Ver los últimos 10 datos (Para graficar el comportamiento del clima/suelo)
app.get('/grafica', (req, res) => {
  const db = fire.firestore();
  var wholeData = []
  db.collection('Lecturas_ARVA').limit(10).orderBy('fecha','desc').get()
    .then(snapshot => {
      snapshot.forEach(doc => {
        wholeData.push(doc.data())
      });
      res.send(wholeData)
    })
    .catch(error => {
      console.log('Error!', error);
      res.status(500).send(error);
  })
})

// Ruta donde el ESP32 inyecta los datos de los sensores
app.post('/insertar', (req, res)=>{
  const db = fire.firestore();
    
    // Guardamos en la colección Lecturas_ARVA
    db.collection('Lecturas_ARVA').add({
      temperatura_ambiental: req.body.temperatura_ambiental,
      humedad_ambiental: req.body.humedad_ambiental,
      humedad_suelo: req.body.humedad_suelo,
      nivel_luz: req.body.nivel_luz,
      ph_suelo: req.body.ph_suelo,
      fecha: new Date().toJSON()
    })
    .then(() => {
        res.send({
          datos_recibidos: req.body,
          fecha: new Date(),
          status: '¡Valores de ARVA insertados en Firebase con éxito!'
        })
    })
    .catch(error => {
        console.log('Error al insertar', error);
        res.status(500).send(error);
    });
})

app.listen(PORT, () => {
  console.log(`API de ARVA escuchando en el puerto ${ PORT }`)
})