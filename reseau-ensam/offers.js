// Offres : liste compacte, fiche détaillée, candidature, gestion des candidats par le lauréat.
import { html, useState, useMemo } from './vendor/preact-htm.js';
import { Icon, Modal, Field, Empty, Person, Avatar, CompanyLogo, TYPE_ICON, toast } from './ui.js';
import { getLang } from './i18n.js';
import { TYPES, FILIERES, NIVEAUX, OBJECTIFS, niveauOf, timeAgo, daysUntil, placementOf, offerMatch, talentsFor } from './logic.js';

const ANNEES_OPTS = [[3, '3A'], [4, '4A'], [5, '5A'], [6, 'Jeunes diplômés']];
export const APP_STATUS = { postule: 'Envoyée', entretien: 'Entretien', retenu: 'Retenu(e)', refuse: 'Pas retenu(e)' };

export function matchesMe(o, me, saison) {
  const n = niveauOf(me, saison);
  return (o.annees || []).includes(n) && (!o.filieres?.length || o.filieres.includes(me.filiere));
}

export function OffersPage(ctx) {
  const { data, me, saison, openOffer } = ctx;
  const isStudent = me.role === 'etudiant';
  const niveau = niveauOf(me, saison);
  const myTypes = isStudent ? (OBJECTIFS[niveau]?.types || []) : Object.keys(TYPES);
  const [vue, setVue] = useState('toutes');
  const [type, setType] = useState('tous');
  const [q, setQ] = useState('');
  const [compose, setCompose] = useState(false);

  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return data.offers.filter(o => {
      if (vue === 'miennes') { if (o.author_id !== me.id) return false; }
      else if (o.status !== 'ouverte' && vue !== 'sauvees') return false;
      if (isStudent && !(o.annees || []).includes(niveau)) return false; // un étudiant ne voit que les offres de son année
      if (vue === 'sauvees' && !data.reactions.some(r => r.offer_id === o.id && r.user_id === me.id && r.kind === 'save')) return false;
      if (type !== 'tous' && o.type !== type) return false;
      if (qq && !`${o.titre} ${o.entreprise} ${o.ville} ${o.pays} ${(o.filieres || []).join(' ')}`.toLowerCase().includes(qq)) return false;
      return true;
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [data, q, type, vue]);
  const plain = vue === 'toutes' && type === 'tous' && !q.trim();
  const chips = [['tous', 'Tout'], ...myTypes.map(k => [k, TYPES[k].label])];

  return html`<section class="page">
    <header class="page-head">
      <div><p class="eyebrow">${isStudent ? `Pour ${NIVEAUX[niveau]?.label?.toLowerCase() || 'toi'} · partagées par les lauréats` : 'Partagées par les lauréats'}</p><h1>Offres</h1></div>
      ${!isStudent ? html`<button class="btn primary" onClick=${() => setCompose(true)}><${Icon} name="plus"/> Publier une offre</button>` : null}
    </header>
    <div class="toolbar">
      <label class="search grow"><${Icon} name="search" size=${16}/><input id="f-q" placeholder="Entreprise, ville, filière…" value=${q} onInput=${e => setQ(e.target.value)}/></label>
      ${!isStudent ? html`<div class="seg" role="group" aria-label="Vue">${[['toutes', 'Toutes'], ['miennes', 'Mes offres']].map(([k, l]) => html`<button class=${vue === k ? 'on' : ''} onClick=${() => setVue(k)}>${l}</button>`)}</div>` : null}
    </div>
    <div class="chips" role="group" aria-label="Type d’offre">
      ${chips.length > 2 ? chips.map(([k, l]) => html`<button class=${'chip t-' + k + (type === k ? ' on' : '')} aria-pressed=${type === k} onClick=${() => setType(k)}>${k !== 'tous' ? html`<${Icon} name=${TYPE_ICON[k]} size=${15}/>` : null}${l}</button>`) : null}
      ${isStudent ? html`<button class=${'chip' + (vue === 'sauvees' ? ' on' : '')} aria-pressed=${vue === 'sauvees'} onClick=${() => setVue(vue === 'sauvees' ? 'toutes' : 'sauvees')}><${Icon} name="bookmark" size=${14}/> Sauvegardées</button>` : null}
    </div>
    ${isStudent && plain && list.length > 5 ? html`<${RecoOffers} ctx=${ctx} max=${3} inOffres/>` : null}
    ${isStudent && plain && list.length > 5 ? html`<div class="section-head"><h2>${NIVEAUX[niveau]?.short ? `Toutes les offres de ${NIVEAUX[niveau].short}` : 'Toutes les offres'}</h2><span class="muted small">${list.length}</span></div>` : null}
    <div class="offer-grid">
      ${list.length ? list.map(o => html`<${OfferCard} key=${o.id} o=${o} ctx=${ctx} onOpen=${() => openOffer(o.id)}/>`) : html`<${Empty} icon="feed" title=${vue === 'sauvees' ? 'Aucune offre sauvegardée' : 'Aucune offre ici'}>${vue === 'sauvees' ? 'Clique sur le marque-page d’une offre pour la garder ici.' : 'Change la recherche ou reviens bientôt : les lauréats publient régulièrement.'}<//>`}
    </div>
    ${compose ? html`<${OfferComposer} ctx=${ctx} onClose=${() => setCompose(false)}/>` : null}
  </section>`;
}

// Offres recommandées à un étudiant : sa filière, ses compétences retrouvées dans l'offre, sa ville
export function RecoOffers({ ctx, max = 3, inOffres = false }) {
  const { data, me, saison, openOffer, go } = ctx;
  const n = niveauOf(me, saison);
  const reco = data.offers.filter(o => o.status === 'ouverte' && (o.annees || []).includes(n) && !data.applications.some(a => a.offer_id === o.id && a.student_id === me.id))
    .map(o => ({ o, ...offerMatch(o, me) })).sort((a, b) => b.score - a.score || new Date(b.o.created_at) - new Date(a.o.created_at)).slice(0, max);
  return html`<div class="reco">
    <div class="section-head"><h2 class="h-ico"><${Icon} name="spark"/> Recommandé pour toi</h2>${inOffres ? null : html`<button class="btn tiny ghost" onClick=${() => go('offres')}>Toutes les offres <${Icon} name="arrow" size=${14}/></button>`}</div>
    <div class="offer-grid one">${reco.length ? reco.map(({ o, why }) => html`<${OfferCard} key=${o.id} o=${o} ctx=${ctx} why=${why} onOpen=${() => openOffer(o.id)}/>`) : html`<${Empty} icon="feed" title="Pas encore d’offre pour ton niveau">Elles arrivent vite. En attendant, demande un conseil à un lauréat dans Mentorat.<//>`}</div>
  </div>`;
}

// Carte compacte : un seul geste, ouvrir la fiche. Seule exception : sauvegarder.
export function OfferCard({ o, ctx, onOpen, why }) {
  const { data, me, store, act } = ctx;
  const author = store.byId('profiles', o.author_id);
  const saved = data.reactions.find(r => r.offer_id === o.id && r.user_id === me.id && r.kind === 'save');
  const apps = data.applications.filter(a => a.offer_id === o.id);
  const myApp = apps.find(a => a.student_id === me.id);
  const dl = daysUntil(o.deadline);
  const mine = o.author_id === me.id;
  const canApply = !myApp && !mine && me.role === 'etudiant' && o.status === 'ouverte';
  return html`<article class=${'ocard' + (o.status !== 'ouverte' ? ' closed' : '')}>
    <button class="ocard-main" onClick=${onOpen} aria-label=${`Ouvrir : ${o.titre}`}>
      <${CompanyLogo} name=${o.entreprise}/>
      <span class="ocard-txt">
        <span class="ocard-tags"><span class=${'tag t-' + o.type}><${Icon} name=${TYPE_ICON[o.type]} size=${13}/>${TYPES[o.type]?.label}</span>
          ${o.status === 'ouverte' && dl !== null && dl >= 0 && dl <= 7 ? html`<span class="tag urgent">${dl === 0 ? 'Dernier jour' : `J-${dl}`}</span>` : null}
          ${o.status !== 'ouverte' ? html`<span class="tag done">${o.status === 'pourvue' ? 'Pourvue' : 'Fermée'}</span>` : null}
          ${o.cooptation && o.status === 'ouverte' ? html`<span class="tag coopt">Cooptation</span>` : null}</span>
        <strong class="ocard-title">${o.titre}</strong>
        <span class="ocard-meta">${o.entreprise} · ${[o.ville, o.pays !== 'Maroc' ? o.pays : ''].filter(Boolean).join(', ')}</span>
        ${why?.length ? html`<span class="why">${why.map(w => html`<span class="mini good">${w}</span>`)}</span>` : null}
      </span>
    </button>
    <footer class="ocard-foot">
      ${author ? html`<span class="ocard-author"><${Avatar} p=${author} size=${22}/><span>${author.full_name.split(' ')[0]} · promo ${author.promo}</span></span>` : null}
      <span class="spacer"></span>
      ${myApp ? html`<span class=${'state-pill a-' + myApp.status}>${APP_STATUS[myApp.status]}</span>` : mine ? html`<span class="muted small">${apps.length} candidat${apps.length > 1 ? 's' : ''}</span>` : canApply ? null : html`<span class="muted small nowrap">${timeAgo(o.created_at)}</span>`}
      ${canApply ? html`<button class="btn tiny primary" onClick=${() => ctx.openOffer(o.id, true)}>Postuler</button>` : null}
      ${!mine ? html`<button class=${'icon-btn small' + (saved ? ' on' : '')} aria-pressed=${!!saved} aria-label=${saved ? 'Retirer des sauvegardes' : 'Sauvegarder'} onClick=${() => act(() => saved ? store.remove('reactions', saved.id) : store.insert('reactions', { offer_id: o.id, user_id: me.id, kind: 'save' }))}><${Icon} name="bookmark" size=${16}/></button>` : null}
    </footer>
  </article>`;
}

// Fiche complète d'une offre
export function OfferDetail({ ctx, id, onClose, apply }) {
  const { data, me, store, act, openProfile } = ctx;
  const o = store.byId('offers', id);
  const mine = o?.author_id === me.id;
  const isAdmin = me.role === 'admin';
  const [tab, setTab] = useState(mine ? 'candidats' : 'offre');
  const [edit, setEdit] = useState(false);
  const [menu, setMenu] = useState(false);
  if (!o) return html`<${Modal} title="Offre" onClose=${onClose}><p>Cette offre a été supprimée.</p><//>`;
  if (edit) return html`<${OfferComposer} ctx=${ctx} offer=${o} onClose=${() => setEdit(false)}/>`;
  const author = store.byId('profiles', o.author_id);
  const apps = data.applications.filter(a => a.offer_id === o.id);
  const comments = data.comments.filter(c => c.offer_id === o.id);
  const dl = o.deadline ? new Date(o.deadline + 'T12:00:00') : null;
  const facts = [
    ['Type', TYPES[o.type]?.long, TYPE_ICON[o.type]],
    ['Lieu', [o.ville, o.pays].filter(Boolean).join(', '), 'pin'],
    o.duree ? ['Durée', o.duree + (o.remunere ? ' · rémunéré' : ''), 'clock'] : null,
    dl ? ['Date limite', dl.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }), 'calendar'] : null,
    ['Pour', [...(o.annees || []).map(a => NIVEAUX[a]?.short), ...(o.filieres?.length ? o.filieres : ['toutes filières'])].join(' · '), 'people'],
  ].filter(Boolean);

  return html`<${Modal} title=${o.entreprise} onClose=${onClose} wide>
    <div class="detail">
      <div class="detail-head">
        <${CompanyLogo} name=${o.entreprise} size=${56}/>
        <div class="detail-title"><span class=${'tag t-' + o.type}><${Icon} name=${TYPE_ICON[o.type]} size=${13}/>${TYPES[o.type]?.label}</span>${o.status !== 'ouverte' ? html` <span class="tag done">${o.status === 'pourvue' ? 'Pourvue' : 'Fermée'}</span>` : null}
          <h2>${o.titre}</h2><p class="muted small">Publiée ${timeAgo(o.created_at)}</p></div>
        ${(mine || isAdmin) ? html`<div class="menu-wrap"><button class="icon-btn" aria-label="Gérer l’offre" aria-expanded=${menu} onClick=${() => setMenu(!menu)}><${Icon} name="more"/></button>
          ${menu ? html`<div class="menu-pop">
            ${mine ? html`<button onClick=${() => { setMenu(false); setEdit(true); }}><${Icon} name="edit" size=${16}/> Modifier</button>` : null}
            <button onClick=${() => { setMenu(false); act(() => store.update('offers', o.id, { status: o.status === 'ouverte' ? 'pourvue' : 'ouverte' })); }}><${Icon} name="check" size=${16}/> ${o.status === 'ouverte' ? 'Marquer pourvue' : 'Rouvrir l’offre'}</button>
            <button class="danger-t" onClick=${() => { setMenu(false); ctx.confirm('Supprimer définitivement cette offre ?', () => act(async () => { await store.remove('offers', o.id); onClose(); })); }}><${Icon} name="trash" size=${16}/> Supprimer</button>
          </div>` : null}</div>` : null}
      </div>
      ${mine ? html`<div class="seg"><button class=${tab === 'candidats' ? 'on' : ''} onClick=${() => setTab('candidats')}>Candidats (${apps.length})</button><button class=${tab === 'offre' ? 'on' : ''} onClick=${() => setTab('offre')}>L’offre</button><button class=${tab === 'questions' ? 'on' : ''} onClick=${() => setTab('questions')}>Questions (${comments.length})</button></div>` : null}

      ${tab === 'candidats' && mine ? html`<${Candidates} ctx=${ctx} o=${o} apps=${apps}/>` : null}

      ${tab === 'offre' ? html`
        <dl class="facts">${facts.map(([k, v, i]) => html`<div><dt><${Icon} name=${i} size=${15}/> ${k}</dt><dd>${v}</dd></div>`)}</dl>
        <div class="prose"><p>${o.description}</p></div>
        ${o.lien ? html`<p><a href=${o.lien.startsWith('http') ? o.lien : 'https://' + o.lien} target="_blank" rel="noopener"><${Icon} name="link" size=${15}/> Voir l’annonce complète</a></p>` : null}
        ${author && !mine ? html`<div class="author-box"><${Person} p=${author} score=${ctx.scores.get(author.id)} onOpen=${openProfile} size=${40}/>
          <p class="small muted">${o.cooptation ? `${author.full_name.split(' ')[0]} peut recommander directement ton profil en interne.` : `${author.full_name.split(' ')[0]} reçoit ta candidature et te répond ici.`}</p></div>` : null}
        ${!mine && me.role !== 'admin' ? html`<${ApplyBox} ctx=${ctx} o=${o} start=${apply}/>` : null}
        ${!mine ? html`<${Questions} ctx=${ctx} o=${o} comments=${comments}/>` : null}` : null}

      ${tab === 'questions' && mine ? html`<${Questions} ctx=${ctx} o=${o} comments=${comments}/>` : null}
    </div>
  <//>`;
}

// Côté étudiant : postuler, puis suivre le statut que le lauréat met à jour
function ApplyBox({ ctx, o, start }) {
  const { data, me, store, act, saison } = ctx;
  const app = data.applications.find(a => a.offer_id === o.id && a.student_id === me.id);
  const [open, setOpen] = useState(!!start);
  const [msg, setMsg] = useState('');
  const pl = placementOf(data, me.id, saison);
  if (app) {
    const steps = ['postule', 'entretien', 'retenu'];
    const idx = app.status === 'refuse' ? -1 : steps.indexOf(app.status);
    return html`<div class="apply-box">
      <p class="eyebrow">Ma candidature</p>
      ${app.status === 'refuse' ? html`<p><span class="state-pill a-refuse">Pas retenu(e)</span> <span class="small muted">Ce n’est pas pour cette fois. Les autres offres t’attendent.</span></p>` : html`
      <ol class="stepper">${steps.map((s, i) => html`<li class=${i <= idx ? 'done' : ''}><span class="step-dot">${i <= idx ? html`<${Icon} name="check" size=${13}/>` : i + 1}</span>${APP_STATUS[s]}</li>`)}</ol>`}
      <p class="small muted">Le lauréat met à jour ce statut. ${app.status === 'retenu' ? (pl?.status === 'en_attente' ? 'Confirme ton recrutement dans « Mon parcours ».' : '') : `Envoyée ${timeAgo(app.created_at)}.`}</p>
      ${app.status === 'postule' ? html`<button class="btn ghost small" onClick=${() => act(() => store.remove('applications', app.id))}>Retirer ma candidature</button>` : null}
    </div>`;
  }
  if (o.status !== 'ouverte') return html`<div class="apply-box"><p class="muted">Cette offre n’accepte plus de candidatures.</p></div>`;
  // Un lauréat a invité cet étudiant depuis le vivier de talents
  const inv = (data.invitations || []).find(i => i.offer_id === o.id && i.student_id === me.id && i.status === 'envoyee');
  const invite = inv ? html`<div class="invite-note"><${Icon} name="send" size=${16}/><div><p><strong>${store.byId('profiles', inv.laureat_id)?.full_name || 'Un lauréat'}</strong> t’a invité(e) à postuler.</p>
    ${inv.message ? html`<p class="quote small">${inv.message}</p>` : null}
    <button class="linkish small" onClick=${() => act(async () => { await store.update('invitations', inv.id, { status: 'declinee' }); toast('C’est noté, merci d’avoir répondu.'); })}>Pas intéressé(e)</button></div></div>` : null;
  if (!open) return html`${invite}<div class="apply-box cta"><div><strong>Intéressé(e) ?</strong><p class="small muted">Le lauréat verra ton profil${me.cv_url ? ' et ton CV' : ''}.</p></div><button class="btn primary" onClick=${() => setOpen(true)}><${Icon} name="send" size=${16}/> Postuler</button></div>`;
  return html`<form class="apply-box form" onSubmit=${e => { e.preventDefault(); act(async () => { await store.insert('applications', { student_id: me.id, offer_id: o.id, entreprise: o.entreprise, titre: o.titre, message: msg.trim(), status: 'postule' }); toast('Candidature envoyée à ' + (store.byId('profiles', o.author_id)?.full_name || 'au lauréat') + '.'); }); }}>
    <${Field} label="Message au lauréat" hint="Deux ou trois phrases : qui tu es, pourquoi cette offre."><textarea id="ap-msg" rows="3" maxlength="1500" value=${msg} onInput=${e => setMsg(e.target.value)} placeholder="Bonjour, je suis en 5A Génie Industriel…"></textarea><//>
    ${!me.cv_url ? html`<p class="small warn-t"><${Icon} name="file" size=${14}/> Ajoute le lien de ton CV dans ton profil pour qu’il soit joint automatiquement.</p>` : html`<p class="small muted"><${Icon} name="file" size=${14}/> Ton CV sera joint.</p>`}
    <div class="row-end"><button type="button" class="btn ghost" onClick=${() => setOpen(false)}>Annuler</button><button class="btn primary">Envoyer ma candidature</button></div>
  </form>`;
}

// Côté lauréat : les candidats de son offre, et la déclaration de recrutement
function Candidates({ ctx, o, apps }) {
  const { data, store, act, openProfile, saison } = ctx;
  const [declare, setDeclare] = useState(false);
  const sorted = [...apps].sort((a, b) => ['postule', 'entretien', 'retenu', 'refuse'].indexOf(a.status) - ['postule', 'entretien', 'retenu', 'refuse'].indexOf(b.status));
  const recruit = (studentId, app) => act(async () => {
    const st = store.byId('profiles', studentId);
    const existing = placementOf(data, studentId, saison);
    if (existing && existing.status !== 'refuse') { toast(`${st.full_name} a déjà une réussite enregistrée cette saison.`, 'err'); return; }
    if (app) await store.update('applications', app.id, { status: 'retenu' });
    await store.insert('placements', { student_id: studentId, offer_id: o.id, laureat_id: ctx.me.id, saison, niveau: Math.min(niveauOf(st, saison), 6), type: o.type, entreprise: o.entreprise, ville: o.ville, pays: o.pays || 'Maroc', source: 'plateforme' });
    toast(`${st.full_name.split(' ')[0]} doit maintenant confirmer. Tes 50 points arrivent dès sa confirmation.`);
  });
  return html`<div class="cands">
    ${sorted.length ? sorted.map(a => {
      const st = store.byId('profiles', a.student_id);
      const pl = data.placements.find(p => p.student_id === a.student_id && p.offer_id === o.id && p.status !== 'refuse');
      return html`<div class="cand" key=${a.id}>
        <div class="cand-head"><${Person} p=${st} onOpen=${openProfile} size=${36}/><span class="spacer"></span>${(data.invitations || []).some(i => i.offer_id === o.id && i.student_id === a.student_id) ? html`<span class="mini good">Invité(e) par toi</span>` : null}<span class="muted small">${timeAgo(a.created_at)}</span></div>
        ${a.message ? html`<p class="quote">${a.message}</p>` : null}
        ${st?.cv_url ? html`<a class="small" href=${st.cv_url.startsWith('http') ? st.cv_url : 'https://' + st.cv_url} target="_blank" rel="noopener"><${Icon} name="file" size=${14}/> Voir le CV</a>` : null}
        ${pl ? html`<p class=${'state-pill ' + (pl.status === 'confirme' ? 's-trouve' : 's-validation')}>${pl.status === 'confirme' ? 'Recrutement confirmé par l’étudiant' : 'Recruté(e) · attend sa confirmation'}</p>` : html`
        <div class="seg small-seg" role="group" aria-label="Statut de la candidature">
          ${[['postule', 'Reçue'], ['entretien', 'Entretien'], ['refuse', 'Pas retenu(e)']].map(([k, l]) => html`<button class=${a.status === k ? 'on' : ''} onClick=${() => act(() => store.update('applications', a.id, { status: k }))}>${l}</button>`)}
          <button class="seg-accent" onClick=${() => recruit(a.student_id, a)}><${Icon} name="check" size=${14}/> Recruté(e)</button>
        </div>`}
      </div>`;
    }) : html`<${Empty} icon="inbox" title="Pas encore de candidat">Partage l’offre dans les groupes de promo : les étudiants concernés la voient déjà dans « Pour moi ».<//>`}
    <${Matching} ctx=${ctx} o=${o}/>
    <button class="btn ghost small" onClick=${() => setDeclare(true)}><${Icon} name="plus" size=${15}/> J’ai recruté un étudiant qui n’a pas postulé ici</button>
    ${declare ? html`<${PickStudent} ctx=${ctx} onClose=${() => setDeclare(false)} onPick=${id => { setDeclare(false); recruit(id, null); }}/>` : null}
  </div>`;
}

// Profils en recherche qui correspondent à l'offre : une invitation à postuler en un clic
function Matching({ ctx, o }) {
  const { data, me, saison, store, act, openProfile } = ctx;
  if (o.status !== 'ouverte') return null;
  const list = talentsFor(data, o, saison);
  if (!list.length) return null;
  const invited = id => data.invitations.some(i => i.offer_id === o.id && i.student_id === id);
  const invite = p => act(async () => {
    const msg = getLang() === 'ar' ? `السلام ${p.full_name.split(' ')[0]}، ملفك يهمني لهذا العرض. ترشّح إذا أعجبك!` : `Bonjour ${p.full_name.split(' ')[0]}, ton profil m’intéresse pour cette offre. Postule si ça te parle !`;
    await store.insert('invitations', { laureat_id: me.id, student_id: p.id, offer_id: o.id, message: msg });
    toast(`Invitation envoyée à ${p.full_name.split(' ')[0]}.`);
  });
  return html`<div class="matching"><p class="small"><${Icon} name="spark" size=${14}/> <strong>Profils qui correspondent à ton offre</strong></p>
    <ul class="people-list">${list.map(({ p, why }) => html`<li key=${p.id}><${Person} p=${p} onOpen=${openProfile} size=${32}/><span class="why">${why.map(w => html`<span class="mini good">${w}</span>`)}</span><span class="spacer"></span>
      ${invited(p.id) ? html`<span class="state-pill s-validation">Invité(e)</span>` : html`<button class="btn small" onClick=${() => invite(p)}><${Icon} name="send" size=${14}/> Inviter à postuler</button>`}</li>`)}</ul></div>`;
}

function PickStudent({ ctx, onClose, onPick }) {
  const { data, saison } = ctx;
  const [q, setQ] = useState('');
  const res = q.trim().length < 2 ? [] : data.profiles.filter(p => p.role !== 'admin' && niveauOf(p, saison) <= 6 && p.full_name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8);
  return html`<${Modal} title="Quel étudiant as-tu recruté ?" onClose=${onClose}>
    <p class="muted small">Il ou elle recevra une demande de confirmation. Le recrutement compte une fois confirmé.</p>
    <label class="search"><${Icon} name="search" size=${16}/><input id="pick-q" placeholder="Nom de l’étudiant" value=${q} onInput=${e => setQ(e.target.value)}/></label>
    <ul class="people-list">${res.map(p => html`<li><${Person} p=${p}/><button class="btn small primary" onClick=${() => onPick(p.id)}>Choisir</button></li>`)}</ul>
    ${q.trim().length >= 2 && !res.length ? html`<p class="muted small">Personne avec ce nom. L’étudiant doit d’abord créer son compte.</p>` : null}
  <//>`;
}

function Questions({ ctx, o, comments }) {
  const { store, me, act, openProfile } = ctx;
  const [txt, setTxt] = useState('');
  const sorted = [...comments].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return html`<div class="comments">
    <h3>Questions publiques <span class="count">${comments.length}</span></h3>
    ${sorted.map(c => { const a = store.byId('profiles', c.author_id); return html`<div class="comment" key=${c.id}>
      <${Avatar} p=${a} size=${28}/>
      <div class="comment-body"><button class="linkish" onClick=${() => openProfile(a)}>${a?.full_name || 'Membre'}</button>${a?.id === o.author_id ? html` <span class="mini">Auteur de l’offre</span>` : null} <span class="muted small">${timeAgo(c.created_at)}</span><p>${c.body}</p></div>
      ${(c.author_id === me.id || me.role === 'admin') ? html`<button class="icon-btn small" aria-label="Supprimer" onClick=${() => act(() => store.remove('comments', c.id))}><${Icon} name="x" size=${14}/></button>` : null}
    </div>`; })}
    <form class="comment-form" onSubmit=${e => { e.preventDefault(); if (!txt.trim()) return; act(async () => { await store.insert('comments', { offer_id: o.id, author_id: me.id, body: txt.trim() }); setTxt(''); }); }}>
      <input id=${'c-' + o.id} placeholder=${o.author_id === me.id ? 'Répondre…' : 'Une question sur l’offre ? Tout le monde verra la réponse.'} value=${txt} onInput=${e => setTxt(e.target.value)} maxlength="1500"/>
      <button class="btn small" type="submit" disabled=${!txt.trim()}>Envoyer</button>
    </form>
  </div>`;
}

export function OfferComposer({ ctx, offer, onClose }) {
  const { store, me, act } = ctx;
  const editing = !!offer?.id;
  const [f, setF] = useState(() => ({
    type: 'stage', titre: '', entreprise: me.entreprise || '', ville: me.ville || '', pays: me.pays || 'Maroc', filieres: [], annees: [3, 4], description: '', contact: '', lien: '', deadline: '', cooptation: false, remunere: false, duree: '', ...(offer || {}),
  }));
  const set = (k, v) => setF({ ...f, [k]: v });
  const toggleIn = (k, v) => set(k, f[k].includes(v) ? f[k].filter(x => x !== v) : [...f[k], v]);
  const setType = t => setF({ ...f, type: t, annees: t === 'pfe' ? [5] : t === 'emploi' ? [6] : t === 'etranger' ? [4, 5] : [3, 4] });
  const valid = f.titre.trim().length >= 4 && f.entreprise.trim() && f.description.trim() && f.annees.length;
  const submit = e => {
    e.preventDefault(); if (!valid) return;
    const row = { type: f.type, titre: f.titre.trim(), entreprise: f.entreprise.trim(), ville: f.ville.trim(), pays: f.pays.trim() || 'Maroc', filieres: f.filieres, annees: f.annees, description: f.description.trim(), contact: f.contact.trim(), lien: f.lien.trim(), deadline: f.deadline || null, cooptation: f.cooptation, remunere: f.remunere, duree: f.duree.trim() };
    act(async () => {
      if (editing) { await store.update('offers', offer.id, row); toast('Offre mise à jour.'); }
      else { await store.insert('offers', { ...row, author_id: me.id, status: 'ouverte' }); toast('Offre publiée. Les étudiants concernés la voient dans « Pour moi ».'); }
      onClose();
    });
  };
  return html`<${Modal} title=${editing ? 'Modifier l’offre' : 'Publier une offre'} onClose=${onClose} wide>
    <form class="form" onSubmit=${submit}>
      <div class="type-pick" role="group" aria-label="Type">${Object.entries(TYPES).map(([k, v]) => html`<button type="button" class=${'type-opt t-' + k + (f.type === k ? ' on' : '')} onClick=${() => setType(k)}><${Icon} name=${TYPE_ICON[k]} size=${22}/><span>${v.label}</span></button>`)}</div>
      <${Field} label="Intitulé"><input id="of-titre" required value=${f.titre} onInput=${e => set('titre', e.target.value)} placeholder="Ex. PFE : optimisation d’une ligne d’assemblage" maxlength="140"/><//>
      <div class="grid3">
        <${Field} label="Entreprise"><input id="of-ent" required value=${f.entreprise} onInput=${e => set('entreprise', e.target.value)}/><//>
        <${Field} label="Ville"><input id="of-ville" value=${f.ville} onInput=${e => set('ville', e.target.value)}/><//>
        <${Field} label="Pays"><input id="of-pays" value=${f.pays} onInput=${e => set('pays', e.target.value)}/><//>
      </div>
      <${Field} label="Description"><textarea id="of-desc" required rows="5" value=${f.description} onInput=${e => set('description', e.target.value)} placeholder="Missions, profil recherché, comment se passe la sélection…" maxlength="4000"></textarea><//>
      <${Field} label="Pour quels niveaux ?"><div class="chips">${ANNEES_OPTS.map(([v, l]) => html`<button type="button" class=${'chip' + (f.annees.includes(v) ? ' on' : '')} onClick=${() => toggleIn('annees', v)}>${l}</button>`)}</div><//>
      <details class="more-fields" open=${editing}>
        <summary>Plus de détails (facultatif)</summary>
        <div class="form">
          <${Field} label="Filières" hint="Aucune sélection = toutes les filières"><div class="chips">${FILIERES.map(v => html`<button type="button" class=${'chip' + (f.filieres.includes(v) ? ' on' : '')} onClick=${() => toggleIn('filieres', v)}>${v}</button>`)}</div><//>
          <div class="grid3">
            <${Field} label="Durée"><input id="of-duree" value=${f.duree} onInput=${e => set('duree', e.target.value)} placeholder="6 mois, CDI…"/><//>
            <${Field} label="Date limite"><input id="of-dl" type="date" value=${f.deadline || ''} onInput=${e => set('deadline', e.target.value)}/><//>
            <${Field} label="Lien vers l’annonce"><input id="of-lien" value=${f.lien} onInput=${e => set('lien', e.target.value)} placeholder="https://…"/><//>
          </div>
          <label class="check"><input id="of-coopt" type="checkbox" checked=${f.cooptation} onChange=${e => set('cooptation', e.target.checked)}/> Je peux recommander (coopter) les bons profils</label>
          <label class="check"><input id="of-rem" type="checkbox" checked=${f.remunere} onChange=${e => set('remunere', e.target.checked)}/> Rémunéré / gratifié</label>
        </div>
      </details>
      <p class="small muted">Les candidatures arrivent ici, dans l’onglet « Candidats » de ton offre. Tu n’as pas besoin de donner ton email.</p>
      <div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn primary" type="submit" disabled=${!valid}>${editing ? 'Enregistrer' : 'Publier'}</button></div>
    </form>
  <//>`;
}
