'use client'

import { useState, useEffect, useMemo } from 'react'
import { Save, Building2, Users, X, Plus } from 'lucide-react'
import { Button, Input, Select, FormateurDispoBadge } from '@/components/ui'
import { createSessionAction, updateSessionAction } from './actions'
import { SESSION_STATUS_LABELS } from '@/lib/types/formation'
import type { Session, Formation, Formateur, HoraireJour } from '@/lib/types/formation'

interface ClientLite {
  id: string
  raison_sociale: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
}

interface ApprenantLite {
  id: string
  prenom: string
  nom: string
  email: string | null
  client_id: string | null
}

interface FormateurExt extends Pick<Formateur, 'id' | 'prenom' | 'nom'> {
  tarif_journalier?: number | null
}

interface SessionFormProps {
  session?: Session
  formations: Pick<Formation, 'id' | 'intitule' | 'reference' | 'modalite' | 'duree_heures'>[]
  formateurs: FormateurExt[]
  clients?: ClientLite[]
  apprenants?: ApprenantLite[]
  /** IDs des apprenants déjà inscrits à la session (édition) */
  initialInscrits?: string[]
  onSuccess: () => void
  onCancel: () => void
}

const statusOptions = Object.entries(SESSION_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))
const typeOptions = [
  { value: 'inter', label: 'Inter — Formation ouverte (centre Lab Learning)' },
  { value: 'intra', label: 'Intra — Formation chez le client' },
]
const modaliteOptions = [
  { value: 'presentiel', label: 'Présentiel' },
  { value: 'distanciel', label: 'À distance' },
  { value: 'mixte', label: 'Mixte (présentiel + distanciel)' },
]

/** Génère un tableau de jours (YYYY-MM-DD) entre 2 dates incluses */
function generateDateRange(start: string, end: string): string[] {
  if (!start || !end) return []
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (startDate > endDate) return []
  const days: string[] = []
  const current = new Date(startDate)
  while (current <= endDate) {
    days.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }
  return days.slice(0, 30)  // safety cap
}

const DEFAULT_HORAIRES = { matin_debut: '09:00', matin_fin: '12:30', aprem_debut: '13:30', aprem_fin: '17:00' }

export function SessionForm({ session, formations, formateurs, clients = [], apprenants = [], initialInscrits = [], onSuccess, onCancel }: SessionFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [error, setError] = useState<string | null>(null)

  const [typeSession, setTypeSession] = useState<'inter' | 'intra'>(session?.type_session || 'inter')
  const [modalite, setModalite] = useState<'presentiel' | 'distanciel' | 'mixte'>(session?.modalite || 'presentiel')
  const [clientId, setClientId] = useState(session?.client_id || '')
  const [formateurId, setFormateurId] = useState(session?.formateur_id || '')
  const [dateDebut, setDateDebut] = useState(session?.date_debut || '')
  const [dateFin, setDateFin] = useState(session?.date_fin || '')
  const [horairesJours, setHorairesJours] = useState<HoraireJour[]>(session?.horaires_jours || [])
  const [adresse, setAdresse] = useState(session?.adresse || '')
  const [codePostal, setCodePostal] = useState(session?.code_postal || '')
  const [ville, setVille] = useState(session?.ville || '')
  const [lieu, setLieu] = useState(session?.lieu || '')
  const [coutFormateur, setCoutFormateur] = useState<string>(session?.cout_formateur?.toString() || '')
  const [selectedApprenants, setSelectedApprenants] = useState<string[]>(initialInscrits)

  // ── Auto-fill : adresse client quand intra ──
  useEffect(() => {
    if (typeSession === 'intra' && clientId) {
      const c = clients.find(x => x.id === clientId)
      if (c) {
        if (c.adresse) setAdresse(c.adresse)
        if (c.code_postal) setCodePostal(c.code_postal)
        if (c.ville) setVille(c.ville)
        if (!lieu) setLieu(c.raison_sociale || '')
      }
    }
  }, [typeSession, clientId])

  // ── Auto-fill : coût formateur (tarif journalier × nb jours) ──
  const nbJours = useMemo(() => generateDateRange(dateDebut, dateFin).length, [dateDebut, dateFin])
  useEffect(() => {
    if (formateurId && nbJours > 0) {
      const f = formateurs.find(x => x.id === formateurId)
      if (f?.tarif_journalier && !coutFormateur) {
        setCoutFormateur((f.tarif_journalier * nbJours).toFixed(2))
      }
    }
  }, [formateurId, nbJours])

  // ── Auto-update horaires_jours quand les dates changent ──
  useEffect(() => {
    const days = generateDateRange(dateDebut, dateFin)
    if (days.length === 0) { setHorairesJours([]); return }
    // Conserve les horaires existants si la date est toujours dans la plage
    setHorairesJours(prev => days.map(d => prev.find(p => p.date === d) || { date: d, ...DEFAULT_HORAIRES }))
  }, [dateDebut, dateFin])

  function updateHoraire(date: string, field: keyof Omit<HoraireJour, 'date'>, value: string) {
    setHorairesJours(prev => prev.map(h => h.date === date ? { ...h, [field]: value } : h))
  }

  function toggleApprenant(id: string) {
    setSelectedApprenants(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const formationOptions = formations.map((f) => ({
    value: f.id,
    label: `${f.reference ? f.reference + ' — ' : ''}${f.intitule}`,
  }))

  const formateurOptions = [
    { value: '', label: 'Non assigné' },
    ...formateurs.map((f) => ({
      value: f.id,
      label: `${f.prenom} ${f.nom}${f.tarif_journalier ? ` — ${f.tarif_journalier}€/jour` : ''}`,
    })),
  ]

  const clientOptions = [
    { value: '', label: '— Sélectionner un client —' },
    ...clients.filter(c => c.raison_sociale).map(c => ({ value: c.id, label: c.raison_sociale! })),
  ]

  /**
   * Règle métier : tous les apprenants d'une session doivent appartenir
   * à la même entreprise. Le "client de référence" est déterminé par :
   *  1. Le client_id choisi (en intra)
   *  2. Sinon, le client du premier apprenant déjà sélectionné
   */
  const referenceClientId = clientId
    || apprenants.find(a => selectedApprenants.includes(a.id))?.client_id
    || ''

  const filteredApprenants = referenceClientId
    ? apprenants.filter(a => a.client_id === referenceClientId)
    : apprenants

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true); setErrors({}); setError(null)
    const fd = new FormData(e.currentTarget)
    fd.set('type_session', typeSession)
    fd.set('modalite', modalite)
    fd.set('client_id', clientId)
    fd.set('formateur_id', formateurId)
    fd.set('horaires_jours', JSON.stringify(horairesJours))
    fd.set('apprenant_ids', selectedApprenants.join(','))
    const result = session ? await updateSessionAction(session.id, fd) : await createSessionAction(fd)
    if (result.success) onSuccess()
    else if (result.errors) setErrors(result.errors)
    if (result.error) setError(result.error)
    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
      {error && <div className="rounded-xl bg-danger-50 border border-danger-200 px-4 py-3 text-sm text-danger-700">{error}</div>}

      {/* Référence auto-générée à la création */}
      {!session && (
        <div className="rounded-xl bg-surface-50 border border-surface-200 px-4 py-2.5 text-xs text-surface-600">
          La référence sera générée automatiquement (format <strong>SES-{new Date().getFullYear()}-XXX</strong>)
        </div>
      )}

      <Select id="formation_id" name="formation_id" label="Formation *" options={formationOptions} defaultValue={session?.formation_id || ''} placeholder="Sélectionner une formation" error={errors.formation_id?.[0]} />

      {session && (
        <div className="grid grid-cols-2 gap-3">
          <Input id="reference" name="reference" label="Référence" defaultValue={session.reference || ''} />
          <Select id="status" name="status" label="Statut" options={statusOptions} defaultValue={session.status} />
        </div>
      )}

      <Input id="intitule" name="intitule" label="Intitulé personnalisé" placeholder="Optionnel — surcharge le nom de la formation" defaultValue={session?.intitule || ''} />

      {/* ── Type & Modalité ── */}
      <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider pt-2">Type et modalité</div>
      <div className="grid grid-cols-2 gap-3">
        <Select id="type_session_select" label="Type *" options={typeOptions} value={typeSession} onChange={e => setTypeSession(e.target.value as 'inter' | 'intra')} />
        <Select id="modalite_select" label="Modalité *" options={modaliteOptions} value={modalite} onChange={e => setModalite(e.target.value as any)} />
      </div>

      {/* ── Client (si intra) ── */}
      {typeSession === 'intra' && (
        <div className="rounded-xl bg-brand-50/50 border border-brand-200 px-4 py-3 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-brand-900">
            <Building2 className="h-4 w-4" /> Client commanditaire
          </div>
          <Select id="client_id_select" label="Client *" options={clientOptions} value={clientId} onChange={e => setClientId(e.target.value)} />
          <div className="text-xs text-brand-700">L'adresse sera pré-remplie avec celle du client (modifiable).</div>
        </div>
      )}

      {/* ── Planning ── */}
      <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider pt-2">Planning</div>

      <div className="grid grid-cols-2 gap-3">
        <Input id="date_debut" name="date_debut" type="date" label="Date de début *" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} error={errors.date_debut?.[0]} />
        <Input id="date_fin" name="date_fin" type="date" label="Date de fin *" value={dateFin} onChange={(e) => setDateFin(e.target.value)} error={errors.date_fin?.[0]} />
      </div>

      {/* Horaires détaillés par demi-journée */}
      {horairesJours.length > 0 && (
        <div className="rounded-xl border border-surface-200 overflow-hidden">
          <div className="px-3 py-2 bg-surface-50 text-xs font-semibold text-surface-600 uppercase">
            Horaires détaillés ({horairesJours.length} jour{horairesJours.length > 1 ? 's' : ''})
          </div>
          <div className="divide-y divide-surface-100">
            {horairesJours.map((h) => (
              <div key={h.date} className="px-3 py-2.5 flex flex-wrap items-center gap-2 text-xs">
                <div className="font-medium text-surface-900 w-32 shrink-0">
                  {new Date(h.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-surface-500">Matin</span>
                  <input type="time" value={h.matin_debut} onChange={e => updateHoraire(h.date, 'matin_debut', e.target.value)} className="rounded border border-surface-200 px-1.5 py-0.5 text-xs" />
                  <span className="text-surface-300">→</span>
                  <input type="time" value={h.matin_fin} onChange={e => updateHoraire(h.date, 'matin_fin', e.target.value)} className="rounded border border-surface-200 px-1.5 py-0.5 text-xs" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-surface-500">Aprem</span>
                  <input type="time" value={h.aprem_debut} onChange={e => updateHoraire(h.date, 'aprem_debut', e.target.value)} className="rounded border border-surface-200 px-1.5 py-0.5 text-xs" />
                  <span className="text-surface-300">→</span>
                  <input type="time" value={h.aprem_fin} onChange={e => updateHoraire(h.date, 'aprem_fin', e.target.value)} className="rounded border border-surface-200 px-1.5 py-0.5 text-xs" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Formateur ── */}
      <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider pt-2">Formateur</div>

      <Select id="formateur_id_select" label="Formateur" options={formateurOptions} value={formateurId} onChange={(e) => setFormateurId(e.target.value)} />

      {formateurId && dateDebut && dateFin && (
        <FormateurDispoBadge formateurId={formateurId} dateDebut={dateDebut} dateFin={dateFin} excludeSessionId={session?.id} />
      )}

      <div className="grid grid-cols-3 gap-3">
        <Input id="cout_formateur" name="cout_formateur" type="number" label="Coût formateur (€)" value={coutFormateur} onChange={e => setCoutFormateur(e.target.value)} placeholder={nbJours > 0 ? `(${nbJours} jour${nbJours > 1 ? 's' : ''})` : ''} />
        <Input id="cout_salle" name="cout_salle" type="number" label="Coût salle (€)" defaultValue={session?.cout_salle?.toString() || ''} />
        <Input id="cout_materiel" name="cout_materiel" type="number" label="Coût matériel (€)" defaultValue={session?.cout_materiel?.toString() || ''} />
      </div>

      {/* ── Lieu ── */}
      {modalite !== 'distanciel' && (
        <>
          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider pt-2">Lieu</div>
          <Input id="lieu" name="lieu" label="Nom du lieu / Salle" placeholder={typeSession === 'intra' ? 'Locaux du client' : 'Centre Lab Learning'} value={lieu} onChange={e => setLieu(e.target.value)} />
          <Input id="adresse" name="adresse" label="Adresse" value={adresse} onChange={e => setAdresse(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input id="code_postal" name="code_postal" label="Code postal" value={codePostal} onChange={e => setCodePostal(e.target.value)} />
            <Input id="ville" name="ville" label="Ville" value={ville} onChange={e => setVille(e.target.value)} />
          </div>
        </>
      )}

      {modalite !== 'presentiel' && (
        <Input id="lien_visio" name="lien_visio" label="Lien visioconférence" placeholder="https://zoom.us/j/..." defaultValue={session?.lien_visio || ''} error={errors.lien_visio?.[0]} />
      )}

      {/* Capacité : valeurs par défaut envoyées en hidden (pas exposées dans l'UI) */}
      <input type="hidden" name="places_min" value={session?.places_min?.toString() || '1'} />
      <input type="hidden" name="places_max" value={session?.places_max?.toString() || '12'} />

      {/* ── Apprenants ── */}
      <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider pt-2 flex items-center gap-2">
        <Users className="h-3.5 w-3.5" />
        Apprenants ({selectedApprenants.length} sélectionné{selectedApprenants.length > 1 ? 's' : ''})
      </div>
      <div className="text-[11px] text-surface-500 -mt-1">
        Tous les apprenants d'une session doivent appartenir à la même entreprise.
        {referenceClientId && clients.find(c => c.id === referenceClientId) && (
          <span className="ml-1 font-medium text-brand-700">
            Filtré sur : {clients.find(c => c.id === referenceClientId)?.raison_sociale}
          </span>
        )}
      </div>
      {filteredApprenants.length === 0 ? (
        <div className="rounded-xl bg-surface-50 border border-surface-200 px-4 py-3 text-xs text-surface-500">
          Aucun apprenant disponible{referenceClientId ? ' pour cette entreprise' : ''}. Créez-les depuis la page Apprenants en les liant à l'entreprise.
        </div>
      ) : (
        <div className="rounded-xl border border-surface-200 max-h-48 overflow-y-auto divide-y divide-surface-100">
          {filteredApprenants.map(a => {
            const checked = selectedApprenants.includes(a.id)
            return (
              <label key={a.id} className="flex items-center gap-3 px-3 py-2 hover:bg-surface-50 cursor-pointer">
                <input type="checkbox" checked={checked} onChange={() => toggleApprenant(a.id)} className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-surface-900 truncate">{a.prenom} {a.nom}</div>
                  {a.email && <div className="text-xs text-surface-500 truncate">{a.email}</div>}
                </div>
              </label>
            )
          })}
        </div>
      )}

      <textarea id="notes_internes" name="notes_internes" rows={2} className="input-base resize-none" placeholder="Notes internes..." defaultValue={session?.notes_internes || ''} />

      <div className="flex justify-end gap-3 pt-3 border-t border-surface-100">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" isLoading={isLoading} icon={<Save className="h-4 w-4" />}>
          {session ? 'Mettre à jour' : 'Créer la session'}
        </Button>
      </div>
    </form>
  )
}
