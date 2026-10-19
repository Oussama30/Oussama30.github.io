// Mentorat en 3 étapes, sur une seule page : l'étudiant dit ce dont il a besoin et propose ses horaires,
// un lauréat clique sur un horaire, la visio et l'invitation d'agenda sont prêtes. Après l'échange : un merci.
import { html, useState, useEffect } from './vendor/preact-htm.js';
import { Icon, Modal, Field, Empty, Person, Avatar, toast } from './ui.js';
import { BESOINS, RDV_MIN, mentorState, futureSlots, requestsFor, mentorsFor, timeAgo } from './logic.js';
import { getLang } from './i18n.js';

const firstName = p => (p?.full_name || '').split(' ')[0];
const pad = n => String(n).padStart(2, '0');
const isHttps = u => /^https:\/\/\S+$/i.test(u || '');

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function slotWhen(iso, now = new Date()) {
  const d = new Date(iso);
  const day0 = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day0(d) - day0(now)) / 864e5);
  return { diff, day: diff === 0 ? 'Aujourd’hui' : diff === 1 ? 'Demain' : diff === -1 ? 'Hier' : JOURS[d.getDay()], date: `${d.getDate()} ${MOIS[d.getMonth()]}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

export function SlotDate({ iso }) {
  const w = slotWhen(iso);
  return html`<span class=${'slot-date' + (w.diff === 0 ? ' today' : '')}><span class="sd-day">${w.day}</span><span class="sd-date">${w.date}</span><span class="sd-time mono">${w.time}</span></span>`;
}

// « Demain · 18:30 », « mardi 21 octobre · 12:30 »
function When({ iso }) {
  const w = slotWhen(iso);
  return html`<span class="when"><span>${w.day}</span>${w.diff > 1 || w.diff < -1 ? html` <span>${w.date}</span>` : null}<span class="mono"> · ${w.time}</span></span>`;
}

const toInput = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
// Horaires proposés par défaut : les trois prochains jours (sauf dimanche), en fin de journée ou à midi
function defaultSlots(now = new Date()) {
  const out = []; const d = new Date(now);
  while (out.length < 3) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 0) continue;
    const x = new Date(d); x.setHours(out.length === 1 ? 12 : 18, 30, 0, 0); out.push(toInput(x));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Agenda : Google Agenda (avec l'étudiant en invité côté lauréat) et fichier .ics
// ---------------------------------------------------------------------------
const icsDate = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function rdvTexts(m, store, lien) {
  const st = store.byId('profiles', m.student_id); const la = store.byId('profiles', m.mentor_id);
  const ar = getLang() === 'ar';
  const title = ar ? `إرشاد · شبكة ENSAM مكناس : ${m.sujet}` : `Mentorat Réseau ENSAM : ${m.sujet}`;
  const details = ar
    ? `موعد مدته ${RDV_MIN} دقيقة بين ${la?.full_name || ''} (خريج) و${st?.full_name || ''}.${lien ? `\nالاتصال المرئي : ${lien}` : ''}\nشبكة ENSAM مكناس`
    : `Rendez-vous de ${RDV_MIN} min entre ${la?.full_name || ''} (lauréat) et ${st?.full_name || ''}.${lien ? `\nVisio : ${lien}` : ''}\nRéseau ENSAM Meknès`;
  return { m, title, details, lien };
}

function gcalUrl({ m, title, details, lien }, guest) {
  const start = new Date(m.rdv_at); const end = new Date(start.getTime() + RDV_MIN * 6e4);
  const q = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${icsDate(start)}/${icsDate(end)}`, details, location: lien || '' });
  if (guest) q.set('add', guest);
  return 'https://calendar.google.com/calendar/render?' + q.toString();
}

function icsHref({ m, title, details, lien }) {
  const esc = t => String(t).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, x => '\\' + x);
  const start = new Date(m.rdv_at); const end = new Date(start.getTime() + RDV_MIN * 6e4);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Reseau ENSAM Meknes//Mentorat//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${m.id}@reseau-ensam`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`,
    `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(details)}`, lien ? `LOCATION:${esc(lien)}` : null, lien ? `URL:${lien}` : null,
    'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean);
  return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(lines.join('\r\n'));
}

// ---------------------------------------------------------------------------
// Petits éléments
// ---------------------------------------------------------------------------
const STEPS = ['Demandé', 'Rendez-vous fixé', 'Terminé'];
function MStepper({ m }) {
  const st = mentorState(m);
  const done = st === 'terminee' ? 3 : ['rdv', 'apres'].includes(st) ? 2 : 1;
  return html`<ol class="stepper mstep">${STEPS.map((s, i) => html`<li class=${i < done ? 'done' : ''}><span class="step-dot">${i < done ? html`<${Icon} name="check" size=${13}/>` : i + 1}</span>${s}</li>`)}</ol>`;
}

const PILL = { ouverte: ['m-demande', 'Ouverte à tous les lauréats'], demande: ['m-demande', 'En attente'], rdv: ['m-acceptee', 'Rendez-vous fixé'], apres: ['m-acceptee', 'À clôturer'], terminee: ['m-terminee', 'Terminé'], annulee: ['m-refusee', 'Annulé'], refusee: ['m-refusee', 'Déclinée'] };

function BesoinTag({ k }) {
  const b = BESOINS[k];
  return b ? html`<span class="mini besoin"><${Icon} name=${b.icon} size=${12}/> ${b.label}</span>` : null;
}

export function HowItWorks({ role }) {
  const steps = role === 'laureat'
    ? [['people', 'Un étudiant demande de l’aide'], ['clock', 'Tu cliques sur un horaire qui t’arrange'], ['video', 'La visio et l’invitation sont prêtes']]
    : [['spark', 'Tu dis ce dont tu as besoin'], ['clock', 'Un lauréat choisit un de tes horaires'], ['video', `Vous vous parlez ${RDV_MIN} min en visio`]];
  return html`<ol class="how">${steps.map(([ic, t], i) => html`<li><span class="how-n">${i + 1}</span><${Icon} name=${ic} size=${18}/><span>${t}</span></li>`)}</ol>`;
}

// ---------------------------------------------------------------------------
// Demander de l'aide : besoin, une phrase, 2 ou 3 horaires, et à qui
// ---------------------------------------------------------------------------
const EXEMPLES = {
  cv: 'Ex. Relire mon CV pour un PFE en méthodes',
  stage: 'Ex. Trouver un PFE en énergie à Casablanca',
  entretien: 'Ex. Préparer mon entretien chez Renault',
  etranger: 'Ex. Les étapes pour un stage en France',
  carriere: 'Ex. Choisir entre qualité et méthodes',
};

export function AskHelp({ ctx, mentor = null, besoin: b0 = '', onClose }) {
  const { store, me, act, go, scores, data } = ctx;
  const [besoin, setBesoin] = useState(b0 || '');
  const [sujet, setSujet] = useState('');
  const [msg, setMsg] = useState('');
  const [slots, setSlots] = useState(() => [...defaultSlots().slice(0, 2), '']);
  const [to, setTo] = useState(mentor?.id || '');
  const reco = mentor ? [] : mentorsFor(data, me, besoin, scores).slice(0, 3);
  const valid = slots.filter(x => x && new Date(x) > new Date());
  const ok = besoin && sujet.trim().length >= 3 && valid.length > 0;
  const target = to ? store.byId('profiles', to) : null;
  const submit = e => {
    e.preventDefault(); if (!ok) return;
    act(async () => {
      await store.insert('mentorships', { student_id: me.id, mentor_id: to || null, besoin, sujet: sujet.trim(), message: msg.trim() || null, creneaux: valid.map(x => new Date(x).toISOString()) });
      toast(to ? `Demande envoyée à ${firstName(target)}. Tu seras prévenu(e) dès qu’un horaire est choisi.` : 'Demande envoyée aux lauréats. Tu seras prévenu(e) dès qu’un horaire est choisi.', 'win');
      onClose(); go('mentorat');
    });
  };
  return html`<${Modal} title=${mentor ? `Demander à ${mentor.full_name}` : 'Demander de l’aide'} onClose=${onClose}>
    <form class="form ask" novalidate onSubmit=${submit}>
      ${mentor?.mentor_sujets ? html`<p class="muted small">Peut t’aider sur : <span translate="no" dir="auto">${mentor.mentor_sujets}</span></p>` : null}
      <fieldset class="need-pick"><legend class="field-label">1. De quoi as-tu besoin ?</legend>
        <div class="chips">${Object.entries(BESOINS).map(([k, v]) => html`<button type="button" class=${'chip' + (besoin === k ? ' on' : '')} aria-pressed=${besoin === k} onClick=${() => setBesoin(k)}><${Icon} name=${v.icon} size=${15}/> ${v.label}</button>`)}</div></fieldset>
      <${Field} label="2. En une phrase"><input id="ah-sujet" maxlength="140" value=${sujet} onInput=${e => setSujet(e.target.value)} placeholder=${EXEMPLES[besoin] || 'Ex. Relire mon CV pour un PFE en méthodes'}/><//>
      <fieldset class="slot-pick"><legend class="field-label">3. Quand es-tu disponible ?</legend>
        <p class="field-hint">Propose 2 ou 3 moments. Le lauréat en choisit un, l’appel dure ${RDV_MIN} minutes.</p>
        <div class="slot-inputs">${slots.map((v, i) => html`<input type="datetime-local" id=${'ah-slot-' + i} aria-label=${`Horaire ${i + 1}`} step="900" value=${v} onInput=${e => setSlots(slots.map((x, j) => (j === i ? e.target.value : x)))}/>`)}</div></fieldset>
      ${!mentor ? html`<fieldset class="pick-list"><legend class="field-label">4. À qui ?</legend>
        <label class=${'pick' + (!to ? ' on' : '')}><input type="radio" name="ah-to" checked=${!to} onChange=${() => setTo('')}/><span><strong>Tous les lauréats qui peuvent aider</strong><span class="small muted">Le plus rapide : le premier disponible choisit un horaire.</span></span></label>
        ${reco.map(({ p, why }) => html`<label class=${'pick' + (to === p.id ? ' on' : '')} key=${p.id}><input type="radio" name="ah-to" checked=${to === p.id} onChange=${() => setTo(p.id)}/>
          <${Avatar} p=${p} size=${30}/><span><strong>${p.full_name}</strong><span class="small muted">${[p.poste, p.entreprise].filter(Boolean).join(' · ')}</span>${why.length ? html`<span class="why">${why.map(w => html`<span class="mini good">${w}</span>`)}</span>` : null}</span></label>`)}
      </fieldset>` : null}
      <${Field} label="Plus de détails (facultatif)"><textarea id="ah-msg" rows="2" maxlength="1500" value=${msg} onInput=${e => setMsg(e.target.value)} placeholder="Lien vers ton CV, entreprise visée…"></textarea><//>
      <div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn primary" disabled=${!ok}><${Icon} name="send" size=${16}/> Envoyer ma demande</button></div>
    </form>
  <//>`;
}

// ---------------------------------------------------------------------------
// Côté lauréat : choisir un horaire (ou un autre moment), avec son propre lien s'il le souhaite
// ---------------------------------------------------------------------------
function TimeChoice({ ctx, m, compact }) {
  const { store, me, act } = ctx;
  const slots = futureSlots(m);
  const [pick, setPick] = useState(null);
  const [autre, setAutre] = useState(() => defaultSlots()[0]);
  const [lien, setLien] = useState('');
  const [msg, setMsg] = useState('');
  const confirm = () => act(async () => {
    const at = pick === 'autre' ? new Date(autre) : new Date(pick);
    if (!(at > new Date())) throw new Error('Choisis un moment à venir.');
    if (lien.trim() && !isHttps(lien.trim())) throw new Error('Le lien doit commencer par https://');
    await store.update('mentorships', m.id, { mentor_id: me.id, status: 'acceptee', rdv_at: at.toISOString(), reponse: msg.trim() || m.reponse || null });
    if (lien.trim()) await store.update('liens_rdv', m.id, { lien: lien.trim() });
    toast(m.rdv_at ? 'Rendez-vous déplacé. L’étudiant est prévenu.' : 'Rendez-vous fixé ! L’étudiant est prévenu. +10 points', 'win');
  });
  return html`<div class="tchoice">
    <p class="small"><strong>${m.rdv_at ? 'Nouvel horaire :' : slots.length ? 'Choisis un horaire qui t’arrange :' : 'Propose un moment :'}</strong></p>
    <div class="chips">${slots.map(c => html`<button type="button" class=${'chip time' + (pick === c ? ' on' : '')} aria-pressed=${pick === c} onClick=${() => setPick(c)}><${Icon} name="clock" size=${14}/> <${When} iso=${c}/></button>`)}
      <button type="button" class=${'chip' + (pick === 'autre' ? ' on' : '')} aria-pressed=${pick === 'autre'} onClick=${() => setPick('autre')}>${slots.length ? 'Autre moment' : 'Choisir le moment'}</button></div>
    ${pick === 'autre' ? html`<input type="datetime-local" id=${'tc-autre-' + m.id} aria-label="Autre moment" step="900" value=${autre} onInput=${e => setAutre(e.target.value)}/>` : null}
    ${pick ? html`<div class="tconfirm">
      <p class="small muted"><${Icon} name="video" size=${14}/> Une salle de visio est créée automatiquement. Tu peux mettre ton lien Google Meet ou Teams à la place.</p>
      ${!compact ? html`<div class="grid2"><input id=${'tc-lien-' + m.id} value=${lien} onInput=${e => setLien(e.target.value)} placeholder="Ton lien Meet ou Teams (facultatif)" dir="ltr"/>
        <input id=${'tc-msg-' + m.id} maxlength="300" value=${msg} onInput=${e => setMsg(e.target.value)} placeholder="Un mot pour l’étudiant (facultatif)"/></div>` : null}
      <div class="row-end"><button type="button" class="btn primary" onClick=${confirm}><${Icon} name="check" size=${16}/> Confirmer le rendez-vous</button></div>
    </div>` : null}
  </div>`;
}

// ---------------------------------------------------------------------------
// Le rendez-vous : rejoindre la visio, l'ajouter à son agenda, le déplacer
// ---------------------------------------------------------------------------
function RdvBox({ ctx, m, side }) {
  const { store, act } = ctx;
  const lienRow = store.byId('liens_rdv', m.id);
  const lien = isHttps(lienRow?.lien) ? lienRow.lien : null;
  const other = store.byId('profiles', side === 'mentor' ? m.student_id : m.mentor_id);
  const [guest, setGuest] = useState(null);
  const [edit, setEdit] = useState(false);
  const [newLien, setNewLien] = useState('');
  useEffect(() => { let on = true; if (side === 'mentor') Promise.resolve(store.emailRdv?.(m.id)).then(g => on && setGuest(g || null), () => {}); return () => { on = false; }; }, [m.id, m.status, side]);
  if (!m.rdv_at) return side === 'mentor' ? html`<${TimeChoice} ctx=${ctx} m=${m}/>` : html`<p class="small muted">${firstName(other)} va fixer l’horaire du rendez-vous.</p>`;
  const t = new Date(m.rdv_at).getTime(); const now = Date.now();
  const live = now > t - 15 * 6e4 && now < t + 60 * 6e4;
  const txt = rdvTexts(m, store, lien);
  const saveLien = () => act(async () => {
    if (!isHttps(newLien.trim())) throw new Error('Le lien doit commencer par https://');
    await store.update('liens_rdv', m.id, { lien: newLien.trim() }); setNewLien(''); setEdit(false); toast('Lien enregistré.');
  });
  return html`<div class=${'rdv-box' + (live ? ' live' : '')}>
    <div class="rdv-top"><${SlotDate} iso=${m.rdv_at}/><span class="rdv-what"><strong>${live ? 'C’est le moment !' : `${RDV_MIN} min en visio`}</strong>
      ${lien ? html`<span class="small muted mono rdv-link" dir="ltr" translate="no">${lien.replace(/^https:\/\//, '')}</span>` : html`<span class="small muted">Lien de visio en préparation…</span>`}</span></div>
    <div class="rdv-actions">
      ${lien ? html`<a class=${'btn ' + (live ? 'primary' : '')} href=${lien} target="_blank" rel="noopener"><${Icon} name="video" size=${16}/> Rejoindre la visio</a>` : null}
      <a class="btn ghost small" href=${gcalUrl(txt, side === 'mentor' ? guest : null)} target="_blank" rel="noopener"><${Icon} name="calendar" size=${15}/> ${side === 'mentor' && guest ? 'Inviter via Google Agenda' : 'Ajouter à Google Agenda'}</a>
      <a class="btn ghost small" href=${icsHref(txt)} download="rendez-vous-ensam.ics"><${Icon} name="download" size=${15}/> Autre agenda (.ics)</a>
    </div>
    ${side === 'mentor' && guest ? html`<p class="small muted">Google Agenda ajoute ${firstName(other)} comme invité(e) : enregistre l’événement puis choisis « Envoyer » pour lui envoyer l’invitation par email.</p>` : null}
    ${side === 'mentor' && lien && lien.includes('meet.jit.si') ? html`<p class="small muted">Jitsi est gratuit. La première personne qui entre se connecte avec Google pour ouvrir la salle.</p>` : null}
    <div class="row wrap rdv-foot">
      ${side === 'mentor' ? html`<button class="linkish small" onClick=${() => setEdit(!edit)}>${edit ? 'Fermer' : 'Changer l’horaire ou le lien'}</button>` : null}
      <span class="spacer"></span>
      <button class="linkish small danger-t" onClick=${() => ctx.confirm(side === 'mentor' ? `Annuler le rendez-vous ? ${firstName(other)} sera prévenu(e).` : 'Annuler le rendez-vous ? Le lauréat sera prévenu.', () => act(async () => { await store.update('mentorships', m.id, { status: 'annulee' }); toast('Rendez-vous annulé.'); }), 'Annuler le rendez-vous')}>Annuler le rendez-vous</button>
    </div>
    ${edit ? html`<div class="rdv-edit"><${TimeChoice} ctx=${ctx} m=${{ ...m, creneaux: [] }} compact/>
      <div class="row"><input id=${'rdv-lien-' + m.id} class="grow" dir="ltr" value=${newLien} onInput=${e => setNewLien(e.target.value)} placeholder="Nouveau lien : https://meet.google.com/…"/><button class="btn small" disabled=${!newLien.trim()} onClick=${saveLien}>Enregistrer le lien</button></div></div>` : null}
  </div>`;
}

// Après le rendez-vous, côté étudiant : une note, un merci, et c'est terminé
function AfterBox({ ctx, m }) {
  const { store, act } = ctx;
  const mentor = store.byId('profiles', m.mentor_id);
  const [note, setNote] = useState(5); const [merci, setMerci] = useState('');
  return html`<form class="merci-box" onSubmit=${e => { e.preventDefault(); act(async () => { await store.update('mentorships', m.id, { status: 'terminee', note, merci: merci.trim() || null }); toast(merci.trim() ? 'Merci envoyé ! Il apparaît sur le mur des mercis.' : 'C’est noté, merci !', 'win'); }); }}>
    <p><${Icon} name="heart" size=${16}/> <strong>Comment s’est passé l’échange avec ${firstName(mentor)} ?</strong></p>
    <span class="stars" role="group" aria-label="Aide reçue">${[1, 2, 3, 4, 5].map(v => html`<button type="button" class=${v <= note ? 'on' : ''} aria-label=${v + ' sur 5'} onClick=${() => setNote(v)}>★</button>`)}</span>
    <textarea id=${'am-merci-' + m.id} rows="2" maxlength="800" placeholder="Un mot de remerciement…" value=${merci} onInput=${e => setMerci(e.target.value)}></textarea>
    <div class="row"><button type="button" class="linkish small" onClick=${() => act(() => store.update('mentorships', m.id, { status: 'annulee' }))}>L’échange n’a pas eu lieu</button><span class="spacer"></span><button class="btn primary small">${merci.trim() ? 'Envoyer mon merci' : 'Terminer'}</button></div>
  </form>`;
}

// Mes horaires sont passés : en proposer d'autres
function NewSlots({ ctx, m, onDone }) {
  const { store, act } = ctx;
  const [slots, setSlots] = useState(() => [...defaultSlots().slice(0, 2), '']);
  const valid = slots.filter(x => x && new Date(x) > new Date());
  return html`<div class="tconfirm">
    <div class="slot-inputs">${slots.map((v, i) => html`<input type="datetime-local" id=${'ns-' + m.id + '-' + i} aria-label=${`Horaire ${i + 1}`} step="900" value=${v} onInput=${e => setSlots(slots.map((x, j) => (j === i ? e.target.value : x)))}/>`)}</div>
    <div class="row-end"><button class="btn small primary" disabled=${!valid.length} onClick=${() => act(async () => { await store.update('mentorships', m.id, { creneaux: valid.map(x => new Date(x).toISOString()) }); toast('Nouveaux horaires envoyés.'); onDone(); })}>Envoyer ces horaires</button></div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Une demande, du début à la fin
// ---------------------------------------------------------------------------
export function RequestCard({ ctx, m, side, why = [] }) {
  const { store, act, openProfile } = ctx;
  const st = mentorState(m);
  const other = store.byId('profiles', side === 'student' ? m.mentor_id : m.student_id);
  const [reslot, setReslot] = useState(false);
  const slots = futureSlots(m);
  const [cls, label] = PILL[st] || PILL.demande;
  const waiting = st === 'ouverte' || st === 'demande';
  return html`<article class=${'mreq st-' + st}>
    <div class="mrow-head">
      ${other ? html`<${Person} p=${other} onOpen=${openProfile} size=${36}/>` : html`<span class="open-to"><span class="open-ico"><${Icon} name="people" size=${18}/></span><span><strong>Tous les lauréats</strong><span class="small muted">Le premier disponible choisit un horaire</span></span></span>`}
      <span class="spacer"></span><span class=${'state-pill ' + cls}>${label}</span></div>
    <p class="mreq-subject"><${BesoinTag} k=${m.besoin}/><strong>${m.sujet}</strong> <span class="muted small">· ${timeAgo(m.created_at)}</span></p>
    ${m.message ? html`<p class="quote">${m.message}</p>` : null}
    ${why.length && waiting ? html`<p class="why"><span class="small muted">Pourquoi toi :</span> ${why.map(w => html`<span class="mini good">${w}</span>`)}</p>` : null}
    ${!['annulee', 'refusee'].includes(st) && !(side !== 'student' && waiting) ? html`<${MStepper} m=${m}/>` : null}
    ${m.reponse && side === 'student' && st !== 'ouverte' ? html`<p class="small"><span class="muted">${firstName(other)} :</span> ${m.reponse}</p>` : null}

    ${side === 'student' && waiting ? html`<div class="mreq-body">
      ${slots.length ? html`<p class="small muted">Tes horaires : ${slots.map(c => html`<span class="mini"><${When} iso=${c}/></span>`)}</p>` : html`<p class="small warn-t">Tes horaires sont passés. Propose-en d’autres pour qu’un lauréat puisse choisir.</p>`}
      ${reslot || !slots.length ? html`<${NewSlots} ctx=${ctx} m=${m} onDone=${() => setReslot(false)}/>` : null}
      <div class="row"><span class="small muted">${st === 'ouverte' ? 'En attente d’un lauréat…' : `En attente de ${firstName(other)}…`}</span><span class="spacer"></span>
        ${slots.length ? html`<button class="linkish small" onClick=${() => setReslot(!reslot)}>${reslot ? 'Fermer' : 'Changer mes horaires'}</button>` : null}
        <button class="linkish small danger-t" onClick=${() => ctx.confirm('Annuler cette demande ?', () => act(() => store.update('mentorships', m.id, { status: 'annulee' })), 'Annuler la demande')}>Annuler</button></div>
    </div>` : null}

    ${side === 'mentor' && waiting ? html`<${TimeChoice} ctx=${ctx} m=${m}/>
      ${st === 'demande' ? html`<div class="row"><span class="spacer"></span><button class="linkish small" onClick=${() => ctx.confirm('Tu n’es pas disponible ? La demande sera proposée aux autres lauréats.', () => act(async () => { await store.update('mentorships', m.id, { mentor_id: null }); toast('Demande proposée aux autres lauréats.'); }), 'Proposer aux autres')}>Pas disponible</button></div>` : null}` : null}

    ${st === 'rdv' || st === 'apres' ? html`<${RdvBox} ctx=${ctx} m=${m} side=${side}/>` : null}
    ${st === 'apres' && side === 'student' ? html`<${AfterBox} ctx=${ctx} m=${m}/>` : null}
    ${st === 'apres' && side === 'mentor' ? html`<div class="row after-mentor"><span class="small">Le rendez-vous a eu lieu ?</span><span class="spacer"></span><button class="btn small primary" onClick=${() => act(async () => { await store.update('mentorships', m.id, { status: 'terminee' }); toast('Mentorat terminé. +20 points', 'win'); })}><${Icon} name="check" size=${15}/> Marquer comme terminé</button></div>` : null}
    ${st === 'terminee' && (m.merci || m.note) ? html`<p class="small merci-inline">${m.note ? html`<span class="stars-ro" aria-label=${m.note + ' sur 5'}>${'★'.repeat(m.note)}</span>` : null}${m.merci ? html`<${Icon} name="heart" size=${14}/> ${m.merci}` : null}</p>` : null}
  </article>`;
}

// ---------------------------------------------------------------------------
// La page Mentorat
// ---------------------------------------------------------------------------
const ACTIVE = ['rdv', 'apres', 'ouverte', 'demande'];
const byRdv = (a, b) => new Date(a.rdv_at || a.created_at) - new Date(b.rdv_at || b.created_at);

export function MentoratPage(ctx) {
  const { data, me, store, act, scores, openProfile } = ctx;
  const [ask, setAsk] = useState(null); // { mentor, besoin }
  const [past, setPast] = useState(false);
  const [more, setMore] = useState(false);
  const isLaureat = me.role === 'laureat';
  const mine = data.mentorships.filter(m => m.student_id === me.id);
  const mineActive = mine.filter(m => ACTIVE.includes(mentorState(m))).sort((a, b) => ACTIVE.indexOf(mentorState(a)) - ACTIVE.indexOf(mentorState(b)) || byRdv(a, b));
  const minePast = mine.filter(m => !ACTIVE.includes(mentorState(m))).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const asMentor = data.mentorships.filter(m => m.mentor_id === me.id);
  const rdvs = asMentor.filter(m => ['rdv', 'apres'].includes(mentorState(m))).sort((a, b) => (mentorState(b) === 'apres') - (mentorState(a) === 'apres') || byRdv(a, b));
  const done = asMentor.filter(m => m.status === 'terminee').sort((a, b) => new Date(b.rdv_at || b.created_at) - new Date(a.rdv_at || a.created_at));
  const need = isLaureat ? requestsFor(data, me, id => store.byId('profiles', id)) : [];
  const busy = new Set(mineActive.map(m => m.mentor_id));
  const reco = me.role === 'etudiant' ? mentorsFor(data, me, '', scores).filter(x => !busy.has(x.p.id)).slice(0, 3) : [];

  if (me.role === 'admin') {
    const open = data.mentorships.filter(m => m.status === 'demande').sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const soon = data.mentorships.filter(m => mentorState(m) === 'rdv');
    return html`<section class="page">
      <header class="page-head"><div><p class="eyebrow">${open.length} demande${open.length > 1 ? 's' : ''} en attente · ${soon.length} rendez-vous à venir</p><h1>Mentorat</h1></div></header>
      <${HowItWorks} role="etudiant"/>
      <div class="list">${open.length ? open.map(m => html`<${RequestCard} key=${m.id} ctx=${ctx} m=${m} side="admin"/>`) : html`<${Empty} icon="mentor" title="Aucune demande en attente">Toutes les demandes ont trouvé un lauréat.<//>`}</div>
    </section>`;
  }

  return html`<section class="page mentorat">
    <header class="page-head"><div><p class="eyebrow">${isLaureat ? 'Aider un étudiant, en 20 minutes' : `Un lauréat, ${RDV_MIN} minutes, en visio`}</p><h1>Mentorat</h1></div>
      ${isLaureat ? html`<label class="switch"><input id="mentor-dispo" type="checkbox" checked=${!!me.mentor_dispo} onChange=${e => act(() => store.update('profiles', me.id, { mentor_dispo: e.target.checked }))}/> Disponible pour aider</label>` : null}</header>
    <${HowItWorks} role=${isLaureat ? 'laureat' : 'etudiant'}/>

    ${!isLaureat ? html`<div class="need-card">
      <h2>De quoi as-tu besoin ?</h2>
      <div class="need-grid">${Object.entries(BESOINS).map(([k, v]) => html`<button class="need-btn" onClick=${() => setAsk({ besoin: k })}><span class="need-ico"><${Icon} name=${v.icon} size=${22}/></span><span>${v.label}</span></button>`)}</div>
    </div>` : null}

    ${isLaureat && rdvs.length ? html`<div class="section-head"><h2 class="h-ico"><${Icon} name="video"/> Mes rendez-vous <span class="count">${rdvs.length}</span></h2></div>
      <div class="list">${rdvs.map(m => html`<${RequestCard} key=${m.id} ctx=${ctx} m=${m} side="mentor"/>`)}</div>` : null}

    ${isLaureat ? html`<div class="section-head"><h2 class="h-ico"><${Icon} name="heart"/> Ils ont besoin de toi <span class="count">${need.length}</span></h2>${!me.mentor_dispo ? html`<span class="small muted">Active « Disponible pour aider » pour recevoir des demandes directes.</span>` : null}</div>
      <div class="list">${need.length ? need.slice(0, more ? 12 : 3).map(({ m, why }) => html`<${RequestCard} key=${m.id} ctx=${ctx} m=${m} side="mentor" why=${why}/>`) : html`<${Empty} icon="mentor" title="Aucune demande pour l’instant">Tu seras prévenu(e) dès qu’un étudiant demande de l’aide.<//>`}</div>
      ${need.length > 3 ? html`<button class="linkish small past-toggle" onClick=${() => setMore(!more)}>${more ? 'Voir moins' : `Voir les autres demandes (${need.length - 3})`}</button>` : null}` : null}

    ${mineActive.length ? html`<div class="section-head"><h2>Mes demandes <span class="count">${mineActive.length}</span></h2></div>
      <div class="list">${mineActive.map(m => html`<${RequestCard} key=${m.id} ctx=${ctx} m=${m} side="student"/>`)}</div>` : null}

    ${!isLaureat && reco.length ? html`<div class="section-head"><h2>Des lauréats qui peuvent t’aider</h2><span class="muted small">Ou choisis toi-même</span></div>
      <div class="cards">${reco.map(({ p, why }) => html`<div class="mcard" key=${p.id}>
        <${Person} p=${p} score=${scores.get(p.id)} onOpen=${openProfile} size=${44}/>
        ${p.poste ? html`<p class="small"><${Icon} name="briefcase" size=${14}/> ${p.poste}${p.entreprise ? ' · ' + p.entreprise : ''}</p>` : null}
        ${p.mentor_sujets ? html`<p class="topics"><span class="muted small">Peut t’aider sur :</span> <span translate="no" dir="auto">${p.mentor_sujets}</span></p>` : null}
        <div class="row"><span class="why">${why.map(w => html`<span class="mini good">${w}</span>`)}</span><span class="spacer"></span><button class="btn small" onClick=${() => setAsk({ mentor: p })}>Lui demander</button></div>
      </div>`)}</div>` : null}

    ${(isLaureat ? done : minePast).length ? html`<button class="linkish small past-toggle" onClick=${() => setPast(!past)}>${past ? 'Masquer l’historique' : `Voir l’historique (${(isLaureat ? done : minePast).length})`}</button>
      ${past ? html`<div class="list">${(isLaureat ? done : minePast).slice(0, 10).map(m => html`<${RequestCard} key=${m.id} ctx=${ctx} m=${m} side=${isLaureat ? 'mentor' : 'student'}/>`)}</div>` : null}` : null}

    ${isLaureat ? html`<p class="small muted center">Toi aussi, tu cherches un conseil ? <button class="linkish" onClick=${() => setAsk({})}>Demande à un lauréat plus expérimenté</button></p>` : null}
    ${ask ? html`<${AskHelp} ctx=${ctx} mentor=${ask.mentor} besoin=${ask.besoin} onClose=${() => setAsk(null)}/>` : null}
  </section>`;
}

// ---------------------------------------------------------------------------
// Sur l'accueil : le prochain rendez-vous, et (lauréat) les demandes qui l'attendent
// ---------------------------------------------------------------------------
export function NextRdv({ ctx }) {
  const { data, me, store, go } = ctx;
  const next = data.mentorships.filter(m => (m.student_id === me.id || m.mentor_id === me.id) && mentorState(m) === 'rdv' && m.rdv_at).sort(byRdv)[0];
  if (!next) return null;
  const other = store.byId('profiles', next.mentor_id === me.id ? next.student_id : next.mentor_id);
  const lien = store.byId('liens_rdv', next.id)?.lien;
  const t = new Date(next.rdv_at).getTime(); const now = Date.now();
  const live = now > t - 15 * 6e4 && now < t + 60 * 6e4;
  return html`<div class=${'next-rdv' + (live ? ' live' : '')}>
    <${SlotDate} iso=${next.rdv_at}/>
    <span class="next-main"><span class="eyebrow"><${Icon} name="video" size=${13}/> Prochain rendez-vous</span><strong dir="auto">${next.sujet}</strong><span class="small muted">Avec <span translate="no">${other?.full_name || ''}</span></span></span>
    <span class="next-act">${isHttps(lien) ? html`<a class=${'btn small' + (live ? ' primary' : '')} href=${lien} target="_blank" rel="noopener"><${Icon} name="video" size=${15}/> Rejoindre</a>` : null}
      <button class="btn small ghost" onClick=${() => go('mentorat')}>Détails</button></span>
  </div>`;
}

export function HelpNeeded({ ctx, max = 2 }) {
  const { data, me, store, go } = ctx;
  if (me.role !== 'laureat') return null;
  const need = requestsFor(data, me, id => store.byId('profiles', id)).filter(x => x.direct || x.score >= 2);
  if (!need.length) return null;
  return html`<div class="help-needed">
    <div class="section-head"><h2 class="h-ico"><${Icon} name="heart"/> Ces étudiants ont besoin de toi</h2>${need.length > max ? html`<button class="btn tiny ghost" onClick=${() => go('mentorat')}>Tout voir (${need.length}) <${Icon} name="arrow" size=${14}/></button>` : null}</div>
    <div class="list">${need.slice(0, max).map(({ m, why }) => html`<${RequestCard} key=${m.id} ctx=${ctx} m=${m} side="mentor" why=${why}/>`)}</div>
  </div>`;
}
