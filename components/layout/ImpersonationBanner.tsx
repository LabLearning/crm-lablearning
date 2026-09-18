'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserCog, X } from '@/components/ui/icons'
import { stopImpersonationAction } from '@/app/dashboard/users/actions'
import { ROLE_LABELS } from '@/lib/types'

/**
 * Bandeau « mode aperçu » et sortie d'impersonation.
 *
 * Il vivait uniquement dans le shell administrateur. Or prendre la place d'un
 * formateur redirige vers /mon-espace, qui utilise un autre shell : l'admin s'y
 * retrouvait sans aucun moyen de revenir sur son compte. Le bandeau est
 * désormais commun à tous les espaces.
 */
export function ImpersonationBanner({ user }: { user: { first_name?: string | null; last_name?: string | null; role: string } }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function sortir() {
    setLoading(true)
    await stopImpersonationAction()
    // Rechargement complet : les Server Components ont été rendus avec
    // l'identité empruntée, un simple refresh laisserait des vues en cache.
    window.location.href = '/dashboard/users'
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <UserCog className="h-4 w-4 shrink-0" />
        <span className="text-xs sm:text-sm font-medium truncate">
          <span className="hidden sm:inline">Mode aperçu : vous naviguez en tant que </span>
          <span className="sm:hidden">Aperçu : </span>
          <strong>{user.first_name} {user.last_name}</strong>{' '}
          ({(ROLE_LABELS as any)[user.role] || user.role})
        </span>
      </div>
      <button
        onClick={sortir}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 min-h-[40px] sm:min-h-[36px] bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 shrink-0"
      >
        <X className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{loading ? 'Retour…' : 'Retour à mon compte'}</span>
        <span className="sm:hidden">{loading ? 'Retour…' : 'Retour'}</span>
      </button>
    </div>
  )
}
