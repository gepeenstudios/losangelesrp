// Sincroniza los roles con Discord al momento (la web lo llama cuando cambian roles, staff o verificación).
// La sincronización es idempotente: llamarla de más no cambia nada, solo vuelve a revisar.
import { sync } from './discord-sync.mjs';
export default async req => {
  if (req.method !== 'POST') return new Response('Usa POST', { status: 405 });
  const lines = []; await sync(process.env, { log: m => lines.push(m) }).catch(e => lines.push('Error: ' + e.message));
  return Response.json({ ok: !lines.some(l => String(l).startsWith('Error')), log: lines });
};
export const config = { path: '/api/discord-sync' };
