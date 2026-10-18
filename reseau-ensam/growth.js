// Ce que les lauréats y gagnent : vivier de talents (shortlist, invitations), entretiens express
// de 15 minutes, attestation vérifiable, et fil des réussites à partager sur LinkedIn.
import { html, useState, useEffect } from './vendor/preact-htm.js';
import { Icon, Modal, Field, Empty, Person, Avatar, RoleLine, BrandLogo, toast } from './ui.js';
import { FILIERES, FOUND, niveauOf, statutOf, timeAgo, slotState, attestationStats } from './logic.js';
import { OfferComposer, matchesMe } from './offers.js';
import { getLang } from './i18n.js';

const firstName = p => (p?.full_name || '').split(' ')[0];
const href = u => (u.startsWith('http') ? u : 'https://' + u);
const byStart = (a, b) => new Date(a.starts_at) - new Date(b.starts_at);

async function copyText(txt, done = 'Copié.') {
  try { await navigator.clipboard.writeText(txt); toast(done); } catch { toast('Copie impossible ici : sélectionne le texte et copie-le.', 'err'); }
}

// ---------------------------------------------------------------------------
// Vivier de talents : chercher, garder dans sa shortlist, inviter à postuler
// ---------------------------------------------------------------------------
const CHERCHE = { 3: 'stage de 3A', 4: 'stage de 4A', 5: 'PFE ou stage à l’étranger' };

export function TalentPool({ ctx }) {
  const { data, me, saison, store, act, openProfile } = ctx;
  const canRecruit = me.role === 'laureat';
  const [view, setView] = useState('tous');
  const [q, setQ] = useState(''); const [fil, setFil] = useState(''); const [niv, setNiv] = useState(''); const [cv, setCv] = useState(false);
  const [invite, setInvite] = useState(null);
  const saved = new Map(data.shortlists.filter(x => x.laureat_id === me.id).map(x => [x.student_id, x]));
  const pool = data.profiles.filter(p => p.role === 'etudiant' && p.vitrine !== false && [3, 4, 5].includes(niveauOf(p, saison)));
  const qq = q.trim().toLowerCase();
  const searching = p => !['trouve', 'validation'].includes(statutOf(data, p, saison).key);
  const list = pool.filter(p => (view === 'shortlist' ? saved.has(p.id) : searching(p)))
    .filter(p => (!fil || p.filiere === fil) && (!niv || niveauOf(p, saison) === +niv) && (!cv || p.cv_url)
      && (!qq || `${p.full_name} ${p.ville || ''} ${p.bio || ''} ${(p.competences || []).join(' ')}`.toLowerCase().includes(qq)))
    .sort((a, b) => (saved.has(b.id) - saved.has(a.id)) || (!!b.cv_url - !!a.cv_url) || (b.competences?.length || 0) - (a.competences?.length || 0));
  const toggle = p => act(async () => {
    const s = saved.get(p.id);
    if (s) await store.remove('shortlists', s.id);
    else { await store.insert('shortlists', { laureat_id: me.id, student_id: p.id, note: '' }); toast(`${firstName(p)} est dans ta shortlist.`); }
  });
  const invState = p => {
    const inv = data.invitations.filter(i => i.laureat_id === me.id && i.student_id === p.id);
    if (!inv.length) return null;
    if (data.applications.some(a => a.student_id === p.id && inv.some(i => i.offer_id === a.offer_id))) return ['s-trouve', 'A postulé'];
    return inv.every(i => i.status === 'declinee') ? ['', 'A décliné'] : ['s-validation', 'Invité(e)'];
  };

  return html`<div class="sub-page">
    <p class="muted small">Étudiants en recherche qui ont choisi d’être visibles par les lauréats.${canRecruit ? ' Garde les profils intéressants et invite-les à postuler à tes offres.' : ''}</p>
    ${canRecruit ? html`<div class="seg" role="group"><button class=${view === 'tous' ? 'on' : ''} onClick=${() => setView('tous')}>Tous les talents</button><button class=${view === 'shortlist' ? 'on' : ''} onClick=${() => setView('shortlist')}><${Icon} name="bookmark" size=${15}/> Ma shortlist${saved.size ? html` <span class="count">${saved.size}</span>` : null}</button></div>` : null}
    <div class="filter-row">
      <label class="search"><${Icon} name="search" size=${16}/><input id="t-q" placeholder="Compétence, ville, nom…" value=${q} onInput=${e => setQ(e.target.value)}/></label>
      <select id="t-fil" value=${fil} onChange=${e => setFil(e.target.value)} aria-label="Filière"><option value="">Toutes filières</option>${FILIERES.map(f => html`<option value=${f}>${f}</option>`)}</select>
      <select id="t-niv" value=${niv} onChange=${e => setNiv(e.target.value)} aria-label="Année"><option value="">Toutes les années</option><option value="3">3A</option><option value="4">4A</option><option value="5">5A</option></select>
      <button class=${'chip' + (cv ? ' on' : '')} aria-pressed=${cv} onClick=${() => setCv(!cv)}><${Icon} name="file" size=${14}/> Avec CV</button>
    </div>
    <div class="cards">${list.map(p => {
      const s = saved.get(p.id); const st = statutOf(data, p, saison); const found = !searching(p); const inv = canRecruit ? invState(p) : null;
      return html`<div class="tcard" key=${p.id}>
        <div class="tcard-head"><${Person} p=${p} onOpen=${openProfile} size=${42}/>
          ${canRecruit ? html`<button class=${'icon-btn save-btn' + (s ? ' on' : '')} aria-pressed=${!!s} aria-label=${s ? 'Retirer de ma shortlist' : 'Garder dans ma shortlist'} title=${s ? 'Retirer de ma shortlist' : 'Garder dans ma shortlist'} onClick=${() => toggle(p)}><${Icon} name="bookmark" size=${18}/></button>` : null}</div>
        <p class="small">Cherche : <strong>${CHERCHE[niveauOf(p, saison)]}</strong></p>
        ${p.disponibilite || p.ville ? html`<p class="small muted tmeta">${p.disponibilite ? html`<span><${Icon} name="calendar" size=${14}/> <span translate="no" dir="auto">${p.disponibilite}</span></span>` : null}${p.ville ? html`<span><${Icon} name="pin" size=${14}/> ${p.ville}</span>` : null}</p>` : null}
        ${(p.competences || []).length ? html`<p class="chips-line">${p.competences.slice(0, 6).map(c => html`<span class=${'mini' + (qq && c.toLowerCase().includes(qq) ? ' hit' : '')}>${c}</span>`)}</p>` : null}
        ${view === 'shortlist' && s ? html`<input class="note-in" id=${'note-' + p.id} maxlength="300" placeholder="Note pour moi (visible par moi seul)" value=${s.note || ''} onChange=${e => act(() => store.update('shortlists', s.id, { note: e.target.value.trim() }))}/>` : null}
        <div class="row tcard-foot">
          ${p.cv_url ? html`<a class="btn tiny ghost" href=${href(p.cv_url)} target="_blank" rel="noopener"><${Icon} name="file" size=${14}/> Voir le CV</a>` : html`<span class="muted small">Pas encore de CV</span>`}
          <span class="spacer"></span>
          ${found ? html`<span class=${'state-pill s-' + st.key}>${st.label}</span>` : inv ? html`<span class=${'state-pill ' + inv[0]}>${inv[1]}</span>` : null}
          ${canRecruit && !found ? html`<button class="btn small primary" onClick=${() => setInvite(p)}><${Icon} name="send" size=${15}/> Inviter</button>` : null}
        </div>
      </div>`;
    })}</div>
    ${!list.length ? (view === 'shortlist' && !saved.size
      ? html`<${Empty} icon="bookmark" title="Ta shortlist est vide">Clique sur le marque-page d’un profil pour le garder ici, avec une note pour toi.<//>`
      : html`<${Empty} icon="spark" title="Personne ne correspond à ces critères">Essaie une autre filière ou enlève un filtre.<//>`) : null}
    ${invite ? html`<${InviteModal} ctx=${ctx} student=${invite} onClose=${() => setInvite(null)}/>` : null}
  </div>`;
}

function InviteModal({ ctx, student, onClose }) {
  const { data, me, saison, store, act } = ctx;
  const mine = data.offers.filter(o => o.author_id === me.id && o.status === 'ouverte')
    .map(o => ({ o, fit: matchesMe(o, student, saison), done: data.invitations.some(i => i.offer_id === o.id && i.student_id === student.id), applied: data.applications.some(a => a.offer_id === o.id && a.student_id === student.id) }))
    .sort((a, b) => b.fit - a.fit);
  const [offerId, setOfferId] = useState(mine.find(x => x.fit && !x.done && !x.applied)?.o.id || mine.find(x => !x.done && !x.applied)?.o.id || '');
  // Message proposé dans la langue de l'interface ; le lauréat le modifie librement
  const [msg, setMsg] = useState(getLang() === 'ar' ? `السلام ${firstName(student)}، ملفك يهمني لهذا العرض. ترشّح إذا أعجبك!` : `Bonjour ${firstName(student)}, ton profil m’intéresse pour cette offre. Postule si ça te parle !`);
  const [compose, setCompose] = useState(false);
  if (compose) return html`<${OfferComposer} ctx=${ctx} onClose=${() => setCompose(false)}/>`;
  const send = e => {
    e.preventDefault();
    act(async () => { await store.insert('invitations', { laureat_id: me.id, student_id: student.id, offer_id: offerId, message: msg.trim() }); toast('Invitation envoyée. Elle apparaît dans ses notifications.'); onClose(); });
  };
  return html`<${Modal} title=${`Inviter ${student.full_name}`} onClose=${onClose}>
    ${mine.length ? html`<form class="form" onSubmit=${send}>
      <p class="small muted">L’étudiant reçoit une notification et ouvre l’offre en un clic. Il reste libre de postuler ou non.</p>
      <fieldset class="pick-list"><legend class="field-label">Sur quelle offre ?</legend>
        ${mine.map(({ o, fit, done, applied }) => html`<label class=${'pick' + (done || applied ? ' off' : '')} key=${o.id}>
          <input type="radio" name="inv-offer" value=${o.id} checked=${offerId === o.id} disabled=${done || applied} onChange=${() => setOfferId(o.id)}/>
          <span><strong>${o.titre}</strong><span class="small muted">${applied ? 'A déjà postulé' : done ? 'Déjà invité(e)' : fit ? 'Correspond à son année et à sa filière' : 'Hors de son année ou de sa filière'}</span></span></label>`)}
      </fieldset>
      <${Field} label="Message"><textarea id="inv-msg" rows="3" maxlength="600" value=${msg} onInput=${e => setMsg(e.target.value)}></textarea><//>
      ${!offerId ? html`<p class="small muted">Cet étudiant a déjà reçu une invitation ou postulé sur chacune de tes offres ouvertes.</p>` : null}
      <div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn primary" disabled=${!offerId}><${Icon} name="send" size=${16}/> Envoyer l’invitation</button></div>
    </form>` : html`<${Empty} icon="feed" title="Publie d’abord une offre">Tu pourras ensuite inviter cet étudiant à y postuler en un clic.<//>
      <div class="row-end"><button class="btn primary" onClick=${() => setCompose(true)}><${Icon} name="plus" size=${16}/> Publier une offre</button></div>`}
  <//>`;
}

// ---------------------------------------------------------------------------
// Entretiens express de 15 minutes
// ---------------------------------------------------------------------------
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const LIEUX = ['Google Meet', 'Appel téléphonique', 'WhatsApp', 'Sur place à l’école'];
const pad = n => String(n).padStart(2, '0');

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

const localDay = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Côté lauréat : ouvrir des créneaux, voir qui a réservé
export function ExpressMentor({ ctx }) {
  const { data, me, store, act, openProfile } = ctx;
  const mine = data.slots.filter(s => s.mentor_id === me.id);
  const upcoming = mine.filter(s => ['libre', 'reserve'].includes(slotState(s))).sort(byStart);
  const done = mine.filter(s => slotState(s) === 'fait').sort((a, b) => byStart(b, a));
  const [f, setF] = useState(() => ({ date: localDay(new Date(Date.now() + 2 * 864e5)), time: '18:30', lieu: 'Google Meet' }));
  const add = e => {
    e.preventDefault();
    const starts = new Date(`${f.date}T${f.time}`);
    if (!(starts > new Date())) { toast('Choisis un moment à venir.', 'err'); return; }
    act(async () => { await store.insert('slots', { mentor_id: me.id, starts_at: starts.toISOString(), lieu: f.lieu.trim() || 'Google Meet', duree: 15 }); toast('Créneau ouvert. Les étudiants peuvent le réserver.'); });
  };
  return html`<div class="express">
    <div class="express-intro"><span class="obj-ico"><${Icon} name="clock" size=${22}/></span><div><strong>Entretiens express de 15 minutes</strong>
      <p class="small muted">Deux créneaux par mois suffisent. Un étudiant réserve, tu reçois une notification, et chaque entretien réalisé rapporte 10 points.</p></div></div>
    <form class="slot-form" onSubmit=${add}>
      <${Field} label="Jour"><input id="sl-date" type="date" required min=${localDay(new Date())} value=${f.date} onInput=${e => setF({ ...f, date: e.target.value })}/><//>
      <${Field} label="Heure"><input id="sl-time" type="time" required step="900" value=${f.time} onInput=${e => setF({ ...f, time: e.target.value })}/><//>
      <${Field} label="Comment ?"><input id="sl-lieu" list="sl-lieux" maxlength="120" value=${f.lieu} onInput=${e => setF({ ...f, lieu: e.target.value })}/><datalist id="sl-lieux">${LIEUX.map(l => html`<option value=${l}></option>`)}</datalist><//>
      <button class="btn primary"><${Icon} name="plus" size=${16}/> Ouvrir ce créneau</button>
    </form>
    <h3 class="sub-title">À venir <span class="count">${upcoming.length}</span></h3>
    ${upcoming.length ? html`<ul class="slot-list">${upcoming.map(s => {
      const st = store.byId('profiles', s.student_id);
      return html`<li class="slot-row" key=${s.id}><${SlotDate} iso=${s.starts_at}/>
        <span class="slot-main">${st ? html`<${Person} p=${st} onOpen=${openProfile} size=${30}/><span class="small">${s.sujet}</span>` : html`<span class="state-pill s-libre">Libre</span>`}
          <span class="small muted"><${Icon} name="pin" size=${13}/> ${s.lieu}</span></span>
        ${st ? html`<button class="btn tiny ghost" onClick=${() => ctx.confirm('Annuler ce rendez-vous ? L’étudiant sera prévenu.', () => act(() => store.update('slots', s.id, { status: 'annule' })), 'Annuler le rendez-vous')}>Annuler</button>`
          : html`<button class="icon-btn small" aria-label="Supprimer ce créneau" onClick=${() => act(() => store.remove('slots', s.id))}><${Icon} name="trash" size=${14}/></button>`}
      </li>`;
    })}</ul>` : html`<p class="muted small">Aucun créneau à venir. Ouvre-en un juste au-dessus.</p>`}
    ${done.length ? html`<h3 class="sub-title">Réalisés <span class="count">${done.length}</span></h3>
      <ul class="slot-list">${done.slice(0, 6).map(s => { const st = store.byId('profiles', s.student_id); return html`<li class="slot-row past" key=${s.id}><${SlotDate} iso=${s.starts_at}/>
        <span class="slot-main"><${Person} p=${st} onOpen=${openProfile} size=${30}/><span class="small">${s.sujet}</span>
          ${s.merci ? html`<span class="small merci-inline"><${Icon} name="heart" size=${14}/> ${s.merci}</span>` : null}</span>
        <span class="mono pts small">+10</span></li>`; })}</ul>` : null}
  </div>`;
}

// Côté étudiant : les prochains créneaux libres, réservables tout de suite
export function ExpressStrip({ ctx, fil }) {
  const { data, me, store, openProfile } = ctx;
  const [book, setBook] = useState(null);
  if (me.role !== 'etudiant') return null;
  const free = data.slots.filter(s => slotState(s) === 'libre' && s.mentor_id !== me.id)
    .map(s => ({ s, m: store.byId('profiles', s.mentor_id) })).filter(x => x.m && (!fil || x.m.filiere === fil))
    .sort((a, b) => byStart(a.s, b.s)).slice(0, 6);
  return html`<div class="express-strip">
    <div class="section-head"><h2 class="h-ico"><${Icon} name="clock"/> 15 minutes avec un lauréat</h2><span class="muted small">Réserve un créneau, sans attendre de réponse</span></div>
    ${free.length ? html`<div class="slot-cards">${free.map(({ s, m }) => html`<div class="slot-card" key=${s.id}>
      <${SlotDate} iso=${s.starts_at}/><${Person} p=${m} onOpen=${openProfile} size=${32}/>
      <span class="small muted"><${Icon} name="pin" size=${13}/> ${s.lieu}</span>
      <button class="btn small primary" onClick=${() => setBook({ s, m })}>Réserver</button></div>`)}</div>`
      : html`<p class="muted small">${fil ? 'Pas de créneau libre dans cette filière pour l’instant.' : 'Pas de créneau libre pour l’instant.'} Tu peux envoyer une demande de mentorat à un lauréat ci-dessous.</p>`}
    ${book ? html`<${BookSlot} ctx=${ctx} s=${book.s} m=${book.m} onClose=${() => setBook(null)}/>` : null}
  </div>`;
}

function BookSlot({ ctx, s, m, onClose }) {
  const { data, store, me, act, scores, go } = ctx;
  const [sujet, setSujet] = useState('');
  const held = data.slots.filter(x => x.student_id === me.id && slotState(x) === 'reserve').length;
  const submit = e => {
    e.preventDefault();
    act(async () => { await store.update('slots', s.id, { student_id: me.id, sujet: sujet.trim() }); toast('C’est réservé ! Le lauréat est prévenu.', 'win'); onClose(); go('reseau/mentorat/rdv'); });
  };
  return html`<${Modal} title="Réserver 15 minutes" onClose=${onClose}>
    <form class="form" onSubmit=${submit}>
      <div class="book-head"><${Avatar} p=${m} size=${44}/><div><strong>${m.full_name}</strong><${RoleLine} p=${m} score=${scores.get(m.id)}/></div></div>
      <p class="book-when"><${SlotDate} iso=${s.starts_at}/><span class="small muted"><${Icon} name="pin" size=${13}/> ${s.lieu}</span></p>
      <${Field} label="De quoi veux-tu parler ?" hint="Une phrase suffit, pour que le lauréat se prépare."><input id="bk-sujet" required maxlength="140" placeholder="Ex. Choisir entre deux sujets de PFE" value=${sujet} onInput=${e => setSujet(e.target.value)}/><//>
      ${held >= 2 ? html`<p class="small warn-t">Tu as déjà 2 rendez-vous à venir. Laisse la place aux autres, puis reviens après.</p>` : null}
      <div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn primary" disabled=${sujet.trim().length < 3 || held >= 2}>Réserver</button></div>
    </form>
  <//>`;
}

// Côté étudiant : ses rendez-vous, puis un merci après l'échange
export function MyBookings({ ctx }) {
  const rows = ctx.data.slots.filter(s => s.student_id === ctx.me.id).sort((a, b) => byStart(b, a));
  if (!rows.length) return null;
  return html`<div class="bookings"><h3 class="sub-title">Mes rendez-vous de 15 min</h3>
    <ul class="slot-list">${rows.slice(0, 8).map(s => html`<${BookingRow} key=${s.id} s=${s} ctx=${ctx}/>`)}</ul></div>`;
}

function BookingRow({ s, ctx }) {
  const { store, act, openProfile } = ctx;
  const st = slotState(s); const m = store.byId('profiles', s.mentor_id);
  const [merci, setMerci] = useState('');
  return html`<li class=${'slot-row' + (st === 'fait' ? ' past' : '')}><${SlotDate} iso=${s.starts_at}/>
    <span class="slot-main"><${Person} p=${m} onOpen=${openProfile} size=${30}/><span class="small">${s.sujet}</span><span class="small muted"><${Icon} name="pin" size=${13}/> ${s.lieu}</span>
      ${st === 'fait' && s.merci ? html`<span class="small merci-inline"><${Icon} name="heart" size=${14}/> ${s.merci}</span>` : null}
      ${st === 'fait' && !s.merci ? html`<form class="comment-form" onSubmit=${e => { e.preventDefault(); act(async () => { await store.update('slots', s.id, { merci: merci.trim() }); toast('Merci envoyé !'); }); }}>
        <input id=${'smerci-' + s.id} maxlength="800" placeholder="Un mot de remerciement pour le lauréat…" value=${merci} onInput=${e => setMerci(e.target.value)}/><button class="btn small primary" disabled=${!merci.trim()}>Remercier</button></form>` : null}</span>
    ${st === 'reserve' ? html`<button class="btn tiny ghost" onClick=${() => ctx.confirm('Annuler ce rendez-vous ? Le créneau redevient libre pour les autres.', () => act(() => store.update('slots', s.id, { student_id: null, sujet: null })), 'Annuler le rendez-vous')}>Annuler</button>`
      : st === 'annule' ? html`<span class="state-pill m-refusee">Annulé</span>` : st === 'fait' ? html`<span class="state-pill m-terminee">Réalisé</span>` : null}
  </li>`;
}

// ---------------------------------------------------------------------------
// Attestation de contribution : imprimable, ajoutable sur LinkedIn, vérifiable par lien
// ---------------------------------------------------------------------------
export const codeOf = id => String(id).replace(/[^0-9a-z]/gi, '').slice(0, 8).toUpperCase().replace(/^(.{4})/, '$1-');
export const verifyUrl = id => `${location.origin}${location.pathname}#verifier/${id}`;
const fmtLong = iso => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const STAT_KEYS = ['mentorats', 'express', 'recrutes', 'reponses'];

function linkedinCertUrl(a) {
  const d = new Date(a.created_at); const enc = encodeURIComponent;
  return `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${enc('Attestation de contribution · Réseau ENSAM Meknès')}&organizationName=${enc('Réseau ENSAM Meknès')}&issueYear=${d.getFullYear()}&issueMonth=${d.getMonth() + 1}&certUrl=${enc(verifyUrl(a.id))}&certId=${enc(codeOf(a.id))}`;
}

function printCertificate() {
  const off = () => { document.body.classList.remove('print-cert'); removeEventListener('afterprint', off); };
  document.body.classList.add('print-cert');
  addEventListener('afterprint', off);
  setTimeout(off, 4000);
  try { window.print(); } catch { off(); toast('Utilise Ctrl+P, ou Partager puis Imprimer sur téléphone.', 'err'); }
}

export function Certificate({ p, a, code, url }) {
  const s = a.stats || {};
  const facts = [
    [s.mentorats, 'mentorat terminé', 'mentorats terminés'],
    [s.express, 'entretien express de 15 minutes', 'entretiens express de 15 minutes'],
    [s.recrutes, 'étudiant recruté et confirmé', 'étudiants recrutés et confirmés'],
    [s.reponses, 'réponse dans l’Entraide', 'réponses dans l’Entraide'],
  ].filter(f => f[0] > 0);
  return html`<div class="certificate">
    <div class="cert-in">
      <div class="cert-top"><${BrandLogo} size=${52}/><span class="cert-org"><strong>Réseau ENSAM Meknès</strong><span>Lauréats & étudiants</span></span></div>
      <p class="cert-kicker">Attestation de contribution</p>
      <p>La plateforme Réseau ENSAM Meknès atteste que</p>
      <p class="cert-name">${p.full_name}</p>
      <p class="cert-sub">${p.filiere} · Promo ${p.promo}</p>
      <p>a accompagné les étudiants de l’école :</p>
      <ul class="cert-facts">${facts.map(([n, one, many]) => html`<li><b class="mono">${n}</b><span>${n > 1 ? many : one}</span></li>`)}</ul>
      <p class="small muted">Chaque action est confirmée par l’étudiant concerné sur la plateforme.</p>
      <div class="cert-foot"><span>Délivrée le ${fmtLong(a.created_at)}</span>${code ? html`<span>Code <b class="mono">${code}</b></span>` : null}</div>
      ${url ? html`<p class="cert-url small">Vérifier : <span class="mono" dir="ltr">${url.replace(/^https?:\/\//, '')}</span></p>` : null}
    </div>
  </div>`;
}

export function AttestationCard({ ctx }) {
  const [open, setOpen] = useState(false);
  return html`<div class="attest-card">
    <span class="attest-ico"><${Icon} name="award" size=${24}/></span>
    <div class="grow"><strong>Attestation de contribution</strong><span class="small muted">Tes mentorats et recrutements confirmés, dans un document à imprimer en PDF ou à ajouter sur LinkedIn, avec un lien de vérification.</span></div>
    <button class="btn small" onClick=${() => setOpen(true)}>Voir mon attestation</button>
    ${open ? html`<${AttestationModal} ctx=${ctx} onClose=${() => setOpen(false)}/>` : null}
  </div>`;
}

function AttestationModal({ ctx, onClose }) {
  const { data, me, store, act } = ctx;
  const now = attestationStats(data, me.id);
  const last = data.attestations.filter(a => a.laureat_id === me.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const current = last && STAT_KEYS.every(k => (last.stats?.[k] || 0) === now[k]) ? last : null;
  if (!now.mentorats && !now.express && !now.recrutes) return html`<${Modal} title="Attestation de contribution" onClose=${onClose}>
    <${Empty} icon="award" title="Bientôt prête">Ton attestation sera disponible après ton premier mentorat terminé, entretien express réalisé ou recrutement confirmé.<//><//>`;
  const shown = current || { stats: now, created_at: new Date().toISOString() };
  return html`<${Modal} title="Attestation de contribution" onClose=${onClose} wide>
    <${Certificate} p=${me} a=${shown} code=${current ? codeOf(current.id) : null} url=${current ? verifyUrl(current.id) : null}/>
    ${current ? html`<div class="row-end wrap cert-actions">
      <button class="btn ghost" onClick=${() => copyText(verifyUrl(current.id), 'Lien de vérification copié.')}><${Icon} name="link" size=${16}/> Copier le lien</button>
      <a class="btn ghost" href=${linkedinCertUrl(current)} target="_blank" rel="noopener"><${Icon} name="share" size=${16}/> Ajouter à mon profil LinkedIn</a>
      <button class="btn primary" onClick=${printCertificate}><${Icon} name="download" size=${16}/> Imprimer ou PDF</button></div>`
    : html`<div class="row-end wrap cert-actions"><p class="small muted grow">${last ? 'Tes chiffres ont changé depuis ta dernière attestation. Crée une version à jour.' : 'Crée ton attestation pour obtenir son code et son lien de vérification.'}</p>
      <button class="btn primary" onClick=${() => act(async () => { await store.insert('attestations', { laureat_id: me.id }); toast('Attestation créée.', 'win'); })}><${Icon} name="award" size=${16}/> Créer mon attestation</button></div>`}
  <//>`;
}

// Page publique : un recruteur ou une RH vérifie une attestation, sans compte
export function VerifyPage({ store, id }) {
  const [res, setRes] = useState(undefined);
  useEffect(() => { let on = true; Promise.resolve(store.verifyAttestation(id)).then(r => on && setRes(r || null), () => on && setRes(null)); return () => { on = false; }; }, [id]);
  return html`<div class="verify-page">
    <a class="brand" href="#accueil"><${BrandLogo} size=${40}/><strong>Réseau ENSAM Meknès</strong></a>
    ${res === undefined ? html`<p class="muted">Vérification en cours…</p>`
      : res ? html`<p class="verify-ok"><${Icon} name="shield" size=${18}/> Attestation authentique, enregistrée sur la plateforme</p><${Certificate} p=${res} a=${res} code=${codeOf(res.id)}/>`
      : html`<div class="verify-ko"><${Icon} name="x" size=${20}/><div><strong>Aucune attestation ne correspond à ce lien.</strong><p class="small muted">Vérifie que le lien est complet, ou demande-le à nouveau à la personne.</p></div></div>`}
  </div>`;
}

// ---------------------------------------------------------------------------
// Fil des réussites : bravos, et partage sur LinkedIn
// ---------------------------------------------------------------------------
const WHAT = { stage: 'son stage', pfe: 'son PFE', etranger: 'son stage à l’étranger', emploi: 'son premier emploi' };

export function SuccessFeed({ ctx }) {
  const { data, me, saison, store, act, openProfile } = ctx;
  const [share, setShare] = useState(null);
  const myN = me.role === 'etudiant' ? niveauOf(me, saison) : null; // un étudiant voit les réussites de sa promo
  const items = data.placements.filter(p => p.saison === saison && FOUND.has(p.status) && (myN === null || p.niveau === myN || p.student_id === me.id))
    .sort((a, b) => new Date(b.confirmed_at || b.created_at) - new Date(a.confirmed_at || a.created_at)).slice(0, 5);
  if (!items.length) return null;
  return html`<div class="panel wins-panel">
    <div class="section-head"><h2 class="h-ico"><${Icon} name="trophy"/> ${myN ? 'Réussites de ma promo' : 'Réussites de la saison'}</h2></div>
    <ul class="wins">${items.map(p => {
      const st = store.byId('profiles', p.student_id); const la = p.status === 'confirme' && p.laureat_id ? store.byId('profiles', p.laureat_id) : null;
      const k = data.kudos.filter(x => x.placement_id === p.id); const mine = k.find(x => x.user_id === me.id);
      const own = p.student_id === me.id || (la && la.id === me.id);
      return html`<li class="win" key=${p.id}>
        <${Avatar} p=${st} size=${38}/>
        <div class="win-txt"><p><button class="linkish strong" onClick=${() => openProfile(st)}>${st?.full_name || 'Un étudiant'}</button> a décroché ${WHAT[p.type]} chez <strong>${p.entreprise}</strong>${la ? html` grâce à <button class="linkish strong" onClick=${() => openProfile(la)}>${la.full_name}</button>` : null}</p>
          <span class="muted small">${p.status === 'confirme' ? 'Vérifié des deux côtés' : 'Trouvé hors plateforme'} · ${timeAgo(p.confirmed_at || p.created_at)}</span></div>
        <div class="win-act">
          <button class=${'kudo' + (mine ? ' on' : '')} aria-pressed=${!!mine} disabled=${p.student_id === me.id} title=${mine ? 'Retirer mon bravo' : 'Dire bravo'} onClick=${() => act(() => (mine ? store.remove('kudos', mine.id) : store.insert('kudos', { placement_id: p.id, user_id: me.id })))}><${Icon} name="clap" size=${16}/><span>Bravo</span>${k.length ? html`<b class="mono">${k.length}</b>` : null}</button>
          ${own ? html`<button class="icon-btn small" aria-label="Partager sur LinkedIn" title="Partager sur LinkedIn" onClick=${() => setShare(p)}><${Icon} name="share" size=${16}/></button>` : null}
        </div>
      </li>`;
    })}</ul>
    ${share ? html`<${ShareModal} ctx=${ctx} pl=${share} onClose=${() => setShare(null)}/>` : null}
  </div>`;
}

const POUR_MOI = { stage: 'mon stage', pfe: 'mon projet de fin d’études', etranger: 'mon stage à l’étranger', emploi: 'mon premier poste d’ingénieur' };
const POUR_LUI = { stage: 'son stage', pfe: 'son projet de fin d’études', etranger: 'son stage', emploi: 'son premier poste d’ingénieur' };

// Texte proposé : l'étudiant parle de lui ; le lauréat ne cite le nom de l'étudiant qu'avec son accord.
export function shareText(store, me, pl) {
  const st = store.byId('profiles', pl.student_id); const la = pl.laureat_id && pl.status === 'confirme' ? store.byId('profiles', pl.laureat_id) : null;
  const lieu = pl.ville ? ` à ${pl.ville}` : '';
  if (pl.student_id === me.id) {
    return `Ravi(e) d’annoncer que je rejoins ${pl.entreprise}${lieu} pour ${POUR_MOI[pl.type]} !`
      + (la ? `\n\nMerci à ${la.full_name}, lauréat(e) de l’ENSAM Meknès, qui m’a ouvert la porte grâce au Réseau ENSAM Meknès.` : '')
      + '\n\n#ENSAM #ENSAMMeknès #ArtsEtMétiers';
  }
  const who = pl.partage_ok ? st?.full_name : 'un(e) étudiant(e) de l’ENSAM Meknès';
  return `Fier(e) d’accueillir ${who} chez ${pl.entreprise}${lieu} pour ${POUR_LUI[pl.type]}.\n\nSur le Réseau ENSAM Meknès, les lauréats partagent leurs offres de stages, de PFE et d’emplois avec les étudiants de l’école. Lauréats, rejoignez-nous !\n\n#ENSAM #ENSAMMeknès #ArtsEtMétiers`;
}

export function ShareModal({ ctx, pl, onClose }) {
  const { store, me } = ctx;
  const [text, setText] = useState(() => shareText(store, me, pl));
  const st = store.byId('profiles', pl.student_id);
  const anonymous = pl.student_id !== me.id && !pl.partage_ok;
  return html`<${Modal} title="Partager sur LinkedIn" onClose=${onClose}>
    <div class="form">
      <p class="small muted">LinkedIn ouvre une nouvelle publication avec ce texte. Tu peux le modifier ici avant.</p>
      ${anonymous ? html`<p class="small hint-box"><${Icon} name="shield" size=${15}/> <span>${firstName(st)} n’a pas autorisé que son nom soit publié : le texte reste anonyme.</span></p>` : null}
      <textarea id="share-txt" rows="7" maxlength="2500" value=${text} onInput=${e => setText(e.target.value)}></textarea>
      <div class="row-end wrap">
        <button type="button" class="btn ghost" onClick=${() => copyText(text, 'Texte copié.')}><${Icon} name="copy" size=${16}/> Copier le texte</button>
        <a class="btn primary" href=${'https://www.linkedin.com/feed/?shareActive=true&text=' + encodeURIComponent(text)} target="_blank" rel="noopener"><${Icon} name="share" size=${16}/> Ouvrir LinkedIn</a>
      </div>
    </div>
  <//>`;
}
