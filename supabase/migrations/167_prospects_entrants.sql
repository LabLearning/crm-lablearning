-- ============================================================
-- 167 — Prospects entrants : site, Meta (Facebook, Instagram), Google Ads
--
-- Demande de Brahim du 24/10/2026 : lancer des campagnes de prospects sur
-- Meta, recevoir chaque prospect dans le CRM, anticiper Google Ads, et
-- refaire la page Leads : les leads viennent du site ou des publicités.
--
-- 1. Deux origines de plus pour un lead : meta_ads et google_ads.
-- 2. Sur le lead : ce que le prospect a rempli (reponses), d'où il vient
--    (attribution : campagne, annonce, formulaire, identifiants de clic),
--    et l'heure du premier contact (contacte_le, délai de rappel).
-- 3. prospects_recus : journal de chaque prospect reçu d'un canal, une seule
--    fois (identifiant du prospect chez Meta ou Google) ; garde aussi les
--    réponses des clients déjà connus, qui ne deviennent pas des leads.
-- 4. canaux_prospects : branchement de Meta et de Google Ads (Page suivie,
--    jetons chiffrés, clé du webhook, dernière réception, dernière erreur).
-- 5. envois_formulaires_site : chaque envoi de la page Contact noté avant
--    d'être traité (jeton de page à usage unique, plafonds anti-robots).
-- À coller d'un bloc dans l'éditeur SQL de Supabase.
-- ============================================================

ALTER TYPE public.lead_source ADD VALUE IF NOT EXISTS 'meta_ads';
ALTER TYPE public.lead_source ADD VALUE IF NOT EXISTS 'google_ads';

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS reponses jsonb,
  ADD COLUMN IF NOT EXISTS attribution jsonb,
  ADD COLUMN IF NOT EXISTS contacte_le timestamptz,
  ADD COLUMN IF NOT EXISTS derniere_demande_le timestamptz;

COMMENT ON COLUMN public.leads.reponses IS
  'Réponses du prospect au premier formulaire (site, Meta, Google Ads) : [{ question, reponse }] ; les suivantes sont au journal prospects_recus';
COMMENT ON COLUMN public.leads.attribution IS
  'Origine du prospect : canal, campagne, annonce, formulaire, plateforme, identifiants de clic (gclid, fbclid), UTM';
COMMENT ON COLUMN public.leads.contacte_le IS
  'Premier contact avec le prospect (échange noté ou passage à « contacté »), pour mesurer le délai de rappel';
COMMENT ON COLUMN public.leads.derniere_demande_le IS
  'Dernière demande reçue d''un canal (site, Meta, Google Ads) : tri de la page Leads, prospect qui revient';

-- Premier contact des leads déjà joints avant cette migration : le premier appel, e-mail ou rendez-vous noté
-- (sans cela, un échange noté plus tard serait pris pour le premier contact et fausserait le délai)
UPDATE public.leads l
SET contacte_le = i.premier
FROM (
  SELECT lead_id, min(date) AS premier
  FROM public.lead_interactions
  WHERE type IN ('appel', 'email', 'rdv') AND date IS NOT NULL
  GROUP BY lead_id
) i
WHERE l.id = i.lead_id AND l.contacte_le IS NULL AND l.status <> 'nouveau';

CREATE TABLE IF NOT EXISTS public.prospects_recus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  canal text NOT NULL CHECK (canal IN ('site', 'meta', 'google_ads')),
  -- Identifiant du prospect chez le canal (leadgen_id Meta, lead_id Google) : une seule réception
  externe_id text,
  recu_le timestamptz NOT NULL DEFAULT now(),
  -- Envoi du formulaire chez le canal
  soumis_le timestamptz,
  -- Prise en main du traitement (reprise d'une réception interrompue après 2 minutes)
  traite_le timestamptz NOT NULL DEFAULT now(),
  statut text NOT NULL CHECK (statut IN ('en_cours', 'lead_cree', 'lead_complete', 'client_connu', 'test', 'erreur')),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  -- Nom et établissement, pour la liste des réceptions
  resume text,
  -- Réponses et origine telles que reçues, pour rejouer une réception en erreur
  donnees jsonb,
  erreur text,
  tentatives integer NOT NULL DEFAULT 1,
  UNIQUE (organization_id, canal, externe_id)
);

CREATE INDEX IF NOT EXISTS prospects_recus_org_recu_idx ON public.prospects_recus (organization_id, recu_le DESC);
CREATE INDEX IF NOT EXISTS prospects_recus_lead_idx ON public.prospects_recus (lead_id);

CREATE TABLE IF NOT EXISTS public.canaux_prospects (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  canal text NOT NULL CHECK (canal IN ('meta', 'google_ads')),
  actif boolean NOT NULL DEFAULT false,
  -- Meta : page_id, page_nom, app_id ; Google Ads : rien d'obligatoire
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Jetons et clés, chiffrés (lib/prospects/coffre) : jamais lus par le navigateur
  secrets jsonb,
  -- Meta : jeton de vérification du webhook (hub.verify_token), sans valeur secrète
  cle_verification text,
  derniere_reception_at timestamptz,
  dernier_releve_at timestamptz,
  derniere_erreur text,
  derniere_erreur_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, canal)
);

-- Envois de la page Contact, notés AVANT d'être traités : le jeton de la page ne sert qu'une fois, et les
-- plafonds (par heure, par jour, par adresse IP) se comptent sur ces lignes, si bien que des envois simultanés
-- ne passent pas tous. Empreintes seulement (ni jeton ni adresse IP en clair) ; lignes effacées après 48 h
CREATE TABLE IF NOT EXISTS public.envois_formulaires_site (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  formulaire text NOT NULL,
  empreinte_jeton text NOT NULL,
  empreinte_ip text,
  cree_le timestamptz NOT NULL DEFAULT now(),
  UNIQUE (formulaire, empreinte_jeton)
);
CREATE INDEX IF NOT EXISTS envois_formulaires_site_idx ON public.envois_formulaires_site (formulaire, cree_le DESC);

-- Lecture et écriture par la clé de service uniquement (migration 164)
ALTER TABLE public.prospects_recus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canaux_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.envois_formulaires_site ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.prospects_recus FROM anon, authenticated;
REVOKE ALL ON public.canaux_prospects FROM anon, authenticated;
REVOKE ALL ON public.envois_formulaires_site FROM anon, authenticated;
REVOKE ALL ON public.leads FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
