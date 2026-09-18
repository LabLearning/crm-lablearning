import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { History } from '@/components/ui/icons'
import type { Activite } from '@/lib/activite'
import { ActiviteClient, type Utilisateur, type Evenement } from './ActiviteClient'

export const dynamic = 'force-dynamic'

const PAR_PAGE = 60
const ROLES_JOURNAL = ['super_admin', 'gestionnaire']

interface Params {
  acteur?: string
  table?: string
  operation?: string
  du?: string
  au?: string
  q?: string
  page?: string
  vue?: string
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
  const p = searchParams || {}
  const page = Math.max(1, Number(p.page) || 1)
  const vue = p.vue === 'evenements' ? 'evenements' : 'modifications'

  const { data: utilisateurs } = await supabase.from('users')
    .select('id, first_name, last_name, avatar_url, role')
    .eq('organization_id', orgId).order('first_name')

  let activites: Activite[] = []
  let total = 0
  let journalAbsent = false
  let evenements: Evenement[] = []
  let totalEvenements = 0

  if (vue === 'modifications') {
    let q = supabase.from('activites')
      .select('*, acteur:acteur_id(first_name, last_name, avatar_url, email), impersonateur:impersone_par(first_name, last_name)', { count: 'exact' })
      .eq('organization_id', orgId)
    if (p.acteur === 'systeme') q = q.is('acteur_id', null)
    else if (p.acteur) q = q.eq('acteur_id', p.acteur)
    if (p.table) q = q.eq('table_name', p.table)
    if (p.operation && ['insert', 'update', 'delete'].includes(p.operation)) q = q.eq('operation', p.operation)
    if (p.du) q = q.gte('created_at', `${p.du}T00:00:00`)
    if (p.au) q = q.lte('created_at', `${p.au}T23:59:59`)
    if (p.q) q = q.ilike('libelle', `%${p.q.trim()}%`)
    const { data, error, count } = await q.order('created_at', { ascending: false }).range((page - 1) * PAR_PAGE, page * PAR_PAGE - 1)
    if (error) journalAbsent = true
    activites = (data || []) as Activite[]
    total = count || 0
  } else {
    let q = supabase.from('audit_logs')
      .select('id, user_id, action, entity_type, entity_id, details, created_at, acteur:user_id(first_name, last_name, avatar_url, email)', { count: 'exact' })
      .eq('organization_id', orgId)
    if (p.acteur === 'systeme') q = q.is('user_id', null)
    else if (p.acteur) q = q.eq('user_id', p.acteur)
    if (p.table) q = q.eq('entity_type', p.table)
    if (p.du) q = q.gte('created_at', `${p.du}T00:00:00`)
    if (p.au) q = q.lte('created_at', `${p.au}T23:59:59`)
    if (p.q) q = q.ilike('action', `%${p.q.trim()}%`)
    const { data, count } = await q.order('created_at', { ascending: false }).range((page - 1) * PAR_PAGE, page * PAR_PAGE - 1)
    evenements = (data || []) as unknown as Evenement[]
    totalEvenements = count || 0
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
        total={vue === 'modifications' ? total : totalEvenements}
        page={page}
        parPage={PAR_PAGE}
        utilisateurs={(utilisateurs || []) as Utilisateur[]}
        filtres={{ acteur: p.acteur || '', table: p.table || '', operation: p.operation || '', du: p.du || '', au: p.au || '', q: p.q || '' }}
        peutAnnuler={session.user.role === 'super_admin'}
        journalAbsent={journalAbsent}
      />
    </div>
  )
}
