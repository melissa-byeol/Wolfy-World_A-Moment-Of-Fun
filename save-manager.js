/**
 * WOLFY WORLD - SAVE MANAGER
 * Guarda progreso en localStorage.
 */

const SAVE_KEY = "wolfy_world_save_v1";

const SaveManager = {
    exists() {
        return localStorage.getItem(SAVE_KEY) !== null;
    },

    load() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            console.error("Error cargando save:", e);
            return null;
        }
    },

    save(data) {
        try {
            if (!data.profile) data.profile = {};
            data.profile.updatedAt = Date.now();
            localStorage.setItem(SAVE_KEY, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error("Error guardando:", e);
            return false;
        }
    },

    createDefault(name = "Lobo Invitado") {
        const save = {
            version: 1,
            profile: {
                name: name,
                createdAt: Date.now(),
                updatedAt: Date.now()
            },
            player: {
                money: 0,
                shovel: "toy",
                inventory: []
            },
            progression: {
                xp: 0,
                level: 1,
                biblioTokens: 0
            },
            library: {
                selectedCollections: ["c1"],
                bookProgress: {},
                completedBooks: []
            },
            collection: {
                chromos: [],
                cards: [],
                equippedCards: []
            },
            rhythm: {
                bestScores: {},
                plays: 0
            },
            settings: {
                autoSave: true
            }
        };

        this.save(save);
        return save;
    },

    clear() {
        localStorage.removeItem(SAVE_KEY);
    }
};
