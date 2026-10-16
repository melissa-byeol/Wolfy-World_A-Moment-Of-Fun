// rhythm-game.js - Motor Rítmico v7 (Chart Based)

const RhythmEngine = (function(){
  const canvas = document.getElementById('rhythm-canvas');
  if(!canvas) return null; // Seguridad
  
  const ctx = canvas.getContext('2d');
  
  // Config Canvas
  const W = 800;
  const H = 450;
  canvas.width = W;
  canvas.height = H;

  let running = false;
  let startTime = 0;
  let notes = [];
  let audioEl = document.getElementById('song-audio');
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
  
  // Physics
  const HIT_LINE_Y = H - 70;
  const NOTE_SPEED = 450; 
  const LEAD_TIME = 1.0; 
  
  // Judgement Windows (seconds)
  const PERFECT_WIN = 0.06;
  const GOOD_WIN = 0.12;
  const MISS_WIN = 0.18;

  /**
   * Carga un chart desde una URL JSON
   */
  async function loadChart(url) {
      try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          const data = await res.json();
          
          // Procesar notas
          const offsetSeconds = (data.offsetMs || 0) / 1000;
          
          notes = data.notes.map(n => ({
              ...n,
              time: n.time + offsetSeconds,
              judged: false,
              hit: false,
              missed: false,
              y: -100 
          })).sort((a, b) => a.time - b.time); 

          console.log(`✅ Chart cargado: ${data.title}. Notas: ${notes.length}`);
          return true;
      } catch (e) {
          console.error("❌ Error cargando chart:", e);
          return false;
      }
  }

  function start(songData, difficulty) {
      if(running) return;
      
      // Reset State
      score = 0; combo = 0; maxCombo = 0; hits = 0; misses = 0;
      running = true;
      startTime = performance.now();
      currentSongId = songData.id;
      
      // Get Stats from GameState (expuesto globalmente como window.GS)
      let stats = { power: 1, shields: 0, startCombo: 0, multiplier: 1 };
      if(window.GS && typeof window.GS.getRhythmStats === 'function') {
          stats = window.GS.getRhythmStats(songData.id);
      }
      
      totalPower = stats.power;
      shields = stats.shields;
      combo = stats.startCombo;
      maxCombo = combo;
      multiplier = stats.multiplier;

      // Play Audio
      if(audioEl) {
          audioEl.currentTime = 0;
          audioEl.play().catch(e => console.warn("Audio blocked"));
      }

      requestAnimationFrame(loop);
      AppAPI.setPower(totalPower);
      AppAPI.addScore(score);
      AppAPI.setCombo(combo);
  }

  function stop() {
      running = false;
      if(audioEl) audioEl.pause();
      finishGame();
  }

  function loop(now) {
      if(!running) return;
      
      const elapsed = (now - startTime) / 1000;
      update(elapsed);
      draw(elapsed);
      
      // Check end condition based on last note time or duration
      const lastNoteTime = notes.length > 0 ? notes[notes.length-1].time : 0;
      if (elapsed > lastNoteTime + 2) {
          stop();
      } else {
          requestAnimationFrame(loop);
      }
  }

  function update(elapsed) {
      for(const note of notes) {
          if(note.judged) continue;
          
          const effectiveTime = elapsed - LEAD_TIME;
          const diff = note.time - effectiveTime;
          note.y = HIT_LINE_Y - (diff * NOTE_SPEED);

          // Auto Miss
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
      ctx.clearRect(0, 0, W, H);
      
      // Background Pulse
      const pulse = Math.sin(elapsed * 4) * 0.05 + 0.95;
      ctx.fillStyle = `rgba(5, 6, 10, ${pulse})`;
      ctx.fillRect(0, 0, W, H);

      const laneW = W / 4;

      // Draw Lanes
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      for(let i=0; i<=4; i++) {
          ctx.beginPath();
          ctx.moveTo(i*laneW, 0);
          ctx.lineTo(i*laneW, H);
          ctx.stroke();
      }

      // Hit Line
      ctx.shadowBlur = 15;
      ctx.shadowColor = "#f1c40f";
      ctx.strokeStyle = "#f1c40f";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, HIT_LINE_Y);
      ctx.lineTo(W, HIT_LINE_Y);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Key Indicators
      const keys = ['D','F','J','K'];
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "center";
      for(let i=0; i<4; i++) {
          const cx = i*laneW + laneW/2;
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.fillRect(cx-15, HIT_LINE_Y+10, 30, 25);
          ctx.fillStyle = "#aaa";
          ctx.fillText(keys[i], cx, HIT_LINE_Y+28);
      }

      // Draw Notes
      for(const note of notes) {
          if(note.y < -50 || note.y > H+50) continue;
          
          const cx = note.lane * laneW + laneW/2;
          const r = 18;

          if(note.judged) {
              if(note.hit) {
                  const alpha = Math.max(0, 1 - (elapsed - note.time)*3);
                  ctx.globalAlpha = alpha;
                  ctx.fillStyle = "#fff";
                  ctx.beginPath();
                  ctx.arc(cx, HIT_LINE_Y, r*1.5, 0, Math.PI*2);
                  ctx.fill();
                  ctx.globalAlpha = 1.0;
              }
          } else {
              ctx.fillStyle = COLORS[note.lane];
              ctx.shadowBlur = 10;
              ctx.shadowColor = COLORS[note.lane];
              ctx.beginPath();
              ctx.arc(cx, note.y, r, 0, Math.PI*2);
              ctx.fill();
              ctx.shadowBlur = 0;
              ctx.strokeStyle = "white";
              ctx.lineWidth = 2;
              ctx.stroke();
              
              ctx.fillStyle = "black";
              ctx.font = "14px Arial";
              ctx.fillText("🌹", cx, note.y+5);
          }
      }
  }

  function inputHit(lane) {
      if(!running) return;
      const elapsed = (performance.now() - startTime) / 1000;
      
      let bestNote = null;
      let minDelta = Infinity;

      for(const note of notes) {
          if(note.judged || note.lane !== lane) continue;
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
          const pts = Math.round((basePts + totalPower) * multiplier * comboBonus);
          
          score += pts;
          
          AppAPI.addScore(score);
          AppAPI.setCombo(combo);
          AppAPI.setAcc(hits/(hits+misses));
      }
  }

  function finishGame() {
      const acc = (hits+misses)===0 ? 1 : hits/(hits+misses);
      let rank = "D";
      if(acc >= 0.98) rank = "S+";
      else if(acc >= 0.95) rank = "S";
      else if(acc >= 0.90) rank = "A";
      else if(acc >= 0.80) rank = "B";
      else if(acc >= 0.70) rank = "C";

      AppAPI.onGameEnd({
          songId: currentSongId,
          score: score,
          maxCombo: maxCombo,
          accuracy: acc,
          rank: rank
      });
  }

  // Input Listeners
  window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if(KEYS[key] !== undefined) {
          e.preventDefault();
          inputHit(KEYS[key]);
      }
  });

  return { start, stop, loadChart };
})();

window.RhythmEngine = RhythmEngine;
