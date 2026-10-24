/**
 * WOLFY WORLD - GAME STATE MANAGER v7 (FIXED)
 * Lógica pura: Catálogo Real, Potencias Acumuladas, Feed System + ESTADÍSTICAS FOODY.
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
    
    // CACHORRITOS / CACHORROS
    { id: "cachorrito", name: "Cachorrito", role: "puppy_general" },
    { id: "xilofonero", name: "Cachorrito Xilofonero", role: "puppy_inst" },
    { id: "trompetero", name: "Cachorrito Trompetero", role: "puppy_inst" },
    { id: "acelerado", name: "Cachorrito Acelerado", role: "puppy_dance" },
    { id: "breakdancer", name: "Cachorrito Breakdancer", role: "puppy_dance" },
    { id: "vocal_bajo", name: "Cachorro Vocalista Bajo", role: "puppy_vocal" },
    { id: "saxofonero", name: "Cachorro Saxofonero", role: "puppy_inst" },
    { id: "panderista", name: "Cachorrita Panderista", role: "puppy_inst" },

    // LOBITAS
    { id: "lobita", name: "Lobita", role: "general" },
    { id: "vocaloid", name: "Lobita Vocaloid", role: "vocal" },
    { id: "adelantadora", name: "Lobita Adelantadora", role: "dance" },
    { id: "coordinada", name: "Lobita Coordinada", role: "vocal" },
    { id: "pianita", name: "Lobita Pianista", role: "inst" },
    { id: "guitarrista_l", name: "Lobita Guitarrista", role: "inst" },
    { id: "flautista", name: "Lobita Flautista", role: "inst" }
];

// --- TEMAS DISPONIBLES (OBJETOS ESTRUCTURADOS) ---
// IMPORTANTE: Ahora son objetos con .name, .icon, .color para evitar errores de undefined
const THEMES_GENERAL = [
    { name: "Themeless", color: "#9aa4b2", icon: "⚪", synergy: [ { songId: 'exotic', multiplier: 1.55 } ] },
    { name: "Curiosity", color: "#3498db", icon: "🔍", synergy: [ { songId: 'curious', multiplier: 1.55 } ] },
    { name: "Playtime", color: "#f1c40f", icon: "🎈", synergy: null },
    { name: "Stillness In The Thorns", icon: "🌹", synergy: [ { songId: 'bed_of_thorns', multiplier: 1.55 }, { songId: 'stick_with_you', multiplier: 1.55 } ] }, 
    { name: "Party O'Clock", color: "#e67e22", icon: "🎉", synergy: null },
    { name: "[FX] Orange-White Blooded", color: "#ff5722", icon: "", synergy: null },
    
    // Ejemplo de sinergia SOS
    { 
        name: "Where is the love?", 
        color: "#ff69b4", 
        icon: "❤️‍🔥", 
        synergy: [ { songId: 'sos', multiplier: 1.55 } ] 
    },

    {
        name: "Ascending The Tower",
        color: "linear-gradient(to bottom, #87CEEB 0%, #E0F7FA 50%, #FFFFFF 100%)",
        icon: "",
        synergy: [ { songId: 'top', multiplier: 1.55} ]
    }
];

const THEME_PUPPY_EXCLUSIVE = { 
    name: "We're the new kids", 
    color: "#2ecc71", 
    icon: "🐶", 
    synergy: [ { songId: 'new_kidz', multiplier: 1.55 } ] 
};

const THEME_LOBITO_VOCAL_EXCLUSIVE = { 
    name: "Sharpened Vocals", 
    color: "#9b59b6", 
    icon: "🎤", 
    synergy: null 
};

const THEME_LOBITO_INST_EXCLUSIVE = { 
    name: "Focused Practice", 
    color: "#1abc9c", 
    icon: "🎼", 
    synergy: null 
};

// Helper para generar IDs seguros a partir del nombre del tema
function getSafeThemeId(themeName) {
    return themeName.replace(/\s+/g, '_').toLowerCase().replace(/[^\w]/g, '');
}

// --- ARQUETIPOS DE ESTADÍSTICAS FOODY ---
const FOODY_ARCHETYPES = {
    'TANK': { 
        baseCap: 100, baseSpd: 2, baseStr: 20, baseHp: 100,
        desc: "Equilibrio perfecto entre resistencia y fuerza."
    },
    'SCOUT': { 
        baseCap: 80, baseSpd: 4, baseStr: 5, baseHp: 50,
        desc: "Rápido y ágil, ideal para recoger ítems pequeños antes de que desaparezcan."
    },
    'BRUISER': { 
        baseCap: 120, baseSpd: 1.5, baseStr: 35, baseHp: 120,
        desc: "Tanque pesado. Puede cargar cajas enormes y defenderse de invasores."
    },
    'HEALER': { 
        baseCap: 90, baseSpd: 2.5, baseStr: 10, baseHp: 80,
        special: 'regen', 
        desc: "Mantiene al equipo vivo. Recupera salud pasivamente."
    },
    'HOARDER': { 
        baseCap: 150, baseSpd: 3, baseStr: 8, baseHp: 60,
        special: 'double_pickup', 
        desc: "El almacén ambulante. Prioriza cantidad sobre calidad."
    }
};

// Mapeo de Personajes a Arquetipos
function getArchetype(charId, role) {
    if (charId === 'lobito') return 'TANK';
    if (charId === 'cachorrito') return 'SCOUT';
    
    // Instrumentales pesados -> Bruiser
    if (role === 'inst' && !role.startsWith('puppy')) return 'BRUISER';
    
    // Vocales/Danza suaves -> Healer/Support
    if (role === 'vocal' || role === 'dance') {
        if (charId.includes('pian') || charId.includes('vocaloid') || charId.includes('coord')) return 'HEALER';
        return 'TANK'; // Default vocal/dance es equilibrado
    }
    
    // Puppy Dance/Acelerado -> Hoarder
    if (role.startsWith('puppy') && (role.includes('dance') || role.includes('accel'))) return 'HOARDER';
    
    // Resto de puppies -> Scout
    if (role.startsWith('puppy')) return 'SCOUT';
    
    return 'TANK'; // Fallback
}

// Fábrica de Catálogo CORREGIDA
function generateCardCatalog() {
    const catalog = [];
    
    CHARACTERS.forEach(char => {
        // 1. Temas Generales
        THEMES_GENERAL.forEach(themeObj => {
            const idSuffix = getSafeThemeId(themeObj.name);
            
            catalog.push({
                id: `${char.id}_${idSuffix}`,
                charId: char.id,
                theme: themeObj.name,
                displayName: `${char.name} [${themeObj.icon} ${themeObj.name}]`,
                rarityBase: 'common',
                visualColor: themeObj.color,
                visualIcon: themeObj.icon,
                synergy: themeObj.synergy || [] ,
                archetype: getArchetype(char.id, char.role)
            });
        });

        // 2. Tema Exclusivo Cachorros
        if (char.role.startsWith('puppy')) {
            const idSuffix = getSafeThemeId(THEME_PUPPY_EXCLUSIVE.name);
            catalog.push({
                id: `${char.id}_${idSuffix}`,
                charId: char.id,
                theme: THEME_PUPPY_EXCLUSIVE.name,
                displayName: `${char.name} [${THEME_PUPPY_EXCLUSIVE.icon} New Kids]`,
                rarityBase: 'rare',
                visualColor: THEME_PUPPY_EXCLUSIVE.color,
                visualIcon: THEME_PUPPY_EXCLUSIVE.icon,
                synergy: THEME_PUPPY_EXCLUSIVE.synergy || [] ,
                archetype: getArchetype(char.id, char.role)
            });
        }

        // 3. Tema Exclusivo Vocal/Danza Lobito/a
        if ((char.role === 'vocal' || char.role === 'dance') && !char.role.startsWith('puppy')) {
            const idSuffix = getSafeThemeId(THEME_LOBITO_VOCAL_EXCLUSIVE.name);
            catalog.push({
                id: `${char.id}_${idSuffix}`,
                charId: char.id,
                theme: THEME_LOBITO_VOCAL_EXCLUSIVE.name,
                displayName: `${char.name} [${THEME_LOBITO_VOCAL_EXCLUSIVE.icon} Sharpened]`,
                rarityBase: 'epic',
                visualColor: THEME_LOBITO_VOCAL_EXCLUSIVE.color,
                visualIcon: THEME_LOBITO_VOCAL_EXCLUSIVE.icon,
                synergy: THEME_LOBITO_VOCAL_EXCLUSIVE.synergy || [] ,
                archetype: getArchetype(char.id, char.role)
            });
        }

        // 4. Tema Exclusivo Instrumental Lobito/a
        if (char.role === 'inst' && !char.role.startsWith('puppy')) {
            const idSuffix = getSafeThemeId(THEME_LOBITO_INST_EXCLUSIVE.name);
            catalog.push({
                id: `${char.id}_${idSuffix}`,
                charId: char.id,
                theme: THEME_LOBITO_INST_EXCLUSIVE.name,
                displayName: `${char.name} [${THEME_LOBITO_INST_EXCLUSIVE.icon} Focused]`,
                rarityBase: 'epic',
                visualColor: THEME_LOBITO_INST_EXCLUSIVE.color,
                visualIcon: THEME_LOBITO_INST_EXCLUSIVE.icon,
                synergy: THEME_LOBITO_INST_EXCLUSIVE.synergy || [] ,
                archetype: getArchetype(char.id, char.role)
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
        
        this.cardInventory = {};
        this.equippedCards = []; 
        
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
        for (let i = 0; i < currentRankIdx; i++) {
            const prevRank = RANK_ORDER[i];
            const config = RANK_CONFIG[prevRank];
            totalPower += config.maxLvl * config.powerInc;
        }
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
                } else break;
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
        if (targetRecord.level >= targetConfig.maxLvl) return { success: false, reason: "max_level" };

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

    /**
     * ⭐ NUEVA FUNCIÓN: CALCULAR STATS FÍSICAS PARA FOODY CHAOS ⭐
     */
    getFoodyStats(cardId) {
        const record = this.getCardRecord(cardId);
        const catalogEntry = CARD_MAP[cardId];
        if (!catalogEntry) return null;

        const archKey = catalogEntry.archetype || 'TANK';
        const archData = FOODY_ARCHETYPES[archKey] || FOODY_ARCHETYPES['TANK'];

        const lvlMult = 1 + (record.level * 0.05);
        const rankIdx = RANK_ORDER.indexOf(record.rank);
        const rankMult = Math.pow(1.2, rankIdx);

        return {
            capacity: Math.round(archData.baseCap * lvlMult * rankMult),
            speed: +(archData.baseSpd * (1 + (record.level * 0.02))).toFixed(2), 
            strength: Math.round(archData.baseStr * lvlMult * rankMult),
            hp: Math.round(archData.baseHp * lvlMult * rankMult),
            special: archData.special || null,
            roleName: archKey
        };
    }

        getRhythmStats(songId) {
        let totalPowerSum = 0;
        let shields = 0;
        let startCombo = 0;
        let globalMultiplier = 1.0; // Multiplicador global de score

        this.equippedCards.forEach(id => {
            const power = this.calculateCardPower(id);
            const record = this.getCardRecord(id);
            const catalogEntry = CARD_MAP[id];

            if (!catalogEntry) return;

            // 1. Potencia Base
            let cardEffectivePower = power;

            // 2. Aplicar Escudos y Combo Inicial según Rango
            if (['XR', 'UR', 'MR'].includes(record.rank)) shields += 1;
            if (record.rank === 'MR') startCombo += 10;

            // 3. ⭐ LÓGICA DE MÚLTIPLES SINERGIAS ⭐
            if (catalogEntry.synergies && Array.isArray(catalogEntry.synergies)) {
                catalogEntry.synergies.forEach(syn => {
                    if (syn.songId === songId) {
                        // Opción A: Multiplicar la potencia INDIVIDUAL de la carta
                        cardEffectivePower *= syn.multiplier;
                        
                        // Opción B (Alternativa): Sumar al multiplicador GLOBAL
                        // globalMultiplier *= syn.multiplier; 
                        
                        // Usaremos Opción A para que sea más granular (solo afecta a esa carta)
                    }
                });
            }

            totalPowerSum += cardEffectivePower;
        });

        return {
            power: totalPowerSum > 0 ? totalPowerSum : 1,
            shields: shields,
            startCombo: startCombo,
            multiplier: globalMultiplier // Esto sigue siendo para efectos globales si los añades luego
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

        for (let i = 0; i < count; i++) {
            const randomChar = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
            
            // Construir pool de temas posibles (ahora son OBJETOS)
            let possibleThemesPool = [...THEMES_GENERAL];
            
            if (randomChar.role.startsWith('puppy')) {
                possibleThemesPool.push(THEME_PUPPY_EXCLUSIVE);
            }
            if ((randomChar.role === 'vocal' || randomChar.role === 'dance') && !randomChar.role.startsWith('puppy')) {
                possibleThemesPool.push(THEME_LOBITO_VOCAL_EXCLUSIVE);
            }
            if (randomChar.role === 'inst' && !randomChar.role.startsWith('puppy')) {
                possibleThemesPool.push(THEME_LOBITO_INST_EXCLUSIVE);
            }
            
            // Elegir uno al azar
            const selectedTheme = possibleThemesPool[Math.floor(Math.random() * possibleThemesPool.length)];
            
            // Generar ID usando el helper
            const cardId = `${randomChar.id}_${getSafeThemeId(selectedTheme.name)}`;
            
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
            version: 7,
            profile: { name: this.profileName },
            balance: { tokens: this.tokens, shards: this.shards },
            cards: { inventory: this.cardInventory, equipped: this.equippedCards },
            rhythm: this.rhythmStats
        };
    }
}

window.GameStateClass = GameState;
window.FOODY_ARCHETYPES = FOODY_ARCHETYPES; // Exportar para usar en UI
