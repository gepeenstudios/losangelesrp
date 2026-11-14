// Arranque y "sistema operativo": macOS en PC, iOS en celular (lo decide el CSS por ancho de pantalla)
import * as db from './db.js';
import { S, esc, money, lvl, loadMe, toast, view, fieldsHTML, cname, myAccounts, modal, notify } from './core.js';
import { APPS, seed, resolveSite } from './apps.js';
import { WALLPAPERS, STAFF_NAME, TRAMITES } from './data.js';
import { lifeWizard } from './vida.js';
import { ico } from './icons.js';
import { CIUDAD } from '../config.js';

const root = document.getElementById('app');
const demoTag = db.DEMO ? '<span class="demo">DEMO</span>' : '';
const mobile = () => matchMedia('(max-width: 760px)').matches;
const FAVS = ['banco', 'mensajes', 'x', 'gobierno', 'vida', 'news', 'insta', 'autos'];
const glyph = a => { const u = S.settings?.app_icons?.[a.id]; return u ? `<img class="gimg" src="${esc(u)}" alt="">` : ico(a.id, 'gi'); };
const wallCss = w => esc(String(w || WALLPAPERS[0]).replace(/ center\/cover$/, ''));
const bigClock = () => `<div class="lock-time"><b data-clock="t"></b><span data-clock="d"></span></div>`;
function clocks() {
  const n = new Date();
  root.querySelectorAll('[data-clock]').forEach(e => {
    const k = e.dataset.clock;
    e.textContent = k === 't' ? n.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: false })
      : k === 'd' ? n.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
      : n.toLocaleString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  });
}
setInterval(clocks, 10000);

function login(mode = 'in') {
  const fields = mode === 'in'
    ? [{ k: 'u', label: 'Usuario', req: 1 }, { k: 'p', label: 'Contraseña', type: 'password', req: 1 }]
    : [{ k: 'u', label: 'Usuario de la web (3-20, letras/números)', req: 1, pattern: '[A-Za-z0-9_.]{3,20}' },
       { k: 'p', label: 'Contraseña (mín. 6)', type: 'password', req: 1, pattern: '.{6,}' },
       { k: 'roblox', label: 'Usuario de Roblox', req: 1 }, { k: 'discord', label: 'Usuario de Discord (el de tu perfil, ej. juan_rp). Solo 1 cuenta por Discord; con él te ponemos tus roles', req: 1 },
       ...(db.DEMO ? [] : [{ k: 'dcode', label: 'Código de 6 dígitos que te manda el bot por Discord (vence en 5 min)', req: 1, pattern: '\\d{6}', ph: '123456' }]),
       { k: 'avatar', label: 'Foto de tu avatar de Roblox (será tu foto de perfil)', type: 'file', req: 1, raw: 1 }]; // se sube después de crear la cuenta (antes no hay permiso)
  view(root, `<div class="lock" style="--wall:${wallCss(WALLPAPERS[1])}">${bigClock()}
    <div class="lock-c ${mode}"><img class="lock-logo" src="img/logo.png" alt="Los Angeles Roleplay"><h1 class="sr">${esc(CIUDAD)}</h1><p class="muted">Portal oficial de la Ciudad de Los Ángeles ${demoTag}</p>
    <form data-form="go" class="form">${fieldsHTML(fields.slice(0, 4))}${mode === 'up' && !db.DEMO ? '<button type="button" class="btn ghost" data-act="code">📨 Enviarme código por Discord</button>' : ''}${fieldsHTML(fields.slice(4))}<button class="btn big" type="submit">${mode === 'in' ? 'Entrar' : 'Crear cuenta'}</button></form>
    <button class="link" data-act="sw">${mode === 'in' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}</button></div></div>`, {
    sw: () => login(mode === 'in' ? 'up' : 'in'),
    async code(_, btn) { // el bot de Discord le manda el código por DM
      const d = root.querySelector('[name=discord]').value;
      if (!d.trim()) throw new Error('Primero escribe tu usuario de Discord');
      btn.disabled = true;
      try { const r = await fetch('/api/discord-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ discord: d }) }).then(r => r.json()).catch(() => ({ error: 'No se pudo conectar con el bot. Intenta en un momento.' }));
        if (r.error) throw new Error(r.error);
        toast('Te mandamos el código por mensaje directo en Discord 📨'); root.querySelector('[name=dcode]').focus();
        let s = 60; const t = setInterval(() => { btn.textContent = --s > 0 ? `Reenviar en ${s}s` : '📨 Reenviar código'; if (s <= 0) { clearInterval(t); btn.disabled = false; } }, 1000);
      } catch (e) { btn.disabled = false; throw e; }
    },
    async go(d) {
      const u = d.u.toLowerCase(), keep = () => localStorage.setItem('rp_login', JSON.stringify({ u, p: d.p })); // solo en este dispositivo, para verla en Ajustes
      if (mode === 'in') { await db.signIn(u, d.p); keep(); return boot(); }
      d.discord = d.discord.trim().replace(/^@/, '').toLowerCase();
      const taken = await db.rpc('signup_check', { u, d: d.discord }); if (taken) throw new Error(taken);
      if (!db.DEMO && !await db.rpc('discord_code_verify', { d: d.discord, code: d.dcode })) throw new Error('Código incorrecto. Revisa el DM del bot e inténtalo otra vez.');
      await db.signUp(u, d.p); keep(); toast('¡Cuenta creada! Bienvenido a Los Ángeles ✅');
      d.avatar = await db.upload(d.avatar);
      await db.insert('profiles', { id: db.uid(), username: u, roblox: d.roblox, discord: d.discord, avatar_url: d.avatar, avatar_full: d.avatar });
      boot();
    },
  });
  clocks();
}

const wait = (ico, msg) => {
  view(root, `<div class="lock" style="--wall:${wallCss(WALLPAPERS[3])}">${bigClock()}<div class="lock-c"><div class="seal">${ico}</div><p>${msg}</p>
    <button class="btn" data-act="sup">🆘 Abrir soporte</button> <button class="link" data-act="out">Cerrar sesión</button></div><div id="wins"></div></div>`, {
    sup: () => openApp('soporte'), out: async () => { await db.signOut(); location.reload(); } });
  clocks();
};

// ---------- ventanas / apps ----------
let z = 10;
const focusWin = w => { w.style.zIndex = ++z; const n = root.querySelector('.appname'); if (n) n.textContent = w.querySelector('.title')?.textContent.trim() || 'Finder'; };
const dockState = () => {
  const open = [...document.querySelectorAll('#wins .win')].map(w => w.dataset.app);
  document.querySelectorAll('.dock [data-id]').forEach(b => b.classList.toggle('running', open.includes(b.dataset.id)));
  const extra = root.querySelector('.dock .extra'); if (!extra) return;
  extra.innerHTML = open.filter(id => !FAVS.includes(id)).map(id => APPS.find(a => a.id === id)).filter(Boolean).map(a => dockIcon(a, 'running')).join('');
};
function closeWin(w) { w.classList.add('closing'); setTimeout(() => { w.remove(); dockState(); }, 260); }

// ventana genérica: apps y páginas (las páginas con url muestran barra de navegador)
export function openWindow({ key, title, iconHTML, bg, url, render }, from) {
  const wins = document.getElementById('wins');
  root.querySelector('#os')?.classList.remove('lp');
  let w = wins.querySelector(`[data-app="${CSS.escape(key)}"]`);
  if (w) { w.classList.remove('min'); focusWin(w); return; }
  w = document.createElement('section');
  w.className = 'win opening' + (url ? ' web' : ''); w.dataset.app = key;
  const n = wins.children.length;
  w.style.left = `calc(50% - 400px + ${n * 30}px)`; w.style.top = `${60 + n * 30}px`;
  if (from) { const r = from.getBoundingClientRect(); w.style.transformOrigin = `${r.left + r.width / 2 - (mobile() ? 0 : innerWidth / 2 - 400 + n * 30)}px ${r.top + r.height / 2 - (mobile() ? 0 : 60 + n * 30)}px`; }
  w.innerHTML = `<div class="win-h"><div class="lights"><button class="l-close" aria-label="Cerrar"></button><button class="l-min" aria-label="Minimizar"></button><button class="l-max" aria-label="Maximizar"></button></div>
    <button class="back" aria-label="Volver">‹ ${url ? 'Atrás' : 'Inicio'}</button><b class="title"><span class="ic xs" style="background:linear-gradient(135deg,${bg})">${iconHTML}</span>${esc(title)}</b>
    <button class="re" aria-label="Recargar" title="Recargar">${ico('refresh', 'i sm')}</button></div>
    ${url ? `<div class="urlbar"><button class="nb" data-nav="back" aria-label="Atrás">‹</button><button class="nb" data-nav="fwd" aria-label="Adelante">›</button>
      <form class="addr">${ico('lock', 'i sm')}<input value="${esc(url)}" aria-label="Dirección" spellcheck="false"></form></div>` : ''}<div class="win-b"></div><button class="home-ind" aria-label="Ir al inicio"></button>`;
  wins.append(w); focusWin(w);
  setTimeout(() => w.classList.remove('opening'), 420);
  const body = w.querySelector('.win-b');
  let run = () => render(body).catch(e => { body.innerHTML = `<p class="empty">Error: ${esc(e.message)}</p>`; });
  if (url) { // ventana de navegador: dirección, atrás/adelante y enlaces
    let cur = null; const hist = [], fut = [], bar = w.querySelector('.addr input');
    const go = async (u, push = true) => {
      u = String(u).trim().replace(/^https?:\/\//, '').replace(/^www\./, ''); if (!u) return;
      if (!/^[^\s/?]+\.[a-z]{2,}(\/|\?|$)/i.test(u)) u = 'google.rp/search?q=' + encodeURIComponent(u);
      if (push && cur && cur !== u) { hist.push(cur); fut.length = 0; }
      cur = u; bar.value = u; delete w.dataset.dirty;
      const [path, qs] = u.split('?'), host = path.split('/')[0].toLowerCase(), params = { ...Object.fromEntries(new URLSearchParams(qs || '')), nav: go };
      body.innerHTML = '<div class="spinner"></div>'; body.scrollTop = 0;
      try {
        if (u === url && render) return await render(body, params);
        const site = await resolveSite(host);
        if (site) await site(body, params);
        else body.innerHTML = `<div class="nf"><h2>Safari no puede abrir la página</h2><p>No se encontró el servidor "${esc(host)}".</p><a class="link" data-href="google.rp/search?q=${encodeURIComponent(host)}">Buscar "${esc(host)}" en Google</a></div>`;
      } catch (e) { body.innerHTML = `<p class="empty">Error: ${esc(e.message)}</p>`; }
    };
    w.querySelector('.addr').onsubmit = e => { e.preventDefault(); bar.blur(); go(bar.value); };
    w.querySelector('[data-nav=back]').onclick = () => hist.length && (fut.push(cur), go(hist.pop(), false));
    w.querySelector('[data-nav=fwd]').onclick = () => fut.length && (hist.push(cur), go(fut.pop(), false));
    body.addEventListener('click', e => { const a = e.target.closest('[data-href]'); if (a) { e.preventDefault(); go(a.dataset.href); } });
    run = () => go(cur || url, !cur);
  }
  w._run = () => { delete w.dataset.dirty; return run(); };
  w.addEventListener('input', () => { w.dataset.dirty = 1; });
  w.querySelector('.re').onclick = w._run;
  w.querySelector('.l-close').onclick = w.querySelector('.back').onclick = w.querySelector('.home-ind').onclick = () => closeWin(w);
  w.querySelector('.l-min').onclick = () => w.classList.add('min');
  w.querySelector('.l-max').onclick = () => toggleFull(w);
  w.addEventListener('pointerdown', () => focusWin(w));
  const h = w.querySelector('.win-h');
  h.ondblclick = e => { if (!e.target.closest('button')) w.classList.toggle('max'); };
  h.addEventListener('pointerdown', e => {
    if (mobile() || e.button || e.target.closest('button') || w.classList.contains('max')) return;
    e.preventDefault(); h.setPointerCapture(e.pointerId); w.classList.add('dragging');
    const sx = e.clientX - w.offsetLeft, sy = e.clientY - w.offsetTop; let raf;
    const mv = ev => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => {
      w.style.left = Math.min(innerWidth - 120, Math.max(120 - w.offsetWidth, ev.clientX - sx)) + 'px';
      w.style.top = Math.min(innerHeight - 60, Math.max(28, ev.clientY - sy)) + 'px'; }); };
    h.addEventListener('pointermove', mv);
    h.addEventListener('pointerup', () => { h.removeEventListener('pointermove', mv); w.classList.remove('dragging'); }, { once: true });
  });
  body.innerHTML = '<div class="spinner"></div>';
  run(); dockState();
}
export function openApp(id, from) {
  const app = APPS.find(a => a.id === id);
  openWindow({ key: id, title: app.name, iconHTML: glyph(app), bg: app.bg, url: app.url, render: app.url ? null : el => app.render(el) }, from);
}
// pantalla completa real: la ventana tapa todo y el navegador entra en pantalla completa
function toggleFull(w) {
  const on = !w.classList.contains('full');
  document.querySelectorAll('#wins .win.full').forEach(x => x.classList.remove('full'));
  w.classList.toggle('full', on); focusWin(w);
  if (on && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  if (!on && document.fullscreenElement) document.exitFullscreen?.();
}
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) document.querySelectorAll('#wins .win.full').forEach(x => x.classList.remove('full')); });
// enlaces a sitios desde cualquier app: se abren en Safari
document.addEventListener('click', e => { const a = !e.defaultPrevented && e.target.closest('[data-href]'); if (a && !a.closest('.win.web')) { e.preventDefault(); openSite(a.dataset.href); } });
export const openSite = u => openWindow({ key: 'safari-' + Date.now(), title: 'Safari', iconHTML: ico('safari', 'gi'), bg: '#1e90ff,#0a5bd8', url: u });
window.openSite = openSite;
window.openWindow = openWindow;
window.openApp = openApp;

const icon = a => `<button class="app" data-act="open" data-id="${a.id}"><span class="ic" style="background:linear-gradient(135deg,${a.bg})">${glyph(a)}<i class="bdg" data-b="${a.id}" hidden></i></span><span class="nm">${esc(a.name)}</span></button>`;
const dockIcon = (a, cls = '') => `<button class="app ${cls}" data-act="open" data-id="${a.id}" title="${esc(a.name)}"><span class="ic" style="background:linear-gradient(135deg,${a.bg})">${glyph(a)}</span><span class="tip">${esc(a.name)}</span></button>`;

async function shell() {
  const apps = APPS.filter(a => a.show()), favs = FAVS.map(id => apps.find(a => a.id === id)).filter(Boolean);
  const wall = wallCss(S.me.wallpaper), c = S.char;
  view(root, `<div id="os" style="--wall:${wall}">
    <header class="menubar"><button class="mb logo" data-menu="logo" aria-label="Menú"><img src="img/favicon.png" alt=""></button><button class="mb appname" data-menu="app">Finder</button>
      <span class="menus"><button class="mb" data-menu="archivo">Archivo</button><button class="mb" data-menu="ver">Ver</button><button class="mb" data-menu="ventana">Ventana</button><button class="mb" data-menu="ayuda">Ayuda</button></span>
      <b class="sb-time" data-clock="t"></b><span class="island"></span><span class="grow"></span>${demoTag}
      ${S.jobs.some(j => j.character_id === S.char?.id && j.status === 'active') ? `<button class="duty jobclock" data-act="job">…</button>` : ''}
      ${lvl() ? `<button class="duty" data-act="duty">…</button>` : ''}<span class="cash"></span><button class="mb sp" data-act="spot" aria-label="Buscar">${ico('buscar', 'i sm')}</button>
      <span class="sb-icons" aria-hidden="true"><i class="sig"><b></b><b></b><b></b><b></b></i><i class="wifi">◠</i><i class="batt"><b></b></i></span>
      <button class="who" data-act="open" data-id="vida">${c ? `<img src="${esc(c.skin_url)}" alt="">` : ico('user', 'i sm')}<span>${c ? esc(cname(c.id)) : 'Sin vida activa'}</span></button>
      <span class="mclock" data-clock="m"></span></header>
    <main class="home">
      <section class="widgets">
        <button class="wdg w-clock" data-act="open" data-id="news"><b data-clock="t"></b><span data-clock="d"></span><small>Los Ángeles, CA · Soleado 24°</small></button>
        <button class="wdg w-bank" data-act="open" data-id="banco"><small>RRVA</small><b class="wb-bal">—</b><span>Cuenta personal</span></button>
        <button class="wdg w-life" data-act="open" data-id="vida">${c ? `<img src="${esc(c.skin_url)}" alt=""><div><b>${esc(cname(c.id))}</b><span>${c.status === 'active' ? 'Ciudadano activo' : 'En aprobación'}</span>
          <small>${(c.roles || []).slice(0, 3).map(esc).join(' · ')}</small></div>` : '<div><b>Sin vida activa</b><span>Tu vida está en aprobación o crea una nueva</span></div>'}</button>
      </section>
      <section class="desk">${apps.filter(a => ['documentos', 'licencias'].includes(a.id)).map(a => `<button class="dfold" data-act="open" data-id="${a.id}"><span class="ic" style="background:linear-gradient(135deg,${a.bg})">${glyph(a)}</span><span>${esc(a.name)}</span></button>`).join('')}</section>
      <div class="grid">${apps.map(icon).join('')}</div>
    </main>
    <nav class="dock">${favs.map(a => dockIcon(a)).join('')}<span class="extra"></span><span class="sep"></span>
      <button class="app lp-btn" data-act="lp" title="Todas las apps"><span class="ic" style="background:linear-gradient(135deg,#e0e0e0,#9e9e9e)">${ico('grid', 'gi')}</span><span class="tip">Todas las apps</span></button></nav>
    <div id="wins"></div></div>`, {
    open: (d, t) => openApp(d.id, t),
    spot: spotlight,
    async job() { const j = S.jobs.find(x => x.character_id === S.char.id && x.status === 'active'); const r = await db.rpc('clock', { c: S.char.id, d: j.dept }); toast(r === 'in' ? `Turno iniciado · ${j.dept}` : 'Turno terminado'); jobLoop(); },
    lp: () => root.querySelector('#os').classList.toggle('lp'),
    async duty() {
      const open = (await db.list('shifts', { eq: { user_id: S.me.id, ended_at: null } }))[0];
      if (open) { await db.update('shifts', open.id, { ended_at: new Date().toISOString() }); toast('Saliste de servicio'); }
      else { await db.insert('shifts', { user_id: S.me.id, started_at: new Date().toISOString() }); toast('Entraste en servicio 🟢'); }
      dutyLoop();
    },
  });
  root.querySelector('.home').addEventListener('click', e => { if (e.target.classList.contains('home')) root.querySelector('#os').classList.remove('lp'); });
  addEventListener('keydown', e => { if (e.key === 'Escape') root.querySelector('#os')?.classList.remove('lp'); });
  clocks();
  myAccounts().then(a => { const p = a.find(x => x.kind === 'personal'); if (p) { root.querySelector('.cash').textContent = money(p.balance); root.querySelector('.wb-bal').textContent = money(p.balance); } });
  for (const a of apps.filter(a => a.badge)) a.badge().then(n => { const b = root.querySelector(`[data-b="${a.id}"]`); if (b && n) { b.hidden = false; b.textContent = n; } });
  dutyLoop(); jobLoop();
}

let jobTimer;
async function jobLoop() {
  const b = root.querySelector('.duty.jobclock'); if (!b) return;
  clearInterval(jobTimer);
  const j = S.jobs.find(x => x.character_id === S.char.id && x.status === 'active');
  const open = (await db.list('work_shifts', { eq: { character_id: S.char.id, ended_at: null } }))[0];
  const paint = () => { if (!open) { b.textContent = `Iniciar turno · ${j.dept}`; b.classList.remove('on'); return; }
    const s = Math.floor((Date.now() - new Date(open.started_at)) / 1000);
    b.textContent = `En turno ${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; b.classList.add('on'); };
  paint(); if (open) jobTimer = setInterval(paint, 1000);
}
window.refreshDuty = () => { dutyLoop(); jobLoop(); };

// ---------- menús de la barra superior (como macOS) ----------
const topWin = () => [...document.querySelectorAll('#wins .win:not(.min)')].sort((a, b) => b.style.zIndex - a.style.zIndex)[0];
const RULES_CK = ['Motivo sólido y coherente', 'Aprobación del staff antes de ejecutarlo', 'Prohibido por conflictos personales (OOC)', 'Rol detallado y bien ejecutado',
  'Nada de Deathmatching', 'Aceptar las consecuencias permanentes', 'No interrumpir roles de terceros', 'Prohibido en zonas seguras (hospitales, comisarías)',
  'Explicar las razones al afectado (OOC)', 'No abusar del CK (se puede anular con pruebas de antirol o reanimación con desfibrilador)', 'No abusar del "rol previo"'];
const MENUS = () => ({
  logo: [['Acerca de Los Angeles Roleplay', () => modal('Los Angeles Roleplay', `<div class="about"><img src="img/logo.png" alt=""><p>Portal oficial del servidor de roleplay.</p><small class="muted">${db.DEMO ? 'Modo demo' : 'Conectado'} · ${esc(S.me.username)}</small></div>`)],
    '-', ['Ajustes…', () => openApp('ajustes')], ['App Store…', () => openApp('robstore')], '-', ['Cerrar sesión', async () => { await db.signOut(); location.reload(); }]],
  app: [['Cerrar ventana', () => topWin() && closeWin(topWin())], ['Recargar', () => topWin()?.querySelector('.re').click()]],
  archivo: [['Nueva vida…', () => import('./vida.js').then(m => m.openWizardOverlay())], ['Nuevo trámite…', () => openApp('gobierno')], ['Buscar… (Ctrl+K)', spotlight], '-', ['Cerrar ventana (Ctrl+W)', () => topWin() && closeWin(topWin())]],
  ver: [['Todas las apps', () => root.querySelector('#os').classList.toggle('lp')], ['Pantalla completa', () => topWin() && toggleFull(topWin())], ['Ajustar a la ventana', () => topWin()?.classList.toggle('max')], ['Recargar ventana', () => topWin()?.querySelector('.re').click()]],
  ventana: [['Minimizar', () => topWin()?.classList.add('min')], ['Cerrar todas', () => document.querySelectorAll('#wins .win').forEach(closeWin)], '-',
    ...[...document.querySelectorAll('#wins .win')].map(w => [w.querySelector('.title').textContent.trim(), () => { w.classList.remove('min'); focusWin(w); }])],
  ayuda: [['Soporte', () => openApp('soporte')], ['Reglas de CK', () => modal('Reglas de CK', `<ol class="rules">${RULES_CK.map(r => `<li>${r}</li>`).join('')}</ol>`)],
    ['Atajos de teclado', () => modal('Atajos de teclado', `<dl class="rcpt"><dt>Ctrl+K</dt><dd>Buscar</dd><dt>Ctrl+W</dt><dd>Cerrar ventana</dd><dt>Ctrl+M</dt><dd>Minimizar</dd><dt>Esc</dt><dd>Cerrar menús</dd></dl>`)]],
});
function closeMenus() { document.querySelectorAll('.menu').forEach(m => m.remove()); document.querySelectorAll('.mb.open').forEach(b => b.classList.remove('open')); }
document.addEventListener('click', e => {
  const b = e.target.closest('[data-menu]');
  if (!b) { if (!e.target.closest('.menu')) closeMenus(); return; }
  const was = b.classList.contains('open'); closeMenus(); if (was) return;
  const r = b.getBoundingClientRect(), items = MENUS()[b.dataset.menu] || [];
  const m = Object.assign(document.createElement('div'), { className: 'menu' });
  m.style.left = Math.min(r.left, innerWidth - 260) + 'px';
  m.innerHTML = items.map((it, i) => it === '-' ? '<hr>' : `<button data-i="${i}">${esc(it[0])}</button>`).join('');
  m.onclick = ev => { const i = ev.target.closest('[data-i]')?.dataset.i; if (i == null) return; closeMenus(); items[i][1](); };
  document.body.append(m); b.classList.add('open');
});
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if (mod && k === 'k') { e.preventDefault(); spotlight(); }
  else if (mod && k === 'w' && topWin()) { e.preventDefault(); closeWin(topWin()); }
  else if (mod && k === 'm' && topWin()) { e.preventDefault(); topWin().classList.add('min'); }
  else if (k === 'escape') { closeMenus(); document.querySelector('.spot')?.remove(); }
});

// ---------- buscador (Spotlight) ----------
function spotlight() {
  if (document.querySelector('.spot') || !S.me) return;
  const o = Object.assign(document.createElement('div'), { className: 'spot' });
  o.innerHTML = `<div class="spot-c"><div class="spot-in">${ico('buscar', 'i')}<input placeholder="Buscar apps, trámites y personas" autofocus></div><div class="spot-r"></div></div>`;
  document.body.append(o);
  const inp = o.querySelector('input'), res = o.querySelector('.spot-r');
  const items = [...APPS.filter(a => a.show()).map(a => ({ t: a.name, s: 'App', i: glyph(a), bg: a.bg, go: () => openApp(a.id) })),
    ...Object.entries(TRAMITES).filter(([, t]) => !t.hidden).map(([k, t]) => ({ t: t.name, s: 'Trámite · ' + t.cat, i: ico(k, 'gi'), bg: '#1d3b6e,#2f5aa8', go: () => import('./portal.js').then(m => m.openTramite(k)) })),
    ...S.all.filter(c => c.status === 'active').map(c => ({ t: `${c.first_name} ${c.last_name}`, s: 'Persona · ' + (c.roles || []).slice(0, 2).join(', '), img: c.skin_url, go: () => openApp('buscar') }))];
  let hits = [];
  const draw = () => { const q = inp.value.trim().toLowerCase();
    hits = (q ? items.filter(x => x.t.toLowerCase().includes(q)) : items.slice(0, 8)).slice(0, 9);
    res.innerHTML = hits.map((x, i) => `<button data-i="${i}" class="${i ? '' : 'sel'}">${x.img ? `<img src="${esc(x.img)}" alt="">` : `<span class="ic xs" style="background:linear-gradient(135deg,${x.bg})">${x.i}</span>`}<b>${esc(x.t)}</b><small>${esc(x.s)}</small></button>`).join('') || '<p class="muted">Sin resultados</p>'; };
  const pick = i => { o.remove(); hits[i]?.go(); };
  inp.oninput = draw; inp.onkeydown = e => { if (e.key === 'Enter') pick(0); };
  res.onclick = e => { const b = e.target.closest('[data-i]'); if (b) pick(+b.dataset.i); };
  o.onclick = e => { if (e.target === o) o.remove(); };
  draw(); inp.focus();
}

let dutyTimer;
async function dutyLoop() {
  const b = root.querySelector('.duty:not(.jobclock)'); if (!b) return;
  clearInterval(dutyTimer);
  const open = (await db.list('shifts', { eq: { user_id: S.me.id, ended_at: null } }))[0];
  const paint = () => {
    if (!open) { b.textContent = `⚫ ${STAFF_NAME[S.me.staff_role]}`; b.title = 'Fuera de servicio · toca para entrar'; b.classList.remove('on'); return; }
    const s = Math.floor((Date.now() - new Date(open.started_at)) / 1000);
    b.textContent = `🟢 ${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    b.title = 'En servicio · toca para salir'; b.classList.add('on');
  };
  paint(); if (open) dutyTimer = setInterval(paint, 1000);
}

const loading = msg => { root.innerHTML = `<div class="boot-load"><img src="img/logo.png" alt=""><div class="spinner"></div><p>${msg}</p></div>`; };
async function boot() {
  if (!db.uid()) return login();
  loading('Entrando a Los Ángeles…');
  await loadMe();
  if (!S.me) { await db.signOut(); return login(); }
  if ((db.DEMO || lvl() >= 5) && !S.ranks.length) { loading('Preparando la ciudad por primera vez…<br><small>Cargando autos, casas, trabajos y leyes. Tarda unos segundos.</small>'); await seed(); await loadMe(); }
  db.rpc('daily_tick', {}).catch(() => {}); // cierre del día (nómina, despidos, intereses); solo corre una vez al día
  if (S.me.banned) return wait('🔨', 'Tu cuenta está baneada. Puedes apelar desde soporte.');
  if (!S.chars.length) return lifeWizard(root, { onDone: boot }); // lo primero: crear tu vida
  if (!S.me.verified) return wait('⏳', `Hola <b>${esc(S.me.username)}</b>. Tu vida ya quedó registrada. Un admin está verificando tu Roblox <b>${esc(S.me.roblox)}</b> y tu Discord <b>${esc(S.me.discord)}</b>.`);
  shell(); checkMessages(true).catch(() => {});
}
window.refreshShell = async reopen => { await loadMe(); await shell(); if (reopen) openApp(reopen); };
// ---------- tiempo real ----------
let rtTimer;
// avisa de mensajes nuevos (WhatsApp o Instagram) que llegaron desde la última revisión
async function checkMessages(first) {
  const ids = S.chars.filter(c => c.status === 'active').map(c => c.id); if (!ids.length) return;
  const key = 'rp_lastmsg_' + S.me.id, last = localStorage.getItem(key) || '';
  const inbox = (await Promise.all(ids.map(id => db.list('messages', { eq: { to_char: id }, limit: 20 })))).flat().filter(m => m.created_at > last).sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (inbox.length) localStorage.setItem(key, inbox.at(-1).created_at);
  if (first && !last) return; // la primera vez solo marca dónde vamos
  inbox.slice(-3).forEach(m => notify({ icon: `<img class="av sm" src="${esc(S.all.find(c => c.id === m.from_char)?.skin_url || '')}" alt="">`, title: (m.via === 'insta' ? 'Instagram · ' : 'Mensajes · ') + cname(m.from_char), body: m.body,
    onclick: () => openApp(m.via === 'insta' ? 'insta' : 'mensajes') }));
}
const liveRefresh = async () => {
  if (!S.me || !root.querySelector('#os')) return;
  await loadMe();
  checkMessages().catch(() => {});
  myAccounts().then(a => { const p = a.find(x => x.kind === 'personal'); if (p) root.querySelectorAll('.cash,.wb-bal').forEach(x => x.textContent = money(p.balance)); });
  for (const a of APPS.filter(a => a.show() && a.badge)) a.badge().then(n => { const b = root.querySelector(`[data-b="${a.id}"]`); if (b) { b.hidden = !n; b.textContent = n; } });
  // vuelve a pintar las ventanas abiertas, salvo donde el usuario está escribiendo
  document.querySelectorAll('#wins .win').forEach(w => { if (!w.dataset.dirty && !w.contains(document.activeElement) && !document.querySelector('.modal')) { const b = w.querySelector('.win-b'), y = b?.scrollTop; Promise.resolve(w._run?.()).then(() => { if (b) b.scrollTop = y; }); } });
};
window.liveRefresh = liveRefresh; // para cambios propios (el modo demo no recibe sus propios eventos)
db.onChange(() => { clearTimeout(rtTimer); rtTimer = setTimeout(liveRefresh, 700); });
boot().catch(e => { root.innerHTML = `<p class="empty">Error al cargar: ${esc(e.message)}</p>`; console.error(e); });
