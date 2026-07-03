import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { SessionsList } from './SessionsList'
import type { Session, Formation, Formateur } from '@/lib/types/formation'

export const dynamic = 'force-dynamic'

export default async function SessionsPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      *,
      formation:formation_id(intitule, reference, modalite, duree_heures, is_poei),
      formateur:formateurs(prenom, nom),
      client:client_id(raison_sociale)
    `)
    .eq('organization_id', session.organization.id)
    .order('date_debut', { ascending: false })

  // Inscriptions + formations liées : 2 requêtes batch (au lieu de 2 par session),
  // parallélisées avec les listes de référence
  const sessionIds = (sessions || []).map((s) => s.id)

  const [
    { data: allInscrits },
    { data: allLinkedFormations },
    { data: formations },
    { data: formateurs },
    { data: clients },
    { data: apprenants },
    { data: poeiLinks },
  ] = await Promise.all([
    sessionIds.length > 0
      ? supabase.from('inscriptions').select('session_id, apprenant_id').in('session_id', sessionIds).not('status', 'in', '("annule","abandonne")')
      : Promise.resolve({ data: [] as any[] }),
    sessionIds.length > 0
      ? supabase.from('session_formations').select('session_id, formation_id, ordre').in('session_id', sessionIds).order('ordre')
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from('formations')
      .select('id, intitule, reference, modalite, duree_heures, duree_jours')
      .eq('organization_id', session.organization.id)
      .eq('is_active', true)
      .order('intitule'),
    supabase
      .from('formateurs')
      .select('id, prenom, nom, tarif_journalier')
      .eq('organization_id', session.organization.id)
      .eq('is_active', true)
      .order('nom'),
    supabase
      .from('clients')
      .select('id, raison_sociale, adresse, code_postal, ville')
      .eq('organization_id', session.organization.id)
      .eq('type', 'entreprise')
      .order('raison_sociale'),
    supabase
      .from('apprenants')
      .select('id, prenom, nom, email, client_id')
      .eq('organization_id', session.organization.id)
      .order('nom'),
    // Sessions rattachées à un projet POEI
    supabase
      .from('poei')
      .select('session_id')
      .eq('organization_id', session.organization.id)
      .not('session_id', 'is', null),
  ])

  // Regroupement en mémoire (rapide) — préserve l'ordre par 'ordre' déjà appliqué côté SQL
  const inscritsBySession: Record<string, string[]> = {}
  for (const i of allInscrits || []) {
    ;(inscritsBySession[i.session_id] ||= []).push(i.apprenant_id)
  }
  const formationsBySession: Record<string, string[]> = {}
  for (const f of allLinkedFormations || []) {
    ;(formationsBySession[f.session_id] ||= []).push(f.formation_id)
  }

  const poeiSessionIds = new Set((poeiLinks || []).map((p: any) => p.session_id))

  const sessionsWithCounts = (sessions || []).map((s) => {
    const inscritsIds = inscritsBySession[s.id] || []
    return {
      ...s,
      _nb_inscrits: inscritsIds.length,
      _inscrits_ids: inscritsIds,
      _formation_ids: formationsBySession[s.id] || [],
      _is_poei: !!((s as any).formation?.is_poei) || poeiSessionIds.has(s.id),
    }
  })

  return (
    <div className="animate-fade-in">
      <SessionsList
        sessions={sessionsWithCounts as Session[]}
        formations={(formations || []) as any[]}
        formateurs={(formateurs || []) as any[]}
        clients={(clients || []) as any[]}
        apprenants={(apprenants || []) as any[]}
      />
    </div>
  )
}
