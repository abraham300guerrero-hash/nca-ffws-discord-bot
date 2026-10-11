// rotaciones.js — Datos de rotaciones, caídas y estrategias por mapa (NCA LEAGUE).
// El líder proporciona el contenido real (texto + imágenes de cada mapa);
// mientras tanto cada campo muestra "en preparación".
// Para añadir la imagen de un mapa: colocar el archivo en ./assets/
// (p. ej. assets/bermuda.png) y poner su nombre en el campo "imagen".

const EN_PREPARACION = '🔜 Información en preparación — el líder la publicará pronto.';

const ROTACIONES = {
  bermuda: {
    nombre: 'Bermuda',
    rotaciones: EN_PREPARACION,
    caidas: EN_PREPARACION,
    estrategias: EN_PREPARACION,
    imagen: null, // p. ej. 'bermuda.png' cuando el líder envíe la imagen
  },
  purgatorio: {
    nombre: 'Purgatorio',
    rotaciones: EN_PREPARACION,
    caidas: EN_PREPARACION,
    estrategias: EN_PREPARACION,
    imagen: null,
  },
  kalahari: {
    nombre: 'Kalahari',
    rotaciones: EN_PREPARACION,
    caidas: EN_PREPARACION,
    estrategias: EN_PREPARACION,
    imagen: null,
  },
  nexterra: {
    nombre: 'NeXTerra',
    rotaciones: EN_PREPARACION,
    caidas: EN_PREPARACION,
    estrategias: EN_PREPARACION,
    imagen: null,
  },
};

module.exports = { ROTACIONES };
