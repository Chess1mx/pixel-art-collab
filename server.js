const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        transports: ['websocket', 'polling'],
        credentials: true
    },
    allowEIO3: true
});
const fs = require('fs');
const path = require('path');

// Servir archivos estáticos desde la carpeta public
app.use(express.static('./public'));

// Configurar CORS para Express
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Matriz de píxeles del servidor
const GRID_WIDTH = 100;
const GRID_HEIGHT = 100;
const PIXELS_FILE = path.join(__dirname, 'pixels.json');

// Cargar píxeles guardados o crear matriz vacía
let pixels;
try {
    if (fs.existsSync(PIXELS_FILE)) {
        pixels = JSON.parse(fs.readFileSync(PIXELS_FILE, 'utf8'));
    } else {
        pixels = new Array(GRID_WIDTH).fill(null)
            .map(() => new Array(GRID_HEIGHT).fill('#FFFFFF'));
    }
} catch (error) {
    console.error('Error al cargar píxeles:', error);
    pixels = new Array(GRID_WIDTH).fill(null)
        .map(() => new Array(GRID_HEIGHT).fill('#FFFFFF'));
}

// Función para guardar píxeles
function savePixels() {
    try {
        fs.writeFileSync(PIXELS_FILE, JSON.stringify(pixels));
    } catch (error) {
        console.error('Error al guardar píxeles:', error);
    }
}

// Manejar conexiones de Socket.IO
io.on('connection', (socket) => {
    console.log('Usuario conectado');
    
    // Enviar el estado actual del canvas cuando se solicite
    socket.on('requestCanvas', () => {
        socket.emit('fullCanvas', pixels);
    });

    // Manejar la colocación de píxeles
    socket.on('placePixel', (data) => {
        const { x, y, color } = data;
        
        // Validar coordenadas y color
        if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT &&
            /^#[0-9A-F]{6}$/i.test(color)) {
            
            // Actualizar el pixel
            pixels[x][y] = color;
            
            // Guardar cambios
            savePixels();
            
            // Emitir actualización a todos los clientes
            io.emit('pixelUpdate', { x, y, color });
        }
    });

    socket.on('disconnect', () => {
        console.log('Usuario desconectado');
    });
});

// Guardar periódicamente
setInterval(savePixels, 60000); // Guardar cada minuto

// Ruta de estado para monitoreo
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        connections: io.engine.clientsCount
    });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor ejecutándose en el puerto ${PORT}`);
}); 