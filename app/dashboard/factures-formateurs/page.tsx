import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { ReceiptText, AlertCircle } from '@/components/ui/icons'
import { SESSION_DETAIL_SELECT, chargerDetailsPrestations, periodeFr } from '@/lib/facture-formateur-detail'
import { chargerPilotageFormateurs } from '@/lib/pilotage-formateurs'
import { JOURS_RELEVE, constituerEquipe, estLaPersonne, jourParis, peutVoirTresorerie, ventilerParPersonne } from '@/lib/tresorerie'
import { banqueDeLOrganisme } from '@/lib/tresorerie-banque'
import { chargerRapprochements, type Acompte, type Proposition } from '@/lib/rapprochement-formateurs'
import { FacturesFormateursList } from './FacturesFormateursList'
import { PilotageFormateurs, type BanqueFormateur } from './PilotageFormateurs'
import { RapprochementBanque } from './RapprochementBanque'

export const dynamic = 'force-dynamic'

const VUES = [
  { valeur: 'factures', label: 'Par facture' },
  { valeur: 'formateurs', label: 'Par formateur' },
] as const
/** Périodes du pilotage ; `jours` nul : depuis le 1er janvier. */
const PERIODES = [
  { valeur: '30', label: '30 jours', jours: 30, phrase: 'sur les 30 derniers jours' },
  { valeur: '90', label: '90 jours', jours: 90, phrase: 'sur les 90 derniers jours' },
  { valeur: '180', label: '6 mois', jours: 180, phrase: 'sur les 6 derniers mois' },
  { valeur: 'annee', label: 'Depuis janvier', jours: null, phrase: null },
] as const
const ROLES_INTERNES = ['super_admin', 'gestionnaire', 'commercial', 'directeur_commercial', 'comptable']

export default async function FacturesFormateursPage({ searchParams }: { searchParams: { vue?: string; periode?: string } }) {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const organizationId = session.organization.id
  const vue = searchParams.vue === 'formateurs' ? 'formateurs' : 'factures'
  const periode = PERIODES.find((p) => p.valeur === searchParams.periode) || PERIODES[2]
  const lien = (v: string, p: string) => {
    const q = [v !== 'factures' && `vue=${v}`, v === 'formateurs' && p !== '180' && `periode=${p}`].filter(Boolean).join('&')
    return q ? `/dashboard/factures-formateurs?${q}` : '/dashboard/factures-formateurs'
  }

  const entete = (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
            <ReceiptText className="h-5 w-5 text-brand-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-heading font-bold text-surface-900">Factures formateurs</h1>
            <p className="text-sm text-surface-500">
              {vue === 'formateurs'
                ? 'Pour chaque formateur : ses sessions réalisées, ses factures en cours et ce qui lui a été payé.'
                : 'Factures de prestation envoyées par les formateurs, avec le détail de chaque prestation : à valider puis à mettre en paiement.'}
            </p>
          </div>
        </div>
        {vue === 'formateurs' && (
          <nav aria-label="Période" className="inline-flex shrink-0 rounded-lg bg-surface-100 p-0.5 self-start">
            {PERIODES.map((p) => (
              <Link
                key={p.valeur}
                href={lien(vue, p.valeur)}
                aria-current={p.valeur === periode.valeur ? 'page' : undefined}
                className={cn('inline-flex min-h-9 items-center whitespace-nowrap rounded-md px-3 text-xs font-semibold transition-colors', p.valeur === periode.valeur ? 'bg-white text-surface-900 shadow-xs' : 'text-surface-500 hover:text-surface-800')}
              >
                {p.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
      <nav aria-label="Vue" className="flex gap-5 border-b border-surface-200">
        {VUES.map((v) => (
          <Link
            key={v.valeur}
            href={lien(v.valeur, periode.valeur)}
            aria-current={v.valeur === vue ? 'page' : undefined}
            className={cn('-mb-px inline-flex min-h-10 items-center whitespace-nowrap border-b-2 text-sm font-semibold transition-colors',
              v.valeur === vue ? 'border-brand-600 text-brand-700' : 'border-transparent text-surface-500 hover:text-surface-800')}
          >
            {v.label}
          </Link>
        ))}
      </nav>
    </>
  )

  // ── Pilotage par formateur ──
  if (vue === 'formateurs') {
    const aujourdhui = jourParis(new Date())
    const debut = periode.jours
      ? new Date(Date.parse(`${aujourdhui}T12:00:00Z`) - (periode.jours - 1) * 86_400_000).toISOString().slice(0, 10)
      : `${aujourdhui.slice(0, 4)}-01-01`
    const joursPeriode = Math.round((Date.parse(`${aujourdhui}T12:00:00Z`) - Date.parse(`${debut}T12:00:00Z`)) / 86_400_000) + 1
    // Le relevé bancaire n'est montré qu'aux rôles qui voient la trésorerie
    const voitBanque = peutVoirTresorerie(session.user.role)

    const [pilotage, lecture, formateurs, utilisateurs] = await Promise.all([
      chargerPilotageFormateurs(supabase, organizationId, debut, aujourdhui).catch(() => null),
      voitBanque ? banqueDeLOrganisme(supabase, organizationId) : Promise.resolve({ banque: null, erreur: null }),
      voitBanque ? supabase.from('formateurs').select('id, prenom, nom').eq('organization_id', organizationId).limit(2000) : Promise.resolve({ data: [] as any[] }),
      voitBanque ? supabase.from('users').select('first_name, last_name').eq('organization_id', organizationId).in('role', ROLES_INTERNES) : Promise.resolve({ data: [] as any[] }),
    ])

    let banque: Record<string, BanqueFormateur> | null = null
    let banqueNote: string | null = null
    let propositions: Proposition[] = []
    let acomptes: Acompte[] = []
    if (lecture.banque && pilotage) {
      // Factures ouvertes que la banque montre réglées, et virements d'acompte, sur tout le relevé
      const rapprochements = await chargerRapprochements(supabase, organizationId, lecture.banque).catch(() => null)
      propositions = rapprochements?.propositions || []
      acomptes = rapprochements?.acomptes || []
      const equipe = constituerEquipe(lecture.banque.membres, (utilisateurs.data || []) as any[])
      const joursBanque = Math.min(joursPeriode, JOURS_RELEVE - 1)
      const ventilation = ventilerParPersonne(lecture.banque, equipe, (formateurs.data || []) as any[], joursBanque, aujourdhui)
      const parFiche = new Map(ventilation.formateurs.filter((v) => v.formateurId).map((v) => [v.formateurId as string, v]))
      banque = {}
      for (const f of (formateurs.data || []) as any[]) {
        const nom = `${f.prenom || ''} ${f.nom || ''}`
        banque[f.id] = {
          versements: parFiche.get(f.id) || null,
          // Un formateur qui est aussi salarié ou dirigeant est payé avec l'équipe : ses virements ne sont pas des honoraires
          equipe: equipe.some((p) => estLaPersonne(nom, p.jetonsPrenom, p.jetonsNom)),
          acomptes: acomptes.filter((a) => a.formateurId === f.id),
        }
      }
      if (joursBanque < joursPeriode) banqueNote = `sur les ${Math.round(joursBanque / 30)} derniers mois seulement`
    }

    return (
      <div className="max-w-7xl mx-auto space-y-5 animate-fade-in">
        {entete}
        {lecture.erreur && (
          <div className="card p-4 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-warning-600 mt-0.5 shrink-0" />
            <p className="text-sm text-surface-600">{lecture.erreur}</p>
          </div>
        )}
        <RapprochementBanque propositions={propositions} />
        {pilotage
          ? <PilotageFormateurs pilotage={pilotage} banque={banque} periode={periode.phrase || `depuis le 1er janvier ${aujourdhui.slice(0, 4)}`} banqueNote={banqueNote} />
          : (
            <div className="card p-4 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-warning-600 mt-0.5 shrink-0" />
              <p className="text-sm text-surface-600">Le pilotage n’a pas pu être calculé. Rechargez la page.</p>
            </div>
          )}
      </div>
    )
  }

  // ── Liste des factures ──
  const { data: facturesRaw } = await supabase
    .from('factures_formateur')
    .select(`*, formateur:formateur_id(prenom, nom), ${SESSION_DETAIL_SELECT}`)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
  const factures = (facturesRaw || []) as any[]

  // Le détail de chaque prestation vient de la session rattachée
  const details = await chargerDetailsPrestations(supabase, factures)

  // Factures sans session : les sessions du même formateur pas encore facturées, pour les rattacher d'un clic
  const orphelins = [...new Set(factures.filter((f) => !f.session_id).map((f) => f.formateur_id))] as string[]
  const candidates: Record<string, { id: string; label: string }[]> = {}
  if (orphelins.length > 0) {
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, formateur_id, reference, date_debut, date_fin, formation:formation_id(intitule), client:client_id(raison_sociale, nom_commercial)')
      .eq('organization_id', organizationId)
      .in('formateur_id', orphelins)
      .neq('status', 'annulee')
      .order('date_debut', { ascending: false })
      .limit(1000)
    const facturees = new Set(factures.filter((f) => f.session_id && f.status !== 'rejetee').map((f) => `${f.formateur_id}:${f.session_id}`))
    for (const s of (sessions || []) as any[]) {
      if (facturees.has(`${s.formateur_id}:${s.id}`)) continue
      const client = s.client?.nom_commercial || s.client?.raison_sociale
      ;(candidates[s.formateur_id] ||= []).push({
        id: s.id,
        label: [periodeFr(s.date_debut, s.date_fin), client, s.formation?.intitule, s.reference].filter(Boolean).join(' · '),
      })
    }
  }

  // URLs signées des PDF déposés (bucket privé)
  const paths = factures.map((f) => f.fichier_url).filter((u) => u && !/^https?:\/\//.test(u)) as string[]
  const fileUrls: Record<string, string> = {}
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from('dossiers').createSignedUrls(paths, 3600)
    ;(signed || []).forEach((s, i) => { if (s?.signedUrl && !s.error) fileUrls[paths[i]] = s.signedUrl })
  }
  for (const f of factures) if (f.fichier_url && /^https?:\/\//.test(f.fichier_url)) fileUrls[f.fichier_url] = f.fichier_url

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in">
      {entete}
      <FacturesFormateursList factures={factures} fileUrls={fileUrls} details={details} candidates={candidates} />
    </div>
  )
}
