// Couche de données : même interface en mode démo (navigateur) et en mode réel (Supabase).
import { buildSeed } from './seed.js';
import { attestationStats } from './logic.js';

export const TABLES = ['profiles', 'offers', 'comments', 'reactions', 'applications', 'placements', 'mentorships', 'questions', 'answers', 'votes', 'shortlists', 'invitations', 'kudos', 'attestations', 'liens_rdv', 'annonces'];
// Tables ajoutées par supabase/mise-a-jour.sql : tant que la base n'est pas à jour, elles restent vides au lieu de bloquer le site.
const OPTIONAL = new Set(['shortlists', 'invitations', 'kudos', 'attestations', 'liens_rdv', 'annonces']);

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
// Salle de visio Jitsi : gratuite, sans compte pour l'invité, nom impossible à deviner
export const jitsiLink = () => 'https://meet.jit.si/ReseauENSAM-' + Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
const demoEmail = p => (p?.full_name || 'membre').toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '').trim().replace(/ +/g, '.') + '@exemple.ma';

function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function safeSet(key, v) { try { localStorage.setItem(key, v); } catch { /* stockage indisponible */ } }

class Base {
  constructor() { this.data = Object.fromEntries(TABLES.map(t => [t, []])); this.listeners = new Set(); this.me = null; }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { this.data = { ...this.data }; for (const fn of this.listeners) fn(); }
  byId(table, id) { return this.data[table].find(r => r.id === id); }
}

// ---------------------------------------------------------------------------
// Démo : données d'exemple, gardées dans le navigateur du visiteur
// ---------------------------------------------------------------------------
const DEMO_KEY = 'ensam-demo-v7';
class DemoStore extends Base {
  constructor() { super(); this.mode = 'demo'; }
  async init() {
    let saved = null;
    try { saved = JSON.parse(safeGet(DEMO_KEY) || 'null'); } catch { saved = null; }
    this.data = saved?.data || buildSeed();
    for (const t of TABLES) this.data[t] ||= [];
    const meId = saved?.meId || this.data.profiles.find(p => p.role === 'etudiant' && p._persona)?.id;
    this.me = this.byId('profiles', meId) || null;
    this.ready = true;
  }
  persist() { safeSet(DEMO_KEY, JSON.stringify({ data: this.data, meId: this.me?.id })); }
  personas() { const o = { etudiant: 0, laureat: 1, admin: 2 }; return this.data.profiles.filter(p => p._persona).sort((a, b) => o[a.role] - o[b.role]); }
  switchTo(id) { this.me = this.byId('profiles', id); this.persist(); this.emit(); }
  reset() { this.data = buildSeed(); this.me = this.personas()[0]; this.persist(); this.emit(); }
  async insert(table, row) {
    const r = { id: uuid(), created_at: new Date().toISOString(), ...row };
    if (table === 'placements') applyPlacementRules(this, r, null);
    if (table === 'applications') applyApplicationRules(this, r, null);
    if (table === 'mentorships') applyMentorshipRules(this, r, null);
    if (table === 'liens_rdv') applyLienRules(this, r, null);
    if (table === 'annonces') { if (this.me?.role !== 'admin') throw new Error('Action non autorisée pour ton compte.'); r.author_id = this.me.id; }
    if (table === 'shortlists') { r.laureat_id = this.me?.id; if (this.data.shortlists.some(x => x.laureat_id === r.laureat_id && x.student_id === r.student_id)) return r; }
    if (table === 'kudos') { r.user_id = this.me?.id; if (this.data.kudos.some(x => x.placement_id === r.placement_id && x.user_id === r.user_id)) return r; }
    if (table === 'invitations') applyInvitationRules(this, r, null);
    if (table === 'attestations') { if (this.me?.role !== 'laureat') throw new Error('Seul un lauréat peut obtenir une attestation.'); Object.assign(r, { laureat_id: this.me.id, stats: attestationStats(this.data, this.me.id) }); }
    if (table === 'reactions' && this.data.reactions.some(x => x.offer_id === r.offer_id && x.user_id === r.user_id && x.kind === r.kind)) return r;
    if (table === 'votes' && this.data.votes.some(x => x.answer_id === r.answer_id && x.user_id === r.user_id)) return r;
    if (table === 'placements' && this.data.placements.some(x => x.student_id === r.student_id && x.saison === r.saison && x.status !== 'refuse')) throw new Error('Une réussite est déjà enregistrée pour cet étudiant cette saison.');
    this.data[table] = [r, ...this.data[table]];
    if (table === 'profiles' && r.id === this.me?.id) this.me = r;
    this.persist(); this.emit();
    return r;
  }
  async update(table, id, patch) {
    const old = this.byId(table, id); if (!old) return null;
    const r = { ...old, ...patch };
    if (table === 'placements') applyPlacementRules(this, r, old);
    if (table === 'applications') applyApplicationRules(this, r, old);
    if (table === 'invitations') applyInvitationRules(this, r, old);
    if (table === 'mentorships') applyMentorshipRules(this, r, old);
    if (table === 'liens_rdv') applyLienRules(this, r, old);
    if (table === 'annonces' && this.me?.role !== 'admin') throw new Error('Action non autorisée pour ton compte.');
    this.data[table] = this.data[table].map(x => x.id === id ? r : x);
    if (table === 'profiles' && id === this.me?.id) this.me = r;
    this.persist(); this.emit();
    return r;
  }
  async remove(table, id) {
    if (table === 'annonces' && this.me?.role !== 'admin') throw new Error('Action non autorisée pour ton compte.');
    this.data[table] = this.data[table].filter(x => x.id !== id);
    this.persist(); this.emit();
  }
  async signOut() {}
  // Email de l'étudiant, pour le seul lauréat qui a fixé le rendez-vous (invitation Google Agenda)
  async emailRdv(id) {
    const m = this.byId('mentorships', id);
    return m && m.status === 'acceptee' && m.mentor_id === this.me?.id ? demoEmail(this.byId('profiles', m.student_id)) : null;
  }
  async adminComptes() {
    if (this.me?.role !== 'admin') throw new Error('Réservé à l’administration.');
    const rows = this.data.profiles.map((p, i) => ({ id: p.id, email: demoEmail(p), created_at: p.created_at, last_sign_in_at: new Date(Date.now() - (i % 9) * 864e5 - 36e5).toISOString(), a_profil: true }));
    return [{ id: 'sans-profil', email: 'nouveau.compte@exemple.ma', created_at: new Date(Date.now() - 5 * 36e5).toISOString(), last_sign_in_at: null, a_profil: false }, ...rows];
  }
  async verifyAttestation(id) {
    const a = this.byId('attestations', id); if (!a) return null;
    const p = this.byId('profiles', a.laureat_id);
    return { id: a.id, full_name: p?.full_name, filiere: p?.filiere, promo: p?.promo, stats: a.stats, created_at: a.created_at };
  }
}

// Mêmes règles que le serveur (supabase/schema.sql), pour que la démo se comporte comme la vraie plateforme.
// Un recrutement via une offre est déclaré par le lauréat auteur, puis confirmé par l'étudiant.
function applyPlacementRules(store, r, old) {
  const me = store.me; const isAdmin = me?.role === 'admin';
  if (!old) {
    if (isAdmin) { if (r.status === 'confirme') r.confirmed_at = new Date().toISOString(); return; }
    if (r.student_id === me?.id) { Object.assign(r, { source: 'autre', status: 'declare', offer_id: null, laureat_id: null }); return; }
    if (me?.role !== 'laureat') throw new Error('Seul un lauréat peut déclarer un recrutement.');
    if (r.offer_id && store.byId('offers', r.offer_id)?.author_id !== me.id) throw new Error('Seul l’auteur de l’offre peut déclarer ce recrutement.');
    Object.assign(r, { laureat_id: me.id, source: 'plateforme', status: 'en_attente', confirmed_at: null });
    return;
  }
  if (isAdmin) { if (r.status === 'confirme' && old.status !== 'confirme') r.confirmed_at = new Date().toISOString(); return; }
  if (old.student_id === me?.id) {
    if (r.status !== old.status && !(old.status === 'en_attente' && ['confirme', 'refuse'].includes(r.status))) r.status = old.status;
    if (r.status === 'confirme' && old.status !== 'confirme') r.confirmed_at = new Date().toISOString();
    if (old.source !== 'autre') for (const k of ['entreprise', 'ville', 'pays', 'type', 'offer_id', 'laureat_id', 'saison', 'niveau']) r[k] = old[k];
    return;
  }
  throw new Error('Seul l’étudiant concerné peut confirmer ce recrutement.');
}

function applyApplicationRules(store, r, old) {
  const me = store.me; if (me?.role === 'admin') return;
  if (!old) {
    if (r.offer_id) { const o = store.byId('offers', r.offer_id); if (o) { r.entreprise = o.entreprise; r.titre = o.titre; } r.status = 'postule'; }
    if (r.offer_id && store.data.applications.some(a => a.offer_id === r.offer_id && a.student_id === r.student_id)) throw new Error('Tu as déjà postulé à cette offre.');
    return;
  }
  const author = old.offer_id ? store.byId('offers', old.offer_id)?.author_id : null;
  if (author && author === me?.id) { for (const k of Object.keys(r)) if (!['status', 'updated_at'].includes(k)) r[k] = old[k]; return; }
  if (old.student_id === me?.id && old.offer_id && r.status !== old.status) r.status = old.status;
}

// Invitation à postuler : un lauréat invite un étudiant sur une de ses offres ; l'étudiant peut seulement la décliner.
function applyInvitationRules(store, r, old) {
  const me = store.me; if (me?.role === 'admin') return;
  if (!old) {
    if (me?.role !== 'laureat') throw new Error('Seul un lauréat peut inviter un étudiant.');
    if (store.byId('offers', r.offer_id)?.author_id !== me.id) throw new Error('Tu ne peux inviter que sur tes propres offres.');
    if (store.data.invitations.some(x => x.offer_id === r.offer_id && x.student_id === r.student_id)) throw new Error('Cet étudiant est déjà invité sur cette offre.');
    Object.assign(r, { laureat_id: me.id, status: 'envoyee' });
    return;
  }
  for (const k of Object.keys(r)) if (k !== 'status') r[k] = old[k];
  if (!(old.student_id === me?.id && r.status === 'declinee')) r.status = old.status;
}

// Mentorat en 3 étapes : l'étudiant demande avec ses horaires, un lauréat en choisit un (le premier l'emporte),
// la visio est créée, puis l'étudiant clôt et remercie.
function applyMentorshipRules(store, r, old) {
  const me = store.me; if (me?.role === 'admin') return;
  const now = new Date();
  const clean = c => [...new Set((c || []).filter(x => new Date(x) > now).map(x => new Date(x).toISOString()))].sort().slice(0, 3);
  if (!old) {
    r.student_id = me.id;
    if (r.mentor_id === me.id) throw new Error('Choisis un autre lauréat que toi.');
    if (r.mentor_id && store.byId('profiles', r.mentor_id)?.role !== 'laureat') throw new Error('Choisis un lauréat.');
    r.creneaux = clean(r.creneaux);
    if (!r.creneaux.length) throw new Error('Propose au moins un horaire à venir.');
    if (store.data.mentorships.filter(m => m.student_id === me.id && m.status === 'demande').length >= 3) throw new Error('Tu as déjà 3 demandes en attente. Attends une réponse avant d’en envoyer une autre.');
    Object.assign(r, { mentor_id: r.mentor_id || null, status: 'demande', rdv_at: null, reponse: null, merci: null, note: null, accepted_at: null });
    return;
  }
  const v = { ...r };
  Object.assign(r, old);
  if (!old.mentor_id && old.status === 'demande' && v.mentor_id === me.id && me.id !== old.student_id) {
    if (me.role !== 'laureat') throw new Error('Seul un lauréat peut accepter une demande.');
    r.mentor_id = me.id;
  }
  if (r.mentor_id === me.id) {
    r.reponse = v.reponse;
    if (old.status === 'demande' && !v.mentor_id && old.mentor_id) r.mentor_id = null;
    else if (v.status === 'acceptee' && ['demande', 'acceptee'].includes(old.status)) {
      if (!v.rdv_at) throw new Error('Choisis l’horaire du rendez-vous.');
      if (v.rdv_at !== old.rdv_at && new Date(v.rdv_at) < now) throw new Error('Choisis un moment à venir.');
      r.status = 'acceptee'; r.rdv_at = v.rdv_at;
      if (old.status === 'demande') r.accepted_at = now.toISOString();
      if (!store.byId('liens_rdv', old.id)) store.data.liens_rdv = [{ id: old.id, lien: jitsiLink(), created_at: now.toISOString() }, ...store.data.liens_rdv];
    } else if (v.status === 'refusee' && old.status === 'demande') r.status = 'refusee';
    else if (['terminee', 'annulee'].includes(v.status) && old.status === 'acceptee') r.status = v.status;
    return;
  }
  if (old.student_id === me.id) {
    r.merci = v.merci; r.note = v.note;
    if (old.status === 'demande') {
      r.besoin = v.besoin; r.sujet = v.sujet; r.message = v.message;
      if (JSON.stringify(v.creneaux) !== JSON.stringify(old.creneaux)) { r.creneaux = clean(v.creneaux); if (!r.creneaux.length) throw new Error('Propose au moins un horaire à venir.'); }
      if (v.status === 'annulee') r.status = 'annulee';
    } else if (old.status === 'acceptee' && ['terminee', 'annulee'].includes(v.status)) r.status = v.status;
    return;
  }
  if (v.mentor_id === me?.id) throw new Error('Un autre lauréat vient de prendre cette demande.');
}

// Lien de visio : seul le lauréat du rendez-vous le change, et seulement pour un lien https
function applyLienRules(store, r, old) {
  if (store.me?.role === 'admin') return;
  const m = store.byId('mentorships', (old || r).id);
  if (!m || m.mentor_id !== store.me?.id) throw new Error('Seul le lauréat du rendez-vous peut changer le lien.');
  if (!/^https:\/\/\S+$/i.test(r.lien || '') || r.lien.length > 300) throw new Error('Le lien doit commencer par https://');
}

// ---------------------------------------------------------------------------
// Réel : Supabase (comptes, base partagée, temps réel)
// ---------------------------------------------------------------------------
class SupabaseStore extends Base {
  constructor(cfg) { super(); this.mode = 'live'; this.cfg = cfg; }
  async init() {
    await new Promise((ok, ko) => { const el = document.createElement('script'); el.src = 'vendor/supabase.js'; el.onload = ok; el.onerror = () => ko(new Error('Chargement de Supabase impossible')); document.head.appendChild(el); });
    const { createClient } = window.supabase;
    this.sb = createClient(this.cfg.supabaseUrl, this.cfg.supabaseAnonKey);
    const { data: { session } } = await this.sb.auth.getSession();
    this.session = session;
    this.sb.auth.onAuthStateChange(async (_e, s) => {
      const changed = (s?.user?.id || null) !== (this.session?.user?.id || null);
      this.session = s;
      if (changed) { await this.loadAll(); this.emit(); }
    });
    if (session) await this.loadAll();
    this.ready = true;
  }
  get userId() { return this.session?.user?.id || null; }
  async loadAll() {
    if (!this.userId) { this.data = Object.fromEntries(TABLES.map(t => [t, []])); this.me = null; return; }
    await Promise.all(TABLES.map(t => this.loadTable(t)));
    this.me = this.byId('profiles', this.userId) || null;
    this.subscribe();
  }
  async loadTable(t) {
    const all = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.sb.from(t).select('*').order('created_at', { ascending: false }).range(from, from + 999);
      if (error && OPTIONAL.has(t)) { this.data[t] = []; return; }
      if (error) throw error;
      all.push(...data);
      if (data.length < 1000) break;
    }
    this.data[t] = all;
  }
  subscribe() {
    if (this.channel) return;
    const pending = new Set(); let timer = null;
    this.channel = this.sb.channel('ensam-live');
    for (const t of TABLES) {
      this.channel.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => {
        pending.add(t); clearTimeout(timer);
        timer = setTimeout(async () => {
          const ts = [...pending]; pending.clear();
          await Promise.all(ts.map(x => this.loadTable(x)));
          this.me = this.byId('profiles', this.userId) || null;
          this.emit();
        }, 400);
      });
    }
    this.channel.subscribe();
  }
  async insert(table, row) {
    const { data, error } = await this.sb.from(table).insert(row).select().single();
    if (error) throw new Error(frError(error));
    this.data[table] = [data, ...this.data[table].filter(x => x.id !== data.id)];
    if (table === 'profiles') this.me = this.byId('profiles', this.userId);
    this.emit(); return data;
  }
  async update(table, id, patch) {
    const { data, error } = await this.sb.from(table).update(patch).eq('id', id).select().single();
    // Aucune ligne modifiée : quelqu'un est passé avant (ex. demande prise entre-temps)
    if (error?.code === 'PGRST116') throw new Error(table === 'mentorships' ? 'Un autre lauréat vient de prendre cette demande.' : 'Cette action n’est plus possible. Recharge la page.');
    if (error) throw new Error(frError(error));
    this.data[table] = this.data[table].some(x => x.id === id) ? this.data[table].map(x => x.id === id ? data : x) : [data, ...this.data[table]];
    // Le lien de visio est créé côté base quand le lauréat accepte
    if (table === 'mentorships') await this.loadTable('liens_rdv').catch(() => {});
    if (table === 'profiles') this.me = this.byId('profiles', this.userId);
    this.emit(); return data;
  }
  async remove(table, id) {
    const { error } = await this.sb.from(table).delete().eq('id', id);
    if (error) throw new Error(frError(error));
    this.data[table] = this.data[table].filter(x => x.id !== id);
    this.emit();
  }
  async signUp(email, password) {
    const { data, error } = await this.sb.auth.signUp({ email, password });
    if (error) throw new Error(frError(error));
    return { needsConfirm: !data.session };
  }
  async signIn(email, password) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(frError(error));
  }
  async resetPassword(email) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) throw new Error(frError(error));
  }
  async setPassword(password) {
    const { error } = await this.sb.auth.updateUser({ password });
    if (error) throw new Error(frError(error));
  }
  async signOut() { await this.sb.auth.signOut(); }
  async verifyAttestation(id) {
    const { data, error } = await this.sb.rpc('attestation_publique', { p_id: id });
    if (error) return null;
    return (Array.isArray(data) ? data[0] : data) || null;
  }
  async emailRdv(id) {
    const { data, error } = await this.sb.rpc('email_rdv', { p_id: id });
    return error ? null : data || null;
  }
  async adminComptes() {
    const { data, error } = await this.sb.rpc('admin_comptes');
    if (error) throw new Error(frError(error));
    return data || [];
  }
}

function frError(e) {
  const m = (e?.message || '').toLowerCase();
  if (m.includes('invalid login')) return 'Email ou mot de passe incorrect.';
  if (m.includes('already registered')) return 'Un compte existe déjà avec cet email. Connecte-toi.';
  if (m.includes('password should be')) return 'Le mot de passe doit contenir au moins 6 caractères.';
  if (m.includes('email not confirmed')) return "Confirme d'abord ton email (regarde ta boîte de réception).";
  if (m.includes('duplicate key') && m.includes('placements')) return 'Une réussite est déjà enregistrée pour cet étudiant cette saison.';
  if (m.includes('duplicate key') && m.includes('applications')) return 'Tu as déjà postulé à cette offre.';
  if (m.includes('duplicate key') && m.includes('invitations')) return 'Cet étudiant est déjà invité sur cette offre.';
  if (m.includes('lien_check')) return 'Le lien doit commencer par https://';
  if (m.includes('could not find the') || m.includes('does not exist')) return 'Cette fonction arrive bientôt : la base est en cours de mise à jour.';
  if (m.includes('row-level security')) return "Action non autorisée pour ton compte.";
  if (m.includes('rate limit')) return 'Trop de tentatives. Réessaie dans quelques minutes.';
  return e?.message || 'Erreur inconnue.';
}

export async function createStore() {
  const cfg = window.ENSAM_CONFIG || {};
  const store = cfg.supabaseUrl && cfg.supabaseAnonKey ? new SupabaseStore(cfg) : new DemoStore();
  await store.init();
  return store;
}
