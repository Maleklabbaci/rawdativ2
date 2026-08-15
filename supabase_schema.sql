-- RAWDATI v2 — Schéma Supabase
-- À copier-coller en une fois dans Supabase Dashboard -> SQL Editor -> New query -> Run

create table if not exists enfants (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists presences (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists paiements (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists personnel (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists classes (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists activites (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists repas (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists comptes (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists discussion_messages (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists parametres (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

-- ⚠️ Active la sécurité ligne par ligne (RLS) puis autorise tout pour l'instant.
-- ⚠️ CE BLOC EST VOLONTAIREMENT PERMISSIF SEULEMENT POUR LA CRÉATION INITIALE
-- DES TABLES. Une fois les tables créées, lance obligatoirement le fichier
-- supabase_rls_migration.sql qui remplace ces policies "allow all" par de
-- vraies règles d'isolation entre crèches (sinon toutes les crèches clientes
-- peuvent lire/modifier les données de toutes les autres via l'API directe).
alter table enfants enable row level security;
alter table presences enable row level security;
alter table paiements enable row level security;
alter table personnel enable row level security;
alter table classes enable row level security;
alter table activites enable row level security;
alter table repas enable row level security;
alter table comptes enable row level security;
alter table discussion_messages enable row level security;
alter table parametres enable row level security;

create policy "allow all enfants" on enfants for all using (true) with check (true);
create policy "allow all presences" on presences for all using (true) with check (true);
create policy "allow all paiements" on paiements for all using (true) with check (true);
create policy "allow all personnel" on personnel for all using (true) with check (true);
create policy "allow all classes" on classes for all using (true) with check (true);
create policy "allow all activites" on activites for all using (true) with check (true);
create policy "allow all repas" on repas for all using (true) with check (true);
create policy "allow all comptes" on comptes for all using (true) with check (true);
create policy "allow all discussion_messages" on discussion_messages for all using (true) with check (true);
create policy "allow all parametres" on parametres for all using (true) with check (true);
