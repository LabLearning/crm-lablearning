'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, Loader2, Building2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { searchCompanies, type SireneCompany } from '@/lib/sirene'

interface CompanySearchInputProps {
  id?: string
  name?: string
  label?: string
  defaultValue?: string
  error?: string
  required?: boolean
  placeholder?: string
  onSelect: (company: SireneCompany) => void
  /** Appelé quand l'user modifie le texte après avoir sélectionné — pour reset les champs auto-remplis */
  onClear?: () => void
}

export function CompanySearchInput({
  id, name, label, defaultValue = '', error, required, placeholder, onSelect, onClear,
}: CompanySearchInputProps) {
  const [value, setValue] = useState(defaultValue)
  const [results, setResults] = useState<SireneCompany[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [apiError, setApiError] = useState(false)
  const [selectedSiret, setSelectedSiret] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setValue(v)
    // Si on avait une sélection active et que le texte change → reset les champs auto-remplis
    if (selectedSiret) onClear?.()
    setSelectedSiret(null)
    setApiError(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (v.trim().length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }
    setIsLoading(true)
    setIsOpen(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const found = await searchCompanies(v, 8)
        setResults(found)
        setApiError(false)
      } catch {
        setResults([])
        setApiError(true)
      } finally {
        setIsLoading(false)
      }
    }, 300)
  }

  function handlePick(company: SireneCompany) {
    setValue(company.raison_sociale)
    setSelectedSiret(company.siret)
    setIsOpen(false)
    onSelect(company)
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-surface-700">
          {label}
        </label>
      )}
      <div ref={wrapRef} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400 pointer-events-none" />
          <input
            id={id}
            name={name}
            type="text"
            value={value}
            onChange={handleChange}
            onFocus={() => { if (results.length > 0) setIsOpen(true) }}
            placeholder={placeholder || 'Rechercher une entreprise (nom, SIRET...)'}
            required={required}
            autoComplete="off"
            className={cn(
              'input-base pl-9',
              error && 'border-danger-500 focus:ring-danger-500/20 focus:border-danger-500',
              selectedSiret && 'pr-9'
            )}
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400 animate-spin" />
          )}
          {selectedSiret && !isLoading && (
            <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
          )}
        </div>

        {isOpen && (results.length > 0 || (!isLoading && value.length >= 2)) && (
          <div className="absolute z-50 mt-1 w-full bg-white rounded-xl border border-surface-200 shadow-lg max-h-72 overflow-y-auto">
            {results.length === 0 && !isLoading && apiError && (
              <div className="px-4 py-3 text-sm bg-amber-50 text-amber-800 border-b border-amber-100">
                <strong>Service de recherche temporairement indisponible</strong>
                <div className="text-xs mt-0.5">L'API publique data.gouv ne répond pas. Continuez en saisie manuelle — tous les champs sont éditables.</div>
              </div>
            )}
            {results.length === 0 && !isLoading && !apiError && (
              <div className="px-4 py-3 text-sm text-surface-500">
                Aucune entreprise trouvée. Vous pouvez saisir manuellement.
              </div>
            )}
            {results.map((c) => (
              <button
                key={c.siret || c.siren}
                type="button"
                onClick={() => handlePick(c)}
                className="w-full text-left px-4 py-3 hover:bg-surface-50 flex items-start gap-3 border-b border-surface-100 last:border-b-0 transition-colors"
              >
                <Building2 className="h-4 w-4 text-surface-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-surface-900 truncate">{c.raison_sociale}</div>
                  <div className="text-xs text-surface-500 mt-0.5 flex flex-wrap gap-x-2">
                    {c.siret && <span>SIRET {c.siret}</span>}
                    {c.code_postal && c.ville && <span>· {c.code_postal} {c.ville}</span>}
                    {c.taille_entreprise && <span>· {c.taille_entreprise}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-danger-600">{error}</p>}
      {!error && (
        <p className="text-xs text-surface-500">
          Tapez au moins 2 caractères. Données INSEE/Sirene officielles via data.gouv.
        </p>
      )}
    </div>
  )
}
