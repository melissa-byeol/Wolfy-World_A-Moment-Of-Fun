/* network-manager.js
   REMOVED: The online connectors were archived.
   Original implementation moved to archive/network-manager.original.js
   This stub remains to avoid build errors but is intentionally inert.
*/

console.warn('network-manager.js has been removed and archived. See archive/network-manager.original.js for the original implementation.');

class NetworkManager {
    constructor() {
        console.warn('Network features disabled in this reset.');
    }
    connectAsHost() { throw new Error('Network disabled'); }
    connectAsClient() { throw new Error('Network disabled'); }
    disconnect() {}
}

// Export minimal stub for compatibility
window.NetworkManager = NetworkManager;
