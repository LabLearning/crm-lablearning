'use client'

import { useState } from 'react'
import { Mail, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'
import { requestPasswordResetAction } from '../(auth)/actions'

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const r = await requestPasswordResetAction(fd)
    if (r.success) setSent(true)
    else setError(r.error || 'Erreur')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <a href="/login" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-800 mb-6">
          <ArrowLeft className="h-4 w-4" /> Retour à la connexion
        </a>

        {sent ? (
          <div className="card p-8 text-center">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-emerald-100 mb-5">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <h1 className="text-xl font-heading font-bold text-surface-900 mb-2">Email envoyé</h1>
            <p className="text-surface-500 text-sm">
              Si un compte est associé à cette adresse, vous allez recevoir un email avec un lien
              pour réinitialiser votre mot de passe. Pensez à vérifier vos spams.
            </p>
          </div>
        ) : (
          <div className="card p-8">
            <h1 className="text-xl font-heading font-bold text-surface-900 mb-2">Mot de passe oublié ?</h1>
            <p className="text-surface-500 text-sm mb-6">
              Entrez l'adresse email de votre compte. Nous vous enverrons un lien sécurisé pour
              en définir un nouveau.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-surface-700 mb-1 uppercase tracking-wider">Adresse email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                  <input
                    id="email" name="email" type="email" required
                    className="input-base pl-10"
                    placeholder="vous@email.fr"
                  />
                </div>
              </div>
              {error && <div className="text-xs text-rose-600">{error}</div>}
              <button
                type="submit" disabled={loading}
                className="btn-primary w-full justify-center inline-flex items-center gap-2 px-4 py-2.5 disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Envoyer le lien
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
