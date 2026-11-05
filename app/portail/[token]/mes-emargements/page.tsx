import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MesEmargementsClient } from './MesEmargementsClient'
import { ToastProvider } from '@/components/ui'

export const dynamic = 'force-dynamic'

/**
 * Émargements de l'apprenant sur son portail, regroupés PAR JOURNÉE : une
 * seule signature remplit les créneaux du jour (matin + après-midi) — la
 * feuille garde une signature par demi-journée, capturée en une fois.
 */
export default async function PortalEmargementsPage({ params }: { params: { token: string } }) {
  const context = await getPortalContext(params.token)
  if (!context || context.type !== 'apprenant') redirect('/portail/expired')

  const supabase = await createServiceRoleClient()
  const { data: emargements } = await supabase
    .from('emargements')
    .select('id, session_id, date, creneau, est_present, motif_absence, signature_data, session:session_id(reference, formation:formation_id(intitule))')
    .eq('apprenant_id', context.apprenant.id)
    .order('date', { ascending: false })

  const aujourdhui = new Date().toISOString().slice(0, 10)

  // Mêmes règles que signerMaJourneeAction : une feuille validée par le
  // formateur ou une inscription annulée ne se signent plus. Sans cela le
  // bouton « Signer la journée » s'affichait et la signature était refusée.
  const sessionIds = Array.from(new Set(((emargements || []) as any[]).map((e) => e.session_id)))
  const [{ data: feuilles }, { data: inscriptions }] = sessionIds.length
    ? await Promise.all([
      supabase.from('emargement_feuilles').select('session_id, date, creneau')
        .in('session_id', sessionIds).not('validated_at', 'is', null),
      supabase.from('inscriptions').select('session_id')
        .eq('apprenant_id', context.apprenant.id).in('session_id', sessionIds)
        .not('status', 'in', '("annule","abandonne")'),
    ])
    : [{ data: [] as any[] }, { data: [] as any[] }]
  const verrouilles = new Set(((feuilles || []) as any[]).map((f) => `${f.session_id}|${f.date}|${f.creneau}`))
  // Lecture en échec : on retombe sur l'affichage d'avant, l'action vérifie de toute façon
  const inscrites = inscriptions ? new Set((inscriptions as any[]).map((i) => i.session_id)) : null

  const parSession = new Map<string, any[]>()
  for (const e of (emargements || []) as any[]) {
    if (!parSession.has(e.session_id)) parSession.set(e.session_id, [])
    parSession.get(e.session_id)!.push(e)
  }

  const groupes = [...parSession.entries()].map(([sessionId, lignes]) => {
    // Regroupement par jour : un jour = une signature qui couvre ses créneaux
    const parJour = new Map<string, any[]>()
    for (const l of lignes) {
      const d = String(l.date)
      if (!parJour.has(d)) parJour.set(d, [])
      parJour.get(d)!.push(l)
    }
    const jours = [...parJour.entries()]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([date, creneaux]) => {
        const tries = creneaux.sort((a: any, b: any) => (a.creneau === 'matin' ? -1 : 1))
        const verrouille = (c: any) => verrouilles.has(`${sessionId}|${date}|${c.creneau}`)
        const aSigner = (c: any) => !c.signature_data && !c.motif_absence
        return {
          date,
          futur: date > aujourdhui,
          creneaux: tries.map((c: any) => ({
            creneau: c.creneau,
            est_present: c.est_present,
            motif_absence: c.motif_absence,
            signe: !!c.signature_data,
            verrouille: verrouille(c),
          })),
          // Journée signable : au moins un créneau passé, non signé, non absent,
          // sur une feuille encore ouverte. Une ligne naît avec « présent = non »
          // tant qu'elle n'est pas signée : seul un motif d'absence (posé par le
          // formateur ou l'organisme) fait l'absence.
          signable: (!inscrites || inscrites.has(sessionId)) && date <= aujourdhui && tries.some((c: any) => aSigner(c) && !verrouille(c)),
          // Rien de signable parce que la feuille est close : on le dit
          close: date <= aujourdhui && tries.some((c: any) => aSigner(c) && verrouille(c)),
        }
      })
    return {
      sessionId,
      titre: lignes[0].session?.formation?.intitule || lignes[0].session?.reference || 'Formation',
      jours,
    }
  })

  return <ToastProvider><MesEmargementsClient token={params.token} groupes={groupes} /></ToastProvider>
}
