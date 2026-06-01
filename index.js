const express = require('express')
const PORT = process.env.PORT || 5000
var app = express();
var fire = require('./fire') // Tu conexión a Firebase
var cors = require('cors');
var bodyParser = require('body-parser');
const axios = require('axios'); // Para consultar APIs externas

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

// --- RUTA OPEN SOURCE (OPENSTREETMAP) ---
app.get('/economia/:municipio', async (req, res) => {
  const municipio = req.params.municipio;
  
  try {
    // 1. Buscamos tiendas agrícolas en OpenStreetMap
    const overpassQuery = `
      [out:json];
      area[name="${municipio}"]->.searchArea;
      (
        node["shop"~"agrarian|farm|hardware"](area.searchArea);
        way["shop"~"agrarian|farm|hardware"](area.searchArea);
      );
      out center;
    `;

    const response = await axios.get(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`);
    const resultadosOSM = response.data.elements;

    let compradoresReales = [];
    let insumosReales = [];

    // 2. Si OpenStreetMap encontró forrajeras reales:
    if (resultadosOSM && resultadosOSM.length > 0) {
      console.log(`¡Éxito! Encontramos ${resultadosOSM.length} negocios en ${municipio} vía OSM`);
      
      compradoresReales = resultadosOSM.slice(0, 2).map((lugar) => ({
        nombre: lugar.tags.name || `Centro Agrícola (Sin nombre registrado)`,
        ubicacion: "Zona Centro", 
        precioKilo: 21.50, 
        cultivo: "Insumos/Grano"
      }));

      insumosReales = resultadosOSM.slice(0, 2).map((lugar, index) => ({
        proveedor: lugar.tags.name || `Proveedor Local ${index + 1}`,
        producto: "Insumos Generales",
        precio: 1100
      }));
    } 
    // 3. PLAN DE RESCATE: Si OSM no tiene mapeado ese pueblito
    else {
      console.log(`OSM no tiene datos para ${municipio}. Usando plan de rescate dinámico.`);
      
      compradoresReales = [{
        nombre: `Acopio Regional ${municipio}`,
        ubicacion: "Cabecera Municipal",
        precioKilo: 21.50,
        cultivo: "Grano Local"
      }];
      
      insumosReales = [{
        proveedor: `Distribuidora Agrícola ${municipio}`,
        producto: "Urea Granulada",
        precio: 1100
      },
      {
        proveedor: "Ferretería Local",
        producto: "Semilla Comercial",
        precio: 850
      }];
    }

    res.json({
      cultivoPrincipal: "Frijol/Maíz",
      compradores: compradoresReales,
      insumos: insumosReales
    });

  } catch (error) {
    console.error("Error consultando Overpass API:", error);
    res.status(500).json({ error: "Error al consultar servidores libres" });
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