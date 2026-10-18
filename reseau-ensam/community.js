// Mentorat, Entraide, Communauté (classement, annuaire, vitrine), profils et administration.
import { html, useState, useMemo } from './vendor/preact-htm.js';
import { Icon, Modal, Field, Empty, Person, Avatar, Tabs, toast, LevelChip, RoleLine } from './ui.js';
import { FILIERES, NIVEAUX, CATEGORIES_Q, niveauOf, statutOf, timeAgo, computeScores, badgesOf, levelOf, seasonLabel, slotState } from './logic.js';
import { TalentPool, ExpressMentor, ExpressStrip, MyBookings } from './growth.js';

// ---------------------------------------------------------------------------
// Mentorat
// ---------------------------------------------------------------------------
export function MentoratPage(ctx) {
  const { data, me, store, scores, act, openProfile } = ctx;
  const isStudent = me.role === 'etudiant';
  // « reseau/mentorat/rdv » ouvre directement les rendez-vous de 15 min
  const [tab, setTab] = useState(ctx.sub2 === 'rdv' ? (isStudent ? 'envoyees' : 'creneaux') : isStudent ? 'mentors' : 'recues');
  const [fil, setFil] = useState('');
  const [ask, setAsk] = useState(null);
  const mentors = data.profiles.filter(p => p.mentor_dispo && p.id !== me.id && (!fil || p.filiere === fil))
    .sort((a, b) => (scores.get(b.id)?.points || 0) - (scores.get(a.id)?.points || 0));
  const recues = data.mentorships.filter(m => m.mentor_id === me.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const envoyees = data.mentorships.filter(m => m.student_id === me.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const freeSlots = id => data.slots.filter(s => s.mentor_id === id && slotState(s) === 'libre').length;
  const myRdv = data.slots.filter(s => s.student_id === me.id && slotState(s) === 'reserve').length;
  const booked = data.slots.filter(s => s.mentor_id === me.id && slotState(s) === 'reserve').length;
  const tabs = [['mentors', 'Les mentors'],
    ...(me.role === 'laureat' ? [['recues', 'Demandes reçues', recues.filter(m => m.status === 'demande').length], ['creneaux', 'Mes créneaux', booked]] : me.role !== 'etudiant' ? [['recues', 'Demandes reçues', recues.filter(m => m.status === 'demande').length]] : []),
    ...(isStudent || envoyees.length ? [['envoyees', 'Mes demandes', envoyees.length + myRdv]] : [])];

  return html`<div class="sub-page">
    <div class="toolbar">
      <div class="seg" role="group">${tabs.map(([k, l, c]) => html`<button class=${tab === k ? 'on' : ''} onClick=${() => setTab(k)}>${l}${c ? html` <span class="count">${c}</span>` : null}</button>`)}</div>
      ${me.role !== 'etudiant' ? html`<label class="switch"><input id="mentor-dispo" type="checkbox" checked=${!!me.mentor_dispo} onChange=${e => act(() => store.update('profiles', me.id, { mentor_dispo: e.target.checked }))}/> Disponible pour du mentorat</label>` : null}
    </div>
    ${tab === 'mentors' ? html`
      <${ExpressStrip} ctx=${ctx} fil=${fil}/>
      ${isStudent ? html`<div class="section-head"><h2 class="h-ico"><${Icon} name="mentor"/> Demander un mentorat</h2><span class="muted small">Pour un suivi plus long : CV, choix de PFE, candidatures</span></div>` : null}
      <div class="filter-row"><select id="m-fil" value=${fil} onChange=${e => setFil(e.target.value)} aria-label="Filière"><option value="">Toutes filières</option>${FILIERES.map(f => html`<option value=${f}>${f}</option>`)}</select></div>
      <div class="cards">${mentors.length ? mentors.map(p => html`<div class="mcard" key=${p.id}>
        <${Person} p=${p} score=${scores.get(p.id)} onOpen=${openProfile} size=${44}/>
        <p class="small"><${Icon} name="briefcase" size=${14}/> ${p.poste ? `${p.poste}${p.entreprise ? ' · ' + p.entreprise : ''}` : ''}${p.ville ? ` · ${p.ville}` : ''}</p>
        ${p.mentor_sujets ? html`<p class="topics"><span class="muted small">Peut t’aider sur :</span> ${p.mentor_sujets}</p>` : null}
        ${freeSlots(p.id) ? html`<p><span class="mini good"><${Icon} name="clock" size=${12}/> ${freeSlots(p.id)} créneau${freeSlots(p.id) > 1 ? 'x' : ''} de 15 min</span></p>` : null}
        <div class="row"><span class="muted small">${(n => `${n} mentorat${n > 1 ? 's' : ''} terminé${n > 1 ? 's' : ''}`)(data.mentorships.filter(m => m.mentor_id === p.id && m.status === 'terminee').length)}</span><span class="spacer"></span><button class="btn small primary" onClick=${() => setAsk(p)}>Demander</button></div>
      </div>`) : html`<${Empty} icon="mentor" title="Aucun mentor dans cette filière pour l’instant">Essaie une autre filière, ou pose ta question dans l’Entraide.<//>`}</div>` : null}
    ${tab === 'recues' ? html`<div class="list">${recues.length ? recues.map(m => html`<${MentorshipRow} key=${m.id} m=${m} ctx=${ctx} side="mentor"/>`) : html`<${Empty} icon="mentor" title="Aucune demande reçue">Active ta disponibilité pour apparaître dans la liste des mentors.<//>`}</div>` : null}
    ${tab === 'creneaux' ? html`<${ExpressMentor} ctx=${ctx}/>` : null}
    ${tab === 'envoyees' ? html`<${MyBookings} ctx=${ctx}/>` : null}
    ${tab === 'envoyees' && (envoyees.length || !data.slots.some(s => s.student_id === me.id)) ? html`<div class="list">${envoyees.length ? envoyees.map(m => html`<${MentorshipRow} key=${m.id} m=${m} ctx=${ctx} side="student"/>`) : html`<${Empty} icon="mentor" title="Aucune demande envoyée">Choisis un mentor et explique en deux phrases ce dont tu as besoin.<//>`}</div>` : null}
    ${ask ? html`<${AskMentor} ctx=${ctx} mentor=${ask} onClose=${() => setAsk(null)}/>` : null}
  </div>`;
}

const M_STATUS = { demande: 'En attente', acceptee: 'Acceptée', terminee: 'Terminée', refusee: 'Déclinée' };

function MentorshipRow({ m, ctx, side }) {
  const { store, act, openProfile } = ctx;
  const other = store.byId('profiles', side === 'mentor' ? m.student_id : m.mentor_id);
  const [rep, setRep] = useState(m.reponse || '');
  const [merci, setMerci] = useState(m.merci || '');
  return html`<div class="mrow">
    <div class="mrow-head"><${Person} p=${other} onOpen=${openProfile} size=${34}/><span class="spacer"></span><span class=${'state-pill m-' + m.status}>${M_STATUS[m.status]}</span></div>
    <p><strong>${m.sujet}</strong> <span class="muted small">· ${timeAgo(m.created_at)}</span></p>
    ${m.message ? html`<p class="quote">${m.message}</p>` : null}
    ${m.reponse && !(side === 'mentor' && m.status === 'demande') ? html`<p class="small"><span class="muted">Réponse du mentor :</span> ${m.reponse}</p>` : null}
    ${m.merci ? html`<p class="small merci-inline"><${Icon} name="heart" size=${14}/> ${m.merci}</p>` : null}
    ${side === 'mentor' && m.status === 'demande' ? html`<div class="form">
      <input id=${'rep-' + m.id} placeholder="Ta réponse (créneau proposé, contact…)" value=${rep} onInput=${e => setRep(e.target.value)}/>
      <div class="row-end"><button class="btn small ghost" onClick=${() => act(() => store.update('mentorships', m.id, { status: 'refusee', reponse: rep }))}>Décliner</button><button class="btn small primary" onClick=${() => act(async () => { await store.update('mentorships', m.id, { status: 'acceptee', reponse: rep }); toast('Mentorat accepté. +10 points'); })}>Accepter</button></div></div>` : null}
    ${side === 'mentor' && m.status === 'acceptee' ? html`<div class="row-end"><button class="btn small" onClick=${() => act(async () => { await store.update('mentorships', m.id, { status: 'terminee' }); toast('Mentorat terminé. +20 points'); })}>Marquer comme terminé</button></div>` : null}
    ${side === 'student' && m.status === 'acceptee' ? html`<div class="row-end"><button class="btn small" onClick=${() => act(() => store.update('mentorships', m.id, { status: 'terminee' }))}>L’échange a eu lieu</button></div>` : null}
    ${side === 'student' && m.status === 'terminee' && !m.merci ? html`<form class="comment-form" onSubmit=${e => { e.preventDefault(); act(async () => { await store.update('mentorships', m.id, { merci: merci.trim() }); toast('Merci envoyé !'); }); }}>
      <input id=${'merci-' + m.id} placeholder="Un mot de remerciement pour ton mentor…" value=${merci} onInput=${e => setMerci(e.target.value)}/><button class="btn small primary" disabled=${!merci.trim()}>Remercier</button></form>` : null}
  </div>`;
}

function AskMentor({ ctx, mentor, onClose }) {
  const { store, me, act } = ctx;
  const [sujet, setSujet] = useState(''); const [msg, setMsg] = useState('');
  return html`<${Modal} title=${`Demande à ${mentor.full_name}`} onClose=${onClose}>
    <form class="form" onSubmit=${e => { e.preventDefault(); act(async () => { await store.insert('mentorships', { student_id: me.id, mentor_id: mentor.id, sujet: sujet.trim(), message: msg.trim() }); toast('Demande envoyée.'); onClose(); }); }}>
      ${mentor.mentor_sujets ? html`<p class="muted small">Peut t’aider sur : ${mentor.mentor_sujets}</p>` : null}
      <${Field} label="Sujet"><input id="am-sujet" required value=${sujet} onInput=${e => setSujet(e.target.value)} placeholder="Ex. Préparer mon entretien chez…" maxlength="140"/><//>
      <${Field} label="Message" hint="Présente-toi en deux phrases et dis ce que tu attends (relecture de CV, appel de 20 min…)."><textarea id="am-msg" rows="4" value=${msg} onInput=${e => setMsg(e.target.value)} maxlength="1500"></textarea><//>
      <div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn primary" disabled=${sujet.trim().length < 3}>Envoyer</button></div>
    </form><//>`;
}

// ---------------------------------------------------------------------------
// Entraide (questions / réponses)
// ---------------------------------------------------------------------------
export function EntraidePage(ctx) {
  const { data, store } = ctx;
  const [cat, setCat] = useState('');
  const [openQ, setOpenQ] = useState(null);
  const [ask, setAsk] = useState(false);
  const qs = data.questions.filter(q => !cat || q.categorie === cat).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const q = openQ && store.byId('questions', openQ);
  if (q) return html`<${QuestionView} ctx=${ctx} q=${q} onBack=${() => setOpenQ(null)}/>`;
  return html`<div class="sub-page">
    <div class="toolbar"><p class="muted small grow">Les questions des étudiants, les réponses des anciens.</p><button class="btn primary small" onClick=${() => setAsk(true)}><${Icon} name="plus" size=${16}/> Poser une question</button></div>
    <div class="chips">${['', ...CATEGORIES_Q].map(c => html`<button class=${'chip' + (cat === c ? ' on' : '')} onClick=${() => setCat(c)}>${c || 'Toutes'}</button>`)}</div>
    <div class="list">${qs.length ? qs.map(q => {
      const ans = data.answers.filter(a => a.question_id === q.id); const au = store.byId('profiles', q.author_id);
      return html`<button class="qrow" key=${q.id} onClick=${() => setOpenQ(q.id)}>
        <span class=${'qcount' + (q.best_answer_id ? ' solved' : ans.length ? '' : ' none')}><b class="mono">${ans.length}</b><span>réponse${ans.length > 1 ? 's' : ''}</span></span>
        <span class="qtxt"><span class="mini">${q.categorie}</span> <strong>${q.titre}</strong><span class="muted small">${au?.full_name || 'Membre'} · ${timeAgo(q.created_at)}${q.best_answer_id ? ' · Résolue' : ''}</span></span>
        <${Icon} name="arrow"/></button>`;
    }) : html`<${Empty} icon="qa" title="Pas encore de question ici">Pose la première, les lauréats sont notifiés.<//>`}</div>
    ${ask ? html`<${AskQuestion} ctx=${ctx} onClose=${() => setAsk(false)} onDone=${id => { setAsk(false); setOpenQ(id); }}/>` : null}
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
      <span class="mini">${q.categorie}</span>
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

function AskQuestion({ ctx, onClose, onDone }) {
  const { store, me, act } = ctx;
  const [f, setF] = useState({ categorie: CATEGORIES_Q[0], titre: '', body: '' });
  return html`<${Modal} title="Poser une question" onClose=${onClose}>
    <form class="form" onSubmit=${e => { e.preventDefault(); act(async () => { const q = await store.insert('questions', { author_id: me.id, categorie: f.categorie, titre: f.titre.trim(), body: f.body.trim() }); onDone(q.id); }); }}>
      <${Field} label="Catégorie"><select id="aq-cat" value=${f.categorie} onChange=${e => setF({ ...f, categorie: e.target.value })}>${CATEGORIES_Q.map(c => html`<option value=${c}>${c}</option>`)}</select><//>
      <${Field} label="Question"><input id="aq-titre" required value=${f.titre} onInput=${e => setF({ ...f, titre: e.target.value })} maxlength="160" placeholder="Ex. Comment obtenir un visa pour un stage au Canada ?"/><//>
      <${Field} label="Détails (facultatif)"><textarea id="aq-body" rows="4" value=${f.body} onInput=${e => setF({ ...f, body: e.target.value })} maxlength="3000"></textarea><//>
      <div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn primary" disabled=${f.titre.trim().length < 5}>Publier</button></div>
    </form><//>`;
}

// ---------------------------------------------------------------------------
// Réseau : entraide, mentorat, annuaire, classement et vitrine des talents
// ---------------------------------------------------------------------------
const RESEAU_TABS = [['entraide', 'Entraide', 'qa'], ['mentorat', 'Mentorat', 'mentor'], ['annuaire', 'Annuaire', 'people'], ['classement', 'Classement', 'trophy'], ['talents', 'Talents', 'spark']];

export function ReseauPage(ctx) {
  const { data, me, sub, go } = ctx;
  const tabs = RESEAU_TABS.filter(([k]) => me.role !== 'etudiant' || !['classement', 'talents'].includes(k));
  const tab = tabs.some(([k]) => k === sub) ? sub : 'entraide';
  const pendingM = data.mentorships.filter(m => m.mentor_id === me.id && m.status === 'demande').length;
  return html`<section class="page">
    <header class="page-head"><div><p class="eyebrow">${data.profiles.filter(p => p.role === 'laureat').length} lauréats · ${data.profiles.filter(p => p.role === 'etudiant').length} étudiants</p><h1>Réseau</h1></div></header>
    <div class="icon-tabs" role="tablist" style=${`--n:${tabs.length}`}>${tabs.map(([k, l, i]) => html`<button role="tab" aria-selected=${tab === k} class=${tab === k ? 'on' : ''} onClick=${() => go('reseau/' + k)}><${Icon} name=${i} size=${20}/><span>${l}</span>${k === 'mentorat' && pendingM ? html`<span class="dotn"></span>` : null}</button>`)}</div>
    ${tab === 'entraide' ? html`<${EntraidePage} ...${ctx}/>` : null}
    ${tab === 'mentorat' ? html`<${MentoratPage} ...${ctx} key=${ctx.sub2 || 'm'}/>` : null}
    ${tab === 'annuaire' ? html`<${Annuaire} ctx=${ctx}/>` : null}
    ${tab === 'classement' ? html`<${Classement} ctx=${ctx}/>` : null}
    ${tab === 'talents' ? html`<${TalentPool} ctx=${ctx}/>` : null}
  </section>`;
}

function Classement({ ctx }) {
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

function Annuaire({ ctx }) {
  const { data, scores, openProfile, me, saison } = ctx;
  const [q, setQ] = useState(''); const [role, setRole] = useState('');
  const myN = me.role === 'etudiant' ? niveauOf(me, saison) : null; // un étudiant voit les lauréats et sa propre promo
  const [fil, setFil] = useState('');
  const dir = data.profiles.filter(p => p.role !== 'admin' && (myN === null || p.role !== 'etudiant' || niveauOf(p, saison) === myN) && (!role || p.role === role) && (!fil || p.filiere === fil) && (!q || `${p.full_name} ${p.entreprise || ''} ${p.ville || ''} ${p.pays || ''} ${p.poste || ''} ${(p.competences || []).join(' ')}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
  return html`<div class="sub-page">
    <div class="filter-row"><label class="search"><${Icon} name="search" size=${16}/><input id="d-q" placeholder="Nom, entreprise, ville, compétence…" value=${q} onInput=${e => setQ(e.target.value)}/></label>
      <select id="d-role" value=${role} onChange=${e => setRole(e.target.value)} aria-label="Rôle"><option value="">Tous</option><option value="laureat">Lauréats</option><option value="etudiant">${myN ? 'Ma promo' : 'Étudiants'}</option></select>
      <select id="d-fil" value=${fil} onChange=${e => setFil(e.target.value)} aria-label="Filière"><option value="">Toutes filières</option>${FILIERES.map(f => html`<option value=${f}>${f}</option>`)}</select></div>
    <ul class="dir">${dir.slice(0, 120).map(p => html`<li key=${p.id}><${Person} p=${p} score=${scores.get(p.id)} onOpen=${openProfile}/><span class="muted small">${[p.poste, p.ville, p.pays !== 'Maroc' ? p.pays : ''].filter(Boolean).join(' · ')}</span></li>`)}</ul>
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
      ${p.poste ? html`<p><strong>${p.poste}</strong>${p.entreprise ? ` chez ${p.entreprise}` : ''}</p>` : null}
      ${st ? html`<p><span class=${'state-pill s-' + st.key}>${st.label}</span>${st.pl ? ` ${st.pl.entreprise}` : ''}</p>` : null}
      ${p.role === 'etudiant' && p.disponibilite ? html`<p class="small"><${Icon} name="calendar" size=${14}/> Disponibilité : <span translate="no" dir="auto">${p.disponibilite}</span></p>` : null}
      ${p.bio ? html`<p>${p.bio}</p>` : null}
      ${(p.competences || []).length ? html`<p class="offer-target">${p.competences.map(c => html`<span class="mini">${c}</span>`)}</p>` : null}
      ${p.role !== 'etudiant' ? html`<div class="profile-stats"><span><b class="mono">${s?.points || 0}</b> points</span><span><b class="mono">${helped}</b> recrutés</span><span><b class="mono">${s?.mentorats || 0}</b> mentorats</span><span><b class="mono">${s?.offres || 0}</b> offres</span></div>` : null}
      ${badges.length ? html`<div class="badge-row">${badges.map(b => html`<span class="mini badge-mini" title=${b.desc}><${Icon} name="star" size=${12}/> ${b.nom}</span>`)}</div>` : null}
      ${(p.linkedin || p.contact) ? html`<dl class="offer-more">${p.linkedin ? html`<div><dt>LinkedIn</dt><dd><a href=${p.linkedin.startsWith('http') ? p.linkedin : 'https://' + p.linkedin} target="_blank" rel="noopener">${p.linkedin}</a></dd></div>` : null}${p.contact ? html`<div><dt>Contact</dt><dd class="sel">${p.contact}</dd></div>` : null}${p.cv_url ? html`<div><dt>CV</dt><dd><a href=${p.cv_url} target="_blank" rel="noopener">Voir le CV</a></dd></div>` : null}</dl>` : null}
      ${p.mentor_dispo && p.id !== me.id ? html`<div class="row-end"><button class="btn primary" onClick=${() => onAskMentor(p)}>Demander un mentorat</button></div>` : null}
    </div>
  <//>`;
}

export function ProfileForm({ ctx, initial, onDone, onboarding }) {
  const { store, act } = ctx;
  const [f, setF] = useState(() => ({ full_name: '', role: 'etudiant', filiere: FILIERES[0], promo: new Date().getFullYear() + 1, entreprise: '', poste: '', ville: '', pays: 'Maroc', bio: '', competences: [], linkedin: '', contact: '', cv_url: '', disponibilite: '', mentor_dispo: false, mentor_sujets: '', vitrine: true, ...(initial || {}) }));
  const set = (k, v) => setF({ ...f, [k]: v });
  const [comp, setComp] = useState((f.competences || []).join(', '));
  const ok = f.full_name.trim().length >= 2 && f.promo >= 1990 && f.promo <= 2040;
  const submit = e => {
    e.preventDefault(); if (!ok) return;
    const row = { full_name: f.full_name.trim(), role: f.role === 'admin' ? 'admin' : f.role, filiere: f.filiere, promo: +f.promo, entreprise: f.entreprise.trim() || null, poste: f.poste.trim() || null, ville: f.ville.trim() || null, pays: f.pays.trim() || 'Maroc', bio: f.bio.trim() || null, competences: comp.split(',').map(x => x.trim()).filter(Boolean).slice(0, 15), linkedin: f.linkedin.trim() || null, contact: f.contact.trim() || null, cv_url: f.cv_url.trim() || null, mentor_dispo: !!f.mentor_dispo, mentor_sujets: f.mentor_sujets.trim() || null, vitrine: !!f.vitrine };
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
    ${!isStudent ? html`<div class="grid2"><${Field} label="Entreprise"><input id="pf-ent" value=${f.entreprise || ''} onInput=${e => set('entreprise', e.target.value)}/><//><${Field} label="Poste"><input id="pf-poste" value=${f.poste || ''} onInput=${e => set('poste', e.target.value)}/><//></div>` : null}
    <div class="grid2"><${Field} label="Ville"><input id="pf-ville" value=${f.ville || ''} onInput=${e => set('ville', e.target.value)}/><//><${Field} label="Pays"><input id="pf-pays" value=${f.pays || ''} onInput=${e => set('pays', e.target.value)}/><//></div>
    <${Field} label="Bio courte"><textarea id="pf-bio" rows="3" maxlength="600" value=${f.bio || ''} onInput=${e => set('bio', e.target.value)} placeholder=${isStudent ? 'Ce que tu cherches, tes projets…' : 'Ton parcours, comment tu peux aider…'}></textarea><//>
    <${Field} label="Compétences" hint="Séparées par des virgules"><input id="pf-comp" value=${comp} onInput=${e => setComp(e.target.value)} placeholder="Lean, CATIA, Python…"/><//>
    <div class="grid2"><${Field} label="LinkedIn"><input id="pf-li" value=${f.linkedin || ''} onInput=${e => set('linkedin', e.target.value)} placeholder="linkedin.com/in/…"/><//><${Field} label="Contact visible par les membres"><input id="pf-contact" value=${f.contact || ''} onInput=${e => set('contact', e.target.value)} placeholder="Email ou téléphone"/><//></div>
    ${isStudent ? html`<div class="grid2"><${Field} label="Lien vers ton CV (Google Drive, etc.)"><input id="pf-cv" value=${f.cv_url || ''} onInput=${e => set('cv_url', e.target.value)}/><//>
      <${Field} label="Disponibilité"><input id="pf-dispo" maxlength="80" value=${f.disponibilite || ''} onInput=${e => set('disponibilite', e.target.value)} placeholder="Ex. dès février, 6 mois"/><//></div>
      <label class="check"><input id="pf-vit" type="checkbox" checked=${f.vitrine} onChange=${e => set('vitrine', e.target.checked)}/> Apparaître dans la Vitrine des talents quand je cherche (visible par les lauréats)</label>` : html`
      <label class="check"><input id="pf-mentor" type="checkbox" checked=${f.mentor_dispo} onChange=${e => set('mentor_dispo', e.target.checked)}/> Je suis disponible pour du mentorat</label>
      ${f.mentor_dispo ? html`<${Field} label="Sujets sur lesquels je peux aider"><input id="pf-msuj" value=${f.mentor_sujets || ''} onInput=${e => set('mentor_sujets', e.target.value)} placeholder="Stages à l’étranger, entretiens, automobile…"/><//>` : null}
      ${f.role === 'laureat' && !initial?.verified ? html`<p class="small muted">Ton badge « Lauréat vérifié » sera ajouté par l’administration de l’école.</p>` : null}`}
    <div class="row-end"><button class="btn primary" disabled=${!ok}>${onboarding ? 'Rejoindre la communauté' : 'Enregistrer'}</button></div>
  </form>`;
}

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------
export function AdminPage(ctx) {
  const { data, store, act, openProfile } = ctx;
  const toVerify = data.profiles.filter(p => p.role === 'laureat' && !p.verified);
  const stale = data.placements.filter(p => p.status === 'en_attente').sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const recent = [...data.offers].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10);
  return html`<section class="page">
    <header class="page-head"><div><p class="eyebrow">Réservé à l’administration</p><h1>Administration</h1></div></header>
    <div class="panel"><div class="section-head"><h2>Lauréats à vérifier</h2><span class="count">${toVerify.length}</span></div>
      <p class="muted small">Vérifie que la personne est bien diplômée de l’ENSAM Meknès (promo, filière), puis valide. Le badge rassure les étudiants.</p>
      <ul class="people-list">${toVerify.map(p => html`<li><${Person} p=${p} onOpen=${openProfile} sub=${`${p.filiere} · Promo ${p.promo}${p.entreprise ? ' · ' + p.entreprise : ''}`}/><span class="spacer"></span><button class="btn small primary" onClick=${() => act(async () => { await store.update('profiles', p.id, { verified: true }); toast('Lauréat vérifié.'); })}><${Icon} name="shield" size=${15}/> Vérifier</button></li>`)}</ul>
      ${!toVerify.length ? html`<p class="muted">Tout est à jour.</p>` : null}</div>
    <div class="panel"><div class="section-head"><h2>Recrutements en attente de l’étudiant</h2><span class="count">${stale.length}</span></div>
      <p class="muted small">Le lauréat a déclaré ces recrutements. Si l’étudiant ne confirme pas, l’administration peut le faire après vérification.</p>
      <ul class="people-list">${stale.map(p => { const s = store.byId('profiles', p.student_id), l = store.byId('profiles', p.laureat_id); return html`<li><${Person} p=${s} onOpen=${openProfile} sub=${`${p.entreprise} · déclaré par ${l?.full_name || '?'} · ${timeAgo(p.created_at)}`}/><span class="spacer"></span>
        <button class="btn small ghost" onClick=${() => act(() => store.update('placements', p.id, { status: 'refuse' }))}>Refuser</button><button class="btn small primary" onClick=${() => act(() => store.update('placements', p.id, { status: 'confirme' }))}>Confirmer</button></li>`; })}</ul></div>
    <div class="panel"><div class="section-head"><h2>Dernières offres publiées</h2></div>
      <ul class="people-list">${recent.map(o => html`<li><span><strong>${o.titre}</strong><br/><span class="muted small">${o.entreprise} · ${store.byId('profiles', o.author_id)?.full_name || ''} · ${timeAgo(o.created_at)}</span></span><span class="spacer"></span><button class="btn tiny ghost danger-t" onClick=${() => ctx.confirm('Supprimer cette offre ?', () => act(() => store.remove('offers', o.id)))}>Supprimer</button></li>`)}</ul></div>
  </section>`;
}

export { levelOf, LevelChip };
