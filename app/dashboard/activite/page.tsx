import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { History } from '@/components/ui/icons'
import { TABLES_ACTIVITE, entitesPourTable, type Activite } from '@/lib/activite'
import { ActiviteClient, type Utilisateur, type Evenement } from './ActiviteClient'

export const dynamic = 'force-dynamic'

const PAR_PAGE = 60
const ROLES_JOURNAL = ['super_admin', 'gestionnaire']
/** Codes « la table n'existe pas » : cache PostgREST, undefined_table */
const TABLE_ABSENTE = ['PGRST205', '42P01']
const FUSEAU = 'Europe/Paris'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const JOUR = /^\d{4}-\d{2}-\d{2}$/

type Brut = string | string[] | undefined
interface Params { acteur?: Brut; table?: Brut; operation?: Brut; du?: Brut; au?: Brut; q?: Brut; page?: Brut; vue?: Brut }

/** Next livre string | string[] : on garde la première valeur. */
const un = (v: Brut) => (Array.isArray(v) ? v[0] : v) || ''

/** Lendemain d'un jour AAAA-MM-JJ, sans dérive de fuseau. */
function lendemain(jour: string): string {
  const d = new Date(`${jour}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** Motif ILIKE « contient » : jokers Postgres et étoile PostgREST échappés. */
function motifRecherche(saisie: string): string | null {
  const terme = saisie.trim().slice(0, 200)
  if (!terme) return null
  return `%${terme.replace(/[\\%_]/g, '\\$&').replace(/\*/g, '\\*')}%`
}

/** Ne garde des paramètres d'URL que ce que la base peut accepter. */
function assainir(p: Params) {
  const acteurBrut = un(p.acteur)
  const table = un(p.table)
  const operation = un(p.operation)
  const du = un(p.du); const au = un(p.au)
  return {
    acteur: acteurBrut === 'systeme' || UUID.test(acteurBrut) ? acteurBrut : '',
    table: table in TABLES_ACTIVITE ? table : '',
    operation: ['insert', 'update', 'delete'].includes(operation) ? operation : '',
    du: JOUR.test(du) && !isNaN(Date.parse(du)) ? du : '',
    au: JOUR.test(au) && !isNaN(Date.parse(au)) ? au : '',
    q: un(p.q).trim().slice(0, 200),
    page: Math.max(1, Number(un(p.page)) || 1),
    vue: un(p.vue) === 'evenements' ? 'evenements' as const : 'modifications' as const,
  }
}

/**
 * Journal d'activité : qui a fait quoi, quand, sur quelle fiche, et la
 * possibilité de revenir en arrière. Deux vues : les modifications de
 * données (journalisées par déclencheur) et les événements applicatifs
 * (mails envoyés, documents générés, lectures de secrets).
 */
export default async function ActivitePage({ searchParams }: { searchParams?: Params }) {
  const session = await getSession()
  if (!ROLES_JOURNAL.includes(session.user.role)) redirect('/dashboard')
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id
  const f = assainir(searchParams || {})
  const { page, vue } = f
  // Bornes de jour en heure de Paris (la base est en UTC), fin exclusive au lendemain minuit
  const depuis = f.du ? `${f.du}T00:00:00 ${FUSEAU}` : null
  const jusqua = f.au ? `${lendemain(f.au)}T00:00:00 ${FUSEAU}` : null
  const motif = motifRecherche(f.q)

  const { data: utilisateurs } = await supabase.from('users')
    .select('id, first_name, last_name, avatar_url, role')
    .eq('organization_id', orgId).order('first_name')

  let activites: Activite[] = []
  let evenements: Evenement[] = []
  let total = 0
  let journalAbsent = false
  let erreur: string | null = null

  if (vue === 'modifications') {
    let q = supabase.from('activites')
      .select('*, acteur:acteur_id(first_name, last_name, avatar_url, email), impersonateur:impersone_par(first_name, last_name)', { count: 'exact' })
      .eq('organization_id', orgId)
    if (f.acteur === 'systeme') q = q.is('acteur_id', null)
    // Filtrer une personne montre aussi ce qui a été fait en son nom par un super administrateur
    else if (f.acteur) q = q.or(`acteur_id.eq.${f.acteur},impersone_par.eq.${f.acteur}`)
    if (f.table) q = q.eq('table_name', f.table)
    if (f.operation) q = q.eq('operation', f.operation)
    if (depuis) q = q.gte('created_at', depuis)
    if (jusqua) q = q.lt('created_at', jusqua)
    if (motif) q = q.ilike('libelle', motif)
    const { data, error, count } = await q.order('created_at', { ascending: false }).range((page - 1) * PAR_PAGE, page * PAR_PAGE - 1)
    if (error) {
      if (TABLE_ABSENTE.includes(String((error as any).code))) journalAbsent = true
      else { console.error('[journal activité]', error); erreur = 'Le journal n’a pas pu être lu. Réessayez dans un instant.' }
    }
    activites = (data || []) as Activite[]
    total = count || 0
  } else {
    let q = supabase.from('audit_logs')
      .select('id, user_id, action, entity_type, entity_id, details, created_at, acteur:user_id(first_name, last_name, avatar_url, email)', { count: 'exact' })
      .eq('organization_id', orgId)
    if (f.acteur === 'systeme') q = q.is('user_id', null)
    else if (f.acteur) q = q.eq('user_id', f.acteur)
    if (f.table) q = q.in('entity_type', entitesPourTable(f.table))
    if (depuis) q = q.gte('created_at', depuis)
    if (jusqua) q = q.lt('created_at', jusqua)
    if (motif) q = q.ilike('action', motif)
    const { data, error, count } = await q.order('created_at', { ascending: false }).range((page - 1) * PAR_PAGE, page * PAR_PAGE - 1)
    if (error) { console.error('[journal événements]', error); erreur = 'Les événements n’ont pas pu être lus. Réessayez dans un instant.' }
    evenements = (data || []) as unknown as Evenement[]
    total = count || 0
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading flex items-center gap-2.5">
            <History className="h-6 w-6 text-brand-500" /> Journal d&apos;activité
          </h1>
          <p className="text-sm text-surface-500 mt-1">
            Qui a fait quoi, quand, sur quelle fiche. Chaque modification peut être annulée par un super administrateur.
          </p>
        </div>
      </div>

      <ActiviteClient
        vue={vue}
        activites={activites}
        evenements={evenements}
        total={total}
        page={page}
        parPage={PAR_PAGE}
        utilisateurs={(utilisateurs || []) as Utilisateur[]}
        filtres={{ acteur: f.acteur, table: f.table, operation: f.operation, du: f.du, au: f.au, q: f.q }}
        peutAnnuler={session.user.role === 'super_admin'}
        journalAbsent={journalAbsent}
        erreur={erreur}
      />
    </div>
  )
}
