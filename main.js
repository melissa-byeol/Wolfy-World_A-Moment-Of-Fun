// main.js - Controlador Principal v7 (Estable & Robusto)

// Instancia global del estado
let GS = null; // Se inicializará después de cargar GameStateClass

// --- DATOS DE CANCIONES ---
const SONG_LIST = [
    { id: 'demo1', title: 'Demo Track 1', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', bpm: 120 },
    { id: 'bed_of_thorns', title: 'Bed of Thorns', src: 'assets/bed-of-thorns.mp3', bpm: 135 },
    { id: 'sweet_venom_(seeb)', title: 'Sweet Venom (SeeB Remix)', src: 'assets/sweet-venom-(seeb-remix).mp3', bpm: 120 },
    { id: 'new_kidz', title: 'New Kidz On The Block', src: 'assets/new-kidz-on-the-block.mp3', bpm: 110 },
    { id: 'exotic', title: 'Exotic', src: 'assets/exotic.mp3', bpm: 140 },
    { id: 'curious', title: 'Curious', src: 'assets/curious.mp3', bpm: 129 },
    { id: 'sos', title: 'SOS (Prod. By Marshmello)', src: 'assets/sos.mp3', bpm: 152},
    { id: 'scream', title: 'Scream', src: 'assets/scream.mp3', bpm: 154}
];

// --- INICIALIZACIÓN SEGURA ---
function init() {
    // 1. Verificar que GameStateClass exista (cargado desde game-state.js)
    if (typeof window.GameStateClass === 'undefined') {
        console.error("ERROR CRÍTICO: GameStateClass no encontrado. ¿game-state.js cargó bien?");
        return;
    }

    // 2. Crear instancia
    GS = new window.GameStateClass();

    // 3. Cargar Guardado
    const saved = localStorage.getItem('wolfy_world_save_v6');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            GS.loadFromSave(data);
        } catch(e) { 
            console.error("Error cargando save", e); 
        }
    } else {
        // Primer arranque: dar monedas iniciales para probar
        GS.initUser("Invitado", 100, 10);
    }

    // 4. Renderizar UI
    renderAccountUI();
    renderSongs();
    setupBindings();
    updateMenuUI();
}

// --- GUARDADO AUTOMÁTICO ---
function saveGame() {
    if (!GS) return;
    localStorage.setItem('wolfy_world_save_v6', JSON.stringify(GS.toSave()));
}

// --- UI HELPERS ---
function el(id){ return document.getElementById(id); }

function showToast(msg, type="info") {
    console.log(`[${type.toUpperCase()}] ${msg}`);
    // Opcional: Alerta visual simple si no hay toast container
    if(type === 'error') alert(msg);
}

// --- ACCOUNT & BALANCES ---
function renderAccountUI() {
    const box = el('account-ui');
    if(!box) return;
    
    box.innerHTML = `
        <div class="account-box">
            <strong>${GS.profileName}</strong>
            <button id="logout-btn" class="secondary btn-xs">Resetear Perfil</button>
        </div>
    `;
    
    const logoutBtn = el('logout-btn');
    if(logoutBtn) {
        logoutBtn.onclick = () => {
            if(confirm("¿Borrar progreso local?")) {
                localStorage.removeItem('wolfy_world_save_v6');
                location.reload();
            }
        };
    }
    
    renderBalances();
    renderCollection();
}

function renderBalances() {
    const tEl = el('tokens');
    const sEl = el('shards');
    if(tEl) tEl.textContent = GS.tokens;
    if(sEl) sEl.textContent = GS.shards;
}

// --- COLECCIÓN DE CARTAS (GESTIÓN ROBUSTA) ---
function renderCollection() {
    const grid = el('collection');
    if(!grid) return;
    
    grid.innerHTML = '';
    
    const ownedIds = Object.keys(GS.cardInventory);
    if(ownedIds.length === 0) {
        grid.innerHTML = '<div class="small empty-msg">No tienes cartas. ¡Abre paquetes!</div>';
        return;
    }

    let totalPower = 0;

    ownedIds.forEach(id => {
        const record = GS.getCardRecord(id);
        const catalogEntry = CARD_MAP[id]; 
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
                <strong class="card-title">${catalogEntry.displayName}</strong>
                <span class="badge rank-badge-${record.rank}">${record.rank} L.${record.level}</span>
            </div>
            <div class="small">Pow: ${power} | Dupes: ${record.count - 1}</div>
            <div class="card-actions-row">
                <button data-action="equip" data-id="${id}" class="${isEquipped?'secondary':'primary-btn'} btn-xs">
                    ${isEquipped ? "❌ Quitar" : "✅ Equipar"}
                </button>
                <button data-action="feed" data-id="${id}" class="secondary btn-xs feed-btn" title="Alimentar">🍽️</button>
                ${canUpgrade ? `<button data-action="upgrade" data-id="${id}" class="chromo-btn btn-xs upgrade-btn" title="Subir Rango">⬆️</button>` : ''}
            </div>
        `;
        grid.appendChild(cardDiv);
    });

    const tpEl = el('total-power-display');
    const ecEl = el('equip-count');
    if(tpEl) tpEl.innerText = totalPower;
    if(ecEl) ecEl.innerText = GS.equippedCards.length;
}

// Delegación de eventos en la colección (UNA SOLA VEZ, EN EL PADRE)
// Esto evita problemas si renderCollection limpia el innerHTML frecuentemente
if (el('collection')) {
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
}

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
    
    const lastDraw = el('last-draw');
    if(lastDraw) {
        lastDraw.innerHTML = res.cards.map(c => 
            `<span class="${c.isNew ? 'text-green' : 'text-gray'}">${c.name} [${c.rank}]</span>`
        ).join('<br>');
    }
    
    logPack(`Abriste ${res.packName}: ${res.cards.length} cartas.`);
}

// --- FEED MODAL LOGIC ---
let feedTargetId = null;
let selectedFoodIds = new Set();

function openFeedModal(targetId) {
    feedTargetId = targetId;
    selectedFoodIds.clear();
    
    const targetCatalog = CARD_MAP[targetId];
    const nameEl = el('feed-target-name');
    if(nameEl) nameEl.innerText = targetCatalog?.displayName || targetId;
    
    const list = el('food-selection-list');
    if(!list) return;
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

    const modal = el('feed-modal');
    if(modal) modal.classList.remove('hidden');
}

// Conectar botones del modal (verificando existencia)
const cancelBtn = el('btn-feed-cancel');
if(cancelBtn) {
    cancelBtn.onclick = () => {
        el('feed-modal').classList.add('hidden');
        feedTargetId = null;
    };
}

const confirmBtn = el('btn-feed-confirm');
if(confirmBtn) {
    confirmBtn.onclick = () => {
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
}

// --- SONG SELECTOR ---
function renderSongs() {
    const sel = el('song-select');
    if(!sel) return;
    
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
            const audio = el('song-audio');
            if(audio) {
                audio.src = song.src;
                audio.load();
            }
        }
    };
    
    if(SONG_LIST.length > 0) {
        sel.value = SONG_LIST[0].id;
        sel.dispatchEvent(new Event('change'));
    }
}

// --- BINDINGS FINALES (CONEXIÓN DIRECTA Y SEGURA) ---
function setupBindings() {
    // Pack Button
    const packBtn = el('open-pack');
    if(packBtn) {
        packBtn.onclick = () => {
            const type = el('pack-type').value;
            openPack(type);
        };
    }

    // Rhythm Start
    const startBtn = el('rg-start');
    if(startBtn) {
        startBtn.onclick = async () => {
            const song = getCurrentSongData();
            if(!song) return;

            const chartPath = `charts/${song.id}.json`;
            
            // Intentar cargar chart
            const loaded = await window.RhythmEngine.loadChart(chartPath);
            
            if(!loaded) {
                showToast("No se encontró chart. Usa demo1 o crea el JSON.", "error");
                return; 
            }

            window.RhythmEngine.start(song, getDifficulty());
            
            // Actualizar UI botones
            const stopBtn = el('rg-stop');
            if(stopBtn) stopBtn.disabled = false;
            startBtn.disabled = true;
        };
    }

    // Rhythm Stop
    const stopBtn = el('rg-stop');
    if(stopBtn) {
        stopBtn.onclick = () => {
            window.RhythmEngine.stop();
            stopBtn.disabled = true;
            if(startBtn) startBtn.disabled = false;
        };
    }

    // ⭐ WOLFY HELPER BUTTON (LA CORRECCIÓN CLAVE) ⭐
    const helperBtn = el('wolfy-helper-btn');
    if(helperBtn) {
        // Estado inicial
        let isHelperOn = false;
        
        // Función para actualizar texto/clase
        const updateHelperUI = () => {
            if(isHelperOn) {
                helperBtn.textContent = "🐺 Helper: ON";
                helperBtn.classList.add('active');
                helperBtn.classList.remove('secondary');
            } else {
                helperBtn.textContent = "🐺 Wolfy Helper";
                helperBtn.classList.remove('active');
                helperBtn.classList.add('secondary');
            }
        };

        // Click Handler
        helperBtn.onclick = () => {
            isHelperOn = !isHelperOn;
            
            // Llamar a la API del motor
            if(window.RhythmEngine && typeof window.RhythmEngine.setHelperMode === 'function') {
                window.RhythmEngine.setHelperMode(isHelperOn);
            } else {
                console.warn("RhythmEngine no listo aún.");
            }
            
            updateHelperUI();
        };
        
        // Asegurar UI correcta al inicio
        updateHelperUI();
    } else {
        console.error("ERROR: No se encontró #wolfy-helper-btn en el HTML.");
    }

        // ... código existente ...

    // ⭐ NUEVO: BINDING PARA FOODY CHAOS ⭐
    const foodyBtn = document.querySelector('[data-module="foody"]');
    if(foodyBtn) {
        foodyBtn.onclick = () => {
            // Abrir Modal Fullscreen
            const modal = document.getElementById('foody-fullscreen-modal');
            if(modal) {
                modal.classList.remove('hidden');
                
                // Inicializar Motor si no está hecho
                if(window.FoodyEngine && GS) {
                    // Limpiar contenedor previo
                    const container = document.getElementById('foody-canvas-container');
                    if(container) container.innerHTML = '';
                    
                    // Iniciar
                    window.FoodyEngine.init(GS, 'foody-canvas-container');
                    window.FoodyAPI.startGame();
                    
                    // Renderizar HUD inicial
                    renderFoodyHUD();
                }
            }
        };
    }

    const fdCloseBtn = document.getElementById('fd-close-btn');
    if(fdCloseBtn) {
        fdCloseBtn.onclick = () => {
            document.getElementById('foody-fullscreen-modal').classList.add('hidden');
            window.FoodyAPI.stopGame();
        };
    }
}

function getCurrentSongData() {
    const id = el('song-select')?.value;
    return SONG_LIST.find(s => s.id === id) || SONG_LIST[0];
}

function getDifficulty() {
    return el('difficulty')?.value || 'normal';
}

function updateMenuUI() {
    renderBalances();
    renderCollection();
}

function logPack(text) {
    const node = document.createElement('div');
    node.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
    const logContainer = el('pack-log');
    if(logContainer) logContainer.prepend(node);
}

function renderFoodyHUD() {
    const hudList = document.getElementById('team-hud-list');
    if(!hudList) return;
    hudList.innerHTML = '';
    
    // Acceder a los stats internos del motor (hack temporal para demo)
    // Idealmente, FoodyEngine debería exponer getTeamStats()
    // Como es IIFE cerrada, simulamos leyendo desde GS directamente para el HUD statico
    // Nota: Esto no refleja el "currentLoad" en tiempo real sin reescribir el getter, 
    // pero sirve para mostrar quiénes están en el equipo.
    
    if(!GS) return;
    
    GS.equippedCards.forEach(id => {
        const rec = GS.getCardRecord(id);
        const cat = CARD_MAP[id];
        const power = GS.calculateCardPower(id);
        
        const div = document.createElement('div');
        div.className = 'team-member-card';
        div.style.borderLeftColor = getRankColor(rec.rank); // Usa la func local o repítela
        
        div.innerHTML = `
            <strong style="font-size:0.8em">${cat ? cat.displayName.split('[')[0] : id}</strong>
            <div class="small">Capacidad: ~${10 + RANK_ORDER.indexOf(rec.rank)*10}kg</div>
            <div class="bar-bg"><div class="bar-fill" style="width: 0%"></div></div>
        `;
        hudList.appendChild(div);
    });
}

// Helper duplicado local para evitar scope issues rápidos
function getRankColor(rank) {
    const colors = { 'B':'#9fb8ff', 'A':'#7fffb1', 'S':'#ffd57f', 'R':'#ff9fb2', 'XR':'#c97fff', 'UR':'#ffad4a', 'MR':'#ffd700' };
    return colors[rank] || '#fff';
}

// --- EXPOSE API FOR RHYTHM ENGINE ---
window.AppAPI = {
    addScore(s){ 
        const elSc = el('rg-score');
        if(elSc) elSc.textContent = s; 
    },
    setCombo(c){ 
        const elCb = el('rg-combo');
        if(elCb) elCb.textContent = c; 
    },
    setAcc(a){ 
        const elAc = el('rg-acc');
        if(elAc) elAc.textContent = `${Math.round(a*100)}%`; 
    },
    setPower(p){ 
        const elPw = el('rg-power');
        if(elPw) elPw.textContent = `x${p.toFixed(1)}`; 
    },
    onGameEnd(results) {
        let shardsEarned = 0;
        if (results.rank === "S+" || results.rank === "S") shardsEarned = 10;
        else if (results.rank === "A") shardsEarned = 5;
        else if (results.rank === "B") shardsEarned = 2;
        else shardsEarned = 1;
        
        GS.shards += shardsEarned;
        GS.applyXpToCards(Math.floor(results.score / 20)); 
        
        const songId = results.songId;
        if(!GS.rhythmStats.bestScores[songId] || results.score > GS.rhythmStats.bestScores[songId]) {
            GS.rhythmStats.bestScores[songId] = results.score;
        }
        GS.rhythmStats.plays++;
        
        saveGame();
        renderBalances();
        renderCollection();
        
        const resBox = el('moon-results');
        if(resBox) {
            resBox.innerHTML = `
                <h3>Rango: ${results.rank}</h3>
                <p>Score: ${results.score} | Combo: ${results.maxCombo}</p>
                <p>Recompensa: +${shardsEarned} 💎 Shards</p>
            `;
            resBox.classList.remove('hidden');
        }
    }
};

// Arrancar todo cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
