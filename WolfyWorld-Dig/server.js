const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Configuración del Juego
const MAX_PLAYERS = 6;
let rooms = {}; // Almacena las salas activas

// Definición de Palas
const SHOVELS = {
    toy: { name: "Pala de Juguete", power: 1, cost: 0 },
    training: { name: "Pala de Entrenamiento", power: 2, cost: 100 },
    iron: { name: "Pala de Hierro", power: 5, cost: 500 },
    steel: { name: "Pala de Acero", power: 10, cost: 1500 }
};

// Tesoros posibles
const TREASURES = [
    { id: 'gem_blue', name: 'Gema Azul', value: 10, rarity: 1 },
    { id: 'gem_red', name: 'Gema Roja', value: 25, rarity: 2 },
    { id: 'ancient_coin', name: 'Moneda Antigua', value: 100, rarity: 3 },
    { id: 'wolfy_relic', name: 'Reliquia de Lobito', value: 500, rarity: 5 }
];

io.on('connection', (socket) => {
    console.log('Un Lobito se ha conectado:', socket.id);

    // Unirse a una sala
    socket.on('joinRoom', (roomId) => {
        if (!rooms[roomId]) {
            rooms[roomId] = { players: {}, gameState: { money: 0, upgrades: {} } };
        }
        
        const room = rooms[roomId];
        if (Object.keys(room.players).length < MAX_PLAYERS) {
            socket.join(roomId);
            room.players[socket.id] = { 
                id: socket.id, 
                money: 0, 
                shovel: 'toy', 
                inventory: [],
                x: Math.random() * 800, 
                y: Math.random() * 600 
            };
            
            // Enviar estado inicial al jugador
            socket.emit('initGame', { 
                playerId: socket.id, 
                players: room.players, 
                shovels: SHOVELS 
            });
            
            // Avisar a los demás
            socket.to(roomId).emit('playerJoined', room.players[socket.id]);
        } else {
            socket.emit('error', 'Sala llena (Max 6 Lobitos)');
        }
    });

    // Mecánica de Excavación (La barra verde)
    socket.on('digAttempt', (data) => {
        const room = rooms[data.roomId];
        if (!room) return;
        
        const player = room.players[socket.id];
        const shovelPower = SHOVELS[player.shovel].power;
        
        // Simulación simple: si el timing es bueno (data.success), gana tesoro
        if (data.success) {
            const treasure = TREASURES[Math.floor(Math.random() * TREASURES.length)];
            player.inventory.push(treasure);
            socket.emit('digResult', { success: true, item: treasure });
        } else {
            socket.emit('digResult', { success: false });
        }
    });

    // Vender en el Mostrador
    socket.on('sellItem', (data) => {
        const room = rooms[data.roomId];
        const player = room.players[socket.id];
        const itemIndex = player.inventory.findIndex(i => i.id === data.itemId);
        
        if (itemIndex > -1) {
            const item = player.inventory.splice(itemIndex, 1)[0];
            player.money += item.value;
            socket.emit('updateWallet', player.money);
            socket.emit('updateInventory', player.inventory);
        }
    });

    // Comprar Mejora (Árbol Incremental)
    socket.on('buyUpgrade', (data) => {
        const room = rooms[data.roomId];
        const player = room.players[socket.id];
        const shovel = SHOVELS[data.shovelType];

        if (player.money >= shovel.cost) {
            player.money -= shovel.cost;
            player.shovel = data.shovelType;
            socket.emit('updateWallet', player.money);
            socket.emit('shovelUpgraded', player.shovel);
        }
    });

    // Trade entre jugadores
    socket.on('tradeItem', (data) => {
        const room = rooms[data.roomId];
        const sender = room.players[socket.id];
        const receiver = room.players[data.targetId];

        if (sender && receiver) {
            const itemIndex = sender.inventory.findIndex(i => i.id === data.itemId);
            if (itemIndex > -1) {
                const item = sender.inventory.splice(itemIndex, 1)[0];
                receiver.inventory.push(item);
                
                io.to(data.targetId).emit('tradeReceived', item);
                socket.emit('updateInventory', sender.inventory);
                io.to(data.targetId).emit('updateInventory', receiver.inventory);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('Lobito desconectado');
        // Lógica para limpiar la sala si se vacía
    });
});

server.listen(3000, () => {
    console.log('Servidor Wolfy World corriendo en puerto 3000');
});
