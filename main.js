const app = {
    state: null,
    net: null,
    miningInterval: null,
    isMining: false,
    cursorPos: 0,
    cursorDir: 1,

    init() {
        this.state = new GameState();
        this.net = new NetworkManager(this.state);
        
        // Configurar callback de red
        this.net.onMessageCallback = (type, data) => {
            this.handleNetworkEvent(type, data);
        };
    },

    startGame() {
        const username = document.getElementById('username').value.trim() || "Invitado";
        const roomCode = document.getElementById('room-code').value.trim().toUpperCase();
        const statusEl = document.getElementById('status');
        
        if(!roomCode) {
            statusEl.innerText = "Error: Introduce un código de sala.";
            return;
        }

        statusEl.innerText = "Conectando...";
        
        // Definir ID local temporal hasta confirmar conexión
        // En P2P puro, usualmente esperas al open event para tener tu ID real de PeerJS.
        // Para simplificar, generamos uno fake aquí y lo sincronizamos después, 
        // o mejor: esperamos al evento ready.
        
        this.net.init('p2p', roomCode, username, (isHost) => {
            // ¡Listo!
            const myPeerId = this.net.peer ? this.net.peer.id : "local-user";
            this.state.setLocalPlayer(myPeerId, username);
            
            document.getElementById('current-room').innerText = roomCode;
            this.switchScreen('game-screen');
            this.renderLoop(); // Empezar bucle de renderizado
            
            statusEl.innerText = "";
        }, (err) => {
            statusEl.innerText = "Error: " + err.message;
        });
    },

    switchScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
    },

    // --- RENDERIZADO ---
    renderLoop() {
        requestAnimationFrame(() => this.render());
    },

    render() {
        const area = document.getElementById('game-area');
        // Limpiar área excepto controles si fueran hijos directos (aquí son absolutos)
        // Mejor: Reutilizar elementos o borrar innerHTML cada frame (ineficiente pero simple para prototipo)
        // Optimización: Solo actualizar posiciones de divs existentes.
        
        // Por simplicidad en este ejemplo, limpiamos y redibujamos. 
        // En producción, mantendrías referencias a los nodos DOM.
        area.innerHTML = ''; 

        const players = this.state.getAllPlayersArray();
        players.forEach(p => {
            const dot = document.createElement('div');
            dot.className = 'player';
            dot.style.left = `${p.x}px`;
            dot.style.top = `${p.y}px`;
            dot.style.backgroundColor = p.color || '#e74c3c';
            dot.innerText = "🐺";
            
            const label = document.createElement('div');
            label.className = 'player-label';
            label.innerText = p.name;
            dot.appendChild(label);
            
            area.appendChild(dot);
        });

        // Actualizar UI local
        this.updateUI();
    },

    updateUI() {
        const me = this.state.getLocalPlayer();
        if(!me) return;

        document.getElementById('money').innerText = me.money;
        document.getElementById('shovel-name').innerText = this.state.shovels[me.shovelType].n;
        
        const invList = document.getElementById('inventory-list');
        invList.innerHTML = '';
        me.inventory.forEach(item => {
            const li = document.createElement('li');
            li.innerText = `${item.n} (+${item.v} PE)`;
            invList.appendChild(li);
        });
    },

    // --- INTERACCIÓN USUARIO ---
    handleAreaClick(e) {
        if(this.isMining) return; // Bloquear movimiento mientras excavas
        
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left - 20; // Centrar el icono
        const y = e.clientY - rect.top - 20;

        const updatedPlayer = this.state.updatePosition(x, y);
        
        // Enviar posición a otros
        this.net.sendAction('UPDATE_POS', { player: updatedPlayer });
        
        // Render inmediato local
        this.render();
    },

    toggleMining() {
        if(this.isMining) {
            this.stopMining();
        } else {
            this.startMining();
        }
    },

    startMining() {
        this.isMining = true;
        document.getElementById('mining-bar').style.display = 'block';
        document.getElementById('btn-dig').innerText = "❌ Cancelar";
        
        this.cursorPos = 0;
        this.cursorDir = 1;
        
        this.miningInterval = setInterval(() => {
            this.cursorPos += 5 * this.cursorDir;
            if(this.cursorPos > 290 || this.cursorPos < 0) this.cursorDir *= -1;
            document.getElementById('cursor').style.left = this.cursorPos + 'px';
        }, 20);
    },

    stopMining() {
        clearInterval(this.miningInterval);
        this.isMining = false;
        document.getElementById('mining-bar').style.display = 'none';
        document.getElementById('btn-dig').innerText = "⛏️ Excavar";
        
        // Verificar éxito
        // Zona verde: 125 a 175 (centrado en 150 +/- 25)
        if(this.cursorPos >= 125 && this.cursorPos <= 175) {
            const loot = this.state.performMineSuccess();
            if(loot) {
                alert(`¡Encontraste ${loot.n}! Valor: ${loot.v} PE`);
                // Opcional: Notificar a otros que encontraste algo (efectos visuales)
            }
        } else {
            alert("Fallaste... la tierra estaba dura.");
        }
        this.render(); // Refrescar inventario/money
    },

    sellItem() {
        if(this.state.sellLastItem()) {
            this.render();
        } else {
            alert("No tienes tesoros para vender.");
        }
    },

    buyShovel(type) {
        if(this.state.buyShovel(type)) {
            this.render();
        } else {
            alert("No tienes suficiente dinero o ya tienes esa pala.");
        }
    },

    // --- EVENTOS DE RED RECIBIDOS ---
    handleNetworkEvent(type, data) {
        switch(type) {
            case 'POSITION_UPDATE':
                // Ya se procesó en GameState, solo fuerza re-render si queremos suavidad extra
                break;
            case 'SYNC_COMPLETE':
                console.log("Estado inicial recibido");
                break;
            case 'PLAYER_REMOVED':
                console.log("Un jugador salió");
                break;
        }
    }
};

// Inicializar al cargar la página
window.onload = () => {
    app.init();
};
