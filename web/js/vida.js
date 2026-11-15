// Registro de una vida nueva (second role) como trámite del Registro Civil. Es lo primero que hace un usuario nuevo.
import * as db from './db.js';
import { S, esc, fieldsHTML, view, set, toast } from './core.js';
import { CITIES, NATIONS } from './data.js';
import { birthCert } from './docs.js';

const seal = `<svg viewBox="0 0 40 40" class="gov-seal" aria-hidden="true"><circle cx="20" cy="20" r="18.5" fill="#fff" stroke="#c9a227" stroke-width="2"/><circle cx="20" cy="20" r="14" fill="#1d3b6e"/>
  <path d="M20 10l2.6 6.4h6.8l-5.5 4.1 2.1 6.6L20 23l-6 4.1 2.1-6.6-5.5-4.1h6.8z" fill="#c9a227"/></svg>`;
const choice = (name, opts) => `<div class="choices">${opts.map(([v, sub]) => `<label class="choice"><input type="radio" name="${name}" value="${esc(v)}" required>
  <span><b>${esc(v)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></label>`).join('')}</div>`;

const STEPS = [
  { t: 'Datos del registrado', s: 'Nombre completo como aparecerá en todos tus documentos.',
    html: () => fieldsHTML([{ k: 'first_name', label: 'Nombre(s)', req: 1 }, { k: 'last_name', label: 'Apellido(s)', req: 1 }]) },
  { t: 'Nacimiento', s: 'Fecha de nacimiento y sexo del registrado.',
    html: () => fieldsHTML([{ k: 'dob', label: 'Fecha de nacimiento', type: 'date', req: 1, max: new Date().toISOString().slice(0, 10) }]) + '<span class="fld-l">Sexo</span>' + choice('sex', [['Masculino'], ['Femenino']]) },
  { t: 'Residencia y nacionalidad', s: 'Dónde vivirás dentro de Los Ángeles.',
    html: () => '<span class="fld-l">Ciudad de residencia</span>' + choice('city', CITIES.map(c => [c])) + fieldsHTML([{ k: 'nationality', label: 'Nacionalidad', type: 'select', options: NATIONS, req: 1, def: 'Estadounidense' }])
      + `<p class="muted">Si eliges cualquier país que no sea Estados Unidos quedas registrado como <b>extranjero</b>: recibes el pasaporte de tu país y tendrás ${set('visa_days')} días para tramitar tu visa.</p>` },
  { t: 'Fotografía', s: 'Captura de tu personaje completo en Roblox. Se usará en tus documentos.',
    html: () => fieldsHTML([{ k: 'skin_url', label: 'Foto del personaje', type: 'file', req: 1 }]) },
  { t: 'Antecedentes del personaje', s: 'Quién es, de dónde viene y a qué se dedica.',
    html: () => fieldsHTML([{ k: 'bio', label: 'Historia', type: 'textarea', req: 1, ph: 'Llegué a Los Ángeles buscando…' }]) },
];

export function lifeWizard(host, { onDone, onCancel } = {}) {
  const d = {};
  let i = 0, rejected = [];
  // vidas rechazadas recientemente: se borraron, pero la persona ve el motivo aquí y en Ajustes → Tu historial
  db.list('user_history', { eq: { user_id: S.me?.id, kind: 'vida' }, limit: 3 }).then(r => { rejected = r.filter(h => Date.now() - new Date(h.created_at) < 7 * 864e5); if (rejected.length && i === 0) draw(); }).catch(() => {});
  const page = body => `<div class="wiz"><div class="portal reg">
    <div class="gov-top">Registro Civil de Los Ángeles · Roleplay</div>
    <header class="gov-bar">${seal}<div><b>County of Los Angeles</b><span>Registro Civil · Solicitud de registro de nacimiento</span></div>
      ${onCancel ? '<button class="link" data-act="cancel">Cancelar</button>' : ''}</header>
    <ol class="steps">${[...STEPS.map(s => s.t), 'Revisión'].map((t, k) => `<li class="${k < i ? 'done' : k === i ? 'on' : ''}"><span>${k < i ? '✓' : k + 1}</span>${t}</li>`).join('')}</ol>
    <main class="gov-main">${body}</main></div></div>`;
  const draw = () => {
    if (i === STEPS.length) return view(host, page(`<h1>Revisa tu solicitud</h1><p class="lead">Confirma que la información es correcta antes de enviarla.</p>
      <div class="summary">${d.skin_url ? `<img src="${esc(d.skin_url)}" alt="">` : ''}<dl class="rcpt">
        <dt>Nombre</dt><dd>${esc(d.first_name)} ${esc(d.last_name)}</dd><dt>Nacimiento</dt><dd>${esc(d.dob)}</dd><dt>Sexo</dt><dd>${esc(d.sex)}</dd>
        <dt>Residencia</dt><dd>${esc(d.city)}</dd><dt>Nacionalidad</dt><dd>${esc(d.nationality)}${d.extranjero === 'Sí' ? ' (extranjero)' : ''}</dd></dl></div>
      <label class="chk"><input type="checkbox" id="decl"> Declaro que la información es verídica dentro del roleplay.</label>
      <div class="gov-actions"><button class="btn ghost" data-act="back">Atrás</button><button class="btn big" data-act="enviar">Enviar solicitud</button></div>`), acts);
    const st = STEPS[i];
    view(host, page(`${i === 0 && rejected.length ? `<div class="notice bad-n"><b>Tu solicitud anterior fue rechazada.</b>${rejected.map(h => `<div>🧍 ${esc(h.title)}${h.note ? ` — motivo: ${esc(h.note)}` : ''}</div>`).join('')}<small>Puedes registrar una vida nueva corrigiendo lo que te indicaron.</small></div>` : ''}
      <small class="step">Paso ${i + 1} de ${STEPS.length + 1}</small><h1>${st.t}</h1><p class="lead">${st.s}</p>
      <form data-form="next" class="form">${st.html()}<div class="gov-actions">${i ? '<button type="button" class="btn ghost" data-act="back">Atrás</button>' : ''}
      <button class="btn big" type="submit">Continuar</button></div></form>`), acts);
    host.querySelector('.gov-main input:not([type=radio]), .gov-main textarea')?.focus();
  };
  const acts = {
    next(v) { Object.assign(d, v); if (v.nationality) d.extranjero = v.nationality === 'Estadounidense' ? 'No' : 'Sí'; i++; draw(); },
    back() { i--; draw(); },
    cancel: () => onCancel?.(),
    async enviar(_, btn) {
      if (!host.querySelector('#decl').checked) throw new Error('Marca la declaración para continuar');
      btn.disabled = true; btn.textContent = 'Procesando registro…';
      const c = await db.insert('characters', { ...d, extranjero: d.extranjero === 'Sí', user_id: S.me.id, roles: ['Ciudadano'], status: 'pending' });
      view(host, page(`<h1>Registro enviado</h1><p class="lead">Folio <b>${c.id.slice(0, 8).toUpperCase()}</b>. Un admin revisará tu vida; al aprobarla podrás usarla en toda la ciudad.</p>
        <div class="doc">${birthCert({ ...c, ...d, extranjero: d.extranjero === 'Sí' })}</div>
        <div class="gov-actions"><button class="btn big" data-act="ok">Continuar</button></div>`), { ok: () => onDone?.(c) });
      toast('Tu vida fue enviada a aprobación');
    },
  };
  draw();
}

export function openWizardOverlay() {
  const o = Object.assign(document.createElement('div'), { className: 'wiz-overlay' });
  document.body.append(o);
  lifeWizard(o, { onDone: () => window.refreshShell ? (o.remove(), window.refreshShell('vida')) : location.reload(), onCancel: () => o.remove() });
}
