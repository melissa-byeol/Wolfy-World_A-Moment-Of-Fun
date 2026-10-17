// rhythm-game.js - Motor Rítmico v7 (Chart Based) - ARREGLADO (responsive, DPR, touch, resize)

const RhythmEngine = (function(){
  const canvas = document.getElementById('rhythm-canvas');
  if(!canvas) return null; // Seguridad: devuelve null si no existe el canvas
  
  const ctx = canvas.getContext('2d');
  const audioEl = document.getElementById('song-audio');

  // Diseño base (coordenadas lógicas)
  const LOGICAL_W = 800;
  const LOGICAL_H = 450;

  // Variables reconfigurables (se reasignan en resize)
  let W = LOGICAL_W;
  let H = LOGICAL_H;
  let HIT_LINE_Y = H - 70;
  let NOTE_SPEED = 450;
  let LEAD_TIME = 1.0;

  // Judgement windows (segundos) - valores base
  let PERFECT_WIN = 0.06;
  let GOOD_WIN = 0.12;
  let MISS_WIN = 0.18;

  // Estado runtime
  let running = false;
  let startTime = 0;
  let notes = [];
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

  // Keys mapping
  const KEYS = { 'd': 0, 'f': 1, 'j': 2, 'k': 3 };
  const COLORS = ['#ff0055', '#ffffff', '#333333', '#aa0033'];

  // Resize / DPR / responsive init
  function resizeCanvasForDisplay() {
    // target width: prefer parent width if available, otherwise window width minus margin
    const parent = canvas.parentElement;
    let parentWidth = parent ? Math.min(parent.clientWidth, LOGICAL_W) : Math.min(window.innerWidth - 20, LOGICAL_W);
    if(parentWidth <= 0) parentWidth = Math.min(window.innerWidth - 20, LOGICAL_W);

    const aspect = LOGICAL_W / LOGICAL_H;
    const targetW = Math.round(parentWidth);
    const targetH = Math.round(targetW / aspect);

    const DPR = Math.max(1, window.devicePixelRatio || 1);

    // Apply CSS size (visual) and backing buffer size (pixels)
    canvas.style.width = targetW + 'px';
    canvas.style.height = targetH + 'px';
    canvas.width = Math.round(targetW * DPR);
    canvas.height = Math.round(targetH * DPR);

    // Work in logical coordinates: scale the context
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    // Update logical drawing sizes used by the code
    W = targetW;
    H = targetH;

    // Recompute hit line as percentage of height (82% down by default)
    HIT_LINE_Y = Math.round(H * 0.82);

    // Adapt speed and lead time with screen height: smaller => slower and more lead
    const scaleFactor = H / LOGICAL_H; // <1 on small screens
    NOTE_SPEED = Math.max(140, Math.round(450 * scaleFactor)); // clamp a min speed
    // Lead time: increase modestly on smaller screens
    LEAD_TIME = Math.min(3.0, Math.max(1.0, 1.0 + (1 - scaleFactor) * 2.0));

    // Tweak judgement windows for mobile (bigger tolerance)
    const mobileFactor = (W <= 420) ? 1.35 : 1.0;
    PERFECT_WIN = 0.06 * mobileFactor;
    GOOD_WIN    = 0.12 * mobileFactor;
    MISS_WIN    = 0.18 * mobileFactor;
  }

  // Initial resize and responsive handler (debounced)
  resizeCanvasForDisplay();
  let _resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => {
      resizeCanvasForDisplay();
    }, 120);
  });

  // Utility: map touch X to lane index
  function touchToLane(clientX) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left; // CSS pixels
    const laneWidth = W / 4;
    let lane = Math.floor(x / laneWidth);
    if (lane < 0) lane = 0;
    if (lane > 3) lane = 3;
    return lane;
  }

  // Touch input support
  canvas.addEventListener('touchstart', (ev) => {
    ev.preventDefault();
    for(const t of Array.from(ev.changedTouches)) {
      const lane = touchToLane(t.clientX);
      inputHit(lane);
    }
  }, { passive: false });

  // --- Chart loader ---
  async function loadChart(url) {
      try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          const data = await res.json();
          
          // Procesar notas: se asume notes[].time (s) y notes[].lane (0..3)
          const offsetSeconds = (data.offsetMs || 0) / 1000;
          
          notes = (data.notes || []).map(n => ({
              ...n,
              time: (n.time || 0) + offsetSeconds,
              judged: false,
              hit: false,
              missed: false,
              y: -100 
          })).sort((a, b) => a.time - b.time); 

          console.log(`✅ Chart cargado: ${data.title || url}. Notas: ${notes.length}`);
          return true;
      } catch (e) {
          console.error("❌ Error cargando chart:", e);
          return false;
      }
  }

  // --- Game control (start/stop/loop) ---
  function start(songData, difficulty) {
      if(running) return;
      
      // Reset State
      score = 0; combo = 0; maxCombo = 0; hits = 0; misses = 0;
      running = true;
      startTime = performance.now();
      currentSongId = songData.id || "";

      // Get Stats from GameState (expuesto globalmente)
      let stats = { power: 1, shields: 0, startCombo: 0, multiplier: 1 };
      if(window.GS && typeof window.GS.getRhythmStats === 'function') {
          try { stats = window.GS.getRhythmStats(songData.id); } catch(e){ console.warn(e); }
      }
      
      totalPower = stats.power || 1;
      shields = stats.shields || 0;
      combo = stats.startCombo || 0;
      maxCombo = combo;
      multiplier = stats.multiplier || 1;

      // Play Audio (si está presente)
      if(audioEl) {
          try {
            audioEl.currentTime = 0;
            audioEl.play().catch(e => console.warn("Audio blocked", e));
          } catch(e){ console.warn(e); }
      }

      AppAPI.setPower(totalPower);
      AppAPI.addScore(score);
      AppAPI.setCombo(combo);

      requestAnimationFrame(loop);
  }

  function stop() {
      running = false;
      if(audioEl) {
        try { audioEl.pause(); } catch(e){/*ignore*/ }
      }
      finishGame();
  }

  function loop(now) {
      if(!running) return;
      
      const elapsed = (now - startTime) / 1000;
      update(elapsed);
      draw(elapsed);
      
      // End when past last note + margin
      const lastNoteTime = notes.length > 0 ? notes[notes.length-1].time : 0;
      if (elapsed > lastNoteTime + 2.5) {
          stop();
      } else {
          requestAnimationFrame(loop);
      }
  }

  // --- Update / Draw ---
  function update(elapsed) {
      for(const note of notes) {
          if(note.judged) continue;
          
          const effectiveTime = elapsed - LEAD_TIME;
          const diff = note.time - effectiveTime;
          note.y = HIT_LINE_Y - (diff * NOTE_SPEED);

          // Auto Miss if passed MISS_WIN after note time
          if(elapsed > note.time + MISS_WIN) {
              note.judged = true;
              if(shields > 0) {
                  shields--;
                  note.hit = true;
              } else {
                  note.missed = true;
                  misses++;
                  combo = 0;
              }
              AppAPI.setCombo(combo);
          }
      }
  }

  function draw(elapsed) {
      // clear using logical dimensions
      ctx.clearRect(0, 0, W, H);
      
      // Background
      const pulse = Math.sin(elapsed * 4) * 0.05 + 0.95;
      ctx.fillStyle = `rgba(5, 6, 10, ${pulse})`;
      ctx.fillRect(0, 0, W, H);

      const laneW = W / 4;

      // Draw Lanes lines
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      for(let i=0; i<=4; i++) {
          ctx.beginPath();
          ctx.moveTo(i*laneW, 0);
          ctx.lineTo(i*laneW, H);
          ctx.stroke();
      }

      // Hit Line
      ctx.save();
      ctx.shadowBlur = 15;
      ctx.shadowColor = "#f1c40f";
      ctx.strokeStyle = "#f1c40f";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, HIT_LINE_Y);
      ctx.lineTo(W, HIT_LINE_Y);
      ctx.stroke();
      ctx.restore();

      // Key Indicators
      const keys = ['D','F','J','K'];
      ctx.font = `${Math.max(12, Math.round(16 * (W / LOGICAL_W)))}px monospace`;
      ctx.textAlign = "center";
      for(let i=0; i<4; i++) {
          const cx = i*laneW + laneW/2;
          ctx.fillStyle = "rgba(0,0,0,0.45)";
          ctx.fillRect(cx-15, HIT_LINE_Y+10, 30, 25);
          ctx.fillStyle = "#ddd";
          ctx.fillText(keys[i], cx, HIT_LINE_Y+28);
      }

      // Draw Notes
      for(const note of notes) {
          // cull out-of-visual-range notes
          if(note.y < -60 || note.y > H + 60) continue;
          
          const cx = (note.lane || 0) * laneW + laneW/2;
          const r = Math.max(10, Math.round(18 * (W / LOGICAL_W)));

          if(note.judged) {
              if(note.hit) {
                  const alpha = Math.max(0, 1 - (elapsed - note.time) * 3);
                  ctx.globalAlpha = alpha;
                  ctx.fillStyle = "#fff";
                  ctx.beginPath();
                  ctx.arc(cx, HIT_LINE_Y, r * 1.4, 0, Math.PI*2);
                  ctx.fill();
                  ctx.globalAlpha = 1.0;
              }
          } else {
              ctx.fillStyle = COLORS[note.lane % COLORS.length];
              ctx.save();
              ctx.shadowBlur = 10;
              ctx.shadowColor = COLORS[note.lane % COLORS.length];
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
              ctx.fillText("🌹", cx, note.y + Math.round(5 * (W / LOGICAL_W)));
          }
      }
  }

  // --- Input handling (keyboard + touch above) ---
  window.addEventListener('keydown', (e) => {
      const key = (e.key || '').toLowerCase();
      if(KEYS[key] !== undefined) {
          e.preventDefault();
          inputHit(KEYS[key]);
      }
  });

  function inputHit(lane) {
      if(!running) return;
      const elapsed = (performance.now() - startTime) / 1000;
      
      let bestNote = null;
      let minDelta = Infinity;

      for(const note of notes) {
          if(note.judged) continue;
          if((note.lane || 0) !== lane) continue;
          const delta = Math.abs(note.time - elapsed);
          if(delta <= MISS_WIN && delta < minDelta) {
              bestNote = note;
              minDelta = delta;
          }
      }

      if(bestNote) {
          bestNote.judged = true;
          bestNote.hit = true;
          
          let basePts = 0;
          if(minDelta <= PERFECT_WIN) basePts = 100;
          else if(minDelta <= GOOD_WIN) basePts = 50;
          else basePts = 10; 

          hits++;
          combo++;
          if(combo > maxCombo) maxCombo = combo;

          const comboBonus = 1 + (Math.min(combo, 100)/200);
          const pts = Math.round((basePts + totalPower) * (multiplier || 1) * comboBonus);
          
          score += pts;
          
          // Update UI via AppAPI (expuesto por main.js)
          try {
            AppAPI.addScore(score);
            AppAPI.setCombo(combo);
            AppAPI.setAcc( hits / Math.max(1, (hits + misses)) );
          } catch(e){ /* ignore if AppAPI missing */ }
      } else {
          // Miss (no note in window)
          combo = 0;
          misses++;
          try { AppAPI.setCombo(combo); AppAPI.setAcc( hits / Math.max(1, (hits + misses)) ); } catch(e){}
      }
  }

  // --- Finish / scoring
  function finishGame() {
      const acc = (hits + misses) === 0 ? 1 : hits / (hits + misses);
      let rank = "D";
      if(acc >= 0.98) rank = "S+";
      else if(acc >= 0.95) rank = "S";
      else if(acc >= 0.90) rank = "A";
      else if(acc >= 0.80) rank = "B";
      else if(acc >= 0.70) rank = "C";

      try {
        AppAPI.onGameEnd({
            songId: currentSongId,
            score: score,
            maxCombo: maxCombo,
            accuracy: acc,
            rank: rank
        });
      } catch(e){
        console.warn("AppAPI.onGameEnd failed", e);
      }
  }

  // Expose public API
  return { start, stop, loadChart };
})();

window.RhythmEngine = RhythmEngine;
