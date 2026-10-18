// Couche de données : même interface en mode démo (navigateur) et en mode réel (Supabase).
import { buildSeed } from './seed.js';

export const TABLES = ['profiles', 'offers', 'comments', 'reactions', 'applications', 'placements', 'mentorships', 'questions', 'answers', 'votes'];

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));

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
const DEMO_KEY = 'ensam-demo-v5';
class DemoStore extends Base {
  constructor() { super(); this.mode = 'demo'; }
  async init() {
    let saved = null;
    try { saved = JSON.parse(safeGet(DEMO_KEY) || 'null'); } catch { saved = null; }
    this.data = saved?.data || buildSeed();
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
    if (table === 'mentorships') { r.status = 'demande'; }
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
    this.data[table] = this.data[table].map(x => x.id === id ? r : x);
    if (table === 'profiles' && id === this.me?.id) this.me = r;
    this.persist(); this.emit();
    return r;
  }
  async remove(table, id) {
    this.data[table] = this.data[table].filter(x => x.id !== id);
    this.persist(); this.emit();
  }
  async signOut() {}
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
    if (error) throw new Error(frError(error));
    this.data[table] = this.data[table].map(x => x.id === id ? data : x);
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
}

function frError(e) {
  const m = (e?.message || '').toLowerCase();
  if (m.includes('invalid login')) return 'Email ou mot de passe incorrect.';
  if (m.includes('already registered')) return 'Un compte existe déjà avec cet email. Connecte-toi.';
  if (m.includes('password should be')) return 'Le mot de passe doit contenir au moins 6 caractères.';
  if (m.includes('email not confirmed')) return "Confirme d'abord ton email (regarde ta boîte de réception).";
  if (m.includes('duplicate key') && m.includes('placements')) return 'Une réussite est déjà enregistrée pour cet étudiant cette saison.';
  if (m.includes('duplicate key') && m.includes('applications')) return 'Tu as déjà postulé à cette offre.';
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
