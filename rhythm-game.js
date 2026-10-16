// rhythm-game.js - simple rhythm engine (canvas) for demo
// Relies on AppAPI (from main.js) for song selection & UI updates

const RhythmGame = (function(){
  const canvas = document.getElementById('rhythm-canvas');
  const ctx = canvas.getContext('2d');
  let running = false;
  let lastTime = 0;
  let beats = []; // each beat: {time, x}
  let startTs = 0;
  let score = 0;
  let combo = 0;
  let hits = 0, attempts = 0;

  // difficulty modifiers
  const DIFFICULTY = {
    easy: { spawnRate: 0.75, window: 0.4 },
    normal: { spawnRate: 1.0, window: 0.3 },
    hard: { spawnRate: 1.25, window: 0.22 },
    expert: { spawnRate: 1.5, window: 0.16 }
  };

  // generate beats from BPM: simple metronome-like timeline for demo
  function prepareBeatsForSong(bpm, durationSec, difficulty){
    const beatsPerSec = bpm/60;
    const rate = DIFFICULTY[difficulty].spawnRate;
    const interval = 1 / (beatsPerSec * rate);
    const arr = [];
    for(let t = 0; t < durationSec; t += interval){
      // a little randomness
      arr.push({ time: t + 0.02*Math.random(), hit:false });
    }
    return arr;
  }

  function start(){
    if(running) return;
    const song = AppAPI.getCurrentSong();
    const diff = AppAPI.getDifficulty();
    const duration = 30; // demo length
    beats = prepareBeatsForSong(song.bpm || 120, duration, diff);
    startTs = performance.now();
    lastTime = startTs;
    score = 0; combo = 0; hits=0; attempts=0;
    running = true;
    requestAnimationFrame(loop);
    // optionally auto-play song
    const audio = document.getElementById('song-audio');
    try { audio.currentTime = 0; audio.play(); } catch(e){}
  }

  function stop(){
    running = false;
    const audio = document.getElementById('song-audio');
    try { audio.pause(); audio.currentTime = 0; } catch(e){}
    // update result
    AppAPI.addScore(score);
    AppAPI.setCombo(combo);
    const acc = attempts===0 ? 0 : hits/attempts;
    AppAPI.setAcc(acc);
  }

  function loop(ts){
    if(!running) return;
    const elapsed = (ts - startTs)/1000;
    // spawn and draw
    update(elapsed);
    draw(elapsed);
    lastTime = ts;
    requestAnimationFrame(loop);
  }

  function update(elapsed){
    // remove expired beats
    beats = beats.filter(b => !b.hit && b.time > elapsed - 1); // keep recent
  }

  function draw(elapsed){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // draw hit line
    const lineX = canvas.width*0.85;
    ctx.fillStyle = '#222';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#333';
    ctx.fillRect(lineX-2,0,4,canvas.height);
    // draw beats as circles moving right-to-left to the hit line
    const travel = canvas.width*0.85;
    const song = AppAPI.getCurrentSong();
    const durationWindow = 6; // seconds of travel
    ctx.fillStyle = '#7fffb1';
    beats.forEach(b=>{
      const tLeft = b.time - elapsed;
      const progress = 1 - (tLeft / durationWindow); // 0..1
      const x = Math.min(lineX, Math.max(20, progress*travel));
      const y = canvas.height/2 + Math.sin(b.time*3)*20;
      ctx.beginPath();
      ctx.fillStyle = '#4fc3f7';
      ctx.arc(x,y,12,0,Math.PI*2);
      ctx.fill();
    });
    // hud
    ctx.fillStyle = '#bcd';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Score: ${score}`, 12, 20);
    ctx.fillText(`Combo: ${combo}`, 12, 40);
  }

  // key handling: space = hit
  window.addEventListener('keydown', (e)=>{
    if(e.code==='Space'){ attemptHit(); e.preventDefault(); }
  });

  function attemptHit(){
    if(!running) return;
    const elapsed = (performance.now()-startTs)/1000;
    const diff = AppAPI.getDifficulty();
    const windowSec = DIFFICULTY[diff].window;
    // find nearest unhit beat within window
    let best = null; let bestDelta = Infinity;
    beats.forEach(b=>{
      if(b.hit) return;
      const delta = Math.abs(b.time - elapsed);
      if(delta <= windowSec && delta < bestDelta){
        best = b; bestDelta = delta;
      }
    });
    attempts++;
    if(best){
      best.hit = true; hits++; combo++; score += Math.max(50, Math.round((1 - bestDelta/windowSec)*1000)) + combo*2;
      AppAPI.addScore(score); AppAPI.setCombo(combo);
      const acc = hits/attempts; AppAPI.setAcc(acc);
      // reward tokens for perfect close hits
      if(bestDelta < windowSec*0.2){ Account.modifyBalances(1,0); log('Hit: perfect! +1 BT'); }
    } else {
      // miss
      combo = 0; AppAPI.setCombo(combo);
      const acc = hits/attempts; AppAPI.setAcc(acc);
      // penalize
      score = Math.max(0, score - 10);
      AppAPI.addScore(score);
    }
  }

  function log(msg){
    const node = document.createElement('div');
    node.textContent = `[RG] ${msg}`;
    document.getElementById('pack-log').prepend(node);
  }

  return { start, stop };
})();

// expose name
window.RhythmGame = RhythmGame;
