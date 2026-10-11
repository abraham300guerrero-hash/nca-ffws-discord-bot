// db.js — Capa de persistencia SQLite (better-sqlite3) del NCA FFWS Bot.
// Tablas:
//   players      -> discord_id (PK), display_name
//   points       -> id, discord_id, week_start (lunes, YYYY-MM-DD), normal, war
//   week_archive -> week_start (PK), archived_at, snapshot (JSON de la semana)
// Las semanas se identifican por la fecha del lunes. /semana-nueva archiva la
// semana actual y los contadores "se ponen en cero" solos (la semana nueva
// empieza sin filas).

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'nca-bot.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS players (
  discord_id   TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS points (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id TEXT NOT NULL,
  week_start TEXT NOT NULL,
  normal     INTEGER NOT NULL DEFAULT 0,
  war        INTEGER NOT NULL DEFAULT 0,
  UNIQUE (discord_id, week_start),
  FOREIGN KEY (discord_id) REFERENCES players (discord_id)
);
CREATE TABLE IF NOT EXISTS week_archive (
  week_start  TEXT PRIMARY KEY,
  archived_at TEXT NOT NULL DEFAULT (datetime('now')),
  snapshot    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS convocatorias (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  fecha      TEXT NOT NULL,
  hora       TEXT NOT NULL,
  notas      TEXT,
  creada_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS warns (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id TEXT NOT NULL,
  motivo     TEXT NOT NULL,
  fecha      TEXT NOT NULL DEFAULT (datetime('now')),
  moderador  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS file_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id   TEXT NOT NULL,
  display_name TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  filenames    TEXT NOT NULL,
  urls         TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// Mínimos semanales del clan NCA FFWS
const MIN_NORMAL = 2000;
const MIN_WAR = 250;

// Lunes de la semana actual (YYYY-MM-DD), en hora local del servidor.
function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const offset = (d.getDay() + 6) % 7; // lunes = 0 … domingo = 6
  d.setDate(d.getDate() - offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const ensurePlayerStmt = db.prepare(`
  INSERT INTO players (discord_id, display_name) VALUES (?, ?)
  ON CONFLICT (discord_id) DO UPDATE SET display_name = excluded.display_name, updated_at = datetime('now')
`);
const ensureRowStmt = db.prepare(`
  INSERT INTO points (discord_id, week_start, normal, war) VALUES (?, ?, 0, 0)
  ON CONFLICT (discord_id, week_start) DO NOTHING
`);
const getPointsStmt = db.prepare('SELECT normal, war FROM points WHERE discord_id = ? AND week_start = ?');

function getPoints(discordId, week = getWeekStart()) {
  const row = getPointsStmt.get(discordId, week);
  return { normal: row ? row.normal : 0, war: row ? row.war : 0 };
}

function getDisplayName(discordId) {
  const row = db.prepare('SELECT display_name FROM players WHERE discord_id = ?').get(discordId);
  return row ? row.display_name : 'Desconocido';
}

// Suma puntos. type: 'normal' | 'war'
function addPoints(discordId, displayName, amount, type) {
  const week = getWeekStart();
  const col = type === 'war' ? 'war' : 'normal';
  ensurePlayerStmt.run(discordId, displayName);
  ensureRowStmt.run(discordId, week);
  db.prepare(`UPDATE points SET ${col} = ${col} + ? WHERE discord_id = ? AND week_start = ?`)
    .run(amount, discordId, week);
  return getPoints(discordId, week);
}

// Resta puntos (corrección). Nunca baja de cero.
function removePoints(discordId, displayName, amount, type) {
  const week = getWeekStart();
  const col = type === 'war' ? 'war' : 'normal';
  ensurePlayerStmt.run(discordId, displayName);
  ensureRowStmt.run(discordId, week);
  db.prepare(`UPDATE points SET ${col} = MAX(0, ${col} - ?) WHERE discord_id = ? AND week_start = ?`)
    .run(amount, discordId, week);
  return getPoints(discordId, week);
}

// Tabla de posiciones de la semana. type: 'normal' | 'war' | 'todo'
function getLeaderboard(type = 'todo', week = getWeekStart(), limit = 20) {
  const order =
    type === 'normal' ? 'p.normal DESC'
    : type === 'war' ? 'p.war DESC'
    : '(p.normal + p.war) DESC';
  return db.prepare(`
    SELECT pl.discord_id, pl.display_name, p.normal, p.war, (p.normal + p.war) AS total
    FROM points p
    JOIN players pl ON pl.discord_id = p.discord_id
    WHERE p.week_start = ?
    ORDER BY ${order}
    LIMIT ?
  `).all(week, limit);
}

// Archiva la semana actual (snapshot con fecha) para /semana-nueva.
function archiveWeek() {
  const week = getWeekStart();
  const rows = db.prepare(`
    SELECT pl.discord_id, pl.display_name, p.normal, p.war, (p.normal + p.war) AS total
    FROM points p
    JOIN players pl ON pl.discord_id = p.discord_id
    WHERE p.week_start = ? AND (p.normal > 0 OR p.war > 0)
    ORDER BY total DESC
  `).all(week);
  if (rows.length === 0) return { week, archived: false, count: 0, rows: [] };
  db.prepare(`
    INSERT INTO week_archive (week_start, snapshot) VALUES (?, ?)
    ON CONFLICT (week_start) DO UPDATE SET archived_at = datetime('now'), snapshot = excluded.snapshot
  `).run(week, JSON.stringify(rows));
  return { week, archived: true, count: rows.length, rows };
}

function meetsMinimums(normal, war) {
  return { normal: normal >= MIN_NORMAL, war: war >= MIN_WAR };
}

// ---------- Convocatorias de guerra ----------

function saveConvocatoria(channelId, messageId, fecha, hora, notas) {
  db.prepare(
    `INSERT INTO convocatorias (channel_id, message_id, fecha, hora, notas) VALUES (?, ?, ?, ?, ?)`,
  ).run(channelId, messageId, fecha, hora, notas || null);
}

function getLastConvocatoria() {
  return db.prepare(`SELECT * FROM convocatorias ORDER BY id DESC LIMIT 1`).get() || null;
}

// ---------- Advertencias (moderación) ----------

function addWarn(discordId, motivo, moderador) {
  const res = db
    .prepare(`INSERT INTO warns (discord_id, motivo, moderador) VALUES (?, ?, ?)`)
    .run(discordId, motivo, moderador);
  return { id: Number(res.lastInsertRowid) };
}

function getWarns(discordId) {
  return db
    .prepare(`SELECT id, motivo, fecha, moderador FROM warns WHERE discord_id = ? ORDER BY id DESC`)
    .all(discordId);
}

function countWarns(discordId) {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM warns WHERE discord_id = ?`).get(discordId);
  return row ? row.n : 0;
}

// ---------- Colector de archivos ----------

// Registra un mensaje con adjuntos reenviado a #revision-archivos.
// filenames y urls son arreglos (se guardan como JSON).
function logFile(discordId, displayName, channelName, filenames, urls) {
  const res = db
    .prepare(
      `INSERT INTO file_log (discord_id, display_name, channel_name, filenames, urls) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(discordId, displayName, channelName, JSON.stringify(filenames || []), JSON.stringify(urls || []));
  return { id: Number(res.lastInsertRowid) };
}

function getFileLog(limit = 20) {
  return db
    .prepare(
      `SELECT id, discord_id, display_name, channel_name, filenames, urls, created_at FROM file_log ORDER BY id DESC LIMIT ?`,
    )
    .all(limit);
}

function countFileLog() {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM file_log`).get();
  return row ? row.n : 0;
}

module.exports = {
  db,
  getWeekStart,
  addPoints,
  removePoints,
  getPoints,
  getDisplayName,
  getLeaderboard,
  archiveWeek,
  meetsMinimums,
  saveConvocatoria,
  getLastConvocatoria,
  addWarn,
  getWarns,
  countWarns,
  logFile,
  getFileLog,
  countFileLog,
  MIN_NORMAL,
  MIN_WAR,
};
