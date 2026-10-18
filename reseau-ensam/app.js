// Point d'entrée : coque de l'application, connexion, accueil, notifications.
import { html, render, useState, useEffect, useMemo } from './vendor/preact-htm.js';
import { createStore } from './store.js';
import { Icon, Modal, Field, Empty, Person, Avatar, Bar, Toaster, toast, Confirm, LevelChip } from './ui.js';
import { seasonOf, seasonLabel, niveauOf, NIVEAUX, OBJECTIFS, statutOf, seasonStats, computeScores, timeAgo, pct, TYPES, levelOf } from './logic.js';
import { OffersPage, OfferCard } from './offers.js';
import { ParcoursPage, ImpactPage, DeclareModal } from './me.js';
import { DashboardPage } from './dashboard.js';
import { MentoratPage, EntraidePage, CommunautePage, ProfileModal, ProfileForm, AdminPage } from './community.js';

const ROUTES = ['accueil', 'offres', 'parcours', 'impact', 'mentorat', 'entraide', 'tableau', 'communaute', 'profil', 'admin'];

function navFor(me) {
  const items = [['accueil', 'Accueil', 'home'], ['offres', 'Offres', 'feed']];
  if (me.role === 'etudiant') items.push(['parcours', 'Mon parcours', 'route']);
  else items.push(['impact', 'Mon impact', 'star']);
  items.push(['mentorat', 'Mentorat', 'mentor'], ['entraide', 'Entraide', 'qa'], ['tableau', 'Tableau de bord', 'chart'], ['communaute', 'Communauté', 'people']);
  if (me.role === 'admin') items.push(['admin', 'Administration', 'shield']);
  return items;
}

function readRoute() { const h = (location.hash || '').slice(1); return ROUTES.includes(h) ? h : 'accueil'; }

function App({ store }) {
  const [, setTick] = useState(0);
  const [route, setRoute] = useState(readRoute);
  const [profile, setProfile] = useState(null);
  const [askMentor, setAskMentor] = useState(null);
  const [confirmBox, setConfirmBox] = useState(null);
  const [bell, setBell] = useState(false);
  useEffect(() => store.on(() => setTick(t => t + 1)), []);
  useEffect(() => { const f = () => setRoute(readRoute()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  const go = r => { try { history.replaceState(null, '', '#' + r); } catch { /* cadre */ } setRoute(r); setBell(false); window.scrollTo?.(0, 0); };

  const data = store.data;
  const me = store.me;
  const saison = seasonOf();
  const scores = useMemo(() => computeScores(data), [data.offers, data.reactions, data.comments, data.placements, data.mentorships, data.answers, data.questions, data.votes]);

  if (store.mode === 'live' && !store.session) return html`<${AuthScreen} store=${store}/>`;
  if (store.mode === 'live' && !me) return html`<${Onboarding} store=${store}/>`;

  const act = async fn => { try { await fn(); } catch (e) { toast(e.message || String(e), 'err'); } };
  const ctx = { store, data, me, saison, scores, go, act, openProfile: p => p && setProfile(p), confirm: (text, onYes) => setConfirmBox({ text, onYes }) };
  const notifs = buildNotifs(ctx);
  const unseen = notifs.filter(n => n.action).length;
  const nav = navFor(me);
  const page = route === 'parcours' && me.role !== 'etudiant' ? 'impact' : route === 'impact' && me.role === 'etudiant' ? 'parcours' : route === 'admin' && me.role !== 'admin' ? 'accueil' : route;

  return html`<div class="shell">
    <aside class="side">
      <div class="brand"><span class="brand-mark" aria-hidden="true">EM</span><span class="brand-txt"><strong>Réseau ENSAM</strong><span>Meknès · Lauréats & étudiants</span></span></div>
      <nav class="side-nav">${nav.map(([k, l, i]) => html`<a href=${'#' + k} class=${page === k ? 'on' : ''} onClick=${e => { e.preventDefault(); go(k); }}><${Icon} name=${i}/> ${l}${k === 'impact' && notifs.some(n => n.kind === 'confirm') ? html`<span class="dotn"></span>` : null}</a>`)}</nav>
      <div class="side-foot"><span class="mono small muted">Saison ${seasonLabel(saison)}</span></div>
    </aside>
    <div class="main">
      <header class="top">
        <div class="brand mobile-only"><span class="brand-mark" aria-hidden="true">EM</span><strong>Réseau ENSAM</strong></div>
        <span class="spacer"></span>
        ${store.mode === 'demo' ? html`<${PersonaSwitch} store=${store} go=${go}/>` : null}
        <div class="bell-wrap"><button class="icon-btn" aria-label=${`Notifications (${unseen})`} aria-expanded=${bell} onClick=${() => setBell(!bell)}><${Icon} name="bell"/>${unseen ? html`<span class="badge-n">${unseen}</span>` : null}</button>
          ${bell ? html`<div class="bell-pop" role="menu"><h3>Notifications</h3>${notifs.length ? notifs.slice(0, 12).map(n => html`<button class=${'notif' + (n.action ? ' act' : '')} onClick=${() => { go(n.to); }}><${Icon} name=${n.icon} size=${16}/><span>${n.text}<span class="muted small">${timeAgo(n.at)}</span></span></button>`) : html`<p class="muted small">Rien de nouveau.</p>`}</div>` : null}
        </div>
        <button class="me-btn" onClick=${() => go('profil')} aria-label="Mon profil"><${Avatar} p=${me} size=${32}/></button>
      </header>
      ${store.mode === 'demo' ? html`<div class="demo-band">Démonstration avec des données fictives. Change de rôle en haut à droite pour tester chaque espace. Les changements restent dans ce navigateur.</div>` : null}
      <main class="content">
        ${page === 'accueil' ? html`<${Home} ...${ctx} notifs=${notifs}/>` : null}
        ${page === 'offres' ? html`<${OffersPage} ...${ctx}/>` : null}
        ${page === 'parcours' ? html`<${ParcoursPage} ...${ctx}/>` : null}
        ${page === 'impact' ? html`<${ImpactPage} ...${ctx}/>` : null}
        ${page === 'mentorat' ? html`<${MentoratPage} ...${ctx}/>` : null}
        ${page === 'entraide' ? html`<${EntraidePage} ...${ctx}/>` : null}
        ${page === 'tableau' ? html`<${DashboardPage} ...${ctx}/>` : null}
        ${page === 'communaute' ? html`<${CommunautePage} ...${ctx}/>` : null}
        ${page === 'admin' ? html`<${AdminPage} ...${ctx}/>` : null}
        ${page === 'profil' ? html`<${MyProfile} ctx=${ctx}/>` : null}
      </main>
    </div>
    <nav class="bottom-nav">${nav.filter(([k]) => ['accueil', 'offres', 'parcours', 'impact', 'tableau', 'communaute'].includes(k)).map(([k, l, i]) => html`<a href=${'#' + k} class=${page === k ? 'on' : ''} onClick=${e => { e.preventDefault(); go(k); }}><${Icon} name=${i}/><span>${{ 'Tableau de bord': 'Suivi', 'Mon parcours': 'Parcours', 'Mon impact': 'Impact' }[l] || l}</span></a>`)}
      <${MoreMenu} nav=${nav} go=${go} page=${page}/></nav>
    ${profile ? html`<${ProfileModal} ctx=${ctx} p=${profile} onClose=${() => setProfile(null)} onAskMentor=${p => { setProfile(null); setAskMentor(p); go('mentorat'); }}/>` : null}
    ${askMentor ? html`<${QuickAsk} ctx=${ctx} mentor=${askMentor} onClose=${() => setAskMentor(null)}/>` : null}
    ${confirmBox ? html`<${Confirm} text=${confirmBox.text} onYes=${confirmBox.onYes} onClose=${() => setConfirmBox(null)} yes="Supprimer"/>` : null}
    <${Toaster}/>
  </div>`;
}

function MoreMenu({ nav, go, page }) {
  const [open, setOpen] = useState(false);
  const rest = nav.filter(([k]) => !['accueil', 'offres', 'parcours', 'impact', 'tableau', 'communaute'].includes(k));
  return html`<div class="more"><button class=${rest.some(([k]) => k === page) ? 'on' : ''} onClick=${() => setOpen(!open)} aria-expanded=${open}><${Icon} name="menu"/><span>Plus</span></button>
    ${open ? html`<div class="more-pop">${rest.map(([k, l, i]) => html`<button onClick=${() => { setOpen(false); go(k); }}><${Icon} name=${i}/> ${l}</button>`)}<button onClick=${() => { setOpen(false); go('profil'); }}><${Icon} name="user"/> Mon profil</button></div>` : null}</div>`;
}

function QuickAsk({ ctx, mentor, onClose }) {
  const { store, me, act } = ctx;
  const [sujet, setSujet] = useState(''); const [msg, setMsg] = useState('');
  return html`<${Modal} title=${`Demande à ${mentor.full_name}`} onClose=${onClose}>
    <form class="form" onSubmit=${e => { e.preventDefault(); act(async () => { await store.insert('mentorships', { student_id: me.id, mentor_id: mentor.id, sujet: sujet.trim(), message: msg.trim() }); toast('Demande envoyée.'); onClose(); }); }}>
      <${Field} label="Sujet"><input id="qa-sujet" value=${sujet} onInput=${e => setSujet(e.target.value)} maxlength="140"/><//>
      <${Field} label="Message"><textarea id="qa-msg" rows="4" value=${msg} onInput=${e => setMsg(e.target.value)} maxlength="1500"></textarea><//>
      <div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn primary" disabled=${sujet.trim().length < 3}>Envoyer</button></div>
    </form><//>`;
}

function PersonaSwitch({ store, go }) {
  const ps = store.personas();
  return html`<label class="persona"><span class="small muted">Voir en tant que</span>
    <select id="persona" value=${store.me?.id} onChange=${e => { store.switchTo(e.target.value); go('accueil'); }}>${ps.map(p => html`<option value=${p.id}>${p._persona}</option>`)}</select></label>`;
}

// ---------------------------------------------------------------------------
// Notifications calculées à partir des données
// ---------------------------------------------------------------------------
function buildNotifs({ data, me, store, saison }) {
  const out = [];
  const name = id => store.byId('profiles', id)?.full_name || 'Un membre';
  for (const p of data.placements) if (p.laureat_id === me.id && p.status === 'en_attente') out.push({ kind: 'confirm', action: true, icon: 'trophy', to: 'impact', at: p.created_at, text: `${name(p.student_id)} dit avoir été retenu(e) chez ${p.entreprise} grâce à ton offre. Confirme-le.` });
  for (const m of data.mentorships) {
    if (m.mentor_id === me.id && m.status === 'demande') out.push({ action: true, icon: 'mentor', to: 'mentorat', at: m.created_at, text: `${name(m.student_id)} te demande un mentorat : ${m.sujet}` });
    if (m.student_id === me.id && m.status === 'acceptee') out.push({ icon: 'mentor', to: 'mentorat', at: m.created_at, text: `${name(m.mentor_id)} a accepté ta demande : ${m.sujet}` });
  }
  for (const p of data.placements) if (p.student_id === me.id && p.status === 'confirme' && p.laureat_id) out.push({ icon: 'check', to: 'parcours', at: p.confirmed_at || p.created_at, action: !p.merci, text: `${name(p.laureat_id)} a confirmé ta réussite chez ${p.entreprise}.${p.merci ? '' : ' Laisse-lui un merci.'}` });
  const myOffers = new Set(data.offers.filter(o => o.author_id === me.id).map(o => o.id));
  for (const c of data.comments) if (myOffers.has(c.offer_id) && c.author_id !== me.id && Date.now() - new Date(c.created_at) < 14 * 864e5) out.push({ icon: 'comment', to: 'offres', at: c.created_at, text: `${name(c.author_id)} a commenté ton offre : « ${c.body.slice(0, 60)}${c.body.length > 60 ? '…' : ''} »` });
  const myQ = new Set(data.questions.filter(q => q.author_id === me.id).map(q => q.id));
  for (const a of data.answers) if (myQ.has(a.question_id) && a.author_id !== me.id) out.push({ icon: 'qa', to: 'entraide', at: a.created_at, text: `${name(a.author_id)} a répondu à ta question.` });
  if (me.role === 'etudiant') {
    const n = niveauOf(me, saison);
    for (const o of data.offers) if (o.status === 'ouverte' && (o.annees || []).includes(n) && (!o.filieres?.length || o.filieres.includes(me.filiere)) && Date.now() - new Date(o.created_at) < 7 * 864e5) out.push({ icon: 'feed', to: 'offres', at: o.created_at, text: `Nouvelle offre pour toi : ${o.titre} (${o.entreprise})` });
  }
  return out.sort((a, b) => (b.action ? 1 : 0) - (a.action ? 1 : 0) || new Date(b.at) - new Date(a.at));
}

// ---------------------------------------------------------------------------
// Accueil
// ---------------------------------------------------------------------------
function Home(props) {
  const ctx = props;
  const { data, me, saison, scores, store, go, openProfile, notifs } = ctx;
  const n = niveauOf(me, saison);
  const st = useMemo(() => seasonStats(data, saison), [data, saison]);
  const first = me.full_name.split(' ')[0];
  const [declare, setDeclare] = useState(false);
  const actions = notifs.filter(x => x.action);
  const forMe = data.offers.filter(o => o.status === 'ouverte' && (me.role !== 'etudiant' || ((o.annees || []).includes(n) && (!o.filieres?.length || o.filieres.includes(me.filiere))))).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3);
  const month = useMemo(() => computeScores(data, new Date(Date.now() - 30 * 864e5)), [data]);
  const star = data.profiles.filter(p => p.role === 'laureat').map(p => ({ p, pts: month.get(p.id)?.points || 0 })).sort((a, b) => b.pts - a.pts)[0];
  const starHelped = star ? data.placements.filter(p => p.laureat_id === star.p.id && p.status === 'confirme').length : 0;
  const mercis = [
    ...data.placements.filter(p => p.merci && p.laureat_id).map(p => ({ from: p.student_id, to: p.laureat_id, txt: p.merci, at: p.confirmed_at || p.created_at })),
    ...data.mentorships.filter(m => m.merci).map(m => ({ from: m.student_id, to: m.mentor_id, txt: m.merci, at: m.created_at })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 4);
  const stu = me.role === 'etudiant' ? statutOf(data, me, saison) : null;
  const obj = OBJECTIFS[n];
  const s = scores.get(me.id);

  return html`<section class="page home">
    <header class="hello">
      <p class="eyebrow">Saison ${seasonLabel(saison)}${me.role === 'etudiant' ? ` · ${NIVEAUX[n]?.label} · ${me.filiere}` : me.role === 'laureat' ? ` · Promo ${me.promo}` : ''}</p>
      <h1>Bonjour ${first}</h1>
      <p class="lead">${me.role === 'etudiant' ? 'Les lauréats de l’école partagent ici leurs offres, leurs conseils et leur temps. Voici où tu en es.' : me.role === 'laureat' ? 'Chaque offre partagée et chaque réponse comptent. Voici ce qui t’attend aujourd’hui.' : 'Vue d’ensemble du réseau et des actions à mener.'}</p>
    </header>

    ${me.role === 'etudiant' && obj ? html`<div class=${'objective compact st-' + stu.key}>
      <div class="objective-main"><p class="eyebrow">Mon objectif</p><h2>${obj.titre}</h2><p class="muted small">Échéance le ${obj.deadline(saison).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</p></div>
      <div class="objective-state"><span class=${'state-pill s-' + stu.key}>${stu.label}</span>${stu.pl ? html`<span>${stu.pl.entreprise}</span>` : html`<button class="btn accent small" onClick=${() => setDeclare(true)}><${Icon} name="trophy" size=${15}/> J’ai trouvé !</button>`}<button class="btn ghost small" onClick=${() => go('parcours')}>Mon parcours</button></div>
    </div>` : null}

    ${me.role !== 'etudiant' && s ? html`<div class="impact-strip"><span><b class="mono">${s.points}</b> points d’impact</span><${LevelChip} points=${s.points}/><span class="muted small">${s.recrutes} étudiant${s.recrutes > 1 ? 's' : ''} recruté${s.recrutes > 1 ? 's' : ''} grâce à toi</span><span class="spacer"></span><button class="btn small ghost" onClick=${() => go('impact')}>Mon impact</button></div>` : null}

    ${actions.length ? html`<div class="callout"><h2>À faire (${actions.length})</h2><ul class="todo">${actions.slice(0, 5).map(a => html`<li><button class="notif act" onClick=${() => go(a.to)}><${Icon} name=${a.icon} size=${16}/><span>${a.text}</span><${Icon} name="arrow" size=${16}/></button></li>`)}</ul></div>` : null}

    <div class="home-grid">
      <div class="home-main">
        <div class="section-head"><h2>${me.role === 'etudiant' ? 'Nouvelles offres pour toi' : 'Dernières offres'}</h2><button class="btn tiny ghost" onClick=${() => go('offres')}>Tout voir</button></div>
        <div class="feed">${forMe.length ? forMe.map(o => html`<${OfferCard} key=${o.id} o=${o} ctx=${ctx}/>`) : html`<${Empty} icon="feed" title="Pas encore d’offre pour ton niveau">Elles arrivent vite : active les notifications en revenant chaque jour, et parle de la plateforme aux lauréats que tu connais.<//>`}</div>
        ${me.role !== 'etudiant' ? html`<div class="cta-post"><div><strong>Une offre dans ton entreprise ?</strong><p class="muted small">Partage-la en 1 minute. Les étudiants de ta filière sont notifiés.</p></div><button class="btn primary" onClick=${() => go('offres')}><${Icon} name="plus"/> Publier</button></div>` : null}
      </div>
      <aside class="home-side">
        <div class="panel pulse">
          <div class="section-head"><h2>L’école en ce moment</h2><button class="btn tiny ghost" onClick=${() => go('tableau')}>Détails</button></div>
          ${st.rows.map(r => html`<div class="pulse-row"><span class="niv-badge">${NIVEAUX[r.n].short}</span><div class="pulse-bar"><div class="row small"><span>${r.objectif.court}</span><span class="spacer"></span><span class="mono">${pct(r.rate)}</span></div><${Bar} value=${r.rate} pace=${r.elapsed}/></div></div>`)}
          <p class="small muted">${st.viaTotal} réussites cette saison grâce aux lauréats de la plateforme.</p>
        </div>
        ${star && star.pts ? html`<div class="panel star">
          <p class="eyebrow">Lauréat du mois</p>
          <${Person} p=${star.p} score=${scores.get(star.p.id)} onOpen=${openProfile} size=${48}/>
          <p class="small"><b class="mono">+${star.pts}</b> points en 30 jours · ${starHelped} étudiant${starHelped > 1 ? 's' : ''} recruté${starHelped > 1 ? 's' : ''} grâce à ses offres</p>
        </div>` : null}
        ${mercis.length ? html`<div class="panel"><div class="section-head"><h2>Mur des mercis</h2></div>
          ${mercis.map(m => html`<blockquote class="merci"><p>« ${m.txt} »</p><footer><span class="small">${store.byId('profiles', m.from)?.full_name?.split(' ')[0] || 'Un étudiant'} → <button class="linkish" onClick=${() => openProfile(store.byId('profiles', m.to))}>${store.byId('profiles', m.to)?.full_name}</button></span></footer></blockquote>`)}
        </div>` : null}
      </aside>
    </div>
    ${declare ? html`<${DeclareModal} ctx=${ctx} onClose=${() => setDeclare(false)}/>` : null}
  </section>`;
}

function MyProfile({ ctx }) {
  const { me, store } = ctx;
  return html`<section class="page narrow">
    <header class="page-head"><div><p class="eyebrow">Visible par les membres connectés</p><h1>Mon profil</h1></div>
      ${store.mode === 'live' ? html`<button class="btn ghost" onClick=${() => store.signOut()}><${Icon} name="logout"/> Se déconnecter</button>` : html`<button class="btn ghost" onClick=${() => { store.reset(); toast('Démo réinitialisée.'); }}>Réinitialiser la démo</button>`}</header>
    <${ProfileForm} ctx=${ctx} initial=${me} key=${me.id}/>
  </section>`;
}

// ---------------------------------------------------------------------------
// Connexion et inscription (mode réel)
// ---------------------------------------------------------------------------
function AuthScreen({ store }) {
  const recovery = /type=recovery/.test(location.hash);
  const [mode, setMode] = useState(recovery ? 'nouveau' : 'connexion');
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [msg, setMsg] = useState(null); const [busy, setBusy] = useState(false);
  const run = async fn => { setBusy(true); setMsg(null); try { await fn(); } catch (e) { setMsg({ err: true, t: e.message }); } setBusy(false); };
  const submit = e => {
    e.preventDefault();
    if (mode === 'connexion') run(() => store.signIn(email.trim(), pw));
    else if (mode === 'inscription') run(async () => { const r = await store.signUp(email.trim(), pw); if (r.needsConfirm) setMsg({ t: 'Compte créé. Ouvre l’email de confirmation reçu, puis reviens te connecter.' }); });
    else if (mode === 'oubli') run(async () => { await store.resetPassword(email.trim()); setMsg({ t: 'Si un compte existe, un lien de réinitialisation vient d’être envoyé.' }); });
    else run(async () => { await store.setPassword(pw); setMsg({ t: 'Mot de passe changé.' }); });
  };
  return html`<div class="auth">
    <div class="auth-side">
      <span class="brand-mark big" aria-hidden="true">EM</span>
      <h1>Réseau ENSAM Meknès</h1>
      <p>Les lauréats partagent leurs offres de stages, de PFE et d’emplois. Les étudiants trouvent plus vite, avec un suivi de chaque promo jusqu’au premier emploi.</p>
      <ul class="auth-points"><li><${Icon} name="feed"/> Offres partagées par les anciens, avec cooptation</li><li><${Icon} name="route"/> Suivi de ta recherche, de la 3A au premier emploi</li><li><${Icon} name="mentor"/> Mentorat et entraide entre générations</li></ul>
    </div>
    <form class="auth-card form" onSubmit=${submit}>
      <h2>${{ connexion: 'Se connecter', inscription: 'Créer mon compte', oubli: 'Mot de passe oublié', nouveau: 'Nouveau mot de passe' }[mode]}</h2>
      ${mode !== 'nouveau' ? html`<${Field} label="Email"><input id="au-email" type="email" required autocomplete="email" value=${email} onInput=${e => setEmail(e.target.value)}/><//>` : null}
      ${mode !== 'oubli' ? html`<${Field} label="Mot de passe" hint=${mode === 'connexion' ? '' : '6 caractères minimum'}><input id="au-pw" type="password" required minlength="6" autocomplete=${mode === 'connexion' ? 'current-password' : 'new-password'} value=${pw} onInput=${e => setPw(e.target.value)}/><//>` : null}
      ${msg ? html`<p class=${'auth-msg' + (msg.err ? ' err' : '')} role="alert">${msg.t}</p>` : null}
      <button class="btn primary wide" disabled=${busy}>${busy ? '…' : { connexion: 'Se connecter', inscription: 'Créer mon compte', oubli: 'Envoyer le lien', nouveau: 'Enregistrer' }[mode]}</button>
      <div class="auth-links">
        ${mode !== 'connexion' ? html`<button type="button" class="linkish" onClick=${() => { setMode('connexion'); setMsg(null); }}>J’ai déjà un compte</button>` : html`<button type="button" class="linkish" onClick=${() => { setMode('inscription'); setMsg(null); }}>Créer un compte</button>`}
        ${mode === 'connexion' ? html`<button type="button" class="linkish" onClick=${() => { setMode('oubli'); setMsg(null); }}>Mot de passe oublié ?</button>` : null}
      </div>
    </form>
  </div>`;
}

function Onboarding({ store }) {
  const act = async fn => { try { await fn(); } catch (e) { toast(e.message, 'err'); } };
  const ctx = { store, act };
  return html`<div class="auth"><div class="auth-card wide">
    <p class="eyebrow">Dernière étape</p><h2>Présente-toi à la communauté</h2>
    <p class="muted">Ces informations permettent de te proposer les bonnes offres et de suivre ta promo.</p>
    <${ProfileForm} ctx=${ctx} onboarding/>
    <button class="linkish small" onClick=${() => store.signOut()}>Se déconnecter</button>
  </div><${Toaster}/></div>`;
}

// ---------------------------------------------------------------------------
(async () => {
  const root = document.getElementById('app');
  try {
    const store = await createStore();
    root.innerHTML = '';
    render(html`<${App} store=${store}/>`, root);
  } catch (e) {
    root.innerHTML = '';
    render(html`<div class="fatal"><h1>Impossible de charger la plateforme</h1><p>${e.message}</p><p class="muted">Vérifie ta connexion internet puis recharge la page.</p></div>`, root);
  }
})();
