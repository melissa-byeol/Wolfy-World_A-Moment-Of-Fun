/**
 * WOLFY WORLD - RHYTHM GAME ENGINE v6
 * Integración Total con Sistema de Potencia de Cartas RPG
 */

class RhythmGame {
    constructor(canvas, callbacks = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.callbacks = callbacks;

        // --- DIMENSIONES LÓGICAS FIJAS ---
        // Siempre dibujamos en este espacio virtual. El CSS escala visualmente.
        this.W = 800;
        this.H = 450;
        
        // Asignar tamaño interno al canvas
        this.canvas.width = this.W;
        this.canvas.height = this.H;

        // --- CONFIGURACIÓN VISUAL ---
        this.laneCount = 4;
        // Paleta Bed of Thorns: Rosa Sangre, Blanco Hueso, Gris Oscuro, Rosa Profundo
        this.laneColors = ["#ff0055", "#ffffff", "#333333", "#aa0033"]; 
        
        // MAPA DE TECLAS
        this.keyMap = { 
            'd': 0, 'f': 1, 'j': 2, 'k': 3,
            'arrowleft': 0, 'arrowup': 1, 'arrowdown': 2, 'arrowright': 3 
        };

        // --- ESTADO DEL JUEGO ---
        this.songData = null; 
        this.notes = [];      
        this.audio = null;
        this.useAudio = false;
        this.running = false;
        this.finished = false;
        this.startTime = 0;
        this.lastFrameTime = 0;

        // --- MECÁNICAS & STATS (Recibidos de GameState) ---
        this.totalPower = 1;      // Suma de potencia de cartas equipadas
        this.scoreMultiplier = 1; // Multiplicadores especiales (ej: Stillness +55%)
        this.shields = 0;         // Escudos iniciales
        this.startComboBonus = 0; // Combo inicial
        
        // Estadísticas actuales de la partida
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.hits = 0;
        this.misses = 0;

        // --- FÍSICA Y JUICIO ---
        this.hitLineY = this.H - 70;
        this.noteSpeed = 450;     // Velocidad de caída (px/s)
        this.visualLeadTime = 1.0; // Segundos de anticipación visual
        
        // Ventanas de juicio (en segundos)
        this.judgeWindowPerfect = 0.06; 
        this.judgeWindowGood = 0.12;    
        this.judgeWindowMiss = 0.18;    

        // --- INICIALIZACIÓN EVENTOS ---
        this.setupInput();
        this.loop = this.loop.bind(this);
        
        // Render inicial vacío para ver el marco antes de cargar chart
        this.renderIdle();
    }

    setupInput() {
        // Teclado Global
        window.addEventListener('keydown', (e) => {
            if (!this.running) return;
            
            const key = e.key.toLowerCase();
            // Prevenir scroll con teclas de juego
            if (["d", "f", "j", "k", " ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
                e.preventDefault();
            }
            // Ignorar repeticiones automáticas (mantener presionada)
            if (e.repeat) return;

            const lane = this.keyMap[key];
            if (lane !== undefined) {
                this.inputHit(lane);
            }
        });

        // Mouse/Touch en Canvas
        this.canvas.addEventListener('pointerdown', (e) => {
            if (!this.running) return;
            
            const rect = this.canvas.getBoundingClientRect();
            // Convertir coordenadas físicas a lógicas
            const scaleX = this.W / rect.width;
            const x = (e.clientX - rect.left) * scaleX;
            
            let lane = Math.floor(x / (this.W / this.laneCount));
            lane = Math.max(0, Math.min(this.laneCount - 1, lane));
            
            this.inputHit(lane);
        });
    }

    /**
     * Carga el chart JSON
     */
    async loadChart(chartSource) {
        try {
            let data;
            if (typeof chartSource === 'string') {
                const res = await fetch(chartSource);
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                data = await res.json();
            } else {
                data = chartSource;
            }

            this.songData = data;
            
            // Aplicar offset global si existe
            const offsetSeconds = (data.offsetMs || 0) / 1000;

            this.notes = data.notes.map(n => ({
                ...n,
                time: n.time + offsetSeconds,
                hit: false,
                missed: false,
                judged: false,
                y: -100 
            })).sort((a, b) => a.time - b.time); 

            console.log(`Chart cargado: ${data.title}. Notas: ${this.notes.length}`);
            return true;
        } catch (e) {
            console.error("Error cargando chart:", e);
            return false;
        }
    }

    /**
     * Inicia la canción aplicando las estadísticas de las cartas
     * @param {HTMLAudioElement} audioElement 
     * @param {Object} stats - { power, shields, startCombo, multiplier }
     */
    start(audioElement, stats = {}) {
        if (!this.songData || this.notes.length === 0) {
            console.warn("No hay chart cargado.");
            return;
        }

        this.audio = audioElement;
        
        // ⭐ APLICAR STATS DE CARTAS DESDE GAMESTATE
        this.totalPower = stats.power || 1;
        this.scoreMultiplier = stats.multiplier || 1;
        this.shields = stats.shields || 0;
        this.startComboBonus = stats.startCombo || 0;

        // Resetear estado de partida
        this.score = 0;
        this.combo = this.startComboBonus;
        this.maxCombo = this.combo;
        this.hits = 0;
        this.misses = 0;
        this.running = true;
        this.finished = false;
        this.startTime = performance.now();

        // Limpiar notas
        this.notes.forEach(n => { 
            n.hit = false; 
            n.missed = false; 
            n.judged = false; 
            n.typeJudge = '';
            n.y = -100;
        });

        // Preparar Audio
        if (this.audio && this.audio.src) {
            this.audio.currentTime = 0;
            this.audio.volume = 1.0;
            this.audio.muted = false;
            
            this.audio.play().then(() => {
                console.log("✅ Audio iniciado.");
                this.useAudio = true;
                // Sincronizar reloj interno con tiempo real del audio
                this.startTime = performance.now() - (this.audio.currentTime * 1000);
                requestAnimationFrame(this.loop);
            }).catch(err => {
                console.warn("Audio blocked, using internal clock.", err);
                this.useAudio = false;
                requestAnimationFrame(this.loop);
            });
        } else {
            this.useAudio = false;
            requestAnimationFrame(this.loop);
        }
    }

    stop() {
        if (!this.running) return;
        this.running = false;
        if (this.audio) this.audio.pause();
        this.finish();
    }

    getCurrentSongTime() {
        if (this.useAudio && this.audio) {
            return this.audio.currentTime;
        }
        return (performance.now() - this.startTime) / 1000;
    }

    loop(now) {
        if (!this.running) return;

        const dt = (now - this.lastFrameTime) / 1000;
        this.lastFrameTime = now;

        const songTime = this.getCurrentSongTime();

        this.updateLogic(songTime);
        this.render(songTime);

        const totalDuration = this.songData.duration || 180;
        
        if (songTime > totalDuration + 2) {
            this.finish();
        } else {
            requestAnimationFrame(this.loop);
        }
    }

    updateLogic(songTime) {
        for (const note of this.notes) {
            if (note.judged) continue;

            // Calcular posición Y con Lead-in Visual
            const effectiveSongTime = songTime - this.visualLeadTime;
            const timeDiff = note.time - effectiveSongTime;
            
            note.y = this.hitLineY - (timeDiff * this.noteSpeed);

            // Detectar MISS automático
            if (songTime > note.time + this.judgeWindowMiss) {
                if (this.shields > 0) {
                    this.shields--;
                    note.judged = true;
                    note.hit = true; 
                    note.typeJudge = 'SHIELD';
                } else {
                    note.judged = true;
                    note.missed = true;
                    this.misses++;
                    this.combo = 0;
                    note.typeJudge = 'MISS';
                }
            }
        }
    }

    inputHit(lane) {
        const songTime = this.getCurrentSongTime(); 
        
        let bestNote = null;
        let minDelta = Infinity;

        for (const note of this.notes) {
            if (note.judged || note.lane !== lane) continue;
            
            const delta = Math.abs(note.time - songTime);
            
            if (delta <= this.judgeWindowMiss && delta < minDelta) {
                bestNote = note;
                minDelta = delta;
            }
        }

        if (bestNote) {
            bestNote.judged = true;
            bestNote.hit = true;
            
            let judgeText = "";
            let basePoints = 0;

            // Determinar calidad del golpe
            if (minDelta <= this.judgeWindowPerfect) {
                judgeText = "PERFECT";
                basePoints = 1000; // Máxima precisión
                this.hits++;
            } else if (minDelta <= this.judgeWindowGood) {
                judgeText = "GOOD";
                basePoints = 500;  // Precisión media
                this.hits++;
            } else {
                judgeText = "BAD";
                basePoints = 100;  // Precisión baja
                this.hits++; 
                this.combo = 0; // Romper combo en BAD
            }

            // ⭐ FÓRMULA FINAL DE PUNTUACIÓN CON POTENCIA DE CARTAS
            // Puntos = Base * PotenciaCartas * MultiplicadorGlobal * BonusCombo
            const comboBonus = 1 + (Math.min(this.combo, 100) / 200); // Hasta x1.5 bonus por combo
            
            const finalPoints = Math.round(basePoints * this.totalPower * this.scoreMultiplier * comboBonus);

            this.score += finalPoints;
            this.combo++;
            if (this.combo > this.maxCombo) this.maxCombo = this.combo;

            bestNote.typeJudge = judgeText;
        }
    }

    renderIdle() {
        const ctx = this.ctx;
        ctx.fillStyle = "#0b0f1d";
        ctx.fillRect(0, 0, this.W, this.H);
        ctx.fillStyle = "#fff";
        ctx.font = "20px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Esperando Chart...", this.W/2, this.H/2);
    }

    render(songTime) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.W, this.H);

        // 1. Fondo Dinámico
        const pulse = Math.sin(songTime * 4) * 0.02 + 0.98;
        ctx.fillStyle = `rgba(10, 10, 15, ${pulse})`;
        ctx.fillRect(0, 0, this.W, this.H);

        const laneWidth = this.W / this.laneCount;

        // 2. Carriles Guías
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.lineWidth = 1;
        for (let i = 0; i <= this.laneCount; i++) {
            ctx.beginPath();
            ctx.moveTo(i * laneWidth, 0);
            ctx.lineTo(i * laneWidth, this.H);
            ctx.stroke();
        }

        // 3. Indicadores de Teclas
        const keys = ['D', 'F', 'J', 'K'];
        ctx.font = "bold 16px monospace";
        ctx.textAlign = "center";
        for (let i = 0; i < this.laneCount; i++) {
            const xCenter = i * laneWidth + laneWidth / 2;
            ctx.fillStyle = "rgba(0,0,0,0.5)";
            ctx.fillRect(xCenter - 15, this.hitLineY + 10, 30, 25);
            ctx.fillStyle = "#aaa";
            ctx.fillText(keys[i], xCenter, this.hitLineY + 28);
        }

        // 4. Línea de Juicio (Hit Line)
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#f1c40f";
        ctx.strokeStyle = "#f1c40f";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, this.hitLineY);
        ctx.lineTo(this.W, this.hitLineY);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 5. Dibujar Notas
        for (const note of this.notes) {
            // Optimización: Solo dibujar si está cerca de la vista
            if (note.y < -50 || note.y > this.H + 50) continue;

            const xCenter = note.lane * laneWidth + laneWidth / 2;
            const radius = 18;

            if (note.judged) {
                if (note.hit) {
                    // Explosión/Fade out
                    const alpha = Math.max(0, 1 - (songTime - note.time) * 3);
                    ctx.globalAlpha = alpha;
                    
                    // Color según tipo de acierto
                    ctx.fillStyle = note.typeJudge === 'PERFECT' ? '#f1c40f' : '#fff';
                    
                    // Círculo expansivo
                    const expandRadius = radius * (1 + (songTime - note.time) * 2);
                    ctx.beginPath();
                    ctx.arc(xCenter, this.hitLineY, expandRadius, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Texto de juicio flotante
                    ctx.fillStyle = note.typeJudge === 'PERFECT' ? '#f1c40f' : '#aaa';
                    ctx.font = "bold 14px Arial";
                    ctx.textAlign = "center";
                    ctx.fillText(note.typeJudge, xCenter, this.hitLineY - 30 - (songTime - note.time)*50);
                    
                    ctx.globalAlpha = 1.0;
                } else if (note.missed) {
                    // Nota gris cayendo
                    ctx.fillStyle = "rgba(100, 100, 100, 0.3)";
                    ctx.beginPath();
                    ctx.arc(xCenter, note.y, radius, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else {
                // Nota activa (brillante)
                const color = this.laneColors[note.lane];
                
                ctx.shadowBlur = 10;
                ctx.shadowColor = color;
                
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(xCenter, note.y, radius, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.shadowBlur = 0;

                ctx.strokeStyle = "white";
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.fillStyle = "black";
                ctx.font = "16px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("🌹", xCenter, note.y);
            }
        }

        // 6. HUD Superior
        ctx.fillStyle = "white";
        ctx.font = "bold 20px Segoe UI";
        ctx.textAlign = "left";
        ctx.fillText(`SCORE: ${this.score}`, 20, 30);
        ctx.fillText(`COMBO: ${this.combo}`, 20, 55);
        ctx.fillText(`POWER: x${this.totalPower.toFixed(1)}`, 20, 80); // Mostrar potencia actual
        
        ctx.textAlign = "right";
        ctx.font = "16px Segoe UI";
        ctx.fillStyle = "#aaa";
        ctx.fillText(`${this.songData.title} - ${this.songData.artist}`, this.W - 20, 30);
        ctx.fillText(`ACCURACY: ${this.getAccuracy()}%`, this.W - 20, 55);
    }

    getAccuracy() {
        const totalJudged = this.hits + this.misses;
        if (totalJudged === 0) return 100;
        return Math.round((this.hits / totalJudged) * 100);
    }

    finish() {
        if (this.finished) return;
        this.running = false;
        this.finished = true;
        
        if (this.audio) {
            try { this.audio.pause(); } catch(e) {}
        }

        const totalJudged = this.hits + this.misses;
        const accuracy = totalJudged > 0 ? Math.round((this.hits / totalJudged) * 100) : 100;

        const results = {
            songId: this.songData.id || "unknown",
            score: this.score,
            maxCombo: this.maxCombo,
            hits: this.hits,
            misses: this.misses,
            accuracy: accuracy,
            rank: this.calculateRank(accuracy)
        };

        if (this.callbacks.onFinish) {
            this.callbacks.onFinish(results);
        }
    }

    calculateRank(acc) {
        if (acc >= 98) return "S+";
        if (acc >= 95) return "S";
        if (acc >= 90) return "A";
        if (acc >= 80) return "B";
        if (acc >= 70) return "C";
        return "D";
    }

    destroy() {
        // Limpieza de eventos globales
        // Nota: Como usamos arrow functions anónimas en addEventListener, 
        // no podemos removerlas fácilmente sin guardar referencias.
        // Para un SPA simple, esto suele ser aceptable al recargar página,
        // pero idealmente deberíamos haber guardado las referencias.
        this.running = false;
        this.finished = true;
    }
}
