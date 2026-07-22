'use client'

import { useState, useEffect, useMemo } from 'react'
import { Save, Building2, Users, X, Plus, CalendarDays, Clock, Search } from 'lucide-react'
import { Button, Input, Select, FormateurDispoBadge, CalendarPicker, SearchSelect } from '@/components/ui'
import { createSessionAction, updateSessionAction } from './actions'
import { SESSION_STATUS_LABELS } from '@/lib/types/formation'
import type { Session, Formation, Formateur, HoraireJour } from '@/lib/types/formation'

interface ClientLite {
  id: string
  raison_sociale: string | null
  siret?: string | null
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
  formations: Pick<Formation, 'id' | 'intitule' | 'reference' | 'modalite' | 'duree_heures' | 'duree_jours'>[]
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

const DEFAULT_HORAIRES = { matin_debut: '09:00', matin_fin: '12:30', aprem_debut: '13:30', aprem_fin: '17:00' }

/** Calcule les heures totales d'un jour à partir des horaires matin/aprem */
function heuresJour(h: HoraireJour): number {
  const diff = (debut: string, fin: string) => {
    if (!debut || !fin) return 0
    const [hd, md] = debut.split(':').map(Number)
    const [hf, mf] = fin.split(':').map(Number)
    return Math.max(0, (hf * 60 + mf) - (hd * 60 + md)) / 60
  }
  return diff(h.matin_debut, h.matin_fin) + diff(h.aprem_debut, h.aprem_fin)
}

export function SessionForm({ session, formations, formateurs, clients = [], apprenants = [], initialInscrits = [], onSuccess, onCancel }: SessionFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [error, setError] = useState<string | null>(null)

  // Multi-formations : la 1ère est la principale (sessions.formation_id)
  const [formationIds, setFormationIds] = useState<string[]>(
    (session as any)?._formation_ids?.length > 0
      ? (session as any)._formation_ids
      : (session?.formation_id ? [session.formation_id] : [])
  )
  const formationId = formationIds[0] || ''
  const [typeSession, setTypeSession] = useState<'inter' | 'intra'>(session?.type_session || 'inter')
  const [modalite, setModalite] = useState<'presentiel' | 'distanciel' | 'mixte'>(session?.modalite || 'presentiel')
  const [clientId, setClientId] = useState(session?.client_id || '')
  const [formateurId, setFormateurId] = useState(session?.formateur_id || '')
  const [horairesJours, setHorairesJours] = useState<HoraireJour[]>(session?.horaires_jours || [])
  const [adresse, setAdresse] = useState(session?.adresse || '')
  const [codePostal, setCodePostal] = useState(session?.code_postal || '')
  const [ville, setVille] = useState(session?.ville || '')
  const [lieu, setLieu] = useState(session?.lieu || '')
  const [coutFormateur, setCoutFormateur] = useState<string>(session?.cout_formateur?.toString() || '')
  const [selectedApprenants, setSelectedApprenants] = useState<string[]>(initialInscrits)
  // Participants créés à la volée depuis le formulaire (sans passer par la fiche entreprise)
  const [extraApprenants, setExtraApprenants] = useState<ApprenantLite[]>([])
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [quickAdd, setQuickAdd] = useState({ prenom: '', nom: '', email: '' })
  const [quickAddLoading, setQuickAddLoading] = useState(false)

  // Formations choisies (multi) → somme des durées
  const formationsChoisies = formationIds.map(id => formations.find(f => f.id === id)).filter((f): f is NonNullable<typeof f> => !!f)
  const dureeJoursRequis = formationsChoisies.reduce((s, f) => s + (f.duree_jours || 0), 0)
  const dureeHeuresRequis = formationsChoisies.reduce((s, f) => s + (f.duree_heures || 0), 0)

  // Recherche dans le catalogue (73 formations) : filtre la liste à cocher
  const [formationQuery, setFormationQuery] = useState('')
  const formationsFiltrees = formations.filter((f) => {
    const q = formationQuery.trim().toLowerCase()
    if (!q) return true
    return `${f.reference || ''} ${f.intitule}`.toLowerCase().includes(q)
  })

  function toggleFormation(id: string) {
    setFormationIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  // Dates min/max dérivées des jours planifiés
  const sortedJours = useMemo(
    () => [...horairesJours].sort((a, b) => a.date.localeCompare(b.date)),
    [horairesJours]
  )
  const dateDebut = sortedJours[0]?.date || ''
  const dateFin = sortedJours[sortedJours.length - 1]?.date || ''
  const totalHeures = horairesJours.reduce((s, h) => s + heuresJour(h), 0)
  const nbJours = horairesJours.length

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
  useEffect(() => {
    if (formateurId && nbJours > 0) {
      const f = formateurs.find(x => x.id === formateurId)
      if (f?.tarif_journalier && !coutFormateur) {
        setCoutFormateur((f.tarif_journalier * nbJours).toFixed(2))
      }
    }
  }, [formateurId, nbJours])

  function toggleJour(date: string) {
    setHorairesJours(prev => {
      if (prev.some(h => h.date === date)) {
        return prev.filter(h => h.date !== date)
      }
      return [...prev, { date, ...DEFAULT_HORAIRES }]
    })
  }

  function removeJour(date: string) {
    setHorairesJours(prev => prev.filter(h => h.date !== date))
  }

  function updateHoraire(date: string, field: keyof Omit<HoraireJour, 'date'>, value: string) {
    setHorairesJours(prev => prev.map(h => h.date === date ? { ...h, [field]: value } : h))
  }

  function toggleApprenant(id: string) {
    setSelectedApprenants(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const formateurOptions = [
    { value: '', label: 'Non assigné' },
    ...formateurs.map((f) => ({
      value: f.id,
      label: `${f.prenom} ${f.nom}${f.tarif_journalier ? ` — ${f.tarif_journalier}€/jour` : ''}`,
    })),
  ]

  const clientOptions = [
    { value: '', label: '— Sélectionner un client —' },
    ...clients.filter(c => c.raison_sociale).map(c => ({
      value: c.id,
      label: c.raison_sociale!,
      preview: {
        title: c.raison_sociale!,
        lines: [
          { label: 'SIRET', value: c.siret || '—' },
          { label: 'Adresse', value: [c.adresse, [c.code_postal, c.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '—' },
        ],
      },
    })),
  ]

  /**
   * Règle métier :
   *  - Intra : tous les apprenants doivent appartenir au client commanditaire
   *  - Inter : pas de restriction, des apprenants de différentes entreprises
   *    peuvent être inscrits ensemble (c'est le principe de l'inter)
   */
  const allApprenants = [...apprenants, ...extraApprenants]
  const filteredApprenants = (typeSession === 'intra' && clientId)
    ? allApprenants.filter(a => a.client_id === clientId)
    : allApprenants

  async function handleQuickAdd() {
    if (!quickAdd.prenom.trim() || !quickAdd.nom.trim()) return
    setQuickAddLoading(true)
    try {
      const { createApprenantAction } = await import('@/app/dashboard/apprenants/actions')
      const fd = new FormData()
      fd.set('prenom', quickAdd.prenom.trim())
      fd.set('nom', quickAdd.nom.trim())
      if (quickAdd.email.trim()) fd.set('email', quickAdd.email.trim())
      if (clientId) fd.set('client_id', clientId)
      const r = await createApprenantAction(fd)
      if (r.success && (r.data as any)?.id) {
        const created = r.data as any
        setExtraApprenants(prev => [...prev, { id: created.id, prenom: created.prenom, nom: created.nom, email: created.email, client_id: created.client_id }])
        setSelectedApprenants(prev => [...prev, created.id])
        setQuickAdd({ prenom: '', nom: '', email: '' })
        setQuickAddOpen(false)
      } else {
        alert((r as any).error || 'Erreur lors de la création du participant')
      }
    } finally {
      setQuickAddLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null); setErrors({})

    // Validation côté client (messages clairs avant l'envoi)
    if (formationIds.length === 0) {
      setError('Veuillez sélectionner au moins une formation')
      return
    }
    if (typeSession === 'intra' && !clientId) {
      setError('En type "intra", vous devez sélectionner un client commanditaire')
      return
    }
    if (horairesJours.length === 0) {
      setError('Ajoutez au moins un jour de planning')
      return
    }

    setIsLoading(true)
    try {
      const fd = new FormData(e.currentTarget)
      fd.set('formation_id', formationId)
      fd.set('formation_ids', formationIds.join(','))
      fd.set('type_session', typeSession)
      fd.set('modalite', modalite)
      fd.set('client_id', clientId)
      fd.set('formateur_id', formateurId)
      fd.set('date_debut', dateDebut)
      fd.set('date_fin', dateFin)
      fd.set('horaires_jours', JSON.stringify(sortedJours))
      fd.set('apprenant_ids', selectedApprenants.join(','))

      const result = session ? await updateSessionAction(session.id, fd) : await createSessionAction(fd)
      if (result.success) {
        onSuccess()
      } else {
        if (result.errors) {
          setErrors(result.errors)
          // Récap les erreurs en haut
          const firstError = Object.entries(result.errors)[0]
          if (firstError) setError(`${firstError[0]} : ${(firstError[1] as string[])[0]}`)
        }
        if (result.error) setError(result.error)
      }
    } catch (e: any) {
      console.error('[SessionForm submit]', e)
      setError(e?.message || 'Erreur inattendue. Voir la console pour plus de détails.')
    } finally {
      setIsLoading(false)
    }
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

      <div>
        <label className="block text-sm font-medium text-surface-700 mb-1.5">
          Formation{formationIds.length > 1 ? 's' : ''} *
        </label>
        {formations.length > 6 && (
          <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-surface-200 mb-1.5">
            <Search className="h-4 w-4 text-surface-400 shrink-0" />
            <input
              type="text" value={formationQuery} onChange={(e) => setFormationQuery(e.target.value)}
              placeholder="Rechercher une formation…"
              className="bg-transparent text-sm placeholder:text-surface-400 focus:outline-none flex-1"
            />
          </div>
        )}
        <div className="rounded-xl border border-surface-200 max-h-44 overflow-y-auto divide-y divide-surface-100">
          {formations.length === 0 ? (
            <div className="px-3 py-3 text-xs text-surface-500">Aucune formation disponible.</div>
          ) : formationsFiltrees.length === 0 ? (
            <div className="px-3 py-3 text-xs text-surface-500">Aucune formation ne correspond à « {formationQuery} ».</div>
          ) : (
            formationsFiltrees.map(f => {
              const checked = formationIds.includes(f.id)
              return (
                <label key={f.id} className="flex items-center gap-3 px-3 py-2 hover:bg-surface-50 cursor-pointer">
                  <input type="checkbox" checked={checked} onChange={() => toggleFormation(f.id)} className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-surface-900 truncate">
                      {f.reference && <span className="text-surface-500">{f.reference} — </span>}
                      {f.intitule}
                    </div>
                    <div className="text-[11px] text-surface-500">
                      {f.duree_jours ? `${f.duree_jours} jour${f.duree_jours > 1 ? 's' : ''}` : ''}
                      {f.duree_jours && f.duree_heures ? ' · ' : ''}
                      {f.duree_heures ? `${f.duree_heures}h` : ''}
                    </div>
                  </div>
                </label>
              )
            })
          )}
        </div>
        {errors.formation_id?.[0] && <p className="text-xs text-danger-600 mt-1">{errors.formation_id[0]}</p>}
      </div>

      {formationsChoisies.length > 0 && (
        <div className="rounded-xl bg-brand-50/50 border border-brand-200 px-4 py-2 text-xs text-brand-800 flex flex-wrap gap-x-4 gap-y-1">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            <strong>{dureeJoursRequis || '?'}</strong> jour{dureeJoursRequis > 1 ? 's' : ''} à planifier
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <strong>{dureeHeuresRequis}h</strong> au total
            {formationsChoisies.length > 1 && <span className="text-brand-600">({formationsChoisies.length} formations cumulées)</span>}
          </span>
        </div>
      )}

      {session && (
        <div className="grid grid-cols-2 gap-3">
          <Input id="reference" name="reference" label="Référence" defaultValue={session.reference || ''} />
          <Select id="status" name="status" label="Statut" options={statusOptions} defaultValue={session.status} />
        </div>
      )}

      {/* ── Type & Modalité ── */}
      <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider pt-2">Type et modalité</div>
      <div className="grid grid-cols-2 gap-3">
        <Select id="type_session_select" label="Type *" options={typeOptions} value={typeSession} onChange={e => setTypeSession(e.target.value as 'inter' | 'intra')} />
        <Select id="modalite_select" label="Modalité *" options={modaliteOptions} value={modalite} onChange={e => setModalite(e.target.value as any)} />
      </div>

      {/* ── Client : obligatoire en intra (chez le client), optionnel en inter ── */}
      <div className="rounded-xl bg-brand-50/50 border border-brand-200 px-4 py-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-brand-900">
          <Building2 className="h-4 w-4" /> Client commanditaire
        </div>
        <SearchSelect
          id="client_id_select"
          label={typeSession === 'intra' ? 'Client *' : 'Client (optionnel)'}
          options={clientOptions.filter(o => o.value !== '')}
          value={clientId}
          onChange={setClientId}
          placeholder="Rechercher un client…"
        />
        {typeSession === 'intra' ? (
          <div className="text-xs text-brand-700">L'adresse sera pré-remplie avec celle du client (modifiable).</div>
        ) : (
          <div className="text-xs text-brand-700">En inter, vous pouvez rattacher la session à un client existant (facultatif).</div>
        )}
      </div>

      {/* ── Planning : ajout de jours individuels ── */}
      <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider pt-2 flex items-center gap-2">
        <CalendarDays className="h-3.5 w-3.5" />
        Planning des jours
      </div>

      {/* Compteur de progression */}
      {dureeJoursRequis > 0 && (
        <div className={`rounded-xl px-4 py-2.5 text-sm border ${
          nbJours === dureeJoursRequis
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : nbJours > dureeJoursRequis
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-surface-50 border-surface-200 text-surface-700'
        }`}>
          <div className="flex items-center justify-between">
            <span>
              <strong>{nbJours}</strong> / {dureeJoursRequis} jour{dureeJoursRequis > 1 ? 's' : ''} planifié{nbJours > 1 ? 's' : ''}
            </span>
            <span className="text-xs">
              {totalHeures.toFixed(1)}h{dureeHeuresRequis ? ` / ${dureeHeuresRequis}h` : ''}
            </span>
          </div>
        </div>
      )}

      {/* Calendrier visuel : clic = ajout/retrait */}
      <CalendarPicker
        selectedDates={horairesJours.map(h => h.date)}
        onToggle={toggleJour}
      />

      {/* Liste des jours planifiés avec horaires détaillés */}
      {sortedJours.length > 0 && (
        <div className="rounded-xl border border-surface-200 overflow-hidden">
          <div className="divide-y divide-surface-100">
            {sortedJours.map((h) => (
              <div key={h.date} className="px-3 py-2.5 grid grid-cols-[auto_minmax(140px,160px)_1fr_auto] gap-3 items-center text-xs">
                <button type="button" onClick={() => removeJour(h.date)} className="p-1 rounded text-danger-400 hover:bg-danger-50 hover:text-danger-600 transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="font-medium text-surface-900">
                  {new Date(h.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-surface-500 w-12 shrink-0">Matin</span>
                    <input type="time" value={h.matin_debut} onChange={e => updateHoraire(h.date, 'matin_debut', e.target.value)} className="rounded border border-surface-200 px-1.5 py-0.5 text-xs" />
                    <span className="text-surface-300">→</span>
                    <input type="time" value={h.matin_fin} onChange={e => updateHoraire(h.date, 'matin_fin', e.target.value)} className="rounded border border-surface-200 px-1.5 py-0.5 text-xs" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-surface-500 w-12 shrink-0">Aprem</span>
                    <input type="time" value={h.aprem_debut} onChange={e => updateHoraire(h.date, 'aprem_debut', e.target.value)} className="rounded border border-surface-200 px-1.5 py-0.5 text-xs" />
                    <span className="text-surface-300">→</span>
                    <input type="time" value={h.aprem_fin} onChange={e => updateHoraire(h.date, 'aprem_fin', e.target.value)} className="rounded border border-surface-200 px-1.5 py-0.5 text-xs" />
                  </div>
                </div>
                <div className="text-surface-500 flex items-center gap-1 whitespace-nowrap">
                  <Clock className="h-3 w-3" />
                  {heuresJour(h).toFixed(1)}h
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Formateur ── */}
      <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider pt-2">Formateur</div>

      <SearchSelect
        id="formateur_id_select"
        label="Formateur"
        options={formateurOptions.filter(o => o.value !== '')}
        value={formateurId}
        onChange={setFormateurId}
        placeholder="Rechercher un formateur…"
      />

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
        {typeSession === 'intra' && clientId ? (
          <>
            Session intra — apprenants filtrés sur :{' '}
            <span className="font-medium text-brand-700">
              {clients.find(c => c.id === clientId)?.raison_sociale}
            </span>
          </>
        ) : typeSession === 'inter' ? (
          <>Session inter — vous pouvez sélectionner des apprenants de différentes entreprises.</>
        ) : (
          <>Sélectionnez d'abord un client pour voir les apprenants.</>
        )}
      </div>
      {filteredApprenants.length === 0 ? (
        <div className="rounded-xl bg-surface-50 border border-surface-200 px-4 py-3 text-xs text-surface-500">
          {typeSession === 'intra' && clientId
            ? 'Aucun apprenant lié à ce client — ajoutez le premier participant ci-dessous.'
            : 'Aucun apprenant disponible — ajoutez le premier participant ci-dessous.'}
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

      {/* Ajout rapide d'un participant (créé et sélectionné à la volée) */}
      {!quickAddOpen ? (
        <button
          type="button"
          onClick={() => setQuickAddOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          <Plus className="h-3.5 w-3.5" /> Ajouter un nouveau participant
        </button>
      ) : (
        <div className="rounded-xl bg-surface-50 border border-surface-200 p-3 space-y-2">
          <div className="text-xs font-semibold text-surface-600">
            Nouveau participant
            {typeSession === 'intra' && clientId && (
              <span className="font-normal text-surface-400"> — rattaché à {clients.find(c => c.id === clientId)?.raison_sociale}</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={quickAdd.prenom} onChange={e => setQuickAdd({ ...quickAdd, prenom: e.target.value })}
              placeholder="Prénom *" className="input-base text-sm" />
            <input value={quickAdd.nom} onChange={e => setQuickAdd({ ...quickAdd, nom: e.target.value })}
              placeholder="Nom *" className="input-base text-sm" />
          </div>
          <input value={quickAdd.email} onChange={e => setQuickAdd({ ...quickAdd, email: e.target.value })}
            type="email" placeholder="Email (optionnel)" className="input-base text-sm w-full" />
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={handleQuickAdd} isLoading={quickAddLoading}
              disabled={!quickAdd.prenom.trim() || !quickAdd.nom.trim()}>
              Créer et sélectionner
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setQuickAddOpen(false)}>Annuler</Button>
          </div>
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
