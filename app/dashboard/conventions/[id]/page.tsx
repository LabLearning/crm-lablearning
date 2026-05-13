import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Building2, GraduationCap, Calendar, Users, FileText, Euro, Clock,
  CheckCircle2, AlertCircle, MapPin, FilePenLine, Download, ExternalLink, Send,
} from 'lucide-react'
import { Badge } from '@/components/ui'
import { CONVENTION_STATUS_LABELS, CONVENTION_STATUS_COLORS, CONVENTION_TYPE_LABELS } from '@/lib/types/convention'
import { formatDate, formatDateTime } from '@/lib/utils'
import { ConventionSignatureBlock } from './ConventionSignatureBlock'

export const dynamic = 'force-dynamic'

export default async function ConventionDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: conv } = await supabase
    .from('conventions')
    .select(`
      *,
      client:clients(id, raison_sociale, type, adresse, code_postal, ville, telephone, email, siret),
      contact:contacts(id, prenom, nom, email, telephone, poste),
      formation:formations(id, intitule, reference, modalite, duree_heures, duree_jours),
      session:sessions(id, reference, status, date_debut, date_fin, lieu, formateur:formateurs(prenom, nom)),
      dossier:dossiers_formation(id, numero, status, opco_workflow_status)
    `)
    .eq('id', params.id)
    .eq('organization_id', session.organization.id)
    .single()

  if (!conv) redirect('/dashboard/conventions')

  const c = conv as any
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'
  const signatureUrl = c.signature_token ? `${appUrl}/convention/${c.signature_token}/signer` : null

  return (
    <div className="space-y-5 animate-fade-in max-w-5xl">
      {/* Header */}
      <div>
        <Link href="/dashboard/conventions" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-800 mb-3">
          <ArrowLeft className="h-4 w-4" /> Retour aux conventions
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-surface-900">{c.numero}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant={CONVENTION_STATUS_COLORS[c.status as keyof typeof CONVENTION_STATUS_COLORS]} dot>
                {CONVENTION_STATUS_LABELS[c.status as keyof typeof CONVENTION_STATUS_LABELS]}
              </Badge>
              <Badge variant="default">{CONVENTION_TYPE_LABELS[c.type as keyof typeof CONVENTION_TYPE_LABELS]}</Badge>
              {c.financeur_type && <Badge variant="warning">{c.financeur_type === 'opco' ? 'OPCO' : c.financeur_type}</Badge>}
            </div>
            {c.objet && <p className="text-sm text-surface-600 mt-2">{c.objet}</p>}
          </div>
          <div className="flex gap-2 shrink-0">
            <a
              href={`/api/pdf/convention/${c.id}`}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary text-sm flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" /> PDF
            </a>
          </div>
        </div>
      </div>

      {/* Bloc signature (gestion lien signature client) */}
      <ConventionSignatureBlock
        conventionId={c.id}
        status={c.status}
        signatureUrl={signatureUrl}
        signatureClientDate={c.signature_client_date}
        signatureClientNom={c.signature_client_nom}
        signatureOfDate={c.signature_of_date}
        signatureOfNom={c.signature_of_nom}
        signatureTokenExpiresAt={c.signature_token_expires_at}
      />

      {/* Client + Formation */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-surface-400 uppercase tracking-wider">
            <Building2 className="h-3.5 w-3.5" /> Client
          </div>
          {c.client ? (
            <>
              <div className="text-base font-semibold text-surface-900">{c.client.raison_sociale}</div>
              {c.client.siret && <div className="text-xs text-surface-500">SIRET {c.client.siret}</div>}
              {c.client.adresse && (
                <div className="text-sm text-surface-700">
                  {c.client.adresse}<br />
                  {c.client.code_postal} {c.client.ville}
                </div>
              )}
              {c.contact && (
                <div className="pt-2 border-t border-surface-100 text-sm">
                  <div className="text-xs text-surface-500">Contact</div>
                  <div className="font-medium text-surface-900">{c.contact.prenom} {c.contact.nom}</div>
                  {c.contact.poste && <div className="text-xs text-surface-500">{c.contact.poste}</div>}
                  <div className="flex flex-wrap gap-3 text-xs text-surface-600 mt-1">
                    {c.contact.email && <span>{c.contact.email}</span>}
                    {c.contact.telephone && <span>{c.contact.telephone}</span>}
                  </div>
                </div>
              )}
            </>
          ) : <div className="text-sm text-surface-400">Aucun client lié</div>}
        </div>

        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-surface-400 uppercase tracking-wider">
            <GraduationCap className="h-3.5 w-3.5" /> Formation
          </div>
          {c.formation ? (
            <>
              <div className="text-base font-semibold text-surface-900">{c.formation.intitule}</div>
              {c.formation.reference && <div className="text-xs text-surface-500 font-mono">{c.formation.reference}</div>}
              <div className="flex flex-wrap gap-3 text-xs text-surface-600">
                <span>{c.formation.modalite}</span>
                {c.formation.duree_jours && <span>{c.formation.duree_jours}j</span>}
                {c.formation.duree_heures && <span>{c.formation.duree_heures}h</span>}
              </div>
            </>
          ) : <div className="text-sm text-surface-400">Aucune formation liée</div>}

          {c.dates_formation && (
            <div className="pt-2 border-t border-surface-100">
              <div className="text-xs text-surface-500">Dates de formation</div>
              <div className="text-sm text-surface-700">{c.dates_formation}</div>
            </div>
          )}
          {c.lieu && (
            <div className="pt-2 border-t border-surface-100">
              <div className="text-xs text-surface-500">Lieu</div>
              <div className="text-sm text-surface-700">{c.lieu}</div>
            </div>
          )}
        </div>
      </div>

      {/* Session liée */}
      {c.session && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-surface-400 uppercase tracking-wider">
              <Calendar className="h-3.5 w-3.5" /> Session liée
            </div>
            <Link href={`/dashboard/sessions`} className="text-xs text-brand-600 hover:underline">Voir →</Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><span className="text-surface-500">Référence :</span> <strong>{c.session.reference}</strong></div>
            <div><span className="text-surface-500">Statut :</span> {c.session.status}</div>
            <div><span className="text-surface-500">Période :</span> {formatDate(c.session.date_debut)} → {formatDate(c.session.date_fin)}</div>
            {c.session.formateur && (
              <div><span className="text-surface-500">Formateur :</span> {c.session.formateur.prenom} {c.session.formateur.nom}</div>
            )}
          </div>
        </div>
      )}

      {/* Dossier lié */}
      {c.dossier && (
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-surface-400 uppercase tracking-wider">
              <FileText className="h-3.5 w-3.5" /> Dossier de financement
            </div>
            <Link href={`/dashboard/dossiers/${c.dossier.id}`} className="text-xs text-brand-600 hover:underline">Ouvrir →</Link>
          </div>
          <div className="mt-2 flex items-center gap-3 text-sm">
            <span className="font-mono text-brand-600">{c.dossier.numero}</span>
            <span className="text-surface-500">·</span>
            <span>{c.dossier.status}</span>
            {c.dossier.opco_workflow_status && (
              <>
                <span className="text-surface-500">·</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                  OPCO : {c.dossier.opco_workflow_status.replace(/_/g, ' ')}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Financier */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-surface-400 uppercase tracking-wider">
          <Euro className="h-3.5 w-3.5" /> Financier
        </div>
        <div className="grid sm:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs text-surface-500">Montant HT</div>
            <div className="text-lg font-bold text-surface-900">{Number(c.montant_ht || 0).toLocaleString('fr-FR')} €</div>
          </div>
          <div>
            <div className="text-xs text-surface-500">TVA ({c.taux_tva}%)</div>
            <div className="text-base text-surface-700">{(Number(c.montant_ttc || 0) - Number(c.montant_ht || 0)).toLocaleString('fr-FR')} €</div>
          </div>
          <div>
            <div className="text-xs text-surface-500">Montant TTC</div>
            <div className="text-lg font-bold text-brand-700">{Number(c.montant_ttc || 0).toLocaleString('fr-FR')} €</div>
          </div>
        </div>
        {c.nombre_stagiaires > 0 && (
          <div className="text-xs text-surface-500 pt-1 border-t border-surface-100">
            <Users className="h-3.5 w-3.5 inline mr-1" />
            {c.nombre_stagiaires} stagiaire{c.nombre_stagiaires > 1 ? 's' : ''}
            {c.duree_heures && ` · ${c.duree_heures}h`}
          </div>
        )}
      </div>

      {/* Notes */}
      {c.notes_internes && (
        <div className="card p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">
            Notes internes
          </div>
          <div className="text-sm text-surface-700 whitespace-pre-wrap">{c.notes_internes}</div>
        </div>
      )}

      {/* Dates clés */}
      <div className="card p-5">
        <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Dates clés</div>
        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div><span className="text-surface-500">Créée :</span> {formatDateTime(c.created_at)}</div>
          {c.date_emission && <div><span className="text-surface-500">Émise :</span> {formatDate(c.date_emission)}</div>}
          {c.sent_at && <div><span className="text-surface-500">Envoyée :</span> {formatDateTime(c.sent_at)}</div>}
          {c.signature_client_date && <div><span className="text-surface-500">Signée client :</span> {formatDateTime(c.signature_client_date)}</div>}
          {c.signature_of_date && <div><span className="text-surface-500">Signée OF :</span> {formatDateTime(c.signature_of_date)}</div>}
        </div>
      </div>
    </div>
  )
}
