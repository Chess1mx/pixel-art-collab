const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const fs = require('fs');
const path = require('path');

// Servir archivos estáticos desde la carpeta public
app.use(express.static('./public'));

// Matriz de píxeles del servidor
const GRID_WIDTH = 100;
const GRID_HEIGHT = 100;
const PIXELS_FILE = path.join(__dirname, 'pixels.json');

// Función para guardar píxeles con respaldo
function savePixels(pixelsData) {
    try {
        // Guardar en el archivo principal
        fs.writeFileSync(PIXELS_FILE, JSON.stringify(pixelsData));
        
        // Crear un respaldo con marca de tiempo
        const backupFile = path.join(__dirname, `pixels_backup_${Date.now()}.json`);
        fs.writeFileSync(backupFile, JSON.stringify(pixelsData));
        
        // Mantener solo los últimos 5 respaldos
        const backups = fs.readdirSync(__dirname)
            .filter(file => file.startsWith('pixels_backup_'))
            .sort()
            .reverse();
        
        backups.slice(5).forEach(file => {
            fs.unlinkSync(path.join(__dirname, file));
        });
    } catch (error) {
        console.error('Error al guardar píxeles:', error);
    }
}

// Cargar píxeles guardados o crear matriz vacía
let pixels;
try {
    if (fs.existsSync(PIXELS_FILE)) {
        pixels = JSON.parse(fs.readFileSync(PIXELS_FILE, 'utf8'));
    } else {
        // Buscar el respaldo más reciente
        const backups = fs.readdirSync(__dirname)
            .filter(file => file.startsWith('pixels_backup_'))
            .sort()
            .reverse();
        
        if (backups.length > 0) {
            pixels = JSON.parse(fs.readFileSync(path.join(__dirname, backups[0]), 'utf8'));
        } else {
            pixels = new Array(GRID_WIDTH).fill(null)
                .map(() => new Array(GRID_HEIGHT).fill('#FFFFFF'));
        }
    }
} catch (error) {
    console.error('Error al cargar píxeles:', error);
    pixels = new Array(GRID_WIDTH).fill(null)
        .map(() => new Array(GRID_HEIGHT).fill('#FFFFFF'));
}

// Guardar periódicamente
setInterval(() => {
    savePixels(pixels);
}, 5 * 60 * 1000); // Cada 5 minutos

// Manejar conexiones de Socket.IO
io.on('connection', (socket) => {
    console.log('Usuario conectado');

    // Enviar el estado actual del canvas al nuevo usuario
    socket.emit('fullCanvas', pixels);

    // Manejar la colocación de píxeles
    socket.on('placePixel', (data) => {
        const { x, y, color } = data;
        
        // Validar coordenadas y color
        if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT &&
            /^#[0-9A-F]{6}$/i.test(color)) {
            pixels[x][y] = color;
            // Emitir actualización a todos los clientes
            io.emit('pixelUpdate', { x, y, color });
        }
    });

    socket.on('disconnect', () => {
        console.log('Usuario desconectado');
    });
});

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