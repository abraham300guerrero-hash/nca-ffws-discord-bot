// Tarjeta de bienvenida NCA FFWS — genera la imagen que se publica en
// #bienvenida cuando entra un miembro nuevo (evento guildMemberAdd).
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');

const W = 1200;
const H = 514;
const BG_PATH = path.join(__dirname, 'assets', 'welcome-bg.webp');
const SHIELD_PATH = path.join(__dirname, 'assets', 'nca-shield.png');
const FONT = '"DejaVu Sans", "Liberation Sans", sans-serif';

let bgCache = null;
async function getBackground() {
  if (!bgCache) bgCache = await loadImage(BG_PATH);
  return bgCache;
}

// Escudo NCA con el negro vuelto transparente (el logo viene en fondo negro).
let shieldCache = null;
async function getShield() {
  if (shieldCache) return shieldCache;
  const img = await loadImage(SHIELD_PATH);
  const c = createCanvas(img.width, img.height);
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i] < 32 && px[i + 1] < 32 && px[i + 2] < 32) px[i + 3] = 0;
  }
  g.putImageData(data, 0, 0);
  shieldCache = c;
  return c;
}

function fitFont(ctx, text, maxWidth, baseSize, weight) {
  let size = baseSize;
  ctx.font = `${weight} ${size}px ${FONT}`;
  while (ctx.measureText(text).width > maxWidth && size > 20) {
    size -= 4;
    ctx.font = `${weight} ${size}px ${FONT}`;
  }
  return size;
}

async function buildWelcomeCard({ displayName, avatarURL }) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const bg = await getBackground();
  const s = Math.max(W / bg.width, H / bg.height);
  const dw = bg.width * s;
  const dh = bg.height * s;
  ctx.drawImage(bg, (W - dw) / 2, (H - dh) / 2, dw, dh);

  // Oscurecer la parte baja para que el texto lea bien.
  const grad = ctx.createLinearGradient(0, H * 0.45, 0, H);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,10,0.82)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // ---- Escudo NCA en la esquina superior izquierda ----
  try {
    const shield = await getShield();
    const sw = 190;
    const sh = (shield.height / shield.width) * sw;
    ctx.drawImage(shield, 28, 22, sw, sh);
  } catch (_) {
    // Sin escudo no se rompe la tarjeta.
  }

  // ---- Avatar circular con anillo eléctrico ----
  const ax = W / 2;
  const ay = 195;
  const ar = 105;

  ctx.save();
  ctx.shadowColor = '#29b6ff';
  ctx.shadowBlur = 45;
  ctx.beginPath();
  ctx.arc(ax, ay, ar + 10, 0, Math.PI * 2);
  ctx.strokeStyle = '#29b6ff';
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(ax, ay, ar, 0, Math.PI * 2);
  ctx.clip();
  let drewAvatar = false;
  if (avatarURL) {
    try {
      const avatar = await loadImage(avatarURL);
      const as = Math.max((ar * 2) / avatar.width, (ar * 2) / avatar.height);
      ctx.drawImage(
        avatar,
        ax - (avatar.width * as) / 2,
        ay - (avatar.height * as) / 2,
        avatar.width * as,
        avatar.height * as
      );
      drewAvatar = true;
    } catch (_) {
      drewAvatar = false;
    }
  }
  if (!drewAvatar) {
    // Silueta genérica si no hay avatar o falló la descarga.
    const ag = ctx.createLinearGradient(ax - ar, ay - ar, ax + ar, ay + ar);
    ag.addColorStop(0, '#1a2340');
    ag.addColorStop(1, '#0a0e1f');
    ctx.fillStyle = ag;
    ctx.fillRect(ax - ar, ay - ar, ar * 2, ar * 2);
    ctx.fillStyle = '#8fa3c7';
    ctx.beginPath();
    ctx.arc(ax, ay - 28, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ax, ay + 95, 62, Math.PI, 0);
    ctx.fill();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(ax, ay, ar, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(41,182,255,0.9)';
  ctx.lineWidth = 4;
  ctx.stroke();

  // ---- Textos ----
  const name = (displayName || 'Nuevo miembro').slice(0, 24);
  ctx.textAlign = 'center';

  try {
    ctx.letterSpacing = '14px';
  } catch (_) {}
  ctx.fillStyle = '#dfe7f5';
  ctx.font = `700 44px ${FONT}`;
  ctx.fillText('BIENVENIDO', ax, 372);

  try {
    ctx.letterSpacing = '6px';
  } catch (_) {}
  ctx.fillStyle = '#29b6ff';
  ctx.shadowColor = '#29b6ff';
  ctx.shadowBlur = 22;
  fitFont(ctx, name.toUpperCase(), W - 160, 64, 800);
  ctx.fillText(name.toUpperCase(), ax, 440);
  ctx.shadowBlur = 0;

  try {
    ctx.letterSpacing = '10px';
  } catch (_) {}
  ctx.fillStyle = '#ffd34d';
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText('¿LISTO PARA LA GUERRA?', ax, 488);

  return canvas.toBuffer('image/png');
}

module.exports = { buildWelcomeCard };
