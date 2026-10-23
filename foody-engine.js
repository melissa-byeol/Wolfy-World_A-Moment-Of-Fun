/**
 * WOLFY WORLD - FOODY ENGINE v1
 * Motor Top-Down para Foody Chaos.
 */

const FoodyEngine = (function() {
    // --- ESTADO INTERNO ---
    let canvas, ctx;
    let isActive = false;
    let lastTime = 0;
    
    // Mapa simple generado proceduralmente o cargado
    // 0: Piso, 1: Pared, 2: Estante Snacks, 3: Estante Drinks, 4: Estante Fresh
    let mapGrid = [];
    const MAP_WIDTH = 15;
    const MAP_HEIGHT = 10;
    
    // Jugador
    let player = {
        x: 1, y: 1, // Posición en grid
        speed: 0.15, // Velocidad de interpolación visual
        visualX: 40, visualY: 40, // Posición pixel actual para suavizado
        direction: 'down'
    };

    // Equipo (Instancias activas durante la partida)
    // Se poblará desde GameState.getFoodyStats() al iniciar
    let teamMembers = []; 

    // Items en pantalla
    let activeItems = []; 
    
    // Temporizador
    let timeLeft = 0;
    let spawnTimer = 0;

    // UI References
    let uiElements = {};

    /**
     * INICIALIZACIÓN
     * @param {string} containerId - ID del div contenedor
     * @param {object} gsInstance - Instancia de GameState para leer cartas equipadas
     */
    function init(containerId, gsInstance) {
        const container = document.getElementById(containerId);
        if (!container) return console.error("Contenedor no encontrado");

        // Crear Canvas si no existe
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.width = MAP_WIDTH * FOODY_CONFIG.TILE_SIZE;
            canvas.height = MAP_HEIGHT * FOODY_CONFIG.TILE_SIZE;
            canvas.style.background = '#1a1a2e';
            canvas.style.borderRadius = '8px';
            canvas.style.display = 'block';
            container.appendChild(canvas);
            ctx = canvas.getContext('2d');
        } else {
            container.innerHTML = ''; // Limpiar reinicio
            container.appendChild(canvas);
        }

        // Generar Mapa Aleatorio Simple
        generateMap();

        // Preparar Equipo desde GameState
        prepareTeam(gsInstance);

        // Resetear Estado
        resetGame();
        
        // Bindings de Input
        setupInput();
        
        // Iniciar Loop
        requestAnimationFrame(gameLoop);
    }

    function generateMap() {
        mapGrid = [];
        for(let y=0; y<MAP_HEIGHT; y++) {
            let row = [];
            for(let x=0; x<MAP_WIDTH; x++) {
                // Bordes son paredes
                if(x===0 || x===MAP_WIDTH-1 || y===0 || y===MAP_HEIGHT-1) {
                    row.push(1); 
                } else {
                    // Interior: Chance de tener estante
                    const rand = Math.random();
                    if(rand > 0.85) row.push(2); // Snack
                    else if(rand > 0.70) row.push(3); // Drink
                    else if(rand > 0.55) row.push(4); // Fresh
                    else row.push(0); // Vacío
                }
            }
            mapGrid.push(row);
        }
        // Asegurar inicio despejado
        mapGrid[1][1] = 0;
        mapGrid[1][2] = 0;
        mapGrid[2][1] = 0;
    }

    function prepareTeam(gs) {
        teamMembers = [];
        if(!gs || !gs.equippedCards || gs.equippedCards.length === 0) {
            // Si no hay equipo, ponemos un dummy básico para probar
            teamMembers.push({
                name: "Lobito Solo",
                capacity: 100,
                currentLoad: 0,
                color: "#fff"
            });
            return;
        }

        gs.equippedCards.forEach(id => {
            const stats = gs.getFoodyStats(id);
            if(stats) {
                teamMembers.push({
                    id: id,
                    name: stats.roleName + " (" + id.split('_')[0] + ")",
                    capacity: stats.capacity,
                    currentLoad: 0,
                    special: stats.special,
                    color: getRankColor(stats.rank || 'B') // Necesitamos rank aquí, asumimos B si falla
                });
            }
        });
    }

    function getRankColor(rank) {
        const colors = { 'B':'#9fb8ff', 'A':'#7fffb1', 'S':'#ffd57f', 'R':'#ff9fb2', 'XR':'#c97fff', 'UR':'#ffad4a', 'MR':'#ffd700' };
        return colors[rank] || '#fff';
    }

    function resetGame() {
        isActive = true;
        timeLeft = FOODY_CONFIG.GAME_DURATION_SECONDS;
        player.x = 1; player.y = 1;
        player.visualX = player.x * FOODY_CONFIG.TILE_SIZE;
        player.visualY = player.y * FOODY_CONFIG.TILE_SIZE;
        activeItems = [];
        teamMembers.forEach(m => m.currentLoad = 0);
        updateHUD();
    }

    // --- INPUT HANDLING ---
    const keys = new Set();
    function setupInput() {
        window.addEventListener('keydown', e => keys.add(e.key.toLowerCase()));
        window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
        
        // Interacción con ESPACIO o ENTER
        window.addEventListener('keydown', e => {
            if((e.code === 'Space' || e.code === 'Enter') && isActive) {
                interactWithAdjacentShelf();
            }
        });
    }

    // --- LÓGICA PRINCIPAL ---
    function gameLoop(timestamp) {
        if(!isActive) return;
        
        const dt = timestamp - lastTime;
        lastTime = timestamp;

        update(dt);
        draw();

        requestAnimationFrame(gameLoop);
    }

    function update(dt) {
        // 1. Movimiento Suave
        const targetX = player.x * FOODY_CONFIG.TILE_SIZE;
        const targetY = player.y * FOODY_CONFIG.TILE_SIZE;
        
        // Interpolación lineal simple (lerp)
        player.visualX += (targetX - player.visualX) * 0.2;
        player.visualY += (targetY - player.visualY) * 0.2;

        // 2. Detección de Colisiones / Movimiento Grid
        let moved = false;
        if(keys.has('w') || keys.has('arrowup')) { tryMove(0, -1); moved=true; }
        else if(keys.has('s') || keys.has('arrowdown')) { tryMove(0, 1); moved=true; }
        else if(keys.has('a') || keys.has('arrowleft')) { tryMove(-1, 0); moved=true; }
        else if(keys.has('d') || keys.has('arrowright')) { tryMove(1, 0); moved=true; }

        if(moved) {
            // Pequeño delay para evitar deslizamiento infinito si mantienes tecla
            // En este modelo simple, solo se mueve si cambia la tecla o hay cooldown
            // Para simplificar: permitimos movimiento continuo pero lento
        }

        // 3. Spawning de Comida
        spawnTimer += dt;
        if(spawnTimer > FOODY_CONFIG.SPAWN_RATE_MS) {
            spawnFoodItem();
            spawnTimer = 0;
        }

        // 4. Timer del Juego
        timeLeft -= dt / 1000;
        if(timeLeft <= 0) {
            endGame();
        }
        
        updateHUD();
    }

    function tryMove(dx, dy) {
        const nx = player.x + dx;
        const ny = player.y + dy;

        // Verificar límites
        if(nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) return;

        const tileType = mapGrid[ny][nx];
        
        // Solo moverse si es piso (0) o salida (9)
        if(tileType === 0) {
            player.x = nx;
            player.y = ny;
        }
        // Si es pared (1) o estante (2,3,4), NO nos movemos encima, pero podemos interactuar si estamos adyacentes
    }

    function interactWithAdjacentShelf() {
        // Buscar estantes adyacentes
        const dirs = [[0,-1], [0,1], [-1,0], [1,0]];
        let foundShelf = null;
        let shelfType = 0;

        for(let d of dirs) {
            const tx = player.x + d[0];
            const ty = player.y + d[1];
            
            if(tx>=0 && tx<MAP_WIDTH && ty>=0 && ty<MAP_HEIGHT) {
                const t = mapGrid[ty][tx];
                if(t >= 2 && t <= 4) {
                    foundShelf = {x: tx, y: ty};
                    shelfType = t;
                    break; // Tomamos el primero que encontremos
                }
            }
        }

        if(foundShelf) {
            openInteractionMenu(shelfType);
        }
    }

    function spawnFoodItem() {
        if(activeItems.length >= FOODY_CONFIG.MAX_ITEMS_ON_SCREEN) return;

        // Elegir tipo aleatorio basado en qué estantes hay cerca? 
        // Por ahora, spawn global en cualquier celda vacía lejana al jugador
        const emptyCells = [];
        for(let y=1; y<MAP_HEIGHT-1; y++){
            for(let x=1; x<MAP_WIDTH-1; x++){
                if(mapGrid[y][x] === 0) {
                    // Evitar spawn muy cerca del jugador
                    const dist = Math.abs(x-player.x) + Math.abs(y-player.y);
                    if(dist > 2) emptyCells.push({x,y});
                }
            }
        }

        if(emptyCells.length === 0) return;

        const cell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        
        // Elegir item aleatorio
        const itemData = FOOD_ITEMS[Math.floor(Math.random() * FOOD_ITEMS.length)];
        
        activeItems.push({
            ...itemData,
            gridX: cell.x,
            gridY: cell.y,
            visualX: cell.x * FOODY_CONFIG.TILE_SIZE,
            visualY: cell.y * FOODY_CONFIG.TILE_SIZE,
            collected: false
        });
    }

    // --- RENDERIZADO ---
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1. Dibujar Mapa
        for(let y=0; y<MAP_HEIGHT; y++) {
            for(let x=0; x<MAP_WIDTH; x++) {
                const t = mapGrid[y][x];
                const px = x * FOODY_CONFIG.TILE_SIZE;
                const py = y * FOODY_CONFIG.TILE_SIZE;

                if(t === 1) { // Pared
                    ctx.fillStyle = '#2c3e50';
                    ctx.fillRect(px, py, FOODY_CONFIG.TILE_SIZE, FOODY_CONFIG.TILE_SIZE);
                } else if(t >= 2 && t <= 4) { // Estante
                    drawShelf(ctx, px, py, t);
                } else { // Piso
                    ctx.fillStyle = (x+y)%2===0 ? '#1e272e' : '#2d3436';
                    ctx.fillRect(px, py, FOODY_CONFIG.TILE_SIZE, FOODY_CONFIG.TILE_SIZE);
                }
            }
        }

        // 2. Dibujar Items
        activeItems.forEach(item => {
            if(item.collected) return;
            ctx.font = "24px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(item.emoji, item.visualX + 20, item.visualY + 20);
        });

        // 3. Dibujar Jugador
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(player.visualX + 20, player.visualY + 20, 15, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Indicador de dirección simple
        ctx.fillStyle = "yellow";
        ctx.beginPath();
        ctx.arc(player.visualX + 20, player.visualY + 20, 5, 0, Math.PI*2);
        ctx.fill();
    }

    function drawShelf(c, x, y, type) {
        c.fillStyle = "#34495e";
        c.fillRect(x, y, FOODY_CONFIG.TILE_SIZE, FOODY_CONFIG.TILE_SIZE);
        c.strokeStyle = "#7f8c8d";
        c.strokeRect(x+2, y+2, FOODY_CONFIG.TILE_SIZE-4, FOODY_CONFIG.TILE_SIZE-4);
        
        c.font = "16px Arial";
        c.textAlign = "center";
        c.textBaseline = "middle";
        let icon = "?";
        if(type === 2) icon = "🍿"; // Snack
        if(type === 3) icon = "🥤"; // Drink
        if(type === 4) icon = "🍎"; // Fresh
        c.fillText(icon, x + 20, y + 20);
    }

    // --- UI & MENÚS ---
    function openInteractionMenu(shelfType) {
        // Filtrar items por tipo de estante
        let availableItems = [];
        if(shelfType === 2) availableItems = FOOD_ITEMS.filter(i => i.type === 'snack');
        if(shelfType === 3) availableItems = FOOD_ITEMS.filter(i => i.type === 'drink');
        if(shelfType === 4) availableItems = FOOD_ITEMS.filter(i => i.type === 'fresh' || i.type === 'dessert');

        if(availableItems.length === 0) return;

        // Crear overlay HTML temporal
        const menu = document.createElement('div');
        menu.className = 'foody-context-menu';
        menu.style.position = 'absolute';
        menu.style.bottom = '20px';
        menu.style.left = '50%';
        menu.style.transform = 'translateX(-50%)';
        menu.style.background = 'rgba(0,0,0,0.9)';
        menu.style.padding = '15px';
        menu.style.borderRadius = '10px';
        menu.style.color = 'white';
        menu.style.zIndex = '1000';
        menu.style.minWidth = '200px';

        let html = `<h4 style="margin:0 0 10px 0; color:#ffd700;">¿Qué llevar?</h4><ul style="list-style:none;padding:0;margin:0;">`;
        
        availableItems.forEach(item => {
            // Verificar si ALGUIEN del equipo tiene espacio
            const canFit = teamMembers.some(m => (m.currentLoad + item.weight) <= m.capacity);
            
            html += `
                <li style="display:flex; justify-content:space-between; align-items:center; padding:5px 0; border-bottom:1px solid #333;">
                    <span>${item.emoji} ${item.name} (${item.weight}kg)</span>
                    <button onclick="window.FoodyAPI.pickUp('${item.id}', ${item.weight}, ${item.value})" 
                            style="padding:2px 8px; font-size:0.8rem;" 
                            ${!canFit ? 'disabled style="opacity:0.5"' : ''}>
                        Llevar
                    </button>
                </li>
            `;
        });
        
        html += `</ul><button onclick="this.parentElement.remove()" style="margin-top:10px; width:100%; background:#e74c3c;">Cerrar</button>`;
        
        menu.innerHTML = html;
        document.body.appendChild(menu);
        
        // Auto-cerrar si se mueve el jugador
        setTimeout(() => {
            if(menu.parentElement) menu.remove();
        }, 5000);
    }

    // API Global para botones HTML
    window.FoodyAPI = {
        pickUp: (itemId, weight, value) => {
            // Asignar al primer miembro con espacio
            for(let member of teamMembers) {
                if(member.currentLoad + weight <= member.capacity) {
                    member.currentLoad += weight;
                    
                    // Remover item del suelo si existe físicamente ahí (opcional, por ahora solo suma puntos/peso)
                    // En esta versión simplificada, "llevar" consume stock virtual del estante
                    
                    alert(`¡${member.name} llevó ${itemId}! (+${value} pts potenciales)`);
                    
                    // Cerrar menú
                    const menus = document.querySelectorAll('.foody-context-menu');
                    menus.forEach(m => m.remove());
                    
                    updateHUD();
                    return;
                }
            }
            alert("¡Todo el equipo está lleno!");
        }
    };

    function updateHUD() {
        // Actualizar barra lateral o inferior si existe
        const hud = document.getElementById('foody-team-hud');
        if(!hud) return;
        
        hud.innerHTML = '';
        teamMembers.forEach(m => {
            const pct = Math.min(100, (m.currentLoad / m.capacity) * 100);
            const barColor = pct > 90 ? '#e74c3c' : (pct > 70 ? '#f1c40f' : '#2ecc71');
            
            const div = document.createElement('div');
            div.style.marginBottom = '5px';
            div.innerHTML = `
                <div style="font-size:0.8em; display:flex; justify-content:space-between;">
                    <span>${m.name}</span>
                    <span>${m.currentLoad.toFixed(1)} / ${m.capacity} kg</span>
                </div>
                <div style="height:6px; background:#333; border-radius:3px; overflow:hidden;">
                    <div style="width:${pct}%; height:100%; background:${barColor}; transition:width 0.3s;"></div>
                </div>
            `;
            hud.appendChild(div);
        });
    }

    function endGame() {
        isActive = false;
        
        // Calcular recompensas
        let totalValue = 0;
        teamMembers.forEach(m => {
            // Simplificación: El valor es proporcional a lo cargado
            // Idealmente deberíamos rastrear qué items específicos tomó cada uno
            totalValue += m.currentLoad * 10; // 10 puntos por kg cargado
        });

        const earnedCoins = Math.floor(totalValue / 10);
        
        // Mostrar resultados
        const resBox = document.getElementById('fd-results');
        if(resBox) {
            resBox.classList.remove('hidden');
            resBox.innerHTML = `
                <h3>¡Tiempo Agotado!</h3>
                <p>Carga Total: <b>${teamMembers.reduce((a,b)=>a+b.currentLoad,0).toFixed(1)} kg</b></p>
                <p>Recompensa: <b>+${earnedCoins} 🪙 Monedas Foody</b></p>
                <button onclick="document.getElementById('fd-results').classList.add('hidden')">Aceptar</button>
            `;
        }
        
        // Guardar progreso en localStorage específico de Foody
        const saveData = {
            coins: (JSON.parse(localStorage.getItem('wolfy_foody_save')||'{}').coins || 0) + earnedCoins,
            highScore: Math.max((JSON.parse(localStorage.getItem('wolfy_foody_save')||'{}').highScore || 0), totalValue)
        };
        localStorage.setItem('wolfy_foody_save', JSON.stringify(saveData));
    }

    return { init };
})();

window.FoodyEngine = FoodyEngine;
