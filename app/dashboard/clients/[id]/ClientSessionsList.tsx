'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Calendar, User, Trash2, ExternalLink, Loader2 } from '@/components/ui/icons'
import { Badge, RowMenu, useToast } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { SESSION_STATUS_LABELS, SESSION_STATUS_COLORS } from '@/lib/types/formation'
import { deleteSessionAction } from '@/app/dashboard/sessions/actions'

export function ClientSessionsList({ sessions, canManage }: { sessions: any[]; canManage: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, start] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

  function remove(s: any) {
    const label = s.formation?.intitule || s.reference || 'cette session'
    if (!confirm(`Supprimer « ${label} » ? Cette action est définitive (émargements, inscriptions et QCM de la session seront perdus).`)) return
    setBusyId(s.id)
    start(async () => {
      const r = await deleteSessionAction(s.id)
      setBusyId(null)
      if (r.success) { toast('success', 'Session supprimée'); router.refresh() }
      else toast('error', r.error || 'Suppression impossible')
    })
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-brand-500" />
        <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Sessions de formation ({sessions.length})</span>
      </div>
      {sessions.length === 0 ? (
        <div className="text-center py-8 text-sm text-surface-400">Aucune session</div>
      ) : (
        <div className="divide-y divide-surface-100">
          {sessions.slice(0, 30).map((s) => {
            const formateurNom = s.formateur ? `${s.formateur.prenom || ''} ${s.formateur.nom || ''}`.trim() : null
            return (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50 transition-colors">
                <Calendar className="h-4 w-4 text-surface-400 shrink-0 hidden sm:block" />
                <Link href={`/dashboard/sessions/${s.id}`} className="flex-1 min-w-0 min-h-10 flex flex-col justify-center">
                  <div className="text-sm font-medium text-surface-900 truncate hover:text-brand-600 transition-colors">
                    {s.formation?.intitule || s.intitule || s.reference || 'Session'}
                  </div>
                  <div className="text-xs text-surface-500 flex items-center gap-3 flex-wrap mt-0.5">
                    {s.reference && <span className="font-mono text-surface-400">{s.reference}</span>}
                    {s.date_debut && (
                      <span>{formatDate(s.date_debut, { day: 'numeric', month: 'short' })}{s.date_fin && s.date_fin !== s.date_debut ? ` → ${formatDate(s.date_fin, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</span>
                    )}
                    {formateurNom && <span className="flex items-center gap-1"><User className="h-3 w-3 shrink-0" />{formateurNom}</span>}
                    {s.status && (
                      <Badge variant={SESSION_STATUS_COLORS[s.status as keyof typeof SESSION_STATUS_COLORS] || 'default'} dot className="sm:hidden">
                        {SESSION_STATUS_LABELS[s.status as keyof typeof SESSION_STATUS_LABELS] || s.status}
                      </Badge>
                    )}
                  </div>
                </Link>
                {s.status && (
                  <Badge variant={SESSION_STATUS_COLORS[s.status as keyof typeof SESSION_STATUS_COLORS] || 'default'} dot className="hidden sm:inline-flex">
                    {SESSION_STATUS_LABELS[s.status as keyof typeof SESSION_STATUS_LABELS] || s.status}
                  </Badge>
                )}
                {busyId === s.id ? (
                  <Loader2 className="h-4 w-4 text-surface-400 animate-spin shrink-0" />
                ) : (
                  <RowMenu triggerClassName="h-10 w-10 flex items-center justify-center -my-2" items={[
                    { label: 'Ouvrir la session', icon: <ExternalLink className="h-4 w-4 text-surface-400" />, href: `/dashboard/sessions/${s.id}` } as any,
                    ...(canManage ? [{ label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, onClick: () => remove(s), danger: true }] : []),
                  ]} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
