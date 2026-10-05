'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import type { ActionResult } from '@/lib/types'
import { peutVoirTresorerie } from '@/lib/tresorerie'
import { banqueDeLOrganisme } from '@/lib/tresorerie-banque'
import { chargerRapprochements, referencePaiement, type Proposition } from '@/lib/rapprochement-formateurs'

/** Le rapprochement lit la banque : il est réservé aux rôles qui voient la trésorerie. */
async function propositionsDuJour() {
  const session = await getSession()
  if (!peutVoirTresorerie(session.user.role)) return { erreur: 'Accès non autorisé' as string }
  const supabase = await createServiceRoleClient()
  const { banque, erreur } = await banqueDeLOrganisme(supabase, session.organization.id)
  if (!banque) return { erreur: erreur || 'Qonto n’est pas relié' }
  const { propositions } = await chargerRapprochements(supabase, session.organization.id, banque)
  return { session, supabase, propositions }
}

/** Marque une facture payée par le virement qui la solde. Sans effet si elle a changé de statut entre-temps. */
async function solder(supabase: any, organizationId: string, p: Proposition): Promise<boolean> {
  const { data, error } = await supabase
    .from('factures_formateur')
    .update({ status: 'payee', date_paiement: p.virement.jour, reference_paiement: referencePaiement(p.virement), updated_at: new Date().toISOString() })
    .eq('id', p.facture.id).eq('organization_id', organizationId).in('status', ['envoyee', 'validee'])
    .select('id')
  if (error || !data?.length) return false
  await logAudit({
    action: 'update_facture_formateur', entity_type: 'facture_formateur', entity_id: p.facture.id,
    details: { status: 'payee', ancien_statut: p.facture.status, rapprochement: p.motif, virement: p.virement.id, date_virement: p.virement.jour, montant: p.virement.montant },
  })
  return true
}

/**
 * Marque payées toutes les factures dont le virement est sûr : il cite la
 * facture ou son client, et il en a le montant. Les propositions sont
 * recalculées ici : rien de ce que le navigateur envoie n'est cru.
 */
export async function appliquerRapprochementsAction(): Promise<ActionResult<{ nb: number; total: number }>> {
  const ctx = await propositionsDuJour()
  if ('erreur' in ctx) return { success: false, error: ctx.erreur }
  let nb = 0
  let total = 0
  for (const p of ctx.propositions.filter((x) => x.sur)) {
    if (await solder(ctx.supabase, ctx.session.organization.id, p)) { nb++; total += p.facture.montantTtc }
  }
  revalidatePath('/dashboard/factures-formateurs')
  return { success: true, data: { nb, total: Math.round(total * 100) / 100 } }
}

/** Confirme un rapprochement proposé (sûr ou à confirmer) : la paire facture-virement doit figurer dans les propositions du moment. */
export async function confirmerRapprochementAction(factureId: string, virementId: string): Promise<ActionResult> {
  const ctx = await propositionsDuJour()
  if ('erreur' in ctx) return { success: false, error: ctx.erreur }
  const p = ctx.propositions.find((x) => x.facture.id === factureId && x.virement.id === virementId)
  if (!p) return { success: false, error: 'Ce rapprochement n’est plus proposé : rechargez la page' }
  if (!(await solder(ctx.supabase, ctx.session.organization.id, p))) return { success: false, error: 'La facture a changé de statut entre-temps' }
  revalidatePath('/dashboard/factures-formateurs')
  return { success: true }
}

/** Annule un paiement enregistré : la facture revient « validée » (ou « à valider » si elle ne l'avait jamais été) et son virement redevient disponible. */
export async function annulerPaiementFactureFormateurAction(factureId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire', 'comptable'].includes(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()
  const { data: fac } = await supabase
    .from('factures_formateur').select('id, formateur_id, status, validated_at, date_paiement, reference_paiement')
    .eq('id', factureId).eq('organization_id', session.organization.id).maybeSingle()
  if (!fac) return { success: false, error: 'Facture introuvable' }
  if (fac.status !== 'payee') return { success: false, error: 'Cette facture n’est pas marquée payée' }

  const { error } = await supabase
    .from('factures_formateur')
    .update({ status: fac.validated_at ? 'validee' : 'envoyee', date_paiement: null, reference_paiement: null, updated_at: new Date().toISOString() })
    .eq('id', factureId).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur lors de l’annulation' }

  await logAudit({
    action: 'update_facture_formateur', entity_type: 'facture_formateur', entity_id: factureId,
    details: { status: fac.validated_at ? 'validee' : 'envoyee', ancien_statut: 'payee', paiement_annule: { date: fac.date_paiement, reference: fac.reference_paiement } },
  })
  revalidatePath('/dashboard/factures-formateurs')
  revalidatePath(`/dashboard/formateurs/${fac.formateur_id}`)
  return { success: true }
}
