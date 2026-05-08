import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Building2, GraduationCap, Calendar, Users, FileText, Euro, Clock,
  CheckCircle2, AlertCircle, MapPin, User as UserIcon, FilePenLine, Download,
} from 'lucide-react'
import { Badge } from '@/components/ui'
import { DossierOpcoCard } from '../DossierOpcoCard'
import { OpcoDetailsCard } from './OpcoDetailsCard'
import { DOSSIER_STATUS_LABELS, DOSSIER_STATUS_COLORS } from '@/lib/types/dossier'
import { formatDate, formatDateTime } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function DossierDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: dossier } = await supabase
    .from('dossiers_formation')
    .select(`
      *,
      client:clients(id, raison_sociale, type, adresse, code_postal, ville, telephone, email, siret),
      formation:formations(id, intitule, reference, modalite, duree_heures, duree_jours, programme_detaille),
      session:sessions(
        id, reference, status, type_session, modalite, date_debut, date_fin, lieu,
        adresse, code_postal, ville, lien_visio, horaires_jours, mission_status,
        cout_formateur,
        formateur:formateurs(id, prenom, nom, email)
      ),
      opco:opco(id, code, nom, site_web),
      checklist:dossier_checklist(*),
      timeline:dossier_timeline(*, user:users(first_name, last_name))
    `)
    .eq('id', params.id)
    .eq('organization_id', session.organization.id)
    .single()

  if (!dossier) redirect('/dashboard/dossiers')

  // Apprenants inscrits à la session
  const sessionId = (dossier as any).session?.id
  const { data: inscriptions } = sessionId ? await supabase
    .from('inscriptions')
    .select('id, status, apprenant:apprenants(id, prenom, nom, email)')
    .eq('session_id', sessionId)
    : { data: [] }

  // Convention liée
  const { data: convention } = sessionId ? await supabase
    .from('conventions')
    .select('id, numero, status, signature_client_date, signature_client_nom, sent_at, signature_token, akto_dossier_status, akto_dossier_numero')
    .eq('session_id', sessionId)
    .maybeSingle()
    : { data: null }

  // Contrat formateur lié
  const { data: contrat } = sessionId ? await supabase
    .from('contrats_formateur')
    .select('id, numero, status, signature_formateur_date, signature_formateur_nom, sent_at, montant_ht')
    .eq('session_id', sessionId)
    .maybeSingle()
    : { data: null }

  const d = dossier as any
  const sess = d.session
  const apprenants = (inscriptions || []).map((i: any) => ({ ...i.apprenant, status: i.status }))
  const totalApprenants = apprenants.length
  const apprenantsActifs = apprenants.filter(a => !['annule', 'abandonne'].includes(a.status)).length

  return (
    <div className="space-y-5 animate-fade-in max-w-5xl">
      {/* Header */}
      <div>
        <Link href="/dashboard/dossiers" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-800 mb-3">
          <ArrowLeft className="h-4 w-4" /> Retour aux dossiers
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-surface-900">{d.numero}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant={DOSSIER_STATUS_COLORS[d.status as keyof typeof DOSSIER_STATUS_COLORS]} dot>
                {DOSSIER_STATUS_LABELS[d.status as keyof typeof DOSSIER_STATUS_LABELS]}
              </Badge>
              {d.financeur_type && <Badge variant="warning">{d.financeur_type === 'opco' ? 'OPCO' : d.financeur_type}</Badge>}
              {d.opco_workflow_status && <span className="text-xs text-surface-500">Workflow OPCO : <strong>{d.opco_workflow_status.replace(/_/g, ' ')}</strong></span>}
            </div>
          </div>
        </div>
      </div>

      {/* Workflow OPCO en haut si applicable */}
      {d.opco_workflow_status && d.opco_id && (
        <>
          <DossierOpcoCard
            dossierId={d.id}
            status={d.opco_workflow_status}
            opcoNom={d.opco?.nom}
            numeroDossier={d.opco_numero_dossier}
            motifRefus={d.opco_motif_refus}
          />
          <OpcoDetailsCard
            dossierId={d.id}
            initialNumero={d.opco_numero_dossier}
            accordUrl={d.accord_prise_en_charge_url}
            accordFilename={d.accord_prise_en_charge_filename}
            accordUploadedAt={d.accord_prise_en_charge_uploaded_at}
            workflowStatus={d.opco_workflow_status}
          />
        </>
      )}

      {/* Client + Formation */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-surface-400 uppercase tracking-wider">
            <Building2 className="h-3.5 w-3.5" /> Client
          </div>
          {d.client ? (
            <>
              <div className="text-base font-semibold text-surface-900">{d.client.raison_sociale}</div>
              {d.client.siret && <div className="text-xs text-surface-500">SIRET {d.client.siret}</div>}
              {d.client.adresse && (
                <div className="text-sm text-surface-700">
                  {d.client.adresse}<br />
                  {d.client.code_postal} {d.client.ville}
                </div>
              )}
              <div className="flex flex-wrap gap-3 text-xs text-surface-500 pt-1">
                {d.client.email && <span>{d.client.email}</span>}
                {d.client.telephone && <span>{d.client.telephone}</span>}
              </div>
            </>
          ) : <div className="text-sm text-surface-400">Aucun client lié</div>}
        </div>

        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-surface-400 uppercase tracking-wider">
            <GraduationCap className="h-3.5 w-3.5" /> Formation
          </div>
          {d.formation ? (
            <>
              <div className="text-base font-semibold text-surface-900">{d.formation.intitule}</div>
              {d.formation.reference && <div className="text-xs text-surface-500 font-mono">{d.formation.reference}</div>}
              <div className="flex flex-wrap gap-3 text-xs text-surface-600 pt-1">
                <span>{d.formation.modalite}</span>
                {d.formation.duree_jours && <span>{d.formation.duree_jours}j</span>}
                {d.formation.duree_heures && <span>{d.formation.duree_heures}h</span>}
              </div>
            </>
          ) : <div className="text-sm text-surface-400">Aucune formation liée</div>}
        </div>
      </div>

      {/* Session liée */}
      {sess && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-surface-400 uppercase tracking-wider">
              <Calendar className="h-3.5 w-3.5" /> Session
            </div>
            <Link href={`/dashboard/sessions`} className="text-xs text-brand-600 hover:underline">Voir la session →</Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><span className="text-surface-500">Référence :</span> <strong>{sess.reference}</strong></div>
            <div><span className="text-surface-500">Statut :</span> {sess.status}</div>
            <div><span className="text-surface-500">Type :</span> {sess.type_session} · {sess.modalite}</div>
            <div><span className="text-surface-500">Période :</span> {formatDate(sess.date_debut)} → {formatDate(sess.date_fin)}</div>
            {sess.lieu && <div className="col-span-2"><span className="text-surface-500"><MapPin className="h-3 w-3 inline" /> Lieu :</span> {sess.lieu}{sess.adresse && `, ${sess.adresse}`}</div>}
            {sess.formateur && (
              <div className="col-span-2 flex items-center gap-2 pt-1 border-t border-surface-100">
                <UserIcon className="h-3.5 w-3.5 text-surface-400" />
                <strong>{sess.formateur.prenom} {sess.formateur.nom}</strong>
                <span className="text-xs px-2 py-0.5 rounded-full bg-surface-100 text-surface-600">
                  Mission : {sess.mission_status === 'accepted' ? 'acceptée' : sess.mission_status === 'pending' ? 'en attente' : sess.mission_status}
                </span>
              </div>
            )}
          </div>

          {/* Planning détaillé */}
          {Array.isArray(sess.horaires_jours) && sess.horaires_jours.length > 0 && (
            <div className="pt-3 border-t border-surface-100">
              <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Planning</div>
              <div className="space-y-1 text-xs">
                {sess.horaires_jours.map((h: any) => (
                  <div key={h.date} className="flex flex-wrap gap-3">
                    <span className="font-medium text-surface-800 w-32">
                      {new Date(h.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                    <span className="text-surface-600">Matin {h.matin_debut}–{h.matin_fin}</span>
                    <span className="text-surface-600">Aprem {h.aprem_debut}–{h.aprem_fin}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Apprenants */}
      {totalApprenants > 0 && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-surface-400 uppercase tracking-wider">
              <Users className="h-3.5 w-3.5" /> Apprenants ({apprenantsActifs}/{totalApprenants})
            </div>
          </div>
          <div className="divide-y divide-surface-100 -mx-2">
            {apprenants.map(a => (
              <div key={a.id} className="px-2 py-2 flex items-center gap-3 text-sm">
                <div className="h-7 w-7 rounded-full bg-surface-100 flex items-center justify-center text-xs font-medium text-surface-600 shrink-0">
                  {a.prenom?.[0]}{a.nom?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-surface-900 truncate">{a.prenom} {a.nom}</div>
                  {a.email && <div className="text-xs text-surface-500 truncate">{a.email}</div>}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-surface-100 text-surface-600 shrink-0">{a.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-surface-400 uppercase tracking-wider">
          <FileText className="h-3.5 w-3.5" /> Documents
        </div>
        <div className="space-y-2">
          {/* Convention */}
          {convention && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 border border-surface-100">
              <FilePenLine className="h-4 w-4 text-brand-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-surface-900">Convention {convention.numero}</div>
                <div className="text-xs text-surface-500">
                  Statut : <strong>{convention.status}</strong>
                  {convention.signature_client_date && (
                    <> · Signée par {convention.signature_client_nom} le {formatDate(convention.signature_client_date)}</>
                  )}
                </div>
              </div>
              <a href={`/api/pdf/convention/${convention.id}`} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline flex items-center gap-1 shrink-0">
                <Download className="h-3 w-3" /> PDF
              </a>
            </div>
          )}
          {/* Contrat formateur */}
          {contrat && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 border border-surface-100">
              <FilePenLine className="h-4 w-4 text-brand-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-surface-900">Contrat formateur {contrat.numero}</div>
                <div className="text-xs text-surface-500">
                  Statut : <strong>{contrat.status}</strong>
                  {contrat.signature_formateur_date && (
                    <> · Signé par {contrat.signature_formateur_nom} le {formatDate(contrat.signature_formateur_date)}</>
                  )}
                </div>
              </div>
            </div>
          )}
          {!convention && !contrat && <div className="text-sm text-surface-400">Aucun document généré pour le moment.</div>}
        </div>
      </div>

      {/* Financier */}
      {(d.montant_total_ht > 0 || d.montant_total_ttc > 0) && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-surface-400 uppercase tracking-wider">
            <Euro className="h-3.5 w-3.5" /> Financier
          </div>
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs text-surface-500">Total HT</div>
              <div className="text-lg font-bold text-surface-900">{Number(d.montant_total_ht || 0).toLocaleString('fr-FR')} €</div>
            </div>
            <div>
              <div className="text-xs text-surface-500">TTC</div>
              <div className="text-lg font-bold text-brand-700">{Number(d.montant_total_ttc || 0).toLocaleString('fr-FR')} €</div>
            </div>
            {d.montant_prise_en_charge > 0 && (
              <div>
                <div className="text-xs text-surface-500">Pris en charge OPCO</div>
                <div className="text-lg font-bold text-emerald-600">{Number(d.montant_prise_en_charge).toLocaleString('fr-FR')} €</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checklist */}
      {Array.isArray(d.checklist) && d.checklist.length > 0 && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-surface-400 uppercase tracking-wider">
            <CheckCircle2 className="h-3.5 w-3.5" /> Checklist
          </div>
          <div className="space-y-1.5">
            {d.checklist.map((item: any) => (
              <div key={item.id} className="flex items-start gap-2 text-sm">
                {item.complete ? <CheckCircle2 className="h-4 w-4 text-success-600 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 text-surface-300 mt-0.5 shrink-0" />}
                <div className="flex-1">
                  <div className={item.complete ? 'text-surface-500 line-through' : 'text-surface-800'}>{item.libelle}</div>
                  {item.notes && <div className="text-xs text-surface-500 mt-0.5">{item.notes}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      {Array.isArray(d.timeline) && d.timeline.length > 0 && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-surface-400 uppercase tracking-wider">
            <Clock className="h-3.5 w-3.5" /> Historique
          </div>
          <div className="space-y-2">
            {d.timeline.slice(0, 10).map((t: any) => (
              <div key={t.id} className="flex items-start gap-2 text-xs">
                <div className="h-1.5 w-1.5 rounded-full bg-brand-400 mt-1.5 shrink-0" />
                <div className="flex-1">
                  <div className="text-surface-800">{t.message || t.action}</div>
                  <div className="text-surface-400">
                    {formatDateTime(t.created_at)}
                    {t.user && ` · ${t.user.first_name} ${t.user.last_name}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
