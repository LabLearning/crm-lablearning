import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EmargementSheet from './EmargementSheet'

export const dynamic = 'force-dynamic'

export default async function PortalEmargementPage({ params }: { params: { token: string } }) {
  const context = await getPortalContext(params.token)
  if (!context || context.type !== 'formateur') redirect('/portail/expired')

  const supabase = await createServiceRoleClient()

  // Sessions actives du formateur. « planifiee » est incluse : une session
  // POEI d'intervention le reste jusqu'à son démarrage, et le formateur doit
  // pouvoir émarger dès le premier jour.
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, reference, date_debut, date_fin, organization_id, formation:formation_id(intitule)')
    .eq('formateur_id', context.formateur.id)
    .in('status', ['planifiee', 'confirmee', 'en_attente_signatures', 'validee', 'en_cours'])
    .order('date_debut', { ascending: true })

  const sessionIds = (sessions || []).map((s) => s.id)

  // Les feuilles n'étaient créées qu'à l'ouverture de la fiche session par un
  // administrateur : sans cette visite, le formateur n'avait rien à signer.
  const { ensureEmargements } = await import('@/lib/emargements')
  await Promise.all(
    (sessions || []).map((s: any) => ensureEmargements(supabase, s.id, s.organization_id)),
  )
  let emargements: any[] = []
  let feuilles: any[] = []

  if (sessionIds.length > 0) {
    const [emRes, fRes] = await Promise.all([
      supabase
        .from('emargements')
        .select(
          'id, session_id, apprenant_id, date, creneau, est_present, signature_data, signed_at, motif_absence, apprenant:apprenants(prenom, nom)',
        )
        .in('session_id', sessionIds)
        .order('date', { ascending: true }),
      supabase
        .from('emargement_feuilles')
        .select('id, session_id, date, creneau, formateur_signature_data, validated_at')
        .in('session_id', sessionIds),
    ])
    emargements = emRes.data || []
    feuilles = fRes.data || []
  }

  // Groupement : session -> date -> creneau -> { emargements, feuille }
  const bySession = (sessions || []).map((s) => {
    const sessionEm = emargements.filter((e) => e.session_id === s.id)
    const sessionFeuilles = feuilles.filter((f) => f.session_id === s.id)

    const dates = Array.from(new Set(sessionEm.map((e) => e.date))).sort()

    return {
      ...s,
      dates: dates.map((date) => {
        const dateEm = sessionEm.filter((e) => e.date === date)
        const creneaux = Array.from(new Set(dateEm.map((e) => e.creneau))).sort((a, b) => {
          const order = { matin: 0, journee: 1, apres_midi: 2 } as Record<string, number>
          return (order[a] ?? 9) - (order[b] ?? 9)
        })

        return {
          date,
          creneaux: creneaux.map((creneau) => ({
            creneau,
            emargements: dateEm
              .filter((e) => e.creneau === creneau)
              .sort((a, b) => {
                const an = `${a.apprenant?.nom || ''} ${a.apprenant?.prenom || ''}`
                const bn = `${b.apprenant?.nom || ''} ${b.apprenant?.prenom || ''}`
                return an.localeCompare(bn)
              }),
            feuille:
              sessionFeuilles.find((f) => f.date === date && f.creneau === creneau) || null,
          })),
        }
      }),
    }
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-bold text-surface-900 tracking-heading">
          Émargement numérique
        </h1>
        <p className="text-surface-500 mt-1">
          Faites signer chaque apprenant sur votre tablette, puis validez la feuille avec votre propre signature.
        </p>
      </div>

      <EmargementSheet token={params.token} sessions={bySession as any} />
    </div>
  )
}
