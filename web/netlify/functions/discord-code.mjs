// Manda por DM de Discord el código de 6 dígitos para verificar la cuenta (dura 5 min, lo guarda Supabase).
import { randomInt } from 'node:crypto';
import { SUPABASE_URL, SUPABASE_KEY } from '../../config.js';

const json = (o, status = 200) => Response.json(o, { status });
async function discord(env, path, opt = {}) {
  const r = await fetch((env.DISCORD_API || 'https://discord.com/api/v10') + path, { ...opt, headers: { Authorization: 'Bot ' + env.DISCORD_TOKEN.trim(), 'Content-Type': 'application/json' } });
  return { ok: r.ok, status: r.status, body: r.status === 204 ? null : await r.json().catch(() => null) };
}

export async function sendCode(env, raw) {
  const d = String(raw || '').trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9_.]{2,32}$/.test(d)) return json({ error: 'Escribe tu usuario de Discord (ej. juan_rp), no tu apodo.' }, 400);
  if (!env.DISCORD_TOKEN || !env.SYNC_KEY) return json({ error: 'El bot de Discord aún no está configurado. Avisa al staff.' }, 503);
  // 1) buscarlo en el server
  const guild = env.GUILD_ID || (await discord(env, '/users/@me/guilds')).body?.[0]?.id;
  const found = await discord(env, `/guilds/${guild}/members/search?query=${encodeURIComponent(d)}&limit=10`);
  const m = (found.body || []).find(x => [x.user.username, x.user.global_name, x.nick].some(n => n && n.toLowerCase() === d));
  if (!m) return json({ error: 'No te encontramos en el servidor de Discord de Los Ángeles RP. Únete primero y revisa que tu usuario esté bien escrito.' }, 404);
  // 2) guardar el código (Supabase valida la llave del bot, que el Discord no esté usado y el límite de 1 por minuto)
  const code = String(randomInt(0, 1e6)).padStart(6, '0');
  const r = await fetch((env.SUPA_URL || SUPABASE_URL) + '/rest/v1/rpc/discord_code_issue', { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ bot_key: env.SYNC_KEY.trim(), d, code }) });
  if (!r.ok) return json({ error: (await r.json().catch(() => ({}))).message || 'No se pudo generar el código' }, 400);
  // 3) mandarle el DM
  const dm = await discord(env, '/users/@me/channels', { method: 'POST', body: JSON.stringify({ recipient_id: m.user.id }) });
  const sent = dm.ok && await discord(env, `/channels/${dm.body.id}/messages`, { method: 'POST', body: JSON.stringify({
    content: `🌴 **Los Ángeles RP**\nTu código para verificar tu cuenta en la web es: **${code}**\nVence en 5 minutos. Si no fuiste tú, ignora este mensaje.` }) });
  if (!sent?.ok) return json({ error: 'No te pudimos mandar el DM. Activa «Mensajes directos» en la configuración de privacidad del servidor de Los Ángeles RP y vuelve a intentar en 1 minuto.' }, 400);
  return json({ ok: true });
}

export default async req => req.method !== 'POST' ? json({ error: 'Usa POST' }, 405) : sendCode(process.env, (await req.json().catch(() => ({}))).discord);
export const config = { path: '/api/discord-code' };
