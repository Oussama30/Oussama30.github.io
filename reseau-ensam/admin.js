// Administration, sur une seule page : les chiffres, l'annonce de l'accueil, les membres
// (rôle, vérification, comptes inscrits sans profil), les recrutements à valider et les offres.
import { html, useState, useEffect } from './vendor/preact-htm.js';
import { Icon, Field, Person, Num, toast } from './ui.js';
import { NIVEAUX, niveauOf, timeAgo, mentorState } from './logic.js';

const ROLES = [['etudiant', 'Étudiant(e)'], ['laureat', 'Lauréat(e)']];

export function AdminPage(ctx) {
  const { data, store, act, openProfile, saison } = ctx;
  const [comptes, setComptes] = useState(null);
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  useEffect(() => { let on = true; Promise.resolve(store.adminComptes?.()).then(r => on && setComptes(r || []), () => on && setComptes([])); return () => { on = false; }; }, [data.profiles.length]);
  const compte = new Map((comptes || []).map(c => [c.id, c]));
  const sansProfil = (comptes || []).filter(c => !c.a_profil);

  const week = Date.now() - 7 * 864e5;
  const members = data.profiles.filter(p => p.role !== 'admin');
  const nouveaux = members.filter(p => new Date(p.created_at) > week);
  const openReq = data.mentorships.filter(m => m.status === 'demande');
  const rdv = data.mentorships.filter(m => mentorState(m) === 'rdv').length;
  const confirmes = data.placements.filter(p => p.saison === saison && p.status === 'confirme').length;
  const kpis = [
    ['Membres', members.length, `${members.filter(p => p.role === 'etudiant').length} étudiants · ${members.filter(p => p.role === 'laureat').length} lauréats`],
    ['Nouveaux cette semaine', nouveaux.length, sansProfil.length ? `+ ${sansProfil.length} sans profil` : 'inscriptions des 7 derniers jours'],
    ['Demandes d’aide', openReq.length, `en attente · ${rdv} rendez-vous à venir`],
    ['Recrutés et confirmés', confirmes, 'cette saison, via la plateforme'],
  ];

  const toVerify = data.profiles.filter(p => p.role === 'laureat' && !p.verified);
  const stale = data.placements.filter(p => p.status === 'en_attente').sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const offers = [...data.offers].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8);
  const qq = q.trim().toLowerCase();
  const list = members.filter(p => !qq || `${p.full_name} ${p.filiere} ${p.promo} ${p.entreprise || ''} ${compte.get(p.id)?.email || ''}`.toLowerCase().includes(qq))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const shown = all || qq ? list.slice(0, 60) : list.slice(0, 6);

  return html`<section class="page admin">
    <header class="page-head"><div><p class="eyebrow">Réservé à l’administration</p><h1>Administration</h1></div></header>

    <div class="kpis">${kpis.map(([l, v, sub]) => html`<div class="kpi"><span class="kpi-label">${l}</span><span class="kpi-val mono"><${Num} v=${v}/></span><span class="small muted">${sub}</span></div>`)}</div>

    <${AnnonceBox} ctx=${ctx}/>

    ${toVerify.length ? html`<div class="panel accent-panel"><div class="section-head"><h2 class="h-ico"><${Icon} name="shield"/> Lauréats à vérifier <span class="count">${toVerify.length}</span></h2></div>
      <p class="muted small">Vérifie que la personne est bien diplômée de l’ENSAM Meknès (promo, filière), puis valide. Le badge rassure les étudiants.</p>
      <ul class="people-list">${toVerify.map(p => html`<li key=${p.id}><${Person} p=${p} onOpen=${openProfile} sub=${`${p.filiere} · Promo ${p.promo}${p.entreprise ? ' · ' + p.entreprise : ''}`}/>${compte.get(p.id) ? html`<span class="small muted mono" dir="ltr" translate="no">${compte.get(p.id).email}</span>` : null}<span class="spacer"></span>
        <button class="btn small primary" onClick=${() => act(async () => { await store.update('profiles', p.id, { verified: true }); toast('Lauréat vérifié.'); })}><${Icon} name="shield" size=${15}/> Vérifier</button></li>`)}</ul></div>` : null}

    <div class="panel">
      <div class="section-head"><h2 class="h-ico"><${Icon} name="people"/> Membres</h2>
        <label class="search"><${Icon} name="search" size=${16}/><input id="adm-q" placeholder="Nom, email, filière, promo…" value=${q} onInput=${e => setQ(e.target.value)}/></label></div>
      ${sansProfil.length ? html`<p class="small hint-box"><${Icon} name="user" size=${15}/> <span>${sansProfil.length} compte${sansProfil.length > 1 ? 's' : ''} créé${sansProfil.length > 1 ? 's' : ''} sans profil (inscription pas terminée) : <span class="mono" dir="ltr" translate="no">${sansProfil.slice(0, 5).map(c => c.email).join(', ')}</span></span></p>` : null}
      <ul class="people-list member-list">${shown.map(p => { const c = compte.get(p.id); return html`<li key=${p.id}>
        <${Person} p=${p} onOpen=${openProfile} sub=${p.role === 'etudiant' ? `${NIVEAUX[niveauOf(p, saison)]?.short || ''} · ${p.filiere} · promo ${p.promo}` : `${p.filiere} · Promo ${p.promo}`}/>
        <span class="small muted member-meta">${c ? html`<span class="mono" dir="ltr" translate="no">${c.email}</span>` : null}<span>Inscrit ${timeAgo(p.created_at)}</span>${c?.last_sign_in_at ? html`<span>Vu ${timeAgo(c.last_sign_in_at)}</span>` : null}</span>
        <span class="spacer"></span>
        <select id=${'role-' + p.id} aria-label="Rôle" value=${p.role} onChange=${e => act(async () => { await store.update('profiles', p.id, { role: e.target.value }); toast('Rôle modifié.'); })}>${ROLES.map(([k, l]) => html`<option value=${k}>${l}</option>`)}</select>
        ${p.role === 'laureat' && !p.verified ? html`<button class="btn small" onClick=${() => act(() => store.update('profiles', p.id, { verified: true }))}><${Icon} name="shield" size=${14}/> Vérifier</button>` : null}
      </li>`; })}</ul>
      ${!qq && list.length > 6 ? html`<button class="linkish small" onClick=${() => setAll(!all)}>${all ? 'Voir moins' : `Voir tous les membres (${list.length})`}</button>` : null}
    </div>

    ${stale.length ? html`<div class="panel"><div class="section-head"><h2>Recrutements en attente de l’étudiant <span class="count">${stale.length}</span></h2></div>
      <p class="muted small">Le lauréat a déclaré ces recrutements. Si l’étudiant ne confirme pas, l’administration peut le faire après vérification.</p>
      <ul class="people-list">${stale.map(p => { const s = store.byId('profiles', p.student_id), l = store.byId('profiles', p.laureat_id); return html`<li key=${p.id}><${Person} p=${s} onOpen=${openProfile} sub=${`${p.entreprise} · déclaré par ${l?.full_name || '?'} · ${timeAgo(p.created_at)}`}/><span class="spacer"></span>
        <button class="btn small ghost" onClick=${() => act(() => store.update('placements', p.id, { status: 'refuse' }))}>Refuser</button><button class="btn small primary" onClick=${() => act(() => store.update('placements', p.id, { status: 'confirme' }))}>Confirmer</button></li>`; })}</ul></div>` : null}

    <div class="panel"><div class="section-head"><h2 class="h-ico"><${Icon} name="feed"/> Dernières offres</h2></div>
      <ul class="people-list">${offers.map(o => html`<li key=${o.id}><span class="grow"><button class="linkish strong" onClick=${() => ctx.openOffer(o.id)}>${o.titre}</button><br/><span class="muted small">${o.entreprise} · ${store.byId('profiles', o.author_id)?.full_name || ''} · ${timeAgo(o.created_at)}</span></span>
        ${o.status !== 'ouverte' ? html`<span class="tag done">${o.status === 'pourvue' ? 'Pourvue' : 'Fermée'}</span>` : null}
        <button class="btn tiny ghost" onClick=${() => act(() => store.update('offers', o.id, { status: o.status === 'ouverte' ? 'fermee' : 'ouverte' }))}>${o.status === 'ouverte' ? 'Masquer' : 'Rouvrir'}</button>
        <button class="btn tiny ghost danger-t" onClick=${() => ctx.confirm('Supprimer cette offre ?', () => act(() => store.remove('offers', o.id)))}>Supprimer</button></li>`)}</ul></div>
  </section>`;
}

// Annonce affichée en haut de l'accueil de tous les membres
function AnnonceBox({ ctx }) {
  const { data, store, me, act } = ctx;
  const current = data.annonces.filter(a => a.active).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const [texte, setTexte] = useState(''); const [lien, setLien] = useState('');
  const publish = e => {
    e.preventDefault();
    act(async () => {
      if (lien.trim() && !/^https:\/\/\S+$/i.test(lien.trim())) throw new Error('Le lien doit commencer par https://');
      for (const a of data.annonces.filter(x => x.active)) await store.update('annonces', a.id, { active: false });
      await store.insert('annonces', { author_id: me.id, texte: texte.trim(), lien: lien.trim() || null, active: true });
      setTexte(''); setLien(''); toast('Annonce publiée sur l’accueil de tous les membres.', 'win');
    });
  };
  return html`<div class="panel">
    <div class="section-head"><h2 class="h-ico"><${Icon} name="bell"/> Annonce sur l’accueil</h2></div>
    ${current ? html`<div class="annonce preview"><${Icon} name="bell" size=${18}/><span class="grow">${current.texte}</span><button class="btn tiny ghost" onClick=${() => act(() => store.update('annonces', current.id, { active: false }))}>Retirer</button></div>` : html`<p class="small muted">Aucune annonce en ce moment.</p>`}
    <form class="form" onSubmit=${publish}>
      <${Field} label=${current ? 'Remplacer par une nouvelle annonce' : 'Nouvelle annonce'} hint="280 caractères au plus. Elle s’affiche en haut de l’accueil de tout le monde."><textarea id="ann-txt" rows="2" maxlength="280" value=${texte} onInput=${e => setTexte(e.target.value)} placeholder="Ex. Forum entreprises jeudi à l’école : les lauréats sont les bienvenus."></textarea><//>
      <div class="row"><input id="ann-lien" class="grow" dir="ltr" value=${lien} onInput=${e => setLien(e.target.value)} placeholder="Lien (facultatif) : https://…"/><button class="btn primary" disabled=${texte.trim().length < 3}>Publier</button></div>
    </form>
  </div>`;
}

// Bandeau de l'accueil, que chacun peut masquer pour lui
export function AnnonceBanner({ ctx }) {
  const { data } = ctx;
  const a = data.annonces.filter(x => x.active).sort((x, y) => new Date(y.created_at) - new Date(x.created_at))[0];
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem('annonce-off') || ''; } catch { return ''; } });
  if (!a || hidden === a.id) return null;
  const hide = () => { setHidden(a.id); try { localStorage.setItem('annonce-off', a.id); } catch { /* */ } };
  return html`<div class="annonce" role="status"><${Icon} name="bell" size=${18}/><span class="grow">${a.texte}${a.lien && /^https:\/\//i.test(a.lien) ? html` <a href=${a.lien} target="_blank" rel="noopener">En savoir plus</a>` : null}</span>
    <button class="icon-btn small" aria-label="Masquer l’annonce" onClick=${hide}><${Icon} name="x" size=${15}/></button></div>`;
}
