/**
WOLFY WORLD - GAME STATE MANAGER v4 (MODULE)
Sistema de Cartas RPG Dinámico con Feed Mechanic
*/
// --- CONFIGURACIÓN DE DATOS ESTÁTICOS (PALAS, TESOROS, LIBROS) ---
export const SHOVEL_DATA = {
    toy: { name: "Juguete", price: 0, luck: 1 },
    training: { name: "Entrenamiento", price: 100, luck: 2 },
    iron: { name: "Hierro", price: 500, luck: 5 },
    steel: { name: "Acero", price: 1500, luck: 10 }
};

export const TREASURE_TYPES = [
    { name: "Botella de Plástico", val: 5, btChance: 0 },
    { name: "Carbón", val: 10, btChance: 0.1 },
    { name: "Linterna Desgastada", val: 25, btChance: 0.3 },
    { name: "Wolficha de Bronce Vieja", val: 50, btChance: 0.6 }
];

export const COLLECTIONS = [{ id: "c1", name: "Conociendo Wolfy World" }];

export const BOOK_CATALOG = [
    { id: 'b1', collection: "c1", title: "Wolfy Clicker Incremental", pages: 8, rewardBT: 50, rewardXP: 100, rarity: 'common' },
    { id: 'b2', collection: "c1", title: "Características De Los Wolfies I [Inteligencia]", pages: 8, rewardBT: 50, rewardXP: 100, rarity: 'common' },
    { id: 'b3', collection: "c1", title: "Características De Los Wolfies II [Agilidad]", pages: 8, rewardBT: 100, rewardXP: 250, rarity: 'rare' },
    { id: 'b4', collection: "c1", title: "Características De Los Wolfies III [Fuerza]", pages: 8, rewardBT: 100, rewardXP: 250, rarity: 'rare' },
    { id: 'b5', collection: "c1", title: "Huesitos Dorados", pages: 8, rewardBT: 250, rewardXP: 500, rarity: 'epic' },
    { id: 'b6', collection: "c1", title: "Conoce a Wolfy", pages: 8, rewardBT: 250, rewardXP: 500, rarity: 'epic' }
];

export const CHROMO_PACKS = {
    small: { name: "Paquete Pequeño", cost: 50, pages: 5, minNew: 0 },
    basic: { name: "Paquete Básico", cost: 150, pages: 8, minNew: 1 },
    large: { name: "Paquete Grande", cost: 400, pages: 12, minNew: 3 }
};

// --- SISTEMA DE CARTAS RPG v4 ---
export const RANK_CONFIG = {
    'B':  { powerInc: 1,  maxLvl: 10, nextRankCost: 100,   nextRank: 'A' },
    'A':  { powerInc: 2,  maxLvl: 20, nextRankCost: 500,   nextRank: 'S' },
    'S':  { powerInc: 3,  maxLvl: 30, nextRankCost: 1000,  nextRank: 'R' },
    'R':  { powerInc: 4,  maxLvl: 40, nextRankCost: 2000,  nextRank: 'XR' },
    'XR': { powerInc: 5,  maxLvl: 50, nextRankCost: 5000,  nextRank: 'UR' },
    'UR': { powerInc: 6,  maxLvl: 60, nextRankCost: 10000, nextRank: 'MR' },
    'MR': { powerInc: 8,  maxLvl: 70, nextRankCost: null,  nextRank: null }
};

export const RANK_ORDER = ['B', 'A', 'S', 'R', 'XR', 'UR', 'MR'];

// Listas de Personajes y Temas
export const CHARACTERS = [
    { id: "lobito", name: "Lobito", type: "general" },
    { id: "cachorrito", name: "Cachorrito", type: "general" },
    { id: "lobita", name: "Lobita", type: "general" },
    { id: "cantante", name: "Lobito Cantante", type: "vocal_dance" },
    { id: "rapero", name: "Lobito Rapero", type: "vocal_dance" },
    { id: "bailarin", name: "Lobito Bailarín", type: "vocal_dance" },
    { id: "vocalista", name: "Lobita Vocalista", type: "vocal_dance" },
    { id: "coordinada", name: "Lobita Coordinada", type: "vocal_dance" },
    { id: "baterista", name: "Lobito Baterista", type: "instrumental" },
    { id: "guitarrista", name: "Lobito Guitarrista", type: "instrumental" },
    { id: "bajista", name: "Lobito Bajista", type: "instrumental" },
    { id: "pianista", name: "Lobito Pianista", type: "instrumental" },
    { id: "flautista", name: "Lobita Flautista", type: "instrumental" }
];

export const THEMES_GENERAL = ["themeless", "stillness", "curiosity", "playtime"];
export const THEME_EXCLUSIVE_VOCAL = "sharpened";
export const THEME_EXCLUSIVE_INSTRUMENTAL = "focused";

// Fábrica de Catálogo: Genera todos los IDs únicos posibles
function generateCardCatalog() {
    const catalog = [];
    CHARACTERS.forEach(char => {
        // 1. Asignar temas generales a TODOS
        THEMES_GENERAL.forEach(theme => {
            catalog.push({
                id: `${char.id}_${theme}`,
                charId: char.id,
                theme: theme,
                displayName: `${char.name} [${theme.charAt(0).toUpperCase() + theme.slice(1)}]`
            });
        });
        // 2. Asignar tema exclusivo según tipo
        if (char.type === "vocal_dance") {
            catalog.push({
                id: `${char.id}_sharpened`,
                charId: char.id,
                theme: THEME_EXCLUSIVE_VOCAL,
                displayName: `${char.name} [Sharpened]`
            });
        } else if (char.type === "instrumental") {
            catalog.push({
                id: `${char.id}_focused`,
                charId: char.id,
                theme: THEME_EXCLUSIVE_INSTRUMENTAL,
                displayName: `${char.name} [Focused]`
            });
        }
    });
    return catalog;
}

// El catálogo completo se genera UNA sola vez al cargar el script
export const FULL_CARD_CATALOG = generateCardCatalog();
// Mapa rápido para búsquedas O(1)
export const CARD_MAP = {};
FULL_CARD_CATALOG.forEach(c => CARD_MAP[c.id] = c);

export class GameState {
    constructor() {
        this.players = {};
        this.myId = null;
        this.isHost = false;
        this.roomCode = "";
        this.profileName = "Lobo Invitado";
        this.createdAt = Date.now();
        this.xp = 0;
        this.level = 1;
        this.biblioTokens = 0;
        this.rhythmShards = 0;
        this.selectedCollections = ["c1"];
        this.bookProgress = {};
        this.completedBooks = [];
        this.chromoInventory = [];
        
        // Inventario de Cartas: { cardId: { level, rank, xp, count } }
        this.cardInventory = {};
        this.equippedCards = [];
        
        // Project Moonlight Stats
        this.rhythm = {
            bestScores: {},
            plays: 0
        };
        
        this.savedPlayer = this.createEmptyPlayer("local", this.profileName);
    }

    initPlayer(id, name, isHost) {
        this.myId = id;
        this.isHost = isHost;
        this.profileName = name || this.profileName;
        const base = this.savedPlayer || this.createEmptyPlayer("local", this.profileName);
        this.players[id] = { ...base, id, name, color: isHost ? "#f1c40f" : "#e74c3c" };
    }

    createEmptyPlayer(id, name) {
        return { id, name, x: 200, y: 150, money: 0, shovel: "toy", inventory: [], color: "#f1c40f" };
    }

    getActivePlayer() { 
        return this.players[this.myId] || this.savedPlayer; 
    }

    getAllPlayers() { 
        return Object.values(this.players); 
    }

    updateMyPosition(x, y) {
        const p = this.getActivePlayer();
        if(p) { 
            p.x = x; 
            p.y = y; 
        }
    }

    addRemotePlayer(data) { 
        if (data.id !== this.myId) {
            this.players[data.id] = data; 
        }
    }

    removePlayer(id) { 
        delete this.players[id]; 
    }

    // --- ECONOMÍA BÁSICA ---
    mineTreasure() {
        const p = this.getActivePlayer();
        const luck = SHOVEL_DATA[p.shovel].luck;
        let roll = Math.random() * 100;
        let tierIndex = 0;
        
        if (roll > 95) tierIndex = 3;
        else if (roll > 75) tierIndex = 2;
        else if (roll > 40) tierIndex = 1;
        
        if (luck >= 5 && Math.random() < 0.2) {
            tierIndex = Math.min(tierIndex + 1, 3);
        }
        
        const template = TREASURE_TYPES[tierIndex];
        const treasure = { ...template, timestamp: Date.now() };
        
        if (Math.random() < treasure.btChance) {
            this.biblioTokens += 5;
        }
        
        p.inventory.push(treasure);
        return treasure;
    }

    sellInventory() {
        const p = this.getActivePlayer();
        let totalMoney = 0;
        p.inventory.forEach(item => totalMoney += item.val);
        p.money += totalMoney;
        p.inventory = [];
        return { money: totalMoney };
    }

    buyShovel(type) {
        const p = this.getActivePlayer();
        const cost = SHOVEL_DATA[type].price;
        if (p.money >= cost) { 
            p.money -= cost; 
            p.shovel = type; 
            return true; 
        }
        return false;
    }

    addXP(amount) {
        this.xp += amount;
        this.level = Math.floor(this.xp / 1000) + 1;
    }

    applyXpToCards(xpGained) {
        if (xpGained <= 0) return;
        const equippedIds = [...this.equippedCards];
        if (equippedIds.length === 0) return;
        
        const xpPerCard = Math.floor(xpGained / equippedIds.length);
        const LEVEL_THRESHOLD = 100; // 100 XP = 1 Nivel
        
        equippedIds.forEach(id => {
            const record = this.getCardRecord(id);
            record.xp += xpPerCard;
            
            while (record.xp >= LEVEL_THRESHOLD) {
                const config = RANK_CONFIG[record.rank];
                if (record.level < config.maxLvl) {
                    record.level++;
                    record.xp -= LEVEL_THRESHOLD;
                } else {
                    break;
                }
            }
        });
    }

    // --- LÓGICA DE CARTAS v4 (FEED SYSTEM) ---
    getCardRecord(cardId) {
        if (!this.cardInventory[cardId]) {
            // Antes: count:1 -> provocaba que cartas no obtenidas parecieran poseídas.
            // Ahora: count:0 para reflejar que no se posee hasta obtenerla.
            this.cardInventory[cardId] = { level: 1, rank: "B", xp: 0, count: 0 };
        }
        return this.cardInventory[cardId];
    }

    calculateCardPower(cardId) {
        const record = this.getCardRecord(cardId);
        const currentRankIdx = RANK_ORDER.indexOf(record.rank);
        if (currentRankIdx === -1) return 1;
        
        let totalPower = 0;
        for (let i = 0; i < currentRankIdx; i++) {
            const prevRank = RANK_ORDER[i];
            const config = RANK_CONFIG[prevRank];
            totalPower += config.maxLvl * config.powerInc;
        }
        
        const currentConfig = RANK_CONFIG[record.rank];
        totalPower += record.level * currentConfig.powerInc;
        
        return totalPower;
    }

    toggleEquipCard(cardId) {
        const index = this.equippedCards.indexOf(cardId);
        
        if (index >= 0) {
            this.equippedCards.splice(index, 1);
            return true;
        }
        
        if (this.equippedCards.length >= 5) {
            return false;
        }
        
        this.equippedCards.push(cardId);
        return true;
    }

    feedCard(targetId, foodIds) {
        if (!foodIds || foodIds.length === 0) return null;
        
        const targetRecord = this.getCardRecord(targetId);
        const targetConfig = RANK_CONFIG[targetRecord.rank];
        
        if (targetRecord.level >= targetConfig.maxLvl) {
            return { success: false, reason: "max_level" };
        }
        
        let totalXpGained = 0;
        let consumedCount = 0;
        
        foodIds.forEach(foodId => {
            if (foodId === targetId) return;
            
            const foodRecord = this.cardInventory[foodId];
            if (!foodRecord || foodRecord.count <= 0) return;
            
            foodRecord.count--;
            consumedCount++;
            
            const rankIdx = RANK_ORDER.indexOf(foodRecord.rank);
            const xpValue = 100 + (rankIdx * 50) + (foodRecord.level * 10);
            totalXpGained += xpValue;
        });
        
        if (consumedCount === 0) return { success: false, reason: "no_food" };
        
        targetRecord.xp += totalXpGained;
        
        let levelsUp = 0;
        const LEVEL_THRESHOLD = 100;
        while (targetRecord.xp >= LEVEL_THRESHOLD && targetRecord.level < targetConfig.maxLvl) {
            targetRecord.level++;
            targetRecord.xp -= LEVEL_THRESHOLD;
            levelsUp++;
        }
        
        return { 
            success: true, 
            xpGained: totalXpGained, 
            levelsUp: levelsUp,
            newLevel: targetRecord.level 
        };
    }

    upgradeCardRank(cardId) {
        const record = this.getCardRecord(cardId);
        const config = RANK_CONFIG[record.rank];
        
        if (!config.nextRank) return false;
        if (record.level < config.maxLvl) return false;
        if (this.rhythmShards < config.nextRankCost) return false;
        
        this.rhythmShards -= config.nextRankCost;
        record.rank = config.nextRank;
        record.level = 1;
        record.xp = 0;
        return true;
    }

    getRhythmStats(songId) {
        let totalPowerSum = 0;
        let shields = 0;
        let startCombo = 0;
        let multiplier = 1.0;
        
        this.equippedCards.forEach(id => {
            const power = this.calculateCardPower(id);
            totalPowerSum += power;
            
            const record = this.getCardRecord(id);
            if (['XR', 'UR', 'MR'].includes(record.rank)) shields += 1;
            if (record.rank === 'MR') startCombo += 10;
            
            const catalogEntry = CARD_MAP[id];
            if (catalogEntry && catalogEntry.theme === "stillness" && songId === "bed_of_thorns") {
                multiplier *= 1.55;
            }
        });
        
        return {
            power: totalPowerSum > 0 ? totalPowerSum : 1,
            shields: shields,
            startCombo: startCombo,
            multiplier: multiplier
        };
    }

    openCardPack(type) {
        const isPremium = type === 'premium';
        const costCurrency = isPremium ? 'rhythmShards' : 'biblioTokens';
        const costAmount = isPremium ? 50 : 40;
        
        if (this[costCurrency] < costAmount) return null;
        
        this[costCurrency] -= costAmount;
        const drawnCards = [];
        const count = isPremium ? 5 : 3;
        
        const allowedRanks = isPremium 
            ? ['A', 'S', 'R', 'XR', 'UR'] 
            : ['B', 'A', 'S', 'R', 'XR'];
        
        for (let i = 0; i < count; i++) {
            const randomChar = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
            
            let possibleThemes = [...THEMES_GENERAL];
            if (randomChar.type === "vocal_dance") possibleThemes.push(THEME_EXCLUSIVE_VOCAL);
            if (randomChar.type === "instrumental") possibleThemes.push(THEME_EXCLUSIVE_INSTRUMENTAL);
            
            const randomTheme = possibleThemes[Math.floor(Math.random() * possibleThemes.length)];
            const cardId = `${randomChar.id}_${randomTheme}`;
            
            let initialRank = 'B';
            const roll = Math.random();
            
            if (isPremium) {
                if (roll > 0.9) initialRank = 'UR';
                else if (roll > 0.7) initialRank = 'XR';
                else if (roll > 0.4) initialRank = 'R';
                else if (roll > 0.1) initialRank = 'S';
                else initialRank = 'A';
            } else {
                if (roll > 0.95) initialRank = 'XR';
                else if (roll > 0.85) initialRank = 'R';
                else if (roll > 0.65) initialRank = 'S';
                else if (roll > 0.35) initialRank = 'A';
                else initialRank = 'B';
            }
            
            if (!this.cardInventory[cardId]) {
                this.cardInventory[cardId] = { level: 1, rank: initialRank, xp: 0, count: 1 };
                drawnCards.push({ 
                    id: cardId, 
                    isNew: true, 
                    rank: initialRank, 
                    name: CARD_MAP[cardId]?.displayName || cardId 
                });
            } else {
                this.cardInventory[cardId].count++;
                drawnCards.push({ 
                    id: cardId, 
                    isNew: false, 
                    rank: this.cardInventory[cardId].rank, 
                    name: CARD_MAP[cardId]?.displayName || cardId 
                });
            }
        }
        
        return {
            packName: isPremium ? "Sobre Premium" : "Sobre Normal",
            cards: drawnCards
        };
    }

    loadFromSave(save) {
        if (!save) return;
        
        this.profileName = save.profile?.name || "Lobo Invitado";
        this.createdAt = save.profile?.createdAt || Date.now();
        this.xp = save.progression?.xp || 0;
        this.level = save.progression?.level || 1;
        this.biblioTokens = save.progression?.biblioTokens || 0;
        this.rhythmShards = save.progression?.rhythmShards || 0;
        this.selectedCollections = save.library?.selectedCollections || ["c1"];
        this.bookProgress = save.library?.bookProgress || {};
        this.completedBooks = save.library?.completedBooks || [];
        this.cardInventory = save.cards?.inventory || {};
        this.equippedCards = save.cards?.equipped || [];
        this.rhythm = save.rhythm || { bestScores: {}, plays: 0 };
        
        this.savedPlayer = {
            ...this.createEmptyPlayer("local", this.profileName),
            money: save.player?.money || 0,
            shovel: save.player?.shovel || "toy",
            inventory: save.player?.inventory || []
        };
    }

    toSave() {
        const p = this.getActivePlayer();
        return {
            version: 4,
            profile: { name: this.profileName, createdAt: this.createdAt, updatedAt: Date.now() },
            player: { money: p.money, shovel: p.shovel, inventory: p.inventory },
            progression: { 
                xp: this.xp, 
                level: this.level, 
                biblioTokens: this.biblioTokens, 
                rhythmShards: this.rhythmShards 
            },
            library: { 
                selectedCollections: this.selectedCollections, 
                bookProgress: this.bookProgress, 
                completedBooks: this.completedBooks 
            },
            cards: { inventory: this.cardInventory, equipped: this.equippedCards },
            rhythm: this.rhythm,
            settings: { autoSave: true }
        };
    }

    getAvailableBooks() {
        return BOOK_CATALOG.filter(b => this.selectedCollections.includes(b.collection));
    }

    toggleCollection(id) {
        const index = this.selectedCollections.indexOf(id);
        if (index >= 0) {
            if (this.selectedCollections.length <= 1) return false;
            this.selectedCollections.splice(index, 1);
            return true;
        } else {
            if (this.selectedCollections.length >= 3) return false;
            this.selectedCollections.push(id);
            return true;
        }
    }

    readPage(bookId) {
        const book = BOOK_CATALOG.find(b => b.id === bookId);
        if (!book) return null;
        
        if (this.completedBooks.includes(bookId)) {
            return null;
        }
        
        const currentProgress = this.bookProgress[bookId] || 0;
        if (currentProgress >= book.pages) {
            return null;
        }
        
        this.bookProgress[bookId] = currentProgress + 1;
        const newProgress = currentProgress + 1;
        
        let completed = false;
        if (newProgress >= book.pages) {
            this.completedBooks.push(bookId);
            this.biblioTokens += book.rewardBT;
            this.addXP(book.rewardXP);
            completed = true;
        }
        
        return {
            book: book,
            progress: newProgress,
            completed: completed,
            rewardBT: completed ? book.rewardBT : 0,
            rewardXP: completed ? book.rewardXP : 0
        };
    }

    openChromoPack(type) {
        const pack = CHROMO_PACKS[type];
        if (!pack) return null;
        
        if (this.biblioTokens < pack.cost) return null;
        
        this.biblioTokens -= pack.cost;
        const results = [];
        let completions = [];
        
        const availableBooks = this.getAvailableBooks();
        if (availableBooks.length === 0) {
            this.biblioTokens += pack.cost;
            return null;
        }
        
        for (let i = 0; i < pack.pages; i++) {
            const randomBook = availableBooks[Math.floor(Math.random() * availableBooks.length)];
            results.push(randomBook);
            
            const currentProgress = this.bookProgress[randomBook.id] || 0;
            if (currentProgress < randomBook.pages) {
                this.bookProgress[randomBook.id] = currentProgress + 1;
                
                if (this.bookProgress[randomBook.id] >= randomBook.pages) {
                    if (!this.completedBooks.includes(randomBook.id)) {
                        this.completedBooks.push(randomBook.id);
                        this.biblioTokens += randomBook.rewardBT;
                        this.addXP(randomBook.rewardXP);
                        completions.push(randomBook);
                    }
                }
            }
        }
        
        this.chromoInventory.unshift({
            packName: pack.name,
            pages: results.length,
            completions: completions.length,
            timestamp: Date.now()
        });
        
        return {
            packName: pack.name,
            results: results,
            completions: completions
        };
    }

    recordRhythm(results) {
        this.rhythm.plays++;
        
        const songId = results.songId || "bed_of_thorns";
        const prevBest = this.rhythm.bestScores[songId] || 0;
        if (results.score > prevBest) {
            this.rhythm.bestScores[songId] = results.score;
        }
        
        let btReward = Math.floor(results.score / 500);
        let xpReward = Math.floor(results.score / 20);
        
        if (results.rank === "S+" || results.rank === "S") {
            btReward += 100;
            xpReward += 200;
        } else if (results.rank === "A") {
            btReward += 50;
            xpReward += 100;
        }
        
        this.biblioTokens += btReward;
        this.addXP(xpReward);
        
        return {
            bt: btReward,
            xp: xpReward
        };
    }
}
