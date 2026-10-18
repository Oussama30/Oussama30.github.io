// « Mon parcours » (étudiants) et « Mon impact » (lauréats).
import { html, useState } from './vendor/preact-htm.js';
import { Icon, Modal, Field, Empty, Person, Bar, toast, LevelChip } from './ui.js';
import { OBJECTIFS, NIVEAUX, TYPES, niveauOf, statutOf, placementOf, typeForNiveau, seasonLabel, daysUntil, timeAgo, levelOf, BADGES, badgesOf, BAREME, computeScores, NIVEAUX_IMPACT } from './logic.js';

const COLS = [['postule', 'Postulé'], ['entretien', 'Entretien'], ['retenu', 'Retenu'], ['refuse', 'Non retenu']];

export function ParcoursPage(ctx) {
  const { data, me, saison, store, act } = ctx;
  const n = niveauOf(me, saison);
  const obj = OBJECTIFS[n];
  const st = statutOf(data, me, saison);
  const pl = st.pl;
  const [declare, setDeclare] = useState(false);
  const [addApp, setAddApp] = useState(false);
  const apps = data.applications.filter(a => a.student_id === me.id);
  const history = data.placements.filter(p => p.student_id === me.id && p.saison !== saison).sort((a, b) => b.saison - a.saison);
  const left = obj ? Math.ceil((obj.deadline(saison) - new Date()) / 864e5) : null;
  const helper = pl?.laureat_id ? store.byId('profiles', pl.laureat_id) : null;

  return html`<section class="page">
    <header class="page-head"><div><p class="eyebrow">Saison ${seasonLabel(saison)} · ${NIVEAUX[n]?.label}</p><h1>Mon parcours</h1></div></header>

    <div class=${'objective st-' + st.key}>
      <div class="objective-main">
        <p class="eyebrow">Mon objectif cette saison</p>
        <h2>${obj ? obj.titre : 'Pas d’objectif de placement cette année'}</h2>
        ${obj ? html`<p class="muted">Échéance : ${obj.deadline(saison).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}${left > 0 ? ` · encore ${left} jours` : ''}</p>` : html`<p class="muted">En cycle préparatoire, profite de l’Entraide et du mentorat pour préparer ton premier stage.</p>`}
      </div>
      <div class="objective-state">
        <span class=${'state-pill s-' + st.key}>${st.label}</span>
        ${pl ? html`<p><strong>${pl.entreprise}</strong>${pl.ville ? `, ${pl.ville}` : ''}${pl.pays && pl.pays !== 'Maroc' ? ` (${pl.pays})` : ''}</p>` : null}
        ${pl?.status === 'en_attente' ? html`<p class="muted small">En attente de confirmation par ${helper?.full_name || 'le lauréat'}.</p>` : null}
        ${!pl && obj ? html`<div class="row"><button class="btn accent" onClick=${() => setDeclare(true)}><${Icon} name="trophy" size=${16}/> J’ai trouvé !</button><button class="btn ghost" onClick=${() => ctx.go('offres')}>Voir les offres pour moi</button></div>` : null}
      </div>
    </div>

    ${pl && pl.laureat_id && pl.status === 'confirme' ? html`<${MerciBox} ctx=${ctx} pl=${pl} helper=${helper}/>` : null}

    <div class="section-head"><h2>Mes candidatures</h2><button class="btn small" onClick=${() => setAddApp(true)}><${Icon} name="plus" size=${15}/> Ajouter une candidature</button></div>
    ${apps.length ? html`<div class="kanban">${COLS.map(([k, l]) => html`<div class="kcol"><h3>${l} <span class="count">${apps.filter(a => a.status === k).length}</span></h3>
      ${apps.filter(a => a.status === k).map(a => html`<div class="kcard" key=${a.id}>
        <strong>${a.entreprise}</strong><span class="muted small">${a.titre || ''}</span>
        ${a.note ? html`<p class="small">${a.note}</p>` : null}
        <div class="row">
          <select id=${'ap-' + a.id} aria-label="Statut" value=${a.status} onChange=${e => act(async () => {
            await store.update('applications', a.id, { status: e.target.value, updated_at: new Date().toISOString() });
            if (e.target.value === 'retenu' && !placementOf(data, me.id, saison) && obj) { toast('Bravo ! Déclare ta réussite pour qu’elle compte dans le suivi.'); setDeclare(a); }
          })}>${COLS.map(([v, t]) => html`<option value=${v}>${t}</option>`)}</select>
          <button class="icon-btn small" aria-label="Supprimer" onClick=${() => act(() => store.remove('applications', a.id))}><${Icon} name="trash" size=${14}/></button>
        </div>
      </div>`)}
    </div>`)}</div>` : html`<${Empty} icon="send" title="Aucune candidature suivie">Clique sur « J’ai postulé » sous une offre, ou ajoute une candidature faite ailleurs.<//>`}

    ${history.length ? html`<div class="section-head"><h2>Saisons précédentes</h2></div>
      <ul class="timeline">${history.map(h => html`<li><span class="mono">${seasonLabel(h.saison)}</span> <strong>${TYPES[h.type]?.label}</strong> chez ${h.entreprise}${h.pays && h.pays !== 'Maroc' ? ` (${h.pays})` : ''} ${h.source === 'plateforme' ? html`<span class="mini">via la plateforme</span>` : null}</li>`)}</ul>` : null}

    ${declare ? html`<${DeclareModal} ctx=${ctx} app=${declare === true ? null : declare} onClose=${() => setDeclare(false)}/>` : null}
    ${addApp ? html`<${AppModal} ctx=${ctx} onClose=${() => setAddApp(false)}/>` : null}
  </section>`;
}

function MerciBox({ ctx, pl, helper }) {
  const { store, act } = ctx;
  const [merci, setMerci] = useState(pl.merci || '');
  const [note, setNote] = useState(pl.note || 5);
  const [edit, setEdit] = useState(!pl.merci);
  if (!edit) return html`<div class="merci-done"><${Icon} name="heart"/> <span>Ton message de remerciement à ${helper?.full_name} est affiché sur le mur des mercis.</span><button class="btn tiny ghost" onClick=${() => setEdit(true)}>Modifier</button></div>`;
  return html`<form class="merci-box" onSubmit=${e => { e.preventDefault(); act(async () => { await store.update('placements', pl.id, { merci: merci.trim(), note: +note }); setEdit(false); toast('Merci envoyé ! Il apparaîtra sur le mur des mercis.'); }); }}>
    <p><strong>${helper?.full_name}</strong> a confirmé ta réussite. Un mot de remerciement compte beaucoup pour les lauréats qui aident.</p>
    <textarea id="merci-txt" rows="2" maxlength="800" placeholder="Merci pour…" value=${merci} onInput=${e => setMerci(e.target.value)}></textarea>
    <div class="row"><label class="small">Aide reçue <select id="merci-note" value=${note} onChange=${e => setNote(e.target.value)}>${[5, 4, 3, 2, 1].map(v => html`<option value=${v}>${'★'.repeat(v)}</option>`)}</select></label><span class="spacer"></span><button class="btn primary small" disabled=${!merci.trim()}>Envoyer mon merci</button></div>
  </form>`;
}

export function DeclareModal({ ctx, app, onClose }) {
  const { store, me, saison, data, act } = ctx;
  const n = Math.min(niveauOf(me, saison), 6);
  const [via, setVia] = useState(app?.offer_id ? 'plateforme' : 'autre');
  const [offerId, setOfferId] = useState(app?.offer_id || '');
  const [f, setF] = useState({ type: typeForNiveau(n), entreprise: app?.entreprise || '', ville: '', pays: 'Maroc' });
  const offers = data.offers.filter(o => o.author_id !== me.id).sort((a, b) => a.entreprise.localeCompare(b.entreprise));
  const submit = e => {
    e.preventDefault();
    act(async () => {
      if (via === 'plateforme') {
        const o = store.byId('offers', offerId); if (!o) return;
        await store.insert('placements', { student_id: me.id, offer_id: o.id, saison, niveau: n, type: o.type, entreprise: o.entreprise, ville: o.ville, pays: o.pays || 'Maroc', source: 'plateforme' });
        toast('Demande envoyée au lauréat pour confirmation.');
      } else {
        await store.insert('placements', { student_id: me.id, saison, niveau: n, type: f.pays.trim() && f.pays.trim() !== 'Maroc' && f.type !== 'emploi' ? 'etranger' : f.type, entreprise: f.entreprise.trim(), ville: f.ville.trim(), pays: f.pays.trim() || 'Maroc', source: 'autre' });
        toast('Bravo ! Ta réussite est enregistrée.');
      }
      onClose();
    });
  };
  const ok = via === 'plateforme' ? !!offerId : f.entreprise.trim();
  return html`<${Modal} title="J’ai trouvé !" onClose=${onClose}>
    <form class="form" onSubmit=${submit}>
      <div class="seg" role="group"><button type="button" class=${via === 'plateforme' ? 'on' : ''} onClick=${() => setVia('plateforme')}>Grâce à une offre de la plateforme</button><button type="button" class=${via === 'autre' ? 'on' : ''} onClick=${() => setVia('autre')}>Ailleurs</button></div>
      ${via === 'plateforme' ? html`<${Field} label="Quelle offre ?" hint="Le lauréat qui l’a publiée confirmera, puis ta réussite sera vérifiée.">
        <select id="dc-offer" value=${offerId} onChange=${e => setOfferId(e.target.value)}><option value="">Choisir…</option>${offers.map(o => html`<option value=${o.id}>${o.entreprise} · ${o.titre}</option>`)}</select><//>` : html`
        <${Field} label="Type"><select id="dc-type" value=${f.type} onChange=${e => setF({ ...f, type: e.target.value })}>${Object.entries(TYPES).map(([k, v]) => html`<option value=${k}>${v.long}</option>`)}</select><//>
        <${Field} label="Entreprise"><input id="dc-ent" value=${f.entreprise} onInput=${e => setF({ ...f, entreprise: e.target.value })} required/><//>
        <div class="grid2"><${Field} label="Ville"><input id="dc-ville" value=${f.ville} onInput=${e => setF({ ...f, ville: e.target.value })}/><//><${Field} label="Pays"><input id="dc-pays" value=${f.pays} onInput=${e => setF({ ...f, pays: e.target.value })}/><//></div>`}
      <div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn primary" disabled=${!ok}>Enregistrer</button></div>
    </form>
  <//>`;
}

function AppModal({ ctx, onClose }) {
  const { store, me, act } = ctx;
  const [f, setF] = useState({ entreprise: '', titre: '', note: '' });
  return html`<${Modal} title="Ajouter une candidature" onClose=${onClose}>
    <form class="form" onSubmit=${e => { e.preventDefault(); act(async () => { await store.insert('applications', { student_id: me.id, offer_id: null, entreprise: f.entreprise.trim(), titre: f.titre.trim(), note: f.note.trim(), status: 'postule' }); onClose(); }); }}>
      <${Field} label="Entreprise"><input id="ap-ent" required value=${f.entreprise} onInput=${e => setF({ ...f, entreprise: e.target.value })}/><//>
      <${Field} label="Poste ou sujet"><input id="ap-titre" value=${f.titre} onInput=${e => setF({ ...f, titre: e.target.value })}/><//>
      <${Field} label="Note pour moi"><input id="ap-note" value=${f.note} onInput=${e => setF({ ...f, note: e.target.value })} placeholder="Relance prévue le…"/><//>
      <div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn primary" disabled=${!f.entreprise.trim()}>Ajouter</button></div>
    </form>
  <//>`;
}

// ---------------------------------------------------------------------------
export function ImpactPage(ctx) {
  const { data, me, store, scores, act, openProfile } = ctx;
  const s = scores.get(me.id) || { points: 0, events: [], offres: 0, recrutes: 0, mentorats: 0, mercis: 0, reponses: 0 };
  const lvl = levelOf(s.points);
  const mine = badgesOf(s, me);
  const pending = data.placements.filter(p => p.laureat_id === me.id && p.status === 'en_attente');
  const helped = data.placements.filter(p => p.laureat_id === me.id && p.status === 'confirme');
  const mercis = [
    ...helped.filter(p => p.merci).map(p => ({ who: p.student_id, txt: p.merci, at: p.confirmed_at || p.created_at, ctx: p.entreprise })),
    ...data.mentorships.filter(m => m.mentor_id === me.id && m.merci).map(m => ({ who: m.student_id, txt: m.merci, at: m.created_at, ctx: m.sujet })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));
  const myOffers = data.offers.filter(o => o.author_id === me.id);
  const month = computeScores(data, new Date(Date.now() - 30 * 864e5)).get(me.id)?.points || 0;
  const [bareme, setBareme] = useState(false);

  return html`<section class="page">
    <header class="page-head"><div><p class="eyebrow">Ce que tu apportes à l’école</p><h1>Mon impact</h1></div><button class="btn ghost" onClick=${() => setBareme(true)}>Comment gagner des points ?</button></header>

    <div class="impact-hero">
      <div class="impact-score">
        <span class="big mono">${s.points}</span><span class="muted">points d’impact</span>
        <div class="lvl-row"><${LevelChip} points=${s.points}/>${lvl.next ? html`<span class="muted small">${lvl.next.min - s.points} points avant ${lvl.next.nom}</span>` : html`<span class="muted small">Niveau maximum atteint</span>`}</div>
        <${Bar} value=${lvl.progress} label="Progression vers le niveau suivant"/>
        <span class="small muted">+${month} points ces 30 derniers jours</span>
      </div>
      <div class="impact-facts">
        <div><span class="big mono">${helped.length}</span><span>étudiant${helped.length > 1 ? 's' : ''} recruté${helped.length > 1 ? 's' : ''} grâce à toi</span></div>
        <div><span class="big mono">${s.mentorats}</span><span>mentorat${s.mentorats > 1 ? 's' : ''} terminé${s.mentorats > 1 ? 's' : ''}</span></div>
        <div><span class="big mono">${myOffers.length}</span><span>offre${myOffers.length > 1 ? 's' : ''} partagée${myOffers.length > 1 ? 's' : ''}</span></div>
        <div><span class="big mono">${mercis.length}</span><span>merci${mercis.length > 1 ? 's' : ''} reçu${mercis.length > 1 ? 's' : ''}</span></div>
      </div>
    </div>

    ${pending.length ? html`<div class="callout"><h2>À confirmer (${pending.length})</h2><p class="muted">Ces étudiants disent avoir été retenus grâce à ton offre. Ta confirmation rend leur réussite vérifiée et te rapporte 50 points chacun.</p>
      ${pending.map(p => { const st = store.byId('profiles', p.student_id); const o = store.byId('offers', p.offer_id); return html`<div class="confirm-row" key=${p.id}>
        <${Person} p=${st} onOpen=${openProfile}/>
        <span class="small">${o?.titre || p.entreprise}</span><span class="spacer"></span>
        <button class="btn small ghost" onClick=${() => act(async () => { await store.update('placements', p.id, { status: 'refuse' }); toast('Demande refusée.'); })}>Ce n’est pas le cas</button>
        <button class="btn small primary" onClick=${() => act(async () => { await store.update('placements', p.id, { status: 'confirme' }); toast('Confirmé ! +50 points d’impact', 'win'); })}><${Icon} name="check" size=${15}/> Confirmer</button>
      </div>`; })}</div>` : null}

    <div class="section-head"><h2>Badges</h2><span class="muted small">${mine.length} sur ${BADGES.length}</span></div>
    <div class="badges">${BADGES.map(b => { const has = mine.some(x => x.id === b.id); return html`<div class=${'badge' + (has ? ' has' : '')} title=${b.desc}><span class="badge-medal"><${Icon} name=${has ? 'star' : 'spark'} size=${20}/></span><strong>${b.nom}</strong><span class="small muted">${b.desc}</span></div>`; })}</div>

    <div class="two-col">
      <div>
        <div class="section-head"><h2>Mur de mes mercis</h2></div>
        ${mercis.length ? html`<div class="mercis">${mercis.map(m => { const p = store.byId('profiles', m.who); return html`<blockquote class="merci"><p>« ${m.txt} »</p><footer><button class="linkish" onClick=${() => openProfile(p)}>${p?.full_name}</button> <span class="muted small">· ${m.ctx} · ${timeAgo(m.at)}</span></footer></blockquote>`; })}</div>` : html`<${Empty} icon="heart" title="Pas encore de merci">Les étudiants peuvent te remercier dès que tu confirmes leur réussite ou termines un mentorat.<//>`}
      </div>
      <div>
        <div class="section-head"><h2>Mes offres</h2><button class="btn tiny ghost" onClick=${() => ctx.go('offres')}>Gérer</button></div>
        ${myOffers.length ? html`<table class="tbl"><thead><tr><th>Offre</th><th class="num">Ça m’aide</th><th class="num">Candidats</th><th class="num">Recrutés</th></tr></thead><tbody>
          ${myOffers.slice(0, 8).map(o => html`<tr><td>${o.titre}<br/><span class="muted small">${o.status === 'ouverte' ? 'Ouverte' : 'Pourvue'} · ${timeAgo(o.created_at)}</span></td>
            <td class="num">${data.reactions.filter(r => r.offer_id === o.id && r.kind === 'utile').length}</td>
            <td class="num">${data.applications.filter(a => a.offer_id === o.id).length}</td>
            <td class="num">${data.placements.filter(p => p.offer_id === o.id && p.status === 'confirme').length}</td></tr>`)}
        </tbody></table>` : html`<${Empty} icon="feed" title="Aucune offre publiée">Une offre partagée = 10 points, et peut-être une carrière lancée.<//>`}
        <div class="section-head"><h2>Derniers points</h2></div>
        <ul class="events">${s.events.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 8).map(e => html`<li><span class="mono pts">+${e.pts}</span> ${e.label} <span class="muted small">${timeAgo(e.at)}</span></li>`)}</ul>
      </div>
    </div>
    ${bareme ? html`<${Modal} title="Points d’impact" onClose=${() => setBareme(false)}>
      <table class="tbl"><tbody>${BAREME.map(([l, p]) => html`<tr><td>${l}</td><td class="num mono">+${p}</td></tr>`)}</tbody></table>
      <p class="muted small">Niveaux : ${NIVEAUX_IMPACT.map(n => `${n.nom} (${n.min})`).join(' · ')}. Chaque mois, le lauréat qui a eu le plus d’impact est mis en avant sur la page d’accueil.</p>
    <//>` : null}
  </section>`;
}
