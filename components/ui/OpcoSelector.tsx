'use client'

import { useEffect, useState } from 'react'
import { Building, CheckCircle2, AlertCircle, Loader2, Zap } from 'lucide-react'

interface Opco {
  id: string
  code: string
  nom: string
  nom_complet: string | null
  description: string | null
}

interface OpcoMatch {
  opco: Opco
  matched_by: 'naf' | 'idcc'
  matched_code: string
  libelle: string | null
}

const STATUS_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: 'aucun', label: 'Aucun compte', color: 'text-surface-500' },
  { value: 'courrier_envoye', label: 'Courrier envoyé', color: 'text-amber-600' },
  { value: 'en_attente_validation', label: 'En attente de validation', color: 'text-amber-600' },
  { value: 'actif', label: 'Compte actif', color: 'text-emerald-600' },
  { value: 'inactif', label: 'Compte inactif', color: 'text-red-500' },
]

interface OpcoSelectorProps {
  /** SIRET de l'entreprise (lookup direct, le plus fiable) */
  siret?: string
  /** Code NAF de l'entreprise (fallback) */
  codeNaf?: string
  /** Code IDCC (convention collective) — prioritaire sur NAF si pas de SIRET match */
  codeIdcc?: string
  /** ID OPCO actuellement sélectionné (édition manuelle ou pré-rempli) */
  defaultOpcoId?: string | null
  /** Statut compte OPCO actuel */
  defaultStatus?: string | null
  /** Numéro de compte OPCO actuel */
  defaultNumeroOpco?: string | null
}

export function OpcoSelector({
  siret, codeNaf, codeIdcc, defaultOpcoId, defaultStatus = 'aucun', defaultNumeroOpco,
}: OpcoSelectorProps) {
  const [opcos, setOpcos] = useState<Opco[]>([])
  const [selectedOpcoId, setSelectedOpcoId] = useState(defaultOpcoId || '')
  const [autoMatch, setAutoMatch] = useState<OpcoMatch | null>(null)
  const [isDetecting, setIsDetecting] = useState(false)

  // Charger la liste des OPCOs au montage
  useEffect(() => {
    fetch('/api/opco/list')
      .then(r => r.json())
      .then(d => setOpcos(d.opcos || []))
      .catch(() => {})
  }, [])

  // Auto-détection quand SIRET, NAF ou IDCC change
  useEffect(() => {
    if (!siret && !codeNaf && !codeIdcc) { setAutoMatch(null); return }
    setIsDetecting(true)
    const params = new URLSearchParams()
    if (siret) params.set('siret', siret)
    if (codeIdcc) params.set('idcc', codeIdcc)
    if (codeNaf) params.set('naf', codeNaf)
    fetch(`/api/opco/detect?${params}`)
      .then(r => r.json())
      .then(d => {
        setAutoMatch(d.match)
        // Si aucun OPCO sélectionné et qu'on a un match → présélection
        if (d.match && !selectedOpcoId) setSelectedOpcoId(d.match.opco.id)
      })
      .catch(() => {})
      .finally(() => setIsDetecting(false))
  }, [siret, codeNaf, codeIdcc])

  const selectedOpco = opcos.find(o => o.id === selectedOpcoId)

  return (
    <div className="space-y-4">
      <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider">OPCO de rattachement</div>

      {/* Auto-détection */}
      {isDetecting && (
        <div className="rounded-xl bg-surface-50 px-4 py-3 text-sm text-surface-600 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Détection en cours…
        </div>
      )}

      {autoMatch && !isDetecting && (
        <div className="rounded-xl bg-brand-50 border border-brand-200 px-4 py-3 text-sm flex items-start gap-3">
          <Zap className="h-4 w-4 text-brand-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="font-medium text-brand-900">
              Détecté automatiquement : <strong>{autoMatch.opco.nom}</strong>
            </div>
            <div className="text-xs text-brand-700 mt-0.5">
              via {autoMatch.matched_by === 'siret' ? 'SIRET' : autoMatch.matched_by === 'idcc' ? 'convention collective' : 'code NAF'} {autoMatch.matched_code}
              {autoMatch.libelle && ` — ${autoMatch.libelle}`}
            </div>
          </div>
        </div>
      )}

      {!autoMatch && !isDetecting && (siret || codeNaf || codeIdcc) && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-amber-800">
            <strong>Détection automatique impossible.</strong> Cette entreprise n'a pas de convention collective
            officiellement déclarée dans la base SIRET-OPCO de data.gouv.
            <div className="mt-1 text-xs text-amber-700">
              Soit tu renseignes le code IDCC ci-dessus, soit tu sélectionnes l'OPCO manuellement.
            </div>
          </div>
        </div>
      )}

      {/* Sélecteur OPCO (éditable même si auto-détecté) */}
      <div className="space-y-1.5">
        <label htmlFor="opco_id" className="block text-sm font-medium text-surface-700">
          OPCO {autoMatch && <span className="text-xs font-normal text-surface-500">(modifiable si dérogation)</span>}
        </label>
        <select
          id="opco_id"
          name="opco_id"
          value={selectedOpcoId}
          onChange={(e) => setSelectedOpcoId(e.target.value)}
          className="input-base"
        >
          <option value="">— Aucun OPCO —</option>
          {opcos.map((o) => (
            <option key={o.id} value={o.id}>{o.nom}{o.nom_complet ? ` — ${o.description}` : ''}</option>
          ))}
        </select>
      </div>

      {/* Statut compte OPCO */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="opco_compte_status" className="block text-sm font-medium text-surface-700">
            Statut du compte OPCO
          </label>
          <select
            id="opco_compte_status"
            name="opco_compte_status"
            defaultValue={defaultStatus || 'aucun'}
            className="input-base"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="numero_opco" className="block text-sm font-medium text-surface-700">
            N° de compte OPCO
          </label>
          <input
            id="numero_opco"
            name="numero_opco"
            type="text"
            defaultValue={defaultNumeroOpco || ''}
            placeholder="N° de dossier OPCO"
            className="input-base"
          />
        </div>
      </div>

      {selectedOpco?.site_web && (
        <a href={selectedOpco.site_web} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700">
          <Building className="h-3 w-3" />
          {selectedOpco.site_web.replace(/^https?:\/\/(www\.)?/, '')}
        </a>
      )}
    </div>
  )
}
