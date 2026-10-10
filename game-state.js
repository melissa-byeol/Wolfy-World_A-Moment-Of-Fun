/**
 * WOLFY WORLD - GAME STATE MANAGER
 * Gestiona datos, economía, inventario y reglas de negocio.
 */

// --- CONFIGURACIÓN DE DATOS ESTÁTICOS ---
const SHOVEL_DATA = {
    toy: { name: "Juguete", price: 0, luck: 1 },
    training: { name: "Entrenamiento", price: 100, luck: 2 },
    iron: { name: "Hierro", price: 500, luck: 5 },
    steel: { name: "Acero", price: 1500, luck: 10 }
};

// TESOROS ACTUALIZADOS CON NUEVOS ITEMS
const TREASURE_TYPES = [
    { name: "Roca Pequeña", val: 1, btChance: 0},
    { name: "Botella de Plástico", val: 5, btChance: 0.1 },       
    { name: "Carbón", val: 10, btChance: 0.25 },                 
    { name: "Linterna Desgastada", val: 25, btChance: 0.4 },    
    { name: "Wolficha de Bronce Vieja", val: 50, btChance: 0.7 },
    { name: "Oro", val: 100, btChance: 1.0}
];

// COLECCIÓN 1: BIBLIOTECA
const BOOK_CATALOG = [
    { id: 'b1', title: "Wolfy Clicker Incremental", pages: 8, costBT: 50, xpReward: 100, rarity: 'common' },
    { id: 'b2', title: "Características De Los Wolfies I [Inteligencia]", pages: 8, costBT: 50, xpReward: 100, rarity: 'common' },
    { id: 'b3', title: "Características De Los Wolfies II [Agilidad]", pages: 8, costBT: 100, xpReward: 250, rarity: 'rare' },
    { id: 'b4', title: "Características De Los Wolfies III [Fuerza]", pages: 8, costBT: 100, xpReward: 250, rarity: 'rare' },
    { id: 'b5', title: "Huesitos Dorados", pages: 8, costBT: 250, xpReward: 500, rarity: 'epic' },
    { id: 'b6', title: "Conoce a Wolfy", pages: 8, costBT: 250, xpReward: 500, rarity: 'epic' }
];

class GameState {
    constructor() {
        this.players = {}; // Mapa global de jugadores conectados
        this.myId = null;
        this.isHost = false;
        this.roomCode = "";
        
        // Progreso Local (Persistente idealmente, pero aquí volátil por sesión)
        this.xp = 0;
        this.level = 1;
        this.biblioTokens = 0;
        this.ownedBooks = []; // IDs de libros comprados
        this.chromoInventory = []; // Historial reciente de cromos abiertos
    }

    initPlayer(id, name, isHost) {
        this.myId = id;
        this.isHost = isHost;
        this.players[id] = {
            id: id,
            name: name,
            x: 200 + Math.random() * 100,
            y: 150 + Math.random() * 100,
            money: 0,
            shovel: 'toy',
            inventory: [], // Tesoros físicos
            color: isHost ? '#f1c40f' : '#e74c3c'
        };
    }

    updateMyPosition(x, y) {
        if(this.players[this.myId]) {
            this.players[this.myId].x = x;
            this.players[this.myId].y = y;
        }
    }

    addRemotePlayer(data) {
        if(data.id !== this.myId) {
            this.players[data.id] = data;
        }
    }

    removePlayer(id) { delete this.players[id]; }
    getLocalPlayer() { return this.players[this.myId]; }
    getAllPlayers() { return Object.values(this.players); }

    // --- MECÁNICA DE MINERÍA ---
    mineTreasure() {
        const p = this.getLocalPlayer();
        const luck = SHOVEL_DATA[p.shovel].luck;
        
        let roll = Math.random() * 100;
        let tierIndex = 0;
        
        // Distribución base
        if (roll > 99) tierIndex = 5; // Wolficha
        else if (roll > 95) tierIndex = 4; // Linterna
        else if (roll > 80) tierIndex = 3; // Carbón
        else if (roll > 65) tierIndex = 2;
        else if (roll > 35) tierIndex = 1;
        else tierIndex = 0; // Botella

        // Boost con suerte alta
        if(luck >= 5 && Math.random() < 0.2) {
             tierIndex = Math.min(tierIndex + 1, 5);
        }

        const treasureTemplate = TREASURE_TYPES[tierIndex];
        const treasure = { ...treasureTemplate, timestamp: Date.now() };
        
        // Ganancia de BT aleatoria según el tesoro
        if(Math.random() < treasure.btChance) {
            this.biblioTokens += 5; 
        }

        p.inventory.push(treasure);
        return treasure;
    }

    sellInventory() {
        const p = this.getLocalPlayer();
        let totalMoney = 0;
        
        p.inventory.forEach(item => {
            totalMoney += item.val;
        });
        
        p.money += totalMoney;
        p.inventory = [];
        return { money: totalMoney };
    }

    buyShovel(type) {
        const p = this.getLocalPlayer();
        const cost = SHOVEL_DATA[type].price;
        if(p.money >= cost) {
            p.money -= cost;
            p.shovel = type;
            return true;
        }
        return false;
    }

    // --- MECÁNICA BIBLIOTECA ---
    buyBook(bookId) {
        const book = BOOK_CATALOG.find(b => b.id === bookId);
        if(!book) return false;
        
        if(this.ownedBooks.includes(bookId)) {
            return false; // Ya lo tiene
        }

        if(this.biblioTokens >= book.costBT) {
            this.biblioTokens -= book.costBT;
            this.ownedBooks.push(bookId);
            this.addXP(book.xpReward);
            return true;
        }
        return false;
    }

    addXP(amount) {
        this.xp += amount;
        const newLevel = Math.floor(this.xp / 1000) + 1;
        if(newLevel > this.level) {
            this.level = newLevel;
            // Notificar subida de nivel vía callback si es necesario
        }
    }

    // --- MECÁNICA CROMOS ---
    openChromoPack(packType) {
        let cost = 0;
        let count = 0;

        if(packType === 'small') { cost = 50; count = 5; }
        else if(packType === 'basic') { cost = 150; count = 8; }
        else if(packType === 'large') { cost = 400; count = 12; }

        if(this.biblioTokens < cost) {
            return null; // Falta dinero
        }

        this.biblioTokens -= cost;
        
        let results = [];
        const collectionPool = [...BOOK_CATALOG]; 

        for(let i=0; i<count; i++) {
            const randIdx = Math.floor(Math.random() * collectionPool.length);
            const pageItem = { ...collectionPool[randIdx], type: 'page' };
            results.push(pageItem);
        }

        // Añadir a historial visual
        this.chromoInventory.unshift(...results.reverse());
        if(this.chromoInventory.length > 20) this.chromoInventory.pop();

        // XP simbólica
        this.addXP(count * 10);

        return results;
    }
}
