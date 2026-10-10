/**
 * WOLFY WORLD - MAIN CONTROLLER
 * Une GameState, NetworkManager y la Interfaz de Usuario (DOM).
 */

const App = {
    state: null,
    net: null,
    ui: {},
    mining: { active: false, interval: null, pos: 0, dir: 1 },

    init() {
        // 1. Instanciar Módulos
        this.state = new GameState();
        this.net = new NetworkManager(this.state);
        
        // 2. Cachear Elementos DOM importantes
        this.cacheDOM();
        
        // 3. Configurar Callbacks de Red
        this.net.onUpdateCallback = () => this.renderGame();
        
        // 4. Bind Eventos de UI
        this.bindEvents();
        
        // 5. Renderizar tiendas iniciales (vacías hasta entrar)
        this.renderBookShop();
    },

    cacheDOM() {
        this.ui.loginScreen = document.getElementById('login-screen');
        this.ui.gameScreen = document.getElementById('game-screen');
        this.ui.statusMsg = document.getElementById('status-msg');
        this.ui.loader = document.getElementById('loader');
        this.ui.gameContainer = document.getElementById('game-container');
        this.ui.miningUi = document.getElementById('mining-ui');
        this.ui.cursorLine = document.getElementById('cursor-line');
        this.ui.btnMine = document.getElementById('btn-mine-action');
        
        // Botones de acción directa
        this.ui.btnSellAll = document.getElementById('btn-sell-all');
        this.ui.btnBuyTraining = document.getElementById('btn-buy-training');
        this.ui.btnBuyIron = document.getElementById('btn-buy-iron');
        this.ui.btnBuySteel = document.getElementById('btn-buy-steel');
        
        // Botones de Cromos
        this.ui.btnPackSmall = document.getElementById('btn-pack-small');
        this.ui.btnPackBasic = document.getElementById('btn-pack-basic');
        this.ui.btnPackLarge = document.getElementById('btn-pack-large');
    },

    bindEvents() {
        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target.dataset.target;
                this.switchTab(target);
            });
        });

        // Movimiento en área de juego
        this.ui.gameContainer.addEventListener('click', (e) => {
            this.handleMove(e);
        });

        // Minería
        this.ui.btnMine.addEventListener('click', () => this.toggleMining());
        document.getElementById('mining-bar').addEventListener('click', () => this.stopMining());

        // Tienda Palas
        this.ui.btnBuyTraining.addEventListener('click', () => this.buyShovel('training'));
        this.ui.btnBuyIron.addEventListener('click', () => this.buyShovel('iron'));
        this.ui.btnBuySteel.addEventListener('click', () => this.buyShovel('steel'));
        this.ui.btnSellAll.addEventListener('click', () => this.sellAllTreasures());

        // Cromos
        this.ui.btnPackSmall.addEventListener('click', () => this.openChromoPack('small'));
        this.ui.btnPackBasic.addEventListener('click', () => this.openChromoPack('basic'));
        this.ui.btnPackLarge.addEventListener('click', () => this.openChromoPack('large'));
    },

    // --- FLUJO DE INICIO ---
    createRoom() {
        const name = document.getElementById('username').value.trim();
        const code = document.getElementById('room-code').value.trim().toUpperCase();
        if(!name || !code) return this.setStatus("Faltan datos", true);
        
        this.showLoader(true);
        this.setStatus("Creando sala...");
        
        this.net.connectAsHost(code, name, 
            () => { this.showLoader(false); this.startGameLoop(); }, 
            (e) => { this.showLoader(false); this.setStatus("Error: "+e, true); }
        );
    },

    joinRoom() {
        const name = document.getElementById('username').value.trim();
        const code = document.getElementById('room-code').value.trim().toUpperCase();
        if(!name || !code) return this.setStatus("Faltan datos", true);
        
        this.showLoader(true);
        this.setStatus("Buscando sala...");
        
        this.net.connectAsClient(code, name,
            () => { this.showLoader(false); this.startGameLoop(); }, 
            (e) => { this.showLoader(false); this.setStatus(e, true); }
        );
    },

    startGameLoop() {
        this.ui.loginScreen.classList.remove('active');
        this.ui.gameScreen.classList.add('active');
        this.ui.miningUi.style.display = 'block';
        document.getElementById('current-room-display').innerText = this.state.roomCode;
        
        this.renderGame();
    },

    // --- UTILIDADES UI ---
    showLoader(show) { this.ui.loader.style.display = show ? 'block' : 'none'; },
    
    setStatus(msg, isError = false) {
        this.ui.statusMsg.innerText = msg;
        this.ui.statusMsg.style.color = isError ? '#e74c3c' : '#2ecc71';
    },

    switchTab(tabName) {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active-tab-content'));
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active-tab'));
        
        document.getElementById(`tab-${tabName}`).classList.add('active-tab-content');
        
        // Activar botón correcto
        const btns = document.querySelectorAll('.tab-btn');
        if(tabName === 'mining') btns[0].classList.add('active-tab');
        if(tabName === 'library') btns[1].classList.add('active-tab');
        if(tabName === 'chromos') btns[2].classList.add('active-tab');
    },

    // --- LÓGICA DE JUEGO (DELEGADA A STATE/NET) ---
    handleMove(e) {
        if(this.mining.active) return; 
        
        const rect = this.ui.gameContainer.getBoundingClientRect();
        let x = e.clientX - rect.left - 20;
        let y = e.clientY - rect.top - 20;
        
        // Límites
        x = Math.max(0, Math.min(x, rect.width - 40));
        y = Math.max(0, Math.min(y, rect.height - 40));

        this.state.updateMyPosition(x, y);
        this.net.sendToHostOrBroadcast({ type: 'MOVE', player: this.state.getLocalPlayer() });
        this.renderGame(); 
    },

    toggleMining() {
        if(this.mining.active) this.stopMining();
        else this.startMining();
    },

    startMining() {
        this.mining.active = true;
        this.mining.pos = 0;
        this.mining.dir = 1;
        this.ui.btnMine.innerText = "❌ Detener";
        
        this.mining.interval = setInterval(() => {
            this.mining.pos += 4 * this.mining.dir;
            if(this.mining.pos > 296 || this.mining.pos < 0) this.mining.dir *= -1;
            this.ui.cursorLine.style.left = this.mining.pos + 'px';
        }, 16);
    },

    stopMining() {
        clearInterval(this.mining.interval);
        this.mining.active = false;
        this.ui.btnMine.innerText = "⛏️ Empezar a Excavar";
        
        // Zona verde: 120 a 180
        if(this.mining.pos >= 120 && this.mining.pos <= 180) {
            const loot = this.state.mineTreasure();
            alert(`¡Encontraste ${loot.name}! (+${loot.val} PE)`);
        } else {
            alert("Fallaste... Tierra dura.");
        }
        this.renderGame();
    },

    sellAllTreasures() {
        const res = this.state.sellInventory();
        if(res.money > 0) {
            alert(`Vendiste todo por ${res.money} PE.`);
            this.net.sendToHostOrBroadcast({ type: 'STATS_UPDATE', player: this.state.getLocalPlayer() });
            this.renderGame();
        } else {
            alert("No tienes nada que vender.");
        }
    },

    buyShovel(type) {
        if(this.state.buyShovel(type)) {
            alert(`Compraste pala: ${SHOVEL_DATA[type].name}`);
            this.renderGame();
        } else {
            alert("Dinero insuficiente.");
        }
    },

    purchaseBook(id) {
        if(this.state.buyBook(id)) {
            alert("¡Libro comprado! XP añadida.");
            this.renderBookShop(); 
            this.renderOwnedBooks();
            this.renderGame(); 
        } else {
            alert("No tienes suficientes BiblioTokens o ya lo tienes.");
        }
    },

    openChromoPack(type) {
        const results = this.state.openChromoPack(type);
        if(results) {
            alert(`¡Has abierto un paquete! Obtuviste ${results.length} páginas.`);
            this.renderChromoInventory();
            this.renderGame(); 
        } else {
            alert("No tienes suficientes BiblioTokens.");
        }
    },

    // --- RENDERIZADO ESPECÍFICO ---
    renderBookShop() {
        const container = document.getElementById('book-shop');
        container.innerHTML = '';
        BOOK_CATALOG.forEach(book => {
            const card = document.createElement('div');
            card.className = 'shop-card';
            const owned = this.state.ownedBooks.includes(book.id);
            const rarityClass = `rarity-${book.rarity}`;
            
            card.innerHTML = `
                <h4>${book.title}</h4>
                <p class="${rarityClass}">${book.rarity.toUpperCase()}</p>
                <p>${book.pages} Págs | +${book.xpReward} XP</p>
                <p>Precio: ${book.costBT} BT</p>
                <button class="library-btn" ${owned ? 'disabled style="opacity:0.5"' : ''}>
                    ${owned ? '✔ Comprado' : 'Comprar'}
                </button>
            `;
            
            // Adjuntar evento al botón generado dinámicamente
            const btn = card.querySelector('button');
            if(!owned) {
                btn.onclick = () => this.purchaseBook(book.id);
            }
            
            container.appendChild(card);
        });
    },

    renderOwnedBooks() {
        const list = document.getElementById('owned-books-list');
        list.innerHTML = '';
        if(this.state.ownedBooks.length === 0) {
            list.innerHTML = '<li>No posees libros aún.</li>';
            return;
        }
        this.state.ownedBooks.forEach(bid => {
            const book = BOOK_CATALOG.find(b => b.id === bid);
            if(book) {
                const li = document.createElement('li');
                li.innerHTML = `<span>📖 ${book.title}</span> <span class="stat-val">+${book.xpReward} XP</span>`;
                list.appendChild(li);
            }
        });
    },

    renderChromoInventory() {
        const list = document.getElementById('chromo-inventory');
        list.innerHTML = '';
        if(this.state.chromoInventory.length === 0) {
            list.innerHTML = '<li>Sin cromos recientes.</li>';
            return;
        }
        this.state.chromoInventory.slice(0, 10).forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `<span>🃏 Página de: ${item.title}</span> <span style="font-size:0.8em; color:#aaa;">(${item.rarity})</span>`;
            list.appendChild(li);
        });
    },

    // --- RENDER GLOBAL (LLAMADO FRECUENTEMENTE) ---
    renderGame() {
        // 1. Dibujar Jugadores (Solo si estamos en tab minería para ahorrar recursos, 
        // aunque en este caso siempre dibujamos porque el contenedor está oculto/mostrado por CSS)
        this.ui.gameContainer.innerHTML = '';
        const players = this.state.getAllPlayers();
        document.getElementById('player-count').innerText = players.length;

        players.forEach(p => {
            const dot = document.createElement('div');
            dot.className = 'player-dot';
            dot.style.left = p.x + 'px';
            dot.style.top = p.y + 'px';
            dot.style.background = p.color;
            dot.innerText = "🐺";
            
            const label = document.createElement('div');
            label.className = 'player-name';
            label.innerText = p.name + (p.id === this.state.myId ? " (Tú)" : "");
            dot.appendChild(label);
            this.ui.gameContainer.appendChild(dot);
        });

        // 2. Actualizar Stats Header
        const me = this.state.getLocalPlayer();
        if(me) {
            document.getElementById('ui-money').innerText = me.money;
            document.getElementById('ui-bt').innerText = this.state.biblioTokens;
            document.getElementById('ui-shovel').innerText = SHOVEL_DATA[me.shovel].name;
            
            // XP Display
            const xpNeededForNextLevel = (this.state.level * 1000) - ((this.state.level - 1) * 1000); // Simplificado: 1000 por nivel
            const currentLevelProgress = this.state.xp % 1000;
            document.getElementById('ui-xp-text').innerText = `${currentLevelProgress}/1000`;
            document.getElementById('ui-xp-bar').style.width = `${(currentLevelProgress / 1000) * 100}%`;
        }

        // 3. Actualizar Inventarios Locales
        const invList = document.getElementById('inventory-treasures');
        invList.innerHTML = '';
        if(me && me.inventory.length > 0) {
            me.inventory.forEach(item => {
                const li = document.createElement('li');
                li.innerText = `${item.name}: ${item.val} PE`;
                invList.appendChild(li);
            });
        } else {
            invList.innerHTML = '<li>Inventario vacío</li>';
        }
        
        // Refrescar listas de librería/cromos si están visibles (opcional, pero bueno para consistencia)
        if(document.getElementById('tab-library').classList.contains('active-tab-content')) {
             this.renderOwnedBooks();
        }
        if(document.getElementById('tab-chromos').classList.contains('active-tab-content')) {
             this.renderChromoInventory();
        }
    }
};

// Inicializar al cargar la página
window.addEventListener('DOMContentLoaded', () => {
    App.init();
});
