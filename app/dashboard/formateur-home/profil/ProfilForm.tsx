'use client'

import { useState, useRef } from 'react'
import { Save, Camera, FileText, Plus, X, Loader2 } from '@/components/ui/icons'
import { updateProfilFormateurAction } from './actions'
import { cn } from '@/lib/utils'
import { AdresseGroupe, AdresseInput, CodePostalInput, VilleInput } from '@/components/ui'

interface Diplome {
  intitule: string
  etablissement: string
  annee: string
}

interface ProfilFormProps {
  formateur: {
    id: string
    prenom: string
    nom: string
    email: string
    telephone: string | null
    bio: string | null
    photo_url: string | null
    cv_url: string | null
    adresse: string | null
    ville: string | null
    code_postal: string | null
    siret: string | null
    tarif_journalier: number | null
    tarif_horaire: number | null
    diplomes: Diplome[]
  }
}

export function ProfilForm({ formateur }: ProfilFormProps) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(formateur.photo_url)
  const [photoBase64, setPhotoBase64] = useState<string | null>(null)
  const [cvBase64, setCvBase64] = useState<string | null>(null)
  const [cvName, setCvName] = useState<string | null>(formateur.cv_url ? 'CV actuel' : null)
  const [diplomes, setDiplomes] = useState<Diplome[]>(formateur.diplomes || [])
  const photoRef = useRef<HTMLInputElement>(null)
  const cvRef = useRef<HTMLInputElement>(null)

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = document.createElement('img')
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const scale = Math.min(1, 400 / img.width)
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        const compressed = canvas.toDataURL('image/jpeg', 0.8)
        setPhotoPreview(compressed)
        setPhotoBase64(compressed)
      }
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  function handleCvChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCvName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => setCvBase64(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function addDiplome() {
    setDiplomes([...diplomes, { intitule: '', etablissement: '', annee: '' }])
  }

  function removeDiplome(idx: number) {
    setDiplomes(diplomes.filter((_, i) => i !== idx))
  }

  function updateDiplome(idx: number, field: keyof Diplome, value: string) {
    setDiplomes(diplomes.map((d, i) => i === idx ? { ...d, [field]: value } : d))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    const formData = new FormData(e.currentTarget)
    if (photoBase64) formData.set('photo', photoBase64)
    if (cvBase64) formData.set('cv', cvBase64)
    formData.set('diplomes', JSON.stringify(diplomes.filter(d => d.intitule.trim())))

    const result = await updateProfilFormateurAction(formData)
    if (result.success) {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } else {
      setError(result.error || 'Erreur')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Photo + identité */}
      <div className="card p-6">
        <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-4">Identité</div>
        <div className="flex items-start gap-6">
          {/* Photo */}
          <div className="shrink-0">
            <div
              onClick={() => photoRef.current?.click()}
              className="h-24 w-24 rounded-2xl bg-surface-100 flex items-center justify-center overflow-hidden cursor-pointer hover:ring-2 hover:ring-brand-300 transition-all relative group"
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Photo" className="h-full w-full object-cover" />
              ) : (
                <Camera className="h-8 w-8 text-surface-400" />
              )}
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="h-5 w-5 text-white" />
              </div>
            </div>
            <input ref={photoRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
          </div>

          <div className="flex-1 grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-surface-700 mb-1.5 block">Prénom</label>
              <input name="prenom" defaultValue={formateur.prenom} className="input-base" />
            </div>
            <div>
              <label className="text-sm font-medium text-surface-700 mb-1.5 block">Nom</label>
              <input name="nom" defaultValue={formateur.nom} className="input-base" />
            </div>
            <div>
              <label className="text-sm font-medium text-surface-700 mb-1.5 block">Email</label>
              <input value={formateur.email} disabled className="input-base bg-surface-50 text-surface-400" />
            </div>
            <div>
              <label className="text-sm font-medium text-surface-700 mb-1.5 block">Téléphone</label>
              <input name="telephone" defaultValue={formateur.telephone || ''} className="input-base" />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium text-surface-700 mb-1.5 block">Bio / Présentation</label>
          <textarea name="bio" rows={3} defaultValue={formateur.bio || ''} className="input-base resize-none" placeholder="Décrivez votre parcours et vos spécialités..." />
        </div>
      </div>

      {/* Coordonnées */}
      <div className="card p-6">
        <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-4">Coordonnées</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Le formateur saisit sa propre adresse : le remplissage automatique du navigateur reste proposé */}
          <AdresseGroupe>
            <div className="sm:col-span-3">
              <label htmlFor="profil-adresse" className="text-sm font-medium text-surface-700 mb-1.5 block">Adresse</label>
              <AdresseInput id="profil-adresse" name="adresse" autoComplete="street-address" defaultValue={formateur.adresse || ''} />
            </div>
            <div>
              <label htmlFor="profil-code-postal" className="text-sm font-medium text-surface-700 mb-1.5 block">Code postal</label>
              <CodePostalInput id="profil-code-postal" name="code_postal" autoComplete="postal-code" defaultValue={formateur.code_postal || ''} />
            </div>
            <div>
              <label htmlFor="profil-ville" className="text-sm font-medium text-surface-700 mb-1.5 block">Ville</label>
              <VilleInput id="profil-ville" name="ville" autoComplete="address-level2" defaultValue={formateur.ville || ''} />
            </div>
          </AdresseGroupe>
          <div>
            <label className="text-sm font-medium text-surface-700 mb-1.5 block">SIRET</label>
            <input name="siret" defaultValue={formateur.siret || ''} className="input-base" placeholder="14 chiffres" />
          </div>
        </div>
      </div>

      {/* Tarifs */}
      <div className="card p-6">
        <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-4">Tarifs</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-surface-700 mb-1.5 block">Tarif journalier (HT)</label>
            <input name="tarif_journalier" type="number" step="0.01" defaultValue={formateur.tarif_journalier || ''} className="input-base" placeholder="0.00 €" />
          </div>
          <div>
            <label className="text-sm font-medium text-surface-700 mb-1.5 block">Tarif horaire (HT)</label>
            <input name="tarif_horaire" type="number" step="0.01" defaultValue={formateur.tarif_horaire || ''} className="input-base" placeholder="0.00 €" />
          </div>
        </div>
      </div>

      {/* CV */}
      <div className="card p-6">
        <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-4">CV</div>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => cvRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-surface-200 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors">
            <FileText className="h-4 w-4" />
            {cvName || 'Importer votre CV'}
          </button>
          {formateur.cv_url && !cvBase64 && (
            <a href={formateur.cv_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:text-brand-700">
              Voir le CV actuel
            </a>
          )}
          <input ref={cvRef} type="file" accept=".pdf,.doc,.docx" onChange={handleCvChange} className="hidden" />
        </div>
      </div>

      {/* Diplômes */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Diplômes & Certifications</div>
          <button type="button" onClick={addDiplome} className="flex items-center gap-1 text-xs text-brand-600 font-medium hover:text-brand-700">
            <Plus className="h-3.5 w-3.5" /> Ajouter
          </button>
        </div>
        <div className="space-y-3">
          {diplomes.map((d, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-surface-50">
              <div className="flex-1 grid grid-cols-3 gap-3">
                <input value={d.intitule} onChange={e => updateDiplome(idx, 'intitule', e.target.value)} placeholder="Intitulé" className="input-base text-sm col-span-2" />
                <input value={d.annee} onChange={e => updateDiplome(idx, 'annee', e.target.value)} placeholder="Année" className="input-base text-sm" />
                <input value={d.etablissement} onChange={e => updateDiplome(idx, 'etablissement', e.target.value)} placeholder="Établissement" className="input-base text-sm col-span-3" />
              </div>
              <button type="button" onClick={() => removeDiplome(idx)} className="p-1.5 text-surface-400 hover:text-danger-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {diplomes.length === 0 && (
            <div className="text-center py-6 text-sm text-surface-400">Aucun diplôme renseigné</div>
          )}
        </div>
      </div>

      {/* Feedback + Submit */}
      {error && <div className="text-sm text-danger-600 bg-danger-50 border border-danger-200 rounded-xl px-4 py-3">{error}</div>}
      {success && <div className="text-sm text-success-600 bg-success-50 border border-success-200 rounded-xl px-4 py-3">Profil mis à jour avec succès</div>}

      <button type="submit" disabled={loading}
        className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2 py-3 px-8">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Enregistrer mon profil
      </button>
    </form>
  )
}
