// Entraide, Communauté (classement, annuaire, vitrine des talents) et profils.
import { html, useState, useMemo } from './vendor/preact-htm.js';
import { Icon, Modal, Field, Empty, Person, Avatar, toast, LevelChip, RoleLine } from './ui.js';
import { getLang } from './i18n.js';
import { FILIERES, NIVEAUX, CATEGORIES_Q, SECTEURS, niveauOf, statutOf, timeAgo, computeScores, badgesOf, levelOf, seasonLabel, routedTo } from './logic.js';
import { TalentPool } from './growth.js';
import { GroupesPage } from './groupes.js';
import { AnnuairePro } from './pro.js';
import { CoupePromos } from './saison.js';

// ---------------------------------------------------------------------------
// Entraide (questions / réponses)
// ---------------------------------------------------------------------------
export function EntraidePage(ctx) {
  const { data, store, me, go } = ctx;
  const [cat, setCat] = useState('');
  const [ask, setAsk] = useState(false);
  const pourMoi = data.questions.filter(q => routedTo(q, me) && !data.answers.some(a => a.question_id === q.id && a.author_id === me.id));
  const qs = (cat === 'moi' ? pourMoi : data.questions.filter(q => !cat || q.categorie === cat)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const q = ctx.sub2 && store.byId('questions', ctx.sub2);
  const open = id => go('reseau/entraide/' + id);
  if (q) return html`<${QuestionView} ctx=${ctx} q=${q} onBack=${() => go('reseau/entraide')}/>`;
  return html`<div class="sub-page">
    <div class="toolbar"><p class="muted small grow">Les questions des étudiants, les réponses des anciens. Une question sur une entreprise ou un pays arrive directement aux lauréats concernés.</p><button class="btn primary small" onClick=${() => setAsk(true)}><${Icon} name="plus" size=${16}/> Poser une question</button></div>
    <div class="chips">${pourMoi.length ? html`<button class=${'chip' + (cat === 'moi' ? ' on' : '')} onClick=${() => setCat(cat === 'moi' ? '' : 'moi')}><${Icon} name="send" size=${13}/> Pour toi <span class="count">${pourMoi.length}</span></button>` : null}${['', ...CATEGORIES_Q].map(c => html`<button class=${'chip' + (cat === c ? ' on' : '')} onClick=${() => setCat(c)}>${c || 'Toutes'}</button>`)}</div>
    <div class="list">${qs.length ? qs.map(q => {
      const ans = data.answers.filter(a => a.question_id === q.id); const au = store.byId('profiles', q.author_id);
      return html`<button class="qrow" key=${q.id} onClick=${() => open(q.id)}>
        <span class=${'qcount' + (q.best_answer_id ? ' solved' : ans.length ? '' : ' none')}><b class="mono">${ans.length}</b><span>réponse${ans.length > 1 ? 's' : ''}</span></span>
        <span class="qtxt"><span class="mini">${q.categorie}</span>${q.entreprise || q.pays ? html`<span class="mini hit"><${Icon} name=${q.entreprise ? 'briefcase' : 'globe'} size=${11}/> ${q.entreprise || q.pays}</span>` : null} <strong>${q.titre}</strong><span class="muted small">${au?.full_name || 'Membre'} · ${timeAgo(q.created_at)}${q.best_answer_id ? ' · Résolue' : ''}</span></span>
        <${Icon} name="arrow"/></button>`;
    }) : html`<${Empty} icon="qa" title="Pas encore de question ici">Pose la première, les lauréats sont notifiés.<//>`}</div>
    ${ask ? html`<${AskQuestion} ctx=${ctx} onClose=${() => setAsk(false)} onDone=${id => { setAsk(false); open(id); }}/>` : null}
  </div>`;
}

function QuestionView({ ctx, q, onBack }) {
  const { data, store, me, act, openProfile, scores } = ctx;
  const [txt, setTxt] = useState('');
  const au = store.byId('profiles', q.author_id);
  const ans = data.answers.filter(a => a.question_id === q.id).map(a => ({ ...a, v: data.votes.filter(v => v.answer_id === a.id) }))
    .sort((a, b) => (b.id === q.best_answer_id) - (a.id === q.best_answer_id) || b.v.length - a.v.length);
  return html`<div class="sub-page">
    <button class="btn ghost small back" onClick=${onBack}>← Toutes les questions</button>
    <article class="qview">
      <span class="mini">${q.categorie}</span>${q.entreprise || q.pays ? html`<span class="mini hit"><${Icon} name=${q.entreprise ? 'briefcase' : 'globe'} size=${11}/> Pour les lauréats ${q.entreprise ? 'de ' + q.entreprise : 'en ' + q.pays}</span>` : null}
      <h2 class="q-title">${q.titre}</h2>
      ${q.body ? html`<p>${q.body}</p>` : null}
      <div class="row"><${Person} p=${au} onOpen=${openProfile} size=${30}/><span class="muted small">${timeAgo(q.created_at)}</span><span class="spacer"></span>
        ${(q.author_id === me.id || me.role === 'admin') ? html`<button class="btn tiny ghost danger-t" onClick=${() => ctx.confirm('Supprimer cette question et ses réponses ?', () => act(async () => { await store.remove('questions', q.id); onBack(); }))}>Supprimer</button>` : null}</div>
    </article>
    <h2 class="section-title">${ans.length} réponse${ans.length > 1 ? 's' : ''}</h2>
    <div class="list">${ans.map(a => { const p = store.byId('profiles', a.author_id); const mine = a.v.find(v => v.user_id === me.id); const best = a.id === q.best_answer_id; return html`<div class=${'answer' + (best ? ' best' : '')} key=${a.id}>
      <div class="vote"><button class=${'icon-btn' + (mine ? ' on' : '')} aria-pressed=${!!mine} aria-label="Cette réponse est utile" onClick=${() => act(() => mine ? store.remove('votes', mine.id) : store.insert('votes', { answer_id: a.id, user_id: me.id }))}><${Icon} name="thumb" size=${16}/></button><b class="mono">${a.v.length}</b></div>
      <div class="answer-body">${best ? html`<span class="best-tag"><${Icon} name="check" size=${14}/> Meilleure réponse</span>` : null}<p>${a.body}</p>
        <div class="row"><${Person} p=${p} score=${scores.get(p?.id)} onOpen=${openProfile} size=${26}/><span class="muted small">${timeAgo(a.created_at)}</span><span class="spacer"></span>
        ${q.author_id === me.id && !best && a.author_id !== me.id ? html`<button class="btn tiny ghost" onClick=${() => act(async () => { await store.update('questions', q.id, { best_answer_id: a.id }); toast('Meilleure réponse choisie. Merci pour le lauréat !'); })}>Choisir comme meilleure réponse</button>` : null}
        ${(a.author_id === me.id || me.role === 'admin') ? html`<button class="icon-btn small" aria-label="Supprimer" onClick=${() => act(() => store.remove('answers', a.id))}><${Icon} name="trash" size=${14}/></button>` : null}</div></div>
    </div>`; })}</div>
    <form class="form answer-form" onSubmit=${e => { e.preventDefault(); act(async () => { await store.insert('answers', { question_id: q.id, author_id: me.id, body: txt.trim() }); setTxt(''); toast('Réponse publiée. +5 points'); }); }}>
      <${Field} label="Ta réponse"><textarea id="ans-txt" rows="4" value=${txt} onInput=${e => setTxt(e.target.value)} placeholder="Partage ton expérience concrète…" maxlength="3000"></textarea><//>
      <div class="row-end"><button class="btn primary" disabled=${!txt.trim()}>Répondre</button></div>
    </form>
  </div>`;
}

export function AskQuestion({ ctx, onClose, onDone, initial = {} }) {
  const { store, me, act, data } = ctx;
  const [f, setF] = useState({ categorie: initial.pays ? 'Étranger & visas' : CATEGORIES_Q[0], titre: '', body: '', entreprise: '', pays: '', ...initial });
  const [cible, setCible] = useState(initial.entreprise || initial.pays ? true : false);
  // Combien de lauréats recevront la question
  const fake = { entreprise: cible ? f.entreprise.trim() : '', pays: cible ? f.pays.trim() : '', author_id: me.id };
  const n = cible && (fake.entreprise || fake.pays) ? data.profiles.filter(p => routedTo(fake, p)).length : 0;
  return html`<${Modal} title="Poser une question" onClose=${onClose}>
    <form class="form" onSubmit=${e => { e.preventDefault(); act(async () => { const row = { author_id: me.id, categorie: f.categorie, titre: f.titre.trim(), body: f.body.trim() }; if (fake.entreprise) row.entreprise = fake.entreprise; if (fake.pays) row.pays = fake.pays; const q = await store.insert('questions', row); if (n) toast(`Question envoyée à ${n} lauréat${n > 1 ? 's' : ''}.`); onDone(q.id); }); }}>
      <${Field} label="Catégorie"><select id="aq-cat" value=${f.categorie} onChange=${e => setF({ ...f, categorie: e.target.value })}>${CATEGORIES_Q.map(c => html`<option value=${c}>${c}</option>`)}</select><//>
      <${Field} label="Question"><input id="aq-titre" required value=${f.titre} onInput=${e => setF({ ...f, titre: e.target.value })} maxlength="160" placeholder="Ex. Comment obtenir un visa pour un stage au Canada ?"/><//>
      <${Field} label="Détails (facultatif)"><textarea id="aq-body" rows="4" value=${f.body} onInput=${e => setF({ ...f, body: e.target.value })} maxlength="3000"></textarea><//>
      <label class="check"><input id="aq-cible" type="checkbox" checked=${cible} onChange=${e => setCible(e.target.checked)}/> Elle concerne une entreprise ou un pays précis</label>
      ${cible ? html`<div class="grid2"><${Field} label="Entreprise"><input id="aq-ent" value=${f.entreprise} onInput=${e => setF({ ...f, entreprise: e.target.value })} placeholder="Ex. Renault, OCP…" maxlength="80"/><//><${Field} label="Pays"><input id="aq-pays" value=${f.pays} onInput=${e => setF({ ...f, pays: e.target.value })} placeholder="Ex. France, Canada…" maxlength="60"/><//></div>
        <p class="small muted">${n ? `${n} lauréat${n > 1 ? 's' : ''} recevr${n > 1 ? 'ont' : 'a'} ta question directement.` : 'Aucun lauréat inscrit ne correspond encore : la question reste visible par tous.'}</p>` : null}
      <div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn primary" disabled=${f.titre.trim().length < 5}>Publier</button></div>
    </form><//>`;
}

// ---------------------------------------------------------------------------
// Réseau : entraide, annuaire, classement et vitrine des talents (le mentorat a sa propre page)
// ---------------------------------------------------------------------------
const RESEAU_TABS = [['groupes', 'Groupes', 'people'], ['entraide', 'Entraide', 'qa'], ['annuaire', 'Annuaire', 'network'], ['classement', 'Classement', 'trophy'], ['talents', 'Talents', 'spark']];

export function ReseauPage(ctx) {
  const { data, me, sub, go } = ctx;
  const tabs = RESEAU_TABS.filter(([k]) => me.role !== 'etudiant' || !['classement', 'talents'].includes(k));
  const tab = tabs.some(([k]) => k === sub) ? sub : 'groupes';
  return html`<section class="page">
    <header class="page-head"><div><p class="eyebrow">${data.profiles.filter(p => p.role === 'laureat').length} lauréats · ${data.profiles.filter(p => p.role === 'etudiant').length} étudiants</p><h1>Réseau</h1></div></header>
    <div class="icon-tabs" role="tablist" style=${`--n:${tabs.length}`}>${tabs.map(([k, l, i]) => html`<button role="tab" aria-selected=${tab === k} class=${tab === k ? 'on' : ''} onClick=${() => go('reseau/' + k)}><${Icon} name=${i} size=${20}/><span>${l}</span></button>`)}</div>
    ${tab === 'groupes' ? html`<${GroupesPage} ctx=${ctx}/>` : null}
    ${tab === 'entraide' ? html`<${EntraidePage} ...${ctx}/>` : null}
    ${tab === 'annuaire' ? html`<${AnnuairePro} ctx=${ctx}/>` : null}
    ${tab === 'classement' ? html`<${Classement} ctx=${ctx}/>` : null}
    ${tab === 'talents' ? html`<${TalentPool} ctx=${ctx}/>` : null}
  </section>`;
}

function Classement({ ctx }) {
  const promos = ctx.sub2 === 'promos';
  return html`<div class="sub-page">
    <div class="seg">${[['', 'Lauréats'], ['promos', 'Coupe des promos']].map(([k, l]) => html`<button class=${(ctx.sub2 || '') === k ? 'on' : ''} onClick=${() => ctx.go('reseau/classement' + (k ? '/' + k : ''))}>${l}</button>`)}</div>
    ${promos ? html`<${CoupePromos} ctx=${ctx}/>` : html`<${ClassementLaureats} ctx=${ctx}/>`}
  </div>`;
}

function ClassementLaureats({ ctx }) {
  const { data, scores, saison, openProfile } = ctx;
  const [period, setPeriod] = useState('mois');
  const periodScores = useMemo(() => period === 'tout' ? scores : computeScores(data, period === 'mois' ? new Date(Date.now() - 30 * 864e5) : new Date(saison, 8, 1)), [data, period]);
  const board = data.profiles.filter(p => p.role === 'laureat').map(p => ({ p, pts: periodScores.get(p.id)?.points || 0 })).filter(x => x.pts > 0).sort((a, b) => b.pts - a.pts).slice(0, 20);
  return html`<div class="sub-page">
    <p class="muted small">Les lauréats qui aident le plus : offres, recrutements confirmés, mentorats, réponses.</p>
    <div class="seg">${[['mois', '30 jours'], ['saison', `Saison ${seasonLabel(saison)}`], ['tout', 'Depuis le début']].map(([k, l]) => html`<button class=${period === k ? 'on' : ''} onClick=${() => setPeriod(k)}>${l}</button>`)}</div>
    <ol class="board">${board.map((x, i) => { const s = scores.get(x.p.id); return html`<li class=${i < 3 ? 'podium p' + (i + 1) : ''}>
      <span class="rank-n mono">${i < 3 ? html`<span class=${'medal m' + (i + 1)}>${i + 1}</span>` : i + 1}</span><${Person} p=${x.p} score=${s} onOpen=${openProfile}/>
      <span class="board-facts small muted"><span title="Recrutés"><${Icon} name="briefcase" size=${14}/> ${s?.recrutes || 0}</span><span title="Mentorats"><${Icon} name="mentor" size=${14}/> ${s?.mentorats || 0}</span><span title="Offres"><${Icon} name="feed" size=${14}/> ${s?.offres || 0}</span></span>
      <span class="mono pts">${x.pts} pts</span></li>`; })}</ol>
    ${!board.length ? html`<${Empty} icon="trophy" title="Personne n’a encore marqué de points sur cette période">Publie une offre ou réponds à une question pour ouvrir le classement.<//>` : null}
  </div>`;
}

// ---------------------------------------------------------------------------
// Profil (fiche d'un membre) et édition de mon profil
// ---------------------------------------------------------------------------
export function ProfileModal({ ctx, p, onClose, onAskMentor }) {
  const { data, me, scores, saison } = ctx;
  const s = scores.get(p.id);
  const badges = badgesOf(s, p, { star: ctx.starId });
  const helped = data.placements.filter(x => x.laureat_id === p.id && x.status === 'confirme').length;
  const st = p.role === 'etudiant' ? statutOf(data, p, saison) : null;
  return html`<${Modal} title="Profil" onClose=${onClose}>
    <div class="profile">
      <div class="profile-head"><${Avatar} p=${p} size=${64}/><div><h2>${p.full_name}</h2><${RoleLine} p=${p} score=${s}/>
        <p class="small muted">${p.role === 'laureat' ? `${p.filiere} · Promo ${p.promo}` : p.role === 'etudiant' ? `${NIVEAUX[niveauOf(p, saison)]?.label} · promo ${p.promo}` : ''}${p.ville ? ` · ${p.ville}` : ''}${p.pays && p.pays !== 'Maroc' ? `, ${p.pays}` : ''}</p></div></div>
      ${p.poste || p.entreprise ? html`<p>${p.poste ? html`<strong>${p.poste}</strong>` : null}${p.entreprise ? html`${p.poste ? ' chez ' : ''}<button class="linkish" onClick=${() => { onClose(); ctx.openEntreprise?.(p.entreprise); }}>${p.entreprise}</button>` : null}${p.secteur ? html` <span class="mini">${p.secteur}</span>` : null}</p>` : null}
      ${st ? html`<p><span class=${'state-pill s-' + st.key}>${st.label}</span>${st.pl ? ` ${st.pl.entreprise}` : ''}</p>` : null}
      ${p.role === 'etudiant' && p.disponibilite ? html`<p class="small"><${Icon} name="calendar" size=${14}/> Disponibilité : <span translate="no" dir="auto">${p.disponibilite}</span></p>` : null}
      ${p.bio ? html`<p>${p.bio}</p>` : null}
      ${(p.competences || []).length ? html`<p class="offer-target">${p.competences.map(c => html`<span class="mini">${c}</span>`)}</p>` : null}
      ${p.role !== 'etudiant' ? html`<div class="profile-stats"><span><b class="mono">${s?.points || 0}</b> points</span><span><b class="mono">${helped}</b> recrutés</span><span><b class="mono">${s?.mentorats || 0}</b> mentorats</span><span><b class="mono">${s?.offres || 0}</b> offres</span></div>` : null}
      ${badges.length ? html`<div class="badge-row">${badges.map(b => html`<span class="mini badge-mini" title=${b.desc}><${Icon} name="star" size=${12}/> ${b.nom}</span>`)}</div>` : null}
      ${(p.linkedin || p.contact) ? html`<dl class="offer-more">${p.linkedin ? html`<div><dt>LinkedIn</dt><dd><a href=${p.linkedin.startsWith('http') ? p.linkedin : 'https://' + p.linkedin} target="_blank" rel="noopener">${p.linkedin}</a></dd></div>` : null}${p.contact ? html`<div><dt>Contact</dt><dd class="sel">${p.contact}</dd></div>` : null}${p.cv_url ? html`<div><dt>CV</dt><dd><a href=${p.cv_url} target="_blank" rel="noopener">Voir le CV</a></dd></div>` : null}</dl>` : null}
      ${p.mentor_dispo && p.role === 'laureat' && p.id !== me.id && me.role !== 'admin' ? html`<div class="row-end"><button class="btn primary" onClick=${() => onAskMentor(p)}><${Icon} name="mentor" size=${16}/> Demander de l’aide</button></div>` : null}
    </div>
  <//>`;
}

export function ProfileForm({ ctx, initial, onDone, onboarding }) {
  const { store, act } = ctx;
  const [f, setF] = useState(() => ({ full_name: '', role: 'etudiant', filiere: FILIERES[0], promo: new Date().getFullYear() + 1, entreprise: '', poste: '', ville: '', pays: 'Maroc', bio: '', competences: [], linkedin: '', contact: '', cv_url: '', disponibilite: '', mentor_dispo: false, mentor_sujets: '', vitrine: true, secteur: '', parrain_dispo: false, ...(initial || {}) }));
  const set = (k, v) => setF({ ...f, [k]: v });
  const [comp, setComp] = useState((f.competences || []).join(', '));
  const ok = f.full_name.trim().length >= 2 && f.promo >= 1990 && f.promo <= 2040;
  const submit = e => {
    e.preventDefault(); if (!ok) return;
    const row = { full_name: f.full_name.trim(), role: f.role === 'admin' ? 'admin' : f.role, filiere: f.filiere, promo: +f.promo, entreprise: f.entreprise.trim() || null, poste: f.poste.trim() || null, ville: f.ville.trim() || null, pays: f.pays.trim() || 'Maroc', bio: f.bio.trim() || null, competences: comp.split(',').map(x => x.trim()).filter(Boolean).slice(0, 15), linkedin: f.linkedin.trim() || null, contact: f.contact.trim() || null, cv_url: f.cv_url.trim() || null, mentor_dispo: !!f.mentor_dispo, mentor_sujets: (f.mentor_sujets || '').trim() || null, vitrine: !!f.vitrine };
    if (f.role === 'laureat') { row.secteur = f.secteur || null; row.parrain_dispo = !!f.parrain_dispo; }
    // Inscription : l'accord donné sur l'écran de création du compte, la langue et le choix pour les emails
    if (onboarding) {
      const meta = store.session?.user?.user_metadata || {};
      if (meta.consent_at) row.consent_at = meta.consent_at;
      row.emails_hebdo = meta.emails_hebdo !== false;
      row.langue = getLang();
    }
    // Colonne ajoutée par la mise à jour Phase 1 : envoyée seulement si la base la connaît déjà ou si elle est remplie
    if ((f.disponibilite || '').trim() || (initial && 'disponibilite' in initial)) row.disponibilite = (f.disponibilite || '').trim() || null;
    act(async () => {
      if (onboarding) await store.insert('profiles', { id: store.userId, ...row });
      else await store.update('profiles', initial.id, row);
      toast(onboarding ? 'Bienvenue dans le réseau !' : 'Profil enregistré.');
      onDone?.();
    });
  };
  const isStudent = f.role === 'etudiant';
  return html`<form class="form" onSubmit=${submit}>
    ${f.role !== 'admin' ? html`<div class="seg" role="group" aria-label="Je suis"><button type="button" class=${isStudent ? 'on' : ''} onClick=${() => set('role', 'etudiant')}>Je suis étudiant(e)</button><button type="button" class=${!isStudent ? 'on' : ''} onClick=${() => set('role', 'laureat')}>Je suis lauréat(e)</button></div>` : null}
    <div class="grid2">
      <${Field} label="Nom complet"><input id="pf-name" required value=${f.full_name} onInput=${e => set('full_name', e.target.value)} maxlength="80"/><//>
      <${Field} label=${isStudent ? 'Promo (année de diplôme prévue)' : 'Promo (année de diplôme)'} hint=${isStudent ? 'Ex. en 5A cette année : ' + (new Date().getMonth() >= 8 ? new Date().getFullYear() + 1 : new Date().getFullYear()) + '. Ton niveau se met à jour tout seul chaque année.' : ''}><input id="pf-promo" type="number" min="1990" max="2040" required value=${f.promo} onInput=${e => set('promo', e.target.value)}/><//>
    </div>
    <${Field} label="Filière"><select id="pf-fil" value=${f.filiere} onChange=${e => set('filiere', e.target.value)}>${FILIERES.map(x => html`<option value=${x}>${x}</option>`)}</select><//>
    ${!isStudent ? html`<div class="grid3"><${Field} label="Entreprise"><input id="pf-ent" value=${f.entreprise || ''} onInput=${e => set('entreprise', e.target.value)}/><//><${Field} label="Poste"><input id="pf-poste" value=${f.poste || ''} onInput=${e => set('poste', e.target.value)}/><//>
      <${Field} label="Secteur"><select id="pf-sect" value=${f.secteur || ''} onChange=${e => set('secteur', e.target.value)}><option value="">—</option>${SECTEURS.map(x => html`<option value=${x}>${x}</option>`)}</select><//></div>` : null}
    <div class="grid2"><${Field} label="Ville"><input id="pf-ville" value=${f.ville || ''} onInput=${e => set('ville', e.target.value)}/><//><${Field} label="Pays"><input id="pf-pays" value=${f.pays || ''} onInput=${e => set('pays', e.target.value)}/><//></div>
    <${Field} label="Bio courte"><textarea id="pf-bio" rows="3" maxlength="600" value=${f.bio || ''} onInput=${e => set('bio', e.target.value)} placeholder=${isStudent ? 'Ce que tu cherches, tes projets…' : 'Ton parcours, comment tu peux aider…'}></textarea><//>
    <${Field} label="Compétences" hint="Séparées par des virgules"><input id="pf-comp" value=${comp} onInput=${e => setComp(e.target.value)} placeholder="Lean, CATIA, Python…"/><//>
    <div class="grid2"><${Field} label="LinkedIn"><input id="pf-li" value=${f.linkedin || ''} onInput=${e => set('linkedin', e.target.value)} placeholder="linkedin.com/in/…"/><//><${Field} label="Contact visible par les membres"><input id="pf-contact" value=${f.contact || ''} onInput=${e => set('contact', e.target.value)} placeholder="Email ou téléphone"/><//></div>
    ${isStudent ? html`<div class="grid2"><${Field} label="Lien vers ton CV (Google Drive, etc.)"><input id="pf-cv" value=${f.cv_url || ''} onInput=${e => set('cv_url', e.target.value)}/><//>
      <${Field} label="Disponibilité"><input id="pf-dispo" maxlength="80" value=${f.disponibilite || ''} onInput=${e => set('disponibilite', e.target.value)} placeholder="Ex. dès février, 6 mois"/><//></div>
      <label class="check"><input id="pf-vit" type="checkbox" checked=${f.vitrine} onChange=${e => set('vitrine', e.target.checked)}/> Apparaître dans la Vitrine des talents quand je cherche (visible par les lauréats)</label>` : html`
      <label class="check"><input id="pf-mentor" type="checkbox" checked=${f.mentor_dispo} onChange=${e => set('mentor_dispo', e.target.checked)}/> Je suis disponible pour du mentorat</label>
      ${f.mentor_dispo ? html`<${Field} label="Sujets sur lesquels je peux aider"><input id="pf-msuj" value=${f.mentor_sujets || ''} onInput=${e => set('mentor_sujets', e.target.value)} placeholder="Stages à l’étranger, entretiens, automobile…"/><//>` : null}
      ${f.role === 'laureat' ? html`<label class="check"><input id="pf-parrain" type="checkbox" checked=${f.parrain_dispo} onChange=${e => set('parrain_dispo', e.target.checked)}/> Je veux bien parrainer un à trois étudiants de 3A de ma filière</label>` : null}
      ${f.role === 'laureat' && !initial?.verified ? html`<p class="small muted">Ton badge « Lauréat vérifié » sera ajouté par l’administration de l’école.</p>` : null}`}
    <div class="row-end"><button class="btn primary" disabled=${!ok}>${onboarding ? 'Rejoindre la communauté' : 'Enregistrer'}</button></div>
  </form>`;
}

export { levelOf, LevelChip };
