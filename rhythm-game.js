const RhythmEngine = (function(){
  const canvas = document.getElementById('rhythm-canvas');
  if(!canvas) return null;

  const ctx = canvas.getContext('2d');

  let W = 800;
  let H = 450;

  // Más cómodo para móvil + mantiene margen visual
  let HIT_LINE_Y = Math.round(H * 0.82);
  let NOTE_SPEED = 220;
  let LEAD_TIME = 2.2;

  // Más tolerantes en móvil
  let PERFECT_WIN = 0.08;
  let GOOD_WIN = 0.16;
  let MISS_WIN = 0.24;

  canvas.width = W;
  canvas.height = H;

  let running = false;
  let startTime = 0;
  let notes = [];
  let audioEl = document.getElementById('song-audio');
  let currentSongId = "";

  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let hits = 0;
  let misses = 0;
  let shields = 0;
  let totalPower = 1;
  let multiplier = 1;

  const KEYS = { 'd': 0, 'f': 1, 'j': 2, 'k': 3 };
  const COLORS = ['#ff0055', '#ffffff', '#333333', '#aa0033'];

  function update(elapsed) {
    for (const note of notes) {
      if (note.judged) continue;

      const effectiveTime = elapsed - LEAD_TIME;
      const diff = note.time - effectiveTime;

      // margen arriba: no se dibuja desde el borde, siempre deja 30px
      const startY = 30;
      note.y = (HIT_LINE_Y - startY) - (diff * NOTE_SPEED) + startY;

      // si la nota se va demasiado arriba, la dejamos visible
      if (note.y < 20) note.y = 20;

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
        try { AppAPI.setCombo(combo); } catch (e) {}
      }
    }
  }

  function draw(elapsed) {
    ctx.clearRect(0, 0, W, H);

    const pulse = Math.sin(elapsed * 4) * 0.05 + 0.95;
    ctx.fillStyle = `rgba(5, 6, 10, ${pulse})`;
    ctx.fillRect(0, 0, W, H);

    const laneW = W / 4;

    // lanes
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(i * laneW, 0);
      ctx.lineTo(i * laneW, H);
      ctx.stroke();
    }

    // hit line
    ctx.strokeStyle = "#f1c40f";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, HIT_LINE_Y);
    ctx.lineTo(W, HIT_LINE_Y);
    ctx.stroke();

    // key indicators
    const keys = ['D', 'F', 'J', 'K'];
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    for (let i = 0; i < 4; i++) {
      const cx = i * laneW + laneW / 2;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(cx - 15, HIT_LINE_Y + 10, 30, 25);
      ctx.fillStyle = "#aaa";
      ctx.fillText(keys[i], cx, HIT_LINE_Y + 28);
    }

    // notas
    for (const note of notes) {
      if (note.y < -60 || note.y > H + 60) continue;

      const cx = note.lane * laneW + laneW / 2;
      const r = 18;

      if (note.judged) {
        if (note.hit) {
          const alpha = Math.max(0, 1 - (elapsed - note.time) * 3);
          ctx.globalAlpha = alpha;
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(cx, HIT_LINE_Y, r * 1.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      } else {
        ctx.fillStyle = COLORS[note.lane];
        ctx.beginPath();
        ctx.arc(cx, note.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  async function loadChart(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();

      const offsetSeconds = (data.offsetMs || 0) / 1000;

      notes = (data.notes || []).map(n => ({
        ...n,
        time: (n.time || 0) + offsetSeconds,
        judged: false,
        hit: false,
        missed: false,
        y: -100
      })).sort((a, b) => a.time - b.time);

      return true;
    } catch (e) {
      console.error("Error cargando chart:", e);
      return false;
    }
  }

  function start(songData, difficulty) {
    if (running) return;

    score = 0;
    combo = 0;
    maxCombo = 0;
    hits = 0;
    misses = 0;
    running = true;
    startTime = performance.now();
    currentSongId = songData.id;

    let stats = { power: 1, shields: 0, startCombo: 0, multiplier: 1 };
    if (window.GS && typeof window.GS.getRhythmStats === "function") {
      stats = window.GS.getRhythmStats(songData.id);
    }

    totalPower = stats.power || 1;
    shields = stats.shields || 0;
    combo = stats.startCombo || 0;
    maxCombo = combo;
    multiplier = stats.multiplier || 1;

    if (audioEl) {
      try {
        audioEl.currentTime = 0;
        audioEl.play().catch(() => {});
      } catch (e) {}
    }

    requestAnimationFrame(loop);
    try { AppAPI.setPower(totalPower); AppAPI.addScore(score); AppAPI.setCombo(combo); } catch (e) {}
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

  function stop() {
    running = false;
    if (audioEl) {
      try { audioEl.pause(); } catch (e) {}
    }
    finishGame();
  }

  function inputHit(lane) {
    if (!running) return;
    const elapsed = (performance.now() - startTime) / 1000;

    let bestNote = null;
    let minDelta = Infinity;

    for (const note of notes) {
      if (note.judged || note.lane !== lane) continue;
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

      const comboBonus = 1 + (Math.min(combo, 100) / 200);
      const pts = Math.round((basePts + totalPower) * multiplier * comboBonus);

      score += pts;
      try { AppAPI.addScore(score); AppAPI.setCombo(combo); AppAPI.setAcc(hits / Math.max(1, hits + misses)); } catch (e) {}
    } else {
      misses++;
      combo = 0;
      try { AppAPI.setCombo(combo); AppAPI.setAcc(hits / Math.max(1, hits + misses)); } catch (e) {}
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
    } catch (e) {}
  }

  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (KEYS[key] !== undefined) {
      e.preventDefault();
      inputHit(KEYS[key]);
    }
  });

  return { start, stop, loadChart };
})();

window.RhythmEngine = RhythmEngine;
