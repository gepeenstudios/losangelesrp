// Todas las apps del sistema. Cada una: { id, name, icon, bg, show(), render(el) }
import * as db from './db.js';
import { sharePrice } from './db.js';
import { S, cpi, esc, money, fdate, lvl, has, isPolice, set, cname, charOpts, toast, modal, view, form, fieldsHTML, readForm,
  myRequests, approvedOf, requestHTML, reviewQueue, tabs, needChar, myAccounts, accSelect, stars, addRole } from './core.js';
import { openWizardOverlay } from './vida.js';
import { openTramite } from './portal.js';
import { ico } from './icons.js';
import { birthCert, idCard, passport, diploma, docNumber } from './docs.js';
import { TRAMITES, ROLES, STAFF, STAFF_NAME, LVL, CITIES, WALLPAPERS, DEFAULT_SETTINGS, SEED_MODELS, SEED_PROPS, SEED_JOBS, CAR_PHOTOS, DEPTS, PENAL_CODE } from './data.js';

const ST = { cumplida: 'Cumplida', liberado: 'Liberado', fugado: 'Fugado', en_prision: 'En prisión', pending: 'Pendiente', active: 'Activo', dead: 'CK', rejected: 'Rechazado', approved: 'Aprobado', abierto: 'Abierto', tomado: 'En atención', cerrado: 'Cerrado', vacation: 'Vacaciones' };
const badge = s => `<span class="st st-${s}">${ST[s] || s}</span>`;
const av = (url, cls = 'av') => `<img class="${cls}" src="${esc(url || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E')}" alt="">`;
const skin = id => S.all.find(c => c.id === id)?.skin_url;
const zoom = d => modal('Imagen', `<img class="full" src="${esc(d.src)}" alt="">`);
const personalAcc = async () => (await myAccounts()).find(a => a.kind === 'personal');
const rerender = (el, app) => app.render(el);

// ============ MI VIDA (personajes / second role) ============
const vida = { id: 'vida', name: 'Mi Vida', icon: '🧬', bg: '#7b2ff7,#f107a3', show: () => true,
  async render(el) {
    const alive = S.chars.filter(c => c.status !== 'dead'), dead = S.chars.filter(c => c.status === 'dead');
    const appeals = dead.length ? await db.list('requests', { eq: { type: 'apelacion_ck' }, overlaps: { dept: ['staff:admin'] } }).catch(() => []) : [];
    const autos = dead.length ? (await myRequests().catch(() => [])).concat(...await Promise.all(dead.map(c => db.list('requests', { eq: { character_id: c.id, type: 'autock' } })))) : [];
    const card = c => `<div class="card char ${S.char?.id === c.id ? 'sel' : ''}">${av(c.skin_url)}<div class="grow">
        <b>${esc(c.first_name)} ${esc(c.last_name)}</b><div class="muted">${esc(c.city || '')} · ${esc(c.nationality || '')} · nac. ${esc(c.dob || '')}</div>
        <div>${badge(c.status)} ${(c.roles || []).map(r => `<span class="tag">${esc(r)}</span>`).join('')}</div></div>`;
    view(el, `<div class="row"><h3 class="grow">Mis vidas</h3><button class="btn" data-act="nuevo">+ Nueva vida</button></div>
      <p class="muted">Cada vida (second role) es una persona distinta en la ciudad, aunque uses el mismo Roblox. Un admin debe aprobarla.</p>
      ${alive.map(c => card(c) + (c.status === 'active' && S.char?.id !== c.id ? `<button class="btn sm" data-act="usar" data-id="${c.id}">Usar esta vida</button>` : S.char?.id === c.id ? '<span class="tag on">En uso</span>' : '')
        + (c.status === 'active' ? `<button class="btn sm ghost" data-act="autock" data-id="${c.id}">Auto-CK</button>` : '') + '</div>').join('')
        || '<p class="empty">No tienes vidas activas. Crea una nueva.</p>'}
      ${dead.length ? `<h3>Vidas perdidas (CK)</h3><p class="muted">Esta vida ya no se puede usar. Sus datos, dinero y bienes quedan guardados por si ganas una apelación.</p>
        ${dead.map(c => card(c) + (autos.some(r => r.character_id === c.id && r.type === 'autock') ? '<span class="tag">Auto-CK</span>' : appeals.some(r => r.character_id === c.id && r.status === 'pending') ? badge('pending') : `<button class="btn sm" data-act="apelar" data-id="${c.id}">Apelar CK</button>`) + (lvl() >= 3 ? `<button class="btn sm bad" data-act="borrar" data-id="${c.id}">Borrar</button>` : '') + '</div>').join('')}` : ''}`, {
      borrar: async d => { if (!confirm('¿Borrar esta vida para siempre? Ya no se podrá apelar.')) return;
        try { await db.rpc('delete_char', { c: d.id }); } catch (e) { return toast(e.message); } toast('Vida borrada'); await window.liveRefresh?.(); vida.render(el); },
      nuevo: openWizardOverlay,
      usar: d => { localStorage.setItem('rp_char', d.id); window.refreshShell?.('vida'); },
      apelar: d => openTramite('apelacion_ck', { charId: d.id }, () => this.render(el)),
      autock: d => { const c = S.chars.find(x => x.id === d.id);
        modal('Auto-CK · ' + esc(c.first_name + ' ' + c.last_name), `<p>Tu personaje muere de forma permanente dentro del juego. No necesitas pruebas ni aprobación del staff, y no se puede apelar.</p>
          <form data-form="go" class="form">${fieldsHTML([{ k: 'motivo', label: 'Motivo (opcional)', type: 'textarea' }, { k: 'lugar', label: 'Lugar (opcional)' }, { k: 'foto', label: 'Foto del cuerpo (opcional)', type: 'file' },
            { k: 'publicar', label: 'Registrar en CK', type: 'check', text: 'Publicar el obituario en LA Times' }, { k: 'conf', label: 'Confirmo', type: 'check', text: 'Entiendo que es permanente', req: 1 }])}
          <button class="btn bad" type="submit">Hacer Auto-CK</button></form>`, {
          async go(f, _, close) { await db.rpc('auto_ck', { c: c.id, motivo: f.motivo || '', lugar: f.lugar || '', foto: f.foto || '', publicar: !!f.publicar });
            close(); toast(f.publicar ? 'Auto-CK registrado y publicado en LA Times' : 'Auto-CK registrado'); window.refreshShell?.('vida'); } }); },
    });
  } };

// ============ RRVA (banco) ============
const last4 = n => '****' + String(n).slice(-4);
const accLabel = a => a.kind === 'personal' ? 'Cuenta personal' : a.kind === 'savings' ? 'Cuenta de ahorro' : 'Cuenta empresarial · ' + a.name;
const banco = { id: 'banco', name: 'RRVA', icon: '🏦', bg: '#004481,#1464a5', show: () => true,
  async render(el, st = { tab: 'mov' }) {
    if (!needChar(el)) return;
    const accs = await myAccounts(), cur = accs.find(a => a.id === st.acc) || accs[0];
    if (!cur) { el.innerHTML = '<p class="empty">Tu cuenta RRVA se abre cuando un admin aprueba tu vida.</p>'; return; }
    const go = p => banco.render(el, { ...st, acc: cur.id, ...p });
    const FK = 'rrva_favs_' + S.char.id, favs = JSON.parse(localStorage.getItem(FK) || '[]');
    let body = '';
    if (st.tab === 'mov') {
      const tx = [...await db.list('transactions', { eq: { from_acc: cur.id } }), ...await db.list('transactions', { eq: { to_acc: cur.id } })]
        .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 80);
      body = tx.length ? `<ul class="list mov">${tx.map(t => { const out = t.from_acc === cur.id; return `<li><span class="mv-ico ${out ? 'out' : 'in'}">${out ? '↗' : '↙'}</span><div class="grow"><b>${esc(t.concept)}</b><div class="muted">${fdate(t.created_at)}</div></div>
        <b class="${out ? 'neg' : 'pos'}">${out ? '−' : '+'}${money(t.amount)}</b></li>`; }).join('')}</ul>` : '<p class="empty">Sin movimientos todavía.</p>';
    } else if (st.tab === 'send') {
      const tx = st.tx || {}, step = st.step || 'dest';
      if (step === 'dest') body = `<div class="tx"><h3>Nueva transferencia</h3><p class="muted">Desde ${esc(accLabel(cur))} ${last4(cur.number)}</p>
        <form data-form="dest" class="form">${fieldsHTML([{ k: 'number', label: 'Número de cuenta RRVA del beneficiario', req: 1, pattern: '[0-9]{10}', ph: '10 dígitos', help: 'Pídele a la persona su número de cuenta (lo ve en su app RRVA).' }])}
        <button class="btn big" type="submit">Continuar</button></form></div>
        ${favs.length ? `<h4 class="sub-h">Cuentas frecuentes</h4><ul class="list">${favs.map(f => `<li class="fav" data-act="fav" data-n="${f.number}"><span class="ini">${esc((f.alias || f.name).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase())}</span>
          <div class="grow"><b>${esc(f.alias || f.name)}</b><div class="muted">RRVA ${last4(f.number)}</div></div><span class="muted">›</span></li>`).join('')}</ul>` : ''}`;
      if (step === 'amount') body = `<div class="tx"><div class="benef"><span class="ini">${esc(tx.holder.split(' ').map(w => w[0]).join('').slice(0, 2))}</span><div><b>${esc(tx.holder)}</b><small>Banco RRVA · ${last4(tx.number)}</small></div></div>
        <form data-form="amount" class="form"><label class="amount"><span>$</span><input name="amount" type="number" min="1" step="0.01" max="${cur.balance}" required placeholder="0.00" autofocus></label>
        <small class="muted center">Saldo disponible ${money(cur.balance)}</small>
        ${fieldsHTML([{ k: 'concept', label: 'Concepto', req: 1, ph: 'Renta, pago, préstamo…' }, ...(favs.some(f => f.number === tx.number) ? [] : [{ k: 'save', label: 'Guardar', type: 'check', text: 'Guardar en cuentas frecuentes' }, { k: 'alias', label: 'Alias (opcional)' }])])}
        <div class="row"><button type="button" class="btn ghost" data-act="tab" data-t="send">Cancelar</button><button class="btn big grow" type="submit">Continuar</button></div></form></div>`;
      if (step === 'confirm') body = `<div class="tx"><h3>Confirma tu transferencia</h3><dl class="rcpt">
        <dt>Cuenta de origen</dt><dd>${esc(accLabel(cur))} ${last4(cur.number)}</dd><dt>Beneficiario</dt><dd>${esc(tx.holder)}</dd><dt>Cuenta destino</dt><dd>RRVA ${last4(tx.number)}</dd>
        <dt>Concepto</dt><dd>${esc(tx.concept)}</dd><dt>Comisión</dt><dd>$0.00</dd><dt class="big">Total</dt><dd class="big">${money(tx.amount)}</dd></dl>
        <div class="token"><small>RRVA Token</small><b>${tx.token.replace(/(\d{3})/, '$1 ')}</b><small>Válido por 60 s</small></div>
        <form data-form="confirm" class="form">${fieldsHTML([{ k: 'token', label: 'Escribe tu código de RRVA Token para autorizar', req: 1, pattern: '[0-9]{6}', ph: '000000' }])}
        <div class="row"><button type="button" class="btn ghost" data-act="tab" data-t="send">Cancelar</button><button class="btn big grow" type="submit">Autorizar transferencia</button></div></form></div>`;
      if (step === 'done') body = `<div class="rcpt-paper" id="rcpt"><div class="rp-h"><b>RRVA</b><span>Comprobante de transferencia</span></div><div class="ok-mark">✓</div>
        <h2>${money(tx.amount)}</h2><p class="muted center">Transferencia liquidada</p><dl class="rcpt">
        <dt>Folio</dt><dd>${tx.folio}</dd><dt>Fecha y hora</dt><dd>${fdate(tx.at)}</dd><dt>Ordenante</dt><dd>${esc(cname(S.char.id))}</dd><dt>Cuenta de origen</dt><dd>${last4(cur.number)}</dd>
        <dt>Beneficiario</dt><dd>${esc(tx.holder)}</dd><dt>Cuenta destino</dt><dd>${last4(tx.number)}</dd><dt>Concepto</dt><dd>${esc(tx.concept)}</dd><dt>Estado</dt><dd class="pos">Liquidada</dd></dl>
        <small class="muted">Banco RRVA · Los Ángeles RP · Operación sujeta a revisión del staff</small></div>
        <div class="row"><button class="btn ghost" data-act="copy">Copiar comprobante</button><button class="btn grow" data-act="tab" data-t="send">Nueva transferencia</button></div>`;
    } else if (st.tab === 'ahorro') {
      const sav = accs.find(a => a.kind === 'savings'), rate = Number(set('fed_rate'));
      body = `<div class="tx"><h3>Cuenta de ahorro RRVA</h3><p class="muted">Tu dinero gana ${rate}% anual (tasa de la Reserva Federal), pagado cada día. La inflación acumulada de la ciudad es ${((cpi() - 1) * 100).toFixed(2)}%.</p>
        ${sav ? `<dl class="rcpt"><dt>Saldo</dt><dd>${money(sav.balance)}</dd><dt>Número de cuenta</dt><dd>${sav.number}</dd><dt>Interés diario estimado</dt><dd class="pos">+${money(sav.balance * rate / 100 / 365)}</dd></dl>
          <p class="muted">Para ahorrar, transfiere desde tu cuenta personal al número ${sav.number}. Para retirar, elige "Ahorro" arriba y transfiere a tu cuenta personal.</p>`
        : `<button class="btn big" data-act="ahorro">Abrir cuenta de ahorro</button>`}</div>`;
    } else if (st.tab === 'multas') {
      const f = await db.list('records', { eq: { character_id: S.char.id, kind: 'multa' } });
      body = f.length ? `<ul class="list">${f.map(r => `<li><div><b>${esc(r.description)}</b><div class="muted">${fdate(r.created_at)}</div></div>
        <span>${money(r.amount)} ${r.paid ? '<span class="tag">Pagada</span>' : `<button class="btn sm" data-act="pagar" data-id="${r.id}">Pagar</button>`}</span></li>`).join('')}</ul>` : '<p class="empty">No tienes multas.</p>';
    } else if (st.tab === 'tarjeta') {
      body = `<div class="ccard"><div class="row"><b class="cc-bank">RRVA</b><small class="grow" style="text-align:right">${cur.kind === 'personal' ? 'Débito' : 'Business'}</small></div><div class="chip"></div>
        <div class="num">${cur.number.replace(/(\d{4})(?=\d)/g, '$1 ')} 00</div><div class="row"><span>${esc(cur.kind === 'personal' ? cname(S.char.id).toUpperCase() : cur.name.toUpperCase())}</span><b class="grow" style="text-align:right">VISA</b></div></div>
        <p class="muted">Las cuentas empresariales se crean al aprobarse tu empresa; puedes tener varios socios. Para invertir abre la app Bolsa.</p>`;
    }
    view(el, `<div class="bank-h"><div class="row"><small class="grow">${esc(accLabel(cur))}</small><button class="link light" data-act="copyacc">Cuenta ${cur.number} ⧉</button></div>
      <small>Saldo disponible</small><h2>${money(cur.balance)}</h2>
      ${accs.length > 1 ? `<div class="chips">${accs.map(a => `<button data-act="acc" data-id="${a.id}" class="${a.id === cur.id ? 'on' : ''}">${a.kind === 'personal' ? 'Personal' : a.kind === 'savings' ? 'Ahorro' : esc(a.name)}</button>`).join('')}</div>` : ''}</div>
      ${tabs([['mov', 'Movimientos'], ['send', 'Transferir'], ['ahorro', 'Ahorro e intereses'], ['multas', 'Multas'], ['tarjeta', 'Tarjeta']], st.tab)}${body}`, {
      async ahorro() { await db.rpc('open_savings', { c: S.char.id }); toast('Cuenta de ahorro abierta'); go({}); },
      tab: d => banco.render(el, { tab: d.t, acc: cur.id }),
      acc: d => banco.render(el, { tab: st.tab, acc: d.id }),
      copyacc: async () => { await navigator.clipboard?.writeText(cur.number); toast('Número de cuenta copiado'); },
      async dest(d) {
        if (d.number === cur.number) throw new Error('Es tu misma cuenta');
        const holder = await db.rpc('account_holder', { num: d.number });
        if (!holder) throw new Error('No existe ninguna cuenta RRVA con ese número');
        go({ step: 'amount', tx: { number: d.number, holder } });
      },
      async fav(d) { const holder = await db.rpc('account_holder', { num: d.n }); if (!holder) throw new Error('Esa cuenta ya no existe'); go({ step: 'amount', tx: { number: d.n, holder } }); },
      amount(d) {
        const tx = { ...st.tx, amount: d.amount, concept: d.concept, token: String(Math.floor(1e5 + Math.random() * 9e5)) };
        if (d.save) localStorage.setItem(FK, JSON.stringify([...favs, { number: tx.number, name: tx.holder, alias: d.alias || '' }]));
        go({ step: 'confirm', tx });
      },
      async confirm(d, f) {
        if (d.token !== st.tx.token) throw new Error('Código de RRVA Token incorrecto');
        f.querySelector('[type=submit]').textContent = 'Procesando…';
        await db.rpc('transfer', { from_acc: cur.id, dest: st.tx.number, amount: st.tx.amount, concept: st.tx.concept });
        const acc2 = (await myAccounts()).find(a => a.id === cur.id);
        document.querySelectorAll('.cash,.wb-bal').forEach(x => { if (acc2?.kind === 'personal') x.textContent = money(acc2.balance); });
        go({ step: 'done', tx: { ...st.tx, folio: 'RRVA' + Date.now().toString().slice(-10), at: new Date().toISOString() } });
      },
      copy: async () => { await navigator.clipboard?.writeText(el.querySelector('#rcpt').innerText); toast('Comprobante copiado'); },
      async pagar(d) { await db.rpc('pay_fine', { record: d.id, acc: cur.id }); toast('Multa pagada'); go({}); },
    });
  } };

// ============ GOBIERNO (trámites) ============
const gobierno = { id: 'gobierno', name: 'LA City', icon: '🏛️', bg: '#1d3b6e,#2f5aa8', url: 'lacity.rp', show: () => true,
  async render(el) {
    const reqs = await myRequests(), ch = S.char, pres = has('Presidente') || lvl() >= 4;
    const gov = (await db.list('accounts', { eq: { kind: 'gov' } }))[0];
    const visaOk = approvedOf(reqs, 'visa').length, days = ch ? Math.ceil(set('visa_days') - (Date.now() - new Date(ch.created_at)) / 864e5) : 0;
    const cats = {};
    Object.entries(TRAMITES).forEach(([k, t]) => { if (t.hidden || k === 'apelacion_ck' || (t.foreignOnly && !ch?.extranjero)) return; (cats[t.cat] ??= []).push([k, t]); });
    const last = k => reqs.find(r => r.type === k), hist = set('cpi_history') || [];
    const infl = ((cpi() - 1) * 100).toFixed(2);
    view(el, `<div class="portal"><div class="gov-top">Sitio oficial de la Ciudad de Los Ángeles · Roleplay</div>
      <header class="gov-bar"><img class="gov-logo" src="img/logo.png" alt=""><div><b>City of Los Angeles</b><span>Servicios en línea para residentes</span></div>
        <nav><a data-act="go" data-k="tramites">Trámites</a><a data-act="go" data-k="mis">Mis solicitudes</a><a data-act="go" data-k="finanzas">Finanzas</a></nav></header>
      <section class="gov-hero"><div><h1>${ch ? `Hola, ${esc(ch.first_name)}` : 'Bienvenido a Los Ángeles'}</h1><p>Realiza tus trámites de identidad, licencias, registros y negocios en línea.</p></div>
        <div class="hero-stats"><div><small>Tesorería de la ciudad</small><b>${money(gov?.balance)}</b></div><div><small>Inflación acumulada</small><b>${infl}%</b></div><div><small>Tasa de la Reserva Federal</small><b>${set('fed_rate')}%</b></div></div></section>
      <main class="gov-main">
      ${ch?.extranjero && !visaOk ? `<div class="notice"><b>Aviso migratorio.</b> ${days > 0 ? `Te quedan ${days} días para registrar tu visa.` : 'Tu plazo para registrar la visa venció; se te considera migrante.'}</div>` : ''}
      ${!ch ? '<div class="notice">Necesitas una vida aprobada para hacer trámites.</div>' : ''}
      <h2 id="tramites" class="sec-h">Trámites y servicios</h2>
      ${Object.entries(cats).map(([c, list]) => `<h3 class="cat-h">${c}</h3><div class="svc">${list.map(([k, t]) => `<button class="svc-card" data-act="tramite" data-k="${k}">
        <span class="gov-ico">${ico(k)}</span><span><b>${esc(t.name)}</b><small>${esc(t.desc || 'Solicitud en línea · Revisión 24-48 h')}</small></span>${last(k) ? badge(last(k).status) : '<span class="go">›</span>'}</button>`).join('')}</div>`).join('')}
      <h2 id="mis" class="sec-h">Mis solicitudes</h2>
      <table class="gov-tbl"><thead><tr><th>Folio</th><th>Trámite</th><th>Fecha</th><th>Estado</th><th>Nota</th></tr></thead><tbody>${reqs.map(r => `<tr><td>${r.id.slice(0, 8).toUpperCase()}</td>
        <td>${esc(TRAMITES[r.type]?.name || r.data.job_title || r.type)}</td><td>${fdate(r.created_at)}</td><td>${badge(r.status)}</td><td>${esc(r.note || '')}</td></tr>`).join('') || '<tr><td colspan="5">Sin solicitudes.</td></tr>'}</tbody></table>
      <h2 id="finanzas" class="sec-h">Finanzas públicas</h2>
      <div class="fin"><div><small>Presupuesto inicial (real, FY 2025-26)</small><b>$13,950,000,000</b></div><div><small>Saldo actual</small><b>${money(gov?.balance)}</b></div>
        <div><small>Índice de precios (CPI)</small><b>${cpi().toFixed(4)}</b></div><div><small>Emisiones de dinero</small><b>${hist.length}</b></div></div>
      ${pres ? `<div class="pres"><h3>Despacho del Presidente</h3><p>Emitir dinero llena la tesorería, pero sube la inflación: todo (autos, casas y sueldos) se encarece. La tasa de la Reserva Federal es el interés que paga el ahorro.</p>
        <div class="pres-grid"><form data-form="print" class="form">${fieldsHTML([{ k: 'amount', label: 'Emitir dinero (USD)', type: 'number', min: 1000000, req: 1, ph: '1000000000' }])}<button class="btn" type="submit">Imprimir dinero</button></form>
        <form data-form="rate" class="form">${fieldsHTML([{ k: 'rate', label: 'Tasa de la Reserva Federal (% anual)', type: 'number', min: 0, max: 25, req: 1, def: set('fed_rate') }])}<button class="btn" type="submit">Fijar tasa</button></form></div></div>` : ''}
      </main><footer class="gov-f"><img class="gov-logo sm" src="img/logo.png" alt=""><span>City of Los Angeles · Portal de roleplay de Los Ángeles RP. Los documentos emitidos solo son válidos dentro del juego.</span></footer></div>`, {
      tramite: d => openTramite(d.k, {}, () => gobierno.render(el)),
      go: d => el.querySelector('#' + d.k)?.scrollIntoView({ behavior: 'smooth' }),
      async print(d) {
        if (!confirm(`¿Emitir ${money(d.amount)}? Esto genera inflación para toda la ciudad.`)) return;
        const c = await db.rpc('print_money', { amount: d.amount }); S.settings.cpi = c; toast(`Dinero emitido. Nuevo índice de precios: ${Number(c).toFixed(4)}`); gobierno.render(el);
      },
      async rate(d) { await db.rpc('set_fed_rate', { rate: d.rate }); S.settings.fed_rate = d.rate; toast('Tasa actualizada'); gobierno.render(el); },
    });
  } };

// ============ WORKDAY (mi trabajo) ============
const rankList = d => S.ranks.filter(r => r.dept === d).sort((a, b) => a.ord - b.ord);
const salaryOf = (d, rank) => S.ranks.find(r => r.dept === d && r.rank === rank)?.salary || 0;
const minsBetween = (shifts, from, to = new Date()) => shifts.reduce((m, w) => m + Math.max(0, (Math.min(new Date(w.ended_at || Date.now()), to) - Math.max(new Date(w.started_at), from)) / 6e4), 0);
const trabajo = { id: 'trabajo', name: 'Workday', icon: '💼', bg: '#f5a623,#e5791b', show: () => true,
  async render(el, tab = 'mio') {
    if (!needChar(el)) return;
    const [emps, shifts] = await Promise.all([db.list('employments', { order: null, limit: 5000 }), db.list('work_shifts', { limit: 5000 })]);
    const mine = emps.filter(e => e.character_id === S.char.id && e.status !== 'fired');
    const mgrOf = [...new Set(S.tags.filter(t => t.startsWith('mgr:')).map(t => t.slice(4)))];
    const minm = Number(set('job_min_minutes')), day0 = new Date(new Date().setHours(0, 0, 0, 0)), wk0 = new Date(Date.now() - 7 * 864e5);
    const open = shifts.find(w => w.character_id === S.char.id && !w.ended_at);
    let body = '';
    if (tab === 'mio') body = mine.length ? mine.map(e => { const sh = shifts.filter(w => w.character_id === S.char.id && w.dept === e.dept), today = minsBetween(sh, day0), week = minsBetween(sh, wk0);
      const daily = salaryOf(e.dept, e.rank) / 365 * cpi(), isOpen = open?.dept === e.dept;
      return `<div class="job"><div class="job-h"><span class="gov-ico">${ico('empleos')}</span><div class="grow"><b>${esc(e.dept)}</b><small>${esc(e.rank)} · desde ${fdate(e.hired_at)}</small></div>${badge(e.status === 'vacation' ? 'vacation' : 'active')}</div>
        <div class="kpis"><div><small>Sueldo anual</small><b>${money(salaryOf(e.dept, e.rank) * cpi())}</b></div><div><small>Pago diario</small><b>${money(daily)}</b></div><div><small>Hoy</small><b>${Math.round(today)} / ${minm} min</b></div><div><small>Últimos 7 días</small><b>${Math.round(week / 60 * 10) / 10} h</b></div></div>
        <div class="meter"><i style="width:${Math.min(100, today / minm * 100)}%"></i></div>
        <p class="muted">Cumple al menos ${minm} minutos de turno al día para cobrar. Si pasas 7 días sin cumplir, el sistema te despide. ${e.status === 'vacation' ? `De vacaciones hasta el ${esc(e.vacation_until)} (con goce de sueldo).` : ''}</p>
        <div class="row">${e.status === 'active' ? `<button class="btn ${isOpen ? 'bad' : 'ok'}" data-act="clock" data-d="${esc(e.dept)}">${isOpen ? 'Terminar turno' : 'Iniciar turno'}</button>` : ''}
        <button class="btn ghost" data-act="vac" data-d="${esc(e.dept)}">Pedir vacaciones</button></div></div>`; }).join('')
      : `<div class="empty"><p>No tienes empleo. Busca vacantes del gobierno o de empresas en LinkedIn.</p><button class="btn" data-act="li">Abrir LinkedIn</button></div>`;
    if (tab === 'pagos') { const accs = await myAccounts(), p = accs.find(a => a.kind === 'personal');
      const tx = p ? (await db.list('transactions', { eq: { to_acc: p.id } })).filter(t => t.concept.startsWith('Nómina')) : [];
      body = `<ul class="list">${tx.map(t => `<li><div><b>${esc(t.concept)}</b><div class="muted">${fdate(t.created_at)}</div></div><b class="pos">+${money(t.amount)}</b></li>`).join('') || '<li class="muted">Aún no recibes pagos. Se depositan cada día por el turno del día anterior.</li>'}</ul>`; }
    if (tab === 'equipo') body = mgrOf.map(d => { const team = emps.filter(e => e.dept === d && e.status !== 'fired');
      return `<h3>${esc(d)}</h3><table class="tbl"><thead><tr><th>Nombre</th><th>Rango</th><th>Hoy</th><th>7 días</th><th>Estado</th><th></th></tr></thead><tbody>${team.map(e => { const sh = shifts.filter(w => w.character_id === e.character_id && w.dept === d);
        return `<tr><td>${esc(cname(e.character_id))}</td><td><select data-rank="${e.id}">${rankList(d).map(r => `<option ${r.rank === e.rank ? 'selected' : ''}>${esc(r.rank)}</option>`).join('')}</select></td>
        <td>${Math.round(minsBetween(sh, day0))} min</td><td>${Math.round(minsBetween(sh, wk0) / 6) / 10} h</td><td>${e.status === 'vacation' ? 'Vacaciones' : sh.some(w => !w.ended_at) ? '🟢 En turno' : 'Fuera'}</td>
        <td class="nowrap"><button class="btn sm" data-act="rank" data-id="${e.id}">Guardar rango</button><button class="btn sm bad" data-act="fire" data-id="${e.id}">Despedir</button></td></tr>`; }).join('')}</tbody></table>`; }).join('') + '<div class="q"></div>';
    view(el, `<div class="wd-h"><b>Workday</b><span>${esc(cname(S.char.id))}</span></div>
      ${tabs([['mio', 'Mi empleo'], ['pagos', 'Recibos de nómina'], ...(mgrOf.length ? [['equipo', 'Mi equipo']] : [])], tab)}${body}`, {
      tab: d => trabajo.render(el, d.t), li: () => window.openApp('empleos'),
      async clock(d) { const r = await db.rpc('clock', { c: S.char.id, d: d.d }); toast(r === 'in' ? 'Turno iniciado' : 'Turno terminado'); window.refreshDuty?.(); trabajo.render(el); },
      vac: d => openTramite('vacaciones', { values: { dept: d.d }, data: { dept: d.d }, dept: ['mgr:' + d.d, 'staff:admin'] }, () => trabajo.render(el)),
      async rank(d) { await db.rpc('set_rank', { emp: d.id, r: el.querySelector(`[data-rank="${d.id}"]`).value }); toast('Rango actualizado. Actualízalo también en Discord.'); trabajo.render(el, 'equipo'); },
      async fire(d) { if (!confirm('¿Despedir a este empleado?')) return; await db.rpc('fire_emp', { emp: d.id }); toast('Despedido. Quítale el rol en Discord.'); trabajo.render(el, 'equipo'); },
    });
    if (tab === 'equipo') reviewQueue(el.querySelector('.q'), { types: ['job', 'vacaciones'], title: 'Solicitudes de empleo y vacaciones' });
  } };

// ============ DOCUMENTOS (wallet) ============
const docs = { id: 'docs', name: 'Wallet', icon: '🪪', bg: '#1c1c1e,#3a3a3c', show: () => true,
  async render(el) {
    if (!needChar(el)) return;
    const reqs = await myRequests(), c = S.char, ok = t => approvedOf(reqs, t), name = `${c.first_name} ${c.last_name}`;
    const dni = ok('dni')[0], when = r => r.reviewed_at || r.created_at, wrap = (h, k) => `<div class="doc" data-act="zoom" data-k="${k}">${h}</div>`;
    const all = [];
    const add = (title, html) => all.push([title, html]);
    add('Acta de nacimiento', birthCert(c));
    if (dni) add('Identificación (California ID)', idCard(c, dni));
    if (dni) ok('licencia_conducir').forEach(l => add('Licencia de conducir · ' + l.data.clase, idCard(c, dni, l)));
    ok('pasaporte').forEach(p => add('Pasaporte', passport(c, p, false)));
    ok('visa').forEach(v => add('Pasaporte y visa', passport(c, v, true)));
    ok('titulo').forEach(t => add('Título universitario', diploma(t.data.carrera, name, 'por haber concluido satisfactoriamente sus estudios profesionales', t.data.universidad, when(t))));
    ok('licencia_abogado').forEach(t => add('Licencia de abogado', diploma('Licencia para ejercer la abogacía', name, 'admitido(a) para ejercer ante los tribunales de Los Ángeles', 'State Bar of Los Angeles RP', when(t))));
    ok('licencia_juez').forEach(t => add('Nombramiento de juez', diploma('Nombramiento judicial', name, 'como Juez de Distrito de la Corte de Los Ángeles', 'Corte Superior de Los Ángeles RP', when(t))));
    ok('licencia_armas').forEach(t => add('Licencia de armas', diploma('Licencia de portación · ' + t.data.tipo, name, 'autorizado(a) a portar armas de la categoría indicada', 'LAPD · Departamento de Licencias', when(t))));
    ok('servicio_militar').forEach(t => add('Servicio militar', diploma('Certificado de servicio militar', name, 'por su ingreso a ' + t.data.rama, 'Departamento de Defensa · LA RP', when(t))));
    const regs = [...ok('placa').map(r => [ico('placa'), `Placa ${esc(r.data.placa.toUpperCase())}`, `${esc(r.data.tipo)} · ${esc(r.data.estado)}`]),
      ...ok('registro_arma').map(r => [ico('registro_arma'), esc(r.data.arma), 'Serie ' + esc(r.data.serie)]),
      ...ok('registro_herramienta').map(r => [ico('registro_herramienta'), esc(r.data.herramienta), 'Registrada'])];
    view(el, `${all.map(([t, h], i) => `<h3>${t}</h3>${wrap(h, i)}`).join('')}
      ${!dni ? `<div class="card row"><span class="grow">Aún no tienes tu identificación (DNI).</span><button class="btn sm" data-act="t" data-k="dni">Tramitarla</button></div>` : ''}
      <h3>Registros</h3><ul class="list">${regs.map(([i, a, b]) => `<li><span class="li-ico">${i}</span><div class="grow"><b>${a}</b><div class="muted">${b}</div></div></li>`).join('') || '<li class="muted">Sin registros</li>'}</ul>`,
    { t: d => openTramite(d.k, {}, () => this.render(el)), zoom: d => modal(all[d.k][0], `<div class="doc big">${all[d.k][1]}</div>`) });
  } };

// ============ MENSAJES ============
const mensajes = { id: 'mensajes', name: 'Mensajes', icon: '💬', bg: '#34c759,#30b350', show: () => true,
  async render(el, other) {
    if (!needChar(el)) return;
    const me = S.char.id;
    const all = [...await db.list('messages', { eq: { from_char: me } }), ...await db.list('messages', { eq: { to_char: me } })].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const convs = [...new Set(all.map(m => m.from_char === me ? m.to_char : m.from_char))];
    const thread = other ? all.filter(m => [m.from_char, m.to_char].includes(other)) : [];
    view(el, `<div class="split"><aside><form data-form="nuevo" class="row"><select name="to" required><option value="">Nuevo chat…</option>${charOpts(c => c.status === 'active' && c.id !== me).map(([i, n]) => `<option value="${i}">${esc(n)}</option>`).join('')}</select><button class="btn sm">Abrir</button></form>
      ${convs.map(id => `<button class="conv ${id === other ? 'on' : ''}" data-act="abrir" data-id="${id}">${av(skin(id), 'av sm')} ${esc(cname(id))}</button>`).join('') || '<p class="empty">Sin chats</p>'}</aside>
      <section>${other ? `<h3>${esc(cname(other))}</h3><div class="thread">${thread.map(m => `<div class="msg ${m.from_char === me ? 'me' : ''}">${esc(m.body)}<small>${fdate(m.created_at)}</small></div>`).join('')}</div>
      <form data-form="send" class="row"><input name="body" required placeholder="Escribe un mensaje…" autocomplete="off"><button class="btn">Enviar</button></form>` : '<p class="empty">Elige un chat</p>'}</section></div>`, {
      nuevo: d => this.render(el, d.to), abrir: d => this.render(el, d.id),
      async send(d) { await db.insert('messages', { from_char: me, to_char: other, body: d.body }); mensajes.render(el, other); },
    });
    el.querySelector('.thread')?.scrollTo(0, 1e6);
  } };

// ============ REDES SOCIALES ============
// Instagram y X con el aspecto de las apps reales (feed, likes, guardados)
const handle = id => { const c = S.all.find(x => x.id === id); return c ? (c.first_name + '.' + c.last_name).toLowerCase().normalize('NFD').replace(/[^a-z0-9.]/g, '') : 'anonimo'; };
const ago = t => { const s = (Date.now() - new Date(t)) / 1000; return s < 60 ? 'ahora' : s < 3600 ? Math.floor(s / 60) + ' min' : s < 86400 ? Math.floor(s / 3600) + ' h' : s < 604800 ? Math.floor(s / 86400) + ' d' : fdate(t); };
const verified = id => S.all.find(c => c.id === id)?.roles?.includes('Influencer') ? ico('s_verified', 'verif') : '';
const savedPosts = () => { try { return JSON.parse(localStorage.getItem('rp_saved') || '[]'); } catch { return []; } };
function social(id, name, icon, bg, needMedia) {
  const app = { id, name, icon, bg, show: () => true,
    async render(el, tab = 'feed') {
      if (typeof tab === 'object') tab = 'feed';
      if (!needChar(el)) return;
      const [all, likes] = await Promise.all([db.list('posts', { eq: { app: id }, limit: 150 }), db.list('post_likes', { eq: { user_id: S.me.id }, order: null, limit: 2000 }).catch(() => [])]);
      const liked = new Set(likes.map(l => l.post_id)), saved = savedPosts(), mine = p => S.chars.some(c => c.id === p.character_id) || lvl() >= 2;
      const posts = tab === 'saved' ? all.filter(p => saved.includes(p.id)) : tab === 'me' ? all.filter(p => p.character_id === S.char.id) : all;
      const who = p => p.anonimo ? 'anonimo' : handle(p.character_id), nm = p => p.anonimo ? 'Anónimo' : esc(cname(p.character_id));
      const heart = p => `<button class="sa ${liked.has(p.id) ? 'on' : ''}" data-act="like" data-id="${p.id}" aria-label="Me gusta">${ico('s_heart', 'i')}${id === 'x' ? `<span>${p.likes || ''}</span>` : ''}</button>`;
      const save = p => `<button class="sa ${saved.includes(p.id) ? 'on' : ''}" data-act="save" data-id="${p.id}" aria-label="Guardar">${ico('s_save', 'i')}</button>`;
      const del = p => mine(p) ? `<button class="sa" data-act="del" data-id="${p.id}" aria-label="Borrar">${ico('s_trash', 'i')}</button>` : '';
      let html;
      if (id === 'insta') {
        const stories = [...new Map(all.filter(p => Date.now() - new Date(p.created_at) < 864e5 && !p.anonimo).map(p => [p.character_id, p])).values()].slice(0, 15);
        html = `<div class="ig"><header class="ig-top"><span class="ig-word">Instagram</span><span class="grow"></span>
            <button class="sa" data-act="nuevo" aria-label="Nueva publicación">${ico('s_new', 'i')}</button><button class="sa" data-act="tab" data-t="saved" aria-label="Guardados">${ico('s_save', 'i')}</button></header>
          ${tab === 'feed' && stories.length ? `<div class="ig-stories">${stories.map(p => `<button class="ig-st" data-act="zoom" data-src="${esc(p.media_url || '')}"><span class="ring">${av(skin(p.character_id), 'av')}</span><small>${esc(handle(p.character_id))}</small></button>`).join('')}</div>` : ''}
          ${tab !== 'feed' ? `<div class="ig-sub"><button class="link" data-act="tab" data-t="feed">‹ Inicio</button><b>${tab === 'saved' ? 'Guardado' : '@' + esc(handle(S.char.id))}</b></div>` : ''}
          <div class="ig-feed">${posts.map(p => `<article class="ig-post post">
            <div class="ig-h">${av(skin(p.character_id), 'av sm ring-s')}<b>${esc(who(p))}</b>${verified(p.character_id)}<span class="muted">· ${ago(p.created_at)}</span><span class="grow"></span>${del(p)}</div>
            ${p.media_url ? `<div class="ig-media" data-act="dbl" data-id="${p.id}"><img src="${esc(p.media_url)}" alt=""><i class="pop">${ico('s_heart', 'i')}</i></div>` : ''}
            <div class="ig-act">${heart(p)}<span class="grow"></span>${save(p)}</div>
            <div class="ig-likes">${p.likes ? `${p.likes.toLocaleString('es-MX')} Me gusta` : 'Sé el primero en dar Me gusta'}</div>
            ${p.body ? `<p class="ig-cap"><b>${esc(who(p))}</b> ${esc(p.body)}</p>` : ''}</article>`).join('') || '<p class="empty">Todavía no hay publicaciones.</p>'}</div>
          <nav class="ig-nav"><button class="sa" data-act="tab" data-t="feed">${ico('s_home', 'i')}</button><button class="sa" data-act="nuevo">${ico('s_new', 'i')}</button>
            <button class="sa" data-act="tab" data-t="me">${av(skin(S.char.id), 'av xs')}</button></nav></div>`;
      } else {
        html = `<div class="xa"><header class="xa-top"><b class="xa-logo">𝕏</b><nav class="xa-tabs"><button class="${tab === 'feed' ? 'on' : ''}" data-act="tab" data-t="feed">Para ti</button><button class="${tab === 'me' ? 'on' : ''}" data-act="tab" data-t="me">Mis posts</button><button class="${tab === 'saved' ? 'on' : ''}" data-act="tab" data-t="saved">Guardados</button></nav></header>
          <form data-form="post" class="xa-compose">${av(skin(S.char.id), 'av')}<div class="grow"><textarea name="body" rows="2" maxlength="280" placeholder="¿Qué está pasando?" required></textarea>
            <div class="row"><label class="sa" title="Foto">${ico('s_photo', 'i')}<input type="file" name="media_url" accept="image/*" hidden></label><span class="grow"></span><button class="xa-btn" type="submit">Postear</button></div></div></form>
          ${posts.map(p => `<article class="xa-post post">${av(skin(p.character_id), 'av')}<div class="grow">
            <div class="xa-h"><b>${nm(p)}</b>${verified(p.character_id)}<span class="muted">@${esc(who(p))} · ${ago(p.created_at)}</span></div>
            ${p.body ? `<p>${esc(p.body)}</p>` : ''}${p.media_url ? `<img class="xa-media" src="${esc(p.media_url)}" alt="" data-act="zoom" data-src="${esc(p.media_url)}">` : ''}
            <div class="xa-act">${heart(p)}${save(p)}${del(p)}</div></div></article>`).join('') || '<p class="empty">Sé el primero en postear.</p>'}</div>`;
      }
      const again = () => app.render(el, tab);
      view(el, html, {
        tab: d => app.render(el, d.t),
        post: async d => { await db.insert('posts', { app: id, character_id: S.char.id, body: d.body, media_url: d.media_url || null }); again(); },
        nuevo: () => modal('Nueva publicación', form('pub', [{ k: 'media_url', label: 'Foto', type: 'file', req: 1 }, { k: 'body', label: 'Escribe un pie de foto…', type: 'textarea' }], {}, 'Compartir'), {
          pub: async (d, f, close) => { await db.insert('posts', { app: id, character_id: S.char.id, body: d.body, media_url: d.media_url }); close(); again(); } }),
        like: async d => { if (liked.has(d.id)) return; await db.rpc('like_post', { id: d.id }); again(); },
        dbl: async (d, t) => { t.classList.remove('beat'); void t.offsetWidth; t.classList.add('beat'); if (!liked.has(d.id)) { await db.rpc('like_post', { id: d.id }); setTimeout(again, 500); } },
        save: d => { const s = savedPosts(), k = s.indexOf(d.id); k < 0 ? s.push(d.id) : s.splice(k, 1); localStorage.setItem('rp_saved', JSON.stringify(s)); again(); },
        del: async d => { if (!confirm('¿Borrar esta publicación?')) return; await db.remove('posts', d.id); again(); },
        zoom: d => d.src && zoom(d),
      });
    } };
  return app;
}

// ============ PERIÓDICO ============
const SECCIONES = ['Última hora', 'Política', 'Sucesos', 'Economía', 'Deportes', 'Obituarios', 'Publicidad'];
const news = { id: 'news', name: 'LA Times', icon: '📰', bg: '#111111,#3a3a3a', url: 'latimes.rp', show: () => true,
  async render(el, sec) {
    if (typeof sec === 'object') sec = undefined;
    const posts = (await db.list('posts', { eq: { app: 'news' }, limit: 100 })).filter(p => !sec || p.section === sec);
    view(el, `<header class="paper"><h1>Los Angeles Times</h1><small>Edición roleplay · ${new Date().toLocaleDateString('es-MX', { dateStyle: 'full' })}</small></header>
      <div class="chips"><button data-act="sec" class="${!sec ? 'on' : ''}">Todo</button>${SECCIONES.map(s => `<button data-act="sec" data-s="${s}" class="${sec === s ? 'on' : ''}">${s}</button>`).join('')}
      ${S.char?.status === 'active' ? '<button data-act="nueva">✍️ Publicar noticia</button>' : ''}</div>
      <div class="news">${posts.map(p => `<article class="story ${p.section === 'Obituarios' ? 'obit' : ''}"><small class="sec">${esc(p.section || 'Noticias')}</small>
        <h2>${esc(p.title)}</h2>${p.media_url ? `<img src="${esc(p.media_url)}" alt="" data-act="zoom" data-src="${esc(p.media_url)}">` : ''}<p>${esc(p.body)}</p>
        <small class="muted">${p.anonimo ? 'Redacción' : 'Por ' + esc(cname(p.character_id))} · ${fdate(p.created_at)}</small>
        ${S.chars.some(c => c.id === p.character_id) || lvl() >= 2 ? ` <button class="link" data-act="del" data-id="${p.id}">Borrar</button>` : ''}</article>`).join('') || '<p class="empty">Sin noticias.</p>'}</div>`, {
      sec: d => this.render(el, d.s),
      nueva: () => modal('✍️ Nueva noticia', form('pub', [{ k: 'title', label: 'Titular', req: 1 }, { k: 'section', label: 'Sección', type: 'select', options: SECCIONES.filter(s => s !== 'Obituarios'), req: 1 },
        { k: 'body', label: 'Nota', type: 'textarea', req: 1 }, { k: 'media_url', label: 'Foto', type: 'file' }, { k: 'anonimo', label: 'Anónima', type: 'check', text: 'Publicar como "Redacción"' }]), {
        async pub(d, _, close) { await db.insert('posts', { ...d, app: 'news', character_id: S.char.id }); close(); news.render(el, sec); } }),
      del: async d => { await db.remove('posts', d.id); this.render(el, sec); }, zoom,
    });
  } };

// ============ GOOGLE + sitios web de las empresas ============
export const slug = n => String(n).toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '').slice(0, 30) || 'empresa';
const reviewsOf = (revs, id) => revs.filter(x => x.target_id === id);
const avgOf = (revs, id) => { const r = reviewsOf(revs, id); return r.length ? r.reduce((s, x) => s + x.stars, 0) / r.length : 0; };
const buscar = { id: 'buscar', name: 'Google', icon: '🔎', bg: '#4285f4,#1a73e8', url: 'google.rp', show: () => true,
  async render(el, params = {}) {
    const q = (params.q || '').trim(), t = params.t || 'todo';
    if (!q) return view(el, `<div class="g-home"><div class="g-top">${av(S.me.avatar_url, 'av sm')}</div>
      <div class="g-logo">Google</div><form data-form="s" class="g-box">${ico('buscar', 'i')}<input name="q" autocomplete="off" aria-label="Buscar"></form>
      <div class="row center"><button class="g-btn" data-act="go">Buscar con Google</button><button class="g-btn" data-act="lucky">Voy a tener suerte</button></div>
      <div class="g-foot">Los Ángeles, California · Google ofrecido en: Español</div></div>`, { s: d => params.nav(`google.rp/search?q=${encodeURIComponent(d.q)}`),
        go: () => params.nav(`google.rp/search?q=${encodeURIComponent(el.querySelector('[name=q]').value)}`), lucky: () => params.nav(`google.rp/search?q=${encodeURIComponent(el.querySelector('[name=q]').value || 'Los Ángeles')}&lucky=1`) });
    const ql = q.toLowerCase(), hit = (...v) => v.some(x => String(x || '').toLowerCase().includes(ql));
    const [cos, revs, posts, jobs, props, models] = await Promise.all([db.list('companies', { order: 'name', asc: true }), db.list('reviews', { eq: { target_kind: 'business' } }),
      db.list('posts', { eq: { app: 'news' }, limit: 300 }), db.list('jobs', { eq: { open: true } }), db.list('properties', { order: null }), db.list('vehicle_models', { order: null })]);
    const SITE_HITS = [['lacity.rp', 'City of Los Angeles · Trámites y servicios', 'Trámites de identidad, licencias, registros y negocios.', 'gobierno dni licencia tramite ciudad la city pasaporte visa placa'],
      ['linkedin.rp', 'LinkedIn: Empleos en Los Ángeles', 'Vacantes del gobierno y de empresas privadas.', 'trabajo empleo vacante linkedin'],
      ['zillow.rp', 'Zillow: Casas y locales en venta', 'Encuentra casas y locales comerciales en Los Ángeles.', 'casa casas propiedad zillow renta local'],
      ['carmax.rp', 'CarMax: Autos nuevos y usados', 'Más de 100 modelos disponibles.', 'auto autos carro coche carmax'],
      ['gbm.rp', 'GBM+: Invierte en la bolsa de Los Ángeles', 'Compra acciones y el ETF LA500.', 'bolsa acciones invertir gbm trading etf portafolio'],
      ['latimes.rp', 'Los Angeles Times', 'Últimas noticias de la ciudad.', 'noticias periodico times'], ['lacourt.rp', 'Superior Court of Los Angeles', 'Demandas, juicios y abogados.', 'corte juez demanda abogado juicio'],
      ['vote.rp', 'Vote.gov: Elecciones', 'Partidos, campañas y votaciones.', 'votar elecciones partido campaña']];
    const R = [];
    SITE_HITS.filter(([h, ti, de, kw]) => hit(h, ti, kw) || kw.split(' ').some(k => ql.includes(k))).forEach(([h, ti, de]) => R.push({ t: 'todo', url: h, title: ti, desc: de }));
    cos.filter(c => hit(c.name, c.industry, c.description, c.brand)).forEach(c => R.push({ t: 'todo', url: slug(c.name) + '.rp', title: c.name + ' · ' + c.industry, desc: c.description || '', stars: avgOf(revs, c.id), n: reviewsOf(revs, c.id).length }));
    posts.filter(p => hit(p.title, p.body)).forEach(p => R.push({ t: 'noticias', url: 'latimes.rp', title: p.title, desc: `${fdate(p.created_at)} — ${String(p.body || '').slice(0, 140)}…` }));
    jobs.filter(j => hit(j.title, j.employer)).forEach(j => R.push({ t: 'empleos', url: 'linkedin.rp', title: `${j.title} · ${j.employer}`, desc: j.description || '' }));
    props.filter(p => hit(p.name, p.zone, p.kind)).forEach(p => R.push({ t: 'propiedades', url: 'zillow.rp', title: `${p.name} · ${p.zone}`, desc: p.for_sale ? 'En venta · ' + money((p.owner_char || p.owner_company ? p.sale_price : p.price * cpi())) : 'Vendida', img: p.img }));
    models.filter(m => hit(m.brand, m.model, m.category)).forEach(m => R.push({ t: 'autos', url: 'carmax.rp', title: `${m.brand} ${m.model}`, desc: `${m.category} · desde ${money(m.price * cpi())}`, img: m.img || CAR_PHOTOS[m.brand] || CAR_PHOTOS.default }));
    if (params.lucky && R[0]) return params.nav(R[0].url);
    const tabsG = [['todo', 'Todo'], ['noticias', 'Noticias'], ['empleos', 'Empleos'], ['propiedades', 'Propiedades'], ['autos', 'Autos']];
    const shown = R.filter(r => t === 'todo' ? true : r.t === t), top = cos.find(c => hit(c.name));
    view(el, `<div class="g-res"><header class="g-rh"><span class="g-logo sm" data-href="google.rp">Google</span><form data-form="s" class="g-box sm"><input name="q" value="${esc(q)}" aria-label="Buscar">${ico('buscar', 'i')}</form>${av(S.me.avatar_url, 'av sm')}</header>
      <nav class="g-tabs">${tabsG.map(([k, l]) => `<a data-href="google.rp/search?q=${encodeURIComponent(q)}&t=${k}" class="${t === k ? 'on' : ''}">${l}</a>`).join('')}</nav>
      <div class="g-body"><div class="g-list"><small class="muted">Cerca de ${shown.length} resultados</small>
      ${shown.map(r => `<div class="g-item">${r.img ? `<img src="${esc(r.img)}" alt="" loading="lazy">` : ''}<div><div class="g-url">${esc(r.url)}</div><a class="g-title" data-href="${esc(r.url)}">${esc(r.title)}</a>
        ${r.stars != null ? `<div class="g-stars"><span class="stars">${stars(r.stars)}</span> ${r.n} reseñas</div>` : ''}<p>${esc(r.desc)}</p></div></div>`).join('') || `<p>No se encontraron resultados para <b>${esc(q)}</b>.</p>`}</div>
      ${top ? `<aside class="g-kp"><div class="kp-h">${av(top.logo_url, 'av')}<div><b>${esc(top.name)}</b><small>${esc(top.industry)}</small></div></div><div class="stars big">${stars(avgOf(revs, top.id))}</div>
        <p>${esc(top.description || '')}</p><a class="g-btn" data-href="${slug(top.name)}.rp">Sitio web</a></aside>` : ''}</div></div>`, { s: d => params.nav(`google.rp/search?q=${encodeURIComponent(d.q)}`) });
  } };

const companySite = { async render(el, params) {
  const co = params.company, revs = await db.list('reviews', { eq: { target_kind: 'business' } }), r = reviewsOf(revs, co.id);
  const jobs = (await db.list('jobs', { eq: { open: true } })).filter(j => j.company_id === co.id);
  view(el, `<div class="cs"><header class="cs-h">${av(co.logo_url, 'av')}<b>${esc(co.name)}</b><nav><a href="#cs-about">Nosotros</a><a href="#cs-jobs">Empleos</a><a href="#cs-rev">Reseñas</a><a href="#cs-contact">Contacto</a></nav></header>
    <section class="cs-hero"><h1>${esc(co.name)}</h1><p>${esc(co.description || co.industry)}</p><div class="stars big">${stars(avgOf(revs, co.id))}</div><small>${r.length} reseñas en Google</small></section>
    <main class="cs-main"><h2 id="cs-about">Nosotros</h2><p>${esc(co.industry)}${co.brand ? ' · Concesionaria oficial ' + esc(co.brand) : ''}. Propietarios: ${co.owners.map(cname).map(esc).join(', ')}.</p>
      <p class="muted">EIN ${esc(co.ein)} · ${(co.permits || []).map(esc).join(' · ')}</p>
      <h2 id="cs-jobs">Trabaja con nosotros</h2>${jobs.map(j => `<div class="card"><b>${esc(j.title)}</b> · ${money(j.salary)}<p>${esc(j.description || '')}</p><a class="link" data-href="linkedin.rp">Postularme en LinkedIn</a></div>`).join('') || '<p class="muted">No hay vacantes por ahora.</p>'}
      <h2 id="cs-rev">Reseñas</h2>${r.map(x => `<div class="card"><span class="stars">${stars(x.stars)}</span> ${esc(x.body)}</div>`).join('') || '<p class="muted">Sé el primero en opinar.</p>'}
      ${form('rev', [{ k: 'stars', label: 'Calificación', type: 'select', options: [5, 4, 3, 2, 1].map(n => [n, '★'.repeat(n)]), req: 1 }, { k: 'body', label: 'Tu reseña', type: 'textarea', req: 1 }], {}, 'Publicar reseña')}
      <h2 id="cs-contact">Contacto</h2><button class="btn" data-act="msg">Enviar mensaje a ${esc(cname(co.owners[0]))}</button></main>
    <footer class="cs-f">© ${new Date().getFullYear()} ${esc(co.name)} · Los Ángeles, CA</footer></div>`, {
    async rev(f) { await db.insert('reviews', { target_kind: 'business', target_id: co.id, stars: +f.stars, body: f.body, user_id: S.me.id }); toast('Gracias por tu reseña'); companySite.render(el, params); },
    msg: () => window.openApp('mensajes'),
  });
} };

// Navegador: cada dirección .rp abre su sitio. Las empresas tienen su propio sitio: nombre.rp
export async function resolveSite(host) {
  const map = { 'google.rp': buscar, 'lacity.rp': gobierno, 'latimes.rp': news, 'linkedin.rp': empleos, 'zillow.rp': casas, 'carmax.rp': autos, 'gbm.rp': bolsa, 'vote.rp': fec, 'lacourt.rp': corte };
  if (map[host]) return (el, params) => map[host].render(el, params);
  const co = (await db.list('companies', { order: null })).find(c => slug(c.name) + '.rp' === host);
  return co ? (el, params) => companySite.render(el, { ...params, company: co }) : null;
}
const safari = { id: 'safari', name: 'Safari', icon: '🧭', bg: '#1e90ff,#0a5bd8', url: 'google.rp', show: () => true, render: el => buscar.render(el, {}) };

// ============ BOLSA DE TRABAJO ============
const empleos = { id: 'empleos', name: 'LinkedIn', icon: '💼', bg: '#0a66c2,#004182', url: 'linkedin.rp', show: () => true,
  async render(el, tab = 'ofertas') {
    if (typeof tab === 'object') tab = 'ofertas';
    if (!needChar(el)) return;
    const jobs = await db.list('jobs', { eq: { open: true } }), pay = set('payroll');
    const mine = (await myRequests()).filter(r => r.type === 'job');
    const cos = (await db.list('companies')).filter(c => c.owners.includes(S.char.id));
    let body = '';
    if (tab === 'ofertas') body = jobs.map(j => `<div class="card"><div class="row"><b>${esc(j.title)}</b>${j.role_tag ? '<span class="tag on">Gobierno</span>' : ''}</div>
      <div class="muted">${esc(j.employer)} · ${j.role_tag ? money((rankList(j.role_tag)[0]?.salary || 0) * cpi()) + ' al año · pago diario' : money(j.salary) + ' por pago'}</div><p>${esc(j.description || '')}</p>
      ${mine.some(r => r.data.job_id === j.id && r.status === 'pending') ? badge('pending') : `<button class="btn sm" data-act="aplicar" data-id="${j.id}">Postularme</button>`}</div>`).join('') || '<p class="empty">No hay vacantes.</p>';
    if (tab === 'mias') body = `<ul class="list">${mine.map(r => `<li><div><b>${esc(r.data.job_title)}</b><div class="muted">${esc(r.data.employer)}${r.note ? ' · ' + esc(r.note) : ''}</div></div>${badge(r.status)}</li>`).join('') || '<p class="empty">Sin postulaciones.</p>'}</ul>`;
    if (tab === 'publicar') body = form('pub', [{ k: 'title', label: 'Puesto', req: 1 },
      { k: 'company_id', label: 'Empleador', type: 'select', options: [['', 'A mi nombre'], ...cos.map(c => [c.id, c.name])] },
      { k: 'salary', label: 'Sueldo por pago (USD)', type: 'number', min: 0, req: 1 }, { k: 'description', label: 'Requisitos y descripción', type: 'textarea', req: 1 }], {}, 'Publicar vacante')
      + `<h3>Mis vacantes</h3><ul class="list">${jobs.filter(j => j.posted_by === S.char.id).map(j => `<li>${esc(j.title)} <button class="btn sm bad" data-act="cerrar" data-id="${j.id}">Cerrar</button></li>`).join('') || '<li class="muted">Ninguna</li>'}</ul>`;
    view(el, `${tabs([['ofertas', 'Vacantes'], ['mias', 'Mis postulaciones'], ['publicar', 'Publicar'], ['recibidas', 'Recibidas']], tab)}<div class="tabbody">${body}</div>`, {
      tab: d => this.render(el, d.t),
      aplicar: d => { const j = jobs.find(x => x.id === d.id);
        modal('💼 ' + esc(j.title), form('send', [{ k: 'experiencia', label: 'Experiencia', type: 'textarea', req: 1 }, { k: 'disponibilidad', label: 'Disponibilidad', req: 1 },
          { k: 'entrevista', label: 'Fecha preferida para entrevista', type: 'datetime-local' }]), {
          async send(f, _, close) {
            await db.insert('requests', { type: 'job', dept: [j.role_tag ? 'mgr:' + j.role_tag : 'char:' + j.posted_by, 'staff:admin'], character_id: S.char.id,
              data: { job_id: j.id, job_title: j.title, employer: j.employer, role_tag: j.role_tag || '', ...f } });
            close(); toast('Postulación enviada'); empleos.render(el, 'mias');
          } }); },
      async pub(d) {
        const co = cos.find(c => c.id === d.company_id);
        await db.insert('jobs', { title: d.title, salary: d.salary, description: d.description, company_id: co?.id || null, employer: co?.name || cname(S.char.id), posted_by: S.char.id });
        toast('Vacante publicada'); empleos.render(el, 'ofertas');
      },
      cerrar: async d => { await db.update('jobs', d.id, { open: false }); this.render(el, 'publicar'); },
    });
    if (tab === 'recibidas') reviewQueue(el.querySelector('.tabbody'), { types: ['job'], title: 'Postulaciones a revisar (pon la fecha de entrevista en la nota)' });
  } };

// ============ BOLSA DE VALORES ============
async function market() {
  const [cos, accs, props, vehs, models] = await Promise.all(['companies', 'accounts', 'properties', 'vehicles', 'vehicle_models'].map(t => db.list(t, { order: null })));
  return cos.map(c => ({ ...c, price: sharePrice(c, accs, props, vehs, models, cos) }));
}
// gráfica de línea en SVG a partir de una lista de precios
const chart = (pts, w = 600, h = 160, line = true) => {
  if (pts.length < 2) pts = [pts[0] || 1, pts[0] || 1];
  const mn = Math.min(...pts), mx = Math.max(...pts), r = mx - mn || 1, up = pts.at(-1) >= pts[0];
  const xy = pts.map((p, i) => `${(i / (pts.length - 1) * w).toFixed(1)},${(h - 6 - (p - mn) / r * (h - 12)).toFixed(1)}`).join(' ');
  return `<svg class="chart ${up ? 'up' : 'down'}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${line ? `<polygon points="0,${h} ${xy} ${w},${h}" class="area"/>` : ''}<polyline points="${xy}"/></svg>`;
};
const pct = (a, b) => b ? (a - b) / b * 100 : 0;
const sgn = n => `<span class="${n >= 0 ? 'pos' : 'neg'}">${n >= 0 ? '+' : ''}${n.toFixed(2)}%</span>`;
const bolsa = { id: 'bolsa', name: 'GBM+', icon: '📈', bg: '#0b1f3a,#1c4f8f', url: 'gbm.rp', show: () => true,
  async render(el, params = {}) {
    if (!needChar(el)) return;
    const st = el._gbm ||= { tab: 'port', id: null };
    const [cos, hold, acc, hist, trades] = await Promise.all([market(), db.list('holdings', { eq: { character_id: S.char.id } }), personalAcc(),
      db.list('price_history', { order: 'created_at', asc: true, limit: 5000 }), db.list('trades', { eq: { character_id: S.char.id } })]);
    const H = id => hold.find(x => x.company_id === id && x.shares > 0), series = c => [...hist.filter(p => p.company_id === c.id).map(p => +p.price), c.price];
    const day = c => { const s = hist.filter(p => p.company_id === c.id && new Date(p.created_at) > Date.now() - 864e5); return pct(c.price, s[0]?.price ?? series(c)[0]); };
    const mine = cos.filter(c => H(c.id)), value = mine.reduce((s, c) => s + H(c.id).shares * c.price, 0), cost = mine.reduce((s, c) => s + Number(H(c.id).cost || 0), 0);
    const go = p => { Object.assign(st, p); bolsa.render(el, params); };
    let body = '';
    if (st.id) {
      const c = cos.find(x => x.id === st.id), h = H(c.id), ser = series(c);
      body = `<button class="link" data-act="back">‹ Mercado</button><div class="q-h"><div><b>${esc(c.name)}</b><small>${esc(c.industry)}</small></div><div class="q-p"><b>${money(c.price)}</b>${sgn(pct(c.price, ser[0]))}</div></div>
        ${chart(ser)}<div class="kpis"><div><small>Valor de mercado</small><b>${money(c.price * (c.shares_total || 1000))}</b></div><div><small>Títulos</small><b>${(c.shares_total || 0).toLocaleString()}</b></div>
          <div><small>Hoy</small><b>${sgn(day(c))}</b></div><div><small>Tu posición</small><b>${h ? h.shares + ' títulos' : '—'}</b></div></div>
        ${h ? `<p class="muted">Costo promedio ${money(h.cost / h.shares)} · Rendimiento ${sgn(pct(h.shares * c.price, h.cost))} (${money(h.shares * c.price - h.cost)})</p>` : ''}
        <div class="order"><div class="seg"><button data-act="side" data-s="buy" class="${st.side !== 'sell' ? 'on buy' : ''}">Comprar</button><button data-act="side" data-s="sell" class="${st.side === 'sell' ? 'on sell' : ''}">Vender</button></div>
          <form data-form="orden" class="form">${fieldsHTML([{ k: 'qty', label: 'Títulos', type: 'number', min: 1, max: st.side === 'sell' ? h?.shares || 0 : undefined, req: 1, def: 1 }])}
          <p class="muted" data-est>Precio de mercado ${money(c.price)} · Poder de compra ${money(acc?.balance)}</p>
          <button class="btn big ${st.side === 'sell' ? 'bad' : 'ok'}" type="submit">${st.side === 'sell' ? 'Vender a mercado' : 'Comprar a mercado'}</button></form></div>`;
    } else if (st.tab === 'port') body = mine.length ? `<table class="tbl"><thead><tr><th>Emisora</th><th>Títulos</th><th>Costo prom.</th><th>Precio</th><th>Valor</th><th>Rendimiento</th></tr></thead><tbody>
        ${mine.map(c => { const h = H(c.id); return `<tr class="click" data-act="ver" data-id="${c.id}"><td><b>${esc(c.name)}</b></td><td>${h.shares}</td><td>${money(h.cost / h.shares)}</td><td>${money(c.price)}</td><td>${money(h.shares * c.price)}</td>
          <td>${sgn(pct(h.shares * c.price, h.cost))}</td></tr>`; }).join('')}</tbody></table>` : `<p class="empty">Aún no tienes inversiones. Ve a Mercado para comprar tus primeras acciones.</p>`;
    else if (st.tab === 'mkt') body = `<div class="mkt">${cos.map(c => `<button class="mkt-row" data-act="ver" data-id="${c.id}"><div><b>${esc(c.name)}</b><small>${esc(c.industry)}</small></div>${chart(series(c).slice(-30), 120, 36, false)}
        <div class="q-p"><b>${money(c.price)}</b>${sgn(day(c))}</div></button>`).join('') || '<p class="empty">Aún no hay emisoras en la bolsa.</p>'}</div>`;
    else body = `<ul class="list">${trades.map(t => `<li><div><b class="${t.side === 'compra' ? 'pos' : 'neg'}">${t.side === 'compra' ? 'Compra' : 'Venta'}</b> ${t.qty} × ${esc(cos.find(c => c.id === t.company_id)?.name || '—')}
        <div class="muted">${fdate(t.created_at)} · ${money(t.price)} por título</div></div><b>${money(t.total)}</b></li>`).join('') || '<li class="muted">Sin operaciones.</li>'}</ul>`;
    view(el, `<div class="gbm"><header class="gbm-h"><b>GBM<span>+</span></b><span>${esc(cname(S.char.id))}</span></header>
      <div class="gbm-sum"><div><small>Valor del portafolio</small><b>${money(value)}</b>${sgn(pct(value, cost))}</div><div><small>Poder de compra</small><b>${money(acc?.balance)}</b></div>
        <div><small>Ganancia / pérdida</small><b class="${value - cost >= 0 ? 'pos' : 'neg'}">${money(value - cost)}</b></div><div><small>Inflación acumulada</small><b>${((cpi() - 1) * 100).toFixed(2)}%</b></div></div>
      ${st.id ? '' : tabs([['port', 'Portafolio'], ['mkt', 'Mercado'], ['ord', 'Órdenes']], st.tab)}<div class="gbm-b">${body}</div>
      <p class="muted small">Precio por título = (efectivo + casas + autos de la empresa) ÷ títulos. El ETF LA500 sigue el promedio del mercado. Los precios se registran con cada operación y al cierre del día.</p></div>`, {
      tab: d => go({ tab: d.t, id: null }), ver: d => go({ id: d.id, side: 'buy' }), back: () => go({ id: null, tab: 'mkt' }), side: d => go({ side: d.s }),
      async orden(f) {
        if (!acc) throw new Error('Necesitas tu cuenta personal');
        const r = st.side === 'sell' ? await db.rpc('sell_shares', { company: st.id, qty: f.qty, acc: acc.id }) : await db.rpc('buy', { kind: 'shares', item: st.id, acc: acc.id, qty: f.qty });
        toast(`Orden ejecutada: ${st.side === 'sell' ? 'vendiste' : 'compraste'} ${f.qty} títulos por ${money(r)}`); go({});
      },
    });
    const q = el.querySelector('[name=qty]'), est = el.querySelector('[data-est]'), c = st.id && cos.find(x => x.id === st.id);
    q?.addEventListener('input', () => { est.textContent = `Total estimado ${money(c.price * (+q.value || 0))} · Poder de compra ${money(acc?.balance)}`; });
  } };

// ============ BIENES RAÍCES ============
const casas = { id: 'casas', name: 'Zillow', icon: '🏠', bg: '#006aff,#0041a8', url: 'zillow.rp', show: () => true,
  async render(el) {
    if (!needChar(el)) return;
    const [props, accs, cos] = await Promise.all([db.list('properties', { order: 'price', asc: true }), myAccounts(), db.list('companies')]);
    const myCos = cos.filter(c => c.owners.includes(S.char.id)).map(c => c.id);
    const mine = p => p.owner_char === S.char.id || myCos.includes(p.owner_company);
    const owner = p => p.owner_char ? cname(p.owner_char) : p.owner_company ? cos.find(c => c.id === p.owner_company)?.name : 'Gobierno de LA';
    const kind = el.dataset.kind || 'casa';
    view(el, `${tabs([['casa', 'Casas'], ['local', 'Locales comerciales']], kind)}<p class="muted">El gobierno vende a precio de lista (ajustado por inflación). Las inmobiliarias registradas (giro Bienes Raíces) compran al 50% y revenden al precio que quieran.</p>
      ${lvl() >= 3 ? '<button class="btn sm" data-act="nueva">+ Agregar propiedad (admin)</button>' : ''}
      <div class="grid-cards">${props.filter(p => (p.kind || 'casa') === kind).map(p => `<div class="card prop">${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy">` : `<div class="ph">${ico('casas')}</div>`}
        <b>${esc(p.name)}</b><div class="muted">${esc(p.zone)} · Dueño: ${esc(owner(p))}</div>
        <div class="price">${p.for_sale ? money(p.owner_char || p.owner_company ? p.sale_price : p.price * cpi()) : 'No está en venta'}</div>
        ${p.for_sale && !mine(p) ? `<button class="btn sm ok" data-act="comprar" data-id="${p.id}">Comprar</button>` : ''}
        ${mine(p) ? `<button class="btn sm" data-act="vender" data-id="${p.id}">${p.for_sale ? 'Cambiar precio / quitar' : 'Poner en venta'}</button>` : ''}</div>`).join('') || '<p class="empty">Aún no hay casas cargadas.</p>'}</div>`, {
      comprar: d => modal('Comprar casa', `<form data-form="go" class="form">${accSelect(accs)}<button class="btn ok" type="submit">Confirmar compra</button></form>`, {
        async go(f, _, close) { const r = await db.rpc('buy', { kind: 'property', item: d.id, acc: f.acc }); toast('¡Casa comprada por ' + money(r) + '!'); close(); casas.render(el); } }),
      vender: d => modal('Vender casa', form('go', [{ k: 'price', label: 'Precio de venta (vacío = quitar de venta)', type: 'number', min: 1 }]), {
        async go(f, _, close) { await db.rpc('list_item', { kind: 'property', item: d.id, price: f.price }); close(); casas.render(el); } }),
      nueva: () => modal('Nueva casa', form('go', [{ k: 'name', label: 'Nombre', req: 1 }, { k: 'zone', label: 'Zona', type: 'select', options: ['River City', 'Springfield'], req: 1 },
        { k: 'kind', label: 'Tipo', type: 'select', options: [['casa', 'Casa'], ['local', 'Local comercial']], req: 1, def: kind }, { k: 'price', label: 'Precio base', type: 'number', min: 1, req: 1 }, { k: 'img', label: 'Foto', type: 'file' }]), {
        async go(f, _, close) { await db.insert('properties', f); close(); casas.render(el); } }),
      tab: d => { el.dataset.kind = d.t; casas.render(el); },
    });
  } };

// ============ CONCESIONARIA ============
const autos = { id: 'autos', name: 'CarMax', icon: '🚘', bg: '#053361,#1660b8', url: 'carmax.rp', show: () => true,
  async render(el, tab = 'catalogo', cat = '') {
    if (typeof tab === 'object') tab = 'catalogo';
    if (!needChar(el)) return;
    const [allModels, vehs, accs, cos] = await Promise.all([db.list('vehicle_models', { order: 'brand', asc: true }), db.list('vehicles'), myAccounts(), db.list('companies')]);
    const models = allModels.filter(m => !cat || m.category === cat), cats = [...new Set(allModels.map(m => m.category).filter(Boolean))];
    const M = Object.fromEntries(allModels.map(m => [m.id, m])), myCos = cos.filter(c => c.owners.includes(S.char.id)).map(c => c.id);
    const brands = [...new Set(models.map(m => m.brand))];
    let body = '';
    if (tab === 'catalogo') body = `<p class="muted">Concesionarias registradas compran al 30%. La concesionaria oficial de cada marca compra al 10% y vende al precio que quiera.</p>
      <div class="chips"><button data-act="cat" class="${!cat ? 'on' : ''}">Todos (${allModels.length})</button>${cats.map(c => `<button data-act="cat" data-c="${esc(c)}" class="${cat === c ? 'on' : ''}">${esc(c)}</button>`).join('')}
      ${lvl() >= 3 ? '<button data-act="nuevo">+ Agregar modelo</button>' : ''}</div>
      ${brands.map(b => `<h3>${esc(b)}</h3><div class="grid-cards">${models.filter(m => m.brand === b).map(m => `<div class="card prop"><img src="${esc(m.img || CAR_PHOTOS[m.brand] || CAR_PHOTOS.default)}" alt="" loading="lazy">
        <b>${esc(m.model)}</b><div class="muted">${esc(m.category || '')}</div><div class="price">${money(m.price * cpi())}</div>
        <div class="row"><button class="btn sm ok" data-act="comprar" data-id="${m.id}">Comprar</button>${lvl() >= 3 ? `<button class="btn sm" data-act="editar" data-id="${m.id}">✏️ Foto / precio</button>` : ''}</div></div>`).join('')}</div>`).join('') || '<p class="empty">Catálogo vacío.</p>'}`;
    if (tab === 'venta') body = `<div class="grid-cards">${vehs.filter(v => v.sale_price != null).map(v => `<div class="card prop"><b>${esc(M[v.model_id]?.brand)} ${esc(M[v.model_id]?.model)}</b>
      <div class="muted">Vende: ${esc(v.owner_company ? cos.find(c => c.id === v.owner_company)?.name : cname(v.owner_char))}</div><div class="price">${money(v.sale_price)}</div>
      <button class="btn sm ok" data-act="usado" data-id="${v.id}">Comprar</button></div>`).join('') || '<p class="empty">Nadie está vendiendo autos ahorita.</p>'}</div>`;
    if (tab === 'garaje') body = `<ul class="list">${vehs.filter(v => v.owner_char === S.char.id || myCos.includes(v.owner_company)).map(v => `<li><div><b>${esc(M[v.model_id]?.brand)} ${esc(M[v.model_id]?.model)}</b>
      <div class="muted">${v.plate ? 'Placa ' + esc(v.plate) : 'Sin placa'}${v.owner_company ? ' · Inventario de ' + esc(cos.find(c => c.id === v.owner_company)?.name) : ''}${v.sale_price != null ? ' · En venta ' + money(v.sale_price) : ''}</div></div>
      <button class="btn sm" data-act="vender" data-id="${v.id}">Vender</button></li>`).join('') || '<li class="muted">No tienes autos.</li>'}</ul>`;
    view(el, `${tabs([['catalogo', 'Agencia (nuevos)'], ['venta', 'En venta'], ['garaje', 'Mi garaje']], tab)}${body}`, {
      tab: d => this.render(el, d.t),
      cat: d => this.render(el, 'catalogo', d.c || ''),
      comprar: d => modal('Comprar ' + esc(M[d.id].model), `<form data-form="go" class="form">${accSelect(accs)}${fieldsHTML([{ k: 'qty', label: 'Cantidad (solo empresas, para inventario)', type: 'number', min: 1, def: 1 }])}<button class="btn ok" type="submit">Comprar</button></form>`, {
        async go(f, _, close) { const r = await db.rpc('buy', { kind: 'model', item: d.id, acc: f.acc, qty: f.qty || 1 }); toast('Pagaste ' + money(r) + ' 🚗'); close(); autos.render(el, 'garaje'); } }),
      usado: d => modal('Comprar auto', `<form data-form="go" class="form">${accSelect(accs)}<button class="btn ok" type="submit">Comprar</button></form>`, {
        async go(f, _, close) { await db.rpc('buy', { kind: 'vehicle', item: d.id, acc: f.acc }); close(); autos.render(el, 'garaje'); } }),
      vender: d => modal('Poner en venta', form('go', [{ k: 'price', label: 'Precio (vacío = quitar de venta)', type: 'number', min: 1 }]), {
        async go(f, _, close) { await db.rpc('list_item', { kind: 'vehicle', item: d.id, price: f.price }); close(); autos.render(el, 'garaje'); } }),
      nuevo: () => modal('Nuevo modelo', form('go', [{ k: 'brand', label: 'Marca', req: 1 }, { k: 'model', label: 'Modelo', req: 1 }, { k: 'category', label: 'Categoría' },
        { k: 'price', label: 'Precio', type: 'number', min: 1, req: 1 }, { k: 'img', label: 'Foto', type: 'file' }]), {
        async go(f, _, close) { await db.insert('vehicle_models', { ...f, custom: true }); close(); autos.render(el); } }),
      editar: d => modal('✏️ ' + esc(M[d.id].brand + ' ' + M[d.id].model), form('go', [{ k: 'price', label: 'Precio', type: 'number', min: 1, req: 1 }, { k: 'img', label: 'Foto del auto', type: 'file' }], M[d.id], 'Guardar'), {
        async go(f, _, close) { await db.update('vehicle_models', d.id, { price: f.price, ...(f.img ? { img: f.img } : {}) }); close(); autos.render(el); } }),
    });
  } };

// ============ ELECCIONES (FEC) ============
const fec = { id: 'fec', name: 'Vote.gov', icon: '🗳️', bg: '#b31942,#0a3161', url: 'vote.rp', show: () => true,
  async render(el, tab = 'votar') {
    if (typeof tab === 'object') tab = 'votar';
    const [els, votes, parties, cands] = await Promise.all([db.list('elections'), db.list('votes'), db.list('parties', { order: 'name', asc: true }), db.list('candidacies', { order: 'created_at', asc: true })]);
    const canAdmin = has('FEC') || lvl() >= 3, cfg = set('elecciones'), now = new Date(), dy = now.getDate();
    const per = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`, mes = d => d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1), curC = cands.filter(c => c.period === per);
    const party = id => parties.find(p => p.id === id), mine = parties.filter(p => S.chars.some(c => c.id === p.owner_char));
    const nm = id => S.all.some(c => c.id === id) ? cname(id) : id; // elecciones automáticas guardan el id de la vida
    const tag = id => { const c = cands.find(x => x.character_id === id), p = c && party(c.party_id); return c ? (p ? esc(p.siglas || p.name) : 'Independiente') : ''; };
    const pres = S.all.filter(c => c.status === 'active' && c.roles?.includes('Presidente'));
    const fase = dy <= cfg.registro_hasta ? `📝 <b>Registro de candidatos abierto</b> hasta el día ${cfg.registro_hasta} de ${mes(now)}. La votación es del ${cfg.votacion_desde} al ${cfg.votacion_hasta}.`
      : dy <= cfg.votacion_hasta ? (dy >= cfg.votacion_desde ? `🗳️ <b>Votación abierta</b> hasta el día ${cfg.votacion_hasta}. Una cuenta = un voto.` : `⏳ La votación empieza el día ${cfg.votacion_desde}.`)
      : `🏁 <b>Votación cerrada.</b> El ganador gobierna todo ${mes(next)} (toma posesión el 1).`;
    let body = '';
    if (tab === 'votar') body = `<div class="card"><p>${fase}</p><p class="muted">Presidente en funciones: <b>${pres.map(c => esc(cname(c.id))).join(', ') || 'vacante'}</b> · Cada mes hay elección y el mandato dura el mes siguiente completo.</p></div>`
      + (els.map(e => { const v = votes.filter(x => x.election_id === e.id), voted = v.some(x => x.user_id === S.me.id);
      return `<div class="card"><div class="row"><b>${esc(e.title)}</b>${e.open ? '<span class="tag on">Abierta</span>' : '<span class="tag">Cerrada</span>'}</div><div class="muted">${esc(e.office)}${e.winner ? ` · Ganador: <b>${esc(nm(e.winner))}</b>` : ''}</div>
      ${e.candidates.map(c => { const n = v.filter(x => x.choice === c).length; return `<div class="bar-row"><span>${esc(nm(c))} <small class="muted">${tag(c)}</small></span><div class="vbar"><i style="width:${v.length ? n / v.length * 100 : 0}%"></i></div><b>${n}</b>
        ${e.open && !voted && S.char?.status === 'active' ? `<button class="btn sm" data-act="votar" data-e="${e.id}" data-c="${esc(c)}">Votar</button>` : ''}</div>`; }).join('')}
      ${voted ? '<small class="muted">Ya votaste ✅</small>' : ''}${canAdmin && e.open ? `<button class="btn sm bad" data-act="cerrar" data-id="${e.id}">Cerrar elección</button>` : ''}</div>`; }).join('') || '<p class="empty">Todavía no hay elecciones.</p>');
    if (tab === 'candidatos') body = curC.map(c => `<div class="card row">${av(c.foto || S.all.find(x => x.id === c.character_id)?.skin_url)}<div class="grow"><b>${esc(cname(c.character_id))}</b> · ${tag(c.character_id)}
      <div class="muted">“${esc(c.slogan || '')}”</div><p>${esc(c.propuestas || '')}</p></div>${canAdmin ? `<button class="btn sm bad" data-act="baja" data-id="${c.id}">Dar de baja</button>` : ''}</div>`).join('') || `<p class="empty">Nadie se ha postulado para ${mes(now)}.</p>`;
    if (tab === 'partidos') body = parties.map(p => `<div class="card row">${av(p.logo)}<div class="grow"><b>${esc(p.name)} ${p.siglas ? '(' + esc(p.siglas) + ')' : ''}</b><div class="muted">${esc(p.ideologia || '')} · Dueño: ${esc(cname(p.owner_char) || '—')} · ${curC.filter(c => c.party_id === p.id).length} candidatos este mes</div></div></div>`).join('') || '<p class="empty">Sin partidos registrados.</p>';
    if (tab === 'postularme') body = !S.char ? '<p class="empty">Necesitas una vida activa.</p>' : dy > cfg.registro_hasta ? `<p class="empty">El registro cerró el día ${cfg.registro_hasta}. Vuelve el 1 de ${mes(next)}.</p>`
      : `<p>Te postulas a <b>Presidente</b> para ${mes(next)} como <b>${esc(cname(S.char.id))}</b>. Si vas con un partido, pide la contraseña a su dueño.</p>
        ${form('postular', [{ k: 'party', label: 'Partido', type: 'select', options: [['', 'Independiente (libre)'], ...parties.map(p => [p.id, p.name])] }, { k: 'pass', label: 'Contraseña del partido', type: 'password', help: 'Déjala vacía si vas independiente.' },
          { k: 'slogan', label: 'Slogan', req: 1 }, { k: 'propuestas', label: 'Propuestas', type: 'textarea', req: 1 }, { k: 'foto', label: 'Foto de campaña', type: 'file' }], {}, 'Registrar candidatura')}`;
    if (tab === 'mipartido') body = mine.map(p => `<div class="card"><b>${esc(p.name)}</b><p class="muted">Tus candidatos deben escribir esta contraseña al postularse. No se la des a quien no quieras en tu partido.</p>
      ${form('clave', [{ k: 'p', type: 'hidden', def: p.id, label: '' }, { k: 'pass', label: 'Nueva contraseña (mínimo 4)', type: 'password', req: 1 }], {}, 'Guardar contraseña')}
      <h4>Candidatos de ${mes(now)}</h4>${curC.filter(c => c.party_id === p.id).map(c => `<div>${esc(cname(c.character_id))}</div>`).join('') || '<p class="muted">Ninguno todavía.</p>'}</div>`).join('');
    if (tab === 'registro') body = `<div class="tiles"><button class="tile" data-act="t" data-k="partido"><span class="ico">🏛️</span><b>Registrar partido</b></button></div>
      ${canAdmin ? `<h3>Elección manual (FEC)</h3><p class="muted">La presidencial se abre y se cierra sola cada mes. Usa esto solo para otros cargos.</p>${form('crear', [{ k: 'title', label: 'Título', req: 1, ph: 'Elección de Gobernador' },
        { k: 'office', label: 'Cargo', type: 'select', options: ['VicePresidente', 'Gobernador', 'Senado', 'Cámara de Representantes'], req: 1 },
        { k: 'candidates', label: 'Candidatos (separados por coma)', req: 1 }], {}, 'Abrir elección')}<div class="fecq"></div>` : ''}`;
    view(el, `${tabs([['votar', 'Elecciones'], ['candidatos', 'Candidatos'], ['partidos', 'Partidos'], ['postularme', 'Postularme'], ...(mine.length ? [['mipartido', 'Mi partido']] : []), ['registro', 'Registrar']], tab)}${body}`, {
      tab: d => fec.render(el, d.t),
      async votar(d) { if (!S.char) return; await db.insert('votes', { election_id: d.e, character_id: S.char.id, choice: d.c, user_id: S.me.id }); toast('Voto registrado 🗳️'); fec.render(el); },
      cerrar: async d => { await db.update('elections', d.id, { open: false }); fec.render(el); },
      baja: async d => { await db.remove('candidacies', d.id); fec.render(el, 'candidatos'); },
      t: d => openTramite(d.k),
      async postular(d) { await db.rpc('run_for_office', { c: S.char.id, party: d.party || null, pass: d.pass || '', slogan: d.slogan, propuestas: d.propuestas, foto: d.foto || null }); toast('Candidatura registrada 📣'); fec.render(el, 'candidatos'); },
      async clave(d) { await db.rpc('set_party_pass', { p: d.p, pass: d.pass }); toast('Contraseña guardada 🔒'); fec.render(el, 'mipartido'); },
      async crear(d) {
        const cands = d.candidates.split(',').map(s => s.trim()).filter(Boolean);
        if (!cands.length) throw new Error('No hay candidatos');
        await db.insert('elections', { title: d.title, office: d.office, candidates: cands }); fec.render(el);
      },
    });
    if (tab === 'registro' && canAdmin) reviewQueue(el.querySelector('.fecq'), { types: ['partido'], title: 'Partidos por aprobar' });
  } };

// ============ CORTE ============
const corte = { id: 'corte', name: 'LA Courts', icon: '⚖️', bg: '#5b3a1e,#8c6239', url: 'lacourt.rp', show: () => true,
  async render(el, tab = 'mias') {
    if (typeof tab === 'object') tab = 'mias';
    const judge = has('Juez de Distrito', 'Corte Suprema', 'Tribunales Inferiores') || lvl() >= 3;
    const dem = (await myRequests()).filter(r => r.type === 'demanda');
    const dir = r => S.all.filter(c => c.status === 'active' && c.roles?.includes(r));
    let body = '';
    if (tab === 'mias') body = `<button class="btn" data-act="t" data-k="demanda">💥 Presentar demanda</button><ul class="list">${dem.map(r => `<li><div><b>Contra ${esc(cname(r.data.demandado))}</b> · ${esc(r.data.tipo)}
      <div class="muted">${r.note ? 'Juez: ' + esc(r.note) : fdate(r.created_at)}</div></div>${badge(r.status)}</li>`).join('')}</ul>`;
    if (tab === 'dir') body = ['Corte Suprema', 'Juez de Distrito', 'Abogado Público', 'Abogado Privado'].map(r => `<h3>${r}</h3><div class="people">${dir(r).map(c => `<span class="person">${av(c.skin_url, 'av sm')}${esc(c.first_name)} ${esc(c.last_name)}</span>`).join('') || '<span class="muted">Nadie</span>'}</div>`).join('')
      + `<div class="tiles"><button class="tile" data-act="t" data-k="licencia_abogado"><span class="ico">⚖️</span><b>Licencia de abogado</b></button><button class="tile" data-act="t" data-k="licencia_juez"><span class="ico">👨‍⚖️</span><b>Licencia de juez</b></button></div>`;
    view(el, `${tabs([['mias', 'Mis demandas'], ['dir', 'Jueces y abogados'], ...(judge ? [['juez', 'Juzgado']] : [])], tab)}<div class="tabbody">${body}</div>`, {
      tab: d => this.render(el, d.t), t: d => openTramite(d.k, {}, () => this.render(el)),
    });
    if (tab === 'juez') reviewQueue(el.querySelector('.tabbody'), { types: ['demanda', 'juicio'], title: 'Demandas y juicios penales (aprobar un juicio = culpable; rechazar = inocente)' });
  } };

// ============ POLICÍA (MDT) + PRISIÓN ============
const REC = { arresto: 'Arresto', multa: 'Multa', orden: 'Orden de arresto', advertencia: 'Advertencia' };
const KIND = { advertencia: 'Advertencias', infraccion: 'Infracciones (multa)', menor: 'Delitos menores', grave: 'Delitos graves' };
const isGuard = () => isPolice() || has('Custodio');
const left = i => Math.max(0, new Date(i.ends_at) - Date.now());
const clockTxt = ms => { const m = Math.ceil(ms / 6e4); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
const inPrison = i => i.status === 'en_prision' && left(i) > 0;
async function searchPeople(q) {
  q = q.trim().toLowerCase(); if (!q) return [];
  const [vehs, reqs] = await Promise.all([db.list('vehicles', { limit: 5000 }), db.list('requests', { eq: { status: 'approved' }, limit: 5000 })]);
  const hit = new Map(), add = (id, why) => { if (id && !hit.has(id)) hit.set(id, why); };
  for (const c of S.all) {
    if (`${c.first_name} ${c.last_name}`.toLowerCase().includes(q)) add(c.id, 'Nombre');
    if (docNumber(c, 'I').toLowerCase() === q) add(c.id, 'No. de identificación');
    if (docNumber(c, 'D').toLowerCase() === q) add(c.id, 'No. de licencia');
    if (c.id.slice(0, 8).toLowerCase() === q) add(c.id, 'Folio de registro');
  }
  vehs.filter(v => v.plate?.toLowerCase() === q).forEach(v => add(v.owner_char, 'Placa ' + v.plate));
  reqs.filter(r => r.type === 'placa' && r.data.placa?.toLowerCase() === q).forEach(r => add(r.character_id, 'Placa ' + r.data.placa.toUpperCase()));
  reqs.filter(r => r.type === 'registro_arma' && r.data.serie?.toLowerCase() === q).forEach(r => add(r.character_id, 'Arma serie ' + r.data.serie));
  return [...hit].map(([id, why]) => ({ c: S.all.find(x => x.id === id), why })).filter(x => x.c);
}
const policia = { id: 'policia', name: 'LAPD MDT', icon: '🚓', bg: '#141e30,#243b55', show: isPolice,
  async render(el, st = { tab: 'buscar' }) {
    if (!sessionStorage.getItem('mdt')) return view(el, `<div class="login-mini"><img class="mdt-badge" src="img/favicon.png" alt=""><h2>LAPD · Mobile Data Terminal</h2>
      <p>Oficial: <b>${esc(S.char ? cname(S.char.id) : S.me.username)}</b></p><p class="muted">Placa #${(S.char?.id || S.me.id).slice(0, 5).toUpperCase()}</p>
      <button class="btn" data-act="in">Iniciar sesión</button></div>`, { in: () => { sessionStorage.setItem('mdt', 1); this.render(el); } });
    const go = p => policia.render(el, { ...st, ...p });
    const code = await db.list('penal_code', { order: 'code', asc: true });
    let body = '';
    if (st.tab === 'buscar') {
      const res = await searchPeople(st.q || '');
      body = `<form data-form="buscar" class="row"><input name="q" value="${esc(st.q || '')}" placeholder="Nombre, No. de identificación o licencia, placa, serie de arma o folio" required autofocus><button class="btn">Buscar</button></form>
        ${st.q && !res.length ? '<p class="empty">Sin coincidencias.</p>' : ''}
        ${res.map(({ c, why }) => `<button class="result" data-act="ver" data-id="${c.id}">${av(c.skin_url, 'av sm')}<div><b>${esc(c.first_name)} ${esc(c.last_name)}</b><div class="muted">Coincide por: ${esc(why)}</div></div>${badge(c.status)}</button>`).join('')}`;
    } else if (st.tab === 'ver') {
      const c = S.all.find(x => x.id === st.id), [recs, reqs, vehs, models, inm] = await Promise.all([db.list('records', { eq: { character_id: c.id } }),
        db.list('requests', { eq: { character_id: c.id, status: 'approved' } }), db.list('vehicles', { eq: { owner_char: c.id } }), db.list('vehicle_models', { order: null }), db.list('inmates', { eq: { character_id: c.id } })]);
      const f = st.f || 'todos', shown = recs.filter(r => f === 'todos' || r.kind === f), jail = inm.find(inPrison);
      const lic = reqs.filter(r => ['dni', 'licencia_conducir', 'licencia_armas', 'registro_arma', 'visa', 'pasaporte', 'placa'].includes(r.type));
      body = `<button class="link" data-act="tab" data-t="buscar">‹ Volver</button><div class="card row">${av(c.skin_url, 'big-av')}<div class="grow"><h3>${esc(c.first_name)} ${esc(c.last_name)}</h3>
        <div class="muted">Nac. ${esc(c.dob)} · ${esc(c.sex)} · ${esc(c.city)} · ${esc(c.nationality)}${c.extranjero ? ' · Extranjero' : ''}</div>
        <div class="muted">ID ${docNumber(c, 'I')} · Licencia ${docNumber(c, 'D')} · Folio ${c.id.slice(0, 8).toUpperCase()}</div>
        ${jail ? `<div class="alert">EN PRISIÓN · le faltan ${clockTxt(left(jail))}. Si está en la calle sin fuga aprobada, repórtalo al staff (warn administrativo).
          <button class="btn sm bad" data-act="reportar" data-id="${jail.id}">Reportar al staff</button></div>` : ''}
        ${recs.some(r => r.kind === 'orden' && !r.paid) ? '<div class="alert">ORDEN DE ARRESTO ACTIVA</div>' : ''}</div></div>
        <h3>Documentos</h3><ul class="list">${lic.map(r => `<li><span class="li-ico">${ico(r.type)}</span><span class="grow">${esc(TRAMITES[r.type].name)} ${esc(r.data.clase || r.data.tipo || r.data.arma || r.data.placa || '')}</span></li>`).join('') || '<li class="muted">Sin documentos</li>'}</ul>
        <h3>Vehículos</h3><ul class="list">${vehs.map(v => { const m = models.find(x => x.id === v.model_id); return `<li>${esc(m?.brand)} ${esc(m?.model)} · ${esc(v.plate || 'sin placa')}</li>`; }).join('') || '<li class="muted">Ninguno</li>'}</ul>
        <h3>Antecedentes</h3><div class="chips">${['todos', 'advertencia', 'multa', 'arresto', 'orden'].map(k => `<button data-act="f" data-f="${k}" class="${f === k ? 'on' : ''}">${k === 'todos' ? 'Todos' : REC[k]} (${k === 'todos' ? recs.length : recs.filter(r => r.kind === k).length})</button>`).join('')}</div>
        <ul class="list">${shown.map(r => `<li><div class="grow"><b>${REC[r.kind] || esc(r.kind)}</b> ${r.amount ? money(r.amount) : ''} ${r.paid ? `<span class="tag">${r.kind === 'orden' ? 'Cumplida' : 'Pagada'}</span>` : ''}
          <div>${esc(r.description)}</div><div class="muted">${fdate(r.created_at)} · Oficial ${esc(cname(r.officer_id))}</div></div>
          ${r.kind === 'orden' && !r.paid ? `<button class="btn sm" data-act="cumplir" data-id="${r.id}">Cumplida</button>` : ''}</li>`).join('') || '<li class="muted">Limpio</li>'}</ul>
        <h3>Procesar</h3><form data-form="procesar" class="form">${fieldsHTML([{ k: 'kind', label: 'Acción', type: 'select', req: 1, def: 'multa',
          options: [['advertencia', 'Advertencia'], ['multa', 'Multa'], ['arresto', 'Arresto (multa + prisión)'], ['orden', 'Orden de arresto']] }])}
          <div class="charges">${Object.entries(KIND).map(([k, l]) => `<details ${k === 'infraccion' ? 'open' : ''}><summary>${l}</summary>${code.filter(x => x.kind === k).map(x => `<label class="chk charge"><input type="checkbox" name="cargo" value="${esc(x.code)}" data-fine="${x.fine}" data-years="${x.years}">
            <b>${esc(x.code)}</b> ${esc(x.title)}<span class="grow"></span><small>${x.fine ? money(x.fine * cpi()) : ''}${x.years ? ` · ${x.years} año${x.years > 1 ? 's' : ''}` : ''}</small></label>`).join('')}</details>`).join('')}</div>
          <div class="totals" data-totals>Selecciona cargos</div>${fieldsHTML([{ k: 'description', label: 'Narrativa / detalles', type: 'textarea', req: 1 }])}
          <button class="btn" type="submit">Registrar</button></form>`;
    } else if (st.tab === 'buscados') {
      const o = await db.list('records', { eq: { kind: 'orden', paid: false } });
      body = `<div class="grid-cards">${o.map(r => `<div class="card prop wanted" data-act="ver" data-id="${r.character_id}"><b>SE BUSCA</b>${av(skin(r.character_id), 'big-av')}<b>${esc(cname(r.character_id))}</b><small>${esc(r.description)}</small></div>`).join('') || '<p class="empty">Nadie buscado.</p>'}</div>`;
    }
    view(el, `${tabs([['buscar', 'Consultar'], ['buscados', 'Buscados'], ['pend', 'Trámites']], st.tab === 'ver' ? 'buscar' : st.tab)}<div class="tabbody">${body}</div>`, {
      tab: d => go({ tab: d.t, q: '' }), buscar: d => go({ q: d.q }), ver: d => go({ tab: 'ver', id: d.id, f: 'todos' }), f: d => go({ f: d.f }),
      cumplir: async d => { await db.update('records', d.id, { paid: true }); go({}); },
      async reportar(d) {
        await db.insert('requests', { type: 'warn_prision', dept: ['staff:mod'], character_id: S.char?.id || st.id, data: { preso_id: st.id, preso: cname(st.id), lugar: prompt('¿Dónde lo viste?') || '—', detalle: `Preso visto fuera de prisión (registro ${d.id.slice(0, 8)})` } });
        toast('Reporte enviado al staff');
      },
      async procesar(v, form) {
        const picked = [...form.querySelectorAll('[name=cargo]:checked')].map(i => code.find(x => x.code === i.value));
        if (!picked.length && v.kind !== 'orden') throw new Error('Selecciona al menos un cargo');
        const fine = picked.reduce((s, x) => s + Number(x.fine), 0) * cpi(), years = picked.reduce((s, x) => s + Number(x.years), 0);
        const charges = picked.map(x => ({ code: x.code, title: x.title })), desc = `${charges.map(x => x.code + ' ' + x.title).join(', ')}${v.description ? ' — ' + v.description : ''}`;
        if (v.kind === 'arresto' && years >= Number(set('trial_years'))) {
          await db.insert('requests', { type: 'juicio', dept: TRAMITES.juicio.dept, character_id: st.id, data: { acusado: cname(st.id), cargos: desc, anos: years, multa: Math.round(fine), oficial: cname(S.char?.id), charges } });
          await db.insert('records', { kind: 'orden', character_id: st.id, officer_id: S.char?.id || null, description: 'En espera de juicio: ' + desc, charges });
          return toast(`Son ${years} años: requiere juicio. Se envió el caso a los jueces.`), go({});
        }
        await db.insert('records', { kind: v.kind === 'advertencia' ? 'advertencia' : v.kind, character_id: st.id, officer_id: S.char?.id || null, amount: v.kind === 'multa' || v.kind === 'arresto' ? Math.round(fine) : null, description: desc, charges });
        if (v.kind === 'arresto' && years > 0) {
          const minutes = years * Number(set('prison_min_per_year'));
          await db.insert('inmates', { character_id: st.id, officer_id: S.char?.id || null, charges, years, minutes, started_at: new Date().toISOString(), ends_at: new Date(Date.now() + minutes * 6e4).toISOString(), status: 'en_prision' });
          toast(`Arrestado: ${years} años = ${minutes} min reales. El contador ya empezó.`);
        } else toast('Registrado');
        go({});
      },
    });
    const box = el.querySelector('[data-totals]');
    el.querySelector('.charges')?.addEventListener('change', () => {
      const p = [...el.querySelectorAll('[name=cargo]:checked')], f = p.reduce((s, i) => s + Number(i.dataset.fine), 0) * cpi(), y = p.reduce((s, i) => s + Number(i.dataset.years), 0);
      box.innerHTML = p.length ? `Multa total <b>${money(f)}</b> · Prisión <b>${y} años</b> (${y * Number(set('prison_min_per_year'))} min reales)${y >= Number(set('trial_years')) ? ' · <b class="neg">requiere juicio</b>' : ''}` : 'Selecciona cargos';
    });
    if (st.tab === 'pend') reviewQueue(el.querySelector('.tabbody'), { types: ['dni', 'licencia_conducir', 'licencia_armas', 'placa'], title: 'Trámites en comisaría',
      extra: r => `<button class="link" data-act="ver" data-id="${r.character_id}">ver antecedentes</button>` });
  } };

const prision = { id: 'prision', name: 'LA County Jail', icon: '🔒', bg: '#4a4a4a,#1f1f1f', show: () => isGuard() || lvl() >= 2 || S.chars.some(c => c.status === 'active'),
  async render(el) {
    const inm = await db.list('inmates', { limit: 500 }), can = isGuard() || lvl() >= 2;
    const now = inm.filter(inPrison), past = inm.filter(i => !inPrison(i)).slice(0, 30);
    const mine = now.filter(i => S.chars.some(c => c.id === i.character_id));
    view(el, `<div class="jail-h"><b>Los Angeles County Jail</b><span>${now.length} reclusos</span></div>
      ${mine.map(i => `<div class="alert">Tu vida <b>${esc(cname(i.character_id))}</b> está en prisión. Le faltan <b data-left="${i.ends_at}">${clockTxt(left(i))}</b>. Si entras al servidor, debes estar dentro de la prisión.</div>`).join('')}
      <p class="muted">La condena corre desde el arresto, aunque el preso no esté conectado. 1 año = ${set('prison_min_per_year')} minutos reales. Desde ${set('trial_years')} años decide un juez.</p>
      <table class="tbl"><thead><tr><th>Recluso</th><th>Cargos</th><th>Condena</th><th>Le falta</th>${can ? '<th></th>' : ''}</tr></thead><tbody>
      ${now.map(i => `<tr><td>${av(skin(i.character_id), 'av sm')} ${esc(cname(i.character_id))}</td><td>${(i.charges || []).map(x => esc(x.code)).join(', ')}</td><td>${i.years} años</td>
        <td><b data-left="${i.ends_at}">${clockTxt(left(i))}</b></td>${can ? `<td class="nowrap"><button class="btn sm" data-act="libre" data-id="${i.id}">Liberar</button><button class="btn sm bad" data-act="fuga" data-id="${i.id}">Fuga aprobada</button></td>` : ''}</tr>`).join('') || `<tr><td colspan="5" class="muted">Nadie en prisión.</td></tr>`}</tbody></table>
      <h3>Historial</h3><ul class="list">${past.map(i => `<li><span class="grow">${esc(cname(i.character_id))} · ${i.years} años</span>${badge(i.status === 'en_prision' ? 'cumplida' : i.status)}</li>`).join('') || '<li class="muted">Sin historial</li>'}</ul>`, {
      async libre(d) { await db.update('inmates', d.id, { status: 'liberado', ends_at: new Date().toISOString(), note: 'Liberado por ' + (cname(S.char?.id) || S.me.username) }); prision.render(el); },
      async fuga(d) {
        if (!confirm('¿Registrar fuga APROBADA por el staff? Se le pondrá orden de arresto.')) return;
        const i = inm.find(x => x.id === d.id);
        await db.update('inmates', d.id, { status: 'fugado', note: 'Fuga aprobada' });
        await db.insert('records', { kind: 'orden', character_id: i.character_id, officer_id: S.char?.id || null, description: 'G-29 Fuga de prisión', charges: [{ code: 'G-29', title: 'Fuga de prisión' }] });
        prision.render(el);
      },
    });
    clearInterval(el._t); el._t = setInterval(() => { if (!el.isConnected) return clearInterval(el._t); el.querySelectorAll('[data-left]').forEach(b => b.textContent = clockTxt(Math.max(0, new Date(b.dataset.left) - Date.now()))); }, 15000);
  } };

// ============ TAXI ============
const taxi = { id: 'taxi', name: 'Uber', icon: '🚕', bg: '#000000,#262626', show: () => true,
  async render(el) {
    if (!needChar(el)) return;
    const mine = (await myRequests()).filter(r => r.type === 'taxi').slice(0, 5);
    view(el, `<button class="btn" data-act="pedir">🚕 Pedir un taxi</button><ul class="list">${mine.map(r => `<li>${esc(r.data.origen)} → ${esc(r.data.destino)} ${badge(r.status)} ${r.note ? esc(r.note) : ''}</li>`).join('')}</ul>
      ${has('Taxi') ? '<div class="q"></div>' : ''}`, { pedir: () => openTramite('taxi', {}, () => this.render(el)) });
    if (has('Taxi')) reviewQueue(el.querySelector('.q'), { types: ['taxi'], title: 'Viajes solicitados (aprobar = aceptar viaje)' });
  } };

// ============ SOPORTE ============
const soporte = { id: 'soporte', name: 'Soporte', icon: '🆘', bg: '#ee0979,#ff6a00', show: () => true,
  async render(el) {
    const t = await db.list('tickets', { eq: { user_id: S.me.id } });
    view(el, `<p class="muted">Escribe tu problema y un helper lo tomará o te dirigirá con quien pueda ayudarte.</p>
      ${form('nuevo', [{ k: 'subject', label: 'Asunto', type: 'select', options: ['Verificación', 'Personaje / second role', 'Reporte de usuario', 'Apelación de ban', 'Dinero / banco', 'Bug de la web', 'Otro'], req: 1 },
        { k: 'body', label: 'Cuéntanos', type: 'textarea', req: 1 }], {}, 'Abrir ticket')}
      ${t.map(x => ticketHTML(x)).join('')}`, {
      async nuevo(d) { await db.insert('tickets', { ...d, user_id: S.me.id }); toast('Ticket abierto'); soporte.render(el); },
      async reply(d) { const x = t.find(y => y.id === d.id), body = el.querySelector(`[data-r="${d.id}"]`).value.trim(); if (!body) return;
        await db.update('tickets', x.id, { replies: [...x.replies, { by: S.me.username, body, at: new Date().toISOString() }] }); soporte.render(el); },
    });
  } };
const ticketHTML = (x, staff) => `<div class="card"><div class="row"><b>#${x.id.slice(0, 5)} · ${esc(x.subject)}</b>${badge(x.status)}</div>
  <div class="muted">${staff ? 'De ' + esc(x._user || '') + ' · ' : ''}${fdate(x.created_at)}${x.assigned_to ? ' · Atiende: ' + esc(x._staff || '') : ''}</div><p>${esc(x.body)}</p>
  ${x.replies.map(r => `<div class="msg ${r.by === S.me.username ? 'me' : ''}"><b>${esc(r.by)}:</b> ${esc(r.body)}<small>${fdate(r.at)}</small></div>`).join('')}
  ${x.status !== 'cerrado' ? `<div class="row"><input data-r="${x.id}" placeholder="Responder…"><button class="btn sm" data-act="reply" data-id="${x.id}">Enviar</button></div>` : ''}
  ${staff && x.status !== 'cerrado' ? `<div class="row gap">${!x.assigned_to ? `<button class="btn sm" data-act="tomar" data-id="${x.id}">Tomar</button>` : ''}
    <select data-asg="${x.id}"><option value="">Redirigir a…</option>${staff.map(s => `<option value="${s.id}">${esc(s.username)} (${STAFF_NAME[s.staff_role]})</option>`).join('')}</select>
    <button class="btn sm" data-act="redir" data-id="${x.id}">Redirigir</button><button class="btn sm bad" data-act="cerrarT" data-id="${x.id}">Cerrar</button></div>` : ''}</div>`;

// ============ CALIFICAR STAFF ============
const resenas = { id: 'resenas', name: 'Staff', icon: '⭐', bg: '#ff9f0a,#ff6b00', show: () => true,
  async render(el) {
    const [staff, revs] = await Promise.all([db.list('profiles', { order: 'username', asc: true }), db.list('reviews', { eq: { target_kind: 'mod' } })]);
    const list = staff.filter(p => p.staff_role).sort((a, b) => LVL[b.staff_role] - LVL[a.staff_role]);
    const r = id => revs.filter(x => x.target_id === id), avg = id => r(id).length ? r(id).reduce((s, x) => s + x.stars, 0) / r(id).length : 0;
    view(el, `<div class="grid-cards">${list.map(p => `<div class="card prop">${av(p.avatar_url, 'big-av')}<b>${esc(p.username)}</b><span class="tag">${STAFF_NAME[p.staff_role]}</span>
      <div class="stars big">${stars(avg(p.id))}</div><small class="muted">${r(p.id).length} reseñas</small>
      <button class="btn sm" data-act="ver" data-id="${p.id}">Ver / calificar</button></div>`).join('') || '<p class="empty">Sin staff aún.</p>'}</div>`, {
      ver: d => { const p = list.find(x => x.id === d.id);
        modal('⭐ ' + esc(p.username), `${r(p.id).map(x => `<div class="card"><span class="stars">${stars(x.stars)}</span> ${esc(x.body)} <small class="muted">${fdate(x.created_at)}</small></div>`).join('') || '<p class="muted">Sin reseñas.</p>'}
          ${p.id !== S.me.id ? form('rev', [{ k: 'stars', label: 'Calificación', type: 'select', options: [5, 4, 3, 2, 1].map(n => [n, '★'.repeat(n)]), req: 1 }, { k: 'body', label: '¿Cómo te atendió?', type: 'textarea', req: 1 }], {}, 'Enviar reseña') : ''}`, {
          async rev(f, _, close) { await db.insert('reviews', { target_kind: 'mod', target_id: p.id, stars: +f.stars, body: f.body, user_id: S.me.id }); close(); resenas.render(el); } }); },
    });
  } };

// ============ ROBSTORE ============
const robstore = { id: 'robstore', name: 'App Store', icon: '🛍️', bg: '#1fa2ff,#0a6cff', show: () => true,
  async render(el) {
    const apps = await db.list('store_apps');
    view(el, `<div class="row"><p class="muted">Apps hechas por la comunidad. Sube tu app en un archivo HTML y el staff la revisa.</p>${S.char?.status === 'active' ? '<button class="btn sm" data-act="subir">+ Subir app</button>' : ''}</div>
      <div class="tiles">${apps.filter(a => a.approved).map(a => `<button class="tile" data-act="abrir" data-id="${a.id}"><span class="ico">${esc(a.icon || '📱')}</span><b>${esc(a.name)}</b><small>${esc(cname(a.author_char))}</small></button>`).join('') || '<p class="empty">Aún no hay apps.</p>'}</div>
      ${apps.some(a => !a.approved) ? `<h3>En revisión</h3><ul class="list">${apps.filter(a => !a.approved).map(a => `<li>${esc(a.icon)} ${esc(a.name)} · ${esc(cname(a.author_char))}
        <span>${lvl() >= 2 ? `<button class="btn sm" data-act="abrir" data-id="${a.id}">Probar</button><button class="btn sm ok" data-act="ok" data-id="${a.id}">Aprobar</button><button class="btn sm bad" data-act="del" data-id="${a.id}">Rechazar</button>` : badge('pending')}</span></li>`).join('')}</ul>` : ''}`, {
      abrir: d => { const a = apps.find(x => x.id === d.id); modal(esc(a.name), '<iframe class="appframe" sandbox="allow-scripts allow-forms" title="app"></iframe>'); [...document.querySelectorAll('.appframe')].pop().srcdoc = a.html; },
      subir: () => modal('Subir app', form('up', [{ k: 'name', label: 'Nombre', req: 1 }, { k: 'icon', label: 'Ícono (emoji)', def: '📱', req: 1 },
        { k: 'file', label: 'Archivo .html', type: 'textfile' }, { k: 'html', label: '…o pega el HTML aquí', type: 'textarea' }]), {
        async up(f, _, close) { const html = f.file || f.html; if (!html) throw new Error('Falta el HTML');
          await db.insert('store_apps', { name: f.name, icon: f.icon, html, author_char: S.char.id }); close(); toast('Enviada a revisión'); robstore.render(el); } }),
      ok: async d => { await db.update('store_apps', d.id, { approved: true }); this.render(el); },
      del: async d => { await db.remove('store_apps', d.id); this.render(el); },
    });
  } };

// ============ AJUSTES ============
const ajustes = { id: 'ajustes', name: 'Ajustes', icon: '⚙️', bg: '#8e8e93,#636366', show: () => true,
  async render(el) {
    let saved = {}; try { saved = JSON.parse(localStorage.getItem('rp_login') || '{}'); if (saved.u !== S.me.username) saved = {}; } catch {}
    view(el, `<div class="card row">${av(S.me.avatar_url)}<div><b>${esc(S.me.username)}</b><div class="muted">Roblox: ${esc(S.me.roblox)} · Discord: ${esc(S.me.discord)}</div>
      ${S.me.staff_role ? `<span class="tag on">${STAFF_NAME[S.me.staff_role]}</span>` : ''}</div></div>
      <h3>Fondo de pantalla</h3><div class="walls">${WALLPAPERS.map(w => `<button class="wall" style="background:${esc(w)} center/cover" data-act="wall" data-w="${esc(w)}" aria-label="Fondo"></button>`).join('')}</div>
      <form data-form="foto" class="row"><input type="file" name="img" accept="image/*" required><button class="btn sm">Usar mi foto de fondo</button></form>
      <h3>Foto de perfil</h3><form data-form="avatar" class="row"><input type="file" name="img" accept="image/*" required><button class="btn sm">Cambiar</button></form>
      <h3>Mi cuenta</h3><div class="card acct"><div class="kv"><small>Usuario para iniciar sesión</small><b>${esc(S.me.username)}</b></div>
        <div class="kv"><small>Contraseña</small><b class="pw">${saved.p ? '•'.repeat(Math.min(saved.p.length, 12)) : '<span class="muted">No guardada en este dispositivo</span>'}</b>
          ${saved.p ? '<button class="btn sm ghost" data-act="ver">Mostrar</button>' : ''}</div>
        <small class="muted">Por seguridad tu contraseña no se guarda en el servidor: solo la recordamos en este dispositivo para que puedas consultarla. Si la olvidas, cámbiala aquí.</small>
        ${form('pass', [{ k: 'p', label: 'Nueva contraseña', type: 'password', req: 1 }, { k: 'p2', label: 'Repítela', type: 'password', req: 1 }], {}, 'Cambiar contraseña')}</div>
      <button class="btn bad" data-act="salir">Cerrar sesión</button>`, {
      ver: (_, b) => { const s = el.querySelector('.pw'), on = b.textContent === 'Mostrar'; s.textContent = on ? saved.p : '•'.repeat(Math.min(saved.p.length, 12)); b.textContent = on ? 'Ocultar' : 'Mostrar'; },
      async pass(d) { if (d.p.length < 6) throw new Error('Mínimo 6 caracteres'); if (d.p !== d.p2) throw new Error('No coinciden');
        await db.setPassword(d.p); localStorage.setItem('rp_login', JSON.stringify({ u: S.me.username, p: d.p })); toast('Contraseña cambiada 🔒'); ajustes.render(el); },
      wall: async d => { await db.update('profiles', S.me.id, { wallpaper: d.w }); location.reload(); },
      foto: async d => { await db.update('profiles', S.me.id, { wallpaper: `url("${d.img}")` }); location.reload(); },
      avatar: async d => { await db.update('profiles', S.me.id, { avatar_url: d.img }); location.reload(); },
      salir: async () => { localStorage.removeItem('rp_login'); await db.signOut(); location.reload(); },
    });
  } };

// ============ PANEL DE STAFF ============
const mins = (sh, from) => sh.filter(s => new Date(s.ended_at || Date.now()) > from)
  .reduce((m, s) => m + (new Date(s.ended_at || Date.now()) - Math.max(new Date(s.started_at), from)) / 6e4, 0);
const staffApp = { id: 'staff', name: 'Panel Staff', icon: '🛡️', bg: '#8e2de2,#4a00e0', show: () => lvl() >= 1,
  async badge() { return (await db.list('requests', { eq: { status: 'pending' }, overlaps: { dept: S.tags.filter(t => t.startsWith('staff:')) } })).length; },
  async render(el, tab = 'aprob') {
    const L = lvl(), profiles = await db.list('profiles', { order: 'username', asc: true }), staff = profiles.filter(p => p.staff_role);
    const go = t => this.render(el, t);
    const T = [['aprob', 'Aprobaciones'], ['users', 'Usuarios'], ['act', 'Actividad'], ['sanc', 'Sanciones'], ['tickets', 'Soporte'], ...(L >= 3 ? [['eco', 'Economía'], ['icons', 'Íconos']] : []), ...(L >= 5 ? [['cfg', 'Configuración']] : [])];
    const acts = { tab: d => go(d.t) };
    let body = '';

    if (tab === 'aprob') {
      const pendP = profiles.filter(p => !p.verified), pendC = S.all.filter(c => c.status === 'pending');
      const visas = L >= 3 ? await db.list('requests', { eq: { type: 'visa', status: 'approved' } }) : [];
      const migr = S.all.filter(c => c.status === 'active' && c.extranjero && !c.roles.includes('Migrante') && !visas.some(v => v.character_id === c.id)
        && (Date.now() - new Date(c.created_at)) / 864e5 > set('visa_days'));
      body = `${L >= 3 ? `<h3>Cuentas por verificar (${pendP.length})</h3>${pendP.map(p => `<div class="card row">${av(p.avatar_url)}<div class="grow"><b>${esc(p.username)}</b>
          <div class="muted">Roblox: <b>${esc(p.roblox)}</b> · Discord: <b>${esc(p.discord)}</b> · ${fdate(p.created_at)}</div></div>
          <button class="btn sm ok" data-act="verif" data-id="${p.id}">Verificar</button><button class="btn sm bad" data-act="banP" data-id="${p.id}">Banear</button></div>`).join('') || '<p class="muted">Nada.</p>'}
        <h3>Vidas por aprobar (${pendC.length})</h3>${pendC.map(c => `<div class="card row">${av(c.skin_url, 'big-av')}<div class="grow"><b>${esc(c.first_name)} ${esc(c.last_name)}</b>
          <div class="muted">Usuario: ${esc(profiles.find(p => p.id === c.user_id)?.username)} · Roblox ${esc(profiles.find(p => p.id === c.user_id)?.roblox)} · Discord ${esc(profiles.find(p => p.id === c.user_id)?.discord)}</div>
          <div>Nac. ${esc(c.dob)} · ${esc(c.sex)} · ${esc(c.city)} · ${esc(c.nationality)} ${c.extranjero ? '<span class="tag on">🧳 Extranjero</span>' : ''}</div><p>${esc(c.bio)}</p></div>
          <div class="col"><button class="btn sm ok" data-act="aprobC" data-id="${c.id}">Aprobar</button><button class="btn sm bad" data-act="rechC" data-id="${c.id}">Rechazar</button></div></div>`).join('') || '<p class="muted">Nada.</p>'}
        ${migr.length ? `<h3>🚨 Extranjeros sin visa (plazo de ${set('visa_days')} días vencido)</h3>${migr.map(c => `<div class="card row"><b class="grow">${esc(c.first_name)} ${esc(c.last_name)}</b>
          <button class="btn sm bad" data-act="migr" data-id="${c.id}">Marcar migrante</button></div>`).join('')}` : ''}` : ''}<div class="q"></div>`;
      Object.assign(acts, {
        verif: async d => { await db.update('profiles', d.id, { verified: true }); toast('Cuenta verificada'); go('aprob'); },
        banP: async d => { await db.update('profiles', d.id, { banned: true }); go('aprob'); },
        aprobC: d => { const c = S.all.find(x => x.id === d.id);
          modal(`Aprobar a ${esc(c.first_name)}`, `<form data-form="ok" class="form">${rolesPicker(c.extranjero ? ['Extranjero'] : ['Ciudadano'])}
            ${fieldsHTML([{ k: 'money', label: 'Dinero inicial', type: 'number', min: 0, def: set('start_money') }])}<button class="btn ok" type="submit">Aprobar vida</button></form>`, {
            async ok(_, f, close) {
              const roles = [...f.querySelectorAll('[name=role]:checked')].map(i => i.value), m = Number(f.money.value || 0);
              await db.update('characters', c.id, { status: 'active', roles });
              const acc = await db.insert('accounts', { kind: 'personal', name: c.first_name + ' ' + c.last_name, owners: [c.id] });
              if (m > 0) await db.rpc('staff_pay', { acc: acc.id, amount: m, concept: 'Dinero inicial', mint: true });
              close(); toast(`Aprobada. Ponle en Discord: ${roles.join(', ')}${c.extranjero ? ' · Recuérdale sacar su visa en ' + set('visa_days') + ' días' : ''}`); if (c.user_id === S.me.id) return window.refreshShell?.('staff'); // es mi vida: activarla al instante
              S.all = await db.list('characters', { order: 'first_name', asc: true }); go('aprob');
            } }); },
        rechC: async d => { await db.update('characters', d.id, { status: 'rejected' }); S.all = await db.list('characters', { order: 'first_name', asc: true }); go('aprob'); },
        migr: async d => { await addRole(d.id, 'Migrante'); toast('Marcado. Ponle en Discord el rol de Migrante.'); S.all = await db.list('characters', { order: 'first_name', asc: true }); go('aprob'); },
      });
    }

    if (tab === 'users') {
      body = `<input class="filter" placeholder="Filtrar por usuario / roblox / discord…" data-filter>${profiles.map(p => `<div class="card urow" data-s="${esc((p.username + ' ' + p.roblox + ' ' + p.discord).toLowerCase())}">
        <div class="row">${av(p.avatar_url, 'av sm')}<b class="grow">${esc(p.username)}</b><span class="muted">${esc(p.roblox)} · ${esc(p.discord)}</span>
        ${p.verified ? '' : '<span class="tag">Sin verificar</span>'}${p.banned ? '<span class="tag bad">Baneado</span>' : ''}</div>
        ${L >= 3 ? `<div class="row gap"><select data-role="${p.id}">${[['', 'Sin rango'], ...STAFF.filter(([, , n]) => n < L || L === 5).map(([k, l]) => [k, l])].map(([k, l]) => `<option value="${k}" ${p.staff_role === k || (!p.staff_role && !k) ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <button class="btn sm" data-act="setRole" data-id="${p.id}">Guardar rango</button><button class="btn sm ${p.banned ? 'ok' : 'bad'}" data-act="tban" data-id="${p.id}" data-b="${p.banned ? '' : '1'}">${p.banned ? 'Desbanear' : 'Banear'}</button>${L >= 5 && p.id !== S.me.id ? `<button class="btn sm bad" data-act="delU" data-id="${p.id}">Eliminar cuenta</button>` : ''}</div>` : ''}
        ${S.all.filter(c => c.user_id === p.id).map(c => `<div class="row sub">${av(c.skin_url, 'av sm')}<span class="grow">${esc(c.first_name)} ${esc(c.last_name)} ${badge(c.status)} ${(c.roles || []).map(r => `<span class="tag">${esc(r)}</span>`).join('')}</span>
          ${L >= 3 ? `<button class="btn sm" data-act="editC" data-id="${c.id}">Roles / estado</button>` : ''}</div>`).join('')}</div>`).join('')}`;
      Object.assign(acts, {
        setRole: async d => { await db.update('profiles', d.id, { staff_role: el.querySelector(`[data-role="${d.id}"]`).value || null }); toast('Rango actualizado. Recuerda ponerlo en Discord.'); go('users'); },
        tban: async d => { await db.update('profiles', d.id, { banned: !!d.b }); go('users'); },
        delU: async d => { const p = profiles.find(x => x.id === d.id);
          if (prompt(`Esto ELIMINA para siempre la cuenta "${p.username}" con todas sus vidas, dinero, casas, autos, trámites y antecedentes. No se puede deshacer. Escribe ELIMINAR para confirmar.`) !== 'ELIMINAR') return;
          try { await db.rpc('delete_user', { u: d.id }); } catch (e) { return toast(e.message); }
          S.all = await db.list('characters', { order: 'first_name', asc: true }); toast('Cuenta eliminada'); go('users'); window.liveRefresh?.(); },
        editC: d => { const c = S.all.find(x => x.id === d.id);
          modal(`Editar vida · ${esc(c.first_name)} ${esc(c.last_name)}`, `<form data-form="save" class="form">${fieldsHTML([
            { k: 'first_name', label: 'Nombre(s)', req: 1 }, { k: 'last_name', label: 'Apellido(s)', req: 1 }, { k: 'dob', label: 'Nacimiento', type: 'date', req: 1 },
            { k: 'sex', label: 'Sexo', type: 'select', options: ['Masculino', 'Femenino'], req: 1 }, { k: 'city', label: 'Ciudad', type: 'select', options: CITIES, req: 1 },
            { k: 'nationality', label: 'Nacionalidad', req: 1 }, { k: 'status', label: 'Estado', type: 'select', options: Object.entries(ST).filter(([k]) => ['pending', 'active', 'dead', 'rejected'].includes(k)), req: 1 },
            { k: 'skin_url', label: 'Cambiar foto', type: 'file' }, { k: 'bio', label: 'Historia', type: 'textarea' }], c)}
            <h4>Roles</h4>${rolesPicker(c.roles)}<div class="row"><button type="button" class="btn bad" data-act="del">Borrar vida</button><span class="grow"></span><button class="btn" type="submit">Guardar</button></div></form>`, {
            async save(v, f, close) {
              const { role, ...rest } = v; if (!rest.skin_url) delete rest.skin_url;
              await db.update('characters', c.id, { ...rest, roles: [...f.querySelectorAll('[name=role]:checked')].map(i => i.value) });
              close(); S.all = await db.list('characters', { order: 'first_name', asc: true }); toast('Guardado. Actualiza sus roles en Discord.'); go('users'); },
            async del(_, __, close) {
              if (prompt(`Esto borra la vida "${c.first_name} ${c.last_name}" con sus trámites, empleos y antecedentes. Escribe BORRAR para confirmar.`) !== 'BORRAR') return;
              try { await db.rpc('delete_char', { c: c.id }); } catch (e) { return toast(e.message); } close(); S.all = await db.list('characters', { order: 'first_name', asc: true }); toast('Vida borrada'); go('users'); window.liveRefresh?.(); },
          }); },
      });
    }

    if (tab === 'act') {
      const sh = await db.list('shifts'), q = set('quotas'), now = new Date();
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate()), week = new Date(day - ((day.getDay() + 6) % 7) * 864e5), month = new Date(now.getFullYear(), now.getMonth(), 1);
      const cell = (m, goal) => `<td class="${goal && m < goal ? 'neg' : 'pos'}">${Math.round(m)}${goal ? ' / ' + goal : ''} min</td>`;
      body = `<table class="tbl"><thead><tr><th>Staff</th><th>Rango</th><th>Estado</th><th>Hoy</th><th>Semana</th><th>Mes</th></tr></thead><tbody>
        ${staff.map(p => { const s = sh.filter(x => x.user_id === p.id), g = q[p.staff_role] || {}; return `<tr><td>${esc(p.username)}</td><td>${STAFF_NAME[p.staff_role]}</td>
          <td>${s.some(x => !x.ended_at) ? '🟢 En servicio' : '⚫'}</td>${cell(mins(s, day), g.dia)}${cell(mins(s, week), g.semana)}${cell(mins(s, month), g.mes)}</tr>`; }).join('')}</tbody></table>
        ${L >= 3 ? `<h3>Mínimos de actividad (minutos)</h3><form data-form="quotas" class="form"><table class="tbl"><tr><th>Rango</th><th>Día</th><th>Semana</th><th>Mes</th></tr>
          ${STAFF.map(([k, l]) => `<tr><td>${l}</td>${['dia', 'semana', 'mes'].map(p => `<td><input type="number" min="0" name="${k}.${p}" value="${q[k]?.[p] ?? 0}"></td>`).join('')}</tr>`).join('')}</table>
          <button class="btn" type="submit">Guardar mínimos</button></form>` : ''}`;
      acts.quotas = async d => { const o = {}; for (const [k, v] of Object.entries(d)) { const [r, p] = k.split('.'); (o[r] ??= {})[p] = v || 0; }
        await db.upsert('settings', { key: 'quotas', value: o }); S.settings.quotas = o; toast('Guardado'); go('act'); };
    }

    if (tab === 'sanc') {
      const bans = await db.list('bans'), K = { ban: '🔨 Ban', warn: '⚠️ Warn', aislamiento: '🔇 Aislamiento', blacklist: '🚫 Black-list', vetado: '🥊 Vetado del staff' };
      body = `${L >= 2 ? form('add', [{ k: 'kind', label: 'Tipo', type: 'select', options: Object.entries(K), req: 1 }, { k: 'username', label: 'Usuario de la web' },
        { k: 'roblox', label: 'Roblox' }, { k: 'discord', label: 'Discord' }, { k: 'reason', label: 'Motivo / pruebas', type: 'textarea', req: 1 }, { k: 'until', label: 'Hasta (vacío = permanente)', type: 'date' }], {}, 'Registrar sanción') : ''}
        <table class="tbl"><thead><tr><th>Tipo</th><th>Usuario</th><th>Roblox</th><th>Discord</th><th>Motivo</th><th>Hasta</th><th>Por</th><th></th></tr></thead><tbody>
        ${bans.map(b => `<tr><td>${K[b.kind] || esc(b.kind)}</td><td>${esc(b.username)}</td><td>${esc(b.roblox)}</td><td>${esc(b.discord)}</td><td>${esc(b.reason)}</td><td>${esc(b.until || 'Perm.')}</td>
          <td>${esc(profiles.find(p => p.id === b.by_user)?.username)}</td><td>${L >= 3 ? `<button class="link" data-act="quitar" data-id="${b.id}">Quitar</button>` : ''}</td></tr>`).join('')}</tbody></table>`;
      Object.assign(acts, {
        async add(d) { await db.insert('bans', { ...d, until: d.until || null, by_user: S.me.id });
          const p = d.kind === 'ban' && profiles.find(x => x.username === d.username || (d.roblox && x.roblox === d.roblox));
          if (p && L >= 3) await db.update('profiles', p.id, { banned: true });
          toast('Sanción registrada. Aplícala también en Discord.'); go('sanc'); },
        quitar: async d => { await db.remove('bans', d.id); go('sanc'); },
      });
    }

    if (tab === 'tickets') {
      const t = await db.list('tickets');
      t.forEach(x => { x._user = profiles.find(p => p.id === x.user_id)?.username; x._staff = profiles.find(p => p.id === x.assigned_to)?.username; });
      body = t.filter(x => x.status !== 'cerrado').map(x => ticketHTML(x, staff)).join('') || '<p class="empty">Sin tickets abiertos 🎉</p>';
      const upd = async (id, p) => { await db.update('tickets', id, p); go('tickets'); };
      Object.assign(acts, {
        tomar: d => upd(d.id, { assigned_to: S.me.id, status: 'tomado' }),
        redir: d => { const v = el.querySelector(`[data-asg="${d.id}"]`).value; if (v) upd(d.id, { assigned_to: v, status: 'tomado' }); },
        cerrarT: d => upd(d.id, { status: 'cerrado' }),
        reply: d => { const x = t.find(y => y.id === d.id), body = el.querySelector(`[data-r="${d.id}"]`).value.trim(); if (body) upd(d.id, { replies: [...x.replies, { by: S.me.username, body, at: new Date().toISOString() }] }); },
      });
    }

    if (tab === 'eco') {
      const govAcc = (await db.list('accounts', { eq: { kind: 'gov' } }))[0], robos = set('robos');
      const depts = [...new Set(S.ranks.map(r => r.dept))];
      body = `<div class="fin"><div><small>Tesorería de Los Ángeles</small><b>${money(govAcc?.balance)}</b></div><div><small>Índice de precios (CPI)</small><b>${cpi().toFixed(4)}</b></div>
        <div><small>Tasa Reserva Federal</small><b>${set('fed_rate')}%</b></div><div><small>Turno mínimo diario</small><b>${set('job_min_minutes')} min</b></div></div>
        <p class="muted">Los sueldos se pagan solos cada día desde la Tesorería (pago diario = sueldo anual ÷ 365 × inflación) a quien cumplió su turno mínimo el día anterior o está de vacaciones. Quien pasa 7 días sin cumplir es despedido.</p>
        <div class="row"><button class="btn" data-act="tick">Correr cierre del día ahora</button>${L >= 4 ? '<button class="btn bad" data-act="printm">Emitir dinero</button>' : ''}</div>
        <h3>Sueldos por rango (anuales, USD)</h3><form data-form="ranks" class="form">${depts.map(d => `<details><summary><b>${esc(d)}</b> · ${rankList(d).length} rangos</summary><table class="tbl"><tr><th>Rango</th><th>Sueldo anual</th><th>Mando</th></tr>
          ${rankList(d).map(r => `<tr><td>${esc(r.rank)}</td><td><input type="number" min="0" name="${esc(d)}|${esc(r.rank)}" value="${r.salary}"></td><td>${r.manage ? 'Sí' : ''}</td></tr>`).join('')}</table></details>`).join('') || '<p class="muted">Carga los datos base en Configuración.</p>'}
          <button class="btn" type="submit">Guardar sueldos</button></form>
        <h3>Dar / quitar dinero</h3>${form('give', [{ k: 'char', label: 'Personaje', type: 'select', options: charOpts(), req: 1 }, { k: 'amount', label: 'Monto (negativo = quitar)', type: 'number', req: 1 }, { k: 'concept', label: 'Concepto', req: 1 }], {}, 'Aplicar')}
        <h3>Pago por robo aprobado (rango aleatorio)</h3><form data-form="robos" class="form"><table class="tbl"><tr><th>Robo</th><th>Mínimo</th><th>Máximo</th></tr>
          ${Object.entries(robos).map(([k, [a, b]]) => `<tr><td>${esc(k)}</td><td><input type="number" min="0" name="${esc(k)}.0" value="${a}"></td><td><input type="number" min="0" name="${esc(k)}.1" value="${b}"></td></tr>`).join('')}</table>
          <button class="btn" type="submit">Guardar rangos</button></form>
        <h3>Ingresos diarios de negocios (los paga el Tesoro según el giro)</h3><form data-form="biz" class="form"><table class="tbl"><tr><th>Giro</th><th>USD por día</th></tr>
          ${Object.entries(set('biz_income') || {}).map(([k, v]) => `<tr><td>${esc(k)}</td><td><input type="number" min="0" name="${esc(k)}" value="${v}"></td></tr>`).join('')}</table>
          <label class="fld"><span>Pago a influencers por cada like (USD)</span><input type="number" min="0" name="__like" value="${set('influencer_like_pay') ?? 15}"></label>
          <button class="btn" type="submit">Guardar</button></form>
        <h3>Otros</h3>${form('otros', [{ k: 'start_money', label: 'Dinero inicial de cada vida', type: 'number', min: 0, req: 1 }, { k: 'visa_days', label: 'Días para que un extranjero registre visa', type: 'number', min: 1, req: 1 },
          { k: 'job_min_minutes', label: 'Minutos mínimos de turno al día', type: 'number', min: 1, req: 1 }, { k: 'fed_rate', label: 'Tasa de la Reserva Federal (%)', type: 'number', min: 0, max: 25, req: 1 },
          { k: 'prison_min_per_year', label: 'Minutos reales por cada año de prisión', type: 'number', min: 1, req: 1 }, { k: 'trial_years', label: 'Años a partir de los cuales hay juicio', type: 'number', min: 1, req: 1 }],
          { start_money: set('start_money'), visa_days: set('visa_days'), job_min_minutes: set('job_min_minutes'), fed_rate: set('fed_rate'), prison_min_per_year: set('prison_min_per_year'), trial_years: set('trial_years') }, 'Guardar')}`;
      const save = async (key, value) => { await db.upsert('settings', { key, value }); S.settings[key] = value; };
      Object.assign(acts, {
        async tick() { toast('Cierre del día: ' + await db.rpc('daily_tick', {})); go('eco'); },
        async printm() { const a = Number(prompt('¿Cuánto dinero emitir? (genera inflación)', '1000000000')); if (!(a > 0)) return; S.settings.cpi = await db.rpc('print_money', { amount: a }); go('eco'); },
        async ranks(d) { for (const [k, v] of Object.entries(d)) { const [dept, rank] = k.split('|'), r = S.ranks.find(x => x.dept === dept && x.rank === rank);
            if (r && Number(v) !== Number(r.salary)) { await db.upsert('dept_ranks', { ...r, salary: Number(v) }, 'dept,rank'); r.salary = Number(v); } } toast('Sueldos guardados'); go('eco'); },
        async give(d) { const acc = (await db.list('accounts', { eq: { kind: 'personal' }, contains: { owners: [d.char] } }))[0];
          if (!acc) throw new Error('Ese personaje no tiene cuenta'); await db.rpc('staff_pay', { acc: acc.id, amount: d.amount, concept: d.concept }); toast('Listo'); },
        biz: async d => { const { __like, ...o } = d; for (const k in o) o[k] = Number(o[k]); await save('biz_income', o); await save('influencer_like_pay', Number(__like)); toast('Guardado'); go('eco'); },
        robos: async d => { const o = {}; for (const [k, v] of Object.entries(d)) { const i = k.lastIndexOf('.'); (o[k.slice(0, i)] ??= [0, 0])[+k.slice(i + 1)] = v || 0; } await save('robos', o); toast('Guardado'); go('eco'); },
        otros: async d => { for (const k of ['start_money', 'visa_days', 'job_min_minutes', 'prison_min_per_year', 'trial_years']) await save(k, d[k]); await db.rpc('set_fed_rate', { rate: d.fed_rate }); S.settings.fed_rate = d.fed_rate; toast('Guardado'); go('eco'); },
      });
    }

    if (tab === 'icons') {
      body = `<h3>Íconos de las apps</h3><p class="muted">Sube tu propia imagen (PNG cuadrado) para el ícono de cualquier app. Solo usa imágenes que tengas derecho a usar.</p>
        ${form('icon', [{ k: 'app', label: 'App', type: 'select', options: APPS.map(a => [a.id, a.name]), req: 1 }, { k: 'url', label: 'Imagen', type: 'file', req: 1 }], {}, 'Guardar ícono')}
        ${Object.keys(set('app_icons') || {}).length ? `<div class="row gap">${Object.entries(set('app_icons')).map(([id, u]) => `<span class="tag"><img src="${esc(u)}" alt="" style="width:18px;height:18px;border-radius:4px;vertical-align:middle"> ${esc(APPS.find(a => a.id === id)?.name || id)} <a href="#" data-act="iconDel" data-id="${esc(id)}">✕</a></span>`).join('')}</div>` : ''}`;
      const saveIcons = async o => { await db.upsert('settings', { key: 'app_icons', value: o }); S.settings.app_icons = o; window.refreshShell?.('staff'); };
      Object.assign(acts, {
        icon: d => saveIcons({ ...(set('app_icons') || {}), [d.app]: d.url }),
        iconDel: d => { const o = { ...(set('app_icons') || {}) }; delete o[d.id]; saveIcons(o); },
      });
    }

    if (tab === 'cfg') {
      body = `<p>Carga o actualiza los datos base: quién aprueba cada trámite, ajustes por defecto, y (si están vacíos) autos, casas y trabajos del gobierno de ejemplo.</p>
        <button class="btn" data-act="seed">Cargar / actualizar datos base</button>
        <h3>Código penal</h3><form data-form="penal" class="form"><table class="tbl"><tr><th>Código</th><th>Delito</th><th>Tipo</th><th>Multa base</th><th>Años</th></tr>
        ${(await db.list('penal_code', { order: 'code', asc: true })).map(x => `<tr><td>${esc(x.code)}</td><td><input name="${esc(x.code)}|title" value="${esc(x.title)}"></td><td>${esc(x.kind)}</td>
          <td><input type="number" min="0" name="${esc(x.code)}|fine" value="${x.fine}"></td><td><input type="number" min="0" step="any" name="${esc(x.code)}|years" value="${x.years}"></td></tr>`).join('')}</table>
        <button class="btn" type="submit">Guardar código penal</button></form>
        <h4>Agregar artículo</h4>${form('penalNew', [{ k: 'code', label: 'Código', req: 1, ph: 'G-31' }, { k: 'title', label: 'Delito', req: 1 },
          { k: 'kind', label: 'Tipo', type: 'select', options: [['advertencia', 'Advertencia'], ['infraccion', 'Infracción'], ['menor', 'Delito menor'], ['grave', 'Delito grave']], req: 1 },
          { k: 'fine', label: 'Multa', type: 'number', min: 0, def: 0 }, { k: 'years', label: 'Años de prisión', type: 'number', min: 0, def: 0 }], {}, 'Agregar')}`;
      Object.assign(acts, {
        async penal(d) { const rows = {}; for (const [k, v] of Object.entries(d)) { const [code, f] = k.split('|'); (rows[code] ??= { code })[f] = f === 'title' ? v : Number(v); }
          for (const r of Object.values(rows)) await db.upsert('penal_code', r, 'code'); toast('Código penal guardado'); go('cfg'); },
        async penalNew(d) { await db.upsert('penal_code', d, 'code'); toast('Artículo agregado'); go('cfg'); },
      });
      acts.seed = async () => { await seed(); toast('Datos base cargados ✅'); };
    }

    view(el, `${tabs(T, tab)}<div class="tabbody">${body}</div>`, acts);
    el.querySelector('[data-filter]')?.addEventListener('input', e => el.querySelectorAll('.urow').forEach(r => r.hidden = !r.dataset.s.includes(e.target.value.toLowerCase())));
    if (tab === 'aprob') reviewQueue(el.querySelector('.q'), { title: 'Trámites para staff' });
  } };
const rolesPicker = cur => `<div class="roles">${Object.entries(ROLES).map(([g, rs]) => `<fieldset><legend>${g}</legend>${rs.map(r => `<label class="chk"><input type="checkbox" name="role" value="${esc(r)}" ${cur.includes(r) || r === 'Ciudadano' ? 'checked' : ''} ${r === 'Ciudadano' ? 'disabled title="Toda vida es ciudadana"' : ''}> ${esc(r)}</label>`).join('')}</fieldset>`).join('')}</div>`;

export async function seed() {
  for (const [type, t] of Object.entries(TRAMITES)) await db.upsert('tramite_depts', { type, dept: t.dept }, 'type');
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) if (S.settings[key] === undefined) await db.upsert('settings', { key, value });
  const models = await db.list('vehicle_models', { order: null, limit: 1000 }), used = new Set((await db.list('vehicles', { limit: 5000 })).map(v => v.model_id));
  const key = (b, m) => (b + '|' + m).toLowerCase(), want = new Set(SEED_MODELS.map(([b, m]) => key(b, m)));
  for (const m of models) if (!want.has(key(m.brand, m.model)) && !used.has(m.id) && !m.custom) await db.remove('vehicle_models', m.id); // quita los de ejemplo viejos
  const have = new Set(models.map(m => key(m.brand, m.model)));
  for (const [brand, model, category, price, img] of SEED_MODELS) {
    const cur = models.find(m => key(m.brand, m.model) === key(brand, model));
    if (!cur) await db.insert('vehicle_models', { brand, model, category, price, img: img || null });
    else if (img && !cur.custom && cur.img !== img) await db.update('vehicle_models', cur.id, { img }); // foto real del juego
  }
  const props = await db.list('properties', { order: null, limit: 1000 });
  const OLD = ['Casa Springfield #1', 'Casa Springfield #2', 'Casa River City #1', 'Casa River City #2', 'Mansión Hills', 'Departamento Centro']; // casas de ejemplo de versiones anteriores
  for (const p of props) if (OLD.includes(p.name) && !p.owner_char && !p.owner_company) await db.remove('properties', p.id);
  for (const [name, zone, price, img] of SEED_PROPS) { const p = props.find(x => x.name === name); p ? p.img !== img && await db.update('properties', p.id, { img }) : await db.insert('properties', { name, zone, price, img, kind: 'casa' }); }
  for (const [dept, list] of Object.entries(DEPTS)) for (const [i, [rank, salary, manage]] of list.entries())
    if (!S.ranks.some(r => r.dept === dept && r.rank === rank)) await db.upsert('dept_ranks', { dept, rank, ord: i, salary, manage: !!manage }, 'dept,rank');
  const jobs = await db.list('jobs', { limit: 1000 });
  for (const [title, employer, role_tag] of SEED_JOBS) if (!jobs.some(j => j.role_tag === role_tag)) await db.insert('jobs', { title, employer, role_tag, description: 'Trabajo de gobierno con sueldo diario. Al ser aceptado entras con el rango más bajo; tus mandos te pueden ascender.' });
  const pc = await db.list('penal_code', { order: null, limit: 1000 });
  for (const [code, title, kind, fine, years] of PENAL_CODE) if (!pc.some(x => x.code === code)) await db.upsert('penal_code', { code, title, kind, fine, years }, 'code');
  if (!(await db.list('companies', { eq: { industry: 'ETF' } })).length) await db.insert('companies', { name: 'LA500 ETF', industry: 'ETF', owners: [], description: 'Fondo que sigue el promedio de todas las empresas de Los Ángeles.' });
  const g = (await db.list('accounts', { eq: { kind: 'gov' } }))[0];
  if (g && Number(g.balance) === 0) await db.rpc('staff_pay', { acc: g.id, amount: 13950000000, concept: 'Presupuesto inicial FY 2025-26', mint: true });
}

export const APPS = [vida, banco, gobierno, safari, docs, trabajo, mensajes,
  social('x', 'X', '𝕏', '#000000,#1c1c1c', false), social('insta', 'Instagram', '📸', '#833ab4,#fd1d1d,#fcb045', true),
  news, buscar, empleos, bolsa, casas, autos, fec, corte, policia, prision, taxi, soporte, resenas, robstore, staffApp, ajustes];
