/**
 * WOLFY WORLD - GAME STATE MANAGER v6
 * Lógica pura: Catálogo Real, Potencias Acumuladas, Feed System.
 */

// --- CONFIGURACIÓN DE RANGOS Y POTENCIAS ACUMULATIVAS ---
const RANK_CONFIG = {
    'B':  { powerInc: 1,  maxLvl: 10, nextRankCost: 100,   nextRank: 'A' },
    'A':  { powerInc: 2,  maxLvl: 20, nextRankCost: 500,   nextRank: 'S' },
    'S':  { powerInc: 3,  maxLvl: 30, nextRankCost: 1000,  nextRank: 'R' },
    'R':  { powerInc: 4,  maxLvl: 40, nextRankCost: 2000,  nextRank: 'XR' },
    'XR': { powerInc: 5,  maxLvl: 50, nextRankCost: 5000,  nextRank: 'UR' },
    'UR': { powerInc: 6,  maxLvl: 60, nextRankCost: 10000, nextRank: 'MR' },
    'MR': { powerInc: 8,  maxLvl: 70, nextRankCost: null,  nextRank: null } 
};
const RANK_ORDER = ['B', 'A', 'S', 'R', 'XR', 'UR', 'MR'];

// --- CATÁLOGO DE ARTISTAS REALES ---
// type: general | vocal_lobito | inst_lobito | puppy_special
const CHARACTERS = [
    // LOBITOS GENERALES & VOCALES/DANZA
    { id: "lobito", name: "Lobito", role: "general" },
    { id: "cantante", name: "Lobito Cantante", role: "vocal" },
    { id: "rapero", name: "Lobito Rapero", role: "vocal" },
    { id: "bailarin", name: "Lobito Bailarín", role: "dance" },
    { id: "tecladista", name: "Lobito Tecladista", role: "inst" },
    { id: "baterista", name: "Lobito Baterista", role: "inst" },
    { id: "guitarrero", name: "Lobito Guitarrero", role: "inst" },
    { id: "bajista", name: "Lobito Bajista", role: "inst" },
    
    // CACHORRITOS / CACHORROS (Exclusivo We're the New Kids)
    { id: "cachorrito", name: "Cachorrito", role: "puppy_general" },
    { id: "xilofonero", name: "Cachorrito Xilofonero", role: "puppy_inst" },
    { id: "trompetero", name: "Cachorrito Trompetero", role: "puppy_inst" },
    { id: "acelerado", name: "Cachorrito Acelerado", role: "puppy_dance" },
    { id: "breakdancer", name: "Cachorrito Breakdancer", role: "puppy_dance" },
    { id: "vocal_bajo", name: "Cachorro Vocalista Bajo", role: "puppy_vocal" },
    { id: "saxofonero", name: "Cachorro Saxofonero", role: "puppy_inst" },
    { id: "panderista", name: "Cachorrita Panderista", role: "puppy_inst" },

    // LOBITAS (Exclusivo Sharpened/Focused según rol)
    { id: "lobita", name: "Lobita", role: "general" },
    { id: "vocaloid", name: "Lobita Vocaloid", role: "vocal" },
    { id: "adelantadora", name: "Lobita Adelantadora", role: "dance" },
    { id: "coordinada", name: "Lobita Coordinada", role: "vocal" },
    { id: "pianita", name: "Lobita Pianista", role: "inst" },
    { id: "guitarrista_l", name: "Lobita Guitarrista", role: "inst" },
    { id: "flautista", name: "Lobita Flautista", role: "inst" }
];

// --- TEMAS DISPONIBLES ---
const THEMES_GENERAL = ["Themeless", "Curiosity", "Playtime", "Party O'Clock", "[FX] Orange-White Blooded"];
const THEME_PUPPY_EXCLUSIVE = "We're the new kids";
const THEME_LOBITO_VOCAL_EXCLUSIVE = "Sharpened Vocals";
const THEME_LOBITO_INST_EXCLUSIVE = "Focused Practice";

// Fábrica de Catálogo: Genera todas las combinaciones válidas
function generateCardCatalog() {
    const catalog = [];
    
    CHARACTERS.forEach(char => {
        // 1. Temas Generales (Todos tienen acceso)
        THEMES_GENERAL.forEach(theme => {
            catalog.push({
                id: `${char.id}_${theme.replace(/\s+/g, '_').toLowerCase()}`,
                charId: char.id,
                theme: theme,
                displayName: `${char.name} [${theme}]`,
                rarityBase: 'common' // Para filtros futuros
            });
        });

        // 2. Tema Exclusivo para Cachorritos/Cachorros
        if (char.role.startsWith('puppy')) {
            catalog.push({
                id: `${char.id}_new_kids`,
                charId: char.id,
                theme: THEME_PUPPY_EXCLUSIVE,
                displayName: `${char.name} [New Kids]`,
                rarityBase: 'rare'
            });
        }

        // 3. Tema Exclusivo para Lobitos/Lobitas Vocales/Danza
        if ((char.role === 'vocal' || char.role === 'dance') && !char.role.startsWith('puppy')) {
             catalog.push({
                id: `${char.id}_sharpened`,
                charId: char.id,
                theme: THEME_LOBITO_VOCAL_EXCLUSIVE,
                displayName: `${char.name} [Sharpened]`,
                rarityBase: 'epic'
            });
        }

        // 4. Tema Exclusivo para Lobitos/Lobitas Instrumentales
        if (char.role === 'inst' && !char.role.startsWith('puppy')) {
            catalog.push({
                id: `${char.id}_focused`,
                charId: char.id,
                theme: THEME_LOBITO_INST_EXCLUSIVE,
                displayName: `${char.name} [Focused]`,
                rarityBase: 'epic'
            });
        }
    });

    return catalog;
}

const FULL_CARD_CATALOG = generateCardCatalog();
const CARD_MAP = {};
FULL_CARD_CATALOG.forEach(c => CARD_MAP[c.id] = c);

// --- ESTADO GLOBAL DEL JUEGO ---
class GameState {
    constructor() {
        this.profileName = "Invitado";
        this.tokens = 0;
        this.shards = 0;
        
        // Inventario de Cartas: { cardId: { level, rank, xp, count } }
        this.cardInventory = {};
        this.equippedCards = []; // Máx 5
        
        this.rhythmStats = { bestScores: {}, plays: 0 };
    }

    initUser(name, tokens = 100, shards = 10) {
        this.profileName = name;
        this.tokens = tokens;
        this.shards = shards;
    }

    getCardRecord(cardId) {
        if (!this.cardInventory[cardId]) {
            this.cardInventory[cardId] = { level: 1, rank: "B", xp: 0, count: 1 };
        }
        return this.cardInventory[cardId];
    }

    calculateCardPower(cardId) {
        const record = this.getCardRecord(cardId);
        const currentRankIdx = RANK_ORDER.indexOf(record.rank);
        if (currentRankIdx === -1) return 1;

        let totalPower = 0;

        // Sumar potencia de rangos anteriores maximizados
        for (let i = 0; i < currentRankIdx; i++) {
            const prevRank = RANK_ORDER[i];
            const config = RANK_CONFIG[prevRank];
            totalPower += config.maxLvl * config.powerInc;
        }

        // Sumar potencia del rango actual
        const currentConfig = RANK_CONFIG[record.rank];
        totalPower += record.level * currentConfig.powerInc;

        return totalPower;
    }

    applyXpToCards(xpGained) {
        if (xpGained <= 0) return;
        const equippedIds = [...this.equippedCards];
        if (equippedIds.length === 0) return;

        const xpPerCard = Math.floor(xpGained / equippedIds.length);
        const LEVEL_THRESHOLD = 100;

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

    upgradeCardRank(cardId) {
        const record = this.getCardRecord(cardId);
        const config = RANK_CONFIG[record.rank];

        if (!config.nextRank) return false;
        if (record.level < config.maxLvl) return false;
        if (this.shards < config.nextRankCost) return false;

        this.shards -= config.nextRankCost;
        record.rank = config.nextRank;
        record.level = 1;
        record.xp = 0;
        return true;
    }

    toggleEquipCard(cardId) {
        const index = this.equippedCards.indexOf(cardId);
        if (index >= 0) {
            this.equippedCards.splice(index, 1);
            return true;
        }
        if (this.equippedCards.length >= 5) return false;
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

        return { success: true, xpGained: totalXpGained, levelsUp: levelsUp, newLevel: targetRecord.level };
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
            
            // Bonus Especial por Tema/Canción
            const catalogEntry = CARD_MAP[id];
            if (catalogEntry) {
                if (songId === "bed_of_thorns" && catalogEntry.theme === "Stillness In The Thorns") {
                     multiplier *= 1.55; // Ejemplo hipotético si existiera ese tema
                }
                // Aquí podrías añadir más sinergias específicas
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
        const costCurrency = isPremium ? 'shards' : 'tokens';
        const costAmount = isPremium ? 50 : 10; 
        
        if (this[costCurrency] < costAmount) return null;
        this[costCurrency] -= costAmount;

        const drawnCards = [];
        const count = isPremium ? 5 : 3; 

        const allowedRanks = isPremium 
            ? ['A', 'S', 'R', 'XR', 'UR'] 
            : ['B', 'A', 'S', 'R', 'XR'];

        for (let i = 0; i < count; i++) {
            const randomChar = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
            
            // Determinar temas posibles basados en el personaje
            let possibleThemes = [...THEMES_GENERAL];
            if (randomChar.role.startsWith('puppy')) possibleThemes.push(THEME_PUPPY_EXCLUSIVE);
            if ((randomChar.role === 'vocal' || randomChar.role === 'dance') && !randomChar.role.startsWith('puppy')) possibleThemes.push(THEME_LOBITO_VOCAL_EXCLUSIVE);
            if (randomChar.role === 'inst' && !randomChar.role.startsWith('puppy')) possibleThemes.push(THEME_LOBITO_INST_EXCLUSIVE);
            
            const randomTheme = possibleThemes[Math.floor(Math.random() * possibleThemes.length)];
            const cardId = `${randomChar.id}_${randomTheme.replace(/\s+/g, '_').toLowerCase()}`;
            
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
                drawnCards.push({ id: cardId, isNew: true, rank: initialRank, name: CARD_MAP[cardId]?.displayName || cardId });
            } else {
                this.cardInventory[cardId].count++;
                drawnCards.push({ id: cardId, isNew: false, rank: this.cardInventory[cardId].rank, name: CARD_MAP[cardId]?.displayName || cardId });
            }
        }

        return {
            packName: isPremium ? "Sobre Premium" : "Sobre Estándar",
            cards: drawnCards
        };
    }

    loadFromSave(save) {
        if (!save) return;
        this.profileName = save.profile?.name || "Invitado";
        this.tokens = save.balance?.tokens || 0;
        this.shards = save.balance?.shards || 0;
        this.cardInventory = save.cards?.inventory || {};
        this.equippedCards = save.cards?.equipped || [];
        this.rhythmStats = save.rhythm || { bestScores: {}, plays: 0 };
    }

    toSave() {
        return {
            version: 6,
            profile: { name: this.profileName },
            balance: { tokens: this.tokens, shards: this.shards },
            cards: { inventory: this.cardInventory, equipped: this.equippedCards },
            rhythm: this.rhythmStats
        };
    }
}

window.GameStateClass = GameState;
