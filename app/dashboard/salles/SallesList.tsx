'use client'

import { useState, useMemo } from 'react'
import { Building2, Search, MapPin, Users, Phone, Mail, Accessibility, Monitor } from 'lucide-react'

interface Salle {
  id: string
  intitule: string
  adresse: string | null
  code_postal: string | null
  ville: string | null
  capacite_max: number | null
  telephone: string | null
  email: string | null
  acces_handicap: boolean | null
  elearning: boolean | null
  lien_google_maps: string | null
}

export function SallesList({ salles }: { salles: Salle[] }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return salles
    const s = search.toLowerCase()
    return salles.filter((sa) =>
      (sa.intitule || '').toLowerCase().includes(s) ||
      (sa.ville || '').toLowerCase().includes(s) ||
      (sa.code_postal || '').toLowerCase().includes(s),
    )
  }, [salles, search])

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Salles de formation</h1>
          <p className="text-surface-500 mt-1 text-sm">{salles.length} salle{salles.length > 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une salle, une ville…"
          className="input-base pl-10 w-full" />
      </div>

      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center text-center py-14 px-8">
          <Building2 className="h-6 w-6 text-surface-400" />
          <p className="text-sm text-surface-500 mt-2">Aucune salle</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((sa) => (
            <div key={sa.id} className="card p-5">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5 text-brand-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-surface-900 truncate">{sa.intitule}</h3>
                  {(sa.ville || sa.code_postal) && (
                    <div className="flex items-center gap-1 text-xs text-surface-500 mt-0.5">
                      <MapPin className="h-3 w-3 shrink-0" /> {[sa.code_postal, sa.ville].filter(Boolean).join(' ')}
                    </div>
                  )}
                </div>
              </div>

              {sa.adresse && <p className="text-xs text-surface-500 mt-3">{sa.adresse}</p>}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs text-surface-600">
                {sa.capacite_max != null && (
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5 text-surface-400" /> {sa.capacite_max} places</span>
                )}
                {sa.telephone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5 text-surface-400" /> {sa.telephone}</span>}
                {sa.email && <span className="flex items-center gap-1 truncate"><Mail className="h-3.5 w-3.5 text-surface-400 shrink-0" /> {sa.email}</span>}
              </div>

              {(sa.acces_handicap || sa.elearning || sa.lien_google_maps) && (
                <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-surface-100">
                  {sa.acces_handicap && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                      <Accessibility className="h-3 w-3" /> Accès PMR
                    </span>
                  )}
                  {sa.elearning && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                      <Monitor className="h-3 w-3" /> E-learning
                    </span>
                  )}
                  {sa.lien_google_maps && (
                    <a href={sa.lien_google_maps} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full bg-surface-100 px-2 py-0.5 text-[11px] font-medium text-surface-600 hover:bg-surface-200">
                      <MapPin className="h-3 w-3" /> Plan
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
