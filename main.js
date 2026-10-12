/**
 * WOLFY WORLD - MAIN CONTROLLER v5
 * Integración Total: Feed System, Sobres Premium & Gestión Dinámica
 */

const App = {
    state: null,
    net: null,
    rhythm: null,
    ui: {},
    mining: { active: false, interval: null, pos: 0, dir: 1 },
    currentScreen: "boot-screen",
    autoSaveTimer: null,
    shopTab: "chromos",
    
    // Estado del Modal de Alimentación
    feedTargetId: null, 
    selectedFoodIds: new Set(), 

        init() {
        this.state = new GameState();
        this.net = new NetworkManager(this.state);

        this.cacheDOM();
        this.bindEvents();
        this.boot();
            
        }
    },
    
       cacheDOM() {
        // --- BOOT ---
        this.ui.bootScreen = document.getElementById("boot-screen");
        this.ui.bootFill = document.getElementById("boot-fill");
        this.ui.bootStatus = document.getElementById("boot-status");
        this.ui.savePrompt = document.getElementById("save-prompt");
        this.ui.bootName = document.getElementById("boot-name");

        // --- MENU ---
        this.ui.menuScreen = document.getElementById("menu-screen");
        this.ui.menuName = document.getElementById("menu-name");
        this.ui.menuMoney = document.getElementById("menu-money");
        this.ui.menuBt = document.getElementById("menu-bt");
        this.ui.menuXp = document.getElementById("menu-xp");
        this.ui.menuLevel = document.getElementById("menu-level");
        this.ui.menuShards = document.getElementById("menu-shards"); // NUEVO

        // --- DIG ---
        this.ui.digScreen = document.getElementById("dig-screen");
        this.ui.digLobby = document.getElementById("dig-lobby");
        this.ui.digGame = document.getElementById("dig-game");
        this.ui.digUsername = document.getElementById("dig-username");
        this.ui.digRoom = document.getElementById("dig-room");
        this.ui.digStatus = document.getElementById("dig-status");
        this.ui.digLoader = document.getElementById("dig-loader");
        this.ui.gameContainer = document.getElementById("game-container");
        this.ui.miningUi = document.getElementById("mining-ui");
        this.ui.miningBar = document.getElementById("mining-bar");
        this.ui.cursorLine = document.getElementById("cursor-line");
        this.ui.btnMine = document.getElementById("btn-mine-action");

        // --- SHOP ---
        this.ui.shopScreen = document.getElementById("shop-screen");
        this.ui.shopChromos = document.getElementById("shop-chromos");
        this.ui.shopCards = document.getElementById("shop-cards");
        this.ui.lastPackResult = document.getElementById("last-pack-result"); // NUEVO

        // --- LIBRARY ---
        this.ui.libraryScreen = document.getElementById("library-screen");
        this.ui.collectionSelector = document.getElementById("collection-selector");
        this.ui.bookList = document.getElementById("book-list");

        // ⭐⭐⭐ CARDS MANAGEMENT (LO QUE FALTABA) ⭐⭐⭐
        this.ui.cardsScreen = document.getElementById("cards-screen");
        this.ui.myCardsGrid = document.getElementById("my-cards-grid"); // CRÍTICO PARA EL CLICK
        this.ui.totalPowerDisplay = document.getElementById("total-power-display");
        this.ui.cardShardsDisplay = document.getElementById("card-shards-display");

        // FEED MODAL ELEMENTS
        this.ui.feedModal = document.getElementById("feed-modal");
        this.ui.feedTargetName = document.getElementById("feed-target-name");
        this.ui.foodSelectionList = document.getElementById("food-selection-list");
        this.ui.btnFeedConfirm = document.getElementById("btn-feed-confirm");
        this.ui.btnFeedCancel = document.getElementById("btn-feed-cancel");

        // --- MOONLIGHT ---
        this.ui.moonScreen = document.getElementById("moonlight-screen");
        this.ui.moonCanvas = document.getElementById("moon-canvas");
        this.ui.moonAudio = document.getElementById("moon-audio");
        this.ui.btnMoonStart = document.getElementById("btn-moon-start");
        this.ui.moonBest = document.getElementById("moon-best");
        this.ui.moonPlays = document.getElementById("moon-plays");
        this.ui.moonResults = document.getElementById("moon-results");
        this.ui.moonEquipped = document.getElementById("moon-equipped");
        this.ui.equipCount = document.getElementById("equip-count"); // NUEVO

        // --- TOAST ---
        this.ui.toastContainer = document.getElementById("toast-container");
    },

        bindEvents() {
        // --- BOOT ---
        document.getElementById("btn-save-yes").addEventListener("click", () => {
            const name = this.ui.bootName.value.trim() || "Lobo Invitado";
            this.createNewSave(name);
        });
        document.getElementById("btn-save-no").addEventListener("click", () => {
            const name = this.ui.bootName.value.trim() || "Lobo Invitado";
            this.playWithoutSave(name);
        });

        // --- MENÚ NAVEGACIÓN ---
        document.querySelectorAll(".menu-card").forEach(btn => {
            btn.addEventListener("click", () => {
                const module = btn.dataset.module;
                if (module === "dig") this.showScreen("dig-screen");
                if (module === "shop") this.showScreen("shop-screen");
                if (module === "library") this.showScreen("library-screen");
                if (module === "moonlight") this.showScreen("moonlight-screen");
                if (module === "cards") this.showScreen("cards-screen");
            });
        });

        document.getElementById("btn-save-now").addEventListener("click", () => this.saveNow());
        document.getElementById("btn-reset-account").addEventListener("click", () => this.resetAccount());
        document.querySelectorAll(".back-btn").forEach(btn => {
            btn.addEventListener("click", () => this.showScreen(btn.dataset.back));
        });

        // --- DIG FOR TREASURES ---
        document.getElementById("btn-dig-host").addEventListener("click", () => this.createRoom());
        document.getElementById("btn-dig-join").addEventListener("click", () => this.joinRoom());
        this.ui.gameContainer.addEventListener("click", (e) => this.handleMove(e));
        this.ui.btnMine.addEventListener("click", () => this.toggleMining());
        this.ui.miningBar.addEventListener("click", () => this.stopMining());
        document.getElementById("btn-buy-training").addEventListener("click", () => this.buyShovel("training"));
        document.getElementById("btn-buy-iron").addEventListener("click", () => this.buyShovel("iron"));
        document.getElementById("btn-sell-all").addEventListener("click", () => this.sellAllTreasures());

        // --- SHOP ---
        document.querySelectorAll("[data-shop-tab]").forEach(btn => {
            btn.addEventListener("click", () => this.switchShopTab(btn.dataset.shopTab));
        });
        document.getElementById("btn-chromo-small").addEventListener("click", () => this.openChromoPack("small"));
        document.getElementById("btn-chromo-basic").addEventListener("click", () => this.openChromoPack("basic"));
        document.getElementById("btn-card-normal").addEventListener("click", () => this.openCardPack('normal'));
        document.getElementById("btn-card-premium").addEventListener("click", () => this.openCardPack('premium'));

        // --- LIBRARY ---
        this.ui.collectionSelector.addEventListener("click", (e) => {
            const chip = e.target.closest(".chip");
            if (chip) this.toggleCollection(chip.dataset.collection);
        });
        this.ui.bookList.addEventListener("click", (e) => {
            const btn = e.target.closest("[data-read-book]");
            if (btn) this.readBookPage(btn.dataset.readBook);
        });

                // --- CARDS MANAGEMENT DELEGATION (ROBUSTA) ---
        
        // Escuchamos clicks en el contenedor padre (#my-cards-grid)
        if (this.ui.myCardsGrid) {
            this.ui.myCardsGrid.addEventListener("click", (e) => {
                // Buscamos hacia arriba desde el elemento clickeado hasta encontrar un botón con data-action
                const btn = e.target.closest("button[data-action]");
                
                // Si no encontramos un botón válido, salimos silenciosamente
                if (!btn) return; 

                const action = btn.dataset.action;
                const cardId = btn.dataset.cardId;

                console.log(`[DEBUG] Acción: ${action} | Carta: ${cardId}`);

                switch(action) {
                    case "equip":
                        this.toggleEquipCard(cardId);
                        break;
                    case "feed":
                        this.openFeedModal(cardId);
                        break;
                    case "upgrade":
                        this.upgradeCardRank(cardId);
                        break;
                }
            });
        } else {
            console.error("ERROR: #my-cards-grid no encontrado en cacheDOM!");
        }

        // 2. Eventos del Modal de Alimentación
        // Estos elementos SÍ existen siempre (están ocultos), así que podemos vincularlos directamente.
        this.ui.btnFeedCancel.addEventListener("click", () => this.closeFeedModal());
        this.ui.btnFeedConfirm.addEventListener("click", () => this.confirmFeed());
        
        // 3. Selección de Comida (Checkboxes)
        // Usamos 'change' porque es más fiable que 'click' para checkboxes.
        this.ui.foodSelectionList.addEventListener("change", (e) => {
            if (e.target.type === 'checkbox') {
                const id = e.target.dataset.foodId;
                if (e.target.checked) {
                    this.selectedFoodIds.add(id);
                } else {
                    this.selectedFoodIds.delete(id);
                }
                console.log("Comidas seleccionadas:", Array.from(this.selectedFoodIds)); // DEBUG
            }
        });

        // --- MOONLIGHT ---
        this.ui.btnMoonStart.addEventListener("click", () => this.toggleMoonlight());

        window.addEventListener("beforeunload", () => {
            if (SaveManager.exists()) SaveManager.save(this.state.toSave());
        });
    },
    
    // --- BOOT / SAVE ---
    boot() {
        let progress = 0;
        const interval = setInterval(() => {
            progress += 7 + Math.random() * 10;
            if (progress >= 80) {
                progress = 80;
                clearInterval(interval);
                this.setBootProgress(progress);
                this.afterBoot80();
            } else {
                this.setBootProgress(progress);
            }
        }, 120);
    },
    setBootProgress(value) {
        const p = Math.floor(value);
        this.ui.bootFill.style.width = `${p}%`;
        this.ui.bootStatus.innerText = `Cargando datos... ${p}%`;
    },
    afterBoot80() {
        if (SaveManager.exists()) {
            const save = SaveManager.load();
            if (save) {
                this.progressTo100(() => {
                    this.state.loadFromSave(save);
                    this.enterMenu();
                    this.showToast("Progreso cargado", "success");
                });
                return;
            }
        }
        this.ui.savePrompt.classList.remove("hidden");
        // Usamos la variable cacheada 'ui' que sí existe
this.ui.bootStatus.innerText = "¿Quieres guardar tu progreso?";
    },
    progressTo100(callback) {
        let p = parseFloat(this.ui.bootFill.style.width) || 80;
        const interval = setInterval(() => {
            p += 5;
            if (p >= 100) {
                p = 100;
                clearInterval(interval);
                this.setBootProgress(p);
                setTimeout(callback, 150);
            } else {
                this.setBootProgress(p);
            }
        }, 70);
    },
    createNewSave(name) {
        const save = SaveManager.createDefault(name);
        this.state.loadFromSave(save);
        this.progressTo100(() => this.enterMenu());
        this.showToast("Perfil creado y guardado", "success");
    },
    playWithoutSave(name) {
        this.state.profileName = name;
        this.progressTo100(() => this.enterMenu());
        this.showToast("Modo sin guardar activo", "info");
    },
    enterMenu() {
        this.showScreen("menu-screen");
        this.updateMenuUI();
    },
    saveNow() {
        if (!SaveManager.exists()) return this.showToast("No hay guardado activo.", "error");
        const ok = SaveManager.save(this.state.toSave());
        this.showToast(ok ? "Progreso guardado" : "Error al guardar", ok ? "success" : "error");
    },
    resetAccount() {
        if(confirm("¿Borrar TODO el progreso?")) {
            SaveManager.clear();
            location.reload();
        }
    },
    scheduleSave() {
        if (!SaveManager.exists()) return;
        clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = setTimeout(() => SaveManager.save(this.state.toSave()), 800);
    },

    // --- UI ROUTER ---
    showScreen(id) {
        document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
        const el = document.getElementById(id);
        if (el) el.classList.add("active");
        this.currentScreen = id;
        
        if (id === "menu-screen") this.updateMenuUI();
        if (id === "dig-screen") this.prepareDigScreen();
        if (id === "shop-screen") this.renderShop();
        if (id === "library-screen") this.renderLibrary();
        if (id === "cards-screen") this.renderCardsManagement();
        if (id === "moonlight-screen") this.renderMoonlight();
    },
    updateMenuUI() {
        const p = this.state.getActivePlayer();
        this.ui.menuName.innerText = this.state.profileName;
        this.ui.menuMoney.innerText = p.money;
        this.ui.menuBt.innerText = this.state.biblioTokens;
        this.ui.menuXp.innerText = this.state.xp;
        this.ui.menuLevel.innerText = this.state.level;
        this.ui.menuShards.innerText = this.state.rhythmShards;
        if (this.ui.digUsername && !this.ui.digUsername.value) this.ui.digUsername.value = this.state.profileName;
    },
    showToast(message, type = "info", duration = 3000) {
        if (!this.ui.toastContainer) return;
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        let icon = "ℹ️";
        if (type === "success") icon = "✅";
        if (type === "error") icon = "❌";
        if (type === "loot") icon = "💎";
        toast.innerHTML = `<span>${icon}</span><span style="margin-left:8px;">${message}</span>`;
        this.ui.toastContainer.appendChild(toast);
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, duration + 500);
    },

    // --- DIG FOR TREASURES ---
    prepareDigScreen() {
        if (this.state.myId) {
            this.ui.digLobby.hidden = true;
            this.ui.digGame.hidden = false;
            this.ui.miningUi.style.display = "block";
            document.getElementById("current-room-display").innerText = this.state.roomCode;
        } else {
            this.ui.digLobby.hidden = false;
            this.ui.digGame.hidden = true;
        }
        this.renderDig();
    },
    setDigStatus(msg, isError = false) {
        this.ui.digStatus.innerText = msg;
        this.ui.digStatus.style.color = isError ? "#e74c3c" : "#2ecc71";
    },
    showDigLoader(show) { this.ui.digLoader.style.display = show ? "block" : "none"; },
    createRoom() {
        const name = this.ui.digUsername.value.trim() || this.state.profileName;
        const code = this.ui.digRoom.value.trim().toUpperCase();
        if (!name || !code) return this.setDigStatus("Faltan datos", true);
        this.showDigLoader(true);
        this.setDigStatus("Creando sala...");
        this.net.connectAsHost(code, name,
            () => {
                this.showDigLoader(false);
                this.ui.digLobby.hidden = true;
                this.ui.digGame.hidden = false;
                this.ui.miningUi.style.display = "block";
                document.getElementById("current-room-display").innerText = this.state.roomCode;
                this.renderDig();
                this.showToast(`Sala ${code} creada`, "success");
            },
            (err) => { this.showDigLoader(false); this.setDigStatus("Error: " + err, true); }
        );
    },
    joinRoom() {
        const name = this.ui.digUsername.value.trim() || this.state.profileName;
        const code = this.ui.digRoom.value.trim().toUpperCase();
        if (!name || !code) return this.setDigStatus("Faltan datos", true);
        this.showDigLoader(true);
        this.setDigStatus("Buscando sala...");
        this.net.connectAsClient(code, name,
            () => {
                this.showDigLoader(false);
                this.ui.digLobby.hidden = true;
                this.ui.digGame.hidden = false;
                this.ui.miningUi.style.display = "block";
                document.getElementById("current-room-display").innerText = this.state.roomCode;
                this.renderDig();
                this.showToast(`Conectado a ${code}`, "success");
            },
            (err) => { this.showDigLoader(false); this.setDigStatus(err, true); }
        );
    },
    handleMove(e) {
        if (this.mining.active) return;
        const rect = this.ui.gameContainer.getBoundingClientRect();
        let x = e.clientX - rect.left - 20;
        let y = e.clientY - rect.top - 20;
        x = Math.max(0, Math.min(x, rect.width - 40));
        y = Math.max(0, Math.min(y, rect.height - 40));
        this.state.updateMyPosition(x, y);
        this.net.sendToHostOrBroadcast({ type: "MOVE", player: this.state.getActivePlayer() });
        this.renderDig();
    },
    toggleMining() { if (this.mining.active) this.stopMining(); else this.startMining(); },
    startMining() {
        this.mining.active = true;
        this.mining.pos = 0;
        this.mining.dir = 1;
        this.ui.btnMine.innerText = "❌ Detener";
        this.mining.interval = setInterval(() => {
            this.mining.pos += 4 * this.mining.dir;
            if (this.mining.pos > 296 || this.mining.pos < 0) this.mining.dir *= -1;
            this.ui.cursorLine.style.left = this.mining.pos + "px";
        }, 16);
    },
    stopMining() {
        clearInterval(this.mining.interval);
        this.mining.active = false;
        this.ui.btnMine.innerText = "⛏️ Excavar";
        if (this.mining.pos >= 120 && this.mining.pos <= 180) {
            const loot = this.state.mineTreasure();
            this.showToast(`¡Encontraste ${loot.name}! (+${loot.val} PE)`, "loot");
        } else {
            this.showToast("Fallaste... Tierra dura.", "error");
        }
        this.scheduleSave();
        this.renderDig();
    },
    sellAllTreasures() {
        const res = this.state.sellInventory();
        if (res.money > 0) {
            this.showToast(`Vendiste todo por ${res.money} PE`, "success");
            this.net.sendToHostOrBroadcast({ type: "STATS_UPDATE", player: this.state.getActivePlayer() });
            this.scheduleSave();
            this.renderDig();
        } else {
            this.showToast("No tienes nada que vender.", "info");
        }
    },
    buyShovel(type) {
        if (this.state.buyShovel(type)) {
            this.showToast(`Compraste pala: ${SHOVEL_DATA[type].name}`, "success");
            this.net.sendToHostOrBroadcast({ type: "STATS_UPDATE", player: this.state.getActivePlayer() });
            this.scheduleSave();
            this.renderDig();
        } else {
            this.showToast("Dinero insuficiente.", "error");
        }
    },
    renderDig() {
        if (!this.ui.gameContainer) return;
        this.ui.gameContainer.innerHTML = "";
        const players = this.state.getAllPlayers();
        document.getElementById("player-count").innerText = players.length;
        players.forEach(p => {
            const dot = document.createElement("div");
            dot.className = "player-dot";
            dot.style.left = p.x + "px";
            dot.style.top = p.y + "px";
            dot.style.background = p.color;
            dot.innerText = "🐺";
            const label = document.createElement("div");
            label.className = "player-name";
            label.innerText = p.name + (p.id === this.state.myId ? " (Tú)" : "");
            dot.appendChild(label);
            this.ui.gameContainer.appendChild(dot);
        });
        const me = this.state.getActivePlayer();
        document.getElementById("dig-money").innerText = me.money;
        document.getElementById("dig-shovel").innerText = SHOVEL_DATA[me.shovel].name;
        const inv = document.getElementById("dig-inventory");
        inv.innerHTML = "";
        if (me.inventory.length === 0) inv.innerHTML = "<li>Inventario vacío</li>";
        else me.inventory.forEach(item => {
            const li = document.createElement("li");
            li.innerText = `${item.name}: ${item.val} PE`;
            inv.appendChild(li);
        });
    },

    // --- SHOP ---
    switchShopTab(tab) {
        this.shopTab = tab;
        document.querySelectorAll("[data-shop-tab]").forEach(b => b.classList.remove("active-tab"));
        document.querySelector(`[data-shop-tab="${tab}"]`).classList.add("active-tab");
        this.ui.shopChromos.classList.toggle("active-tab-content", tab === "chromos");
        this.ui.shopCards.classList.toggle("active-tab-content", tab === "cards");
        this.renderShop();
    },
    renderShop() {
        const history = document.getElementById("chromo-history");
        history.innerHTML = "";
        if (this.state.chromoInventory.length === 0) history.innerHTML = "<li>Sin paquetes abiertos.</li>";
        else this.state.chromoInventory.slice(0, 10).forEach(entry => {
            const li = document.createElement("li");
            li.innerHTML = `<span>🃏 ${entry.packName}</span><span>${entry.pages} págs · ${entry.completions} completados</span>`;
            history.appendChild(li);
        });
    },
    openChromoPack(type) {
        const res = this.state.openChromoPack(type);
        if (!res) return this.showToast("No tienes suficientes BT o no hay libros disponibles.", "error");
        let msg = `Abriste ${res.packName}: ${res.results.length} páginas.`;
        if (res.completions.length > 0) msg += ` Completaste ${res.completions.length} libro(s).`;
        this.showToast(msg, "loot");
        this.scheduleSave();
        this.renderShop();
        this.renderLibrary();
        this.updateMenuUI();
    },
    openCardPack(type) {
        const res = this.state.openCardPack(type);
        if (!res) {
            const currency = type === 'premium' ? 'Shards' : 'BT';
            return this.showToast(`No tienes suficientes ${currency}.`, "error");
        }

        // Mostrar resultados en la tienda
        if(this.ui.lastPackResult) {
            this.ui.lastPackResult.classList.remove("hidden");
            this.ui.lastPackResult.innerHTML = `
                <h4>Resultado: ${res.packName}</h4>
                <ul class="item-list">
                    ${res.cards.map(c => `
                        <li>
                            <span>${c.isNew ? '✨ NUEVA:' : '🔄 DUPE:'} ${c.name}</span>
                            <span class="rank-${c.rank}" style="font-weight:bold;">[${c.rank}]</span>
                        </li>
                    `).join('')}
                </ul>
            `;
        }

        this.showToast(`Obtuviste ${res.cards.length} cartas.`, "loot");
        this.scheduleSave();
        this.updateMenuUI();
    },

      renderCardsManagement() {
        this.ui.myCardsGrid.innerHTML = "";
        const ownedIds = Object.keys(this.state.cardInventory);
        
        if (ownedIds.length === 0) {
            this.ui.myCardsGrid.innerHTML = "<p>No tienes cartas todavía. ¡Abre sobres!</p>";
            return;
        }

        let totalPower = 0;

        ownedIds.forEach(id => {
            const record = this.state.getCardRecord(id);
            const catalogEntry = CARD_MAP[id];
            if (!catalogEntry) return;

            const power = this.state.calculateCardPower(id);
            totalPower += power;
            const isEquipped = this.state.equippedCards.includes(id);
            const config = RANK_CONFIG[record.rank];
            const canUpgrade = record.level >= config.maxLvl && !!config.nextRank;
            const hasEnoughShards = this.state.rhythmShards >= config.nextRankCost;

            const cardDiv = document.createElement("div");
            cardDiv.className = `card-item ${isEquipped ? "equipped" : ""}`;
            
            // HTML INTERNO CON DATA ATTRIBUTES CORRECTOS
            cardDiv.innerHTML = `
                <div class="card-rank-badge rank-${record.rank}">${record.rank}</div>
                <h4>${catalogEntry.displayName}</h4>
                <p>Lvl ${record.level}/${config.maxLvl} | Pow: ${power}</p>
                ${record.count > 1 ? `<p style="color:#aaa; font-size:0.8em;">Dupes: ${record.count - 1}</p>` : ''}
                
                <div class="card-actions">
                                // ... dentro del forEach de renderCardsManagement ...
            
            // BOTÓN EQUIPAR
            <button data-action="equip" data-card-id="${id}" class="${isEquipped ? 'secondary' : ''}">
                ${isEquipped ? "❌ Quitar" : "✅ Equipar"}
            </button>
            
            // BOTÓN ALIMENTAR
            <button data-action="feed" data-card-id="${id}" class="library-btn">
                🍽️ Alimentar
            </button>

            // BOTÓN SUBIR RANGO (si aplica)
            ${canUpgrade ? `
                <button data-action="upgrade" data-card-id="${id}" class="${hasEnoughShards ? 'chromo-btn' : 'secondary'}" ${!hasEnoughShards ? 'disabled' : ''}>
                    ⬆️ Subir Rango (${config.nextRankCost} 💎)
                </button>
            ` : ''}
                </div>
            `;
            this.ui.myCardsGrid.appendChild(cardDiv);
        });

        this.ui.totalPowerDisplay.innerText = totalPower;
        this.ui.cardShardsDisplay.innerText = this.state.rhythmShards;
    },

    // Delegación de eventos para los botones dentro de la grilla
    handleCardAction(e) {
        const btn = e.target.closest("[data-card-action]");
        if (!btn) return;
        
        const action = btn.dataset.action;
        const cardId = btn.dataset.cardId;

        if (action === "equip") this.toggleEquipCard(cardId);
        if (action === "upgrade") this.upgradeCardRank(cardId);
        if (action === "feed") this.openFeedModal(cardId);
    },

    toggleEquipCard(cardId) {
        const success = this.state.toggleEquipCard(cardId);
        
        if (success) {
            this.showToast("Carta actualizada", "success");
            this.scheduleSave();
            this.renderCardsManagement(); // Refrescar vista
            this.renderMoonlight();       // Refrescar Moonlight también
        } else {
            this.showToast("No puedes equipar más de 5 cartas.", "error");
        }
    },

    upgradeCardRank(cardId) {
        const success = this.state.upgradeCardRank(cardId);
        
        if (success) {
            this.showToast("¡Rango subido exitosamente!", "success");
            this.scheduleSave();
            this.renderCardsManagement();
            this.updateMenuUI();
        } else {
            this.showToast("Faltan requisitos o Shards.", "error");
        }
    },

    // --- LÓGICA DEL MODAL DE ALIMENTACIÓN ---
    
    openFeedModal(targetId) {
        this.feedTargetId = targetId;
        this.selectedFoodIds.clear();
        
        const targetRecord = this.state.getCardRecord(targetId);
        const targetCatalog = CARD_MAP[targetId];
        
        // Mostrar nombre de la carta objetivo
        this.ui.feedTargetName.innerText = targetCatalog?.displayName || targetId;
        
        // Limpiar lista anterior
        this.ui.foodSelectionList.innerHTML = "";

        // Generar checkboxes para TODAS las demás cartas que tengas
        Object.keys(this.state.cardInventory).forEach(id => {
            if (id === targetId) return; // Excluir la propia
            
            const rec = this.state.cardInventory[id];
            // Solo mostrar si tiene al menos 1 copia disponible para comer
            // (Nota: En un sistema real, quizás quieras excluir la única copia de una carta importante, 
            // pero por simplicidad aquí dejamos todas seleccionables excepto la target)
            
            if (rec.count <= 0) return; 

            const catalog = CARD_MAP[id];
            if(!catalog) return;

            const li = document.createElement("label");
            li.style.display = "flex";
            li.style.alignItems = "center";
            li.style.padding = "8px";
            li.style.borderBottom = "1px solid #333";
            li.innerHTML = `
                <input type="checkbox" data-food-id="${id}" style="margin-right:10px;">
                <span>[${rec.rank}] ${catalog.displayName} (x${rec.count})</span>
            `;
            this.ui.foodSelectionList.appendChild(li);
        });

        // Si no hay nada para comer, avisar
        if (this.ui.foodSelectionList.children.length === 0) {
            this.ui.foodSelectionList.innerHTML = "<p>No tienes otras cartas para alimentar.</p>";
        }

        this.ui.feedModal.classList.remove("hidden");
    },

    closeFeedModal() {
        this.ui.feedModal.classList.add("hidden");
        this.feedTargetId = null;
        this.selectedFoodIds.clear();
    },

    confirmFeed() {
        if (!this.feedTargetId || this.selectedFoodIds.size === 0) {
            this.showToast("Selecciona al menos una carta para alimentar.", "error");
            return;
        }

        const result = this.state.feedCard(this.feedTargetId, Array.from(this.selectedFoodIds));
        
        if (result && result.success) {
            this.showToast(`¡Alimentada! +${result.levelsUp} Niveles`, "success");
            this.scheduleSave();
            this.renderCardsManagement();
            this.closeFeedModal();
        } else {
            const msg = result?.reason === "max_level" ? "La carta ya está al máximo de nivel." : "Error al alimentar.";
            this.showToast(msg, "error");
        }
    },
    // --- LIBRARY ---
    renderLibrary() {
        this.ui.collectionSelector.innerHTML = "";
        COLLECTIONS.forEach(col => {
            const active = this.state.selectedCollections.includes(col.id);
            const chip = document.createElement("button");
            chip.className = `chip ${active ? "active" : ""}`;
            chip.dataset.collection = col.id;
            chip.innerText = col.name;
            this.ui.collectionSelector.appendChild(chip);
        });
        this.ui.bookList.innerHTML = "";
        const books = this.state.getAvailableBooks();
        if (books.length === 0) { this.ui.bookList.innerHTML = "<p>No hay libros.</p>"; return; }
        books.forEach(book => {
            const progress = this.state.bookProgress[book.id] || 0;
            const completed = this.state.completedBooks.includes(book.id);
            const percent = Math.floor((progress / book.pages) * 100);
            const row = document.createElement("div");
            row.className = "book-row";
            row.innerHTML = `
                <h4>${book.title}</h4>
                <div class="book-meta">
                    <span class="rarity-${book.rarity}">${book.rarity.toUpperCase()}</span>
                    <span>${progress}/${book.pages} páginas</span>
                </div>
                <div class="book-progress"><div class="book-progress-fill" style="width:${percent}%"></div></div>
                <div class="book-meta">
                    <span>Recompensa: ${book.rewardBT} BT + ${book.rewardXP} XP</span>
                    ${completed ? "<span>✔ Completado</span>" : `<button data-read-book="${book.id}" class="library-btn">Leer página</button>`}
                </div>
            `;
            this.ui.bookList.appendChild(row);
        });
    },
    toggleCollection(id) {
        if (this.state.toggleCollection(id)) { this.scheduleSave(); this.renderLibrary(); }
        else this.showToast("Debes tener entre 1 y 3 colecciones activas.", "error");
    },
    readBookPage(bookId) {
        const res = this.state.readPage(bookId);
        if (!res) return this.showToast("Este libro ya está completado.", "info");
        if (res.completed) this.showToast(`¡Completaste "${res.book.title}"! +${res.rewardBT} BT, +${res.rewardXP} XP`, "loot");
        else this.showToast(`Leíste una página de "${res.book.title}"`, "info");
        this.scheduleSave();
        this.renderLibrary();
        this.updateMenuUI();
    },

    // --- PROJECT MOONLIGHT ---
    ensureRhythm() {
        if (!this.rhythm && this.ui.moonCanvas) {
            this.rhythm = new RhythmGame(this.ui.moonCanvas, {
                onFinish: (results) => this.onRhythmFinish(results)
            });
        }
    },
    async toggleMoonlight() {
        this.ensureRhythm();
        if (this.rhythm.running) {
            this.rhythm.stop();
            return;
        }
        const audioElement = document.getElementById("moon-audio");
        if (!audioElement) return this.showToast("Error: No se encontró #moon-audio", "error");
        if (!this.rhythm.songData) {
            this.showToast("Cargando Chart...", "info");
            const loaded = await this.rhythm.loadChart('charts/bed_of_thorns.json');
            if (!loaded) return this.showToast("Error cargando chart.", "error");
        }
        const rhythmStats = this.state.getRhythmStats("bed_of_thorns");
        this.rhythm.start(audioElement, rhythmStats); 
        const btn = document.getElementById("btn-moon-start");
        if(btn) btn.innerText = "⏹ Detener Stage";
        this.ui.moonResults.classList.add("hidden");
        this.showToast(`Iniciando con Potencia x${rhythmStats.power.toFixed(1)}`, "success");
    },
    renderMoonlight() {
        this.ensureRhythm();
        const bestScore = this.state.rhythm.bestScores["bed_of_thorns"] || 0;
        const plays = this.state.rhythm.plays || 0;
        if(this.ui.moonBest) this.ui.moonBest.innerText = bestScore;
        if(this.ui.moonPlays) this.ui.moonPlays.innerText = plays;
        if(this.ui.equipCount) this.ui.equipCount.innerText = this.state.equippedCards.length;
        
        const list = this.ui.moonEquipped;
        if(list) {
            list.innerHTML = "";
            if (this.state.equippedCards.length === 0) list.innerHTML = "<li>Sin cartas equipadas.</li>";
            else this.state.equippedCards.forEach(id => {
                const catalogEntry = CARD_MAP[id];
                if (!catalogEntry) return;
                const record = this.state.getCardRecord(id);
                const li = document.createElement("li");
                li.innerHTML = `<span>🎴 ${catalogEntry.displayName} [${record.rank}] Lvl ${record.level}</span><span>Pow: ${this.state.calculateCardPower(id)}</span>`;
                list.appendChild(li);
            });
        }
        if (this.rhythm && this.rhythm.running) this.ui.btnMoonStart.innerText = "⏹ Detener Stage";
        else this.ui.btnMoonStart.innerText = "▶️ Iniciar Stage";
    },
    onRhythmFinish(results) {
        const rewards = this.state.recordRhythm(results);
        
        // Calcular Shards ganados
        let shardsEarned = 0;
        if (results.rank === "S+" || results.rank === "S") shardsEarned = 10;
        else if (results.rank === "A") shardsEarned = 5;
        else if (results.rank === "B") shardsEarned = 2;
        else shardsEarned = 1;
        this.state.rhythmShards += shardsEarned;
        
        // Aplicar XP a cartas
        this.state.applyXpToCards(rewards.xp);

        const resBox = document.getElementById("moon-results");
        if(resBox) {
            resBox.classList.remove("hidden");
            resBox.innerHTML = `
                <h3>Resultado: ${results.rank}</h3>
                <p>Score: <b>${results.score}</b></p>
                <p>Combo máx: <b>${results.maxCombo}</b></p>
                <hr>
                <p>💎 Shards Ganados: <b>+${shardsEarned}</b></p>
                <p>Total Shards: <b>${this.state.rhythmShards}</b></p>
                <p>Recompensa: <b>+${rewards.bt} BT</b> | <b>+${rewards.xp} XP</b></p>
            `;
        }
        this.ui.btnMoonStart.innerText = "▶️ Iniciar Stage";
        this.scheduleSave();
        this.renderMoonlight();
        this.updateMenuUI();
        this.showToast(`Stage terminado. Rango ${results.rank}`, results.rank === "D" ? "error" : "success");
    }
};

window.addEventListener("DOMContentLoaded", () => {
    App.init();
});
