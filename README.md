# Wolfy World — Reset snapshot

Este commit realiza un "reset" del proyecto conforme a la petición: se han removido los conectores en tiempo real y se ha agregado un chart de prueba sin audio.

Qué se hizo:
- Se eliminó la carga de PeerJS en index.html y se dejó el `network-manager.js` como un stub inerte.
- La implementación original del network manager fue archivada en `archive/network-manager.original.js`.
- Se añadió `assets/charts/bed_of_thorns.json` — chart de prueba (sin referencia a audio).
- Se preservaron `style.css`, `game-state.js`, `save-manager.js`, `rhythm-game.js`, y `main.js`.

Notas:
- El juego online ha sido deshabilitado; si quieres restaurarlo basta con recuperar el archivo archivado y reinstaurar la etiqueta de PeerJS.
- El chart de prueba se puede cargar desde `assets/charts/bed_of_thorns.json`.
