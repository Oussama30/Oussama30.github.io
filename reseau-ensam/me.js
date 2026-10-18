// « Mon parcours » (étudiants) et « Mon espace » (lauréats).
import { html, useState } from './vendor/preact-htm.js';
import { Icon, Modal, Field, Empty, Person, Bar, toast, LevelChip, CompanyLogo, TYPE_ICON } from './ui.js';
import { OBJECTIFS, NIVEAUX, TYPES, niveauOf, statutOf, typeForNiveau, seasonLabel, timeAgo, levelOf, BADGES, badgesOf, BAREME, computeScores, NIVEAUX_IMPACT } from './logic.js';
import { APP_STATUS, OfferComposer } from './offers.js';

// Étapes vues par l'étudiant : il postule, le lauréat fait avancer, l'étudiant confirme.
const JOURNEY = [['send', 'Je postule'], ['people', 'Entretien'], ['briefcase', 'Recruté(e)'], ['check', 'Confirmé']];
export function journeyStep(st, apps) {
  if (st.key === 'trouve') return 4;
  if (st.key === 'validation') return 3;
  if (apps.some(a => a.status === 'entretien')) return 2;
  if (apps.some(a => a.status !== 'refuse')) return 1;
  return 0;
}

export function Journey({ step }) {
  return html`<ol class="journey">${JOURNEY.map(([ic, l], i) => html`<li class=${i < step ? 'done' : i === step ? 'next' : ''}><span class="j-dot"><${Icon} name=${i < step ? 'check' : ic} size=${16}/></span><span class="j-lbl">${l}</span></li>`)}</ol>`;
}

export function ParcoursPage(ctx) {
  const { data, me, saison, store, act, openOffer } = ctx;
  const n = niveauOf(me, saison);
  const obj = OBJECTIFS[n];
  const st = statutOf(data, me, saison);
  const pl = st.pl;
  const [declare, setDeclare] = useState(false);
  const [addApp, setAddApp] = useState(false);
  const apps = data.applications.filter(a => a.student_id === me.id).sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
  const history = data.placements.filter(p => p.student_id === me.id && p.saison !== saison && p.status !== 'refuse').sort((a, b) => b.saison - a.saison);
  const helper = pl?.laureat_id ? store.byId('profiles', pl.laureat_id) : null;
  const step = journeyStep(st, apps);

  return html`<section class="page">
    <header class="page-head"><div><p class="eyebrow">Saison ${seasonLabel(saison)} · ${NIVEAUX[n]?.label}</p><h1>Mon parcours</h1></div></header>

    ${pl?.status === 'en_attente' ? html`<${ConfirmRecruit} ctx=${ctx} pl=${pl} helper=${helper}/>` : null}

    <div class=${'objective st-' + st.key}>
      <div class="objective-top">
        <span class="obj-ico"><${Icon} name=${obj ? TYPE_ICON[obj.types[0]] : 'cap'} size=${24}/></span>
        <div class="objective-main">
          <p class="eyebrow">Mon objectif cette saison</p>
          <h2>${obj ? obj.titre : 'Pas d’objectif de placement cette année'}</h2>
          ${obj ? html`<p class="muted small">Les lauréats sont là pour t’aider. Avance à ton rythme.</p>` : html`<p class="muted small">En cycle préparatoire, profite de l’Entraide et du mentorat pour préparer ton premier stage.</p>`}
        </div>
        <span class=${'state-pill s-' + st.key}>${st.label}</span>
      </div>
      ${obj ? html`<${Journey} step=${step}/>` : null}
      ${pl && pl.status !== 'en_attente' ? html`<div class="found-line"><${CompanyLogo} name=${pl.entreprise} size=${36}/><span><strong>${pl.entreprise}</strong>${pl.ville ? `, ${pl.ville}` : ''}${pl.pays && pl.pays !== 'Maroc' ? ` (${pl.pays})` : ''}<br/><span class="muted small">${pl.status === 'confirme' ? `Vérifié : recruté(e) par ${helper?.full_name || 'un lauréat'}, confirmé par toi` : 'Trouvé en dehors de la plateforme'}</span></span></div>` : null}
      ${!pl && obj ? html`<div class="row"><button class="btn primary" onClick=${() => ctx.go('offres')}><${Icon} name="search" size=${16}/> Voir les offres pour moi</button></div>` : null}
    </div>

    ${pl && pl.laureat_id && pl.status === 'confirme' ? html`<${MerciBox} ctx=${ctx} pl=${pl} helper=${helper}/>` : null}

    <div class="section-head"><h2>Mes candidatures <span class="count">${apps.length}</span></h2><button class="btn small ghost" onClick=${() => setAddApp(true)}><${Icon} name="plus" size=${15}/> Candidature hors plateforme</button></div>
    ${apps.length ? html`<ul class="app-list">${apps.map(a => {
      const o = a.offer_id ? store.byId('offers', a.offer_id) : null;
      return html`<li class="app-row" key=${a.id}>
        <${CompanyLogo} name=${a.entreprise} size=${40}/>
        <span class="app-txt">${o ? html`<button class="linkish" onClick=${() => openOffer(o.id)}>${a.titre || o.titre}</button>` : html`<strong>${a.titre || 'Candidature'}</strong>`}<span class="muted small">${a.entreprise} · ${o ? 'via la plateforme' : 'hors plateforme'} · ${timeAgo(a.updated_at || a.created_at)}</span></span>
        ${o ? html`<span class=${'state-pill a-' + a.status}>${APP_STATUS[a.status]}</span>` : html`<span class="row nowrap">
          <select id=${'ap-' + a.id} aria-label="Statut" value=${a.status} onChange=${e => act(() => store.update('applications', a.id, { status: e.target.value, updated_at: new Date().toISOString() }))}>${Object.entries(APP_STATUS).map(([v, t]) => html`<option value=${v}>${t}</option>`)}</select>
          <button class="icon-btn small" aria-label="Supprimer" onClick=${() => act(() => store.remove('applications', a.id))}><${Icon} name="trash" size=${14}/></button></span>`}
      </li>`;
    })}</ul>
    <p class="small muted hint"><${Icon} name="shield" size=${14}/> Pour les offres de la plateforme, c’est le lauréat qui met à jour le statut. Quand il te marque « Recruté(e) », tu confirmes ici.</p>` : html`<${Empty} icon="send" title="Aucune candidature pour l’instant">Ouvre une offre et clique sur « Postuler ». Le lauréat reçoit ton message et ton CV.<//>`}

    ${!pl && obj ? html`<p class="small muted center">Tu as trouvé sans passer par la plateforme ? <button class="linkish" onClick=${() => setDeclare(true)}>Indique-le ici</button> pour que ta promo soit bien suivie.</p>` : null}

    ${history.length ? html`<div class="section-head"><h2>Saisons précédentes</h2></div>
      <ul class="app-list">${history.map(h => html`<li class="app-row"><${CompanyLogo} name=${h.entreprise} size=${36}/><span class="app-txt"><strong>${TYPES[h.type]?.label} chez ${h.entreprise}</strong><span class="muted small">${seasonLabel(h.saison)}${h.pays && h.pays !== 'Maroc' ? ` · ${h.pays}` : ''}</span></span>${h.source === 'plateforme' ? html`<span class="state-pill s-trouve">Via la plateforme</span>` : null}</li>`)}</ul>` : null}

    ${declare ? html`<${DeclareOutside} ctx=${ctx} onClose=${() => setDeclare(false)}/>` : null}
    ${addApp ? html`<${AppModal} ctx=${ctx} onClose=${() => setAddApp(false)}/>` : null}
  </section>`;
}

// Le lauréat a déclaré le recrutement : l'étudiant confirme ou non.
export function ConfirmRecruit({ ctx, pl, helper }) {
  const { store, act } = ctx;
  const o = pl.offer_id ? store.byId('offers', pl.offer_id) : null;
  return html`<div class="confirm-card">
    <div class="confirm-top"><${CompanyLogo} name=${pl.entreprise} size=${48}/>
      <div><p class="eyebrow">À confirmer</p><h2>${helper?.full_name || 'Un lauréat'} indique t’avoir recruté(e) chez ${pl.entreprise}</h2>
        <p class="muted small">${o ? o.titre : TYPES[pl.type]?.long}. Une fois confirmé, ta réussite est vérifiée des deux côtés et compte dans le suivi de ta promo.</p></div></div>
    <div class="row-end">
      <button class="btn ghost" onClick=${() => act(async () => { await store.update('placements', pl.id, { status: 'refuse' }); toast('C’est noté. Le lauréat sera informé.'); })}>Ce n’est pas le cas</button>
      <button class="btn primary" onClick=${() => act(async () => { await store.update('placements', pl.id, { status: 'confirme' }); toast('Félicitations ! Ta réussite est confirmée.', 'win'); })}><${Icon} name="check" size=${16}/> Oui, je confirme</button>
    </div>
  </div>`;
}

function MerciBox({ ctx, pl, helper }) {
  const { store, act } = ctx;
  const [merci, setMerci] = useState(pl.merci || '');
  const [note, setNote] = useState(pl.note || 5);
  const [edit, setEdit] = useState(!pl.merci);
  if (!edit) return html`<div class="merci-done"><${Icon} name="heart"/> <span>Ton merci à ${helper?.full_name} est affiché sur le mur des mercis.</span><button class="btn tiny ghost" onClick=${() => setEdit(true)}>Modifier</button></div>`;
  return html`<form class="merci-box" onSubmit=${e => { e.preventDefault(); act(async () => { await store.update('placements', pl.id, { merci: merci.trim(), note: +note }); setEdit(false); toast('Merci envoyé ! Il apparaît sur le mur des mercis.'); }); }}>
    <p><${Icon} name="heart" size=${16}/> <strong>Dis merci à ${helper?.full_name}.</strong> C’est ce qui donne envie aux lauréats de continuer à aider.</p>
    <textarea id="merci-txt" rows="2" maxlength="800" placeholder="Merci pour…" value=${merci} onInput=${e => setMerci(e.target.value)}></textarea>
    <div class="row"><span class="stars" role="group" aria-label="Aide reçue">${[1, 2, 3, 4, 5].map(v => html`<button type="button" class=${v <= note ? 'on' : ''} aria-label=${v + ' sur 5'} onClick=${() => setNote(v)}>★</button>`)}</span><span class="spacer"></span><button class="btn primary small" disabled=${!merci.trim()}>Envoyer mon merci</button></div>
  </form>`;
}

// Réussite trouvée hors plateforme : déclarée par l'étudiant, non vérifiée.
function DeclareOutside({ ctx, onClose }) {
  const { store, me, saison, act } = ctx;
  const n = Math.min(niveauOf(me, saison), 6);
  const [f, setF] = useState({ type: typeForNiveau(n), entreprise: '', ville: '', pays: 'Maroc' });
  const submit = e => {
    e.preventDefault();
    act(async () => {
      const pays = f.pays.trim() || 'Maroc';
      await store.insert('placements', { student_id: me.id, saison, niveau: n, type: pays !== 'Maroc' && f.type !== 'emploi' ? 'etranger' : f.type, entreprise: f.entreprise.trim(), ville: f.ville.trim(), pays, source: 'autre' });
      toast('Bravo ! C’est enregistré.', 'win'); onClose();
    });
  };
  return html`<${Modal} title="J’ai trouvé hors plateforme" onClose=${onClose}>
    <form class="form" onSubmit=${submit}>
      <p class="small muted">Pour une offre de la plateforme, pas besoin de remplir ceci : le lauréat te marque « Recruté(e) » et tu confirmes.</p>
      <${Field} label="Type"><select id="dc-type" value=${f.type} onChange=${e => setF({ ...f, type: e.target.value })}>${Object.entries(TYPES).map(([k, v]) => html`<option value=${k}>${v.long}</option>`)}</select><//>
      <${Field} label="Entreprise"><input id="dc-ent" value=${f.entreprise} onInput=${e => setF({ ...f, entreprise: e.target.value })} required/><//>
      <div class="grid2"><${Field} label="Ville"><input id="dc-ville" value=${f.ville} onInput=${e => setF({ ...f, ville: e.target.value })}/><//><${Field} label="Pays"><input id="dc-pays" value=${f.pays} onInput=${e => setF({ ...f, pays: e.target.value })}/><//></div>
      <div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn primary" disabled=${!f.entreprise.trim()}>Enregistrer</button></div>
    </form>
  <//>`;
}

function AppModal({ ctx, onClose }) {
  const { store, me, act } = ctx;
  const [f, setF] = useState({ entreprise: '', titre: '', note: '' });
  return html`<${Modal} title="Candidature hors plateforme" onClose=${onClose}>
    <form class="form" onSubmit=${e => { e.preventDefault(); act(async () => { await store.insert('applications', { student_id: me.id, offer_id: null, entreprise: f.entreprise.trim(), titre: f.titre.trim(), note: f.note.trim(), status: 'postule' }); onClose(); }); }}>
      <p class="small muted">Pour garder toutes tes candidatures au même endroit. Tu mets toi-même le statut à jour.</p>
      <${Field} label="Entreprise"><input id="ap-ent" required value=${f.entreprise} onInput=${e => setF({ ...f, entreprise: e.target.value })}/><//>
      <${Field} label="Poste ou sujet"><input id="ap-titre" value=${f.titre} onInput=${e => setF({ ...f, titre: e.target.value })}/><//>
      <${Field} label="Note pour moi"><input id="ap-note" value=${f.note} onInput=${e => setF({ ...f, note: e.target.value })} placeholder="Relance prévue le…"/><//>
      <div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn primary" disabled=${!f.entreprise.trim()}>Ajouter</button></div>
    </form>
  <//>`;
}

// ---------------------------------------------------------------------------
// Espace lauréat : ce qu'il y a à traiter, puis ce qu'il a apporté
// ---------------------------------------------------------------------------
export function EspacePage(ctx) {
  const { data, me, store, scores, act, openProfile, openOffer } = ctx;
  const s = scores.get(me.id) || { points: 0, events: [], offres: 0, recrutes: 0, mentorats: 0, mercis: 0, reponses: 0 };
  const lvl = levelOf(s.points);
  const mine = badgesOf(s, me);
  const myOffers = data.offers.filter(o => o.author_id === me.id).sort((a, b) => (a.status === 'ouverte' ? 0 : 1) - (b.status === 'ouverte' ? 0 : 1) || new Date(b.created_at) - new Date(a.created_at));
  const myOfferIds = new Set(myOffers.map(o => o.id));
  const toTreat = data.applications.filter(a => myOfferIds.has(a.offer_id) && a.status === 'postule').sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const waiting = data.placements.filter(p => p.laureat_id === me.id && p.status === 'en_attente');
  const helped = data.placements.filter(p => p.laureat_id === me.id && p.status === 'confirme');
  const mercis = [
    ...helped.filter(p => p.merci).map(p => ({ who: p.student_id, txt: p.merci, at: p.confirmed_at || p.created_at, ctx: p.entreprise })),
    ...data.mentorships.filter(m => m.mentor_id === me.id && m.merci).map(m => ({ who: m.student_id, txt: m.merci, at: m.created_at, ctx: m.sujet })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));
  const month = computeScores(data, new Date(Date.now() - 30 * 864e5)).get(me.id)?.points || 0;
  const [bareme, setBareme] = useState(false);
  const [compose, setCompose] = useState(false);

  return html`<section class="page">
    <header class="page-head"><div><p class="eyebrow">Promo ${me.promo}${me.entreprise ? ' · ' + me.entreprise : ''}</p><h1>Mon espace</h1></div>
      <button class="btn primary" onClick=${() => setCompose(true)}><${Icon} name="plus"/> Publier une offre</button></header>

    <div class="impact-hero">
      <div class="impact-score">
        <span class="row"><${Icon} name="star" size=${20}/><span class="muted">Points d’impact</span></span>
        <span class="big mono">${s.points}</span>
        <div class="lvl-row"><${LevelChip} points=${s.points}/>${lvl.next ? html`<span class="muted small">encore ${lvl.next.min - s.points} pour ${lvl.next.nom}</span>` : html`<span class="muted small">Niveau maximum</span>`}</div>
        <${Bar} value=${lvl.progress} label="Progression vers le niveau suivant"/>
        <span class="row small muted">+${month} ces 30 jours<span class="spacer"></span><button class="linkish small on-dark" onClick=${() => setBareme(true)}>Comment gagner des points ?</button></span>
      </div>
      <div class="impact-facts">
        <div><span class="fact-ico"><${Icon} name="briefcase" size=${18}/></span><span class="big mono">${helped.length}</span><span>recruté${helped.length > 1 ? 's' : ''} grâce à toi</span></div>
        <div><span class="fact-ico"><${Icon} name="feed" size=${18}/></span><span class="big mono">${myOffers.length}</span><span>offre${myOffers.length > 1 ? 's' : ''} partagée${myOffers.length > 1 ? 's' : ''}</span></div>
        <div><span class="fact-ico"><${Icon} name="mentor" size=${18}/></span><span class="big mono">${s.mentorats}</span><span>mentorat${s.mentorats > 1 ? 's' : ''} terminé${s.mentorats > 1 ? 's' : ''}</span></div>
        <div><span class="fact-ico"><${Icon} name="heart" size=${18}/></span><span class="big mono">${mercis.length}</span><span>merci${mercis.length > 1 ? 's' : ''} reçu${mercis.length > 1 ? 's' : ''}</span></div>
      </div>
    </div>

    ${toTreat.length ? html`<div class="panel accent-panel"><div class="section-head"><h2 class="h-ico"><${Icon} name="inbox"/> Nouvelles candidatures <span class="count">${toTreat.length}</span></h2></div>
      <ul class="app-list flat">${toTreat.slice(0, 6).map(a => { const p = store.byId('profiles', a.student_id); const o = store.byId('offers', a.offer_id); return html`<li class="app-row" key=${a.id}>
        <${Person} p=${p} onOpen=${openProfile} size=${36}/><span class="app-txt right"><span class="muted small">pour ${o?.titre}</span></span>
        <button class="btn small primary" onClick=${() => openOffer(o.id)}>Voir</button></li>`; })}</ul></div>` : null}

    ${waiting.length ? html`<div class="panel"><div class="section-head"><h2 class="h-ico"><${Icon} name="clock"/> En attente de confirmation <span class="count">${waiting.length}</span></h2></div>
      <p class="small muted">Tu as indiqué avoir recruté ces étudiants. Dès qu’ils confirment, tu reçois 50 points.</p>
      <ul class="app-list flat">${waiting.map(p => { const st = store.byId('profiles', p.student_id); return html`<li class="app-row" key=${p.id}>
        <${Person} p=${st} onOpen=${openProfile} size=${36}/><span class="app-txt right"><span class="muted small">${p.entreprise} · ${timeAgo(p.created_at)}</span></span>
        <button class="btn small ghost" onClick=${() => ctx.confirm('Annuler cette déclaration de recrutement ?', () => act(() => store.remove('placements', p.id)), 'Annuler la déclaration')}>Annuler</button></li>`; })}</ul></div>` : null}

    <div class="section-head"><h2>Mes offres</h2></div>
    ${myOffers.length ? html`<ul class="app-list">${myOffers.slice(0, 10).map(o => {
      const nApps = data.applications.filter(a => a.offer_id === o.id).length;
      const nRec = data.placements.filter(p => p.offer_id === o.id && p.status === 'confirme').length;
      return html`<li key=${o.id}><button class="app-row clickable" onClick=${() => openOffer(o.id)}>
        <span class=${'type-ico t-' + o.type}><${Icon} name=${TYPE_ICON[o.type]} size=${18}/></span>
        <span class="app-txt"><strong>${o.titre}</strong><span class="muted small">${o.status === 'ouverte' ? 'Ouverte' : 'Pourvue'} · ${timeAgo(o.created_at)}</span></span>
        <span class="mini-stats"><span title="Candidats"><${Icon} name="inbox" size=${15}/> ${nApps}</span><span title="Recrutés confirmés"><${Icon} name="check" size=${15}/> ${nRec}</span></span></button></li>`;
    })}</ul>` : html`<${Empty} icon="feed" title="Aucune offre publiée">Une offre partagée = 10 points, et peut-être une carrière lancée.<//>`}

    <div class="section-head"><h2>Badges</h2><span class="muted small">${mine.length} sur ${BADGES.length}</span></div>
    <div class="badges">${BADGES.map(b => { const has = mine.some(x => x.id === b.id); return html`<div class=${'badge' + (has ? ' has' : '')} title=${b.desc}><span class="badge-medal"><${Icon} name=${has ? 'star' : 'spark'} size=${20}/></span><strong>${b.nom}</strong><span class="small muted">${b.desc}</span></div>`; })}</div>

    <div class="two-col">
      <div>
        <div class="section-head"><h2>Mes mercis</h2></div>
        ${mercis.length ? html`<div class="mercis">${mercis.slice(0, 6).map(m => { const p = store.byId('profiles', m.who); return html`<blockquote class="merci"><p>« ${m.txt} »</p><footer><button class="linkish" onClick=${() => openProfile(p)}>${p?.full_name}</button> <span class="muted small">· ${m.ctx} · ${timeAgo(m.at)}</span></footer></blockquote>`; })}</div>` : html`<${Empty} icon="heart" title="Pas encore de merci">Les étudiants te remercient quand ils confirment leur recrutement ou après un mentorat.<//>`}
      </div>
      <div>
        <div class="section-head"><h2>Derniers points</h2></div>
        <ul class="events">${[...s.events].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 8).map(e => html`<li><span class="mono pts">+${e.pts}</span> ${e.label} <span class="muted small">${timeAgo(e.at)}</span></li>`)}</ul>
      </div>
    </div>
    ${bareme ? html`<${Modal} title="Points d’impact" onClose=${() => setBareme(false)}>
      <table class="tbl"><tbody>${BAREME.map(([l, p]) => html`<tr><td>${l}</td><td class="num mono">+${p}</td></tr>`)}</tbody></table>
      <p class="muted small">Niveaux : ${NIVEAUX_IMPACT.map(n => `${n.nom} (${n.min})`).join(' · ')}. Chaque mois, le lauréat qui a eu le plus d’impact est mis en avant sur l’accueil.</p>
    <//>` : null}
    ${compose ? html`<${OfferComposer} ctx=${ctx} onClose=${() => setCompose(false)}/>` : null}
  </section>`;
}
