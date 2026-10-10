class GameState {
    constructor() {
        this.players = {}; // Mapa de ID -> Jugador
        this.localPlayerId = null;
        this.shovels = {
            toy: { n: "Juguete", p: 1 },
            training: { n: "Entrenamiento", p: 2, c: 100 },
            iron: { n: "Hierro", p: 5, c: 500 },
            steel: { n: "Acero", p: 10, c: 1500 }
        };
        this.treasures = [
            { n: "Roca", v: 1 },
            { n: "Gema Pequeña", v: 10 },
            { n: "Gema Grande", v: 50 },
            { n: "Oro", v: 100 }
        ];
    }

    setLocalPlayer(id, name) {
        this.localPlayerId = id;
        if (!this.players[id]) {
            this.players[id] = {
                id: id,
                name: name,
                x: 380,
                y: 230,
                money: 0,
                shovelType: 'toy',
                inventory: [],
                color: '#f1c40f' // Color por defecto
            };
        }
    }

    getLocalPlayer() {
        return this.players[this.localPlayerId];
    }

    updatePosition(x, y) {
        const player = this.getLocalPlayer();
        if(player) {
            player.x = x;
            player.y = y;
        }
        return player; // Retornar para enviar por red
    }

    performMineSuccess() {
        const player = this.getLocalPlayer();
        if(!player) return null;

        // Lógica simple: La pala determina qué tan probable es un tesoro bueno
        const power = this.shovels[player.shovelType].p;
        let rewardIndex = Math.floor(Math.random() * this.treasures.length);
        // Mejorar probabilidad con poder de pala (simple ejemplo)
        if(power > 1 && Math.random() < 0.3) rewardIndex = Math.min(rewardIndex + 1, this.treasures.length - 1);
        
        const treasure = {...this.treasures[rewardIndex]};
        player.inventory.push(treasure);
        return treasure;
    }

    sellLastItem() {
        const player = this.getLocalPlayer();
        if(!player || player.inventory.length === 0) return false;
        
        const item = player.inventory.pop();
        player.money += item.v;
        return true;
    }

    buyShovel(typeKey) {
        const player = this.getLocalPlayer();
        const shovelData = this.shovels[typeKey];
        
        if(player.money >= shovelData.c) {
            player.money -= shovelData.c;
            player.shovelType = typeKey;
            return true;
        }
        return false;
    }

    getAllPlayersArray() {
        return Object.values(this.players);
    }
    
    // Sincronización remota (llamado desde NetworkManager)
    syncRemotePlayer(remoteData) {
        if(remoteData.id !== this.localPlayerId) {
            this.players[remoteData.id] = remoteData;
        }
    }
}
