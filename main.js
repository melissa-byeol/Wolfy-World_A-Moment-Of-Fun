
// main.js - account, cards, packs, song selector, UI bindings
// NOTE: This is a demo client-side system (localStorage). Replace storage with backend calls for production.

importScripts = undefined; // avoid worker confusion in some hosts

// ---------- Data: progression values by rarity (from your sequence) ----------
const POWER_TABLE = {
  B: [2,3,4,5,6,7,8,9,10,11],
  A: [13,15,17,19,21,23,25,27,29,31,33,35,37,39,41,43,45,47,49,51],
  S: [54,57,60,63,66,69,72,75,78,81,84,87,90,93,96,99,102,105,108,111,114,117,120,123,126,129,132,135,138,141],
  R: [145,149,153,157,161,165,169,173,177,181,185,189,193,197,201,205,209,213,217,221,225,229,233,237,241,245,249,253,257,261,265,269,273,277,281,285,289,293,297,301],
  XR: [306,311,316,321,326,331,336,341,346,351,356,361,366,371,376,381,386,391,396,401,406,411,416,421,426,431,436,441,446,451,456,461,466,471,476,481,486,491,496,501,506,511,516,521,526,531,536,541,546,551],
  UR: [557,563,569,575,581,587,593,599,605,611,617,623,629,635,641,647,653,659,665,671,677,683,689,695,701,707,713,719,725,731,737,743,749,755,761,767,773,779,785,791,797,803,809,815,821,827,833,839,845,851,857,863,869,875,881,887,893,899,905,911],
  MR: [919,927,935,943,951,959,967,975,983,991,999,1007,1015,1023,1031,1039,1047,1055,1063,1071,1079,1087,1095,1103,1111,1119,1127,1135,1143,1151,1159,1167,1175,1183,1191,1199,1207,1215,1223,1231,1239,1247,1255,1263,1271,1279,1287,1295,1303,1311,1319,1327,1335,1343,1351,1359,1367,1375,1383,1391,1399,1407,1415,1423,1431,1439,1447,1455,1463,1471]
};

// rarities ordered by strength/weight
const RARITIES = ['B','A','S','R','XR','UR','MR'];

// weights for pack rarity distribution (example; tweak to taste)
const PACK_WEIGHTS = {
  standard: {B:70, A:20, S:7, R:2, XR:0.7, UR:0.2, MR:0.1},
  premium: {B:40, A:30, S:18, R:7, XR:3, UR:1.5, MR:0.5}
};

// packs cost
const PACK_COST = { standard: 10, premium: 50 };

// ---------- Local storage helpers ----------
const STORAGE_KEY = 'wolfy_demo_v1';
function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw) return { accounts: {}, sessions: {}, songs: [], global: {} };
  try { return JSON.parse(raw); } catch(e){ return { accounts:{}, sessions:{}, songs:[], global:{} }; }
}
function saveState(state){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
let STATE = loadState();

// ---------- Demo songs ----------
if(!STATE.songs || STATE.songs.length === 0){
  STATE.songs = [
    { id:'demo1', title:'Demo Track 1', src:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', bpm: 120 },
    { id:'demo2', title:'Ambient Loop', src:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', bpm: 100 }
  ];
  saveState(STATE);
}

// ---------- Account manager ----------
const Account = {
  current: null,
  create(username, password){
    if(!username) throw 'username required';
    if(STATE.accounts[username]) throw 'user exists';
    STATE.accounts[username] = {
      username,
      password, // demo: plaintext. In prod use server + hashing.
      tokens: 100,
      shards: 10,
      cards: {}, // key: rarity+level -> count
      createdAt: Date.now()
    };
    saveState(STATE);
    this.login(username, password);
  },
  login(username, password){
    const u = STATE.accounts[username];
    if(!u) throw 'no such user';
    if(u.password !== password) throw 'bad credentials';
    this.current = username;
    renderAccountUI();
  },
  logout(){
    this.current = null;
    renderAccountUI();
  },
  delete(usernameConfirm){
    if(!this.current) throw 'no active session';
    if(usernameConfirm !== this.current) throw 'confirmation mismatch';
    delete STATE.accounts[this.current];
    saveState(STATE);
    this.current = null;
    renderAccountUI();
  },
  get(){
    if(!this.current) return null;
    return STATE.accounts[this.current];
  },
  modifyBalances(deltaTokens=0, deltaShards=0){
    const u = this.get();
    if(!u) throw 'no user';
    u.tokens = Math.max(0, (u.tokens||0) + deltaTokens);
    u.shards = Math.max(0, (u.shards||0) + deltaShards);
    saveState(STATE);
    renderBalances();
  },
  addCard(rarity, level){
    const u = this.get();
    if(!u) throw 'no user';
    const key = `${rarity}-${level}`;
    u.cards[key] = (u.cards[key]||0) + 1;
    saveState(STATE);
    renderCollection();
  }
};

// ---------- Utility ----------
function chooseWeighted(weightMap){
  const total = Object.values(weightMap).reduce((a,b)=>a+b,0);
  let r = Math.random()*total;
  for(const k of Object.keys(weightMap)){
    r -= weightMap[k];
    if(r <= 0) return k;
  }
  // fallback
  return Object.keys(weightMap)[0];
}
function randInt(max){ return Math.floor(Math.random()*max); }

// ---------- Pack opening ----------
function openPack(type='standard'){
  const user = Account.get();
  if(!user) { alert('Inicia sesión para abrir paquetes'); return; }
  const cost = PACK_COST[type] || 10;
  if(user.tokens < cost){ alert('No tienes suficientes Beat Tokens'); return; }
  // deduct
  Account.modifyBalances(-cost, 0);
  const rarity = chooseWeighted(PACK_WEIGHTS[type]);
  const levels = POWER_TABLE[rarity];
  const levelIdx = randInt(levels.length);
  const level = levelIdx + 1;
  // give card
  Account.addCard(rarity, level);
  logPack(`Abriste paquete ${type} → obtuviste ${rarity} lvl.${level}`);
  // reward shards randomly on premium
  if(type==='premium' && Math.random() < 0.35){
    const shards = 1 + Math.floor(Math.random()*3);
    Account.modifyBalances(0, shards);
    logPack(`Bonus: +${shards} Rhythm Shards`);
  }
  renderBalances();
}

// ---------- UI rendering ----------
function el(id){ return document.getElementById(id); }

function renderAccountUI(){
  const box = el('account-ui');
  box.innerHTML = '';
  if(Account.current){
    const u = Account.get();
    box.innerHTML = `
      <div class="account-box">
        <div><strong>${u.username}</strong> <span class="small">(creada: ${new Date(u.createdAt).toLocaleString()})</span></div>
        <div class="small">Cards: ${Object.keys(u.cards||{}).length}</div>
        <div style="display:flex;gap:6px">
          <button id="logout-btn" class="secondary">Cerrar sesión</button>
        </div>
      </div>
    `;
    el('logout-btn').onclick = ()=>{ Account.logout(); };
  } else {
    box.innerHTML = `
      <div class="account-box">
        <input id="login-user" placeholder="Usuario" />
        <input id="login-pass" placeholder="Contraseña" type="password" />
        <div style="display:flex;gap:8px">
          <button id="login-btn">Iniciar</button>
          <button id="signup-btn" class="secondary">Crear</button>
        </div>
      </div>
    `;
    el('login-btn').onclick = ()=>{
      const u = el('login-user').value.trim();
      const p = el('login-pass').value;
      try { Account.login(u,p); } catch(e){ alert(e); }
    };
    el('signup-btn').onclick = ()=>{
      const u = el('login-user').value.trim();
      const p = el('login-pass').value;
      try { Account.create(u,p); } catch(e){ alert(e); }
    };
  }
  renderBalances();
  renderCollection();
}

function renderBalances(){
  const u = Account.get();
  el('tokens').textContent = u ? u.tokens : 0;
  el('shards').textContent = u ? u.shards : 0;
}

// render collection
function renderCollection(){
  const grid = el('collection');
  grid.innerHTML = '';
  const u = Account.get();
  if(!u){ grid.innerHTML = '<div class="small">Inicia sesión para ver tu colección</div>'; return; }
  const entries = Object.entries(u.cards || {});
  if(entries.length===0){ grid.innerHTML = '<div class="small">No tienes cartas aún. Abre paquetes!</div>'; return; }
  // list cards
  entries.forEach(([key, count])=>{
    const [rarity, level] = key.split('-');
    const power = POWER_TABLE[rarity][level-1] || 0;
    const div = document.createElement('div');
    div.className = `card-tile rarity-${rarity}`;
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between">
        <div><strong>${rarity} Lvl.${level}</strong></div>
        <div class="badge">${count}x</div>
      </div>
      <div class="small">Power: ${power}</div>
      <div class="card-meta small">
        <div>Rarity: ${rarity}</div>
        <div><button class="secondary view-card" data-key="${key}">Ver</button></div>
      </div>
    `;
    grid.appendChild(div);
  });
  // view handlers
  document.querySelectorAll('.view-card').forEach(btn=>{
    btn.onclick = ()=>{ alert('Card view: '+btn.dataset.key); };
  });
}

// pack log
function logPack(text){
  const node = document.createElement('div');
  node.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  el('pack-log').prepend(node);
}

// song UI
function renderSongs(){
  const sel = el('song-select'); sel.innerHTML = '';
  STATE.songs.forEach(s=>{
    const opt = document.createElement('option'); opt.value = s.id; opt.textContent = `${s.title} (BPM ${s.bpm || '?'})`;
    sel.appendChild(opt);
  });
  sel.onchange = ()=>{ loadSong(sel.value); };
  loadSong(sel.value || STATE.songs[0].id);
}

function loadSong(id){
  const s = STATE.songs.find(x=>x.id===id);
  if(!s) return;
  const audio = el('song-audio');
  audio.src = s.src;
  audio.load();
}

// create / delete UI
function renderCreateUI(){
  const box = el('create-ui');
  box.innerHTML = `
    <div class="form-row"><input id="new-user" placeholder="Nuevo usuario"/></div>
    <div class="form-row"><input id="new-pass" placeholder="Contraseña" type="password"/></div>
    <div class="form-row">
      <button id="create-account-btn">Crear Cuenta</button>
      <button id="delete-account-btn" class="secondary">Eliminar Cuenta</button>
    </div>
    <div id="delete-area" class="delete-confirm small"></div>
  `;
  el('create-account-btn').onclick = ()=>{
    try { Account.create(el('new-user').value.trim(), el('new-pass').value); alert('Cuenta creada e iniciada'); }
    catch(e){ alert(e); }
  };
  el('delete-account-btn').onclick = ()=>{
    const u = Account.current;
    if(!u){ alert('Inicia sesión antes de eliminar'); return; }
    const area = el('delete-area');
    area.innerHTML = `
      Escribe tu usuario <strong>${u}</strong> aquí para confirmar: 
      <input id="del-confirm" placeholder="Escribe tu usuario" />
      <button id="del-confirm-btn" class="secondary">Confirmar</button>
    `;
    el('del-confirm-btn').onclick = ()=>{
      const val = el('del-confirm').value.trim();
      try {
        Account.delete(val);
        alert('Cuenta eliminada');
        area.innerHTML = '';
      } catch(e){ alert(e); }
    };
  };
}

// bindings
function setupBindings(){
  el('open-pack').onclick = ()=>{
    const type = el('pack-type').value;
    openPack(type);
  };
  el('rg-start').onclick = ()=>{ RhythmGame.start(); };
  el('rg-stop').onclick = ()=>{ RhythmGame.stop(); };
}

// initial render
renderAccountUI();
renderCreateUI();
renderSongs();
setupBindings();

// expose minimal API for rhythm-game to update UI
window.AppAPI = {
  addScore(s){ el('rg-score').textContent = s; },
  setCombo(c){ el('rg-combo').textContent = c; },
  setAcc(a){ el('rg-acc').textContent = `${Math.round(a*100)}%`; },
  getCurrentSong(){ return STATE.songs.find(s=>s.id===el('song-select').value) || STATE.songs[0]; },
  getDifficulty(){ return el('difficulty').value; }
};

// expose Account for debugging
window._Account = Account;

console.log('Main UI initialized');
