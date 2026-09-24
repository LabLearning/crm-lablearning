import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Mail, Phone, Euro, Presentation, Award, Star, Calendar,
  MapPin, Building2, ShieldCheck, FileText, AlertTriangle, ExternalLink, Clock,
} from '@/components/ui/icons'
import { Avatar, Badge, BackLink } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { SESSION_STATUS_LABELS, SESSION_STATUS_COLORS } from '@/lib/types/formation'
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES_FORMATEUR } from '@/lib/types/document'
import { Download } from '@/components/ui/icons'
import { FormateurFacturesAdmin } from './FormateurFacturesAdmin'
import { MarquerVerifieButton } from './MarquerVerifieButton'
import { EvaluationFormateur } from './EvaluationFormateur'
import { FormateurDocUpload, FormateurDocDelete } from '@/app/mon-espace/_formateur/FormateurDocUpload'

export const dynamic = 'force-dynamic'

const contratLabels: Record<string, string> = { salarie: 'Salarié', prestataire: 'Prestataire', sous_traitance: 'Sous-traitance', benevole: 'Bénévole' }

export default async function FormateurDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: f } = await supabase
    .from('formateurs')
    .select('*')
    .eq('id', params.id)
    .eq('organization_id', session.organization.id)
    .single()
  if (!f) redirect('/dashboard/formateurs')

  // Fiche d'évaluation courante (indicateur 21) — résiliente avant migration 133.
  let evaluation: any = null
  try {
    const r = await supabase.from('formateur_evaluations').select('*').eq('formateur_id', params.id).maybeSingle()
    if (!r.error) evaluation = r.data
  } catch { evaluation = null }

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, reference, intitule, date_debut, date_fin, lieu, ville, status, formation:formation_id(intitule), client:client_id(raison_sociale)')
    .eq('formateur_id', params.id)
    .order('date_debut', { ascending: false })

  const list = (sessions || []) as any[]
  const now = new Date().toISOString().slice(0, 10)
  const upcoming = list.filter((s) => (s.date_fin || s.date_debut) >= now)
  const past = list.filter((s) => (s.date_fin || s.date_debut) < now)

  // Pièces administratives déposées par le formateur (URSSAF, Kbis, NDA, RC…)
  const { data: docsRaw } = await supabase
    .from('documents')
    .select('id, nom, type, file_url, created_at')
    .eq('formateur_id', params.id)
    .in('type', DOCUMENT_TYPES_FORMATEUR)
    .order('created_at', { ascending: false })
  const docs = (docsRaw || []) as any[]
  const docUrls: Record<string, string> = {}
  const paths = docs.map((d) => d.file_url).filter((u) => u && !/^https?:\/\//.test(u)) as string[]
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from('dossiers').createSignedUrls(paths, 3600)
    ;(signed || []).forEach((s, i) => { if (s?.signedUrl && !s.error) docUrls[paths[i]] = s.signedUrl })
  }
  for (const d of docs) if (d.file_url && /^https?:\/\//.test(d.file_url)) docUrls[d.file_url] = d.file_url

  // Factures de prestation envoyées par le formateur
  const { data: facturesRaw } = await supabase
    .from('factures_formateur')
    .select('*, session:session_id(reference)')
    .eq('formateur_id', params.id)
    .order('created_at', { ascending: false })
  const factures = (facturesRaw || []) as any[]
  const facPaths = factures.map((f) => f.fichier_url).filter((u) => u && !/^https?:\/\//.test(u)) as string[]
  const facUrls: Record<string, string> = {}
  if (facPaths.length > 0) {
    const { data: signed } = await supabase.storage.from('dossiers').createSignedUrls(facPaths, 3600)
    ;(signed || []).forEach((s, i) => { if (s?.signedUrl && !s.error) facUrls[facPaths[i]] = s.signedUrl })
  }

  // CV : lien externe (Drive) ou fichier déposé par le formulaire d'inscription
  const cvBrut = (f as any).cv_url as string | null
  let cvLien: string | null = null
  if (cvBrut && /^https?:\/\//.test(cvBrut)) cvLien = cvBrut
  else if (cvBrut) {
    const { data: signe } = await supabase.storage.from('documents').createSignedUrl(cvBrut, 3600)
    cvLien = signe?.signedUrl || null
  }

  // Dernier envoi du formulaire d'inscription (migration 160) : ce qui diffère de la fiche
  let derniereInscription: any = null
  if ((f as any).inscrit_via_formulaire_at) {
    const r = await supabase.from('formateur_inscriptions').select('created_at, resultat, differences')
      .eq('formateur_id', params.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!r.error) derniereInscription = r.data
  }
  const LIBELLES_CHAMPS: Record<string, string> = {
    civilite: 'Civilité', prenom: 'Prénom', nom: 'Nom', telephone: 'Téléphone', adresse: 'Adresse', code_postal: 'Code postal',
    ville: 'Ville', type_contrat: 'Statut', siret: 'SIRET', numero_da: 'N° de déclaration d’activité', taux_tva: 'TVA',
    qualifications: 'Expérience', zone_intervention: 'Zone', disponibilites: 'Disponibilités', tarif_journalier: 'Tarif journalier',
    tarif_horaire: 'Tarif horaire', bio: 'Présentation', cv_url: 'CV',
  }
  const differences = ((derniereInscription?.differences || []) as any[]).filter((d) => d?.champ)
  const diplomes = (Array.isArray((f as any).diplomes) ? (f as any).diplomes : [])
    .map((d: any) => (d && typeof d === 'object' ? [d.intitule, d.etablissement, d.annee].filter(Boolean).join(' · ') : String(d || '')))
    .filter(Boolean) as string[]
  const peutVerifier = ['super_admin', 'gestionnaire'].includes(session.user.role)
  const valeurLisible = (champ: string, v: unknown) =>
    champ === 'type_contrat' ? (contratLabels[String(v)] || String(v))
    : champ === 'taux_tva' ? (Number(v) === 0 ? 'sans TVA' : `${Number(v)} %`)
    : champ === 'tarif_journalier' || champ === 'tarif_horaire' ? `${Number(v).toLocaleString('fr-FR')} €`
    : String(v)

  const SessionRow = (s: any) => (
    <Link key={s.id} href={`/dashboard/sessions/${s.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50 transition-colors border-b border-surface-100/60 last:border-0">
      <div className="h-9 w-9 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
        <Calendar className="h-4 w-4 text-surface-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-surface-900 truncate">{s.formation?.intitule || s.intitule || s.reference || 'Session'}</div>
        <div className="text-xs text-surface-500 flex items-center gap-3 flex-wrap">
          <span>{formatDate(s.date_debut, { day: 'numeric', month: 'short' })} — {formatDate(s.date_fin, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          {s.client?.raison_sociale && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{s.client.raison_sociale}</span>}
          {(s.lieu || s.ville) && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{[s.lieu, s.ville].filter(Boolean).join(', ')}</span>}
        </div>
      </div>
      <Badge variant={SESSION_STATUS_COLORS[s.status] || 'default'}>{SESSION_STATUS_LABELS[s.status] || s.status}</Badge>
    </Link>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      <BackLink fallbackHref="/dashboard/formateurs" label="Formateurs" className="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-surface-700" />

      {/* En-tête */}
      <div className="card p-6 flex flex-col sm:flex-row sm:items-center gap-5">
        <Avatar firstName={f.prenom} lastName={f.nom} src={f.photo_url} size="xl" className="!h-20 !w-20 !text-xl" />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-heading font-bold text-surface-900">{f.civilite} {f.prenom} {f.nom}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="default">{contratLabels[f.type_contrat] || f.type_contrat}</Badge>
            {!f.is_active && <Badge variant="warning">Inactif</Badge>}
            {f.note_moyenne && (
              <span className="flex items-center gap-1 text-xs font-medium text-surface-700"><Star className="h-3 w-3 text-warning-500 fill-warning-500" />{f.note_moyenne}/5</span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-surface-500 flex-wrap">
            {f.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{f.email}</span>}
            {f.telephone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{f.telephone}</span>}
            {f.tarif_journalier && <span className="flex items-center gap-1"><Euro className="h-3.5 w-3.5" />{Number(f.tarif_journalier).toLocaleString('fr-FR')} €/j</span>}
            {(f as any).zone_intervention && <span className="flex items-center gap-1 text-brand-600 font-medium"><MapPin className="h-3.5 w-3.5" />{(f as any).zone_intervention}</span>}
            {(f as any).numero_da && <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />DA {(f as any).numero_da}</span>}
          </div>
          {(f.siret) && <div className="text-xs text-surface-400 mt-1">SIRET {f.siret}</div>}
        </div>
        <div className="text-center shrink-0">
          <div className="text-3xl font-heading font-bold text-brand-600">{list.length}</div>
          <div className="text-xs text-surface-500">session{list.length > 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Fiche remplie par le formateur lui-même, à relire */}
      {(f as any).a_verifier && (
        <div className="card p-4 border-warning-100 bg-warning-50/60 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-warning-600 shrink-0" />
            <div className="flex-1 min-w-[200px] text-sm text-surface-800">
              <span className="font-medium">Fiche remplie par le formateur</span>
              {(f as any).inscrit_via_formulaire_at && <> le {formatDate((f as any).inscrit_via_formulaire_at, { day: 'numeric', month: 'long', year: 'numeric' })}</>}
              <span className="text-surface-500"> · à relire avant de lui confier une mission</span>
            </div>
            {peutVerifier && <MarquerVerifieButton formateurId={f.id} />}
          </div>
          {differences.length > 0 && (
            <div className="text-xs text-surface-600 space-y-1 pl-7">
              <div className="font-medium text-surface-700">Il a déclaré des informations différentes de la fiche, qui n&apos;ont pas été remplacées :</div>
              {differences.map((d: any, i: number) => (
                <div key={i}>
                  <span className="text-surface-500">{LIBELLES_CHAMPS[d.champ] || d.champ} :</span>{' '}
                  {d.champ === 'cv_url'
                    ? <>nouveau CV déposé, il remplace le précédent{/^https?:\/\//.test(String(d.actuel)) && <> (<a href={String(d.actuel)} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">ancien CV</a>)</>}</>
                    : <><span className="line-through text-surface-400">{valeurLisible(d.champ, d.actuel)}</span> → <span className="font-medium text-surface-900">{valeurLisible(d.champ, d.declare)}</span></>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Profil déclaré : CV, tarifs, disponibilités, parcours */}
      {(cvLien || (f as any).tarif_horaire || (f as any).disponibilites || (f as any).qualifications || (f as any).bio || diplomes.length > 0) && (
        <div className="card p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-surface-700">
            {cvLien && (
              <a href={cvLien} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium text-brand-600 hover:underline">
                <FileText className="h-4 w-4" /> Voir le CV <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            {(f as any).tarif_horaire && <span className="inline-flex items-center gap-1"><Euro className="h-3.5 w-3.5 text-surface-400" />{Number((f as any).tarif_horaire).toLocaleString('fr-FR')} €/h HT</span>}
            {(f as any).inscrit_via_formulaire_at && Number((f as any).taux_tva) === 0 && <span className="text-surface-500">Sans TVA (franchise en base)</span>}
            {(f as any).disponibilites && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-surface-400" />{(f as any).disponibilites}</span>}
          </div>
          {diplomes.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Diplômes</div>
              <ul className="text-sm text-surface-700 space-y-0.5">{diplomes.map((d, i) => <li key={i}>{d}</li>)}</ul>
            </div>
          )}
          {(f as any).qualifications && (
            <div>
              <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Expérience</div>
              <p className="text-sm text-surface-700 whitespace-pre-line">{(f as any).qualifications}</p>
            </div>
          )}
          {(f as any).bio && (
            <div>
              <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Présentation</div>
              <p className="text-sm text-surface-700 whitespace-pre-line">{(f as any).bio}</p>
            </div>
          )}
        </div>
      )}

      {/* Expertise / certifications */}
      {((f.domaines_expertise || []).length > 0 || (f.certifications || []).length > 0) && (
        <div className="card p-5 space-y-3">
          {(f.domaines_expertise || []).length > 0 && (
            <div>
              <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Domaines d'expertise</div>
              <div className="flex flex-wrap gap-1.5">{(f.domaines_expertise || []).map((d: string) => <Badge key={d} variant="info">{d}</Badge>)}</div>
            </div>
          )}
          {(f.certifications || []).length > 0 && (
            <div>
              <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Certifications</div>
              <div className="flex flex-wrap gap-1.5">{(f.certifications || []).map((c: string) => <Badge key={c} variant="success"><Award className="h-3 w-3 mr-0.5" />{c}</Badge>)}</div>
            </div>
          )}
        </div>
      )}

      {/* Sessions */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
          <Presentation className="h-4 w-4 text-brand-500" />
          <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Sessions animées ({list.length})</span>
        </div>
        {list.length === 0 ? (
          <div className="text-center py-10 text-sm text-surface-400">Aucune session rattachée à ce formateur</div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <>
                <div className="px-4 py-2 bg-surface-50 text-2xs font-semibold text-surface-400 uppercase tracking-wider">À venir / en cours ({upcoming.length})</div>
                {upcoming.map(SessionRow)}
              </>
            )}
            {past.length > 0 && (
              <>
                <div className="px-4 py-2 bg-surface-50 text-2xs font-semibold text-surface-400 uppercase tracking-wider">Passées ({past.length})</div>
                {past.map(SessionRow)}
              </>
            )}
          </>
        )}
      </div>

      {/* Évaluation du profil et des compétences (indicateur 21) */}
      <EvaluationFormateur formateurId={params.id} initial={evaluation} />

      {/* Factures de prestation envoyées par le formateur */}
      <FormateurFacturesAdmin factures={factures} fileUrls={facUrls} />

      {/* Pièces administratives — déposées par le formateur ou par l'administration */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-brand-500" />
          <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Pièces administratives ({docs.length})</span>
        </div>
        <div className="px-4 py-3 border-b border-surface-100 bg-surface-50/40">
          <FormateurDocUpload token="" formateurId={params.id} />
        </div>
        {docs.length === 0 ? (
          <div className="text-center py-10 text-sm text-surface-400">Aucune pièce déposée par le formateur (URSSAF, Kbis, NDA, responsabilité civile, régularité fiscale…)</div>
        ) : (
          <div className="divide-y divide-surface-100">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                <FileText className="h-4 w-4 text-surface-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-surface-900 truncate">{d.nom}</div>
                  <div className="text-xs text-surface-500 flex items-center gap-2 flex-wrap">
                    <Badge variant="default">{(DOCUMENT_TYPE_LABELS as any)[d.type] || d.type}</Badge>
                    <span>{formatDate(d.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>
                {docUrls[d.file_url] && (
                  <a href={docUrls[d.file_url]} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-900 text-white text-xs font-medium hover:bg-surface-800 transition-colors shrink-0">
                    <Download className="h-3.5 w-3.5" /> Télécharger
                  </a>
                )}
                <FormateurDocDelete docId={d.id} token="" formateurId={params.id} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
