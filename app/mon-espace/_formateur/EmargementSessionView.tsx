import { createServiceRoleClient } from '@/lib/supabase/server'
import { fetchAllPaged } from '@/lib/supabase/fetch-all'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui'
import { ArrowLeft, Download } from '@/components/ui/icons'
import { sortCreneaux, todayISO } from '@/app/portail/[token]/emargement/helpers'
import { SessionDays, type DayRow } from '@/app/portail/[token]/emargement/[sessionId]/SessionDays'
import { ModeEmargement } from '@/app/portail/[token]/emargement/[sessionId]/ModeEmargement'
import { SessionHeaderFormateur } from '@/app/portail/[token]/SessionHeaderFormateur'
import { SessionPointage } from '@/app/mon-espace/_formateur/SessionPointage'

/**
 * Détail d'émargement d'une session, partagé entre l'espace connecté et le
 * portail. Le `sessionId` provient de l'URL : on vérifie qu'il appartient au
 * formateur (jamais de confiance dans l'URL). Le `token` reste transmis aux
 * composants clients (server actions d'émargement).
 */
export async function EmargementSessionView({
  formateurId,
  formateurName,
  token,
  basePath,
  sessionId,
  deniedRedirect,
}: {
  formateurId: string
  formateurName: string
  token: string
  basePath: string
  sessionId: string
  deniedRedirect: string
}) {
  const supabase = await createServiceRoleClient()

  const { data: session } = await supabase
    .from('sessions')
    .select(
      'id, reference, intitule, date_debut, date_fin, horaires, lieu, adresse, code_postal, ville, formateur_id, organization_id, emargement_mode, emargement_scan_path, emargement_scan_uploaded_at, formation:formation_id(intitule, duree_heures), client:client_id(raison_sociale, nom_commercial, sigle)',
    )
    .eq('id', sessionId)
    .maybeSingle()

  // Le sessionId vient de l'URL : il doit appartenir au formateur.
  if (!session || session.formateur_id !== formateurId) redirect(deniedRedirect)

  const { ensureEmargements } = await import('@/lib/emargements')
  await ensureEmargements(supabase, session.id, session.organization_id)

  const todayDate = todayISO()
  const [emRows, fRes, insRes, pRes] = await Promise.all([
    // Paginé, ordre total : au-delà de 1000 lignes (une longue POEI), les
    // derniers jours disparaissaient et le formateur ne pouvait plus les signer
    fetchAllPaged((from, to) => supabase
      .from('emargements')
      .select(
        'id, apprenant_id, date, creneau, est_present, signature_data, signed_at, motif_absence, apprenant:apprenants(prenom, nom)',
      )
      .eq('session_id', session.id)
      .order('date', { ascending: true }).order('creneau').order('apprenant_id').order('id')
      .range(from, to)),
    supabase
      .from('emargement_feuilles')
      .select('id, date, creneau, mode, scan_storage_path, formateur_signature_data, validated_at')
      .eq('session_id', session.id),
    // Même règle que la feuille d'émargement PDF : inscrits actifs + toute
    // personne ayant déjà signé (cf. lib/emargement-participants).
    import('@/lib/emargement-participants').then((m) => m.participantsFeuille(supabase, session.id)),
    // Pointage du formateur pour cette session, jour courant
    supabase
      .from('pointages_formateur')
      .select('id, heure_arrivee, heure_depart')
      .eq('session_id', session.id)
      .eq('formateur_id', formateurId)
      .eq('date', todayDate)
      .maybeSingle(),
  ])
  const pointageToday = (pRes as any).data || null

  const emargements = emRows as any[]
  const feuilles = (fRes.data || []) as any[]
  const stagiaires = (insRes as any[]) || []

  // Un seul appel signé pour tous les scans plutôt qu'un par feuille
  const scanPaths = feuilles.map((f) => f.scan_storage_path).filter(Boolean) as string[]
  const scanUrls: Record<string, string> = {}
  if (scanPaths.length > 0) {
    const { data: signed } = await supabase.storage.from('documents').createSignedUrls(scanPaths, 3600)
    for (const s of signed || []) {
      if (s.path && s.signedUrl) scanUrls[s.path] = s.signedUrl
    }
  }

  const dates = Array.from(new Set(emargements.map((e) => e.date))).sort()

  const days: DayRow[] = dates.map((date) => {
    const dayEm = emargements.filter((e) => e.date === date)
    return {
      date,
      creneaux: sortCreneaux(Array.from(new Set(dayEm.map((e) => e.creneau)))).map((creneau) => {
        const feuille = feuilles.find((f) => f.date === date && f.creneau === creneau) || null
        return {
          creneau,
          emargements: dayEm
            .filter((e) => e.creneau === creneau)
            .sort((a, b) =>
              `${a.apprenant?.nom || ''} ${a.apprenant?.prenom || ''}`.localeCompare(
                `${b.apprenant?.nom || ''} ${b.apprenant?.prenom || ''}`,
              ),
            ),
          feuille,
          scanUrl: feuille?.scan_storage_path ? scanUrls[feuille.scan_storage_path] || null : null,
        }
      }),
    }
  })

  const today = todayISO()
  const totalFeuilles = days.reduce((n, d) => n + d.creneaux.length, 0)
  const validated = days.reduce((n, d) => n + d.creneaux.filter((c) => c.feuille?.validated_at).length, 0)

  // Feuilles signées téléchargeables dès qu'au moins une signature existe.
  const nbSignatures = emargements.filter((e) => e.signature_data).length
  const toutSigne = validated === totalFeuilles && totalFeuilles > 0
  const pdfSigneHref =
    basePath === '/mon-espace'
      ? `/api/pdf/emargement-signe/${session.id}`
      : `/api/pdf/emargement-signe/${session.id}?token=${token}`

  return (
    <div className="space-y-5 animate-fade-in">
      <Link
        href={`${basePath}/emargement`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-surface-500 active:text-surface-800"
      >
        <ArrowLeft className="h-4 w-4" /> Toutes les sessions
      </Link>

      <SessionHeaderFormateur
        session={session as any}
        formateurName={formateurName}
        stagiaires={stagiaires}
        badge={
          validated === totalFeuilles && totalFeuilles > 0 ? (
            <Badge variant="success">Émargement complet</Badge>
          ) : (
            <Badge variant="default">
              {validated}/{totalFeuilles} feuilles validées
            </Badge>
          )
        }
      />

      {/* Pointage du formateur (arrivée / départ, jour courant) */}
      <div>
        <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Mon pointage — {new Date(todayDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <SessionPointage token={token} sessionId={session.id} pointage={pointageToday} />
      </div>

      {nbSignatures > 0 && (
        <a
          href={pdfSigneHref}
          target="_blank"
          rel="noreferrer"
          className={`flex items-center justify-between gap-3 rounded-xl border p-4 transition-colors ${
            toutSigne
              ? 'border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50'
              : 'border-surface-200 bg-white hover:bg-surface-50'
          }`}
        >
          <div className="min-w-0">
            <div className="text-sm font-semibold text-surface-900">
              Télécharger la feuille d&apos;émargement signée
            </div>
            <div className="text-xs text-surface-500 mt-0.5">
              {toutSigne
                ? 'Toutes les feuilles sont signées — PDF avec les signatures des stagiaires'
                : `PDF avec les ${nbSignatures} signature${nbSignatures > 1 ? 's' : ''} recueillie${nbSignatures > 1 ? 's' : ''} à ce jour`}
            </div>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-900 text-white text-xs font-medium">
            <Download className="h-4 w-4" /> PDF
          </span>
        </a>
      )}

      <ModeEmargement
        token={token}
        sessionId={session.id}
        mode={((session as any).emargement_mode as 'numerique' | 'papier') || 'numerique'}
        scanPath={(session as any).emargement_scan_path || null}
        scanUploadedAt={(session as any).emargement_scan_uploaded_at || null}
        verrouille={validated > 0}
      />
      <SessionDays
        token={token}
        sessionId={session.id}
        days={days}
        today={today}
        modeSession={((session as any).emargement_mode as 'numerique' | 'papier') || 'numerique'}
      />
    </div>
  )
}
