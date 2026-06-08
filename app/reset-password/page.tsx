'use client'

import { useState, useEffect } from 'react'
import { Lock, ArrowRight, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

export default function ResetPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')

  // Au montage : Supabase auto-détecte le token de récupération depuis l'URL et établit une session temporaire
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
      else setError('Lien invalide ou expiré. Demandez un nouvel email de réinitialisation.')
    })
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (pwd.length < 8) { setError('Mot de passe trop court (min. 8 caractères)'); return }
    if (pwd !== pwd2) { setError('Les deux mots de passe ne correspondent pas'); return }

    setLoading(true)
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { error } = await supabase.auth.updateUser({ password: pwd })
    setLoading(false)
    if (error) { setError(error.message); return }
    setDone(true)
    setTimeout(() => { window.location.href = '/dashboard' }, 1500)
  }

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {done ? (
          <div className="card p-8 text-center">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-emerald-100 mb-5">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <h1 className="text-xl font-heading font-bold text-surface-900 mb-2">Mot de passe modifié</h1>
            <p className="text-surface-500 text-sm">Redirection vers votre tableau de bord…</p>
          </div>
        ) : error && !ready ? (
          <div className="card p-8 text-center">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-rose-100 mb-5">
              <AlertTriangle className="h-7 w-7 text-rose-600" />
            </div>
            <h1 className="text-xl font-heading font-bold text-surface-900 mb-2">Lien invalide</h1>
            <p className="text-surface-500 text-sm mb-6">{error}</p>
            <a href="/forgot-password" className="btn-primary inline-flex items-center gap-2 px-6 py-2.5">
              Demander un nouveau lien <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        ) : (
          <div className="card p-8">
            <h1 className="text-xl font-heading font-bold text-surface-900 mb-2">Nouveau mot de passe</h1>
            <p className="text-surface-500 text-sm mb-6">Choisissez un mot de passe sécurisé (au moins 8 caractères).</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="pwd" className="block text-xs font-semibold text-surface-700 mb-1 uppercase tracking-wider">Nouveau mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                  <input id="pwd" type="password" required minLength={8} value={pwd} onChange={(e) => setPwd(e.target.value)} className="input-base pl-10" placeholder="••••••••" />
                </div>
              </div>
              <div>
                <label htmlFor="pwd2" className="block text-xs font-semibold text-surface-700 mb-1 uppercase tracking-wider">Confirmation</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                  <input id="pwd2" type="password" required minLength={8} value={pwd2} onChange={(e) => setPwd2(e.target.value)} className="input-base pl-10" placeholder="••••••••" />
                </div>
              </div>
              {error && <div className="text-xs text-rose-600">{error}</div>}
              <button type="submit" disabled={loading || !ready} className="btn-primary w-full justify-center inline-flex items-center gap-2 px-4 py-2.5 disabled:opacity-50">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Définir le mot de passe
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
