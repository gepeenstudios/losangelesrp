// Bot de Discord de Los Ángeles RP: copia los roles de la web a Discord (pone y quita).
// Corre solo cada 15 min como función programada de Netlify; no necesita tu compu prendida.
// Variables de entorno en Netlify: DISCORD_TOKEN (token del bot), SYNC_KEY (llave de Panel Staff → Discord), GUILD_ID (opcional).
import { SUPABASE_URL as SUPA, SUPABASE_KEY as ANON } from '../../config.js';
import R from './roles.json' with { type: 'json' };
const { roles: WEB_ROLES, staff: STAFF } = R;
const BOT_START = Date.UTC(2026, 10, 14, 7, 0);

export async function sync(env, { dry: DRY = false, log = console.log } = {}) {
  if (!env.DISCORD_TOKEN || !env.SYNC_KEY) return log('Bot sin configurar: faltan DISCORD_TOKEN o SYNC_KEY en las variables de Netlify.');
  async function api(path, opt = {}) { // Discord REST con reintento por límite de velocidad
    for (let i = 0; i < 5; i++) {
      const r = await fetch((env.DISCORD_API || 'https://discord.com/api/v10') + path, { ...opt, headers: { Authorization: 'Bot ' + env.DISCORD_TOKEN.trim(), 'Content-Type': 'application/json', ...opt.headers } });
      if (r.status === 429) { const wait = ((await r.json()).retry_after || 1) * 1000; await new Promise(s => setTimeout(s, wait)); continue; }
      if (!r.ok) throw new Error(`${opt.method || 'GET'} ${path} → ${r.status} ${await r.text()}`);
      return r.status === 204 ? null : r.json();
    }
  }
  // 1) qué dice la web
  const res = await fetch((env.SUPA_URL || SUPA) + '/rest/v1/rpc/discord_sync', { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ bot_key: env.SYNC_KEY.trim() }) });
  if (!res.ok) throw new Error('La web rechazó la llave del bot: ' + await res.text());
  const { users } = await res.json();
  // 2) el server de Discord
  const guild = env.GUILD_ID || (await api('/users/@me/guilds'))[0]?.id;
  if (!guild) throw new Error('El bot no está en ningún servidor. Invítalo primero.');
  const STAFF_NAMES = Object.fromEntries(STAFF), MANAGED = [...WEB_ROLES, ...Object.values(STAFF_NAMES), 'Verificado', 'Baneado'];
  // Usa los roles que YA tiene el server (sin acentos/mayúsculas/emojis). No crea roles: Discord limita a 250.
  const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const born = id => Number(BigInt(id) >> 22n) + 1420070400000; // fecha de creación del rol (snowflake)
  let roles = (await api(`/guilds/${guild}/roles`)).sort((a, b) => born(a.id) - born(b.id));
  // limpia los duplicados que creó la primera versión del bot (14-nov-2026) si el server ya tenía ese rol
  for (const r of roles.filter(r => MANAGED.includes(r.name) && born(r.id) > BOT_START))
    if (roles.some(o => o.id !== r.id && born(o.id) < born(r.id) && norm(o.name) === norm(r.name))) { DRY ? log('borrar duplicado', r.name) : await api(`/guilds/${guild}/roles/${r.id}`, { method: 'DELETE', headers: { 'X-Audit-Log-Reason': 'Duplicado creado por el bot' } }); roles = roles.filter(x => x.id !== r.id); }
  const byName = {}; for (const n of MANAGED) { const r = roles.find(r => norm(r.name) === norm(n)); if (r) byName[n] = r.id; }
  const managedIds = new Set(Object.values(byName)), noRole = MANAGED.filter(n => !byName[n]);
  let members = [], after = '0';
  for (;;) { const page = await api(`/guilds/${guild}/members?limit=1000&after=${after}`); members.push(...page); if (page.length < 1000) break; after = page.at(-1).user.id; }
  const find = d => members.find(m => [m.user.username, m.user.global_name, m.nick].some(x => x && x.toLowerCase() === d));
  // 3) poner y quitar
  let add = 0, del = 0, miss = [];
  for (const u of users) {
    const m = find(u.discord); if (!m) { miss.push(u.discord); continue; }
    const want = new Set(u.banned ? ['Baneado'] : [...u.roles, ...(u.staff ? [STAFF_NAMES[u.staff]] : []), ...(u.verified ? ['Verificado'] : [])].map(n => byName[n]).filter(Boolean));
    for (const id of want) if (!m.roles.includes(id)) { add++; DRY ? log('+', u.discord, roles.find(r => r.id === id)?.name) : await api(`/guilds/${guild}/members/${m.user.id}/roles/${id}`, { method: 'PUT', headers: { 'X-Audit-Log-Reason': 'Sincronizado con la web de Los Ángeles RP' } }); }
    for (const id of m.roles) if (managedIds.has(id) && !want.has(id)) { del++; DRY ? log('-', u.discord, roles.find(r => r.id === id)?.name) : await api(`/guilds/${guild}/members/${m.user.id}/roles/${id}`, { method: 'DELETE', headers: { 'X-Audit-Log-Reason': 'Ya no tiene este rol en la web' } }); }
  }
  return log(`Listo: ${users.length} cuentas de la web, ${add} roles puestos, ${del} quitados.${miss.length ? ' No están en Discord: ' + miss.join(', ') + '.' : ''}${noRole.length ? ' Roles que no existen en el server (créalos si los usas): ' + noRole.join(', ') : ''}`);
}

export default async () => { const msg = await sync(process.env); console.log(msg); return new Response(String(msg)); };
export const config = { schedule: '*/15 * * * *' };
