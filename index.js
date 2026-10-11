// index.js — NCA FFWS Bot (discord.js v14).
// Intents: Guilds + GuildMembers (privilegiado: activar "SERVER MEMBERS INTENT"
// en el portal de desarrolladores para la bienvenida por DM).
// Comandos slash por servidor (guild):
//   /puntos-agregar  (Líder/Capitán)  suma puntos normales o de guerra
//   /puntos-quitar   (Líder/Capitán)  resta puntos (corrección)
//   /puntos-ver      (todos)           puntos de un miembro + progreso vs mínimos
//   /tabla           (todos)           tabla de posiciones con ✅/⚠️
//   /semana-nueva    (solo Líder)      archiva la semana y reinicia contadores
//   /convocar        (Líder/Capitán)   convocatoria de guerra con ✅/❌
//   /convocados      (todos)           quién confirmó y quién no en la última convocatoria
//   /anuncio         (Líder/Capitán)   anuncio con formato NCA en #anuncios
//   /sorteo          (Líder/Capitán)   sorteo con reacción 🎉 y ganador al azar
//   /advertir        (Líder/Capitán)   registra advertencia + aviso por DM
//   /advertencias    (todos)           advertencias registradas de un miembro
//   /expulsar        (Líder/Capitán)   kick del servidor
//   /asignar         (Líder/Capitán)   asigna el rol "Escuadra N" (quita otras escuadras)
//   /encuesta        (Líder/Capitán)   encuesta con reacciones numéricas 1️⃣-5️⃣
//   /ticket          (todos)           crea un canal privado de soporte
//   /ticket-cerrar   (Líder/Capitán)   borra el canal ticket actual
//   /reglas          (todos)           muestra el reglamento oficial del clan
//   /rotaciones      (todos)           publica en #rutinas la guía del mapa elegido
// Además: recordatorio automático de guerra (mié/vie/sáb 17:00 America/Chicago,
// configurable con WAR_REMINDER_CRON) publicado en #convocatoria;
// MVP semanal automático (domingos 18:00 America/Chicago, configurable con
// MVP_CRON) publicado en #general;
// rol "Élite Semanal" automático (lunes 06:00 America/Chicago, configurable con
// ELITE_CRON): se asigna a los 3 primeros de la tabla de la semana anterior;
// bienvenida por DM con el reglamento a cada miembro nuevo (evento guildMemberAdd);
// colector de archivos: los mensajes con adjuntos se reenvían a #revision-archivos
// para revisión del staff (evento messageCreate, ver file_collector.js).

require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');
const cron = require('node-cron');
const db = require('./db');
const utils = require('./utils');
const fileCollector = require('./file_collector');
const { ROTACIONES } = require('./rotaciones');
const http = require('http');

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !GUILD_ID) {
  console.error('❌ Configuración incompleta: faltan DISCORD_TOKEN y/o GUILD_ID.');
  console.error('   Define esas variables de entorno (mira el archivo .env.example).');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages],
});
// NOTA: GuildMembers es un intent PRIVILEGIADO. Hay que activar el toggle
// "SERVER MEMBERS INTENT" en el portal de desarrolladores de Discord
// (tu aplicación → Bot → Privileged Gateway Intents), o el bot no recibirá
// el evento guildMemberAdd (bienvenida por DM).
// GuildMessages NO es privilegiado (solo se declara aquí) y es necesario para
// recibir messageCreate (colector de archivos). El intent privilegiado
// "Message Content" NO hace falta: el colector solo lee los attachments
// (nombre y url), nunca el texto de los mensajes.

const ROL_LIDER = 'Líder';
const ROL_CAPITAN = 'Capitán';
const COLOR_CLAN = 0x1e5fb8; // azul NCA

// Reglamento OFICIAL del clan (póster "REGLAS DEL CLAN"). El usuario puede editarlo aquí.
const RULES_TEXT = `📜 **REGLAS DEL CLAN NCA FFWS — #NCA X SIEMPRE**

**1. GUERRA DE CLANES:** Participación obligatoria.
**2. SUBIDA DE RANGO:** Al inicio de temporada.
**3. RESPETO:** Cero toxicidad.
**4. ACTIVIDAD:** +3 días inactivo = expulsión.
**5. PUNTOS:** 2000 normales, 250 en guerra.
**6. COMPROMISO:** Participación en actividades.
**7. CONTENIDO:** Apoyar con clips.
**8. COMUNICACIÓN:** WhatsApp y Discord.
**9. REPORTE:** Domingos antes de 8 PM.
**10. PRUEBAS:** Entregar pruebas el fin de semana.`;

const fmt = (n) => Number(n).toLocaleString('es-MX');

function hasStaffRole(member) {
  if (!member || !member.roles || !member.roles.cache) return false;
  return member.roles.cache.some((r) => r.name === ROL_LIDER || r.name === ROL_CAPITAN);
}

function isLeader(member) {
  if (!member || !member.roles || !member.roles.cache) return false;
  return member.roles.cache.some((r) => r.name === ROL_LIDER);
}

function progressLine(normal, war) {
  const m = db.meetsMinimums(normal, war);
  const iconN = m.normal ? '✅' : '⚠️';
  const iconW = m.war ? '✅' : '⚠️';
  return `${iconN} Normales: ${fmt(normal)}/${fmt(db.MIN_NORMAL)} · ${iconW} Guerra: ${fmt(war)}/${fmt(db.MIN_WAR)}`;
}

function tipoLabel(tipo) {
  return tipo === 'war' ? 'guerra' : 'normales';
}

// ---------- Definición de comandos ----------

const tipoOption = (opt) =>
  opt
    .setName('tipo')
    .setDescription('Tipo de puntos')
    .setRequired(true)
    .addChoices(
      { name: 'Normales', value: 'normal' },
      { name: 'Guerra', value: 'war' },
    );

const commands = [
  new SlashCommandBuilder()
    .setName('puntos-agregar')
    .setDescription('Suma puntos a un miembro (solo Líder y Capitán).')
    .addUserOption((o) => o.setName('miembro').setDescription('Miembro del clan').setRequired(true))
    .addIntegerOption((o) => o.setName('cantidad').setDescription('Puntos a sumar').setRequired(true).setMinValue(1))
    .addStringOption(tipoOption),

  new SlashCommandBuilder()
    .setName('puntos-quitar')
    .setDescription('Resta puntos a un miembro como corrección (solo Líder y Capitán).')
    .addUserOption((o) => o.setName('miembro').setDescription('Miembro del clan').setRequired(true))
    .addIntegerOption((o) => o.setName('cantidad').setDescription('Puntos a restar').setRequired(true).setMinValue(1))
    .addStringOption(tipoOption),

  new SlashCommandBuilder()
    .setName('puntos-ver')
    .setDescription('Muestra los puntos semanales de un miembro y su progreso vs los mínimos.')
    .addUserOption((o) => o.setName('miembro').setDescription('Miembro a consultar (vacío = tú)')),

  new SlashCommandBuilder()
    .setName('tabla')
    .setDescription('Tabla de posiciones de la semana con ✅/⚠️ según los mínimos.')
    .addStringOption((o) =>
      o
        .setName('tipo')
        .setDescription('Qué puntos ordenar')
        .addChoices(
          { name: 'Todo', value: 'todo' },
          { name: 'Normales', value: 'normal' },
          { name: 'Guerra', value: 'war' },
        ),
    ),

  new SlashCommandBuilder()
    .setName('semana-nueva')
    .setDescription('Archiva la semana actual y reinicia los contadores (solo Líder).'),

  new SlashCommandBuilder()
    .setName('convocar')
    .setDescription('Publica una convocatoria de guerra con ✅/❌ (solo Líder y Capitán).')
    .addStringOption((o) =>
      o.setName('fecha').setDescription('Fecha de la guerra (p. ej. "sábado 17 de octubre")').setRequired(true),
    )
    .addStringOption((o) =>
      o.setName('hora').setDescription('Hora de la guerra (p. ej. "7:00 p.m.")').setRequired(true),
    )
    .addStringOption((o) => o.setName('notas').setDescription('Notas adicionales (opcional)')),

  new SlashCommandBuilder()
    .setName('convocados')
    .setDescription('Muestra quién confirmó ✅ y quién no ❌ en la última convocatoria.'),

  new SlashCommandBuilder()
    .setName('anuncio')
    .setDescription('Publica un anuncio con formato NCA (solo Líder y Capitán).')
    .addStringOption((o) => o.setName('texto').setDescription('Texto del anuncio').setRequired(true))
    .addChannelOption((o) => o.setName('canal').setDescription('Canal destino (por defecto #anuncios)')),

  new SlashCommandBuilder()
    .setName('sorteo')
    .setDescription('Inicia un sorteo con reacción 🎉 (solo Líder y Capitán).')
    .addStringOption((o) => o.setName('premio').setDescription('Premio del sorteo').setRequired(true))
    .addIntegerOption((o) =>
      o
        .setName('duracion_minutos')
        .setDescription('Duración en minutos (por defecto 60)')
        .setMinValue(1)
        .setMaxValue(10080),
    ),

  new SlashCommandBuilder()
    .setName('advertir')
    .setDescription('Registra una advertencia a un miembro y le avisa por DM (solo Líder y Capitán).')
    .addUserOption((o) => o.setName('usuario').setDescription('Miembro a advertir').setRequired(true))
    .addStringOption((o) => o.setName('motivo').setDescription('Motivo de la advertencia').setRequired(true)),

  new SlashCommandBuilder()
    .setName('advertencias')
    .setDescription('Muestra las advertencias registradas de un miembro.')
    .addUserOption((o) => o.setName('usuario').setDescription('Miembro a consultar (vacío = tú)')),

  new SlashCommandBuilder()
    .setName('expulsar')
    .setDescription('Expulsa (kick) a un miembro del servidor (solo Líder y Capitán).')
    .addUserOption((o) => o.setName('usuario').setDescription('Miembro a expulsar').setRequired(true))
    .addStringOption((o) => o.setName('motivo').setDescription('Motivo de la expulsión')),

  new SlashCommandBuilder()
    .setName('asignar')
    .setDescription('Asigna a un miembro a una escuadra (solo Líder y Capitán).')
    .addUserOption((o) => o.setName('usuario').setDescription('Miembro a asignar').setRequired(true))
    .addIntegerOption((o) =>
      o.setName('escuadra').setDescription('Número de escuadra (1-12)').setRequired(true).setMinValue(1).setMaxValue(12),
    ),

  new SlashCommandBuilder()
    .setName('encuesta')
    .setDescription('Crea una encuesta con reacciones numéricas (solo Líder y Capitán).')
    .addStringOption((o) => o.setName('pregunta').setDescription('Pregunta de la encuesta').setRequired(true))
    .addStringOption((o) => o.setName('opcion1').setDescription('Opción 1').setRequired(true))
    .addStringOption((o) => o.setName('opcion2').setDescription('Opción 2').setRequired(true))
    .addStringOption((o) => o.setName('opcion3').setDescription('Opción 3'))
    .addStringOption((o) => o.setName('opcion4').setDescription('Opción 4'))
    .addStringOption((o) => o.setName('opcion5').setDescription('Opción 5')),

  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Abre un canal privado de soporte visible para ti y el staff.')
    .addStringOption((o) => o.setName('motivo').setDescription('Motivo del ticket (opcional)')),

  new SlashCommandBuilder()
    .setName('ticket-cerrar')
    .setDescription('Cierra y borra el canal ticket actual (solo Líder y Capitán).'),

  new SlashCommandBuilder()
    .setName('reglas')
    .setDescription('Muestra el reglamento del clan NCA FFWS.'),

  new SlashCommandBuilder()
    .setName('rotaciones')
    .setDescription('Publica en #rutinas las rotaciones, caídas y estrategias del mapa elegido.')
    .addStringOption((o) =>
      o
        .setName('mapa')
        .setDescription('¿Para qué mapa quieres la información?')
        .setRequired(true)
        .addChoices(
          { name: 'Bermuda', value: 'bermuda' },
          { name: 'Purgatorio', value: 'purgatorio' },
          { name: 'Kalahari', value: 'kalahari' },
          { name: 'NeXTerra', value: 'nexterra' },
        ),
    ),
];

// ---------- Manejadores ----------

// Busca un canal de texto del servidor por nombre (insensible a mayúsculas).
function findTextChannelByName(guild, name) {
  if (!guild || !guild.channels || !guild.channels.cache) return null;
  const target = String(name).toLowerCase();
  return (
    guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildText && c.name.toLowerCase() === target,
    ) || null
  );
}

// Ids de Discord de quienes reaccionaron con un emoji (sin bots).
async function reactionUserIds(message, emoji) {
  try {
    const reaction = message.reactions.cache.get(emoji);
    if (!reaction) return [];
    const users = await reaction.users.fetch();
    return [...users.values()].filter((u) => !u.bot).map((u) => u.id);
  } catch (_) {
    return [];
  }
}

// Nombres visibles (apodo del servidor si existe) para una lista de ids.
async function displayNamesForIds(guild, ids) {
  const names = [];
  for (const id of ids) {
    let name = null;
    try {
      const m = await guild.members.fetch(id);
      name = m ? m.displayName : null;
    } catch (_) {
      name = null;
    }
    if (!name) name = db.getDisplayName(id);
    names.push(name);
  }
  return names;
}

// Programa el recordatorio automático de guerra (miércoles, viernes, sábado).
function setupWarReminders() {
  const expr = utils.buildReminderCron();
  if (!cron.validate(expr)) {
    console.error(`⚠️ WAR_REMINDER_CRON inválido ("${expr}"). Recordatorios desactivados.`);
    return;
  }
  cron.schedule(
    expr,
    async () => {
      try {
        const guild = client.guilds.cache.get(GUILD_ID);
        const channel = findTextChannelByName(guild, 'convocatoria');
        if (!channel) {
          console.log('⏰ Recordatorio de guerra: no existe #convocatoria, se omite.');
          return;
        }
        await channel.send(utils.warReminderText());
        console.log('⏰ Recordatorio de guerra publicado en #convocatoria.');
      } catch (err) {
        console.error('⚠️ Error publicando el recordatorio de guerra:', err && err.message ? err.message : err);
      }
    },
    { timezone: 'America/Chicago' },
  );
  console.log(`⏰ Recordatorios de guerra programados (${expr}, America/Chicago).`);
}

// Programa el anuncio del MVP semanal (domingos 18:00 America/Chicago).
function setupMvp() {
  const expr = utils.buildMvpCron();
  if (!cron.validate(expr)) {
    console.error(`⚠️ MVP_CRON inválido ("${expr}"). MVP semanal desactivado.`);
    return;
  }
  cron.schedule(
    expr,
    async () => {
      try {
        const guild = client.guilds.cache.get(GUILD_ID);
        const channel = findTextChannelByName(guild, 'general');
        if (!channel) {
          console.log('🏅 MVP semanal: no existe #general, se omite.');
          return;
        }
        const rows = db.getLeaderboard('todo', db.getWeekStart(), 1);
        if (rows.length === 0) {
          console.log('🏅 MVP semanal: sin datos esta semana, no se publica nada.');
          return;
        }
        const mvp = rows[0];
        const embed = new EmbedBuilder()
          .setColor(COLOR_CLAN)
          .setTitle('🏅 MVP de la semana — NCA FFWS')
          .setDescription(
            `¡Felicidades **${mvp.display_name}**! 🐺\n\n` +
              `• Normales: **${fmt(mvp.normal)}**\n` +
              `• Guerra: **${fmt(mvp.war)}**\n` +
              `• Total: **${fmt(mvp.total)}**`,
          )
          .setFooter({ text: `Semana del ${db.getWeekStart()}` });
        await channel.send({ embeds: [embed] });
        console.log(`🏅 MVP semanal publicado: ${mvp.display_name}.`);
      } catch (err) {
        console.error('⚠️ Error publicando el MVP semanal:', err && err.message ? err.message : err);
      }
    },
    { timezone: 'America/Chicago' },
  );
  console.log(`🏅 MVP semanal programado (${expr}, America/Chicago).`);
}

// Sorteos activos en memoria: messageId -> timeout (v1: se pierden al reiniciar).
const sorteosActivos = new Map();

// Rol "Élite Semanal" automático: cada lunes 06:00 (America/Chicago) se asigna
// a los 3 primeros de la tabla de la semana anterior, quitándoselo a quienes
// lo tuvieran. Requiere el permiso "Gestionar roles" del bot y que exista el
// rol llamado exactamente "Élite Semanal" en el servidor.
const ROL_ELITE = 'Élite Semanal';

function setupEliteRole() {
  const expr = utils.buildEliteCron();
  if (!cron.validate(expr)) {
    console.error(`⚠️ ELITE_CRON inválido ("${expr}"). Rol Élite Semanal desactivado.`);
    return;
  }
  cron.schedule(
    expr,
    async () => {
      try {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) {
          console.log('🌟 Élite Semanal: servidor no encontrado en caché, se omite.');
          return;
        }
        try {
          await guild.members.fetch(); // puebla la caché para role.members
        } catch (_) {
          // Si falla, se sigue con lo que haya en caché.
        }
        const weekStart = utils.getPrevWeekStart();
        const top3 = db.getLeaderboard('todo', weekStart, 3);
        if (top3.length === 0) {
          console.log(`🌟 Élite Semanal: sin datos en la semana del ${weekStart}, no se hace nada.`);
          return;
        }
        const role = guild.roles.cache.find((r) => r.name === ROL_ELITE);
        if (!role) {
          console.error(
            `⚠️ Élite Semanal: no existe el rol "${ROL_ELITE}" en el servidor. Créalo para activar el rol semanal.`,
          );
          return;
        }
        // Quitar el rol a quienes lo tuvieran antes.
        for (const member of [...role.members.values()]) {
          try {
            await member.roles.remove(role);
          } catch (err) {
            console.error(
              `⚠️ Élite Semanal: no se pudo quitar el rol a ${member.displayName}:`,
              err && err.message ? err.message : err,
            );
          }
        }
        // Asignarlo a los 3 primeros de la semana anterior.
        const asignados = [];
        for (const row of top3) {
          try {
            const member = await guild.members.fetch(row.discord_id);
            if (!member) continue;
            await member.roles.add(role);
            asignados.push(member.displayName);
          } catch (err) {
            console.error(
              `⚠️ Élite Semanal: no se pudo asignar el rol a ${row.display_name}:`,
              err && err.message ? err.message : err,
            );
          }
        }
        console.log(`🌟 Élite Semanal (semana del ${weekStart}): ${asignados.join(', ') || 'nadie asignado'}.`);
      } catch (err) {
        console.error('⚠️ Error en el rol Élite Semanal:', err && err.message ? err.message : err);
      }
    },
    { timezone: 'America/Chicago' },
  );
  console.log(`🌟 Rol Élite Semanal programado (${expr}, America/Chicago).`);
}

async function cerrarSorteo(channel, messageId, premio) {
  sorteosActivos.delete(messageId);
  let msg = null;
  try {
    msg = await channel.messages.fetch(messageId);
  } catch (_) {
    return;
  }
  const ids = await reactionUserIds(msg, '🎉');
  const ganadorId = utils.pickWinner(ids);
  if (!ganadorId) {
    await channel.send(`🎉 Sorteo **${premio}** declarado **desierto**: nadie participó.`);
    return;
  }
  await channel.send(
    `🎉 ¡Sorteo finalizado! Premio: **${premio}**\n\n🥇 Ganador: <@${ganadorId}> ¡Felicidades, a reclamar tu premio! 🐺`,
  );
}

async function cmdPuntosAgregar(interaction) {
  if (!hasStaffRole(interaction.member)) {
    return interaction.reply({ content: '🚫 Solo los roles Líder y Capitán pueden agregar puntos.', ephemeral: true });
  }
  const member = interaction.options.getMember('miembro');
  const cantidad = interaction.options.getInteger('cantidad');
  const tipo = interaction.options.getString('tipo');
  const res = db.addPoints(member.user.id, member.displayName, cantidad, tipo);
  await interaction.reply(
    `➕ **${member.displayName}** sumó ${fmt(cantidad)} puntos ${tipoLabel(tipo)}.\n${progressLine(res.normal, res.war)}`,
  );
}

async function cmdPuntosQuitar(interaction) {
  if (!hasStaffRole(interaction.member)) {
    return interaction.reply({ content: '🚫 Solo los roles Líder y Capitán pueden quitar puntos.', ephemeral: true });
  }
  const member = interaction.options.getMember('miembro');
  const cantidad = interaction.options.getInteger('cantidad');
  const tipo = interaction.options.getString('tipo');
  const res = db.removePoints(member.user.id, member.displayName, cantidad, tipo);
  await interaction.reply(
    `➖ **${member.displayName}** restó ${fmt(cantidad)} puntos ${tipoLabel(tipo)} (corrección).\n${progressLine(res.normal, res.war)}`,
  );
}

async function cmdPuntosVer(interaction) {
  const member = interaction.options.getMember('miembro') || interaction.member;
  if (!member) {
    return interaction.reply({ content: '⚠️ Este comando solo funciona dentro del servidor.', ephemeral: true });
  }
  const { normal, war } = db.getPoints(member.user.id);
  const total = normal + war;
  const embed = new EmbedBuilder()
    .setColor(COLOR_CLAN)
    .setTitle(`📊 Puntos de ${member.displayName}`)
    .addFields(
      { name: 'Normales', value: `${fmt(normal)} / ${fmt(db.MIN_NORMAL)}`, inline: true },
      { name: 'Guerra', value: `${fmt(war)} / ${fmt(db.MIN_WAR)}`, inline: true },
      { name: 'Total', value: fmt(total), inline: true },
    )
    .setFooter({ text: progressLine(normal, war) });
  await interaction.reply({ embeds: [embed] });
}

async function cmdTabla(interaction) {
  const tipo = interaction.options.getString('tipo') || 'todo';
  const week = db.getWeekStart();
  const rows = db.getLeaderboard(tipo, week, 20);
  if (rows.length === 0) {
    return interaction.reply('📭 Aún no hay puntos registrados esta semana. ¡A sumar, escuadra!');
  }
  const tituloTipo = tipo === 'normal' ? 'normales' : tipo === 'war' ? 'de guerra' : 'general';
  const lines = rows.map((r, i) => {
    const m = db.meetsMinimums(r.normal, r.war);
    const ok = tipo === 'normal' ? m.normal : tipo === 'war' ? m.war : m.normal && m.war;
    const icon = ok ? '✅' : '⚠️';
    const val =
      tipo === 'normal' ? `${fmt(r.normal)} pts`
      : tipo === 'war' ? `${fmt(r.war)} pts`
      : `${fmt(r.normal)} + ${fmt(r.war)} = ${fmt(r.total)}`;
    return `**${i + 1}.** ${r.display_name} — ${val} ${icon}`;
  });
  const embed = new EmbedBuilder()
    .setColor(COLOR_CLAN)
    .setTitle(`🏆 Tabla NCA FFWS (${tituloTipo})`)
    .setDescription(lines.join('\n'))
    .setFooter({ text: `Semana del ${week} · ✅ cumple el mínimo · ⚠️ por debajo del mínimo` });
  await interaction.reply({ embeds: [embed] });
}

async function cmdSemanaNueva(interaction) {
  if (!isLeader(interaction.member)) {
    return interaction.reply({ content: '🚫 Solo el rol Líder puede abrir una semana nueva.', ephemeral: true });
  }
  const res = db.archiveWeek();
  if (!res.archived) {
    return interaction.reply({ content: '📭 La semana actual no tiene puntos registrados, no hay nada que archivar.', ephemeral: true });
  }
  await interaction.reply(
    `🗄️ Semana del **${res.week}** archivada con ${res.count} jugador(es).\nContadores en cero. ¡A por la nueva semana, a ganar se ha dicho! 🐺`,
  );
}

async function cmdConvocar(interaction) {
  if (!hasStaffRole(interaction.member)) {
    return interaction.reply({ content: '🚫 Solo los roles Líder y Capitán pueden publicar convocatorias.', ephemeral: true });
  }
  const fecha = interaction.options.getString('fecha');
  const hora = interaction.options.getString('hora');
  const notas = interaction.options.getString('notas');

  // Si se invoca fuera de #convocatoria, publicar ahí; si no existe, en el canal actual.
  let target = interaction.channel;
  const convChannel = findTextChannelByName(interaction.guild, 'convocatoria');
  if (convChannel && interaction.channelId !== convChannel.id) target = convChannel;
  if (!target || !target.isTextBased || !target.isTextBased()) {
    return interaction.reply({ content: '⚠️ No encontré un canal de texto válido para la convocatoria.', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setColor(COLOR_CLAN)
    .setTitle('⚔️ Convocatoria de guerra — NCA FFWS')
    .addFields(
      { name: '📅 Fecha', value: fecha, inline: true },
      { name: '🕖 Hora', value: hora, inline: true },
    )
    .setFooter({ text: 'Reacciona ✅ si asistes · ❌ si no puedes' });
  if (notas) embed.setDescription(notas);

  let msg;
  try {
    msg = await target.send({ embeds: [embed] });
  } catch (err) {
    console.error('Error publicando convocatoria:', err && err.message ? err.message : err);
    return interaction.reply({ content: '⚠️ No pude publicar en ese canal. Revisa los permisos del bot.', ephemeral: true });
  }
  try {
    await msg.react('✅');
    await msg.react('❌');
  } catch (err) {
    console.error('Error añadiendo reacciones:', err && err.message ? err.message : err);
  }
  db.saveConvocatoria(target.id, msg.id, fecha, hora, notas);
  await interaction.reply({ content: `📣 Convocatoria publicada en ${target}.`, ephemeral: true });
}

async function cmdConvocados(interaction) {
  const conv = db.getLastConvocatoria();
  if (!conv) {
    return interaction.reply({ content: '📭 Aún no hay convocatorias publicadas.', ephemeral: true });
  }
  let msg;
  try {
    const channel = await interaction.guild.channels.fetch(conv.channel_id);
    msg = await channel.messages.fetch(conv.message_id);
  } catch (_) {
    return interaction.reply({ content: '⚠️ No pude leer la última convocatoria (el mensaje ya no existe).', ephemeral: true });
  }
  const idsSi = await reactionUserIds(msg, '✅');
  const idsNoRaw = await reactionUserIds(msg, '❌');
  const idsNo = idsNoRaw.filter((id) => !idsSi.includes(id));
  const [nombresSi, nombresNo] = await Promise.all([
    displayNamesForIds(interaction.guild, idsSi),
    displayNamesForIds(interaction.guild, idsNo),
  ]);
  const embed = new EmbedBuilder()
    .setColor(COLOR_CLAN)
    .setTitle(`📋 Convocados — ${conv.fecha} · ${conv.hora}`)
    .addFields(
      { name: `✅ Confirmados (${nombresSi.length})`, value: utils.formatNameList(nombresSi) },
      { name: `❌ Ausentes (${nombresNo.length})`, value: utils.formatNameList(nombresNo) },
    );
  await interaction.reply({ embeds: [embed] });
}

async function cmdAnuncio(interaction) {
  if (!hasStaffRole(interaction.member)) {
    return interaction.reply({ content: '🚫 Solo los roles Líder y Capitán pueden publicar anuncios.', ephemeral: true });
  }
  const texto = interaction.options.getString('texto');
  const canalOpt = interaction.options.getChannel('canal');
  const target =
    canalOpt && canalOpt.isTextBased && canalOpt.isTextBased()
      ? canalOpt
      : findTextChannelByName(interaction.guild, 'anuncios');
  if (!target) {
    return interaction.reply({
      content: '⚠️ No encontré el canal #anuncios. Indica el canal destino con la opción "canal".',
      ephemeral: true,
    });
  }
  const embed = new EmbedBuilder()
    .setColor(COLOR_CLAN)
    .setTitle('📢 ANUNCIO NCA FFWS')
    .setDescription(texto)
    .setFooter({ text: `Publicado por ${interaction.member.displayName}` })
    .setTimestamp();
  try {
    await target.send({ embeds: [embed] });
  } catch (err) {
    console.error('Error publicando anuncio:', err && err.message ? err.message : err);
    return interaction.reply({ content: '⚠️ No pude publicar en ese canal. Revisa los permisos del bot.', ephemeral: true });
  }
  await interaction.reply({ content: `📢 Anuncio publicado en ${target}.`, ephemeral: true });
}

async function cmdSorteo(interaction) {
  if (!hasStaffRole(interaction.member)) {
    return interaction.reply({ content: '🚫 Solo los roles Líder y Capitán pueden iniciar sorteos.', ephemeral: true });
  }
  const premio = interaction.options.getString('premio');
  const minutos = interaction.options.getInteger('duracion_minutos') || 60;
  const channel = interaction.channel;
  if (!channel || !channel.isTextBased || !channel.isTextBased()) {
    return interaction.reply({ content: '⚠️ Este comando solo funciona en un canal de texto.', ephemeral: true });
  }
  const fin = new Date(Date.now() + minutos * 60 * 1000);
  const embed = new EmbedBuilder()
    .setColor(COLOR_CLAN)
    .setTitle('🎉 ¡SORTEO NCA FFWS!')
    .setDescription(`**Premio:** ${premio}\n\nReacciona con 🎉 para participar.`)
    .setFooter({ text: `Termina en ${minutos} minuto(s)` })
    .setTimestamp(fin);
  let msg;
  try {
    msg = await channel.send({ embeds: [embed] });
    await msg.react('🎉');
  } catch (err) {
    console.error('Error iniciando sorteo:', err && err.message ? err.message : err);
    return interaction.reply({ content: '⚠️ No pude publicar el sorteo. Revisa los permisos del bot.', ephemeral: true });
  }
  const timeout = setTimeout(() => {
    cerrarSorteo(channel, msg.id, premio).catch((err) =>
      console.error('Error cerrando sorteo:', err && err.message ? err.message : err),
    );
  }, minutos * 60 * 1000);
  if (timeout.unref) timeout.unref();
  sorteosActivos.set(msg.id, timeout);
  await interaction.reply({ content: `🎉 Sorteo publicado en ${channel}. Duración: ${minutos} minuto(s).`, ephemeral: true });
}

async function cmdAdvertir(interaction) {
  if (!hasStaffRole(interaction.member)) {
    return interaction.reply({ content: '🚫 Solo los roles Líder y Capitán pueden advertir.', ephemeral: true });
  }
  const user = interaction.options.getUser('usuario');
  const motivo = interaction.options.getString('motivo');
  const w = db.addWarn(user.id, motivo, interaction.user.username);
  const total = db.countWarns(user.id);
  let dmOk = true;
  try {
    await user.send(
      `⚠️ Has recibido una advertencia en **NCA FFWS**.\n**Motivo:** ${motivo}\nAdvertencias acumuladas: ${total}.`,
    );
  } catch (_) {
    dmOk = false; // DMs cerrados: no es un error fatal.
  }
  await interaction.reply(
    `⚠️ **${user.username}** advertido (advertencia #${w.id}, total: ${total}).\n**Motivo:** ${motivo}` +
      (dmOk ? '' : '\n_No se pudo avisar por DM (los tiene cerrados)._'),
  );
}

async function cmdAdvertencias(interaction) {
  const user = interaction.options.getUser('usuario') || interaction.user;
  const warns = db.getWarns(user.id);
  if (warns.length === 0) {
    return interaction.reply({ content: `✅ **${user.username}** no tiene advertencias registradas.`, ephemeral: true });
  }
  const lines = warns.map((w) => `**#${w.id}** — ${w.motivo} _(por ${w.moderador}, ${w.fecha})_`);
  const embed = new EmbedBuilder()
    .setColor(COLOR_CLAN)
    .setTitle(`⚠️ Advertencias de ${user.username} (${warns.length})`)
    .setDescription(lines.join('\n'));
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function cmdExpulsar(interaction) {
  if (!hasStaffRole(interaction.member)) {
    return interaction.reply({ content: '🚫 Solo los roles Líder y Capitán pueden expulsar.', ephemeral: true });
  }
  const member = interaction.options.getMember('usuario');
  const motivo = interaction.options.getString('motivo') || 'Sin motivo especificado';
  if (!member) {
    return interaction.reply({ content: '⚠️ Ese usuario no está en el servidor.', ephemeral: true });
  }
  if (member.id === interaction.user.id) {
    return interaction.reply({ content: '🚫 No puedes expulsarte a ti mismo.', ephemeral: true });
  }
  try {
    await member.kick(motivo);
  } catch (err) {
    console.error('Error al expulsar:', err && err.message ? err.message : err);
    return interaction.reply({
      content:
        '⚠️ No pude expulsar a ese miembro. Revisa que el bot tenga el permiso **Expulsar miembros** y que su rol esté por encima del rol del miembro.',
      ephemeral: true,
    });
  }
  await interaction.reply(`👢 **${member.displayName}** fue expulsado del servidor.\n**Motivo:** ${motivo}`);
}

async function cmdAsignar(interaction) {
  if (!hasStaffRole(interaction.member)) {
    return interaction.reply({ content: '🚫 Solo los roles Líder y Capitán pueden asignar escuadras.', ephemeral: true });
  }
  const member = interaction.options.getMember('usuario');
  const num = interaction.options.getInteger('escuadra');
  const roleName = utils.squadRoleName(num);
  if (!member) {
    return interaction.reply({ content: '⚠️ Ese usuario no está en el servidor.', ephemeral: true });
  }
  if (!roleName) {
    return interaction.reply({ content: '⚠️ La escuadra debe ser un número del 1 al 12.', ephemeral: true });
  }
  const guild = interaction.guild;
  const newRole = guild.roles.cache.find((r) => r.name === roleName);
  if (!newRole) {
    return interaction.reply({ content: `⚠️ No existe el rol "${roleName}" en el servidor.`, ephemeral: true });
  }
  try {
    const isSquadRole = (name) => /^Escuadra (?:[1-9]|1[0-2])$/.test(name);
    const toRemove = member.roles.cache.filter((r) => r.id !== newRole.id && isSquadRole(r.name));
    if (toRemove.size > 0) await member.roles.remove(toRemove);
    await member.roles.add(newRole);
  } catch (err) {
    console.error('Error asignando escuadra:', err && err.message ? err.message : err);
    return interaction.reply({
      content:
        '⚠️ No pude asignar la escuadra. Revisa que el bot tenga el permiso **Gestionar roles** y que su rol esté por encima de los roles de escuadra.',
      ephemeral: true,
    });
  }
  await interaction.reply(`🛡️ **${member.displayName}** ahora pertenece a **${roleName}**.`);
}

async function cmdEncuesta(interaction) {
  if (!hasStaffRole(interaction.member)) {
    return interaction.reply({ content: '🚫 Solo los roles Líder y Capitán pueden crear encuestas.', ephemeral: true });
  }
  const pregunta = interaction.options.getString('pregunta');
  const opciones = [];
  for (let i = 1; i <= 5; i++) {
    const o = interaction.options.getString(`opcion${i}`);
    if (o) opciones.push(o);
  }
  const channel = interaction.channel;
  if (!channel || !channel.isTextBased || !channel.isTextBased()) {
    return interaction.reply({ content: '⚠️ Este comando solo funciona en un canal de texto.', ephemeral: true });
  }
  const emojis = utils.pollEmojis(opciones.length);
  const lines = opciones.map((o, i) => `${emojis[i]} ${o}`);
  const embed = new EmbedBuilder()
    .setColor(COLOR_CLAN)
    .setTitle('📊 Encuesta NCA FFWS')
    .setDescription(`**${pregunta}**\n\n${lines.join('\n')}`)
    .setFooter({ text: `Encuesta de ${interaction.member.displayName} · reacciona para votar` });
  let msg;
  try {
    msg = await channel.send({ embeds: [embed] });
    for (const e of emojis) await msg.react(e);
  } catch (err) {
    console.error('Error publicando encuesta:', err && err.message ? err.message : err);
    return interaction.reply({ content: '⚠️ No pude publicar la encuesta. Revisa los permisos del bot.', ephemeral: true });
  }
  await interaction.reply({ content: `📊 Encuesta publicada en ${channel}.`, ephemeral: true });
}

async function cmdTicket(interaction) {
  const motivo = interaction.options.getString('motivo') || 'Sin motivo especificado';
  const guild = interaction.guild;
  if (!guild) {
    return interaction.reply({ content: '⚠️ Este comando solo funciona dentro del servidor.', ephemeral: true });
  }
  const user = interaction.user;
  const channelName = `ticket-${utils.sanitizeTicketName(user.username)}`;
  const existente = findTextChannelByName(guild, channelName);
  if (existente) {
    return interaction.reply({ content: `🎫 Ya tienes un ticket abierto: ${existente}.`, ephemeral: true });
  }
  const liderRole = guild.roles.cache.find((r) => r.name === ROL_LIDER);
  const capitanRole = guild.roles.cache.find((r) => r.name === ROL_CAPITAN);
  const readWrite = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
  ];
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: user.id, allow: readWrite },
  ];
  if (liderRole) overwrites.push({ id: liderRole.id, allow: readWrite });
  if (capitanRole) overwrites.push({ id: capitanRole.id, allow: readWrite });
  let channel;
  try {
    channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      permissionOverwrites: overwrites,
      reason: `Ticket de ${user.username}: ${motivo}`,
    });
  } catch (err) {
    console.error('Error creando ticket:', err && err.message ? err.message : err);
    return interaction.reply({
      content: '⚠️ No pude crear el ticket. Revisa que el bot tenga el permiso **Gestionar canales**.',
      ephemeral: true,
    });
  }
  const embed = new EmbedBuilder()
    .setColor(COLOR_CLAN)
    .setTitle(`🎫 Ticket de ${user.username}`)
    .setDescription(`**Motivo:** ${motivo}\n\nEl staff te atenderá aquí. Un Líder o Capitán puede cerrarlo con \`/ticket-cerrar\`.`);
  await channel.send({ content: `<@${user.id}>`, embeds: [embed] }).catch(() => {});
  await interaction.reply({ content: `🎫 Tu ticket está listo: ${channel}.`, ephemeral: true });
}

async function cmdTicketCerrar(interaction) {
  if (!hasStaffRole(interaction.member)) {
    return interaction.reply({ content: '🚫 Solo los roles Líder y Capitán pueden cerrar tickets.', ephemeral: true });
  }
  const channel = interaction.channel;
  if (!channel || !utils.isTicketChannel(channel.name)) {
    return interaction.reply({ content: '⚠️ Este comando solo se puede usar dentro de un canal ticket.', ephemeral: true });
  }
  await interaction.reply('🔒 Cerrando ticket…');
  try {
    await channel.delete('Ticket cerrado por el staff');
  } catch (err) {
    console.error('Error borrando ticket:', err && err.message ? err.message : err);
  }
}

async function cmdReglas(interaction) {
  const embed = new EmbedBuilder().setColor(COLOR_CLAN).setDescription(RULES_TEXT);
  await interaction.reply({ embeds: [embed] });
}

async function cmdRotaciones(interaction) {
  const mapaKey = interaction.options.getString('mapa');
  const info = ROTACIONES[mapaKey];
  if (!info) {
    await interaction.reply({ content: '⚠️ Mapa no reconocido.', ephemeral: true });
    return;
  }
  const embed = new EmbedBuilder()
    .setColor(COLOR_CLAN)
    .setTitle(`🗺️ ${info.nombre} — Rotaciones, caídas y estrategias`)
    .addFields(
      { name: '🔄 Rotaciones', value: info.rotaciones },
      { name: '🪂 Caídas', value: info.caidas },
      { name: '🧠 Estrategias', value: info.estrategias },
    );
  const files = [];
  if (info.imagen) {
    const attachment = new AttachmentBuilder(`./assets/${info.imagen}`);
    files.push(attachment);
    embed.setImage(`attachment://${info.imagen}`);
  }
  // La guía se publica en el canal de entrenamiento (#rutinas).
  const canalRutinas = findTextChannelByName(interaction.guild, 'rutinas');
  if (canalRutinas) {
    await canalRutinas.send({ embeds: [embed], files });
    await interaction.reply({
      content: '✅ Guía publicada en #rutinas. ¡A entrenar! 🎯',
      ephemeral: true,
    });
  } else {
    await interaction.reply({ embeds: [embed], files });
  }
}

const handlers = {
  'puntos-agregar': cmdPuntosAgregar,
  'puntos-quitar': cmdPuntosQuitar,
  'puntos-ver': cmdPuntosVer,
  'tabla': cmdTabla,
  'semana-nueva': cmdSemanaNueva,
  'convocar': cmdConvocar,
  'convocados': cmdConvocados,
  'anuncio': cmdAnuncio,
  'sorteo': cmdSorteo,
  'advertir': cmdAdvertir,
  'advertencias': cmdAdvertencias,
  'expulsar': cmdExpulsar,
  'asignar': cmdAsignar,
  'encuesta': cmdEncuesta,
  'ticket': cmdTicket,
  'ticket-cerrar': cmdTicketCerrar,
  'reglas': cmdReglas,
  'rotaciones': cmdRotaciones,
};

// Bienvenida por DM con el reglamento al unirse un miembro nuevo,
// más asignación automática del rol "Jugador" (da acceso a las 12
// secciones de escuadra y demás espacios del clan).
// Requiere el intent privilegiado GuildMembers (toggle "SERVER MEMBERS INTENT"
// en el portal de desarrolladores). Si el usuario tiene los DM cerrados,
// el error se ignora en silencio.
client.on('guildMemberAdd', async (member) => {
  try {
    const embed = new EmbedBuilder()
      .setColor(COLOR_CLAN)
      .setTitle('🐺 ¡Bienvenido a NCA FFWS!')
      .setDescription(`Hola **${member.user.username}**, ¡qué bueno tenerte en el clan!\n\n${RULES_TEXT}`);
    await member.send({ embeds: [embed] });
  } catch (_) {
    // DMs cerrados: no se hace nada.
  }
  try {
    const jugadorRole = member.guild.roles.cache.find((r) => r.name === 'Jugador');
    if (jugadorRole) {
      await member.roles.add(jugadorRole);
      console.log(`✅ Rol Jugador asignado a ${member.user.tag}`);
    } else {
      console.warn('⚠️ No se encontró el rol "Jugador" para auto-asignar.');
    }
  } catch (err) {
    console.error('⚠️ No se pudo asignar el rol Jugador:', err && err.message ? err.message : err);
  }
});

// Colector de archivos: todo mensaje con adjuntos se reenvía a
// #revision-archivos para revisión del staff (ver file_collector.js).
client.on('messageCreate', (message) => {
  fileCollector.handleMessageCreate(message).catch((err) => {
    console.error('⚠️ Error en el colector de archivos:', err && err.message ? err.message : err);
  });
});

client.on('interactionCreate', async (interaction) => {  if (!interaction.isChatInputCommand()) return;
  const handler = handlers[interaction.commandName];
  if (!handler) return;
  try {
    await handler(interaction);
  } catch (err) {
    console.error('Error en comando:', err && err.message ? err.message : err);
    const msg = '⚠️ Algo salió mal procesando el comando. Inténtalo de nuevo en un momento.';
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: msg, ephemeral: true });
      } else {
        await interaction.reply({ content: msg, ephemeral: true });
      }
    } catch (_) {
      // Si ni siquiera se puede responder, no hay más que hacer.
    }
  }
});

client.once('ready', async () => {
  console.log(`🤖 NCA FFWS Bot en línea como ${client.user.tag}`);
  setupWarReminders();
  setupMvp();
  setupEliteRole();
  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), {
      body: commands.map((c) => c.toJSON()),
    });
    console.log(`✅ ${commands.length} comandos slash registrados en el servidor.`);
  } catch (err) {
    console.error('❌ No se pudieron registrar los comandos:', err && err.message ? err.message : err);
  }
});

process.on('unhandledRejection', (err) => {
  console.error('⚠️ Error no controlado:', err && err.message ? err.message : err);
});

// Servidor HTTP mínimo para hosting gratuito (Render Web Service exige escuchar
// en process.env.PORT). Sirve como health check y para el keep-alive externo.
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('NCA FFWS Bot en linea');
}).listen(PORT, () => {
  console.log(`🌐 HTTP escuchando en el puerto ${PORT}`);
});

client.login(TOKEN).catch(() => {
  console.error('❌ No se pudo iniciar sesión en Discord. Revisa que DISCORD_TOKEN sea válido.');
  process.exit(1);
});
