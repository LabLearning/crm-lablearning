-- Surveillance du CRM (app/api/cron/sante) : dernière vérification réussie,
-- et historique des pannes. Niveau plateforme, pas de donnée d'organisation.
-- Sans ces tables, l'alerte de panne part quand même ; seul le message
-- « le CRM répond de nouveau » manque.

create table if not exists public.sante_plateforme (
  id text primary key,
  dernier_ok timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.incidents_plateforme (
  id uuid primary key default gen_random_uuid(),
  debut timestamptz not null unique,   -- dernière vérification réussie avant la panne
  fin timestamptz not null,            -- première vérification réussie après
  minutes integer not null,
  created_at timestamptz not null default now()
);

-- Lecture et écriture par la clé de service uniquement
alter table public.sante_plateforme enable row level security;
alter table public.incidents_plateforme enable row level security;
