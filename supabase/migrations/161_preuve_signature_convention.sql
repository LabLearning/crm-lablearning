-- ============================================================
-- 161 — Dossier de preuve des signatures électroniques de convention
--
-- Le certificat de signature d'une convention s'appuie sur des preuves
-- captées au moment de la signature. Jusqu'ici :
--   - signature_client_date est la date PORTÉE sur la convention (ramenée à
--     la veille de la session quand le client signe tard) : ce n'est pas
--     l'horodatage de l'acte ;
--   - le PDF signé n'était pas conservé, seulement régénéré à la demande ;
--   - rien ne gardait l'ouverture du lien, la consultation du document ni
--     le consentement, et l'annulation effaçait tout.
--
-- Ajouts :
--   - conventions.signature_client_signed_at : horodatage réel, posé par le
--     serveur à l'instant de la signature, jamais modifié ensuite ;
--   - conventions.signature_document_path / _sha256 : exemplaire PDF figé à
--     la signature (bucket privé documents) et son empreinte SHA-256 ;
--   - conventions.signature_consentement : texte de la case cochée ;
--   - convention_signature_evenements : journal des événements (lien ouvert,
--     document consulté, signature, annulation), en ajout seul, qui survit à
--     l'annulation d'une signature.
-- ============================================================

ALTER TABLE public.conventions
  ADD COLUMN IF NOT EXISTS signature_client_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signature_document_path text,
  ADD COLUMN IF NOT EXISTS signature_document_sha256 text,
  ADD COLUMN IF NOT EXISTS signature_consentement text;

COMMENT ON COLUMN public.conventions.signature_client_signed_at IS 'Horodatage réel de la signature du client (serveur). signature_client_date est la date portée sur la convention.';
COMMENT ON COLUMN public.conventions.signature_document_sha256 IS 'Empreinte SHA-256 de l''exemplaire PDF figé au moment de la signature (signature_document_path).';

CREATE TABLE IF NOT EXISTS public.convention_signature_evenements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  convention_id uuid NOT NULL REFERENCES public.conventions(id) ON DELETE CASCADE,
  evenement text NOT NULL CHECK (evenement IN ('lien_ouvert', 'document_consulte', 'signature', 'annulation')),
  survenu_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conv_sig_evt_convention ON public.convention_signature_evenements(convention_id, survenu_at);
ALTER TABLE public.convention_signature_evenements ENABLE ROW LEVEL SECURITY;

-- Reprise de l'historique : l'horodatage réel des signatures déjà faites est
-- celui de la notification « Convention signée par le client », créée par le
-- serveur à l'instant même de la signature (la plus récente, en cas de
-- nouvelle signature après une annulation).
UPDATE public.conventions c
SET signature_client_signed_at = n.created_at
FROM (
  SELECT entity_id, max(created_at) AS created_at
  FROM public.notifications
  WHERE entity_type = 'convention' AND titre = 'Convention signée par le client'
  GROUP BY entity_id
) n
WHERE n.entity_id::text = c.id::text
  AND c.signature_client_signed_at IS NULL
  AND c.signature_client_signature_data IS NOT NULL;

NOTIFY pgrst, 'reload schema';
