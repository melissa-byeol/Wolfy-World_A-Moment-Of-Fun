/**
 * WOLFY WORLD - RHYTHM GAME ENGINE (Programable Chart System)
 * Versión Final con Lead-in Visual Sincronizado + Gráficos Restaurados
 */

class RhythmGame {
    constructor(canvas, callbacks = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.callbacks = callbacks;

        // --- CONFIGURACIÓN VISUAL ---
        this.width = 800;
        this.height = 450;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.laneCount = 4;
        // Paleta Bed of Thorns: Rosa Sangre, Blanco Hueso, Gris Oscuro, Rosa Profundo
        this.laneColors = ["#ff0055", "#ffffff", "#333333", "#aa0033"]; 
        
        // MAPA DE TECLAS
        this.keyMap = { 
            'd': 0, 'f': 1, 'j': 2, 'k': 3,
            'arrowleft': 0, 'arrowup': 1, 'arrowdown': 2, 'arrowright': 3 
        };

        // --- ESTADO DE LA CANCIÓN ---
        this.songData = null; 
        this.notes = [];      
        this.audio = null;
        this.useAudio = false;

        // --- MECÁNICAS ---
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.hits = 0;
        this.misses = 0;
        this.shields = 0;
        this.multiplier = 1;
        
        // --- FÍSICA Y JUICIO ---
        this.hitLineY = this.height - 70;
        this.noteSpeed = 350; // Píxeles por segundo
        
        // ⭐ NUEVO: Tiempo de anticipación visual (segundos)
        // Las notas aparecerán esta cantidad de segundos ANTES de su tiempo real.
        this.visualLeadTime = 1.5; 

        // Ventanas de juicio (en segundos)
        this.judgeWindowPerfect = 0.05; 
        this.judgeWindowGood = 0.12;    
        this.judgeWindowMiss = 0.18;    

        this.running = false;
        this.finished = false;
        this.startTime = 0;
        this.lastFrameTime = 0;

        // --- INPUT HANDLING ---

        // 1. Click/Touch en Canvas
        this.canvas.addEventListener("pointerdown", (e) => {
            if (!this.running) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const x = (e.clientX - rect.left) * scaleX;
            
            const laneWidth = this.canvas.width / this.laneCount;
            let lane = Math.floor(x / laneWidth);
            lane = Math.max(0, Math.min(this.laneCount - 1, lane));
            
            this.inputHit(lane);
        });

        // 2. Teclado Global
        this.handleKeyDown = (e) => {
            if (!this.running) return;
            
            const key = e.key.toLowerCase();
            if (["d", "f", "j", "k", " ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
                e.preventDefault();
            }

            if (e.repeat) return;

            const lane = this.keyMap[key];
            if (lane !== undefined) {
                this.inputHit(lane);
            }
        };

        window.addEventListener('keydown', this.handleKeyDown);
        this.loop = this.loop.bind(this);
    }

    /**
     * Carga el chart desde un objeto JSON o URL
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
            
            // Clonar notas aplicando el offset global si existe en el JSON
            const offsetSeconds = (data.offsetMs || 0) / 1000;

            this.notes = data.notes.map(n => ({
                ...n,
                time: n.time + offsetSeconds, // Aplicar calibración fina
                hit: false,
                missed: false,
                judged: false,
                y: -100 
            })).sort((a, b) => a.time - b.time); 

            console.log(`Chart cargado: ${data.title}. Total notas: ${this.notes.length}. Offset: ${offsetSeconds}s`);
            return true;
        } catch (e) {
            console.error("Error cargando chart:", e);
            return false;
        }
    }

    start(audioElement, effects = {}) {
        if (!this.songData || this.notes.length === 0) {
            console.warn("No hay chart cargado.");
            return;
        }

        this.audio = audioElement;
        this.effects = effects;
        
        // Reset estadísticas
        this.score = 0;
        this.combo = effects.startCombo || 0;
        this.maxCombo = this.combo;
        this.hits = 0;
        this.misses = 0;
        this.shields = effects.shields || 0;
        this.multiplier = effects.scoreMultiplier || 1;
        this.running = true;
        this.finished = false;

        this.notes.forEach(n => { 
            n.hit = false; 
            n.missed = false; 
            n.judged = false; 
            n.typeJudge = '';
        });

        // Lógica de Audio Crítica
        this.audio.currentTime = 0;
        this.audio.volume = 1.0;
        this.audio.muted = false;

        const playPromise = this.audio.play();

        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log("✅ Audio iniciado.");
                this.useAudio = true;
                this.startTime = performance.now() - (this.audio.currentTime * 1000);
                requestAnimationFrame(this.loop);
            }).catch(error => {
                console.error("❌ Error Play:", error);
                alert("El navegador bloqueó el audio. Recarga la página.");
                this.useAudio = false;
                this.startTime = performance.now();
                requestAnimationFrame(this.loop);
            });
        } else {
            try {
                this.audio.play();
                this.useAudio = true;
                this.startTime = performance.now() - (this.audio.currentTime * 1000);
                requestAnimationFrame(this.loop);
            } catch(e) {
                this.useAudio = false;
                this.startTime = performance.now();
                requestAnimationFrame(this.loop);
            }
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

            // ⭐ CÁLCULO CON LEAD-IN VISUAL
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
            let points = 0;

            if (minDelta <= this.judgeWindowPerfect) {
                judgeText = "PERFECT";
                points = 300;
                this.hits++;
            } else if (minDelta <= this.judgeWindowGood) {
                judgeText = "GOOD";
                points = 100;
                this.hits++;
            } else {
                judgeText = "BAD";
                points = 10;
                this.hits++; 
                this.combo = 0; 
            }

            const finalPoints = Math.round(points * this.multiplier * (1 + this.combo/100));
            this.score += finalPoints;
            this.combo++;
            if (this.combo > this.maxCombo) this.maxCombo = this.combo;

            bestNote.typeJudge = judgeText;
        }
    }

    render(songTime) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        // 1. Fondo Dinámico (Latido suave)
        const pulse = Math.sin(songTime * 4) * 0.02 + 0.98;
        ctx.fillStyle = `rgba(10, 10, 15, ${pulse})`;
        ctx.fillRect(0, 0, this.width, this.height);

        const laneWidth = this.width / this.laneCount;

        // 2. Dibujar Carriles Guías
        for (let i = 0; i < this.laneCount; i++) {
            ctx.strokeStyle = "rgba(255,255,255,0.05)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(i * laneWidth, 0);
            ctx.lineTo(i * laneWidth, this.height);
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
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, this.hitLineY);
        ctx.lineTo(this.width, this.hitLineY);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 5. Dibujar Notas
        for (const note of this.notes) {
            // Optimización: Solo dibujar si está cerca de la vista
            if (note.y < -50 || note.y > this.height + 50) continue;

            const xCenter = note.lane * laneWidth + laneWidth / 2;
            const radius = 20;

            if (note.judged) {
                if (note.hit) {
                    // Explosión/Fade out
                    const alpha = Math.max(0, 1 - (songTime - note.time) * 2);
                    ctx.globalAlpha = alpha;
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
                
                // Glow effect
                ctx.shadowBlur = 10;
                ctx.shadowColor = color;
                
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(xCenter, note.y, radius, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.shadowBlur = 0;

                // Borde blanco fino
                ctx.strokeStyle = "white";
                ctx.lineWidth = 2;
                ctx.stroke();

                // Icono central (Rosa para Bed of Thorns)
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
        
        ctx.textAlign = "right";
        ctx.font = "16px Segoe UI";
        ctx.fillStyle = "#aaa";
        ctx.fillText(`${this.songData.title} - ${this.songData.artist}`, this.width - 20, 30);
        ctx.fillText(`ACCURACY: ${this.getAccuracy()}%`, this.width - 20, 55);
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
        window.removeEventListener('keydown', this.handleKeyDown);
        this.running = false;
        this.finished = true;
    }
}
