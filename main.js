/**
 * WOLFY WORLD - MAIN CONTROLLER
 * Hub Update con guardado, menú, tienda, biblioteca y Project Moonlight.
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

    init() {
        this.state = new GameState();
        this.net = new NetworkManager(this.state);

        this.cacheDOM();
        this.bindEvents();
        this.boot();
    },

    cacheDOM() {
        this.ui.bootScreen = document.getElementById("boot-screen");
        this.ui.bootFill = document.getElementById("boot-fill");
        this.ui.bootStatus = document.getElementById("boot-status");
        this.ui.savePrompt = document.getElementById("save-prompt");
        this.ui.bootName = document.getElementById("boot-name");

        this.ui.menuScreen = document.getElementById("menu-screen");
        this.ui.menuName = document.getElementById("menu-name");
        this.ui.menuMoney = document.getElementById("menu-money");
        this.ui.menuBt = document.getElementById("menu-bt");
        this.ui.menuXp = document.getElementById("menu-xp");
        this.ui.menuLevel = document.getElementById("menu-level");

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

        this.ui.shopScreen = document.getElementById("shop-screen");
        this.ui.shopChromos = document.getElementById("shop-chromos");
        this.ui.shopCards = document.getElementById("shop-cards");

        this.ui.libraryScreen = document.getElementById("library-screen");
        this.ui.collectionSelector = document.getElementById("collection-selector");
        this.ui.bookList = document.getElementById("book-list");

        this.ui.moonScreen = document.getElementById("moonlight-screen");
        this.ui.moonCanvas = document.getElementById("moon-canvas");
        this.ui.moonAudio = document.getElementById("moon-audio");
        this.ui.btnMoonStart = document.getElementById("btn-moon-start");
        this.ui.moonBest = document.getElementById("moon-best");
        this.ui.moonPlays = document.getElementById("moon-plays");
        this.ui.moonResults = document.getElementById("moon-results");
        this.ui.moonEquipped = document.getElementById("moon-equipped");

        this.ui.toastContainer = document.getElementById("toast-container");
    },

    bindEvents() {
        // Boot
        document.getElementById("btn-save-yes").addEventListener("click", () => {
            const name = this.ui.bootName.value.trim() || "Lobo Invitado";
            this.createNewSave(name);
        });

        document.getElementById("btn-save-no").addEventListener("click", () => {
            const name = this.ui.bootName.value.trim() || "Lobo Invitado";
            this.playWithoutSave(name);
        });

        // Menú
        document.querySelectorAll(".menu-card").forEach(btn => {
            btn.addEventListener("click", () => {
                const module = btn.dataset.module;
                if (module === "dig") this.showScreen("dig-screen");
                if (module === "shop") this.showScreen("shop-screen");
                if (module === "library") this.showScreen("library-screen");
                if (module === "moonlight") this.showScreen("moonlight-screen");
            });
        });

        document.getElementById("btn-save-now").addEventListener("click", () => this.saveNow());

        // Back buttons
        document.querySelectorAll(".back-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                this.showScreen(btn.dataset.back);
            });
        });

        // Dig lobby
        document.getElementById("btn-dig-host").addEventListener("click", () => this.createRoom());
        document.getElementById("btn-dig-join").addEventListener("click", () => this.joinRoom());

        // Dig gameplay
        this.ui.gameContainer.addEventListener("click", (e) => this.handleMove(e));
        this.ui.btnMine.addEventListener("click", () => this.toggleMining());
        this.ui.miningBar.addEventListener("click", () => this.stopMining());

        document.getElementById("btn-buy-training").addEventListener("click", () => this.buyShovel("training"));
        document.getElementById("btn-buy-iron").addEventListener("click", () => this.buyShovel("iron"));
        document.getElementById("btn-buy-steel").addEventListener("click", () => this.buyShovel("steel"));
        document.getElementById("btn-sell-all").addEventListener("click", () => this.sellAllTreasures());

        // Shop tabs
        document.querySelectorAll("[data-shop-tab]").forEach(btn => {
            btn.addEventListener("click", () => this.switchShopTab(btn.dataset.shopTab));
        });

        document.getElementById("btn-chromo-small").addEventListener("click", () => this.openChromoPack("small"));
        document.getElementById("btn-chromo-basic").addEventListener("click", () => this.openChromoPack("basic"));
        document.getElementById("btn-chromo-large").addEventListener("click", () => this.openChromoPack("large"));

        document.getElementById("btn-card-small").addEventListener("click", () => this.openCardPack("small"));
        document.getElementById("btn-card-basic").addEventListener("click", () => this.openCardPack("basic"));
        document.getElementById("btn-card-lunar").addEventListener("click", () => this.openCardPack("lunar"));

        // Library delegation
        this.ui.collectionSelector.addEventListener("click", (e) => {
            const chip = e.target.closest(".chip");
            if (!chip) return;
            this.toggleCollection(chip.dataset.collection);
        });

        this.ui.bookList.addEventListener("click", (e) => {
            const btn = e.target.closest("[data-read-book]");
            if (!btn) return;
            this.readBookPage(btn.dataset.readBook);
        });

        // Moonlight
        this.ui.btnMoonStart.addEventListener("click", () => this.toggleMoonlight());

        document.addEventListener("keydown", (e) => {
            if (this.currentScreen === "moonlight-screen" && this.rhythm) {
                this.rhythm.handleKey(e.key);
            }
        });

        window.addEventListener("beforeunload", () => {
            if (SaveManager.exists()) {
                SaveManager.save(this.state.toSave());
            }
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

    setBootStatus(msg) {
        this.ui.bootStatus.innerText = msg;
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
        this.setBootStatus("¿Quieres guardar tu progreso?");
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
        this.state.savedPlayer.name = name;
        this.progressTo100(() => this.enterMenu());
        this.showToast("Modo sin guardar activo", "info");
    },

    enterMenu() {
        this.showScreen("menu-screen");
        this.updateMenuUI();
    },

    saveNow() {
        if (!SaveManager.exists()) {
            this.showToast("No hay guardado activo. Crea un perfil primero.", "error");
            return;
        }

        const ok = SaveManager.save(this.state.toSave());
        this.showToast(ok ? "Progreso guardado" : "Error al guardar", ok ? "success" : "error");
    },

    scheduleSave() {
        if (!SaveManager.exists()) return;

        clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = setTimeout(() => {
            SaveManager.save(this.state.toSave());
        }, 800);
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
        if (id === "moonlight-screen") this.renderMoonlight();
    },

    updateMenuUI() {
        const p = this.state.getActivePlayer();

        this.ui.menuName.innerText = this.state.profileName;
        this.ui.menuMoney.innerText = p.money;
        this.ui.menuBt.innerText = this.state.biblioTokens;
        this.ui.menuXp.innerText = this.state.xp;
        this.ui.menuLevel.innerText = this.state.level;

        if (this.ui.digUsername && !this.ui.digUsername.value) {
            this.ui.digUsername.value = this.state.profileName;
        }
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

        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, duration + 500);
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

    showDigLoader(show) {
        this.ui.digLoader.style.display = show ? "block" : "none";
    },

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
            (err) => {
                this.showDigLoader(false);
                this.setDigStatus("Error: " + err, true);
            }
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
            (err) => {
                this.showDigLoader(false);
                this.setDigStatus(err, true);
            }
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
        this.net.sendToHostOrBroadcast({
            type: "MOVE",
            player: this.state.getActivePlayer()
        });

        this.renderDig();
    },

    toggleMining() {
        if (this.mining.active) this.stopMining();
        else this.startMining();
    },

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
        this.ui.btnMine.innerText = "⛏️ Empezar a Excavar";

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
            this.net.sendToHostOrBroadcast({
                type: "STATS_UPDATE",
                player: this.state.getActivePlayer()
            });
            this.scheduleSave();
            this.renderDig();
        } else {
            this.showToast("No tienes nada que vender.", "info");
        }
    },

    buyShovel(type) {
        if (this.state.buyShovel(type)) {
            this.showToast(`Compraste pala: ${SHOVEL_DATA[type].name}`, "success");
            this.net.sendToHostOrBroadcast({
                type: "STATS_UPDATE",
                player: this.state.getActivePlayer()
            });
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
        const playerCountEl = document.getElementById("player-count");
        if (playerCountEl) playerCountEl.innerText = players.length;

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
        document.getElementById("dig-bt").innerText = this.state.biblioTokens;
        document.getElementById("dig-shovel").innerText = SHOVEL_DATA[me.shovel].name;

        const xpInLevel = this.state.xp % 1000;
        document.getElementById("dig-xp-text").innerText = `${xpInLevel}/1000`;
        document.getElementById("dig-xp-bar").style.width = `${(xpInLevel / 1000) * 100}%`;

        const inv = document.getElementById("dig-inventory");
        inv.innerHTML = "";

        if (me.inventory.length === 0) {
            inv.innerHTML = "<li>Inventario vacío</li>";
        } else {
            me.inventory.forEach(item => {
                const li = document.createElement("li");
                li.innerText = `${item.name}: ${item.val} PE`;
                inv.appendChild(li);
            });
        }
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
        // Chromo history
        const history = document.getElementById("chromo-history");
        history.innerHTML = "";

        if (this.state.chromoInventory.length === 0) {
            history.innerHTML = "<li>Sin paquetes abiertos.</li>";
        } else {
            this.state.chromoInventory.slice(0, 10).forEach(entry => {
                const li = document.createElement("li");
                li.innerHTML = `<span>🃏 ${entry.packName}</span><span>${entry.pages} págs · ${entry.completions} completados</span>`;
                history.appendChild(li);
            });
        }

        // Cards inventory grouped
        const cardInv = document.getElementById("card-inventory");
        cardInv.innerHTML = "";

        const counts = {};
        this.state.cards.forEach(id => counts[id] = (counts[id] || 0) + 1);

        const cardIds = Object.keys(counts);
        if (cardIds.length === 0) {
            cardInv.innerHTML = "<li>No tienes cartas.</li>";
        } else {
            cardIds.forEach(id => {
                const card = CARD_TYPES.find(c => c.id === id);
                if (!card) return;

                const li = document.createElement("li");
                const equipped = this.state.equippedCards.includes(id);

                li.innerHTML = `
                    <span>🎴 ${card.name} x${counts[id]}</span>
                    <button class="library-btn" data-equip-card="${id}">
                        ${equipped ? "Quitar" : "Equipar"}
                    </button>
                `;

                li.querySelector("button").addEventListener("click", () => this.toggleEquipCard(id));
                cardInv.appendChild(li);
            });
        }

        // Equipped
        const equippedList = document.getElementById("equipped-cards");
        equippedList.innerHTML = "";

        if (this.state.equippedCards.length === 0) {
            equippedList.innerHTML = "<li>Ninguna equipada.</li>";
        } else {
            this.state.equippedCards.forEach(id => {
                const card = CARD_TYPES.find(c => c.id === id);
                if (!card) return;

                const li = document.createElement("li");
                li.innerHTML = `<span>⭐ ${card.name}</span><span>${card.effect}</span>`;
                equippedList.appendChild(li);
            });
        }
    },

    openChromoPack(type) {
        const res = this.state.openChromoPack(type);

        if (!res) {
            this.showToast("No tienes suficientes BT o no hay libros disponibles.", "error");
            return;
        }

        let msg = `Abriste ${res.packName}: ${res.results.length} páginas.`;
        if (res.completions.length > 0) {
            msg += ` Completaste ${res.completions.length} libro(s).`;
        }

        this.showToast(msg, "loot");
        this.scheduleSave();
        this.renderShop();
        this.renderLibrary();
        this.updateMenuUI();
    },

    openCardPack(type) {
        const res = this.state.openCardPack(type);

        if (!res) {
            this.showToast("No tienes suficientes BT.", "error");
            return;
        }

        this.showToast(`Abriste ${res.packName}: ${res.cards.length} cartas.`, "loot");
        this.scheduleSave();
        this.renderShop();
        this.updateMenuUI();
    },

    toggleEquipCard(cardId) {
        if (this.state.toggleEquipCard(cardId)) {
            this.showToast("Carta actualizada", "success");
            this.scheduleSave();
            this.renderShop();
            this.renderMoonlight();
        } else {
            this.showToast("No puedes equipar más de 3 cartas.", "error");
        }
    },

    // --- LIBRARY ---
    renderLibrary() {
        // Colecciones
        this.ui.collectionSelector.innerHTML = "";

        COLLECTIONS.forEach(col => {
            const active = this.state.selectedCollections.includes(col.id);
            const chip = document.createElement("button");
            chip.className = `chip ${active ? "active" : ""}`;
            chip.dataset.collection = col.id;
            chip.innerText = col.name;
            this.ui.collectionSelector.appendChild(chip);
        });

        // Libros
        this.ui.bookList.innerHTML = "";

        const books = this.state.getAvailableBooks();

        if (books.length === 0) {
            this.ui.bookList.innerHTML = "<p>No hay libros en las colecciones activas.</p>";
            return;
        }

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
                <div class="book-progress">
                    <div class="book-progress-fill" style="width:${percent}%"></div>
                </div>
                <div class="book-meta">
                    <span>Recompensa: ${book.rewardBT} BT + ${book.rewardXP} XP</span>
                    ${completed
                        ? "<span>✔ Completado</span>"
                        : `<button data-read-book="${book.id}" class="library-btn">Leer página</button>`
                    }
                </div>
            `;

            this.ui.bookList.appendChild(row);
        });
    },

    toggleCollection(id) {
        if (this.state.toggleCollection(id)) {
            this.scheduleSave();
            this.renderLibrary();
        } else {
            this.showToast("Debes tener entre 1 y 3 colecciones activas.", "error");
        }
    },

    readBookPage(bookId) {
        const res = this.state.readPage(bookId);

        if (!res) {
            this.showToast("Este libro ya está completado.", "info");
            return;
        }

        if (res.completed) {
            this.showToast(`¡Completaste "${res.book.title}"! +${res.rewardBT} BT, +${res.rewardXP} XP`, "loot");
        } else {
            this.showToast(`Leíste una página de "${res.book.title}"`, "info");
        }

        this.scheduleSave();
        this.renderLibrary();
        this.updateMenuUI();
    },

    // --- PROJECT MOONLIGHT ---
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
            this.ui.btnMoonStart.innerText = "▶️ Iniciar Stage";
            return;
        }

this.ui.moonAudio = document.getElementById("moon-audio");
        
        // 1. Cargar el Chart JSON
        this.showToast("Cargando Chart...", "info");
        const loaded = await this.rhythm.loadChart('charts/bed_of_thorns.json');
        
        if (!loaded) {
            this.showToast("Error: No se encontró el archivo del chart.", "error");
            return;
        }

        // 2. Obtener efectos de cartas equipadas
        const effects = this.state.getCardEffects();

        // 3. Iniciar Juego con Audio
        this.rhythm.start(this.ui.moonAudio, effects);
        this.ui.btnMoonStart.innerText = "⏹ Detener Stage";
        this.ui.moonResults.classList.add("hidden");
        this.showToast("¡Stage Iniciado!", "success");
    },

    renderMoonlight() {
        this.ensureRhythm();

        this.ui.moonBest.innerText = this.state.rhythm.bestScores.bed || 0;
        this.ui.moonPlays.innerText = this.state.rhythm.plays || 0;

        const list = this.ui.moonEquipped;
        list.innerHTML = "";

        if (this.state.equippedCards.length === 0) {
            list.innerHTML = "<li>Sin cartas equipadas.</li>";
        } else {
            this.state.equippedCards.forEach(id => {
                const card = CARD_TYPES.find(c => c.id === id);
                if (!card) return;

                const li = document.createElement("li");
                li.innerHTML = `<span>🎴 ${card.name}</span><span>${card.effect}</span>`;
                list.appendChild(li);
            });
        }

        if (this.rhythm && this.rhythm.running) {
            this.ui.btnMoonStart.innerText = "⏹ Detener Stage";
        } else {
            this.ui.btnMoonStart.innerText = "▶️ Iniciar Stage";
        }
    },
    
    onRhythmFinish(results) {
        const rewards = this.state.recordRhythm(results);

        this.ui.moonResults.classList.remove("hidden");
        this.ui.moonResults.innerHTML = `
            <h3>Resultado: ${results.rank}</h3>
            <p>Score: <b>${results.score}</b></p>
            <p>Combo máximo: <b>${results.maxCombo}</b></p>
            <p>Aciertos: <b>${results.hits}</b> | Fallos: <b>${results.misses}</b></p>
            <p>Precisión: <b>${Math.round(results.accuracy * 100)}%</b></p>
            <p>Recompensa: <b>+${rewards.bt} BT</b> | <b>+${rewards.xp} XP</b></p>
        `;

        this.ui.btnMoonStart.innerText = "▶️ Iniciar Stage";
        this.scheduleSave();
        this.renderMoonlight();
        this.updateMenuUI();
        this.showToast(`Stage terminado. Rango ${results.rank}`, results.rank === "F" ? "error" : "success");
    }
};

window.addEventListener("DOMContentLoaded", () => {
    App.init();
});
