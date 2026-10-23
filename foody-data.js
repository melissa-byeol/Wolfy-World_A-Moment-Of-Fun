/**
 * WOLFY WORLD - FOODY DATA
 * Definición de ítems y reglas básicas de la tienda.
 */

const FOOD_ITEMS = [
    // SNACKS (Ligeros, poco valor)
    { id: 'chips', name: 'Chips', emoji: '🍟', weight: 0.5, value: 10, type: 'snack' },
    { id: 'cookie', name: 'Galleta', emoji: '🍪', weight: 0.2, value: 5, type: 'snack' },
    { id: 'candy', name: 'Caramelo', emoji: '🍬', weight: 0.1, value: 8, type: 'snack' },
    
    // DRINKS (Medios, buen valor)
    { id: 'soda', name: 'Refresco', emoji: '🥤', weight: 0.8, value: 25, type: 'drink' },
    { id: 'water', name: 'Agua', emoji: '💧', weight: 1.0, value: 15, type: 'drink' },
    { id: 'juice', name: 'Jugo', emoji: '🧃', weight: 0.9, value: 20, type: 'drink' },

    // FRESH/HEAVY (Pesados, alto valor)
    { id: 'apple', name: 'Manzana', emoji: '🍎', weight: 0.3, value: 12, type: 'fresh' },
    { id: 'bread', name: 'Pan', emoji: '🍞', weight: 1.5, value: 30, type: 'fresh' },
    { id: 'meat', name: 'Carne', emoji: '🥩', weight: 2.0, value: 50, type: 'fresh' },
    { id: 'cake', name: 'Pastel', emoji: '🍰', weight: 3.0, value: 80, type: 'dessert' }
];

// Configuración del Minijuego
const FOODY_CONFIG = {
    GAME_DURATION_SECONDS: 60,
    SPAWN_RATE_MS: 800, // Cada cuántos ms aparece comida nueva
    MAX_ITEMS_ON_SCREEN: 15,
    TILE_SIZE: 40
};

window.FOOD_ITEMS = FOOD_ITEMS;
window.FOODY_CONFIG = FOODY_CONFIG;
