import Link from 'next/link'
import { ArrowLeft, ClipboardList, Printer } from '@/components/ui/icons'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { resolveFormateur } from '../../_formateur/guard'
import { formatDate } from '@/lib/utils'
import { RapportForm } from './RapportForm'

export const dynamic = 'force-dynamic'

/**
 * Compte rendu de formation, rempli par le formateur depuis son espace et
 * transmis au gestionnaire : il rejoint le dossier de la session (onglet
 * Bilan) et nourrit l'amélioration continue.
 */
export default async function RapportPage({ params }: { params: { sessionId: string } }) {
  const { formateurId } = await resolveFormateur()
  const supabase = await createServiceRoleClient()

  const { data: sess } = await supabase.from('sessions')
    .select('id, reference, intitule, date_debut, date_fin, formation_id, formation:formation_id(intitule), client:client_id(raison_sociale, nom_commercial)')
    .eq('id', params.sessionId).eq('formateur_id', formateurId).maybeSingle()

  if (!sess) {
    return (
      <div className="card p-10 text-center text-sm text-surface-500">
        Session introuvable ou hors de votre périmètre.
      </div>
    )
  }

  const { data: rapport } = await supabase.from('rapports_session')
    .select('*').eq('session_id', params.sessionId).eq('formateur_id', formateurId).maybeSingle()

  // Compte rendu prérempli avec les demi-journées, les objectifs et les
  // stagiaires de la session. Un remplaçant reprend le brouillon laissé sur la
  // session par un autre formateur ; un ancien rapport en texte libre est repris
  // dans les rubriques correspondantes.
  const { compteRenduSession } = await import('@/lib/compte-rendu-data')
  const { compteRenduStocke } = await import('@/lib/compte-rendu')
  const r: any = rapport
  let stocke = compteRenduStocke(r)
  if (!r) {
    const { data: autres } = await supabase.from('rapports_session').select('*')
      .eq('session_id', params.sessionId).neq('formateur_id', formateurId)
      .order('updated_at', { ascending: false }).limit(1)
    stocke = compteRenduStocke(autres?.[0])
  }
  const compteRendu = await compteRenduSession(supabase, sess as any, stocke)
  if (r && !stocke) {
    if (r.contenu_aborde && compteRendu.deroule[0] && !compteRendu.deroule[0].contenu) compteRendu.deroule[0].contenu = r.contenu_aborde
    compteRendu.conditions.difficultes ||= r.difficultes_rencontrees || ''
    compteRendu.bilan.points_positifs ||= r.points_positifs || ''
    compteRendu.bilan.recommandations ||= r.recommandations || ''
    compteRendu.bilan.commentaires ||= [r.objectifs_atteints && `Objectifs atteints : ${r.objectifs_atteints}`, r.objectifs_non_atteints && `Objectifs non atteints : ${r.objectifs_non_atteints}`, r.commentaires_generaux].filter(Boolean).join('\n')
  }

  const s: any = sess
  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div>
        <Link href="/mon-espace/sessions" className="inline-flex items-center gap-1 text-xs text-surface-500 hover:text-surface-700">
          <ArrowLeft className="h-3.5 w-3.5" /> Mes sessions
        </Link>
        <h1 className="text-xl font-heading font-bold text-surface-900 flex items-center gap-2 mt-1">
          <ClipboardList className="h-5 w-5 text-brand-500" /> Compte rendu de formation
        </h1>
        <p className="text-sm text-surface-500 mt-1">
          {s.formation?.intitule || s.intitule || 'Session'}
          {s.client ? ` · ${s.client.nom_commercial || s.client.raison_sociale}` : ''}
          {s.date_debut ? ` · ${formatDate(s.date_debut, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
          {s.reference ? ` · ${s.reference}` : ''}
        </p>
        <a href={`/api/pdf/compte-rendu/${params.sessionId}?vierge=1`}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-surface-500 hover:text-brand-600">
          <Printer className="h-3.5 w-3.5" /> Imprimer la fiche papier à remplir pendant la session
        </a>
      </div>

      <RapportForm
        sessionId={params.sessionId}
        initial={compteRendu}
        transmis={rapport?.status === 'soumis' || rapport?.status === 'valide'}
      />
    </div>
  )
}
