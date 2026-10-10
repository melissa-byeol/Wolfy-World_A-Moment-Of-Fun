/**
 * WOLFY WORLD - MAIN CONTROLLER (With Toast Notifications)
 */

const App = {
    state: null,
    net: null,
    ui: {},
    mining: { active: false, interval: null, pos: 0, dir: 1 },
    toastContainer: null, // Referencia al DOM

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    },

    setup() {
        console.log("Wolfy World Iniciando...");
        
        // Instanciar Módulos
        this.state = new GameState();
        this.net = new NetworkManager(this.state);
        
        // Cachear DOM
        this.cacheDOM();
        
        // Configurar Red
        this.net.onUpdateCallback = () => this.renderGame();
        
        // Bind Eventos
        this.bindEvents();
        
        // Render inicial
        this.renderBookShop();
        console.log("Setup Completado.");
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
        
        // Botones Login
        this.ui.btnCreateRoom = document.getElementById('btn-create-room');
        this.ui.btnJoinRoom = document.getElementById('btn-join-room');
        
        // Botones Acción Directa
        this.ui.btnSellAll = document.getElementById('btn-sell-all');
        this.ui.btnBuyTraining = document.getElementById('btn-buy-training');
        this.ui.btnBuyIron = document.getElementById('btn-buy-iron');
        this.ui.btnBuySteel = document.getElementById('btn-buy-steel');
        
        // Botones Cromos
        this.ui.btnPackSmall = document.getElementById('btn-pack-small');
        this.ui.btnPackBasic = document.getElementById('btn-pack-basic');
        this.ui.btnPackLarge = document.getElementById('btn-pack-large');

        // Toast Container
        this.toastContainer = document.getElementById('toast-container');
    },

    bindEvents() {
        // --- LOGIN BUTTONS ---
        if(this.ui.btnCreateRoom) {
            this.ui.btnCreateRoom.addEventListener('click', () => this.createRoom());
        }
        if(this.ui.btnJoinRoom) {
            this.ui.btnJoinRoom.addEventListener('click', () => this.joinRoom());
        }

        // --- TABS ---
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target.dataset.target;
                this.switchTab(target);
            });
        });

        // --- MOVIMIENTO JUEGO ---
        if(this.ui.gameContainer) {
            this.ui.gameContainer.addEventListener('click', (e) => {
                this.handleMove(e);
            });
        }

        // --- MINERÍA ---
        if(this.ui.btnMine) {
            this.ui.btnMine.addEventListener('click', () => this.toggleMining());
        }
        const miningBar = document.getElementById('mining-bar');
        if(miningBar) {
            miningBar.addEventListener('click', () => this.stopMining());
        }

        // --- TIENDA PALAS ---
        if(this.ui.btnBuyTraining) this.ui.btnBuyTraining.addEventListener('click', () => this.buyShovel('training'));
        if(this.ui.btnBuyIron) this.ui.btnBuyIron.addEventListener('click', () => this.buyShovel('iron'));
        if(this.ui.btnBuySteel) this.ui.btnBuySteel.addEventListener('click', () => this.buyShovel('steel'));
        if(this.ui.btnSellAll) this.ui.btnSellAll.addEventListener('click', () => this.sellAllTreasures());

        // --- CROMOS ---
        if(this.ui.btnPackSmall) this.ui.btnPackSmall.addEventListener('click', () => this.openChromoPack('small'));
        if(this.ui.btnPackBasic) this.ui.btnPackBasic.addEventListener('click', () => this.openChromoPack('basic'));
        if(this.ui.btnPackLarge) this.ui.btnPackLarge.addEventListener('click', () => this.openChromoPack('large'));
    },

    // --- NUEVO SISTEMA DE NOTIFICACIONES ---
    showToast(message, type = 'info', duration = 3000) {
        if (!this.toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        // Icono simple basado en tipo
        let icon = "ℹ️";
        if(type === 'success') icon = "✅";
        if(type === 'error') icon = "❌";
        if(type === 'loot') icon = "💎";

        toast.innerHTML = `<span>${icon}</span> <span style="flex-grow:1; margin-left:8px;">${message}</span>`;
        
        this.toastContainer.appendChild(toast);

        // Remover automáticamente tras la duración + animación de salida
        setTimeout(() => {
            if(toast.parentNode) {
                toast.remove();
            }
        }, duration + 500); // Sumamos tiempo extra para la animación fadeOut
    },

    // --- FLUJO DE INICIO ---
    createRoom() {
        const name = document.getElementById('username').value.trim();
        const code = document.getElementById('room-code').value.trim().toUpperCase();
        if(!name || !code) return this.showToast("Faltan datos", "error");
        
        this.showLoader(true);
        this.setStatus("Creando sala...", false);
        
        this.net.connectAsHost(code, name, 
            () => { 
                this.showLoader(false); 
                this.startGameLoop(); 
                this.showToast(`Sala ${code} creada correctamente`, "success");
            }, 
            (e) => { 
                this.showLoader(false); 
                this.showToast("Error al crear sala: " + e, "error"); 
            }
        );
    },

    joinRoom() {
        const name = document.getElementById('username').value.trim();
        const code = document.getElementById('room-code').value.trim().toUpperCase();
        if(!name || !code) return this.showToast("Faltan datos", "error");
        
        this.showLoader(true);
        this.setStatus("Buscando sala...", false);
        
        this.net.connectAsClient(code, name,
            () => { 
                this.showLoader(false); 
                this.startGameLoop(); 
                this.showToast(`Te has unido a la sala ${code}`, "success");
            }, 
            (e) => { 
                this.showLoader(false); 
                this.showToast(e, "error"); 
            }
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
    showLoader(show) { 
        if(this.ui.loader) this.ui.loader.style.display = show ? 'block' : 'none'; 
    },
    
    setStatus(msg, isError = false) {
        if(this.ui.statusMsg) {
            this.ui.statusMsg.innerText = msg;
            this.ui.statusMsg.style.color = isError ? '#e74c3c' : '#2ecc71';
        }
    },

    switchTab(tabName) {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active-tab-content'));
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active-tab'));
        
        const content = document.getElementById(`tab-${tabName}`);
        if(content) content.classList.add('active-tab-content');
        
        const btns = document.querySelectorAll('.tab-btn');
        btns.forEach(b => {
            if(b.dataset.target === tabName) b.classList.add('active-tab');
        });
    },

    // --- LÓGICA DE JUEGO (Sin Alerts) ---
    handleMove(e) {
        if(this.mining.active) return; 
        
        const rect = this.ui.gameContainer.getBoundingClientRect();
        let x = e.clientX - rect.left - 20;
        let y = e.clientY - rect.top - 20;
        
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
            // ¡Notificación elegante!
            this.showToast(`¡Encontraste ${loot.name}! (+${loot.val} PE)`, "loot");
        } else {
            this.showToast("Fallaste... Tierra dura.", "error");
        }
        this.renderGame();
    },

    sellAllTreasures() {
        const res = this.state.sellInventory();
        if(res.money > 0) {
            this.showToast(`Vendiste todo por ${res.money} PE.`, "success");
            this.net.sendToHostOrBroadcast({ type: 'STATS_UPDATE', player: this.state.getLocalPlayer() });
            this.renderGame();
        } else {
            this.showToast("No tienes nada que vender.", "info");
        }
    },

    buyShovel(type) {
        if(this.state.buyShovel(type)) {
            this.showToast(`Compraste pala: ${SHOVEL_DATA[type].name}`, "success");
            this.renderGame();
        } else {
            this.showToast("Dinero insuficiente.", "error");
        }
    },

    purchaseBook(id) {
        if(this.state.buyBook(id)) {
            this.showToast("¡Libro comprado! XP añadida.", "success");
            this.renderBookShop(); 
            this.renderOwnedBooks();
            this.renderGame(); 
        } else {
            this.showToast("No tienes suficientes BiblioTokens o ya lo tienes.", "error");
        }
    },

    openChromoPack(type) {
        const results = this.state.openChromoPack(type);
        if(results) {
            this.showToast(`¡Paquete abierto! Obtuviste ${results.length} páginas.`, "loot");
            this.renderChromoInventory();
            this.renderGame(); 
        } else {
            this.showToast("No tienes suficientes BiblioTokens.", "error");
        }
    },

    // --- RENDERIZADO ESPECÍFICO ---
    renderBookShop() {
        const container = document.getElementById('book-shop');
        if(!container) return;
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
            
            const btn = card.querySelector('button');
            if(!owned) {
                btn.onclick = () => this.purchaseBook(book.id);
            }
            
            container.appendChild(card);
        });
    },

    renderOwnedBooks() {
        const list = document.getElementById('owned-books-list');
        if(!list) return;
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
        if(!list) return;
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

    // --- RENDER GLOBAL ---
    renderGame() {
        // 1. Dibujar Jugadores
        if(this.ui.gameContainer) {
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
        }

        // 2. Actualizar Stats Header
        const me = this.state.getLocalPlayer();
        if(me) {
            document.getElementById('ui-money').innerText = me.money;
            document.getElementById('ui-bt').innerText = this.state.biblioTokens;
            document.getElementById('ui-shovel').innerText = SHOVEL_DATA[me.shovel].name;
            
            const currentLevelProgress = this.state.xp % 1000;
            document.getElementById('ui-xp-text').innerText = `${currentLevelProgress}/1000`;
            document.getElementById('ui-xp-bar').style.width = `${(currentLevelProgress / 1000) * 100}%`;
        }

        // 3. Actualizar Inventarios Locales
        const invList = document.getElementById('inventory-treasures');
        if(invList) {
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
        }
        
        // Refrescar listas secundarias
        if(document.getElementById('tab-library').classList.contains('active-tab-content')) {
             this.renderOwnedBooks();
        }
        if(document.getElementById('tab-chromos').classList.contains('active-tab-content')) {
             this.renderChromoInventory();
        }
    }
};

// Lanzar la aplicación
App.init();
