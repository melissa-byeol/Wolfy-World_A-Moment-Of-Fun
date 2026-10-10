/**
 * WOLFY WORLD - NETWORK MANAGER
 * Abstracción sobre PeerJS para manejar conexiones P2P.
 * bruhh
 */

class NetworkManager {
    constructor(gameState) {
        this.state = gameState;
        this.peer = null;
        this.connections = new Map(); // peerId -> conn object
        this.onUpdateCallback = null; // Función a llamar cuando llega data remota
    }

    connectAsHost(roomCode, username, onSuccess, onError) {
        this.state.roomCode = roomCode;
        const hostId = `wolfy-${roomCode.toUpperCase()}`;
        
        if(typeof Peer === 'undefined') { 
            onError("Librería PeerJS no cargada."); 
            return; 
        }

        this.peer = new Peer(hostId, { debug: 1 });
        
        this.peer.on('open', () => {
            console.log("Host started:", hostId);
            this.state.initPlayer(hostId, username, true);
            onSuccess();
            
            // Escuchar nuevas conexiones entrantes
            this.peer.on('connection', (conn) => {
                this.handleIncomingConnection(conn);
            });
        });

        this.peer.on('error', (err) => {
            console.error(err);
            onError(err.type);
        });
    }

    connectAsClient(roomCode, username, onSuccess, onError) {
        this.state.roomCode = roomCode;
        const targetHostId = `wolfy-${roomCode.toUpperCase()}`;
        
        if(typeof Peer === 'undefined') { 
            onError("Librería PeerJS no cargada."); 
            return; 
        }

        this.peer = new Peer(null, { debug: 1 });
        
        this.peer.on('open', (myId) => {
            this.state.initPlayer(myId, username, false);
            console.log("Client connected locally:", myId);
            
            // Intentar conectar al Host conocido
            const conn = this.peer.connect(targetHostId);
            
            conn.on('open', () => {
                console.log("Connected to Host!");
                this.connections.set(targetHostId, conn);
                
                // Handshake inicial
                conn.send({ type: 'HELLO', player: this.state.getLocalPlayer() });
                onSuccess();
            });

            conn.on('data', (data) => {
                this.processNetworkData(data);
            });

            conn.on('close', () => {
                alert("Desconectado del Host");
                location.reload();
            });
            
            conn.on('error', (err) => {
                onError("No se pudo conectar al host. ¿Está creada la sala?");
            });
        });

        this.peer.on('error', (err) => {
            if(err.type === 'peer-unavailable') {
                onError("La sala no existe o el host está offline.");
            } else {
                onError(err.message);
            }
        });
    }

    handleIncomingConnection(conn) {
        conn.on('open', () => {
            this.connections.set(conn.peer, conn);
            console.log("New client joined:", conn.peer);
            
            // Enviar estado actual completo al nuevo jugador
            conn.send({ 
                type: 'STATE_SYNC', 
                players: this.state.getAllPlayers() 
            });
        });

        conn.on('data', (data) => {
            this.processNetworkData(data);
        });

        conn.on('close', () => {
            this.connections.delete(conn.peer);
            this.state.removePlayer(conn.peer);
            this.broadcast({ type: 'PLAYER_LEAVE', id: conn.peer });
            if(this.onUpdateCallback) this.onUpdateCallback();
        });
    }

    processNetworkData(data) {
        switch(data.type) {
            case 'HELLO':
                // El Host recibe información de un nuevo cliente
                if(this.state.isHost) {
                    this.state.addRemotePlayer(data.player);
                    // Notificar a todos los demás que alguien entró
                    this.broadcast({ type: 'PLAYER_JOIN', player: data.player });
                }
                break;
                
            case 'STATE_SYNC':
                // El Cliente recibe la lista completa de jugadores del Host
                data.players.forEach(p => this.state.addRemotePlayer(p));
                break;
                
            case 'MOVE':
                // Actualizar posición de otro jugador
                this.state.addRemotePlayer(data.player);
                break;
                
            case 'PLAYER_JOIN':
                // Otro cliente informa que alguien entró (solo Host reenvía esto normalmente, 
                // pero si usamos broadcast desde Host, los clientes reciben esto)
                this.state.addRemotePlayer(data.player);
                break;
                
            case 'PLAYER_LEAVE':
                this.state.removePlayer(data.id);
                break;
        }
        
        // Llamar al callback de la UI para refrescar
        if(this.onUpdateCallback) this.onUpdateCallback();
    }

    broadcast(msg) {
        this.connections.forEach((conn) => { 
            try { 
                conn.send(msg); 
            } catch(e) { 
                console.warn("Send failed", e); 
            } 
        });
    }

    sendToHostOrBroadcast(msg) {
        if(this.state.isHost) {
            this.broadcast(msg);
        } else {
            // Como cliente, solo puedo enviar al Host
            const hostId = `wolfy-${this.state.roomCode.toUpperCase()}`;
            const conn = this.connections.get(hostId);
            if(conn) conn.send(msg);
        }
    }
}
