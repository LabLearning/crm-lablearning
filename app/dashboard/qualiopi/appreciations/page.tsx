import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { Star, Building2, GraduationCap, Landmark, PhoneCall, Download } from '@/components/ui/icons'
import { formatDate } from '@/lib/utils'
import { BackLink } from '@/components/ui/BackLink'

export const dynamic = 'force-dynamic'

const TYPES: Record<string, { label: string; Icon: any }> = {
  evaluation_formateur: { label: 'Évaluations des formateurs par les référents', Icon: GraduationCap },
  formateur: { label: 'Formateurs', Icon: GraduationCap },
  entreprise: { label: 'Entreprises clientes', Icon: Building2 },
  financeur: { label: 'Financeurs', Icon: Landmark },
}

const CRITERES_FORMATEUR: [string, string][] = [
  ['note_ponctualite', 'Ponctualité'],
  ['note_pedagogie', 'Pédagogie'],
  ['note_maitrise', 'Maîtrise du métier'],
  ['note_relationnel', 'Relationnel'],
  ['note_adaptation', 'Adaptation'],
]

/**
 * Registre des appréciations des parties prenantes (indicateur 30) : toutes
 * les réponses au formulaire public /appreciation — entreprises, formateurs,
 * financeurs — plus les retours recueillis par téléphone.
 */
export default async function AppreciationsPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: appreciations } = await supabase
    .from('appreciations_parties_prenantes')
    .select('id, type, statut, note_globale, note_organisation, note_intervenant, note_ponctualite, note_pedagogie, note_maitrise, note_relationnel, note_adaptation, recommande, commentaire, repondant_nom, repondant_fonction, created_at, repondu_at, client:client_id(raison_sociale, nom_commercial), session:session_id(reference), formateur:formateur_id(prenom, nom), poei:poei_id(numero)')
    .eq('organization_id', session.organization.id)
    .order('created_at', { ascending: false })

  // Les demandes envoyées au référent mais sans réponse ne sont pas des
  // appréciations : hors registre et hors moyenne.
  const rows = ((appreciations || []) as any[]).filter((r) => r.statut !== 'envoye')
  const moyenne = rows.filter((r) => r.note_globale != null)
  const note = moyenne.length ? (moyenne.reduce((a, r) => a + r.note_globale, 0) / moyenne.length).toFixed(1) : null

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      <BackLink fallbackHref="/dashboard/qualiopi" label="Qualiopi" className="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-surface-700" />

      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Appréciations des parties prenantes</h1>
          <p className="text-sm text-surface-500 mt-1">
            Les réponses au formulaire d&apos;appréciation (entreprises, formateurs, financeurs) et les retours
            recueillis par téléphone — indicateur 30.
          </p>
        </div>
        {note && (
          <div className="card px-4 py-3 text-center">
            <div className="text-xl font-heading font-bold text-surface-900 inline-flex items-center gap-1.5">
              <Star className="h-4 w-4 text-amber-400" /> {note}/5
            </div>
            <div className="text-2xs text-surface-400">{rows.length} réponse{rows.length > 1 ? 's' : ''}</div>
          </div>
        )}
      </div>

      {Object.entries(TYPES).map(([type, meta]) => {
        const lignes = rows.filter((r) => r.type === type)
        if (!lignes.length) return null
        return (
          <div key={type} className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
              <meta.Icon className="h-4 w-4 text-brand-500" />
              <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">{meta.label} ({lignes.length})</span>
            </div>
            <div className="divide-y divide-surface-100">
              {lignes.map((r) => {
                const parTelephone = /téléphone/i.test(r.repondant_fonction || '')
                return (
                  <div key={r.id} className="px-4 py-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {r.note_globale != null && (
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-surface-900">
                          <Star className="h-4 w-4 text-amber-400" /> {r.note_globale}/5
                        </span>
                      )}
                      {r.type === 'evaluation_formateur' && r.formateur && (
                        <span className="text-sm font-semibold text-surface-900">
                          {[r.formateur.prenom, r.formateur.nom].filter(Boolean).join(' ')}
                          <span className="font-normal text-surface-400"> évalué par</span>
                        </span>
                      )}
                      <span className="text-sm text-surface-800">{r.repondant_nom || 'Anonyme'}</span>
                      {r.repondant_fonction && <span className="text-xs text-surface-400">{r.repondant_fonction.replace(' — recueilli par téléphone', '')}</span>}
                      {r.poei?.numero && <span className="text-xs text-surface-400">· {r.poei.numero}</span>}
                      {(r.client?.nom_commercial || r.client?.raison_sociale) && (
                        <span className="text-xs text-surface-500">· {r.client.nom_commercial || r.client.raison_sociale}</span>
                      )}
                      {parTelephone && (
                        <span className="inline-flex items-center gap-1 text-2xs font-medium text-surface-500 bg-surface-100 rounded-full px-2 py-0.5">
                          <PhoneCall className="h-3 w-3" /> téléphone
                        </span>
                      )}
                      <span className="text-xs text-surface-400 ml-auto inline-flex items-center gap-2">
                        {formatDate(r.created_at, { day: 'numeric', month: 'long', year: 'numeric' })}
                        {r.type === 'evaluation_formateur' && r.statut === 'repondu' && (
                          <a href={`/api/pdf/evaluation-formateur-referent/${r.id}`} target="_blank" rel="noreferrer"
                            title="Télécharger l'évaluation en PDF"
                            className="inline-flex items-center gap-1 rounded-md border border-surface-200 bg-white px-1.5 py-0.5 text-surface-600 hover:text-surface-900 hover:bg-surface-50">
                            <Download className="h-3 w-3" /> PDF
                          </a>
                        )}
                      </span>
                    </div>
                    {r.commentaire && <p className="text-sm text-surface-600 mt-1.5 whitespace-pre-line">{r.commentaire}</p>}
                    {r.type === 'evaluation_formateur' ? (
                      <div className="flex items-center gap-4 mt-1.5 text-2xs text-surface-400 flex-wrap">
                        {CRITERES_FORMATEUR.map(([cle, label]) => r[cle] != null && <span key={cle}>{label} : {r[cle]}/5</span>)}
                        {r.recommande != null && <span>{r.recommande ? 'Retravaillerait avec ce formateur' : 'Ne souhaite pas retravailler avec ce formateur'}</span>}
                      </div>
                    ) : (r.note_organisation != null || r.note_intervenant != null || r.recommande != null) && (
                      <div className="flex items-center gap-4 mt-1.5 text-2xs text-surface-400">
                        {r.note_organisation != null && <span>Organisation : {r.note_organisation}/5</span>}
                        {r.note_intervenant != null && <span>Intervenant : {r.note_intervenant}/5</span>}
                        {r.recommande != null && <span>{r.recommande ? 'Recommande Lab Learning' : 'Ne recommande pas'}</span>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {rows.length === 0 && (
        <div className="card p-10 text-center text-sm text-surface-500">Aucune appréciation pour le moment.</div>
      )}
    </div>
  )
}
