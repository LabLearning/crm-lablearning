'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings2, Trash2, X, Loader2, Save } from 'lucide-react'
import { updateFranchiseAction, deleteFranchiseAction } from '../actions'

interface Franchise {
  id: string
  nom: string
  raison_sociale: string | null
  siret: string | null
  secteur: string | null
  nombre_etablissements: number | null
  zone_geographique: string | null
  contact_nom: string | null
  contact_email: string | null
  contact_telephone: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  notes: string | null
}

/**
 * Modification des informations générales d'une franchise et suppression.
 * Les actions updateFranchiseAction / deleteFranchiseAction existaient déjà
 * mais n'étaient pas exposées : seule la commission était éditable.
 */
export function FranchiseSettingsClient({ franchise }: { franchise: Franchise }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true); setError(null)
    const fd = new FormData(e.currentTarget)
    const r = await updateFranchiseAction(franchise.id, fd)
    setSaving(false)
    if (r.success) { setOpen(false); router.refresh() }
    else setError(r.error || 'Erreur lors de la mise à jour')
  }

  async function handleDelete() {
    if (!confirm(
      `Supprimer la franchise « ${franchise.nom} » ?\n\nLes établissements rattachés ne seront PAS supprimés : ils seront simplement détachés du réseau.`,
    )) return
    setDeleting(true); setError(null)
    const r = await deleteFranchiseAction(franchise.id)
    if (r.success) { router.push('/dashboard/franchises') }
    else { setDeleting(false); setError(r.error || 'Suppression impossible') }
  }

  const F = (label: string, name: keyof Franchise, type = 'text') => (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-surface-500">{label}</label>
      <input
        type={type} name={name} defaultValue={(franchise[name] as any) ?? ''}
        className="input-base text-sm"
      />
    </div>
  )

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-surface-200 text-sm font-medium text-surface-700 hover:bg-surface-50"
      >
        <Settings2 className="h-4 w-4" /> Modifier la franchise
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && setOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100 sticky top-0 bg-white">
              <h2 className="text-lg font-heading font-bold text-surface-900">Modifier la franchise</h2>
              <button onClick={() => setOpen(false)} className="p-2 rounded-lg text-surface-400 hover:bg-surface-100"><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-surface-500">Nom de l&apos;enseigne *</label>
                <input name="nom" defaultValue={franchise.nom} required className="input-base text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {F('Raison sociale', 'raison_sociale')}
                {F('SIRET', 'siret')}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {F('Secteur', 'secteur')}
                {F('Établissements déclarés', 'nombre_etablissements', 'number')}
              </div>
              {F('Zone géographique', 'zone_geographique')}

              <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider pt-2">Contact référent</div>
              <div className="grid grid-cols-2 gap-3">
                {F('Nom', 'contact_nom')}
                {F('Téléphone', 'contact_telephone')}
              </div>
              {F('Email', 'contact_email', 'email')}
              {F('Adresse', 'adresse')}
              <div className="grid grid-cols-2 gap-3">
                {F('Code postal', 'code_postal')}
                {F('Ville', 'ville')}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-surface-500">Notes</label>
                <textarea name="notes" defaultValue={franchise.notes ?? ''} rows={2} className="input-base text-sm resize-none" />
              </div>

              {error && <p className="text-xs text-danger-600">{error}</p>}

              <div className="flex items-center justify-between gap-3 pt-3 border-t border-surface-100">
                <button
                  type="button" onClick={handleDelete} disabled={deleting}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-danger-600 hover:text-danger-700 disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Supprimer
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 rounded-lg border border-surface-200 text-sm font-medium text-surface-600 hover:bg-surface-50">Annuler</button>
                  <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Enregistrer
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
