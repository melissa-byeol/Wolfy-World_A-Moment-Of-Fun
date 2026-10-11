/**
 * WOLFY WORLD - GAME STATE MANAGER
 * Lógica pura del juego.
 */

// --- PALAS ---
const SHOVEL_DATA = {
    toy: { name: "Juguete", price: 0, luck: 1 },
    training: { name: "Entrenamiento", price: 100, luck: 2 },
    iron: { name: "Hierro", price: 500, luck: 5 },
    steel: { name: "Acero", price: 1500, luck: 10 }
};

// --- TESOROS ---
const TREASURE_TYPES = [
    { name: "Botella de Plástico", val: 5, btChance: 0 },
    { name: "Carbón", val: 10, btChance: 0.1 },
    { name: "Linterna Desgastada", val: 25, btChance: 0.3 },
    { name: "Wolficha de Bronce Vieja", val: 50, btChance: 0.6 }
];

// --- COLECCIONES DE BIBLIOTECA ---
const COLLECTIONS = [
    {
        id: "c1",
        name: "Conociendo Wolfy World",
        description: "Colección inicial sobre lobitos, clickers y huesitos dorados."
    }
];

// --- LIBROS ---
// IMPORTANTE: rewardBT es lo que DA al completarse, no lo que cuesta.
const BOOK_CATALOG = [
    {
        id: "b1",
        collection: "c1",
        title: "Wolfy Clicker Incremental",
        pages: 8,
        rewardBT: 50,
        rewardXP: 100,
        rarity: "common"
    },
    {
        id: "b2",
        collection: "c1",
        title: "Características De Los Wolfies I [Inteligencia]",
        pages: 8,
        rewardBT: 50,
        rewardXP: 100,
        rarity: "common"
    },
    {
        id: "b3",
        collection: "c1",
        title: "Características De Los Wolfies II [Agilidad]",
        pages: 8,
        rewardBT: 100,
        rewardXP: 250,
        rarity: "rare"
    },
    {
        id: "b4",
        collection: "c1",
        title: "Características De Los Wolfies III [Fuerza]",
        pages: 8,
        rewardBT: 100,
        rewardXP: 250,
        rarity: "rare"
    },
    {
        id: "b5",
        collection: "c1",
        title: "Huesitos Dorados",
        pages: 8,
        rewardBT: 250,
        rewardXP: 500,
        rarity: "epic"
    },
    {
        id: "b6",
        collection: "c1",
        title: "Conoce a Wolfy",
        pages: 8,
        rewardBT: 250,
        rewardXP: 500,
        rarity: "epic"
    }
];

// --- PAQUETES DE CROMOS ---
const CHROMO_PACKS = {
    small: {
        name: "Paquete Pequeño",
        cost: 50,
        pages: 5,
        minNew: 0
    },
    basic: {
        name: "Paquete Básico",
        cost: 150,
        pages: 8,
        minNew: 1
    },
    large: {
        name: "Paquete Grande",
        cost: 400,
        pages: 12,
        minNew: 3
    }
};

// --- PAQUETES DE CARTAS PARA PROJECT MOONLIGHT ---
const CARD_PACKS = {
    small: {
        name: "Sobre de Cartas Pequeño",
        cost: 40,
        cards: 3,
        guaranteeRare: false
    },
    basic: {
        name: "Sobre de Cartas Básico",
        cost: 100,
        cards: 6,
        guaranteeRare: false
    },
    lunar: {
        name: "Sobre Lunar",
        cost: 250,
        cards: 10,
        guaranteeRare: true
    }
};

// --- TIPOS DE CARTAS ---
const CARD_TYPES = [
    { id: "note", name: "Carta Nota", rarity: "common", effect: "+5% puntuación base" },
    { id: "combo", name: "Carta Combo", rarity: "rare", effect: "Empieza con combo 10" },
    { id: "shield", name: "Carta Escudo", rarity: "epic", effect: "Absorbe 3 fallos" },
    { id: "moon", name: "Carta Moonlight", rarity: "legendary", effect: "+25% puntuación" }
];

class GameState {
    constructor() {
        // Multijugador
        this.players = {};
        this.myId = null;
        this.isHost = false;
        this.roomCode = "";

        // Perfil local
        this.profileName = "Lobo Invitado";
        this.createdAt = Date.now();

        // Progresión global
        this.xp = 0;
        this.level = 1;
        this.biblioTokens = 0;

        // Biblioteca
        this.selectedCollections = ["c1"];
        this.bookProgress = {};
        this.completedBooks = [];

        // Coleccionables
        this.chromoInventory = [];
        this.cards = [];
        this.equippedCards = [];

        // Project Moonlight
        this.rhythm = {
            bestScores: {},
            plays: 0
        };

        // Jugador "single player" / respaldo local
        this.savedPlayer = this.createEmptyPlayer("local", this.profileName);
    }

    createEmptyPlayer(id, name) {
        return {
            id: id,
            name: name,
            x: 200 + Math.random() * 100,
            y: 150 + Math.random() * 100,
            money: 0,
            shovel: "toy",
            inventory: [],
            color: "#f1c40f"
        };
    }

    initPlayer(id, name, isHost) {
        this.myId = id;
        this.isHost = isHost;
        this.profileName = name || this.profileName;

        const base = this.savedPlayer;

        this.players[id] = {
            id: id,
            name: name,
            x: 200 + Math.random() * 100,
            y: 150 + Math.random() * 100,
            money: base.money || 0,
            shovel: base.shovel || "toy",
            inventory: Array.isArray(base.inventory) ? [...base.inventory] : [],
            color: isHost ? "#f1c40f" : "#e74c3c"
        };
    }

    getActivePlayer() {
        return this.players[this.myId] || this.savedPlayer;
    }

    syncSavedPlayer() {
        const p = this.getActivePlayer();
        if (p !== this.savedPlayer) {
            this.savedPlayer.money = p.money;
            this.savedPlayer.shovel = p.shovel;
            this.savedPlayer.inventory = Array.isArray(p.inventory) ? [...p.inventory] : [];
        }
    }

    updateMyPosition(x, y) {
        const p = this.getActivePlayer();
        p.x = x;
        p.y = y;
    }

    addRemotePlayer(data) {
        if (data.id !== this.myId) {
            this.players[data.id] = data;
        }
    }

    removePlayer(id) {
        delete this.players[id];
    }

    getAllPlayers() {
        return Object.values(this.players);
    }

    // --- ECONOMÍA BÁSICA ---
    addBiblioTokens(amount) {
        this.biblioTokens += amount;
    }

    addXP(amount) {
        this.xp += amount;
        this.level = Math.floor(this.xp / 1000) + 1;
    }

    // --- MINERÍA ---
    mineTreasure() {
        const p = this.getActivePlayer();
        const luck = SHOVEL_DATA[p.shovel].luck;

        let roll = Math.random() * 100;
        let tierIndex = 0;

        if (roll > 95) tierIndex = 3;
        else if (roll > 75) tierIndex = 2;
        else if (roll > 40) tierIndex = 1;
        else tierIndex = 0;

        if (luck >= 5 && Math.random() < 0.2) {
            tierIndex = Math.min(tierIndex + 1, 3);
        }

        const template = TREASURE_TYPES[tierIndex];
        const treasure = { ...template, timestamp: Date.now() };

        if (Math.random() < treasure.btChance) {
            this.biblioTokens += 5;
        }

        p.inventory.push(treasure);
        this.syncSavedPlayer();
        return treasure;
    }

    sellInventory() {
        const p = this.getActivePlayer();
        let totalMoney = 0;

        p.inventory.forEach(item => {
            totalMoney += item.val;
        });

        p.money += totalMoney;
        p.inventory = [];
        this.syncSavedPlayer();

        return { money: totalMoney };
    }

    buyShovel(type) {
        const p = this.getActivePlayer();
        const cost = SHOVEL_DATA[type].price;

        if (p.money >= cost) {
            p.money -= cost;
            p.shovel = type;
            this.syncSavedPlayer();
            return true;
        }

        return false;
    }

    // --- BIBLIOTECA ---
    getAvailableBooks() {
        return BOOK_CATALOG.filter(b => this.selectedCollections.includes(b.collection));
    }

    toggleCollection(id) {
        const index = this.selectedCollections.indexOf(id);

        if (index >= 0) {
            if (this.selectedCollections.length <= 1) return false;
            this.selectedCollections.splice(index, 1);
            return true;
        }

        if (this.selectedCollections.length >= 3) return false;
        this.selectedCollections.push(id);
        return true;
    }

    addBookPage(bookId, count = 1) {
        const book = BOOK_CATALOG.find(b => b.id === bookId);
        if (!book) return null;

        if (this.completedBooks.includes(bookId)) return null;

        let current = this.bookProgress[bookId] || 0;
        let added = 0;

        for (let i = 0; i < count; i++) {
            if (current < book.pages) {
                current++;
                added++;
            } else {
                break;
            }
        }

        this.bookProgress[bookId] = current;

        if (current >= book.pages && !this.completedBooks.includes(bookId)) {
            this.completedBooks.push(bookId);
            this.biblioTokens += book.rewardBT;
            this.addXP(book.rewardXP);

            return {
                book,
                completed: true,
                added,
                rewardBT: book.rewardBT,
                rewardXP: book.rewardXP
            };
        }

        return {
            book,
            completed: false,
            added
        };
    }

    readPage(bookId) {
        return this.addBookPage(bookId, 1);
    }

    // --- CROMOS ---
    openChromoPack(type) {
        const pack = CHROMO_PACKS[type];
        if (!pack) return null;

        if (this.biblioTokens < pack.cost) return null;

        this.biblioTokens -= pack.cost;

        const available = this.getAvailableBooks();
        if (available.length === 0) return null;

        const results = [];
        const completions = [];

        for (let i = 0; i < pack.pages; i++) {
            const incomplete = available.filter(b =>
                !this.completedBooks.includes(b.id) &&
                (this.bookProgress[b.id] || 0) < b.pages
            );

            let pool = available;

            if (i < (pack.minNew || 0) && incomplete.length > 0) {
                pool = incomplete;
            }

            const book = pool[Math.floor(Math.random() * pool.length)];
            const res = this.addBookPage(book.id, 1);

            if (res) {
                results.push({
                    bookId: book.id,
                    title: book.title,
                    rarity: book.rarity,
                    completed: res.completed
                });

                if (res.completed) {
                    completions.push({
                        title: book.title,
                        bt: res.rewardBT,
                        xp: res.rewardXP
                    });
                }
            }
        }

        this.addXP(pack.pages * 5);

        this.chromoInventory.unshift({
            type: "pack",
            packName: pack.name,
            pages: results.length,
            completions: completions.length,
            timestamp: Date.now()
        });

        if (this.chromoInventory.length > 20) {
            this.chromoInventory.pop();
        }

        return {
            packName: pack.name,
            results,
            completions
        };
    }

    // --- CARTAS ---
    drawCard(forceNonCommon = false) {
        let pool = [...CARD_TYPES];

        if (forceNonCommon) {
            const better = pool.filter(c => c.rarity !== "common");
            if (better.length > 0) pool = better;
        }

        // Pesos simples
        const weighted = [];
        pool.forEach(card => {
            let weight = 1;
            if (card.rarity === "common") weight = 60;
            if (card.rarity === "rare") weight = 25;
            if (card.rarity === "epic") weight = 12;
            if (card.rarity === "legendary") weight = 3;

            for (let i = 0; i < weight; i++) weighted.push(card);
        });

        return weighted[Math.floor(Math.random() * weighted.length)] || pool[0];
    }

    openCardPack(type) {
        const pack = CARD_PACKS[type];
        if (!pack) return null;

        if (this.biblioTokens < pack.cost) return null;

        this.biblioTokens -= pack.cost;

        const drawn = [];

        for (let i = 0; i < pack.cards; i++) {
            const forceRare = pack.guaranteeRare && i === 0;
            const card = this.drawCard(forceRare);
            this.cards.push(card.id);
            drawn.push(card);
        }

        return {
            packName: pack.name,
            cards: drawn
        };
    }

    toggleEquipCard(cardId) {
        const index = this.equippedCards.indexOf(cardId);

        if (index >= 0) {
            this.equippedCards.splice(index, 1);
            return true;
        }

        if (this.equippedCards.length >= 3) return false;

        this.equippedCards.push(cardId);
        return true;
    }

    getCardEffects() {
        const equipped = this.equippedCards;

        return {
            startCombo: equipped.includes("combo") ? 10 : 0,
            shields: equipped.includes("shield") ? 3 : 0,
            scoreMultiplier:
                1 +
                (equipped.includes("note") ? 0.05 : 0) +
                (equipped.includes("moon") ? 0.25 : 0)
        };
    }

    // --- PROJECT MOONLIGHT ---
    recordRhythm(results) {
        this.rhythm.plays++;

        const songId = "bed";
        const prev = this.rhythm.bestScores[songId] || 0;

        if (results.score > prev) {
            this.rhythm.bestScores[songId] = results.score;
        }

        const btReward = Math.floor(results.score / 500) + (results.rank !== "F" ? 50 : 0);
        const xpReward = Math.floor(results.score / 20);

        this.biblioTokens += btReward;
        this.addXP(xpReward);

        return {
            bt: btReward,
            xp: xpReward
        };
    }

    // --- SAVE / LOAD ---
    loadFromSave(save) {
        if (!save) return;

        this.profileName = save.profile?.name || "Lobo Invitado";
        this.createdAt = save.profile?.createdAt || Date.now();

        this.xp = save.progression?.xp || 0;
        this.level = save.progression?.level || 1;
        this.biblioTokens = save.progression?.biblioTokens || 0;

        this.selectedCollections = Array.isArray(save.library?.selectedCollections) && save.library.selectedCollections.length
            ? save.library.selectedCollections
            : ["c1"];

        this.bookProgress = save.library?.bookProgress || {};
        this.completedBooks = Array.isArray(save.library?.completedBooks) ? save.library.completedBooks : [];

        this.chromoInventory = Array.isArray(save.collection?.chromos) ? save.collection.chromos : [];
        this.cards = Array.isArray(save.collection?.cards) ? save.collection.cards : [];
        this.equippedCards = Array.isArray(save.collection?.equippedCards) ? save.collection.equippedCards : [];

        this.rhythm = save.rhythm || { bestScores: {}, plays: 0 };

        this.savedPlayer = {
            ...this.createEmptyPlayer("local", this.profileName),
            money: save.player?.money || 0,
            shovel: save.player?.shovel || "toy",
            inventory: Array.isArray(save.player?.inventory) ? save.player.inventory : []
        };
    }

    toSave() {
        this.syncSavedPlayer();
        const p = this.getActivePlayer();

        return {
            version: 1,
            profile: {
                name: this.profileName,
                createdAt: this.createdAt,
                updatedAt: Date.now()
            },
            player: {
                money: p.money,
                shovel: p.shovel,
                inventory: p.inventory
            },
            progression: {
                xp: this.xp,
                level: this.level,
                biblioTokens: this.biblioTokens
            },
            library: {
                selectedCollections: this.selectedCollections,
                bookProgress: this.bookProgress,
                completedBooks: this.completedBooks
            },
            collection: {
                chromos: this.chromoInventory,
                cards: this.cards,
                equippedCards: this.equippedCards
            },
            rhythm: this.rhythm,
            settings: {
                autoSave: true
            }
        };
    }
}
