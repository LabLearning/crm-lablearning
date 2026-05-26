'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UserCog, UserPlus, UserMinus, Repeat, Check, X, Loader2, Calendar, GraduationCap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { validateChangeAction, refuseChangeAction } from './actions'

interface Demande {
  id: string
  type: string
  statut: string
  motif: string | null
  nouveau_nom: string | null
  nouveau_prenom: string | null
  nouveau_email: string | null
  nouveau_telephone: string | null
  created_at: string
  validated_at: string | null
  reponse_gestionnaire: string | null
  session: { id: string; reference: string; date_debut: string; formation: { intitule: string } | null } | null
  formateur: { prenom: string | null; nom: string | null } | null
  apprenant: { prenom: string | null; nom: string | null } | null
}

const TYPE_META: Record<string, { label: string; icon: any; bg: string; text: string }> = {
  ajout: { label: 'Ajout', icon: UserPlus, bg: 'bg-emerald-50', text: 'text-emerald-700' },
  retrait: { label: 'Retrait', icon: UserMinus, bg: 'bg-rose-50', text: 'text-rose-700' },
  remplacement: { label: 'Remplacement', icon: Repeat, bg: 'bg-blue-50', text: 'text-blue-700' },
}
const STATUT_META: Record<string, { label: string; bg: string; text: string }> = {
  en_attente: { label: 'À valider', bg: 'bg-amber-50', text: 'text-amber-700' },
  validee: { label: 'Validée', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  refusee: { label: 'Refusée', bg: 'bg-surface-100', text: 'text-surface-500' },
}

export default function ChangementsClient({ demandes }: { demandes: Demande[] }) {
  const [filter, setFilter] = useState<'en_attente' | 'all'>('en_attente')

  const filtered = useMemo(
    () => demandes.filter((d) => (filter === 'en_attente' ? d.statut === 'en_attente' : true)),
    [demandes, filter],
  )
  const nbEnAttente = demandes.filter((d) => d.statut === 'en_attente').length

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Changements de participants</h1>
        <p className="text-surface-500 text-sm mt-1">
          Demandes déclarées par les formateurs sur le terrain — à valider.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => setFilter('en_attente')}
          className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium', filter === 'en_attente' ? 'bg-surface-900 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200')}>
          À valider {nbEnAttente > 0 && <span className="text-[10px] bg-amber-400 text-surface-900 px-1.5 rounded">{nbEnAttente}</span>}
        </button>
        <button onClick={() => setFilter('all')}
          className={cn('px-3 py-1.5 rounded-lg text-sm font-medium', filter === 'all' ? 'bg-surface-900 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200')}>
          Toutes
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center text-center py-14 px-8">
          <UserCog className="h-6 w-6 text-surface-400 mb-3" />
          <p className="text-sm text-surface-500">{filter === 'en_attente' ? 'Aucune demande en attente' : 'Aucune demande'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => <DemandeCard key={d.id} d={d} />)}
        </div>
      )}
    </div>
  )
}

function DemandeCard({ d }: { d: Demande }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const meta = TYPE_META[d.type] || TYPE_META.remplacement
  const st = STATUT_META[d.statut] || STATUT_META.en_attente
  const Icon = meta.icon
  const formateurNom = `${d.formateur?.prenom || ''} ${d.formateur?.nom || ''}`.trim()
  const ancien = `${d.apprenant?.prenom || ''} ${d.apprenant?.nom || ''}`.trim()
  const nouveau = `${d.nouveau_prenom || ''} ${d.nouveau_nom || ''}`.trim()

  const act = (fn: () => Promise<{ success: boolean; error?: string }>) =>
    startTransition(async () => {
      const r = await fn()
      if (!r.success) alert((r as any).error || 'Erreur'); else router.refresh()
    })

  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <div className={cn('shrink-0 h-9 w-9 rounded-lg flex items-center justify-center', meta.bg)}>
          <Icon className={cn('h-4 w-4', meta.text)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded', meta.bg, meta.text)}>{meta.label}</span>
            <span className={cn('text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded', st.bg, st.text)}>{st.label}</span>
            {d.session && (
              <Link href={`/dashboard/sessions/${d.session.id}`} className="text-sm font-medium text-surface-900 hover:text-brand-600 inline-flex items-center gap-1">
                <GraduationCap className="h-3.5 w-3.5 text-surface-400" />
                {d.session.formation?.intitule || d.session.reference}
              </Link>
            )}
          </div>
          <div className="text-sm text-surface-700 mt-1.5">
            {d.type === 'retrait' && <>Retirer <strong>{ancien || '—'}</strong></>}
            {d.type === 'ajout' && <>Ajouter <strong>{nouveau || '—'}</strong></>}
            {d.type === 'remplacement' && <>Remplacer <strong>{ancien || '—'}</strong> par <strong>{nouveau || '—'}</strong></>}
            {d.nouveau_email && <span className="text-surface-400"> · {d.nouveau_email}</span>}
            {d.nouveau_telephone && <span className="text-surface-400"> · {d.nouveau_telephone}</span>}
          </div>
          {d.motif && <div className="text-xs text-surface-500 mt-1 italic">« {d.motif} »</div>}
          <div className="text-[11px] text-surface-400 mt-1.5 flex items-center gap-2 flex-wrap">
            {formateurNom && <span>Demandé par {formateurNom}</span>}
            <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(d.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        {d.statut === 'en_attente' && (
          <div className="shrink-0 flex items-center gap-1.5">
            <button onClick={() => act(() => validateChangeAction(d.id))} disabled={isPending}
              className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Valider
            </button>
            <button onClick={() => { if (confirm('Refuser cette demande ?')) act(() => refuseChangeAction(d.id)) }} disabled={isPending}
              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-2 rounded-lg border border-surface-200 text-surface-600 hover:bg-rose-50 hover:text-rose-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
