import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, GraduationCap, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui'
import { POEI_STATUS_LABELS, POEI_STATUS_COLORS } from '@/lib/types/poei'
import { formatDate } from '@/lib/utils'
import { PoeiStatusBar } from './PoeiStatusBar'
import { PoeiEditor } from './PoeiEditor'
import { PoeiCandidats } from './PoeiCandidats'
import { PoeiEmailHistory } from './PoeiEmailHistory'
import { PoeiInterventions } from './PoeiInterventions'
import type { Poei, PoeiCandidat } from '@/lib/types/poei'

export const dynamic = 'force-dynamic'

export default async function PoeiDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: poei } = await supabase
    .from('poei')
    .select(`*, client:clients(raison_sociale), formation:formations(intitule), session:sessions(id, reference, date_debut, date_fin)`)
    .eq('id', params.id)
    .eq('organization_id', session.organization.id)
    .single()

  if (!poei) redirect('/dashboard/poei')
  const p = poei as Poei

  const [{ data: candidatsRaw }, { data: clients }, { data: formations }, { data: apprenants }, { data: emailLogs }] = await Promise.all([
    supabase
      .from('poei_candidats')
      .select('*, apprenant:apprenants(nom, prenom, email, telephone, date_naissance)')
      .eq('poei_id', params.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('clients').select('id, raison_sociale').eq('organization_id', session.organization.id).order('raison_sociale'),
    supabase
      .from('formations').select('id, intitule').eq('organization_id', session.organization.id).eq('is_active', true).order('intitule'),
    // Apprenants de l'établissement du projet (client) — pas tout le monde.
    // Repli sur toute l'org si le projet n'a pas encore de client lié.
    (p.client_id
      ? supabase.from('apprenants').select('id, nom, prenom, email').eq('organization_id', session.organization.id).eq('client_id', p.client_id).order('nom')
      : supabase.from('apprenants').select('id, nom, prenom, email').eq('organization_id', session.organization.id).order('nom').limit(1000)),
    // Tous les emails envoyés pour ce projet (historique + statut attestations)
    supabase
      .from('email_logs')
      .select('id, to_email, to_name, subject, template, status, error, sent_at, created_at')
      .eq('organization_id', session.organization.id)
      .eq('entity_type', 'poei')
      .eq('entity_id', params.id)
      .order('created_at', { ascending: false }),
  ])
  const candidats = (candidatsRaw || []) as PoeiCandidat[]

  // Interventions formateurs (plusieurs formateurs possibles sur un POEI)
  const [{ data: interventions }, { data: formateursList }] = await Promise.all([
    supabase
      .from('poei_interventions')
      .select('*, formateur:formateurs(prenom, nom), contrat:contrats_formateur(id, numero, status, signature_formateur_date)')
      .eq('poei_id', params.id)
      .order('ordre', { ascending: true })
      .order('date_debut', { ascending: true }),
    supabase
      .from('formateurs')
      .select('id, prenom, nom, tarif_journalier, zone_intervention')
      .eq('organization_id', session.organization.id)
      .eq('is_active', true)
      .order('nom'),
  ])

  // Devis POEI existants → map candidat_id → devis (pour le bouton de téléchargement par personne)
  const { data: devisPoei } = await supabase
    .from('devis')
    .select('id, numero, notes_internes')
    .eq('organization_id', session.organization.id)
    .ilike('notes_internes', `%[POEI:${params.id}:%`)
  const devisByCandidat: Record<string, { id: string; numero: string | null }> = {}
  for (const d of devisPoei || []) {
    const m = (d.notes_internes || '').match(new RegExp(`\\[POEI:${params.id}:([^\\]]+)\\]`))
    if (m) devisByCandidat[m[1]] = { id: d.id, numero: d.numero }
  }

  // Dernier statut d'envoi d'attestation par adresse email (le plus récent gagne)
  const emailStatus: Record<string, { status: string; date: string | null }> = {}
  for (const log of (emailLogs || []).filter((l: any) => l.template === 'attestation_entree')) {
    const key = (log.to_email || '').toLowerCase()
    if (key && !emailStatus[key]) emailStatus[key] = { status: log.status, date: log.sent_at || log.created_at }
  }

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl">
      <div>
        <Link href="/dashboard/poei" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-800 mb-3">
          <ArrowLeft className="h-4 w-4" /> Retour aux POEI
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-surface-900 inline-flex items-center gap-2">
              <Building2 className="h-5 w-5 text-sky-500" />
              {p.client?.raison_sociale || 'Projet POEI'}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-surface-500">
              <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 text-xs font-semibold">POEI</span>
              <span className="font-mono">{p.numero}</span>
              <Badge variant={POEI_STATUS_COLORS[p.statut]} dot>{POEI_STATUS_LABELS[p.statut]}</Badge>
              {p.formation?.intitule && <span className="inline-flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" /> {p.formation.intitule}</span>}
              {p.date_debut && <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {formatDate(p.date_debut, { day: '2-digit', month: 'short' })}{p.date_fin ? ' → ' + formatDate(p.date_fin, { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</span>}
            </div>
          </div>
        </div>
      </div>

      <PoeiStatusBar poeiId={p.id} statut={p.statut} />

      <PoeiInterventions
        poeiId={p.id}
        interventions={((interventions || []) as any[]).map((iv) => ({
          ...iv,
          contrat: Array.isArray(iv.contrat) ? iv.contrat[0] || null : iv.contrat || null,
        }))}
        formateurs={(formateursList || []) as any[]}
        dureeTotale={p.duree_heures}
      />

      <PoeiCandidats poeiId={p.id} candidats={candidats} apprenants={apprenants || []} emailStatus={emailStatus} clientNom={p.client?.raison_sociale || null} clientId={p.client_id} devisByCandidat={devisByCandidat} />

      <PoeiEmailHistory logs={(emailLogs || []) as any[]} />

      <PoeiEditor poei={p} clients={clients || []} formations={formations || []} nbCandidats={candidats.length} />
    </div>
  )
}
