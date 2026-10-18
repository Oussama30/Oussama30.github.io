// Règles métier : saisons, niveaux, objectifs, points d'impact, badges, statistiques.

export const FILIERES = [
  'Génie Mécanique', 'Génie Industriel', 'Génie Électromécanique', 'Génie Civil',
  'Génie Énergétique', 'Génie Informatique & IA', 'Mécatronique',
];

export const TYPES = {
  stage: { label: 'Stage', long: 'Stage (3A / 4A)' },
  pfe: { label: 'PFE', long: 'Projet de fin d’études' },
  etranger: { label: 'Stage à l’étranger', long: 'Stage à l’étranger' },
  emploi: { label: 'Emploi', long: 'Emploi (CDI, CDD, VIE…)' },
};

export const NIVEAUX = {
  1: { short: '1A', label: '1re année (cycle prépa)' },
  2: { short: '2A', label: '2e année (cycle prépa)' },
  3: { short: '3A', label: '3e année' },
  4: { short: '4A', label: '4e année' },
  5: { short: '5A', label: '5e année' },
  6: { short: 'Diplômé', label: 'Jeune diplômé' },
  7: { short: 'Lauréat', label: 'Lauréat' },
};

export const CATEGORIES_Q = ['PFE', 'Stage', 'Étranger & visas', 'CV & entretiens', 'Premier emploi', 'Vie à l’école'];

// Une saison = une année universitaire, de septembre à août. 2026 = « 2026-2027 ».
export function seasonOf(d = new Date()) { return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; }
export const seasonLabel = s => `${s}-${s + 1}`;

// Niveau d'un membre pendant une saison, calculé depuis sa promo (année de diplôme).
export function niveauOf(p, saison) {
  if (!p || !p.promo) return 7;
  const n = 5 - (p.promo - (saison + 1));
  if (n <= 0) return 1;
  if (n <= 5) return n;
  return p.promo === saison ? 6 : 7;
}

// Objectif de chaque niveau pour la saison, avec son échéance.
export const OBJECTIFS = {
  3: { titre: 'Stage de fin de 3e année', court: 'Stage', types: ['stage', 'etranger'], start: s => new Date(s, 8, 1), deadline: s => new Date(s + 1, 5, 30) },
  4: { titre: 'Stage de fin de 4e année', court: 'Stage', types: ['stage', 'etranger'], start: s => new Date(s, 8, 1), deadline: s => new Date(s + 1, 5, 30) },
  5: { titre: 'PFE ou stage à l’étranger', court: 'PFE / étranger', types: ['pfe', 'etranger'], start: s => new Date(s, 8, 1), deadline: s => new Date(s + 1, 1, 15) },
  6: { titre: 'Premier emploi', court: 'Emploi', types: ['emploi'], start: s => new Date(s, 6, 1), deadline: s => new Date(s + 1, 2, 31) },
};

export function typeForNiveau(n) { return n === 6 || n === 7 ? 'emploi' : n === 5 ? 'pfe' : 'stage'; }

export const FOUND = new Set(['declare', 'confirme']);

export function placementOf(data, uid, saison) {
  return data.placements.find(p => p.student_id === uid && p.saison === saison && p.status !== 'refuse');
}

// Statut de recherche d'un étudiant pour la saison
export function statutOf(data, p, saison) {
  const pl = placementOf(data, p.id, saison);
  if (pl && FOUND.has(pl.status)) return { key: 'trouve', label: 'Trouvé', pl };
  if (pl && pl.status === 'en_attente') return { key: 'validation', label: 'À confirmer', pl };
  const apps = data.applications.filter(a => a.student_id === p.id);
  if (apps.some(a => a.status === 'entretien')) return { key: 'entretiens', label: 'Entretiens en cours' };
  if (apps.length) return { key: 'candidatures', label: 'Candidatures envoyées' };
  return { key: 'recherche', label: 'En recherche' };
}

// ---------------------------------------------------------------------------
// Tableau de bord
// ---------------------------------------------------------------------------
export function seasonStats(data, saison, now = new Date()) {
  const members = data.profiles.filter(p => p.role !== 'admin');
  const rows = [3, 4, 5, 6].map(n => {
    const pop = members.filter(p => niveauOf(p, saison) === n);
    const pls = pop.map(p => placementOf(data, p.id, saison)).filter(Boolean);
    const found = pls.filter(pl => FOUND.has(pl.status));
    const pending = pls.filter(pl => pl.status === 'en_attente');
    const via = found.filter(pl => pl.source === 'plateforme');
    const o = OBJECTIFS[n];
    const start = o.start(saison), end = o.deadline(saison);
    const elapsed = Math.max(0, Math.min(1, (now - start) / (end - start)));
    const daysLeft = Math.ceil((end - now) / 864e5);
    const rate = pop.length ? found.length / pop.length : 0;
    const byFiliere = FILIERES.map(f => {
      const fp = pop.filter(p => p.filiere === f);
      const ff = fp.filter(p => found.some(pl => pl.student_id === p.id));
      return { filiere: f, total: fp.length, found: ff.length };
    }).filter(x => x.total > 0);
    const searching = pop.filter(p => !pls.some(pl => pl.student_id === p.id && (FOUND.has(pl.status) || pl.status === 'en_attente')));
    return { n, objectif: o, total: pop.length, found: found.length, pending: pending.length, via: via.length, rate, elapsed, daysLeft, end, byFiliere, searching, foundList: found };
  });
  const sPl = data.placements.filter(p => p.saison === saison && FOUND.has(p.status));
  const countries = tally(sPl.filter(p => (p.pays || 'Maroc') !== 'Maroc').map(p => p.pays));
  const companies = tally(sPl.map(p => p.entreprise));
  return { rows, countries, companies, totalFound: sPl.length, viaTotal: sPl.filter(p => p.source === 'plateforme').length };
}

export function monthlyActivity(data, months = 6, now = new Date()) {
  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const e = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const inM = r => { const t = new Date(r.created_at); return t >= d && t < e; };
    out.push({
      label: d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''),
      offres: data.offers.filter(inM).length,
      placements: data.placements.filter(p => p.status === 'confirme' && p.confirmed_at && (t => t >= d && t < e)(new Date(p.confirmed_at))).length,
    });
  }
  return out;
}

function tally(arr) {
  const m = new Map(); for (const x of arr) if (x) m.set(x, (m.get(x) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

// ---------------------------------------------------------------------------
// Points d'impact et badges : ce qui donne envie aux lauréats de revenir
// ---------------------------------------------------------------------------
export const BAREME = [
  ['Offre publiée', 10],
  ['Candidature reçue sur une offre', 2],
  ['Commentaire utile', 1],
  ['Étudiant recruté (confirmé par l’étudiant)', 50],
  ['Bonus stage ou emploi à l’étranger', 25],
  ['Mentorat accepté', 10],
  ['Mentorat terminé', 20],
  ['Message de remerciement reçu', 10],
  ['Réponse dans l’Entraide', 5],
  ['Meilleure réponse choisie', 15],
  ['Vote reçu sur une réponse', 2],
  ['Réussite enregistrée (étudiant)', 10],
];

export const NIVEAUX_IMPACT = [
  { min: 0, nom: 'Membre' },
  { min: 60, nom: 'Bronze' },
  { min: 150, nom: 'Argent' },
  { min: 300, nom: 'Or' },
  { min: 600, nom: 'Platine' },
  { min: 1000, nom: 'Légende ENSAM' },
];

export function levelOf(points) {
  let i = 0; for (let k = 0; k < NIVEAUX_IMPACT.length; k++) if (points >= NIVEAUX_IMPACT[k].min) i = k;
  const cur = NIVEAUX_IMPACT[i], next = NIVEAUX_IMPACT[i + 1];
  return { ...cur, idx: i, next, progress: next ? (points - cur.min) / (next.min - cur.min) : 1 };
}

// Retourne une Map id -> { points, events[], stats } ; `since` limite aux événements récents.
export function computeScores(data, since = null) {
  const S = new Map();
  const get = id => { if (!S.has(id)) S.set(id, { points: 0, events: [], offres: 0, recrutes: 0, etranger: 0, mentorats: 0, mercis: 0, reponses: 0, meilleures: 0, candidatures: 0 }); return S.get(id); };
  const add = (id, pts, label, at) => {
    if (!id) return; if (since && new Date(at) < since) return;
    const s = get(id); s.points += pts; s.events.push({ pts, label, at });
  };
  const offerAuthor = new Map(data.offers.map(o => [o.id, o.author_id]));
  for (const o of data.offers) { add(o.author_id, 10, `Offre publiée : ${o.titre}`, o.created_at); get(o.author_id).offres++; }
  for (const ap of data.applications) if (ap.offer_id) { const a = offerAuthor.get(ap.offer_id); if (a && a !== ap.student_id) { add(a, 2, 'Candidature reçue', ap.created_at); get(a).candidatures++; } }
  for (const c of data.comments) add(c.author_id, 1, 'Commentaire', c.created_at);
  for (const p of data.placements) {
    if (FOUND.has(p.status)) add(p.student_id, 10, 'Réussite enregistrée', p.created_at);
    if (p.status === 'confirme' && p.laureat_id) {
      const at = p.confirmed_at || p.created_at;
      add(p.laureat_id, 50, `Étudiant recruté chez ${p.entreprise}`, at); get(p.laureat_id).recrutes++;
      if (p.type === 'etranger' || (p.pays && p.pays !== 'Maroc')) { add(p.laureat_id, 25, `Bonus international (${p.pays})`, at); get(p.laureat_id).etranger++; }
      if (p.merci) { add(p.laureat_id, 10, 'Message de remerciement', at); get(p.laureat_id).mercis++; }
    }
  }
  for (const m of data.mentorships) {
    if (m.status === 'acceptee' || m.status === 'terminee') add(m.mentor_id, 10, `Mentorat accepté : ${m.sujet}`, m.created_at);
    if (m.status === 'terminee') { add(m.mentor_id, 20, `Mentorat terminé : ${m.sujet}`, m.created_at); get(m.mentor_id).mentorats++; }
    if (m.merci) { add(m.mentor_id, 10, 'Message de remerciement', m.created_at); get(m.mentor_id).mercis++; }
  }
  const ansAuthor = new Map(data.answers.map(a => [a.id, a.author_id]));
  for (const a of data.answers) { add(a.author_id, 5, 'Réponse dans l’Entraide', a.created_at); get(a.author_id).reponses++; }
  for (const q of data.questions) if (q.best_answer_id && ansAuthor.get(q.best_answer_id)) { const a = ansAuthor.get(q.best_answer_id); add(a, 15, 'Meilleure réponse', q.created_at); get(a).meilleures++; }
  for (const v of data.votes) { const a = ansAuthor.get(v.answer_id); if (a && a !== v.user_id) add(a, 2, 'Vote sur ta réponse', v.created_at); }
  return S;
}

export const BADGES = [
  { id: 'verifie', nom: 'Lauréat vérifié', desc: 'Profil vérifié par l’école', test: (s, p) => p.role === 'laureat' && p.verified },
  { id: 'premier', nom: 'Premier coup de pouce', desc: 'A publié une première offre', test: s => s.offres >= 1 },
  { id: 'recruteur', nom: 'Recruteur', desc: '3 étudiants recrutés grâce à ses offres', test: s => s.recrutes >= 3 },
  { id: 'faiseur', nom: 'Faiseur de carrières', desc: '10 étudiants recrutés', test: s => s.recrutes >= 10 },
  { id: 'passeport', nom: 'Passeport', desc: 'A ouvert une porte à l’étranger', test: s => s.etranger >= 1 },
  { id: 'mentor', nom: 'Mentor', desc: '3 mentorats terminés', test: s => s.mentorats >= 3 },
  { id: 'sage', nom: 'Sage de l’entraide', desc: '3 meilleures réponses', test: s => s.meilleures >= 3 },
  { id: 'aime', nom: 'Aimé de la promo', desc: '5 messages de remerciement', test: s => s.mercis >= 5 },
];

export function badgesOf(score, profile) {
  const s = score || { offres: 0, recrutes: 0, etranger: 0, mentorats: 0, meilleures: 0, mercis: 0 };
  return BADGES.filter(b => b.test(s, profile || {}));
}

// ---------------------------------------------------------------------------
// Petits utilitaires d'affichage
// ---------------------------------------------------------------------------
export function timeAgo(iso, now = new Date()) {
  const s = Math.round((now - new Date(iso)) / 1000);
  if (s < 60) return 'à l’instant';
  const m = Math.round(s / 60); if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24); if (d < 30) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}
export const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '';
export function daysUntil(dateStr, now = new Date()) { if (!dateStr) return null; return Math.ceil((new Date(dateStr + 'T23:59:59') - now) / 864e5); }
export const initials = name => (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
export const pct = x => `${Math.round(x * 100)}\u202f%`;
