// rhythm-game.js - Motor Rítmico (reemplazo completo)
// Usa spawn → hit-line progresivo (normalizado) para evitar notas "amontonadas" o fuera de vista.
// Incluye: DPR/responsive, touch, keyboard, debug exposable.

const RhythmEngine = (function(){
  const canvas = document.getElementById('rhythm-canvas');
  if(!canvas) return null;
  const ctx = canvas.getContext('2d');
  const audioEl = document.getElementById('song-audio') || null;

  // Diseño lógico base
  const LOGICAL_W = 800;
  const LOGICAL_H = 450;

  // Reconfigurables (se recalculan al hacer resize)
  let W = LOGICAL_W;
  let H = LOGICAL_H;
  let HIT_LINE_Y = Math.round(H * 0.82);
  const TOP_MARGIN = 40;   // px: margen superior donde nacen las notas
  let LEAD_TIME = 1.8;     // segundos para que una nota vaya de spawn -> hit line
  let TRAVEL = Math.max(80, HIT_LINE_Y - TOP_MARGIN); // px de recorrido visual entre spawn y hit line
  let NOTE_SPEED = TRAVEL / Math.max(0.001, LEAD_TIME); // px/s derivado = TRAVEL / LEAD_TIME

  // Ventanas de juicio (base, se adaptan en resize para mobile)
  let PERFECT_WIN = 0.06;
  let GOOD_WIN    = 0.12;
  let MISS_WIN    = 0.18;

  // Estado runtime
  let running = false;
  let startTime = 0;
  let notes = []; // notas cargadas del chart
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
  const KEYS = { 'd': 0, 'f': 1, 'j': 2, 'k': 3 };
  const COLORS = ['#ff0055', '#ffffff', '#333333', '#aa0033'];

  // --- Responsive canvas + DPR handling ---
  function resizeCanvasForDisplay() {
    // prefer parent width if available; otherwise window width minus margin
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

    // Scale the drawing context to work in CSS/logical pixels
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    // Update logical sizes used in the game
    W = targetW;
    H = targetH;
    HIT_LINE_Y = Math.round(H * 0.82);

    // Recompute travel distance and speed
    recomputeNoteSpeed();

    // Adjust judgement windows for small screens (more tolerance)
    const mobileFactor = (W <= 420) ? 1.35 : 1.0;
    PERFECT_WIN = 0.06 * mobileFactor;
    GOOD_WIN    = 0.12 * mobileFactor;
    MISS_WIN    = 0.18 * mobileFactor;
  }

  function recomputeNoteSpeed() {
    TRAVEL = Math.max(80, HIT_LINE_Y - TOP_MARGIN);
    NOTE_SPEED = TRAVEL / Math.max(0.001, LEAD_TIME); // px per second
  }

  // Initial sizing + resize listener (debounced)
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
    const x = clientX - rect.left; // CSS pixels
    const laneWidth = W / 4;
    let lane = Math.floor(x / laneWidth);
    lane = Math.max(0, Math.min(3, lane));
    return lane;
  }
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

      const offsetSeconds = (data.offsetMs || 0) / 1000;
      notes = (data.notes || []).map(n => ({
        time: (n.time || 0) + offsetSeconds,
        lane: (typeof n.lane === 'number') ? n.lane : 0,
        judged: false,
        hit: false,
        missed: false,
        y: -100
      })).sort((a,b) => a.time - b.time);

      // expose small debug sample if requested
      return true;
    } catch (e) {
      console.error("Error cargando chart:", e);
      return false;
    }
  }

  // --- Start/Stop/Loop ---
  function start(songData, difficulty) {
    if (running) return;
    // Reset stats
    score = 0; combo = 0; maxCombo = 0; hits = 0; misses = 0;
    running = true;
    startTime = performance.now();
    currentSongId = songData && songData.id ? songData.id : "";

    // get stats from GS if present
    let stats = { power: 1, shields: 0, startCombo: 0, multiplier: 1 };
    if (window.GS && typeof window.GS.getRhythmStats === 'function') {
      try { stats = window.GS.getRhythmStats(currentSongId); } catch(e){ console.warn(e); }
    }
    totalPower = stats.power || 1;
    shields = stats.shields || 0;
    combo = stats.startCombo || 0;
    maxCombo = combo;
    multiplier = stats.multiplier || 1;

    // try to play audio
    if (audioEl) {
      try { audioEl.currentTime = 0; audioEl.play().catch(() => {}); } catch(e){}
    }

    // ensure timing config is consistent
    recomputeNoteSpeed();

    try { AppAPI.setPower(totalPower); AppAPI.addScore(score); AppAPI.setCombo(combo); } catch(e){}

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

    const lastNoteTime = notes.length > 0 ? notes[notes.length - 1].time : 0;
    if (elapsed > lastNoteTime + 2.5) {
      stop();
    } else {
      requestAnimationFrame(loop);
    }
  }

  // --- Update & Draw ---
  function update(elapsed) {
    for (const note of notes) {
      if (note.judged) continue;

      // diff: note.time - effectiveTime ; when diff === LEAD_TIME => spawn, diff === 0 => hit
      const effectiveTime = elapsed - LEAD_TIME;
      const diff = note.time - effectiveTime;

      // Normalized progress: 0 at spawn, 1 at hit
      let progress = 1 - (diff / LEAD_TIME);
      // clamp to avoid crazy values
      if (progress < -0.5) progress = -0.5;
      if (progress > 1.5) progress = 1.5;

      // Compute y based on TOP_MARGIN + progress * TRAVEL
      note.y = TOP_MARGIN + progress * TRAVEL;

      // auto-miss if passed window
      if (elapsed > note.time + MISS_WIN) {
        note.judged = true;
        if (shields > 0) {
          shields--;
          note.hit = true;
        } else {
          note.missed = true;
          misses++;
          combo = 0;
        }
        try { AppAPI.setCombo(combo); } catch(e){}
      }
    }
  }

  function draw(elapsed) {
    // clear in logical coords
    ctx.clearRect(0, 0, W, H);

    // background
    const pulse = Math.sin(elapsed * 4) * 0.05 + 0.95;
    ctx.fillStyle = `rgba(5, 6, 10, ${pulse})`;
    ctx.fillRect(0, 0, W, H);

    const laneW = W / 4;

    // lanes
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for (let i=0; i<=4; i++) {
      ctx.beginPath();
      ctx.moveTo(i*laneW, 0);
      ctx.lineTo(i*laneW, H);
      ctx.stroke();
    }

    // debug: spawn/top margin (temporary visual aid)
    ctx.save();
    ctx.setLineDash([6,4]);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.moveTo(0, TOP_MARGIN);
    ctx.lineTo(W, TOP_MARGIN);
    ctx.stroke();
    ctx.restore();

    // hit line
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

    // key indicators
    const keys = ['D','F','J','K'];
    ctx.font = `${Math.max(12, Math.round(16 * (W / LOGICAL_W)))}px monospace`;
    ctx.textAlign = "center";
    for (let i=0; i<4; i++) {
      const cx = i*laneW + laneW/2;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(cx-15, HIT_LINE_Y+10, 30, 25);
      ctx.fillStyle = "#ddd";
      ctx.fillText(keys[i], cx, HIT_LINE_Y+28);
    }

    // draw notes
    for (const note of notes) {
      // skip if offscreen
      if (note.y < -80 || note.y > H + 80) continue;
      const cx = (note.lane || 0) * laneW + laneW/2;
      const r = Math.max(10, Math.round(18 * (W / LOGICAL_W)));

      if (note.judged) {
        if (note.hit) {
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

  // --- Input handling ---
  window.addEventListener('keydown', (e) => {
    const key = (e.key || '').toLowerCase();
    if (KEYS[key] !== undefined) {
      e.preventDefault();
      inputHit(KEYS[key]);
    }
  });

  function inputHit(lane) {
    if (!running) return;
    const elapsed = (performance.now() - startTime) / 1000;

    let bestNote = null;
    let minDelta = Infinity;
    for (const note of notes) {
      if (note.judged) continue;
      if ((note.lane || 0) !== lane) continue;
      const delta = Math.abs(note.time - elapsed);
      if (delta <= MISS_WIN && delta < minDelta) {
        bestNote = note;
        minDelta = delta;
      }
    }

    if (bestNote) {
      bestNote.judged = true;
      bestNote.hit = true;

      let basePts = 0;
      if (minDelta <= PERFECT_WIN) basePts = 100;
      else if (minDelta <= GOOD_WIN) basePts = 50;
      else basePts = 10;

      hits++;
      combo++;
      if (combo > maxCombo) maxCombo = combo;

      const comboBonus = 1 + (Math.min(combo, 100)/200);
      const pts = Math.round((basePts + totalPower) * (multiplier || 1) * comboBonus);
      score += pts;

      try {
        AppAPI.addScore(score);
        AppAPI.setCombo(combo);
        AppAPI.setAcc(hits / Math.max(1, (hits + misses)));
      } catch(e){}
    } else {
      // miss (no note in window)
      misses++;
      combo = 0;
      try {
        AppAPI.setCombo(combo);
        AppAPI.setAcc(hits / Math.max(1, (hits + misses)));
      } catch(e){}
    }
  }

  // --- Finish ---
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

  // --- Debug exposure (useful for console checks) ---
  const _debug = {
    getConfig: () => ({ W, H, HIT_LINE_Y, TOP_MARGIN, TRAVEL, LEAD_TIME, NOTE_SPEED, PERFECT_WIN, GOOD_WIN, MISS_WIN }),
    notesSample: () => notes.slice(0, 12),
    getState: () => ({ running, score, combo, hits, misses, shields })
  };

  // Public API
  const api = { start, stop, loadChart, _debug };
  return api;
})();

// Expose to global for console access
window.RhythmEngine = RhythmEngine;
