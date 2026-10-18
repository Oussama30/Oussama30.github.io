// Point d'entrée : coque de l'application, connexion, accueil, notifications.
import { html, render, useState, useEffect, useMemo } from './vendor/preact-htm.js';
import { createStore } from './store.js';
import { Icon, Modal, Field, Empty, Person, Avatar, Bar, Toaster, toast, Confirm, LevelChip, BrandLogo, CompanyLogo, useLocal } from './ui.js';
import { seasonOf, seasonLabel, niveauOf, NIVEAUX, OBJECTIFS, statutOf, seasonStats, computeScores, timeAgo, pct } from './logic.js';
import { OffersPage, OfferCard, OfferDetail, OfferComposer, matchesMe, APP_STATUS } from './offers.js';
import { ParcoursPage, EspacePage, ConfirmRecruit, Journey, journeyStep } from './me.js';
import { DashboardPage } from './dashboard.js';
import { ReseauPage, ProfileModal, ProfileForm, AdminPage } from './community.js';

const ROUTES = ['accueil', 'offres', 'parcours', 'espace', 'reseau', 'suivi', 'profil', 'admin'];
const ALIASES = { impact: 'espace', tableau: 'suivi', communaute: 'reseau', mentorat: 'reseau/mentorat', entraide: 'reseau/entraide' };

function navFor(me) {
  const items = [['accueil', 'Accueil', 'home'], ['offres', 'Offres', 'feed']];
  if (me.role === 'etudiant') items.push(['parcours', 'Mon parcours', 'route']);
  else if (me.role === 'laureat') items.push(['espace', 'Mon espace', 'star']);
  items.push(['reseau', 'Réseau', 'network'], ['suivi', me.role === 'etudiant' ? 'Ma promo' : 'Suivi', 'chart']);
  if (me.role === 'admin') items.push(['admin', 'Admin', 'shield']);
  return items;
}

function readRoute() {
  let h = decodeURIComponent((location.hash || '').slice(1));
  h = ALIASES[h] || h;
  const [base, sub] = h.split('/');
  return ROUTES.includes(base) ? { base, sub: sub || '' } : { base: 'accueil', sub: '' };
}

function App({ store }) {
  const [, setTick] = useState(0);
  const [route, setRoute] = useState(readRoute);
  const [profile, setProfile] = useState(null);
  const [offerId, setOfferId] = useState(null);
  const [askMentor, setAskMentor] = useState(null);
  const [confirmBox, setConfirmBox] = useState(null);
  const [pop, setPop] = useState(null); // 'bell' | 'me'
  useEffect(() => store.on(() => setTick(t => t + 1)), []);
  useEffect(() => { const f = () => setRoute(readRoute()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  useEffect(() => { if (!pop) return; const f = e => { if (!e.target.closest('.pop-wrap')) setPop(null); }; document.addEventListener('click', f); return () => document.removeEventListener('click', f); }, [pop]);
  const go = r => { try { history.replaceState(null, '', '#' + r); } catch { /* cadre */ } const [base, sub] = r.split('/'); setRoute({ base, sub: sub || '' }); setPop(null); window.scrollTo?.(0, 0); };

  const data = store.data;
  const me = store.me;
  const saison = seasonOf();
  const scores = useMemo(() => computeScores(data), [data.offers, data.applications, data.comments, data.placements, data.mentorships, data.answers, data.questions, data.votes]);

  if (store.mode === 'live' && !store.session) return html`<${AuthScreen} store=${store}/>`;
  if (store.mode === 'live' && !me) return html`<${Onboarding} store=${store}/>`;

  const act = async fn => { try { await fn(); } catch (e) { toast(e.message || String(e), 'err'); } };
  const ctx = {
    store, data, me, saison, scores, go, act, sub: route.sub,
    openProfile: p => p && setProfile(p),
    openOffer: id => { setOfferId(id); setPop(null); },
    confirm: (text, onYes, yes) => setConfirmBox({ text, onYes, yes }),
  };
  const notifs = buildNotifs(ctx);
  const todo = notifs.filter(n => n.action).length;
  const nav = navFor(me);
  let page = route.base;
  if (page === 'parcours' && me.role !== 'etudiant') page = me.role === 'laureat' ? 'espace' : 'accueil';
  if (page === 'espace' && me.role !== 'laureat') page = me.role === 'etudiant' ? 'parcours' : 'accueil';
  if (page === 'admin' && me.role !== 'admin') page = 'accueil';
  const openNotif = n => { setPop(null); if (n.offer) ctx.openOffer(n.offer); else go(n.to); };
  const dotFor = k => (k === 'parcours' || k === 'espace') && notifs.some(n => n.action && n.mine);

  return html`<div class="shell">
    <aside class="side">
      <a class="brand" href="#accueil" onClick=${e => { e.preventDefault(); go('accueil'); }}><${BrandLogo} size=${40}/><span class="brand-txt"><strong>Réseau ENSAM</strong><span>Meknès · Lauréats & étudiants</span></span></a>
      <nav class="side-nav">${nav.map(([k, l, i]) => html`<a href=${'#' + k} class=${page === k ? 'on' : ''} onClick=${e => { e.preventDefault(); go(k); }}><span class="nav-ico"><${Icon} name=${i}/></span> ${l}${dotFor(k) ? html`<span class="dotn"></span>` : null}</a>`)}</nav>
      <div class="side-foot"><span class="mono small muted">Saison ${seasonLabel(saison)}</span></div>
    </aside>
    <div class="main">
      <header class="top">
        <a class="brand mobile-only" href="#accueil" onClick=${e => { e.preventDefault(); go('accueil'); }}><${BrandLogo} size=${34}/><strong>Réseau ENSAM</strong></a>
        <span class="spacer"></span>
        ${store.mode === 'demo' ? html`<${PersonaSwitch} store=${store} go=${go}/>` : null}
        <div class="pop-wrap"><button class="icon-btn" aria-label=${`Notifications (${todo} à traiter)`} aria-expanded=${pop === 'bell'} onClick=${() => setPop(pop === 'bell' ? null : 'bell')}><${Icon} name="bell"/>${todo ? html`<span class="badge-n">${todo}</span>` : null}</button>
          ${pop === 'bell' ? html`<div class="bell-pop" role="menu"><h3>Notifications</h3>${notifs.length ? notifs.slice(0, 14).map(n => html`<button class=${'notif' + (n.action ? ' act' : '')} onClick=${() => openNotif(n)}><span class=${'n-ico ' + (n.tone || '')}><${Icon} name=${n.icon} size=${16}/></span><span>${n.text}<span class="muted small">${timeAgo(n.at)}</span></span></button>`) : html`<p class="muted small">Rien de nouveau.</p>`}</div>` : null}
        </div>
        <div class="pop-wrap"><button class="me-btn" onClick=${() => setPop(pop === 'me' ? null : 'me')} aria-label="Mon compte" aria-expanded=${pop === 'me'}><${Avatar} p=${me} size=${34}/></button>
          ${pop === 'me' ? html`<div class="menu-pop right" role="menu">
            <div class="menu-who"><strong>${me.full_name}</strong><span class="muted small">${me.role === 'etudiant' ? 'Étudiant(e)' : me.role === 'laureat' ? 'Lauréat(e)' : 'Administration'}</span></div>
            <button onClick=${() => go('profil')}><${Icon} name="user" size=${16}/> Mon profil</button>
            <button onClick=${() => { try { localStorage.removeItem('guide-off-' + me.id); } catch { /* */ } go('accueil'); }}><${Icon} name="route" size=${16}/> Comment ça marche ?</button>
            ${me.role === 'admin' ? html`<button onClick=${() => go('admin')}><${Icon} name="shield" size=${16}/> Administration</button>` : null}
            ${store.mode === 'live' ? html`<button onClick=${() => store.signOut()}><${Icon} name="logout" size=${16}/> Se déconnecter</button>` : html`<button onClick=${() => { store.reset(); setPop(null); toast('Démo réinitialisée.'); }}><${Icon} name="spark" size=${16}/> Réinitialiser la démo</button>`}
          </div>` : null}
        </div>
      </header>
      ${store.mode === 'demo' ? html`<div class="demo-band"><${Icon} name="spark" size=${15}/><span>Démo avec des données fictives. Essaie le circuit : <b>Salma</b> postule, <b>Youssef</b> (lauréat) la marque « Recruté(e) », puis Salma confirme. Change de rôle en haut.</span></div>` : null}
      <main class="content">
        ${page === 'accueil' ? html`<${Home} ...${ctx} notifs=${notifs} openNotif=${openNotif}/>` : null}
        ${page === 'offres' ? html`<${OffersPage} ...${ctx}/>` : null}
        ${page === 'parcours' ? html`<${ParcoursPage} ...${ctx}/>` : null}
        ${page === 'espace' ? html`<${EspacePage} ...${ctx}/>` : null}
        ${page === 'reseau' ? html`<${ReseauPage} ...${ctx}/>` : null}
        ${page === 'suivi' ? html`<${DashboardPage} ...${ctx}/>` : null}
        ${page === 'admin' ? html`<${AdminPage} ...${ctx}/>` : null}
        ${page === 'profil' ? html`<${MyProfile} ctx=${ctx}/>` : null}
      </main>
    </div>
    <nav class="bottom-nav">${nav.map(([k, l, i]) => html`<a href=${'#' + k} class=${page === k ? 'on' : ''} onClick=${e => { e.preventDefault(); go(k); }}><span class="bn-ico"><${Icon} name=${i}/>${dotFor(k) ? html`<span class="dotn"></span>` : null}</span><span>${{ 'Mon parcours': 'Parcours', 'Mon espace': 'Espace', 'Ma promo': 'Promo' }[l] || l}</span></a>`)}</nav>
    ${offerId ? html`<${OfferDetail} ctx=${ctx} id=${offerId} key=${offerId} onClose=${() => setOfferId(null)}/>` : null}
    ${profile ? html`<${ProfileModal} ctx=${ctx} p=${profile} onClose=${() => setProfile(null)} onAskMentor=${p => { setProfile(null); setAskMentor(p); }}/>` : null}
    ${askMentor ? html`<${QuickAsk} ctx=${ctx} mentor=${askMentor} onClose=${() => setAskMentor(null)}/>` : null}
    ${confirmBox ? html`<${Confirm} text=${confirmBox.text} onYes=${confirmBox.onYes} onClose=${() => setConfirmBox(null)} yes=${confirmBox.yes || 'Supprimer'}/>` : null}
    <${Toaster}/>
  </div>`;
}

function QuickAsk({ ctx, mentor, onClose }) {
  const { store, me, act, go } = ctx;
  const [sujet, setSujet] = useState(''); const [msg, setMsg] = useState('');
  return html`<${Modal} title=${`Demande à ${mentor.full_name}`} onClose=${onClose}>
    <form class="form" onSubmit=${e => { e.preventDefault(); act(async () => { await store.insert('mentorships', { student_id: me.id, mentor_id: mentor.id, sujet: sujet.trim(), message: msg.trim() }); toast('Demande envoyée.'); onClose(); go('reseau/mentorat'); }); }}>
      ${mentor.mentor_sujets ? html`<p class="muted small">Peut t’aider sur : ${mentor.mentor_sujets}</p>` : null}
      <${Field} label="Sujet"><input id="qa-sujet" value=${sujet} onInput=${e => setSujet(e.target.value)} maxlength="140" placeholder="Ex. Préparer mon entretien chez…"/><//>
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
const recent = (iso, days) => Date.now() - new Date(iso) < days * 864e5;

function buildNotifs({ data, me, store, saison }) {
  const out = [];
  const name = id => store.byId('profiles', id)?.full_name || 'Un membre';
  const first = id => name(id).split(' ')[0];
  // Étudiant : recrutement à confirmer, évolution des candidatures, nouvelles offres
  for (const p of data.placements) {
    if (p.student_id !== me.id) continue;
    if (p.status === 'en_attente') out.push({ action: true, mine: true, tone: 'accent', icon: 'briefcase', to: 'parcours', at: p.created_at, text: `${name(p.laureat_id)} indique t’avoir recruté(e) chez ${p.entreprise}. Confirme-le.` });
    if (p.status === 'confirme' && p.laureat_id && !p.merci) out.push({ action: true, mine: true, tone: 'brass', icon: 'heart', to: 'parcours', at: p.confirmed_at || p.created_at, text: `Ta réussite chez ${p.entreprise} est confirmée. Laisse un merci à ${first(p.laureat_id)}.` });
  }
  for (const a of data.applications) if (a.student_id === me.id && a.offer_id && a.status !== 'postule' && recent(a.updated_at || a.created_at, 21)) {
    out.push({ icon: a.status === 'refuse' ? 'x' : a.status === 'entretien' ? 'people' : 'check', tone: a.status === 'refuse' ? '' : 'good', offer: a.offer_id, at: a.updated_at || a.created_at, text: `Ta candidature « ${a.titre} » : ${APP_STATUS[a.status]}.` });
  }
  if (me.role === 'etudiant') {
    for (const o of data.offers) if (o.status === 'ouverte' && matchesMe(o, me, saison) && recent(o.created_at, 7)) out.push({ icon: 'feed', offer: o.id, at: o.created_at, text: `Nouvelle offre pour toi : ${o.titre} (${o.entreprise})` });
  }
  // Lauréat : candidatures reçues, confirmations, mercis, commentaires
  const myOffers = new Map(data.offers.filter(o => o.author_id === me.id).map(o => [o.id, o]));
  for (const a of data.applications) if (myOffers.has(a.offer_id) && a.status === 'postule') out.push({ action: true, mine: true, tone: 'accent', icon: 'inbox', offer: a.offer_id, at: a.created_at, text: `Nouvelle candidature de ${name(a.student_id)} : ${myOffers.get(a.offer_id).titre}` });
  for (const p of data.placements) if (p.laureat_id === me.id && p.status === 'confirme' && recent(p.confirmed_at || p.created_at, 30)) out.push({ icon: 'trophy', tone: 'brass', to: 'espace', at: p.confirmed_at || p.created_at, text: `${name(p.student_id)} a confirmé son recrutement chez ${p.entreprise}. +50 points${p.merci ? ' et un merci' : ''}.` });
  for (const c of data.comments) if (myOffers.has(c.offer_id) && c.author_id !== me.id && recent(c.created_at, 14)) out.push({ icon: 'comment', offer: c.offer_id, at: c.created_at, text: `${name(c.author_id)} a posé une question sur ton offre : « ${c.body.slice(0, 60)}${c.body.length > 60 ? '…' : ''} »` });
  // Mentorat et entraide
  for (const m of data.mentorships) {
    if (m.mentor_id === me.id && m.status === 'demande') out.push({ action: true, tone: 'accent', icon: 'mentor', to: 'reseau/mentorat', at: m.created_at, text: `${name(m.student_id)} te demande un mentorat : ${m.sujet}` });
    if (m.student_id === me.id && m.status === 'acceptee') out.push({ icon: 'mentor', tone: 'good', to: 'reseau/mentorat', at: m.created_at, text: `${name(m.mentor_id)} a accepté ta demande : ${m.sujet}` });
  }
  const myQ = new Set(data.questions.filter(q => q.author_id === me.id).map(q => q.id));
  for (const a of data.answers) if (myQ.has(a.question_id) && a.author_id !== me.id) out.push({ icon: 'qa', to: 'reseau/entraide', at: a.created_at, text: `${name(a.author_id)} a répondu à ta question.` });
  return out.sort((a, b) => (b.action ? 1 : 0) - (a.action ? 1 : 0) || new Date(b.at) - new Date(a.at));
}

// ---------------------------------------------------------------------------
// Accueil : ce qu'il faut faire, où j'en suis, ce qui est nouveau
// ---------------------------------------------------------------------------
function Home(ctx) {
  const { data, me, saison, scores, store, go, openProfile, openOffer, notifs, openNotif } = ctx;
  const n = niveauOf(me, saison);
  const st = useMemo(() => seasonStats(data, saison), [data, saison]);
  const first = me.full_name.split(' ')[0];
  const [compose, setCompose] = useState(false);
  const actions = notifs.filter(x => x.action);
  const isStudent = me.role === 'etudiant';
  const latest = data.offers.filter(o => o.status === 'ouverte' && (!isStudent || matchesMe(o, me, saison))).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 4);
  const month = useMemo(() => computeScores(data, new Date(Date.now() - 30 * 864e5)), [data]);
  const star = data.profiles.filter(p => p.role === 'laureat').map(p => ({ p, pts: month.get(p.id)?.points || 0 })).sort((a, b) => b.pts - a.pts)[0];
  const starHelped = star ? data.placements.filter(p => p.laureat_id === star.p.id && p.status === 'confirme').length : 0;
  const mercis = [
    ...data.placements.filter(p => p.merci && p.laureat_id).map(p => ({ from: p.student_id, to: p.laureat_id, txt: p.merci, at: p.confirmed_at || p.created_at })),
    ...data.mentorships.filter(m => m.merci).map(m => ({ from: m.student_id, to: m.mentor_id, txt: m.merci, at: m.created_at })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 2);
  const stu = isStudent ? statutOf(data, me, saison) : null;
  const obj = OBJECTIFS[n];
  const s = scores.get(me.id);
  const myApps = data.applications.filter(a => a.student_id === me.id);
  const helper = stu?.pl?.laureat_id ? store.byId('profiles', stu.pl.laureat_id) : null;

  const shortcuts = isStudent
    ? [['feed', 'Offres pour moi', `${data.offers.filter(o => o.status === 'ouverte' && matchesMe(o, me, saison)).length} ouvertes`, () => go('offres')],
      ['mentor', 'Trouver un mentor', 'Un lauréat, un appel', () => go('reseau/mentorat')],
      ['qa', 'Poser une question', 'Les anciens répondent', () => go('reseau/entraide')],
      ['chart', 'Ma promo', `${NIVEAUX[n]?.short || ''} cette saison`, () => go('suivi')]]
    : me.role === 'laureat'
      ? [['plus', 'Publier une offre', '+10 points', () => setCompose(true)],
        ['inbox', 'Mes candidatures', `${data.applications.filter(a => a.status === 'postule' && data.offers.some(o => o.id === a.offer_id && o.author_id === me.id)).length} à voir`, () => go('espace')],
        ['qa', 'Répondre aux étudiants', `${data.questions.filter(q => !data.answers.some(a => a.question_id === q.id)).length} sans réponse`, () => go('reseau/entraide')],
        ['spark', 'Talents en recherche', 'Repère un profil', () => go('reseau/talents')]]
      : [['shield', 'Administration', 'Vérifier les lauréats', () => go('admin')], ['chart', 'Suivi', 'Placement par promo', () => go('suivi')], ['feed', 'Offres', 'Modérer', () => go('offres')], ['network', 'Réseau', 'Annuaire', () => go('reseau/annuaire')]];

  return html`<section class="page home">
    <header class="hello">
      <p class="eyebrow">Saison ${seasonLabel(saison)}${isStudent ? ` · ${NIVEAUX[n]?.label} · ${me.filiere}` : me.role === 'laureat' ? ` · Promo ${me.promo}` : ''}</p>
      <h1>Bonjour ${first}</h1>
    </header>

    <${Guide} ctx=${ctx} setCompose=${setCompose}/>

    ${isStudent && stu.pl?.status === 'en_attente' ? html`<${ConfirmRecruit} ctx=${ctx} pl=${stu.pl} helper=${helper}/>` : null}

    ${isStudent && obj ? html`<button class=${'objective compact clickable st-' + stu.key} onClick=${() => go('parcours')}>
      <div class="objective-top"><span class="obj-ico"><${Icon} name="route" size=${22}/></span>
        <div class="objective-main"><p class="eyebrow">Mon objectif de l’année</p><h2>${obj.titre}</h2></div>
        <span class=${'state-pill s-' + stu.key}>${stu.label}</span></div>
      <${Journey} step=${journeyStep(stu, myApps)}/>
    </button>` : null}

    ${me.role === 'laureat' && s ? html`<button class="impact-strip clickable" onClick=${() => go('espace')}><span class="obj-ico brass"><${Icon} name="star" size=${20}/></span><span><b class="mono">${s.points}</b> points d’impact</span><${LevelChip} points=${s.points}/><span class="muted small">${s.recrutes} recruté${s.recrutes > 1 ? 's' : ''} grâce à toi</span><span class="spacer"></span><${Icon} name="arrow" size=${18}/></button>` : null}

    ${actions.filter(a => !(isStudent && a.icon === 'briefcase')).length ? html`<div class="callout"><h2 class="h-ico"><${Icon} name="bell"/> À faire</h2><ul class="todo">${actions.filter(a => !(isStudent && a.icon === 'briefcase')).slice(0, 4).map(a => html`<li><button class="notif act" onClick=${() => openNotif(a)}><span class=${'n-ico ' + (a.tone || '')}><${Icon} name=${a.icon} size=${16}/></span><span>${a.text}</span><${Icon} name="arrow" size=${16}/></button></li>`)}</ul></div>` : null}

    <div class="shortcuts">${shortcuts.map(([i, l, sub, fn]) => html`<button class="shortcut" onClick=${fn}><span class="sc-ico"><${Icon} name=${i} size=${22}/></span><strong>${l}</strong><span class="muted small">${sub}</span></button>`)}</div>

    <div class="home-grid">
      <div class="home-main">
        <div class="section-head"><h2>${isStudent ? 'Nouvelles offres pour toi' : 'Dernières offres'}</h2><button class="btn tiny ghost" onClick=${() => go('offres')}>Tout voir <${Icon} name="arrow" size=${14}/></button></div>
        <div class="offer-grid one">${latest.length ? latest.map(o => html`<${OfferCard} key=${o.id} o=${o} ctx=${ctx} onOpen=${() => openOffer(o.id)}/>`) : html`<${Empty} icon="feed" title="Pas encore d’offre pour ton niveau">Elles arrivent vite. Parle de la plateforme aux lauréats que tu connais.<//>`}</div>
      </div>
      <aside class="home-side">
        <button class="panel pulse clickable" onClick=${() => go('suivi')}>
          <div class="section-head"><h2>${isStudent ? 'Ma promo' : 'L’école en ce moment'}</h2><${Icon} name="arrow" size=${16}/></div>
          ${st.rows.filter(r => !isStudent || r.n === n).map(r => html`<div class="pulse-row"><span class="niv-badge">${NIVEAUX[r.n].short}</span><div class="pulse-bar"><div class="row small"><span>${r.objectif.court}</span><span class="spacer"></span><span class="mono">${isStudent ? `${r.found}/${r.total}` : pct(r.rate)}</span></div><${Bar} value=${r.rate} pace=${isStudent ? undefined : r.elapsed}/></div></div>`)}
          <p class="small muted">${isStudent ? 'Tes camarades qui ont déjà trouvé. Chacun avance à son rythme.' : `${st.viaTotal} réussites vérifiées grâce aux lauréats cette saison.`}</p>
        </button>
        ${star && star.pts ? html`<div class="panel star">
          <p class="eyebrow"><${Icon} name="trophy" size=${14}/> Lauréat du mois</p>
          <${Person} p=${star.p} score=${scores.get(star.p.id)} onOpen=${openProfile} size=${48}/>
          <p class="small"><b class="mono">+${star.pts}</b> points en 30 jours · ${starHelped} recruté${starHelped > 1 ? 's' : ''} grâce à ses offres</p>
        </div>` : null}
        ${mercis.length ? html`<div class="panel"><div class="section-head"><h2 class="h-ico"><${Icon} name="heart"/> Mur des mercis</h2></div>
          ${mercis.map(m => html`<blockquote class="merci"><p>« ${m.txt} »</p><footer><span class="small">${store.byId('profiles', m.from)?.full_name?.split(' ')[0] || 'Un étudiant'} → <button class="linkish" onClick=${() => openProfile(store.byId('profiles', m.to))}>${store.byId('profiles', m.to)?.full_name}</button></span></footer></blockquote>`)}
        </div>` : null}
      </aside>
    </div>
    ${compose ? html`<${OfferComposer} ctx=${ctx} onClose=${() => setCompose(false)}/>` : null}
  </section>`;
}

// Premiers pas : un guide court par rôle, dont les étapes se cochent toutes seules.
function Guide({ ctx, setCompose }) {
  const { data, me, saison, go } = ctx;
  const [off, setOff] = useLocal('guide-off-' + me.id, false);
  if (off || me.role === 'admin') return null;
  const n = niveauOf(me, saison);
  const myApps = data.applications.filter(a => a.student_id === me.id);
  const myOffers = data.offers.filter(o => o.author_id === me.id);
  const steps = me.role === 'etudiant' ? [
    ['user', 'Complète ton profil', 'Ajoute le lien de ton CV : il sera joint à chaque candidature.', !!me.cv_url, () => go('profil'), 'Mon profil'],
    ['feed', 'Postule à une offre', `Tu ne vois que les offres de ${NIVEAUX[n]?.short || 'ton année'}. Un message de deux phrases suffit.`, myApps.some(a => a.offer_id), () => go('offres'), 'Voir les offres'],
    ['people', 'Le lauréat te répond', 'Il fait avancer ta candidature : entretien, puis « Recruté(e) ». Tu suis tout dans Mon parcours.', myApps.some(a => a.offer_id && a.status !== 'postule'), () => go('parcours'), 'Mon parcours'],
    ['heart', 'Confirme et dis merci', 'Quand il te marque recruté(e), tu confirmes en un clic et tu lui laisses un mot.', data.placements.some(p => p.student_id === me.id && p.status === 'confirme' && p.merci), null, ''],
  ] : [
    ['user', 'Complète ton profil', 'Entreprise, poste, sujets sur lesquels tu peux aider : les étudiants te trouvent plus facilement.', !!(me.entreprise && me.poste), () => go('profil'), 'Mon profil'],
    ['plus', 'Publie une offre', 'Une minute suffit. Seuls les étudiants de l’année concernée la voient.', myOffers.length > 0, () => setCompose(true), 'Publier'],
    ['inbox', 'Réponds aux candidats', 'Les candidatures arrivent dans Mon espace, avec message et CV.', data.applications.some(a => myOffers.some(o => o.id === a.offer_id) && a.status !== 'postule'), () => go('espace'), 'Mon espace'],
    ['check', 'Marque « Recruté(e) »', 'L’étudiant confirme, et tu reçois ses remerciements et 50 points.', data.placements.some(p => p.laureat_id === me.id && p.status === 'confirme'), null, ''],
  ];
  const done = steps.filter(x => x[3]).length;
  if (done === steps.length) return null;
  return html`<div class="guide">
    <div class="guide-head"><div><p class="eyebrow">Comment ça marche</p><h2>${me.role === 'etudiant' ? 'Trouver ton stage avec les lauréats, en 4 étapes' : 'Aider les étudiants, en 4 étapes'}</h2></div>
      <span class="muted small">${done}/${steps.length}</span><button class="icon-btn small" aria-label="Masquer le guide" onClick=${() => setOff(true)}><${Icon} name="x" size=${16}/></button></div>
    <ol class="guide-steps">${steps.map(([ic, t, d, ok, fn, cta], i) => html`<li class=${ok ? 'ok' : ''}>
      <span class="g-ico"><${Icon} name=${ok ? 'check' : ic} size=${20}/></span>
      <strong>${i + 1}. ${t}</strong><span class="small muted">${d}</span>
      ${!ok && fn ? html`<button class="btn tiny" onClick=${fn}>${cta}</button>` : null}</li>`)}</ol>
  </div>`;
}

function MyProfile({ ctx }) {
  const { me, store } = ctx;
  return html`<section class="page narrow">
    <header class="page-head"><div><p class="eyebrow">Visible par les membres connectés</p><h1>Mon profil</h1></div>
      ${store.mode === 'live' ? html`<button class="btn ghost" onClick=${() => store.signOut()}><${Icon} name="logout"/> Se déconnecter</button>` : null}</header>
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
      <${BrandLogo} size=${72}/>
      <h1>Réseau ENSAM Meknès</h1>
      <p>Les lauréats partagent leurs offres de stages, de PFE et d’emplois. Les étudiants trouvent plus vite, avec un suivi de chaque promo jusqu’au premier emploi.</p>
      <ul class="auth-points">
        <li><span class="sc-ico"><${Icon} name="feed"/></span> Offres partagées par les anciens, avec cooptation</li>
        <li><span class="sc-ico"><${Icon} name="check"/></span> Recrutements vérifiés : le lauréat déclare, l’étudiant confirme</li>
        <li><span class="sc-ico"><${Icon} name="mentor"/></span> Mentorat et entraide entre générations</li>
        <li><span class="sc-ico"><${Icon} name="chart"/></span> Suivi de chaque promo, de la 3A au premier emploi</li>
      </ul>
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
    <div class="row"><${BrandLogo} size=${44}/><div><p class="eyebrow">Dernière étape</p><h2>Présente-toi à la communauté</h2></div></div>
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
