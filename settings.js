/**
 * WOLFY WORLD - SETTINGS MANAGER v1
 * Gestiona preferencias globales (carriles, volumen, etc.)
 */

const Settings = {
    defaults: {
        laneCount: 4, // 4 o 6
        keyLayout: 'classic' // 'classic' (DFJK) o 'wide' (DFGHJK)
    },
    
    current: {},

    init() {
        const saved = localStorage.getItem('wolfy_settings');
        if (saved) {
            try {
                this.current = { ...this.defaults, ...JSON.parse(saved) };
            } catch(e) {
                console.warn("Error cargando settings, usando defaults.");
                this.current = { ...this.defaults };
            }
        } else {
            this.current = { ...this.defaults };
        }
        
        // Asegurar consistencia entre laneCount y layout
        if(this.current.laneCount === 6) this.current.keyLayout = 'wide';
        if(this.current.laneCount === 4) this.current.keyLayout = 'classic';
    },

    save() {
        localStorage.setItem('wolfy_settings', JSON.stringify(this.current));
    },

    setLaneCount(count) {
        this.current.laneCount = count;
        if (count === 4) this.current.keyLayout = 'classic';
        if (count === 6) this.current.keyLayout = 'wide';
        this.save();
        
        // Notificar al motor de ritmo si está disponible
        if(window.RhythmEngine && typeof window.RhythmEngine.updateSettings === 'function') {
            window.RhythmEngine.updateSettings();
        }
    }
};

window.Settings = Settings;
