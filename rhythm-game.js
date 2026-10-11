/**
 * WOLFY WORLD - RHYTHM GAME ENGINE (Programable Chart System)
 */

class RhythmGame {
    constructor(canvas, callbacks = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.callbacks = callbacks;

        // Configuración Visual
        this.width = 800;
        this.height = 450;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.laneCount = 4;
        // Paleta Bed of Thorns: Negro, Rosa Sangre, Blanco Hueso, Gris Ceniza
        this.laneColors = ["#ff0055", "#ffffff", "#333333", "#aa0033"]; 
        this.keys = { d: 0, f: 1, j: 2, k: 3 };

        // Estado de la Canción
        this.songData = null; // Se llenará al cargar el JSON
        this.notes = [];      // Notas activas procesadas
        this.audio = null;
        this.useAudio = false;

        // Mecánicas
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.hits = 0;
        this.misses = 0;
        this.shields = 0;
        this.multiplier = 1;
        
        // Física de caída
        this.hitLineY = this.height - 70;
        this.noteSpeed = 350; // Píxeles por segundo (ajustar según gusto)
        this.spawnDistance = this.hitLineY + 50; // Donde aparecen arriba
        
        // Ventanas de juicio
        this.judgeWindowPerfect = 0.05; // ±50ms
        this.judgeWindowGood = 0.12;    // ±120ms
        this.judgeWindowMiss = 0.18;    // Fuera de esto es Miss

        this.running = false;
        this.finished = false;
        this.startTime = 0;
        this.lastFrameTime = 0;

        // Input
        this.canvas.addEventListener("pointerdown", (e) => {
            if (!this.running) return;
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const x = (e.clientX - rect.left) * scaleX;
            const lane = Math.floor(x / (this.canvas.width / this.laneCount));
            this.inputHit(lane);
        });

        this.loop = this.loop.bind(this);
    }

    /**
     * Carga el chart desde un objeto JSON o URL
     */
    async loadChart(chartSource) {
        try {
            let data;
            if (typeof chartSource === 'string') {
                // Si es URL o ruta local
                const res = await fetch(chartSource);
                data = await res.json();
            } else {
                // Si ya es objeto
                data = chartSource;
            }

            this.songData = data;
            
            // Clonar notas para no modificar el original durante el juego
            this.notes = data.notes.map(n => ({
                ...n,
                hit: false,
                missed: false,
                judged: false,
                y: -100 // Posición inicial fuera de pantalla
            })).sort((a, b) => a.time - b.time); // Ordenar por tiempo

            console.log(`Chart cargado: ${data.title}. Total notas: ${this.notes.length}`);
            return true;
        } catch (e) {
            console.error("Error cargando chart:", e);
            return false;
        }
    }

    start(audioElement, effects = {}) {
        if (!this.songData || this.notes.length === 0) {
            alert("No hay chart cargado.");
            return;
        }

        this.audio = audioElement;
        this.effects = effects;
        
        // Resetear estadísticas
        this.score = 0;
        this.combo = effects.startCombo || 0;
        this.maxCombo = this.combo;
        this.hits = 0;
        this.misses = 0;
        this.shields = effects.shields || 0;
        this.multiplier = effects.scoreMultiplier || 1;
        this.running = true;
        this.finished = false;

        // Reiniciar estado de notas
        this.notes.forEach(n => { n.hit = false; n.missed = false; n.judged = false; });

        // Preparar Audio
        if (this.audio && this.audio.src) {
            this.audio.currentTime = 0;
            this.audio.volume = 1.0;
            this.audio.play().then(() => {
                this.useAudio = true;
                this.startTime = performance.now() - (this.audio.currentTime * 1000);
            }).catch(err => {
                console.warn("Audio autoplay bloqueado, usando reloj interno.", err);
                this.useAudio = false;
                this.startTime = performance.now();
            });
        } else {
            this.useAudio = false;
            this.startTime = performance.now();
        }

        this.lastFrameTime = performance.now();
        requestAnimationFrame(this.loop);
    }

    stop() {
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

        // Verificar fin de canción
        if (songTime > (this.songData.duration || 180) + 2) {
            this.finish();
        } else {
            requestAnimationFrame(this.loop);
        }
    }

    updateLogic(songTime) {
        for (const note of this.notes) {
            if (note.judged) continue;

            // Calcular posición Y basada en el tiempo restante hasta el hit line
            // Si time == songTime, entonces está en hitLineY
            // Si time > songTime, está arriba (menos Y)
            // Fórmula: Y = HitLine - (TiempoRestante * Velocidad)
            const timeDiff = note.time - songTime;
            note.y = this.hitLineY - (timeDiff * this.noteSpeed);

            // Detectar MISS automático si pasó demasiado
            if (timeDiff < -this.judgeWindowMiss) {
                if (this.shields > 0) {
                    this.shields--;
                    note.judged = true;
                    note.hit = true; // Considerado absorbido
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
        
        // Buscar la nota más cercana en ese carril que aún no haya sido juzgada
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
                this.hits++; // Cuenta como hit pero rompe combo? Opcional. Aquí lo dejamos como hit débil.
                this.combo = 0; // Romper combo en BAD es común
            }

            // Aplicar multiplicadores
            const finalPoints = Math.round(points * this.multiplier * (1 + this.combo/100));
            this.score += finalPoints;
            this.combo++;
            if (this.combo > this.maxCombo) this.maxCombo = this.combo;

            bestNote.typeJudge = judgeText;
            
            // Efecto visual inmediato (opcional, se maneja en render)
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

        // 3. Línea de Juicio (Hit Line)
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#f1c40f";
        ctx.strokeStyle = "#f1c40f";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, this.hitLineY);
        ctx.lineTo(this.width, this.hitLineY);
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset shadow

        // 4. Dibujar Notas
        for (const note of this.notes) {
            // Solo dibujar si está cerca de la pantalla (optimización)
            if (note.y < -50 || note.y > this.height + 50) continue;

            const xCenter = note.lane * laneWidth + laneWidth / 2;
            const radius = 20;

            // Estilo según estado
            if (note.judged) {
                if (note.hit) {
                    // Explosión de partículas simple o fade out
                    ctx.globalAlpha = Math.max(0, 1 - (songTime - note.time)); // Fade rápido
                    ctx.fillStyle = note.typeJudge === 'PERFECT' ? '#f1c40f' : '#fff';
                    ctx.beginPath();
                    ctx.arc(xCenter, this.hitLineY, radius * 1.5, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Texto de juicio flotante
                    ctx.fillStyle = note.typeJudge === 'PERFECT' ? '#f1c40f' : '#aaa';
                    ctx.font = "bold 14px Arial";
                    ctx.textAlign = "center";
                    ctx.fillText(note.typeJudge, xCenter, this.hitLineY - 30);
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

        // 5. HUD Superior
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
        // Peso: Perfect=1, Good=0.5, Miss=0 (simplificado)
        // Para esto necesitaríamos contar tipos de hits, por ahora usamos ratio básico
        return Math.round((this.hits / totalJudged) * 100);
    }

    finish() {
        if (this.finished) return;
        this.running = false;
        this.finished = true;
        if (this.audio) this.audio.pause();

        const results = {
            songId: this.songData.id,
            score: this.score,
            maxCombo: this.maxCombo,
            hits: this.hits,
            misses: this.misses,
            accuracy: this.getAccuracy(),
            rank: this.calculateRank()
        };

        if (this.callbacks.onFinish) this.callbacks.onFinish(results);
    }

    calculateRank() {
        const acc = this.getAccuracy();
        if (acc >= 98) return "S+";
        if (acc >= 95) return "S";
        if (acc >= 90) return "A";
        if (acc >= 80) return "B";
        if (acc >= 70) return "C";
        return "D";
    }
}
