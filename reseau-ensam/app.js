// Point d'entrée : coque de l'application, connexion, accueil, notifications.
import { getLang, setLang } from './i18n.js';
import { html, render, useState, useEffect, useMemo, useRef } from './vendor/preact-htm.js';
import { createStore } from './store.js';
import { Icon, Field, Empty, Person, Avatar, Bar, Toaster, toast, Confirm, LevelChip, BrandLogo, SchoolScene, Num, useLocal } from './ui.js';
import { seasonOf, seasonLabel, niveauOf, NIVEAUX, OBJECTIFS, FOUND, statutOf, seasonStats, computeScores, starOfMonth, mentorState, requestsFor, timeAgo, pct, routedTo, needsRelance, myGroups, groupKey } from './logic.js';
import { OffersPage, OfferCard, OfferDetail, OfferComposer, RecoOffers, matchesMe, APP_STATUS } from './offers.js';
import { ParcoursPage, EspacePage, ConfirmRecruit, Journey, journeyStep } from './me.js';
import { DashboardPage } from './dashboard.js';
import { ReseauPage, ProfileModal, ProfileForm, AskQuestion } from './community.js';
import { AdminPage, AnnonceBanner } from './admin.js';
import { MentoratPage, AskHelp, NextRdv, HelpNeeded, slotWhen } from './mentorat.js';
import { SuccessFeed, VerifyPage } from './growth.js';
import { PrivacyPage, ConsentModal, MesDonnees, DesaboPage } from './privacy.js';
import { useInstall, IosInstallHelp } from './pwa.js';
import { NextCafe } from './groupes.js';
import { EntrepriseModal } from './pro.js';
import { DefisPanel, CoupePromos, ParrainCard, DevenirParrain, TonAnnee, TonAnneeStrip } from './saison.js';
import { AlerteTalents } from './recrutement.js';

const ROUTES = ['accueil', 'offres', 'mentorat', 'parcours', 'espace', 'reseau', 'suivi', 'profil', 'admin', 'verifier', 'confidentialite', 'desabo'];
const ALIASES = { impact: 'espace', tableau: 'suivi', communaute: 'reseau', entraide: 'reseau/entraide', groupes: 'reseau/groupes', sujets: 'offres/sujets', 'reseau/mentorat': 'mentorat', 'reseau/mentorat/rdv': 'mentorat' };

function navFor(me) {
  const items = [['accueil', 'Accueil', 'home'], ['offres', 'Offres', 'feed'], ['mentorat', 'Mentorat', 'mentor']];
  if (me.role === 'etudiant') items.push(['parcours', 'Mon parcours', 'route']);
  else if (me.role === 'laureat') items.push(['espace', 'Mon espace', 'star']);
  items.push(['reseau', 'Réseau', 'network'], ['suivi', me.role === 'etudiant' ? 'Ma promo' : 'Suivi', 'chart']);
  if (me.role === 'admin') items.push(['admin', 'Admin', 'shield']);
  return items;
}

const dec = x => { try { return decodeURIComponent(x || ''); } catch { return x || ''; } };
function parseRoute(r) {
  const [base, sub, sub2] = (ALIASES[dec(r)] || r).split('/').map(dec);
  return ROUTES.includes(base) ? { base, sub: sub || '', sub2: sub2 || '' } : { base: 'accueil', sub: '', sub2: '' };
}
const readRoute = () => parseRoute((location.hash || '').slice(1));

function App({ store }) {
  const [, setTick] = useState(0);
  const [route, setRoute] = useState(readRoute);
  const [profile, setProfile] = useState(null);
  const [offerId, setOfferId] = useState(null);
  const [applyNow, setApplyNow] = useState(false);
  const [askMentor, setAskMentor] = useState(null);
  const [confirmBox, setConfirmBox] = useState(null);
  const [pop, setPop] = useState(null); // 'bell' | 'me'
  const seen = useRef(null); const lastAct = useRef(0);
  useEffect(() => store.on(() => setTick(t => t + 1)), []);
  useEffect(() => { const f = () => setRoute(readRoute()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  useEffect(() => { if (!pop) return; const f = e => { if (!e.target.closest('.pop-wrap')) setPop(null); }; document.addEventListener('click', f); return () => document.removeEventListener('click', f); }, [pop]);
  const go = r => { try { history.replaceState(null, '', '#' + r); } catch { /* cadre */ } setRoute(parseRoute(r)); setPop(null); window.scrollTo?.(0, 0); };
  const [entreprise, setEntreprise] = useState(null);
  const [askQ, setAskQ] = useState(null);
  const [annee, setAnnee] = useState(null);
  const [iosHelp, setIosHelp] = useState(false);
  const install = useInstall();

  const data = store.data;
  const me = store.me;
  const saison = seasonOf();
  const scores = useMemo(() => computeScores(data), [data.offers, data.applications, data.comments, data.placements, data.mentorships, data.answers, data.questions, data.votes]);
  const monthScores = useMemo(() => computeScores(data, new Date(Date.now() - 30 * 864e5)), [data]);
  const star = useMemo(() => starOfMonth(data, monthScores), [data, monthScores]);

  // Temps réel : une nouvelle notification venue d'un autre membre s'affiche aussi en bas de l'écran
  const latest = useRef(null);
  useEffect(() => {
    const cur = latest.current; latest.current = null;
    if (!cur) return;
    const { notifs, todo, me: who } = cur;
    const keys = new Set(notifs.map(n => n.key).filter(Boolean));
    const prev = seen.current;
    if (prev && prev.id === who.id && Date.now() - lastAct.current > 2500) {
      const fresh = notifs.find(n => n.key && !prev.keys.has(n.key) && (n.action || n.tone === 'good'));
      if (fresh) toast(fresh.text);
    }
    seen.current = { id: who.id, keys };
    try { document.title = (todo ? `(${todo}) ` : '') + 'Réseau ENSAM Meknès'; } catch { /* */ }
  });

  const relang = () => setTick(t => t + 1);
  // Pages publiques, sans compte : vérification d'une attestation, désabonnement des emails, confidentialité
  if (route.base === 'verifier') return html`<div class="auth verify-wrap"><div class="auth-lang"><${LangToggle} onChange=${relang}/></div><${VerifyPage} store=${store} id=${route.sub}/></div>`;
  if (route.base === 'desabo') return html`<div class="auth verify-wrap"><div class="auth-lang"><${LangToggle} onChange=${relang}/></div><${DesaboPage} store=${store} token=${route.sub}/></div>`;
  if (route.base === 'confidentialite' && (store.mode !== 'live' || !store.session || !me)) return html`<div class="auth verify-wrap privacy-wrap"><div class="auth-lang"><${LangToggle} onChange=${relang}/></div><${PrivacyPage} onBack=${() => { history.back(); setTimeout(() => setRoute(readRoute()), 50); }}/></div>`;
  if (store.mode === 'live' && !store.session) return html`<${AuthScreen} store=${store} relang=${relang}/>`;
  if (store.mode === 'live' && !me) return html`<${Onboarding} store=${store} relang=${relang}/>`;

  const act = async fn => { lastAct.current = Date.now(); try { await fn(); } catch (e) { toast(e.message || String(e), 'err'); } lastAct.current = Date.now(); };
  const ctx = {
    store, data, me, saison, scores, go, act, sub: route.sub, sub2: route.sub2, star, starId: star?.p.id,
    openProfile: p => p && setProfile(p),
    openOffer: (id, apply = false) => { setOfferId(id); setApplyNow(apply); setPop(null); },
    confirm: (text, onYes, yes) => setConfirmBox({ text, onYes, yes }),
    openEntreprise: name => name && setEntreprise(name),
    askQuestion: initial => setAskQ(initial || {}),
    askHelp: p => setAskMentor(p),
    openAnnee: s => setAnnee(s || saison),
  };
  const notifs = buildNotifs(ctx);
  const todo = notifs.filter(n => n.action).length;
  latest.current = { notifs, todo, me };
  const nav = navFor(me);
  let page = route.base;
  if (page === 'parcours' && me.role !== 'etudiant') page = me.role === 'laureat' ? 'espace' : 'accueil';
  if (page === 'espace' && me.role !== 'laureat') page = me.role === 'etudiant' ? 'parcours' : 'accueil';
  if (page === 'admin' && me.role !== 'admin') page = 'accueil';
  const needConsent = store.mode === 'live' && !me.consent_at && !['confidentialite', 'profil'].includes(page);
  const openNotif = n => { setPop(null); if (n.offer) ctx.openOffer(n.offer); else go(n.to); };
  const dotFor = k => ((k === 'parcours' || k === 'espace') && notifs.some(n => n.action && n.mine)) || (k === 'mentorat' && notifs.some(n => n.action && n.to === 'mentorat'));

  return html`<div class="shell">
    <aside class="side">
      <a class="brand" href="#accueil" onClick=${e => { e.preventDefault(); go('accueil'); }}><${BrandLogo} size=${40}/><span class="brand-txt"><strong>Réseau ENSAM</strong><span>Meknès · Lauréats & étudiants</span></span></a>
      <nav class="side-nav">${nav.map(([k, l, i]) => html`<a href=${'#' + k} class=${page === k ? 'on' : ''} onClick=${e => { e.preventDefault(); go(k); }}><span class="nav-ico"><${Icon} name=${i}/></span> ${l}${dotFor(k) ? html`<span class="dotn"></span>` : null}</a>`)}</nav>
      <div class="side-foot"><span class="mono small muted">Saison ${seasonLabel(saison)}</span><a class="small muted" href="#confidentialite" onClick=${e => { e.preventDefault(); go('confidentialite'); }}>Confidentialité</a></div>
    </aside>
    <div class="main">
      <header class="top">
        <a class="brand mobile-only" href="#accueil" onClick=${e => { e.preventDefault(); go('accueil'); }}><${BrandLogo} size=${34}/><strong>Réseau ENSAM</strong></a>
        <span class="spacer"></span>
        ${store.mode === 'demo' ? html`<${PersonaSwitch} store=${store} go=${go}/>` : null}
        <${LangToggle} onChange=${relang} store=${store} me=${me}/>
        <div class="pop-wrap"><button class="icon-btn" aria-label=${`Notifications (${todo} à traiter)`} aria-expanded=${pop === 'bell'} onClick=${() => setPop(pop === 'bell' ? null : 'bell')}><${Icon} name="bell"/>${todo ? html`<span class="badge-n">${todo}</span>` : null}</button>
          ${pop === 'bell' ? html`<div class="bell-pop" role="menu"><h3>Notifications</h3>${notifs.length ? notifs.slice(0, 14).map(n => html`<button class=${'notif' + (n.action ? ' act' : '')} onClick=${() => openNotif(n)}><span class=${'n-ico ' + (n.tone || '')}><${Icon} name=${n.icon} size=${16}/></span><span>${n.text}<span class="muted small">${timeAgo(n.at)}</span></span></button>`) : html`<p class="muted small">Rien de nouveau.</p>`}</div>` : null}
        </div>
        <div class="pop-wrap"><button class="me-btn" onClick=${() => setPop(pop === 'me' ? null : 'me')} aria-label="Mon compte" aria-expanded=${pop === 'me'}><${Avatar} p=${me} size=${34}/></button>
          ${pop === 'me' ? html`<div class="menu-pop right" role="menu">
            <div class="menu-who"><strong>${me.full_name}</strong><span class="muted small">${me.role === 'etudiant' ? 'Étudiant(e)' : me.role === 'laureat' ? 'Lauréat(e)' : 'Administration'}</span></div>
            <button onClick=${() => go('profil')}><${Icon} name="user" size=${16}/> Mon profil</button>
            <button onClick=${() => { try { localStorage.removeItem('guide-off-' + me.id); } catch { /* */ } go('accueil'); }}><${Icon} name="route" size=${16}/> Comment ça marche ?</button>
            ${me.role !== 'admin' ? html`<button onClick=${() => { setPop(null); ctx.openAnnee(); }}><${Icon} name="award" size=${16}/> Ton année dans le réseau</button>` : null}
            ${install ? html`<button onClick=${() => { setPop(null); install.ios ? setIosHelp(true) : install.prompt(); }}><${Icon} name="download" size=${16}/> Installer l’application</button>` : null}
            <button onClick=${() => go('confidentialite')}><${Icon} name="shield" size=${16}/> Confidentialité</button>
            ${me.role === 'admin' ? html`<button onClick=${() => go('admin')}><${Icon} name="shield" size=${16}/> Administration</button>` : null}
            ${store.mode === 'live' ? html`<button onClick=${() => store.signOut()}><${Icon} name="logout" size=${16}/> Se déconnecter</button>` : html`<button onClick=${() => { store.reset(); setPop(null); toast('Démo réinitialisée.'); }}><${Icon} name="spark" size=${16}/> Réinitialiser la démo</button>`}
          </div>` : null}
        </div>
      </header>
      ${store.mode === 'demo' ? html`<div class="demo-band"><${Icon} name="spark" size=${15}/><span>Démo avec des données fictives. Essaie le mentorat : <b translate="no">Salma</b> demande de l’aide, <b translate="no">Youssef</b> (lauréat) clique sur un horaire, la visio est prête. Change de rôle en haut.</span></div>` : null}
      <main class="content">
        ${page === 'accueil' ? html`<${Home} ...${ctx} notifs=${notifs} openNotif=${openNotif}/>` : null}
        ${page === 'offres' ? html`<${OffersPage} ...${ctx}/>` : null}
        ${page === 'mentorat' ? html`<${MentoratPage} ...${ctx}/>` : null}
        ${page === 'parcours' ? html`<${ParcoursPage} ...${ctx}/>` : null}
        ${page === 'espace' ? html`<${EspacePage} ...${ctx}/>` : null}
        ${page === 'reseau' ? html`<${ReseauPage} ...${ctx}/>` : null}
        ${page === 'suivi' ? html`<${DashboardPage} ...${ctx}/>` : null}
        ${page === 'admin' ? html`<${AdminPage} ...${ctx}/>` : null}
        ${page === 'profil' ? html`<${MyProfile} ctx=${ctx}/>` : null}
        ${page === 'confidentialite' ? html`<${PrivacyPage}/>` : null}
      </main>
    </div>
    <nav class="bottom-nav">${nav.map(([k, l, i]) => html`<a href=${'#' + k} class=${page === k ? 'on' : ''} onClick=${e => { e.preventDefault(); go(k); }}><span class="bn-ico"><${Icon} name=${i}/>${dotFor(k) ? html`<span class="dotn"></span>` : null}</span><span>${{ 'Mon parcours': 'Parcours', 'Mon espace': 'Espace', 'Ma promo': 'Promo' }[l] || l}</span></a>`)}</nav>
    ${offerId ? html`<${OfferDetail} ctx=${ctx} id=${offerId} key=${offerId} apply=${applyNow} onClose=${() => setOfferId(null)}/>` : null}
    ${profile ? html`<${ProfileModal} ctx=${ctx} p=${profile} onClose=${() => setProfile(null)} onAskMentor=${p => { setProfile(null); setAskMentor(p); }}/>` : null}
    ${askMentor ? html`<${AskHelp} ctx=${ctx} mentor=${askMentor} onClose=${() => setAskMentor(null)}/>` : null}
    ${confirmBox ? html`<${Confirm} text=${confirmBox.text} onYes=${confirmBox.onYes} onClose=${() => setConfirmBox(null)} yes=${confirmBox.yes || 'Supprimer'}/>` : null}
    ${entreprise ? html`<${EntrepriseModal} ctx=${ctx} name=${entreprise} key=${entreprise} onClose=${() => setEntreprise(null)}/>` : null}
    ${askQ ? html`<${AskQuestion} ctx=${ctx} initial=${askQ} onClose=${() => setAskQ(null)} onDone=${id => { setAskQ(null); go('reseau/entraide/' + id); }}/>` : null}
    ${annee ? html`<${TonAnnee} ctx=${ctx} saison=${annee} onClose=${() => setAnnee(null)}/>` : null}
    ${iosHelp ? html`<${IosInstallHelp} onClose=${() => setIosHelp(false)}/>` : null}
    ${needConsent ? html`<${ConsentModal} ctx=${ctx}/>` : null}
    <${Toaster}/>
  </div>`;
}

// Bouton français / arabe, en haut à côté des notifications
export function LangToggle({ onChange, store, me }) {
  const ar = getLang() === 'ar';
  const save = l => { if (store?.mode === 'live' && me && me.langue !== l && 'langue' in me) store.update('profiles', me.id, { langue: l }).catch(() => {}); };
  return html`<button class="lang-btn" onClick=${() => { setLang(ar ? 'fr' : 'ar'); save(ar ? 'fr' : 'ar'); onChange?.(); }} aria-label=${ar ? 'Passer en français' : 'التبديل إلى العربية'} lang=${ar ? 'fr' : 'ar'}>
    <${Icon} name="globe" size=${16}/><span>${ar ? 'FR' : 'ع'}</span><span class="lang-long">${ar ? 'Français' : 'العربية'}</span></button>`;
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
    if (p.status === 'en_attente') out.push({ key: 'pa' + p.id, action: true, mine: true, tone: 'accent', icon: 'briefcase', to: 'parcours', at: p.created_at, text: `${name(p.laureat_id)} indique t’avoir recruté(e) chez ${p.entreprise}. Confirme-le.` });
    if (p.status === 'confirme' && p.laureat_id && !p.merci) out.push({ action: true, mine: true, tone: 'brass', icon: 'heart', to: 'parcours', at: p.confirmed_at || p.created_at, text: `Ta réussite chez ${p.entreprise} est confirmée. Laisse un merci à ${first(p.laureat_id)}.` });
  }
  for (const a of data.applications) if (a.student_id === me.id && a.offer_id && a.status !== 'postule' && recent(a.updated_at || a.created_at, 21)) {
    out.push({ key: 'as' + a.id + a.status, icon: a.status === 'refuse' ? 'x' : a.status === 'entretien' ? 'people' : 'check', tone: a.status === 'refuse' ? '' : 'good', offer: a.offer_id, at: a.updated_at || a.created_at, text: `Ta candidature « ${a.titre} » : ${APP_STATUS[a.status]}.` });
  }
  if (me.role === 'etudiant') {
    for (const o of data.offers) if (o.status === 'ouverte' && matchesMe(o, me, saison) && recent(o.created_at, 7)) out.push({ icon: 'feed', offer: o.id, at: o.created_at, text: `Nouvelle offre pour toi : ${o.titre} (${o.entreprise})` });
  }
  // Lauréat : candidatures reçues, confirmations, commentaires
  const myOffers = new Map(data.offers.filter(o => o.author_id === me.id).map(o => [o.id, o]));
  for (const a of data.applications) if (myOffers.has(a.offer_id) && a.status === 'postule') out.push({ key: 'ap' + a.id, action: true, mine: true, tone: 'accent', icon: 'inbox', offer: a.offer_id, at: a.created_at, text: `Nouvelle candidature de ${name(a.student_id)} : ${myOffers.get(a.offer_id).titre}` });
  for (const p of data.placements) if (p.laureat_id === me.id && p.status === 'confirme' && recent(p.confirmed_at || p.created_at, 30)) out.push({ key: 'pc' + p.id, icon: 'trophy', tone: 'brass', to: 'espace', at: p.confirmed_at || p.created_at, text: `${name(p.student_id)} a confirmé son recrutement chez ${p.entreprise}. +50 points${p.merci ? ' et un merci' : ''}.` });
  for (const c of data.comments) if (myOffers.has(c.offer_id) && c.author_id !== me.id && recent(c.created_at, 14)) out.push({ icon: 'comment', offer: c.offer_id, at: c.created_at, text: `${name(c.author_id)} a posé une question sur ton offre : « ${c.body.slice(0, 60)}${c.body.length > 60 ? '…' : ''} »` });
  // Mentorat : demande reçue, horaire choisi, rendez-vous proche, puis merci
  for (const m of data.mentorships) {
    const st = mentorState(m);
    const w = st === 'rdv' && m.rdv_at ? slotWhen(m.rdv_at) : null;
    const soon = w && w.diff >= 0 && w.diff <= 1 ? `${w.diff === 0 ? 'aujourd’hui' : 'demain'} à ${w.time}` : null;
    const upcoming = m.rdv_at && new Date(m.rdv_at) > Date.now();
    if (m.mentor_id === me.id) {
      if (st === 'demande') out.push({ key: 'md' + m.id, action: true, tone: 'accent', icon: 'mentor', to: 'mentorat', at: m.created_at, text: `${name(m.student_id)} te demande de l’aide : ${m.sujet}` });
      if (soon) out.push({ key: 'mr' + m.id, rdv: true, action: true, tone: 'accent', icon: 'video', to: 'mentorat', at: m.accepted_at || m.created_at, text: `Rendez-vous avec ${name(m.student_id)} ${soon}` });
      if (st === 'apres') out.push({ key: 'mf' + m.id, action: true, tone: 'brass', icon: 'check', to: 'mentorat', at: m.rdv_at, text: `Ton rendez-vous avec ${first(m.student_id)} a eu lieu ? Marque-le comme terminé.` });
      if (st === 'terminee' && m.merci && recent(m.rdv_at || m.created_at, 14)) out.push({ key: 'mm' + m.id, tone: 'brass', icon: 'heart', to: 'espace', at: m.rdv_at || m.created_at, text: `${first(m.student_id)} te remercie pour le mentorat : ${m.sujet}` });
      if (st === 'annulee' && upcoming) out.push({ key: 'mx' + m.id, icon: 'x', to: 'mentorat', at: m.accepted_at || m.created_at, text: `Rendez-vous annulé : ${m.sujet}` });
    }
    if (m.student_id === me.id) {
      if (st === 'rdv' && !soon && recent(m.accepted_at || m.created_at, 10)) out.push({ key: 'sa' + m.id + m.rdv_at, icon: 'mentor', tone: 'good', to: 'mentorat', at: m.accepted_at || m.created_at, text: `${name(m.mentor_id)} a accepté ta demande : ${m.sujet}` });
      if (soon) out.push({ key: 'sr' + m.id + m.rdv_at, rdv: true, action: true, mine: true, tone: 'accent', icon: 'video', to: 'mentorat', at: m.accepted_at || m.created_at, text: `Rendez-vous avec ${name(m.mentor_id)} ${soon}` });
      if (st === 'apres') out.push({ key: 'sf' + m.id, action: true, mine: true, tone: 'brass', icon: 'heart', to: 'mentorat', at: m.rdv_at, text: `Comment s’est passé ton échange avec ${first(m.mentor_id)} ? Dis-lui merci.` });
      if (st === 'annulee' && upcoming && m.mentor_id) out.push({ key: 'sx' + m.id, icon: 'x', to: 'mentorat', at: m.accepted_at || m.created_at, text: `Rendez-vous annulé : ${m.sujet}` });
    }
  }
  // Lauréat : demandes ouvertes à tous qui lui correspondent bien (deux au plus)
  if (me.role === 'laureat') for (const { m } of requestsFor(data, me, id => store.byId('profiles', id)).filter(x => !x.direct && x.score >= 3).slice(0, 2)) {
    out.push({ key: 'mo' + m.id, tone: 'accent', icon: 'heart', to: 'mentorat', at: m.created_at, text: `${name(m.student_id)} cherche de l’aide : ${m.sujet}` });
  }
  // Invitations à postuler (étudiant)
  for (const i of data.invitations) if (i.student_id === me.id && i.status === 'envoyee' && !data.applications.some(a => a.offer_id === i.offer_id && a.student_id === me.id)) {
    const o = store.byId('offers', i.offer_id);
    if (o && o.status === 'ouverte') out.push({ key: 'in' + i.id, action: true, mine: true, tone: 'accent', icon: 'send', offer: o.id, at: i.created_at, text: `${name(i.laureat_id)} t’invite à postuler : ${o.titre}` });
  }
  // Bravos reçus sur sa réussite
  for (const p of data.placements) if (p.student_id === me.id && FOUND.has(p.status)) {
    const k = data.kudos.filter(x => x.placement_id === p.id && x.user_id !== me.id);
    const last = k.reduce((m, x) => (x.created_at > m ? x.created_at : m), '');
    if (k.length && recent(last, 14)) out.push({ icon: 'clap', tone: 'brass', to: 'accueil', at: last, text: `${k.length} bravo${k.length > 1 ? 's' : ''} pour ta réussite chez ${p.entreprise}` });
  }
  const myQ = new Set(data.questions.filter(q => q.author_id === me.id).map(q => q.id));
  for (const a of data.answers) if (myQ.has(a.question_id) && a.author_id !== me.id) out.push({ key: 'an' + a.id, tone: 'good', icon: 'qa', to: 'reseau/entraide/' + a.question_id, at: a.created_at, text: `${name(a.author_id)} a répondu à ta question.` });
  // Questions routées vers ce lauréat (son entreprise ou son pays), sans réponse de sa part
  if (me.role === 'laureat') for (const q of data.questions) if (routedTo(q, me) && recent(q.created_at, 14) && !data.answers.some(a => a.question_id === q.id && a.author_id === me.id)) {
    out.push({ key: 'qr' + q.id, action: true, tone: 'accent', icon: 'qa', to: 'reseau/entraide/' + q.id, at: q.created_at, text: `Une question pour toi sur ${q.entreprise || q.pays} : ${q.titre}` });
  }
  // Relance douce : mes offres ouvertes sans activité depuis 3 semaines
  for (const o of data.offers) if (o.author_id === me.id && needsRelance(data, o)) out.push({ key: 'ro' + o.id, action: true, mine: true, icon: 'clock', offer: o.id, at: o.relance_at || o.created_at, text: `Ton offre « ${o.titre} » est-elle toujours ouverte ?` });
  // Parrainage
  for (const x of data.parrainages) if (x.saison === saison && recent(x.created_at, 14)) {
    if (x.parrain_id === me.id) out.push({ key: 'pf' + x.id, tone: 'brass', icon: 'heart', to: 'espace', at: x.created_at, text: `${name(x.filleul_id)} (3A) est ton filleul cette année. Fais-lui signe !` });
    if (x.filleul_id === me.id) out.push({ key: 'pp' + x.id, tone: 'brass', icon: 'heart', to: 'accueil', at: x.created_at, text: `${name(x.parrain_id)}, lauréat(e) de ta filière, est ton parrain cette année.` });
  }
  // Un café ENSAM annoncé dans ma ville ou mon pays
  const groups = myGroups(data, me).all;
  for (const c of data.cafes) {
    const g = groups.includes(groupKey('ville', c.ville)) ? groupKey('ville', c.ville) : groups.includes(groupKey('pays', c.pays)) ? groupKey('pays', c.pays) : null;
    if (!g || c.annule || c.organisateur_id === me.id || new Date(c.date_at) < Date.now() || !recent(c.created_at, 10)) continue;
    if (data.cafe_participants.some(x => x.cafe_id === c.id && x.user_id === me.id)) continue;
    const w = new Date(c.date_at);
    out.push({ key: 'cf' + c.id, icon: 'clap', tone: 'good', to: 'reseau/groupes/' + encodeURIComponent(g), at: c.created_at, text: `Café ENSAM à ${c.ville} le ${w.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} : inscris-toi en un clic.` });
  }
  return out.sort((a, b) => (b.action ? 1 : 0) - (a.action ? 1 : 0) || new Date(b.at) - new Date(a.at));
}

// ---------------------------------------------------------------------------
// Accueil : ce qu'il y a à faire aujourd'hui, le prochain rendez-vous, ce qui est pour moi
// ---------------------------------------------------------------------------
function Home(ctx) {
  const { data, me, saison, scores, store, go, openProfile, openOffer, notifs, openNotif } = ctx;
  const n = niveauOf(me, saison);
  const st = useMemo(() => seasonStats(data, saison), [data, saison]);
  const first = me.full_name.split(' ')[0];
  const [compose, setCompose] = useState(false);
  const isStudent = me.role === 'etudiant';
  // Le prochain rendez-vous a sa propre carte ; la confirmation de recrutement aussi
  // Les demandes d'aide et le prochain rendez-vous ont leur propre bloc juste en dessous
  const actions = notifs.filter(x => x.action && !x.rdv && !x.key?.startsWith('md') && !(isStudent && x.icon === 'briefcase'));
  const latest = data.offers.filter(o => o.status === 'ouverte').sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 4);
  const star = ctx.star;
  const starHelped = star ? data.placements.filter(p => p.laureat_id === star.p.id && p.status === 'confirme').length : 0;
  const mercis = [
    ...data.placements.filter(p => p.merci && p.laureat_id).map(p => ({ from: p.student_id, to: p.laureat_id, txt: p.merci, at: p.confirmed_at || p.created_at })),
    ...data.mentorships.filter(m => m.merci && m.mentor_id).map(m => ({ from: m.student_id, to: m.mentor_id, txt: m.merci, at: m.rdv_at || m.created_at })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 2);
  const stu = isStudent ? statutOf(data, me, saison) : null;
  const obj = OBJECTIFS[n];
  const s = scores.get(me.id);
  const myApps = data.applications.filter(a => a.student_id === me.id);
  const helper = stu?.pl?.laureat_id ? store.byId('profiles', stu.pl.laureat_id) : null;
  const asking = data.mentorships.some(m => m.student_id === me.id && ['demande', 'acceptee'].includes(m.status));

  return html`<section class="page home">
    <header class="hello home-hero sky">
      <div class="hello-txt">
        <p class="eyebrow">Saison ${seasonLabel(saison)}${isStudent ? ` · ${NIVEAUX[n]?.label} · ${me.filiere}` : me.role === 'laureat' ? ` · Promo ${me.promo}` : ''}</p>
        <h1>Bonjour ${first}</h1>
        <p class="hello-sub">${isStudent ? 'Les lauréats de l’école t’ouvrent leurs portes. Avance à ton rythme.' : me.role === 'laureat' ? 'Merci de garder la porte ouverte aux étudiants de l’école.' : 'Tout le réseau de l’école, en un coup d’œil.'}</p>
      </div>
      <${SchoolScene} align=${getLang() === 'ar' ? 'xMinYMax' : 'xMaxYMax'}/>
    </header>

    <${AnnonceBanner} ctx=${ctx}/>
    <${TonAnneeStrip} ctx=${ctx} onOpen=${ctx.openAnnee}/>
    <${Guide} ctx=${ctx} setCompose=${setCompose}/>

    ${isStudent && stu.pl?.status === 'en_attente' ? html`<${ConfirmRecruit} ctx=${ctx} pl=${stu.pl} helper=${helper}/>` : null}

    ${actions.length ? html`<div class="callout today"><h2 class="h-ico"><${Icon} name="bell"/> À faire aujourd’hui</h2><ul class="todo">${actions.slice(0, 4).map(a => html`<li><button class="notif act" onClick=${() => openNotif(a)}><span class=${'n-ico ' + (a.tone || '')}><${Icon} name=${a.icon} size=${16}/></span><span>${a.text}</span><${Icon} name="arrow" size=${16}/></button></li>`)}</ul></div>` : null}

    <${NextRdv} ctx=${ctx}/>
    <${ParrainCard} ctx=${ctx}/>
    <${HelpNeeded} ctx=${ctx}/>
    <${AlerteTalents} ctx=${ctx}/>

    ${isStudent && obj ? html`<button class=${'objective compact clickable st-' + stu.key} onClick=${() => go('parcours')}>
      <div class="objective-top"><span class="obj-ico"><${Icon} name="route" size=${22}/></span>
        <div class="objective-main"><p class="eyebrow">Mon objectif de l’année</p><h2>${obj.titre}</h2></div>
        <span class=${'state-pill s-' + stu.key}>${stu.label}</span></div>
      <${Journey} step=${journeyStep(stu, myApps)}/>
    </button>` : null}

    ${isStudent && !asking ? html`<div class="help-cta"><span class="obj-ico"><${Icon} name="mentor" size=${22}/></span>
      <div class="grow"><strong>Besoin d’un conseil ?</strong><span class="small muted">CV, stage, entretien, étranger : un lauréat te parle 20 minutes en visio.</span></div>
      <button class="btn primary small" onClick=${() => go('mentorat')}>Demander de l’aide</button></div>` : null}

    <${DevenirParrain} ctx=${ctx}/>
    ${me.role === 'laureat' && s ? html`<button class="impact-strip clickable" onClick=${() => go('espace')}><span class="obj-ico brass"><${Icon} name="star" size=${20}/></span><span><b class="mono"><${Num} v=${s.points}/></b> points d’impact</span><${LevelChip} points=${s.points}/><span class="muted small">${s.recrutes} recruté${s.recrutes > 1 ? 's' : ''} grâce à toi</span><span class="spacer"></span><${Icon} name="arrow" size=${18}/></button>` : null}

    <div class="home-grid">
      <div class="home-main">
        ${isStudent ? html`<${RecoOffers} ctx=${ctx}/>` : html`<div class="section-head"><h2>Dernières offres</h2><button class="btn tiny ghost" onClick=${() => go('offres')}>Tout voir <${Icon} name="arrow" size=${14}/></button></div>
          <div class="offer-grid one">${latest.length ? latest.map(o => html`<${OfferCard} key=${o.id} o=${o} ctx=${ctx} onOpen=${() => openOffer(o.id)}/>`) : html`<${Empty} icon="feed" title="Pas encore d’offre">Publie la première : les étudiants concernés la voient tout de suite.<//>`}</div>`}
        <${SuccessFeed} ctx=${ctx}/>
      </div>
      <aside class="home-side">
        <${DefisPanel} ctx=${ctx}/>
        <${NextCafe} ctx=${ctx}/>
        <button class="panel pulse clickable" onClick=${() => go('suivi')}>
          <div class="section-head"><h2>${isStudent ? 'Ma promo' : 'L’école en ce moment'}</h2><${Icon} name="arrow" size=${16}/></div>
          ${st.rows.filter(r => !isStudent || r.n === n).map(r => html`<div class="pulse-row"><span class="niv-badge">${NIVEAUX[r.n].short}</span><div class="pulse-bar"><div class="row small"><span>${r.objectif.court}</span><span class="spacer"></span><span class="mono">${isStudent ? `${r.found}/${r.total}` : pct(r.rate)}</span></div><${Bar} value=${r.rate} pace=${isStudent ? undefined : r.elapsed}/></div></div>`)}
          <p class="small muted">${isStudent ? 'Tes camarades qui ont déjà trouvé. Chacun avance à son rythme.' : `${st.viaTotal} réussites vérifiées grâce aux lauréats cette saison.`}</p>
        </button>
        ${!isStudent ? html`<${CoupePromos} ctx=${ctx} compact/>` : null}
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
    ['mentor', 'Demande un conseil', 'Un lauréat choisit un de tes horaires et t’appelle 20 minutes en visio.', data.mentorships.some(m => m.student_id === me.id), () => go('mentorat'), 'Mentorat'],
    ['heart', 'Confirme et dis merci', 'Quand il te marque recruté(e), tu confirmes en un clic et tu lui laisses un mot.', data.placements.some(p => p.student_id === me.id && p.status === 'confirme' && p.merci), null, ''],
  ] : [
    ['user', 'Complète ton profil', 'Entreprise, poste, sujets sur lesquels tu peux aider : les étudiants te trouvent plus facilement.', !!(me.entreprise && me.poste), () => go('profil'), 'Mon profil'],
    ['plus', 'Publie une offre', 'Une minute suffit. Seuls les étudiants de l’année concernée la voient.', myOffers.length > 0, () => setCompose(true), 'Publier'],
    ['mentor', 'Aide un étudiant', 'Clique sur un de ses horaires : la visio et l’invitation sont prêtes.', data.mentorships.some(m => m.mentor_id === me.id && m.status !== 'demande'), () => go('mentorat'), 'Mentorat'],
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
    <${MesDonnees} ctx=${ctx}/>
  </section>`;
}

// ---------------------------------------------------------------------------
// Connexion et inscription (mode réel)
// ---------------------------------------------------------------------------
function AuthScreen({ store, relang }) {
  const recovery = /type=recovery/.test(location.hash);
  const [mode, setMode] = useState(recovery ? 'nouveau' : 'connexion');
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [ok, setOk] = useState(false); const [mails, setMails] = useState(true);
  const [msg, setMsg] = useState(null); const [busy, setBusy] = useState(false);
  const run = async fn => { setBusy(true); setMsg(null); try { await fn(); } catch (e) { setMsg({ err: true, t: e.message }); } setBusy(false); };
  const submit = e => {
    e.preventDefault();
    if (mode === 'connexion') run(() => store.signIn(email.trim(), pw));
    else if (mode === 'inscription') run(async () => { const r = await store.signUp(email.trim(), pw, { consent_at: new Date().toISOString(), emails_hebdo: mails, langue: getLang() }); if (r.needsConfirm) setMsg({ t: 'Compte créé. Ouvre l’email de confirmation reçu, puis reviens te connecter.' }); });
    else if (mode === 'oubli') run(async () => { await store.resetPassword(email.trim()); setMsg({ t: 'Si un compte existe, un lien de réinitialisation vient d’être envoyé.' }); });
    else run(async () => { await store.setPassword(pw); setMsg({ t: 'Mot de passe changé.' }); });
  };
  return html`<div class="auth">
    <div class="auth-lang"><${LangToggle} onChange=${relang}/></div>
    <section class="auth-hero sky">
      <div class="auth-hero-txt">
        <${BrandLogo} size=${64} draw/>
        <h1>Réseau ENSAM Meknès</h1>
        <p>Les lauréats partagent leurs offres de stages, de PFE et d’emplois. Les étudiants trouvent plus vite, avec un suivi de chaque promo jusqu’au premier emploi.</p>
      </div>
      <${SchoolScene} fit="slice"/>
    </section>
    <div class="auth-right">
    <form class="auth-card form" onSubmit=${submit}>
      <h2>${{ connexion: 'Se connecter', inscription: 'Créer mon compte', oubli: 'Mot de passe oublié', nouveau: 'Nouveau mot de passe' }[mode]}</h2>
      ${mode !== 'nouveau' ? html`<${Field} label="Email"><input id="au-email" type="email" required autocomplete="email" value=${email} onInput=${e => setEmail(e.target.value)}/><//>` : null}
      ${mode !== 'oubli' ? html`<${Field} label="Mot de passe" hint=${mode === 'connexion' ? '' : '6 caractères minimum'}><input id="au-pw" type="password" required minlength="6" autocomplete=${mode === 'connexion' ? 'current-password' : 'new-password'} value=${pw} onInput=${e => setPw(e.target.value)}/><//>` : null}
      ${mode === 'inscription' ? html`<label class="check small"><input id="au-ok" type="checkbox" required checked=${ok} onChange=${e => setOk(e.target.checked)}/> <span>J’accepte que mes données servent au réseau (<a href="#confidentialite">Confidentialité</a>)</span></label>
        <label class="check small"><input id="au-mail" type="checkbox" checked=${mails} onChange=${e => setMails(e.target.checked)}/> Recevoir un résumé par email chaque semaine</label>` : null}
      ${msg ? html`<p class=${'auth-msg' + (msg.err ? ' err' : '')} role="alert">${msg.t}</p>` : null}
      <button class="btn primary wide" disabled=${busy || (mode === 'inscription' && !ok)}>${busy ? '…' : { connexion: 'Se connecter', inscription: 'Créer mon compte', oubli: 'Envoyer le lien', nouveau: 'Enregistrer' }[mode]}</button>
      <div class="auth-links">
        ${mode !== 'connexion' ? html`<button type="button" class="linkish" onClick=${() => { setMode('connexion'); setMsg(null); }}>J’ai déjà un compte</button>` : html`<button type="button" class="linkish" onClick=${() => { setMode('inscription'); setMsg(null); }}>Créer un compte</button>`}
        ${mode === 'connexion' ? html`<button type="button" class="linkish" onClick=${() => { setMode('oubli'); setMsg(null); }}>Mot de passe oublié ?</button>` : null}
      </div>
    </form>
    <ul class="auth-points">
      <li><span class="sc-ico"><${Icon} name="feed"/></span> Offres partagées par les anciens, avec cooptation</li>
      <li><span class="sc-ico"><${Icon} name="check"/></span> Recrutements vérifiés : le lauréat déclare, l’étudiant confirme</li>
      <li><span class="sc-ico"><${Icon} name="mentor"/></span> Mentorat et entraide entre générations</li>
      <li><span class="sc-ico"><${Icon} name="chart"/></span> Suivi de chaque promo, de la 3A au premier emploi</li>
    </ul>
    <p class="small muted center"><a href="#confidentialite">Confidentialité</a></p>
    </div>
  </div>`;
}

function Onboarding({ store, relang }) {
  const act = async fn => { try { await fn(); } catch (e) { toast(e.message, 'err'); } };
  const ctx = { store, act };
  return html`<div class="auth"><div class="auth-lang"><${LangToggle} onChange=${relang}/></div><div class="auth-card wide">
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
