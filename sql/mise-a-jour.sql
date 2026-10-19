-- =====================================================================
--  Réseau ENSAM Meknès · Mise à jour de la base
--  Ajoute ce qui manque (mentorat en 3 étapes, visio, annonces, page admin,
--  vivier de talents, attestation, fil des réussites) sans toucher aux comptes,
--  offres ni candidatures existants. Relançable sans risque.
--  Supabase > SQL Editor > New query : colle tout ce fichier, puis Run.
-- =====================================================================


create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Profils (1 ligne par compte)
-- role    : etudiant | laureat | admin
-- promo   : année de diplôme (prévue pour un étudiant, réelle pour un lauréat)
--           -> le niveau (3A/4A/5A) est calculé automatiquement chaque saison
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 80),
  role text not null default 'etudiant' check (role in ('etudiant','laureat','admin')),
  filiere text not null,
  promo int not null check (promo between 1990 and 2040),
  entreprise text,
  poste text,
  ville text,
  pays text default 'Maroc',
  bio text check (char_length(bio) <= 600),
  competences text[] default '{}',
  linkedin text,
  contact text,
  cv_url text,
  disponibilite text constraint profiles_disponibilite_len check (char_length(disponibilite) <= 80),
  mentor_dispo boolean default false,
  mentor_sujets text,
  vitrine boolean default true,
  verified boolean default false,
  created_at timestamptz default now()
);
-- Bases installées avant la « Phase 1 »
alter table public.profiles add column if not exists disponibilite text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_disponibilite_len') then
    alter table public.profiles add constraint profiles_disponibilite_len check (char_length(disponibilite) <= 80);
  end if;
end $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Personne ne peut s'auto-proclamer admin ou "lauréat vérifié"
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    if new.role = 'admin' then new.role := 'etudiant'; end if;
    new.verified := false;
  else
    new.role := case when old.role = 'admin' then 'admin'
                     when new.role = 'admin' then old.role
                     else new.role end;
    if new.role <> old.role then new.verified := false;
    else new.verified := old.verified; end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_protect_profile on public.profiles;
create trigger trg_protect_profile before insert or update on public.profiles
  for each row execute function public.protect_profile();

-- ---------------------------------------------------------------------
-- Offres publiées (surtout par les lauréats)
-- type : stage | pfe | etranger | emploi
-- annees : niveaux ciblés (3,4,5 ; 6 = jeunes diplômés)
-- ---------------------------------------------------------------------
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('stage','pfe','etranger','emploi')),
  titre text not null check (char_length(titre) between 4 and 140),
  entreprise text not null,
  ville text,
  pays text default 'Maroc',
  filieres text[] default '{}',
  annees int[] default '{}',
  description text not null check (char_length(description) <= 4000),
  contact text,
  lien text,
  deadline date,
  cooptation boolean default false,
  remunere boolean default false,
  duree text,
  status text not null default 'ouverte' check (status in ('ouverte','pourvue','fermee')),
  created_at timestamptz default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1500),
  created_at timestamptz default now()
);

-- kind : utile (= "ça m'aide") | save (= sauvegardée)
create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('utile','save')),
  created_at timestamptz default now(),
  unique (offer_id, user_id, kind)
);

-- ---------------------------------------------------------------------
-- Candidatures
-- Sur une offre de la plateforme : l'étudiant postule, le LAURÉAT auteur de
-- l'offre fait avancer le statut (entretien, retenu, pas retenu).
-- Candidature externe (offer_id vide) : l'étudiant la suit lui-même.
-- ---------------------------------------------------------------------
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  offer_id uuid references public.offers(id) on delete set null,
  entreprise text not null,
  titre text,
  message text check (char_length(message) <= 1500),
  status text not null default 'postule' check (status in ('postule','entretien','retenu','refuse')),
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.applications add column if not exists message text;
create unique index if not exists applications_une_par_offre on public.applications (student_id, offer_id) where offer_id is not null;

create or replace function public.protect_application() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_author uuid; v_status text; v_note text; v_message text;
begin
  if tg_op = 'INSERT' then
    if new.offer_id is not null then
      select author_id into v_author from public.offers where id = new.offer_id;
      select entreprise, titre into new.entreprise, new.titre from public.offers where id = new.offer_id;
      if auth.uid() is not null and not public.is_admin() then new.status := 'postule'; end if;
    end if;
    return new;
  end if;
  if auth.uid() is null or public.is_admin() then new.updated_at := now(); return new; end if;
  select author_id into v_author from public.offers where id = old.offer_id;
  v_status := new.status; v_note := new.note; v_message := new.message;
  new := old;
  new.updated_at := now();
  if old.offer_id is not null and auth.uid() = v_author and auth.uid() <> old.student_id then
    new.status := v_status;                         -- le lauréat fait avancer la candidature
  elsif auth.uid() = old.student_id then
    new.note := v_note; new.message := v_message;   -- l'étudiant garde ses notes
    if old.offer_id is null then new.status := v_status; end if;  -- et suit seul ses candidatures externes
  end if;
  return new;
end $$;
drop trigger if exists trg_protect_application on public.applications;
create trigger trg_protect_application before insert or update on public.applications
  for each row execute function public.protect_application();

-- ---------------------------------------------------------------------
-- Réussites (placements) : la base du tableau de bord.
-- saison : année de début de l'année universitaire (2026 = 2026-2027)
-- niveau : 3,4,5 ou 6 (jeune diplômé)
-- Deux façons d'arriver ici :
--   1. Le LAURÉAT déclare « j'ai recruté X » (depuis son offre)  -> en_attente
--      puis l'ÉTUDIANT confirme                                  -> confirme (vérifié des deux côtés)
--      ou dit que ce n'est pas le cas                            -> refuse
--   2. L'étudiant déclare avoir trouvé hors plateforme            -> declare (non vérifié)
-- ---------------------------------------------------------------------
create table if not exists public.placements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  offer_id uuid references public.offers(id) on delete set null,
  laureat_id uuid references public.profiles(id) on delete set null,
  saison int not null,
  niveau int not null check (niveau between 3 and 6),
  type text not null check (type in ('stage','pfe','etranger','emploi')),
  entreprise text not null,
  ville text,
  pays text default 'Maroc',
  source text not null default 'autre' check (source in ('plateforme','autre')),
  status text not null default 'declare' check (status in ('declare','en_attente','confirme','refuse')),
  merci text check (char_length(merci) <= 800),
  note int check (note between 1 and 5),
  partage_ok boolean default false,           -- l'étudiant accepte d'être cité sur LinkedIn
  created_at timestamptz default now(),
  confirmed_at timestamptz
);
alter table public.placements add column if not exists partage_ok boolean default false;
-- Une seule réussite par étudiant et par saison (une déclaration refusée par l'étudiant ne compte pas)
create unique index if not exists placements_une_par_saison on public.placements (student_id, saison) where status <> 'refuse';

create or replace function public.protect_placement() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_author uuid; v_status text; v_merci text; v_note int; v_ent text; v_ville text; v_pays text; v_type text; v_partage boolean;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null or public.is_admin() then return new; end if;
    new.confirmed_at := null;
    if auth.uid() = new.student_id then
      -- l'étudiant ne peut déclarer qu'une réussite hors plateforme (non vérifiée)
      new.offer_id := null; new.laureat_id := null; new.source := 'autre'; new.status := 'declare';
      return new;
    end if;
    -- sinon c'est un lauréat qui déclare avoir recruté l'étudiant
    if not exists (select 1 from public.profiles where id = auth.uid() and role = 'laureat') then
      raise exception 'Seul un lauréat peut déclarer un recrutement.';
    end if;
    new.laureat_id := auth.uid();
    if new.offer_id is not null then
      select author_id into v_author from public.offers where id = new.offer_id;
      if v_author is distinct from auth.uid() then raise exception 'Seul l’auteur de l’offre peut déclarer ce recrutement.'; end if;
    end if;
    new.source := 'plateforme'; new.status := 'en_attente'; new.partage_ok := false;
    return new;
  end if;
  -- UPDATE
  if auth.uid() is null or public.is_admin() then
    if new.status = 'confirme' and old.status <> 'confirme' then new.confirmed_at := now(); end if;
    return new;
  end if;
  v_status := new.status; v_merci := new.merci; v_note := new.note; v_partage := new.partage_ok;
  v_ent := new.entreprise; v_ville := new.ville; v_pays := new.pays; v_type := new.type;
  new := old;
  if auth.uid() = old.student_id then
    new.merci := v_merci; new.note := v_note; new.partage_ok := coalesce(v_partage, false);
    if old.status = 'en_attente' and v_status in ('confirme','refuse') then
      new.status := v_status;
      if v_status = 'confirme' then new.confirmed_at := now(); end if;
    end if;
    if old.source = 'autre' then new.entreprise := v_ent; new.ville := v_ville; new.pays := v_pays; new.type := v_type; end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_protect_placement on public.placements;
create trigger trg_protect_placement before insert or update on public.placements
  for each row execute function public.protect_placement();

-- ---------------------------------------------------------------------
-- Mentorat en 3 étapes
--   1. L'étudiant dit de quoi il a besoin et propose 2 ou 3 horaires,
--      à un lauréat précis ou à tous les lauréats (mentor_id vide).
--   2. Un lauréat clique sur un horaire : le rendez-vous est fixé et le lien
--      de visio est créé tout seul (table liens_rdv, visible des deux seulement).
--   3. Après l'échange, l'étudiant note et dit merci.
-- ---------------------------------------------------------------------
create table if not exists public.mentorships (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  mentor_id uuid references public.profiles(id) on delete cascade,
  besoin text check (besoin in ('cv','stage','entretien','etranger','carriere')),
  sujet text not null check (char_length(sujet) between 3 and 140),
  message text check (char_length(message) <= 1500),
  creneaux timestamptz[] not null default '{}',
  status text not null default 'demande',
  rdv_at timestamptz,
  reponse text check (char_length(reponse) <= 1500),
  merci text check (char_length(merci) <= 800),
  note int check (note between 1 and 5),
  accepted_at timestamptz,
  created_at timestamptz default now()
);
-- Bases installées avant le mentorat en 3 étapes
alter table public.mentorships alter column mentor_id drop not null;
alter table public.mentorships add column if not exists besoin text check (besoin in ('cv','stage','entretien','etranger','carriere'));
alter table public.mentorships add column if not exists creneaux timestamptz[] not null default '{}';
alter table public.mentorships add column if not exists rdv_at timestamptz;
alter table public.mentorships add column if not exists note int check (note between 1 and 5);
alter table public.mentorships add column if not exists accepted_at timestamptz;
alter table public.mentorships drop constraint if exists mentorships_status_check;
alter table public.mentorships add constraint mentorships_status_check check (status in ('demande','acceptee','terminee','refusee','annulee'));
create index if not exists mentorships_ouvertes on public.mentorships (created_at) where mentor_id is null and status = 'demande';

-- Lien de visio d'un rendez-vous : lisible par l'étudiant et le lauréat concernés seulement
create table if not exists public.liens_rdv (
  id uuid primary key references public.mentorships(id) on delete cascade,
  lien text not null check (lien ~* '^https://[^\s]+$' and char_length(lien) <= 300),
  created_at timestamptz default now()
);

-- Horaires proposés : à venir, sans doublon, 3 au plus
create or replace function public.creneaux_valides(c timestamptz[]) returns timestamptz[]
language sql stable as $$
  select coalesce(array_agg(x order by x), '{}') from (
    select distinct x from unnest(coalesce(c, '{}')) x where x > now() order by x limit 3) t;
$$;

create or replace function public.protect_mentorship() returns trigger
language plpgsql security definer set search_path = public as $$
declare v public.mentorships%rowtype; v_role text;
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  select role into v_role from public.profiles where id = auth.uid();
  if tg_op = 'INSERT' then
    new.student_id := auth.uid();
    if new.mentor_id = auth.uid() then raise exception 'Choisis un autre lauréat que toi.'; end if;
    if new.mentor_id is not null and not exists (select 1 from public.profiles where id = new.mentor_id and role = 'laureat') then
      raise exception 'Choisis un lauréat.';
    end if;
    new.creneaux := public.creneaux_valides(new.creneaux);
    if cardinality(new.creneaux) = 0 then raise exception 'Propose au moins un horaire à venir.'; end if;
    if (select count(*) from public.mentorships where student_id = auth.uid() and status = 'demande') >= 3 then
      raise exception 'Tu as déjà 3 demandes en attente. Attends une réponse avant d’en envoyer une autre.';
    end if;
    new.status := 'demande'; new.rdv_at := null; new.reponse := null; new.merci := null; new.note := null;
    new.accepted_at := null; new.created_at := now();
    return new;
  end if;
  v := new;
  new := old;
  -- Un lauréat prend une demande ouverte à tous
  if old.mentor_id is null and old.status = 'demande' and v.mentor_id = auth.uid() and auth.uid() <> old.student_id then
    if v_role is distinct from 'laureat' then raise exception 'Seul un lauréat peut accepter une demande.'; end if;
    new.mentor_id := auth.uid();
  end if;
  -- Le lauréat : fixer ou déplacer le rendez-vous, passer la main, clore
  if new.mentor_id = auth.uid() then
    new.reponse := v.reponse;
    if old.status = 'demande' and v.mentor_id is null and old.mentor_id is not null then
      new.mentor_id := null;                                 -- la demande devient ouverte à tous
    elsif v.status = 'acceptee' and old.status in ('demande','acceptee') then
      if v.rdv_at is null then raise exception 'Choisis l’horaire du rendez-vous.'; end if;
      if v.rdv_at is distinct from old.rdv_at and v.rdv_at < now() then raise exception 'Choisis un moment à venir.'; end if;
      new.status := 'acceptee'; new.rdv_at := v.rdv_at;
      if old.status = 'demande' then new.accepted_at := now(); end if;
      insert into public.liens_rdv (id, lien)
        values (old.id, 'https://meet.jit.si/ReseauENSAM-' || substr(md5(gen_random_uuid()::text), 1, 12))
        on conflict (id) do nothing;
    elsif v.status = 'refusee' and old.status = 'demande' then new.status := 'refusee';
    elsif v.status in ('terminee','annulee') and old.status = 'acceptee' then new.status := v.status;
    end if;
    return new;
  end if;
  -- L'étudiant : modifier sa demande en attente, annuler, dire que l'échange a eu lieu, noter, remercier
  if auth.uid() = old.student_id then
    new.merci := v.merci; new.note := v.note;
    if old.status = 'demande' then
      new.besoin := v.besoin; new.sujet := v.sujet; new.message := v.message;
      if v.creneaux is distinct from old.creneaux then
        new.creneaux := public.creneaux_valides(v.creneaux);
        if cardinality(new.creneaux) = 0 then raise exception 'Propose au moins un horaire à venir.'; end if;
      end if;
      if v.status = 'annulee' then new.status := 'annulee'; end if;
    elsif old.status = 'acceptee' and v.status in ('terminee','annulee') then
      new.status := v.status;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_protect_mentorship on public.mentorships;
create trigger trg_protect_mentorship before insert or update on public.mentorships
  for each row execute function public.protect_mentorship();

-- Email de l'étudiant, donné au seul lauréat qui a fixé le rendez-vous
-- (pour l'invitation Google Agenda)
create or replace function public.email_rdv(p_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select u.email::text from public.mentorships m join auth.users u on u.id = m.student_id
  where m.id = p_id and m.status = 'acceptee' and m.mentor_id = auth.uid();
$$;
revoke all on function public.email_rdv(uuid) from public;
grant execute on function public.email_rdv(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Entraide : questions / réponses / votes
-- ---------------------------------------------------------------------
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  categorie text not null,
  titre text not null check (char_length(titre) between 5 and 160),
  body text check (char_length(body) <= 3000),
  best_answer_id uuid,
  created_at timestamptz default now()
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 3000),
  created_at timestamptz default now()
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.answers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (answer_id, user_id)
);

-- ---------------------------------------------------------------------
-- Shortlist : les profils qu'un lauréat garde de côté (visible par lui seul)
-- ---------------------------------------------------------------------
create table if not exists public.shortlists (
  id uuid primary key default gen_random_uuid(),
  laureat_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  note text check (char_length(note) <= 300),
  created_at timestamptz default now(),
  unique (laureat_id, student_id)
);

-- ---------------------------------------------------------------------
-- Invitations à postuler : un lauréat invite un étudiant sur une de SES offres.
-- L'étudiant postule (candidature normale) ou décline.
-- ---------------------------------------------------------------------
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  laureat_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  offer_id uuid not null references public.offers(id) on delete cascade,
  message text check (char_length(message) <= 600),
  status text not null default 'envoyee' check (status in ('envoyee','declinee')),
  created_at timestamptz default now(),
  unique (offer_id, student_id)
);

create or replace function public.protect_invitation() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.profiles where id = auth.uid() and role = 'laureat') then
      raise exception 'Seul un lauréat peut inviter un étudiant.';
    end if;
    if not exists (select 1 from public.offers where id = new.offer_id and author_id = auth.uid()) then
      raise exception 'Tu ne peux inviter que sur tes propres offres.';
    end if;
    new.laureat_id := auth.uid(); new.status := 'envoyee'; new.created_at := now();
    return new;
  end if;
  v_status := new.status;
  new := old;
  if auth.uid() = old.student_id and v_status = 'declinee' then new.status := 'declinee'; end if;
  return new;
end $$;
drop trigger if exists trg_protect_invitation on public.invitations;
create trigger trg_protect_invitation before insert or update on public.invitations
  for each row execute function public.protect_invitation();

-- ---------------------------------------------------------------------
-- Annonces de l'administration (bandeau sur l'accueil)
-- ---------------------------------------------------------------------
create table if not exists public.annonces (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete set null,
  texte text not null check (char_length(texte) between 3 and 280),
  lien text check (lien ~* '^https://[^\s]+$' and char_length(lien) <= 300),
  active boolean not null default true,
  created_at timestamptz default now()
);

-- Comptes vus par l'administration : email, dernière connexion, profil rempli ou non
create or replace function public.admin_comptes()
returns table (id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, a_profil boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l’administration.'; end if;
  return query select u.id, u.email::text, u.created_at, u.last_sign_in_at, exists (select 1 from public.profiles p where p.id = u.id)
    from auth.users u order by u.created_at desc;
end $$;
revoke all on function public.admin_comptes() from public;
grant execute on function public.admin_comptes() to authenticated;

-- ---------------------------------------------------------------------
-- Bravos sur le fil des réussites
-- ---------------------------------------------------------------------
create table if not exists public.kudos (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.placements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (placement_id, user_id)
);

-- ---------------------------------------------------------------------
-- Attestations de contribution : les chiffres sont calculés par la base,
-- à partir des seules actions confirmées par les étudiants.
-- ---------------------------------------------------------------------
create table if not exists public.attestations (
  id uuid primary key default gen_random_uuid(),
  laureat_id uuid not null references public.profiles(id) on delete cascade,
  stats jsonb not null default '{}',
  created_at timestamptz default now()
);

create or replace function public.protect_attestation() returns trigger
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if auth.uid() is not null and not public.is_admin() then
    if not exists (select 1 from public.profiles where id = auth.uid() and role = 'laureat') then
      raise exception 'Seul un lauréat peut obtenir une attestation.';
    end if;
    new.laureat_id := auth.uid();
  end if;
  v := new.laureat_id;
  new.stats := jsonb_build_object(
    'mentorats', (select count(*) from public.mentorships where mentor_id = v and status = 'terminee'),
    'recrutes',  (select count(*) from public.placements where laureat_id = v and status = 'confirme'),
    'reponses',  (select count(*) from public.answers where author_id = v));
  new.created_at := now();
  return new;
end $$;
drop trigger if exists trg_protect_attestation on public.attestations;
create trigger trg_protect_attestation before insert on public.attestations
  for each row execute function public.protect_attestation();

-- Vérification publique d'une attestation par son lien (sans compte)
create or replace function public.attestation_publique(p_id uuid)
returns table (id uuid, full_name text, filiere text, promo int, stats jsonb, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id, p.full_name, p.filiere, p.promo, a.stats, a.created_at
  from public.attestations a join public.profiles p on p.id = a.laureat_id
  where a.id = p_id;
$$;
revoke all on function public.attestation_publique(uuid) from public;
grant execute on function public.attestation_publique(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Sécurité ligne par ligne (RLS)
-- Règle générale : tout membre connecté lit, chacun écrit ce qui lui appartient,
-- l'admin modère tout.
-- ---------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.offers       enable row level security;
alter table public.comments     enable row level security;
alter table public.reactions    enable row level security;
alter table public.applications enable row level security;
alter table public.placements   enable row level security;
alter table public.mentorships  enable row level security;
alter table public.questions    enable row level security;
alter table public.answers      enable row level security;
alter table public.votes        enable row level security;
alter table public.shortlists   enable row level security;
alter table public.invitations  enable row level security;
alter table public.liens_rdv    enable row level security;
alter table public.annonces     enable row level security;
alter table public.kudos        enable row level security;
alter table public.attestations enable row level security;

do $$
declare t text;
begin
  foreach t in array array['profiles','offers','comments','reactions','applications','placements','mentorships','questions','answers','votes',
                       'shortlists','invitations','kudos','attestations','liens_rdv','annonces'] loop
    execute format('drop policy if exists "lecture membres" on public.%I', t);
    execute format('drop policy if exists "ecriture proprietaire" on public.%I', t);
    execute format('drop policy if exists "modif proprietaire" on public.%I', t);
    execute format('drop policy if exists "suppression proprietaire" on public.%I', t);
  end loop;
end $$;

-- Lecture
create policy "lecture membres" on public.profiles     for select to authenticated using (true);
create policy "lecture membres" on public.offers       for select to authenticated using (true);
create policy "lecture membres" on public.comments     for select to authenticated using (true);
create policy "lecture membres" on public.reactions    for select to authenticated using (true);
create policy "lecture membres" on public.placements   for select to authenticated using (true);
create policy "lecture membres" on public.mentorships  for select to authenticated using (true);
create policy "lecture membres" on public.questions    for select to authenticated using (true);
create policy "lecture membres" on public.answers      for select to authenticated using (true);
create policy "lecture membres" on public.votes        for select to authenticated using (true);
-- Les candidatures sont privées : l'étudiant, l'auteur de l'offre et l'admin
create policy "lecture membres" on public.applications for select to authenticated using (
  student_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.offers o where o.id = offer_id and o.author_id = auth.uid())
);

-- Création
create policy "ecriture proprietaire" on public.profiles     for insert to authenticated with check (id = auth.uid());
create policy "ecriture proprietaire" on public.offers       for insert to authenticated with check (author_id = auth.uid());
create policy "ecriture proprietaire" on public.comments     for insert to authenticated with check (author_id = auth.uid());
create policy "ecriture proprietaire" on public.reactions    for insert to authenticated with check (user_id = auth.uid());
create policy "ecriture proprietaire" on public.applications for insert to authenticated with check (student_id = auth.uid());
create policy "ecriture proprietaire" on public.placements   for insert to authenticated with check (student_id = auth.uid() or laureat_id = auth.uid() or public.is_admin());
create policy "ecriture proprietaire" on public.mentorships  for insert to authenticated with check (student_id = auth.uid());
create policy "ecriture proprietaire" on public.questions    for insert to authenticated with check (author_id = auth.uid());
create policy "ecriture proprietaire" on public.answers      for insert to authenticated with check (author_id = auth.uid());
create policy "ecriture proprietaire" on public.votes        for insert to authenticated with check (user_id = auth.uid());

-- Modification
create policy "modif proprietaire" on public.profiles     for update to authenticated using (id = auth.uid() or public.is_admin());
create policy "modif proprietaire" on public.offers       for update to authenticated using (author_id = auth.uid() or public.is_admin());
create policy "modif proprietaire" on public.comments     for update to authenticated using (author_id = auth.uid());
create policy "modif proprietaire" on public.applications for update to authenticated using (
  student_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.offers o where o.id = offer_id and o.author_id = auth.uid())
);
create policy "modif proprietaire" on public.placements   for update to authenticated using (student_id = auth.uid() or laureat_id = auth.uid() or public.is_admin());
-- Une demande ouverte à tous peut être prise par un lauréat (le premier qui choisit un horaire l'emporte)
create policy "modif proprietaire" on public.mentorships  for update to authenticated using (student_id = auth.uid() or mentor_id = auth.uid() or public.is_admin() or (mentor_id is null and status = 'demande'));
create policy "modif proprietaire" on public.questions    for update to authenticated using (author_id = auth.uid() or public.is_admin());
create policy "modif proprietaire" on public.answers      for update to authenticated using (author_id = auth.uid());

-- Suppression
create policy "suppression proprietaire" on public.profiles     for delete to authenticated using (id = auth.uid() or public.is_admin());
create policy "suppression proprietaire" on public.offers       for delete to authenticated using (author_id = auth.uid() or public.is_admin());
create policy "suppression proprietaire" on public.comments     for delete to authenticated using (author_id = auth.uid() or public.is_admin());
create policy "suppression proprietaire" on public.reactions    for delete to authenticated using (user_id = auth.uid());
create policy "suppression proprietaire" on public.applications for delete to authenticated using (student_id = auth.uid());
create policy "suppression proprietaire" on public.placements   for delete to authenticated using (student_id = auth.uid() or (laureat_id = auth.uid() and status = 'en_attente') or public.is_admin());
create policy "suppression proprietaire" on public.mentorships  for delete to authenticated using (student_id = auth.uid() or public.is_admin());
create policy "suppression proprietaire" on public.questions    for delete to authenticated using (author_id = auth.uid() or public.is_admin());
create policy "suppression proprietaire" on public.answers      for delete to authenticated using (author_id = auth.uid() or public.is_admin());
create policy "suppression proprietaire" on public.votes        for delete to authenticated using (user_id = auth.uid());

-- Nouvelles tables : vivier, bravos, attestations, liens de visio, annonces
-- Shortlist : privée au lauréat
create policy "lecture membres" on public.shortlists for select to authenticated using (laureat_id = auth.uid() or public.is_admin());
create policy "ecriture proprietaire" on public.shortlists for insert to authenticated with check (laureat_id = auth.uid());
create policy "modif proprietaire" on public.shortlists for update to authenticated using (laureat_id = auth.uid());
create policy "suppression proprietaire" on public.shortlists for delete to authenticated using (laureat_id = auth.uid());
-- Invitations : le lauréat qui invite et l'étudiant invité
create policy "lecture membres" on public.invitations for select to authenticated using (laureat_id = auth.uid() or student_id = auth.uid() or public.is_admin());
create policy "ecriture proprietaire" on public.invitations for insert to authenticated with check (laureat_id = auth.uid());
create policy "modif proprietaire" on public.invitations for update to authenticated using (student_id = auth.uid() or laureat_id = auth.uid() or public.is_admin());
create policy "suppression proprietaire" on public.invitations for delete to authenticated using (laureat_id = auth.uid() or public.is_admin());
-- Liens de visio : l'étudiant et le lauréat du rendez-vous ; le lauréat peut mettre son propre lien (Meet, Teams…)
create policy "lecture membres" on public.liens_rdv for select to authenticated using (public.is_admin()
  or exists (select 1 from public.mentorships m where m.id = liens_rdv.id and (m.student_id = auth.uid() or m.mentor_id = auth.uid())));
create policy "ecriture proprietaire" on public.liens_rdv for insert to authenticated with check (
  exists (select 1 from public.mentorships m where m.id = liens_rdv.id and m.mentor_id = auth.uid()));
create policy "modif proprietaire" on public.liens_rdv for update to authenticated using (
  exists (select 1 from public.mentorships m where m.id = liens_rdv.id and m.mentor_id = auth.uid()));
-- Annonces : tout le monde les lit, l'administration les écrit
create policy "lecture membres" on public.annonces for select to authenticated using (true);
create policy "ecriture proprietaire" on public.annonces for insert to authenticated with check (public.is_admin());
create policy "modif proprietaire" on public.annonces for update to authenticated using (public.is_admin());
create policy "suppression proprietaire" on public.annonces for delete to authenticated using (public.is_admin());
-- Bravos
create policy "lecture membres" on public.kudos for select to authenticated using (true);
create policy "ecriture proprietaire" on public.kudos for insert to authenticated with check (user_id = auth.uid());
create policy "suppression proprietaire" on public.kudos for delete to authenticated using (user_id = auth.uid());
-- Attestations : le lauréat ; la vérification publique passe par attestation_publique()
create policy "lecture membres" on public.attestations for select to authenticated using (laureat_id = auth.uid() or public.is_admin());
create policy "ecriture proprietaire" on public.attestations for insert to authenticated with check (laureat_id = auth.uid() or public.is_admin());
create policy "suppression proprietaire" on public.attestations for delete to authenticated using (laureat_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- Temps réel : la plateforme se met à jour toute seule chez tout le monde
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['profiles','offers','comments','reactions','applications','placements','mentorships','questions','answers','votes',
                       'shortlists','invitations','kudos','attestations','liens_rdv','annonces'] loop
      if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- =====================================================================
-- APRÈS votre inscription sur la plateforme, devenez administrateur :
--   update public.profiles set role = 'admin', verified = true
--   where id = (select id from auth.users where email = 'VOTRE_EMAIL');
-- =====================================================================
