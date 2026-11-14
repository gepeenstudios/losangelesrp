// Bot de Discord de Los Ángeles RP: copia los roles de la web a Discord (pone y quita).
// Corre solo cada 15 min en GitHub Actions; no necesita tu compu prendida.
// Variables: DISCORD_TOKEN (token del bot), SYNC_KEY (llave de Panel Staff → Discord), GUILD_ID (opcional).
import fs from 'node:fs';
const { roles: WEB_ROLES, staff: STAFF } = JSON.parse(fs.readFileSync(new URL('./roles.json', import.meta.url)));
const cfg = fs.readFileSync(new URL('../web/config.js', import.meta.url), 'utf8');
const SUPA = cfg.match(/SUPABASE_URL = '([^']+)'/)[1], ANON = cfg.match(/SUPABASE_KEY = '([^']+)'/)[1];
const { DISCORD_TOKEN, SYNC_KEY } = process.env;
if (!DISCORD_TOKEN || !SYNC_KEY) { console.log('Bot sin configurar: faltan DISCORD_TOKEN o SYNC_KEY en los secretos de GitHub.'); process.exit(0); }
const DRY = process.argv.includes('--dry'); // muestra qué haría sin tocar Discord

async function api(path, opt = {}) { // Discord REST con reintento por límite de velocidad
  for (let i = 0; i < 5; i++) {
    const r = await fetch((process.env.DISCORD_API || 'https://discord.com/api/v10') + path, { ...opt, headers: { Authorization: 'Bot ' + DISCORD_TOKEN, 'Content-Type': 'application/json', ...opt.headers } });
    if (r.status === 429) { const wait = ((await r.json()).retry_after || 1) * 1000; await new Promise(s => setTimeout(s, wait)); continue; }
    if (!r.ok) throw new Error(`${opt.method || 'GET'} ${path} → ${r.status} ${await r.text()}`);
    return r.status === 204 ? null : r.json();
  }
}
// 1) qué dice la web
const res = await fetch((process.env.SUPA_URL || SUPA) + '/rest/v1/rpc/discord_sync', { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ bot_key: SYNC_KEY }) });
if (!res.ok) throw new Error('La web rechazó la llave del bot: ' + await res.text());
const { users } = await res.json();
// 2) el server de Discord
const guild = process.env.GUILD_ID || (await api('/users/@me/guilds'))[0]?.id;
if (!guild) throw new Error('El bot no está en ningún servidor. Invítalo primero.');
const STAFF_NAMES = Object.fromEntries(STAFF), MANAGED = [...WEB_ROLES, ...Object.values(STAFF_NAMES), 'Verificado', 'Baneado'];
let roles = await api(`/guilds/${guild}/roles`);
for (const name of MANAGED) if (!roles.some(r => r.name === name) && !DRY) roles.push(await api(`/guilds/${guild}/roles`, { method: 'POST', body: JSON.stringify({ name, mentionable: false }) }));
const byName = Object.fromEntries(roles.map(r => [r.name, r.id])), managedIds = new Set(MANAGED.map(n => byName[n]).filter(Boolean));
let members = [], after = '0';
for (;;) { const page = await api(`/guilds/${guild}/members?limit=1000&after=${after}`); members.push(...page); if (page.length < 1000) break; after = page.at(-1).user.id; }
const find = d => members.find(m => [m.user.username, m.user.global_name, m.nick].some(x => x && x.toLowerCase() === d));
// 3) poner y quitar
let add = 0, del = 0, miss = [];
for (const u of users) {
  const m = find(u.discord); if (!m) { miss.push(u.discord); continue; }
  const want = new Set(u.banned ? ['Baneado'] : [...u.roles, ...(u.staff ? [STAFF_NAMES[u.staff]] : []), ...(u.verified ? ['Verificado'] : [])].map(n => byName[n]).filter(Boolean));
  for (const id of want) if (!m.roles.includes(id)) { add++; DRY ? console.log('+', u.discord, roles.find(r => r.id === id)?.name) : await api(`/guilds/${guild}/members/${m.user.id}/roles/${id}`, { method: 'PUT', headers: { 'X-Audit-Log-Reason': 'Sincronizado con la web de Los Ángeles RP' } }); }
  for (const id of m.roles) if (managedIds.has(id) && !want.has(id)) { del++; DRY ? console.log('-', u.discord, roles.find(r => r.id === id)?.name) : await api(`/guilds/${guild}/members/${m.user.id}/roles/${id}`, { method: 'DELETE', headers: { 'X-Audit-Log-Reason': 'Ya no tiene este rol en la web' } }); }
}
console.log(`Listo: ${users.length} cuentas de la web, ${add} roles puestos, ${del} quitados.${miss.length ? ' No están en Discord: ' + miss.join(', ') : ''}`);
