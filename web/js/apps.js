// Todas las apps del sistema. Cada una: { id, name, icon, bg, show(), render(el) }
import * as db from './db.js';
import { sharePrice, coOut, coPremium, coFair, coBook, etfNav, creditCap } from './db.js';
import { GAME_DAY_MS, gameDay, gameStart, fgame, freal, courtNews, S, cpi, esc, money, fdate, lvl, has, isPolice, set, cname, charOpts, toast, modal, ask, view, form, fieldsHTML, readForm, downloadImage,
  myRequests, approvedOf, requestHTML, reviewQueue, tabs, needChar, myAccounts, accSelect, stars, addRole } from './core.js';
import { openWizardOverlay } from './vida.js';
import { openTramite } from './portal.js';
import { ico } from './icons.js';
import { birthCert, idCard, passport, visa, vehicleReg, diploma, docNumber, homeCountry, homePassport, ssnCard, deathCert, will } from './docs.js';
import { incomeTax, CK_RULES, JOB_DESC, TRAMITES, ROLES, STAFF, STAFF_NAME, LVL, CITIES, NATIONS, SHOP, SHOP_STORES, GUN_CLASSES, WALLPAPERS, DEFAULT_SETTINGS, SEED_MODELS, SEED_PROPS, SEED_JOBS, CAR_PHOTOS, DEPTS, PENAL_CODE } from './data.js';

const ST = { preventiva: 'Prisión preventiva', revoked: 'Cancelado por la policía', cumplida: 'Cumplida', liberado: 'Liberado', fugado: 'Fugado', en_prision: 'En prisión', pending: 'Pendiente', active: 'Activo', dead: 'CK', rejected: 'Rechazado', approved: 'Aprobado', abierto: 'Abierto', tomado: 'En atención', cerrado: 'Cerrado', vacation: 'Vacaciones' };
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
    // familia, heredero y herencias de la vida en uso
    const me = S.char?.status === 'active' ? S.char : null;
    const [fams, fmem, inh] = me ? await Promise.all([db.list('families', { order: null }).catch(() => []), db.list('family_members', { order: null, limit: 5000 }).catch(() => []), db.list('inheritances', { limit: 20 }).catch(() => [])]) : [[], [], []];
    const myF = fmem.find(m => m.character_id === me?.id && m.status === 'active'), fam = myF && fams.find(f => f.id === myF.family_id), invites = fmem.filter(m => m.character_id === me?.id && m.status === 'pending');
    const others = charOpts(c => c.status === 'active' && c.id !== me?.id);
    const ROUTE = { heredero: 'a su heredero', familia: 'a su familia', siguiente_vida: 'esperando tu siguiente vida', tesoreria: 'a la Tesorería' };
    const famHTML = !me ? '' : `<h3>👨‍👩‍👧 Familia</h3>
      ${invites.map(i => `<div class="card row"><span class="grow">📩 Te invitaron a la familia <b>${esc(fams.find(f => f.id === i.family_id)?.name || '')}</b> como <b>${esc(i.relation)}</b> (de ${esc(cname(i.invited_by))})</span>
        <button class="btn sm ok" data-act="famsi" data-f="${i.family_id}">Aceptar</button><button class="btn sm ghost" data-act="famno" data-f="${i.family_id}">Rechazar</button></div>`).join('')}
      ${fam ? `<div class="card"><div class="row"><b class="grow">Familia ${esc(fam.name)}</b><button class="btn sm ghost" data-act="famsalir">Salir</button></div>
          <ul class="list">${fmem.filter(m => m.family_id === fam.id).map(m => `<li>${av(skin(m.character_id), 'av sm')} <span class="grow">${esc(cname(m.character_id))}</span><span class="tag">${esc(m.relation)}</span>${m.status === 'pending' ? badge('pending') : ''}</li>`).join('')}</ul>
          <form class="row form" data-form="faminv"><select name="who" required><option value="">Invitar a…</option>${others.map(([i, n]) => `<option value="${i}">${esc(n)}</option>`).join('')}</select>
            <select name="relation">${['Esposo/a', 'Pareja', 'Hijo/a', 'Padre', 'Madre', 'Hermano/a', 'Abuelo/a', 'Nieto/a', 'Tío/a', 'Primo/a', 'Familiar'].map(r => `<option>${r}</option>`).join('')}</select><button class="btn sm">Invitar</button></form>
          <p class="muted">La familia tiene su propio grupo en Mensajes. Si mueres sin heredero, tu familia se reparte tu dinero y tus bienes.</p></div>`
        : `<form class="card row form" data-form="famnueva"><input name="name" placeholder="Apellido o nombre de tu familia" required><button class="btn">Crear familia</button></form>`}
      <h3>📜 Heredero</h3><form class="card row form" data-form="heredero"><span class="grow muted">Si tu personaje muere, todo lo tuyo pasa a:</span>
        <select name="h"><option value="">— Nadie (va a mi familia) —</option>${others.map(([i, n]) => `<option value="${i}" ${me.heir === i ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select><button class="btn sm">Guardar</button></form>
      ${inh.length ? `<h3>Herencias</h3><ul class="list">${inh.map(i => `<li><span class="grow">⚱️ Herencia de <b>${esc(cname(i.from_char))}</b> ${ROUTE[i.route] || i.route}${i.recipients?.length ? ': ' + i.recipients.map(r => esc(cname(r))).join(', ') : ''}
        <small class="muted">${fdate(i.created_at)}${i.debt_paid > 0 ? ' · deudas pagadas ' + money(i.debt_paid) : ''}</small></span><b>${money(i.money)}</b></li>`).join('')}</ul>` : ''}`;
    view(el, `<div class="row"><h3 class="grow">Mis vidas</h3><button class="btn" data-act="nuevo">+ Nueva vida</button></div>
      <p class="muted">Cada vida (second role) es una persona distinta en la ciudad, aunque uses el mismo Roblox. Un admin debe aprobarla.</p>
      ${alive.map(c => card(c) + (c.status === 'active' && S.char?.id !== c.id ? `<button class="btn sm" data-act="usar" data-id="${c.id}">Usar esta vida</button>` : S.char?.id === c.id ? '<span class="tag on">En uso</span>' : '')
        + (c.status === 'active' ? `<button class="btn sm ghost" data-act="autock" data-id="${c.id}">Auto-CK</button>` : '') + '</div>').join('')
        || '<p class="empty">No tienes vidas activas. Crea una nueva.</p>'}
      ${famHTML}
      ${dead.length ? `<h3>Vidas perdidas (CK)</h3><p class="muted">Esta vida ya no se puede usar. Al morir se pagaron sus deudas y su dinero y bienes pasaron a su heredero, a su familia o a tu siguiente vida (si la registras en 7 días); si no, a la Tesorería.</p>
        ${dead.map(c => card(c) + `<button class="btn sm ghost" data-act="defuncion" data-id="${c.id}">⚰️ Acta de defunción</button>` + (autos.some(r => r.character_id === c.id && r.type === 'autock') ? '<span class="tag">Auto-CK</span>' : appeals.some(r => r.character_id === c.id && r.status === 'pending') ? badge('pending') : `<button class="btn sm" data-act="apelar" data-id="${c.id}">Apelar CK</button>`) + (lvl() >= 3 ? `<button class="btn sm bad" data-act="borrar" data-id="${c.id}">Borrar</button>` : '') + '</div>').join('')}` : ''}`, {
      borrar: async d => { if (!await ask('¿Borrar esta vida para siempre? Ya no se podrá apelar.')) return;
        try { await db.rpc('delete_char', { c: d.id }); } catch (e) { return toast(e.message); } toast('Vida borrada'); await window.liveRefresh?.(); vida.render(el); },
      nuevo: openWizardOverlay,
      defuncion: async d => { const c = S.chars.find(x => x.id === d.id), auto = autos.find(r => r.character_id === c.id && r.type === 'autock'), inhr = (await db.list('inheritances', { order: null }).catch(() => [])).find(i => i.from_char === c.id);
        modal('Acta de defunción', `<div class="doc big">${deathCert(c, { date: auto?.created_at || inhr?.created_at, cause: auto ? 'Auto-CK' + (auto.data?.motivo ? ' · ' + auto.data.motivo : '') : 'Homicidio (CK)', place: auto?.data?.lugar })}</div>`); },
      famnueva: async f => { await db.rpc('family_create', { c: me.id, name: f.name }); toast('Familia creada 👨‍👩‍👧 (y su grupo en Mensajes)'); vida.render(el); },
      faminv: async f => { await db.rpc('family_invite', { c: me.id, who: f.who, relation: f.relation }); toast('Invitación enviada'); vida.render(el); },
      famsi: async d => { await db.rpc('family_respond', { c: me.id, f: d.f, accept: true }); toast('¡Ya eres parte de la familia!'); vida.render(el); },
      famno: async d => { await db.rpc('family_respond', { c: me.id, f: d.f, accept: false }); vida.render(el); },
      famsalir: async () => { if (!await ask('¿Salir de tu familia?')) return; await db.rpc('family_leave', { c: me.id }); vida.render(el); },
      heredero: async f => { await db.rpc('set_heir', { c: me.id, h: f.h || null }); toast(f.h ? 'Heredero guardado' : 'Sin heredero: todo irá a tu familia'); await window.liveRefresh?.(); vida.render(el); },
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
const accLabel = a => a.kind === 'personal' ? 'Cuenta personal' : a.kind === 'savings' ? 'Cuenta de ahorro' : a.kind === 'encrypted' ? 'Cuenta encriptada 🔐' : 'Cuenta empresarial · ' + a.name;
const banco = { id: 'banco', name: 'RRVA', icon: '🏦', bg: '#004481,#1464a5', show: () => true,
  async render(el, st = { tab: 'mov' }) {
    if (!needChar(el)) return;
    const [accs, ords, jail] = await Promise.all([myAccounts(), db.list('records', { eq: { character_id: S.char.id, kind: 'orden', paid: false } }).catch(() => []),
      db.list('inmates', { eq: { character_id: S.char.id } }).catch(() => [])]);
    const wanted = ords.length > 0, jailed = jail.some(i => i.status === 'preventiva' || (i.status === 'en_prision' && new Date(i.ends_at) > Date.now()));
    const frozen = a => jailed || (wanted && ['personal', 'savings'].includes(a.kind)); // igual que acc_guard en el servidor
    const cur = accs.find(a => a.id === st.acc) || (wanted && accs.find(a => a.kind === 'encrypted')) || accs[0];
    if (!cur) { el.innerHTML = '<p class="empty">Tu cuenta RRVA se abre cuando un admin aprueba tu vida.</p>'; return; }
    el.classList.toggle('deep', cur.kind === 'encrypted' && st.tab !== 'credito'); // la cuenta encriptada se ve tipo deep web
    const go = p => banco.render(el, { ...st, acc: cur.id, ...p });
    const FK = 'rrva_favs_' + S.char.id, favs = JSON.parse(localStorage.getItem(FK) || '[]');
    let body = '';
    if (st.tab === 'mov') {
      const tx = [...await db.list('transactions', { eq: { from_acc: cur.id } }), ...await db.list('transactions', { eq: { to_acc: cur.id } })]
        .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 80);
      body = tx.length ? `<ul class="list mov">${tx.map(t => { const out = t.from_acc === cur.id; return `<li><span class="mv-ico ${out ? 'out' : 'in'}">${out ? '↗' : '↙'}</span><div class="grow"><b>${esc(t.concept)}</b><div class="muted">${fdate(t.created_at)}</div></div>
        <b class="${out ? 'neg' : 'pos'}">${out ? '−' : '+'}${money(t.amount)}</b></li>`; }).join('')}</ul>` : '<p class="empty">Sin movimientos todavía.</p>';
    } else if (st.tab === 'send' && frozen(cur)) {
      body = `<div class="notice frz"><b>🔒 Esta cuenta está congelada.</b> ${jailed ? 'Estás en prisión: no puedes mover tu dinero hasta que salgas.' : 'Tienes una orden de arresto activa. Usa tu <b>Cuenta encriptada 🔐</b> para transferir.'}</div>`;
    } else if (st.tab === 'send') {
      const tx = st.tx || {}, step = st.step || 'dest';
      if (step === 'dest') body = `<div class="tx"><h3>Nueva transferencia</h3><p class="muted">Desde ${esc(accLabel(cur))} ${last4(cur.number)}</p>
        <form data-form="dest" class="form">${fieldsHTML([{ k: 'number', label: 'Número de cuenta RRVA o nombre del beneficiario', req: 1, ph: '10 dígitos o nombre y apellido', help: 'Puedes pegar el número con espacios o escribir el nombre de la persona.' }])}
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
      const sav = accs.find(a => a.kind === 'savings'), rate = Number(set('savings_rate'));
      body = `<div class="tx"><h3>Cuenta de ahorro RRVA</h3><p class="muted">Tu dinero gana <b>${rate}% anual</b>, pagado cada día del juego (cada 2 horas reales). La inflación acumulada de la ciudad es ${((cpi() - 1) * 100).toFixed(2)}%.</p>
        ${sav ? `<dl class="rcpt"><dt>Saldo</dt><dd>${money(sav.balance)}</dd><dt>Número de cuenta</dt><dd>${sav.number}</dd><dt>Interés por día del juego</dt><dd class="pos">+${money(sav.balance * rate / 100 / 365)}</dd><dt>Interés por día real (12 días del juego)</dt><dd class="pos">+${money(sav.balance * rate / 100 / 365 * 12)}</dd></dl>
          <p class="muted">Para ahorrar, transfiere desde tu cuenta personal al número ${sav.number}. Para retirar, elige "Ahorro" arriba y transfiere a tu cuenta personal.</p>`
        : `<button class="btn big" data-act="ahorro">Abrir cuenta de ahorro</button>`}</div>`;
    } else if (st.tab === 'multas') {
      const f = (await db.list('records', { eq: { character_id: S.char.id } })).filter(r => (r.kind === 'multa' || r.kind === 'arresto') && Number(r.amount) > 0);
      body = (f.some(r => !r.paid) ? '<p class="muted">Las multas se cobran solas de tu cuenta personal en cuanto te entra dinero. Lo que falta se ve como saldo negativo y la Tesorería solo recibe lo que pagas.</p>' : '') + (f.length ? `<ul class="list">${f.map(r => `<li><div><b>${r.kind === 'arresto' ? '🚔 ' : ''}${esc(r.description)}</b><div class="muted">${fdate(r.created_at)}${!r.paid && r.collected > 0 ? ` · pagado ${money(r.collected)} de ${money(r.amount)}` : ''}</div></div>
        <span>${money(r.amount - (r.paid ? 0 : Number(r.collected || 0)))} ${r.paid ? '<span class="tag">Pagada</span>' : `<span class="neg">debes</span> <button class="btn sm" data-act="pagar" data-id="${r.id}">Pagar</button>`}</span></li>`).join('')}</ul>` : '<p class="empty">No tienes multas.</p>');
    } else if (st.tab === 'imp') {
      const txs = (await db.list('transactions', { eq: { from_acc: cur.id }, limit: 500 })).filter(t => /^Impuesto/.test(t.concept));
      const nom = (await db.list('transactions', { eq: { to_acc: cur.id }, limit: 500 })).filter(t => /^Nómina neta/.test(t.concept));
      const emps = (S.jobs || []).filter(e => e.character_id === S.char.id), tc = set('impuestos'), y = emps.reduce((s, e) => s + (S.ranks.find(r => r.dept === e.dept && r.rank === e.rank)?.salary || 0), 0) * cpi(), it = incomeTax(y);
      body = `<div class="card"><b>Tu situación fiscal</b><p class="muted">En Los Ángeles pagas impuestos al <b>IRS</b> (federal), al <b>Franchise Tax Board</b> (California) y FICA (Seguro Social y Medicare). Tu número fiscal es tu SSN: está en la app Documentos.</p>
        ${y ? `<p>Sueldo anual bruto: <b>${money(y)}</b> · Impuestos al año: <b>${money(it)}</b> (${(it / y * 100).toFixed(1)}%) · Te llega neto: <b>${money((y - it) / 365)}</b> al día.</p>` : '<p class="muted">Cuando tengas un trabajo del gobierno verás aquí cuánto se te retiene.</p>'}
        <ul class="muted small"><li>Compra de autos: Sales Tax de LA ${tc.sales}%.</li><li>Compra de casa a otra persona: impuesto de transferencia ${tc.transfer}%.</li><li>Casas que tienes: impuesto predial ${tc.property}% al año (se cobra un poco cada día).</li><li>Empresas: impuesto corporativo ${tc.corp}% (federal 21% + California 8.84%).</li></ul></div>
        <h3>Impuestos pagados</h3><ul class="list">${txs.map(t => `<li><div><b>${esc(t.concept)}</b><div class="muted">${fdate(t.created_at)}</div></div><b class="neg">−${money(t.amount)}</b></li>`).join('') || '<li class="muted">Todavía no has pagado impuestos directos.</li>'}</ul>
        ${nom.length ? `<p class="muted">Además se te retuvieron impuestos en ${nom.length} pagos de nómina.</p>` : ''}`;
    } else if (st.tab === 'credito') {
      const r = await db.rpc('card_status', { c: S.char.id }), k = r.card, sc = r.score, ev = await db.list('credit_events', { eq: { character_id: S.char.id }, limit: 40 });
      const plans = await db.list('credit_plans', { eq: { character_id: S.char.id }, limit: 20 }).catch(() => []);
      const lvlTxt = sc >= 760 ? ['Excelente', '#00b37e'] : sc >= 700 ? ['Muy bueno', '#4cc38a'] : sc >= 620 ? ['Bueno', '#f2c94c'] : sc >= 560 ? ['Regular', '#f2994a'] : ['Malo', '#eb5757'];
      const EV = { intereses: '📈 Intereses cobrados', apertura: '🟢 Tarjeta aprobada', cargo: '💳 Cargo', abono: '💵 Pago', pago_a_tiempo: '✅ Pago a tiempo', pago_tarde: '⚠️ Pago atrasado', impago: '⛔ Impago', rechazo: '❌ Solicitud rechazada' };
      const gauge = `<div class="cr-score"><svg viewBox="0 0 200 110"><path d="M15 100 A85 85 0 0 1 185 100" class="cr-bg"/><path d="M15 100 A85 85 0 0 1 185 100" class="cr-fg" style="stroke:${lvlTxt[1]};stroke-dasharray:${((sc - 300) / 550 * 267).toFixed(0)} 400"/></svg>
        <div><b>${sc}</b><small style="color:${lvlTxt[1]}">${lvlTxt[0]}</small></div><p class="muted">Buró de crédito · de 300 a 850</p></div>`;
      body = `<div class="tx">${gauge}${k ? `<div class="ccard ${k.status !== 'active' ? 'cr-off' : ''}"><div class="row"><b class="cc-bank">RRVA</b><small class="grow" style="text-align:right">Crédito${k.status === 'frozen' ? ' · CONGELADA' : ''}</small></div><div class="chip"></div>
          <div class="num">${k.number.replace(/(\d{4})(?=\d)/g, '$1 ')}</div><div class="row"><span>${esc(cname(S.char.id).toUpperCase())}</span><b class="grow" style="text-align:right">VISA</b></div></div>
        <div class="kpis"><div><small>Línea de crédito</small><b>${money(k.credit_limit)}</b></div><div><small>Debes</small><b class="${k.owed > 0 ? 'neg' : ''}">${money(k.owed)}</b></div><div><small>Disponible</small><b>${money(Math.max(0, k.credit_limit - k.owed))}</b></div>
          <div><small>Intereses</small><b>${Math.round(k.apr * 100)}% anual</b><small> · este periodo ${money(k.int_cycle || 0)}</small></div><div><small>Con tu score tu línea puede llegar a</small><b>${money(creditCap(sc))}</b>${sc < 800 ? `<small> · con score ${sc < 650 ? 650 : sc < 700 ? 700 : sc < 760 ? 760 : 800}: ${money(creditCap(sc < 650 ? 650 : sc < 700 ? 700 : sc < 760 ? 760 : 800))}</small>` : ''}</div><div><small>Pago mínimo</small><b>${money(Math.max(0, k.stmt_min - k.stmt_paid))}</b><small> antes del ${fdate(k.stmt_due)} (en ${Math.max(0, Math.ceil((gameStart(k.stmt_due) - Date.now()) / 36e5))} h reales)</small></div></div>
        <div class="cr-grid"><form class="card form" data-form="ccpay"><h3>Pagar tarjeta</h3>${fieldsHTML([{ k: 'amount', label: 'Monto (sale de tu cuenta personal)', type: 'number', min: 0.01, step: 0.01, req: 1, def: Math.max(0, k.stmt_min - k.stmt_paid) || '' }])}<button class="btn big">Pagar</button></form>
          <form class="card form" data-form="cccharge"><h3>Usar tarjeta</h3>${fieldsHTML([{ k: 'dest', label: 'Cuenta RRVA a la que pagas', req: 1, ph: '10 dígitos', help: 'Pon tu propia cuenta para retirar efectivo (comisión 3%).' }, { k: 'amount', label: 'Monto', type: 'number', min: 1, step: 0.01, req: 1 }, { k: 'concept', label: 'Concepto', ph: 'Compra, renta…' }])}<button class="btn big">Pagar con tarjeta</button></form></div>
        <form class="card form cr-plan" data-form="ccplan"><h3>🗓️ Comprar a plazos</h3><p class="muted">Pagas en mensualidades que se cargan solas a tu tarjeta cada mes del juego (1 mes del juego = 2.5 días reales). Entre más largo el plazo, más interés.</p>
          ${fieldsHTML([{ k: 'dest', label: 'Cuenta RRVA a la que pagas', req: 1, ph: '10 dígitos (no tu propia cuenta)' }, { k: 'amount', label: 'Monto de la compra', type: 'number', min: 100, step: 0.01, req: 1 }, { k: 'concept', label: 'Concepto', ph: 'Auto, casa, tele…' }])}
          <table class="tbl cr-terms"><thead><tr><th></th><th>Plazo (juego)</th><th>Tiempo real</th><th>Interés</th><th>Mensualidad</th><th>Total</th></tr></thead><tbody>${PLAZOS.map(([m, r, real], i) => `<tr><td><input type="radio" name="months" value="${m}" ${i === 1 ? 'checked' : ''}></td><td><b>${m} ${m === 1 ? 'mes' : 'meses'}</b></td><td>${real}</td><td>${r * 100}% · <span data-int="${m}">—</span></td><td data-mo="${m}">—</td><td data-tot="${m}">—</td></tr>`).join('')}</tbody></table>
          <button class="btn big">Comprar a plazos</button></form>
        ${plans.length ? `<div class="card"><h3>Mis compras a plazos</h3><ul class="list">${plans.map(p => `<li><span class="grow"><b>${esc(p.concept)}</b> <small class="muted">${money(p.principal)} a ${p.months} ${p.months === 1 ? 'mes' : 'meses'} · total ${money(p.total)}</small>
          <div class="meter"><i style="width:${p.paid / p.months * 100}%"></i></div><small class="muted">${p.status === 'done' ? '✅ Liquidada' : `${p.paid}/${p.months} pagadas · siguiente ${money(p.monthly)} el ${fdate(p.next_due)}`}</small></span></li>`).join('')}</ul></div>` : ''}`
        : r.debt > 0 ? `<div class="notice"><b>Tienes una deuda de ${money(r.debt)} con RRVA</b> de una tarjeta cancelada. Págala para volver a pedir crédito.</div><form class="card form" data-form="ccpay">${fieldsHTML([{ k: 'amount', label: 'Monto', type: 'number', min: 0.01, step: 0.01, req: 1, def: r.debt }])}<button class="btn big">Pagar deuda</button></form>`
        : `<div class="card"><h3>Solicita tu Tarjeta de Crédito RRVA</h3><p>RRVA revisa tu buró de crédito. La primera tarjeta suele ser de <b>${money(10000 * cpi())}</b>; con buen historial te dan más, con mal historial menos o nada.</p>
          <ul class="muted"><li>Cada semana hay un corte con <b>pago mínimo</b> (10% de lo que debes). Tienes 7 días para pagarlo.</li><li>Pagar a tiempo sube tu score y tu línea: entre mejor historial, más rápido crece, <b>hasta millones</b> (score 800+ → hasta $10M).</li><li>Pagar tarde cobra un cargo, baja tu score y tu línea.</li>
          <li>Dos atrasos seguidos congelan la tarjeta; tres la cancelan y la deuda sigue.</li><li>Interés anual 36% sobre lo que debes. El crédito lo presta el gobierno: no se crea dinero.</li></ul>
          <button class="btn big" data-act="ccapply">Solicitar tarjeta</button></div>`}
        <h3>Historial crediticio</h3><ul class="list">${ev.map(e => `<li><span class="grow">${EV[e.kind] || esc(e.kind)} <small class="muted">${fdate(e.created_at)}</small><div class="muted">${esc(e.note || '')}</div></span>${e.amount != null ? `<b>${money(e.amount)}</b>` : ''}</li>`).join('') || '<p class="muted">Aún no tienes historial. Pedir tu primera tarjeta y pagarla a tiempo lo construye.</p>'}</ul></div>`;
    } else if (st.tab === 'tarjeta') {
      const cc = cur.kind === 'personal' ? (await db.list('credit_cards', { eq: { character_id: S.char.id }, order: null })).find(x => x.status !== 'closed') : null;
      body = `<div class="cc-row"><div class="ccard"><div class="row"><b class="cc-bank">RRVA</b><small class="grow" style="text-align:right">${cur.kind === 'personal' ? 'Débito' : 'Business'}</small></div><div class="chip"></div>
        <div class="num">${cur.number.replace(/(\d{4})(?=\d)/g, '$1 ')} 00</div><div class="row"><span>${esc(cur.kind === 'personal' ? cname(S.char.id).toUpperCase() : cur.name.toUpperCase())}</span><b class="grow" style="text-align:right">VISA</b></div></div>
        ${cc ? `<div class="ccard ${cc.status !== 'active' ? 'cr-off' : ''}" data-act="tab" data-t="credito"><div class="row"><b class="cc-bank">RRVA</b><small class="grow" style="text-align:right">Crédito</small></div><div class="chip"></div>
          <div class="num">${cc.number.replace(/(\d{4})(?=\d)/g, '$1 ')}</div><div class="row"><span>${esc(cname(S.char.id).toUpperCase())}</span><b class="grow" style="text-align:right">VISA</b></div></div>` : ''}</div>
        ${cc ? `<p class="muted">Crédito: debes ${money(cc.owed)} de ${money(cc.credit_limit)} · intereses ${Math.round(cc.apr * 100)}% anual. Toca la tarjeta para ver tu estado de cuenta.</p>` : '<p class="muted">¿Quieres una tarjeta de crédito? Pídela en la pestaña Crédito.</p>'}
        <p class="muted">Las cuentas empresariales se crean al aprobarse tu empresa; puedes tener varios socios. Para invertir abre la app Bolsa.</p>`;
    }
    const ccard = (await db.list('credit_cards', { eq: { character_id: S.char.id }, order: null })).find(x => x.status !== 'closed'), onCC = st.tab === 'credito' && ccard;
    view(el, `<div class="bank-h">${onCC ? `<div class="row"><small class="grow">Tarjeta de crédito RRVA ${last4(ccard.number)}</small><small>${Math.round(ccard.apr * 100)}% anual</small></div>
      <small>Crédito disponible</small><h2>${money(Math.max(0, ccard.credit_limit - ccard.owed))}</h2><small>Debes ${money(ccard.owed)} de una línea de ${money(ccard.credit_limit)}</small>`
      : `<div class="row"><small class="grow">${esc(accLabel(cur))}</small><button class="link light" data-act="copyacc">Cuenta ${cur.number} ⧉</button></div>
      <small>${frozen(cur) ? '🔒 CONGELADA · saldo' : 'Saldo disponible'}</small><h2>${money(cur.balance)}</h2>${frozen(cur) ? `<small>${jailed ? 'Estás en prisión: no puedes usar tu dinero.' : 'Orden de arresto activa: usa tu Cuenta encriptada 🔐.'}</small>` : ''}`}
      ${accs.length > 1 || ccard ? `<div class="chips">${accs.map(a => `<button data-act="acc" data-id="${a.id}" class="${a.id === cur.id && !onCC ? 'on' : ''}">${frozen(a) ? '🔒 ' : ''}${a.kind === 'personal' ? 'Personal' : a.kind === 'savings' ? 'Ahorro' : a.kind === 'encrypted' ? '🔐 Encriptada' : esc(a.name)}</button>`).join('')}${ccard ? `<button data-act="tab" data-t="credito" class="${onCC ? 'on' : ''}">💳 Crédito</button>` : ''}</div>` : ''}</div>
      ${tabs([['mov', 'Movimientos'], ['send', 'Transferir'], ['ahorro', 'Ahorro e intereses'], ['multas', 'Multas'], ['imp', 'Impuestos'], ['tarjeta', 'Tarjeta'], ['credito', 'Crédito']], st.tab)}${body}`, {
      async ahorro() { await db.rpc('open_savings', { c: S.char.id }); toast('Cuenta de ahorro abierta'); go({}); },
      tab: d => banco.render(el, { tab: d.t, acc: cur.id }),
      acc: d => banco.render(el, { tab: st.tab === 'credito' ? 'mov' : st.tab, acc: d.id }),
      copyacc: async () => { await navigator.clipboard?.writeText(cur.number); toast('Número de cuenta copiado'); },
      async dest(d) {
        const raw = String(d.number).trim(), digits = raw.replace(/\D/g, '');
        if (!/\d/.test(raw)) { // escribió un nombre
          const r = await db.rpc('account_by_name', { q: raw }) || [];
          if (!r.length) throw new Error('No encontré a nadie con ese nombre');
          if (r.length > 1 && !r.some(x => x.holder.toLowerCase() === raw.toLowerCase())) throw new Error('Hay varias personas: ' + r.map(x => x.holder).join(', ') + '. Escribe el nombre completo.');
          d.number = (r.find(x => x.holder.toLowerCase() === raw.toLowerCase()) || r[0]).number;
        } else d.number = digits.length === 12 && digits.endsWith('00') ? digits.slice(0, 10) : digits; // número de tarjeta de débito = cuenta + 00
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
      async ccapply() { const r = await db.rpc('card_apply', { c: S.char.id }); r.ok ? toast(`¡Aprobada! Línea de crédito de ${money(r.limit)} 💳`) : toast(r.reason, 'err'); go({}); },
      async ccpay(d) { await db.rpc('card_pay', { c: S.char.id, amount: +d.amount }); toast('Pago aplicado a tu tarjeta'); go({}); window.liveRefresh?.(); },
      async ccplan(d) { d.dest = String(d.dest).replace(/\D/g, '').slice(0, 10); const r = await db.rpc('card_plan', { c: S.char.id, dest: d.dest, amount: +d.amount, months: +d.months, concept: d.concept });
        toast(`Compra a ${d.months} ${+d.months === 1 ? 'mes' : 'meses'}: ${money(r.monthly)} al mes, total ${money(r.total)}`); banco.render(el, st); },
      async cccharge(d) { d.dest = String(d.dest).replace(/\D/g, '').slice(0, 10); const r = await db.rpc('card_charge', { c: S.char.id, dest: d.dest, amount: +d.amount, concept: d.concept }); toast(`Pagado con tarjeta · te quedan ${money(r.available)} disponibles`); go({}); window.liveRefresh?.(); },
    });
  } };

// ============ GOBIERNO (trámites) ============
// qué cambia una ley (texto para la lista de leyes)
const LAW_EFFECT = l => { const p = l.params || {}, TX = { sales: 'ventas', property: 'predial', corp: 'corporativo', transfer: 'transferencias' };
  return { impuesto: `Impuesto de ${TX[p.tipo] || p.tipo}: ${p.valor}%`, ahorro: `Interés de ahorro: ${p.valor}% anual`, dinero_inicial: `Dinero inicial de cada vida: ${money(p.valor)}`,
    servicio_militar: `Servicio militar obligatorio para: ${(p.depts || []).join(', ') || 'ningún empleo'}`, casino_max: `Apuesta máxima del casino: ${money(p.valor)}`, visa_dias: `Plazo de visa: ${p.valor} días del juego`,
    delito: `Nuevo delito ${esc(p.code || '')} «${esc(p.title || '')}»: multa ${money(p.fine || 0)}${p.months ? `, ${p.months} meses de prisión` : ''}` }[l.effect] || ''; };
const gobierno = { id: 'gobierno', name: 'LA City', icon: '🏛️', bg: '#1d3b6e,#2f5aa8', url: 'lacity.rp', show: () => true,
  async render(el) {
    const reqs = await myRequests(), ch = S.char, pres = has('Presidente') || lvl() >= 4;
    const laws = await db.list('laws', { order: 'created_at', limit: 300 }).catch(() => []), lawmaker = has('Presidente') || has('Gobernador') || lvl() >= 4;
    const tax = k => (set('impuestos') || {})[k] ?? DEFAULT_SETTINGS.impuestos[k];
    const gov = (await db.list('accounts', { eq: { kind: 'gov' } }))[0], budgets = await db.list('accounts', { eq: { kind: 'dept' } }).catch(() => []);
    const visaOk = approvedOf(reqs, 'visa').length, days = ch ? Math.ceil(set('visa_days') - (Date.now() - new Date(ch.created_at)) / GAME_DAY_MS) : 0;
    const cats = {};
    Object.entries(TRAMITES).forEach(([k, t]) => { if (t.hidden || k === 'apelacion_ck' || (t.foreignOnly && !ch?.extranjero)) return; (cats[t.cat] ??= []).push([k, t]); });
    const last = k => reqs.find(r => r.type === k), hist = set('cpi_history') || [];
    const infl = ((cpi() - 1) * 100).toFixed(2);
    view(el, `<div class="portal"><div class="gov-top">Sitio oficial de la Ciudad de Los Ángeles · Roleplay</div>
      <header class="gov-bar"><img class="gov-logo" src="img/logo.png" alt=""><div><b>City of Los Angeles</b><span>Servicios en línea para residentes</span></div>
        <nav><a data-act="go" data-k="tramites">Trámites</a><a data-act="go" data-k="mis">Mis solicitudes</a><a data-act="go" data-k="leyes">Leyes</a><a data-act="go" data-k="finanzas">Finanzas</a></nav></header>
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
      <h2 id="leyes" class="sec-h">Leyes de Los Ángeles</h2>
      ${(() => { const vig = laws.filter(l => l.status === 'vigente'), der = laws.filter(l => l.status !== 'vigente');
        const card = l => `<div class="law ${l.status}"><div class="row"><b class="grow">Ley ${l.number}: ${esc(l.title)}</b>${l.status === 'vigente' ? '<span class="tag on">Vigente</span>' : '<span class="tag">Derogada</span>'}</div>
          <small class="muted">Promulgada por ${esc(l.author_office || '')} ${esc(cname(l.author))} · ${fdate(l.created_at)}${l.repealed_at ? ' · derogada ' + fdate(l.repealed_at) : ''}</small>
          <p>${esc(l.body)}</p>${LAW_EFFECT(l) ? `<p class="law-eff">⚙️ ${LAW_EFFECT(l)}</p>` : ''}${lawmaker && l.status === 'vigente' ? `<button class="btn sm ghost" data-act="derogar" data-id="${l.id}">Derogar</button>` : ''}</div>`;
        return (vig.map(card).join('') || '<p class="muted">Aún no hay leyes promulgadas.</p>') + (der.length ? `<details><summary>Leyes derogadas (${der.length})</summary>${der.map(card).join('')}</details>` : ''); })()}
      ${lawmaker ? `<div class="pres"><h3>📜 Despacho legislativo (${has('Presidente') ? 'Presidente' : has('Gobernador') ? 'Gobernador' : 'Staff'})</h3><p>Promulga leyes para la ciudad. Pueden ser solo texto o cambiar reglas del juego. Se publican solas en LA Times y se pueden derogar (regresa todo como estaba).</p>
        <form data-form="ley" class="form">${fieldsHTML([{ k: 'title', label: 'Nombre de la ley', req: 1 }, { k: 'body', label: 'Texto de la ley', type: 'textarea', req: 1 },
          { k: 'effect', label: '¿Qué cambia?', type: 'select', options: [['ninguno', 'Solo texto (sin efecto automático)'], ['impuesto', 'Un impuesto'], ['ahorro', 'Interés de las cuentas de ahorro'], ['dinero_inicial', 'Dinero inicial de cada vida'],
            ['servicio_militar', 'Empleos que piden servicio militar'], ['casino_max', 'Apuesta máxima del casino'], ['visa_dias', 'Días para sacar visa (extranjeros)'], ['delito', 'Agregar un delito al código penal']] }])}
          <div data-eff="impuesto" hidden>${fieldsHTML([{ k: 'tipo', label: 'Impuesto', type: 'select', options: [['sales', `Ventas (hoy ${tax('sales')}%)`], ['property', `Predial (hoy ${tax('property')}%)`], ['corp', `Corporativo (hoy ${tax('corp')}%)`], ['transfer', `Transferencias (hoy ${tax('transfer')}%)`], ['crypto', `Ganancias cripto al vender (hoy ${tax('crypto')}%)`]] }])}</div>
          <div data-eff="impuesto ahorro dinero_inicial casino_max visa_dias" hidden>${fieldsHTML([{ k: 'valor', label: 'Nuevo valor', type: 'number', min: 0, step: 0.01 }])}</div>
          <div data-eff="servicio_militar" hidden><div class="g-pick">${Object.keys(set('payroll') || {}).map(d => `<label class="chk"><input type="checkbox" name="dep" value="${esc(d)}" ${set('military_required').includes(d) ? 'checked' : ''}> ${esc(d)}</label>`).join('')}</div></div>
          <div data-eff="delito" hidden>${fieldsHTML([{ k: 'code', label: 'Artículo', ph: 'Art. 120' }, { k: 'dtitle', label: 'Nombre del delito' }, { k: 'kind', label: 'Tipo', type: 'select', options: [['infraccion', 'Infracción'], ['delito', 'Delito'], ['grave', 'Delito grave']] },
            { k: 'fine', label: 'Multa (USD)', type: 'number', min: 0 }, { k: 'months', label: 'Prisión (meses)', type: 'number', min: 0 }])}</div>
          <button class="btn" type="submit">Promulgar ley</button></form></div>` : ''}
      <h2 id="finanzas" class="sec-h">Finanzas públicas</h2>
      ${(() => { const state = has('Presidente') || has('Gobernador') || lvl() >= 3, mgr = d => S.tags.includes('mgr:' + d) || lvl() >= 3, depts = Object.keys(DEPTS);
        return `<h3 class="cat-h">Presupuesto de cada departamento</h3><p class="muted">Todo sale de la Tesorería. Con su presupuesto cada departamento paga la nómina de su gente y su jefe lo gasta en lo que ocupe. Las multas entran al presupuesto de la Policía.</p>
        <table class="gov-tbl"><thead><tr><th>Departamento</th><th>Presupuesto</th><th></th></tr></thead><tbody>${depts.map(d => { const a = budgets.find(x => x.dept === d);
          return `<tr><td>${esc(d)}</td><td><b>${a ? money(a.balance) : '<span class="muted">Sin asignar (paga la Tesorería)</span>'}</b>${a ? ` <small class="muted">· cuenta ${a.number}</small>` : ''}</td><td class="nowrap">${state ? `<button class="btn sm" data-act="presu" data-d="${esc(d)}">Dar / quitar</button>` : ''}${a && mgr(d) ? `<button class="btn sm ghost" data-act="gastar" data-d="${esc(d)}">Gastar</button>` : ''}</td></tr>`; }).join('')}</tbody></table>`; })()}
      <div class="fin"><div><small>Presupuesto inicial (real, FY 2025-26)</small><b>$13,950,000,000</b></div><div><small>Saldo actual</small><b>${money(gov?.balance)}</b></div>
        <div><small>Índice de precios (CPI)</small><b>${cpi().toFixed(4)}</b></div><div><small>Emisiones de dinero</small><b>${hist.length}</b></div></div>
      ${pres ? `<div class="pres"><h3>Despacho del Presidente</h3><p>Emitir dinero llena la tesorería, pero sube la inflación: todo (autos, casas y sueldos) se encarece. La tasa de la Reserva Federal es el interés que paga el ahorro.</p>
        <div class="pres-grid"><form data-form="print" class="form">${fieldsHTML([{ k: 'amount', label: 'Emitir dinero (USD)', type: 'number', min: 1000000, req: 1, ph: '1000000000' }])}<button class="btn" type="submit">Imprimir dinero</button></form>
        <form data-form="rate" class="form">${fieldsHTML([{ k: 'rate', label: 'Tasa de la Reserva Federal (% anual)', type: 'number', min: 0, max: 25, req: 1, def: set('fed_rate') }])}<button class="btn" type="submit">Fijar tasa</button></form></div></div>` : ''}
      </main><footer class="gov-f"><img class="gov-logo sm" src="img/logo.png" alt=""><span>City of Los Angeles · Portal de roleplay de Los Ángeles RP. Los documentos emitidos solo son válidos dentro del juego.</span></footer></div>`, {
      tramite: d => openTramite(d.k, {}, () => gobierno.render(el)),
      presu: d => modal('Presupuesto · ' + esc(d.d), `<p class="muted">Positivo: se lo das desde la Tesorería. Negativo: lo regresas a la Tesorería.</p>` + form('go', [{ k: 'amount', label: 'Monto (USD)', type: 'number', req: 1, ph: '1000000 o -500000' }], {}, 'Aplicar'), {
        async go(v, _, close) { const b = await db.rpc('budget_move', { d: d.d, amount: +v.amount }); close(); toast(`Presupuesto de ${d.d}: ${money(b)}`); gobierno.render(el); } }),
      gastar: d => modal('Gastar presupuesto · ' + esc(d.d), form('go', [{ k: 'dest', label: 'Número de cuenta destino', req: 1 }, { k: 'amount', label: 'Monto (USD)', type: 'number', min: 1, req: 1 }, { k: 'concept', label: 'Concepto', req: 1, ph: 'Ej. compra de patrullas' }], {}, 'Pagar'), {
        async go(v, _, close) { await db.rpc('dept_spend', { d: d.d, dest: v.dest, amount: +v.amount, concept: v.concept }); close(); toast('Pago hecho desde el presupuesto'); gobierno.render(el); } }),
      go: d => el.querySelector('#' + d.k)?.scrollIntoView({ behavior: 'smooth' }),
      async print(d) {
        if (!await ask(`¿Emitir ${money(d.amount)}? Esto genera inflación para toda la ciudad.`)) return;
        const c = await db.rpc('print_money', { amount: d.amount }); S.settings.cpi = c; toast(`Dinero emitido. Nuevo índice de precios: ${Number(c).toFixed(4)}`); gobierno.render(el);
      },
      async rate(d) { await db.rpc('set_fed_rate', { rate: d.rate }); S.settings.fed_rate = d.rate; toast('Tasa actualizada'); gobierno.render(el); },
      async ley(f) {
        const e = f.effect || 'ninguno', params = e === 'impuesto' ? { tipo: f.tipo, valor: +f.valor } : ['ahorro', 'dinero_inicial', 'casino_max', 'visa_dias'].includes(e) ? { valor: +f.valor }
          : e === 'servicio_militar' ? { depts: [...el.querySelectorAll('[data-eff=servicio_militar] input:checked')].map(x => x.value) } : e === 'delito' ? { code: f.code, title: f.dtitle, kind: f.kind, fine: +f.fine || 0, months: +f.months || 0 } : {};
        if (!await ask('¿Promulgar esta ley? Se publica en LA Times y entra en vigor de inmediato.')) return;
        const n = await db.rpc('enact_law', { c: S.char.id, title: f.title, body: f.body, effect: e, params }); toast(`Ley ${n} promulgada 📜`); await window.refreshShell?.('gobierno');
      },
      async derogar(d) { if (!await ask('¿Derogar esta ley? Lo que cambió regresa como estaba.')) return; await db.rpc('repeal_law', { c: S.char.id, law: d.id }); toast('Ley derogada'); await window.refreshShell?.('gobierno'); },
    });
    const effSel = el.querySelector('[data-form=ley] [name=effect]');
    if (effSel) { const upd = () => el.querySelectorAll('[data-eff]').forEach(d => d.hidden = !d.dataset.eff.split(' ').includes(effSel.value)); effSel.onchange = upd; upd(); }
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
    const minm = Number(set('job_min_minutes')), day0 = new Date(new Date().setHours(0, 0, 0, 0)), wk0 = new Date(Date.now() - 7 * 864e5); // Workday va en tiempo real: «hoy» = el día real
    const open = shifts.find(w => w.character_id === S.char.id && !w.ended_at);
    let body = '';
    if (tab === 'mio') body = mine.length ? mine.map(e => { const sh = shifts.filter(w => w.character_id === S.char.id && w.dept === e.dept), today = minsBetween(sh, day0), week = minsBetween(sh, wk0);
      const daily = salaryOf(e.dept, e.rank) / 365 * cpi(), isOpen = open?.dept === e.dept;
      return `<div class="job"><div class="job-h"><span class="gov-ico">${ico('empleos')}</span><div class="grow"><b>${esc(e.dept)}</b><small>${esc(e.rank)} · desde ${freal(e.hired_at)}</small></div>${badge(e.status === 'vacation' ? 'vacation' : 'active')}</div>
        <div class="kpis"><div><small>Sueldo anual</small><b>${money(salaryOf(e.dept, e.rank) * cpi())}</b></div><div><small>Pago diario</small><b>${money(daily)}</b></div><div><small>Hoy</small><b>${Math.round(today)} / ${minm} min</b></div><div><small>Últimos 7 días</small><b>${Math.round(week / 60 * 10) / 10} h</b></div></div>
        <div class="meter"><i style="width:${Math.min(100, today / minm * 100)}%"></i></div>
        <p class="muted">Cumple al menos ${minm} minutos de turno al día y cobras ese mismo día, en cuanto los completes. Si pasas 7 días sin cumplir, el sistema te despide. ${e.status === 'vacation' ? `De vacaciones hasta el ${esc(e.vacation_until)} (con goce de sueldo).` : ''}</p>
        <div class="row">${e.status === 'active' ? `<button class="btn ${isOpen ? 'bad' : 'ok'}" data-act="clock" data-d="${esc(e.dept)}">${isOpen ? 'Terminar turno' : 'Iniciar turno'}</button>` : ''}
        <button class="btn ghost" data-act="vac" data-d="${esc(e.dept)}">Pedir vacaciones</button><span class="grow"></span><button class="btn bad ghost" data-act="renunciar" data-id="${e.id}" data-d="${esc(e.dept)}">Renunciar</button></div></div>`; }).join('')
      : `<div class="empty"><p>No tienes empleo. Busca vacantes del gobierno o de empresas en LinkedIn.</p><button class="btn" data-act="li">Abrir LinkedIn</button></div>`;
    if (tab === 'pagos') { const accs = await myAccounts(), p = accs.find(a => a.kind === 'personal');
      const tx = p ? (await db.list('transactions', { eq: { to_acc: p.id } })).filter(t => t.concept.startsWith('Nómina')) : [];
      body = `<ul class="list">${tx.map(t => `<li><div><b>${esc(t.concept)}</b><div class="muted">${freal(t.created_at)}</div></div><b class="pos">+${money(t.amount)}</b></li>`).join('') || '<li class="muted">Aún no recibes pagos. Se depositan en cuanto cumples los minutos de turno del día.</li>'}</ul>`; }
    if (tab === 'equipo') body = mgrOf.map(d => { const team = emps.filter(e => e.dept === d && e.status !== 'fired');
      return `<h3>${esc(d)}</h3><table class="tbl"><thead><tr><th>Nombre</th><th>Rango</th><th>Hoy</th><th>7 días</th><th>Estado</th><th></th></tr></thead><tbody>${team.map(e => { const sh = shifts.filter(w => w.character_id === e.character_id && w.dept === d);
        return `<tr><td>${esc(cname(e.character_id))}</td><td><select data-rank="${e.id}">${rankList(d).map(r => `<option ${r.rank === e.rank ? 'selected' : ''}>${esc(r.rank)}</option>`).join('')}</select></td>
        <td>${Math.round(minsBetween(sh, day0))} min</td><td>${Math.round(minsBetween(sh, wk0) / 6) / 10} h</td><td>${e.status === 'vacation' ? 'Vacaciones' : sh.some(w => !w.ended_at) ? '🟢 En turno' : 'Fuera'}</td>
        <td class="nowrap"><button class="btn sm" data-act="rank" data-id="${e.id}">Guardar rango</button><button class="btn sm bad" data-act="fire" data-id="${e.id}">Despedir</button></td></tr>`; }).join('')}</tbody></table>`; }).join('') + '<div class="q"></div>';
    view(el, `<div class="wd-h"><b>Workday</b><span>${esc(cname(S.char.id))}</span></div>
      ${tabs([['mio', 'Mi empleo'], ['pagos', 'Recibos de nómina'], ...(mgrOf.length ? [['equipo', 'Mi equipo']] : [])], tab)}${body}`, {
      tab: d => trabajo.render(el, d.t), li: () => window.openApp('empleos'),
      async clock(d) { const r = await db.rpc('clock', { c: S.char.id, d: d.d }); toast(r === 'in' ? 'Turno iniciado' : 'Turno terminado'); window.refreshDuty?.(); trabajo.render(el); },
      renunciar: async d => { if (!await ask(`¿Renunciar a ${d.d}? Pierdes el puesto y el rol; para volver tendrías que postularte otra vez.`)) return;
        await db.rpc('quit_job', { emp: d.id }); toast('Renunciaste a ' + d.d); window.refreshDuty?.(); trabajo.render(el); },
      vac: d => openTramite('vacaciones', { values: { dept: d.d }, data: { dept: d.d }, dept: ['mgr:' + d.d, 'staff:admin'] }, () => trabajo.render(el)),
      async rank(d) { await db.rpc('set_rank', { emp: d.id, r: el.querySelector(`[data-rank="${d.id}"]`).value }); toast('Rango actualizado. Actualízalo también en Discord.'); trabajo.render(el, 'equipo'); },
      async fire(d) { if (!await ask('¿Despedir a este empleado?')) return; await db.rpc('fire_emp', { emp: d.id }); toast('Despedido. Quítale el rol en Discord.'); trabajo.render(el, 'equipo'); },
    });
    if (tab === 'equipo') reviewQueue(el.querySelector('.q'), { types: ['job', 'vacaciones'], title: 'Solicitudes de empleo y vacaciones' });
  } };


// ============ TOOL STORE (herramientas, electrónica, armería, camping) + inventario ============
const SHOPI = Object.fromEntries(SHOP.map(([id, name, store, price, gun, conf, desc]) => [id, { id, name, store, price, gun, conf, desc }]));
const gunRank = t => GUN_CLASSES.indexOf(t) + 1;
const toolstore = { id: 'toolstore', name: 'Tool Store', icon: '🧰', bg: '#ff7a00,#c43e00', url: 'toolstore.rp', show: () => true,
  async render(el, tab = 'herramientas') {
    if (typeof tab === 'object') tab = 'herramientas';
    if (!needChar(el)) return;
    const [mine, reqs, accs] = await Promise.all([db.list('items', { eq: { owner_char: S.char.id }, limit: 1000 }), myRequests(), myAccounts()]);
    const lic = Math.max(0, ...approvedOf(reqs, 'licencia_armas').map(r => gunRank(r.data.tipo))), have = id => mine.filter(i => i.item === id).length;
    const why = it => !it.gun ? '' : !lic ? 'Necesitas licencia de armas' : it.gun !== 'any' && lic < gunRank(it.gun) ? `Tu licencia no cubre ${it.gun}` : '';
    const card = it => { const no = why(it); return `<div class="ts-card"><div class="ts-img"><img src="img/tienda/${it.id}.jpg" alt="${esc(it.name)}" loading="lazy">${have(it.id) ? `<span class="ts-have">Tienes ${have(it.id)}</span>` : ''}</div>
      <div class="ts-b"><b>${esc(it.name)}</b><small class="muted">${esc(it.desc)}</small>
      ${it.gun ? `<span class="tag ${no ? 'bad' : ''}">🪪 ${it.gun === 'any' ? 'Licencia de armas' : 'Licencia: ' + esc(it.gun)}</span>` : ''}${it.conf && !it.gun ? '<span class="tag">La policía lo puede decomisar</span>' : ''}
      <div class="row"><b class="ts-price">${money(it.price * cpi())}</b><span class="grow"></span>${no ? `<button class="btn sm ghost" data-act="lic">${esc(no)}</button>` : `<button class="btn sm" data-act="comprar" data-id="${it.id}">Comprar</button>`}</div></div></div>`; };
    let body;
    if (tab === 'inv') {
      const groups = Object.values(mine.reduce((g, i) => ((g[i.item] ??= []).push(i), g), {}));
      body = `<p class="muted">Lo que traes contigo. Las armas quedan registradas a tu nombre con su número de serie.</p><ul class="list ts-inv">
        <li><img src="img/tienda/pearphone_retro.jpg" alt=""><div class="grow"><b>Pearphone Retro</b><div class="muted">Celular incluido con tu vida · no se puede quitar ni decomisar</div></div><span class="tag">Incluido</span></li>
        ${groups.map(g => { const it = SHOPI[g[0].item] || { name: g[0].item }; return `<li><img src="img/tienda/${g[0].item}.jpg" alt=""><div class="grow"><b>${esc(it.name)}${g.length > 1 ? ` ×${g.length}` : ''}</b>
          <div class="muted">${g.filter(i => i.serial).map(i => 'Serie ' + esc(i.serial)).join(' · ') || esc(SHOP_STORES[it.store] || '')}</div></div>${it.conf ? '<span class="tag">Decomisable</span>' : ''}</li>`; }).join('')}</ul>`;
    } else body = `<p class="muted">${tab === 'armeria' ? `Armería con licencia: necesitas tu <b>licencia de armas</b> aprobada (una licencia cubre su clase y las de abajo: Cortas → Largas → SWAT → Pesadas). Cada arma sale registrada con número de serie. Tu licencia: <b>${lic ? GUN_CLASSES[lic - 1] : 'ninguna'}</b>.` : 'Precios en dólares con impuestos incluidos. Pagas con tu cuenta personal.'}</p>
      <div class="ts-grid">${SHOP.filter(x => x[2] === tab).map(x => card(SHOPI[x[0]])).join('')}</div>`;
    view(el, `<div class="ts"><header class="ts-h"><b>🧰 Tool Store</b><span>Los Ángeles</span></header>${tabs([...Object.entries(SHOP_STORES), ['inv', `Mi inventario (${mine.length + 1})`]], tab)}<div class="tabbody">${body}</div></div>`, {
      tab: d => toolstore.render(el, d.t),
      lic: () => openTramite('licencia_armas'),
      comprar: d => { const it = SHOPI[d.id], gun = it.gun && it.gun !== 'any';
        modal('Comprar ' + esc(it.name), `<img class="ts-modal-img" src="img/tienda/${it.id}.jpg" alt="">` + form('go', [...(gun ? [] : [{ k: 'q', label: 'Cantidad', type: 'number', min: 1, max: 20, def: 1, req: 1 }])], {}, `Pagar ${money(it.price * cpi())}${gun ? '' : ' c/u'}`)
          + `<p class="muted">Se cobra de tu cuenta personal (saldo ${money(accs.find(a => a.kind === 'personal')?.balance || 0)}).</p>`, {
          async go(v, _, close) { await db.rpc('buy_item', { c: S.char.id, it: it.id, q: Number(v.q || 1) }); close(); toast(`Compraste ${it.name} 🧰`); toolstore.render(el, tab); window.liveRefresh?.(); } }); },
    });
  } };


// ============ 911 (llamadas de emergencia y despacho) ============
export const SVC911 = { policia: ['🚓', 'Policía', 'Robo, pelea, persona armada, accidente con heridos'], ems: ['🚑', 'Ambulancia', 'Herido, desmayado, emergencia médica'], bomberos: ['🚒', 'Bomberos', 'Incendio, persona atrapada, fuga de gas'] };
export const canRespond = sv => lvl() >= 2 || (sv === 'policia' ? isPolice() : sv === 'ems' ? has('Servicios Médicos') : has('Bomberos'));
const ST911 = { abierta: ['Esperando unidad', 'bad'], en_camino: ['Unidad en camino', 'warn'], cerrada: ['Atendida', 'ok'], cancelada: ['Cancelada', ''] };
const e911 = { id: 'e911', name: '911', icon: '🚨', bg: '#ff3b30,#a8000b', show: () => S.chars.some(c => c.status === 'active'),
  badge: async () => Object.keys(SVC911).some(canRespond) ? (await db.list('calls911', { eq: { status: 'abierta' }, limit: 100 }).catch(() => [])).filter(k => canRespond(k.service)).length : 0,
  async render(el, tab) {
    if (!needChar(el)) return;
    const resp = Object.keys(SVC911).some(canRespond); tab = typeof tab === 'string' ? tab : resp ? 'despacho' : 'llamar';
    const calls = await db.list('calls911', { order: 'created_at', asc: false, limit: 200 }), mine = calls.filter(k => S.chars.some(c => c.id === k.caller_char));
    const st = k => `<span class="tag ${ST911[k.status][1]}">${ST911[k.status][0]}</span>`, who = k => k.responders?.length ? 'Atiende: ' + k.responders.map(cname).join(', ') : '';
    let body;
    if (tab === 'llamar') body = `<div class="e9-hero"><b>911</b><span>Solo para emergencias reales. Las llamadas falsas son delito (Art. 63: $10,000 y prisión temporal).</span></div>
      <form data-form="llamar" class="form"><span class="fld-l">¿Qué servicio necesitas?</span><div class="choices e9-svc">${Object.entries(SVC911).map(([k, [i, n, d]]) =>
        `<label class="choice"><input type="radio" name="service" value="${k}" required><span><b>${i} ${n}</b><small>${d}</small></span></label>`).join('')}</div>
      ${fieldsHTML([{ k: 'location', label: '¿Dónde estás?', req: 1, ph: 'Ej. Gasolinera de Springfield, frente al banco' }, { k: 'description', label: '¿Qué está pasando?', type: 'textarea', req: 1, ph: 'Describe lo que ves: cuántas personas, si hay armas, heridos…' },
        { k: 'anonymous', label: 'Anónima', type: 'check', text: 'no mostrar mi nombre a las unidades' }])}<button class="btn bad big" type="submit">📞 Llamar al 911</button></form>
      <h3>Mis llamadas</h3><ul class="list">${mine.map(k => `<li><div class="grow"><b>${SVC911[k.service][0]} ${SVC911[k.service][1]}</b> · ${esc(k.location)}<div class="muted">${esc(k.description)}</div><div class="muted">${fdate(k.created_at)} ${who(k)}${k.note ? ' · ' + esc(k.note) : ''}</div></div>
        ${st(k)}${['abierta', 'en_camino'].includes(k.status) ? `<button class="btn sm ghost" data-act="cancelar" data-id="${k.id}">Cancelar</button>` : ''}</li>`).join('') || '<li class="muted">No has hecho llamadas.</li>'}</ul>`;
    else {
      const act = calls.filter(k => canRespond(k.service) && ['abierta', 'en_camino'].includes(k.status)), done = calls.filter(k => canRespond(k.service) && !['abierta', 'en_camino'].includes(k.status)).slice(0, 15);
      const card = k => `<div class="card e9-call ${k.status}"><div class="row"><b class="e9-ic">${SVC911[k.service][0]}</b><div class="grow"><b>${esc(k.location)}</b><div class="muted">${SVC911[k.service][1]} · ${ago(k.created_at)} · ${k.anonymous ? 'Llamada anónima' : 'Llama ' + esc(cname(k.caller_char))}</div></div>${st(k)}</div>
        <p>${esc(k.description)}</p>${who(k) ? `<div class="muted">${esc(who(k))}</div>` : ''}${k.note ? `<div class="muted">Nota: ${esc(k.note)}</div>` : ''}
        ${['abierta', 'en_camino'].includes(k.status) ? `<div class="row gap">${k.responders?.includes(S.char.id) ? '' : `<button class="btn sm" data-act="voy" data-id="${k.id}">🚨 Voy en camino</button>`}<button class="btn sm ghost" data-act="cerrar" data-id="${k.id}">Cerrar llamada</button></div>` : ''}</div>`;
      body = `<p class="muted">Llamadas para ${Object.keys(SVC911).filter(canRespond).map(k => SVC911[k][1]).join(', ')}. Te llega una alerta cada vez que entra una nueva.</p>
        <h3>Activas (${act.length})</h3>${act.map(card).join('') || '<p class="empty">Sin emergencias activas 🙌</p>'}<h3>Recientes</h3>${done.map(card).join('') || '<p class="muted">—</p>'}`;
    }
    view(el, `${tabs([...(resp ? [['despacho', 'Despacho']] : []), ['llamar', 'Llamar']], tab)}<div class="tabbody">${body}</div>`, {
      tab: d => e911.render(el, d.t),
      async llamar(v) { await db.insert('calls911', { caller_char: S.char.id, service: v.service, location: v.location, description: v.description, anonymous: !!v.anonymous });
        toast('📞 Llamada enviada. Las unidades ya recibieron la alerta.'); e911.render(el, 'llamar'); },
      cancelar: async d => { if (!await ask('¿Cancelar la llamada?')) return; await db.rpc('respond_call', { cid: d.id, act: 'cancel' }); e911.render(el, 'llamar'); },
      voy: async d => { await db.rpc('respond_call', { cid: d.id, act: 'go', c: S.char.id }); toast('Marcado: vas en camino'); e911.render(el, 'despacho'); },
      cerrar: d => modal('Cerrar llamada', form('go', [{ k: 'note', label: 'Cómo terminó (opcional)', type: 'textarea', ph: 'Ej. Sospechoso detenido, sin heridos' }], {}, 'Cerrar'), {
        async go(v, _, close) { await db.rpc('respond_call', { cid: d.id, act: 'close', note: v.note || null }); close(); e911.render(el, 'despacho'); } }),
    });
  } };


// ============ EXPEDIENTES (staff Moderador+: toda la información de una cuenta y sus vidas) ============
const expedientes = { id: 'expedientes', name: 'Expedientes', icon: '🗂️', bg: '#3a3f58,#1b1e2e', show: () => lvl() >= 2,
  async render(el, uid) {
    if (lvl() < 2) return view(el, '<p class="empty">Solo staff (Moderador o superior).</p>');
    const profiles = await db.list('profiles', { order: 'created_at', limit: 5000 }), chars = await db.list('characters', { order: 'created_at', limit: 10000 });
    const go = id => expedientes.render(el, id), skip = new Set(['avatar_url', 'avatar_full', 'skin_url', 'id', 'user_id']);
    // tabla con TODAS las columnas de un registro (lo que exista en la base de datos)
    const kv = o => `<table class="tbl kv">${Object.entries(o).filter(([k, v]) => !skip.has(k) && v !== null && v !== '' && !(Array.isArray(v) && !v.length))
      .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(typeof v === 'object' ? JSON.stringify(v) : /_at$|_until$|^dob$/.test(k) ? fdate(v) : v)}</td></tr>`).join('')}</table>`;
    if (typeof uid !== 'string') {
      const row = p => { const cs = chars.filter(c => c.user_id === p.id);
        return `<tr class="brow" data-s="${esc([p.username, p.roblox, p.discord, ...cs.map(c => c.first_name + ' ' + c.last_name)].join(' ').toLowerCase())}" data-act="ver" data-id="${p.id}">
          <td>${av(p.avatar_url, 'mini-av')} <b>${esc(p.username)}</b></td><td>${esc(p.roblox || '')}</td><td>${esc(p.discord || '')}</td><td>${p.staff_role ? esc(STAFF_NAME[p.staff_role]) : '—'}</td>
          <td>${cs.map(c => `${esc(c.first_name)} ${esc(c.last_name)} <small class="muted">(${esc(c.status)})</small>`).join('<br>') || '<span class="muted">sin vida</span>'}</td><td>${fdate(p.created_at)}</td></tr>`; };
      view(el, `<div class="exp"><h2>Expedientes · ${profiles.length} cuentas</h2><input class="filter" placeholder="Buscar por usuario, Roblox, Discord o nombre de una vida…" data-q autocomplete="off">
        <table class="tbl hover"><thead><tr><th>Usuario</th><th>Roblox</th><th>Discord</th><th>Staff</th><th>Vidas</th><th>Creada</th></tr></thead><tbody>${profiles.map(row).join('')}</tbody></table></div>`, { ver: d => go(d.id) });
      el.querySelector('[data-q]').oninput = e => { const q = e.target.value.toLowerCase().trim(); el.querySelectorAll('.brow').forEach(r => r.hidden = q && !r.dataset.s.includes(q)); };
      return;
    }
    const p = profiles.find(x => x.id === uid), mine = chars.filter(c => c.user_id === uid), ids = mine.map(c => c.id);
    if (!p) return go();
    const all = (t, o = {}) => db.list(t, { limit: 5000, ...o }).catch(() => []);
    const [accs, reqs, recs, inm, emps, vehs, models, props, comps, hold, items, calls, posts, songs, bans, tickets, shifts] = await Promise.all([
      ids.length ? all('accounts', { overlaps: { owners: ids } }) : [], all('requests', { eq: { user_id: uid } }), all('records'), all('inmates'), all('employments', { order: null }),
      all('vehicles'), all('vehicle_models', { order: null }), all('properties', { order: null }), all('companies', { order: null }), all('holdings', { order: null }), all('items'),
      all('calls911'), all('posts'), all('songs'), all('bans'), all('tickets', { eq: { user_id: uid } }), all('shifts', { eq: { user_id: uid } })]);
    const tx = accs.length ? (await Promise.all(accs.map(a => all('transactions', { eq: { to_acc: a.id }, limit: 15 }).then(r => r.concat()).then(async r => r.concat(await all('transactions', { eq: { from_acc: a.id }, limit: 15 }))))))
      .flat().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 25) : [];
    const sec = (t, n, body) => `<details class="exp-s" ${n ? 'open' : ''}><summary>${t}${n === true ? '' : ` <span class="muted">(${n})</span>`}</summary>${body || '<p class="muted">Nada.</p>'}</details>`;
    const list = (arr, f) => arr.length ? `<ul class="list">${arr.map(f).join('')}</ul>` : '';
    const name = c => `${c.first_name} ${c.last_name}`, M = Object.fromEntries(models.map(m => [m.id, m]));
    const sanc = bans.filter(b => [p.username, p.roblox, p.discord].filter(Boolean).some(v => [b.username, b.roblox, b.discord].map(x => String(x || '').toLowerCase()).includes(String(v).toLowerCase())));
    const dutyH = Math.round(shifts.filter(x => new Date(x.started_at) > Date.now() - 7 * 864e5).reduce((m, x) => m + (new Date(x.ended_at || Date.now()) - new Date(x.started_at)) / 6e4, 0) / 6) / 10;
    const life = c => { const mine1 = (arr, k = 'character_id') => arr.filter(x => x[k] === c.id);
      const cAccs = accs.filter(a => a.owners?.includes(c.id)), cVeh = mine1(vehs, 'owner_char'), cProps = mine1(props, 'owner_char'), cComps = comps.filter(x => x.owners?.includes(c.id));
      return `<div class="card exp-life"><div class="row">${av(c.skin_url, 'big-av')}<div class="grow"><h3>${esc(name(c))}</h3><div class="muted">${esc(c.status)} · roles: ${esc((c.roles || []).join(', '))}</div></div></div>
        ${sec('Datos de la vida', true, kv(c))}
        ${sec('Cuentas de banco', cAccs.length, list(cAccs, a => `<li><span class="grow">${esc(a.name || a.kind)} · ${esc(a.number || '')}</span><b>${money(a.balance)}</b></li>`))}
        ${sec('Trámites', mine1(reqs).length, list(mine1(reqs), r => `<li><span class="grow">${esc(TRAMITES[r.type]?.name || r.type)} <small class="muted">${fdate(r.created_at)}</small><div class="muted">${esc(Object.entries(r.data || {}).filter(([, v]) => typeof v !== 'object' && !/^(data:|https?:)/.test(String(v))).map(([k, v]) => k + ': ' + v).join(' · ').slice(0, 300))}</div></span>${badge(r.status)}</li>`))}
        ${sec('Antecedentes', mine1(recs).length, list(mine1(recs), r => `<li><span class="grow"><b>${esc(r.kind)}</b> ${esc(r.description)} <small class="muted">${fdate(r.created_at)} · ${esc(cname(r.officer_id))}</small></span>${r.amount ? `<b>${money(r.amount)}</b>` : ''}</li>`))}
        ${sec('Prisión', mine1(inm).length, list(mine1(inm), i => `<li><span class="grow">${esc(i.status)} · ${pena(i.years)} (${Math.round(i.minutes)} min) · ${i.ends_at ? 'sale ' + fdate(i.ends_at) : 'en espera de juicio'}</span></li>`))}
        ${sec('Empleos', mine1(emps).length, list(mine1(emps), e => `<li><span class="grow">${esc(e.dept)} · ${esc(e.rank)} <small class="muted">desde ${fdate(e.hired_at)}</small></span>${badge(e.status === 'fired' ? 'rejected' : e.status)}</li>`))}
        ${sec('Vehículos', cVeh.length, list(cVeh, v => `<li><span class="grow">${esc(M[v.model_id]?.brand || '')} ${esc(M[v.model_id]?.model || '')} · placa ${esc(v.plate || '—')} · VIN ${esc(v.vin || '—')}</span></li>`))}
        ${sec('Propiedades', cProps.length, list(cProps, x => `<li><span class="grow">${esc(x.name)}</span><b>${money(x.price)}</b></li>`))}
        ${sec('Empresas y acciones', cComps.length + mine1(hold).length, list(cComps, x => `<li>🏢 ${esc(x.name)}</li>`) + list(mine1(hold), h => `<li>📈 ${esc(comps.find(x => x.id === h.company_id)?.name || h.company_id)} · ${h.shares} acciones</li>`))}
        ${sec('Inventario (Tool Store)', mine1(items, 'owner_char').length, list(mine1(items, 'owner_char'), i => `<li>${esc(SHOPI[i.item]?.name || i.item)}${i.serial ? ' · serie ' + esc(i.serial) : ''} <small class="muted">${fdate(i.created_at)}</small></li>`))}
        ${sec('Llamadas al 911', mine1(calls, 'caller_char').length, list(mine1(calls, 'caller_char'), k => `<li><span class="grow">${esc(SVC911[k.service]?.[1] || k.service)} · ${esc(k.location)}: ${esc(k.description)} <small class="muted">${fdate(k.created_at)}</small></span>${esc(k.status)}</li>`))}
        ${sec('Redes y música', mine1(posts).length + mine1(songs, 'uploader_char').length, `<p>${mine1(posts).length} publicaciones · ${mine1(songs, 'uploader_char').length} canciones (${mine1(songs, 'uploader_char').reduce((n, x) => n + (x.plays || 0), 0)} reproducciones)</p>`)}
      </div>`; };
    view(el, `<div class="exp"><button class="link" data-act="volver">‹ Todas las cuentas</button>
      <div class="row exp-h">${av(p.avatar_url, 'big-av')}<div class="grow"><h2>${esc(p.username)}</h2><div class="muted">Roblox ${esc(p.roblox || '—')} · Discord ${esc(p.discord || '—')} · ${p.staff_role ? esc(STAFF_NAME[p.staff_role]) : 'Sin rango de staff'} · creada ${fdate(p.created_at)}</div></div></div>
      ${sec('Datos de la cuenta', true, kv(p) + `<p class="muted">Servicio de staff últimos 7 días: ${dutyH} h · Tickets de soporte: ${tickets.length}</p>`)}
      ${sec('Sanciones', sanc.length, list(sanc, b => `<li><span class="grow"><b>${esc(b.kind)}</b> · ${esc(b.reason)} <small class="muted">${fdate(b.created_at)} · hasta ${esc(b.until || 'permanente')}</small></span></li>`))}
      ${sec('Últimos movimientos de banco', tx.length, list(tx, t => `<li><span class="grow">${esc(t.concept)} <small class="muted">${fdate(t.created_at)}</small></span><b class="${accs.some(a => a.id === t.to_acc) ? 'pos' : 'neg'}">${accs.some(a => a.id === t.to_acc) ? '+' : '−'}${money(t.amount)}</b></li>`))}
      <h2>Vidas (${mine.length})</h2>${mine.map(life).join('') || '<p class="empty">Esta cuenta no ha creado vidas.</p>'}</div>`, { volver: () => go() });
  } };



// ============ BITSO (cripto con oferta fija; el precio lo mueven las compras y ventas de los jugadores contra un pool x·y=k) ============
const cfmt = p => p >= 1000 ? money(p) : p >= 1 ? '$' + Number(p).toFixed(2) : '$' + Number(p).toFixed(4);
const cfmt8 = n => (Math.floor(Number(n) * 1e8) / 1e8).toFixed(8).replace(/\.?0+$/, '') || '0';
const bitso = { id: 'bitso', name: 'Bitso', icon: '🪙', bg: '#0b2b1f,#0f7a4f', show: () => true,
  async render(el, sel = null, range = 5 * 60e3) {
    if (typeof sel !== 'string') sel = null; if (range > 14 * 3600e3 || range < 60e3) range = 5 * 60e3; // range = duración de cada vela
    if (!needChar(el)) return;
    await db.rpc('crypto_tick').catch(() => {});
    const [coins, holds, accs] = await Promise.all([db.list('crypto_coins', { order: 'ord', asc: true }), db.list('crypto_hold', { eq: { character_id: S.char.id }, order: null }), myAccounts()]);
    const day = Object.fromEntries(await Promise.all(coins.map(async c => [c.sym, (await db.rpc('crypto_chart', { s: c.sym, minutes: 1440 }) || []).map(x => Number(x.price))])));
    const H = Object.fromEntries(holds.map(h => [h.sym, h])), bal = Number(accs.find(a => a.kind === 'personal')?.balance || 0);
    const val = c => Number(H[c.sym]?.qty || 0) * Number(c.price), total = coins.reduce((n, c) => n + val(c), 0), cost = holds.reduce((n, h) => n + Number(h.cost), 0);
    const ch = c => pct(Number(c.price), day[c.sym][0] || Number(c.price));
    let body;
    if (sel) {
      const c = coins.find(x => x.sym === sel), h = H[sel], q = Number(h?.qty || 0), pl = val(c) - Number(h?.cost || 0);
      const trades = await db.list('crypto_trades', { eq: { character_id: S.char.id, sym: sel }, limit: 20 }), myAddr = await db.rpc('crypto_addr', { c: S.char.id, s: sel });
      const rawHist = (await db.list('crypto_hist', { eq: { sym: sel }, order: 't', limit: 5000 }).catch(() => [])).reverse();
      body = `<button class="link" data-act="home">‹ Mercado</button>
        <div class="bx-top"><span class="bx-dot" style="background:${c.color}">${esc(c.sym[0])}</span><div><h2>${esc(c.name)} <small class="muted">${esc(c.sym)}</small></h2><div class="bx-price">${cfmt(c.price)} ${sgn(ch(c))}</div></div></div>
        ${tfBar(range)}${candles(rawHist.map(x => ({ t: +new Date(x.t), p: +x.price })), range, Number(c.price))}
        <div class="bx-grid"><div class="card"><h3>Tu ${esc(c.sym)}</h3><p><b>${q.toFixed(8).replace(/\.?0+$/, '') || 0}</b> ${esc(c.sym)} ≈ <b>${money(val(c))}</b></p>${q ? `<p>Ganancia/pérdida: <b class="${pl >= 0 ? 'pos' : 'neg'}">${pl >= 0 ? '+' : '−'}${money(Math.abs(pl))}</b></p>` : ''}</div>
          <form class="card form" data-form="buy"><h3>Comprar</h3><label class="fld"><span>Dólares a invertir (saldo ${money(bal)})</span><input name="usd" type="number" min="1" step="0.01" required></label><button class="btn bx-buy">Comprar ${esc(c.sym)}</button></form>
          <form class="card form" data-form="sell"><h3>Vender</h3><label class="fld"><span>Cantidad de ${esc(c.sym)}</span><input name="qty" type="number" min="0" step="any" max="${q}" required></label><div class="row"><button type="button" class="btn ghost sm" data-act="all">Todo</button><span class="grow"></span><button class="btn bx-sell">Vender</button></div><p class="muted">Comprar, tener o enviar cripto no paga impuestos. Al venderla a dinero pagas ${(set('impuestos')?.crypto ?? 25)}% sobre tu <b>ganancia</b> (si vendes con pérdida no pagas nada).</p></form>
          <div class="card bx-wallet"><h3>Recibir ${esc(c.sym)}</h3><p class="muted">Tu dirección de depósito. Compártela para que te envíen ${esc(c.sym)}; solo sirve para esta moneda.</p><code class="bx-addr">${esc(myAddr)}</code><button class="btn sm ghost" data-act="copyaddr">Copiar dirección</button></div>
          <form class="card form" data-form="send"><h3>Enviar ${esc(c.sym)}</h3><label class="fld"><span>Dirección de ${esc(c.sym)} del destinatario</span><input name="addr" required placeholder="${esc(myAddr.slice(0, 6))}…" autocomplete="off" spellcheck="false"></label><div class="bx-send-amt"><label class="fld grow"><span>Cantidad</span><input name="amt" type="number" min="0" step="any" required></label>
            <label class="fld"><span>En</span><select name="unit"><option value="coin">${esc(c.sym)}</option><option value="usd">USD</option></select></label><button type="button" class="btn ghost sm" data-act="sendmax">Máx</button></div>
            <p class="muted">Puedes mandar hasta <b>${cfmt8(q / 1.001)} ${esc(c.sym)}</b> ≈ <b>${money(q / 1.001 * Number(c.price))}</b> (ya descontando la comisión de red).</p>
            <div class="bx-sum-send" data-sendsum></div><button class="btn">Enviar</button><p class="muted">Comisión de red: 0.1% (se cobra aparte). Solo puedes mandar ${esc(c.sym)} a una dirección de ${esc(c.sym)}. Revisa bien la dirección: una transacción enviada no se puede revertir. No pasa por el banco.</p></form></div>
        <div class="kpis"><div><small>Monedas que existen</small><b>${Number(c.supply || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</b></div><div><small>En manos de jugadores</small><b>${Number((c.supply || 0) - (c.pool_coin || 0)).toLocaleString('en-US', { maximumFractionDigits: 4 })}</b></div>
          <div><small>Capitalización</small><b>${money(Number(c.price) * Number(c.supply || 0))}</b></div><div><small>Dólares en la reserva</small><b>${money(c.pool_usd)}</b></div></div>
        <p class="muted">Como una cripto real: hay una cantidad fija de monedas y el precio lo mueven las compras y ventas de todos los jugadores. Comprar sube el precio, vender lo baja, y entre más grande la orden más lo mueve. Comisión 0.5%. El gobierno no participa.</p>
        <h3>Tus movimientos</h3><ul class="list">${trades.map(t => `<li><span class="grow">${{ buy: '🟢 Compra', sell: '🔴 Venta', send: '📤 Enviaste', receive: '📥 Recibiste' }[t.side] || esc(t.side)}${t.txid ? ` <code class="bx-tx" title="${esc(t.txid)}">tx ${esc(t.txid.slice(0, 10))}…</code>` : ''} ${Number(t.qty).toFixed(8).replace(/\.?0+$/, '')} ${esc(t.sym)} a ${cfmt(t.price)} <small class="muted">${fdate(t.created_at)}</small></span><b>${money(t.usd)}</b></li>`).join('') || '<p class="muted">Aún no operas esta moneda.</p>'}</ul>`;
    } else body = `<div class="bx-sum card"><div><small class="muted">Tu portafolio cripto</small><div class="bx-price">${money(total)}</div>${cost ? `<div class="${total - cost >= 0 ? 'pos' : 'neg'}">${total - cost >= 0 ? '+' : '−'}${money(Math.abs(total - cost))} desde que compraste</div>` : ''}</div><div><small class="muted">Saldo en tu cuenta</small><div><b>${money(bal)}</b></div></div></div>
      ${holds.some(h => h.qty > 0) ? `<h3>Mi portafolio</h3><table class="tbl"><thead><tr><th>Moneda</th><th>Tienes</th><th>Invertiste</th><th>Vale hoy</th><th>Ganancia</th><th>%</th></tr></thead><tbody>${coins.filter(c => H[c.sym]?.qty > 0).map(c => { const h = H[c.sym], v = val(c), g = v - Number(h.cost);
        return `<tr class="click" data-act="coin" data-s="${c.sym}"><td><b>${esc(c.sym)}</b></td><td>${Number(h.qty).toFixed(8).replace(/\.?0+$/, '')}</td><td>${money(h.cost)}</td><td>${money(v)}</td><td class="${g >= 0 ? 'pos' : 'neg'}">${g >= 0 ? '+' : '−'}${money(Math.abs(g))}</td><td>${sgn(pct(v, Number(h.cost)))}</td></tr>`; }).join('')}</tbody></table>` : ''}
      <h3>Mercado</h3><ul class="list bx-list">${coins.map(c => `<li data-act="coin" data-s="${c.sym}"><span class="bx-dot" style="background:${c.color}">${esc(c.sym[0])}</span><div class="grow"><b>${esc(c.name)}</b><div class="muted">${esc(c.sym)}${H[c.sym]?.qty > 0 ? ` · tienes ${money(val(c))}` : ''}</div></div>
        <div class="bx-spark">${chart(day[c.sym], 120, 36, false)}</div><div class="bx-r"><b>${cfmt(c.price)}</b><div>${sgn(ch(c))}</div></div></li>`).join('')}</ul><p class="muted">El precio de cada moneda lo deciden las compras y ventas de los jugadores. Se actualiza en vivo.</p>`;
    view(el, `<div class="bx"><header class="bx-h"><b>bitso</b><span class="grow"></span><span class="muted">en vivo ●</span></header><div class="tabbody">${body}</div></div>`, {
      home: () => bitso.render(el), coin: d => bitso.render(el, d.s), tf: d => bitso.render(el, sel, +d.ms),
      all: (_, b) => { b.form.qty.value = Number(H[sel]?.qty || 0); },
      async buy(v) { const r = await db.rpc('crypto_trade', { c: S.char.id, s: sel, side: 'buy', amount: +v.usd }); toast(`Compraste ${Number(r.qty).toFixed(8).replace(/\.?0+$/, '')} ${sel} · nuevo precio ${cfmt(r.new_price)}`); bitso.render(el, sel, range); window.liveRefresh?.(); },
      copyaddr: () => { navigator.clipboard?.writeText(el.querySelector('.bx-addr').textContent); toast('Dirección copiada'); },
      sendmax: (_, b) => { const f = b.form, mx = Math.floor(Number(H[sel]?.qty || 0) / 1.001 * 1e8) / 1e8, pr = Number(coins.find(x => x.sym === sel).price); f.amt.value = f.unit.value === 'usd' ? Math.floor(mx * pr * 100) / 100 : mx; f.amt.dispatchEvent(new Event('input', { bubbles: true })); },
      async send(v) { const pr = Number(coins.find(x => x.sym === sel).price), qty = Math.floor((v.unit === 'usd' ? +v.amt / pr : +v.amt) * 1e8) / 1e8;
        if (!(qty > 0)) throw new Error('Cantidad inválida');
        if (!await ask(`¿Enviar ${cfmt8(qty)} ${sel} (≈ ${money(qty * pr)}) a ${v.addr.trim().slice(0, 14)}…? Comisión de red ${cfmt8(qty * 0.001)} ${sel}. No se puede revertir.`)) return;
        const r = await db.rpc('crypto_send', { c: S.char.id, addr: v.addr.trim(), s: sel, amount: qty }); toast(`Enviado ✓ · comisión ${r.fee} ${sel} · tx ${String(r.txid).slice(0, 10)}…`); bitso.render(el, sel, range); },
      async sell(v) { const r = await db.rpc('crypto_trade', { c: S.char.id, s: sel, side: 'sell', amount: +v.qty }); toast(`Vendiste por ${money(r.usd)}${r.tax > 0 ? ` · impuesto sobre tu ganancia ${money(r.tax)} · te llegan ${money(r.usd - r.tax)}` : ''}`); bitso.render(el, sel, range); window.liveRefresh?.(); },
    });
    const sf = el.querySelector('form[data-form=send]');
    if (sf) { const pr = Number(coins.find(x => x.sym === sel).price), have = Number(H[sel]?.qty || 0);
      sf.oninput = sf.onchange = () => { const a = +sf.amt.value || 0, qty = sf.unit.value === 'usd' ? a / pr : a, fee = qty * 0.001, ok = qty + fee <= have + 1e-9;
        sf.querySelector('[data-sendsum]').innerHTML = a ? `<div>Envías <b>${cfmt8(qty)} ${esc(sel)}</b> ≈ <b>${money(qty * pr)}</b></div><div>Comisión de red: ${cfmt8(fee)} ${esc(sel)} ≈ ${money(fee * pr)}</div>
          <div>Total que sale de tu wallet: <b>${cfmt8(qty + fee)} ${esc(sel)}</b> · te quedan ${cfmt8(Math.max(0, have - qty - fee))}</div>${ok ? '' : '<div class="neg">No te alcanza</div>'}` : ''; }; }
    // en vivo: vuelve a pintar cada 30 s mientras la ventana siga abierta y nadie esté escribiendo
    clearTimeout(el._bx); el._bx = setTimeout(() => { if (el.isConnected && el.querySelector('.bx') && !el.contains(document.activeElement)) bitso.render(el, sel, range); }, sel ? 10000 : 30000);
  } };

// ============ CASINO (el servidor decide todo; apuestas → Tesorería, premios ← Tesorería) ============
const CAS = { dice: ['🎲', 'Dados'], limbo: ['🚀', 'Limbo'], coin: ['🪙', 'Volado'], roulette: ['🎡', 'Ruleta'], slots: ['🎰', 'Tragamonedas'], plinko: ['🔻', 'Plinko'], wheel: ['🛞', 'Rueda'],
  blackjack: ['🃏', 'Blackjack'], poker: ['♠️', 'Video póker'], mines: ['💣', 'Minas'], mesas: ['👥', 'Con gente'], hist: ['🧾', 'Mis apuestas'] };
const CAS_TABLE = ['blackjack', 'poker', 'mines'];
const PLINKO = [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13], WHEEL = [0, 1.2, 0, 1.5, 0, 1.2, 0, 2, 0, 4], REDS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const SLOT_SYM = ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣'], WHEEL_COL = { 0: '#2f4553', 1.2: '#4cc3ff', 1.5: '#00e701', 2: '#ffd200', 4: '#ff4d6d' };
const POKER_HANDS = { 800: 'Flor imperial', 50: 'Escalera de color', 25: 'Póker', 9: 'Full house', 6: 'Color', 4: 'Escalera', 3: 'Tercia', 2: 'Dos pares', 1: 'Par de J o mejor' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rcol = n => n === 0 ? 'verde' : REDS.includes(n) ? 'rojo' : 'negro';
const cardHTML = (n, cls = '') => n < 0 ? `<div class="cas-card back ${cls}"></div>` : (() => { const r = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'][n % 13], su = ['♠','♥','♦','♣'][Math.floor(n / 13)];
  return `<div class="cas-card ${su === '♥' || su === '♦' ? 'red' : ''} ${cls}"><b>${r}</b><span>${su}</span><b class="br">${r}</b></div>`; })();
const fx = n => (Math.round(n * 100) / 100).toLocaleString('en-US');

// animaciones de los juegos instantáneos: pintan en el escenario y terminan cuando el resultado ya está a la vista
const CAS_ANIM = {
  async dice(st, r, v) { const t = +v.tg, over = v.over === '1';
    st.innerHTML = `<div class="cas-big" data-n>0.00</div><div class="cas-track"><i style="${over ? `left:${t}%;right:0` : `left:0;right:${100 - t}%`}"></i><b data-m style="left:0%">${''}</b></div>`;
    const n = st.querySelector('[data-n]'), m = st.querySelector('[data-m]'); requestAnimationFrame(() => m.style.left = r.roll + '%');
    for (let k = 0; k < 14; k++) { n.textContent = (Math.random() * 100).toFixed(2); await sleep(40); } n.textContent = r.roll.toFixed(2); await sleep(350); },
  async limbo(st, r) { st.innerHTML = '<div class="cas-big" data-n>1.00×</div>'; const n = st.querySelector('[data-n]'), end = Math.min(r.result, 1e6), T = Math.min(1600, 400 + Math.log(end) * 300), t0 = performance.now();
    await new Promise(ok => { const f = now => { const p = Math.min(1, (now - t0) / T); n.textContent = fx(Math.exp(Math.log(end) * p)) + '×'; p < 1 ? requestAnimationFrame(f) : ok(); }; requestAnimationFrame(f); });
    n.classList.add(r.mult > 0 ? 'cas-g' : 'cas-r'); },
  async coin(st, r) { st.innerHTML = `<div class="cas-coin"><div class="cas-coin-in ${r.side}"><span class="f">CARA</span><span class="b">CRUZ</span></div></div>`; await sleep(1700); },
  async roulette(st, r) { const cells = Array.from({ length: 60 }, (_, i) => i === 52 ? r.n : Math.floor(Math.random() * 37));
    st.innerHTML = `<div class="cas-strip"><div class="cas-strip-in">${cells.map(n => `<span class="cas-${rcol(n)}">${n}</span>`).join('')}</div><i></i></div>`;
    const inner = st.querySelector('.cas-strip-in'), w = st.querySelector('.cas-strip').clientWidth;
    requestAnimationFrame(() => requestAnimationFrame(() => inner.style.transform = `translateX(${w / 2 - (52 * 56 + 28) + (Math.random() * 30 - 15)}px)`)); await sleep(3100); },
  async slots(st, r) { st.innerHTML = `<div class="cas-reels">${r.reels.map((s, i) => `<div class="cas-reel"><div class="cas-reel-in" style="transition-duration:${1 + i * 0.45}s">${[...Array.from({ length: 24 }, () => SLOT_SYM[Math.random() * 6 | 0]), s].map(x => `<span>${x}</span>`).join('')}</div></div>`).join('')}</div>`;
    requestAnimationFrame(() => requestAnimationFrame(() => st.querySelectorAll('.cas-reel-in').forEach(x => x.style.transform = `translateY(-${24 * 72}px)`))); await sleep(2100); },
  async plinko(st, r) { const W = 300, gap = W / 9, H = 26; // 9 cubetas: la bola cae al centro de la suya
    st.innerHTML = `<div class="cas-plinko" style="width:${W}px;height:${H * 9 + 40}px">${Array.from({ length: 8 }, (_, row) => Array.from({ length: row + 3 }, (_, k) => `<i style="left:${W / 2 + (k - (row + 2) / 2) * gap}px;top:${(row + 1) * H}px"></i>`).join('')).join('')}
      <b class="cas-ball" style="left:${W / 2}px;top:0"></b><div class="cas-row cas-pk-slots" style="top:${H * 9 + 6}px">${PLINKO.map(m => `<span>×${m}</span>`).join('')}</div></div>`;
    const ball = st.querySelector('.cas-ball'); let x = W / 2;
    for (let k = 0; k < 8; k++) { x += (r.path[k] ? 1 : -1) * gap / 2; await sleep(150); ball.style.left = x + 'px'; ball.style.top = (k + 1) * H + H * 0.6 + 'px'; }
    await sleep(200); st.querySelectorAll('.cas-pk-slots span')[r.slot].classList.add('cas-hit'); await sleep(300); },
  async wheel(st, r) { const grad = WHEEL.map((m, i) => `${WHEEL_COL[m]} ${i * 36}deg ${(i + 1) * 36}deg`).join(',');
    st.innerHTML = `<div class="cas-wheel"><div class="cas-wheel-in" style="background:conic-gradient(${grad})">${WHEEL.map((m, i) => `<span style="transform:rotate(${i * 36 + 18}deg) translateY(-92px)">×${m}</span>`).join('')}</div><i></i></div>`;
    const w = st.querySelector('.cas-wheel-in'); requestAnimationFrame(() => requestAnimationFrame(() => w.style.transform = `rotate(${360 * 5 + 360 - (r.seg * 36 + 18) + (Math.random() * 20 - 10)}deg)`)); await sleep(3300); },
};

const casino = { id: 'casino', name: 'Casino', icon: '🎰', bg: '#0f212e,#1a2c38', show: () => true,
  async render(el, game = 'dice', bet = 10) {
    if (typeof game !== 'string') game = 'dice';
    if (!needChar(el)) return;
    const win = el.closest('.win'); if (win) { if (game === 'mesas') delete win.dataset.dirty; else win.dataset.dirty = '1'; } // el refresco automático borraría la jugada en curso (las mesas sí se refrescan solas)
    const accs = await myAccounts(), bal = Number(accs.find(a => a.kind === 'personal')?.balance || 0);
    const hand = CAS_TABLE.includes(game) ? await db.rpc('casino_open', { c: S.char.id, game }) : null;
    const betBox = `<label class="fld"><span>Apuesta (USD)</span><div class="cas-bet"><input name="bet" type="number" min="1" step="0.01" value="${bet}" required><button type="button" data-act="half">½</button><button type="button" data-act="dbl">2×</button><button type="button" data-act="max">Máx</button></div></label>`;
    const ctl = {
      dice: `<label class="fld"><span>Número objetivo (2–98)</span><input name="tg" type="range" min="2" max="98" value="50"></label>
        <label class="fld"><span>Dirección</span><select name="over"><option value="1">Más que (over)</option><option value="0">Menos que (under)</option></select></label><p class="cas-dinfo muted"></p>`,
      limbo: `<label class="fld"><span>Multiplicador objetivo (1.01–1000)</span><input name="tg" type="number" min="1.01" max="1000" step="0.01" value="2" required></label><p class="muted">Sale un multiplicador al azar. Si es igual o mayor a tu objetivo, ganas apuesta × objetivo. Probabilidad ≈ 99% ÷ objetivo.</p>`,
      coin: `<label class="fld"><span>Elige</span><select name="side"><option value="cara">Cara</option><option value="cruz">Cruz</option></select></label><p class="muted">Paga ×1.98.</p>`,
      roulette: `<label class="fld"><span>Apuesta a</span><select name="pick"><option value="rojo">🔴 Rojo (×2)</option><option value="negro">⚫ Negro (×2)</option><option value="par">Par (×2)</option><option value="impar">Impar (×2)</option>
        <option value="bajo">1–18 (×2)</option><option value="alto">19–36 (×2)</option><option value="d1">1ª docena 1–12 (×3)</option><option value="d2">2ª docena 13–24 (×3)</option><option value="d3">3ª docena 25–36 (×3)</option>
        ${Array.from({ length: 37 }, (_, n) => `<option value="n${n}">Número ${n} (×36)</option>`).join('')}</select></label><p class="muted">Ruleta europea (0–36).</p>`,
      slots: `<p class="muted">Tres iguales: 🍒×5 · 🍋×10 · 🔔×20 · ⭐×50 · 💎×100 · 7️⃣×250. Dos iguales: ×0.7.</p>`,
      plinko: `<p class="muted">La bola cae por 8 filas de clavos. Orillas ×13, centro ×0.4.</p>`,
      wheel: `<p class="muted">10 casillas: ×0, ×1.2, ×1.5, ×2 y ×4.</p>`,
      blackjack: `<p class="muted">El blackjack paga 3 a 2. El crupier se planta en 17. Puedes doblar con tus dos primeras cartas.</p>`,
      poker: `<p class="muted">Jacks or Better: recibes 5 cartas, eliges cuáles quedarte y cambias las demás.</p><table class="cas-pay">${Object.entries(POKER_HANDS).reverse().map(([m, n]) => `<tr><td>${n}</td><td>×${m}</td></tr>`).join('')}</table>`,
      mines: `<label class="fld"><span>Número de minas (1–24)</span><input name="mines" type="number" min="1" max="24" value="3" required></label><p class="muted">Destapa casillas con diamante y retírate cuando quieras. Si sale una mina, pierdes. <b>Entre más minas, más paga cada diamante</b>; con pocas minas casi no ganas.</p>
        <table class="cas-pay"><tr><td>Minas</td><td>1er diamante</td><td>3 diamantes</td></tr>${[1, 3, 5, 10, 15, 20, 24].map(n => { const m = k => { let x = 0.92 + 0.003 * n; for (let i = 0; i < k; i++) x *= (25 - i) / (25 - n - i); return x; };
          return `<tr><td>${n}</td><td>×${fx(m(1))}</td><td>${n <= 22 ? '×' + fx(m(3)) : '—'}</td></tr>`; }).join('')}</table>`,
    };
    const acts = {
      tab: d => casino.render(el, d.t, el.querySelector('[name=bet]')?.value || bet),
      half: (_, b) => { const i = b.form.bet; i.value = Math.max(1, Math.round(i.value / 2 * 100) / 100); },
      dbl: (_, b) => { const i = b.form.bet; i.value = Math.min(50000, bal, i.value * 2); },
      max: (_, b) => { b.form.bet.value = Math.min(50000, Math.floor(bal * 100) / 100); },
    };
    const idle = () => `<div class="cas-out idle">${CAS[game][0]}<b>${CAS[game][1]}</b></div>`;
    let body;
    if (game === 'mesas') { // mesas con gente: juegan entre jugadores, el ganador se lleva el bote y la casa cobra 5%
      const [tbs, seats] = await Promise.all([db.list('casino_tables', { limit: 40 }), db.list('casino_seats', { order: 'joined_at', asc: true, limit: 500 })]);
      const open = tbs.filter(t => t.status === 'open'), done = tbs.filter(t => t.status === 'done').slice(0, 8), me = S.char.id, G = { jackpot: ['🎯', 'Jackpot'], dados: ['🎲', 'Duelo de dados'] };
      const sits = t => seats.filter(x => x.table_id === t.id), pot = t => sits(t).reduce((n, x) => n + Number(x.amount), 0);
      const seatHTML = (t, x) => `<div class="pvp-seat ${t.winner === x.character_id ? 'won' : ''}">${av(skin(x.character_id), 'av sm')}<b>${esc(cname(x.character_id))}</b>
        <small>${money(x.amount)}${t.game === 'jackpot' && pot(t) ? ` · ${(x.amount / pot(t) * 100).toFixed(1)}%` : ''}${x.roll ? ` · 🎲 ${x.roll}` : ''}</small></div>`;
      body = `<div class="pvp"><form class="form pvp-new" data-form="mesa"><b>Abrir una mesa</b>${fieldsHTML([{ k: 'g', label: 'Juego', type: 'select', options: [['jackpot', '🎯 Jackpot: cada quien pone lo que quiera; entre más pongas, más probabilidad'], ['dados', '🎲 Duelo de dados: todos ponen lo mismo y gana el tiro más alto']], req: 1, def: 'jackpot' },
        { k: 'amount', label: 'Tu apuesta (USD)', type: 'number', min: 1, step: 0.01, req: 1, def: bet }, { k: 'maxp', label: 'Máximo de jugadores', type: 'number', min: 2, max: 10, def: 6 }])}<button class="btn" type="submit">Abrir mesa</button>
        <p class="muted">El ganador se lleva todo el bote menos 5% de comisión, que va a la Tesorería. Si la mesa se llena se juega sola; si no, el anfitrión la inicia con 2 o más.</p></form>
        <h3>Mesas abiertas</h3>${open.map(t => { const sd = sits(t), inn = sd.some(x => x.character_id === me), host = t.host === me;
          return `<div class="pvp-t"><div class="row"><b class="grow">${G[t.game][0]} ${G[t.game][1]} · de ${esc(cname(t.host))}</b><span class="tag">${sd.length}/${t.max_players}</span><b class="cas-g">Bote ${money(pot(t))}</b></div>
          <div class="pvp-seats">${sd.map(x => seatHTML(t, x)).join('')}</div><div class="row gap">
          ${!inn ? (t.game === 'dados' ? `<button class="btn ok" data-act="unirme" data-id="${t.id}">Entrar por ${money(t.buy_in)}</button>` : `<input type="number" min="1" step="0.01" value="${t.buy_in}" data-amt="${t.id}" class="pvp-amt"><button class="btn ok" data-act="unirme" data-id="${t.id}">Entrar</button>`) : ''}
          ${host && sd.length >= 2 ? `<button class="btn" data-act="iniciar" data-id="${t.id}">${t.game === 'dados' ? '🎲 Tirar dados' : '🎯 Girar'}</button>` : ''}
          ${inn ? `<button class="btn ghost bad" data-act="salir" data-id="${t.id}">${host ? 'Cerrar mesa (devuelve todo)' : 'Salirme'}</button>` : ''}</div></div>`; }).join('') || '<p class="empty">No hay mesas abiertas. ¡Abre una!</p>'}
        <h3>Últimos resultados</h3>${done.map(t => `<div class="pvp-t done ${t.winner === me ? 'mine' : ''}"><div class="row"><b class="grow">${G[t.game][0]} ${G[t.game][1]} · ganó <span class="cas-g">${esc(cname(t.winner))}</span></b><b>${money(t.result?.prize)}</b></div>
          <div class="pvp-seats">${sits(t).map(x => seatHTML(t, x)).join('')}</div>${(t.result?.rounds || []).length > 1 ? `<small class="muted">Hubo empate: se volvió a tirar ${t.result.rounds.length - 1} vez/veces.</small>` : ''}<small class="muted">${fdate(t.finished_at)}</small></div>`).join('') || '<p class="muted">Aún no hay partidas.</p>'}</div>`;
      Object.assign(acts, {
        async mesa(v) { await db.rpc('pvp_create', { c: me, game: v.g, amount: +v.amount, maxp: +v.maxp || 6 }); toast('Mesa abierta 👥'); window.liveRefresh?.(); casino.render(el, 'mesas', v.amount); },
        async unirme(d) { await db.rpc('pvp_join', { t: d.id, c: me, amount: +(el.querySelector(`[data-amt="${d.id}"]`)?.value || 0) || null }); toast('Entraste a la mesa'); window.liveRefresh?.(); casino.render(el, 'mesas'); },
        async iniciar(d) { await db.rpc('pvp_start', { t: d.id }); const t = (await db.list('casino_tables', { eq: { id: d.id } }))[0]; toast(t?.winner === me ? `🎉 ¡Ganaste ${money(t.result?.prize)}!` : `Ganó ${cname(t?.winner)}`); casino.render(el, 'mesas'); },
        async salir(d) { await db.rpc('pvp_leave', { t: d.id, c: me }); toast('Dinero devuelto'); window.liveRefresh?.(); casino.render(el, 'mesas'); },
      });
    } else if (game === 'hist') {
      const rows = await db.list('casino_bets', { eq: { character_id: S.char.id }, limit: 100 });
      const tb = rows.reduce((n, r) => n + Number(r.bet), 0), tp = rows.reduce((n, r) => n + Number(r.payout), 0);
      body = `<p>Últimas ${rows.length} apuestas · apostado ${money(tb)} · ganado ${money(tp)} · <b class="${tp - tb >= 0 ? 'pos' : 'neg'}">neto ${tp - tb >= 0 ? '+' : '−'}${money(Math.abs(tp - tb))}</b></p>
        <table class="tbl"><thead><tr><th>Juego</th><th>Apuesta</th><th>×</th><th>Pago</th><th>Fecha</th></tr></thead><tbody>${rows.map(r => `<tr><td>${CAS[r.game]?.join(' ') || esc(r.game)}</td><td>${money(r.bet)}</td><td>${fx(r.mult)}</td><td class="${r.payout > 0 ? 'pos' : 'neg'}">${money(r.payout)}</td><td>${fdate(r.created_at)}</td></tr>`).join('')}</tbody></table>`;
    } else body = `<div class="cas-game"><form class="cas-side form" data-form="play">${betBox}${ctl[game]}<div class="cas-acts"><button class="btn big cas-go" type="submit">${CAS_TABLE.includes(game) ? 'Jugar' : 'Apostar'}</button></div></form>
      <div class="cas-stage"><div class="cas-show">${idle()}</div><div class="cas-res"></div></div></div>`;
    view(el, `<div class="cas"><header class="cas-h"><b>🎰 Casino Los Ángeles</b><span class="grow"></span><span>Saldo <b data-bal>${money(bal)}</b></span></header>
      ${tabs(Object.entries(CAS).map(([k, [i, n]]) => [k, i + ' ' + n]), game)}<div class="tabbody">${body}<p class="muted cas-legal">Juego responsable. Lo que pierdes va a la Tesorería del gobierno y los premios los paga la Tesorería. Apuesta máxima ${money(50000)}.</p></div></div>`, acts);
    if (game === 'hist' || game === 'mesas') return;
    const form = el.querySelector('.cas-side'), show = el.querySelector('.cas-show'), res = el.querySelector('.cas-res'), go = el.querySelector('.cas-go'), acts2 = el.querySelector('.cas-acts');
    const refreshBal = () => myAccounts().then(a => { const b = money(a.find(y => y.kind === 'personal')?.balance); el.querySelector('[data-bal]').textContent = b; document.querySelectorAll('.cash,.wb-bal').forEach(x => x.textContent = b); });
    const result = r => { res.innerHTML = r.payout > 0 ? `<b class="cas-g cas-pop">Ganaste ${money(r.payout)} (×${fx(r.mult)})</b>` : `<b class="cas-r cas-pop">Perdiste ${money(r.bet)}</b>`; res.closest('.cas-stage').classList.toggle('cas-won', r.payout > 0); refreshBal(); };
    if (game === 'dice') { const upd = () => { const t = +form.tg.value, o = form.over.value === '1'; el.querySelector('.cas-dinfo').textContent = `Gana si sale ${o ? 'MÁS' : 'MENOS'} de ${t} · ${o ? 100 - t : t}% · paga ×${(99 / (o ? 100 - t : t)).toFixed(4)}`; };
      form.tg.oninput = form.over.onchange = upd; upd(); }
    // juegos de mesa: dibuja la mano actual (las cartas nuevas entran con animación)
    let shown = { p: 0, d: 0, h: [] }, holds = [false, false, false, false, false];
    const table = (v, fresh) => {
      if (v.game === 'blackjack') {
        const row = (cs, k) => cs.map((c, i) => cardHTML(c, i >= shown[k] || fresh ? 'deal' : '')).join('');
        show.innerHTML = `<div class="cas-bj"><div><small>Crupier · ${v.status === 'open' ? v.dv + ' + ?' : v.dv}</small><div class="cas-hand">${row(v.d, 'd')}</div></div>
          <div><small>Tú · ${v.pv}${v.doubled ? ' · doblaste' : ''}</small><div class="cas-hand">${row(v.p, 'p')}</div></div></div>`;
        shown = { p: v.p.length, d: v.status === 'open' ? 1 : v.d.length };
        acts2.innerHTML = v.status === 'open' ? `<button type="button" class="btn big" data-act="bj" data-a="hit">Pedir</button><button type="button" class="btn big ghost" data-act="bj" data-a="stand">Plantarse</button>${v.p.length === 2 ? `<button type="button" class="btn big ghost" data-act="bj" data-a="double">Doblar</button>` : ''}` : `<button class="btn big cas-go" type="submit">Jugar otra</button>`;
      } else if (v.game === 'poker') {
        show.innerHTML = `<div class="cas-hand cas-pk">${v.h.map((c, i) => `<div class="cas-hold ${holds[i] && v.status === 'open' ? 'on' : ''}" data-act="hold" data-i="${i}">${cardHTML(c, shown.h[i] !== c ? 'deal' : '')}<small>${v.status === 'open' ? (holds[i] ? 'SE QUEDA' : 'cambiar') : ''}</small></div>`).join('')}</div>
          ${v.status !== 'open' ? `<div class="cas-pkname">${POKER_HANDS[v.mult] || 'Nada'}</div>` : '<p class="muted">Toca las cartas que te quieres quedar.</p>'}`;
        shown.h = [...v.h];
        acts2.innerHTML = v.status === 'open' ? `<button type="button" class="btn big" data-act="draw">Cambiar cartas</button>` : `<button class="btn big cas-go" type="submit">Jugar otra</button>`;
      } else {
        show.innerHTML = `<div class="cas-mines">${Array.from({ length: 25 }, (_, i) => { const op = v.open.includes(i), mine = v.mines?.includes(i);
          return `<button type="button" class="cas-tile ${op ? 'op' : ''} ${op && mine ? 'boom' : ''} ${!op && mine ? 'reveal' : ''}" ${v.status === 'open' && !op ? `data-act="pick" data-i="${i}"` : 'disabled'}>${op ? (mine ? '💣' : '💎') : mine ? '💣' : ''}</button>`; }).join('')}</div>
          <p class="muted">${v.n} minas · ${v.open.length} diamantes${v.status === 'open' ? ` · ahora ×${fx(v.now)} · siguiente ×${fx(v.next)}` : ''}</p>`;
        acts2.innerHTML = v.status === 'open' ? `<button type="button" class="btn big" data-act="cash" ${v.open.length ? '' : 'disabled'}>Retirar ${v.open.length ? money(v.bet * v.now) : ''}</button>` : `<button class="btn big cas-go" type="submit">Jugar otra</button>`;
      }
      form.querySelectorAll('input,select').forEach(x => x.disabled = v.status === 'open');
      if (v.status !== 'open') result(v); else { res.innerHTML = ''; res.closest('.cas-stage').classList.remove('cas-won'); }
      cur = v;
    };
    let cur = null;
    if (hand) table(hand);
    async function act(fn) { el.querySelectorAll('.cas-acts button').forEach(b => b.disabled = true); try { table(await fn()); } finally { el.querySelectorAll('.cas-acts button').forEach(b => b.disabled = false); } }
    Object.assign(acts, {
      async play(v) {
        if (CAS_TABLE.includes(game)) { shown = { p: 0, d: 0, h: [] }; holds = [false, false, false, false, false];
          return act(() => db.rpc('casino_start', { c: S.char.id, game, bet: +v.bet, opts: game === 'mines' ? { mines: +v.mines } : {} })).then(refreshBal); }
        const opts = game === 'dice' ? { target: +v.tg, over: v.over === '1' } : game === 'limbo' ? { target: +v.tg } : game === 'coin' ? { side: v.side } : game === 'roulette' ? { pick: v.pick } : {};
        go.disabled = true; res.innerHTML = '';
        try { const r = await db.rpc('casino_play', { c: S.char.id, game, bet: +v.bet, opts }); await CAS_ANIM[game](show, r, v); result({ ...r, bet: +v.bet }); }
        finally { go.disabled = false; }
      },
      bj: d => act(() => db.rpc('casino_act', { hand: cur.id, action: d.a })),
      hold: d => { if (cur?.status !== 'open') return; holds[d.i] = !holds[d.i]; table(cur); },
      draw: () => act(() => db.rpc('casino_act', { hand: cur.id, action: 'draw', arg: holds })),
      pick: d => act(() => db.rpc('casino_act', { hand: cur.id, action: 'pick', arg: +d.i })),
      cash: () => act(() => db.rpc('casino_act', { hand: cur.id, action: 'cash' })),
    });
  } };
// ============ DOCUMENTOS (wallet) ============
// Documentos personales y licencias: Wallet los junta todos; Documentos y Licencias salen en el escritorio cuando tienes alguno
const LIC_TYPES = ['licencia_conducir', 'licencia_armas', 'licencia_abogado', 'licencia_juez'];
const myFamilyName = async () => { const m = (await db.list('family_members', { eq: { character_id: S.char?.id }, order: null }).catch(() => [])).find(x => x.status === 'active'); return m ? (await db.list('families', { order: null }).catch(() => [])).find(f => f.id === m.family_id)?.name || '' : ''; };
function myDocs(c, reqs, vehs = [], models = [], famName = '') {
  const ok = t => approvedOf(reqs, t), name = `${c.first_name} ${c.last_name}`, when = r => r.reviewed_at || r.created_at, dni = ok('dni')[0], out = [];
  const add = (kind, title, html) => out.push({ kind, title, html });
  if (c.extranjero) add('doc', 'Pasaporte de ' + homeCountry(c), homePassport(c)); else add('doc', 'Acta de nacimiento', birthCert(c));
  if (dni) add('doc', 'Identificación (California ID)', idCard(c, dni));
  if (!c.extranjero || ok('visa').length) add('doc', 'Tarjeta del Seguro Social (SSN)', ssnCard(c)); // número fiscal ante el IRS
  ok('pasaporte').forEach(p => add('doc', 'Pasaporte', passport(c, p, false)));
  ok('visa').forEach(v => add('doc', /Green Card/.test(v.data.tipo) ? 'Green Card (residencia permanente)' : 'Visa de Estados Unidos', visa(c, v)));
  ok('titulo').forEach(t => add('doc', 'Título universitario', diploma(t.data.carrera, name, 'por haber concluido satisfactoriamente sus estudios profesionales', t.data.universidad, when(t))));
  ok('servicio_militar').forEach(t => add('doc', 'Servicio militar', diploma('Certificado de servicio militar', name, 'por su ingreso a ' + t.data.rama, 'Departamento de Defensa · LA RP', when(t))));
  if (dni) ok('licencia_conducir').forEach(l => add('lic', 'Licencia de conducir · ' + l.data.clase, idCard(c, dni, l)));
  ok('licencia_armas').forEach(t => add('lic', 'Licencia de armas', diploma('Licencia de portación · ' + t.data.tipo, name, 'autorizado(a) a portar armas de la categoría indicada', 'LAPD · Departamento de Licencias', when(t))));
  ok('licencia_abogado').forEach(t => add('lic', 'Licencia de abogado', diploma('Licencia para ejercer la abogacía', name, 'admitido(a) para ejercer ante los tribunales de Los Ángeles', 'State Bar of Los Angeles RP', when(t))));
  ok('licencia_juez').forEach(t => add('lic', 'Nombramiento de juez', diploma('Nombramiento judicial', name, 'como Juez de Distrito de la Corte de Los Ángeles', 'Corte Superior de Los Ángeles RP', when(t))));
  if (c.heir) add('doc', 'Testamento', will(c, { heir: cname(c.heir), family: famName, date: c.heir_at || c.created_at }));
  vehs.forEach(v => { const m = models.find(x => x.id === v.model_id); add('doc', `Registro vehicular · ${m ? m.brand + ' ' + m.model : 'Vehículo'}`, vehicleReg(c, v, m)); });
  return { list: out, dni };
}
function docApp(id, name, bg, kind, show) {
  const app = { id, name, icon: '🪪', bg, show,
    async render(el) {
      if (!needChar(el)) return;
      const [reqs, vehs, models] = await Promise.all([myRequests(), db.list('vehicles', { eq: { owner_char: S.char.id } }), db.list('vehicle_models', { order: null })]), famName = await myFamilyName(), ok = t => approvedOf(reqs, t), { list, dni } = myDocs(S.char, reqs, vehs, models, famName), all = kind ? list.filter(d => d.kind === kind) : list;
      const regs = kind ? [] : [...ok('placa').map(r => [ico('placa'), `Placa ${esc(r.data.placa.toUpperCase())}`, `${esc(r.data.tipo)} · ${esc(r.data.estado)}`]),
        ...ok('registro_arma').map(r => [ico('registro_arma'), esc(r.data.arma), 'Serie ' + esc(r.data.serie)]),
        ...ok('registro_herramienta').map(r => [ico('registro_herramienta'), esc(r.data.herramienta), 'Registrada']),
        ...(await db.list('items', { eq: { owner_char: S.char.id }, limit: 500 })).filter(i => i.serial).map(i => [ico('registro_arma'), esc(SHOPI[i.item]?.name || i.item), 'Serie ' + esc(i.serial) + ' · comprada en Tool Store'])];
      const tiles = all.map((d, i) => `<button class="dfile" data-act="zoom" data-k="${i}"><div class="dthumb"><div class="doc">${d.html}</div></div><b>${esc(d.title)}</b></button>`).join('');
      view(el, `<p class="muted">${kind === 'lic' ? 'Tus licencias vigentes. Toca una para verla en grande.' : kind === 'doc' ? 'Tus documentos oficiales. Toca uno para verlo en grande.' : 'Todos tus documentos, licencias y registros.'}</p>
        <div class="dgrid">${tiles || `<p class="empty">${kind === 'lic' ? 'Todavía no tienes licencias. Tramítalas en el portal del gobierno.' : 'Sin documentos.'}</p>`}</div>
        ${!dni && kind !== 'lic' ? `<div class="card row"><span class="grow">Aún no tienes tu identificación (DNI).</span><button class="btn sm" data-act="t" data-k="dni">Tramitarla</button></div>` : ''}
        ${kind === 'lic' ? `<div class="row gap">${LIC_TYPES.map(t => `<button class="btn sm ghost" data-act="t" data-k="${t}">${esc(TRAMITES[t].name)}</button>`).join('')}</div>` : ''}
        ${kind ? '' : `<h3>Registros</h3><ul class="list">${regs.map(([i, a, b]) => `<li><span class="li-ico">${i}</span><div class="grow"><b>${a}</b><div class="muted">${b}</div></div></li>`).join('') || '<li class="muted">Sin registros</li>'}</ul>`}`,
      { t: d => openTramite(d.k, {}, () => app.render(el)), zoom: d => modal(esc(all[d.k].title), `<div class="doc big">${all[d.k].html}</div><div class="row"><span class="grow"></span><button class="btn" data-act="dl">${ico('descargar', 'i sm')} Descargar imagen</button></div>`, {
        async dl(_, b) { b.disabled = true; b.textContent = 'Generando…'; try { await downloadImage(b.closest('.modal-b').querySelector('.doc.big > *'), `${all[d.k].title} - ${S.char.first_name} ${S.char.last_name}`); toast('Imagen descargada ✅'); }
          catch (e) { console.error(e); toast('No se pudo generar la imagen', 'err'); } finally { b.disabled = false; b.innerHTML = `${ico('descargar', 'i sm')} Descargar imagen`; } } }) });
    } };
  return app;
}
const docs = docApp('docs', 'Wallet', '#1c1c1e,#3a3a3c', null, () => true);
const documentos = docApp('documentos', 'Documentos', '#1f6feb,#0b4fb3', 'doc', () => !!S.char);
const licencias = docApp('licencias', 'Licencias', '#0f9d58,#0a7a43', 'lic', () => !!S.docs?.some(t => LIC_TYPES.includes(t)));

// ============ MENSAJES ============
const mensajes = { id: 'mensajes', name: 'Mensajes', icon: '💬', bg: '#34c759,#30b350', show: () => true,
  async render(el, other) {
    if (!needChar(el)) return;
    const me = S.char.id, isG = typeof other === 'string' && other.startsWith('g:'), gid = isG ? other.slice(2) : null;
    const all = [...await db.list('messages', { eq: { from_char: me } }), ...await db.list('messages', { eq: { to_char: me } })].filter(m => !m.via).sort((a, b) => a.created_at.localeCompare(b.created_at));
    const convs = [...new Set(all.map(m => m.from_char === me ? m.to_char : m.from_char))];
    // grupos donde estoy (WhatsApp)
    const gm = await db.list('chat_group_members', { order: null, limit: 5000 }).catch(() => []), myG = gm.filter(m => m.character_id === me).map(m => m.group_id);
    const groups = (await db.list('chat_groups', { order: null }).catch(() => [])).filter(g => myG.includes(g.id));
    const gmsgs = gid ? (await db.list('group_messages', { eq: { group_id: gid }, order: 'created_at', limit: 300 })).reverse() : [];
    const group = gid && groups.find(g => g.id === gid), members = gid ? gm.filter(m => m.group_id === gid) : [], amAdmin = members.some(m => m.character_id === me && m.admin);
    const thread = other && !isG ? all.filter(m => [m.from_char, m.to_char].includes(other)) : [];
    const bubbles = isG ? gmsgs.map(m => `<div class="msg ${m.from_char === me ? 'me' : ''}">${m.from_char !== me ? `<b class="g-from">${esc(cname(m.from_char))}</b>` : ''}${esc(m.body)}<small>${fdate(m.created_at)}</small></div>`).join('')
      : thread.map(m => `<div class="msg ${m.from_char === me ? 'me' : ''}">${esc(m.body)}<small>${fdate(m.created_at)}</small></div>`).join('');
    view(el, `<div class="split wa ${other ? 'has-chat' : ''}"><aside><form data-form="nuevo" class="row"><select name="to" required><option value="">Nuevo chat…</option>${charOpts(c => c.status === 'active' && c.id !== me).map(([i, n]) => `<option value="${i}">${esc(n)}</option>`).join('')}</select><button class="btn sm">Abrir</button></form>
      <button class="btn sm ghost wa-newg" data-act="nuevoGrupo">👥 Nuevo grupo</button>
      ${groups.map(g => `<button class="conv ${'g:' + g.id === other ? 'on' : ''}" data-act="abrir" data-id="g:${g.id}"><span class="av sm g-av">👥</span> ${esc(g.name)}</button>`).join('')}
      ${convs.map(id => `<button class="conv ${id === other ? 'on' : ''}" data-act="abrir" data-id="${id}">${av(skin(id), 'av sm')} ${esc(cname(id))}</button>`).join('') || (groups.length ? '' : '<p class="empty">Sin chats</p>')}</aside>
      <section>${other ? `<header class="wa-h"><button class="wa-back" data-act="atras" aria-label="Volver a los chats">‹</button>${isG ? '<span class="av sm g-av">👥</span>' : av(skin(other), 'av sm')}<b class="grow">${esc(isG ? group?.name || 'Grupo' : cname(other))}</b>
          ${isG ? `<small class="muted">${members.length} integrantes</small>${amAdmin ? '<button class="btn sm ghost" data-act="gAdd">+ Agregar</button>' : ''}<button class="btn sm ghost" data-act="gSalir">Salir</button>` : ''}</header>
        ${isG ? `<div class="g-members muted">${members.map(m => esc(cname(m.character_id)) + (m.admin ? ' (admin)' : '')).join(' · ')}</div>` : ''}
        <div class="thread">${bubbles}</div>
      <form data-form="send" class="row"><input name="body" required placeholder="Escribe un mensaje…" autocomplete="off"><button class="btn">Enviar</button></form>` : '<p class="empty">Elige un chat</p>'}</section></div>`, {
      nuevo: d => mensajes.render(el, d.to), abrir: d => mensajes.render(el, d.id), atras: () => mensajes.render(el),
      async send(d) { if (isG) await db.insert('group_messages', { group_id: gid, from_char: me, body: d.body }); else await db.insert('messages', { from_char: me, to_char: other, body: d.body }); mensajes.render(el, other); },
      nuevoGrupo: () => modal('Nuevo grupo', `<form data-form="crear" class="form">${fieldsHTML([{ k: 'name', label: 'Nombre del grupo', req: 1 }])}<div class="fld"><span>Integrantes</span><div class="g-pick">${charOpts(c => c.status === 'active' && c.id !== me).map(([i, n]) => `<label class="chk"><input type="checkbox" name="m" value="${i}"> ${esc(n)}</label>`).join('')}</div></div><button class="btn">Crear grupo</button></form>`, {
        async crear(f, form, close) { const ids = [...(form.querySelectorAll ? form : document).querySelectorAll('.modal .g-pick input:checked')].map(x => x.value);
          const g = await db.rpc('group_create', { c: me, name: f.name, members: ids }); close(); toast('Grupo creado 👥'); mensajes.render(el, 'g:' + g); } }),
      gAdd: () => modal('Agregar al grupo', form('add', [{ k: 'who', label: 'Persona', type: 'select', options: charOpts(c => c.status === 'active' && !members.some(m => m.character_id === c.id)), req: 1 }]), {
        async add(f, _, close) { await db.rpc('group_add', { c: me, g: gid, who: f.who }); close(); mensajes.render(el, other); } }),
      async gSalir() { if (!await ask('¿Salir del grupo?')) return; await db.rpc('group_leave', { c: me, g: gid }); mensajes.render(el); },
    });
    el.querySelector('.thread')?.scrollTo(0, 1e6);
  } };

// ============ REDES SOCIALES ============
// Instagram y X con el aspecto de las apps reales (feed, likes, guardados)
const handle = id => { const c = S.all.find(x => x.id === id); return c ? (c.first_name + '.' + c.last_name).toLowerCase().normalize('NFD').replace(/[^a-z0-9.]/g, '') : 'anonimo'; };
const ago = t => { const s = (Date.now() - new Date(t)) / 1000; return s < 60 ? 'ahora' : s < 3600 ? Math.floor(s / 60) + ' min' : s < 86400 ? Math.floor(s / 3600) + ' h' : s < 604800 ? Math.floor(s / 86400) + ' d' : fdate(t); };
const isVerified = id => { const c = S.all.find(x => x.id === id); return !!c && (c.roles?.includes('Influencer') || (c.ig_verified_until && new Date(c.ig_verified_until) > new Date())); };
const verified = id => isVerified(id) ? ico('s_verified', 'verif') : '';
const savedPosts = () => { try { return JSON.parse(localStorage.getItem('rp_saved') || '[]'); } catch { return []; } };
const isVideo = u => /^data:video|\.(mp4|webm|mov|m4v|ogv)(\?|$)/i.test(u || '');
const media = (u, cls = '', auto = false) => !u ? '' : isVideo(u) ? `<video class="${cls}" src="${esc(u)}" playsinline loop ${auto ? 'autoplay muted' : 'controls'} preload="metadata"></video>` : `<img class="${cls}" src="${esc(u)}" alt="">`;
const DAY = 864e5;
// Visor de historias a pantalla completa (avanza solo, como Instagram)
function storyViewer(list, start = 0) {
  let k = start, timer;
  const ov = document.createElement('div'); ov.className = 'stv'; document.body.append(ov);
  const close = () => { clearTimeout(timer); ov.remove(); };
  const show = () => {
    const s = list[k]; if (!s) return close();
    ov.innerHTML = `<div class="stv-card"><div class="stv-bars">${list.map((_, i) => `<i class="${i < k ? 'done' : i === k ? 'on' : ''}"></i>`).join('')}</div>
      <div class="stv-h">${av(skin(s.character_id), 'av sm')}<b>${esc(handle(s.character_id))}</b>${verified(s.character_id)}<span>${ago(s.created_at)}</span><button class="stv-x" aria-label="Cerrar">✕</button></div>
      ${media(s.media_url, 'stv-m', true)}${s.body ? `<p class="stv-t">${esc(s.body)}</p>` : ''}<button class="stv-prev" aria-label="Anterior"></button><button class="stv-next" aria-label="Siguiente"></button></div>`;
    ov.querySelector('.stv-x').onclick = close; ov.querySelector('.stv-prev').onclick = () => { k = Math.max(0, k - 1); show(); }; ov.querySelector('.stv-next').onclick = () => { k++; show(); };
    const v = ov.querySelector('video'); clearTimeout(timer);
    if (v) { v.muted = false; v.onended = () => { k++; show(); }; v.play().catch(() => {}); v.loop = false; } else timer = setTimeout(() => { k++; show(); }, 5000);
  };
  ov.onclick = e => { if (e.target === ov) close(); }; show();
}
// Instagram y X con el aspecto de las apps reales
function social(id, name, icon, bg) {
  const ig = id === 'insta';
  const app = { id, name, icon, bg, show: () => true,
    async render(el, tab = 'feed', arg) {
      if (typeof tab === 'object') tab = 'feed';
      if (!needChar(el)) return;
      const me = S.char.id;
      const [all, likes] = await Promise.all([db.list('posts', { eq: { app: id }, limit: 200 }), db.list('post_likes', { eq: { user_id: S.me.id }, order: null, limit: 2000 }).catch(() => [])]);
      const liked = new Set(likes.map(l => l.post_id)), saved = savedPosts(), canDel = p => S.chars.some(c => c.id === p.character_id) || lvl() >= 2;
      const [cm, fo] = ig ? await Promise.all([db.list('post_comments', { order: 'created_at', asc: true, limit: 3000 }).catch(() => []), db.list('follows', { order: null, limit: 5000 }).catch(() => [])]) : [[], []];
      const myRp = new Set(all.filter(p => p.repost_of && p.character_id === me).map(p => p.repost_of)), nC = p => cm.filter(c => c.post_id === p.id).length;
      const stories = all.filter(p => p.section === 'story' && Date.now() - new Date(p.created_at) < DAY).reverse();
      const posts = all.filter(p => p.section !== 'story');
      const who = p => p.anonimo ? 'anonimo' : handle(p.character_id), nm = p => p.anonimo ? 'Anónimo' : esc(cname(p.character_id));
      const heart = p => `<button class="sa ${liked.has(p.id) ? 'on' : ''}" data-act="like" data-id="${p.id}" aria-label="Me gusta">${ico('s_heart', 'i')}${ig ? '' : `<span>${p.likes || ''}</span>`}</button>`;
      const save = p => `<button class="sa ${saved.includes(p.id) ? 'on' : ''}" data-act="save" data-id="${p.id}" aria-label="Guardar">${ico('s_save', 'i')}</button>`;
      const del = p => canDel(p) ? `<button class="sa" data-act="del" data-id="${p.id}" aria-label="Borrar">${ico('s_trash', 'i')}</button>` : '';
      const again = (t = tab, x = arg) => app.render(el, t, x);
      let html;
      if (ig) {
        const igPost = p => `<article class="ig-post post" data-pv="${p.id}"><div class="ig-h">${av(skin(p.character_id), 'av sm')}<button class="link" data-act="perfil" data-id="${p.character_id}"><b>${esc(who(p))}</b></button>${verified(p.character_id)}<span class="muted">· ${ago(p.created_at)}</span>${p.section === 'reel' ? '<span class="tag">Reel</span>' : ''}<span class="grow"></span>${del(p)}</div>
          ${p.media_url ? `<div class="ig-media" data-act="dbl" data-id="${p.id}">${media(p.media_url, '', isVideo(p.media_url))}<i class="pop">${ico('s_heart', 'i')}</i></div>` : ''}
          <div class="ig-act">${heart(p)}<button class="sa" data-act="ver" data-id="${p.id}" aria-label="Comentar">${ico('s_comment', 'i')}</button><button class="sa rp ${myRp.has(p.id) ? 'on' : ''}" data-act="repost" data-id="${p.id}" aria-label="Repostear" title="${myRp.has(p.id) ? 'Quitar repost' : 'Repostear'}">${ico('s_repost', 'i')}</button><button class="sa" data-act="dm" data-id="${p.character_id}" aria-label="Enviar mensaje">${ico('s_send', 'i')}</button><span class="grow"></span>${save(p)}</div>
          <div class="ig-likes">${p.likes ? `${p.likes.toLocaleString('es-MX')} Me gusta` : 'Sé el primero en dar Me gusta'}<span class="ig-views">${ico('s_eye', 'i')} ${(p.views || 0).toLocaleString('es-MX')} ${p.views === 1 ? 'visualización' : 'visualizaciones'}</span></div>${p.body ? `<p class="ig-cap"><b>${esc(who(p))}</b> ${esc(p.body)}</p>` : ''}${nC(p) ? `<button class="link ig-more" data-act="ver" data-id="${p.id}">Ver ${nC(p) === 1 ? 'el comentario' : 'los ' + nC(p) + ' comentarios'}</button>` : ''}</article>`;
        const feedItem = p => { if (!p.repost_of) return igPost(p); const o = all.find(x => x.id === p.repost_of); return o ? `<div class="ig-rp">${ico('s_repost', 'i')}<span><b>${esc(handle(p.character_id))}</b> lo reposteó</span></div>` + igPost(o) : ''; };
        const byUser = [...new Map(stories.map(s => [s.character_id, s])).keys()];
        const head = t => `<header class="ig-top">${t}<span class="grow"></span><button class="sa" data-act="crear" aria-label="Crear">${ico('s_new', 'i')}</button><button class="sa" data-act="tab" data-t="dms" aria-label="Mensajes">${ico('s_send', 'i')}</button></header>`;
        let body;
        if (tab === 'feed') body = head('<span class="ig-word">Instagram</span>') + `<div class="ig-stories"><button class="ig-st" data-act="crear" data-k="story"><span class="ring add">${av(skin(me), 'av')}<i>+</i></span><small>Tu historia</small></button>
            ${byUser.map(u => `<button class="ig-st" data-act="story" data-id="${u}"><span class="ring">${av(skin(u), 'av')}</span><small>${esc(handle(u))}</small></button>`).join('')}</div>
          <div class="ig-feed">${posts.map(feedItem).join('') || '<p class="empty">Todavía no hay publicaciones. ¡Sé el primero!</p>'}</div>`;
        else if (tab === 'reels') { const reels = posts.filter(p => p.section === 'reel' || isVideo(p.media_url));
          body = `<div class="ig-reels">${reels.map(p => `<section class="reel" data-pv="${p.id}">${media(p.media_url, 'reel-v', true)}<div class="reel-info"><div class="row">${av(skin(p.character_id), 'av sm')}<b>${esc(who(p))}</b>${verified(p.character_id)}</div>${p.body ? `<p>${esc(p.body)}</p>` : ''}</div>
            <div class="reel-act">${heart(p)}<small>${p.likes || 0}</small><span class="sa" title="Visualizaciones">${ico('s_eye', 'i')}</span><small>${p.views || 0}</small><button class="sa" data-act="dm" data-id="${p.character_id}">${ico('s_send', 'i')}</button>${save(p)}</div></section>`).join('') || '<p class="empty light">Aún no hay reels. Sube un video con el botón +.</p>'}</div>`; }
        else if (tab === 'perfil') { const u = arg || me, mine = posts.filter(p => p.character_id === u && !p.repost_of), c = S.all.find(x => x.id === u), nFo = fo.filter(f => f.followed === u).length, iFollow = fo.some(f => f.follower === me && f.followed === u);
          const vu = c?.ig_verified_until && new Date(c.ig_verified_until) > new Date();
          body = head(`<b class="ig-user">${esc(handle(u))}${verified(u)}</b>`) + `<div class="ig-prof">${av(skin(u), 'av xl')}<div class="ig-stats"><div><b>${mine.length}</b><small>publicaciones</small></div><div><b>${nFo}</b><small>seguidores</small></div><div><b>${fo.filter(f => f.follower === u).length}</b><small>seguidos</small></div></div></div>
            <div class="ig-bio"><b>${esc(cname(u))}</b>${c?.roles?.includes('Influencer') ? `<div class="muted">💸 Gana ${money((set('influencer_like_pay') ?? 15) * cpi() * Math.min(5, 1 + nFo / 20))} por like · más seguidores = más pago</div>` : ''}${c?.roles?.length ? `<div class="muted">${esc(c.roles.join(' · '))}</div>` : ''}</div>
            <div class="row gap ig-btns">${u === me ? `<button class="btn ghost grow" data-act="crear">Nueva publicación</button><button class="btn ghost grow" data-act="verif">${vu ? 'Verificado hasta ' + fdate(c.ig_verified_until) : isVerified(u) ? 'Cuenta verificada' : 'Solicitar verificación'}</button>` : `<button class="btn grow ${iFollow ? 'ghost' : ''}" data-act="follow" data-id="${u}">${iFollow ? 'Siguiendo ✓' : 'Seguir'}</button><button class="btn ghost grow" data-act="dm" data-id="${u}">Enviar mensaje</button>`}</div>
            <div class="ig-grid">${mine.map(p => `<button class="ig-cell" data-act="ver" data-id="${p.id}">${isVideo(p.media_url) ? `<video src="${esc(p.media_url)}" muted playsinline preload="metadata"></video>` : media(p.media_url)}${isVideo(p.media_url) ? '<i class="ig-play">▶</i>' : ''}</button>`).join('') || '<p class="empty">Sin publicaciones.</p>'}</div>`; }
        else if (tab === 'saved') body = head('<b>Guardado</b>') + `<div class="ig-feed">${posts.filter(p => saved.includes(p.id)).map(igPost).join('') || '<p class="empty">No has guardado nada.</p>'}</div>`;
        else if (tab === 'dms') {
          const msgs = [...await db.list('messages', { eq: { from_char: me } }), ...await db.list('messages', { eq: { to_char: me } })].filter(m => m.via === 'insta').sort((a, b) => a.created_at.localeCompare(b.created_at));
          const convs = [...new Set(msgs.map(m => m.from_char === me ? m.to_char : m.from_char))].reverse(), o = arg;
          body = o ? `<header class="ig-top"><button class="link" data-act="tab" data-t="dms">‹</button>${av(skin(o), 'av sm')}<b>${esc(handle(o))}</b>${verified(o)}</header>
              <div class="ig-thread">${msgs.filter(m => [m.from_char, m.to_char].includes(o)).map(m => `<div class="ig-msg ${m.from_char === me ? 'me' : ''}">${esc(m.body)}</div>`).join('') || '<p class="empty">Saluda a ' + esc(cname(o)) + ' 👋</p>'}</div>
              <form data-form="send" class="ig-send"><input name="body" placeholder="Mensaje…" autocomplete="off" required><button class="link" type="submit">Enviar</button></form>`
            : `<header class="ig-top"><button class="link" data-act="tab" data-t="feed">‹</button><b>${esc(handle(me))}</b></header>
              <form data-form="nuevoDm" class="ig-send"><select name="to" required><option value="">Nuevo mensaje…</option>${charOpts(c => c.status === 'active' && c.id !== me).map(([i, n]) => `<option value="${i}">${esc(n)}</option>`).join('')}</select><button class="link" type="submit">Chat</button></form>
              ${convs.map(u => { const last = msgs.filter(m => [m.from_char, m.to_char].includes(u)).pop(); return `<button class="ig-conv" data-act="dm" data-id="${u}">${av(skin(u), 'av')}<div><b>${esc(handle(u))}</b>${verified(u)}<small class="muted">${esc((last.from_char === me ? 'Tú: ' : '') + last.body).slice(0, 40)} · ${ago(last.created_at)}</small></div></button>`; }).join('') || '<p class="empty">Sin mensajes todavía.</p>'}`;
        }
        else body = head('<b>Publicación</b>') + `<div class="ig-feed">${posts.filter(p => p.id === arg).map(igPost).join('')}<div class="ig-cms">${cm.filter(c => c.post_id === arg).map(c => `<p><button class="link" data-act="perfil" data-id="${c.character_id}"><b>${esc(handle(c.character_id))}</b></button> ${esc(c.body)} <small class="muted">${ago(c.created_at)}</small>${S.chars.some(x => x.id === c.character_id) || lvl() >= 2 ? `<button class="sa" data-act="delC" data-id="${c.id}" aria-label="Borrar comentario">${ico('s_trash', 'i')}</button>` : ''}</p>`).join('') || '<p class="muted">Sin comentarios todavía. Escribe el primero.</p>'}</div></div>
          <form data-form="comentar" class="ig-send"><input name="body" maxlength="300" placeholder="Agrega un comentario…" autocomplete="off" required><button class="link" type="submit">Publicar</button></form>`;
        html = `<div class="ig">${body}<nav class="ig-nav"><button class="sa ${tab === 'feed' ? 'on' : ''}" data-act="tab" data-t="feed" aria-label="Inicio">${ico('s_home', 'i')}</button><button class="sa" data-act="tab" data-t="reels" aria-label="Reels">${ico('s_play', 'i')}</button>
          <button class="sa" data-act="crear" aria-label="Crear">${ico('s_new', 'i')}</button><button class="sa" data-act="tab" data-t="saved" aria-label="Guardados">${ico('s_save', 'i')}</button><button class="sa" data-act="perfil" data-id="${me}" aria-label="Perfil">${av(skin(me), 'av xs')}</button></nav></div>`;
      } else {
        const list = tab === 'saved' ? posts.filter(p => saved.includes(p.id)) : tab === 'me' ? posts.filter(p => p.character_id === me) : posts;
        html = `<div class="xa"><header class="xa-top"><b class="xa-logo">𝕏</b><nav class="xa-tabs"><button class="${tab === 'feed' ? 'on' : ''}" data-act="tab" data-t="feed">Para ti</button><button class="${tab === 'me' ? 'on' : ''}" data-act="tab" data-t="me">Mis posts</button><button class="${tab === 'saved' ? 'on' : ''}" data-act="tab" data-t="saved">Guardados</button></nav></header>
          <form data-form="post" class="xa-compose">${av(skin(me), 'av')}<div class="grow"><textarea name="body" rows="2" maxlength="280" placeholder="¿Qué está pasando?"></textarea><div class="xa-prev" hidden></div>
            <div class="row"><label class="sa" title="Foto o video">${ico('s_photo', 'i')}<input type="file" name="media_url" accept="image/*,video/*" hidden data-prev></label><small class="muted" data-count>280</small><span class="grow"></span><button class="xa-btn" type="submit">Postear</button></div></div></form>
          ${list.map(p => `<article class="xa-post post">${av(skin(p.character_id), 'av')}<div class="grow">
            <div class="xa-h"><b>${nm(p)}</b>${verified(p.character_id)}<span class="muted">@${esc(who(p))} · ${ago(p.created_at)}</span></div>
            ${p.body ? `<p>${esc(p.body)}</p>` : ''}${p.media_url ? (isVideo(p.media_url) ? media(p.media_url, 'xa-media') : `<img class="xa-media" src="${esc(p.media_url)}" alt="" data-act="zoom" data-src="${esc(p.media_url)}">`) : ''}
            <div class="xa-act">${heart(p)}${save(p)}${del(p)}</div></div></article>`).join('') || '<p class="empty">Sé el primero en postear.</p>'}</div>`;
      }
      const sendDm = async (to, body) => db.insert('messages', { from_char: me, to_char: to, body, via: 'insta' });
      view(el, html, {
        tab: d => again(d.t, null), perfil: d => again('perfil', d.id), ver: d => again('post', d.id), dm: d => again('dms', d.id),
        story: d => storyViewer(stories.filter(s => s.character_id === d.id)),
        post: async d => { if (!d.body && !d.media_url) throw new Error('Escribe algo o agrega una foto'); await db.insert('posts', { app: id, character_id: me, body: d.body || null, media_url: d.media_url || null, section: isVideo(d.media_url) ? 'reel' : null }); again(); },
        crear: d => modal('Crear', form('pub', [{ k: 'tipo', label: 'Tipo', type: 'select', options: [['post', 'Publicación'], ['reel', 'Reel (video)'], ['story', 'Historia (dura 24 horas)']], def: d.k || 'post', req: 1 },
          { k: 'media_url', label: 'Foto o video', type: 'file', accept: 'image/*,video/*', req: 1 }, { k: 'body', label: 'Escribe un pie de foto…', type: 'textarea' }], {}, 'Compartir'), {
          pub: async (f, _, close) => { if (f.tipo === 'reel' && !isVideo(f.media_url)) throw new Error('Un reel debe ser un video');
            await db.insert('posts', { app: id, character_id: me, body: f.body || null, media_url: f.media_url, section: f.tipo === 'post' ? (isVideo(f.media_url) ? 'reel' : null) : f.tipo });
            close(); toast(f.tipo === 'story' ? 'Historia publicada · desaparece en 24 h' : 'Publicado ✅'); again(f.tipo === 'story' ? 'feed' : f.tipo === 'reel' ? 'reels' : 'feed', null); } }),
        verif: () => isVerified(me) && !(S.char.ig_verified_until && new Date(S.char.ig_verified_until) - Date.now() < 5 * DAY) ? toast('Tu cuenta ya está verificada') : openTramite('verificacion_ig'),
        send: async d => { await sendDm(arg, d.body); again(); },
        nuevoDm: d => again('dms', d.to),
        comentar: async d => { await db.insert('post_comments', { post_id: arg, character_id: me, body: d.body.trim().slice(0, 300) }); again(); },
        delC: async d => { await db.remove('post_comments', d.id); again(); },
        repost: async d => { const mine = all.find(p => p.repost_of === d.id && p.character_id === me); mine ? await db.remove('posts', mine.id) : await db.insert('posts', { app: id, character_id: me, repost_of: d.id }); toast(mine ? 'Repost quitado' : 'Reposteado en tu perfil 🔁'); again(); },
        follow: async d => { const f = { follower: me, followed: d.id }; fo.some(x => x.follower === me && x.followed === d.id) ? await db.removeWhere('follows', f) : await db.insert('follows', f); again(); },
        like: async d => { if (liked.has(d.id)) return; await db.rpc('like_post', { id: d.id }); again(); },
        dbl: async (d, t) => { t.classList.remove('beat'); void t.offsetWidth; t.classList.add('beat'); if (!liked.has(d.id)) { await db.rpc('like_post', { id: d.id }); setTimeout(() => again(), 500); } },
        save: d => { const s = savedPosts(), k = s.indexOf(d.id); k < 0 ? s.push(d.id) : s.splice(k, 1); localStorage.setItem('rp_saved', JSON.stringify(s)); again(); },
        del: async d => { if (!await ask('¿Borrar esta publicación?')) return; await db.remove('posts', d.id); again(); },
        zoom: d => d.src && zoom(d),
      });
      // vista previa al adjuntar en X y contador de caracteres
      const fi = el.querySelector('input[data-prev]'), pv = el.querySelector('.xa-prev'), ta = el.querySelector('.xa-compose textarea'), cnt = el.querySelector('[data-count]');
      fi?.addEventListener('change', () => { const f = fi.files[0]; if (!f) return; const u = URL.createObjectURL(f);
        pv.innerHTML = `${f.type.startsWith('video') ? `<video src="${u}" muted playsinline autoplay loop></video>` : `<img src="${u}" alt="">`}<button type="button" class="xa-rm" aria-label="Quitar">✕</button>`; pv.hidden = false;
        pv.querySelector('.xa-rm').onclick = () => { fi.value = ''; pv.hidden = true; pv.innerHTML = ''; }; });
      ta?.addEventListener('input', () => { cnt.textContent = 280 - ta.value.length; });
      el.querySelector('.ig-thread')?.scrollTo(0, 1e6);
      // los reels se reproducen solo cuando se ven
      const io = new IntersectionObserver(es => es.forEach(e => e.target.tagName === 'VIDEO' && (e.isIntersecting ? e.target.play().catch(() => {}) : e.target.pause())), { threshold: .6 });
      el.querySelectorAll('.reel-v, .ig-media video').forEach(v => io.observe(v));
      // visualizaciones: cuenta lo que de verdad pasó por la pantalla (1 por cuenta), en un solo envío
      const seen = new Set(); let vt; const vo = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; seen.add(e.target.dataset.pv); vo.unobserve(e.target);
        clearTimeout(vt); vt = setTimeout(() => { const ids = [...seen]; seen.clear(); db.rpc('view_posts', { ids }).catch(() => {}); }, 1200); }), { threshold: .5 });
      el.querySelectorAll('[data-pv]').forEach(n => vo.observe(n));
    } };
  return app;
}

// ============ PERIÓDICO ============
const SECCIONES = ['Última hora', 'Política', 'Policía', 'Sucesos', 'Economía', 'Deportes', 'Obituarios', 'Publicidad'];
const news = { id: 'news', name: 'LA Times', icon: '📰', bg: '#111111,#3a3a3a', url: 'latimes.rp', show: () => true,
  async render(el, sec) {
    if (typeof sec === 'object') sec = undefined;
    const posts = (await db.list('posts', { eq: { app: 'news' }, limit: 100 })).filter(p => !sec || p.section === sec);
    view(el, `<header class="paper"><h1>Los Angeles Times</h1><small>Edición roleplay · ${new Date().toLocaleDateString('es-MX', { dateStyle: 'full' })}</small></header>
      <div class="chips"><button data-act="sec" class="${!sec ? 'on' : ''}">Todo</button>${SECCIONES.map(s => `<button data-act="sec" data-s="${s}" class="${sec === s ? 'on' : ''}">${s}</button>`).join('')}
      ${S.char?.status === 'active' ? '<button data-act="nueva">✍️ Publicar noticia</button>' : ''}</div>
      <div class="news">${posts.map(p => `<article class="story ${p.section === 'Obituarios' ? 'obit' : ''} ${p.section === 'Policía' ? 'arrest' : ''}"><small class="sec">${esc(p.section || 'Noticias')}${p.section === 'Policía' ? ' · LAPD' : ''}</small>
        <h2>${esc(p.title)}</h2>${p.media_url ? `<figure><img src="${esc(p.media_url)}" alt="" data-act="zoom" data-src="${esc(p.media_url)}">${p.section === 'Policía' ? '<figcaption>Foto de ficha · Cortesía LAPD</figcaption>' : ''}</figure>` : ''}<p>${esc(p.body)}</p>
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
      <div class="g-quick"><a class="g-tile" data-href="robpedia.rp"><b>W</b><span>RobPedia</span></a><a class="g-tile" data-href="sites.google.rp"><b>＋</b><span>Crear sitio web</span></a>
        <a class="g-tile" data-href="latimes.rp"><b>📰</b><span>LA Times</span></a><a class="g-tile" data-href="lacity.rp"><b>🏛️</b><span>LA City</span></a></div>
      <div class="g-foot">Los Ángeles, California · Google ofrecido en: Español</div></div>`, { s: d => params.nav(`google.rp/search?q=${encodeURIComponent(d.q)}`),
        go: () => params.nav(`google.rp/search?q=${encodeURIComponent(el.querySelector('[name=q]').value)}`), lucky: () => params.nav(`google.rp/search?q=${encodeURIComponent(el.querySelector('[name=q]').value || 'Los Ángeles')}&lucky=1`) });
    const ql = q.toLowerCase(), hit = (...v) => v.some(x => String(x || '').toLowerCase().includes(ql));
    const [cos, revs, posts, jobs, props, models] = await Promise.all([db.list('companies', { order: 'name', asc: true }), db.list('reviews', { eq: { target_kind: 'business' } }),
      db.list('posts', { eq: { app: 'news' }, limit: 300 }), db.list('jobs', { eq: { open: true } }), db.list('properties', { order: null }), db.list('vehicle_models', { order: null })]);
    const SITE_HITS = [['lacity.rp', 'City of Los Angeles · Trámites y servicios', 'Trámites de identidad, licencias, registros y negocios.', 'gobierno dni licencia tramite ciudad la city pasaporte visa placa'],
      ['linkedin.rp', 'LinkedIn: Empleos en Los Ángeles', 'Vacantes del gobierno y de empresas privadas.', 'trabajo empleo vacante linkedin'],
      ['zillow.rp', 'Zillow: Casas y locales en venta', 'Encuentra casas y locales comerciales en Los Ángeles.', 'casa casas propiedad zillow renta local'],
      ['carmax.rp', 'CarMax: Autos nuevos y usados', 'Más de 100 modelos disponibles.', 'auto autos carro coche carmax'],
      ['toolstore.rp', 'Tool Store: herramientas, celulares, armería y camping', 'Compra con tu cuenta personal. Armas solo con licencia.', 'tienda herramientas celular telefono armas pistola camping dron toolstore'],
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
    const sites = await db.list('sites', { order: null }).catch(() => []);
    sites.filter(x => hit(x.title, x.tagline, x.body, x.slug)).forEach(x => R.push({ t: 'todo', url: x.slug + '.rp', title: x.title, desc: x.tagline || String(x.body || '').slice(0, 140) }));
    WIKI.filter(([t, , kw]) => hit(t, kw) || ql.includes('wiki') || ql.includes('robpedia')).forEach(([t]) => R.unshift({ t: 'todo', url: 'robpedia.rp?a=' + encodeURIComponent(t), title: t + ' — RobPedia, la enciclopedia libre', desc: 'Artículo de RobPedia sobre ' + t + ' en Los Ángeles RP.' }));
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
  const map = { 'google.rp': buscar, 'lacity.rp': gobierno, 'latimes.rp': news, 'linkedin.rp': empleos, 'zillow.rp': casas, 'carmax.rp': autos, 'toolstore.rp': toolstore, 'gbm.rp': bolsa, 'vote.rp': fec, 'lacourt.rp': corte };
  if (map[host]) return (el, params) => map[host].render(el, params);
  if (host === 'robpedia.rp' || host === 'wikipedia.rp') return robpedia;
  if (host === 'sites.google.rp') return siteBuilder;
  const co = (await db.list('companies', { order: null })).find(c => slug(c.name) + '.rp' === host);
  if (co) return (el, params) => companySite.render(el, { ...params, company: co });
  const st = (await db.list('sites', { order: null }).catch(() => [])).find(x => x.slug + '.rp' === host);
  return st ? el => userSite(el, st) : null;
}
// ============ ROBPEDIA (Wikipedia del server) ============
const WIKI = [['Los Ángeles RP', 'servidor', 'roblox servidor ciudad river city springfield historia'], ['Economía de Los Ángeles', 'economía', 'dinero tesoreria inflacion fed banco rrva bolsa'],
  ['Gobierno y elecciones', 'gobierno', 'presidente elecciones partido votar gobierno'], ['Reglas de CK', 'ck', 'ck muerte personaje reglas'], ['Empresas de Los Ángeles', 'empresas', 'empresa negocio compañia']];
async function robpedia(el, params = {}) {
  const art = params.a || 'Portada';
  const [chars, cos, props, posts, parties, els, vehs] = await Promise.all([db.list('characters', { order: null }).catch(() => S.all), db.list('companies', { order: 'name', asc: true }), db.list('properties', { order: null }),
    db.list('posts', { order: null, limit: 1000 }), db.list('parties', { order: null }).catch(() => []), db.list('elections', { order: null }).catch(() => []), db.list('vehicles', { order: null }).catch(() => [])]);
  const alive = chars.filter(c => c.status === 'active'), ck = chars.filter(c => c.status === 'dead'), pres = alive.filter(c => c.roles?.includes('Presidente'));
  const foreign = alive.filter(c => c.extranjero).length, sold = props.filter(p => p.owner_char || p.owner_company).length, top = [...posts].sort((a, b) => (b.likes || 0) - (a.likes || 0))[0];
  const nat = Object.entries(alive.reduce((m, c) => (m[c.nationality] = (m[c.nationality] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1])[0];
  const city = Object.entries(alive.reduce((m, c) => (m[c.city] = (m[c.city] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1])[0];
  const facts = [`Los Ángeles RP tiene <b>${alive.length}</b> ciudadanos con vida activa y <b>${ck.length}</b> vidas que terminaron en CK.`,
    pres.length ? `El presidente en funciones es <b>${esc(cname(pres[0].id))}</b>.` : 'Ahora mismo la presidencia está <b>vacante</b>.',
    `<b>${foreign}</b> ciudadanos llegaron del extranjero${nat ? `; la nacionalidad más común es <b>${esc(nat[0])}</b>` : ''}.`,
    city ? `La zona con más habitantes es <b>${esc(city[0])}</b>.` : '', `Hay <b>${cos.length}</b> empresas registradas y <b>${parties.length}</b> partidos políticos.`,
    `Se han vendido <b>${sold}</b> de <b>${props.length}</b> casas y locales del gobierno.`, `Circulan <b>${vehs.length}</b> autos con placa registrada.`,
    `La inflación acumulada es de <b>${((cpi() - 1) * 100).toFixed(2)}%</b> y la tasa de la Reserva Federal está en <b>${set('fed_rate')}%</b>.`,
    top?.likes ? `La publicación con más «Me gusta» tiene <b>${top.likes}</b> y es de <b>${esc(cname(top.character_id))}</b>.` : '',
    `Se han hecho <b>${els.length}</b> elecciones en la historia de la ciudad.`].filter(Boolean);
  const A = {
    'Portada': `<p>Bienvenido a <b>RobPedia</b>, la enciclopedia libre de Los Ángeles RP que cualquiera puede consultar.</p><div class="wk-box"><h3>¿Sabías que…?</h3><ul>${facts.map(f => `<li>${f}</li>`).join('')}</ul></div>
      <h3>Artículos</h3><ul>${WIKI.map(([t]) => `<li><a class="link" data-href="robpedia.rp?a=${encodeURIComponent(t)}">${esc(t)}</a></li>`).join('')}</ul>`,
    'Los Ángeles RP': `<p><b>Los Ángeles RP</b> es un servidor de roleplay en Roblox ambientado en la ciudad de Los Ángeles, California. La ciudad se divide en <b>River City</b> y <b>Springfield</b>.</p>
      <p>Cada jugador puede tener varias <i>vidas</i> (personajes), registradas en el Registro Civil. Una vida puede terminar por <a class="link" data-href="robpedia.rp?a=Reglas%20de%20CK">CK</a>.</p>
      <h3>Datos actuales</h3><ul>${facts.slice(0, 5).map(f => `<li>${f}</li>`).join('')}</ul>`,
    'Economía de Los Ángeles': `<p>La moneda es el dólar estadounidense. El banco principal es <b>RRVA</b>. La <b>Tesorería</b> empezó con <b>$13,950 millones</b>, el presupuesto real de la Ciudad de Los Ángeles.</p>
      <p>El único dinero nuevo que entra solo es el inicial de cada vida nueva. El presidente puede imprimir dinero, lo que genera <b>inflación</b> (hoy ${((cpi() - 1) * 100).toFixed(2)}%).</p>
      <p>En la bolsa (GBM+) se negocian acciones de las empresas y el ETF <b>LA500</b>. Las cuentas de ahorro pagan ${set('savings_rate')}% anual.</p>`,
    'Gobierno y elecciones': `<p>Cada mes hay elección presidencial: registro de candidatos del día 1 al ${set('elecciones').registro_hasta}, votación del ${set('elecciones').votacion_desde} al ${set('elecciones').votacion_hasta}. El ganador gobierna el mes siguiente completo.</p>
      <p>Presidente actual: <b>${pres.length ? esc(cname(pres[0].id)) : 'vacante'}</b>.</p><h3>Partidos</h3><ul>${parties.map(p => `<li>${esc(p.name)}${p.siglas ? ' (' + esc(p.siglas) + ')' : ''} — ${esc(p.ideologia || '')}</li>`).join('') || '<li>Sin partidos registrados.</li>'}</ul>`,
    'Reglas de CK': `<p>El <b>CK</b> (Character Kill) es la muerte permanente de un personaje. Reglas oficiales:</p><ol>${CK_RULES.map(([h, b]) => `<li><b>${esc(h)}.</b> ${esc(b)}</li>`).join('')}</ol>`,
    'Empresas de Los Ángeles': `<ul>${cos.map(c => `<li><a class="link" data-href="${slug(c.name)}.rp">${esc(c.name)}</a> — ${esc(c.industry)}</li>`).join('') || '<li>Aún no hay empresas.</li>'}</ul>`,
  };
  view(el, `<div class="wk"><header class="wk-h"><a class="wk-logo" data-href="robpedia.rp"><b>RobPedia</b><small>La enciclopedia libre</small></a><form data-form="s" class="wk-s"><input name="q" placeholder="Buscar en RobPedia" aria-label="Buscar"></form></header>
    <article class="wk-a"><h1>${esc(art)}</h1><small class="muted">De RobPedia, la enciclopedia libre · datos en vivo del servidor</small>${A[art] || `<p>Este artículo no existe todavía. <a class="link" data-href="robpedia.rp">Volver a la portada</a></p>`}</article></div>`,
    { s: d => params.nav ? params.nav('google.rp/search?q=' + encodeURIComponent(d.q + ' robpedia')) : null });
}

// ============ GOOGLE SITES: cada quien hace su página ============
const sitePage = st => `<div class="us"><header class="us-h" style="background:${esc(st.color || '#1a73e8')}"><h1>${esc(st.title)}</h1>${st.tagline ? `<p>${esc(st.tagline)}</p>` : ''}</header>
  ${st.img ? `<img class="us-img" src="${esc(st.img)}" alt="">` : ''}<main class="us-b">${String(st.body || '').split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('')}</main>
  <footer class="us-f">${esc(st.slug)}.rp · Creado por ${esc(cname(st.owner_char))} con Google Sites</footer></div>`;
const userSite = (el, st) => { el.innerHTML = sitePage(st); };
async function siteBuilder(el, params = {}) {
  if (!needChar(el)) return;
  const mine = (await db.list('sites', { order: null })).filter(x => S.chars.some(c => c.id === x.owner_char)), ed = mine.find(x => x.id === params.id);
  view(el, `<div class="gs"><header class="gs-h"><b>Google Sites</b><span class="muted">Crea tu página web gratis con dominio .rp</span></header>
    <div class="gs-b"><section><h3>${ed ? 'Editar ' + esc(ed.slug) + '.rp' : 'Nuevo sitio'}</h3>${form('save', [
      ...(ed ? [] : [{ k: 'slug', label: 'Dirección (solo minúsculas, números y guiones)', req: 1, ph: 'mi-negocio' }]),
      { k: 'title', label: 'Título', req: 1 }, { k: 'tagline', label: 'Frase corta' }, { k: 'color', label: 'Color principal', type: 'color', def: '#1a73e8' },
      { k: 'img', label: 'Imagen de portada', type: 'file' }, { k: 'body', label: 'Contenido (deja una línea en blanco entre párrafos)', type: 'textarea', req: 1 }], ed || {}, ed ? 'Guardar cambios' : 'Publicar sitio')}</section>
      <section><h3>Mis sitios</h3>${mine.map(x => `<div class="card row"><b class="grow">${esc(x.title)}</b><a class="link" data-href="${esc(x.slug)}.rp">${esc(x.slug)}.rp</a>
        <button class="btn sm ghost" data-act="edit" data-id="${x.id}">Editar</button><button class="btn sm bad" data-act="del" data-id="${x.id}">Borrar</button></div>`).join('') || '<p class="empty">Todavía no tienes sitios.</p>'}</section></div></div>`, {
    async save(d) {
      if (!d.img) delete d.img;
      if (ed) { await db.update('sites', ed.id, d); toast('Sitio actualizado'); return params.nav ? params.nav(ed.slug + '.rp') : siteBuilder(el, {}); }
      d.slug = String(d.slug).toLowerCase().trim();
      if (!/^[a-z0-9-]{3,40}$/.test(d.slug)) throw new Error('La dirección solo puede tener minúsculas, números y guiones (3 a 40)');
      if (await resolveSite(d.slug + '.rp')) throw new Error('Esa dirección ya está ocupada');
      await db.insert('sites', { ...d, owner_char: S.char.id }); toast('¡Sitio publicado!'); params.nav ? params.nav(d.slug + '.rp') : siteBuilder(el, {});
    },
    edit: d => siteBuilder(el, { ...params, id: d.id }),
    del: async d => { if (!await ask('¿Borrar este sitio?')) return; await db.remove('sites', d.id); siteBuilder(el, params); },
  });
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
    const jobNeeds = d => !d ? [] : [...(set('job_reqs')?.[d] || []), ...(set('military_required').includes(d) ? ['servicio_militar'] : [])], clean = d => (set('clean_record') || []).includes(d), yr = j => (rankList(j.role_tag)[0]?.salary || 0) * cpi(), top = j => (rankList(j.role_tag).at(-1)?.salary || 0) * cpi();
    if (tab === 'ofertas') body = `<div class="card info"><b>¿Cómo se paga?</b><p class="muted">El sueldo del gobierno es <b>anual</b> (como en la vida real) y se paga <b>un pedacito cada día real</b>: sueldo del año ÷ 365. Para cobrar el día tienes que trabajar mínimo ${set('job_min_minutes')} minutos reales ese día, fichando en Workday. Workday va en hora real, no en la hora del juego.</p></div>`
      + jobs.map(j => `<div class="card"><div class="row"><b>${esc(j.title)}</b>${j.role_tag ? '<span class="tag on">Gobierno</span>' : ''}</div>
      <div class="muted">${esc(j.employer)}</div>
      <div class="pay">${j.role_tag ? `<b>${money(yr(j) / 365)}</b> al día · <b>${money(yr(j) / 12)}</b> al mes · <b>${money(yr(j))}</b> al año <small class="muted">(rango inicial; el más alto gana ${money(top(j))} al año)</small>` : `<b>${money(j.salary)}</b> al día <small class="muted">(lo paga el empleador)</small>`}</div>
      <p>${esc(JOB_DESC[j.role_tag] || j.description || '')}</p>${jobNeeds(j.role_tag).length || clean(j.role_tag) ? `<p class="reqs">Requisitos: ${jobNeeds(j.role_tag).map(t => `<span class="tag">${t === 'servicio_militar' ? '🪖 ' : '📄 '}${esc(TRAMITES[t]?.name || t)}</span>`).join(' ')}${clean(j.role_tag) ? ' <span class="tag">🧾 Sin antecedentes penales</span>' : ''}</p>` : ''}
      ${mine.some(r => r.data.job_id === j.id && r.status === 'pending') ? badge('pending') : `<button class="btn sm" data-act="aplicar" data-id="${j.id}">Postularme</button>`}</div>`).join('') || '<p class="empty">No hay vacantes.</p>';
    if (tab === 'mias') body = `<ul class="list">${mine.map(r => `<li><div><b>${esc(r.data.job_title)}</b><div class="muted">${esc(r.data.employer)}${r.note ? ' · ' + esc(r.note) : ''}</div></div>${badge(r.status)}</li>`).join('') || '<p class="empty">Sin postulaciones.</p>'}</ul>`;
    if (tab === 'publicar') body = form('pub', [{ k: 'title', label: 'Puesto', req: 1 },
      { k: 'company_id', label: 'Empleador', type: 'select', options: [['', 'A mi nombre'], ...cos.map(c => [c.id, c.name])] },
      { k: 'salary', label: 'Sueldo por día (USD) — lo pagas tú', type: 'number', min: 0, req: 1 }, { k: 'description', label: 'Requisitos y descripción', type: 'textarea', req: 1 }], {}, 'Publicar vacante')
      + `<h3>Mis vacantes</h3><ul class="list">${jobs.filter(j => j.posted_by === S.char.id).map(j => `<li>${esc(j.title)} <button class="btn sm bad" data-act="cerrar" data-id="${j.id}">Cerrar</button></li>`).join('') || '<li class="muted">Ninguna</li>'}</ul>`;
    view(el, `${tabs([['ofertas', 'Vacantes'], ['mias', 'Mis postulaciones'], ['publicar', 'Publicar'], ['recibidas', 'Recibidas']], tab)}<div class="tabbody">${body}</div>`, {
      tab: d => this.render(el, d.t),
      aplicar: async d => { const j = jobs.find(x => x.id === d.id);
        const reqs = await myRequests(), miss = jobNeeds(j.role_tag).filter(t => !approvedOf(reqs, t).length);
        if (miss.length) throw new Error(`Para postularte a ${j.role_tag} te falta: ${miss.map(t => TRAMITES[t]?.name || t).join(', ')} (trámites en Gobierno).`);
        if (clean(j.role_tag) && (await db.list('records', { eq: { character_id: S.char.id } })).some(r => r.kind === 'arresto' || (r.kind === 'orden' && !r.paid))) throw new Error(`Para ${j.role_tag} necesitas no tener antecedentes penales (arrestos, prisión u órdenes de arresto).`);
        modal('💼 ' + esc(j.title), form('send', [{ k: 'experiencia', label: 'Experiencia', type: 'textarea', req: 1 }, { k: 'disponibilidad', label: 'Disponibilidad', req: 1 },
          { k: 'entrevista', label: 'Fecha preferida para entrevista', type: 'date', min: new Date().toISOString().slice(0, 10) }, { k: 'hora', label: 'Hora preferida (opcional)', type: 'time' }]), {
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
  const [cos, accs, props, vehs, models, holds, etfh] = await Promise.all(['companies', 'accounts', 'properties', 'vehicles', 'vehicle_models', 'holdings', 'etf_holdings'].map(t => db.list(t, { order: null, limit: 10000 }).catch(() => [])));
  return cos.map(c => ({ ...c, price: sharePrice(c, accs, props, vehs, models, cos, holds, etfh), out: c.industry === 'ETF' ? holds.filter(h => h.company_id === c.id && h.shares > 0).reduce((s, h) => s + Number(h.shares), 0) : coOut(c, holds, etfh),
    fair: c.industry === 'ETF' ? etfNav(c, accs, props, vehs, models, cos, holds, etfh) : coFair(c, accs, props, vehs, models, holds, etfh),
    bps: coBook(c, accs, props, vehs, models) / Math.max(coOut(c, holds, etfh), 1), // valor en libros por título SIN redondear (igual que buy_shares del servidor)
    cash: Number(accs.find(a => a.id === c.account_id)?.balance || 0), etf: c.industry === 'ETF' ? etfh.filter(e => e.shares > 0) : null }));
}
// gráfica de línea en SVG a partir de una lista de precios
const chart = (pts, w = 600, h = 160, line = true) => {
  if (pts.length < 2) pts = [pts[0] || 1, pts[0] || 1];
  const mn = Math.min(...pts), mx = Math.max(...pts), r = mx - mn || 1, up = pts.at(-1) >= pts[0];
  const xy = pts.map((p, i) => `${(i / (pts.length - 1) * w).toFixed(1)},${(h - 6 - (p - mn) / r * (h - 12)).toFixed(1)}`).join(' ');
  return `<svg class="chart ${up ? 'up' : 'down'}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${line ? `<polygon points="0,${h} ${xy} ${w},${h}" class="area"/>` : ''}<polyline points="${xy}"/></svg>`;
};
const pct = (a, b) => b ? (a - b) / b * 100 : 0;
// gráfica de velas tipo trading. pts = [{t: ms, p: precio}] en orden; tf = duración de cada vela (ms reales). Velas vacías repiten el último cierre.
const TF = [['1H', 5 * 60e3, '1 hora del juego'], ['6H', 30 * 60e3, '6 horas del juego'], ['1D', 2 * 3600e3, '1 día del juego'], ['1S', 14 * 3600e3, '1 semana del juego']];
function candles(pts, tf, live, n = 48) {
  const W = 760, H = 300, PR = 64, PB = 22, end = Math.floor(Date.now() / tf) * tf, start = end - (n - 1) * tf;
  let prev = [...pts].reverse().find(x => x.t < start)?.p ?? pts[0]?.p ?? live; const cs = [];
  for (let k = 0; k < n; k++) { const b0 = start + k * tf, inb = pts.filter(x => x.t >= b0 && x.t < b0 + tf).map(x => x.p); if (k === n - 1) inb.push(live);
    const o = prev, c = inb.length ? inb.at(-1) : prev; cs.push({ t: b0, o, c, h: Math.max(o, c, ...inb), l: Math.min(o, c, ...inb), v: inb.length }); prev = c; }
  let mn = Math.min(...cs.map(c => c.l)), mx = Math.max(...cs.map(c => c.h)); if (mx - mn < mx * 0.002) { mn *= 0.995; mx *= 1.005; } const pad = (mx - mn) * 0.08; mn -= pad; mx += pad;
  const y = v => (H - PB - (v - mn) / (mx - mn) * (H - PB - 10)).toFixed(1), cw = (W - PR) / n, last = cs.at(-1), up = last.c >= cs[0].o;
  const fmt = v => v >= 1000 ? Math.round(v).toLocaleString('en-US') : v >= 1 ? v.toFixed(2) : v.toFixed(4);
  const grid = [0, 1, 2, 3, 4].map(i => { const v = mn + (mx - mn) * i / 4; return `<line x1="0" x2="${W - PR}" y1="${y(v)}" y2="${y(v)}" class="tv-g"/><text x="${W - PR + 6}" y="${+y(v) + 4}" class="tv-t">${fmt(v)}</text>`; }).join('');
  const times = [0, 0.25, 0.5, 0.75].map(f => { const i = Math.floor(f * n); return `<text x="${(i * cw + 2).toFixed(0)}" y="${H - 6}" class="tv-t">${fgame(cs[i].t, tf >= 2 * 3600e3 ? { day: 'numeric', month: 'short' } : { hour: 'numeric', minute: '2-digit' })}</text>`; }).join('');
  const body = cs.map((c, i) => { const x = i * cw + cw / 2, g = c.c >= c.o, top = y(Math.max(c.o, c.c)), hh = Math.max(1, Math.abs(y(c.o) - y(c.c)));
    return `<g class="${g ? 'tv-up' : 'tv-dn'}${i === n - 1 ? ' tv-live' : ''}"><line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${y(c.h)}" y2="${y(c.l)}"/><rect x="${(x - cw * 0.35).toFixed(1)}" y="${top}" width="${(cw * 0.7).toFixed(1)}" height="${hh.toFixed(1)}" rx="1"/></g>`; }).join('');
  return `<svg class="tv" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Gráfica de velas">${grid}${times}${body}
    <line x1="0" x2="${W - PR}" y1="${y(live)}" y2="${y(live)}" class="tv-last ${up ? 'tv-up' : 'tv-dn'}"/><rect x="${W - PR + 2}" y="${+y(live) - 9}" width="${PR - 4}" height="18" rx="3" class="tv-tag ${up ? 'tv-up' : 'tv-dn'}"/><text x="${W - PR + 6}" y="${+y(live) + 4}" class="tv-tag-t">${fmt(live)}</text></svg>`;
}
const tfBar = cur => `<div class="tv-tf">${TF.map(([l, ms, t]) => `<button class="${ms === cur ? 'on' : ''}" data-act="tf" data-ms="${ms}" title="${t}">${l}</button>`).join('')}<span class="tv-livedot">● En vivo</span></div>`;

const sgn = n => `<span class="${n >= 0 ? 'pos' : 'neg'}">${n >= 0 ? '+' : ''}${n.toFixed(2)}%</span>`;
const bolsa = { id: 'bolsa', name: 'GBM+', icon: '📈', bg: '#0b1f3a,#1c4f8f', url: 'gbm.rp', show: () => true,
  async render(el, params = {}) {
    if (!needChar(el)) return;
    const st = el._gbm ||= { tab: 'port', id: null };
    const [cos, hold, acc, hist, trades] = await Promise.all([market(), db.list('holdings', { eq: { character_id: S.char.id } }), personalAcc(),
      db.list('price_history', { order: 'created_at', limit: 5000 }).then(r => r.reverse()), db.list('trades', { eq: { character_id: S.char.id } })]);
    const H = id => hold.find(x => x.company_id === id && x.shares > 0), series = c => [...hist.filter(p => p.company_id === c.id).map(p => +p.price), c.price];
    const day = c => { const s = hist.filter(p => p.company_id === c.id && new Date(p.created_at) > Date.now() - 864e5); return pct(c.price, s[0]?.price ?? series(c)[0]); };
    const mine = cos.filter(c => H(c.id)?.shares > 0), value = mine.reduce((s, c) => s + H(c.id).shares * c.price, 0), cost = mine.reduce((s, c) => s + Number(H(c.id).cost || 0), 0);
    const go = p => { Object.assign(st, p); bolsa.render(el, params); };
    let body = '';
    if (st.id) {
      const c = cos.find(x => x.id === st.id), h = H(c.id), ser = series(c);
      body = `<button class="link" data-act="back">‹ Mercado</button><div class="q-h"><div><b>${esc(c.name)}</b><small>${esc(c.industry)}</small></div><div class="q-p"><b>${money(c.price)}</b>${sgn(pct(c.price, ser[0]))}</div></div>
        ${tfBar(st.tf ||= 30 * 60e3)}${candles(hist.filter(p => p.company_id === c.id).map(p => ({ t: +new Date(p.created_at), p: +p.price })), st.tf, c.price)}<div class="kpis"><div><small>Valor de mercado</small><b>${money(c.price * (c.out || c.shares_total || 1000))}</b></div><div><small>Efectivo para recomprar</small><b>${c.industry === 'ETF' ? '—' : money(c.cash)}</b></div><div><small>Títulos en circulación</small><b>${(c.out || 0).toLocaleString()}</b></div>
          <div><small>Hoy</small><b>${sgn(day(c))}</b></div><div><small>Tu posición</small><b>${h ? h.shares + ' títulos' : '—'}</b></div></div>
        ${h ? `<p class="muted">Costo promedio ${money(h.cost / h.shares)} · Rendimiento ${sgn(pct(h.shares * c.price, h.cost))} (${money(h.shares * c.price - h.cost)})</p>` : ''}
        <div class="order"><div class="seg"><button data-act="side" data-s="buy" class="${st.side !== 'sell' ? 'on buy' : ''}">Comprar</button><button data-act="side" data-s="sell" class="${st.side === 'sell' ? 'on sell' : ''}">Vender</button></div>
          <form data-form="orden" class="form">${fieldsHTML([{ k: 'qty', label: 'Títulos', type: 'number', min: 1, max: st.side === 'sell' ? h?.shares || 0 : undefined, req: 1, def: 1 }])}
          <div class="qty-btns">${[[0.25, '25%'], [0.5, '50%'], [1, st.side === 'sell' ? 'Todo' : 'Todo mi dinero']].map(([f, l]) => `<button type="button" class="btn ghost sm" data-act="frac" data-f="${f}">${l}</button>`).join('')}</div>
          <p class="muted" data-est>Precio de mercado ${money(c.price)} · Poder de compra ${money(acc?.balance)}</p><p class="muted">Compras y vendes al momento directo con la empresa (en el ETF, con el fondo): al comprar, la empresa emite títulos nuevos y tu dinero entra a ella; al vender, la empresa te los recompra con su efectivo. Pedidos grandes mueven el precio.</p>
          <button class="btn big ${st.side === 'sell' ? 'bad' : 'ok'}" type="submit">${st.side === 'sell' ? 'Vender' : 'Comprar'}</button></form></div>
        ${c.industry !== 'ETF' && (c.owners || []).some(o => S.chars?.some?.(x => x.id === o) || o === S.char.id) ? `<form class="card form" data-form="dividendo"><h3>Repartir dividendos</h3><p class="muted">Reparte efectivo de ${esc(c.name)} (${money(c.cash)}) entre todas las acciones en circulación, incluidas las del ETF.</p>${fieldsHTML([{ k: 'amount', label: 'Total a repartir', type: 'number', min: 1, step: 0.01, req: 1 }])}<button class="btn">Repartir</button></form>` : ''}`;
    } else if (st.tab === 'port') body = mine.length ? `<div class="kpis inv-sum"><div><small>Invertiste</small><b>${money(cost)}</b></div><div><small>Vale hoy</small><b>${money(value)}</b></div>
        <div><small>Vas ${value - cost >= 0 ? 'ganando' : 'perdiendo'}</small><b class="${value - cost >= 0 ? 'pos' : 'neg'}">${value - cost >= 0 ? '+' : '−'}${money(Math.abs(value - cost))}</b></div><div><small>Rendimiento</small><b>${sgn(pct(value, cost))}</b></div></div>
        <table class="tbl"><thead><tr><th>Emisora</th><th>Títulos</th><th>Costo prom.</th><th>Invertiste</th><th>Precio</th><th>Vale hoy</th><th>Ganancia</th><th>%</th></tr></thead><tbody>
        ${mine.map(c => { const h = H(c.id), v = h.shares * c.price, g = v - h.cost; return `<tr class="click" data-act="ver" data-id="${c.id}"><td><b>${esc(c.name)}</b></td><td>${h.shares}</td><td>${money(h.cost / h.shares)}</td><td>${money(h.cost)}</td><td>${money(c.price)}</td><td>${money(v)}</td>
          <td class="${g >= 0 ? 'pos' : 'neg'}">${g >= 0 ? '+' : '−'}${money(Math.abs(g))}</td><td>${sgn(pct(v, h.cost))}</td></tr>`; }).join('')}</tbody></table>` : `<p class="empty">Aún no tienes inversiones. Ve a Mercado para comprar tus primeras acciones.</p>`;
    else if (st.tab === 'mkt') body = `<div class="mkt">${cos.map(c => `<button class="mkt-row" data-act="ver" data-id="${c.id}"><div><b>${esc(c.name)}</b><small>${esc(c.industry)}</small></div>${chart(series(c).slice(-30), 120, 36, false)}
        <div class="q-p"><b>${money(c.price)}</b>${sgn(day(c))}</div></button>`).join('') || '<p class="empty">Aún no hay emisoras en la bolsa.</p>'}</div>`;
    else body = `<ul class="list">${trades.map(t => `<li><div><b class="${t.side === 'compra' ? 'pos' : 'neg'}">${t.side === 'compra' ? 'Compra' : 'Venta'}</b> ${t.qty} × ${esc(cos.find(c => c.id === t.company_id)?.name || '—')}
        <div class="muted">${fdate(t.created_at)} · ${money(t.price)} por título</div></div><b>${money(t.total)}</b></li>`).join('') || '<li class="muted">Sin operaciones.</li>'}</ul>`;
    view(el, `<div class="gbm"><header class="gbm-h"><b>GBM<span>+</span></b><span>${esc(cname(S.char.id))}</span></header>
      <div class="gbm-sum"><div><small>Valor del portafolio</small><b>${money(value)}</b>${sgn(pct(value, cost))}</div><div><small>Poder de compra</small><b>${money(acc?.balance)}</b></div>
        <div><small>Ganancia / pérdida</small><b class="${value - cost >= 0 ? 'pos' : 'neg'}">${money(value - cost)}</b></div><div><small>Inflación acumulada</small><b>${((cpi() - 1) * 100).toFixed(2)}%</b></div></div>
      ${st.id ? '' : tabs([['port', 'Portafolio'], ['mkt', 'Mercado'], ['ord', 'Órdenes']], st.tab)}<div class="gbm-b">${body}</div>
      <p class="muted small">Precio por título = (efectivo + casas + autos de la empresa) ÷ títulos. El ETF LA500 es un fondo: con tu dinero compra acciones de todas las empresas según su tamaño, y su precio es lo que valen sus acciones más su efectivo, entre sus títulos. Los precios se registran con cada operación y al cierre del día.</p></div>`, {
      tab: d => go({ tab: d.t, id: null }), ver: d => go({ id: d.id, side: 'buy' }), back: () => go({ id: null, tab: 'mkt' }), tf: d => go({ tf: +d.ms }), side: d => go({ side: d.s }),
      async orden(f) {
        if (!acc) throw new Error('Necesitas tu cuenta personal');
        const r = st.side === 'sell' ? await db.rpc('sell_shares', { company: st.id, qty: f.qty, acc: acc.id }) : await db.rpc('buy', { kind: 'shares', item: st.id, acc: acc.id, qty: f.qty });
        toast(`${st.side === 'sell' ? 'Vendiste' : 'Compraste'} ${f.qty} títulos por ${money(r)}`); go({}); window.liveRefresh?.();
      },
      async dividendo(f) { const p = await db.rpc('pay_dividend', { company: st.id, amount: +f.amount }); toast(`Repartiste ${money(p)} en dividendos`); go({}); window.liveRefresh?.(); },
    });
    clearTimeout(el._live); if (st.id) el._live = setTimeout(() => { if (el.isConnected && el.querySelector('.tv') && !el.contains(document.activeElement)) bolsa.render(el, params); }, 10000); // en vivo
    const q = el.querySelector('[name=qty]'), est = el.querySelector('[data-est]'), c = st.id && cos.find(x => x.id === st.id);
    if (!q || !c) return;
    // mismo cálculo que buy_shares/sell_shares del servidor: el precio se mueve mientras compras o vendes
    const isEtf = c.industry === 'ETF', prem0 = isEtf ? 1 : coPremium(c), bookPs = isEtf ? c.price : Math.max(c.bps, 0.01), outQ = Math.max(c.out || 0, 1), cashBal = Number(acc?.balance || 0), myShares = Number(H(c.id)?.shares || 0), isSell = st.side === 'sell';
    const tradeCost = n => isEtf ? c.price * n * (isSell ? 0.995 : 1) : isSell ? bookPs * (prem0 + Math.max(prem0 * Math.exp(-n / outQ), 0.2)) / 2 * n : bookPs * (prem0 + Math.min(prem0 * Math.exp(n / outQ), 5)) / 2 * n;
    const maxBuyQty = budget => { let lo = 0, hi = 1; while (tradeCost(hi) <= budget && hi < 1e12) hi *= 2; while (hi - lo > 1) { const m = Math.floor((lo + hi) / 2); tradeCost(m) <= budget ? lo = m : hi = m; } return lo; };
    const maxSellQty = () => { let n = myShares; while (n > 0 && tradeCost(n) > c.cash) n = Math.floor(n * 0.9); return n; };
    const fitQty = isSell ? maxSellQty() : maxBuyQty(cashBal * 0.995);
    const updEst = () => { const n = Math.max(0, Math.floor(+q.value || 0)), t = tradeCost(n);
      est.innerHTML = isSell ? `Recibirías ≈ <b>${money(t)}</b>${n ? ` (promedio ${money(t / n)} por título)` : ''} · Tienes ${myShares.toLocaleString()} títulos · La empresa puede recomprarte hasta <b>${fitQty.toLocaleString()}</b>`
        : `Total estimado <b>${money(t)}</b>${n ? ` (promedio ${money(t / n)} por título)` : ''} · Tu saldo ${money(cashBal)} · <b>Te alcanza para ${fitQty.toLocaleString()} títulos</b>`; };
    el.querySelectorAll('[data-act=frac]').forEach(b => b.onclick = e => { e.stopPropagation(); const f = +b.dataset.f;
      q.value = isSell ? Math.min(Math.floor(myShares * f), fitQty) : maxBuyQty(cashBal * f * 0.995); /* margen para redondeos */ updEst(); });
    q.addEventListener('input', updEst); updEst();
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
      <div class="grid-cards">${props.filter(p => (p.kind || 'casa') === kind).map(p => { const sold = !p.for_sale && (p.owner_char || p.owner_company);
        return `<div class="card prop ${sold ? 'sold' : ''}"><div class="prop-img">${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy">` : `<div class="ph">${ico('casas')}</div>`}${sold ? '<span class="sold-tag">VENDIDA</span>' : ''}</div>
        <b>${esc(p.name)}</b><div class="muted">📍 ${esc(p.location || 'Ubicación por asignar')} · ${esc(p.zone)}</div><div class="muted">Dueño: ${esc(owner(p))}</div>
        <div class="price">${p.for_sale ? money(p.owner_char || p.owner_company ? p.sale_price : p.price * cpi()) : 'No está en venta'}</div>
        ${p.for_sale && !mine(p) ? `<button class="btn sm ok" data-act="comprar" data-id="${p.id}">Comprar</button>` : ''}
        ${mine(p) ? `<button class="btn sm" data-act="vender" data-id="${p.id}">${p.for_sale ? 'Cambiar precio / quitar' : 'Poner en venta'}</button>` : ''}
        ${lvl() >= 3 ? `<div class="row gap"><button class="btn sm ghost" data-act="editar" data-id="${p.id}">Editar</button><button class="btn sm ghost" data-act="duplicar" data-id="${p.id}">+ Otra igual</button><button class="btn sm ghost" data-act="borrar" data-id="${p.id}">🗑 Borrar</button></div>` : ''}</div>`; }).join('') || '<p class="empty">Aún no hay casas cargadas.</p>'}</div>`, {
      editar: d => { const p = props.find(x => x.id === d.id); modal('Editar ' + esc(p.name), form('go', [{ k: 'name', label: 'Nombre', req: 1 }, { k: 'location', label: 'Ubicación (calle, número, referencia)' },
          { k: 'zone', label: 'Zona', type: 'select', options: ['Los Ángeles', 'River City', 'Springfield'], req: 1 }, { k: 'price', label: 'Precio base del gobierno (USD)', type: 'number', min: 1, req: 1 }, { k: 'img', label: 'Cambiar foto', type: 'file' }], p), {
        async go(f, _, close) { if (!f.img) delete f.img; f.price = Number(f.price); await db.update('properties', p.id, f); close(); toast('Casa actualizada'); casas.render(el); } }); },
      borrar: async d => { const p = props.find(x => x.id === d.id); if (!await ask(`¿Borrar «${p.name}» para siempre?${p.owner_char || p.owner_company ? ' Su dueño la perderá.' : ''}`)) return; await db.remove('properties', d.id); toast('Casa borrada'); casas.render(el); },
      duplicar: async d => { const { name, zone, price, img, kind: k } = props.find(x => x.id === d.id); await db.insert('properties', { name, zone, price, img, kind: k || 'casa' }); toast('Agregada otra unidad. Ponle su ubicación con «Editar».'); casas.render(el); },
      comprar: d => modal('Comprar casa', `<form data-form="go" class="form">${accSelect(accs)}<button class="btn ok" type="submit">Confirmar compra</button></form>`, {
        async go(f, _, close) { const r = await db.rpc('buy', { kind: 'property', item: d.id, acc: f.acc }); toast('¡Casa comprada por ' + money(r) + '!'); close(); casas.render(el); } }),
      vender: d => modal('Vender casa', form('go', [{ k: 'price', label: 'Precio de venta (vacío = quitar de venta)', type: 'number', min: 1 }]), {
        async go(f, _, close) { await db.rpc('list_item', { kind: 'property', item: d.id, price: f.price }); close(); casas.render(el); } }),
      nueva: () => modal('Nueva casa', form('go', [{ k: 'name', label: 'Nombre', req: 1 }, { k: 'zone', label: 'Zona', type: 'select', options: ['River City', 'Springfield'], req: 1 },
        { k: 'location', label: 'Ubicación' }, { k: 'kind', label: 'Tipo', type: 'select', options: [['casa', 'Casa'], ['local', 'Local comercial']], req: 1, def: kind }, { k: 'price', label: 'Precio base', type: 'number', min: 1, req: 1 }, { k: 'img', label: 'Foto', type: 'file' }]), {
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
        <div class="row"><button class="btn sm ok" data-act="comprar" data-id="${m.id}">Comprar</button>${lvl() >= 3 ? `<button class="btn sm" data-act="editar" data-id="${m.id}">✏️ Foto / precio</button><button class="btn sm ghost" data-act="borrarM" data-id="${m.id}">🗑</button>` : ''}</div></div>`).join('')}</div>`).join('') || '<p class="empty">Catálogo vacío.</p>'}`;
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
      borrarM: async d => { if (!await ask(`¿Quitar ${M[d.id].brand} ${M[d.id].model} del catálogo?`)) return; await db.remove('vehicle_models', d.id).catch(() => { throw new Error('No se puede: hay jugadores con este auto. Edítalo en lugar de borrarlo.'); }); toast('Auto quitado del catálogo'); autos.render(el); },
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
    if (tab === 'juez') await juzgado(el.querySelector('.tabbody'), () => this.render(el, 'juez'));
  } };

// Juzgado: sala de juicios penales. El juez decide con qué cargos queda culpable (puede quitar o agregar) o lo declara inocente.
async function juzgado(el, again) {
  const [trials, code, prev] = await Promise.all([db.list('requests', { eq: { status: 'pending', type: 'juicio' } }),
    db.list('penal_code', { order: 'code', asc: true }).then(c => c.sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true }))), db.list('inmates', { eq: { status: 'preventiva' } }).catch(() => [])]);
  const sum = card => { const p = [...card.querySelectorAll('[name=cargo]:checked')].map(i => code.find(x => x.code === i.value)).filter(Boolean);
    return { p, years: Math.min(99, p.reduce((s, x) => s + Number(x.years || 0), 0)), fine: p.reduce((s, x) => s + Number(x.fine || 0), 0) * cpi() }; };
  el.innerHTML = `<h3>⚖️ Juicios penales</h3>${trials.map(r => { const pv = prev.find(i => i.character_id === r.character_id);
    return `<div class="card trial" data-trial="${r.id}"><div class="trial-h"><small>TRIBUNAL SUPERIOR DE LOS ÁNGELES · CASO ${r.id.slice(0, 8).toUpperCase()}</small>
      <b>El Pueblo de California vs. ${esc(r.data.acusado || cname(r.character_id))}</b>
      <span class="muted">Presentado por ${esc(r.data.oficial || 'LAPD')} · ${fdate(r.created_at)} · ${pv ? `🔒 En prisión preventiva desde ${fdate(pv.started_at)}` : '🚨 No está detenido (orden de arresto)'}</span></div>
      <p class="muted">La fiscalía pide ${pena(r.data.anos) || 'multa'}${r.data.multa ? ' y ' + money(r.data.multa) : ''}. Los cargos de la fiscalía ya están marcados: quita los que no se probaron y agrega los que sí.</p>
      <div class="charges">${chargesHTML(code, (r.data.charges || []).map(x => x.code))}</div>
      <div class="trial-sum" data-sum></div>
      <textarea data-fund rows="2" placeholder="Fundamentos de la sentencia (se publican en LA Times)"></textarea>
      <div class="row gap"><button class="btn ok" data-act="culpable" data-id="${r.id}">⚖️ Culpable de los cargos marcados</button><button class="btn bad" data-act="inocente" data-id="${r.id}">🕊️ Inocente</button></div></div>`; }).join('') || '<p class="empty">No hay juicios pendientes.</p>'}
    <div class="dem"></div>`;
  const paint = card => { const { p, years, fine } = sum(card); card.querySelector('[data-sum]').innerHTML = `Sentencia: <b>${pena(years) || 'sin prisión'}</b> · multa <b>${money(fine)}</b> · ${p.length} cargo(s)`; };
  el.querySelectorAll('.trial').forEach(c => { paint(c); c.addEventListener('change', () => paint(c)); });
  const act = { async culpable(d) {
      const r = trials.find(x => x.id === d.id), card = el.querySelector(`[data-trial="${d.id}"]`), { p, years, fine } = sum(card), fund = card.querySelector('[data-fund]').value.trim();
      if (!p.length) throw new Error('Marca al menos un cargo, o declara inocente');
      if (!await ask(`¿Culpable de ${p.length} cargo(s)? ${pena(years) || 'Sin prisión'} y multa de ${money(fine)}.`)) return;
      const charges = p.map(x => ({ code: x.code, title: x.title })), cargos = charges.map(x => x.code + ' ' + x.title).join(', '), minutes = years * Number(set('prison_min_per_year'));
      const pv = (await db.list('inmates', { eq: { character_id: r.character_id, status: 'preventiva' } }))[0];
      if (pv && years > 0) await db.update('inmates', pv.id, { status: 'en_prision', years, minutes, charges, ends_at: new Date(new Date(pv.started_at).getTime() + minutes * 6e4).toISOString(), note: 'Sentencia judicial (la preventiva cuenta como cumplida)' });
      else if (pv) await db.update('inmates', pv.id, { status: 'liberado', ends_at: new Date().toISOString(), note: 'Sentencia sin prisión' });
      else if (years > 0) await db.insert('inmates', { character_id: r.character_id, officer_id: S.char?.id || null, charges, years, minutes, started_at: new Date().toISOString(), ends_at: new Date(Date.now() + minutes * 6e4).toISOString(), status: 'en_prision', note: 'Sentencia judicial' });
      if (fine > 0) await db.insert('records', { kind: 'arresto', character_id: r.character_id, officer_id: S.char?.id || null, amount: Math.round(fine), description: 'Sentencia judicial: ' + cargos, charges });
      const data = { ...r.data, charges, cargos, anos: years, multa: Math.round(fine), veredicto: 'culpable' };
      await db.update('requests', r.id, { status: 'approved', note: fund, data, reviewer_id: S.me.id, reviewed_at: new Date().toISOString() });
      await courtNews({ ...r, data, note: fund }, true); toast('Sentencia dictada ⚖️'); again();
    },
    async inocente(d) {
      const r = trials.find(x => x.id === d.id), fund = el.querySelector(`[data-trial="${d.id}"] [data-fund]`).value.trim();
      if (!await ask(`¿Declarar inocente a ${r.data.acusado}? Sale libre y no paga nada.`)) return;
      for (const i of await db.list('inmates', { eq: { character_id: r.character_id, status: 'preventiva' } })) await db.update('inmates', i.id, { status: 'liberado', ends_at: new Date().toISOString(), note: 'Inocente: liberado por el juez' });
      await courtNews({ ...r, note: fund }, false); await db.rpc('reject_request', { id: r.id, note: fund || 'Inocente' }); toast('Declarado inocente 🕊️'); again();
    } };
  el.onclick = async e => { const b = e.target.closest('[data-act]'); if (!b || !act[b.dataset.act]) return; b.disabled = true; try { await act[b.dataset.act](b.dataset); } catch (x) { toast(x.message, 'err'); } finally { b.disabled = false; } };
  reviewQueue(el.querySelector('.dem'), { types: ['demanda'], title: 'Demandas civiles' });
}

// ============ SE BUSCA (recompensas públicas) ============
// tabla de plazos: [meses del juego, interés total, duración real]. 12 meses del juego ≈ 1 mes real.
const PLAZOS = [[1, 0.03, '2.5 días'], [3, 0.09, '7.5 días'], [6, 0.20, '15 días'], [12, 0.45, '1 mes']];
document.addEventListener('input', e => { const f = e.target.closest?.('.cr-plan'); if (!f) return; const a = +f.amount.value || 0;
  PLAZOS.forEach(([m, r]) => { const t = a * (1 + r); f.querySelector(`[data-int="${m}"]`).textContent = money(a * r); f.querySelector(`[data-mo="${m}"]`).textContent = money(t / m); f.querySelector(`[data-tot="${m}"]`).textContent = money(t); }); });
const sebusca = { id: 'sebusca', name: 'Se Busca', icon: '🤠', bg: '#8b5a2b,#3e2410', show: () => true,
  async render(el) {
    const o = await db.list('records', { eq: { kind: 'orden', paid: false } }).catch(() => []), tot = o.reduce((n, r) => n + bountyOf(r), 0);
    view(el, `<div class="sb"><header class="sb-h"><b>🤠 SE BUSCA · Recompensas de la LAPD</b><span>${o.length} buscado(s) · ${money(tot)} en recompensas</span></header>
      <p class="muted">Cada orden de arresto empieza en $0 y sube $1 por cada día del juego (2 horas reales) que la persona sigue libre; la policía también puede subirla, hasta un máximo de $1,000,000,000. Si ves a alguien, manda un aviso: le llega a la policía como llamada al 911. Si tu información lleva a su captura, <b>tú cobras la recompensa</b> (cuenta el último aviso antes de la captura; los policías no pueden cobrarla).</p>
      <div class="posters">${o.map(r => `<div>${posterHTML(r)}<button class="btn sm" data-act="aviso" data-id="${r.id}">📞 Dar un aviso</button></div>`).join('') || '<p class="empty">Nadie buscado por ahora. 🌴</p>'}</div></div>`, {
      aviso: d => { const r = o.find(x => x.id === d.id); if (!S.char) throw new Error('Necesitas una vida activa');
        modal('📞 Aviso sobre ' + esc(cname(r.character_id)), form('go', [{ k: 'location', label: '¿Dónde lo viste?', req: 1 }, { k: 'detalle', label: 'Detalles (ropa, auto, hacia dónde iba)', type: 'textarea', req: 1 }, { k: 'anonymous', label: 'Enviar como anónimo', type: 'checkbox' }], {}, 'Enviar aviso'), {
          async go(v, _, close) { await db.insert('calls911', { caller_char: S.char.id, service: 'policia', location: v.location, description: `Aviso de recompensa · ${cname(r.character_id)}: ${v.detalle}`.slice(0, 500), anonymous: !!v.anonymous, wanted_char: r.character_id }); close(); toast('Aviso enviado a la policía 🚓'); } }); },
    });
  } };

// ============ POLICÍA (MDT) + PRISIÓN ============
const REC = { arresto: 'Arresto', multa: 'Multa', orden: 'Orden de arresto', advertencia: 'Advertencia', cancelacion: 'Documento cancelado', decomiso: 'Decomiso' };
const KIND = { advertencia: 'Advertencias', infraccion: 'Infracciones (solo multa)', menor: 'Delitos menores (hasta 1 año)', grave: 'Delitos graves (más de 1 año)' };
// lista de artículos del código penal con casillas (MDT y Juzgado); «on» = códigos ya marcados
const chargesHTML = (code, on = []) => Object.entries(KIND).filter(([k]) => code.some(x => x.kind === k)).map(([k, l]) => `<details ${k === 'infraccion' || code.some(x => x.kind === k && on.includes(x.code)) ? 'open' : ''}><summary>${l}</summary>${code.filter(x => x.kind === k).map(x => `<label class="chk charge" title="${esc(x.notes || '')}"><input type="checkbox" name="cargo" value="${esc(x.code)}" ${on.includes(x.code) ? 'checked' : ''} data-fine="${x.fine}" data-years="${x.years}" data-lic="${x.lic ? 1 : ''}">
            <b>${esc(x.code)}</b> ${esc(x.title)}${x.lic ? ' <span class="tag">licencia</span>' : ''}${x.notes ? ` <small class="muted">· ${esc(x.notes)}</small>` : ''}<span class="grow"></span><small>${[x.fine ? money(x.fine * cpi()) : '', pena(x.years)].filter(Boolean).join(' · ')}</small></label>`).join('')}</details>`).join('');
// años de prisión → texto («6 meses», «2 años y 6 meses», «Perpetua»)
const pena = y => { const m = Math.round(Number(y) * 12); if (m >= 1188) return 'Perpetua'; if (!m) return ''; const a = Math.floor(m / 12), r = m % 12;
  return [a && `${a} año${a > 1 ? 's' : ''}`, r && `${r} mes${r > 1 ? 'es' : ''}`].filter(Boolean).join(' y '); };
// recompensa de una orden: $1 por cada día del juego que sigue libre + lo que agregó la policía (igual que bounty() en SQL)
const bountyOf = r => Math.min(1e9, Math.max(0, Math.round((Date.parse(gameDay()) - Date.parse(gameDay(r.created_at))) / 864e5)) + Number(r.bounty_extra || 0)); // tope: mil millones
// cartel de SE BUSCA (MDT, app Se Busca y LA Times)
const posterHTML = (r, act = '') => `<div class="poster" ${act}><div class="poster-h">SE BUSCA</div><small class="poster-sub">POR EL DEPARTAMENTO DE POLICÍA DE LOS ÁNGELES</small>
  <div class="poster-ph">${av(skin(r.character_id), 'poster-img')}</div><b class="poster-name">${esc(cname(r.character_id)).toUpperCase()}</b>
  <p class="poster-ch">${esc((r.description || '').replace(/^En espera de juicio: /, ''))}</p><div class="poster-rw"><small>RECOMPENSA</small><b>${money(bountyOf(r))}</b></div>
  <small class="poster-f">Sube $1 por cada día que sigue libre · desde ${fdate(r.created_at)}</small></div>`;
const isGuard = () => isPolice() || has('Custodio');
const left = i => Math.max(0, new Date(i.ends_at) - Date.now()), since = i => Date.now() - new Date(i.started_at);
const clockTxt = ms => { const m = Math.ceil(ms / 6e4); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
const inPrison = i => i.status === 'preventiva' || (i.status === 'en_prision' && left(i) > 0);
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
  // por usuario de Roblox o de Discord (todas las vidas de esa cuenta; primero las activas)
  const qq = q.replace(/^@/, ''), profs = await db.list('profiles', { order: null, limit: 5000 }).catch(() => []);
  for (const p of profs) {
    const rb = String(p.roblox || '').toLowerCase().replace(/^@/, ''), dc = String(p.discord || '').toLowerCase().replace(/^@/, '');
    const why = rb && rb.includes(qq) ? `Roblox ${p.roblox}` : dc && dc.includes(qq) ? `Discord ${p.discord}` : null;
    if (why) S.all.filter(c => c.user_id === p.id).sort((a, b) => (b.status === 'active') - (a.status === 'active')).forEach(c => add(c.id, why + (c.status === 'active' ? '' : ' · vida ' + (ST[c.status] || c.status))));
  }
  vehs.filter(v => v.plate?.toLowerCase() === q).forEach(v => add(v.owner_char, 'Placa ' + v.plate));
  vehs.filter(v => v.vin?.toLowerCase() === q).forEach(v => add(v.owner_char, 'VIN ' + v.vin));
  reqs.filter(r => r.type === 'placa' && r.data.placa?.toLowerCase() === q).forEach(r => add(r.character_id, 'Placa ' + r.data.placa.toUpperCase()));
  reqs.filter(r => r.type === 'registro_arma' && r.data.serie?.toLowerCase() === q).forEach(r => add(r.character_id, 'Arma serie ' + r.data.serie));
  (await db.list('items', { limit: 5000 })).filter(i => i.serial?.toLowerCase() === q).forEach(i => add(i.owner_char, `Arma serie ${i.serial} (${SHOPI[i.item]?.name || i.item})`));
  return [...hit].map(([id, why]) => ({ c: S.all.find(x => x.id === id), why })).filter(x => x.c);
}
const MUG = [['frente', 'De frente'], ['izq', 'Perfil izquierdo'], ['der', 'Perfil derecho'], ['espalda', 'De espalda']];
const policia = { id: 'policia', name: 'LAPD MDT', icon: '🚓', bg: '#141e30,#243b55', show: isPolice,
  async render(el, st = { tab: 'buscar' }) {
    if (!sessionStorage.getItem('mdt')) return view(el, `<div class="login-mini"><img class="mdt-badge" src="img/favicon.png" alt=""><h2>LAPD · Mobile Data Terminal</h2>
      <p>Oficial: <b>${esc(S.char ? cname(S.char.id) : S.me.username)}</b></p><p class="muted">Placa #${(S.char?.id || S.me.id).slice(0, 5).toUpperCase()}</p>
      <button class="btn" data-act="in">Iniciar sesión</button></div>`, { in: () => { sessionStorage.setItem('mdt', 1); this.render(el); } });
    const go = p => policia.render(el, { ...st, ...p });
    const code = (await db.list('penal_code', { order: 'code', asc: true })).sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true }));
    let body = '';
    if (st.tab === 'buscar') {
      const res = await searchPeople(st.q || '');
      body = `<form data-form="buscar" class="row"><input name="q" value="${esc(st.q || '')}" placeholder="Nombre, usuario de Roblox o Discord, No. de identificación o licencia, placa, VIN, serie de arma o folio" required autofocus><button class="btn">Buscar</button></form>
        ${st.q && !res.length ? '<p class="empty">Sin coincidencias.</p>' : ''}
        ${res.map(({ c, why }) => `<button class="result" data-act="ver" data-id="${c.id}">${av(c.skin_url, 'av sm')}<div><b>${esc(c.first_name)} ${esc(c.last_name)}</b><div class="muted">Coincide por: ${esc(why)}</div></div>${badge(c.status)}</button>`).join('')}`;
    } else if (st.tab === 'ver') {
      const c = S.all.find(x => x.id === st.id), [recs, reqs, vehs, models, inm] = await Promise.all([db.list('records', { eq: { character_id: c.id } }),
        db.list('requests', { eq: { character_id: c.id, status: 'approved' } }), db.list('vehicles', { eq: { owner_char: c.id } }), db.list('vehicle_models', { order: null }), db.list('inmates', { eq: { character_id: c.id } })]), inv = await db.list('items', { eq: { owner_char: c.id }, limit: 500 });
      const f = st.f || 'todos', shown = recs.filter(r => f === 'todos' || r.kind === f), jail = inm.find(inPrison);
      const lic = reqs.filter(r => ['dni', 'licencia_conducir', 'licencia_armas', 'registro_arma', 'visa', 'pasaporte', 'placa'].includes(r.type));
      body = `<button class="link" data-act="tab" data-t="buscar">‹ Volver</button><div class="card row">${av(c.skin_url, 'big-av')}<div class="grow"><h3>${esc(c.first_name)} ${esc(c.last_name)}</h3>
        <div class="muted">Nac. ${esc(c.dob)} · ${esc(c.sex)} · ${esc(c.city)} · ${esc(c.nationality)}${c.extranjero ? ' · Extranjero' : ''}</div>
        <div class="muted">ID ${docNumber(c, 'I')} · Licencia ${docNumber(c, 'D')} · Folio ${c.id.slice(0, 8).toUpperCase()}</div>
        ${(() => { const m = inm.find(i => i.mugshots)?.mugshots; return m ? `<div class="mugs">${MUG.map(([k, l]) => m[k] ? `<figure><img src="${esc(m[k])}" alt="${l}" data-act="zoom" data-src="${esc(m[k])}"><figcaption>${l}</figcaption></figure>` : '').join('')}</div>` : ''; })()}
        ${jail ? `<div class="alert">EN PRISIÓN · ${jail.status === 'preventiva' ? 'preventiva (espera juicio), lleva ' + clockTxt(since(jail)) : 'le faltan ' + clockTxt(left(jail))}. Si está en la calle sin fuga aprobada, repórtalo al staff (warn administrativo).
          <button class="btn sm bad" data-act="reportar" data-id="${jail.id}">Reportar al staff</button></div>` : ''}
        ${(() => { const o = recs.filter(r => r.kind === 'orden' && !r.paid); return o.length && !jail ? `<div class="alert wanted-alert"><b>🚨 SE BUSCA · ORDEN DE ARRESTO ACTIVA</b><ul>${o.map(r => `<li>${esc(r.description)} · <b class="bounty">💰 Recompensa ${money(bountyOf(r))}</b> <button class="link" data-act="recompensa" data-id="${r.id}">Subir recompensa</button></li>`).join('')}</ul>
          <button class="btn bad" data-act="capturar">🚔 Capturado: procesar arresto</button> <small class="muted">Carga los cargos de la orden; puedes agregar más antes de registrar. La recompensa la cobra el ciudadano cuyo aviso llevó a la captura (los policías no cuentan).</small></div>` : ''; })()}</div></div>
        <h3>Documentos</h3><ul class="list">${lic.map(r => `<li><span class="li-ico">${ico(r.type)}</span><span class="grow">${esc(TRAMITES[r.type].name)} ${esc(r.data.clase || r.data.tipo || r.data.arma || r.data.placa || '')}</span><button class="btn sm bad" data-act="cancelarDoc" data-id="${r.id}" data-n="${esc(TRAMITES[r.type].name)}">Cancelar</button></li>`).join('') || '<li class="muted">Sin documentos</li>'}</ul>
        <h3>Vehículos</h3><ul class="list">${vehs.map(v => { const m = models.find(x => x.id === v.model_id); const exp = new Date(v.registered_at || v.created_at); exp.setFullYear(exp.getFullYear() + 1); return `<li><div class="grow"><b>${esc(m?.brand)} ${esc(m?.model)}</b> · ${esc(v.plate || 'sin placa')}<div class="muted">VIN ${esc(v.vin || '—')} · Registro ${exp < new Date() ? '<b class="neg">VENCIDO</b>' : 'vigente hasta ' + fdate(exp.toISOString())}</div></div></li>`; }).join('') || '<li class="muted">Ninguno</li>'}</ul>
        <h3>Inventario</h3>${inv.some(i => SHOPI[i.item]?.gun) ? '<button class="btn sm bad" data-act="decomisarArmas">Decomisar todas las armas y munición</button>' : ''}<ul class="list">
          <li class="muted">Celular incluido (no se decomisa)</li>${inv.map(i => { const it = SHOPI[i.item] || { name: i.item }; return `<li><span class="grow">${esc(it.name)}${i.serial ? ` · <b>serie ${esc(i.serial)}</b>` : ''}</span>${it.conf ? `<button class="btn sm bad" data-act="decomisar" data-id="${i.id}" data-n="${esc(it.name)}">Decomisar</button>` : ''}</li>`; }).join('')}</ul>
        <h3>Antecedentes</h3><div class="chips">${['todos', 'advertencia', 'multa', 'arresto', 'orden'].map(k => `<button data-act="f" data-f="${k}" class="${f === k ? 'on' : ''}">${k === 'todos' ? 'Todos' : REC[k]} (${k === 'todos' ? recs.length : recs.filter(r => r.kind === k).length})</button>`).join('')}</div>
        <ul class="list">${shown.map(r => `<li><div class="grow"><b>${REC[r.kind] || esc(r.kind)}</b> ${r.amount ? money(r.amount) : ''} ${r.paid ? `<span class="tag">${r.kind === 'orden' ? 'Cumplida' : 'Pagada'}</span>` : ''}
          <div>${esc(r.description)}</div><div class="muted">${fdate(r.created_at)} · Oficial ${esc(cname(r.officer_id))}</div></div>
          ${r.kind === 'orden' && !r.paid ? `<button class="btn sm" data-act="cumplir" data-id="${r.id}">Cumplida</button>` : ''}</li>`).join('') || '<li class="muted">Limpio</li>'}</ul>
        <h3>Procesar</h3><form data-form="procesar" class="form">${fieldsHTML([{ k: 'kind', label: 'Acción', type: 'select', req: 1, def: 'multa',
          options: [['advertencia', 'Advertencia'], ['multa', 'Multa'], ['arresto', 'Arresto (multa + prisión)'], ['orden', 'Orden de arresto']] }])}
          <p class="muted" data-adv hidden>Advertencia: no lleva multa ni prisión, solo queda en su historial. Escribe abajo el motivo.</p>
          <div data-pen><div class="charges">${chargesHTML(code)}</div>
          <div class="row gap wrap"><label class="chk"><input type="checkbox" name="atenuante"> Atenuante (Art. 4): coopera, confiesa o repara el daño · −30 % de multa</label>
          <label class="chk"><input type="checkbox" name="agravante"> Agravante (Art. 5): reincidente, insulta a la autoridad o discrimina · +11 meses de prisión (o +$2,500 si no hay prisión)</label>
          <label class="chk" data-licbox hidden><input type="checkbox" name="quitarLic" checked> Retirar su licencia de conducir (los cargos marcados con «licencia» lo permiten)</label></div>
          <div class="totals" data-totals>Selecciona cargos</div></div>
          <div data-mir hidden class="miranda"><h4>⚖️ Derechos Miranda — léelos en voz alta antes de interrogar</h4>
            <ol><li>Tiene derecho a guardar silencio.</li><li>Todo lo que diga puede y será usado en su contra en un tribunal.</li><li>Tiene derecho a hablar con un abogado y a tenerlo presente durante el interrogatorio.</li><li>Si no puede pagar un abogado, se le asignará uno de oficio antes de cualquier interrogatorio.</li><li>¿Entiende los derechos que le acabo de leer? Teniéndolos en cuenta, ¿desea hablar conmigo?</li></ol>
            <details><summary>English (Miranda warning)</summary><p class="small">You have the right to remain silent. Anything you say can and will be used against you in a court of law. You have the right to an attorney. If you cannot afford an attorney, one will be appointed for you. Do you understand the rights I have just read to you? With these rights in mind, do you wish to speak to me?</p></details>
            <label class="chk"><input type="checkbox" name="miranda"> Le leí sus derechos y dijo que los entiende</label></div>
          <div data-mug hidden><h4>📸 Fotos de ficha (obligatorias para encarcelar)</h4><p class="muted">Toma una foto del personaje por cada lado.</p><div class="mug-grid">${fieldsHTML(MUG.map(([k, l]) => ({ k: 'mug_' + k, label: l, type: 'file', accept: 'image/*' })))}</div></div>
          ${fieldsHTML([{ k: 'description', label: 'Narrativa / detalles', type: 'textarea', req: 1 }])}
          <button class="btn" type="submit">Registrar</button></form>`;
    } else if (st.tab === 'buscados') {
      const o = await db.list('records', { eq: { kind: 'orden', paid: false } });
      body = `<div class="posters">${o.map(r => posterHTML(r, `data-act="ver" data-id="${r.character_id}"`)).join('') || '<p class="empty">Nadie buscado.</p>'}</div>`;
    }
    view(el, `${tabs([['buscar', 'Consultar'], ['buscados', 'Buscados'], ['pend', 'Trámites']], st.tab === 'ver' ? 'buscar' : st.tab)}<div class="tabbody">${body}</div>`, {
      tab: d => go({ tab: d.t, q: '' }), buscar: d => go({ q: d.q }), ver: d => go({ tab: 'ver', id: d.id, f: 'todos' }), f: d => go({ f: d.f }),
      cumplir: async d => { await db.update('records', d.id, { paid: true }); go({}); },
      decomisar: d => modal('Decomisar ' + esc(d.n), form('go', [{ k: 'motivo', label: 'Motivo', type: 'textarea', req: 1, ph: 'Ej. portaba el arma durante un asalto (Art. 45)' }], {}, 'Decomisar'), {
        async go(v, _, close) { await db.rpc('confiscate_item', { i: d.id, motivo: v.motivo, officer: S.char?.id || null }); close(); toast(d.n + ' decomisado'); go({}); } }),
      decomisarArmas: () => modal('Decomisar armas y munición', form('go', [{ k: 'motivo', label: 'Motivo', type: 'textarea', req: 1 }], {}, 'Decomisar todo'), {
        async go(v, _, close) { const inv = await db.list('items', { eq: { owner_char: st.id }, limit: 500 });
          for (const i of inv.filter(i => SHOPI[i.item]?.gun)) await db.rpc('confiscate_item', { i: i.id, motivo: v.motivo, officer: S.char?.id || null });
          close(); toast('Armas decomisadas'); go({}); } }),
      cancelarDoc: d => modal('Cancelar ' + esc(d.n), `<p class="muted">El documento deja de ser válido: desaparece de su cartera y tendrá que volver a tramitarlo. Queda en sus antecedentes.</p>` + form('go', [{ k: 'motivo', label: 'Motivo', type: 'textarea', req: 1, ph: 'Ej. arrestado por conducir en estado de ebriedad' }], {}, 'Cancelar documento'), {
        async go(v, _, close) { await db.rpc('revoke_doc', { r: d.id, motivo: v.motivo, officer: S.char?.id || null }); close(); toast(d.n + ' cancelado'); go({}); } }),
      async reportar(d) {
        await db.insert('requests', { type: 'warn_prision', dept: ['staff:mod'], character_id: S.char?.id || st.id, data: { preso_id: st.id, preso: cname(st.id), lugar: prompt('¿Dónde lo viste?') || '—', detalle: `Preso visto fuera de prisión (registro ${d.id.slice(0, 8)})` } });
        toast('Reporte enviado al staff');
      },
      zoom,
      recompensa: d => modal('💰 Subir recompensa', form('go', [{ k: 'amount', label: 'Agregar a la recompensa (USD · máximo total $1,000,000,000)', type: 'number', min: 1, max: 1e9, req: 1 }], {}, 'Subir'), {
        async go(v, _, close) { await db.rpc('raise_bounty', { rec: d.id, amount: +v.amount }); close(); toast('Recompensa actualizada'); go({}); } }),
      async capturar() { // pasa la orden al formulario de arresto con sus cargos marcados
        const fm = el.querySelector('form[data-form=procesar]'), codes = (await db.list('records', { eq: { character_id: st.id, kind: 'orden', paid: false } })).flatMap(r => (r.charges || []).map(x => x.code));
        fm.kind.value = 'arresto'; fm.querySelectorAll('[name=cargo]').forEach(i => { if (codes.includes(i.value)) { i.checked = true; i.closest('details').open = true; } });
        fm.dataset.captura = '1'; fm.dispatchEvent(new Event('change')); fm.scrollIntoView({ behavior: 'smooth' }); toast('Orden cargada: revisa los cargos, agrega los nuevos y registra el arresto');
      },
      async procesar(v, form) {
        if (v.kind === 'advertencia') { // solo historial: sin cargos, multa, prisión ni licencia
          await db.insert('records', { kind: 'advertencia', character_id: st.id, officer_id: S.char?.id || null, amount: null, description: v.description, charges: [] });
          return toast('Advertencia registrada en su historial'), go({});
        }
        const picked = [...form.querySelectorAll('[name=cargo]:checked')].map(i => code.find(x => x.code === i.value));
        if (!picked.length && v.kind !== 'orden') throw new Error('Selecciona al menos un cargo');
        let fine = picked.reduce((s, x) => s + Number(x.fine), 0) * cpi(), years = picked.reduce((s, x) => s + Number(x.years), 0);
        if (v.atenuante) fine *= 0.7;
        if (v.agravante) years > 0 ? years += 11 / 12 : fine += 2500 * cpi();
        if (v.kind === 'arresto' && !years) throw new Error('Ningún cargo marcado tiene prisión: usa Multa');
        if (v.kind === 'arresto' && !v.miranda) throw new Error('Primero léele sus derechos Miranda y marca la casilla');
        const miss = v.kind === 'arresto' ? MUG.filter(([k]) => !v['mug_' + k]).map(([, l]) => l) : [];
        if (miss.length) throw new Error('Para encarcelar faltan las fotos de ficha: ' + miss.join(', '));
        if (v.quitarLic && picked.some(x => x.lic)) { const lic = (await db.list('requests', { eq: { character_id: st.id, type: 'licencia_conducir', status: 'approved' } }))[0];
          if (lic) { await db.rpc('revoke_doc', { r: lic.id, motivo: picked.filter(x => x.lic).map(x => x.code + ' ' + x.title).join(', '), officer: S.char?.id || null }); toast('Licencia de conducir retirada'); } }
        const charges = picked.map(x => ({ code: x.code, title: x.title })), desc = `${charges.map(x => x.code + ' ' + x.title).join(', ')}${v.description ? ' — ' + v.description : ''}`;
        const juicio = v.kind !== 'orden' && years > Number(set('trial_years')); // más de N años: también va a juicio, pero si lo arrestaste ya entra a prisión
        const pend = juicio && (await db.list('requests', { eq: { character_id: st.id, type: 'juicio', status: 'pending' } }).catch(() => [])).length;
        if (juicio && !pend) await db.insert('requests', { type: 'juicio', dept: TRAMITES.juicio.dept, character_id: st.id, data: { acusado: cname(st.id), cargos: desc, anos: years, multa: Math.round(fine), oficial: cname(S.char?.id), charges, preso: v.kind === 'arresto' } });
        if (juicio && v.kind !== 'arresto') {
          await db.insert('records', { kind: 'orden', character_id: st.id, officer_id: S.char?.id || null, description: 'En espera de juicio: ' + desc, charges });
          return toast(`Son ${pena(years)}: requiere juicio. Se envió el caso a los jueces y quedó con orden de arresto (si ya lo tienes, usa Arresto).`), go({});
        }
        const ords = v.kind === 'arresto' ? await db.list('records', { eq: { character_id: st.id, kind: 'orden', paid: false } }) : [];
        const reward = ords.length ? await db.rpc('capture_orders', { c: st.id, officer: S.char?.id || null }) : null; // la orden se vuelve este arresto; la recompensa va a quien dio la información
        if (reward?.paid > 0) toast(`💰 Recompensa de ${money(reward.paid)} para ${cname(reward.to)} por su información`);
        await db.insert('records', { kind: v.kind === 'advertencia' ? 'advertencia' : v.kind, character_id: st.id, officer_id: S.char?.id || null, amount: v.kind === 'multa' || (v.kind === 'arresto' && !juicio) ? Math.round(fine) : null, description: (juicio ? '[Pendiente de juicio: multa y sentencia las fija el juez] ' : '') + (ords.length ? 'Capturado por orden de arresto · ' : '') + desc, charges });
        if (v.kind === 'orden') await db.insert('posts', { app: 'news', section: 'Policía', anonimo: true, character_id: S.char?.id || null, media_url: skin(st.id) || null,
          title: `SE BUSCA: ${cname(st.id)}`, body: `La LAPD emitió una orden de arresto contra ${cname(st.id)}.\n\nCargos: ${desc}\n\nRecompensa: empieza en $0 y sube $1 por cada día que siga libre. Si lo ves, avisa al 911 o desde la app Se Busca. No intentes detenerlo tú mismo.` }).catch(() => {});
        if (v.kind === 'arresto' && years > 0) {
          const minutes = years * Number(set('prison_min_per_year'));
          await db.insert('inmates', { character_id: st.id, officer_id: S.char?.id || null, charges, years, minutes, mugshots: Object.fromEntries(MUG.map(([k]) => [k, v['mug_' + k]])), started_at: new Date().toISOString(),
            ends_at: juicio ? null : new Date(Date.now() + minutes * 6e4).toISOString(), status: juicio ? 'preventiva' : 'en_prision', note: juicio ? 'Prisión preventiva: en espera de juicio' : null });
          const who = cname(st.id), list = charges.map(x => `• ${x.code} ${x.title}`).join('\n');
          await db.insert('posts', { app: 'news', section: 'Policía', character_id: S.char?.id || null, anonimo: true, media_url: v.mug_frente || null,
            title: juicio ? `LAPD arresta a ${who}: queda en prisión preventiva en espera de juicio` : `LAPD arresta a ${who}: ${pena(years)} de prisión`,
            body: `LOS ÁNGELES — Agentes del Departamento de Policía de Los Ángeles detuvieron a ${who}, quien fue fichado y trasladado a prisión. ${ords.length ? 'Tenía una orden de arresto activa y fue capturado. ' : ''}Le leyeron sus derechos Miranda en el lugar.\n\nCargos:\n${list}\n\n${juicio ? `La fiscalía pide ${pena(years)} de prisión; un juez decidirá. Multa: ${money(Math.round(fine))}.` : `Sentencia: ${pena(years)} de prisión y multa de ${money(Math.round(fine))}.`}${v.description ? '\n\n' + v.description : ''}\n\nOficial a cargo: ${cname(S.char?.id) || 'LAPD'}.` }).catch(() => {});
          toast(juicio ? 'Arrestado en prisión preventiva: el contador corre hacia arriba hasta que el juez dicte sentencia.' : `Arrestado: ${pena(years)} = ${Math.round(minutes)} min reales. El contador ya empezó.`);
        } else toast('Registrado');
        go({});
      },
    });
    const box = el.querySelector('[data-totals]');
    el.querySelector('form[data-form=procesar]')?.addEventListener('change', () => {
      const fm = el.querySelector('form[data-form=procesar]'), p = [...el.querySelectorAll('[name=cargo]:checked')], adv = fm.kind.value === 'advertencia';
      el.querySelector('[data-pen]').hidden = adv; el.querySelector('[data-adv]').hidden = !adv; el.querySelector('[data-mug]').hidden = el.querySelector('[data-mir]').hidden = fm.kind.value !== 'arresto';
      let f = p.reduce((s, i) => s + Number(i.dataset.fine), 0) * cpi(), y = p.reduce((s, i) => s + Number(i.dataset.years), 0);
      if (fm.atenuante.checked) f *= 0.7; if (fm.agravante.checked) y > 0 ? y += 11 / 12 : f += 2500 * cpi();
      el.querySelector('[data-licbox]').hidden = !p.some(i => i.dataset.lic);
      box.innerHTML = p.length ? `Multa total <b>${money(f)}</b>${y ? ` · Prisión <b>${pena(y)}</b> (${Math.round(y * Number(set('prison_min_per_year')))} min reales)` : ' · Sin prisión'}${y > Number(set('trial_years')) ? ' · <b class="neg">más de ' + set('trial_years') + ' años: entra a prisión y el caso va a juicio</b>' : ''}` : 'Selecciona cargos';
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
      ${mine.map(i => `<div class="alert">Tu vida <b>${esc(cname(i.character_id))}</b> está en prisión. ${i.status === 'preventiva' ? `En prisión preventiva (esperando juicio) desde hace <b data-since="${i.started_at}">${clockTxt(since(i))}</b>.` : `Le faltan <b data-left="${i.ends_at}">${clockTxt(left(i))}</b>.`} Si entras al servidor, debes estar dentro de la prisión.</div>`).join('')}
      <p class="muted">La condena corre desde el arresto, aunque el preso no esté conectado. 1 mes = ${Math.round(set('prison_min_per_year') / 12)} minutos reales (1 año = ${set('prison_min_per_year')} min). Más de ${set('trial_years')} años decide un juez.</p>
      <table class="tbl"><thead><tr><th>Recluso</th><th>Cargos</th><th>Condena</th><th>Tiempo</th>${can ? '<th></th>' : ''}</tr></thead><tbody>
      ${now.map(i => `<tr><td>${av(skin(i.character_id), 'av sm')} ${esc(cname(i.character_id))}</td><td>${(i.charges || []).map(x => esc(x.code)).join(', ')}</td><td>${i.status === 'preventiva' ? 'Juicio pendiente (piden ' + pena(i.years) + ')' : pena(i.years)}</td>
        <td>${i.status === 'preventiva' ? `<span class="tag">Preventiva</span> lleva <b data-since="${i.started_at}">${clockTxt(since(i))}</b>` : `faltan <b data-left="${i.ends_at}">${clockTxt(left(i))}</b>`}</td>${can ? `<td class="nowrap"><button class="btn sm" data-act="libre" data-id="${i.id}">Liberar</button><button class="btn sm bad" data-act="fuga" data-id="${i.id}">Fuga aprobada</button></td>` : ''}</tr>`).join('') || `<tr><td colspan="5" class="muted">Nadie en prisión.</td></tr>`}</tbody></table>
      <h3>Historial</h3><ul class="list">${past.map(i => `<li><span class="grow">${esc(cname(i.character_id))} · ${pena(i.years)}</span>${badge(i.status === 'en_prision' ? 'cumplida' : i.status)}</li>`).join('') || '<li class="muted">Sin historial</li>'}</ul>`, {
      async libre(d) { await db.update('inmates', d.id, { status: 'liberado', ends_at: new Date().toISOString(), note: 'Liberado por ' + (cname(S.char?.id) || S.me.username) }); prision.render(el); },
      async fuga(d) {
        if (!await ask('¿Registrar fuga APROBADA por el staff? Se le pondrá orden de arresto.')) return;
        const i = inm.find(x => x.id === d.id);
        await db.update('inmates', d.id, { status: 'fugado', note: 'Fuga aprobada' });
        await db.insert('records', { kind: 'orden', character_id: i.character_id, officer_id: S.char?.id || null, description: 'Art. 90 Evasión de prisión (fuga consumada)', charges: [{ code: 'Art. 90', title: 'Evasión de prisión (fuga consumada)' }, ...(i.charges || [])] });
        prision.render(el);
      },
    });
    clearInterval(el._t); el._t = setInterval(() => { if (!el.isConnected) return clearInterval(el._t); el.querySelectorAll('[data-left]').forEach(b => b.textContent = clockTxt(Math.max(0, new Date(b.dataset.left) - Date.now()))); el.querySelectorAll('[data-since]').forEach(b => b.textContent = clockTxt(Date.now() - new Date(b.dataset.since))); }, 15000);
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
    const apps = await db.list('store_apps'), owner = lvl() >= 5;
    view(el, `<div class="card row"><div class="grow"><b>¿Quieres tu propia app?</b><div class="muted">Paga el permiso de ${money(TRAMITES.app_store.cost)}, describe cómo la quieres y el equipo de la ciudad la programa y la publica con tu nombre.</div></div>
        ${S.char?.status === 'active' ? '<button class="btn" data-act="pedir">Solicitar mi app</button>' : ''}${owner ? '<button class="btn ghost" data-act="subir">Publicar app (Owner)</button>' : ''}</div>
      <div class="tiles">${apps.filter(a => a.approved).map(a => `<button class="tile" data-act="abrir" data-id="${a.id}"><span class="ico">${/^(data:image|https?:)/.test(a.icon || '') ? `<img src="${esc(a.icon)}" alt="" class="app-logo">` : esc(a.icon || '📱')}</span><b>${esc(a.name)}</b><small>${esc(cname(a.author_char))}</small></button>`).join('') || '<p class="empty">Todavía no hay apps publicadas.</p>'}</div>
      ${owner ? apps.filter(a => a.approved).map(a => `<div class="row sub"><span class="grow">${/^(data:image|https?:)/.test(a.icon || '') ? `<img src="${esc(a.icon)}" alt="" class="app-logo sm">` : esc(a.icon)} ${esc(a.name)}</span><button class="btn sm bad" data-act="del" data-id="${a.id}">Quitar</button></div>`).join('') : ''}`, {
      abrir: d => { const a = apps.find(x => x.id === d.id); modal(esc(a.name), '<iframe class="appframe" sandbox="allow-scripts allow-forms" title="app"></iframe>'); [...document.querySelectorAll('.appframe')].pop().srcdoc = a.html; },
      pedir: () => openTramite('app_store'),
      subir: () => modal('Publicar app', form('up', [{ k: 'author', label: 'Dueño de la app (quien pagó el permiso)', type: 'select', options: charOpts(), req: 1 }, { k: 'name', label: 'Nombre', req: 1 }, { k: 'logo', label: 'Logo (imagen; la del trámite de la persona)', type: 'file', accept: 'image/*' }, { k: 'icon', label: '…o ícono emoji', def: '📱', req: 1 },
        { k: 'file', label: 'Archivo .html', type: 'textfile' }, { k: 'html', label: '…o pega el HTML aquí', type: 'textarea' }]), {
        async up(f, _, close) { const html = f.file || f.html; if (!html) throw new Error('Falta el HTML');
          await db.insert('store_apps', { name: f.name, icon: f.logo || f.icon, html, author_char: f.author, approved: true }); close(); toast('App publicada'); robstore.render(el); } }),
      del: async d => { if (!await ask('¿Quitar esta app del App Store?')) return; await db.remove('store_apps', d.id); robstore.render(el); },
    });
  } };

// ============ SPOTIFY ============
// El audio vive fuera de la ventana: la música sigue aunque cierres Spotify. Con una Jam, todos escuchan lo mismo al mismo segundo.
const GENRES = ['Pop', 'Reguetón', 'Hip-Hop / Rap', 'Corridos', 'Rock', 'Electrónica', 'R&B', 'Banda / Regional', 'Indie', 'Podcast', 'Otro'];
const player = window.rpPlayer ??= { audio: new Audio(), queue: [], i: -1, loop: 'off', shuffle: false, jam: null, lib: {}, onchange: null, off: 0 };
// cuenta la reproducción (y paga regalías) al llegar a 30 s o a la mitad de la canción
player.audio.ontimeupdate = () => { const s = curSong(), a = player.audio; if (!s || player.counted === s.id || !S.char || a.currentTime < Math.min(30, (a.duration || 60) / 2)) return;
  player.counted = s.id; db.rpc('song_play', { s: s.id, c: S.char.id }).catch(() => {}); };
const fmtT = s => !isFinite(s) ? '0:00' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const curSong = () => player.queue[player.i];
const jamPush = p => player.jam && db.update('jams', player.jam, { ...p, updated_at: new Date(Date.now() + player.off).toISOString() }).catch(() => {});
function playAt(k, push = true) {
  const s = player.queue[k]; if (!s) return;
  player.i = k; player.audio.src = s.url; player.audio.play().catch(() => {});
  if (push) jamPush({ song_id: s.id, playing: true, position: 0 });
  player.onchange?.(); mini();
}
const nextIdx = () => player.shuffle && player.queue.length > 1 ? (player.i + 1 + Math.floor(Math.random() * (player.queue.length - 1))) % player.queue.length : player.i + 1;
function next(auto) {
  if (auto && player.loop === 'one') { player.audio.currentTime = 0; player.audio.play(); return jamPush({ playing: true, position: 0 }); }
  const k = nextIdx(); if (k < player.queue.length) return playAt(k);
  if (player.loop === 'all' || !auto) return playAt(0);
  jamPush({ playing: false, position: 0 }); player.onchange?.(); mini();
}
const toggle = () => { const a = player.audio; if (!a.src) return; a.paused ? a.play() : a.pause(); jamPush({ playing: !a.paused, position: a.currentTime }); };
player.audio.onended = () => next(true);
player.audio.onplay = player.audio.onpause = () => { player.onchange?.(); mini(); };
// sincroniza con la Jam cada 2 s: misma canción, mismo segundo, misma pausa
clearInterval(player.timer);
player.timer = setInterval(async () => {
  if (!player.jam) return;
  const j = await db.get('jams', player.jam).catch(() => null);
  if (!j) { player.jam = null; toast('La Jam terminó'); player.onchange?.(); return; }
  player.jamRow = j;
  const s = player.lib[j.song_id], a = player.audio;
  if (s && curSong()?.id !== s.id) { const k = player.queue.findIndex(x => x.id === s.id); if (k < 0) player.queue.push(s); playAt(k < 0 ? player.queue.length - 1 : k, false); }
  const want = Number(j.position) + (j.playing ? (Date.now() + player.off - new Date(j.updated_at)) / 1000 : 0);
  if (a.src && Math.abs(a.currentTime - want) > 2.5 && isFinite(a.duration)) a.currentTime = Math.min(want, a.duration - 0.5);
  if (j.playing && a.paused && a.src) a.play().catch(() => {}); if (!j.playing && !a.paused) a.pause();
}, 2000);
function mini() { // mini reproductor flotante para controlar la música desde cualquier app
  let m = document.querySelector('.sp-mini'); const s = curSong();
  if (!s) return m?.remove();
  if (!m) { m = Object.assign(document.createElement('div'), { className: 'sp-mini' }); document.body.append(m); }
  m.innerHTML = `${s.cover ? `<img src="${esc(s.cover)}" alt="">` : `<span class="sp-ph">${ico('s_music', 'i')}</span>`}<div><b>${esc(s.title)}</b><small>${player.jam ? '🎧 Jam · ' : ''}${esc(s.artist || '')}</small></div>
    <button data-m="prev" aria-label="Anterior">${ico('s_prevb', 'i')}</button><button data-m="pp" aria-label="Reproducir o pausar">${ico(player.audio.paused ? 's_playb' : 's_pause', 'i')}</button><button data-m="next" aria-label="Siguiente">${ico('s_next', 'i')}</button><button data-m="x" aria-label="Cerrar">✕</button>`;
  m.onclick = e => { const k = e.target.closest('[data-m]')?.dataset.m; if (k === 'pp') toggle(); if (k === 'next') next(); if (k === 'prev') playAt(Math.max(0, player.i - 1));
    if (k === 'x') { player.audio.pause(); jamPush({ playing: false, position: player.audio.currentTime }); player.queue = []; player.i = -1; m.remove(); } };
}
const spotify = { id: 'spotify', name: 'Spotify', icon: '🎧', bg: '#1db954,#13863b', show: () => true,
  async render(el, view_ = 'home', arg) {
    if (typeof view_ === 'object') view_ = 'home';
    if (!needChar(el)) return;
    const me = S.char.id, go = (v = view_, x = arg) => spotify.render(el, v, x);
    const [all, profs, likes, lists] = await Promise.all([db.list('songs', { order: 'created_at', asc: false }).catch(() => []), db.list('sp_profiles', { order: null }).catch(() => []),
      db.list('song_likes', { order: null, limit: 5000 }).catch(() => []), db.list('playlists', { order: 'created_at', asc: true }).catch(() => [])]);
    if (!player.off && db.rpc) db.rpc('server_now', {}).then(t => { if (t) player.off = new Date(t) - Date.now(); }).catch(() => {});
    all.forEach(s => player.lib[s.id] = s);
    const songs = all.filter(s => s.approved), pend = all.filter(s => !s.approved); // sin aprobar: solo las ve quien la subió y Admin+
    const prof = profs.find(p => p.character_id === me), pname = id => profs.find(p => p.character_id === id)?.name || cname(id);
    // cuenta de Spotify: cada quien se registra con el nombre y foto que quiera
    if (!prof) return view(el, `<div class="spfy sp-reg"><div class="sp-regbox"><b class="sp-logo">${ico('spotify', 'i')} Spotify</b><h2>Crea tu cuenta de Spotify</h2><p class="muted">Es gratis. Elige cómo te verán los demás.</p>
        ${form('reg', [{ k: 'name', label: 'Nombre de usuario', req: 1, def: cname(me) }, { k: 'avatar', label: 'Foto de perfil', type: 'file' }, { k: 'color', label: 'Tu color', type: 'color', def: '#1db954' }, { k: 'bio', label: 'Bio (opcional)', type: 'textarea' }], {}, 'Registrarme')}</div></div>`,
      { reg: async d => { await db.insert('sp_profiles', { character_id: me, name: d.name, avatar: d.avatar || S.char.skin_url || null, color: d.color, bio: d.bio || null }); toast('¡Bienvenido a Spotify! 🎧'); go('home'); } });
    const liked = new Set(likes.filter(l => l.character_id === me).map(l => l.song_id)), myLists = lists.filter(p => p.owner_char === me);
    const q = (el.dataset.q || '').toLowerCase();
    let title = 'Lo más nuevo', list = songs, head = '';
    if (view_ === 'liked') { title = 'Tus me gusta'; list = songs.filter(s => liked.has(s.id)); }
    else if (view_ === 'mine') { title = 'Tus canciones'; list = all.filter(s => s.uploader_char === me); head = `<p class="muted">💸 El gobierno te paga <b>${money((set('spotify_play_pay') ?? 2) * cpi())}</b> por cada reproducción de otra persona (cuenta 1 por persona al día). Llevas ${list.reduce((n, s) => n + (s.plays || 0), 0)} reproducciones.</p>`; }
    else if (view_ === 'pend' && lvl() >= 3) { title = 'Por aprobar'; list = pend; }
    else if (view_ === 'genre') { title = arg; list = songs.filter(s => (s.genre || 'Otro') === arg); }
    else if (view_ === 'artist') { title = arg; list = songs.filter(s => (s.artist || '').toLowerCase() === arg.toLowerCase()); }
    else if (view_ === 'list') { const p = lists.find(x => x.id === arg); title = p?.name || 'Playlist'; list = (p?.songs || []).map(id => songs.find(s => s.id === id)).filter(Boolean);
      head = `<p class="muted">Playlist de ${esc(pname(p?.owner_char))} · ${list.length} canciones ${p?.owner_char === me ? `<button class="link" data-act="delList" data-id="${p.id}">Borrar playlist</button>` : ''}</p>`; }
    else if (view_ === 'profile') { const p = profs.find(x => x.character_id === arg) || prof; title = p.name; list = songs.filter(s => s.uploader_char === p.character_id);
      head = `<div class="sp-prof" style="--c:${esc(p.color || '#1db954')}"><img class="sp-pav" src="${esc(p.avatar || '')}" alt=""><div><small>PERFIL</small><h1>${esc(p.name)}</h1><p>${esc(p.bio || '')}</p>
        <small>${list.length} canciones subidas · ${lists.filter(x => x.owner_char === p.character_id).length} playlists · ${likes.filter(l => l.character_id === p.character_id).length} me gusta</small>
        ${p.character_id === me ? '<br><button class="btn sm ghost" data-act="editProf">Editar perfil</button>' : ''}</div></div>`; title = 'Canciones'; }
    else if (q) { title = 'Resultados para "' + el.dataset.q + '"'; list = songs.filter(s => [s.title, s.artist, s.genre].join(' ').toLowerCase().includes(q)); }
    const cur = curSong(), artists = [...new Set(songs.map(s => s.artist).filter(Boolean))].slice(0, 12), jam = player.jamRow && player.jam ? player.jamRow : null;
    const row = (s, k) => `<div class="sp-row ${cur?.id === s.id ? 'on' : ''}" data-act="play" data-k="${k}"><span class="sp-n">${cur?.id === s.id && !player.audio.paused ? '<i class="eq"><b></b><b></b><b></b></i>' : k + 1}</span>
        ${s.cover ? `<img src="${esc(s.cover)}" alt="">` : `<span class="sp-ph">${ico('s_music', 'i')}</span>`}<div class="sp-t"><b title="${esc(s.title)}">${s.approved ? '' : '⏳ '}${esc(s.title)}</b><span class="sp-sub"><button class="link" data-act="artist" data-a="${esc(s.artist || '')}">${esc(s.artist || 'Artista desconocido')}</button><small>· ${(s.plays || 0).toLocaleString('es-MX')} ${s.plays === 1 ? 'reproducción' : 'reproducciones'}</small></span></div>
        <span class="sp-g">${esc(s.genre || '')}</span><button class="sa ${liked.has(s.id) ? 'on' : ''}" data-act="like" data-id="${s.id}" aria-label="Me gusta">${ico('s_heart', 'i')}</button>
        <button class="sa" data-act="addList" data-id="${s.id}" aria-label="Agregar a playlist">${ico('s_new', 'i')}</button>${!s.approved && lvl() >= 3 ? `<button class="sa on" data-act="aprobar" data-id="${s.id}" aria-label="Aprobar" title="Aprobar">✅</button>` : ''}${s.uploader_char === me || lvl() >= 3 ? `<button class="sa" data-act="del" data-id="${s.id}" aria-label="Borrar">${ico('s_trash', 'i')}</button>` : ''}</div>`;
    const home = view_ === 'home' && !q;
    view(el, `<div class="spfy"><aside class="sp-side"><b class="sp-logo">${ico('spotify', 'i')} Spotify</b>
        <button class="${home ? 'on' : ''}" data-act="nav" data-v="home">${ico('s_home', 'i')} Inicio</button>
        <button class="${view_ === 'jam' ? 'on' : ''}" data-act="nav" data-v="jam">🎧 Jam ${player.jam ? '<span class="sp-live">EN VIVO</span>' : ''}</button>
        <div class="sp-lib"><small>TU BIBLIOTECA</small>
          <button class="${view_ === 'liked' ? 'on' : ''}" data-act="nav" data-v="liked"><span class="sp-lk">♥</span> Tus me gusta <em>${liked.size}</em></button>
          <button class="${view_ === 'mine' ? 'on' : ''}" data-act="nav" data-v="mine">${ico('s_music', 'i')} Tus canciones</button>
          ${lvl() >= 3 ? `<button class="${view_ === 'pend' ? 'on' : ''}" data-act="nav" data-v="pend">✅ Por aprobar <em>${pend.length}</em></button>` : ''}
          ${myLists.map(p => `<button class="${view_ === 'list' && arg === p.id ? 'on' : ''}" data-act="list" data-id="${p.id}">${ico('s_save', 'i')} ${esc(p.name)}</button>`).join('')}
          <button data-act="newList">${ico('s_new', 'i')} Crear playlist</button><button data-act="subir">${ico('s_new', 'i')} Subir canción</button></div>
        <button class="sp-me" data-act="profile" data-id="${me}"><img src="${esc(prof.avatar || '')}" alt=""><span>${esc(prof.name)}</span></button></aside>
      <main class="sp-main" style="--c:${esc(prof.color || '#1db954')}"><form data-form="buscar" class="sp-search">${ico('s_search', 'i')}<input name="q" value="${esc(el.dataset.q || '')}" placeholder="¿Qué quieres escuchar?" autocomplete="off"></form>
        ${view_ === 'jam' ? (jam ? `<div class="sp-jam"><h1>🎧 Jam en vivo</h1><p>Comparte este código para que se unan y escuchen lo mismo al mismo tiempo. Si alguien pausa o cambia de canción, cambia para todos.</p>
              <div class="sp-code">${esc(jam.code)}</div><div class="sp-mem">${jam.members.map(m => `<span><img src="${esc(profs.find(p => p.character_id === m)?.avatar || '')}" alt="">${esc(pname(m))}</span>`).join('')}</div>
              <button class="btn bad" data-act="leaveJam">${jam.host_char === me ? 'Terminar Jam' : 'Salir de la Jam'}</button></div>`
            : `<div class="sp-jam"><h1>🎧 Jam</h1><p>Escuchen música juntos en tiempo real, aunque cada quien esté en su compu o su celular.</p><button class="btn" data-act="newJam">Iniciar una Jam</button>
              ${form('joinJam', [{ k: 'code', label: 'O únete con un código', req: 1, ph: 'Ej. K7P2QX' }], {}, 'Unirme')}</div>`)
        : `${home ? `<h2>Géneros</h2><div class="sp-genres">${GENRES.map((g, n) => `<button data-act="genre" data-g="${esc(g)}" style="--h:${n * 33}">${esc(g)}</button>`).join('')}</div>
            ${artists.length ? `<h2>Artistas</h2><div class="sp-artists">${artists.map(a => `<button data-act="artist" data-a="${esc(a)}"><span>${esc(a[0] || '?')}</span><b>${esc(a)}</b></button>`).join('')}</div>` : ''}` : ''}
          ${head}<div class="sp-bar-h"><h2>${esc(title)}</h2>${list.length ? `<button class="sp-bigplay" data-act="playAll" aria-label="Reproducir todo">${ico('s_playb', 'i')}</button>` : ''}</div>
          <div class="sp-list">${list.map(row).join('') || '<p class="empty">No hay canciones aquí todavía. Sube la primera con «Subir canción».</p>'}</div>`}</main>
      <footer class="sp-bar">${cur ? `${cur.cover ? `<img src="${esc(cur.cover)}" alt="">` : `<span class="sp-ph">${ico('s_music', 'i')}</span>`}<div class="sp-now"><b title="${esc(cur.title)}">${esc(cur.title)}</b><small>${esc(cur.artist || '')}</small></div>` : '<div class="sp-now muted">Elige una canción</div>'}
        <div class="sp-mid"><div class="sp-ctl"><button class="${player.shuffle ? 'on' : ''}" data-act="shuffle" aria-label="Aleatorio" aria-pressed="${!!player.shuffle}" title="Aleatorio${player.shuffle ? ' (activado)' : ''}">${ico('s_shuffle', 'i')}</button><button data-act="prev" aria-label="Anterior">${ico('s_prevb', 'i')}</button>
          <button class="sp-pp" data-act="pp" aria-label="Reproducir o pausar">${ico(player.audio.paused ? 's_playb' : 's_pause', 'i')}</button><button data-act="next" aria-label="Siguiente">${ico('s_next', 'i')}</button>
          <button class="${player.loop !== 'off' ? 'on' : ''}" data-act="loop" aria-label="Repetir" title="${player.loop === 'one' ? 'Repetir esta canción' : player.loop === 'all' ? 'Repetir todo' : 'Sin repetir'}">${ico(player.loop === 'one' ? 's_repeat1' : 's_repeat', 'i')}</button></div>
          <div class="sp-prog"><small data-t>0:00</small><input type="range" class="sp-range sp-seek" min="0" max="1000" value="0" aria-label="Avance"><small data-d>0:00</small></div></div>
        <div class="sp-volw"><span aria-hidden="true">${player.audio.volume === 0 ? '🔇' : '🔊'}</span><input type="range" class="sp-range sp-vol" min="0" max="100" value="${Math.round(player.audio.volume * 100)}" aria-label="Volumen"></div></footer></div>`, {
      nav: d => { el.dataset.q = ''; go(d.v, null); }, list: d => go('list', d.id), genre: d => go('genre', d.g), artist: d => d.a && go('artist', d.a), profile: d => go('profile', d.id),
      buscar: d => { el.dataset.q = d.q || ''; go('home'); },
      play: d => { player.queue = list; playAt(+d.k); },
      playAll: () => { player.queue = list; playAt(player.shuffle ? Math.floor(Math.random() * list.length) : 0); },
      pp: () => player.audio.src ? toggle() : list.length && (player.queue = list, playAt(0)),
      next: () => player.queue.length && next(), prev: () => player.queue.length && playAt(Math.max(0, player.i - 1)),
      shuffle: () => { player.shuffle = !player.shuffle; go(); }, loop: () => { player.loop = { off: 'all', all: 'one', one: 'off' }[player.loop]; toast(player.loop === 'one' ? 'Repetir esta canción' : player.loop === 'all' ? 'Repetir todo' : 'Sin repetir'); go(); },
      like: async d => { liked.has(d.id) ? await db.removeWhere('song_likes', { song_id: d.id, character_id: me }) : await db.insert('song_likes', { song_id: d.id, character_id: me }); go(); },
      addList: d => !myLists.length ? toast('Primero crea una playlist', 'err') : modal('Agregar a playlist', form('al', [{ k: 'p', label: 'Playlist', type: 'select', options: myLists.map(p => [p.id, p.name]), req: 1 }]), {
        async al(f, _, close) { const p = myLists.find(x => x.id === f.p); if (!p.songs.includes(d.id)) await db.update('playlists', p.id, { songs: [...p.songs, d.id] }); close(); toast('Agregada a ' + p.name); } }),
      newList: () => modal('Nueva playlist', form('nl', [{ k: 'name', label: 'Nombre', req: 1 }, { k: 'cover', label: 'Portada', type: 'file' }]), {
        async nl(f, _, close) { const p = await db.insert('playlists', { owner_char: me, name: f.name, cover: f.cover || null, songs: [] }); close(); go('list', p.id); } }),
      delList: async d => { if (!await ask('¿Borrar esta playlist?')) return; await db.remove('playlists', d.id); go('home'); },
      del: async d => { if (!await ask('¿Borrar esta canción?')) return; await db.remove('songs', d.id); go(); },
      aprobar: async d => { await db.update('songs', d.id, { approved: true }); toast('Canción aprobada ✅'); go(); },
      editProf: () => modal('Editar perfil', form('ep', [{ k: 'name', label: 'Nombre', req: 1 }, { k: 'avatar', label: 'Cambiar foto', type: 'file' }, { k: 'color', label: 'Color', type: 'color' }, { k: 'bio', label: 'Bio', type: 'textarea' }], prof), {
        async ep(f, _, close) { if (!f.avatar) delete f.avatar; await db.updateWhere('sp_profiles', { character_id: me }, f); close(); go('profile', me); } }),
      subir: () => modal('Subir canción', form('up', [{ k: 'title', label: 'Título', req: 1 }, { k: 'artist', label: 'Artista', def: prof.name }, { k: 'genre', label: 'Género', type: 'select', options: GENRES, req: 1 },
        { k: 'url', label: 'Archivo de audio (MP3, M4A, WAV…)', type: 'file', accept: 'audio/*', req: 1 }, { k: 'cover', label: 'Portada (opcional)', type: 'file' }]) + '<p class="muted small">Sube solo música tuya o que tengas permiso de compartir.</p>', {
        async up(f, _, close) { await db.insert('songs', { ...f, cover: f.cover || null, uploader_char: me }); close(); toast(lvl() >= 3 ? 'Canción subida 🎵' : 'Canción enviada ⏳ Un admin la revisa antes de publicarla'); go('mine'); } }),
      newJam: async () => { const code = Math.random().toString(36).slice(2, 8).toUpperCase(), s = curSong();
        const j = await db.insert('jams', { code, host_char: me, members: [me], song_id: s?.id || null, playing: !player.audio.paused, position: player.audio.currentTime || 0, updated_at: new Date(Date.now() + player.off).toISOString() });
        player.jam = j.id; player.jamRow = j; toast('Jam creada: comparte el código ' + code); go('jam'); },
      joinJam: async d => { player.jam = await db.rpc('join_jam', { jam_code: d.code, c: me }); player.jamRow = await db.get('jams', player.jam); toast('Te uniste a la Jam 🎧'); go('jam'); },
      leaveJam: async () => { const j = player.jamRow; if (j?.host_char === me) await db.remove('jams', j.id); else if (j) await db.update('jams', j.id, { members: j.members.filter(m => m !== me) }).catch(() => {});
        player.jam = null; player.jamRow = null; toast('Saliste de la Jam'); go('jam'); },
    });
    // barra de avance, tiempos y volumen en vivo
    const seek = el.querySelector('.sp-seek'), vol = el.querySelector('.sp-vol'), a = player.audio, tt = el.querySelector('[data-t]'), dd = el.querySelector('[data-d]');
    const paint = (r, v) => r.style.setProperty('--p', v + '%');
    const tick = () => { if (!el.isConnected) return a.removeEventListener('timeupdate', tick); if (a.duration) { seek.value = a.currentTime / a.duration * 1000; paint(seek, a.currentTime / a.duration * 100); } tt.textContent = fmtT(a.currentTime); dd.textContent = fmtT(a.duration); };
    a.addEventListener('timeupdate', tick); tick(); paint(vol, vol.value);
    seek.oninput = () => { if (a.duration) a.currentTime = seek.value / 1000 * a.duration; paint(seek, seek.value / 10); };
    seek.onchange = () => jamPush({ position: a.currentTime, playing: !a.paused });
    vol.oninput = () => { a.volume = vol.value / 100; paint(vol, vol.value); localStorage.setItem('rp_vol', vol.value); };
    player.onchange = () => el.isConnected && go();
  } };
if (localStorage.getItem('rp_vol') != null) player.audio.volume = localStorage.getItem('rp_vol') / 100;

// ============ ARCHIVOS (carpetas, documentos, presentaciones, hojas) ============
const FKIND = { folder: ['📁', 'Carpeta'], doc: ['📄', 'Documento'], slides: ['📊', 'Presentación'], sheet: ['📗', 'Hoja de cálculo'] };
const THEMES = { Oscuro: '#111827,#fff', Claro: '#ffffff,#111', Azul: '#0b3d91,#fff', Atardecer: '#7b2ff7,#fff', Verde: '#0f5132,#fff' };
const cleanHTML = html => { const d = new DOMParser().parseFromString(html || '', 'text/html'); d.querySelectorAll('script,iframe,object,embed,link,style,form').forEach(n => n.remove());
  d.querySelectorAll('*').forEach(n => [...n.attributes].forEach(a => (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value)) && n.removeAttribute(a.name))); return d.body.innerHTML; };
// fórmulas de la hoja: =A1+B2*2 y =SUMA(A1:A5). Solo números y + - * / ( ) llegan a evaluarse.
export function calc(cells, raw, depth = 0) {
  if (typeof raw !== 'string' || raw[0] !== '=') return raw ?? '';
  if (depth > 30) return '#CICLO';
  const val = (c, r) => +calc(cells, cells[r - 1]?.[c.charCodeAt(0) - 65], depth + 1) || 0;
  const e = raw.slice(1).toUpperCase().replace(/(?:SUMA|SUM)\(([A-Z])(\d+):([A-Z])(\d+)\)/g, (_, c1, r1, c2, r2) => { let t = 0; for (let r = +r1; r <= +r2; r++) for (let c = c1.charCodeAt(0); c <= c2.charCodeAt(0); c++) t += val(String.fromCharCode(c), r); return `(${t})`; })
    .replace(/([A-Z])(\d+)/g, (_, c, r) => `(${val(c, +r)})`);
  if (!/^[\d+\-*/().\s]+$/.test(e)) return '#ERROR';
  try { const r = Function('"use strict";return (' + e + ')')(); return Number.isFinite(r) ? Math.round(r * 1e6) / 1e6 : '#ERROR'; } catch { return '#ERROR'; }
}
function fileEditor(el, f, back) {
  const win = el.closest('.win'); if (win) win.dataset.dirty = '1'; // que el refresco automático no borre lo que escribes
  let t, dirty = false; const c = f.content ||= {};
  const push = async () => { dirty = false; try { await db.update('files', f.id, { content: c, updated_at: new Date().toISOString() }); st().textContent = 'Guardado ✓'; } catch (e) { st().textContent = '⚠️ No se guardó'; toast('No se pudo guardar: ' + e.message, 'err'); } };
  const st = () => el.querySelector('[data-st]') || {}, save = () => { dirty = true; st().textContent = 'Guardando…'; clearTimeout(t); t = setTimeout(push, 700); };
  const head = extra => `<div class="fx-bar"><button class="btn sm ghost" data-act="volver">‹ Archivos</button><b class="fx-title">${FKIND[f.kind][0]} ${esc(f.name)}</b>${extra || ''}<span class="grow"></span><small class="muted" data-st>Guardado ✓</small></div>`;
  const acts = { volver: async () => { clearTimeout(t); if (dirty) await push(); if (win) delete win.dataset.dirty; back(); } };
  if (f.kind === 'doc') {
    const B = (cmd, label, v, title) => `<button type="button" data-c="${cmd}" data-v="${v || ''}" title="${title || label}">${label}</button>`;
    view(el, `<div class="fx">${head()}<div class="fx-tools">${B('bold', '<b>N</b>', '', 'Negrita')}${B('italic', '<i>K</i>', '', 'Cursiva')}${B('underline', '<u>S</u>', '', 'Subrayado')}${B('formatBlock', 'Título', 'h1')}${B('formatBlock', 'Subtítulo', 'h2')}${B('formatBlock', 'Texto', 'p')}
      ${B('insertUnorderedList', '• Lista')}${B('insertOrderedList', '1. Lista')}${B('justifyLeft', '⬅', '', 'Izquierda')}${B('justifyCenter', '↔', '', 'Centrar')}${B('justifyRight', '➡', '', 'Derecha')}
      <label title="Color del texto">🎨<input type="color" data-color></label><button type="button" data-act="bajar">⬇ Descargar .doc</button></div>
      <div class="fx-page" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Documento">${cleanHTML(c.html)}</div></div>`, { ...acts,
      bajar: () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['<html><meta charset="utf-8"><body>' + c.html + '</body></html>'], { type: 'application/msword' })); a.download = f.name + '.doc'; a.click(); } });
    const page = el.querySelector('.fx-page'); page.oninput = () => { c.html = cleanHTML(page.innerHTML); save(); };
    el.querySelectorAll('[data-c]').forEach(b => { b.onmousedown = e => e.preventDefault(); b.onclick = () => { page.focus(); document.execCommand(b.dataset.c, false, b.dataset.v || null); page.oninput(); }; });
    el.querySelector('[data-color]').oninput = e => { page.focus(); document.execCommand('foreColor', false, e.target.value); page.oninput(); };
  } else if (f.kind === 'slides') {
    c.slides ||= [{ t: f.name, b: '' }]; c.theme ||= 'Oscuro'; let i = 0;
    const sty = () => { const [bg, fg] = THEMES[c.theme].split(','); return `background:${bg};color:${fg}`; };
    const draw = () => { i = Math.min(i, c.slides.length - 1); const s = c.slides[i];
      view(el, `<div class="fx">${head(`<button class="btn sm" data-act="mas">＋ Diapositiva</button><button class="btn sm ghost" data-act="menos">🗑</button>
        <select data-theme aria-label="Tema">${Object.keys(THEMES).map(k => `<option ${k === c.theme ? 'selected' : ''}>${k}</option>`).join('')}</select><button class="btn sm ok" data-act="play">▶ Presentar</button>`)}
        <div class="sl"><div class="sl-list">${c.slides.map((x, k) => `<button class="${k === i ? 'on' : ''}" data-act="ir" data-k="${k}" style="${sty()}"><small>${k + 1}</small><b>${esc(x.t || 'Sin título')}</b></button>`).join('')}</div>
        <div class="sl-main" style="${sty()}"><input class="sl-t" value="${esc(s.t)}" placeholder="Título" aria-label="Título"><textarea class="sl-b" placeholder="Escribe aquí el contenido…" aria-label="Contenido">${esc(s.b)}</textarea></div></div></div>`, { ...acts,
        ir: d => { i = +d.k; draw(); }, mas: () => { c.slides.splice(++i, 0, { t: '', b: '' }); save(); draw(); },
        menos: () => { if (c.slides.length < 2) return toast('Debe quedar al menos una diapositiva', 'err'); c.slides.splice(i, 1); save(); draw(); },
        play: () => { let k = i; const o = document.createElement('div'); o.className = 'sl-show'; o.style.cssText = sty(); o.tabIndex = 0;
          const show = () => { if (k >= c.slides.length) return end(); o.innerHTML = `<h1>${esc(c.slides[k].t)}</h1><p>${esc(c.slides[k].b)}</p><small>${k + 1} / ${c.slides.length} · clic o → para avanzar · Esc para salir</small>`; };
          const end = () => { o.remove(); document.fullscreenElement && document.exitFullscreen(); };
          o.onclick = () => { k++; show(); }; o.onkeydown = e => { if (e.key === 'Escape') end(); else if (e.key === 'ArrowLeft') { k = Math.max(0, k - 1); show(); } else if (['ArrowRight', ' ', 'Enter'].includes(e.key)) { k++; show(); } };
          document.body.append(o); o.focus(); o.requestFullscreen?.().catch(() => {}); show(); } });
      el.querySelector('.sl-t').oninput = e => { s.t = e.target.value; el.querySelector('.sl-list .on b').textContent = s.t || 'Sin título'; save(); };
      el.querySelector('.sl-b').oninput = e => { s.b = e.target.value; save(); };
      el.querySelector('[data-theme]').onchange = e => { c.theme = e.target.value; save(); draw(); }; };
    draw();
  } else {
    const R = 30, C = 8; c.cells ||= []; for (let r = 0; r < R; r++) c.cells[r] ||= [];
    view(el, `<div class="fx">${head('<small class="muted">Fórmulas: =A1+B1 · =SUMA(A1:A10)</small>')}<div class="sh"><table><tr><th></th>${[...Array(C)].map((_, k) => `<th>${String.fromCharCode(65 + k)}</th>`).join('')}</tr>
      ${[...Array(R)].map((_, r) => `<tr><th>${r + 1}</th>${[...Array(C)].map((_, k) => `<td><input data-r="${r}" data-k="${k}" aria-label="${String.fromCharCode(65 + k)}${r + 1}"></td>`).join('')}</tr>`).join('')}</table></div></div>`, acts);
    const ins = [...el.querySelectorAll('.sh input')], paint = () => ins.forEach(x => { if (x !== document.activeElement) x.value = calc(c.cells, c.cells[x.dataset.r][x.dataset.k]); });
    ins.forEach(x => { x.onfocus = () => x.value = c.cells[x.dataset.r][x.dataset.k] ?? ''; x.onblur = paint;
      x.oninput = () => { c.cells[x.dataset.r][x.dataset.k] = x.value; save(); };
      x.onkeydown = e => { if (e.key === 'Enter') ins[ins.indexOf(x) + C]?.focus(); }; });
    paint();
  }
}
const archivos = { id: 'archivos', name: 'Archivos', icon: '📁', bg: '#1e90ff,#0a5fd1', show: () => true,
  async render(el) {
    const me = db.uid(), files = await db.list('files', { eq: { owner: me } }), again = () => archivos.render(el);
    const open = files.find(f => f.id === el.dataset.open && f.kind !== 'folder');
    if (open) return fileEditor(el, open, () => { el.dataset.open = ''; again(); });
    const dir = files.find(f => f.id === el.dataset.dir && f.kind === 'folder'), kids = id => files.filter(f => f.parent === id).flatMap(f => [f, ...kids(f.id)]);
    const here = files.filter(f => (f.parent || '') === (dir?.id || '')).sort((a, b) => (b.kind === 'folder') - (a.kind === 'folder') || a.name.localeCompare(b.name));
    const path = []; for (let d = dir; d; d = files.find(f => f.id === d.parent)) path.unshift(d);
    const get = d => files.find(f => f.id === d.id);
    view(el, `<div class="fx"><div class="fx-bar"><nav class="fx-path" aria-label="Ruta"><button class="link" data-act="go" data-id="">🖥 Mi equipo</button>${path.map(p => ` › <button class="link" data-act="go" data-id="${p.id}">${esc(p.name)}</button>`).join('')}</nav><span class="grow"></span>
      ${Object.entries(FKIND).map(([k, [ic, n]]) => `<button class="btn sm ${k === 'folder' ? '' : 'ghost'}" data-act="nuevo" data-k="${k}">${ic} ${k === 'folder' ? 'Nueva carpeta' : n}</button>`).join('')}</div>
      <div class="fx-grid">${here.map(f => `<div class="fx-it"><button class="fx-open" data-act="abrir" data-id="${f.id}"><span class="fx-ic">${FKIND[f.kind][0]}</span><span class="fx-n" title="${esc(f.name)}">${esc(f.name)}</span></button>
        <div class="fx-acts"><button data-act="ren" data-id="${f.id}" title="Renombrar" aria-label="Renombrar">✏️</button><button data-act="mover" data-id="${f.id}" title="Mover a otra carpeta" aria-label="Mover">📂</button><button data-act="borrar" data-id="${f.id}" title="Borrar" aria-label="Borrar">🗑</button></div></div>`).join('')
        || '<p class="empty">Esta carpeta está vacía. Crea una carpeta, un documento, una presentación o una hoja de cálculo con los botones de arriba.</p>'}</div></div>`, {
      go: d => { el.dataset.dir = d.id; again(); },
      abrir: d => { el.dataset[get(d).kind === 'folder' ? 'dir' : 'open'] = d.id; again(); },
      nuevo: d => modal('Nueva ' + FKIND[d.k][1].toLowerCase(), form('go', [{ k: 'name', label: 'Nombre', req: 1, def: FKIND[d.k][1] + ' sin título' }], {}, 'Crear'), {
        async go(v, _, close) { const f = await db.insert('files', { owner: me, parent: dir?.id || null, name: v.name.trim().slice(0, 80), kind: d.k, content: {} }); close(); if (d.k !== 'folder') el.dataset.open = f.id; again(); } }),
      ren: d => modal('Renombrar', form('go', [{ k: 'name', label: 'Nombre', req: 1 }], get(d), 'Guardar'), { async go(v, _, close) { await db.update('files', d.id, { name: v.name.trim().slice(0, 80) }); close(); again(); } }),
      mover: d => { const no = new Set([d.id, ...kids(d.id).map(f => f.id)]);
        modal('Mover «' + esc(get(d).name) + '»', form('go', [{ k: 'p', label: 'Carpeta destino', type: 'select', options: [['', '🖥 Mi equipo'], ...files.filter(f => f.kind === 'folder' && !no.has(f.id)).map(f => [f.id, '📁 ' + f.name])] }], { p: get(d).parent || '' }, 'Mover'), {
          async go(v, _, close) { await db.update('files', d.id, { parent: v.p || null }); close(); again(); } }); },
      borrar: async d => { const f = get(d), sub = kids(d.id); if (!await ask(`¿Borrar «${f.name}»${sub.length ? ` y los ${sub.length} archivos que tiene dentro` : ''}? No se puede deshacer.`)) return;
        for (const x of [...sub.reverse(), f]) await db.remove('files', x.id); toast('Borrado'); again(); },
    });
  } };

// ============ AJUSTES ============
const ajustes = { id: 'ajustes', name: 'Ajustes', icon: '⚙️', bg: '#8e8e93,#636366', show: () => true,
  async render(el) {
    let saved = {}; try { saved = JSON.parse(localStorage.getItem('rp_login') || '{}'); if (saved.u !== S.me.username) saved = {}; } catch {}
    const hist = await db.list('user_history', { eq: { user_id: S.me.id }, limit: 50 }).catch(() => []);
    view(el, `<div class="card row">${av(S.me.avatar_url)}<div><b>${esc(S.me.username)}</b><div class="muted">Roblox: ${esc(S.me.roblox)} · Discord: ${esc(S.me.discord)}</div>
      ${S.me.staff_role ? `<span class="tag on">${STAFF_NAME[S.me.staff_role]}</span>` : ''}</div></div>
      ${hist.length ? `<h3>Tu historial</h3><ul class="list">${hist.map(h => `<li><span class="grow">${h.kind === 'vida' ? '🧍 Vida rechazada' : '📄 Trámite rechazado'}: <b>${esc(TRAMITES[h.title.split(' · ')[0]]?.name ? TRAMITES[h.title.split(' · ')[0]].name + (h.title.includes(' · ') ? ' · ' + h.title.split(' · ')[1] : '') : h.title)}</b>
        <div class="muted">${h.note ? 'Motivo: ' + esc(h.note) + ' · ' : ''}${fdate(h.created_at)}</div></span></li>`).join('')}</ul>` : ''}
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
    const T = [['aprob', 'Aprobaciones'], ['users', 'Usuarios'], ['act', 'Actividad'], ['sanc', 'Sanciones'], ['tickets', 'Soporte'], ...(L >= 3 ? [['eco', 'Economía'], ['icons', 'Íconos']] : []), ...(L >= 5 ? [['discord', 'Discord'], ['cfg', 'Configuración']] : [])];
    const acts = { tab: d => go(d.t) };
    let body = '';

    if (tab === 'aprob') {
      const pendP = profiles.filter(p => !p.verified), pendC = S.all.filter(c => c.status === 'pending');
      const visas = L >= 3 ? await db.list('requests', { eq: { type: 'visa', status: 'approved' } }) : [];
      const migr = S.all.filter(c => c.status === 'active' && c.extranjero && !c.roles.includes('Migrante') && !visas.some(v => v.character_id === c.id)
        && (Date.now() - new Date(c.created_at)) / GAME_DAY_MS > set('visa_days'));
      body = `${L >= 3 ? `<h3>Cuentas por verificar (${pendP.length})</h3>${pendP.map(p => `<div class="card row">${av(p.avatar_url)}<div class="grow"><b>${esc(p.username)}</b>
          <div class="muted">Roblox: <b>${esc(p.roblox)}</b> · Discord: <b>${esc(p.discord)}</b> · ${fdate(p.created_at)}</div></div>
          <button class="btn sm ok" data-act="verif" data-id="${p.id}">Verificar</button><button class="btn sm bad" data-act="banP" data-id="${p.id}">Banear</button></div>`).join('') || '<p class="muted">Nada.</p>'}
        <h3>Vidas por aprobar (${pendC.length})</h3>${pendC.map(c => `<div class="card row">${av(c.skin_url, 'big-av')}<div class="grow"><b>${esc(c.first_name)} ${esc(c.last_name)}</b>
          <div class="muted">Usuario: ${esc(profiles.find(p => p.id === c.user_id)?.username)} · Roblox ${esc(profiles.find(p => p.id === c.user_id)?.roblox)} · Discord ${esc(profiles.find(p => p.id === c.user_id)?.discord)}</div>
          <div>Nac. ${esc(c.dob)} · ${esc(c.sex)} · ${esc(c.city)} · ${esc(c.nationality)} ${c.extranjero ? '<span class="tag on">🧳 Extranjero</span>' : ''}</div><p>${esc(c.bio)}</p></div>
          <div class="col"><button class="btn sm ok" data-act="aprobC" data-id="${c.id}">Aprobar</button><button class="btn sm bad" data-act="rechC" data-id="${c.id}">Rechazar</button></div></div>`).join('') || '<p class="muted">Nada.</p>'}
        ${migr.length ? `<h3>🚨 Extranjeros sin visa (plazo de ${set('visa_days')} días del juego vencido)</h3>${migr.map(c => `<div class="card row"><b class="grow">${esc(c.first_name)} ${esc(c.last_name)}</b>
          <button class="btn sm bad" data-act="migr" data-id="${c.id}">Marcar migrante</button></div>`).join('')}` : ''}` : ''}<div class="q"></div>`;
      Object.assign(acts, {
        verif: async d => { await db.update('profiles', d.id, { verified: true }); toast('Cuenta verificada'); go('aprob'); },
        banP: async d => { await db.update('profiles', d.id, { banned: true }); go('aprob'); },
        aprobC: d => { const c = S.all.find(x => x.id === d.id);
          modal(`Aprobar a ${esc(c.first_name)}`, `<form data-form="ok" class="form">${rolesPicker(c.extranjero ? ['Extranjero'] : ['Ciudadano'])}
            ${fieldsHTML([{ k: 'money', label: 'Dinero inicial (sale de la Tesorería, ya ajustado a la inflación)', type: 'number', min: 0, def: Math.round(set('start_money') * cpi()) }])}<button class="btn ok" type="submit">Aprobar vida</button></form>`, {
            async ok(_, f, close) {
              const roles = [...f.querySelectorAll('[name=role]:checked')].map(i => i.value), m = Number(f.money.value || 0);
              await db.update('characters', c.id, { status: 'active', roles });
              const acc = await db.insert('accounts', { kind: 'personal', name: c.first_name + ' ' + c.last_name, owners: [c.id] });
              if (m > 0) await db.rpc('staff_pay', { acc: acc.id, amount: Math.round(m * 100) / 100, concept: 'Dinero inicial (de la Tesorería)' });
              close(); toast(`Aprobada. El bot le pone en Discord: ${roles.join(', ')}${c.extranjero ? ' · Recuérdale sacar su visa en ' + set('visa_days') + ' días del juego' : ''}`); if (c.user_id === S.me.id) return window.refreshShell?.('staff'); // es mi vida: activarla al instante
              S.all = await db.list('characters', { order: 'first_name', asc: true }); go('aprob');
            } }); },
        rechC: d => modal('Rechazar vida', form('r', [{ k: 'note', label: 'Motivo (lo verá la persona en su historial)', type: 'textarea' }], {}, 'Rechazar y borrar'), {
          async r(f, _, close) { await db.rpc('reject_character', { c: d.id, note: f.note }); close(); toast('Vida rechazada: se borró y quedó en el historial de la persona');
            S.all = await db.list('characters', { order: 'first_name', asc: true }); go('aprob'); } }),
        migr: async d => { await addRole(d.id, 'Migrante'); toast('Marcado como Migrante. El bot le pone el rol en Discord.'); S.all = await db.list('characters', { order: 'first_name', asc: true }); go('aprob'); },
      });
    }

    if (tab === 'users') {
      const rolesOf = p => S.all.filter(c => c.user_id === p.id && c.status === 'active').flatMap(c => c.roles || []);
      body = `<div class="row gap"><input class="filter grow" placeholder="Buscar por usuario, Roblox, Discord o rol (ej. Policía)…" data-filter>
        <select data-rolefilter aria-label="Filtrar por rol"><option value="">Todos los roles</option><optgroup label="Staff">${STAFF.map(([, l]) => `<option>${esc(l)}</option>`).join('')}</optgroup>
          ${Object.entries(ROLES).map(([g, rs]) => `<optgroup label="${esc(g)}">${rs.map(r => `<option>${esc(r)}</option>`).join('')}</optgroup>`).join('')}</select></div>
        <p class="muted">${L >= 3 ? 'Para dar un rol (Policía, EMS, Juez…) toca «Roles / estado» en la vida de la persona.' : 'Solo los Admin o más pueden cambiar roles.'}</p>
        ${profiles.map(p => `<div class="card urow" data-s="${esc([p.username, p.roblox, p.discord, STAFF_NAME[p.staff_role] || '', ...rolesOf(p)].join(' ').toLowerCase())}">
        <div class="row">${av(p.avatar_url, 'av sm')}<b class="grow">${esc(p.username)} ${p.staff_role ? `<span class="tag on">${esc(STAFF_NAME[p.staff_role])}</span>` : ''}</b><span class="muted">${esc(p.roblox)} · ${esc(p.discord)}</span>
        ${p.verified ? '' : '<span class="tag">Sin verificar</span>'}${p.banned ? '<span class="tag bad">Baneado</span>' : ''}</div>
        ${L >= 3 ? `<div class="row gap"><select data-role="${p.id}">${[['', 'Sin rango'], ...STAFF.filter(([, , n]) => n < L || L === 5).map(([k, l]) => [k, l])].map(([k, l]) => `<option value="${k}" ${p.staff_role === k || (!p.staff_role && !k) ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <button class="btn sm" data-act="setRole" data-id="${p.id}">Guardar rango</button><button class="btn sm ${p.banned ? 'ok' : 'bad'}" data-act="tban" data-id="${p.id}" data-b="${p.banned ? '' : '1'}">${p.banned ? 'Desbanear' : 'Banear'}</button>${L >= 5 && p.id !== S.me.id ? `<button class="btn sm bad" data-act="delU" data-id="${p.id}">Eliminar cuenta</button>` : ''}</div>` : ''}
        ${S.all.filter(c => c.user_id === p.id).map(c => `<div class="row sub">${av(c.skin_url, 'av sm')}<span class="grow">${esc(c.first_name)} ${esc(c.last_name)} ${badge(c.status)} ${(c.roles || []).map(r => `<span class="tag">${esc(r)}</span>`).join('')}</span>
          ${L >= 3 ? `<button class="btn sm" data-act="editC" data-id="${c.id}">Roles / estado</button>` : ''}</div>`).join('')}</div>`).join('')}`;
      Object.assign(acts, {
        setRole: async d => { await db.update('profiles', d.id, { staff_role: el.querySelector(`[data-role="${d.id}"]`).value || null }); toast('Rango actualizado. El bot lo pone en Discord al momento.'); go('users'); },
        tban: async d => { await db.update('profiles', d.id, { banned: !!d.b }); go('users'); },
        delU: async d => { const p = profiles.find(x => x.id === d.id);
          if (prompt(`Esto ELIMINA para siempre la cuenta "${p.username}" con todas sus vidas, dinero, casas, autos, trámites y antecedentes. No se puede deshacer. Escribe ELIMINAR para confirmar.`) !== 'ELIMINAR') return;
          try { await db.rpc('delete_user', { u: d.id }); } catch (e) { return toast(e.message); }
          S.all = await db.list('characters', { order: 'first_name', asc: true }); toast('Cuenta eliminada'); go('users'); window.liveRefresh?.(); },
        editC: d => { const c = S.all.find(x => x.id === d.id);
          modal(`Editar vida · ${esc(c.first_name)} ${esc(c.last_name)}`, `<form data-form="save" class="form">${fieldsHTML([
            { k: 'first_name', label: 'Nombre(s)', req: 1 }, { k: 'last_name', label: 'Apellido(s)', req: 1 }, { k: 'dob', label: 'Nacimiento', type: 'date', req: 1 },
            { k: 'sex', label: 'Sexo', type: 'select', options: ['Masculino', 'Femenino'], req: 1 }, { k: 'city', label: 'Ciudad', type: 'select', options: CITIES, req: 1 },
            { k: 'nationality', label: 'Nacionalidad', type: 'select', options: [...new Set([...NATIONS, c.nationality].filter(Boolean))], req: 1 }, { k: 'status', label: 'Estado', type: 'select', options: Object.entries(ST).filter(([k]) => ['pending', 'active', 'dead', 'rejected'].includes(k)), req: 1 },
            { k: 'skin_url', label: 'Cambiar foto', type: 'file' }, { k: 'bio', label: 'Historia', type: 'textarea' }], c)}
            <h4>Roles</h4>${rolesPicker(c.roles)}<div class="row"><button type="button" class="btn bad" data-act="del">Borrar vida</button><span class="grow"></span><button class="btn" type="submit">Guardar</button></div></form>`, {
            async save(v, f, close) {
              const { role, ...rest } = v; if (!rest.skin_url) delete rest.skin_url;
              await db.update('characters', c.id, { ...rest, extranjero: rest.nationality !== 'Estadounidense', roles: [...f.querySelectorAll('[name=role]:checked')].map(i => i.value) });
              close(); S.all = await db.list('characters', { order: 'first_name', asc: true }); toast('Guardado. El bot actualiza sus roles en Discord al momento.'); go('users'); },
            async del(_, __, close) {
              if (!await ask(`Esto borra para siempre la vida "${c.first_name} ${c.last_name}" con sus trámites, empleos y antecedentes. ¿Continuar?`)) return;
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
      body = `<div class="whobox"><input class="filter" placeholder="Buscar persona por usuario, Roblox, Discord o nombre de su vida (ej. angel)…" data-who autocomplete="off"><div class="who-list" hidden></div></div>
        ${L >= 2 ? form('add', [{ k: 'kind', label: 'Tipo', type: 'select', options: Object.entries(K), req: 1 }, { k: 'username', label: 'Usuario de la web' },
        { k: 'roblox', label: 'Roblox' }, { k: 'discord', label: 'Discord' }, { k: 'reason', label: 'Motivo / pruebas', type: 'textarea', req: 1 }, { k: 'until', label: 'Hasta (vacío = permanente)', type: 'date' }], {}, 'Registrar sanción') : ''}
        <table class="tbl"><thead><tr><th>Tipo</th><th>Usuario</th><th>Roblox</th><th>Discord</th><th>Motivo</th><th>Hasta</th><th>Por</th><th></th></tr></thead><tbody>
        ${bans.map(b => `<tr class="brow" data-s="${esc([b.username, b.roblox, b.discord].join(' ').toLowerCase())}"><td>${K[b.kind] || esc(b.kind)}</td><td>${esc(b.username)}</td><td>${esc(b.roblox)}</td><td>${esc(b.discord)}</td><td>${esc(b.reason)}</td><td>${esc(b.until || 'Perm.')}</td>
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
        <div><small>Tasa Reserva Federal</small><b>${set('fed_rate')}%</b></div><div><small>Turno mínimo por día del juego</small><b>${set('job_min_minutes')} min reales</b></div></div>
        <p class="muted">Los sueldos se pagan solos cada día desde la Tesorería (pago diario = sueldo anual ÷ 365 × inflación) a quien cumplió su turno mínimo el día anterior o está de vacaciones. Quien pasa 7 días sin cumplir es despedido.</p>
        <div class="row"><button class="btn" data-act="tick">Correr cierre del día ahora</button>${L >= 4 ? '<button class="btn bad" data-act="printm">Emitir dinero</button>' : ''}</div>
        <h3>Sueldos por rango (anuales, USD)</h3><form data-form="ranks" class="form">${depts.map(d => `<details><summary><b>${esc(d)}</b> · ${rankList(d).length} rangos</summary><table class="tbl"><tr><th>Rango</th><th>Sueldo anual</th><th>Mando</th></tr>
          ${rankList(d).map(r => `<tr><td>${esc(r.rank)}</td><td><input type="number" min="0" name="${esc(d)}|${esc(r.rank)}" value="${r.salary}"></td><td>${r.manage ? 'Sí' : ''}</td></tr>`).join('')}</table></details>`).join('') || '<p class="muted">Carga los datos base en Configuración.</p>'}
          <button class="btn" type="submit">Guardar sueldos</button></form>
        <h3>Dar / quitar dinero</h3>${form('give', [{ k: 'char', label: 'Personaje', type: 'select', options: charOpts(), req: 1 }, { k: 'amount', label: 'Monto (negativo = quitar)', type: 'number', req: 1 }, { k: 'concept', label: 'Concepto', req: 1 }], {}, 'Aplicar')}
        <h3>Pago por robo aprobado (rango aleatorio)</h3><form data-form="robos" class="form"><table class="tbl"><tr><th>Robo</th><th>Mínimo</th><th>Máximo</th></tr>
          ${Object.entries(robos).map(([k, [a, b]]) => `<tr><td>${esc(k)}</td><td><input type="number" min="0" name="${esc(k)}.0" value="${a}"></td><td><input type="number" min="0" name="${esc(k)}.1" value="${b}"></td></tr>`).join('')}</table>
          <button class="btn" type="submit">Guardar rangos</button></form>
        <h3>Sueldo del staff (al año; se paga ÷365 cada día que cumplan ${set('staff_min_minutes')} min en servicio)</h3><form data-form="staffpay" class="form"><table class="tbl">
          ${STAFF.map(([k, l]) => `<tr><td>${esc(l)}</td><td><input type="number" min="0" name="${k}" value="${set('staff_salary')[k] ?? 0}"></td><td class="muted">${money((set('staff_salary')[k] ?? 0) / 365)} al día</td></tr>`).join('')}</table>
          <button class="btn" type="submit">Guardar sueldos del staff</button></form>
        <h3>Impuestos (%)</h3>${form('imp', [{ k: 'sales', label: 'Sales Tax de LA (autos)', type: 'number', min: 0, def: set('impuestos').sales }, { k: 'transfer', label: 'Transferencia de casas entre personas', type: 'number', min: 0, def: set('impuestos').transfer },
          { k: 'property', label: 'Predial anual', type: 'number', min: 0, def: set('impuestos').property }, { k: 'corp', label: 'Corporativo (empresas)', type: 'number', min: 0, def: set('impuestos').corp }], {}, 'Guardar impuestos')}
        <p class="muted small">La retención de nómina usa las tablas reales 2026 del IRS y de California (más FICA 7.65%).</p>
        <h3>Ingresos diarios de negocios (los paga el Tesoro según el giro)</h3><form data-form="biz" class="form"><table class="tbl"><tr><th>Giro</th><th>USD por día</th></tr>
          ${Object.entries(set('biz_income') || {}).map(([k, v]) => `<tr><td>${esc(k)}</td><td><input type="number" min="0" name="${esc(k)}" value="${v}"></td></tr>`).join('')}</table>
          <label class="fld"><span>Pago a influencers por cada like (USD, sube con sus seguidores hasta ×5)</span><input type="number" min="0" name="__like" value="${set('influencer_like_pay') ?? 15}"></label>
          <label class="fld"><span>Regalías de Spotify por cada reproducción (USD)</span><input type="number" min="0" step="0.5" name="__play" value="${set('spotify_play_pay') ?? 2}"></label>
          <button class="btn" type="submit">Guardar</button></form>
        <h3>Otros</h3>${form('otros', [{ k: 'start_money', label: 'Dinero inicial de cada vida', type: 'number', min: 0, req: 1 }, { k: 'visa_days', label: 'Días del juego (2 h reales c/u) para que un extranjero registre visa', type: 'number', min: 1, req: 1 },
          { k: 'job_min_minutes', label: 'Minutos mínimos de turno al día', type: 'number', min: 1, req: 1 }, { k: 'fed_rate', label: 'Tasa de la Reserva Federal (%)', type: 'number', min: 0, max: 25, req: 1 },
          { k: 'prison_min_per_year', label: 'Minutos reales por cada año de prisión', type: 'number', min: 1, req: 1 }, { k: 'trial_years', label: 'Más de cuántos años de prisión va a juicio', type: 'number', min: 1, req: 1 }],
          { start_money: set('start_money'), visa_days: set('visa_days'), job_min_minutes: set('job_min_minutes'), fed_rate: set('fed_rate'), prison_min_per_year: set('prison_min_per_year'), trial_years: set('trial_years') }, 'Guardar')}`;
      const save = async (key, value) => { await db.upsert('settings', { key, value }); S.settings[key] = value; };
      Object.assign(acts, {
        async tick() { toast('Cierre del día: ' + await db.rpc('daily_tick', {})); go('eco'); },
        async printm() { const a = Number(prompt('¿Cuánto dinero emitir? (genera inflación)', '1000000000')); if (!(a > 0)) return; S.settings.cpi = await db.rpc('print_money', { amount: a }); go('eco'); },
        async ranks(d) { for (const [k, v] of Object.entries(d)) { const [dept, rank] = k.split('|'), r = S.ranks.find(x => x.dept === dept && x.rank === rank);
            if (r && Number(v) !== Number(r.salary)) { await db.upsert('dept_ranks', { ...r, salary: Number(v) }, 'dept,rank'); r.salary = Number(v); } } toast('Sueldos guardados'); go('eco'); },
        async give(d) { const acc = (await db.list('accounts', { eq: { kind: 'personal' }, contains: { owners: [d.char] } }))[0];
          if (!acc) throw new Error('Ese personaje no tiene cuenta'); await db.rpc('staff_pay', { acc: acc.id, amount: d.amount, concept: d.concept }); toast('Listo'); },
        imp: async d => { for (const k in d) d[k] = Number(d[k]); await save('impuestos', d); toast('Impuestos guardados'); go('eco'); },
        staffpay: async d => { for (const k in d) d[k] = Number(d[k]); await save('staff_salary', d); toast('Sueldos guardados'); go('eco'); },
        biz: async d => { const { __like, __play, ...o } = d; for (const k in o) o[k] = Number(o[k]); await save('biz_income', o); await save('influencer_like_pay', Number(__like)); await save('spotify_play_pay', Number(__play)); toast('Guardado'); go('eco'); },
        robos: async d => { const o = {}; for (const [k, v] of Object.entries(d)) { const i = k.lastIndexOf('.'); (o[k.slice(0, i)] ??= [0, 0])[+k.slice(i + 1)] = v || 0; } await save('robos', o); toast('Guardado'); go('eco'); },
        otros: async d => { for (const k of ['start_money', 'visa_days', 'job_min_minutes', 'prison_min_per_year', 'trial_years']) await save(k, d[k]); await db.rpc('set_fed_rate', { rate: d.fed_rate }); S.settings.fed_rate = d.fed_rate; toast('Guardado'); go('eco'); },
      });
    }

    if (tab === 'discord') {
      const exp = set('role_expiry_months') || {}, last = S.settings.discord_last_sync;
      body = `<div class="card"><b>Bot de Discord</b><p class="muted">Cada 15 minutos el bot copia a Discord los roles de la web: pone los que tienen y quita los que ya no. Solo toca los roles que maneja la web (Policía, Admin, Verificado…), nunca otros.</p>
        <p>Última sincronización: <b>${last ? fdate(last) + ' ' + new Date(last).toLocaleTimeString('es-MX') : 'todavía no corre'}</b></p>
        <button class="btn" data-act="botkey">Generar llave del bot</button> <small class="muted">La llave se muestra una sola vez; si generas otra, la anterior deja de servir.</small></div>
        <h3>Roles con vencimiento</h3><p class="muted">Cuando a alguien se le da uno de estos roles, se le quita solo al pasar el tiempo (en la web y en Discord). 0 = no vence.</p>
        <form data-form="exp" class="form"><table class="tbl">${Object.values(ROLES).flat().map(r => `<tr><td>${esc(r)}</td><td><select name="${esc(r)}">${[0, 1, 3, 6, 12].map(m => `<option value="${m}" ${(exp[r] || 0) == m ? 'selected' : ''}>${m ? m + (m === 1 ? ' mes' : ' meses') : 'No vence'}</option>`).join('')}</select></td></tr>`).join('')}</table>
        <button class="btn" type="submit">Guardar vencimientos</button></form>`;
      Object.assign(acts, {
        botkey: async () => { if (!await ask('¿Generar una llave nueva? La anterior dejará de funcionar.')) return; const k = await db.rpc('new_bot_key', {});
          modal('Llave del bot', `<p>Cópiala y pégala en Netlify (Site configuration → Environment variables) como <b>SYNC_KEY</b>. No la compartas.</p><input class="mono" readonly value="${esc(k)}" onclick="this.select()"><button class="btn" data-act="cp">Copiar</button>`, { cp: async () => { await navigator.clipboard?.writeText(k); toast('Copiada'); } }); },
        exp: async d => { const o = {}; for (const k in d) if (+d[k] > 0) o[k] = +d[k]; await db.upsert('settings', { key: 'role_expiry_months', value: o }); S.settings.role_expiry_months = o; toast('Vencimientos guardados'); go('discord'); },
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
        <h3>Código penal</h3><form data-form="penal" class="form"><table class="tbl"><tr><th>Código</th><th>Delito</th><th>Tipo</th><th>Multa base</th><th>Meses de prisión</th><th>Quita licencia</th></tr>
        ${(await db.list('penal_code', { order: 'code', asc: true })).sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true })).map(x => `<tr><td>${esc(x.code)}</td><td><input name="${esc(x.code)}|title" value="${esc(x.title)}"></td><td>${esc(x.kind)}</td>
          <td><input type="number" min="0" name="${esc(x.code)}|fine" value="${x.fine}"></td><td><input type="number" min="0" step="1" name="${esc(x.code)}|months" value="${Math.round(x.years * 12)}"></td><td><input type="checkbox" name="${esc(x.code)}|lic" ${x.lic ? 'checked' : ''}></td></tr>`).join('')}</table>
        <button class="btn" type="submit">Guardar código penal</button></form>
        <h4>Agregar artículo</h4>${form('penalNew', [{ k: 'code', label: 'Código', req: 1, ph: 'G-31' }, { k: 'title', label: 'Delito', req: 1 },
          { k: 'kind', label: 'Tipo', type: 'select', options: [['advertencia', 'Advertencia'], ['infraccion', 'Infracción'], ['menor', 'Delito menor'], ['grave', 'Delito grave']], req: 1 },
          { k: 'fine', label: 'Multa', type: 'number', min: 0, def: 0 }, { k: 'months', label: 'Meses de prisión (1 mes = 5 min reales)', type: 'number', min: 0, def: 0 }, { k: 'lic', label: 'Quita licencia', type: 'check', text: 'permite retirar la licencia de conducir' }], {}, 'Agregar')}`;
      Object.assign(acts, {
        async penal(d) { const rows = {}; for (const [k, v] of Object.entries(d)) { const [code, f] = k.split('|'); const r = rows[code] ??= { code, lic: false };
            if (f === 'title') r.title = v; else if (f === 'lic') r.lic = v; else if (f === 'months') r.years = Number(v) / 12; else r[f] = Number(v); }
          for (const r of Object.values(rows)) await db.upsert('penal_code', r, 'code'); toast('Código penal guardado'); go('cfg'); },
        async penalNew({ months, ...d }) { await db.upsert('penal_code', { ...d, years: Number(months || 0) / 12 }, 'code'); toast('Artículo agregado'); go('cfg'); },
      });
      acts.seed = async () => { await seed(); toast('Datos base cargados ✅'); };
    }

    view(el, `${tabs(T, tab)}<div class="tabbody">${body}</div>`, acts);
    const fil = () => { const q = (el.querySelector('[data-filter]')?.value || '').toLowerCase(), r = (el.querySelector('[data-rolefilter]')?.value || '').toLowerCase();
      el.querySelectorAll('.urow').forEach(x => x.hidden = !x.dataset.s.includes(q) || (r && !x.dataset.s.includes(r))); };
    el.querySelector('[data-filter]')?.addEventListener('input', fil); el.querySelector('[data-rolefilter]')?.addEventListener('change', fil);
    // sanciones: buscador con sugerencias mientras escribes (usuario, Roblox, Discord o nombre de la vida)
    const who = el.querySelector('[data-who]'), wl = el.querySelector('.who-list');
    who?.addEventListener('input', () => {
      const q = who.value.trim().toLowerCase();
      el.querySelectorAll('.brow').forEach(r => r.hidden = !!q && !r.dataset.s.includes(q));
      const hits = !q ? [] : profiles.filter(p => [p.username, p.roblox, p.discord, ...S.all.filter(c => c.user_id === p.id).map(c => c.first_name + ' ' + c.last_name)].join(' ').toLowerCase().includes(q)).slice(0, 8);
      wl.hidden = !hits.length;
      wl.innerHTML = hits.map(p => `<button type="button" data-u="${p.id}">${av(p.avatar_url, 'av sm')}<span><b>${esc(p.username)}</b><small class="muted">Roblox: ${esc(p.roblox)} · Discord: ${esc(p.discord)}${S.all.some(c => c.user_id === p.id) ? ' · ' + esc(S.all.filter(c => c.user_id === p.id).map(c => c.first_name + ' ' + c.last_name).join(', ')) : ''}</small></span></button>`).join('');
    });
    wl?.addEventListener('click', e => { const b = e.target.closest('[data-u]'); if (!b) return; const p = profiles.find(x => x.id === b.dataset.u), f = el.querySelector('form[data-form=add]');
      if (f) { f.username.value = p.username; f.roblox.value = p.roblox || ''; f.discord.value = p.discord || ''; f.reason.focus(); }
      who.value = p.username; wl.hidden = true; who.dispatchEvent(new Event('input')); wl.hidden = true; });
    if (tab === 'aprob') reviewQueue(el.querySelector('.q'), { title: 'Trámites para staff' });
  } };
const rolesPicker = cur => `<div class="roles">${Object.entries(ROLES).map(([g, rs]) => `<fieldset><legend>${g}</legend>${rs.map(r => `<label class="chk"><input type="checkbox" name="role" value="${esc(r)}" ${cur.includes(r) || r === 'Ciudadano' ? 'checked' : ''} ${r === 'Ciudadano' ? 'disabled title="Toda vida es ciudadana"' : ''}> ${esc(r)}</label>`).join('')}</fieldset>`).join('')}</div>`;

export async function seed() {
  const all = ps => Promise.all(ps); // en paralelo: el primer arranque pasa de ~1 min a pocos segundos
  await all(Object.entries(TRAMITES).map(([type, t]) => db.upsert('tramite_depts', { type, dept: t.dept }, 'type')));
  await all(Object.entries(DEFAULT_SETTINGS).filter(([key]) => S.settings[key] === undefined).map(([key, value]) => db.upsert('settings', { key, value })));
  const models = await db.list('vehicle_models', { order: null, limit: 1000 }), used = new Set((await db.list('vehicles', { limit: 5000 })).map(v => v.model_id));
  const key = (b, m) => (b + '|' + m).toLowerCase(), want = new Set(SEED_MODELS.map(([b, m]) => key(b, m)));
  for (const m of models) if (!want.has(key(m.brand, m.model)) && !used.has(m.id) && !m.custom) await db.remove('vehicle_models', m.id); // quita los de ejemplo viejos
  const have = new Set(models.map(m => key(m.brand, m.model)));
  await all(SEED_MODELS.map(([brand, model, category, price, img]) => {
    const cur = models.find(m => key(m.brand, m.model) === key(brand, model));
    if (!cur) return db.insert('vehicle_models', { brand, model, category, price, img: img || null });
    if (img && !cur.custom && cur.img !== img) return db.update('vehicle_models', cur.id, { img }); // foto real del juego
  }));
  const props = await db.list('properties', { order: null, limit: 1000 });
  const OLD = ['Casa Springfield #1', 'Casa Springfield #2', 'Casa River City #1', 'Casa River City #2', 'Mansión Hills', 'Departamento Centro']; // casas de ejemplo de versiones anteriores
  for (const p of props) if (OLD.includes(p.name) && !p.owner_char && !p.owner_company) await db.remove('properties', p.id);
  for (const [name, zone, price, img] of SEED_PROPS) { const p = props.find(x => x.name === name); p ? p.img !== img && await db.update('properties', p.id, { img }) : await db.insert('properties', { name, zone, price, img, kind: 'casa' }); }
  await all(Object.entries(DEPTS).flatMap(([dept, list]) => list.map(([rank, salary, manage], i) =>
    !S.ranks.some(r => r.dept === dept && r.rank === rank) && db.upsert('dept_ranks', { dept, rank, ord: i, salary, manage: !!manage }, 'dept,rank'))));
  const jobs = await db.list('jobs', { limit: 1000 });
  for (const [title, employer, role_tag] of SEED_JOBS) if (!jobs.some(j => j.role_tag === role_tag)) await db.insert('jobs', { title, employer, role_tag, description: 'Trabajo de gobierno con sueldo diario. Al ser aceptado entras con el rango más bajo; tus mandos te pueden ascender.' });
  const pc = await db.list('penal_code', { order: null, limit: 1000 });
  await all(PENAL_CODE.filter(([code]) => !pc.some(x => x.code === code)).map(([code, title, kind, fine, years, lic, notes]) => db.upsert('penal_code', { code, title, kind, fine, years, lic, notes: notes || null }, 'code')));
  if (!(await db.list('companies', { eq: { industry: 'ETF' } })).length) await db.insert('companies', { name: 'LA500 ETF', industry: 'ETF', owners: [], description: 'Fondo que sigue el promedio de todas las empresas de Los Ángeles.' });
  const g = (await db.list('accounts', { eq: { kind: 'gov' } }))[0];
  if (g && Number(g.balance) === 0) await db.rpc('staff_pay', { acc: g.id, amount: 13950000000, concept: 'Presupuesto inicial FY 2025-26', mint: true }).catch(() => {}); // solo funciona si la economía está vacía
}

export const APPS = [vida, banco, gobierno, safari, docs, documentos, licencias, archivos, spotify, trabajo, mensajes,
  social('x', 'X', '𝕏', '#000000,#1c1c1c'), social('insta', 'Instagram', '📸', '#833ab4,#fd1d1d,#fcb045'),
  news, buscar, empleos, bolsa, casas, autos, toolstore, casino, bitso, fec, corte, e911, sebusca, policia, expedientes, prision, taxi, soporte, resenas, robstore, staffApp, ajustes];
