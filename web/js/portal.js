// Cada trámite se abre en su propia ventana como una página del portal del gobierno de Los Ángeles
import * as db from './db.js';
import { S, esc, toast, view, fieldsHTML, resolveFields, approvedOf, fdate } from './core.js';
import { TRAMITES, CK_RULES } from './data.js';
import { ti } from './icons.js';

const sealMini = `<svg viewBox="0 0 40 40" class="gov-seal" aria-hidden="true"><circle cx="20" cy="20" r="18.5" fill="#fff" stroke="#c9a227" stroke-width="2"/><circle cx="20" cy="20" r="14" fill="#1d3b6e"/>
  <path d="M20 10l2.6 6.4h6.8l-5.5 4.1 2.1 6.6L20 23l-6 4.1 2.1-6.6-5.5-4.1h6.8z" fill="#c9a227"/></svg>`;
const who = d => d.map(x => x.startsWith('staff:') ? 'Staff (' + x.slice(6) + ' o más)' : x.startsWith('char:') ? 'El empleador' : x).join(', ');

export async function openTramite(type, extra = {}, after) {
  const t = TRAMITES[type], ch = extra.charId ? S.chars.find(c => c.id === extra.charId) : S.char;
  if (!ch) return toast('Primero necesitas una vida activa (Mi Vida)', 'err');
  window.openWindow({
    key: 'tram-' + type + ch.id, title: t.name, iconHTML: ti(type), bg: '#1d3b6e,#2f5aa8', url: `servicios.lacity.rp/${t.cat.toLowerCase()}/${type.replace(/_/g, '-')}`,
    async render(el) {
      const reqs = await db.list('requests', { eq: { character_id: ch.id } });
      const miss = (t.needs || []).filter(n => !approvedOf(reqs, n).length), pend = type !== 'taxi' && reqs.find(r => r.type === type && r.status === 'pending');
      const fields = await resolveFields(t.fields);
      const page = body => `<div class="portal"><div class="gov-top">Sitio oficial de la Ciudad de Los Ángeles · Roleplay</div>
        <header class="gov-bar">${sealMini}<div><b>City of Los Angeles</b><span>Servicios en línea</span></div><nav><span>Trámites</span><span>Pagos</span><span>Ayuda</span></nav></header>
        <div class="crumbs">Inicio › Trámites › ${esc(t.cat)} › <b>${esc(t.name)}</b></div>${body}
        <footer class="gov-f">${sealMini}<span>City of Los Angeles · Portal de roleplay de Los Ángeles RP. Los documentos emitidos solo son válidos dentro del juego.</span></footer></div>`;
      const side = `<aside class="gov-side"><h3>Requisitos</h3><ul>${(t.needs || []).map(n => `<li class="${miss.includes(n) ? 'no' : 'ok'}">${miss.includes(n) ? '✕' : '✓'} ${esc(TRAMITES[n].name)}</li>`).join('') || '<li class="ok">✓ Ninguno</li>'}
        <li class="ok">✓ Vida aprobada</li></ul><h3>Lo revisa</h3><p>${esc(who(extra.dept || t.dept))}</p><h3>Tiempo estimado</h3><p>24 a 48 horas</p><h3>Costo</h3><p>Sin costo</p></aside>`;
      if (miss.length || pend) return view(el, page(`<main class="gov-main"><div class="gov-head"><span class="gov-ico">${ti(type)}</span><div><h1>${esc(t.name)}</h1><p class="lead">${esc(t.desc || '')}</p></div></div>
        <div class="gov-grid"><div class="notice">${pend ? `<b>Ya tienes una solicitud en revisión.</b><br>Folio ${pend.id.slice(0, 8).toUpperCase()} · enviada el ${fdate(pend.created_at)}` : `<b>No cumples los requisitos.</b><br>Primero tramita: ${miss.map(n => esc(TRAMITES[n].name)).join(', ')}.`}</div>${side}</div></main>`));
      view(el, page(`<main class="gov-main"><div class="gov-head"><span class="gov-ico">${ti(type)}</span><div><h1>${esc(t.name)}</h1><p class="lead">${esc(t.desc || 'Llena el formulario. Un servidor público revisará tu solicitud.')}</p></div></div>
        ${t.rules ? `<details class="ck-rules" open><summary>Reglas de CK (léelas antes de enviar)</summary><ol>${CK_RULES.map(([h, b]) => `<li><b>${esc(h)}.</b> ${esc(b)}</li>`).join('')}</ol></details>` : ''}
        <div class="gov-grid"><form class="gov-form" data-form="send">
          <section><h2>1. Datos del solicitante</h2><div class="ro"><div><small>Nombre</small><b>${esc(ch.first_name)} ${esc(ch.last_name)}</b></div>
            <div><small>Fecha de nacimiento</small><b>${esc(ch.dob)}</b></div><div><small>Residencia</small><b>${esc(ch.city)}</b></div><div><small>Nacionalidad</small><b>${esc(ch.nationality)}</b></div></div></section>
          <section><h2>2. Información del trámite</h2>${fieldsHTML(fields, extra.values)}</section>
          <section><h2>3. Declaración</h2><label class="chk"><input type="checkbox" required> Declaro bajo protesta de decir verdad que la información es correcta. Mentir es un delito federal.</label></section>
          <div class="gov-actions"><button class="btn big" type="submit">Enviar solicitud</button></div></form>${side}</div></main>`), {
        async send(data) {
          const r = await db.insert('requests', { type, dept: extra.dept || t.dept, character_id: ch.id, data: { ...extra.data, ...data } });
          view(el, page(`<main class="gov-main"><div class="done"><div class="check">✓</div><h1>Solicitud recibida</h1>
            <p class="lead">Tu trámite <b>${esc(t.name)}</b> fue enviado y está en revisión.</p>
            <dl><dt>Folio</dt><dd>${r.id.slice(0, 8).toUpperCase()}</dd><dt>Solicitante</dt><dd>${esc(ch.first_name)} ${esc(ch.last_name)}</dd><dt>Fecha</dt><dd>${fdate(r.created_at)}</dd><dt>Estado</dt><dd>En revisión</dd></dl>
            <p class="muted">Puedes seguir el estado en Gobierno LA → Mis solicitudes.</p></div></main>`));
          after?.();
        },
      });
    },
  });
}
