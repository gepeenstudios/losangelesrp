// Documentos oficiales del roleplay: acta de nacimiento, credencial/licencia, pasaporte y diplomas.
// Llevan la marca "ROLEPLAY · SIN VALIDEZ OFICIAL" a propósito: son del juego.
import { esc } from './core.js';

const RP = 'DOCUMENTO DE ROLEPLAY · SIN VALIDEZ OFICIAL · LOS ÁNGELES RP · ';
const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const pad = (n, l) => String(n).padStart(l, '0');
const fdate = d => d ? new Date(d + (String(d).length === 10 ? 'T12:00:00' : '')).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '';
const up = s => esc(String(s || '').toUpperCase());

// fondo de seguridad (guilloché) hecho con elipses rotadas
// comillas simples y %27: va dentro de style="..." (con comillas dobles se cortaba el atributo)
export const guilloche = (color, w = 260, h = 130, n = 22) => `url('data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>${Array.from({ length: n }, (_, i) =>
    `<ellipse cx='${w / 2}' cy='${h / 2}' rx='${w / 2 - i * 2.5}' ry='${h / 6 + i * 1.6}' fill='none' stroke='${color}' stroke-width='.45' transform='rotate(${i * 8.2} ${w / 2} ${h / 2})'/>`).join('')}</svg>`).replace(/'/g, '%27')}')`;

const seal = (top, bottom, color = '#1d3b6e') => `<svg class="seal" viewBox="0 0 120 120" aria-hidden="true"><defs><path id="sc" d="M60 60m-46 0a46 46 0 1 1 92 0a46 46 0 1 1-92 0"/></defs>
  <circle cx="60" cy="60" r="57" fill="none" stroke="${color}" stroke-width="2"/><circle cx="60" cy="60" r="52" fill="none" stroke="${color}" stroke-width=".8"/>
  <circle cx="60" cy="60" r="34" fill="none" stroke="${color}" stroke-width="1"/>
  <text fill="${color}" font-size="8.4" font-family="Georgia,serif" letter-spacing="1.2"><textPath href="#sc">${top} ★ ${bottom} ★</textPath></text>
  <path d="M60 36l6 15h16l-13 10 5 16-14-10-14 10 5-16-13-10h16z" fill="none" stroke="${color}" stroke-width="1.4"/>
  <text x="60" y="88" text-anchor="middle" fill="${color}" font-size="6" font-family="Georgia,serif">EST. 1850</text></svg>`;

const barcode = (seed, w = 220, h = 34) => { let x = 0, s = hash(seed), r = ''; while (x < w) { s = (Math.imul(s, 1103515245) + 12345) >>> 0; const bw = 1 + (s % 3); if ((s >> 4) % 2) r += `<rect x="${x}" width="${bw}" height="${h}"/>`; x += bw; } return `<svg class="barcode" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${r}</svg>`; };
const micro = () => `<div class="micro">${RP.repeat(6)}</div>`;
export const docNumber = (c, p = 'D') => p + pad(hash(c.id) % 1e7, 7);

// ---------- Acta de nacimiento ----------
export function birthCert(c) {
  const file = `${new Date(c.created_at || Date.now()).getFullYear()}19${pad(hash(c.id) % 1e6, 6)}`;
  const issued = new Date(c.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const f = (n, l, v, span = 1) => `<div class="bf" style="grid-column:span ${span}"><small>${n} ${l}</small><b>${v || '&nbsp;'}</b></div>`;
  const [first, ...mid] = String(c.first_name || '').split(' ');
  return `<div class="birthcert" style="background-image:${guilloche('#8fb3a0', 300, 150)}">
    <div class="bc-head">${seal('COUNTY OF LOS ANGELES', 'REGISTRAR-RECORDER')}<div><small>STATE OF CALIFORNIA</small><h2>CERTIFICATION OF VITAL RECORD</h2>
      <small>COUNTY OF LOS ANGELES · REGISTRAR-RECORDER/COUNTY CLERK</small></div><div class="bc-no"><small>STATE FILE NUMBER</small><b>${file}</b></div></div>
    <h3>CERTIFICATE OF LIVE BIRTH <span>· ACTA DE NACIMIENTO</span></h3>
    <div class="bc-grid">
      ${f('1A.', 'NAME OF CHILD — FIRST', up(first), 2)}${f('1B.', 'MIDDLE', up(mid.join(' ')))}${f('1C.', 'LAST', up(c.last_name), 2)}
      ${f('2.', 'SEX', up(c.sex))}${f('3A.', 'THIS BIRTH — SINGLE', 'SINGLE')}${f('4A.', 'DATE OF BIRTH', fdate(c.dob), 2)}${f('4B.', 'HOUR', pad(hash(c.id) % 24, 2) + pad(hash(c.id + 'm') % 60, 2))}
      ${f('5A.', 'PLACE OF BIRTH — CITY', c.extranjero ? up(c.nationality) : up(String(c.city || '').split('·').pop().trim()), 2)}${f('5B.', 'COUNTY', c.extranjero ? 'FOREIGN' : 'LOS ANGELES')}${f('6.', 'NATIONALITY', up(c.nationality), 2)}
      ${f('7.', 'RESIDENCE', up(c.city), 3)}${f('8.', 'LOCAL REGISTRATION NO.', pad(hash(c.id + 'r') % 1e5, 5), 2)}
    </div>
    <div class="bc-foot">${seal('STATE OF CALIFORNIA', 'DEPT. OF PUBLIC HEALTH', '#7a1f1f')}
      <p>Copia certificada del registro de nacimiento inscrito en el Registro Civil de Los Ángeles RP. Documento válido únicamente dentro del roleplay.</p>
      <div class="sig"><span class="signature">M. A. Hartwell</span><small>REGISTRADOR CIVIL · LOS ÁNGELES RP</small><small>DATE ISSUED ${up(issued)}</small></div></div>
    ${barcode(c.id, 300, 26)}${micro()}</div>`;
}

// ---------- Credencial / licencia (formato tarjeta) ----------
export function idCard(c, dni, lic) {
  const dl = !!lic, n = docNumber(c, dl ? 'D' : 'I'), born = new Date(c.dob + 'T12:00:00');
  const exp = new Date(born); exp.setFullYear(new Date().getFullYear() + 5);
  const cls = lic?.data?.clase?.split(' ')[0] || '';
  return `<div class="idc ${dl ? 'drv' : ''}" style="background-image:${guilloche(dl ? '#c9a85f' : '#7fa6c9', 220, 110, 26)}">
    <div class="idc-h"><b>California</b><span>${dl ? 'DRIVER LICENSE' : 'IDENTIFICATION CARD'}</span><i class="usa">USA</i></div>
    <div class="idc-b"><div class="idc-photo"><img src="${esc(dni.data.foto || c.skin_url)}" alt=""><span class="signature">${esc(c.first_name)} ${esc(c.last_name)}</span></div>
      <div class="idc-f"><div class="r"><small>${dl ? 'DL' : 'ID'}</small><b class="red">${n}</b></div><div class="r"><small>EXP</small><b class="red">${fdate(exp.toISOString().slice(0, 10))}</b></div>
        <div class="r"><small>LN</small><b>${up(c.last_name)}</b></div><div class="r"><small>FN</small><b>${up(c.first_name)}</b></div>
        <div class="addr">${up(dni.data.direccion)}<br>${up(String(c.city || '').split('·').pop().trim())}, CA ${90000 + hash(c.id) % 1000}</div>
        <div class="r"><small>DOB</small><b class="red">${fdate(c.dob)}</b>${dl ? `<small>CLASS</small><b>${esc(cls)}</b>` : ''}</div>
        <div class="r4"><span><small>SEX</small>${up(c.sex?.[0])}</span><span><small>HGT</small>${esc(dni.data.altura)}</span><span><small>EYES</small>${up(String(dni.data.ojos).slice(0, 3))}</span><span><small>HAIR</small>${up(String(dni.data.cabello).slice(0, 3))}</span></div>
        <div class="r"><small>ISS</small><b>${fdate((lic || dni).reviewed_at?.slice(0, 10) || dni.created_at?.slice(0, 10))}</b>${dni.data.donador ? '<span class="donor">♥ DONOR</span>' : ''}</div></div>
      <img class="ghost" src="${esc(dni.data.foto || c.skin_url)}" alt=""></div>
    <div class="idc-micro">${RP.repeat(3)}</div></div>`;
}

// ---------- Pasaporte (página de datos) ----------
// pasaporte de cada país: [nombre oficial, palabra «pasaporte», color, código ISO, bandera, autoridad, idioma de las etiquetas]
const SRE = 'SECRETARÍA DE RELACIONES EXTERIORES', MRE = 'MINISTERIO DE RELACIONES EXTERIORES';
const PASS = { 'México': ['ESTADOS UNIDOS MEXICANOS', 'PASAPORTE', '#0b5d3b', 'MEX', '🇲🇽', SRE, 'es'], 'Colombia': ['REPÚBLICA DE COLOMBIA', 'PASAPORTE', '#7a1f2b', 'COL', '🇨🇴', MRE, 'es'],
  'Guatemala': ['REPÚBLICA DE GUATEMALA', 'PASAPORTE', '#1f3f7a', 'GTM', '🇬🇹', 'INSTITUTO GUATEMALTECO DE MIGRACIÓN', 'es'], 'El Salvador': ['REPÚBLICA DE EL SALVADOR', 'PASAPORTE', '#1b3a6b', 'SLV', '🇸🇻', 'DIRECCIÓN GENERAL DE MIGRACIÓN', 'es'],
  'Honduras': ['REPÚBLICA DE HONDURAS', 'PASAPORTE', '#17365f', 'HND', '🇭🇳', 'INSTITUTO NACIONAL DE MIGRACIÓN', 'es'], 'Venezuela': ['REPÚBLICA BOLIVARIANA DE VENEZUELA', 'PASAPORTE', '#6b1d2a', 'VEN', '🇻🇪', 'SAIME', 'es'],
  'Argentina': ['REPÚBLICA ARGENTINA', 'PASAPORTE', '#16406e', 'ARG', '🇦🇷', 'REGISTRO NACIONAL DE LAS PERSONAS', 'es'], 'Perú': ['REPÚBLICA DEL PERÚ', 'PASAPORTE', '#7d1c24', 'PER', '🇵🇪', 'SUPERINTENDENCIA NACIONAL DE MIGRACIONES', 'es'],
  'Chile': ['REPÚBLICA DE CHILE', 'PASAPORTE', '#101d3a', 'CHL', '🇨🇱', 'SERVICIO DE REGISTRO CIVIL E IDENTIFICACIÓN', 'es'], 'Cuba': ['REPÚBLICA DE CUBA', 'PASAPORTE', '#1a2f66', 'CUB', '🇨🇺', 'MINISTERIO DEL INTERIOR', 'es'],
  'España': ['REINO DE ESPAÑA', 'PASAPORTE', '#6e1423', 'ESP', '🇪🇸', 'DIRECCIÓN GENERAL DE LA POLICÍA', 'es'], 'Canadá': ['CANADA', 'PASSPORT · PASSEPORT', '#16264d', 'CAN', '🇨🇦', 'IMMIGRATION, REFUGEES AND CITIZENSHIP CANADA'],
  'Brasil': ['REPÚBLICA FEDERATIVA DO BRASIL', 'PASSAPORTE', '#12305c', 'BRA', '🇧🇷', 'POLÍCIA FEDERAL'], 'República Dominicana': ['REPÚBLICA DOMINICANA', 'PASAPORTE', '#12305c', 'DOM', '🇩🇴', 'DIRECCIÓN GENERAL DE PASAPORTES', 'es'],
  'Ecuador': ['REPÚBLICA DEL ECUADOR', 'PASAPORTE', '#6b1a26', 'ECU', '🇪🇨', MRE, 'es'], 'Nicaragua': ['REPÚBLICA DE NICARAGUA', 'PASAPORTE', '#173b73', 'NIC', '🇳🇮', 'DIRECCIÓN GENERAL DE MIGRACIÓN', 'es'],
  'Costa Rica': ['REPÚBLICA DE COSTA RICA', 'PASAPORTE', '#123a6b', 'CRI', '🇨🇷', 'DIRECCIÓN GENERAL DE MIGRACIÓN', 'es'], 'Panamá': ['REPÚBLICA DE PANAMÁ', 'PASAPORTE', '#14305e', 'PAN', '🇵🇦', 'AUTORIDAD DE PASAPORTES', 'es'],
  'Uruguay': ['REPÚBLICA ORIENTAL DEL URUGUAY', 'PASAPORTE', '#16386b', 'URY', '🇺🇾', 'DIRECCIÓN NACIONAL DE IDENTIFICACIÓN CIVIL', 'es'], 'Paraguay': ['REPÚBLICA DEL PARAGUAY', 'PASAPORTE', '#152f5c', 'PRY', '🇵🇾', 'POLICÍA NACIONAL', 'es'],
  'Bolivia': ['ESTADO PLURINACIONAL DE BOLIVIA', 'PASAPORTE', '#1d4a2f', 'BOL', '🇧🇴', 'DIRECCIÓN GENERAL DE MIGRACIÓN', 'es'], 'Reino Unido': ['UNITED KINGDOM OF GREAT BRITAIN AND NORTHERN IRELAND', 'PASSPORT', '#14213d', 'GBR', '🇬🇧', 'HM PASSPORT OFFICE'],
  'Francia': ['RÉPUBLIQUE FRANÇAISE', 'PASSEPORT', '#5e1626', 'FRA', '🇫🇷', 'PRÉFECTURE'], 'Alemania': ['BUNDESREPUBLIK DEUTSCHLAND', 'REISEPASS', '#5c1a26', 'DEU', '🇩🇪', 'BUNDESDRUCKEREI'],
  'Italia': ['REPUBBLICA ITALIANA', 'PASSAPORTO', '#5e1a2a', 'ITA', '🇮🇹', 'MINISTERO DEGLI AFFARI ESTERI'], 'Japón': ['日本国 · JAPAN', '旅券 · PASSPORT', '#7a1220', 'JPN', '🇯🇵', 'MINISTRY OF FOREIGN AFFAIRS'],
  'China': ['中华人民共和国 · PEOPLE’S REPUBLIC OF CHINA', '护照 · PASSPORT', '#6d1020', 'CHN', '🇨🇳', 'NATIONAL IMMIGRATION ADMINISTRATION'], 'Corea del Sur': ['대한민국 · REPUBLIC OF KOREA', '여권 · PASSPORT', '#143a5e', 'KOR', '🇰🇷', 'MINISTRY OF FOREIGN AFFAIRS'],
  'Rusia': ['РОССИЙСКАЯ ФЕДЕРАЦИЯ · RUSSIAN FEDERATION', 'ПАСПОРТ · PASSPORT', '#6b1420', 'RUS', '🇷🇺', 'MINISTRY OF INTERNAL AFFAIRS'] };
export function passport(c, req, foreign) {
  const st = foreign ? PASS[req.data.pais] || [up(req.data.pais), 'PASSPORT · PASAPORTE', '#3a2d5c', '', '🌐', up(req.data.pais)] : null, es = st?.[6] === 'es';
  const L = (en, sp) => es ? `${sp} / ${en}` : sp ? `${en} / ${sp}` : en;
  const code = st?.[3] ? st[3] : foreign ? String(req.data.pais || 'XXX').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'X') : 'USA';
  const no = foreign ? String(req.data.pasaporte_ext).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 9) : pad(hash(c.id + 'p') % 1e9, 9);
  const iss = new Date(req.reviewed_at || req.created_at), exp = new Date(iss); exp.setFullYear(iss.getFullYear() + 10);
  const d6 = d => d.toISOString().slice(2, 10).replace(/-/g, '');
  const name = (String(c.last_name) + '<<' + String(c.first_name).replace(/ /g, '<')).toUpperCase().normalize('NFD').replace(/[^A-Z<]/g, '');
  const mrz1 = ('P<' + code + name).padEnd(44, '<').slice(0, 44);
  const mrz2 = (no.padEnd(9, '<') + (hash(no) % 10) + code + d6(new Date(c.dob + 'T12:00:00')) + (hash(c.dob) % 10) + (c.sex === 'Femenino' ? 'F' : 'M') + d6(exp) + (hash(+exp) % 10)).padEnd(44, '<').slice(0, 44);
  const f = (l, v) => `<div><small>${l}</small><b>${v}</b></div>`;
  return `<div class="pass ${st ? 'ext' : ''}" style="${st ? `--pc:${st[2]};` : ''}background-image:${guilloche(st ? st[2] + '55' : '#9db5d8', 260, 130, 24)}">
    ${st ? `<div class="pass-h"><span class="pass-flag" aria-hidden="true">${st[4]}</span><b>${esc(st[0])}</b><span>${esc(st[1])}</span></div>` : `<div class="pass-h"><b>UNITED STATES OF AMERICA</b><span>PASSPORT · PASSEPORT · PASAPORTE</span></div>`}
    <div class="pass-b"><img class="pass-photo" src="${esc(req.data.foto || c.skin_url)}" alt="">
      <div class="pass-f">${f(L('Type', 'Tipo'), 'P')}${f(L('Code', 'Código'), code)}${f(L('Passport No.', 'No. de pasaporte'), no)}
        <div class="w">${f(L('Surname', 'Apellidos'), up(c.last_name))}</div><div class="w">${f(L('Given Names', 'Nombres'), up(c.first_name))}</div>
        <div class="w">${f(L('Nationality', 'Nacionalidad'), up(c.nationality))}</div>${f(L('Date of birth', es && 'Fecha de nacimiento'), fdate(c.dob))}${f(L('Sex', 'Sexo'), up(c.sex?.[0]))}
        ${f(L('Place of birth', es && 'Lugar de nacimiento'), foreign ? up(req.data.pais) : 'CALIFORNIA, U.S.A.')}${f(L('Date of issue', es && 'Fecha de expedición'), fdate(iss.toISOString().slice(0, 10)))}${f(L('Date of expiration', es && 'Fecha de caducidad'), fdate(exp.toISOString().slice(0, 10)))}
        ${f(L('Authority', es && 'Autoridad'), st ? esc(st[5]) : 'UNITED STATES DEPARTMENT OF STATE')}</div></div>
    <div class="mrz">${esc(mrz1)}<br>${esc(mrz2)}</div><div class="idc-micro">${RP.repeat(3)}</div></div>`;
}

// Visa estadounidense (hoja que se pega en el pasaporte extranjero) o Green Card, según el tipo aprobado
export function visa(c, req) {
  const t = String(req.data.tipo || ''), green = /Green Card/.test(t), cls = green ? 'C2' : (t.match(/^([A-Z])-?(\w+)/) || [, 'B', '2']).slice(1).join('');
  const iss = new Date(req.reviewed_at || req.created_at), exp = new Date(iss); exp.setFullYear(iss.getFullYear() + ({ B2: 10, F1: 5, H1B: 3, E2: 5 }[cls] || 10));
  const day = d => d.toISOString().slice(0, 10), d6 = d => day(d).slice(2).replace(/-/g, ''), ctrl = '2026' + pad(hash(req.id || c.id + 'v') % 1e10, 10);
  const nat = String(homeCountry(c)).normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
  const pno = String(req.data.pasaporte_ext || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 9);
  const name = (String(c.last_name) + '<<' + String(c.first_name).replace(/ /g, '<')).toUpperCase().normalize('NFD').replace(/[^A-Z<]/g, '');
  const f = (l, v, w) => `<div class="${w ? 'w' : ''}"><small>${l}</small><b>${v}</b></div>`, foto = esc(req.data.foto || c.skin_url);
  if (green) return `<div class="gcard" style="background-image:${guilloche('#7fb59a', 240, 120, 22)}">
    <div class="gcard-h"><b>UNITED STATES OF AMERICA</b><span>PERMANENT RESIDENT</span></div>
    <div class="pass-b"><img class="pass-photo" src="${foto}" alt=""><div class="pass-f">
      <div class="w">${f('Surname', up(c.last_name))}</div><div class="w">${f('Given Name', up(c.first_name))}</div>
      ${f('USCIS#', pad(hash(c.id + 'uscis') % 1e9, 9))}${f('Category', 'IR1')}${f('Country of Birth', up(homeCountry(c)))}
      ${f('Date of Birth', fdate(c.dob))}${f('Sex', up(c.sex?.[0]))}${f('Card Expires', fdate(day(exp)))}${f('Resident Since', fdate(day(iss)), 1)}</div></div>
    <div class="mrz">${esc(('C1USA' + pad(hash(c.id + 'gc') % 1e9, 9)).padEnd(30, '<'))}<br>${esc((d6(new Date(c.dob + 'T12:00:00')) + '0' + (c.sex === 'Femenino' ? 'F' : 'M') + d6(exp) + '0' + nat).padEnd(30, '<'))}<br>${esc(name.padEnd(30, '<').slice(0, 30))}</div>
    <div class="idc-micro">${RP.repeat(3)}</div></div>`;
  return `<div class="usvisa" style="background-image:${guilloche('#c9a0a8', 260, 130, 26)}">
    <div class="usvisa-h"><b>UNITED STATES OF AMERICA</b><span class="usvisa-v">VISA</span></div>
    <div class="pass-b"><img class="pass-photo" src="${foto}" alt=""><div class="pass-f">
      <div class="w">${f('Issuing Post Name', 'LOS ANGELES')}</div>${f('Control Number', ctrl, 1)}
      <div class="w">${f('Surname', up(c.last_name))}</div><div class="w">${f('Given Name', up(c.first_name))}</div>
      ${f('Visa Type/Class', 'R ' + esc(cls))}${f('Entries', 'M')}${f('Passport Number', esc(pno))}
      ${f('Sex', up(c.sex?.[0]))}${f('Birth Date', fdate(c.dob))}${f('Nationality', nat)}
      ${f('Issue Date', fdate(day(iss)))}${f('Expiration Date', fdate(day(exp)))}${f('Annotation', esc(t.split('·')[1]?.trim().toUpperCase() || ''))}</div></div>
    <div class="mrz">${esc(('V<USA' + name).padEnd(44, '<').slice(0, 44))}<br>${esc((pno.padEnd(9, '<') + (hash(pno) % 10) + nat + d6(new Date(c.dob + 'T12:00:00')) + (hash(c.dob) % 10) + (c.sex === 'Femenino' ? 'F' : 'M') + d6(exp) + (hash(+exp) % 10) + cls).padEnd(44, '<').slice(0, 44))}</div>
    <div class="idc-micro">${RP.repeat(3)}</div></div>`;
}

// Tarjeta de registro vehicular (DMV de California) de un auto. Vence 1 año después de registrarse con su dueño actual.
export function vehicleReg(c, v, m) {
  const reg = new Date(v.registered_at || v.created_at), exp = new Date(reg); exp.setFullYear(reg.getFullYear() + 1);
  const day = d => d.toISOString().slice(0, 10), vin = esc(v.vin || ('PENDIENTE' + String(hash(v.id)).padStart(8, '0')).slice(0, 17)), vencida = exp < new Date();
  const f = (l, val, cls = '') => `<div class="${cls}"><small>${l}</small><b>${val}</b></div>`;
  return `<div class="vreg" style="background-image:${guilloche('#9fc3d9', 240, 120, 22)}">
    <div class="vreg-h"><div><b>STATE OF CALIFORNIA</b><span>DEPARTMENT OF MOTOR VEHICLES</span></div><em>REGISTRATION CARD</em></div>
    <div class="vreg-g">
      ${f('LICENSE NUMBER', v.plate ? esc(v.plate.toUpperCase()) : '<i>SIN PLACA</i>', 'big')}${f('VEHICLE ID NUMBER (VIN)', vin, 'w')}
      ${f('MAKE', up(m?.brand))}${f('MODEL', up(m?.model))}${f('BODY TYPE', up(m?.category || 'AUTO'))}
      ${f('REGISTERED OWNER', up(c.first_name + ' ' + c.last_name), 'w')}${f('ADDRESS', up(c.city || 'LOS ANGELES, CA'), 'w')}
      ${f('ISSUED', fdate(day(reg)))}${f('EXPIRES', fdate(day(exp)) + (vencida ? ' <span class="neg">VENCIDO</span>' : ''))}${f('CLASS', 'AUTO')}
    </div>
    ${v.plate ? '' : '<p class="vreg-n">Placa pendiente: tramita tu placa en la comisaría (Registro de placa).</p>'}
    <div class="idc-micro">${RP.repeat(3)}</div></div>`;
}

// Pasaporte del país de origen: todo extranjero lo trae al llegar (lo necesita para su visa)
const COUNTRY = { mexican: 'México', colombian: 'Colombia', guatemalte: 'Guatemala', salvadoreñ: 'El Salvador', hondureñ: 'Honduras', venezolan: 'Venezuela',
  argentin: 'Argentina', peruan: 'Perú', chilen: 'Chile', cuban: 'Cuba', español: 'España', canadiense: 'Canadá', brasileñ: 'Brasil', dominican: 'República Dominicana',
  ecuatorian: 'Ecuador', nicaragüense: 'Nicaragua', costarricense: 'Costa Rica', panameñ: 'Panamá', uruguay: 'Uruguay', paraguay: 'Paraguay', bolivian: 'Bolivia',
  ingl: 'Reino Unido', británic: 'Reino Unido', frances: 'Francia', alemán: 'Alemania', aleman: 'Alemania', italian: 'Italia', japon: 'Japón', chin: 'China', corean: 'Corea del Sur', rus: 'Rusia' };
export const homeCountry = c => { const n = String(c.nationality || '').toLowerCase().trim(); return Object.entries(COUNTRY).find(([k]) => n.startsWith(k))?.[1] || (c.nationality || 'País de origen'); };
export const homePassportNo = c => String(homeCountry(c)).normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 1).toUpperCase() + pad(hash(c.id + 'home') % 1e8, 8);
export const homePassport = c => passport(c, { data: { pais: homeCountry(c), pasaporte_ext: homePassportNo(c) }, created_at: c.created_at }, 'home');

// Tarjeta del Seguro Social (SSN): tu número fiscal ante el IRS
export const ssnNumber = c => { const n = String(hash(c.id + 'ssn') % 1e9).padStart(9, '0'); return `${n.slice(0, 3)}-${n.slice(3, 5)}-${n.slice(5)}`; };
export const ssnCard = c => `<div class="ssn"><div class="ssn-h">SOCIAL SECURITY</div><div class="ssn-u">UNITED STATES OF AMERICA</div>
  <div class="ssn-n">${ssnNumber(c)}</div><small>THIS NUMBER HAS BEEN ESTABLISHED FOR</small><div class="ssn-name">${up(c.first_name)} ${up(c.last_name)}</div>
  <div class="ssn-sig"><span class="signature">${esc(c.first_name)} ${esc(c.last_name)}</span><small>SIGNATURE</small></div><div class="idc-micro">${RP.repeat(2)}</div></div>`;

// ---------- Diplomas y licencias profesionales ----------
export function diploma(title, who, line, by, date) {
  return `<div class="diploma" style="background-image:${guilloche('#c8b37a', 300, 150, 18)}"><div class="dip-in">
    ${seal(by.toUpperCase().slice(0, 30), 'LOS ANGELES', '#6b4f1d')}<small>${esc(by)}</small><h2>${esc(title)}</h2><p>se otorga a</p>
    <div class="dip-name">${esc(who)}</div><p>${esc(line)}</p>
    <div class="dip-sig"><span><i class="signature">${esc(by.split(' ')[0])}</i><small>Firma autorizada</small></span><span><b>${fdate(String(date).slice(0, 10))}</b><small>Fecha</small></span></div>
    ${micro()}</div></div>`;
}
