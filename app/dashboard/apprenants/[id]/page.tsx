import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Mail, Phone, Building2, Calendar, MapPin, GraduationCap,
  CheckCircle2, Star, Accessibility, Cake, FileText, ListChecks,
} from '@/components/ui/icons'
import { Avatar, Badge, BackLink } from '@/components/ui'
import { formatDate, companyLabel } from '@/lib/utils'
import { ApprenantEditButton } from './ApprenantEditButton'
import { CopyButton, Copiable, type FormatCopie } from '@/components/ui/CopyButton'

export const dynamic = 'force-dynamic'

const QCM_TYPE_LABELS: Record<string, string> = {
  positionnement: 'Positionnement', entree: "Évaluation d'entrée", sortie: 'Évaluation des acquis',
  satisfaction_chaud: 'Satisfaction à chaud', satisfaction_froid: 'Satisfaction à froid',
}

export default async function ApprenantDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: a } = await supabase
    .from('apprenants')
    .select('*, client:clients(id, raison_sociale, nom_commercial, sigle)')
    .eq('id', params.id)
    .eq('organization_id', session.organization.id)
    .single()
  if (!a) redirect('/dashboard/apprenants')

  const [{ data: inscriptions }, { data: qcmReponses }, { data: evals }, { data: docs }, { data: clients }, { data: emargements }] = await Promise.all([
    supabase.from('inscriptions')
      .select('id, status, session:sessions(id, reference, date_debut, date_fin, status, formation:formation_id(intitule), client:client_id(raison_sociale, nom_commercial, sigle))')
      .eq('apprenant_id', params.id).order('date_inscription', { ascending: false }),
    supabase.from('qcm_reponses')
      .select('id, score, is_reussi, is_complete, completed_at, qcm:qcm(titre, type)')
      .eq('apprenant_id', params.id).order('created_at', { ascending: false }),
    supabase.from('evaluations_apprenant')
      .select('id, intitule, note, note_max, appreciation, date_evaluation')
      .eq('apprenant_id', params.id).order('date_evaluation', { ascending: false }),
    supabase.from('documents').select('id, nom, type, created_at').eq('apprenant_id', params.id).order('created_at', { ascending: false }),
    supabase.from('clients').select('id, raison_sociale').eq('organization_id', session.organization.id).eq('type', 'entreprise').order('raison_sociale'),
    supabase.from('emargements')
      .select('id, session_id, date, creneau, est_present, motif_absence, session:session_id(id, reference, formation:formation_id(intitule))')
      .eq('apprenant_id', params.id).order('date', { ascending: false }),
  ])

  // Émargements regroupés par session : présence globale + absences motivées.
  const emParSession = new Map<string, any[]>()
  for (const e of (emargements || []) as any[]) {
    if (!emParSession.has(e.session_id)) emParSession.set(e.session_id, [])
    emParSession.get(e.session_id)!.push(e)
  }

  const insList = (inscriptions || []) as any[]
  const now = new Date().toISOString().slice(0, 10)
  const nbTerminees = insList.filter((i) => i.session?.status === 'terminee').length
  const entreprise = a.entreprise || companyLabel(a.client) || null

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <BackLink fallbackHref="/dashboard/apprenants" label="Apprenants" className="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-surface-700" />
        <ApprenantEditButton apprenant={a} clients={(clients || []) as any[]} />
      </div>

      {/* En-tête */}
      <div className="card p-6 flex flex-col sm:flex-row sm:items-center gap-5">
        <Avatar firstName={a.prenom} lastName={a.nom} size="xl" className="!h-20 !w-20 !text-xl" />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-heading font-bold text-surface-900">{a.civilite} {a.prenom} {a.nom}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {entreprise && (a.client
              ? <Link href={`/dashboard/clients/${a.client.id}`} className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"><Building2 className="h-3.5 w-3.5" />{entreprise}</Link>
              : <span className="inline-flex items-center gap-1 text-sm text-surface-500"><Building2 className="h-3.5 w-3.5" />{entreprise}</span>)}
            {a.poste && <Badge variant="default">{a.poste}</Badge>}
            {a.situation_handicap && <Badge variant="warning"><Accessibility className="h-3 w-3 mr-0.5" />Situation de handicap</Badge>}
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-surface-500 flex-wrap">
            {a.email && <span className="inline-flex items-center"><a href={`mailto:${a.email}`} className="flex items-center gap-1 hover:text-surface-700"><Mail className="h-3.5 w-3.5" />{a.email}</a><CopyButton valeur={a.email} libelle="l’email" /></span>}
            {a.telephone && <span className="inline-flex items-center"><a href={`tel:${a.telephone}`} className="flex items-center gap-1 hover:text-surface-700"><Phone className="h-3.5 w-3.5" />{a.telephone}</a><CopyButton valeur={a.telephone} format="telephone" libelle="le téléphone" /></span>}
          </div>
        </div>
        <div className="text-center shrink-0">
          <div className="text-3xl font-heading font-bold text-brand-600">{nbTerminees}</div>
          <div className="text-xs text-surface-500">formation{nbTerminees > 1 ? 's' : ''} suivie{nbTerminees > 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* État civil */}
      <div className="card p-5 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        {a.nom && <Info label="Nom" value={a.nom} copie={a.nom} />}
        {a.prenom && <Info label="Prénom" value={a.prenom} copie={a.prenom} />}
        {a.date_naissance && <Info icon={Cake} label="Date de naissance" value={formatDate(a.date_naissance, { day: '2-digit', month: '2-digit', year: 'numeric' })} copie={a.date_naissance} format="date" />}
        {a.lieu_naissance && <Info label="Lieu de naissance" value={a.lieu_naissance} copie={a.lieu_naissance} />}
        {a.sexe && <Info label="Sexe" value={a.sexe === 'H' ? 'Homme' : a.sexe === 'F' ? 'Femme' : a.sexe} />}
        {a.numero_securite_sociale && <Info label="N° sécurité sociale" value={a.numero_securite_sociale} copie={a.numero_securite_sociale} format="chiffres" />}
        {a.type_contrat && <Info label="Type de contrat" value={a.type_contrat} copie={a.type_contrat} />}
        {a.adresse && <Info icon={MapPin} label="Adresse" value={a.adresse} copie={a.adresse} />}
        {a.code_postal && <Info label="Code postal" value={a.code_postal} copie={a.code_postal} />}
        {a.ville && <Info label="Ville" value={a.ville} copie={a.ville} />}
        {a.statut_bpf && <Info label="Statut BPF" value={a.statut_bpf} />}
      </div>

      {a.situation_handicap && (a.type_handicap || a.besoins_adaptation) && (
        <div className="card p-5 space-y-2 border-l-2 border-amber-300">
          <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1.5"><Accessibility className="h-4 w-4" />Accessibilité</div>
          {a.type_handicap && <div className="text-sm text-surface-700">{a.type_handicap}</div>}
          {a.besoins_adaptation && <div className="text-sm text-surface-600">{a.besoins_adaptation}</div>}
        </div>
      )}

      {/* Sessions / parcours */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-brand-500" />
          <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Parcours de formation ({insList.length})</span>
        </div>
        {insList.length === 0 ? (
          <div className="text-center py-8 text-sm text-surface-400">Aucune inscription</div>
        ) : (
          <div className="divide-y divide-surface-100">
            {insList.map((i) => (
              <Link key={i.id} href={i.session?.id ? `/dashboard/sessions/${i.session.id}` : '#'}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50 transition-colors">
                <Calendar className="h-4 w-4 text-surface-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-surface-900 truncate">{i.session?.formation?.intitule || i.session?.reference || 'Session'}</div>
                  <div className="text-xs text-surface-500">
                    {i.session?.date_debut && formatDate(i.session.date_debut, { day: 'numeric', month: 'short', year: 'numeric' })}
                    {i.session?.client && ` · ${companyLabel(i.session.client)}`}
                  </div>
                </div>
                <Badge variant={i.session?.status === 'terminee' ? 'purple' : 'default'}>{i.session?.status === 'terminee' ? 'Terminée' : (i.status || 'inscrit')}</Badge>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Émargements : la présence par session, absences motivées comprises */}
      {emParSession.size > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-brand-500" />
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Émargements ({emParSession.size} session{emParSession.size > 1 ? 's' : ''})</span>
          </div>
          <div className="divide-y divide-surface-100">
            {[...emParSession.entries()].map(([sessionId, lignes]) => {
              // null = créneau pas encore passé : ni présent ni absent
              const faits = lignes.filter((l: any) => l.est_present !== null)
              const presents = faits.filter((l: any) => l.est_present).length
              const absences = faits.filter((l: any) => l.est_present === false)
              const dates = lignes.map((l: any) => String(l.date)).sort()
              return (
                <Link key={sessionId} href={`/dashboard/sessions/${sessionId}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50 transition-colors">
                  <CheckCircle2 className={`h-4 w-4 shrink-0 ${absences.length === 0 ? 'text-emerald-500' : 'text-amber-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-surface-900 truncate">
                      {lignes[0].session?.formation?.intitule || lignes[0].session?.reference || 'Session'}
                    </div>
                    <div className="text-xs text-surface-500">
                      {formatDate(dates[0], { day: 'numeric', month: 'short', year: 'numeric' })}
                      {dates.length > 1 && dates[0] !== dates[dates.length - 1]
                        ? ` – ${formatDate(dates[dates.length - 1], { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                      {absences.length > 0 && absences[0].motif_absence ? ` · Absence : ${absences[0].motif_absence}` : ''}
                    </div>
                  </div>
                  <span className={`text-xs font-semibold tabular-nums shrink-0 ${absences.length === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {presents}/{faits.length || lignes.length} présent{presents > 1 ? 's' : ''}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* QCM */}
      {(qcmReponses || []).length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-violet-500" />
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Questionnaires ({(qcmReponses || []).length})</span>
          </div>
          <div className="divide-y divide-surface-100">
            {(qcmReponses as any[]).map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-surface-800 truncate">{r.qcm?.titre || 'Questionnaire'}</div>
                  <div className="text-xs text-surface-400">{QCM_TYPE_LABELS[r.qcm?.type] || r.qcm?.type}</div>
                </div>
                {r.is_complete ? (
                  r.score != null
                    ? <span className={`text-sm font-bold ${r.is_reussi === false ? 'text-danger-600' : 'text-emerald-600'}`}>{Math.round(r.score)}%</span>
                    : <Badge variant="success">Complété</Badge>
                ) : <Badge variant="default">En attente</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Évaluations (notes) */}
      {(evals || []).length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Évaluations ({(evals || []).length})</span>
          </div>
          <div className="divide-y divide-surface-100">
            {(evals as any[]).map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-surface-800 truncate">{e.intitule || 'Évaluation'}</div>
                  {e.appreciation && <div className="text-xs text-surface-400 truncate">{e.appreciation}</div>}
                </div>
                {e.note != null && <span className="text-sm font-bold text-surface-900">{e.note}/{e.note_max || 20}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {a.notes && (
        <div className="card p-5">
          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Notes</div>
          <p className="text-sm text-surface-700 whitespace-pre-wrap">{a.notes}</p>
        </div>
      )}
    </div>
  )
}

function Info({ icon: Icon, label, value, copie, format }: { icon?: any; label: string; value: string; copie?: string | null; format?: FormatCopie }) {
  return (
    <div className="min-w-0">
      <div className="text-2xs uppercase tracking-wider text-surface-400 mb-0.5 flex items-center gap-1">{Icon && <Icon className="h-3 w-3" />}{label}</div>
      <div className="text-surface-800">
        {copie !== undefined ? <Copiable valeur={copie} format={format} libelle={label.toLowerCase()}>{value}</Copiable> : value}
      </div>
    </div>
  )
}
