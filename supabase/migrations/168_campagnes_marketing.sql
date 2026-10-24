-- ============================================================
-- 168 — Campagnes marketing : e-mail et SMS envoyés depuis le CRM
--
-- Demande de Brahim du 24/10/2026 : un onglet « Campagnes » pour envoyer des
-- campagnes d'e-mails et de SMS aux prospects et aux clients. Envoi par Brevo
-- (clé BREVO_API_KEY, variables d'environnement de Vercel).
--
-- 1. campagnes : la campagne (canal, contenu, audience, programmation,
--    compteurs).
-- 2. campagne_envois : un destinataire par ligne, figé au lancement
--    (statut, identifiant du message chez Brevo, erreur).
-- 3. oppositions_marketing : les personnes qui ne veulent plus rien recevoir
--    (lien de désinscription, STOP, rebond, case du formulaire, demande) :
--    jamais d'envoi vers elles, quel que soit la campagne.
-- À coller d'un bloc dans l'éditeur SQL de Supabase (après la 167).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.campagnes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nom text NOT NULL,
  canal text NOT NULL CHECK (canal IN ('email', 'sms')),
  statut text NOT NULL DEFAULT 'brouillon'
    CHECK (statut IN ('brouillon', 'programmee', 'en_cours', 'envoyee', 'annulee')),
  -- E-mail : objet et texte (mis en page aux couleurs de Lab Learning) ; SMS : le message
  objet text,
  contenu text NOT NULL DEFAULT '',
  -- Bouton facultatif de l'e-mail : libellé et adresse
  bouton_libelle text,
  bouton_url text,
  -- Audience : filtres choisis à l'écran (sources, origines, étapes, départements…)
  audience jsonb NOT NULL DEFAULT '{}'::jsonb,
  programmee_le timestamptz,
  lancee_le timestamptz,
  terminee_le timestamptz,
  nb_destinataires integer NOT NULL DEFAULT 0,
  nb_envoyes integer NOT NULL DEFAULT 0,
  nb_echecs integer NOT NULL DEFAULT 0,
  nb_desinscrits integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campagnes_org_idx ON public.campagnes (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.campagne_envois (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campagne_id uuid NOT NULL REFERENCES public.campagnes(id) ON DELETE CASCADE,
  -- Qui : un lead ou un contact de client (le lien sert à l'historique de la fiche)
  personne_type text NOT NULL CHECK (personne_type IN ('lead', 'contact')),
  personne_id uuid,
  nom text,
  -- Adresse e-mail ou numéro (format international sans « + ») selon le canal
  destination text NOT NULL,
  -- en_cours : réservé par un passage de la tâche planifiée, le temps de l'envoi
  statut text NOT NULL DEFAULT 'a_envoyer' CHECK (statut IN ('a_envoyer', 'en_cours', 'envoye', 'echec', 'exclu')),
  message_id text,
  erreur text,
  envoye_le timestamptz,
  UNIQUE (campagne_id, destination)
);
CREATE INDEX IF NOT EXISTS campagne_envois_a_envoyer_idx ON public.campagne_envois (campagne_id, statut);
CREATE INDEX IF NOT EXISTS campagne_envois_message_idx ON public.campagne_envois (message_id);

CREATE TABLE IF NOT EXISTS public.oppositions_marketing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  canal text NOT NULL CHECK (canal IN ('email', 'sms')),
  -- E-mail en minuscules, ou téléphone réduit à ses 9 derniers chiffres
  valeur text NOT NULL,
  source text NOT NULL CHECK (source IN ('lien_desinscription', 'stop_sms', 'rebond', 'plainte', 'formulaire', 'demande', 'manuel')),
  detail text,
  cree_le timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, canal, valeur)
);

-- Lecture et écriture par la clé de service uniquement (migration 164)
ALTER TABLE public.campagnes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campagne_envois ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oppositions_marketing ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.campagnes FROM anon, authenticated;
REVOKE ALL ON public.campagne_envois FROM anon, authenticated;
REVOKE ALL ON public.oppositions_marketing FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
