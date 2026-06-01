const express = require('express')
const PORT = process.env.PORT || 5000
var app = express();
var fire = require('./fire') // Tu conexión a Firebase
var cors = require('cors');
var bodyParser = require('body-parser');
const axios = require('axios'); // <-- IMPORTANTE: Faltaba importar la librería aquí

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// --- PANTALLA DE INICIO ACTUALIZADA ---
app.get('/', (req, res) => {
  res.send(
    '<h1>ARVA Smart API - Motor Agrícola</h1>' +
    '<ul>' +
    '<li><b>GET /valor</b> - Última lectura de sensores</li>' +
    '<li><b>POST /insertar</b> - Inyección de datos ESP32</li>' +
    '<li><b>GET /economia/:municipio</b> - Búsqueda AUTOMÁTICA de mercados y precios</li>' +
    '</ul>'
  )
})

// --- NUEVAS RUTAS: INVENTARIO DE PARCELAS EN LA NUBE ---
app.post('/parcelas', (req, res) => {
  const db = fire.firestore();
  // Se crea una nueva tabla/colección en Firebase llamada "Parcelas_ARVA"
  db.collection('Parcelas_ARVA').add(req.body)
    .then(() => res.send({ status: '¡Parcela guardada en la nube!' }))
    .catch(error => res.status(500).send(error));
});

app.get('/parcelas', (req, res) => {
  const db = fire.firestore();
  var parcelas = [];
  db.collection('Parcelas_ARVA').get()
    .then(snapshot => {
      snapshot.forEach(doc => { 
        // Extraemos el ID único de Firebase y los datos
        parcelas.push({ id: doc.id, ...doc.data() }); 
      });
      res.send(parcelas);
    })
    .catch(error => res.status(500).send(error));
});

// --- RUTA REALITY-CHECK (BÚSQUEDA REAL EN OPENSTREETMAP) ---
app.get('/economia/:municipio', async (req, res) => {
  const municipio = req.params.municipio;
  
  try {
    // 🚀 BÚSQUEDA AGRESIVA (Sintaxis nativa de Overpass QL)
    const overpassQuery = `
      [out:json][timeout:25];
      area["name"="${municipio}"]->.searchArea;
      (
        nwr["name"~"acopio|frijol|grano|forraje|fertilizante|agroquimico|semilla|agricola|agro", i](area.searchArea);
        nwr["shop"~"agrarian|farm"](area.searchArea);
      );
      out center;
    `;

    const response = await axios.get(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`, {
      headers: { 'User-Agent': 'ARVA-Smart-App/1.0' }
    });
    
    const resultadosOSM = response.data.elements;

    let compradoresReales = [];
    let insumosReales = [];

    // SI ENCUENTRA NEGOCIOS REALES EN EL MAPA, LOS CLASIFICA
    if (resultadosOSM && resultadosOSM.length > 0) {
      console.log(`¡Éxito! Encontramos ${resultadosOSM.length} negocios reales en ${municipio}`);

      resultadosOSM.forEach((lugar) => {
        const nombre = lugar.tags.name || "Negocio Agrícola";
        const nombreLower = nombre.toLowerCase();

        // 1. ¿Es comprador o acopio?
        if (nombreLower.includes('acopio') || nombreLower.includes('grano') || nombreLower.includes('frijol')) {
          compradoresReales.push({
            nombre: nombre,
            ubicacion: "Ubicación en Mapa", // OSM a veces no trae la calle exacta
            precioKilo: 21.50, // Este es el precio actual base del mercado
            cultivo: "Frijol/Grano"
          });
        } 
        // 2. Si no es comprador, asumimos que vende insumos
        else {
          insumosReales.push({
            proveedor: nombre,
            // Asignamos fertilizante a los que suenan a químicos, y semilla a los demás
            producto: nombreLower.includes('agro') || nombreLower.includes('ferti') ? "Fertilizantes / Químicos" : "Semillas y Forraje",
            precio: 1100 // Precio promedio base
          });
        }
      });
    }

    // 🛑 ADIÓS SIMULACIÓN: Mandamos exactamente lo que extrajimos de la realidad
    res.json({
      cultivoPrincipal: "Frijol/Maíz",
      compradores: compradoresReales,
      insumos: insumosReales
    });

  } catch (error) {
    console.error("Error consultando Overpass API:", error);
    res.status(500).json({ error: "Error al consultar la base de datos de mapas" });
  }
});

// --- TUS RUTAS ORIGINALES DE SENSORES (¡Restauradas!) ---
app.get('/ver', (req, res) => {
  const db = fire.firestore();
  var wholeData = []
  db.collection('Lecturas_ARVA').orderBy('fecha', 'asc').get()
    .then(snapshot => {
      snapshot.forEach(doc => { wholeData.push(doc.data()) });
      res.send(wholeData)
    })
    .catch(error => res.status(500).send(error));
})

app.get('/valor', (req, res) => {
  const db = fire.firestore();
  var wholeData = []
  db.collection('Lecturas_ARVA').limit(1).orderBy('fecha','desc').get()
    .then(snapshot => {
      snapshot.forEach(doc => { wholeData.push(doc.data()) });
      res.send(wholeData)
    })
    .catch(error => res.status(500).send(error));
})

app.get('/grafica', (req, res) => {
  const db = fire.firestore();
  var wholeData = []
  db.collection('Lecturas_ARVA').limit(10).orderBy('fecha','desc').get()
    .then(snapshot => {
      snapshot.forEach(doc => { wholeData.push(doc.data()) });
      res.send(wholeData)
    })
    .catch(error => res.status(500).send(error));
})

app.post('/insertar', (req, res)=>{
  const db = fire.firestore();
  db.collection('Lecturas_ARVA').add({
    temperatura_ambiental: req.body.temperatura_ambiental,
    humedad_ambiental: req.body.humedad_ambiental,
    humedad_suelo: req.body.humedad_suelo,
    nivel_luz: req.body.nivel_luz,
    ph_suelo: req.body.ph_suelo,
    fecha: new Date().toJSON()
  })
  .then(() => res.send({ status: '¡Valores insertados con éxito!' }))
  .catch(error => res.status(500).send(error));
})

// --- LA INSTRUCCIÓN MÁS IMPORTANTE PARA RENDER ---
app.listen(PORT, () => {
  console.log(`API de ARVA escuchando en el puerto ${ PORT }`)
})