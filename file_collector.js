// file_collector.js — Colector de archivos del NCA FFWS Bot.
// Cuando un miembro publica un mensaje CON archivos adjuntos (imágenes,
// videos, documentos) en cualquier canal del servidor, el bot lo reenvía al
// canal #revision-archivos para revisión del staff y registra el evento en
// la tabla file_log.
//
// Intents: solo necesita GuildMessages (NO es privilegiado, se declara en el
// código) para recibir el evento messageCreate. El intent privilegiado
// "Message Content" NO hace falta: el colector solo lee los attachments
// (nombre y url), nunca el texto de los mensajes.

const { EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const db = require('./db');

const REVISION_CHANNEL = 'revision-archivos';
const COLOR_CLAN = 0x1e5fb8; // azul NCA (igual que index.js)
const ROL_LIDER = 'Líder';
const ROL_CAPITAN = 'Capitán';

// Decide si un mensaje debe recolectarse. Acepta el mensaje de discord.js o
// un objeto plano con la misma forma (author.bot, attachments, channel.name,
// guild) para poder probarse sin conexión.
function shouldCollect(message) {
  if (!message || !message.guild) return false; // solo servidor, no DMs
  if (message.author && message.author.bot) return false; // ignora bots (incluido él mismo)
  const atts = message.attachments;
  const count = atts ? (typeof atts.size === 'number' ? atts.size : atts.length) : 0;
  if (!count) return false; // sin adjuntos no hay nada que revisar
  if (message.channel && message.channel.name === REVISION_CHANNEL) return false; // evita bucles
  return true;
}

// Normaliza los adjuntos a [{ name, url }]. Acepta Collection de discord.js,
// Map o arreglo plano.
function listAttachments(attachments) {
  if (!attachments) return [];
  const arr =
    typeof attachments.values === 'function' ? [...attachments.values()] : [...attachments];
  return arr
    .map((a) => ({ name: a.name || 'archivo', url: a.url || '' }))
    .filter((a) => a.url);
}

// "11/10/2026, 01:52" en America/Chicago. Pensado para el embed.
function formatDateTime(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Chicago',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch (_) {
    return new Date(date).toISOString();
  }
}

// Construye el embed del reenvío (devuelve el EmbedBuilder, sin enviar).
function buildForwardEmbed({ mention, displayName, channelName, dateStr, filenames }) {
  const list =
    filenames && filenames.length ? filenames.map((n) => `• ${n}`).join('\n') : '—';
  const safeList = list.length > 1024 ? list.slice(0, 1021) + '…' : list;
  return new EmbedBuilder()
    .setColor(COLOR_CLAN)
    .setTitle('📎 Archivo compartido — revisión del staff')
    .addFields(
      { name: '👤 Miembro', value: `${mention} (${displayName})` },
      { name: '💬 Canal original', value: `#${channelName}`, inline: true },
      { name: '🕐 Fecha', value: dateStr, inline: true },
      { name: '📁 Archivos', value: safeList },
    );
}

// Busca #revision-archivos; si no existe intenta crearlo privado para el
// staff. Devuelve el canal o null (y lo anota en los logs en español).
async function ensureRevisionChannel(guild) {
  const existing = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText && c.name === REVISION_CHANNEL,
  );
  if (existing) return existing;
  const liderRole = guild.roles.cache.find((r) => r.name === ROL_LIDER);
  const capitanRole = guild.roles.cache.find((r) => r.name === ROL_CAPITAN);
  const staffPerms = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.SendMessages,
  ];
  const overwrites = [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }];
  if (liderRole) overwrites.push({ id: liderRole.id, allow: staffPerms });
  if (capitanRole) overwrites.push({ id: capitanRole.id, allow: staffPerms });
  try {
    const channel = await guild.channels.create({
      name: REVISION_CHANNEL,
      type: ChannelType.GuildText,
      topic: 'Archivos compartidos por los miembros, para revisión del staff.',
      permissionOverwrites: overwrites,
      reason: 'Colector de archivos del NCA FFWS Bot',
    });
    console.log(`📎 Canal #${REVISION_CHANNEL} creado para revisión del staff.`);
    return channel;
  } catch (err) {
    console.error(
      '⚠️ No se pudo crear #revision-archivos (¿falta el permiso "Gestionar canales"?):',
      err && err.message ? err.message : err,
    );
    return null;
  }
}

// Orquesta la recolección de un mensaje con adjuntos.
// Devuelve { collected: true, id } si se registró, { collected: false } si no.
async function handleMessageCreate(message) {
  if (!shouldCollect(message)) return { collected: false };
  const guild = message.guild;
  const target = await ensureRevisionChannel(guild);
  if (!target) return { collected: false };
  const files = listAttachments(message.attachments);
  if (files.length === 0) return { collected: false };
  const filenames = files.map((f) => f.name);
  const urls = files.map((f) => f.url);
  const member = message.member;
  const displayName =
    (member && member.displayName) ||
    (message.author && message.author.username) ||
    'Desconocido';
  const mention = `<@${message.author.id}>`;
  const embed = buildForwardEmbed({
    mention,
    displayName,
    channelName: message.channel.name,
    dateStr: formatDateTime(message.createdAt || new Date()),
    filenames,
  });
  // Se registra en la DB aunque el reenvío falle: la auditoría no se pierde.
  const { id } = db.logFile(message.author.id, displayName, message.channel.name, filenames, urls);
  try {
    await target.send({
      embeds: [embed],
      files: files.map((f) => ({ attachment: f.url, name: f.name })),
    });
  } catch (err) {
    console.error(
      '⚠️ No se pudo reenviar el archivo a #revision-archivos (queda registrado en la DB):',
      err && err.message ? err.message : err,
    );
    return { collected: false, id };
  }
  console.log(`📎 Archivo(s) de ${displayName} reenviados a #${REVISION_CHANNEL} (registro #${id}).`);
  return { collected: true, id };
}

module.exports = {
  REVISION_CHANNEL,
  shouldCollect,
  listAttachments,
  formatDateTime,
  buildForwardEmbed,
  ensureRevisionChannel,
  handleMessageCreate,
};
