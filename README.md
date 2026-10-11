# NCA FFWS Bot 🐺

Bot de Discord del clan **NCA FFWS** (Free Fire). Lleva el control de puntos
**normales** y de **guerra de clanes** de cada miembro, con los mínimos semanales
del clan y tabla de posiciones; además publica convocatorias de guerra con
confirmación ✅/❌, anuncios del staff, sorteos, recordatorios automáticos de
guerra y moderación rápida; además gestiona escuadras, encuestas, tickets de
soporte, MVP semanal automático, rol "Élite Semanal" automático (top 3 de la
semana anterior) y da la bienvenida por DM con el reglamento.
Además incluye un **colector de archivos**: todo mensaje con adjuntos se
reenvía a #revision-archivos para revisión del staff y queda registrado.
Usa los intents `Guilds`, `GuildMembers` y `GuildMessages`. `GuildMembers` es
privilegiado: hay que activar el toggle **SERVER MEMBERS INTENT** en el portal
de desarrolladores (aplicación → Bot → Privileged Gateway Intents); sirve para
la bienvenida por DM. `GuildMessages` no es privilegiado (solo se declara en
el código) y sirve para el colector de archivos. El intent privilegiado
**Message Content** no hace falta: el bot nunca lee el texto de los mensajes,
solo los adjuntos (nombre y URL).

## Comandos slash (se registran solos al arrancar, solo en tu servidor)

| Comando | Quién puede usarlo | Qué hace |
|---|---|---|
| `/puntos-agregar miembro:@usuario cantidad:N tipo:normal\|guerra` | Líder, Capitán | Suma N puntos al miembro. Muestra su progreso vs los mínimos. |
| `/puntos-quitar miembro:@usuario cantidad:N tipo:normal\|guerra` | Líder, Capitán | Resta N puntos como corrección (nunca baja de cero). |
| `/puntos-ver [miembro]` | Todos | Puntos normales, de guerra y total del miembro (o tuyos si no indicas a nadie), más ✅/⚠️ según los mínimos. |
| `/tabla [tipo:normal\|guerra\|todo]` | Todos | Tabla de posiciones de la semana, ordenada, con ✅ si cumple el mínimo y ⚠️ si está por debajo. |
| `/semana-nueva` | Solo Líder | Archiva la semana actual (guarda snapshot con fecha) y pone los contadores en cero. |
| `/convocar fecha hora [notas]` | Líder, Capitán | Publica una convocatoria de guerra (embed) en #convocatoria con reacciones ✅/❌. |
| `/convocados` | Todos | Lee la última convocatoria y lista confirmados ✅ y ausentes ❌ por nombre. |
| `/anuncio texto [canal]` | Líder, Capitán | Publica un anuncio con formato NCA en #anuncios (o el canal indicado). |
| `/sorteo premio [duracion_minutos=60]` | Líder, Capitán | Sorteo con reacción 🎉; al terminar elige un ganador al azar y lo anuncia. |
| `/advertir @usuario motivo` | Líder, Capitán | Registra una advertencia en la DB y avisa al usuario por DM si es posible. |
| `/advertencias [@usuario]` | Todos | Muestra las advertencias registradas (vacío = las tuyas). Respuesta privada. |
| `/expulsar @usuario [motivo]` | Líder, Capitán | Expulsa (kick) al miembro del servidor. Requiere permiso "Expulsar miembros". |
| `/asignar @usuario escuadra:1-12` | Líder, Capitán | Asigna el rol "Escuadra N" al miembro (le quita otras escuadras). Requiere "Gestionar roles". |
| `/encuesta pregunta opcion1 opcion2 [opcion3-5]` | Líder, Capitán | Encuesta con reacciones numéricas 1️⃣-5️⃣. |
| `/ticket [motivo]` | Todos | Crea un canal privado `ticket-<nombre>` visible para ti y el staff. Requiere "Gestionar canales". |
| `/ticket-cerrar` | Líder, Capitán | Cierra y borra el canal ticket actual (solo dentro de un ticket). |
| `/reglas` | Todos | Muestra el reglamento oficial del clan. |

**Mínimos semanales del clan:** 2.000 puntos normales y 250 de guerra.
Las semanas se identifican por el lunes (fecha `YYYY-MM-DD`).

## Recordatorio automático de guerra

Sin usar ningún comando, el bot publica solo en **#convocatoria** un
recordatorio de guerra los **miércoles, viernes y sábados a las 5:00 p.m.**
(hora de Chicago). Si el canal #convocatoria no existe, el recordatorio se
omite sin errores (queda registrado en los logs).

Para cambiar el horario, define la variable `WAR_REMINDER_CRON` con una
expresión cron (formato de 5 campos). Ejemplos:

```bash
WAR_REMINDER_CRON=0 18 * * 3,5,6   # 6:00 p.m. mié/vie/sáb
WAR_REMINDER_CRON=30 16 * * 3,5,6  # 4:30 p.m. mié/vie/sáb
```

Los días se cuentan 0=domingo … 6=sábado.

## Sorteos

`/sorteo` publica el premio y añade la reacción 🎉. Al cumplirse la duración,
el bot elige un ganador al azar entre quienes reaccionaron (excluye bots) y
lo anuncia mencionándolo en el canal. Si nadie participó, lo declara desierto.

> **Limitación (v1):** los sorteos activos viven en la memoria del proceso. Si
> el bot se reinicia mientras un sorteo sigue abierto, ese sorteo se pierde y
> no se elegirá ganador. No inicies sorteos largos justo antes de un
> redespliegue.

## MVP semanal automático

Sin usar ningún comando, los **domingos a las 6:00 p.m.** (hora de Chicago)
el bot publica en **#general** el MVP de la semana: el primer lugar de la
tabla con sus puntos normales, de guerra y total. Si no hay puntos
registrados esa semana, no publica nada (queda registrado en los logs).

Para cambiar el horario, define `MVP_CRON` (formato cron de 5 campos).
Ejemplo: `MVP_CRON=0 20 * * 0` para domingos 8:00 p.m.

## Rol "Élite Semanal" automático

Sin usar ningún comando, los **lunes a las 6:00 a.m.** (hora de Chicago) el
bot toma a los **3 primeros de la tabla de la semana anterior** y les asigna
el rol **"Élite Semanal"**, quitándoselo a quienes lo tuvieran antes. Si no
hay puntos registrados esa semana, no hace nada.

Requisitos:
- Debe existir en el servidor un rol llamado exactamente `Élite Semanal`.
- El bot necesita el permiso **Gestionar roles** y su rol debe estar por
  encima de "Élite Semanal" en la jerarquía del servidor.

Para cambiar el horario, define `ELITE_CRON` (formato cron de 5 campos).
Ejemplo: `ELITE_CRON=0 8 * * 1` para lunes 8:00 a.m.

## Reglamento del clan

El comando `/reglas` y el mensaje de bienvenida por DM usan el reglamento
oficial, que vive en la constante `RULES_TEXT` al inicio de `index.js`. Si el
clan cambia sus reglas, edita ese texto y redespliega el bot. Texto actual
(póster oficial "REGLAS DEL CLAN"):

> 1. GUERRA DE CLANES: Participación obligatoria. 2. SUBIDA DE RANGO: Al inicio
> de temporada. 3. RESPETO: Cero toxicidad. 4. ACTIVIDAD: +3 días inactivo =
> expulsión. 5. PUNTOS: 2000 normales, 250 en guerra. 6. COMPROMISO:
> Participación en actividades. 7. CONTENIDO: Apoyar con clips.
> 8. COMUNICACIÓN: WhatsApp y Discord. 9. REPORTE: Domingos antes de 8 PM.
> 10. PRUEBAS: Entregar pruebas el fin de semana.

## Bienvenida por DM

Cuando un miembro nuevo entra al servidor (evento `guildMemberAdd`), el bot
le envía por DM un embed de bienvenida con el reglamento. Requiere el intent
privilegiado **Server Members Intent** activado en el portal (ver arriba). Si
el usuario tiene los DM cerrados, el bot lo ignora en silencio.

## Colector de archivos

Sin usar ningún comando, cuando un miembro publica un mensaje **con archivos
adjuntos** (imágenes, videos, documentos) en cualquier canal del servidor, el
bot lo reenvía automáticamente al canal **#revision-archivos** para que el
staff lo revise, y guarda el evento en la tabla `file_log` de la base de datos
(quién, en qué canal, nombres de archivo, URLs y fecha).

- Si #revision-archivos no existe, el bot intenta crearlo **privado** (visible
  solo para los roles "Líder" y "Capitán"); para crearlo necesita el permiso
  **Gestionar canales**. Si no lo tiene, lo anota en los logs y sigue sin
  interrumpirse.
- El reenvío incluye un resumen (miembro mencionado, canal original, fecha y
  lista de archivos) y los archivos re-subidos. No se reenvían mensajes del
  propio bot ni de otros bots, y tampoco lo ya publicado en #revision-archivos
  (evita bucles).
- Para reenviar, el bot necesita en #revision-archivos los permisos **Ver
  canal**, **Enviar mensajes**, **Insertar enlaces** y **Adjuntar archivos**.

> **Intents:** el colector usa el intent `GuildMessages` (no es privilegiado,
> solo se declara en el código) para recibir el evento `messageCreate`. El
> intent privilegiado **Message Content NO hace falta**, porque el bot solo lee
> los adjuntos (nombre y URL), nunca el texto de los mensajes.

## Requisitos

- Node.js 18 o superior
- Una aplicación de bot creada en el [Portal de Desarrolladores de Discord](https://discord.com/developers/applications) con su token

## Uso local

```bash
npm install
cp .env.example .env   # y completa DISCORD_TOKEN y GUILD_ID
node index.js
```

Al arrancar, el bot registra los 17 comandos slash en el servidor indicado por
`GUILD_ID` (para ver el ID del servidor, activa el modo desarrollador en
Discord: Ajustes → Avanzado → Modo desarrollador, luego clic derecho al
servidor → Copiar ID).

## Despliegue en Render

> Se usa **Background Worker** (no Web Service): un bot de Discord no abre
> ningún puerto HTTP, y un Web Service fallaría la revisión de salud de Render
> al no enlazar `$PORT`.

1. Sube este proyecto a un repositorio de GitHub.
2. En [render.com](https://render.com) → **New +** → **Background Worker** →
   conecta el repositorio.
3. Configura:
   - **Build Command:** `npm install`
   - **Start Command:** `node index.js`
   - **Environment → Add Environment Variable:**
     - `DISCORD_TOKEN` = el token del bot
     - `GUILD_ID` = el ID de tu servidor
     - `WAR_REMINDER_CRON` = (opcional) horario del recordatorio de guerra
4. **Create Background Worker.** En los logs verás `🤖 NCA FFWS Bot en línea…`
   y `✅ 17 comandos slash registrados en el servidor.`

**Persistencia:** los puntos viven en SQLite (`nca-bot.db`). En Render el disco
es efímero: si el servicio se reinicia o redespliega, los datos se pierden.
Para conservarlos, añade un **Disk** en Render y apunta la variable `DB_PATH`
a una ruta dentro del disco (p. ej. `/opt/render/project/data/nca-bot.db`).

## Cómo invitar el bot a tu servidor

(Este paso lo haces tú en el portal de Discord, una sola vez.)

1. Ve al [Portal de Desarrolladores](https://discord.com/developers/applications)
   → tu aplicación → **OAuth2 → URL Generator**.
2. En **Scopes** marca `bot` y `applications.commands`.
3. En **Bot Permissions** marca `Administrator` (o al menos: Send Messages,
   Embed Links, Use Application Commands, **Kick Members** (para `/expulsar`),
   **Manage Roles** (para `/asignar` y el rol automático "Élite Semanal"),
   **Manage Channels** (para `/ticket` y para crear #revision-archivos si no
   existe) y **Attach Files** (para reenviar adjuntos en el colector)).
   Además, en **Bot → Privileged Gateway Intents** activa **SERVER MEMBERS
   INTENT** (para la bienvenida por DM a miembros nuevos).
4. Copia la URL generada abajo, ábrela en el navegador, elige tu servidor
   **NCA FFWS** y autoriza.
5. El token va en **Bot → Reset Token** (cópialo a `DISCORD_TOKEN` en Render;
   no lo compartas con nadie).

## Estructura

```
nca-discord-bot/
├── index.js       # bot: comandos slash, permisos por rol, sorteos, cron, manejo de errores
├── db.js          # SQLite: players, points (por semana), week_archive, convocatorias, warns, file_log
├── utils.js       # funciones puras (sorteo, listas, cron) — testeables sin Discord
├── file_collector.js # colector de archivos → #revision-archivos + tabla file_log
├── package.json   # discord.js v14 + better-sqlite3 + node-cron + dotenv
├── .env.example   # plantilla de variables (sin valores reales)
└── README.md
```
