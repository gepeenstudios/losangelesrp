// Estado, helpers de UI, formularios y la cola de aprobaciones (compartida por Staff, Policía, Corte, etc.)
import * as db from './db.js';
import { LVL, STAFF, TRAMITES, POLICE, DEFAULT_SETTINGS } from './data.js';
import { ico } from './icons.js';

export const S = { me: null, chars: [], char: null, all: [], settings: {}, tags: [], ranks: [], jobs: [] };
export const cpi = () => Number(S.settings.cpi ?? 1);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = n => '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
// fechas en la hora de la ciudad (1 día = 2 h reales); las fechas sin hora (nacimiento, vencimientos) se muestran tal cual
export const fdate = d => !d ? '' : /^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? new Date(d + 'T12:00:00Z').toLocaleDateString('es-MX', { dateStyle: 'medium', timeZone: 'UTC' })
  : fgame(d, { dateStyle: 'medium', timeStyle: 'short' });
export const lvl = () => LVL[S.me?.staff_role] || 0;
export const has = (...r) => r.some(x => S.char?.roles?.includes(x));
export const isPolice = () => has(...POLICE); // solo quien tiene el rol de policía (el staff también necesita que se lo asignen)
export const set = k => S.settings[k] ?? DEFAULT_SETTINGS[k];
export const cname = id => { const c = S.all.find(x => x.id === id); return c ? `${c.first_name} ${c.last_name}` : '—'; };
export const charOpts = (filter = c => c.status === 'active') => S.all.filter(filter).map(c => [c.id, `${c.first_name} ${c.last_name}`]);
const isImg = v => typeof v === 'string' && /^(data:image|https?:\/\/.*\.(png|jpe?g|webp|gif)|https?:\/\/.*\/storage\/)/i.test(v);

export async function loadMe() {
  S.me = await db.get('profiles', db.uid());
  if (!S.me) return;
  S.all = await db.list('characters', { order: 'first_name', asc: true });
  S.chars = S.all.filter(c => c.user_id === S.me.id);
  const sid = localStorage.getItem('rp_char');
  S.char = S.chars.find(c => c.id === sid && c.status === 'active') || S.chars.find(c => c.status === 'active') || null;
  S.settings = Object.fromEntries((await db.list('settings', { order: null })).map(r => [r.key, r.value]));
  const t = new Set(S.chars.filter(c => c.status === 'active').flatMap(c => c.roles || []));
  S.chars.forEach(c => t.add('char:' + c.id));
  STAFF.forEach(([k, , n]) => n <= lvl() && t.add('staff:' + k));
  S.ranks = await db.list('dept_ranks', { order: null, limit: 1000 });
  S.jobs = (await db.list('employments', { order: null, limit: 5000 })).filter(e => e.status !== 'fired' && S.chars.some(c => c.id === e.character_id && c.status === 'active'));
  S.jobs.forEach(e => S.ranks.find(r => r.dept === e.dept && r.rank === e.rank)?.manage && t.add('mgr:' + e.dept));
  S.tags = [...t];
  S.docs = S.char ? (await db.list('requests', { eq: { character_id: S.char.id, status: 'approved' }, order: null, limit: 500 })).map(r => r.type) : []; // para mostrar Documentos/Licencias en el escritorio
}

// ---------- toasts y modales ----------
export function toast(msg, kind = 'ok') {
  const t = Object.assign(document.createElement('div'), { className: 'toast ' + kind, textContent: msg });
  document.body.append(t); setTimeout(() => t.remove(), 4500);
}
// Notificación estilo macOS/iOS (arriba a la derecha), p. ej. al recibir un mensaje
export function notify({ icon = '', title, body, onclick }) {
  let box = document.querySelector('.notifs'); if (!box) { box = Object.assign(document.createElement('div'), { className: 'notifs' }); document.body.append(box); }
  const n = document.createElement('button'); n.className = 'notif'; n.innerHTML = `<span class="n-ic">${icon}</span><span class="n-tx"><b>${esc(title)}</b><span>${esc(body)}</span></span><small>ahora</small>`;
  const bye = () => { n.classList.add('out'); setTimeout(() => n.remove(), 300); };
  n.onclick = () => { onclick?.(); bye(); }; box.prepend(n); setTimeout(bye, 7000);
  try { new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=').play().catch(() => {}); } catch {}
}
// confirm() nativo no sale en navegadores integrados (app de Discord/Roblox, paneles): usamos un modal propio
export const ask = msg => new Promise(res => {
  let ok = false;
  const close = modal('Confirmar', `<p>${esc(msg)}</p><div class="row gap"><button class="btn" data-act="si">Sí, continuar</button><button class="btn ghost" data-act="close">Cancelar</button></div>`, { si: () => { ok = true; close(); } });
  const m = document.body.lastElementChild;
  new MutationObserver((_, o) => { if (!m.isConnected) { o.disconnect(); res(ok); } }).observe(document.body, { childList: true });
});
export function modal(title, html, acts = {}) {
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div class="modal-c"><div class="modal-h"><b>${title}</b><button class="x" data-act="close" aria-label="Cerrar">✕</button></div><div class="modal-b"></div></div>`;
  document.body.append(m);
  const close = () => m.remove();
  view(m.querySelector('.modal-b'), html, acts, close);
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-act=close]')) close(); });
  return close;
}

// view: pinta html y conecta [data-act] (clicks) y form[data-form] (submits) a funciones
export function view(el, html, acts = {}, close) {
  el.innerHTML = html.replaceAll('<img ', '<img loading="lazy" decoding="async" ');
  enhance(el);
  el.onclick = async e => {
    const t = e.target.closest('[data-act]');
    if (!t || !el.contains(t) || !acts[t.dataset.act]) return;
    e.preventDefault();
    try { await acts[t.dataset.act](t.dataset, t, close); } catch (err) { console.error(err); toast(err.message, 'err'); }
  };
  el.onsubmit = async e => {
    const f = e.target, fn = acts[f.dataset.form];
    if (!fn) return;
    e.preventDefault();
    const b = f.querySelector('[type=submit]'), txt = b?.innerHTML; // evita doble envío y muestra que está trabajando
    if (b) { b.disabled = true; b.classList.add('busy'); b.innerHTML = '<span class="bspin"></span> Procesando…'; }
    try { await fn(await readForm(f), f, close); } catch (err) { toast(err.message, 'err'); }
    finally { if (b) { b.disabled = false; b.classList.remove('busy'); b.innerHTML = txt; } }
  };
}

// Descarga un elemento de la página como imagen PNG (para documentos y licencias)
let h2i;
export async function downloadImage(node, name) {
  h2i ??= new Promise((ok, bad) => { const s = document.createElement('script'); s.src = 'js/vendor/html-to-image.js'; s.onload = () => ok(window.htmlToImage); s.onerror = bad; document.head.append(s); });
  const url = await (await h2i).toPng(node, { pixelRatio: 3, cacheBust: true, skipFonts: true, imagePlaceholder: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }); // si una foto no carga, se pone transparente en vez de fallar
  Object.assign(document.createElement('a'), { href: url, download: name.replace(/[^\w\sáéíóúñÁÉÍÓÚÑ.-]/g, '').trim() + '.png' }).click();
}

// ---------- formularios ----------
// buscador de personas (escribes y salen sugerencias) y campos que aparecen según otra respuesta
export function enhance(root) {
  root.querySelectorAll('select[data-person]').forEach(sel => {
    if (sel.dataset.done) return; sel.dataset.done = 1; sel.classList.add('sr-sel');
    const box = Object.assign(document.createElement('div'), { className: 'pbox' });
    box.innerHTML = '<input type="text" placeholder="Escribe un nombre…" autocomplete="off" aria-label="Buscar persona"><div class="plist" hidden></div>';
    sel.after(box); const inp = box.firstChild, list = box.lastChild, opts = [...sel.options].filter(o => o.value);
    if (sel.value) inp.value = sel.selectedOptions[0].text;
    inp.oninput = () => { const q = inp.value.trim().toLowerCase(); sel.value = '';
      const hits = q ? opts.filter(o => o.text.toLowerCase().includes(q)).slice(0, 8) : [];
      list.innerHTML = hits.map(o => { const c = S.all.find(x => x.id === o.value); return `<button type="button" data-v="${esc(o.value)}"><img class="av sm" src="${esc(c?.skin_url || '')}" alt=""><span>${esc(o.text)}</span></button>`; }).join('') || (q ? '<small class="muted">Nadie con ese nombre</small>' : '');
      list.hidden = !q; };
    list.onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; sel.value = b.dataset.v; inp.value = b.textContent.trim(); list.hidden = true; sel.dispatchEvent(new Event('change', { bubbles: true })); };
  });
  root.querySelectorAll('form').forEach(f => {
    const conds = [...f.querySelectorAll('[data-show]')]; if (!conds.length) return;
    const upd = () => conds.forEach(l => { const [k, vals] = l.dataset.show.split('='), cur = f.elements[k]?.value || '', on = vals.split('|').includes(cur);
      l.hidden = !on; l.querySelectorAll('input,select,textarea').forEach(x => x.disabled = !on); });
    f.addEventListener('change', upd); upd();
  });
}
// datos de la vida (registro civil) que se pueden corregir con el trámite «correccion»
export const VIDA_FIELDS = { first_name: 'Nombre(s)', last_name: 'Apellido(s)', dob: 'Fecha de nacimiento (AAAA-MM-DD)', sex: 'Sexo', city: 'Ciudad', nationality: 'Nacionalidad' };
export async function resolveFields(fields) {
  const dyn = {
    // cada dato que se puede corregir de mis trámites: «id|tipo|campo»
    '@myFields': async () => (await db.list('requests', { eq: { character_id: S.char?.id } })).filter(r => r.type !== 'correccion' && r.status !== 'rejected' && TRAMITES[r.type])
      .flatMap(r => TRAMITES[r.type].fields.filter(f => f.type !== 'file' && f.type !== 'checkbox' && typeof f.options !== 'string' && r.data?.[f.k] != null)
        .map(f => [`${r.id}|${r.type}|${f.k}`, `${TRAMITES[r.type].name} (${r.id.slice(0, 6).toUpperCase()}) → ${f.label.replace(/\s*\(.*\)$/, '')}: ${String(r.data[f.k]).slice(0, 40)}`]))
      .concat(S.char ? Object.entries(VIDA_FIELDS).map(([k, l]) => [`${S.char.id}|vida|${k}`, `Registro de mi vida → ${l}: ${String(S.char[k] ?? '').slice(0, 40)}`]) : []),
    '@chars': () => charOpts(c => c.status === 'active' && c.id !== S.char?.id),
    '@myVehicles': async () => {
      const ms = Object.fromEntries((await db.list('vehicle_models', { order: null })).map(m => [m.id, m]));
      return [['inicial', 'Auto inicial'], ...(await db.list('vehicles', { eq: { owner_char: S.char?.id } }))
        .map(v => [v.id, `${ms[v.model_id]?.brand || ''} ${ms[v.model_id]?.model || 'Vehículo'}${v.plate ? ' · ' + v.plate : ''}`])];
    },
  };
  return Promise.all(fields.map(async f => typeof f.options === 'string' ? { ...f, person: f.options === '@chars', options: await dyn[f.options]() } : f));
}
export function fieldsHTML(fields, v = {}) {
  return fields.map(f => {
    const val = v[f.k] ?? f.def ?? '', req = f.req ? 'required' : '';
    let i;
    if (f.type === 'textarea') i = `<textarea name="${f.k}" rows="3" ${req} placeholder="${esc(f.ph || '')}">${esc(val)}</textarea>`;
    else if (f.type === 'select') i = `<select name="${f.k}" ${req} ${f.person ? 'data-person' : ''}><option value="">Selecciona…</option>${f.options.map(o => {
      const [ov, ol] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(ov)}" ${String(ov) === String(val) ? 'selected' : ''}>${esc(ol)}</option>`;
    }).join('')}</select>`;
    else if (f.type === 'file' || f.type === 'textfile') i = `<div class="drop">${val && f.type === 'file' ? `<img class="drop-prev" src="${esc(val)}" alt="">` : ''}
      <div class="drop-ui"><span class="drop-ico">${f.type === 'file' ? '🖼️' : '📄'}</span><b>Arrastra ${f.type === 'file' ? 'tu imagen' : 'tu archivo'} aquí</b><small>o toca para elegir</small></div>
      <input type="file" name="${f.k}" ${f.type === 'textfile' ? 'data-text="1"' : ''} ${f.raw ? 'data-raw="1"' : ''} accept="${f.accept || (f.type === 'file' ? 'image/*' : '.html,text/html')}" ${req}></div>`;
    else if (f.type === 'check') return `<label class="chk"><input type="checkbox" name="${f.k}" ${val ? 'checked' : ''} ${req}> ${esc(f.label)}: ${esc(f.text || '')}</label>`;
    else i = `<input name="${f.k}" type="${f.type || 'text'}" value="${esc(val)}" ${req} ${f.pattern ? `pattern="${f.pattern}"` : ''}
      ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} ${f.type === 'number' ? 'step="any"' : ''} placeholder="${esc(f.ph || '')}">`;
    return `<label class="fld" ${f.show ? `data-show="${esc(f.show)}"` : ''}><span>${esc(f.label)}${f.req ? ' *' : ''}</span>${i}${f.help ? `<small>${esc(f.help)}</small>` : ''}</label>`;
  }).join('');
}
export async function readForm(fm) {
  const o = {};
  for (const el of fm.elements) {
    if (!el.name || el.disabled || (el.type === 'radio' && !el.checked)) continue;
    if (el.type === 'file') { if (el.files[0]) o[el.name] = el.dataset.text ? await el.files[0].text() : el.dataset.raw ? el.files[0] : await db.upload(el.files[0]); }
    else if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.type === 'number') o[el.name] = el.value === '' ? null : Number(el.value);
    else o[el.name] = el.value.trim();
  }
  return o;
}
export const form = (name, fields, v, btn = 'Enviar') => `<form data-form="${name}" class="form">${fieldsHTML(fields, v)}<button class="btn" type="submit">${btn}</button></form>`;

// ---------- trámites ----------
export async function myRequests() { return S.char ? db.list('requests', { eq: { character_id: S.char.id } }) : []; }
export const approvedOf = (reqs, type) => reqs.filter(r => r.type === type && r.status === 'approved');

// muestra los datos de una solicitud con las etiquetas del formulario
export function requestHTML(r) {
  const t = TRAMITES[r.type] || { name: r.data.job_title ? 'Postulación: ' + r.data.job_title : r.type, fields: [] };
  const lab = { experiencia: 'Experiencia', disponibilidad: 'Disponibilidad', entrevista: 'Fecha preferida para entrevista', hora: 'Hora preferida', ...Object.fromEntries((t.fields || []).map(f => [f.k, f.label])) };
  const val = (k, v) => r.type === 'correccion' && k === 'campo' ? (([id, ty, f]) => esc(ty === 'vida' ? `Registro de la vida → ${VIDA_FIELDS[f] || f}` : `${TRAMITES[ty]?.name || ty} (folio ${id.slice(0, 8).toUpperCase()}) → ${TRAMITES[ty]?.fields.find(x => x.k === f)?.label || f}`))(String(v).split('|'))
    : k === 'victima' || k === 'demandado' ? esc(cname(v))
    : isImg(v) ? `<img class="thumb" src="${esc(v)}" alt="${esc(lab[k] || k)}" data-act="zoom" data-src="${esc(v)}">`
    : typeof v === 'boolean' ? (v ? 'Sí' : 'No')
    : /^https?:\/\//.test(v) ? `<a href="${esc(v)}" target="_blank" rel="noopener">${esc(v)}</a>` : esc(v);
  return `<dl class="dl">${Object.entries(r.data || {}).filter(([k, v]) => v !== '' && v != null && !k.startsWith('job_id'))
    .map(([k, v]) => `<dt>${esc(lab[k] || k)}</dt><dd>${val(k, v)}</dd>`).join('')}</dl>`;
}

const rand = (a, b) => Math.round(a + Math.random() * (b - a));
// efectos al aprobar (los ejecuta quien aprueba; lo que mueve dinero pasa por funciones seguras de la BD)
export const ON_APPROVE = {
  async robo(r) {
    const [a, b] = set('robos')[r.data.tipo] || [100, 500], amt = rand(a, b);
    const acc = (await db.list('accounts', { eq: { kind: 'personal' }, contains: { owners: [r.character_id] } }))[0];
    if (!acc) throw new Error('El personaje no tiene cuenta bancaria');
    await db.rpc('staff_pay', { acc: acc.id, amount: amt, concept: 'Robo aprobado · ' + r.data.tipo });
    return `Se depositaron ${money(amt)}.`;
  },
  async ck(r) {
    await db.update('characters', r.data.victima, { status: 'dead' });
    await db.insert('posts', { app: 'news', section: 'Obituarios', character_id: null, anonimo: true,
      title: `Fallece ${cname(r.data.victima)}`,
      body: `Las autoridades de Los Ángeles confirmaron el fallecimiento de ${cname(r.data.victima)} en ${r.data.lugar}. Hasta el momento no se han dado a conocer más detalles del caso. Descanse en paz.`,
      media_url: r.data.foto_cuerpo });
    return 'Personaje marcado como muerto y obituario publicado en el periódico.';
  },
  async apelacion_ck(r) { await db.update('characters', r.character_id, { status: 'active' }); return 'CK anulado: el personaje vuelve a estar activo.'; },
  async empresa(r, c) {
    const d = r.data, giro = d.giro;
    const acc = await db.insert('accounts', { kind: 'business', name: d.nombre, owners: [r.character_id] });
    try { await db.rpc('fund_company', { req: r.id, dest: acc.id }); } catch (e) { await db.remove('accounts', acc.id); throw e; }
    const ein = `${rand(10, 99)}-${rand(1000000, 9999999)}`;
    const { GIROS, PERMISOS_BASE } = await import('./data.js');
    const extra = GIROS.find(g => g[0] === giro)?.[1];
    await db.insert('companies', { name: d.nombre, industry: giro, brand: d.marca || null, account_id: acc.id, owners: [r.character_id], ein,
      permits: [...PERMISOS_BASE, ...(extra && extra !== '—' ? [extra] : [])], description: d.descripcion, logo_url: d.logo || null });
    if (lvl() >= 3) await addRole(r.character_id, 'Empresario');
    return `Empresa creada. EIN ${ein}. Se pasaron ${money(Number(d.capital) || 0)} de capital de la cuenta del dueño a la cuenta de la empresa ${acc.number}.`;
  },
  async partido(r) {
    await db.insert('parties', { name: r.data.nombre, siglas: r.data.siglas || null, ideologia: r.data.ideologia, logo: r.data.logo || null, owner_char: r.character_id });
    return 'Partido registrado. El dueño debe poner la contraseña del partido en Vote.gov → Mi partido.';
  },
  async verificacion_ig(r) {
    const c = S.all.find(x => x.id === r.character_id), base = c?.ig_verified_until && new Date(c.ig_verified_until) > new Date() ? new Date(c.ig_verified_until) : new Date();
    await db.update('characters', r.character_id, { ig_verified_until: new Date(+base + 30 * 864e5).toISOString() }); // 30 días por cada pago de $5
    return 'Cuenta verificada por 30 días ✔️';
  },
  app_store() { return 'Permiso aprobado. El Owner programará la app como la pediste y la publicará en el App Store.'; },
  async placa(r) { if (r.data.vehiculo && r.data.vehiculo !== 'inicial') await db.update('vehicles', r.data.vehiculo, { plate: r.data.placa.toUpperCase() }); return 'Placa asignada.'; },
  async job(r) {
    if (!r.data.role_tag) return '';
    await db.rpc('hire', { c: r.character_id, d: r.data.role_tag });
    return `Contratado en ${r.data.role_tag}. El bot le pone en Discord el rol "${r.data.role_tag}".`;
  },
  async juicio(r) { // aprobar = culpable: entra a prisión con los años pedidos
    const minutes = Number(r.data.anos) * Number(set('prison_min_per_year'));
    await db.insert('inmates', { character_id: r.character_id, charges: r.data.charges || [], years: Number(r.data.anos), minutes, started_at: new Date().toISOString(), ends_at: new Date(Date.now() + minutes * 6e4).toISOString(), status: 'en_prision', note: 'Sentencia judicial' });
    await db.insert('records', { kind: 'arresto', character_id: r.character_id, amount: r.data.multa || null, description: 'Sentencia: ' + r.data.cargos, charges: r.data.charges || [] });
    for (const o of await db.list('records', { eq: { character_id: r.character_id, kind: 'orden', paid: false } })) if (o.description.startsWith('En espera de juicio')) await db.update('records', o.id, { paid: true });
    return `Culpable: ${Math.round(r.data.anos * 12)} meses de prisión (${Math.round(minutes)} min reales). Ya está corriendo su condena.`;
  },
  async warn_prision(r) {
    const c = S.all.find(x => x.id === r.data.preso_id), p = c && await db.get('profiles', c.user_id);
    await db.insert('bans', { kind: 'warn', username: p?.username || '', roblox: p?.roblox || '', discord: p?.discord || '', reason: `Fuera de prisión sin fuga aprobada (${r.data.lugar})`, by_user: S.me.id });
    return 'Warn administrativo registrado en Sanciones. Aplícalo también en Discord.';
  },
  async correccion(r) { // en Supabase lo aplica la base de datos al aprobar; aquí solo el modo demo
    if (!db.DEMO) return 'El dato quedó corregido en su trámite.';
    const [id, ty, k] = r.data.campo.split('|');
    if (ty === 'vida') { if (id === r.character_id && VIDA_FIELDS[k]) await db.update('characters', id, { [k]: r.data.nuevo, ...(k === 'nationality' ? { extranjero: r.data.nuevo !== 'Estadounidense' } : {}) }); return 'El dato quedó corregido en el registro de su vida.'; }
    const t = await db.get('requests', id);
    if (t?.character_id === r.character_id) await db.update('requests', id, { data: { ...t.data, [k]: r.data.nuevo } });
    return 'El dato quedó corregido en su trámite.';
  },
  async vacaciones(r) { await db.rpc('set_vacation', { c: r.character_id, d: r.data.dept, until: r.data.hasta }); return 'Vacaciones aprobadas.'; },
};
export async function addRole(charId, role) {
  const c = await db.get('characters', charId);
  if (!c.roles.includes(role)) await db.update('characters', charId, { roles: [...c.roles, role] });
}

// cola de revisión: muestra solicitudes pendientes que este usuario puede aprobar
export async function reviewQueue(el, { types, title = 'Pendientes por revisar', extra } = {}) {
  let rows = (await db.list('requests', { eq: { status: 'pending' }, overlaps: { dept: S.tags } }))
    .filter(r => (!types || types.includes(r.type)) && (r.user_id !== S.me.id || lvl() >= 3));
  const html = rows.length ? rows.map(r => `<div class="card">
      <div class="row"><b class="ttl">${ico(r.type)} ${esc(TRAMITES[r.type]?.name || r.data.job_title || r.type)}</b><span class="muted">${fdate(r.created_at)}</span></div>
      <div class="muted">Solicitante: <b>${esc(cname(r.character_id))}</b> ${extra ? extra(r) : ''}</div>
      ${requestHTML(r)}
      <div class="row gap"><input placeholder="Nota (opcional; ej. fecha de entrevista)" data-note="${r.id}">
      <button class="btn ok" data-act="ok" data-id="${r.id}">Aprobar</button><button class="btn bad" data-act="no" data-id="${r.id}">Rechazar</button></div></div>`).join('')
    : '<p class="empty">No hay nada pendiente 🎉</p>';
  const decide = status => async d => {
    const r = rows.find(x => x.id === d.id), note = el.querySelector(`[data-note="${d.id}"]`).value;
    let msg = '';
    if (status === 'approved') msg = (await ON_APPROVE[r.type]?.(r)) || '';
    if (status === 'rejected') await db.rpc('reject_request', { id: r.id, note }); // se borra y queda en el historial de la persona
    else await db.update('requests', r.id, { status, note, reviewer_id: S.me.id, reviewed_at: new Date().toISOString() });
    const role = status === 'approved' && TRAMITES[r.type]?.discord?.(r.data);
    if (status === 'approved' && TRAMITES[r.type]?.role && lvl() >= 3) await addRole(r.character_id, TRAMITES[r.type].role);
    toast(`${status === 'approved' ? 'Aprobado' : 'Rechazado'}. ${msg}${role ? ` · Discord: ${role}` : ''}`);
    if (r.user_id === S.me.id || S.chars.some(c => c.id === r.data?.victima)) return window.refreshShell?.(); // me afecta a mí: refrescar todo
    reviewQueue(el, { types, title, extra });
  };
  view(el, `<h3>${title}</h3>${html}`, { ok: decide('approved'), no: decide('rejected'), zoom: d => modal('Imagen', `<img class="full" src="${esc(d.src)}" alt="">`) });
}

export const tabs = (list, cur) => `<nav class="tabs">${list.map(([k, l]) => `<button data-act="tab" data-t="${k}" class="${k === cur ? 'on' : ''}">${l}</button>`).join('')}</nav>`;
export const needChar = el => {
  if (S.char?.status === 'active') return true;
  el.innerHTML = `<p class="empty">Necesitas un personaje activo. Ve a <b>Mi Vida</b> para crearlo o esperar su aprobación.</p>`;
  return false;
};
export async function myAccounts() {
  if (!S.char) return [];
  return db.list('accounts', { overlaps: { owners: [S.char.id] }, order: 'kind', asc: false });
}
export const accSelect = (accs, name = 'acc') => `<label class="fld"><span>Pagar con</span><select name="${name}" required>${accs.map(a =>
  `<option value="${a.id}">${a.kind === 'personal' ? 'Personal' : '🏢 ' + esc(a.name)} · ${money(a.balance)}</option>`).join('')}</select></label>`;
export const stars = n => '★'.repeat(Math.round(n || 0)) + '☆'.repeat(5 - Math.round(n || 0));

// zonas para soltar archivos: el input transparente cubre la zona (arrastrar funciona nativo); aquí solo la vista previa
document.addEventListener('change', e => {
  const inp = e.target, box = inp.closest?.('.drop'); if (!box) return;
  const f = inp.files[0]; box.querySelector('.drop-prev')?.remove(); box.classList.toggle('has', !!f);
  if (!f) return;
  if (f.type.startsWith('image/')) box.insertAdjacentHTML('afterbegin', `<img class="drop-prev" src="${URL.createObjectURL(f)}" alt="">`);
  else box.querySelector('.drop-ui b').textContent = '✅ ' + f.name;
});
for (const [ev, on] of [['dragenter', 1], ['dragover', 1], ['dragleave', 0], ['drop', 0]])
  document.addEventListener(ev, e => { const b = e.target.closest?.('.drop'); if (b) b.classList.toggle('over', !!on); });

// ===== Tiempo del juego: 1 día = 2 horas reales (×12). Día 1 (1 ene 2026 00:00) = 15 nov 2026 00:00 Monterrey. Igual que game_day()/game_start() del SQL.
export const GAME_EPOCH = Date.parse('2026-11-15T06:00:00Z'), GAME_DAY_MS = 2 * 3600e3, GAME_SPEED = 12;
export const gameDate = (t = Date.now()) => new Date(Date.UTC(2026, 0, 1) + (new Date(t).getTime() - GAME_EPOCH) * GAME_SPEED); // fecha/hora del juego (léela en UTC)
export const gameDay = (t = Date.now()) => gameDate(t).toISOString().slice(0, 10);
export const gameStart = d => GAME_EPOCH + (Date.parse(d + 'T00:00:00Z') - Date.UTC(2026, 0, 1)) / GAME_SPEED; // momento real en que empieza el día «d»
export const fgame = (t = Date.now(), opt = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) => gameDate(t).toLocaleString('es-MX', { ...opt, timeZone: 'UTC' });
