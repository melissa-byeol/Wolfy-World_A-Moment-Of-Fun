/**
 * WOLFY WORLD - FOODY CHAOS ENGINE v3 (Grid Based)
 * Exploración top-down con mapas JSON y gestión de inventario por capacidad.
 */

const FoodyEngine = (function() {
    // --- CONFIGURACIÓN DEL MOTOR ---
    const TILE_SIZE = 40; // Tamaño visual de cada celda en px
    const VIEWPORT_W = 600; // Ancho visible del canvas
    const VIEWPORT_H = 400; // Alto visible del canvas
    
    // Tipos de Tiles
    const TILES = {
        EMPTY: 0,
        WALL: 1,
        SHELF_SNACK: 2,
        SHELF_DRINK: 3,
        SHELF_FRESH: 4,
        EXIT_DOOR: 9
    };

    // Estado Runtime
    let isActive = false;
    let currentMap = null;
    let playerPos = { x: 1, y: 1 }; // Posición en grid
    let cameraOffset = { x: 0, y: 0 };
    let teamStats = []; // Array de objetos { id, name, capacity, eaten }
    
    // DOM Elements
    let canvas = null;
    let ctx = null;
    let uiContainer = null; // Donde pintamos menús contextuales HTML
    
    // Input State
    const keysPressed = new Set();
    let moveTimer = 0;
    const MOVE_COOLDOWN = 150; // ms entre movimientos

    /**
     * Inicializa el motor con una instancia de GameState externa
     */
    function init(gsInstance, containerId) {
        if (!gsInstance) return console.error("GameState no proporcionado");
        
        // Crear Canvas si no existe
        let root = document.getElementById(containerId);
        if(!root) {
            root = document.createElement('div');
            root.id = containerId;
            document.body.appendChild(root);
        }

        canvas = document.createElement('canvas');
        canvas.width = VIEWPORT_W;
        canvas.height = VIEWPORT_H;
        canvas.style.background = '#1a1a2e';
        canvas.style.borderRadius = '8px';
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto';
        root.innerHTML = ''; // Limpiar anterior
        root.appendChild(canvas);
        
        ctx = canvas.getContext('2d');
        
        // Contenedor para UI HTML (menús contextuales)
        uiContainer = document.createElement('div');
        uiContainer.className = 'foody-ui-layer';
        root.appendChild(uiContainer);

        // Cargar Mapa Demo
        loadMap('maps/pantry_level_1.json', gsInstance);
        
        setupInputListeners();
    }

    /**
     * Carga un mapa desde JSON y prepara al equipo
     */
    async function loadMap(mapUrl, gsInstance) {
        try {
            const res = await fetch(mapUrl);
            if(!res.ok) throw new Error(`No encontrado: ${mapUrl}`);
            const data = await res.json();
            
            currentMap = data;
            
            // Preparar Equipo basado en GS.equippedCards
            teamStats = gsInstance.equippedCards.map(cardId => {
                const record = gsInstance.getCardRecord(cardId);
                const catalog = CARD_MAP[cardId];
                
                // Fórmula de Capacidad: Base + (RangoIndex * 10) + (Level * 2)
                // Ejemplo: B Lvl 1 = 10kg. MR Lvl 70 = ~150kg.
                const rankIdx = RANK_ORDER.indexOf(record.rank);
                const baseCap = 10;
                const cap = baseCap + (rankIdx * 10) + (record.level * 2);
                
                return {
                    id: cardId,
                    name: catalog ? catalog.displayName : cardId,
                    maxCapacity: cap,
                    currentLoad: 0, // kg comidos/llevados
                    color: getRankColor(record.rank)
                };
            });

            // Resetear posición al inicio definido en el mapa
            playerPos = { ...data.startPos || {x:1, y:1} };
            
            renderLoop(); // Dibujar primer frame
            
        } catch(e) {
            console.error("Error cargando mapa:", e);
            alert("No se pudo cargar el mapa. ¿Existe la carpeta /maps/?");
        }
    }

    function getRankColor(rank) {
        const colors = { 'B':'#9fb8ff', 'A':'#7fffb1', 'S':'#ffd57f', 'R':'#ff9fb2', 'XR':'#c97fff', 'UR':'#ffad4a', 'MR':'#ffd700' };
        return colors[rank] || '#fff';
    }

    // --- LÓGICA DE MOVIMIENTO Y CÁMARA ---
    function update(dt) {
        if (!isActive) return;

        // Movimiento suave con cooldown
        moveTimer += dt;
        if (moveTimer >= MOVE_COOLDOWN) {
            let dx = 0, dy = 0;
            if (keysPressed.has('w') || keysPressed.has('arrowup')) dy = -1;
            if (keysPressed.has('s') || keysPressed.has('arrowdown')) dy = 1;
            if (keysPressed.has('a') || keysPressed.has('arrowleft')) dx = -1;
            if (keysPressed.has('d') || keysPressed.has('arrowright')) dx = 1;

            if (dx !== 0 || dy !== 0) {
                const nx = playerPos.x + dx;
                const ny = playerPos.y + dy;
                
                if (isWalkable(nx, ny)) {
                    playerPos.x = nx;
                    playerPos.y = ny;
                    moveTimer = 0; // Reset cooldown
                    
                    checkInteraction(); // Ver si chocamos con algo interactuable
                }
            }
        }

        // Actualizar Cámara (Centrar jugador)
        // La cámara muestra el tile central alrededor del jugador
        cameraOffset.x = (playerPos.x * TILE_SIZE) - (VIEWPORT_W / 2) + (TILE_SIZE / 2);
        cameraOffset.y = (playerPos.y * TILE_SIZE) - (VIEWPORT_H / 2) + (TILE_SIZE / 2);
        
        // Clampear cámara a bordes del mapa
        const mapPxW = currentMap.grid[0].length * TILE_SIZE;
        const mapPxH = currentMap.grid.length * TILE_SIZE;
        
        if(cameraOffset.x < 0) cameraOffset.x = 0;
        if(cameraOffset.y < 0) cameraOffset.y = 0;
        if(cameraOffset.x > mapPxW - VIEWPORT_W) cameraOffset.x = Math.max(0, mapPxW - VIEWPORT_W);
        if(cameraOffset.y > mapPxH - VIEWPORT_H) cameraOffset.y = Math.max(0, mapPxH - VIEWPORT_H);
    }

    function isWalkable(x, y) {
        if (y < 0 || y >= currentMap.grid.length) return false;
        if (x < 0 || x >= currentMap.grid[0].length) return false;
        
        const tileType = currentMap.grid[y][x];
        // Solo vacíos o salidas son transitables (las estanterías bloquean pero son interactivas)
        return tileType === TILES.EMPTY || tileType === TILES.EXIT_DOOR;
    }

    function checkInteraction() {
        // Mirar hacia dónde está mirando el jugador? 
        // Simplificación: Interactuar con adyacentes si hay tecla E presionada recientemente
        // Por ahora, mostraremos opciones si estamos JUNTO a una estantería
        
        const adjacentTiles = [
            {x: playerPos.x+1, y: playerPos.y},
            {x: playerPos.x-1, y: playerPos.y},
            {x: playerPos.x, y: playerPos.y+1},
            {x: playerPos.x, y: playerPos.y-1}
        ];

        let foundShelf = null;
        for(const pos of adjacentTiles) {
            if(pos.y >= 0 && pos.y < currentMap.grid.length && pos.x >= 0 && pos.x < currentMap.grid[0].length) {
                const t = currentMap.grid[pos.y][pos.x];
                if(t >= 2 && t <= 4) { // Es estantería
                    foundShelf = { x: pos.x, y: pos.y, type: t };
                    break;
                }
            }
        }

        if(foundShelf) {
            showContextMenu(foundShelf);
        } else {
            hideContextMenu();
        }
    }

    // --- RENDERIZADO CANVAS ---
    function draw() {
        if(!ctx || !currentMap) return;
        
        ctx.clearRect(0, 0, VIEWPORT_W, VIEWPORT_H);
        
        // Calcular rango de tiles visibles
        const startX = Math.floor(cameraOffset.x / TILE_SIZE);
        const startY = Math.floor(cameraOffset.y / TILE_SIZE);
        const endX = Math.ceil((cameraOffset.x + VIEWPORT_W) / TILE_SIZE);
        const endY = Math.ceil((cameraOffset.y + VIEWPORT_H) / TILE_SIZE);

        // Dibujar Grid
        for(let y = startY; y <= endY; y++) {
            for(let x = startX; x <= endX; x++) {
                if(y < 0 || y >= currentMap.grid.length || x < 0 || x >= currentMap.grid[0].length) continue;
                
                const tileType = currentMap.grid[y][x];
                const screenX = (x * TILE_SIZE) - cameraOffset.x;
                const screenY = (y * TILE_SIZE) - cameraOffset.y;

                drawTile(ctx, screenX, screenY, tileType, x, y);
            }
        }

        // Dibujar Jugador (Líder del equipo)
        const pScreenX = (playerPos.x * TILE_SIZE) - cameraOffset.x;
        const pScreenY = (playerPos.y * TILE_SIZE) - cameraOffset.y;
        
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(pScreenX + TILE_SIZE/2, pScreenY + TILE_SIZE/2, TILE_SIZE/3, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Indicador de "Comiendo" si tiene carga alta
        if(teamStats.length > 0) {
             const avgLoad = teamStats.reduce((acc, s) => acc + (s.currentLoad/s.maxCapacity), 0) / teamStats.length;
             if(avgLoad > 0.8) {
                 ctx.fillStyle = "red";
                 ctx.font = "10px Arial";
                 ctx.fillText("😵", pScreenX + 5, pScreenY - 5);
             }
        }
    }

    function drawTile(c, sx, sy, type, gx, gy) {
        // Fondo suelo
        c.fillStyle = (gx + gy) % 2 === 0 ? "#2a2d42" : "#222538";
        c.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);

        switch(type) {
            case TILES.WALL:
                c.fillStyle = "#111";
                c.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
                c.strokeStyle = "#333";
                c.strokeRect(sx, sy, TILE_SIZE, TILE_SIZE);
                break;
            case TILES.SHELF_SNACK:
                drawShelf(c, sx, sy, "🍿", "#ffcc80");
                break;
            case TILES.SHELF_DRINK:
                drawShelf(c, sx, sy, "🥤", "#82b1ff");
                break;
            case TILES.SHELF_FRESH:
                drawShelf(c, sx, sy, "🍎", "#69f0ae");
                break;
            case TILES.EXIT_DOOR:
                c.fillStyle = "#ffd700";
                c.fillRect(sx + 5, sy + 5, TILE_SIZE - 10, TILE_SIZE - 10);
                c.fillStyle = "#000";
                c.font = "bold 12px Arial";
                c.textAlign = "center";
                c.fillText("EXIT", sx + TILE_SIZE/2, sy + TILE_SIZE/2 + 4);
                break;
        }
    }

    function drawShelf(c, sx, sy, emoji, color) {
        c.fillStyle = color;
        c.globalAlpha = 0.3;
        c.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
        c.globalAlpha = 1.0;
        
        c.font = "20px Arial";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText(emoji, sx + TILE_SIZE/2, sy + TILE_SIZE/2);
        
        c.strokeStyle = "#fff";
        c.lineWidth = 1;
        c.strokeRect(sx+2, sy+2, TILE_SIZE-4, TILE_SIZE-4);
    }

    // --- UI CONTEXTUAL (HTML Overlay) ---
    function showContextMenu(shelfInfo) {
        if(!uiContainer) return;
        
        // Determinar contenido según tipo de estantería
        let items = [];
        if(shelfInfo.type === TILES.SHELF_SNACK) items = [{name:"Chips", weight: 0.5, val: 10}, {name:"Galletas", weight: 0.3, val: 15}];
        if(shelfInfo.type === TILES.SHELF_DRINK) items = [{name:"Agua", weight: 1.0, val: 5}, {name:"Refresco", weight: 0.8, val: 20}];
        if(shelfInfo.type === TILES.SHELF_FRESH) items = [{name:"Manzana", weight: 0.2, val: 25}, {name:"Pollo", weight: 1.5, val: 50}];

        let html = `<div class="context-menu">
            <h4>Estantería</h4>
            <ul>`;
            
        items.forEach(item => {
            // Verificar si ALGÚN miembro del equipo tiene espacio
            const canFit = teamStats.some(s => (s.currentLoad + item.weight) <= s.maxCapacity);
            
            html += `<li>
                <span>${item.name} (${item.weight}kg)</span>
                <button onclick="window.FoodyAPI.takeItem(${item.weight}, ${item.val})" ${!canFit ? 'disabled style="opacity:0.5"' : ''}>
                    Llevar (+${item.val} pts)
                </button>
            </li>`;
        });
        
        html += `</ul>
        <button class="secondary" onclick="window.FoodyAPI.closeMenu()">Cerrar</button>
        </div>`;
        
        uiContainer.innerHTML = html;
    }

    function hideContextMenu() {
        if(uiContainer) uiContainer.innerHTML = '';
    }

    // --- API PARA BOTONES HTML ---
    window.FoodyAPI = {
        takeItem: (weight, value) => {
            // Asignar peso al primer lobo con espacio disponible
            let assigned = false;
            for(let member of teamStats) {
                if(member.currentLoad + weight <= member.maxCapacity) {
                    member.currentLoad += weight;
                    assigned = true;
                    break;
                }
            }
            
            if(assigned) {
                // Sumar puntos globales (simulación score)
                // En un juego real, esto actualizaría un contador global
                console.log(`Equipo llevó ${weight}kg. Ganancia: ${value}`);
                hideContextMenu();
                renderLoop(); // Refrescar visual
                
                // Feedback visual simple
                const msg = document.createElement('div');
                msg.textContent = `+${value} PTS`;
                msg.style.position = 'absolute';
                msg.style.left = '50%';
                msg.style.top = '50%';
                msg.style.color = '#ffd700';
                msg.style.fontWeight = 'bold';
                msg.style.transform = 'translate(-50%, -50%)';
                msg.style.pointerEvents = 'none';
                msg.style.animation = 'fadeUp 1s forwards';
                document.body.appendChild(msg);
                setTimeout(() => msg.remove(), 1000);
            } else {
                alert("¡Todo el equipo está lleno! No pueden llevar más.");
            }
        },
        closeMenu: () => hideContextMenu(),
        startGame: () => { isActive = true; lastTime = performance.now(); requestAnimationFrame(gameLoop); },
        stopGame: () => { isActive = false; }
    };

    // --- LOOP PRINCIPAL ---
    let lastTime = 0;
    function gameLoop(timestamp) {
        if(!isActive) return;
        const dt = timestamp - lastTime;
        lastTime = timestamp;
        
        update(dt);
        draw();
        
        requestAnimationFrame(gameLoop);
    }
    
    function renderLoop() {
         // Solo dibujar un frame cuando algo cambia externamente (ej: menú cerrado)
         draw();
    }

    // --- INPUT LISTENERS ---
    function setupInputListeners() {
        window.addEventListener('keydown', (e) => {
            keysPressed.add(e.key.toLowerCase());
        });
        window.addEventListener('keyup', (e) => {
            keysPressed.delete(e.key.toLowerCase());
        });
    }

    return { init };
})();

window.FoodyEngine = FoodyEngine;
