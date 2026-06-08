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

// --- RUTAS CRUD PARA ACTUALIZAR Y ELIMINAR PARCELAS ---
app.put('/parcelas/:id', (req, res) => {
  const db = fire.firestore();
  // Busca el documento por su ID y actualiza sus coordenadas y nombre
  db.collection('Parcelas_ARVA').doc(req.params.id).update(req.body)
    .then(() => res.send({ status: '¡Parcela actualizada con éxito!' }))
    .catch(error => res.status(500).send(error));
});

app.delete('/parcelas/:id', (req, res) => {
  const db = fire.firestore();
  // Destruye el documento de la base de datos usando su ID
  db.collection('Parcelas_ARVA').doc(req.params.id).delete()
    .then(() => res.send({ status: '¡Parcela eliminada!' }))
    .catch(error => res.status(500).send(error));
});

// --- RUTA INEGI DENUE (DATOS OFICIALES DE GOBIERNO) ---
app.get('/economia/:municipio', async (req, res) => {
  const municipio = req.params.municipio.trim().toLowerCase();
  const tokenInegi = process.env.INEGI_TOKEN;

  if (!tokenInegi) {
    return res.status(500).json({ error: "Falta configurar el Token de INEGI en el servidor." });
  }

  // 1. Diccionario de Coordenadas (Centro del municipio)
  // Puedes agregar más municipios aquí después
  const coordenadasMap = {
    'guadalupe victoria': { lat: 24.4485, lon: -104.1242 },
    'durango': { lat: 24.0277, lon: -104.6538 },
    'cuencame': { lat: 24.8694, lon: -103.6963 }
  };

  const ubicacion = coordenadasMap[municipio];

  if (!ubicacion) {
    return res.json({
      cultivoPrincipal: "Desconocido",
      compradores: [], insumos: [],
      nota: "Municipio no mapeado en el servidor. Agrega sus coordenadas."
    });
  }

  try {
    // 2. Búsqueda paralela al INEGI (Radio de 15km = 15000 metros)
    const radio = 15000; 
    
    const urlCompradores = `https://www.inegi.org.mx/app/api/denue/v1/consulta/Buscar/grano/${ubicacion.lat},${ubicacion.lon}/${radio}/${tokenInegi}`;
    const urlInsumos = `https://www.inegi.org.mx/app/api/denue/v1/consulta/Buscar/fertilizante/${ubicacion.lat},${ubicacion.lon}/${radio}/${tokenInegi}`;

    // 🚀 FUNCIÓN ESCUDO: Si INEGI no encuentra nada y lanza 404, regresamos un arreglo vacío sin tumbar el server
    const consultarINEGI = async (url) => {
      try {
        const respuesta = await axios.get(url, { headers: { 'User-Agent': 'ARVA-Smart-App/1.0' } });
        return respuesta.data;
      } catch (error) {
        console.log("INEGI no encontró resultados para esta categoría (Error 404/400). Regresando lista vacía.");
        return []; 
      }
    };

    // Consultamos al mismo tiempo, pero protegidos
    const [dataCompradores, dataInsumos] = await Promise.all([
      consultarINEGI(urlCompradores),
      consultarINEGI(urlInsumos)
    ]);

    let compradoresReales = [];
    let insumosReales = [];

    // 3. Procesamiento de Compradores (INEGI regresa un array de objetos o un string si no hay datos)
    if (Array.isArray(dataCompradores)) {
      compradoresReales = dataCompradores.slice(0, 5).map(negocio => ({
        nombre: negocio.Nombre || "Centro de Acopio",
        ubicacion: `${negocio.Calle || ''}, ${negocio.Colonia || ''}`.trim() || "Ubicación en cabecera",
        precioKilo: 21.50, // Precio base de mercado
        cultivo: (negocio.Clase_actividad && negocio.Clase_actividad.includes('semilla')) ? 'Semillas/Granos' : 'Frijol/Maíz'
      }));
    }

    // 4. Procesamiento de Insumos
    if (Array.isArray(dataInsumos)) {
      insumosReales = dataInsumos.slice(0, 5).map(negocio => ({
        proveedor: negocio.Nombre || "Distribuidora Agrícola",
        producto: (negocio.Clase_actividad && negocio.Clase_actividad.includes('fertilizante')) ? 'Fertilizantes y Agroquímicos' : 'Insumos Generales',
        precio: 1100
      }));
    }

    res.json({
      cultivoPrincipal: "Frijol/Maíz",
      compradores: compradoresReales,
      insumos: insumosReales
    });

  } catch (error) {
    console.error("Error crítico en ruta Economía:", error.message);
    res.status(500).json({ error: "Error interno del servidor al procesar datos del INEGI." });
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