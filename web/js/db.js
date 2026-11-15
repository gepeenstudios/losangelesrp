// Capa de datos: Supabase si config.js tiene llaves; si no, modo demo en localStorage (mismas funciones).
import { incomeTax, TRAMITES, SHOP, GUN_CLASSES } from './data.js';
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';

export const DEMO = !SUPABASE_URL;
const DOMAIN = '@usuarios.ciudadrp.app'; // el login es por usuario; Supabase pide un email, este nunca recibe correos
let sb = null, myId = null;

if (!DEMO) {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  myId = (await sb.auth.getSession()).data.session?.user.id || null;
}

const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
export const uid = () => myId;

// ---------- imágenes: se reducen antes de subir ----------
async function shrink(file, max = 1280) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  const img = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = Object.assign(document.createElement('canvas'), { width: img.width * k, height: img.height * k });
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
}

// ====================== SUPABASE ======================
const SB = {
  async signUp(u, p) { const d = ok(await sb.auth.signUp({ email: u + DOMAIN, password: p })); if (!d.session) throw new Error('Desactiva "Confirm email" en Supabase (ver LEEME)'); myId = d.user.id; },
  async signIn(u, p) { myId = ok(await sb.auth.signInWithPassword({ email: u + DOMAIN, password: p })).user.id; },
  async signOut() { await sb.auth.signOut(); myId = null; },
  async setPassword(p) { ok(await sb.auth.updateUser({ password: p })); },
  async list(t, o = {}) {
    let q = sb.from(t).select('*');
    for (const [k, v] of Object.entries(o.eq || {})) q = v === null ? q.is(k, null) : q.eq(k, v);
    for (const [k, v] of Object.entries(o.contains || {})) q = q.contains(k, v);
    for (const [k, v] of Object.entries(o.overlaps || {})) q = q.overlaps(k, v);
    for (const [k, v] of Object.entries(o.ilike || {})) q = q.ilike(k, `%${v}%`);
    if (o.order !== null) q = q.order(o.order || 'created_at', { ascending: !!o.asc });
    return ok(await q.limit(o.limit || 500));
  },
  async get(t, id, key = 'id') { return ok(await sb.from(t).select('*').eq(key, id).maybeSingle()); },
  async insert(t, row) { return ok(await sb.from(t).insert(row).select().single()); },
  async update(t, id, patch) { return ok(await sb.from(t).update(patch).eq('id', id).select().maybeSingle()); },
  async upsert(t, row, key = 'key') { return ok(await sb.from(t).upsert(row, { onConflict: key })); },
  async remove(t, id) { return ok(await sb.from(t).delete().eq('id', id)); },
  async removeWhere(t, eq) { return ok(await sb.from(t).delete().match(eq)); },
  async updateWhere(t, eq, patch) { return ok(await sb.from(t).update(patch).match(eq)); },
  async rpc(n, a) { return ok(await sb.rpc(n, a)); },
  async upload(file) {
    const f = await shrink(file), path = `${myId}/${Date.now()}-${(file.name || 'img').replace(/[^\w.]/g, '_')}`;
    ok(await sb.storage.from('uploads').upload(path, f));
    return sb.storage.from('uploads').getPublicUrl(path).data.publicUrl;
  },
};

// ====================== DEMO (localStorage) ======================
// shortcut: el modo demo no aplica permisos ni seguridad; es solo para probar la web sin Supabase.
const LS = 'rpla_db';
let mem = JSON.parse(localStorage.getItem(LS) || 'null') || { t: {}, users: [], session: null };
const save = () => localStorage.setItem(LS, JSON.stringify(mem));
const T = n => (mem.t[n] ??= []);
const now = () => new Date().toISOString();
const DEF = {
  profiles: { verified: false, banned: false }, characters: { roles: ['Ciudadano'], status: 'pending' },
  accounts: { balance: 0, owners: [] }, requests: { status: 'pending', data: {} }, posts: { likes: 0 },
  tickets: { status: 'abierto', replies: [] }, companies: { shares_total: 1000, owners: [] }, jobs: { open: true },
  properties: { for_sale: true }, elections: { open: true, candidates: [] }, store_apps: { approved: false },
  records: { paid: false },
};
const BY_USER = { requests: 'user_id', reviews: 'user_id', shifts: 'user_id', tickets: 'user_id', bans: 'by_user', votes: 'user_id' };
const has = (r, o) => {
  for (const [k, v] of Object.entries(o.eq || {})) if ((r[k] ?? null) !== v) return false;
  for (const [k, v] of Object.entries(o.contains || {})) if (!v.every(x => (r[k] || []).includes(x))) return false;
  for (const [k, v] of Object.entries(o.overlaps || {})) if (!v.some(x => (r[k] || []).includes(x))) return false;
  for (const [k, v] of Object.entries(o.ilike || {})) if (!String(r[k] ?? '').toLowerCase().includes(v.toLowerCase())) return false;
  return true;
};
const acc = id => T('accounts').find(a => a.id === id) || (() => { throw new Error('Cuenta no existe'); })();
const personal = c => T('accounts').find(a => a.kind === 'personal' && a.owners[0] === c);
const gov = () => T('accounts').find(a => a.kind === 'gov');
const company = id => T('companies').find(c => c.id === id);
function move(f, t, amt, concept) {
  amt = Number(amt);
  if (!(amt > 0)) throw new Error('Monto inválido');
  if (f) { if (f.balance < amt) throw new Error('Fondos insuficientes'); f.balance -= amt; }
  if (t) t.balance += amt;
  T('transactions').push({ id: crypto.randomUUID(), from_acc: f?.id || null, to_acc: t?.id || null, amount: amt, concept, created_at: now() });
}
export const creditCap = s => (s >= 800 ? 1e7 : s >= 760 ? 2e6 : s >= 700 ? 5e5 : s >= 650 ? 5e4 : 1e4) * cpi();
function creditScore(c) { const E = T('credit_events').filter(e => e.character_id === c), n = k => E.filter(e => e.kind === k && (k === 'pago_a_tiempo' || new Date(e.created_at) > Date.now() - 60 * 864e5)).length;
  const k = T('credit_cards').find(x => x.character_id === c && x.status !== 'closed'), age = E.length ? (Date.now() - Math.min(...E.map(e => new Date(e.created_at)))) / 864e5 : 0;
  return Math.round(Math.max(300, Math.min(850, 620 + 12 * Math.min(n('pago_a_tiempo'), 15) - 45 * n('pago_tarde') - 160 * n('impago') - (k ? 80 * Math.max(k.owed / k.credit_limit - 0.3, 0) : 0) + Math.min(30, Math.floor(age))))); }
function cardTick(c) {
  const k = T('credit_cards').find(x => x.character_id === c && x.status !== 'closed'); if (!k) return null;
  const ev = (kind, amount, note, d) => T('credit_events').push({ id: crypto.randomUUID(), character_id: c, kind, amount, note, created_at: d.toISOString() });
  let d = new Date(k.last_tick + 'T12:00:00'), i = 0; const today = new Date(new Date().toISOString().slice(0, 10) + 'T12:00:00');
  while (d < today && i++ < 90) { d = new Date(d.getTime() + 864e5);
    if (k.owed > 0) { const it = Math.round(k.owed * k.apr / 365 * 100) / 100; k.int_cycle = (k.int_cycle || 0) + it; k.owed = Math.round((k.owed + it) * 100) / 100; }
    if (d >= new Date(k.stmt_due + 'T12:00:00')) { if (k.int_cycle > 0) { ev('intereses', Math.round(k.int_cycle * 100) / 100, `Intereses del periodo (${Math.round(k.apr * 100)}% anual)`, d); k.int_cycle = 0; }
      if (k.stmt_min > 0 && k.stmt_paid >= k.stmt_min) { ev('pago_a_tiempo', k.stmt_paid, 'Pagaste tu mínimo a tiempo', d); k.missed = 0; { const sc = creditScore(c); if (sc >= 650 && k.owed <= k.credit_limit * 0.5) k.credit_limit = Math.round(Math.min(k.credit_limit * (sc >= 800 ? 2 : sc >= 760 ? 1.5 : sc >= 700 ? 1.25 : 1.1), creditCap(sc)) * 100) / 100; } }
      else if (k.stmt_min > 0) { k.missed++; k.owed += Math.round(25 * cpi() * 100) / 100; ev('pago_tarde', k.stmt_min, 'No cubriste tu pago mínimo · cargo por atraso', d); k.credit_limit = Math.round(Math.max(k.credit_limit * 0.8, 500) * 100) / 100;
        if (k.missed >= 3) { k.status = 'closed'; ev('impago', k.owed, '3 pagos vencidos: tarjeta cancelada, la deuda sigue', d); } else if (k.missed >= 2) k.status = 'frozen'; }
      k.stmt_min = k.owed <= 0 ? 0 : Math.round(Math.max(Math.min(k.owed, 50 * cpi()), k.owed * 0.1) * 100) / 100; k.stmt_paid = 0; k.stmt_due = new Date(d.getTime() + 7 * 864e5).toISOString().slice(0, 10); } }
  k.last_tick = d.toISOString().slice(0, 10); return k.status === 'closed' ? null : k;
}
const bjVal = cs => { let t = 0, a = 0; for (const c of cs) { const r = c % 13; if (r === 12) { t += 11; a++; } else t += r >= 8 ? 10 : r + 2; } while (t > 21 && a) { t -= 10; a--; } return t; };
function pokerMult(cs) {
  const r = cs.map(c => c % 13).sort((a, b) => a - b), cnt = Object.values(r.reduce((m, x) => (m[x] = (m[x] || 0) + 1, m), {})).sort((a, b) => b - a);
  const fl = new Set(cs.map(c => Math.floor(c / 13))).size === 1, st = cnt.length === 5 && (r[4] - r[0] === 4 || r.join() === '0,1,2,3,12');
  if (st && fl && r[0] === 8) return 800; if (st && fl) return 50; if (cnt[0] === 4) return 25; if (cnt[0] === 3 && cnt[1] === 2) return 9; if (fl) return 6; if (st) return 4;
  if (cnt[0] === 3) return 3; if (cnt[0] === 2 && cnt[1] === 2) return 2; if (cnt[0] === 2 && r.find((x, i) => r[i + 1] === x) >= 9) return 1; return 0;
}
const minesMult = (n, k) => { let m = 0.92 + 0.003 * n; // igual que mines_mult() del SQL for (let i = 0; i < k; i++) m *= (25 - i) / (25 - n - i); return Math.round(m * 1e4) / 1e4; };
function cView(h) { const s = h.state, o = h.status === 'open', v = { id: h.id, game: h.game, bet: h.bet, status: h.status, mult: s.mult, payout: s.payout };
  if (h.game === 'blackjack') return { ...v, p: [...s.p], pv: bjVal(s.p), doubled: !!s.doubled, d: o ? [s.d[0], -1] : [...s.d], dv: o ? bjVal([s.d[0]]) : bjVal(s.d) };
  if (h.game === 'poker') return { ...v, h: [...s.h], drawn: !!s.drawn };
  return { ...v, n: s.n, open: [...s.open], now: minesMult(s.n, s.open.length), next: minesMult(s.n, s.open.length + 1), mines: o ? null : [...s.mines] }; }
function cSettle(h, m) { const pay = Math.round(h.bet * m * 100) / 100; if (pay > 0) move(gov(), personal(h.character_id), pay, `Casino · premio ${h.game} ×${Math.round(m * 100) / 100}`);
  h.status = 'done'; h.state.mult = m; h.state.payout = pay; T('casino_bets').push({ id: crypto.randomUUID(), character_id: h.character_id, game: h.game, bet: h.bet, mult: m, payout: pay, result: cView(h), created_at: now() }); }
const newVin = () => Array.from({ length: 17 }, () => '0123456789ABCDEFGHJKLMNPRSTUVWXYZ'[Math.random() * 33 | 0]).join('');
// igual que share_price() del SQL: valor en libros ÷ acciones en circulación × prima de mercado (que regresa a 1 un 20% por día)
const coBook = (co, accounts, props, vehicles, models) => Number(accounts.find(a => a.id === co.account_id)?.balance || 0)
  + props.filter(x => x.owner_company === co.id).reduce((s, x) => s + Number(x.price), 0)
  + vehicles.filter(x => x.owner_company === co.id).reduce((s, x) => s + Number(models.find(m => m.id === x.model_id)?.price || 0), 0);
export const coOut = (co, holdings = T('holdings')) => holdings.filter(h => h.company_id === co.id && h.shares > 0).reduce((s, h) => s + Number(h.shares), 0);
export const coPremium = co => 1 + (Number(co.premium ?? 1) - 1) * Math.pow(0.8, (Date.now() - new Date(co.premium_at || Date.now())) / 864e5);
export function sharePrice(co, accounts = T('accounts'), props = T('properties'), vehicles = T('vehicles'), models = T('vehicle_models'), companies = T('companies'), holdings = T('holdings')) {
  if (co.industry === 'ETF') { const o = companies.filter(x => x.industry !== 'ETF'); return o.length ? Math.round(o.reduce((s, x) => s + sharePrice(x, accounts, props, vehicles, models, companies, holdings), 0) / o.length * 10 * 100) / 100 : 10; }
  const out = coOut(co, holdings) || co.shares_total || 1;
  return Math.max(0.01, Math.round(coBook(co, accounts, props, vehicles, models) / out * coPremium(co) * 100) / 100);
}
const setting = (k, d) => T('settings').find(x => x.key === k)?.value ?? d;
const putSetting = (key, value) => { const r = T('settings').find(x => x.key === key); r ? r.value = value : T('settings').push({ key, value }); };
const cpi = () => Number(setting('cpi', 1));
const myChars = () => T('characters').filter(c => c.user_id === myId);
const lvlLocal = () => ({ helper: 1, mod: 2, admin: 3, coowner: 4, owner: 5 })[T('profiles').find(p => p.id === myId)?.staff_role] || 0;
const isMgr = d => lvlLocal() >= 3 || T('employments').some(e => e.dept === d && e.status !== 'fired' && myChars().some(c => c.id === e.character_id && c.status === 'active')
  && T('dept_ranks').find(r => r.dept === d && r.rank === e.rank)?.manage);
const guard = (ok, msg) => { if (!ok) throw new Error(msg); };
const ranksOf = d => T('dept_ranks').filter(r => r.dept === d).sort((a, b) => a.ord - b.ord);
const dayMins = (c, d, day) => T('work_shifts').filter(w => w.character_id === c && w.dept === d).reduce((m, w) => {
  const a = Math.max(new Date(w.started_at), new Date(day + 'T00:00:00')), b = Math.min(new Date(w.ended_at || Date.now()), new Date(day + 'T24:00:00'));
  return m + Math.max(0, (b - a) / 6e4); }, 0);
const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const RPC = {
  hire({ c, d }) {
    guard(isMgr(d), `Solo los mandos de ${d} pueden contratar`);
    const r = ranksOf(d)[0]; guard(r, 'Departamento sin rangos');
    const e = T('employments').find(x => x.character_id === c && x.dept === d), today = iso(new Date());
    e ? Object.assign(e, { rank: r.rank, status: 'active', last_qualified: today, vacation_until: null })
      : T('employments').push({ id: crypto.randomUUID(), character_id: c, dept: d, rank: r.rank, status: 'active', last_qualified: today, hired_at: now() });
    const ch = T('characters').find(x => x.id === c); ch.roles = [...ch.roles.filter(x => x !== d), d];
  },
  set_rank({ emp, r }) { const e = T('employments').find(x => x.id === emp); guard(isMgr(e.dept), 'Sin permiso'); guard(ranksOf(e.dept).some(x => x.rank === r), 'Rango no válido'); e.rank = r; },
  fire_emp({ emp }) { const e = T('employments').find(x => x.id === emp); guard(isMgr(e.dept), 'Sin permiso'); e.status = 'fired'; const ch = T('characters').find(x => x.id === e.character_id); ch.roles = ch.roles.filter(x => x !== e.dept); },
  set_vacation({ c, d, until }) { guard(isMgr(d), 'Sin permiso'); const e = T('employments').find(x => x.character_id === c && x.dept === d && x.status !== 'fired'); if (e) Object.assign(e, { status: 'vacation', vacation_until: until }); },
  clock({ c, d }) {
    guard(myChars().some(x => x.id === c), 'No es tu vida');
    guard(T('employments').some(e => e.character_id === c && e.dept === d && e.status === 'active'), `No trabajas activo en ${d}`);
    const open = T('work_shifts').find(w => w.character_id === c && !w.ended_at);
    if (open) { open.ended_at = now(); return 'out'; }
    T('work_shifts').push({ id: crypto.randomUUID(), character_id: c, dept: d, started_at: now(), ended_at: null, created_at: now() }); return 'in';
  },
  daily_tick() {
    RPC.election_tick();
    const today = iso(new Date()), d = iso(new Date(Date.now() - 864e5)), wk = iso(new Date(Date.now() - 7 * 864e5));
    if (setting('last_tick', '1970-01-01') >= today) return 'ya corrió hoy';
    putSetting('last_tick', today);
    let n = 0, f = 0; const g = gov(), minm = Number(setting('job_min_minutes', 60)), rate = Number(setting('fed_rate', 4.5));
    for (const e of T('employments').filter(e => e.status !== 'fired')) {
      if (e.status === 'vacation' && e.vacation_until < d) Object.assign(e, { status: 'active', vacation_until: null });
      const ch = T('characters').find(x => x.id === e.character_id); if (ch?.status !== 'active') continue;
      const r = T('dept_ranks').find(x => x.dept === e.dept && x.rank === e.rank);
      if (e.status === 'vacation' || dayMins(e.character_id, e.dept, d) >= minm) {
        e.last_qualified = d; const a = personal(e.character_id);
        if (a && r) try { const y = r.salary * cpi(); move(g, a, Math.round((y - incomeTax(y)) / 365 * 100) / 100, `Nómina neta · ${e.dept} · ${e.rank} (ya con retención de impuestos)`); n++; } catch {}
      } else if ((e.last_qualified || '1970-01-01') < iso(new Date(new Date(d) - 6 * 864e5))) { e.status = 'fired'; ch.roles = ch.roles.filter(x => x !== e.dept); f++; }
    }
    for (const c of T('companies')) T('price_history').push({ id: crypto.randomUUID(), company_id: c.id, price: sharePrice(c), created_at: now() });
    for (const a of T('accounts').filter(a => a.kind === 'savings' && a.balance > 0)) try { move(g, a, Math.round(a.balance * rate / 100 / 365 * 100) / 100, 'Intereses de ahorro'); } catch {}
    const ss = setting('staff_salary', {}), smin = Number(setting('staff_min_minutes', 30)); // sueldo del staff
    for (const p of T('profiles').filter(p => p.staff_role)) {
      const mins = T('shifts').filter(s => s.user_id === p.id).reduce((m, s) => m + Math.max(0, (Math.min(+new Date(s.ended_at || Date.now()), +new Date(today)) - Math.max(+new Date(s.started_at), +new Date(today) - 864e5)) / 6e4), 0);
      const ch = T('characters').find(c => c.user_id === p.id && c.status === 'active'), a = ch && personal(ch.id);
      if (a && mins >= smin) try { const y = (ss[p.staff_role] ?? 40000) * cpi(); move(g, a, Math.round((y - incomeTax(y)) / 365 * 100) / 100, 'Nómina neta · Staff · ' + p.staff_role + ' (ya con retención de impuestos)'); } catch {}
    }
    const inc = setting('biz_income', {}); // los negocios del rol no venden de verdad: el gobierno les paga según su giro
    for (const co of T('companies').filter(co => co.account_id && co.owners.some(o => T('characters').find(c => c.id === o)?.status === 'active')))
      try { move(g, T('accounts').find(a => a.id === co.account_id), Math.round((inc[co.industry] ?? 400) * cpi() * (1 - (setting('impuestos', {}).corp ?? 29.84) / 100) * 100) / 100, 'Ingresos del negocio · ' + (co.industry || '') + ' (neto de impuesto corporativo)'); } catch {}
    for (const p of T('properties').filter(p => p.owner_char || p.owner_company)) { // impuesto predial
      const pa = p.owner_char ? personal(p.owner_char) : acc(T('companies').find(c => c.id === p.owner_company)?.account_id);
      if (pa) try { move(pa, g, Math.round(p.price * cpi() * (setting('impuestos', {}).property ?? 1.2) / 100 / 365 * 100) / 100, 'Impuesto predial · ' + p.name); } catch {}
    }
    return `${n} pagos, ${f} despidos`;
  },
  open_savings({ c }) {
    guard(myChars().some(x => x.id === c), 'No es tu vida');
    let a = T('accounts').find(x => x.kind === 'savings' && x.owners[0] === c);
    if (!a) T('accounts').push(a = { id: crypto.randomUUID(), kind: 'savings', name: 'Ahorro', owners: [c], balance: 0, number: String(Math.floor(Math.random() * 1e10)).padStart(10, '0'), created_at: now() });
    return a.id;
  },
  print_money({ amount }) {
    guard(lvlLocal() >= 4 || myChars().some(c => c.status === 'active' && c.roles.includes('Presidente')), 'Solo el Presidente puede emitir dinero');
    const supply = T('accounts').reduce((s, a) => s + Number(a.balance), 0);
    move(null, gov(), amount, 'Emisión de dinero · Reserva Federal');
    const c = Math.round(cpi() * (1 + amount / Math.max(supply, 1) * 0.5) * 1e4) / 1e4;
    putSetting('cpi', c); putSetting('cpi_history', [...setting('cpi_history', []), { t: now(), cpi: c, printed: amount }]);
    return c;
  },
  auto_ck({ c, motivo, lugar, foto, publicar }) {
    const ch = myChars().find(x => x.id === c); guard(ch, 'No es tu vida'); guard(ch.status === 'active', 'Esa vida no está activa');
    ch.status = 'dead';
    T('requests').push({ id: crypto.randomUUID(), type: 'autock', dept: ['staff:mod'], user_id: myId, character_id: c, data: { victima: c, motivo, lugar, foto_cuerpo: foto, publicado: publicar }, status: 'approved', reviewed_at: now(), created_at: now() });
    if (publicar) T('posts').push({ id: crypto.randomUUID(), app: 'news', section: 'Obituarios', character_id: null, anonimo: true, likes: 0, created_at: now(),
      title: `Fallece ${ch.first_name} ${ch.last_name}`, body: `Las autoridades de Los Ángeles confirmaron el fallecimiento de ${ch.first_name} ${ch.last_name}${lugar ? ' en ' + lugar : ''}. Descanse en paz.`, media_url: foto || null });
  },
  delete_char({ c }) {
    guard(lvlLocal() >= 3, 'Solo admins');
    T('properties').filter(p => p.owner_char === c).forEach(p => Object.assign(p, { owner_char: null, for_sale: true, sale_price: null }));
    const accs = T('accounts').filter(a => a.owners[0] === c && ['personal', 'savings'].includes(a.kind)).map(a => a.id);
    for (const [t, f] of [['vehicles', 'owner_char'], ['items', 'owner_char'], ['holdings', 'character_id'], ['requests', 'character_id'], ['employments', 'character_id'], ['records', 'character_id'], ['inmates', 'character_id'], ['work_shifts', 'character_id']]) mem.t[t] = T(t).filter(x => x[f] !== c);
    mem.t.transactions = T('transactions').filter(x => !accs.includes(x.from_acc) && !accs.includes(x.to_acc));
    mem.t.accounts = T('accounts').filter(a => !accs.includes(a.id)); mem.t.characters = T('characters').filter(x => x.id !== c);
  },
  delete_user({ u }) {
    guard(lvlLocal() >= 5, 'Solo el Owner'); guard(u !== myId, 'No puedes borrarte a ti mismo');
    T('characters').filter(c => c.user_id === u).forEach(c => RPC.delete_char({ c: c.id }));
    for (const t of ['tickets', 'reviews', 'shifts']) mem.t[t] = T(t).filter(x => x.user_id !== u);
    mem.t.profiles = T('profiles').filter(p => p.id !== u); mem.users = mem.users.filter(x => x.id !== u);
  },
  set_fed_rate({ rate }) { guard(lvlLocal() >= 3 || myChars().some(c => c.status === 'active' && c.roles.includes('Presidente')), 'Sin permiso'); guard(rate >= 0 && rate <= 25, 'Tasa fuera de rango'); putSetting('fed_rate', rate); },
  transfer({ from_acc, dest, amount, concept }) {
    const a = acc(from_acc), t = T('accounts').find(x => x.number === dest) || personal(dest);
    if (!t) throw new Error('Cuenta destino no encontrada');
    if (t === a) throw new Error('Es la misma cuenta');
    move(a, t, amount, concept || 'Transferencia');
  },
  staff_pay({ acc: id, amount, concept, mint }) { if (mint && amount > 0 && T('accounts').some(x => x.balance > 0)) throw new Error('El dinero no se crea: solo el Presidente puede emitir más (Reserva Federal)'); mint && amount > 0 ? move(null, acc(id), amount, concept) : amount >= 0 ? move(gov(), acc(id), amount, concept) : move(acc(id), gov(), -amount, concept); },
  buy({ kind, item, acc: id, qty = 1 }) {
    let sellerIsPerson = false;
    const a = acc(id), co = a.kind === 'business' ? T('companies').find(c => c.account_id === id) : null, buyer = co ? null : a.owners[0];
    let q = Math.max(qty || 1, 1), price, seller;
    if (kind === 'property') {
      const p = T('properties').find(x => x.id === item);
      if (!p?.for_sale) throw new Error('No está en venta');
      sellerIsPerson = !!(p.owner_char || p.owner_company);
      if (!p.owner_char && !p.owner_company) { seller = gov(); price = Math.round(p.price * cpi() * (co?.industry === 'Bienes Raíces' ? 0.5 : 1) * 100) / 100; }
      else { price = p.sale_price; seller = personal(p.owner_char) || acc(company(p.owner_company).account_id); }
      if (seller === a) throw new Error('Ya es tuyo');
      move(a, seller, price, 'Compra · casa');
      Object.assign(p, { owner_char: buyer, owner_company: co?.id || null, for_sale: false, sale_price: null });
    } else if (kind === 'model') {
      const m = T('vehicle_models').find(x => x.id === item);
      if (!co) q = 1;
      price = m.price * cpi() * q * (co?.industry === 'Concesionaria' ? (co.brand?.toLowerCase() === m.brand.toLowerCase() ? 0.1 : 0.3) : 1);
      move(a, gov(), price, 'Compra · auto nuevo');
      for (let i = 0; i < q; i++) T('vehicles').push({ id: crypto.randomUUID(), model_id: item, owner_char: buyer, owner_company: co?.id || null, sale_price: null, plate: null, vin: newVin(), registered_at: now(), created_at: now() });
    } else if (kind === 'vehicle') {
      const v = T('vehicles').find(x => x.id === item);
      if (v?.sale_price == null) throw new Error('No está en venta');
      price = v.sale_price; seller = personal(v.owner_char) || acc(company(v.owner_company).account_id);
      if (seller === a) throw new Error('Ya es tuyo');
      move(a, seller, price, 'Compra · auto usado');
      Object.assign(v, { owner_char: buyer, owner_company: co?.id || null, sale_price: null, plate: null, vin: v.vin || newVin(), registered_at: now() });
    } else if (kind === 'shares') {
      if (!buyer) throw new Error('Compra acciones con tu cuenta personal');
      const c = company(item); if (c.industry === 'ETF') throw new Error('El ETF ya no acepta compras nuevas'); if (!(q >= 1)) throw new Error('Cantidad inválida');
      const out = Math.max(coOut(c), 1), ps = coBook(c, T('accounts'), T('properties'), T('vehicles'), T('vehicle_models')) / out, p0 = coPremium(c), p1 = Math.min(p0 * Math.exp(q / out), 5);
      price = Math.round(Math.max(ps, 0.01) * (p0 + p1) / 2 * q * 100) / 100;
      move(a, acc(c.account_id), price, 'Compra de acciones · ' + c.name); Object.assign(c, { premium: p1, premium_at: now() });
      const h = T('holdings').find(x => x.character_id === buyer && x.company_id === item);
      h ? (h.shares += q, h.cost = (h.cost || 0) + price) : T('holdings').push({ id: crypto.randomUUID(), character_id: buyer, company_id: item, shares: q, cost: price, created_at: now() });
      T('trades').push({ id: crypto.randomUUID(), character_id: buyer, company_id: item, side: 'compra', qty: q, price: price / q, total: price, created_at: now() });
      T('price_history').push({ id: crypto.randomUUID(), company_id: item, price: sharePrice(c), created_at: now() });
    } else throw new Error('Tipo inválido');
    // impuestos como en el SQL: sales tax en autos (no concesionarias) y transferencia en casas entre particulares
    const tc = setting('impuestos', {}), tax = kind === 'shares' ? 0 : (kind === 'model' || kind === 'vehicle') && co?.industry !== 'Concesionaria' ? price * (tc.sales ?? 10.25) / 100
      : kind === 'property' && sellerIsPerson ? price * (tc.transfer ?? 0.56) / 100 : 0;
    if (tax > 0) move(a, gov(), Math.round(tax * 100) / 100, kind === 'property' ? 'Impuesto de transferencia de inmueble' : 'Impuesto sobre ventas (Sales Tax LA)');
    return price + Math.round(tax * 100) / 100;
  },
  sell_shares({ company: cid, qty, acc: id }) {
    const a = acc(id), h = T('holdings').find(x => x.character_id === a.owners[0] && x.company_id === cid);
    if (!h || h.shares < qty || qty < 1) throw new Error('No tienes tantas acciones');
    const c = company(cid); let price;
    if (c.industry === 'ETF') { price = sharePrice(c) * qty; move(gov(), a, price, 'Venta de acciones · ETF'); }
    else { const out = Math.max(coOut(c), 1), ps = coBook(c, T('accounts'), T('properties'), T('vehicles'), T('vehicle_models')) / out, p0 = coPremium(c), p1 = Math.max(p0 * Math.exp(-qty / out), 0.2);
      price = Math.round(Math.max(ps, 0) * (p0 + p1) / 2 * qty * 100) / 100; const ca = acc(c.account_id);
      if (price > ca.balance) throw new Error(`La empresa solo tiene ${ca.balance.toFixed(2)} en efectivo para recomprar acciones (tus ${qty} títulos valen ${price.toFixed(2)})`);
      if (price > 0) move(ca, a, price, 'Venta de acciones · ' + c.name); Object.assign(c, { premium: p1, premium_at: now() }); }
    h.cost = Math.round((h.cost || 0) * (h.shares - qty) / h.shares * 100) / 100; h.shares -= qty;
    T('trades').push({ id: crypto.randomUUID(), character_id: a.owners[0], company_id: cid, side: 'venta', qty, price: price / qty, total: price, created_at: now() });
    T('price_history').push({ id: crypto.randomUUID(), company_id: cid, price: sharePrice(c), created_at: now() });
    return price;
  },
  list_item({ kind, item, price }) {
    const x = T(kind === 'property' ? 'properties' : 'vehicles').find(r => r.id === item);
    if (kind === 'property') { x.for_sale = price != null; x.sale_price = price; } else x.sale_price = price;
  },
  pay_fine({ record, acc: id }) {
    const r = T('records').find(x => x.id === record);
    if (!r || r.paid || r.kind !== 'multa') throw new Error('Multa no válida');
    move(acc(id), gov(), r.amount, 'Multa'); r.paid = true;
  },
  like_post({ id }) {
    if (T('post_likes').some(l => l.post_id === id && l.user_id === myId)) return; // un like por cuenta
    T('post_likes').push({ post_id: id, user_id: myId }); const p = T('posts').find(p => p.id === id); p.likes++;
    const au = T('characters').find(c => c.id === p.character_id);
    if (au && au.user_id !== myId && au.status === 'active' && au.roles.includes('Influencer')) {
      const a = personal(au.id); if (a) try { move(gov(), a, Math.round(Number(setting('influencer_like_pay', 15)) * cpi() * Math.min(5, 1 + T('follows').filter(f => f.followed === au.id).length / 20) * 100) / 100, 'Influencer · pago por like'); } catch {}
    }
  },
  join_jam({ jam_code, c }) { const j = T('jams').find(x => x.code === String(jam_code).trim().toUpperCase()); guard(j, 'No existe una Jam con ese código'); j.members = [...j.members.filter(m => m !== c), c]; return j.id; },
  server_now() { return new Date().toISOString(); },
  pay_now() { return 0; }, // shortcut: en demo la nómina solo se paga con el cierre diario (daily_tick), suficiente para probar
  fund_company({ req, dest }) { const r = T('requests').find(x => x.id === req && x.type === 'empresa'), d = acc(dest), cap = Number(r?.data?.capital) || 0;
    if (!r) throw new Error('Solicitud no encontrada'); if (T('transactions').some(t => t.to_acc === dest)) throw new Error('El capital ya se depositó');
    if (cap > 0) { const p = personal(r.character_id); if (!p || p.balance < cap) throw new Error(`El dueño ya no tiene el capital disponible (${cap})`); move(p, d, cap, 'Capital inicial · ' + (r.data.nombre || 'empresa')); } },
  account_by_name({ q }) { q = String(q).trim().toLowerCase(); return T('characters').filter(c => c.status === 'active' && (c.first_name + ' ' + c.last_name).toLowerCase().includes(q)).slice(0, 5)
    .map(c => ({ number: personal(c.id)?.number, holder: c.first_name + ' ' + c.last_name })).filter(x => x.number); },
  // espejo demo de la tarjeta de crédito (la versión real está en el SQL)
  card_status({ c }) { const k = cardTick(c); return { score: creditScore(c), card: k ? { ...k } : null, debt: T('credit_cards').filter(x => x.character_id === c).reduce((n, x) => n + x.owed, 0) }; },
  card_apply({ c }) {
    if (!myChars().some(x => x.id === c)) throw new Error('No es tu personaje'); cardTick(c);
    if (T('credit_cards').some(x => x.character_id === c && x.status !== 'closed')) throw new Error('Ya tienes una tarjeta de crédito');
    const ev = (kind, note, amount = null) => T('credit_events').push({ id: crypto.randomUUID(), character_id: c, kind, amount, note, created_at: now() });
    const debt = T('credit_cards').filter(x => x.character_id === c && x.status === 'closed').reduce((n, x) => n + x.owed, 0);
    if (debt > 0) { ev('rechazo', 'Solicitud rechazada: tienes una deuda pendiente'); return { ok: false, reason: `Tienes una deuda pendiente de ${debt.toFixed(2)} con RRVA. Págala primero.` }; }
    const sc = creditScore(c), lim = Math.round(10000 * cpi() * (sc >= 760 ? 2 : sc >= 700 ? 1.5 : sc >= 620 ? 1 : sc >= 560 ? 0.5 : 0) * 100) / 100;
    if (!lim) { ev('rechazo', `Solicitud rechazada por historial (score ${sc})`); return { ok: false, reason: `Tu historial crediticio no alcanza (score ${sc}). Necesitas al menos 560.`, score: sc }; }
    const today = new Date().toISOString().slice(0, 10), due = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    T('credit_cards').push({ id: crypto.randomUUID(), character_id: c, number: '4152' + String(Math.floor(Math.random() * 1e12)).padStart(12, '0'), credit_limit: lim, owed: 0, status: 'active', apr: 0.36,
      last_tick: today, stmt_due: due, stmt_min: 0, stmt_paid: 0, missed: 0, created_at: now() });
    ev('apertura', 'Tarjeta de crédito aprobada', lim); return { ok: true, limit: lim, score: sc };
  },
  card_charge({ c, dest, amount, concept = 'Compra con tarjeta' }) {
    if (!myChars().some(x => x.id === c)) throw new Error('No es tu personaje'); const k = cardTick(c);
    if (!k) throw new Error('No tienes tarjeta de crédito'); if (k.status !== 'active') throw new Error('Tu tarjeta está congelada por pagos atrasados. Paga tu mínimo.');
    const amt = Math.round(amount * 100) / 100; if (!(amt >= 1)) throw new Error('Monto inválido');
    const t = T('accounts').find(a => a.number === dest); if (!t) throw new Error('Cuenta destino no encontrada');
    const fee = t === personal(c) ? Math.round(amt * 3) / 100 : 0;
    if (k.owed + amt + fee > k.credit_limit) throw new Error(`Te pasas de tu línea de crédito (disponible ${(k.credit_limit - k.owed).toFixed(2)})`);
    move(gov(), t, amt, 'Tarjeta de crédito RRVA · ' + (concept || 'Compra')); k.owed += amt + fee;
    T('credit_events').push({ id: crypto.randomUUID(), character_id: c, kind: 'cargo', amount: amt + fee, note: (concept || 'Compra') + (fee ? ' (retiro de efectivo, comisión 3%)' : ''), created_at: now() });
    return { owed: k.owed, available: k.credit_limit - k.owed };
  },
  card_pay({ c, amount }) {
    if (!myChars().some(x => x.id === c)) throw new Error('No es tu personaje'); cardTick(c);
    const k = T('credit_cards').filter(x => x.character_id === c && x.owed > 0).sort((a, b) => (b.status !== 'closed') - (a.status !== 'closed'))[0]; if (!k) throw new Error('No debes nada');
    let amt = Math.round(amount * 100) / 100; if (!(amt > 0)) throw new Error('Monto inválido'); amt = Math.min(amt, k.owed);
    move(personal(c), gov(), amt, 'Pago de tarjeta de crédito RRVA'); k.owed = Math.round((k.owed - amt) * 100) / 100; k.stmt_paid += amt; if (k.status === 'frozen' && k.stmt_paid >= k.stmt_min) k.status = 'active';
    T('credit_events').push({ id: crypto.randomUUID(), character_id: c, kind: 'abono', amount: amt, note: 'Pago a tu tarjeta', created_at: now() }); return { owed: k.owed };
  },
  // espejo demo de las funciones de cripto (pool x·y=k: el precio lo mueven las compras y ventas)
  crypto_tick() {
    const C = T('crypto_coins'); if (!C.length) C.push(...[['BTC','Bitcoin',95000,'#f7931a'],['ETH','Ethereum',3500,'#8c8cff'],['SOL','Solana',180,'#14f195'],['XRP','XRP',2.3,'#c9d1d9'],
      ['DOGE','Dogecoin',0.35,'#c2a633'],['ADA','Cardano',0.9,'#3a7bff'],['LARP','LA Coin',1,'#ff4d6d']].map(([sym, name, p, color], i) => { const y = (sym === 'LARP' ? 2e6 : 2e7) / p;
        return { sym, name, price: p, color, ord: i + 1, supply: y, pool_coin: y, pool_usd: 0, virt_usd: p * y }; }));
    const st = T('settings'), row = st.find(x => x.key === 'crypto_last') || (st.push({ key: 'crypto_last', value: new Date(Math.floor(Date.now() / 6e4) * 6e4 - 60 * 6e4).toISOString() }), st.at(-1));
    const last = new Date(row.value).getTime(), steps = Math.min(Math.floor((Date.now() - last) / 6e4), 1440); if (steps < 1) return;
    for (const c of C) for (let k = 1; k <= steps; k++) T('crypto_hist').push({ sym: c.sym, t: new Date(last + k * 6e4).toISOString(), price: c.price });
    row.value = new Date(last + steps * 6e4).toISOString(); mem.t.crypto_hist = T('crypto_hist').filter(h => new Date(h.t) > Date.now() - 7 * 864e5);
  },
  crypto_chart({ s, minutes }) { const h = T('crypto_hist').filter(x => x.sym === s && new Date(x.t) > Date.now() - minutes * 6e4), k = Math.max(1, Math.floor(minutes / 120)); return h.filter((_, i) => (h.length - 1 - i) % k === 0); },
  crypto_trade({ c, s, side, amount }) {
    if (!myChars().some(x => x.id === c)) throw new Error('No es tu personaje'); RPC.crypto_tick();
    const k = T('crypto_coins').find(x => x.sym === s); if (!k) throw new Error('Moneda desconocida');
    const H = T('crypto_hold'), h = H.find(x => x.character_id === c && x.sym === s) || (H.push({ character_id: c, sym: s, qty: 0, cost: 0 }), H.at(-1)), x = k.virt_usd + k.pool_usd; let q, usd;
    const res = T('accounts').find(a => a.name === 'Bitso · reserva de liquidez') || (T('accounts').push({ id: crypto.randomUUID(), kind: 'business', name: 'Bitso · reserva de liquidez', owners: [], balance: 0, number: '0000000001', created_at: now() }), T('accounts').at(-1));
    if (side === 'buy') { usd = Math.round(amount * 100) / 100; if (!(usd >= 1)) throw new Error('Mínimo $1'); q = Math.floor((k.pool_coin - x * k.pool_coin / (x + usd * 0.995)) * 1e8) / 1e8;
      move(personal(c), res, usd, 'Bitso · compra ' + s); k.pool_usd += usd; k.pool_coin -= q; h.qty += q; h.cost += usd; }
    else { q = +amount; if (!(q > 0)) throw new Error('Cantidad inválida'); if (h.qty < q - 1e-12) throw new Error('No tienes tanto ' + s);
      usd = Math.floor((x - x * k.pool_coin / (k.pool_coin + q)) * 0.995 * 100) / 100; if (usd < 0.01) throw new Error('Muy poco para vender'); if (usd > k.pool_usd) throw new Error('La reserva no alcanza');
      h.cost = h.qty - q <= 1e-12 ? 0 : h.cost * (h.qty - q) / h.qty; h.qty = Math.max(0, h.qty - q); move(res, personal(c), usd, 'Bitso · venta ' + s); k.pool_usd -= usd; k.pool_coin += q; }
    k.price = (k.virt_usd + k.pool_usd) / k.pool_coin; T('crypto_hist').push({ sym: s, t: now(), price: k.price });
    T('crypto_trades').push({ id: crypto.randomUUID(), character_id: c, sym: s, side, qty: q, price: usd / q, usd, created_at: now() }); return { qty: q, usd, price: usd / q, new_price: k.price };
  },
  // espejo demo de casino_start / casino_act / casino_open (la versión real está en el servidor)
  casino_open({ c, game }) { const h = T('casino_hands').find(x => x.character_id === c && x.game === game && x.status === 'open'); return h ? cView(h) : null; },
  casino_start({ c, game, bet, opts = {} }) {
    if (!myChars().some(x => x.id === c)) throw new Error('No es tu personaje');
    if (myChars().find(x => x.id === c).status !== 'active') throw new Error('Tu vida debe estar activa');
    const open = T('casino_hands').find(x => x.character_id === c && x.game === game && x.status === 'open'); if (open) return cView(open);
    bet = Math.round(Number(bet) * 100) / 100; if (!(bet >= 1)) throw new Error('La apuesta mínima es $1'); if (bet > 50000) throw new Error('La apuesta máxima es $50000');
    const n = +opts.mines; if (game === 'mines' && !(n >= 1 && n <= 24)) throw new Error('Minas entre 1 y 24');
    move(personal(c), gov(), bet, 'Casino · apuesta ' + game);
    const deck = Array.from({ length: 52 }, (_, i) => i).sort(() => Math.random() - 0.5), h = { id: crypto.randomUUID(), character_id: c, game, bet, status: 'open', created_at: now() };
    if (game === 'blackjack') { h.state = { p: [deck[0], deck[2]], d: [deck[1], deck[3]], deck: deck.slice(4) }; T('casino_hands').push(h);
      const pv = bjVal(h.state.p), dv = bjVal(h.state.d); if (pv === 21 || dv === 21) cSettle(h, pv === 21 && dv === 21 ? 1 : pv === 21 ? 2.5 : 0); }
    else if (game === 'poker') { h.state = { h: deck.slice(0, 5), deck: deck.slice(5) }; T('casino_hands').push(h); }
    else { h.state = { n, open: [], mines: Array.from({ length: 25 }, (_, i) => i).sort(() => Math.random() - 0.5).slice(0, n) }; T('casino_hands').push(h); }
    return cView(h);
  },
  casino_act({ hand, action, arg }) {
    const h = T('casino_hands').find(x => x.id === hand && x.status === 'open'); if (!h) throw new Error('Esa mano ya terminó');
    if (!myChars().some(x => x.id === h.character_id)) throw new Error('No es tu mano'); const s = h.state;
    if (h.game === 'blackjack') {
      if (action === 'double') { if (s.p.length !== 2) throw new Error('Solo puedes doblar con tus dos primeras cartas'); move(personal(h.character_id), gov(), h.bet, 'Casino · doblar blackjack'); h.bet *= 2; s.doubled = true; }
      if (action === 'hit' || action === 'double') s.p.push(s.deck.shift()); else if (action !== 'stand') throw new Error('Acción inválida');
      const pv = bjVal(s.p);
      if (pv > 21) cSettle(h, 0);
      else if (action !== 'hit' || pv === 21) { while (bjVal(s.d) < 17) s.d.push(s.deck.shift()); const dv = bjVal(s.d); cSettle(h, dv > 21 || pv > dv ? 2 : pv === dv ? 1 : 0); }
    } else if (h.game === 'poker') { if (action !== 'draw') throw new Error('Acción inválida'); s.h = s.h.map((c, i) => arg?.[i] ? c : s.deck.shift()); s.drawn = true; cSettle(h, pokerMult(s.h)); }
    else { const k = s.open.length;
      if (action === 'cash') { if (!k) throw new Error('Destapa al menos una casilla'); cSettle(h, minesMult(s.n, k)); }
      else if (action === 'pick') { const i = +arg; if (!(i >= 0 && i <= 24) || s.open.includes(i)) throw new Error('Casilla inválida'); s.open.push(i);
        if (s.mines.includes(i)) cSettle(h, 0); else if (k + 1 === 25 - s.n) cSettle(h, minesMult(s.n, k + 1)); }
      else throw new Error('Acción inválida'); }
    return cView(h);
  },
  // espejo demo de casino_play (la versión real decide en el servidor)
  casino_play({ c, game, bet, opts = {} }) {
    if (!myChars().some(x => x.id === c)) throw new Error('No es tu personaje');
    if (myChars().find(x => x.id === c).status !== 'active') throw new Error('Tu vida debe estar activa');
    bet = Math.round(Number(bet) * 100) / 100; if (!(bet >= 1)) throw new Error('La apuesta mínima es $1'); if (bet > 50000) throw new Error('La apuesta máxima es $50000');
    const a = personal(c); move(a, gov(), bet, 'Casino · apuesta ' + game);
    const R = Math.random, reds = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]; let m = 0, res;
    if (game === 'dice') { const t = +opts.target; if (!(t >= 2 && t <= 98)) throw new Error('Objetivo entre 2 y 98'); const r = Math.floor(R() * 10000) / 100;
      m = opts.over !== false ? (r > t ? 99 / (100 - t) : 0) : (r < t ? 99 / t : 0); res = { roll: r }; }
    else if (game === 'limbo') { const t = +opts.target; if (!(t >= 1.01 && t <= 1000)) throw new Error('Multiplicador entre 1.01 y 1000'); const r = Math.min(Math.floor(0.99 / (1 - R()) * 100) / 100, 1e6); m = r >= t ? t : 0; res = { result: r }; }
    else if (game === 'coin') { const sd = R() < 0.5 ? 'cara' : 'cruz'; m = sd === opts.side ? 1.98 : 0; res = { side: sd }; }
    else if (game === 'roulette') { const n = Math.floor(R() * 37), p = opts.pick || '';
      m = p === 'rojo' && reds.includes(n) || p === 'negro' && n > 0 && !reds.includes(n) || p === 'par' && n > 0 && n % 2 === 0 || p === 'impar' && n % 2 === 1 || p === 'bajo' && n >= 1 && n <= 18 || p === 'alto' && n >= 19 ? 2
        : /^d[123]$/.test(p) && n > 0 && Math.floor((n - 1) / 12) + 1 === +p[1] ? 3 : /^n\d+$/.test(p) && +p.slice(1) === n ? 36 : 0;
      res = { n, color: n === 0 ? 'verde' : reds.includes(n) ? 'rojo' : 'negro' }; }
    else if (game === 'slots') { const w = [30,25,20,12,8,5], sym = ['🍒','🍋','🔔','⭐','💎','7️⃣'], pay = [5,10,20,50,100,250];
      const k = [0,0,0].map(() => { let r = R() * 100, i = 0; while (r >= w[i]) r -= w[i++]; return i; });
      m = k[0] === k[1] && k[1] === k[2] ? pay[k[0]] : k[0] === k[1] || k[1] === k[2] || k[0] === k[2] ? 0.7 : 0; res = { reels: k.map(i => sym[i]) }; }
    else if (game === 'plinko') { const path = Array.from({ length: 8 }, () => +(R() < 0.5)), k = path.reduce((x, y) => x + y, 0); m = [13,3,1.3,0.7,0.4,0.7,1.3,3,13][k]; res = { path, slot: k }; }
    else if (game === 'wheel') { const n = Math.floor(R() * 10); m = [0,1.2,0,1.5,0,1.2,0,2,0,4][n]; res = { seg: n }; }
    else throw new Error('Juego desconocido');
    const payout = Math.round(bet * m * 100) / 100; if (m > 0) move(gov(), a, payout, `Casino · premio ${game} ×${Math.round(m * 100) / 100}`);
    T('casino_bets').push({ id: crypto.randomUUID(), character_id: c, game, bet, mult: m, payout, result: res, created_at: now() });
    return { ...res, mult: Math.round(m * 1e4) / 1e4, payout };
  },
  quit_job({ emp }) { const e = T('employments').find(x => x.id === emp); if (!e) throw new Error('Ese no es tu empleo'); e.status = 'fired'; T('work_shifts').filter(w => w.character_id === e.character_id && !w.ended_at).forEach(w => w.ended_at = now()); const c = T('characters').find(x => x.id === e.character_id); if (c) c.roles = c.roles.filter(r => r !== e.dept); },
  respond_call({ cid, act, c, note }) { const k = T('calls911').find(x => x.id === cid); if (!k) throw new Error('La llamada no existe');
    if (act === 'cancel') return Object.assign(k, { status: 'cancelada', updated_at: now() });
    if (['cerrada', 'cancelada'].includes(k.status)) throw new Error('Esa llamada ya terminó');
    if (act === 'go') Object.assign(k, { status: 'en_camino', responders: [...new Set([...(k.responders || []), c])], updated_at: now() });
    else Object.assign(k, { status: 'cerrada', note: note || null, updated_at: now() }); },
  buy_item({ c, it, q = 1 }) { const x = SHOP.find(s => s[0] === it); if (!x) throw new Error('Ese producto no existe'); const [, name, , price, gun] = x, rk = t => GUN_CLASSES.indexOf(t) + 1;
    if (q < 1 || q > 20 || (gun && gun !== 'any' && q > 1)) throw new Error('Cantidad inválida (armas: una por compra)');
    if (gun) { const lic = Math.max(0, ...T('requests').filter(r => r.character_id === c && r.type === 'licencia_armas' && r.status === 'approved').map(r => rk(r.data.tipo)));
      if (!lic) throw new Error('Necesitas una licencia de armas vigente. Tramítala en la comisaría.'); if (gun !== 'any' && lic < rk(gun)) throw new Error(`Tu licencia no cubre ${name}. Necesitas licencia de ${gun} o superior.`); }
    const total = Math.round(price * cpi() * q * 100) / 100; move(personal(c), gov(), total, 'Tool Store · ' + name + (q > 1 ? ' ×' + q : ''));
    for (let k = 0; k < q; k++) T('items').push({ id: crypto.randomUUID(), owner_char: c, item: it, serial: gun && gun !== 'any' ? crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase() : null, price: total / q, created_at: now() }); },
  confiscate_item({ i, motivo, officer }) { const x = T('items').find(y => y.id === i); if (!x) throw new Error('Ese objeto ya no existe'); if (!String(motivo || '').trim()) throw new Error('Escribe el motivo del decomiso');
    const s = SHOP.find(y => y[0] === x.item); if (!s?.[5]) throw new Error((s?.[1] || 'Eso') + ' no se puede decomisar');
    mem.t.items = T('items').filter(y => y.id !== i); T('records').push({ id: crypto.randomUUID(), kind: 'decomiso', character_id: x.owner_char, officer_id: officer, description: `Decomiso: ${s[1]}${x.serial ? ' (serie ' + x.serial + ')' : ''} — ${motivo}`, created_at: now() }); },
  revoke_doc({ r, motivo, officer }) { const q = T('requests').find(x => x.id === r && x.status === 'approved'); if (!q) throw new Error('Ese documento no existe o ya no está vigente'); if (!String(motivo || '').trim()) throw new Error('Escribe el motivo de la cancelación');
    Object.assign(q, { status: 'revoked', note: 'Cancelado por la policía: ' + motivo, reviewer_id: myId, reviewed_at: now() });
    T('records').push({ id: crypto.randomUUID(), kind: 'cancelacion', character_id: q.character_id, officer_id: officer, description: `${TRAMITES[q.type]?.name || q.type} cancelada: ${motivo}`, created_at: now() }); },
  view_posts({ ids }) { for (const id of ids) { const p = T('posts').find(x => x.id === id); if (!p || T('post_views').some(v => v.post_id === id && v.user_id === myId)) continue; T('post_views').push({ post_id: id, user_id: myId }); p.views = (p.views || 0) + 1; } save(); },
  song_play({ s, c }) { const day = now().slice(0, 10); if (T('song_plays').some(p => p.song_id === s && p.character_id === c && p.day === day)) return;
    T('song_plays').push({ song_id: s, character_id: c, day }); const sg = T('songs').find(x => x.id === s); if (!sg) return; sg.plays = (sg.plays || 0) + 1;
    const up = T('characters').find(x => x.id === sg.uploader_char); if (!sg.approved || !up || up.user_id === myId) return;
    const a = personal(up.id); if (a) try { move(gov(), a, Math.round(Number(setting('spotify_play_pay', 2)) * cpi() * 100) / 100, 'Spotify · regalías por reproducción'); } catch {} },
  signup_check({ u, d }) { const n = x => String(x || '').trim().replace(/^@/, '').toLowerCase(); return T('profiles').some(p => p.username === n(u)) ? 'Ese usuario de la web ya existe' : T('profiles').some(p => n(p.discord) === n(d)) ? 'Ese Discord ya tiene una cuenta. Solo se permite una cuenta por Discord.' : null; },
  new_bot_key() { guard(lvlLocal() >= 5, 'Solo el Owner'); return 'demo-' + crypto.randomUUID().replace(/-/g, ''); },
  pay_gov({ c, amount, concept }) {
    guard(myChars().some(x => x.id === c), 'No es tu vida'); guard(amount > 0, 'Monto inválido');
    move(personal(c), gov(), amount, concept);
  },
  set_party_pass({ p, pass }) {
    const pa = T('parties').find(x => x.id === p); guard(pa && (myChars().some(c => c.id === pa.owner_char) || lvlLocal() >= 3), 'Solo el dueño del partido');
    guard((pass || '').length >= 4, 'La contraseña debe tener al menos 4 caracteres');
    mem.t.party_secrets = [...T('party_secrets').filter(x => x.party_id !== p), { party_id: p, pass }];
  },
  run_for_office({ c, party, pass, slogan, propuestas, foto }) {
    const ch = myChars().find(x => x.id === c); guard(ch, 'No es tu vida'); guard(ch.status === 'active', 'Tu vida debe estar activa');
    const cfg = setting('elecciones', {}), hasta = cfg.registro_hasta ?? 20;
    guard(new Date().getDate() <= hasta, `El registro de candidatos cerró el día ${hasta}. Vuelve el próximo mes.`);
    if (party) guard(T('party_secrets').some(x => x.party_id === party && x.pass === (pass || '')), 'Contraseña del partido incorrecta');
    const per = iso(new Date()).slice(0, 7); mem.t.candidacies = T('candidacies').filter(x => !(x.period === per && x.character_id === c));
    T('candidacies').push({ id: crypto.randomUUID(), period: per, office: 'Presidente', character_id: c, party_id: party || null, slogan, propuestas, foto: foto || null, created_at: now() });
  },
  election_tick() {
    const per = iso(new Date()).slice(0, 7), dy = new Date().getDate(), cfg = setting('elecciones', {}), vd = cfg.votacion_desde ?? 21, vh = cfg.votacion_hasta ?? 27;
    for (const e of T('elections').filter(e => e.auto && e.open && (e.period < per || (e.period === per && dy > vh)))) {
      const n = {}; T('votes').filter(v => v.election_id === e.id).forEach(v => n[v.choice] = (n[v.choice] || 0) + 1);
      Object.assign(e, { open: false, winner: Object.keys(n).sort((a, b) => n[b] - n[a])[0] || null });
    }
    const e = T('elections').filter(e => e.auto && !e.open && !e.installed && e.period < per).sort((a, b) => b.period.localeCompare(a.period))[0];
    if (e) {
      T('characters').forEach(c => c.roles = c.roles.filter(r => r !== 'Presidente'));
      T('employments').filter(x => x.dept === 'Presidente').forEach(x => x.status = 'fired');
      T('elections').filter(x => x.auto && x.period <= e.period).forEach(x => x.installed = true);
      const w = T('characters').find(c => c.id === e.winner && c.status === 'active');
      if (w) { w.roles.push('Presidente'); const r = ranksOf('Presidente')[0], em = T('employments').find(x => x.character_id === w.id && x.dept === 'Presidente');
        if (r) em ? Object.assign(em, { status: 'active', rank: r.rank, last_qualified: iso(new Date()) }) : T('employments').push({ id: crypto.randomUUID(), character_id: w.id, dept: 'Presidente', rank: r.rank, status: 'active', last_qualified: iso(new Date()), hired_at: now() }); }
    }
    const cands = T('candidacies').filter(x => x.period === per).sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (dy >= vd && dy <= vh && !T('elections').some(x => x.period === per) && cands.length)
      T('elections').push({ id: crypto.randomUUID(), title: 'Elección presidencial · ' + per, office: 'Presidente', candidates: cands.map(x => x.character_id), open: true, period: per, auto: true, created_at: now() });
  },
  account_holder({ num }) {
    const a = T('accounts').find(x => x.number === num); if (!a) return null;
    if (a.kind !== 'personal') return a.name;
    const c = T('characters').find(x => x.id === a.owners[0]); return c ? `${c.first_name} ${c.last_name[0]}.` : null;
  },
};
const LOCAL = {
  async signUp(u, p) {
    if (mem.users.some(x => x.u === u)) throw new Error('Ese usuario ya existe');
    const id = crypto.randomUUID(); mem.users.push({ u, p, id }); mem.session = myId = id; save();
  },
  async signIn(u, p) { const x = mem.users.find(x => x.u === u && x.p === p); if (!x) throw new Error('Usuario o contraseña incorrectos'); mem.session = myId = x.id; save(); },
  async signOut() { mem.session = myId = null; save(); },
  async setPassword(p) { const u = mem.users.find(x => x.id === myId); if (u) { u.p = p; save(); } },
  async list(t, o = {}) {
    let r = T(t).filter(x => has(x, o));
    const k = o.order === undefined ? 'created_at' : o.order;
    if (k) r = r.sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * (o.asc ? 1 : -1));
    return structuredClone(r.slice(0, o.limit || 500));
  },
  async get(t, id, key = 'id') { return structuredClone(T(t).find(x => x[key] === id) || null); },
  async insert(t, row) {
    const r = { id: crypto.randomUUID(), created_at: now(), ...structuredClone(DEF[t] || {}), ...row };
    if (BY_USER[t] && !r[BY_USER[t]]) r[BY_USER[t]] = myId;
    if (t === 'songs') r.approved = lvlLocal() >= 3;
    if (t === 'calls911') Object.assign(r, { status: 'abierta', responders: [], note: null });
    if (t === 'accounts' && !r.number) r.number = String(Math.floor(Math.random() * 1e10)).padStart(10, '0');
    if (t === 'profiles' && !T('profiles').length) Object.assign(r, { staff_role: 'owner', verified: true });
    if (t === 'votes' && T('votes').some(v => v.election_id === r.election_id && v.user_id === myId)) throw new Error('Ya votaste en esta elección');
    T(t).push(r);
    if (t === 'companies' && r.industry !== 'ETF' && r.owners?.length) T('holdings').push({ id: crypto.randomUUID(), character_id: r.owners[0], company_id: r.id, shares: r.shares_total || 1000, cost: 0, created_at: now() }); // como el trigger del SQL
    save(); return structuredClone(r);
  },
  async update(t, id, patch) { const r = T(t).find(x => x.id === id); Object.assign(r, structuredClone(patch)); if (t === 'requests') Object.assign(r, { reviewer_id: myId, reviewed_at: now() }); save(); return structuredClone(r); },
  async upsert(t, row, key = 'key') { const ks = key.split(','), i = T(t).findIndex(x => ks.every(k => x[k] === row[k])); i < 0 ? T(t).push(row) : (T(t)[i] = row); save(); },
  async remove(t, id) { mem.t[t] = T(t).filter(x => x.id !== id); save(); },
  async removeWhere(t, eq) { mem.t[t] = T(t).filter(x => !Object.entries(eq).every(([k, v]) => x[k] === v)); save(); },
  async updateWhere(t, eq, patch) { T(t).filter(x => Object.entries(eq).every(([k, v]) => x[k] === v)).forEach(x => Object.assign(x, structuredClone(patch))); save(); },
  async rpc(n, a) { const r = RPC[n](a); save(); return r; },
  async upload(file) {
    const f = await shrink(file, 800);
    return new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(f); });
  },
};
if (DEMO) {
  myId = mem.session;
  if (!T('accounts').some(a => a.kind === 'gov')) { T('accounts').push({ id: crypto.randomUUID(), kind: 'gov', name: 'Tesorería de Los Ángeles', number: '0000000001', owners: [], balance: 13950000000, created_at: now() }); save(); }
}

// tiempo real: avisa cuando cambia cualquier tabla (en demo, cuando otra pestaña cambia los datos)
export function onChange(cb) {
  if (!DEMO) return sb.channel('rt').on('postgres_changes', { event: '*', schema: 'public' }, p => cb(p.table)).subscribe();
  addEventListener('storage', e => { if (e.key === LS && e.newValue) { mem = JSON.parse(e.newValue); myId = mem.session; cb('*'); } });
}
const B = DEMO ? LOCAL : SB;
// cuando cambian roles, staff o verificación, el bot de Discord los pone al momento (no espera a su vuelta de cada 15 min)
const ROLE_TABLES = ['characters', 'profiles'], ROLE_RPCS = ['delete_char', 'delete_user', 'set_vacation', 'hire', 'fire_emp'];
let syncT; const discordNow = () => { if (DEMO) return; clearTimeout(syncT); syncT = setTimeout(() => fetch('/api/discord-sync', { method: 'POST' }).catch(() => {}), 1500); };
for (const m of ['insert', 'update', 'upsert', 'remove', 'removeWhere', 'updateWhere']) { const f = B[m]; B[m] = async (t, ...a) => { const r = await f.call(B, t, ...a); if (ROLE_TABLES.includes(t)) discordNow(); return r; }; }
{ const f = B.rpc; B.rpc = async (n, a) => { const r = await f.call(B, n, a); if (ROLE_RPCS.includes(n)) discordNow(); return r; }; }
export const { signUp, signIn, signOut, list, get, insert, update, upsert, remove, removeWhere, updateWhere, rpc, upload, setPassword } = B;
