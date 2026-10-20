// Confidentialité (loi 09-08) : page publique, accord des anciens membres, « Mes données », désabonnement.
import { html, useState, useEffect } from './vendor/preact-htm.js';
import { Icon, Modal, BrandLogo, toast } from './ui.js';
import { PushToggle } from './pwa.js';

const cfg = () => (typeof window !== 'undefined' && window.ENSAM_CONFIG) || {};

// Le texte est court et concret : ce qui est collecté, pourquoi, qui le voit, où il est stocké, combien de temps, les droits.
const SECTIONS = [
  ['user', 'Ce que nous collectons', [
    'Ton compte : ton email et ton mot de passe (chiffré, jamais visible, même par l’administration).',
    'Ton profil : nom, rôle, filière, promo, et si tu les remplis : entreprise, poste, secteur, ville, pays, bio, compétences, LinkedIn, contact, lien de CV, disponibilité.',
    'Ce que tu fais sur la plateforme : offres, candidatures, rendez-vous de mentorat, questions et réponses, mercis, messages de groupe, cafés.',
    'Si tu les actives : l’adresse technique de ton téléphone pour les notifications, et ta langue préférée pour les emails.',
  ]],
  ['spark', 'Pourquoi', [
    'Mettre en relation les étudiants et les lauréats de l’ENSAM Meknès : offres, mentorat, entraide.',
    'Te proposer ce qui te correspond (ton année, ta filière, ta ville).',
    'Suivre chaque promo jusqu’au premier emploi, avec des chiffres globaux par promo et par filière.',
    'T’envoyer les emails utiles : rendez-vous, et un résumé par semaine si tu le gardes activé.',
  ]],
  ['people', 'Qui voit quoi', [
    'Ton profil est visible par les membres connectés, jamais par le public ni par les moteurs de recherche.',
    'Une candidature n’est visible que par toi et par le lauréat qui a publié l’offre.',
    'Un étudiant ne voit que les offres de son année ; les offres entre lauréats ne sont pas visibles par les étudiants.',
    'L’administration voit les emails des comptes, seulement pour vérifier les lauréats et aider en cas de problème.',
    'Une attestation de lauréat peut être vérifiée par un lien que son titulaire choisit de partager.',
  ]],
  ['shield', 'Ce que nous ne faisons pas', [
    'Aucune vente ni location de données, aucune publicité, aucun traceur publicitaire.',
    'Le navigateur garde seulement ta langue et tes préférences d’affichage.',
  ]],
  ['globe', 'Où sont les données', [
    'Base de données et comptes : Supabase, serveurs à Paris (Union européenne).',
    'Site : GitHub Pages. Emails : Brevo (Union européenne). Visio : Jitsi Meet, quand tu rejoins un rendez-vous.',
    'Carte : fonds OpenStreetMap et CARTO. Polices : Google Fonts. Notifications du téléphone : le service de ton navigateur (Google, Apple ou Mozilla), seulement si tu les actives.',
  ]],
  ['clock', 'Combien de temps', [
    'Tant que ton compte existe. Quand tu le supprimes, ton profil et tout ce qui t’est lié sont effacés tout de suite. Seuls restent des chiffres globaux sans nom.',
    'Les notifications en attente sont effacées dès leur envoi.',
  ]],
  ['check', 'Tes droits (loi 09-08)', [
    'Accès : télécharge toutes tes données depuis « Mon profil ».',
    'Rectification : modifie ton profil à tout moment.',
    'Opposition : désactive les emails ou les notifications en un clic.',
    'Suppression : supprime ton compte depuis « Mon profil », sans rien demander à personne.',
    'Tu peux aussi saisir la CNDP (Commission nationale de contrôle de la protection des données à caractère personnel) : cndp.ma.',
  ]],
];

export function PrivacyPage({ onBack }) {
  const c = cfg();
  return html`<section class="page narrow privacy">
    <header class="page-head"><div class="row"><${BrandLogo} size=${44}/><div><p class="eyebrow">Réseau ENSAM Meknès</p><h1>Confidentialité</h1></div></div>
      ${onBack ? html`<button class="btn ghost" onClick=${onBack}>← Retour</button>` : null}</header>
    <p class="lead">Cette plateforme est faite par et pour la communauté de l’ENSAM Meknès. Tes données servent à une seule chose : t’aider à trouver ou à aider.</p>
    ${SECTIONS.map(([ic, h, items]) => html`<div class="panel priv-sec"><h2 class="h-ico"><${Icon} name=${ic}/> ${h}</h2><ul>${items.map(t => html`<li>${t}</li>`)}</ul></div>`)}
    <div class="panel priv-sec"><h2 class="h-ico"><${Icon} name="inbox"/> Contact</h2>
      <p>Responsable du traitement : l’équipe qui administre le Réseau ENSAM Meknès.</p>
      ${c.contactEmail ? html`<p>Pour toute question sur tes données : <a href=${'mailto:' + c.contactEmail} dir="ltr" translate="no">${c.contactEmail}</a></p>` : html`<p>Pour toute question sur tes données, écris à l’administration depuis la plateforme (Entraide ou profil d’un administrateur).</p>`}
      ${c.cndp ? html`<p class="small muted">Déclaration CNDP : <span dir="ltr" translate="no">${c.cndp}</span></p>` : null}
    </div>
    <p class="small muted">Dernière mise à jour : octobre 2026.</p>
  </section>`;
}

// Les membres inscrits avant cette page donnent leur accord une fois (mode réel uniquement).
export function ConsentModal({ ctx }) {
  const { me, store, act, go } = ctx;
  const [ok, setOk] = useState(false);
  const [mails, setMails] = useState(me.emails_hebdo !== false);
  return html`<div class="modal-back consent-back"><div class="modal" role="dialog" aria-modal="true" aria-label="Tes données">
    <header class="modal-head"><h2>Tes données, en clair</h2></header>
    <div class="modal-body form">
      <p>Nous avons écrit une page « Confidentialité » : ce que la plateforme garde sur toi, qui le voit, et comment tout supprimer. Lis-la et donne ton accord pour continuer.</p>
      <button class="linkish" onClick=${() => go('confidentialite')}><${Icon} name="shield" size=${15}/> Lire la page Confidentialité</button>
      <label class="check"><input id="cs-ok" type="checkbox" checked=${ok} onChange=${e => setOk(e.target.checked)}/> J’ai lu la page Confidentialité et j’accepte que mes données servent au réseau.</label>
      <label class="check"><input id="cs-mail" type="checkbox" checked=${mails} onChange=${e => setMails(e.target.checked)}/> Recevoir un résumé par email chaque semaine</label>
      <div class="row-end"><button class="btn ghost" onClick=${() => go('profil')}>Supprimer mon compte</button>
        <button class="btn primary" disabled=${!ok} onClick=${() => act(async () => { await store.update('profiles', me.id, { consent_at: new Date().toISOString(), emails_hebdo: mails }); toast('Merci, c’est enregistré.'); })}>Continuer</button></div>
    </div>
  </div></div>`;
}

// « Mes données » dans Mon profil : emails, notifications, téléchargement, suppression
export function MesDonnees({ ctx }) {
  const { me, store, act, go, data } = ctx;
  const [del, setDel] = useState(false);
  const exportData = () => {
    const mine = {};
    const owner = { offers: ['author_id'], comments: ['author_id'], reactions: ['user_id'], applications: ['student_id'], placements: ['student_id', 'laureat_id'], mentorships: ['student_id', 'mentor_id'], questions: ['author_id'], answers: ['author_id'], votes: ['user_id'], shortlists: ['laureat_id', 'student_id'], invitations: ['laureat_id', 'student_id'], kudos: ['user_id'], attestations: ['laureat_id'], groupe_messages: ['author_id'], groupe_membres: ['user_id'], cafes: ['organisateur_id'], cafe_participants: ['user_id'], startups: ['fondateur_id'], parrainages: ['filleul_id', 'parrain_id'] };
    for (const [t, cols] of Object.entries(owner)) mine[t] = (data[t] || []).filter(r => cols.some(c => r[c] === me.id));
    const out = { exporte_le: new Date().toISOString(), plateforme: 'Réseau ENSAM Meknès', email: store.session?.user?.email || null, profil: me, ...mine };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
    a.download = 'mes-donnees-reseau-ensam.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  return html`<div class="panel" id="mes-donnees">
    <div class="section-head"><h2 class="h-ico"><${Icon} name="shield"/> Mes données et notifications</h2><button class="btn tiny ghost" onClick=${() => go('confidentialite')}>Confidentialité <${Icon} name="arrow" size=${14}/></button></div>
    <label class="check"><input id="md-mail" type="checkbox" checked=${me.emails_hebdo !== false} onChange=${e => act(async () => { await store.update('profiles', me.id, { emails_hebdo: e.target.checked }); toast(e.target.checked ? 'Tu recevras un résumé chaque semaine.' : 'Plus de résumé par email.'); })}/> Recevoir un résumé par email chaque semaine</label>
    <${PushToggle} ctx=${ctx}/>
    <div class="row">
      <button class="btn small" onClick=${exportData}><${Icon} name="download" size=${15}/> Télécharger mes données</button>
      <span class="spacer"></span>
      <button class="btn small ghost danger-t" onClick=${() => setDel(true)}><${Icon} name="trash" size=${15}/> Supprimer mon compte</button>
    </div>
    ${del ? html`<${DeleteAccount} ctx=${ctx} onClose=${() => setDel(false)}/>` : null}
  </div>`;
}

function DeleteAccount({ ctx, onClose }) {
  const { store, act } = ctx;
  const [txt, setTxt] = useState('');
  const word = 'SUPPRIMER';
  return html`<${Modal} title="Supprimer mon compte" onClose=${onClose}>
    <div class="form">
      <p>Ton profil, tes offres, tes candidatures, tes messages et tes rendez-vous seront effacés tout de suite. Cette action est définitive.</p>
      <p class="small muted">Tu peux d’abord télécharger tes données.</p>
      <label class="field"><span class="field-label">Écris SUPPRIMER pour confirmer</span><input id="del-txt" value=${txt} onInput=${e => setTxt(e.target.value)} autocomplete="off" dir="ltr"/></label>
      <div class="row-end"><button class="btn ghost" onClick=${onClose}>Annuler</button>
        <button class="btn danger" disabled=${txt.trim().toUpperCase() !== word} onClick=${() => act(async () => { await store.supprimerCompte(); onClose(); toast('Ton compte a été supprimé. Au revoir et bonne route !'); })}>Supprimer définitivement</button></div>
    </div>
  <//>`;
}

// Lien « Se désabonner » des emails : page publique, un bouton, sans connexion
export function DesaboPage({ store, token }) {
  const [state, setState] = useState('ask'); // ask | busy | ok | ko
  useEffect(() => { if (!token) setState('ko'); }, [token]);
  const go = async () => { setState('busy'); setState(await store.seDesabonner(token) ? 'ok' : 'ko'); };
  return html`<div class="auth-card desabo">
    <${BrandLogo} size=${52}/>
    <h1>Résumé par email</h1>
    ${state === 'ask' || state === 'busy' ? html`<p>Tu ne veux plus recevoir le résumé de la semaine ?</p>
      <button class="btn primary" disabled=${state === 'busy'} onClick=${go}>${state === 'busy' ? '…' : 'Me désabonner'}</button>` : null}
    ${state === 'ok' ? html`<p class="verify-ok"><${Icon} name="check"/> C’est fait : tu ne recevras plus le résumé par email.</p><p class="small muted">Tu peux le réactiver à tout moment dans « Mon profil ».</p>` : null}
    ${state === 'ko' ? html`<p class="verify-ko">Ce lien n’est plus valable. Connecte-toi et désactive le résumé dans « Mon profil ».</p>` : null}
    <a class="btn ghost" href="#accueil">Aller sur la plateforme</a>
  </div>`;
}
