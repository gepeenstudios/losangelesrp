// Capa de datos: Supabase si config.js tiene llaves; si no, modo demo en localStorage (mismas funciones).
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
export function sharePrice(co, accounts = T('accounts'), props = T('properties'), vehicles = T('vehicles'), models = T('vehicle_models'), companies = T('companies')) {
  if (co.industry === 'ETF') { const o = companies.filter(x => x.industry !== 'ETF'); return o.length ? Math.round(o.reduce((s, x) => s + sharePrice(x, accounts, props, vehicles, models, companies), 0) / o.length * 1000) / 100 : 10; }
  const bal = accounts.find(a => a.id === co.account_id)?.balance || 0;
  const p = props.filter(x => x.owner_company === co.id).reduce((s, x) => s + Number(x.price), 0);
  const v = vehicles.filter(x => x.owner_company === co.id).reduce((s, x) => s + Number(models.find(m => m.id === x.model_id)?.price || 0), 0);
  return Math.max(1, Math.round((Number(bal) + p + v) / Math.max(co.shares_total, 1) * 100) / 100);
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
        if (a && r) try { move(g, a, Math.round(r.salary / 365 * cpi() * 100) / 100, `Nómina · ${e.dept} · ${e.rank}`); n++; } catch {}
      } else if ((e.last_qualified || '1970-01-01') < iso(new Date(new Date(d) - 6 * 864e5))) { e.status = 'fired'; ch.roles = ch.roles.filter(x => x !== e.dept); f++; }
    }
    for (const c of T('companies')) T('price_history').push({ id: crypto.randomUUID(), company_id: c.id, price: sharePrice(c), created_at: now() });
    for (const a of T('accounts').filter(a => a.kind === 'savings' && a.balance > 0)) try { move(g, a, Math.round(a.balance * rate / 100 / 365 * 100) / 100, 'Intereses de ahorro'); } catch {}
    const inc = setting('biz_income', {}); // los negocios del rol no venden de verdad: el gobierno les paga según su giro
    for (const co of T('companies').filter(co => co.account_id && co.owners.some(o => T('characters').find(c => c.id === o)?.status === 'active')))
      try { move(g, T('accounts').find(a => a.id === co.account_id), Math.round((inc[co.industry] ?? 400) * cpi() * 100) / 100, 'Ingresos del negocio · ' + (co.industry || '')); } catch {}
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
    for (const [t, f] of [['vehicles', 'owner_char'], ['holdings', 'character_id'], ['requests', 'character_id'], ['employments', 'character_id'], ['records', 'character_id'], ['inmates', 'character_id'], ['work_shifts', 'character_id']]) mem.t[t] = T(t).filter(x => x[f] !== c);
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
  staff_pay({ acc: id, amount, concept, mint }) { mint && amount > 0 ? move(null, acc(id), amount, concept) : amount >= 0 ? move(gov(), acc(id), amount, concept) : move(acc(id), gov(), -amount, concept); },
  buy({ kind, item, acc: id, qty = 1 }) {
    const a = acc(id), co = a.kind === 'business' ? T('companies').find(c => c.account_id === id) : null, buyer = co ? null : a.owners[0];
    let q = Math.max(qty || 1, 1), price, seller;
    if (kind === 'property') {
      const p = T('properties').find(x => x.id === item);
      if (!p?.for_sale) throw new Error('No está en venta');
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
      for (let i = 0; i < q; i++) T('vehicles').push({ id: crypto.randomUUID(), model_id: item, owner_char: buyer, owner_company: co?.id || null, sale_price: null, plate: null, created_at: now() });
    } else if (kind === 'vehicle') {
      const v = T('vehicles').find(x => x.id === item);
      if (v?.sale_price == null) throw new Error('No está en venta');
      price = v.sale_price; seller = personal(v.owner_char) || acc(company(v.owner_company).account_id);
      if (seller === a) throw new Error('Ya es tuyo');
      move(a, seller, price, 'Compra · auto usado');
      Object.assign(v, { owner_char: buyer, owner_company: co?.id || null, sale_price: null, plate: null });
    } else if (kind === 'shares') {
      if (!buyer) throw new Error('Compra acciones con tu cuenta personal');
      const c = company(item); price = sharePrice(c) * q;
      move(a, c.industry === 'ETF' ? gov() : acc(c.account_id), price, 'Compra de acciones');
      const h = T('holdings').find(x => x.character_id === buyer && x.company_id === item);
      h ? (h.shares += q, h.cost = (h.cost || 0) + price) : T('holdings').push({ id: crypto.randomUUID(), character_id: buyer, company_id: item, shares: q, cost: price, created_at: now() });
      T('trades').push({ id: crypto.randomUUID(), character_id: buyer, company_id: item, side: 'compra', qty: q, price: price / q, total: price, created_at: now() });
      T('price_history').push({ id: crypto.randomUUID(), company_id: item, price: sharePrice(c), created_at: now() });
    } else throw new Error('Tipo inválido');
    return price;
  },
  sell_shares({ company: cid, qty, acc: id }) {
    const a = acc(id), h = T('holdings').find(x => x.character_id === a.owners[0] && x.company_id === cid);
    if (!h || h.shares < qty || qty < 1) throw new Error('No tienes tantas acciones');
    const c = company(cid), price = sharePrice(c) * qty;
    move(c.industry === 'ETF' ? gov() : acc(c.account_id), a, price, 'Venta de acciones');
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
      const a = personal(au.id); if (a) try { move(gov(), a, Math.round(Number(setting('influencer_like_pay', 15)) * cpi() * 100) / 100, 'Influencer · pago por like'); } catch {}
    }
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
    if (t === 'accounts' && !r.number) r.number = String(Math.floor(Math.random() * 1e10)).padStart(10, '0');
    if (t === 'profiles' && !T('profiles').length) Object.assign(r, { staff_role: 'owner', verified: true });
    if (t === 'votes' && T('votes').some(v => v.election_id === r.election_id && v.user_id === myId)) throw new Error('Ya votaste en esta elección');
    T(t).push(r); save(); return structuredClone(r);
  },
  async update(t, id, patch) { const r = T(t).find(x => x.id === id); Object.assign(r, structuredClone(patch)); if (t === 'requests') Object.assign(r, { reviewer_id: myId, reviewed_at: now() }); save(); return structuredClone(r); },
  async upsert(t, row, key = 'key') { const ks = key.split(','), i = T(t).findIndex(x => ks.every(k => x[k] === row[k])); i < 0 ? T(t).push(row) : (T(t)[i] = row); save(); },
  async remove(t, id) { mem.t[t] = T(t).filter(x => x.id !== id); save(); },
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
export const { signUp, signIn, signOut, list, get, insert, update, upsert, remove, rpc, upload } = B;
