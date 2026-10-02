import Link from 'next/link'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { resolveFormateur } from '../_formateur/guard'
import { PoeiGrillesFormateur } from './PoeiGrillesFormateur'
import { PoeiIncidentsFormateur } from './PoeiIncidentsFormateur'
import { appreciationsPourClient } from '@/lib/poei-bilan-ft'

export const dynamic = 'force-dynamic'

export default async function MonEspacePoeiPage() {
  const { formateurId, organizationId } = await resolveFormateur()
  const supabase = await createServiceRoleClient()

  // POEI où le formateur intervient
  const { data: itv } = await supabase
    .from('poei_interventions')
    .select('poei_id')
    .eq('formateur_id', formateurId)
    .eq('organization_id', organizationId)
  const poeiIds = [...new Set((itv || []).map((i: any) => i.poei_id).filter(Boolean))]

  if (poeiIds.length === 0) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading mb-2">Évaluations POEI</h1>
        <div className="card p-10 text-center text-sm text-surface-500">
          Aucun projet POEI ne vous est rattaché pour le moment.
          <div className="mt-3"><Link href="/mon-espace" className="text-brand-600 text-sm hover:underline">Retour à mon espace</Link></div>
        </div>
      </div>
    )
  }

  // Incidents des dossiers du formateur (résilient : migration 123)
  let incidents: any[] = []
  {
    const r = await supabase.from('incidents')
      .select('id, poei_id, date_incident, type, gravite, titre, description, mesures_prises, statut, apprenant_id, formateur_id, created_at')
      .in('poei_id', poeiIds).eq('organization_id', organizationId)
      .order('date_incident', { ascending: false })
    if (!r.error) incidents = r.data || []
  }

  const [{ data: poeis }, { data: cands }, { data: grilles }] = await Promise.all([
    supabase.from('poei').select('id, numero, poste_vise, date_debut, date_fin, statut, client:client_id(raison_sociale, nom_commercial), formation:formation_id(intitule)').in('id', poeiIds).eq('organization_id', organizationId).order('date_debut', { ascending: false }),
    supabase.from('poei_candidats').select('id, poei_id, apprenant_id, apprenant:apprenants(id, nom, prenom)').in('poei_id', poeiIds),
    supabase.from('poei_grilles').select('*').in('poei_id', poeiIds).eq('organization_id', organizationId),
  ])

  return (
    <div className="animate-fade-in">
      <PoeiGrillesFormateur
        poeis={(poeis || []) as any[]}
        candidats={(cands || []) as any[]}
        grilles={((grilles || []) as any[]).map((g) => ({ ...g, appreciations: appreciationsPourClient(g.appreciations) }))}
      />

      <PoeiIncidentsFormateur
        poeis={(poeis || []) as any[]}
        candidats={(cands || []) as any[]}
        incidents={incidents}
      />
    </div>
  )
}
