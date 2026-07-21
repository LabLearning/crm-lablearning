import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui'
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  Building2,
  User,
  Users,
} from 'lucide-react'
import { formatShortDate, sortCreneaux, todayISO } from '../helpers'
import { SessionDays, type DayRow } from './SessionDays'
import { ContenuPedagogiqueFormateur } from '../../ContenuPedagogique'
import { getSessionSupports, getPositionnementEtat } from '@/lib/session-contenu'

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
      'id, reference, intitule, date_debut, date_fin, horaires, lieu, adresse, code_postal, ville, formateur_id, organization_id, deroule_pedagogique, materiel_necessaire, formation:formation_id(intitule, duree_heures), client:client_id(raison_sociale)',
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

  // Contenu pédagogique : le formateur voit tous les supports de sa session
  const [supportsBySession, positionnement] = await Promise.all([
    getSessionSupports(supabase, [session.id], 'formateur'),
    getPositionnementEtat(
      supabase,
      session.id,
      stagiaires.map((a: any) => ({ id: a.id, prenom: a.prenom, nom: a.nom })),
    ),
  ])
  const supports = supportsBySession[session.id] || []

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

  const formation = (session as any).formation
  const client = (session as any).client
  const adresseComplete = [session.adresse, [session.code_postal, session.ville].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="space-y-5 animate-fade-in">
      <Link
        href={`/portail/${params.token}/emargement`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-surface-500 active:text-surface-800"
      >
        <ArrowLeft className="h-4 w-4" /> Toutes les sessions
      </Link>

      <div className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {validated === totalFeuilles && totalFeuilles > 0 ? (
            <Badge variant="success">Émargement complet</Badge>
          ) : (
            <Badge variant="default">
              {validated}/{totalFeuilles} feuilles validées
            </Badge>
          )}
          {session.reference && (
            <span className="text-[11px] font-mono text-surface-400">{session.reference}</span>
          )}
        </div>

        <h1 className="text-lg sm:text-xl font-heading font-bold text-surface-900 tracking-heading leading-snug">
          {formation?.intitule || session.intitule || 'Session'}
        </h1>

        <div className="mt-3 grid gap-2 text-sm text-surface-600 sm:grid-cols-2">
          {client?.raison_sociale && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-surface-400 shrink-0" />
              <span className="truncate">{client.raison_sociale}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-surface-400 shrink-0" />
            <span>
              {formatShortDate(session.date_debut)} — {formatShortDate(session.date_fin)}
              {formation?.duree_heures ? ` · ${formation.duree_heures}h` : ''}
            </span>
          </div>
          {session.horaires && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-surface-400 shrink-0" />
              <span className="truncate">{session.horaires}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-surface-400 shrink-0" />
            <span className="truncate">
              {context.formateur.prenom} {context.formateur.nom}
            </span>
          </div>
          {(session.lieu || adresseComplete) && (
            <div className="flex items-start gap-2 sm:col-span-2">
              <MapPin className="h-4 w-4 text-surface-400 shrink-0 mt-0.5" />
              <span>
                {session.lieu}
                {session.lieu && adresseComplete ? ' — ' : ''}
                {adresseComplete}
              </span>
            </div>
          )}
        </div>

        {stagiaires.length > 0 && (
          <div className="mt-4 pt-4 border-t border-surface-100">
            <div className="flex items-center gap-2 text-xs font-semibold text-surface-500 uppercase tracking-wider">
              <Users className="h-3.5 w-3.5" />
              {stagiaires.length} stagiaire{stagiaires.length > 1 ? 's' : ''}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {stagiaires.map((a: any, i: number) => (
                <span
                  key={i}
                  className="text-xs text-surface-700 bg-surface-100 rounded-full px-2.5 py-1"
                >
                  {a.prenom} {a.nom}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <ContenuPedagogiqueFormateur
        token={params.token}
        deroule={(session as any).deroule_pedagogique || null}
        materiel={(session as any).materiel_necessaire || null}
        supports={supports}
        positionnement={positionnement}
      />

      <SessionDays token={params.token} sessionId={session.id} days={days} today={today} />
    </div>
  )
}
