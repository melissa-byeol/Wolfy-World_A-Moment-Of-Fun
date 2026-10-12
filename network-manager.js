/**
 * WOLFY WORLD - NETWORK MANAGER v2
 * Abstracción estable sobre PeerJS para P2P.
 */

class NetworkManager {
    constructor(gameState) {
        this.state = gameState;
        this.peer = null;
        this.connections = new Map(); // Mapa de conexiones activas
        this.onUpdateCallback = null; // Callback para refrescar UI
    }

    /**
     * Iniciar como HOST (Crear Sala)
     */
    connectAsHost(roomCode, username, onSuccess, onError) {
        this.state.roomCode = roomCode.toUpperCase();
        const hostId = `wolfy-${this.state.roomCode}`;
        
        if (typeof Peer === 'undefined') { 
            onError("Librería PeerJS no cargada."); 
            return; 
        }

        // Limpiar peer anterior si existe
        if (this.peer) {
            try { this.peer.destroy(); } catch(e){}
        }

        this.peer = new Peer(hostId, { debug: 1 });
        
        this.peer.on('open', () => {
            console.log("✅ Host started:", hostId);
            // Inicializar jugador local con ID del host
            this.state.initPlayer(hostId, username, true);
            onSuccess();
            
            // Escuchar nuevas conexiones entrantes
            this.peer.on('connection', (conn) => {
                this.handleIncomingConnection(conn);
            });
        });

        this.peer.on('error', (err) => {
            console.error("❌ Host Error:", err);
            let msg = "Error desconocido.";
            if (err.type === 'unavailable-id') msg = "La sala ya existe. Intenta otro código.";
            else if (err.type === 'browser-incompatible') msg = "Tu navegador no soporta WebRTC.";
            else msg = err.message || err.type;
            onError(msg);
        });
    }

    /**
     * Conectar como CLIENTE (Unirse a Sala)
     */
    connectAsClient(roomCode, username, onSuccess, onError) {
        this.state.roomCode = roomCode.toUpperCase();
        const targetHostId = `wolfy-${this.state.roomCode}`;
        
        if (typeof Peer === 'undefined') { 
            onError("Librería PeerJS no cargada."); 
            return; 
        }

        // Limpiar peer anterior
        if (this.peer) {
            try { this.peer.destroy(); } catch(e){}
        }

        this.peer = new Peer(null, { debug: 1 });
        
        this.peer.on('open', (myId) => {
            this.state.initPlayer(myId, username, false);
            console.log(" Client connected locally:", myId);
            
            // Intentar conectar al Host conocido
            const conn = this.peer.connect(targetHostId, { reliable: true });
            
            conn.on('open', () => {
                console.log("✅ Connected to Host!");
                this.connections.set(targetHostId, conn);
                
                // Handshake inicial: Enviar nuestro estado al Host
                // USANDO getActivePlayer() en lugar de getLocalPlayer()
                const playerData = this.state.getActivePlayer();
                conn.send({ type: 'HELLO', player: playerData });
                
                onSuccess();
            });

            conn.on('data', (data) => {
                this.processNetworkData(data);
            });

            conn.on('close', () => {
                console.warn("⚠️ Connection closed by host or network issue.");
                // No recargar automáticamente, dejar que el usuario decida o reintente
                if(this.onUpdateCallback) this.onUpdateCallback();
            });
            
            conn.on('error', (err) => {
                console.error("Conn Error:", err);
                onError("No se pudo conectar al host. Verifica el código de sala.");
            });
        });

        this.peer.on('error', (err) => {
            console.error("❌ Client Error:", err);
            if(err.type === 'peer-unavailable') {
                onError("La sala no existe o el host está offline.");
            } else {
                onError(err.message || "Error de red inesperado.");
            }
        });
    }

    /**
     * Manejar llegada de nuevo cliente (Solo Host)
     */
    handleIncomingConnection(conn) {
        conn.on('open', () => {
            this.connections.set(conn.peer, conn);
            console.log("➕ New client joined:", conn.peer);
            
            // Enviar estado actual completo al nuevo jugador
            const allPlayers = this.state.getAllPlayers();
            conn.send({ 
                type: 'STATE_SYNC', 
                players: allPlayers 
            });
        });

        conn.on('data', (data) => {
            this.processNetworkData(data);
        });

        conn.on('close', () => {
            console.log("👋 Client left:", conn.peer);
            this.connections.delete(conn.peer);
            this.state.removePlayer(conn.peer);
            
            // Notificar a los demás que alguien se fue
            this.broadcast({ type: 'PLAYER_LEAVE', id: conn.peer });
            
            if(this.onUpdateCallback) this.onUpdateCallback();
        });
        
        conn.on('error', (err) => {
            console.error("Incoming Conn Error:", err);
        });
    }

    /**
     * Procesar datos recibidos de otros jugadores
     */
    processNetworkData(data) {
        switch(data.type) {
            case 'HELLO':
                // El Host recibe info de un nuevo cliente
                if(this.state.isHost) {
                    this.state.addRemotePlayer(data.player);
                    // Notificar a todos los demás que alguien entró
                    this.broadcast({ type: 'PLAYER_JOIN', player: data.player });
                }
                break;
                
            case 'STATE_SYNC':
                // El Cliente recibe la lista completa de jugadores del Host
                if (!this.state.isHost) {
                    data.players.forEach(p => this.state.addRemotePlayer(p));
                }
                break;
                
            case 'MOVE':
                // Actualizar posición de otro jugador
                this.state.addRemotePlayer(data.player);
                break;
                
            case 'PLAYER_JOIN':
                // Otro cliente informa que alguien entró (reenviado por Host)
                this.state.addRemotePlayer(data.player);
                break;
                
            case 'PLAYER_LEAVE':
                // Alguien se desconectó
                this.state.removePlayer(data.id);
                break;
        }
        
        // Llamar al callback de la UI para refrescar visualmente
        if(this.onUpdateCallback) this.onUpdateCallback();
    }

    /**
     * Enviar mensaje a TODOS los conectados (Usado por Host)
     */
    broadcast(msg) {
        this.connections.forEach((conn) => { 
            try { 
                if (conn.open) conn.send(msg); 
            } catch(e) { 
                console.warn("Broadcast failed", e); 
            } 
        });
    }

    /**
     * Lógica inteligente de envío:
     * - Si eres Host: Broadcast a todos.
     * - Si eres Cliente: Envía solo al Host.
     */
    sendToHostOrBroadcast(msg) {
        if(this.state.isHost) {
            this.broadcast(msg);
        } else {
            // Como cliente, busco la conexión al Host
            const hostId = `wolfy-${this.state.roomCode}`;
            const conn = this.connections.get(hostId);
            if(conn && conn.open) {
                conn.send(msg);
            } else {
                console.warn("Cannot send message: No connection to host.");
            }
        }
    }
    
    /**
     * Limpieza total (usar al salir del juego online)
     */
    disconnect() {
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        this.connections.clear();
        this.state.myId = null;
        this.state.isHost = false;
        this.state.roomCode = "";
        this.state.players = {}; // Resetear jugadores remotos
    }
}
