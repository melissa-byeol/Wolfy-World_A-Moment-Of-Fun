// main.js - Controlador Principal v6

// Instancia global del estado
let GS = new window.GameStateClass();

// --- DATOS DE CANCIONES NUEVAS ---
const SONG_LIST = [
    { id: 'demo1', title: 'Demo Track 1', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', bpm: 120 },
    { id: 'bed_of_thorns', title: 'Bed of Thorns', src: 'assets/bed-of-thorns.mp3', bpm: 135 },
    { id: 'sweet_venom_(seeb)', title: 'Sweet Venom (SeeB Remix)', src: 'assets/sweet-venom-(seeb-remix).mp3', bpm: 128 },
    { id: 'new_kidz', title: 'New Kidz On The Block', src: 'assets/new-kidz-on-the-block.mp3', bpm: 110 },
    { id: 'exotic', title: 'Exotic', src: 'assets/exotic.mp3', bpm: 140 },
    { id: 'curious', title: 'Curious', src: 'assets/curious.mp3', bpm: 129 }
];

// --- INICIALIZACIÓN ---
function init() {
    // Cargar guardado si existe
    const saved = localStorage.getItem('wolfy_world_save_v6');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            GS.loadFromSave(data);
        } catch(e) { console.error("Error cargando save", e); }
    }

    renderAccountUI();
    renderSongs();
    setupBindings();
    updateMenuUI();
}

// --- GUARDADO AUTOMÁTICO ---
function saveGame() {
    localStorage.setItem('wolfy_world_save_v6', JSON.stringify(GS.toSave()));
}

// --- UI HELPERS ---
function el(id){ return document.getElementById(id); }

function showToast(msg, type="info") {
    // Implementación simple de toast o alert si no hay librería
    console.log(`[${type.toUpperCase()}] ${msg}`);
    // Podrías añadir un div flotante aquí igual que antes
}

// --- ACCOUNT & BALANCES ---
function renderAccountUI() {
    const box = el('account-ui');
    box.innerHTML = `
        <div class="account-box">
            <strong>${GS.profileName}</strong>
            <button id="logout-btn" class="secondary">Resetear Perfil</button>
        </div>
    `;
    el('logout-btn').onclick = () => {
        if(confirm("¿Borrar progreso local?")) {
            localStorage.removeItem('wolfy_world_save_v6');
            location.reload();
        }
    };
    renderBalances();
    renderCollection();
}

function renderBalances() {
    el('tokens').textContent = GS.tokens;
    el('shards').textContent = GS.shards;
}

// --- COLECCIÓN DE CARTAS (GESTIÓN) ---
function renderCollection() {
    const grid = el('collection');
    grid.innerHTML = '';
    
    const ownedIds = Object.keys(GS.cardInventory);
    if(ownedIds.length === 0) {
        grid.innerHTML = '<div class="small">No tienes cartas. ¡Abre paquetes!</div>';
        return;
    }

    let totalPower = 0;

    ownedIds.forEach(id => {
        const record = GS.getCardRecord(id);
        const catalogEntry = CARD_MAP[id]; // Acceso directo desde game-state.js scope global
        if (!catalogEntry) return;

        const power = GS.calculateCardPower(id);
        totalPower += power;
        const isEquipped = GS.equippedCards.includes(id);
        const config = RANK_CONFIG[record.rank];
        const canUpgrade = record.level >= config.maxLvl && !!config.nextRank;

        const cardDiv = document.createElement('div');
        cardDiv.className = `card-tile rarity-${record.rank} ${isEquipped ? 'equipped-border' : ''}`;
        
        cardDiv.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong>${catalogEntry.displayName}</strong>
                <span class="badge">${record.rank} L.${record.level}</span>
            </div>
            <div class="small">Pow: ${power} | Dupes: ${record.count - 1}</div>
            <div class="card-actions-row">
                <button data-action="equip" data-id="${id}" class="${isEquipped?'secondary':'primary-btn'}">
                    ${isEquipped ? "Quitar" : "Equipar"}
                </button>
                <button data-action="feed" data-id="${id}" class="secondary small-btn">🍽️</button>
                ${canUpgrade ? `<button data-action="upgrade" data-id="${id}" class="chromo-btn small-btn">⬆️</button>` : ''}
            </div>
        `;
        grid.appendChild(cardDiv);
    });

    el('total-power-display').innerText = totalPower;
    el('equip-count').innerText = GS.equippedCards.length;
}

// Delegación de eventos en la colección
el('collection').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if(!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if(action === 'equip') {
        if(GS.toggleEquipCard(id)) {
            saveGame();
            renderCollection();
        } else {
            showToast("Máximo 5 cartas equipadas.", "error");
        }
    }
    if(action === 'feed') {
        openFeedModal(id);
    }
    if(action === 'upgrade') {
        if(GS.upgradeCardRank(id)) {
            saveGame();
            renderCollection();
            renderBalances();
            showToast("¡Rango subido!", "success");
        } else {
            showToast("Faltan Shards o Nivel Max.", "error");
        }
    }
});

// --- PACKS ---
function openPack(type) {
    const res = GS.openCardPack(type);
    if(!res) {
        showToast(`No tienes suficientes monedas (${type}).`, "error");
        return;
    }
    
    saveGame();
    renderBalances();
    renderCollection();
    
    // Mostrar últimos draws
    const lastDraw = el('last-draw');
    lastDraw.innerHTML = res.cards.map(c => 
        `<span class="${c.isNew ? 'text-green' : 'text-gray'}">${c.name} [${c.rank}]</span>`
    ).join('<br>');
    
    logPack(`Abriste ${res.packName}: ${res.cards.length} cartas.`);
}

// --- FEED MODAL LOGIC ---
let feedTargetId = null;
let selectedFoodIds = new Set();

function openFeedModal(targetId) {
    feedTargetId = targetId;
    selectedFoodIds.clear();
    
    const targetCatalog = CARD_MAP[targetId];
    el('feed-target-name').innerText = targetCatalog?.displayName || targetId;
    
    const list = el('food-selection-list');
    list.innerHTML = "";

    Object.keys(GS.cardInventory).forEach(id => {
        if (id === targetId) return; 
        const rec = GS.cardInventory[id];
        if (rec.count <= 0) return; 

        const catalog = CARD_MAP[id];
        if(!catalog) return;

        const label = document.createElement('label');
        label.style.display = "block";
        label.style.padding = "5px";
        label.style.borderBottom = "1px solid #333";
        label.innerHTML = `
            <input type="checkbox" value="${id}" class="food-check">
            [${rec.rank}] ${catalog.displayName} (x${rec.count})
        `;
        list.appendChild(label);
    });

    el('feed-modal').classList.remove('hidden');
}

el('btn-feed-cancel').onclick = () => {
    el('feed-modal').classList.add('hidden');
    feedTargetId = null;
};

el('btn-feed-confirm').onclick = () => {
    const checks = document.querySelectorAll('.food-check:checked');
    const ids = Array.from(checks).map(c => c.value);
    
    if(ids.length === 0) return showToast("Selecciona comida.", "error");

    const result = GS.feedCard(feedTargetId, ids);
    
    if(result && result.success) {
        saveGame();
        renderCollection();
        showToast(`¡Alimentada! +${result.levelsUp} Niveles`, "success");
        el('feed-modal').classList.add('hidden');
    } else {
        showToast("Error al alimentar.", "error");
    }
};

// --- SONG SELECTOR ---
function renderSongs() {
    const sel = el('song-select');
    sel.innerHTML = '';
    SONG_LIST.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.title} (BPM ${s.bpm})`;
        sel.appendChild(opt);
    });
    sel.onchange = () => {
        const song = SONG_LIST.find(x => x.id === sel.value);
        if(song) {
            el('song-audio').src = song.src;
            el('song-audio').load();
        }
    };
    // Load first by default
    if(SONG_LIST.length > 0) {
        sel.value = SONG_LIST[0].id;
        sel.dispatchEvent(new Event('change'));
    }
}

// --- BINDINGS FINALES ---
// --- BINDINGS FINALES ---
function setupBindings() {
    el('open-pack').onclick = () => {
        const type = el('pack-type').value;
        openPack(type);
    };
    
    el('rg-start').onclick = async () => {
        const song = getCurrentSongData();
        if(!song) return;

        // 1. Intentar cargar el chart específico si existe
        // Convención: charts/{id}.json
        const chartPath = `charts/${song.id}.json`;
        
        showToast(`Cargando chart de ${song.title}...`, "info");
        const loaded = await window.RhythmEngine.loadChart(chartPath);
        
        if(!loaded) {
            showToast("No se encontró chart. Generando demo...", "error");
            // Fallback opcional: Si no hay json, podrías generar notas aleatorias aquí
            // Pero para mantener integridad, abortamos o pedimos al usuario que cree el json.
            return; 
        }

        // 2. Iniciar el juego
        window.RhythmEngine.start(song, getDifficulty());
        el('rg-stop').disabled = false;
        el('rg-start').disabled = true;
    };
    
    el('rg-stop').onclick = () => {
        window.RhythmEngine.stop();
        el('rg-stop').disabled = true;
        el('rg-start').disabled = false;
    };
}

function getCurrentSongData() {
    const id = el('song-select').value;
    return SONG_LIST.find(s => s.id === id) || SONG_LIST[0];
}

function getDifficulty() {
    return el('difficulty').value;
}

function updateMenuUI() {
    renderBalances();
    renderCollection();
}

function logPack(text) {
    const node = document.createElement('div');
    node.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
    el('pack-log').prepend(node);
}

// --- EXPOSE API FOR RHYTHM ENGINE ---
window.AppAPI = {
    addScore(s){ el('rg-score').textContent = s; },
    setCombo(c){ el('rg-combo').textContent = c; },
    setAcc(a){ el('rg-acc').textContent = `${Math.round(a*100)}%`; },
    setPower(p){ el('rg-power').textContent = `x${p.toFixed(1)}`; },
    onGameEnd(results) {
        // Registrar recompensas
        let shardsEarned = 0;
        if (results.rank === "S+" || results.rank === "S") shardsEarned = 10;
        else if (results.rank === "A") shardsEarned = 5;
        else if (results.rank === "B") shardsEarned = 2;
        else shardsEarned = 1;
        
        GS.shards += shardsEarned;
        GS.applyXpToCards(Math.floor(results.score / 20)); // XP basada en score
        
        // Guardar mejor score
        const songId = results.songId;
        if(!GS.rhythmStats.bestScores[songId] || results.score > GS.rhythmStats.bestScores[songId]) {
            GS.rhythmStats.bestScores[songId] = results.score;
        }
        GS.rhythmStats.plays++;
        
        saveGame();
        renderBalances();
        renderCollection();
        
        el('moon-results').innerHTML = `
            <h3>Rango: ${results.rank}</h3>
            <p>Score: ${results.score} | Combo: ${results.maxCombo}</p>
            <p>Recompensa: +${shardsEarned} 💎 Shards</p>
        `;
        el('moon-results').classList.remove('hidden');
    }
};

// Arrancar todo
init();
