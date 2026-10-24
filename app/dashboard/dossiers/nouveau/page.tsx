import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { estResponsableLeads, peutRelierLeadAuClient } from '@/lib/leads-acces'
import { peutGererSessions } from '@/lib/sessions-acces'
import { NouveauDossierWizard } from './NouveauDossierWizard'

export const dynamic = 'force-dynamic'

/**
 * Nouveau dossier en un geste : client → apprenants → formation → la session
 * est créée avec ses inscriptions. Le circuit commercial direct — les leads
 * restent réservés aux demandes entrantes du site web.
 */
export default async function NouveauDossierPage({ searchParams }: { searchParams?: { lead?: string } }) {
  const session = await getSession()
  // L'assistant crée une session : sans ce droit, il ne servirait qu'à tout saisir pour rien
  if (!peutGererSessions(session, 'create')) {
    return (
      <div className="max-w-3xl mx-auto animate-fade-in">
        <div className="card p-6 text-sm text-surface-700">
          Vous n’avez pas le droit de créer des sessions : un responsable peut monter ce dossier.{' '}
          <Link href="/dashboard/leads" className="font-semibold text-brand-600 hover:underline">Retour aux leads</Link>
        </div>
      </div>
    )
  }
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  // Depuis la page Leads (« Créer le dossier ») : l'assistant part des coordonnées du lead
  const leadId = typeof searchParams?.lead === 'string' && /^[0-9a-f-]{36}$/i.test(searchParams.lead) ? searchParams.lead : null
  const { data: leadLu } = leadId
    ? await supabase.from('leads')
        .select('id, entreprise, siret, contact_prenom, contact_nom, contact_email, contact_telephone, adresse, code_postal, ville, converted_client_id, source, created_at, assigned_to, session_id')
        .eq('id', leadId).eq('organization_id', orgId).maybeSingle()
    : { data: null }
  // Un commercial ne monte que le dossier d'un lead à lui ou que personne ne suit (même règle que l'action) :
  // il le sait dès l'ouverture, pas après avoir tout saisi
  const leadRefuse = !!leadLu && !estResponsableLeads(session.user.role)
    && !!(leadLu as any).assigned_to && (leadLu as any).assigned_to !== session.user.id
  // Un lead n'a qu'un dossier : s'il l'a déjà, l'assistant s'ouvre sans lui, avec le lien vers sa session
  const sessionDuLead: string | null = !leadRefuse && (leadLu as any)?.session_id ? (leadLu as any).session_id : null
  const lead = leadRefuse || sessionDuLead ? null : leadLu

  // Le client du lead, comme à la conversion : celui déjà relié, puis le même SIRET ; même société
  // (même SIREN) sous un autre SIRET, c'est à l'utilisateur de choisir l'établissement
  const CHAMPS_CLIENT = 'id, raison_sociale, nom_commercial, siret, ville'
  let clientDuLead: any = null
  let candidatsSiren: any[] = []
  if (lead) {
    if ((lead as any).converted_client_id) {
      const { data } = await supabase.from('clients').select(CHAMPS_CLIENT)
        .eq('id', (lead as any).converted_client_id).eq('organization_id', orgId).maybeSingle()
      if (data) clientDuLead = { ...data, motif: 'relie' }
    }
    const siret = String((lead as any).siret || '').replace(/\D/g, '')
    if (!clientDuLead && siret.length >= 9) {
      const { data: memeSociete } = await supabase.from('clients').select(CHAMPS_CLIENT)
        .eq('organization_id', orgId).like('siret', `${siret.slice(0, 9)}%`)
      const liste = ((memeSociete || []) as any[]).filter((c) => String(c.siret || '').replace(/\D/g, '').startsWith(siret.slice(0, 9)))
      const exact = siret.length === 14 ? liste.find((c) => String(c.siret || '').replace(/\D/g, '') === siret) : null
      if (exact) clientDuLead = { ...exact, motif: 'siret' }
      else candidatsSiren = liste
    }
    // Un commercial ne relie le lead qu'à un client qu'il suit (portefeuille) : sinon le dossier se crée sans ce lien
    if (clientDuLead) clientDuLead.lienPossible = await peutRelierLeadAuClient(supabase, session, lead as any, clientDuLead.id)
  }

  const [{ data: clients }, { data: formations }, { data: formateurs }] = await Promise.all([
    supabase.from('clients')
      .select('id, raison_sociale, nom_commercial, siret, ville')
      .eq('organization_id', orgId).eq('type', 'entreprise')
      .order('raison_sociale'),
    // Une POEI ne passe pas par un dossier OPCO : elle se crée dans le module POEI
    supabase.from('formations')
      .select('id, intitule, duree_heures, duree_jours')
      .eq('organization_id', orgId).eq('is_active', true).or('is_poei.is.null,is_poei.eq.false')
      .order('intitule'),
    supabase.from('formateurs')
      .select('id, prenom, nom')
      .eq('organization_id', orgId).eq('is_active', true)
      .order('nom'),
  ])

  // Le client du lead et les établissements de la même société figurent dans la liste, même hors du type entreprise
  const listeClients = ((clients || []) as any[]).slice()
  for (const c of [clientDuLead, ...candidatsSiren].filter(Boolean)) {
    if (!listeClients.some((x) => x.id === c.id)) listeClients.push({ id: c.id, raison_sociale: c.raison_sociale, nom_commercial: c.nom_commercial, siret: c.siret, ville: c.ville })
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <NouveauDossierWizard
        clients={listeClients}
        formations={(formations || []) as any[]}
        formateurs={(formateurs || []) as any[]}
        depuisLead={(lead as any) || null}
        clientDuLead={clientDuLead ? { id: clientDuLead.id, motif: clientDuLead.motif, lienPossible: !!clientDuLead.lienPossible } : null}
        candidatsSiren={candidatsSiren.map((c) => c.id)}
        leadRefuse={leadRefuse}
        sessionDuLead={sessionDuLead}
      />
    </div>
  )
}
