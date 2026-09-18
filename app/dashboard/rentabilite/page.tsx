import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { PieChart, RefreshCw, AlertCircle } from '@/components/ui/icons'
import { peutVoirMarge } from '@/lib/rentabilite'
import { rentabilitePeriode } from '@/lib/rentabilite-data'
import { RentabiliteClient } from './RentabiliteClient'

export const dynamic = 'force-dynamic'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function raccourcis(aujourdhui: Date) {
  const a = aujourdhui.getFullYear()
  const m = aujourdhui.getMonth()
  const t = Math.floor(m / 3) * 3
  const il12 = new Date(aujourdhui); il12.setFullYear(a - 1); il12.setDate(il12.getDate() + 1)
  return [
    { label: 'Ce mois', du: iso(new Date(a, m, 1)), au: iso(new Date(a, m + 1, 0)) },
    { label: 'Ce trimestre', du: iso(new Date(a, t, 1)), au: iso(new Date(a, t + 3, 0)) },
    { label: 'Année en cours', du: `${a}-01-01`, au: `${a}-12-31` },
    { label: '12 derniers mois', du: iso(il12), au: iso(aujourdhui) },
  ]
}

export default async function RentabilitePage({ searchParams }: { searchParams: { du?: string; au?: string; sans_objet?: string } }) {
  const session = await getSession()
  // Le commercial a les droits du module factures : la marge se garde ici, au rôle
  if (!peutVoirMarge(session.user.role)) redirect('/dashboard')
  const supabase = await createServiceRoleClient()

  const aujourdhui = new Date()
  const annee = aujourdhui.getFullYear()
  let du = DATE.test(searchParams.du || '') ? searchParams.du! : `${annee}-01-01`
  let au = DATE.test(searchParams.au || '') ? searchParams.au! : `${annee}-12-31`
  if (du > au) [du, au] = [au, du]
  const afficherSansObjet = searchParams.sans_objet === '1'

  const { lignes, meta } = await rentabilitePeriode(supabase, session.organization.id, du, au)
  const liens = raccourcis(aujourdhui)
  const suffixe = afficherSansObjet ? '&sans_objet=1' : ''

  return (
    <div className="max-w-7xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-start sm:items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
          <PieChart className="h-5 w-5 text-brand-600" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-heading font-bold text-surface-900">Rentabilité des sessions</h1>
          <p className="text-sm text-surface-500">Marge calculée en direct : chiffre d&apos;affaires, coût formateur, frais annexes et commissions.</p>
        </div>
      </div>

      {/* Mobile : les deux dates côte à côte, la case à cocher puis le bouton en pleine largeur ; raccourcis défilants */}
      <form method="get" className="card p-4 flex flex-wrap items-end gap-3">
        <div className="grid grid-cols-2 gap-3 w-full sm:w-auto sm:flex sm:items-end">
          <div className="space-y-1.5 min-w-0">
            <label htmlFor="du" className="block text-xs font-medium text-surface-600">Du</label>
            <input id="du" name="du" type="date" defaultValue={du} className="input-base !min-h-10 !py-2 w-full sm:w-40" />
          </div>
          <div className="space-y-1.5 min-w-0">
            <label htmlFor="au" className="block text-xs font-medium text-surface-600">Au</label>
            <input id="au" name="au" type="date" defaultValue={au} className="input-base !min-h-10 !py-2 w-full sm:w-40" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-surface-600 cursor-pointer min-h-10 sm:min-h-0 sm:pb-2">
          <input type="checkbox" name="sans_objet" value="1" defaultChecked={afficherSansObjet} className="h-4 w-4 rounded border-surface-300" />
          Afficher les sessions sans inscrit ni montant
        </label>
        <button type="submit" className="btn-primary !py-2 text-sm inline-flex items-center gap-1.5 w-full sm:w-auto min-h-10">
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </button>
        <div className="w-full flex sm:flex-wrap gap-1.5 pt-1 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {liens.map((r) => {
            const actif = r.du === du && r.au === au
            return (
              <a key={r.label} href={`?du=${r.du}&au=${r.au}${suffixe}`}
                className={actif
                  ? 'inline-flex items-center min-h-10 sm:min-h-0 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 bg-surface-900 text-white'
                  : 'inline-flex items-center min-h-10 sm:min-h-0 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 bg-white text-surface-500 border border-surface-200/80 hover:border-surface-300 hover:text-surface-700'}>
                {r.label}
              </a>
            )
          })}
        </div>
      </form>

      {meta.erreur ? (
        <div className="card p-4 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-warning-600 mt-0.5 shrink-0" />
          <p className="text-sm text-surface-600">{meta.erreur}</p>
        </div>
      ) : (
        <RentabiliteClient
          lignes={lignes}
          du={du}
          au={au}
          afficherSansObjet={afficherSansObjet}
          fraisDisponibles={meta.fraisDisponibles}
          tvaFormateurDisponible={meta.tvaFormateurDisponible}
        />
      )}
    </div>
  )
}
