// utils.js — Funciones puras del NCA FFWS Bot (testeables sin conexión a Discord).

const { MIN_NORMAL, MIN_WAR, getWeekStart } = require('./db');

const fmtN = (n) => Number(n).toLocaleString('es-MX');

// Elige un ganador al azar entre una lista de ids de Discord.
// randFn es inyectable para pruebas. Devuelve null si no hay participantes.
function pickWinner(ids, randFn = Math.random) {
  if (!Array.isArray(ids) || ids.length === 0) return null;
  const i = Math.floor(randFn() * ids.length);
  return ids[i];
}

// Formatea una lista de nombres para mostrarla en un embed.
function formatNameList(names) {
  if (!names || names.length === 0) return '—';
  return names.map((n) => `• ${n}`).join('\n');
}

// Expresión cron del recordatorio de guerra.
// Por defecto: 17:00 (America/Chicago) los miércoles (3), viernes (5) y sábados (6).
// Se puede cambiar con la variable WAR_REMINDER_CRON.
const DEFAULT_WAR_CRON = '0 17 * * 3,5,6';
function buildReminderCron() {
  const v = (process.env.WAR_REMINDER_CRON || '').trim();
  return v || DEFAULT_WAR_CRON;
}

// Texto del recordatorio automático de guerra de clanes.
function warReminderText() {
  return (
    '⚔️ **¡Hoy hay guerra de clanes, escuadra!**\n\n' +
    'Confirma tu asistencia en #convocatoria con ✅.\n' +
    `Mínimos semanales: ${fmtN(MIN_NORMAL)} puntos normales · ${fmtN(MIN_WAR)} de guerra.\n` +
    '¡A ganar se ha dicho! 🐺'
  );
}

// Nombre del rol de escuadra ("Escuadra N"). Devuelve null si n no es 1-12.
function squadRoleName(n) {
  const num = Number(n);
  if (!Number.isInteger(num) || num < 1 || num > 12) return null;
  return `Escuadra ${num}`;
}

// Limpia un nombre de usuario para usarlo en "ticket-<nombre>".
function sanitizeTicketName(username) {
  const clean = String(username || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  return clean || 'miembro';
}

// Emojis numéricos para encuestas (máximo 5).
const POLL_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
function pollEmojis(count) {
  const n = Math.max(0, Math.min(5, Number(count) || 0));
  return POLL_EMOJIS.slice(0, n);
}

// Expresión cron del MVP semanal.
// Por defecto: domingos 18:00 (America/Chicago). Configurable con MVP_CRON.
const DEFAULT_MVP_CRON = '0 18 * * 0';
function buildMvpCron() {
  const v = (process.env.MVP_CRON || '').trim();
  return v || DEFAULT_MVP_CRON;
}

// Expresión cron del rol "Élite Semanal" automático.
// Por defecto: lunes 06:00 (America/Chicago). Configurable con ELITE_CRON.
const DEFAULT_ELITE_CRON = '0 6 * * 1';
function buildEliteCron() {
  const v = (process.env.ELITE_CRON || '').trim();
  return v || DEFAULT_ELITE_CRON;
}

// Lunes (YYYY-MM-DD) de la semana ANTERIOR a la fecha dada.
// Reutiliza getWeekStart de db.js restando 7 días.
function getPrevWeekStart(date = new Date()) {
  const d = new Date(date);
  d.setDate(d.getDate() - 7);
  return getWeekStart(d);
}

// ¿Es un canal de ticket? (nombre "ticket-...")
function isTicketChannel(name) {
  return String(name || '').toLowerCase().startsWith('ticket-');
}

module.exports = {
  pickWinner,
  formatNameList,
  buildReminderCron,
  warReminderText,
  DEFAULT_WAR_CRON,
  squadRoleName,
  sanitizeTicketName,
  pollEmojis,
  buildMvpCron,
  isTicketChannel,
  DEFAULT_MVP_CRON,
  buildEliteCron,
  getPrevWeekStart,
  DEFAULT_ELITE_CRON,
};

