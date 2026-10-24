import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { URL_WEBHOOK_META } from '@/lib/prospects/meta'
import { URL_WEBHOOK_GOOGLE } from '@/lib/prospects/google-ads'
import { CanauxClient } from './CanauxClient'

export const dynamic = 'force-dynamic'
// Le branchement et « Rattraper les 90 derniers jours » relisent chaque prospect chez Meta un par un :
// au-delà du délai par défaut, l'action serait coupée (le relevé des 10 minutes finirait le travail)
export const maxDuration = 300

/**
 * Canaux de prospects : brancher les formulaires publicitaires Meta et
 * Google Ads, et suivre les dernières réceptions. Réservé au super
 * administrateur (jetons et clés). Aucun secret ne part au navigateur.
 */
export default async function CanauxPage() {
  const session = await getSession()
  if (session.user.role !== 'super_admin') redirect('/dashboard/leads')
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const [canauxRes, receptionsRes] = await Promise.all([
    supabase.from('canaux_prospects')
      .select('canal, actif, config, cle_verification, derniere_reception_at, dernier_releve_at, derniere_erreur, derniere_erreur_at, updated_at')
      .eq('organization_id', orgId),
    supabase.from('prospects_recus')
      .select('id, canal, recu_le, statut, resume, erreur, lead_id, client_id, tentatives, evenement:donnees->>evenement')
      .eq('organization_id', orgId).order('recu_le', { ascending: false }).limit(30),
  ])
  const migrationManquante = !!canauxRes.error
  const canaux = ((canauxRes.data || []) as any[])
  const meta = canaux.find((c) => c.canal === 'meta')
  const google = canaux.find((c) => c.canal === 'google_ads')

  return (
    <div className="animate-fade-in">
      <CanauxClient
        migrationManquante={migrationManquante}
        meta={meta ? {
          actif: !!meta.actif,
          pageNom: meta.config?.page_nom || null,
          pageId: meta.config?.page_id || null,
          appId: meta.config?.app_id || null,
          connecteLe: meta.config?.connecte_le || null,
          derniereReception: meta.derniere_reception_at,
          dernierReleve: meta.dernier_releve_at,
          erreur: meta.derniere_erreur,
          erreurLe: meta.derniere_erreur_at,
        } : null}
        google={google ? {
          actif: !!google.actif && !!google.cle_verification,
          cleCreeeLe: google.config?.cle_creee_le || null,
          derniereReception: google.derniere_reception_at,
          erreur: google.derniere_erreur,
          erreurLe: google.derniere_erreur_at,
        } : null}
        receptions={(((receptionsRes as any).error ? [] : receptionsRes.data) || []).map((r: any) => ({
          id: r.id, canal: r.canal, recuLe: r.recu_le, statut: r.statut, resume: r.resume, erreur: r.erreur,
          leadId: r.lead_id, clientId: r.client_id, tentatives: r.tentatives, evenement: r.evenement || null,
        }))}
        urlWebhookMeta={URL_WEBHOOK_META}
        urlWebhookGoogle={URL_WEBHOOK_GOOGLE}
      />
    </div>
  )
}
