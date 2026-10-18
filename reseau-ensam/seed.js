// Données de démonstration (personnes et entreprises fictives) pour essayer la plateforme.
import { FILIERES, seasonOf } from './logic.js';

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const PRENOMS = ['Salma', 'Youssef', 'Imane', 'Hamza', 'Khadija', 'Anas', 'Meryem', 'Othmane', 'Hiba', 'Ayoub', 'Zineb', 'Mehdi', 'Nour', 'Ilyas', 'Kawtar', 'Amine', 'Sara', 'Reda', 'Chaimae', 'Bilal', 'Ghita', 'Adam', 'Yasmine', 'Soufiane', 'Fatima Zahra', 'Hatim', 'Douae', 'Ismail', 'Rania', 'Zakaria', 'Oumaima', 'Achraf', 'Wiam', 'Taha', 'Asmae', 'Nabil', 'Lina', 'Marouane', 'Hajar', 'Karim'];
const NOMS = ['Bennani', 'El Amrani', 'Alaoui', 'Tazi', 'Berrada', 'Idrissi', 'Chraibi', 'Lahlou', 'Fassi', 'Benjelloun', 'Ouazzani', 'Kettani', 'Sebti', 'Moussaoui', 'Bouzidi', 'Hajji', 'Naciri', 'Zerouali', 'Amrani', 'Belkadi', 'Skalli', 'Rahmouni', 'Lamrani', 'Cherkaoui', 'Bakkali', 'El Khattabi', 'Squalli', 'Mernissi', 'Tahiri', 'Ziani'];
const VILLES_MA = ['Casablanca', 'Tanger', 'Kénitra', 'Rabat', 'Meknès', 'Fès', 'Marrakech', 'Agadir', 'Jorf Lasfar', 'Mohammedia'];

const ENTREPRISES = [
  { nom: 'Renault Group Maroc', ville: 'Tanger', pays: 'Maroc', fil: ['Génie Mécanique', 'Génie Industriel'] },
  { nom: 'Stellantis Kénitra', ville: 'Kénitra', pays: 'Maroc', fil: ['Génie Industriel', 'Mécatronique'] },
  { nom: 'OCP Group', ville: 'Jorf Lasfar', pays: 'Maroc', fil: ['Génie Électromécanique', 'Génie Énergétique'] },
  { nom: 'Safran Nacelles', ville: 'Casablanca', pays: 'Maroc', fil: ['Génie Mécanique'] },
  { nom: 'Lear Corporation', ville: 'Kénitra', pays: 'Maroc', fil: ['Génie Industriel'] },
  { nom: 'Siemens Gamesa', ville: 'Tanger', pays: 'Maroc', fil: ['Génie Énergétique', 'Génie Mécanique'] },
  { nom: 'Capgemini Engineering', ville: 'Casablanca', pays: 'Maroc', fil: ['Génie Informatique & IA', 'Mécatronique'] },
  { nom: 'ONEE', ville: 'Rabat', pays: 'Maroc', fil: ['Génie Électromécanique', 'Génie Énergétique'] },
  { nom: 'LafargeHolcim Maroc', ville: 'Meknès', pays: 'Maroc', fil: ['Génie Civil', 'Génie Industriel'] },
  { nom: 'Yazaki Morocco', ville: 'Meknès', pays: 'Maroc', fil: ['Génie Industriel'] },
  { nom: 'Spirit AeroSystems', ville: 'Casablanca', pays: 'Maroc', fil: ['Génie Mécanique', 'Génie Industriel'] },
  { nom: 'TGCC', ville: 'Casablanca', pays: 'Maroc', fil: ['Génie Civil'] },
  { nom: 'Airbus Operations', ville: 'Toulouse', pays: 'France', fil: ['Génie Mécanique'] },
  { nom: 'Valeo', ville: 'Créteil', pays: 'France', fil: ['Mécatronique', 'Génie Électromécanique'] },
  { nom: 'Bosch', ville: 'Stuttgart', pays: 'Allemagne', fil: ['Mécatronique', 'Génie Informatique & IA'] },
  { nom: 'Hydro-Québec', ville: 'Montréal', pays: 'Canada', fil: ['Génie Énergétique', 'Génie Électromécanique'] },
  { nom: 'Schneider Electric', ville: 'Grenoble', pays: 'France', fil: ['Génie Électromécanique'] },
  { nom: 'Vinci Construction', ville: 'Nanterre', pays: 'France', fil: ['Génie Civil'] },
];

export function buildSeed(now = new Date()) {
  const r = rng(20261018);
  const pick = a => a[Math.floor(r() * a.length)];
  const S = seasonOf(now);
  const daysAgo = (d, h = 10) => new Date(now.getTime() - d * 864e5 - h * 36e5).toISOString();
  const seasonDate = (s, frac) => new Date(new Date(s, 8, 1).getTime() + frac * 300 * 864e5).toISOString();
  let n = 0; const id = p => `${p}-${(++n).toString(36).padStart(4, '0')}`;
  const used = new Set();
  const name = () => { for (;;) { const x = `${pick(PRENOMS)} ${pick(NOMS)}`; if (!used.has(x)) { used.add(x); return x; } } };

  const profiles = [];
  const mk = (o) => { const p = { id: id('u'), pays: 'Maroc', competences: [], vitrine: true, verified: false, mentor_dispo: false, created_at: daysAgo(40 + Math.floor(r() * 300)), ...o }; used.add(p.full_name); profiles.push(p); return p; };

  // Trois comptes « personas » pour essayer chaque rôle
  const salma = mk({ full_name: 'Salma Bennani', role: 'etudiant', filiere: 'Génie Industriel', promo: S + 1, ville: 'Meknès', bio: 'Passionnée de lean manufacturing et de supply chain. Je cherche un PFE en excellence opérationnelle, idéalement à l’étranger.', competences: ['Lean', 'VSM', 'Python', 'Power BI', 'SolidWorks'], linkedin: 'linkedin.com/in/salma-bennani', _persona: 'Étudiante 5A' });
  const youssef = mk({ full_name: 'Youssef El Amrani', role: 'laureat', filiere: 'Génie Mécanique', promo: 2016, entreprise: 'Renault Group Maroc', poste: 'Responsable méthodes emboutissage', ville: 'Tanger', verified: true, mentor_dispo: true, mentor_sujets: 'Industrie automobile, méthodes, préparer un entretien technique', bio: 'Promo 2016. 10 ans dans l’automobile entre Tanger et Flins. Je réponds toujours aux étudiants de l’école.', competences: ['Emboutissage', 'Méthodes', 'Lean', 'Management'], linkedin: 'linkedin.com/in/youssef-elamrani', _persona: 'Lauréat' });
  const admin = mk({ full_name: 'Bureau des relations entreprises', role: 'admin', filiere: 'Génie Industriel', promo: 2010, entreprise: 'ENSAM Meknès', poste: 'Administration', ville: 'Meknès', verified: true, _persona: 'Admin école' });

  // Étudiants de la saison en cours
  const students = [salma];
  const counts = { [S + 1]: 21, [S + 2]: 18, [S + 3]: 17 };
  for (const promo of Object.keys(counts).map(Number)) for (let i = 0; i < counts[promo]; i++) {
    students.push(mk({ full_name: name(), role: 'etudiant', filiere: pick(FILIERES), promo, ville: pick(VILLES_MA), competences: [] }));
  }
  // Jeunes diplômés (promo S) et promo précédente
  const jeunes = []; for (let i = 0; i < 16; i++) jeunes.push(mk({ full_name: name(), role: 'laureat', filiere: pick(FILIERES), promo: S, ville: pick(VILLES_MA), verified: r() > 0.3 }));
  const precedents = []; for (let i = 0; i < 7; i++) precedents.push(mk({ full_name: name(), role: 'laureat', filiere: pick(FILIERES), promo: S - 1, verified: true }));

  // Lauréats expérimentés
  const postes = ['Ingénieur méthodes', 'Responsable qualité', 'Chef de projet', 'Ingénieur R&D', 'Responsable maintenance', 'Plant manager', 'Data engineer', 'Ingénieur structures', 'Consultant supply chain', 'Ingénieure procédés'];
  const seniors = [youssef];
  for (let i = 0; i < 17; i++) {
    const e = pick(ENTREPRISES);
    seniors.push(mk({ full_name: name(), role: 'laureat', filiere: pick(e.fil), promo: 2008 + Math.floor(r() * 15), entreprise: e.nom, poste: pick(postes), ville: e.ville, pays: e.pays, verified: r() > 0.15, mentor_dispo: r() > 0.45, mentor_sujets: pick(['Stages à l’étranger, Campus France, VIE', 'CV, entretiens, négociation de salaire', 'Lean, qualité, industrie', 'Data, IA, reconversion', 'Génie civil, chantiers, BET', 'Énergies renouvelables']), competences: [] }));
  }
  // Les postes des jeunes diplômés déjà en emploi sont remplis plus bas.

  // ---------------- Offres ----------------
  const offers = [];
  const OFFRES = [
    ['pfe', 'PFE : réduction des rebuts sur ligne d’emboutissage', 'Renault Group Maroc', ['Génie Mécanique', 'Génie Industriel'], [5], 'Sujet de PFE de 6 mois en équipe méthodes. Analyse des causes (Ishikawa, AMDEC), plan d’action et suivi des indicateurs. Je coopte directement les profils motivés.', 9, youssef],
    ['stage', 'Stage ingénieur adjoint : amélioration continue', 'Yazaki Morocco', ['Génie Industriel'], [4], 'Stage de 2 mois cet été. Chantiers 5S, SMED et suivi TRS sur les lignes de câblage.', 32],
    ['etranger', 'Stage 6 mois : aérostructures (Toulouse)', 'Airbus Operations', ['Génie Mécanique'], [5], 'Stage en bureau d’études, calcul de structures composites. Niveau B2 en français et anglais exigé. Gratification + aide au logement.', 21],
    ['emploi', 'Ingénieur maintenance (CDI) – jeune diplômé accepté', 'OCP Group', ['Génie Électromécanique', 'Génie Énergétique'], [6], 'Poste basé à Jorf Lasfar. Maintenance préventive et conditionnelle des unités de production. Je peux transmettre vos CV en interne.', 18],
    ['stage', 'Stage ouvrier / technique sur chantier', 'TGCC', ['Génie Civil'], [3], 'Stage de 1 mois sur un chantier à Casablanca. Découverte de l’organisation de chantier et du suivi de gros œuvre.', 40],
    ['pfe', 'PFE data : maintenance prédictive par machine learning', 'Capgemini Engineering', ['Génie Informatique & IA', 'Mécatronique', 'Génie Électromécanique'], [5], 'Modèles de prédiction de pannes à partir de données capteurs. Python, scikit-learn, notions de vibratoire appréciées.', 25],
    ['etranger', 'Stage de recherche : stockage d’énergie', 'Hydro-Québec', ['Génie Énergétique', 'Génie Électromécanique'], [4, 5], 'Stage de 4 à 6 mois à Montréal au centre de recherche. Visa étudiant à prévoir, je peux vous guider sur la procédure.', 35],
    ['emploi', 'VIE ingénieur qualité fournisseurs (Allemagne)', 'Bosch', ['Mécatronique', 'Génie Industriel'], [6], 'VIE de 18 mois à Stuttgart. Allemand apprécié, anglais courant indispensable.', 29],
    ['stage', 'Stage d’été maintenance éolienne', 'Siemens Gamesa', ['Génie Énergétique', 'Génie Mécanique'], [3, 4], 'Stage de 6 à 8 semaines à l’usine de pales de Tanger. Sécurité, maintenance, contrôle qualité.', 12],
    ['pfe', 'PFE : optimisation énergétique d’un four rotatif', 'LafargeHolcim Maroc', ['Génie Énergétique', 'Génie Industriel'], [5], 'Bilan énergétique, pistes de valorisation de la chaleur perdue, étude technico-économique. Usine de Meknès.', 15],
    ['emploi', 'Ingénieur structures junior (CDI)', 'Vinci Construction', ['Génie Civil'], [6], 'Bureau d’études à Nanterre, dimensionnement béton armé et charpente. Ouvert aux jeunes diplômés avec un PFE en structures.', 44],
    ['stage', 'Stage 4A : supply chain et planification', 'Lear Corporation', ['Génie Industriel'], [4], 'Stage de 2 mois, planification de production et gestion des flux. Excel avancé demandé.', 50],
    ['etranger', 'Stage 4A en électrification (Grenoble)', 'Schneider Electric', ['Génie Électromécanique'], [4], 'Stage de 3 mois sur la qualification de tableaux électriques. Démarches Campus France à anticiper dès janvier.', 22],
    ['pfe', 'PFE : jumeau numérique d’une cellule robotisée', 'Stellantis Kénitra', ['Mécatronique', 'Génie Informatique & IA'], [5], 'Modélisation d’une cellule de soudage robotisée et validation virtuelle des cadences.', 6],
    ['emploi', 'Ingénieur méthodes (CDI)', 'Safran Nacelles', ['Génie Mécanique', 'Génie Industriel'], [6], 'Industrialisation de pièces composites. 0 à 3 ans d’expérience.', 4],
    ['stage', 'Stage ouvrier en atelier d’usinage', 'Spirit AeroSystems', ['Génie Mécanique'], [3], 'Découverte de l’usinage aéronautique et du contrôle dimensionnel. 1 mois en juillet.', 2],
    ['pfe', 'PFE : réseau de chaleur et autoconsommation solaire', 'ONEE', ['Génie Énergétique', 'Génie Électromécanique'], [5], 'Dimensionnement d’une installation photovoltaïque pour un site administratif et étude de rentabilité.', 1],
  ];
  const offerAuthors = seniors.filter(s => s.entreprise);
  for (const [type, titre, ent, fil, an, desc, ago, author] of OFFRES) {
    const e = ENTREPRISES.find(x => x.nom === ent);
    const a = author || offerAuthors.find(s => s.entreprise === ent) || pick(offerAuthors);
    const dl = new Date(now.getTime() + (10 + Math.floor(r() * 60)) * 864e5);
    offers.push({ id: id('o'), author_id: a.id, type, titre, entreprise: ent, ville: e.ville, pays: e.pays, filieres: fil, annees: an, description: desc, contact: a.linkedin || 'Message via la plateforme', lien: '', deadline: ago === 1 ? new Date(now.getTime() + 3 * 864e5).toISOString().slice(0, 10) : dl.toISOString().slice(0, 10), cooptation: r() > 0.5 || a === youssef, remunere: type !== 'stage' || r() > 0.5, duree: type === 'pfe' ? '6 mois' : type === 'emploi' ? 'CDI' : type === 'etranger' ? '4 à 6 mois' : '1 à 2 mois', status: ago > 40 ? 'pourvue' : 'ouverte', created_at: daysAgo(ago, Math.floor(r() * 10)) });
  }
  // Historique : offres des mois précédents, déjà pourvues
  const HIST = { stage: 'Stage technique', pfe: 'PFE', etranger: 'Stage international', emploi: 'Ingénieur junior' };
  for (let i = 0; i < 34; i++) {
    const e = pick(ENTREPRISES); const type = e.pays !== 'Maroc' ? pick(['etranger', 'emploi']) : pick(['stage', 'pfe', 'emploi', 'stage']);
    const a = offerAuthors.find(s => s.entreprise === e.nom) || pick(offerAuthors);
    offers.push({ id: id('o'), author_id: a.id, type, titre: `${HIST[type]} – ${e.fil[0]}`, entreprise: e.nom, ville: e.ville, pays: e.pays, filieres: e.fil, annees: type === 'pfe' ? [5] : type === 'emploi' ? [6] : type === 'etranger' ? [4, 5] : [3, 4], description: 'Offre partagée par un lauréat, désormais pourvue.', contact: 'Message via la plateforme', lien: '', deadline: null, cooptation: r() > 0.6, remunere: true, duree: '', status: 'pourvue', created_at: daysAgo(55 + Math.floor(r() * 300)) });
  }
  const offerOf = t => offers.find(o => o.titre.startsWith(t));

  // ---------------- Placements ----------------
  const placements = [];
  const place = (st, o) => { placements.push({ id: id('p'), student_id: st.id, offer_id: null, laureat_id: null, source: 'autre', status: 'declare', pays: 'Maroc', merci: null, note: null, confirmed_at: null, ...o }); };
  const fromOffer = (st, off, saison, niveau, extra = {}) => place(st, { offer_id: off.id, laureat_id: off.author_id, source: 'plateforme', status: 'confirme', saison, niveau, type: off.type, entreprise: off.entreprise, ville: off.ville, pays: off.pays, confirmed_at: daysAgo(Math.floor(r() * 25) + 1), created_at: daysAgo(30), ...extra });
  const MERCIS = ['Merci infiniment pour la cooptation, l’entretien s’est très bien passé grâce à vos conseils.', 'Votre offre est tombée au bon moment. Merci d’avoir pris le temps de relire mon CV !', 'Grâce à vous j’ai décroché mon stage, je ferai pareil pour les promos suivantes.', 'Merci pour votre disponibilité et vos réponses rapides.'];

  const s5 = students.filter(s => s.promo === S + 1 && s !== salma), s4 = students.filter(s => s.promo === S + 2), s3 = students.filter(s => s.promo === S + 3);
  // Saison en cours
  fromOffer(s5[0], offerOf('PFE : réduction'), S, 5, { merci: MERCIS[0], note: 5 });
  fromOffer(s5[1], offerOf('PFE data'), S, 5, { merci: MERCIS[1], note: 5 });
  fromOffer(s5[2], offerOf('Stage 6 mois'), S, 5, { merci: MERCIS[2], note: 4 });
  fromOffer(s5[3], offerOf('PFE : optimisation'), S, 5, {});
  fromOffer(s5[4], offerOf('PFE : réduction'), S, 5, { status: 'en_attente', confirmed_at: null, created_at: daysAgo(1) });
  fromOffer(s5[5], offerOf('PFE : jumeau'), S, 5, { status: 'en_attente', confirmed_at: null, created_at: daysAgo(2) });
  for (let i = 6; i < 10; i++) { const e = pick(ENTREPRISES); place(s5[i], { saison: S, niveau: 5, type: e.pays === 'Maroc' ? 'pfe' : 'etranger', entreprise: e.nom, ville: e.ville, pays: e.pays, created_at: daysAgo(5 + i * 3) }); }
  fromOffer(s4[0], offerOf('Stage d’été'), S, 4, { merci: MERCIS[3], note: 5 });
  place(s4[1], { saison: S, niveau: 4, type: 'stage', entreprise: 'Lear Corporation', ville: 'Kénitra', created_at: daysAgo(9) });
  place(s4[2], { saison: S, niveau: 4, type: 'etranger', entreprise: 'Valeo', ville: 'Créteil', pays: 'France', created_at: daysAgo(4) });
  place(s3[0], { saison: S, niveau: 3, type: 'stage', entreprise: 'TGCC', ville: 'Casablanca', created_at: daysAgo(6) });
  fromOffer(s3[1], offerOf('Stage ouvrier en atelier'), S, 3, { status: 'en_attente', confirmed_at: null, created_at: daysAgo(0) });
  // Jeunes diplômés : premier emploi
  jeunes.forEach((j, i) => {
    if (i >= 11) return;
    const e = pick(ENTREPRISES);
    if (i < 3) {
      const o = [offerOf('Ingénieur maintenance'), offerOf('Ingénieur méthodes'), offerOf('VIE ingénieur')][i];
      fromOffer(j, o, S, 6, { merci: MERCIS[i % 4], note: 5 }); j.entreprise = o.entreprise; j.poste = o.titre.split(' (')[0]; j.ville = o.ville; j.pays = o.pays;
    } else { place(j, { saison: S, niveau: 6, type: 'emploi', entreprise: e.nom, ville: e.ville, pays: e.pays, created_at: daysAgo(20 + i * 4) }); j.entreprise = e.nom; j.poste = pick(postes); j.ville = e.ville; j.pays = e.pays; }
  });
  // Saison précédente (historique complet)
  const P = S - 1;
  const prevPlace = (st, niveau, frac, viaRate = 0.3) => {
    const e = pick(ENTREPRISES);
    const type = niveau === 6 ? 'emploi' : niveau === 5 ? (e.pays === 'Maroc' ? 'pfe' : 'etranger') : (e.pays === 'Maroc' ? 'stage' : 'etranger');
    const old = offers.filter(o => o.status === 'pourvue' && o.entreprise === e.nom);
    const via = old.length > 0 && r() < viaRate; const off = via ? pick(old) : null;
    place(st, { saison: P, niveau, type, entreprise: e.nom, ville: e.ville, pays: e.pays, source: via ? 'plateforme' : 'autre', offer_id: off?.id || null, laureat_id: off?.author_id || null, status: via ? 'confirme' : 'declare', confirmed_at: via ? seasonDate(P, frac + 0.02) : null, merci: via && r() > 0.5 ? pick(MERCIS) : null, created_at: seasonDate(P, frac) });
  };
  jeunes.forEach((j, i) => prevPlace(j, 5, 0.25 + i * 0.012, 0.35));               // ils étaient en 5A
  s5.concat([salma]).forEach((st, i) => { if (st !== salma && i < 19) prevPlace(st, 4, 0.45 + i * 0.015, 0.3); }); // en 4A
  s4.forEach((st, i) => { if (i < 17) prevPlace(st, 3, 0.5 + i * 0.015, 0.2); });  // en 3A
  precedents.forEach((p, i) => { if (i < 6) prevPlace(p, 6, 0.1 + i * 0.05, 0.3); });
  place(salma, { saison: P, niveau: 4, type: 'stage', entreprise: 'Yazaki Morocco', ville: 'Meknès', created_at: seasonDate(P, 0.6) });

  // ---------------- Interactions ----------------
  const comments = [], reactions = [], applications = [], mentorships = [], questions = [], answers = [], votes = [];
  const COMS = [
    ['etudiant', 'Est-ce que l’offre est ouverte aux étudiants en Génie Électromécanique ?'],
    ['laureat', 'Oui, envoyez votre CV avec un mot sur vos projets. Je fais suivre aux RH cette semaine.'],
    ['etudiant', 'Candidature envoyée, merci pour le partage !'],
    ['etudiant', 'Le stage est-il rémunéré ?'],
    ['laureat', 'Gratification prévue + transport. Le processus RH prend environ 3 semaines.'],
    ['laureat', 'Je confirme, très bonne équipe. J’y ai fait mon PFE en 2019.'],
    ['etudiant', 'Combien de profils vous comptez prendre cette année ?'],
    ['laureat', 'Pensez à préparer un niveau B2 certifié, c’est vérifié pour le visa.'],
  ];
  offers.forEach((o, i) => {
    const k = 1 + Math.floor(r() * 4);
    for (let c = 0; c < k; c++) {
      const [role, body] = COMS[(i + c * 3) % COMS.length];
      const author = role === 'laureat' ? (c % 2 ? offers[i] && profiles.find(p => p.id === o.author_id) : pick(seniors)) : pick(students);
      comments.push({ id: id('c'), offer_id: o.id, author_id: author.id, body, created_at: new Date(new Date(o.created_at).getTime() + (c + 1) * 5 * 36e5).toISOString() });
    }
    const nr = 3 + Math.floor(r() * 14);
    const voters = new Set(); for (let v = 0; v < nr; v++) voters.add(pick(students).id);
    for (const uid of voters) reactions.push({ id: id('r'), offer_id: o.id, user_id: uid, kind: 'utile', created_at: o.created_at });
  });
  reactions.push({ id: id('r'), offer_id: offerOf('Stage 6 mois').id, user_id: salma.id, kind: 'save', created_at: daysAgo(3) });
  reactions.push({ id: id('r'), offer_id: offerOf('Stage de recherche').id, user_id: salma.id, kind: 'save', created_at: daysAgo(2) });

  // Candidatures de Salma (persona) + d'autres
  applications.push({ id: id('a'), student_id: salma.id, offer_id: offerOf('PFE : réduction').id, entreprise: 'Renault Group Maroc', titre: 'PFE réduction des rebuts', status: 'entretien', note: 'Entretien technique jeudi 10h avec le service méthodes', created_at: daysAgo(6), updated_at: daysAgo(1) });
  applications.push({ id: id('a'), student_id: salma.id, offer_id: offerOf('Stage 6 mois').id, entreprise: 'Airbus Operations', titre: 'Stage aérostructures', status: 'postule', note: '', created_at: daysAgo(4), updated_at: daysAgo(4) });
  applications.push({ id: id('a'), student_id: salma.id, offer_id: null, entreprise: 'Decathlon (candidature spontanée)', titre: 'PFE supply chain', status: 'refuse', note: 'Profil plus logistique recherché', created_at: daysAgo(15), updated_at: daysAgo(8) });
  s5.slice(10, 16).forEach((st, i) => applications.push({ id: id('a'), student_id: st.id, offer_id: offers[i].id, entreprise: offers[i].entreprise, titre: offers[i].titre, status: i % 3 ? 'postule' : 'entretien', note: '', created_at: daysAgo(3 + i), updated_at: daysAgo(1 + i) }));

  // Mentorat
  const mentors = seniors.filter(s => s.mentor_dispo);
  mentorships.push({ id: id('m'), student_id: s5[11].id, mentor_id: youssef.id, sujet: 'Préparer un entretien technique en méthodes', message: 'Bonjour, j’ai un entretien chez un équipementier automobile la semaine prochaine. Pourriez-vous m’aider à me préparer ?', status: 'demande', created_at: daysAgo(0, 3) });
  mentorships.push({ id: id('m'), student_id: s4[3].id, mentor_id: youssef.id, sujet: 'Choisir entre deux stages de 4A', message: 'J’hésite entre un stage en qualité et un stage en méthodes.', status: 'terminee', reponse: 'Appel de 30 min fait.', merci: 'Merci pour l’appel, j’ai choisi les méthodes et je ne regrette pas !', created_at: daysAgo(20) });
  mentorships.push({ id: id('m'), student_id: s5[7].id, mentor_id: youssef.id, sujet: 'Relire mon CV pour l’automobile', message: '', status: 'acceptee', reponse: 'Envoie-le moi, je te fais un retour samedi.', created_at: daysAgo(5) });
  mentors.slice(1).forEach((m, i) => {
    const st = pick(students);
    mentorships.push({ id: id('m'), student_id: st.id, mentor_id: m.id, sujet: pick(['Procédure Campus France', 'Préparer un entretien', 'Choisir mon sujet de PFE', 'Négocier un premier salaire', 'Trouver un stage à l’étranger']), message: '', status: i % 3 === 0 ? 'acceptee' : 'terminee', reponse: 'Avec plaisir.', merci: i % 3 ? 'Merci beaucoup pour vos conseils !' : null, created_at: daysAgo(8 + i * 4) });
  });

  // Entraide
  const QS = [
    ['Étranger & visas', 'Quand commencer la procédure Campus France pour un stage de 5A en France ?', 'Je vise un stage à partir de février. Quels documents préparer et combien de temps ça prend en pratique ?', [
      ['laureat', 'Commence dès octobre. Il faut la convention de stage signée, le relevé de notes traduit si besoin et une preuve de ressources. Compte 6 à 8 semaines au total avec le rendez-vous visa.'],
      ['laureat', 'Ajoute aussi l’attestation de logement, c’est ce qui m’a bloqué deux semaines.'],
      ['etudiant', 'Merci ! Est-ce que le relevé de 4A suffit ?']]],
    ['PFE', 'Comment choisir entre un PFE en R&D et un PFE en production ?', 'J’ai deux propositions et je ne sais pas laquelle aide le plus pour un premier emploi.', [
      ['laureat', 'Pense au premier poste que tu veux. La production embauche plus vite au Maroc, la R&D ouvre plus de portes à l’étranger. Dans les deux cas, ce qui compte c’est un résultat chiffré à mettre sur ton CV.'],
      ['laureat', 'Regarde aussi qui sera ton encadrant en entreprise. Un bon encadrant vaut plus que le sujet.']]],
    ['CV & entretiens', 'Faut-il mettre les projets du cycle prépa sur le CV ?', '', [
      ['laureat', 'Non, sauf s’ils sont vraiment techniques. Garde la place pour tes stages de 3A et 4A et les projets du cycle ingénieur.']]],
    ['Premier emploi', 'Quel salaire demander pour un premier poste d’ingénieur à Casablanca ?', 'Pour un CDI en industrie, quelle fourchette est raisonnable en 2026 ?', [
      ['laureat', 'Dans l’industrie, la fourchette la plus courante que je vois pour un débutant reste entre 9 000 et 12 000 DH net, plus selon les primes. Les multinationales de l’automobile et de l’aéronautique sont souvent au-dessus.']]],
    ['Stage', 'Des entreprises à Meknès qui prennent des stagiaires de 3A ?', 'Je cherche un stage ouvrier proche de l’école.', []],
    ['Vie à l’école', 'Le club robotique cherche des lauréats pour un parrainage', 'On prépare la compétition nationale et on cherche des conseils et un sponsor.', [
      ['laureat', 'Contactez-moi, notre entreprise sponsorise déjà deux clubs, on peut regarder.']]],
  ];
  QS.forEach(([cat, titre, body, ans], qi) => {
    const author = pick(students);
    const q = { id: id('q'), author_id: author.id, categorie: cat, titre, body, best_answer_id: null, created_at: daysAgo(2 + qi * 4) };
    questions.push(q);
    ans.forEach(([role, txt], ai) => {
      const a = { id: id('ans'), question_id: q.id, author_id: role === 'laureat' ? (qi === 0 && ai === 0 ? youssef.id : pick(seniors).id) : author.id, body: txt, created_at: new Date(new Date(q.created_at).getTime() + (ai + 1) * 3 * 36e5).toISOString() };
      answers.push(a);
      const nv = role === 'laureat' ? 2 + Math.floor(r() * 9) : 0;
      const vs = new Set(); for (let v = 0; v < nv; v++) vs.add(pick(students).id);
      for (const uid of vs) votes.push({ id: id('v'), answer_id: a.id, user_id: uid, created_at: a.created_at });
      if (ai === 0 && role === 'laureat' && qi % 2 === 0) q.best_answer_id = a.id;
    });
  });

  return { profiles, offers, comments, reactions, applications, placements, mentorships, questions, answers, votes };
}
