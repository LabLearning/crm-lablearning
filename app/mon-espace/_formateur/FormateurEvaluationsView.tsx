import { createServiceRoleClient } from '@/lib/supabase/server'
import { Star } from 'lucide-react'

/**
 * Évaluations reçues par le formateur (retours des apprenants sur ses
 * sessions). Branche formateur extraite de la page portail /evaluations, pour
 * être rendue à l'identique dans l'espace connecté. Aucun lien interne.
 */
export async function FormateurEvaluationsView({ formateurId }: { formateurId: string }) {
  const supabase = await createServiceRoleClient()

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id')
    .eq('formateur_id', formateurId)

  const sessionIds = (sessions || []).map((s) => s.id)

  let satisfactions: any[] = []
  if (sessionIds.length > 0) {
    const { data } = await supabase
      .from('evaluations_satisfaction')
      .select('*, session:sessions(reference, formation:formation_id(intitule))')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: false })
    satisfactions = data || []
  }

  const avgNote = satisfactions.length > 0
    ? (satisfactions.reduce((s, e) => s + Number(e.note_formateur || e.note_moyenne || 0), 0) / satisfactions.length).toFixed(1)
    : '—'

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Évaluations reçues</h1>
        <p className="text-surface-500 mt-1">Retours des apprenants sur vos sessions</p>
      </div>

      <div className="card p-6 flex items-center gap-4">
        <div className="p-3 rounded-xl bg-warning-50"><Star className="h-6 w-6 text-warning-500 fill-warning-500" /></div>
        <div>
          <div className="text-xs text-surface-500">Note moyenne formateur</div>
          <div className="text-2xl font-heading font-bold text-warning-600">{avgNote}/5</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-xs text-surface-500">Évaluations</div>
          <div className="text-lg font-bold text-surface-800">{satisfactions.length}</div>
        </div>
      </div>

      <div className="space-y-3">
        {satisfactions.map((s) => (
          <div key={s.id} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-medium text-surface-900">{s.session?.formation?.intitule || s.session?.reference || 'Session'}</div>
                <div className="text-xs text-surface-500">{s.nombre_reponses} réponse{s.nombre_reponses > 1 ? 's' : ''} · Taux : {s.taux_reponse}%</div>
              </div>
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 text-warning-500 fill-warning-500" />
                <span className="text-lg font-bold text-surface-800">{Number(s.note_moyenne).toFixed(1)}</span>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: 'Contenu', note: s.note_contenu },
                { label: 'Formateur', note: s.note_formateur },
                { label: 'Organisation', note: s.note_organisation },
                { label: 'Supports', note: s.note_supports },
                { label: 'Applicabilité', note: s.note_applicabilite },
              ].map((n) => (
                <div key={n.label} className="text-center p-2 rounded-lg bg-surface-50">
                  <div className="text-2xs text-surface-400">{n.label}</div>
                  <div className={`text-sm font-bold ${n.note ? (Number(n.note) >= 4 ? 'text-success-600' : Number(n.note) >= 3 ? 'text-warning-600' : 'text-danger-600') : 'text-surface-300'}`}>
                    {n.note ? `${Number(n.note).toFixed(1)}` : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {satisfactions.length === 0 && (
        <div className="card p-12 text-center text-sm text-surface-500">Aucune évaluation reçue</div>
      )}
    </div>
  )
}
