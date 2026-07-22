import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui'
import { ArrowLeft } from 'lucide-react'
import { sortCreneaux, todayISO } from '../helpers'
import { SessionDays, type DayRow } from './SessionDays'
import { ModeEmargement } from './ModeEmargement'
import { SessionHeaderFormateur } from '../../SessionHeaderFormateur'

export const dynamic = 'force-dynamic'

export default async function PortalEmargementSessionPage({
  params,
}: {
  params: { token: string; sessionId: string }
}) {
  const context = await getPortalContext(params.token)
  if (!context || context.type !== 'formateur') redirect('/portail/expired')

  const supabase = await createServiceRoleClient()

  const { data: session } = await supabase
    .from('sessions')
    .select(
      'id, reference, intitule, date_debut, date_fin, horaires, lieu, adresse, code_postal, ville, formateur_id, organization_id, emargement_mode, emargement_scan_path, emargement_scan_uploaded_at, formation:formation_id(intitule, duree_heures), client:client_id(raison_sociale)',
    )
    .eq('id', params.sessionId)
    .maybeSingle()

  // Le sessionId vient de l'URL : il doit appartenir au formateur du token.
  if (!session || session.formateur_id !== context.formateur.id) redirect('/portail/expired')

  const { ensureEmargements } = await import('@/lib/emargements')
  await ensureEmargements(supabase, session.id, session.organization_id)

  const [emRes, fRes, insRes] = await Promise.all([
    supabase
      .from('emargements')
      .select(
        'id, apprenant_id, date, creneau, est_present, signature_data, signed_at, motif_absence, apprenant:apprenants(prenom, nom)',
      )
      .eq('session_id', session.id)
      .order('date', { ascending: true }),
    supabase
      .from('emargement_feuilles')
      .select('id, date, creneau, mode, scan_storage_path, formateur_signature_data, validated_at')
      .eq('session_id', session.id),
    supabase
      .from('inscriptions')
      .select('apprenant:apprenants(id, prenom, nom)')
      .eq('session_id', session.id)
      .not('status', 'in', '("annule","abandonne")'),
  ])

  const emargements = (emRes.data || []) as any[]
  const feuilles = (fRes.data || []) as any[]
  const stagiaires = (insRes.data || [])
    .map((i: any) => i.apprenant)
    .filter(Boolean)
    .sort((a: any, b: any) => `${a.nom}`.localeCompare(`${b.nom}`))

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

  return (
    <div className="space-y-5 animate-fade-in">
      <Link
        href={`/portail/${params.token}/emargement`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-surface-500 active:text-surface-800"
      >
        <ArrowLeft className="h-4 w-4" /> Toutes les sessions
      </Link>

      <SessionHeaderFormateur
        session={session as any}
        formateurName={`${context.formateur.prenom} ${context.formateur.nom}`}
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

      <ModeEmargement
        token={params.token}
        sessionId={session.id}
        mode={((session as any).emargement_mode as 'numerique' | 'papier') || 'numerique'}
        scanPath={(session as any).emargement_scan_path || null}
        scanUploadedAt={(session as any).emargement_scan_uploaded_at || null}
        verrouille={validated > 0}
      />
      <SessionDays
        token={params.token}
        sessionId={session.id}
        days={days}
        today={today}
        modeSession={((session as any).emargement_mode as 'numerique' | 'papier') || 'numerique'}
      />
    </div>
  )
}
