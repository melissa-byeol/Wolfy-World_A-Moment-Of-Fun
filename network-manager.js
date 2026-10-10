class NetworkManager {
    constructor(gameState) {
        this.gameState = gameState;
        this.peer = null;
        this.conns = []; // Conexiones activas (Host)
        this.conn = null; // Mi conexión (Cliente)
        this.isHost = false;
        this.roomCode = "";
        this.onMessageCallback = null; // Función que llama main.js cuando llega data
    }

    init(mode, roomCode, username, onReady, onError) {
        this.roomCode = roomCode.toUpperCase();
        this.mode = mode; // 'p2p' or 'server'
        
        if (mode === 'p2p') {
            this.initP2P(username, onReady, onError);
        } else {
            this.initWebSocket(onReady, onError);
        }
    }

    // --- MODO P2P (PeerJS) ---
    initP2P(username, onReady, onError) {
        // Si somos host, creamos un ID fijo basado en sala + sufijo HOST
        // Si nos unimos, buscamos ese ID
        
        // Para simplificar este demo, asumiremos que el primer clic decide Host/Join 
        // O podemos tener dos botones. Aquí usaremos una heurística:
        // Intentamos conectar primero. Si falla tras timeout, intentamos ser Host.
        // MEJOR ENFOQUE PARA DEMO: Botón separado o detección automática.
        // Vamos a asumir que si llamas a startGame(), decides rol antes.
        
        // NOTA: En producción real, necesitarías un signaling server o lista de hosts conocidos.
        // Para este ejemplo local, haremos que el usuario elija rol en HTML (no lo mostré arriba para ahorrar espacio, 
        // pero asume que hay un selector Host/Join). 
        
        // Simulación rápida: Si no hay nadie conectado, eres Host.
        // Pero PeerJS requiere IDs únicos. 
        // Estrategia: ID = "wolfy-" + ROOMCODE. Quien obtiene el lock es Host.
        
        const peerId = "wolfy-" + this.roomCode;
        
        this.peer = new Peer(peerId);
        
        this.peer.on('open', () => {
            console.log("Connected to PeerJS cloud");
            this.isHost = true; // Asumimos que ganamos la carrera por el ID
            
            // Escuchar conexiones entrantes
            this.peer.on('connection', (conn) => {
                this.handleIncomingConn(conn);
            });
            
            onReady(true); // Notificar que estamos listos como Host
        });

        this.peer.on('error', (err) => {
            if(err.type === 'unavailable-id') {
                // Alguien más ya es host, así que somos cliente
                this.joinAsClient(peerId, onReady, onError);
            } else {
                onError(err);
            }
        });
    }

    joinAsClient(hostId, onReady, onError) {
        this.isHost = false;
        this.peer = new Peer(); // Cliente con ID random
        
        this.peer.on('open', () => {
            this.conn = this.peer.connect(hostId);
            
            this.conn.on('open', () => {
                console.log("Joined host!");
                onReady(false);
                
                // Recibir datos iniciales
                this.conn.on('data', (data) => {
                    this.processNetworkData(data);
                });
            });
            
            this.conn.on('error', onError);
        });
    }

    handleIncomingConn(conn) {
        conn.on('open', () => {
            this.conns.push(conn);
            console.log(`New player joined: ${conn.peer}`);
            
            // Enviar estado actual a nuevo jugador
            conn.send({
                type: 'INIT_STATE',
                players: this.gameState.getAllPlayersArray(),
                hostId: this.peer.id
            });
        });

        conn.on('data', (data) => {
            this.processNetworkData(data);
        });

        conn.on('close', () => {
            this.conns = this.conns.filter(c => c !== conn);
            // Notificar salida de jugador
            this.broadcast({ type: 'PLAYER_LEFT', playerId: conn.peer });
        });
    }

    processNetworkData(data) {
        if (data.type === 'UPDATE_POS') {
            this.gameState.syncRemotePlayer(data.player);
            if(this.onMessageCallback) this.onMessageCallback('POSITION_UPDATE', data.player);
        }
        else if (data.type === 'INIT_STATE') {
            // Inicializar todos los jugadores remotos
            data.players.forEach(p => {
                if(p.id !== this.gameState.localPlayerId) {
                    this.gameState.syncRemotePlayer(p);
                }
            });
             if(this.onMessageCallback) this.onMessageCallback('SYNC_COMPLETE');
        }
        else if (data.type === 'PLAYER_LEFT') {
            delete this.gameState.players[data.playerId];
             if(this.onMessageCallback) this.onMessageCallback('PLAYER_REMOVED', data.playerId);
        }
    }

    broadcast(message) {
        if (this.isHost) {
            this.conns.forEach(c => c.send(message));
        } else {
            if(this.conn) this.conn.send(message);
        }
    }

    sendAction(actionType, payload) {
        const message = {
            type: actionType,
            senderId: this.gameState.localPlayerId,
            ...payload
        };
        this.broadcast(message);
    }

    // --- MODO SERVIDOR (Placeholder para futuro) ---
    initWebSocket(onReady, onError) {
        // Ejemplo: const ws = new WebSocket('wss://tu-servidor.com/wolfy');
        // Implementar lógica similar usando WS events
        alert("Modo Servidor aún en desarrollo. Usa P2P por ahora.");
        onError(new Error("Not implemented"));
    }
}
