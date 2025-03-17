// Configuración del canvas
const canvas = document.getElementById('pixelCanvas');
const ctx = canvas.getContext('2d');
const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 1000;
const PIXEL_SIZE = 10;
const GRID_WIDTH = CANVAS_WIDTH / PIXEL_SIZE;
const GRID_HEIGHT = CANVAS_HEIGHT / PIXEL_SIZE;

// Variables de control
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let lastX = 0;
let lastY = 0;
let lastTouchDistance = 0;
let isZooming = false;
let lastTap = 0;

// Inicialización del canvas
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
ctx.imageSmoothingEnabled = false;

// Matriz de píxeles
let pixels = new Array(GRID_WIDTH).fill(null)
    .map(() => new Array(GRID_HEIGHT).fill('#FFFFFF'));

// Conexión WebSocket
const socket = io();

socket.on('connect', () => {
    console.log('Conectado al servidor');
    // Solicitar el estado actual del canvas al conectar
    socket.emit('requestCanvas');
});

socket.on('connect_error', (error) => {
    console.error('Error de conexión:', error);
    alert('Error de conexión. Intentando reconectar...');
});

socket.on('pixelUpdate', (data) => {
    pixels[data.x][data.y] = data.color;
    drawPixel(data.x, data.y, data.color);
});

socket.on('fullCanvas', (data) => {
    pixels = data;
    drawCanvas();
});

// Funciones de dibujo
function drawGrid() {
    ctx.strokeStyle = '#EEEEEE';
    ctx.lineWidth = 0.5;
    
    // Dibujar líneas verticales
    for (let x = 0; x <= GRID_WIDTH; x++) {
        ctx.beginPath();
        ctx.moveTo(x * PIXEL_SIZE, 0);
        ctx.lineTo(x * PIXEL_SIZE, CANVAS_HEIGHT);
        ctx.stroke();
    }
    
    // Dibujar líneas horizontales
    for (let y = 0; y <= GRID_HEIGHT; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * PIXEL_SIZE);
        ctx.lineTo(CANVAS_WIDTH, y * PIXEL_SIZE);
        ctx.stroke();
    }
}

function drawCanvas() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Dibujar el grid primero
    drawGrid();
    
    // Dibujar los píxeles
    for (let x = 0; x < GRID_WIDTH; x++) {
        for (let y = 0; y < GRID_HEIGHT; y++) {
            if (pixels[x][y] !== '#FFFFFF') {
                drawPixel(x, y, pixels[x][y]);
            }
        }
    }
}

function drawPixel(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
}

// Función para obtener coordenadas del pixel
function getPixelCoordinates(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const clientX = event.clientX || event.touches[0].clientX;
    const clientY = event.clientY || event.touches[0].clientY;
    
    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;
    
    const x = Math.floor(canvasX / PIXEL_SIZE);
    const y = Math.floor(canvasY / PIXEL_SIZE);
    
    return { x, y };
}

// Eventos del mouse
canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
});

canvas.addEventListener('mousemove', (e) => {
    const coords = getPixelCoordinates(e);
    document.getElementById('mouseCoords').textContent = `Coordenadas: ${coords.x}, ${coords.y}`;

    if (isDragging) {
        const deltaX = e.clientX - lastX;
        const deltaY = e.clientY - lastY;
        offsetX += deltaX;
        offsetY += deltaY;
        lastX = e.clientX;
        lastY = e.clientY;
        updateCanvasTransform();
    }
});

canvas.addEventListener('mouseup', () => {
    isDragging = false;
});

canvas.addEventListener('click', (e) => {
    if (isDragging) return;
    
    const coords = getPixelCoordinates(e);
    if (coords.x >= 0 && coords.x < GRID_WIDTH && coords.y >= 0 && coords.y < GRID_HEIGHT) {
        placePixel(coords.x, coords.y);
    }
});

// Eventos táctiles
canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
        isZooming = true;
        lastTouchDistance = getTouchDistance(e.touches);
    } else {
        const now = Date.now();
        if (now - lastTap < 300) { // Doble tap
            e.preventDefault();
            const coords = getPixelCoordinates(e);
            placePixel(coords.x, coords.y);
        }
        lastTap = now;
        
        isDragging = true;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
    }
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    
    if (isZooming && e.touches.length === 2) {
        const distance = getTouchDistance(e.touches);
        const deltaScale = distance / lastTouchDistance;
        scale *= deltaScale;
        scale = Math.min(Math.max(0.5, scale), 5); // Limitar zoom
        lastTouchDistance = distance;
        updateCanvasTransform();
    } else if (isDragging && e.touches.length === 1) {
        const deltaX = e.touches[0].clientX - lastX;
        const deltaY = e.touches[0].clientY - lastY;
        offsetX += deltaX;
        offsetY += deltaY;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        updateCanvasTransform();
    }
    
    const coords = getPixelCoordinates(e);
    document.getElementById('mouseCoords').textContent = `Coordenadas: ${coords.x}, ${coords.y}`;
});

canvas.addEventListener('touchend', () => {
    isDragging = false;
    isZooming = false;
});

// Función auxiliar para calcular la distancia entre dos toques
function getTouchDistance(touches) {
    return Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY
    );
}

// Función para colocar un pixel
function placePixel(x, y) {
    if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
        const color = document.getElementById('colorPicker').value;
        pixels[x][y] = color;
        drawPixel(x, y, color);
        socket.emit('placePixel', { x, y, color });
        return true;
    }
    return false;
}

// Controles de zoom
document.getElementById('zoomIn').addEventListener('click', () => {
    scale *= 1.2;
    scale = Math.min(scale, 5); // Limitar zoom máximo
    updateCanvasTransform();
});

document.getElementById('zoomOut').addEventListener('click', () => {
    scale *= 0.8;
    scale = Math.max(scale, 0.5); // Limitar zoom mínimo
    updateCanvasTransform();
});

document.getElementById('resetZoom').addEventListener('click', () => {
    scale = 1;
    updateCanvasTransform();
});

function updateCanvasTransform() {
    const container = canvas.parentElement;
    const containerRect = container.getBoundingClientRect();
    
    // Calcular el tamaño del canvas escalado
    const scaledWidth = CANVAS_WIDTH * scale;
    const scaledHeight = CANVAS_HEIGHT * scale;
    
    // Centrar el canvas en el contenedor
    offsetX = Math.max(0, (containerRect.width - scaledWidth) / 2);
    offsetY = Math.max(0, (containerRect.height - scaledHeight) / 2);
    
    // Aplicar transformación
    canvas.style.position = 'absolute';
    canvas.style.left = `${offsetX}px`;
    canvas.style.top = `${offsetY}px`;
    canvas.style.transform = `scale(${scale})`;
    canvas.style.transformOrigin = '0 0';
}

// Prevenir el zoom del navegador en dispositivos móviles
document.addEventListener('gesturestart', (e) => {
    e.preventDefault();
});

// Inicialización
window.addEventListener('load', () => {
    drawCanvas();
    updateCanvasTransform();
    
    // Solicitar el estado actual del canvas
    if (socket.connected) {
        socket.emit('requestCanvas');
    }
});

// Agregar evento para redimensionamiento de ventana
window.addEventListener('resize', () => {
    updateCanvasTransform();
}); 