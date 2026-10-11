/**
 * WOLFY WORLD - RHYTHM GAME
 * Project Moonlight: Wolfy Stage
 * Optimizado para "Bed of Thorns" - TXT
 */

class RhythmGame {
    constructor(canvas, callbacks = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.callbacks = callbacks;

        // Configuración visual
        this.width = 800;
        this.height = 450;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.laneCount = 4;
        // Colores inspirados en la paleta de Bed of Thorns (Negro, Rosa intenso, Blanco, Gris oscuro)
        this.laneColors = ["#ff0055", "#ffffff", "#333333", "#aa0033"]; 
        this.keys = { d: 0, f: 1, j: 2, k: 3 };

        // Datos de la canción
        this.song = {
            id: "bed_of_thorns",
            title: "Bed of Thorns",
            artist: "TXT",
            duration: 180, // ~3 minutos (ajustar según tu MP3 real)
            bpm: 96 // Tempo aproximado
        };

        this.running = false;
        this.finished = false;
        this.startTime = 0;
        this.lastFrame = 0;
        this.useAudio = false;
        this.audio = null;

        this.notes = [];
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.hits = 0;
        this.misses = 0;
        this.shields = 0;
        this.multiplier = 1;

        this.hitLineY = this.height - 70;
        // Velocidad ajustada para BPM 96 (más lento que Bad Guy, más rápido que baladas)
        this.noteSpeed = 280; 
        this.hitWindow = 0.20; // Ventana de tolerancia generosa
        this.perfectWindow = 0.08;

        this.effects = {};

        // Input táctil/mouse
        this.canvas.addEventListener("pointerdown", (e) => {
            if (!this.running) return;
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const x = (e.clientX - rect.left) * scaleX;
            const lane = Math.floor(x / (this.canvas.width / this.laneCount));
            this.hitLane(Math.max(0, Math.min(3, lane)));
        });

        this.loop = this.loop.bind(this);
    }

    /**
     * Generador de Chart Semi-Estructural
     * Simula la estructura Intro -> Verso -> Coro -> Drop
     */
    generateChart() {
        const notes = [];
        let currentTime = 2.0; // Empieza tras 2 seg de silencio/intro
        
        const totalDuration = this.song.duration || 180;
        
        // Definir secciones aproximadas (en segundos)
        const sections = [
            { start: 0, end: 15, density: 0.3, type: 'intro' },      // Muy pocas notas
            { start: 15, end: 45, density: 0.6, type: 'verse' },     // Ritmo constante
            { start: 45, end: 60, density: 0.8, type: 'pre_chorus' },// Sube tensión
            { start: 60, end: 90, density: 1.2, type: 'chorus' },    // Muchas notas, patrones claros
            { start: 90, end: 105, density: 0.5, type: 'break' },    // Pausa breve
            { start: 105, end: 135, density: 1.5, type: 'drop' },    // Caída fuerte, notas rápidas
            { start: 135, end: 160, density: 0.9, type: 'outro' }    // Baja energía
        ];

        while (currentTime < totalDuration - 2) {
            // Determinar sección actual
            const currentSection = sections.find(s => currentTime >= s.start && currentTime < s.end) || 
                                   { density: 0.5, type: 'unknown' };

            // Intervalo base inverso proporcional a la densidad
            // Mayor densidad = menor intervalo entre notas
            const baseInterval = 0.6 / currentSection.density; 
            
            // Añadir variación humana (no todas las notas están perfectamente cuadradas)
            const jitter = (Math.random() - 0.5) * 0.1; 
            const interval = Math.max(0.25, baseInterval + jitter);

            // Decidir si poner nota simple o doble/triple
            const roll = Math.random();
            
            if (roll < 0.7) {
                // Nota única
                const lane = Math.floor(Math.random() * this.laneCount);
                notes.push({ time: currentTime, lane, hit: false, missed: false });
            } else if (roll < 0.9) {
                // Doble nota (dos carriles distintos)
                const lanes = [0, 1, 2, 3].sort(() => Math.random() - 0.5).slice(0, 2);
                lanes.forEach(l => notes.push({ time: currentTime, lane: l, hit: false, missed: false }));
            } else {
                // Triple nota (desafío alto)
                const lanes = [0, 1, 2, 3].sort(() => Math.random() - 0.5).slice(0, 3);
                lanes.forEach(l => notes.push({ time: currentTime, lane: l, hit: false, missed: false }));
            }

            currentTime += interval;
        }

        return notes.sort((a, b) => a.time - b.time);
    }

    start(effects = {}, audio = null) {
        this.effects = effects;
        this.audio = audio;

        // Intentar leer duración real del audio si existe
        if (audio && audio.src && isFinite(audio.duration) && audio.duration > 10) {
            this.song.duration = audio.duration;
        }

        this.notes = this.generateChart();
        this.score = 0;
        this.combo = effects.startCombo || 0;
        this.maxCombo = this.combo;
        this.hits = 0;
        this.misses = 0;
        this.shields = effects.shields || 0;
        this.multiplier = effects.scoreMultiplier || 1;
        this.running = true;
        this.finished = false;

        if (audio && audio.src) {
            try {
                audio.currentTime = 0;
                audio.play().catch(() => {});
                this.useAudio = true;
            } catch (e) {
                this.useAudio = false;
            }
        } else {
            this.useAudio = false;
        }

        this.startTime = performance.now();
        this.lastFrame = performance.now();
        requestAnimationFrame(this.loop);
    }

    stop() {
        if (this.running) this.finish();
    }

    getSongTime() {
        if (this.useAudio && this.audio && !this.audio.paused && isFinite(this.audio.currentTime)) {
            return this.audio.currentTime;
        }
        return (performance.now() - this.startTime) / 1000;
    }

    loop(now) {
        if (!this.running) return;

        const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
        this.lastFrame = now;

        const songTime = this.getSongTime();
        this.update(dt, songTime);
        this.draw(songTime);

        if (this.running) {
            requestAnimationFrame(this.loop);
        }
    }

    update(dt, songTime) {
        for (const note of this.notes) {
            if (note.hit || note.missed) continue;

            // Si pasa demasiado tiempo sin golpear
            if (songTime > note.time + this.hitWindow) {
                if (this.shields > 0) {
                    this.shields--;
                    note.hit = true;
                    note.shielded = true;
                } else {
                    note.missed = true;
                    this.misses++;
                    this.combo = 0;
                }
            }
        }

        const allResolved = this.notes.every(n => n.hit || n.missed);
        if (songTime > this.song.duration + 1 || allResolved) {
            this.finish();
        }
    }

    draw(songTime) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        // Fondo dinámico sutil (efecto "latido" muy leve)
        const pulse = Math.sin(songTime * 2) * 0.05 + 0.95;
        const grad = ctx.createLinearGradient(0, 0, 0, this.height);
        grad.addColorStop(0, `rgba(11, 15, 29, ${pulse})`);
        grad.addColorStop(1, `rgba(22, 33, 62, ${pulse})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.width, this.height);

        const laneWidth = this.width / this.laneCount;

        // Carriles
        for (let i = 0; i < this.laneCount; i++) {
            ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.05)";
            ctx.fillRect(i * laneWidth, 0, laneWidth, this.height);

            ctx.strokeStyle = "rgba(255,255,255,0.12)";
            ctx.beginPath();
            ctx.moveTo((i + 1) * laneWidth, 0);
            ctx.lineTo((i + 1) * laneWidth, this.height);
            ctx.stroke();
        }

        // Línea de golpe
        ctx.strokeStyle = "#f1c40f";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, this.hitLineY);
        ctx.lineTo(this.width, this.hitLineY);
        ctx.stroke();

        // Receptores
        for (let i = 0; i < this.laneCount; i++) {
            ctx.fillStyle = this.laneColors[i] + "55";
            ctx.beginPath();
            ctx.arc(i * laneWidth + laneWidth / 2, this.hitLineY, 24, 0, Math.PI * 2);
            ctx.fill();
        }

        // Notas
        for (const note of this.notes) {
            if (note.hit) continue;

            const y = this.hitLineY - (note.time - songTime) * this.noteSpeed;
            if (y < -50 || y > this.height + 50) continue;

            const x = note.lane * laneWidth + laneWidth / 2;

            ctx.fillStyle = note.missed ? "rgba(255,255,255,0.15)" : this.laneColors[note.lane];
            ctx.beginPath();
            ctx.arc(x, y, 18, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = "white";
            ctx.lineWidth = 2;
            ctx.stroke();

            // Icono de rosa/espinas en vez de lobo para variar
            ctx.fillStyle = "white";
            ctx.font = "16px Segoe UI";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("🌹", x, y);
        }

        // HUD
        ctx.fillStyle = "white";
        ctx.font = "bold 18px Segoe UI";
        ctx.textAlign = "left";
        ctx.fillText(`Score: ${this.score}`, 15, 28);
        ctx.fillText(`Combo: ${this.combo}`, 15, 52);
        ctx.fillText(`Escudos: ${this.shields}`, 15, 76);

        ctx.textAlign = "right";
        ctx.fillText(`${this.song.title} - ${this.song.artist}`, this.width - 15, 28);
        ctx.fillText(`Tiempo: ${Math.max(0, songTime).toFixed(1)}s`, this.width - 15, 52);

        ctx.textAlign = "center";
        ctx.font = "14px Segoe UI";
        ctx.fillStyle = "#aaa";
        ctx.fillText("Teclas: D  F  J  K  |  O toca los carriles", this.width / 2, this.height - 18);
    }

    handleKey(key) {
        const lane = this.keys[String(key).toLowerCase()];
        if (lane !== undefined) this.hitLane(lane);
    }

    hitLane(lane) {
        if (!this.running) return;

        const songTime = this.getSongTime();
        let bestNote = null;
        let bestDelta = Infinity;

        for (const note of this.notes) {
            if (note.lane !== lane || note.hit || note.missed) continue;
            const delta = Math.abs(note.time - songTime);
            if (delta <= this.hitWindow && delta < bestDelta) {
                bestNote = note;
                bestDelta = delta;
            }
        }

        if (!bestNote) return;

        const perfect = bestDelta <= this.perfectWindow;
        const base = perfect ? 150 : 100;
        const comboBonus = 1 + Math.min(this.combo, 100) / 200;
        const gained = Math.round(base * this.multiplier * comboBonus);

        bestNote.hit = true;
        bestNote.perfect = perfect;

        this.score += gained;
        this.combo++;
        this.hits++;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    }

    finish() {
        if (this.finished) return;

        this.running = false;
        this.finished = true;

        if (this.audio) {
            try { this.audio.pause(); } catch (e) {}
        }

        const total = this.hits + this.misses;
        const accuracy = total > 0 ? this.hits / total : 1;

        let rank = "F";
        if (accuracy >= 0.95) rank = "S";
        else if (accuracy >= 0.85) rank = "A";
        else if (accuracy >= 0.70) rank = "B";
        else if (accuracy >= 0.50) rank = "C";

        const results = {
            songId: this.song.id,
            score: this.score,
            maxCombo: this.maxCombo,
            hits: this.hits,
            misses: this.misses,
            accuracy,
            rank
        };

        if (this.callbacks.onFinish) {
            this.callbacks.onFinish(results);
        }
    }
}
