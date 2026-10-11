// rotaciones.js — Datos de rotaciones, caídas y estrategias por mapa (NCA LEAGUE).
// Contenido investigado en la web (guías competitivas estilo FFWS, 2026-10-11)
// y cargado al bot el 2026-10-11. Imágenes de referencia en ./assets/.

const ROTACIONES = {
  bermuda: {
    nombre: 'Bermuda',
    caidas:
      '🪂 **Peak** — centro y punto más alto; loot abundante, rotación fácil (hot drop solo con nivel). ' +
      '**Mill** — norte, almacén con loot alto. **Factory** — sur, el drop más popular. ' +
      '**Clock Tower** — agresivo, loot excelente. **Mars Electric** — sur, tranquilo. ' +
      '**Graveyard** — noroeste, seguro y cerca del centro.',
    rotaciones:
      '🔄 Lootear 2-3 min y rotar antes del primer cierre. Tomar el centro (Peak/Clock Tower) en 2ª/3ª zona. ' +
      'Gatekepear puentes de Bimasakti/Riverside. Endgame en altura con gloo walls. ' +
      'Evitar campo abierto sin gloo y cruzar puentes sin revisar.',
    estrategias:
      '🧠 Control del centro temprano (Peak = visión y ventaja). Peleas selectivas: solo con ventaja numérica o posicional. ' +
      'Micro-rotaciones silenciosas en endgame. 6-10 gloo walls por jugador. ' +
      'Roles: entry fragger, soportes, largo alcance; formación en línea/triángulo, nunca separados.',
    imagen: 'bermuda.png',
  },
  purgatorio: {
    nombre: 'Purgatorio',
    caidas:
      '🪂 **Brasilia** — centro, hot drop; split Up/Down + tienda. **Marbleworks** — radios reveladoras + tienda (cuidado el puente). ' +
      '**Fields** — todoterreno, armor L2 + ARs. **Central** — mayor densidad de loot. ' +
      '**Moathouse** — norte aislado, loot alto pero escaso (salir pronto). **Lumber Mill** — seguro, puente al continente.',
    rotaciones:
      '🔄 Cruzar puentes temprano, nunca al final. Mapa abierto: batallas de largo alcance con cobertura natural. ' +
      'Gatekepear puentes (Moathouse→Forge/Fields). Cuidado río SO (Golf Course/Mt. Vilia): buscar bote si la zona cierra ahí.',
    estrategias:
      '🧠 Centralidad = control (Brasilia/Marbleworks, jugar lockdown). Usar radios reveladoras para anticipar. ' +
      'Estilo metódico y a distancia. Limpiar interiores con granadas. Parada de tienda en mid-game. ' +
      'Endgame: gloo + inhaladores, altura, sin revelar posición.',
    imagen: 'purgatorio.png',
  },
  kalahari: {
    nombre: 'Kalahari',
    caidas:
      '🪂 **Refinery** — centro, hot drop solo escuadras top. **Bayfront** — defensiva, kill zone vs rotaciones del norte. ' +
      '**Command Post** — casi perfecto si se llega primero. **Santa Catarina** — barco para cruzar masas de tierra. ' +
      '**Confinement** — pocos enemigos, lejos de zona. **Shrines** — puente al centro + emboscadas.',
    rotaciones:
      '🔄 De cobertura en cobertura (rocas/edificios), nunca en línea recta por el desierto. Usar ondulaciones para altura. ' +
      'Vehículos solo en early; abandonarlos tras la 3ª zona. No quedar atrapado en la masa de tierra equivocada.',
    estrategias:
      '🧠 Mapa de snipers: rol de largo alcance obligatorio. En Refinery, limpiar en 60-90 s o salir antes del third party. ' +
      'Bayfront como trampa de puntos. Endgame en elevación, sin disparar hasta tener posición. Minimizar exposición (poca vegetación).',
    imagen: 'kalahari.jpg',
  },
  nexterra: {
    nombre: 'NeXTerra',
    caidas:
      '🪂 **Intellect Center** — norte, multifloor muy expuesto (solo agresivas). **Grav Labs/Anti-Gravity Zone** — combate aéreo, hotspot. ' +
      '**Deca Square** — portales, hub de rotación/flanqueo. **Plazaria** — 3 edificios, caer en bordes. ' +
      '**The Hangar/Space Colony** — tranquilos. **Museum/Mortar Ruins** — sólidos, menos competencia.',
    rotaciones:
      '🔄 Usar catapultas, tirolinas y portales de Deca Square para llegar rápido. ' +
      'Si la zona cae al norte, llegar a Intellect Center antes o rodearlo. ' +
      'Cuidado con cierre en Intellect Center (foso sur = trampa). No usar portales a ciegas en late.',
    estrategias:
      '🧠 Loadout híbrido (AR + escopeta). Armadura primero. Granadas para edificios interconectados. ' +
      'Movimiento/slide como defensa; strafe en anti-gravedad. Comunicación vertical por pisos; ' +
      'limpiar por pisos con granadas, nunca separarse.',
    imagen: 'nexterra.jpg',
  },
};

module.exports = { ROTACIONES };
