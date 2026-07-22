'use client'

import { useRef, useState } from 'react'
import { Send, CheckCircle2, User, Building2, GraduationCap, Store } from 'lucide-react'
import { submitLeadFromPortalAction } from './actions'

interface Props {
  token: string
  franchises?: { id: string; nom: string }[]
}

export function NouveauLeadForm({ token, franchises = [] }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [estFranchise, setEstFranchise] = useState(false)
  const [franchiseId, setFranchiseId] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setFieldErrors({})

    const formData = new FormData(e.currentTarget)
    const result = await submitLeadFromPortalAction(token, formData)

    setIsLoading(false)

    if (result.success) {
      setSuccess(true)
    } else if (result.errors) {
      setFieldErrors(result.errors)
    } else {
      setError(result.error || 'Une erreur est survenue.')
    }
  }

  function handleReset() {
    setSuccess(false)
    setError(null)
    setFieldErrors({})
    formRef.current?.reset()
  }

  if (success) {
    return (
      <div className="card p-8 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-success-50 flex items-center justify-center mb-4">
          <CheckCircle2 className="h-7 w-7 text-success-600" />
        </div>
        <h2 className="text-lg font-heading font-bold text-surface-900 tracking-tight mb-2">
          Lead transmis avec succès
        </h2>
        <p className="text-surface-500 text-sm mb-6 max-w-md">
          Votre lead a été transmis avec succès&nbsp;! Notre équipe prendra contact avec vous rapidement.
        </p>
        <button
          type="button"
          onClick={handleReset}
          className="btn-primary"
        >
          Soumettre un autre lead
        </button>
      </div>
    )
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-6">
        <Send className="h-5 w-5 text-brand-500" />
        <h2 className="text-base font-heading font-bold text-surface-900 tracking-tight">
          Soumettre un nouveau lead
        </h2>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-danger-50 border border-danger-200 text-danger-700 text-sm">
          {error}
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} noValidate>
        {/* Section Contact prospect */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <User className="h-4 w-4 text-surface-400" />
            <span className="section-label">Contact prospect</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-surface-600 mb-1">
                Prénom
              </label>
              <input
                type="text"
                name="contact_prenom"
                className="input-base w-full"
                placeholder="Prénom"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-600 mb-1">
                Nom <span className="text-danger-500">*</span>
              </label>
              <input
                type="text"
                name="contact_nom"
                className={`input-base w-full${fieldErrors.contact_nom ? ' border-danger-400 focus:ring-danger-300' : ''}`}
                placeholder="Nom"
              />
              {fieldErrors.contact_nom && (
                <p className="mt-1 text-xs text-danger-600">{fieldErrors.contact_nom}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-600 mb-1">
                Email
              </label>
              <input
                type="email"
                name="contact_email"
                className={`input-base w-full${fieldErrors.contact_email ? ' border-danger-400 focus:ring-danger-300' : ''}`}
                placeholder="email@exemple.fr"
              />
              {fieldErrors.contact_email && (
                <p className="mt-1 text-xs text-danger-600">{fieldErrors.contact_email}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-600 mb-1">
                Téléphone
              </label>
              <input
                type="tel"
                name="contact_telephone"
                className="input-base w-full"
                placeholder="06 00 00 00 00"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-surface-600 mb-1">
                Poste / Fonction
              </label>
              <input
                type="text"
                name="contact_poste"
                className="input-base w-full"
                placeholder="Ex: Responsable RH"
              />
            </div>
          </div>
        </div>

        {/* Section Entreprise */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="h-4 w-4 text-surface-400" />
            <span className="section-label">Entreprise</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-surface-600 mb-1">
                Nom de l&apos;entreprise
              </label>
              <input
                type="text"
                name="entreprise"
                className="input-base w-full"
                placeholder="Raison sociale"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-600 mb-1">
                SIRET
              </label>
              <input
                type="text"
                name="siret"
                className="input-base w-full"
                placeholder="14 chiffres"
                maxLength={14}
              />
            </div>
          </div>

          {/* Établissement franchisé : classé dans son réseau à la conversion */}
          {franchises.length > 0 && (
            <div className="mt-4 rounded-xl border border-surface-200 p-3 space-y-2.5 bg-surface-50/50">
              <label className="flex items-center gap-2 text-sm font-medium text-surface-700 cursor-pointer">
                <input
                  type="checkbox" checked={estFranchise}
                  onChange={(e) => { setEstFranchise(e.target.checked); if (!e.target.checked) setFranchiseId('') }}
                  className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                />
                <Store className="h-4 w-4 text-surface-500" />
                Établissement franchisé
              </label>
              {estFranchise && (
                <select
                  value={franchiseId} onChange={(e) => setFranchiseId(e.target.value)}
                  className="input-base w-full"
                >
                  <option value="">— Choisir la franchise —</option>
                  {franchises.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
                </select>
              )}
              <input type="hidden" name="franchise_id" value={estFranchise ? franchiseId : ''} />
            </div>
          )}
        </div>

        {/* Section Besoins en formation */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <GraduationCap className="h-4 w-4 text-surface-400" />
            <span className="section-label">Besoins en formation</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-surface-600 mb-1">
                Formation souhaitée
              </label>
              <input
                type="text"
                name="formation_souhaitee"
                className="input-base w-full"
                placeholder="Ex: Hygiène alimentaire HACCP"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-600 mb-1">
                Nombre de stagiaires
              </label>
              <input
                type="number"
                name="nombre_stagiaires"
                min={1}
                className="input-base w-full"
                placeholder="Ex: 5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-600 mb-1">
                Date souhaitée
              </label>
              <input
                type="date"
                name="date_souhaitee"
                className="input-base w-full"
              />
            </div>
          </div>
        </div>

        {/* Commentaire */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-surface-600 mb-1">
            Commentaire
          </label>
          <textarea
            name="commentaire"
            rows={4}
            className="input-base w-full resize-none"
            placeholder="Informations complémentaires, contexte, contraintes..."
          />
        </div>

        {/* Info note */}
        <div className="mb-5 px-4 py-3 rounded-lg bg-surface-50 border border-surface-100 text-surface-500 text-xs leading-relaxed">
          Une fois soumis, notre équipe commerciale examinera votre lead et vous tiendra informé de son avancement.
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2"
        >
          <Send className="h-4 w-4" />
          {isLoading ? 'Envoi en cours...' : 'Soumettre le lead'}
        </button>
      </form>
    </div>
  )
}
