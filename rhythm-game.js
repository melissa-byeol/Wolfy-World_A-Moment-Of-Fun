// rhythm-game.js - Motor Rítmico v8 (Con Soporte HOLDS)

const RhythmEngine = (function(){
  const canvas = document.getElementById('rhythm-canvas');
  if(!canvas) return null;
  const ctx = canvas.getContext('2d');
  const audioEl = document.getElementById('song-audio') || null;

  // Diseño lógico base
  const LOGICAL_W = 800;
  const LOGICAL_H = 450;

  let W = LOGICAL_W;
  let H = LOGICAL_H;
  let HIT_LINE_Y = Math.round(H * 0.82);
  const TOP_MARGIN = 40;   
  let LEAD_TIME = 1.8;     
  let TRAVEL = Math.max(80, HIT_LINE_Y - TOP_MARGIN);
  let NOTE_SPEED = TRAVEL / Math.max(0.001, LEAD_TIME);

  // Ventanas de juicio
  let PERFECT_WIN = 0.06;
  let GOOD_WIN    = 0.12;
  let MISS_WIN    = 0.18;

  // Estado runtime
  let running = false;
  let startTime = 0;
  let notes = []; // Array mixto: Tap Notes y Hold Notes
  let currentSongId = "";

  // Stats
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let hits = 0;
  let misses = 0;
  let shields = 0;
  let totalPower = 1;
  let multiplier = 1;

  // Key mapping & colors
  const KEYS = {
    'd': 0, 'f': 1, 'j': 2, 'k': 3,
    'arrowleft': 0, 'arrowdown': 1, 'arrowup': 2, 'arrowright': 3
  };
  const COLORS = ['#ff0055', '#ffffff', '#333333', '#aa0033'];
  
  // Track active keys for Hold detection
  const activeKeys = new Set(); 

  // Autoplay / helper state
  let autoplay = false;
  let helperMode = false;          
  let helperOriginalVolume = null; 
  let prevElapsed = 0;

  // --- Responsive canvas + DPR handling ---
  function resizeCanvasForDisplay() {
    const parent = canvas.parentElement;
    let parentWidth = parent ? Math.min(parent.clientWidth, LOGICAL_W) : Math.min(window.innerWidth - 20, LOGICAL_W);
    if(parentWidth <= 0) parentWidth = Math.min(window.innerWidth - 20, LOGICAL_W);

    const aspect = LOGICAL_W / LOGICAL_H;
    const targetW = Math.round(parentWidth);
    const targetH = Math.round(targetW / aspect);

    const DPR = Math.max(1, window.devicePixelRatio || 1);

    canvas.style.width = targetW + 'px';
    canvas.style.height = targetH + 'px';
    canvas.width = Math.round(targetW * DPR);
    canvas.height = Math.round(targetH * DPR);

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    W = targetW;
    H = targetH;
    HIT_LINE_Y = Math.round(H * 0.82);

    recomputeNoteSpeed();

    const mobileFactor = (W <= 420) ? 1.35 : 1.0;
    PERFECT_WIN = 0.06 * mobileFactor;
    GOOD_WIN    = 0.12 * mobileFactor;
    MISS_WIN    = 0.18 * mobileFactor;
  }

  function recomputeNoteSpeed() {
    TRAVEL = Math.max(80, HIT_LINE_Y - TOP_MARGIN);
    NOTE_SPEED = TRAVEL / Math.max(0.001, LEAD_TIME);
  }

  resizeCanvasForDisplay();
  let _resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => {
      resizeCanvasForDisplay();
    }, 120);
  });

  // --- Touch input mapping to lanes ---
  function touchToLane(clientX) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const laneWidth = W / 4;
    let lane = Math.floor(x / laneWidth);
    lane = Math.max(0, Math.min(3, lane));
    return lane;
  }
  
  // Helper to simulate key press/release for touch
  function handleTouchStart(e) {
      e.preventDefault();
      for(const t of Array.from(e.changedTouches)) {
          const lane = touchToLane(t.clientX);
          activateLane(lane);
      }
  }
  function handleTouchEnd(e) {
      e.preventDefault();
      for(const t of Array.from(e.changedTouches)) {
          const lane = touchToLane(t.clientX);
          deactivateLane(lane);
      }
  }

  canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
  canvas.addEventListener('mousedown', (e) => {
      if(!running) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const lane = Math.floor((x / rect.width) * 4);
      if(lane >=0 && lane < 4) activateLane(lane);
  });
  canvas.addEventListener('mouseup', (e) => {
      if(!running) return;
       const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const lane = Math.floor((x / rect.width) * 4);
      if(lane >=0 && lane < 4) deactivateLane(lane);
  });


  // --- Chart loader (Updated for Holds) ---
  async function loadChart(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();

      const offsetSeconds = (data.offsetMs || 0) / 1000;
      
      notes = (data.notes || []).map(n => {
          const isHold = typeof n.duration === 'number' && n.duration > 0;
          return {
              type: isHold ? 'hold' : 'tap',
              time: (n.time || 0) + offsetSeconds,
              endTime: isHold ? ((n.time || 0) + n.duration + offsetSeconds) : null,
              lane: (typeof n.lane === 'number') ? n.lane : 0,
              
              // State flags
              judgedHead: false, // ¿Se golpeó el inicio?
              holdingBody: false, // ¿Se está sosteniendo ahora mismo?
              bodyBroken: false, // ¿Se soltó antes de tiempo?
              judgedTail: false, // ¿Se completó el final?
              
              hit: false, // Éxito total
              missed: false, // Fallo total
              y: -100,
              tailY: -100 // Posición Y del final de la barra
          };
      }).sort((a,b) => a.time - b.time);

      prevElapsed = 0;
      activeKeys.clear(); // Resetear teclas presionadas
      return true;
    } catch (e) {
      console.error("Error cargando chart:", e);
      return false;
    }
  }

  // --- Start/Stop/Loop ---
  function start(songData, difficulty) {
    if (running) return;
    score = 0; combo = 0; maxCombo = 0; hits = 0; misses = 0;
    running = true;
    startTime = performance.now();
    currentSongId = songData && songData.id ? songData.id : "";

    let stats = { power: 1, shields: 0, startCombo: 0, multiplier: 1 };
    if (window.GS && typeof window.GS.getRhythmStats === 'function') {
      try { stats = window.GS.getRhythmStats(currentSongId); } catch(e){ console.warn(e); }
    }
    totalPower = stats.power || 1;
    shields = stats.shields || 0;
    combo = stats.startCombo || 0;
    maxCombo = combo;
    multiplier = stats.multiplier || 1;

    if (audioEl) {
      try {
        audioEl.currentTime = 0;
        const playPromise = audioEl.play();
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise.then(()=> {
            startTime = performance.now() - (audioEl.currentTime || 0) * 1000;
            requestAnimationFrame(loop);
          }).catch(()=> {
            startTime = performance.now();
            requestAnimationFrame(loop);
          });
          return;
        } else {
          startTime = performance.now() - (audioEl.currentTime || 0) * 1000;
        }
      } catch(e){}
    }

    requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (audioEl) {
      try { audioEl.pause(); } catch(e){}
    }
    finishGame();
  }

  function loop(now) {
    if (!running) return;
    const elapsed = (now - startTime) / 1000;
    update(elapsed);
    draw(elapsed);

    const lastNoteTime = notes.length > 0 ? (notes[notes.length-1].endTime || notes[notes.length-1].time) : 0;
    if (elapsed > lastNoteTime + 2.5) {
        stop();
    } else {
        requestAnimationFrame(loop);
    }
  }

  // --- Update Logic (Complex for Holds) ---
  function update(elapsed) {
    for (const note of notes) {
        
        // Calculate Positions
        const spawnTime = note.time - LEAD_TIME;
        let progressHead = (elapsed - spawnTime) / Math.max(0.0001, LEAD_TIME);
        if (progressHead < -0.5) progressHead = -0.5;
        if (progressHead > 1.5) progressHead = 1.5;
        note.y = TOP_MARGIN + progressHead * TRAVEL;

        if (note.type === 'hold') {
             const endSpawnTime = note.endTime - LEAD_TIME;
             let progressTail = (elapsed - endSpawnTime) / Math.max(0.0001, LEAD_TIME);
             if (progressTail < -0.5) progressTail = -0.5;
             if (progressTail > 1.5) progressTail = 1.5;
             note.tailY = TOP_MARGIN + progressTail * TRAVEL;
             
             // Check Body Status
             // If head was hit AND we are currently between head and tail time
             if (note.judgedHead && !note.bodyBroken && !note.judgedTail) {
                 if (elapsed >= note.time && elapsed <= note.endTime) {
                     // Is the key still pressed?
                     if (!activeKeys.has(note.lane)) {
                         note.bodyBroken = true; // FAIL! Released too early
                         note.missed = true;
                         misses++;
                         combo = 0;
                         try { AppAPI.setCombo(combo); } catch(e){}
                     } else {
                         note.holdingBody = true; // Visual feedback that it's being held
                     }
                 } else if (elapsed > note.endTime) {
                     // Time passed without breaking? Success!
                     if (!note.bodyBroken) {
                         note.judgedTail = true;
                         note.hit = true;
                         hits++;
                         combo++;
                         if (combo > maxCombo) maxCombo = combo;
                         
                         // Award points for successful hold completion
                         const pts = Math.round((50 + totalPower) * (multiplier || 1));
                         score += pts;
                         try {
                            AppAPI.addScore(score);
                            AppAPI.setCombo(combo);
                            AppAPI.setAcc(hits / Math.max(1, (hits + misses)));
                        } catch(e){}
                     }
                 }
             }
        }

        // Auto-Miss Head (for both tap and hold starts)
        if (!note.judgedHead && elapsed > note.time + MISS_WIN) {
            note.judgedHead = true;
            if (shields > 0) {
                shields--;
                note.judgedHead = true; // Mark as handled by shield
                // For holds, if shield takes the head, does it auto-complete body? 
                // Usually yes in casual games. Let's say YES for simplicity.
                if(note.type === 'hold') {
                    note.hit = true;
                    note.judgedTail = true;
                    hits++;
                    combo++;
                    if (combo > maxCombo) maxCombo = combo;
                }
            } else {
                note.missed = true;
                misses++;
                combo = 0;
                if(note.type === 'hold') note.bodyBroken = true; // Ensure body doesn't trigger later
            }
            try { AppAPI.setCombo(combo); } catch(e){}
        }
        
        // Autoplay Logic for Heads
        if (autoplay && !note.judgedHead) {
             if (note.time > prevElapsed && note.time <= elapsed) {
                 // Simulate pressing the key
                 activateLane(note.lane);
                 // Schedule release for holds after duration
                 if(note.type === 'hold') {
                     setTimeout(() => {
                         if(running) deactivateLane(note.lane);
                     }, note.endTime * 1000 - elapsed * 1000);
                 } else {
                      deactivateLane(note.lane);
                 }
             }
        }
    }

    prevElapsed = elapsed;
  }

  function draw(elapsed) {
    ctx.clearRect(0, 0, W, H);

    const pulse = Math.sin(elapsed * 4) * 0.05 + 0.95;
    ctx.fillStyle = `rgba(5, 6, 10, ${pulse})`;
    ctx.fillRect(0, 0, W, H);

    const laneW = W / 4;

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for (let i=0; i<=4; i++) {
      ctx.beginPath();
      ctx.moveTo(i*laneW, 0);
      ctx.lineTo(i*laneW, H);
      ctx.stroke();
    }

    // Hit line
    ctx.save();
    ctx.shadowBlur = 14;
    ctx.shadowColor = "#f1c40f";
    ctx.strokeStyle = "#f1c40f";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, HIT_LINE_Y);
    ctx.lineTo(W, HIT_LINE_Y);
    ctx.stroke();
    ctx.restore();

    // Draw Notes
    for (const note of notes) {
        if (note.y < -100 || note.y > H + 100) continue; // Optimization
        
        const cx = note.lane * laneW + laneW/2;
        const r = Math.max(10, Math.round(18 * (W / LOGICAL_W)));
        const color = COLORS[note.lane % COLORS.length];

        if (note.type === 'hold') {
            // Draw Body (Rectangle connecting Head and Tail)
            if (note.judgedHead && !note.missed) {
                // Only draw body if head is hit
                const topY = note.y;
                const bottomY = note.tailY;
                
                // Clamp drawing to screen
                const drawTop = Math.max(topY, 0);
                const drawBottom = Math.min(bottomY, H);
                
                if (drawBottom > drawTop) {
                    ctx.fillStyle = note.holdingBody ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)";
                    ctx.fillRect(cx - r, drawTop, r*2, drawBottom - drawTop);
                    
                    // Glow effect if holding correctly
                    if(note.holdingBody) {
                         ctx.shadowBlur = 10;
                         ctx.shadowColor = color;
                         ctx.strokeStyle = color;
                         ctx.lineWidth = 2;
                         ctx.strokeRect(cx - r, drawTop, r*2, drawBottom - drawTop);
                         ctx.shadowBlur = 0;
                    }
                }
            }

            // Draw Head Circle
            if (!note.judgedHead || !note.hit) {
                 ctx.fillStyle = color;
                 ctx.beginPath();
                 ctx.arc(cx, note.y, r, 0, Math.PI*2);
                 ctx.fill();
                 ctx.strokeStyle = "white";
                 ctx.lineWidth = 2;
                 ctx.stroke();
            } else if (note.hit) {
                 // Explosion/Fade out on complete success
                 const alpha = Math.max(0, 1 - (elapsed - note.endTime)*2);
                 if(alpha > 0) {
                     ctx.globalAlpha = alpha;
                     ctx.fillStyle = "#fff";
                     ctx.beginPath();
                     ctx.arc(cx, note.y, r*1.5, 0, Math.PI*2);
                     ctx.fill();
                     ctx.globalAlpha = 1.0;
                 }
            }
            
            // Draw Tail Cap (Optional visual cue)
            if (!note.judgedTail && !note.missed && note.tailY > 0 && note.tailY < H) {
                 ctx.fillStyle = "rgba(255,255,255,0.5)";
                 ctx.beginPath();
                 ctx.arc(cx, note.tailY, r*0.8, 0, Math.PI*2);
                 ctx.fill();
            }

        } else {
            // Standard Tap Note
            if (!note.judgedHead || !note.hit) {
                ctx.fillStyle = color;
                ctx.save();
                ctx.shadowBlur = 10;
                ctx.shadowColor = color;
                ctx.beginPath();
                ctx.arc(cx, note.y, r, 0, Math.PI*2);
                ctx.fill();
                ctx.restore();

                ctx.strokeStyle = "rgba(255,255,255,0.9)";
                ctx.lineWidth = Math.max(1, Math.round(2 * (W / LOGICAL_W)));
                ctx.beginPath();
                ctx.arc(cx, note.y, r, 0, Math.PI*2);
                ctx.stroke();
                
                ctx.fillStyle = "black";
                ctx.font = `${Math.max(10, Math.round(14 * (W / LOGICAL_W)))}px Arial`;
                ctx.textAlign = "center";
                ctx.fillText("🌹", cx, note.y + Math.round(5 * (W / LOGICAL_W)));
            } else if (note.hit) {
                 const alpha = Math.max(0, 1 - (elapsed - note.time) * 3);
                 ctx.globalAlpha = alpha;
                 ctx.fillStyle = "#fff";
                 ctx.beginPath();
                 ctx.arc(cx, HIT_LINE_Y, r * 1.4, 0, Math.PI*2);
                 ctx.fill();
                 ctx.globalAlpha = 1.0;
            }
        }
    }
    
    // Keys Indicator
    const keys = ['D','F','J','K'];
    ctx.font = `${Math.max(12, Math.round(16 * (W / LOGICAL_W)))}px monospace`;
    ctx.textAlign = "center";
    for (let i=0; i<4; i++) {
      const cx = i*laneW + laneW/2;
      ctx.fillStyle = activeKeys.has(i) ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.45)";
      ctx.fillRect(cx-15, HIT_LINE_Y+10, 30, 25);
      ctx.fillStyle = activeKeys.has(i) ? "#fff" : "#ddd";
      ctx.fillText(keys[i], cx, HIT_LINE_Y+28);
    }
  }

  // --- Input Handling Helpers ---
  function activateLane(lane) {
      if(activeKeys.has(lane)) return; // Already down
      activeKeys.add(lane);
      inputHit(lane, {autoplay:false});
  }
  
  function deactivateLane(lane) {
      activeKeys.delete(lane);
      // No need to call inputHit here, logic is in update() checking activeKeys
  }

  window.addEventListener('keydown', (e) => {
    const target = e.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.repeat) return; // Ignore key repeats

    const key = (e.key || '').toLowerCase();

    if (key === 'a') { 
      setAutoplay(!autoplay);
      return;
    }
    
    const lane = KEYS[key];
    if (lane !== undefined) {
      e.preventDefault();
      activateLane(lane);
    }
  });

  window.addEventListener('keyup', (e) => {
     const key = (e.key || '').toLowerCase();
     const lane = KEYS[key];
     if (lane !== undefined) {
         deactivateLane(lane);
     }
  });

  function inputHit(lane, {autoplay=false} = {}) {
    if (!running) return;
    const elapsed = (performance.now() - startTime) / 1000;

    // Find best TAP or HOLD HEAD candidate
    let bestNote = null;
    let minDelta = Infinity;
    
    for (const note of notes) {
        // Skip if already judged head OR if it's a hold body part (we only judge heads initially)
        if (note.judgedHead) continue; 
        if (note.lane !== lane) continue;
        
        const delta = Math.abs(note.time - elapsed);
        if (delta <= MISS_WIN && delta < minDelta) {
            bestNote = note;
            minDelta = delta;
        }
    }

    if (bestNote) {
        bestNote.judgedHead = true;
        
        if (autoplay && helperMode) {
            // Just mark visually, no points
            bestNote.hit = true; 
            return;
        }

        // Determine Score based on precision
        let basePts = 0;
        if (minDelta <= PERFECT_WIN) basePts = 100;
        else if (minDelta <= GOOD_WIN) basePts = 50;
        else basePts = 10; // Bad but counts as hit
        
        hits++;
        combo++;
        if (combo > maxCombo) maxCombo = combo;

        const comboBonus = 1 + (Math.min(combo, 100) / 200);
        const pts = Math.round((basePts + totalPower) * (multiplier || 1) * comboBonus);
        score += pts;

        try {
            AppAPI.addScore(score);
            AppAPI.setCombo(combo);
            AppAPI.setAcc(hits / Math.max(1, (hits + misses)));
        } catch(e){}
        
        // If it's a tap note, it's fully done now.
        if(bestNote.type === 'tap') {
            bestNote.hit = true;
        }
        // If it's a hold, waiting for update() to check body/tail
    }
  }

  function finishGame() {
    const acc = (hits + misses) === 0 ? 1 : hits / (hits + misses);
    let rank = "D";
    if (acc >= 0.98) rank = "S+";
    else if (acc >= 0.95) rank = "S";
    else if (acc >= 0.90) rank = "A";
    else if (acc >= 0.80) rank = "B";
    else if (acc >= 0.70) rank = "C";

    try {
      AppAPI.onGameEnd({
        songId: currentSongId,
        score: score,
        maxCombo: maxCombo,
        accuracy: acc,
        rank: rank
      });
    } catch (e) {
      console.warn("AppAPI.onGameEnd failed", e);
    }
  }

  function setAutoplay(enabled) {
    autoplay = !!enabled;
    if (autoplay) {
      prevElapsed = running ? ((performance.now() - startTime) / 1000) : 0;
    }
    console.log('Autoplay', autoplay ? 'ON' : 'OFF');
  }

  function setHelperMode(enabled) {
    const turningOn = !!enabled;
    if (turningOn === helperMode) return;
    helperMode = turningOn;
    console.log('Wolfy Helper', helperMode ? 'ACTIVADO' : 'DESACTIVADO');

    if (audioEl) {
      try {
        if (helperMode) {
          helperOriginalVolume = (typeof audioEl.volume === 'number') ? audioEl.volume : 1.0;
          audioEl.volume = Math.max(0.12, helperOriginalVolume * 0.45);
        } else {
          if (helperOriginalVolume !== null) {
            audioEl.volume = helperOriginalVolume;
            helperOriginalVolume = null;
          }
        }
      } catch (e) {
        console.warn('No se pudo cambiar volumen del audio', e);
      }
    }

    if (helperMode) {
      setAutoplay(true);
    } else {
      setAutoplay(false);
    }
  }

  const _debug = {
    getConfig: () => ({ W, H, HIT_LINE_Y, TOP_MARGIN, TRAVEL, LEAD_TIME, NOTE_SPEED, PERFECT_WIN, GOOD_WIN, MISS_WIN, autoplay, helperMode, running, startTime }),
    notesSample: () => notes.slice(0, 12),
    getState: () => ({ running, score, combo, hits, misses, shields })
  };

  const api = { start, stop, loadChart, setAutoplay, setHelperMode, _debug };
  return api;
})();

window.RhythmEngine = RhythmEngine;
