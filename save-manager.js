/**
 * WOLFY WORLD - SAVE MANAGER v4
 * Guarda progreso en localStorage compatible con el nuevo sistema de cartas RPG.
 */

// Cambiamos la clave a v4 para asegurar compatibilidad con la nueva estructura de GameState
const SAVE_KEY = "wolfy_world_save_v4";

const SaveManager = {
    /**
     * Verifica si existe un guardado válido
     */
    exists() {
        return localStorage.getItem(SAVE_KEY) !== null;
    },

    /**
     * Carga los datos del localStorage
     * @returns {Object|null} Datos parseados o null si no hay save/error
     */
    load() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return null;
            
            const data = JSON.parse(raw);
            
            // Validación básica de integridad
            if (!data.version || data.version < 4) {
                console.warn("Save antiguo detectado. Se ignorará para prevenir errores.");
                return null; 
            }
            
            return data;
        } catch (e) {
            console.error("Error cargando save:", e);
            return null;
        }
    },

    /**
     * Guarda los datos en localStorage
     * @param {Object} data - Objeto completo desde GameState.toSave()
     * @returns {boolean} Éxito o fracaso
     */
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

    /**
     * Crea un perfil por defecto completamente nuevo
     * @param {string} name - Nombre del jugador
     * @returns {Object} El objeto de save recién creado
     */
    createDefault(name = "Lobo Invitado") {
        const save = {
            version: 4, // Versión actualizada
            
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
                biblioTokens: 0,
                rhythmShards: 0 // Nueva moneda añadida
            },
            
            library: {
                selectedCollections: ["c1"],
                bookProgress: {},
                completedBooks: []
            },
            
            // Estructura de Cartas Actualizada (Objeto en lugar de array simple)
            cards: {
                inventory: {},   // { cardId: { level, rank, xp, count } }
                equipped: []     // [ cardId, cardId... ]
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

    /**
     * Borra todo el progreso local
     */
    clear() {
        localStorage.removeItem(SAVE_KEY);
    }
};
