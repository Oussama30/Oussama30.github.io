// Fil d'offres : publication, filtres, réactions, commentaires, suivi, « j'ai été retenu(e) ».
import { html, useState, useMemo } from './vendor/preact-htm.js';
import { Icon, Modal, Field, Empty, Person, Avatar, toast } from './ui.js';
import { TYPES, FILIERES, NIVEAUX, niveauOf, timeAgo, daysUntil, typeForNiveau, placementOf } from './logic.js';

const ANNEES_OPTS = [[3, '3A'], [4, '4A'], [5, '5A'], [6, 'Jeunes diplômés']];

export function OffersPage(ctx) {
  const { data, me, saison } = ctx;
  const myN = niveauOf(me, saison);
  const [type, setType] = useState('tous');
  const [q, setQ] = useState('');
  const [filiere, setFiliere] = useState('');
  const [annee, setAnnee] = useState('');
  const [lieu, setLieu] = useState('');
  const [vue, setVue] = useState('ouvertes');
  const [compose, setCompose] = useState(null);

  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return data.offers.filter(o => {
      if (vue === 'ouvertes' && o.status !== 'ouverte') return false;
      if (vue === 'pour-moi' && (o.status !== 'ouverte' || !(o.annees || []).includes(myN) || (o.filieres?.length && !o.filieres.includes(me.filiere)))) return false;
      if (vue === 'sauvees' && !data.reactions.some(r => r.offer_id === o.id && r.user_id === me.id && r.kind === 'save')) return false;
      if (vue === 'miennes' && o.author_id !== me.id) return false;
      if (type !== 'tous' && o.type !== type) return false;
      if (filiere && !(o.filieres || []).includes(filiere)) return false;
      if (annee && !(o.annees || []).includes(+annee)) return false;
      if (lieu === 'maroc' && (o.pays || 'Maroc') !== 'Maroc') return false;
      if (lieu === 'etranger' && (o.pays || 'Maroc') === 'Maroc') return false;
      if (qq && !`${o.titre} ${o.entreprise} ${o.ville} ${o.pays} ${o.description}`.toLowerCase().includes(qq)) return false;
      return true;
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [data, q, type, filiere, annee, lieu, vue]);

  const isStudent = me.role === 'etudiant';
  const vues = [['ouvertes', 'Offres ouvertes'], ...(isStudent ? [['pour-moi', 'Pour moi']] : []), ['sauvees', 'Sauvegardées'], ...(!isStudent ? [['miennes', 'Mes offres']] : []), ['toutes', 'Historique']];

  return html`<section class="page">
    <header class="page-head">
      <div><p class="eyebrow">Fil des opportunités</p><h1>Offres partagées par les lauréats</h1></div>
      <button class="btn primary" onClick=${() => setCompose({})}><${Icon} name="plus"/> Publier une offre</button>
    </header>
    <div class="filters">
      <div class="seg" role="group" aria-label="Vue">${vues.map(([k, l]) => html`<button class=${vue === k ? 'on' : ''} onClick=${() => setVue(k)}>${l}</button>`)}</div>
      <div class="chips" role="group" aria-label="Type d’offre">
        ${[['tous', 'Tout'], ...Object.entries(TYPES).map(([k, v]) => [k, v.label])].map(([k, l]) => html`<button class=${'chip t-' + k + (type === k ? ' on' : '')} onClick=${() => setType(k)}>${l}</button>`)}
      </div>
      <div class="filter-row">
        <label class="search"><${Icon} name="search" size=${16}/><input id="f-q" placeholder="Entreprise, ville, mot-clé…" value=${q} onInput=${e => setQ(e.target.value)}/></label>
        <select id="f-fil" value=${filiere} onChange=${e => setFiliere(e.target.value)} aria-label="Filière"><option value="">Toutes filières</option>${FILIERES.map(f => html`<option>${f}</option>`)}</select>
        <select id="f-an" value=${annee} onChange=${e => setAnnee(e.target.value)} aria-label="Niveau"><option value="">Tous niveaux</option>${ANNEES_OPTS.map(([v, l]) => html`<option value=${v}>${l}</option>`)}</select>
        <select id="f-lieu" value=${lieu} onChange=${e => setLieu(e.target.value)} aria-label="Lieu"><option value="">Maroc et étranger</option><option value="maroc">Maroc</option><option value="etranger">Étranger</option></select>
      </div>
    </div>
    <p class="muted small">${list.length} offre${list.length > 1 ? 's' : ''}</p>
    <div class="feed">
      ${list.length ? list.map(o => html`<${OfferCard} key=${o.id} o=${o} ctx=${ctx} onEdit=${() => setCompose(o)}/>`) : html`<${Empty} icon="feed" title="Aucune offre ne correspond">Élargis les filtres, ou publie la première offre de ce type.<//>`}
    </div>
    ${compose ? html`<${OfferComposer} ctx=${ctx} offer=${compose} onClose=${() => setCompose(null)}/>` : null}
  </section>`;
}

export function OfferCard({ o, ctx, onEdit, compact }) {
  const { data, me, store, scores, openProfile, act, saison } = ctx;
  const [open, setOpen] = useState(false);
  const [claim, setClaim] = useState(false);
  const [txt, setTxt] = useState('');
  const author = store.byId('profiles', o.author_id);
  const reacts = data.reactions.filter(r => r.offer_id === o.id);
  const utile = reacts.filter(r => r.kind === 'utile');
  const iUtile = utile.find(r => r.user_id === me.id);
  const iSave = reacts.find(r => r.kind === 'save' && r.user_id === me.id);
  const comments = data.comments.filter(c => c.offer_id === o.id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const apps = data.applications.filter(a => a.offer_id === o.id);
  const myApp = apps.find(a => a.student_id === me.id);
  const recrutes = data.placements.filter(p => p.offer_id === o.id && p.status === 'confirme');
  const dl = daysUntil(o.deadline);
  const mine = o.author_id === me.id;
  const isAdmin = me.role === 'admin';
  const myPl = placementOf(data, me.id, saison);

  const toggle = (kind, existing) => act(async () => {
    if (existing) await store.remove('reactions', existing.id);
    else await store.insert('reactions', { offer_id: o.id, user_id: me.id, kind });
  });
  const follow = () => act(async () => {
    await store.insert('applications', { student_id: me.id, offer_id: o.id, entreprise: o.entreprise, titre: o.titre, status: 'postule', note: '' });
    toast('Ajoutée à tes candidatures. Mets à jour son statut dans « Mon parcours ».');
  });
  const send = e => { e.preventDefault(); if (!txt.trim()) return; act(async () => { await store.insert('comments', { offer_id: o.id, author_id: me.id, body: txt.trim() }); setTxt(''); }); };

  return html`<article class=${'offer' + (o.status !== 'ouverte' ? ' closed' : '')} id=${'offre-' + o.id}>
    <div class="offer-top">
      <span class=${'tag t-' + o.type}>${TYPES[o.type]?.label}</span>
      ${o.status === 'pourvue' ? html`<span class="tag done">Pourvue</span>` : o.status === 'fermee' ? html`<span class="tag done">Fermée</span>` : null}
      ${o.cooptation ? html`<span class="tag coopt" title="Le lauréat peut recommander directement ton profil">Cooptation possible</span>` : null}
      ${o.status === 'ouverte' && dl !== null && dl <= 7 && dl >= 0 ? html`<span class="tag urgent"><${Icon} name="clock" size=${13}/> ${dl === 0 ? 'Dernier jour' : `J-${dl}`}</span>` : null}
      <span class="spacer"></span>
      <span class="muted small">${timeAgo(o.created_at)}</span>
    </div>
    <h3 class="offer-title">${o.titre}</h3>
    <p class="offer-meta"><strong>${o.entreprise}</strong> <span class="dot">·</span> <${Icon} name="pin" size=${14}/> ${[o.ville, o.pays].filter(Boolean).join(', ')}
      ${o.duree ? html` <span class="dot">·</span> ${o.duree}` : null}${o.remunere ? html` <span class="dot">·</span> Rémunéré` : null}</p>
    <p class="offer-target">${(o.annees || []).map(a => html`<span class="mini">${NIVEAUX[a]?.short}</span>`)}${(o.filieres || []).map(f => html`<span class="mini">${f}</span>`)}</p>
    ${!compact ? html`<p class=${'offer-desc' + (open ? ' full' : '')}>${o.description}</p>` : null}
    ${open && (o.contact || o.lien || o.deadline) ? html`<dl class="offer-more">
      ${o.contact ? html`<div><dt>Contact</dt><dd class="sel">${o.contact}</dd></div>` : null}
      ${o.lien ? html`<div><dt>Lien</dt><dd><a href=${o.lien.startsWith('http') ? o.lien : 'https://' + o.lien} target="_blank" rel="noopener">${o.lien}</a></dd></div>` : null}
      ${o.deadline ? html`<div><dt>Date limite</dt><dd>${new Date(o.deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</dd></div>` : null}
    </dl>` : null}
    <div class="offer-author">
      ${author ? html`<${Person} p=${author} score=${scores.get(author.id)} onOpen=${openProfile} size=${30}/>` : null}
      ${recrutes.length ? html`<span class="impact-pill"><${Icon} name="check" size=${14}/> ${recrutes.length} recruté${recrutes.length > 1 ? 's' : ''} grâce à cette offre</span>` : null}
    </div>
    <div class="offer-actions">
      <button class=${'act' + (iUtile ? ' on' : '')} onClick=${() => toggle('utile', iUtile)} aria-pressed=${!!iUtile} title="Dire au lauréat que son offre est utile"><${Icon} name="thumb" size=${16}/> Ça m’aide <b>${utile.length || ''}</b></button>
      <button class=${'act' + (open ? ' on' : '')} onClick=${() => setOpen(!open)} aria-expanded=${open}><${Icon} name="comment" size=${16}/> ${open ? 'Réduire' : 'Détails'} <b>${comments.length || ''}</b></button>
      <button class=${'act' + (iSave ? ' on' : '')} onClick=${() => toggle('save', iSave)} aria-pressed=${!!iSave}><${Icon} name="bookmark" size=${16}/> ${iSave ? 'Sauvegardée' : 'Sauvegarder'}</button>
      <span class="spacer"></span>
      ${me.role !== 'admin' && !mine && o.status === 'ouverte' && !myApp ? html`<button class="btn small" onClick=${follow}><${Icon} name="send" size=${15}/> J’ai postulé</button>` : null}
      ${myApp ? html`<span class="muted small">Candidature : ${{ postule: 'envoyée', entretien: 'entretien', retenu: 'retenu(e)', refuse: 'non retenue' }[myApp.status]}</span>` : null}
      ${!mine && me.role !== 'admin' && !myPl ? html`<button class="btn small accent" onClick=${() => setClaim(true)}><${Icon} name="trophy" size=${15}/> J’ai été retenu(e)</button>` : null}
    </div>
    ${(mine || isAdmin) ? html`<div class="owner-bar">
      <span class="muted small">${apps.length} candidat${apps.length > 1 ? 's' : ''} suivi${apps.length > 1 ? 's' : ''} sur la plateforme</span>
      <span class="spacer"></span>
      ${o.status === 'ouverte' ? html`<button class="btn tiny ghost" onClick=${() => act(() => store.update('offers', o.id, { status: 'pourvue' }))}>Marquer pourvue</button>` : html`<button class="btn tiny ghost" onClick=${() => act(() => store.update('offers', o.id, { status: 'ouverte' }))}>Rouvrir</button>`}
      ${mine ? html`<button class="btn tiny ghost" onClick=${onEdit}><${Icon} name="edit" size=${14}/> Modifier</button>` : null}
      <button class="btn tiny ghost danger-t" onClick=${() => ctx.confirm('Supprimer définitivement cette offre et ses commentaires ?', () => act(() => store.remove('offers', o.id)))}><${Icon} name="trash" size=${14}/> Supprimer</button>
    </div>` : null}
    ${open ? html`<div class="comments">
      ${comments.map(c => { const a = store.byId('profiles', c.author_id); return html`<div class="comment" key=${c.id}>
        <${Avatar} p=${a} size=${28}/>
        <div class="comment-body"><button class="linkish" onClick=${() => openProfile(a)}>${a?.full_name || 'Membre'}</button>${a?.id === o.author_id ? html` <span class="mini">Auteur</span>` : null} <span class="muted small">${timeAgo(c.created_at)}</span>
          <p>${c.body}</p></div>
        ${(c.author_id === me.id || isAdmin) ? html`<button class="icon-btn small" aria-label="Supprimer le commentaire" onClick=${() => act(() => store.remove('comments', c.id))}><${Icon} name="x" size=${14}/></button>` : null}
      </div>`; })}
      <form class="comment-form" onSubmit=${send}>
        <input id=${'c-' + o.id} placeholder=${mine ? 'Répondre aux étudiants…' : 'Poser une question au lauréat…'} value=${txt} onInput=${e => setTxt(e.target.value)} maxlength="1500"/>
        <button class="btn small primary" type="submit" disabled=${!txt.trim()}>Envoyer</button>
      </form>
    </div>` : null}
    ${claim ? html`<${ClaimModal} ctx=${ctx} offer=${o} onClose=${() => setClaim(false)}/>` : null}
  </article>`;
}

// L'étudiant déclare avoir été retenu grâce à l'offre. Le lauréat auteur devra confirmer.
export function ClaimModal({ ctx, offer, onClose }) {
  const { store, me, saison, act } = ctx;
  const n = niveauOf(me, saison);
  const [ville, setVille] = useState(offer?.ville || '');
  const submit = e => {
    e.preventDefault();
    act(async () => {
      await store.insert('placements', { student_id: me.id, offer_id: offer.id, saison, niveau: Math.min(n, 6), type: offer.type, entreprise: offer.entreprise, ville, pays: offer.pays || 'Maroc', source: 'plateforme' });
      const app = ctx.data.applications.find(a => a.offer_id === offer.id && a.student_id === me.id);
      if (app) await store.update('applications', app.id, { status: 'retenu', updated_at: new Date().toISOString() });
      toast('Bravo ! Le lauréat va recevoir ta demande de confirmation.');
      onClose();
    });
  };
  const author = store.byId('profiles', offer.author_id);
  return html`<${Modal} title="Félicitations !" onClose=${onClose}>
    <form class="form" onSubmit=${submit}>
      <p>Tu déclares avoir été retenu(e) pour <strong>${offer.titre}</strong> chez <strong>${offer.entreprise}</strong>.</p>
      <p class="muted">${author?.full_name || 'Le lauréat'} recevra une demande de confirmation. Une fois confirmée, ta réussite compte dans le suivi de ta promo et ${author?.full_name?.split(' ')[0] || 'le lauréat'} gagne des points d’impact.</p>
      <${Field} label="Ville du stage / poste"><input id="cl-ville" value=${ville} onInput=${e => setVille(e.target.value)}/><//>
      <div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn primary" type="submit">Envoyer la demande</button></div>
    </form>
  <//>`;
}

export function OfferComposer({ ctx, offer, onClose }) {
  const { store, me, act } = ctx;
  const editing = !!offer?.id;
  const [f, setF] = useState(() => ({
    type: 'stage', titre: '', entreprise: me.entreprise || '', ville: me.ville || '', pays: me.pays || 'Maroc', filieres: [], annees: [], description: '', contact: me.linkedin || '', lien: '', deadline: '', cooptation: false, remunere: false, duree: '', ...(offer || {}),
  }));
  const set = (k, v) => setF({ ...f, [k]: v });
  const toggleIn = (k, v) => set(k, f[k].includes(v) ? f[k].filter(x => x !== v) : [...f[k], v]);
  const setType = t => setF({ ...f, type: t, annees: f.annees.length ? f.annees : t === 'pfe' ? [5] : t === 'emploi' ? [6] : t === 'etranger' ? [4, 5] : [3, 4] });
  const valid = f.titre.trim().length >= 4 && f.entreprise.trim() && f.description.trim() && f.annees.length;
  const submit = e => {
    e.preventDefault(); if (!valid) return;
    const row = { type: f.type, titre: f.titre.trim(), entreprise: f.entreprise.trim(), ville: f.ville.trim(), pays: f.pays.trim() || 'Maroc', filieres: f.filieres, annees: f.annees, description: f.description.trim(), contact: f.contact.trim(), lien: f.lien.trim(), deadline: f.deadline || null, cooptation: f.cooptation, remunere: f.remunere, duree: f.duree.trim() };
    act(async () => {
      if (editing) { await store.update('offers', offer.id, row); toast('Offre mise à jour.'); }
      else { await store.insert('offers', { ...row, author_id: me.id, status: 'ouverte' }); toast('Offre publiée. +10 points d’impact'); }
      onClose();
    });
  };
  return html`<${Modal} title=${editing ? 'Modifier l’offre' : 'Publier une offre'} onClose=${onClose} wide>
    <form class="form" onSubmit=${submit}>
      <div class="chips" role="group" aria-label="Type">${Object.entries(TYPES).map(([k, v]) => html`<button type="button" class=${'chip t-' + k + (f.type === k ? ' on' : '')} onClick=${() => setType(k)}>${v.long}</button>`)}</div>
      <${Field} label="Intitulé"><input id="of-titre" required value=${f.titre} onInput=${e => set('titre', e.target.value)} placeholder="Ex. PFE : optimisation d’une ligne d’assemblage" maxlength="140"/><//>
      <div class="grid3">
        <${Field} label="Entreprise"><input id="of-ent" required value=${f.entreprise} onInput=${e => set('entreprise', e.target.value)}/><//>
        <${Field} label="Ville"><input id="of-ville" value=${f.ville} onInput=${e => set('ville', e.target.value)}/><//>
        <${Field} label="Pays"><input id="of-pays" value=${f.pays} onInput=${e => set('pays', e.target.value)}/><//>
      </div>
      <${Field} label="Niveaux ciblés"><div class="chips">${ANNEES_OPTS.map(([v, l]) => html`<button type="button" class=${'chip' + (f.annees.includes(v) ? ' on' : '')} onClick=${() => toggleIn('annees', v)}>${l}</button>`)}</div><//>
      <${Field} label="Filières ciblées" hint="Aucune sélection = toutes les filières"><div class="chips">${FILIERES.map(v => html`<button type="button" class=${'chip' + (f.filieres.includes(v) ? ' on' : '')} onClick=${() => toggleIn('filieres', v)}>${v}</button>`)}</div><//>
      <${Field} label="Description"><textarea id="of-desc" required rows="5" value=${f.description} onInput=${e => set('description', e.target.value)} placeholder="Missions, profil recherché, durée, démarche pour postuler…" maxlength="4000"></textarea><//>
      <div class="grid3">
        <${Field} label="Durée"><input id="of-duree" value=${f.duree} onInput=${e => set('duree', e.target.value)} placeholder="6 mois, CDI…"/><//>
        <${Field} label="Date limite"><input id="of-dl" type="date" value=${f.deadline || ''} onInput=${e => set('deadline', e.target.value)}/><//>
        <${Field} label="Contact"><input id="of-contact" value=${f.contact} onInput=${e => set('contact', e.target.value)} placeholder="Email, LinkedIn…"/><//>
      </div>
      <${Field} label="Lien vers l’annonce (facultatif)"><input id="of-lien" value=${f.lien} onInput=${e => set('lien', e.target.value)} placeholder="https://…"/><//>
      <div class="checks">
        <label class="check"><input id="of-coopt" type="checkbox" checked=${f.cooptation} onChange=${e => set('cooptation', e.target.checked)}/> Je peux recommander (coopter) les bons profils</label>
        <label class="check"><input id="of-rem" type="checkbox" checked=${f.remunere} onChange=${e => set('remunere', e.target.checked)}/> Rémunéré / gratifié</label>
      </div>
      <div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn primary" type="submit" disabled=${!valid}>${editing ? 'Enregistrer' : 'Publier'}</button></div>
    </form>
  <//>`;
}

export { typeForNiveau };
