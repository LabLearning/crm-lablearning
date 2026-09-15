'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Mail, Loader2, Check, ShieldOff, KeyRound, Eye } from '@/components/ui/icons'
import { cn } from '@/lib/utils'
import { inviteFranchiseUserAction, revokeFranchiseUserAction } from '../actions'
import { startImpersonationAction } from '@/app/dashboard/users/actions'

interface FranchiseUser {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  status: string
}

const STATUS_META: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: 'Actif', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  invited: { label: 'Invité', bg: 'bg-amber-50', text: 'text-amber-700' },
  suspended: { label: 'Révoqué', bg: 'bg-rose-50', text: 'text-rose-700' },
  inactive: { label: 'Inactif', bg: 'bg-surface-100', text: 'text-surface-600' },
}

export default function FranchiseAccessClient({
  franchiseId, users, canImpersonate,
}: { franchiseId: string; users: FranchiseUser[]; canImpersonate?: boolean }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Lien d'activation, à transmettre à la main si le mail n'arrive pas. */
  const [lien, setLien] = useState<string | null>(null)

  const handleImpersonate = (userId: string) => {
    startTransition(async () => {
      const r = await startImpersonationAction(userId)
      if (r.success) { router.push('/franchise'); router.refresh() }
      else alert((r as any).error || 'Erreur')
    })
  }

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)
    setError(null)
    setSent(null)
    startTransition(async () => {
      const r = await inviteFranchiseUserAction(franchiseId, email)
      setSending(false)
      if (r.success) {
        // Le compte est prêt même si l'email n'est pas parti : le lien
        // d'activation s'affiche pour être transmis à la main.
        const avertissement = (r as any).warning as string | undefined
        if (avertissement) setError(avertissement)
        else setSent(email)
        setLien(((r as any).data?.inviteUrl as string) || null)
        setEmail('')
        router.refresh()
      } else {
        setError((r as any).error || 'Erreur')
        setLien(null)
      }
    })
  }

  const handleRevoke = (userId: string) => {
    if (!confirm('Révoquer l\'accès de cet utilisateur ?')) return
    startTransition(async () => {
      const r = await revokeFranchiseUserAction(userId)
      if (!r.success) alert((r as any).error || 'Erreur')
      else router.refresh()
    })
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-3">
        <KeyRound className="h-4 w-4 text-surface-400" />
        <h2 className="text-sm font-heading font-semibold text-surface-900">Accès au portail franchise</h2>
      </div>
      <p className="text-xs text-surface-500 mb-4">
        Invitez les responsables de cette franchise. Ils recevront un email Lab Learning pour créer leur mot de passe
        et accéder à leur tableau de bord (établissements, audits, formations, commissions).
      </p>

      {/* Liste users */}
      {users.length > 0 && (
        <div className="space-y-2 mb-4">
          {users.map((u) => {
            const meta = STATUS_META[u.status] || STATUS_META.inactive
            const name = `${u.first_name || ''} ${u.last_name || ''}`.trim()
            return (
              <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-surface-200/70">
                <div className="h-8 w-8 rounded-full bg-brand-50 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0">
                  {((u.first_name?.[0] || u.email[0]) + (u.last_name?.[0] || '')).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-surface-900 truncate">{name || u.email}</div>
                  {name && <div className="text-xs text-surface-400 truncate">{u.email}</div>}
                </div>
                <span className={cn('text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0', meta.bg, meta.text)}>
                  {meta.label}
                </span>
                {canImpersonate && u.status === 'active' && (
                  <button onClick={() => handleImpersonate(u.id)}
                    className="shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2 py-1.5 rounded-md text-brand-600 hover:bg-brand-50" title="Voir son espace">
                    <Eye className="h-3.5 w-3.5" /> Aperçu
                  </button>
                )}
                {u.status !== 'suspended' && (
                  <button onClick={() => handleRevoke(u.id)}
                    className="shrink-0 p-1.5 rounded-md text-surface-400 hover:text-rose-600 hover:bg-rose-50" title="Révoquer l'accès">
                    <ShieldOff className="h-4 w-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Invite form */}
      <form onSubmit={handleInvite} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setSent(null) }}
            placeholder="email@franchise.fr"
            className="input-base pl-9 w-full text-sm"
          />
        </div>
        <button type="submit" disabled={sending || !email.trim()} className="btn-primary inline-flex items-center gap-2 px-4 py-2 shrink-0">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Inviter
        </button>
      </form>
      {sent && (
        <div className="mt-2 text-xs text-emerald-600 inline-flex items-center gap-1">
          <Check className="h-3.5 w-3.5" /> Invitation envoyée à {sent}
        </div>
      )}
      {error && <div className="mt-2 text-xs text-rose-600">{error}</div>}
      {lien && (
        <div className="mt-2 rounded-lg bg-surface-50 border border-surface-200 p-2.5">
          <div className="text-[11px] font-semibold text-surface-600 mb-1">Lien d&apos;activation, à transmettre si besoin</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate text-[11px] text-surface-700">{lien}</code>
            <button
              type="button"
              onClick={() => { navigator.clipboard?.writeText(lien); setSent('Lien copié') }}
              className="shrink-0 text-[11px] font-semibold px-2 py-1 rounded border border-surface-200 text-surface-600 hover:bg-white"
            >
              Copier
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
