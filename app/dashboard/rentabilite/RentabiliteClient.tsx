'use client'

import { useMemo, useState } from 'react'
import {
  ReceiptEuro, Scale, TrendingUp, AlertCircle, AlertTriangle, Info, Download,
  ChevronsUpDown, ArrowUp, ArrowDown, PieChart, Search,
} from '@/components/ui/icons'
import { Badge } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { BadgeVariant } from '@/lib/types'
import {
  euro, pourcent, MESSAGE_MIGRATION_FRAIS, MESSAGE_TVA_FORMATEUR, QUALITE_MARGE_LABELS, STATUT_LABELS,
  type BadgeUnite, type Rentabilite, type StatutMarge,
} from '@/lib/rentabilite'

type Filtre = 'toutes' | 'deficitaire' | 'marge_faible' | 'incomplete' | 'rentable' | 'sans_objet'
type Colonne = 'gravite' | 'session' | 'date' | 'ca' | 'formateur' | 'frais' | 'commissions' | 'marge' | 'taux'

const GRAVITE: Record<StatutMarge, number> = { deficitaire: 0, marge_faible: 1, incomplete: 2, rentable: 3, sans_objet: 4 }
const STATUT_BADGE: Record<StatutMarge, BadgeVariant> = {
  rentable: 'success', marge_faible: 'warning', deficitaire: 'danger', incomplete: 'default', sans_objet: 'default',
}
const BADGE_UNITE: Record<BadgeUnite, { label: string; classe: string }> = {
  intra: { label: 'Intra', classe: 'bg-surface-100 text-surface-600' },
  inter: { label: 'Inter', classe: 'bg-surface-100 text-surface-600' },
  poei: { label: 'POEI', classe: 'bg-info-50 text-info-600' },
  agefice: { label: 'AGEFICE', classe: 'bg-brand-50 text-brand-600' },
  dendreo: { label: 'Dendreo', classe: 'bg-warning-50 text-warning-700' },
}
// Messages de paramétrage communs à toutes les lignes : affichés une fois en tête
const ALERTES_GLOBALES = ['A21', 'A22']

// Tuiles : montants arrondis à l'euro pour rester lisibles ; le tableau garde les centimes
const euroRond = (n: number) => Math.round(n).toLocaleString('fr-FR') + ' €'
const sansAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const dateFr = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : 'Sans date')
const commissions = (r: Rentabilite) =>
  r.couts.commissionFranchise == null || r.couts.commissionApporteur == null ? null : r.couts.commissionFranchise + r.couts.commissionApporteur
const lienUnite = (r: Rentabilite) =>
  r.type === 'poei'
    ? (r.porteuseIds[0] ? `/dashboard/sessions/${r.porteuseIds[0]}?tab=facturation` : `/dashboard/poei/${r.poeiIds[0]}`)
    : `/dashboard/sessions/${r.sessionIds[0]}?tab=facturation`
const couleurMarge = (s: StatutMarge) =>
  s === 'rentable' ? 'text-success-700' : s === 'marge_faible' ? 'text-warning-700' : s === 'deficitaire' ? 'text-danger-600' : 'text-surface-500'

/** Tuile de synthèse : deux par ligne sur mobile (icône masquée, montant insécable), identique à StatCard au-delà. */
function Tuile({ icon, iconBg, label, value, valueColor, sub }: {
  icon: React.ReactNode; iconBg: string; label: string; value: string; valueColor: string; sub: string
}) {
  return (
    <div className="card p-3.5 sm:p-5 flex items-start gap-4">
      <div className={cn('stat-icon hidden sm:flex', iconBg)}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs sm:text-sm text-surface-500 leading-none">{label}</p>
        <p className={cn('text-lg sm:text-xl font-heading font-bold tracking-tight tabular-nums whitespace-nowrap mt-1 sm:mt-0.5', valueColor)}>{value}</p>
        <p className="text-xs text-surface-400 mt-1">{sub}</p>
      </div>
    </div>
  )
}

function valeurTri(r: Rentabilite, c: Colonne): number | string | null {
  switch (c) {
    case 'session': return sansAccents(r.reference || r.titre || '')
    case 'date': return r.date || null
    case 'ca': return r.recette.prevu
    case 'formateur': return r.couts.formateurInconnu ? null : r.couts.formateur
    case 'frais': return r.couts.frais
    case 'commissions': return commissions(r)
    case 'marge': return r.marge
    case 'taux': return r.taux
    default: return GRAVITE[r.statut]
  }
}

export function RentabiliteClient({ lignes, du, au, afficherSansObjet, fraisDisponibles, tvaFormateurDisponible }: {
  lignes: Rentabilite[]
  du: string
  au: string
  afficherSansObjet: boolean
  fraisDisponibles: boolean
  tvaFormateurDisponible: boolean
}) {
  const [filtre, setFiltre] = useState<Filtre>('toutes')
  const [recherche, setRecherche] = useState('')
  const [tri, setTri] = useState<{ col: Colonne; dir: 'asc' | 'desc' }>({ col: 'gravite', dir: 'asc' })

  const base = useMemo(() => {
    const q = sansAccents(recherche.trim())
    return lignes.filter((r) => (afficherSansObjet || r.statut !== 'sans_objet')
      && (!q || sansAccents([r.reference, r.client, r.titre].filter(Boolean).join(' ')).includes(q)))
  }, [lignes, recherche, afficherSansObjet])

  const compte = (s: StatutMarge) => base.filter((r) => r.statut === s).length
  const options: { value: Filtre; label: string; count: number }[] = [
    { value: 'toutes', label: 'Toutes', count: base.filter((r) => r.statut !== 'sans_objet').length },
    { value: 'deficitaire', label: 'Déficitaires', count: compte('deficitaire') },
    { value: 'marge_faible', label: 'Marge faible', count: compte('marge_faible') },
    { value: 'incomplete', label: 'À compléter', count: compte('incomplete') },
    { value: 'rentable', label: 'Rentables', count: compte('rentable') },
    ...(afficherSansObjet ? [{ value: 'sans_objet' as Filtre, label: 'Sans objet', count: compte('sans_objet') }] : []),
  ]

  const visibles = useMemo(() => {
    const f = base.filter((r) => (filtre === 'toutes' ? r.statut !== 'sans_objet' : r.statut === filtre))
    const sens = tri.dir === 'asc' ? 1 : -1
    return [...f].sort((a, b) => {
      const va = valeurTri(a, tri.col)
      const vb = valeurTri(b, tri.col)
      if (va == null && vb == null) return 0
      if (va == null) return 1 // valeurs inconnues toujours en fin de liste
      if (vb == null) return -1
      const c = va < vb ? -1 : va > vb ? 1 : 0
      if (c !== 0 || tri.col !== 'gravite') return c * sens
      // Par défaut : gravité, puis marge la plus faible d'abord
      return (a.marge ?? a.margePartielle) - (b.marge ?? b.margePartielle)
    })
  }, [base, filtre, tri])

  const totaux = useMemo(() => {
    const t = { ca: 0, facture: 0, aFacturer: 0, couts: 0, formateur: 0, frais: 0, commissions: 0, marge: 0, caComplet: 0, nbComplets: 0, nbIncompletes: 0, caSansCout: 0, encaisse: 0 }
    for (const r of visibles) {
      t.ca += r.recette.prevu || 0
      t.facture += r.recette.facture
      t.aFacturer += r.recette.aFacturer
      t.couts += r.couts.total
      t.formateur += r.couts.formateur
      t.frais += r.couts.frais
      t.commissions += (r.couts.commissionFranchise || 0) + (r.couts.commissionApporteur || 0)
      t.encaisse += r.recette.encaisse
      if (r.marge != null && r.recette.prevu != null) { t.marge += r.marge; t.caComplet += r.recette.prevu; t.nbComplets++ }
      if (r.statut === 'incomplete') { t.nbIncompletes++; t.caSansCout += r.recette.prevu || 0 }
    }
    return t
  }, [visibles])
  const tauxGlobal = totaux.caComplet > 0 ? totaux.marge / totaux.caComplet : null
  const statutGlobal: StatutMarge = tauxGlobal == null ? 'incomplete' : totaux.marge < -0.005 ? 'deficitaire' : tauxGlobal < 0.3 ? 'marge_faible' : 'rentable'

  function trier(col: Colonne) {
    setTri((t) => (t.col === col ? { col, dir: t.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: col === 'session' || col === 'date' ? 'asc' : 'desc' }))
  }

  function exporter() {
    const nombre = (n: number | null | undefined) => (n == null ? '' : n.toFixed(2).replace('.', ','))
    // Une cellule commençant par =, +, - ou @ serait exécutée comme formule à
    // l'ouverture du fichier : on la neutralise par une apostrophe.
    const cellule = (v: string) => {
      const sur = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
      return /[;"\n]/.test(sur) ? `"${sur.replace(/"/g, '""')}"` : sur
    }
    const entetes = ['Référence', 'Intitulé', 'Client', 'Date', 'Type', 'CA prévu', 'Facturé', 'Encaissé', 'Reste à facturer',
      'Coût formateur', 'Frais', 'Commission franchise', 'Commission apporteur', 'Coûts', 'Marge', 'Taux (%)', 'Statut', 'Qualité', 'Manques', 'Alertes']
    const lignesCsv = visibles.map((r) => [
      r.reference || '', r.titre, r.client || '', dateFr(r.date), r.badges.map((b) => BADGE_UNITE[b].label).join(' '),
      nombre(r.recette.prevu), nombre(r.recette.facture), nombre(r.recette.encaisse), nombre(r.recette.aFacturer),
      r.couts.formateurInconnu ? '' : nombre(r.couts.formateur), nombre(r.couts.frais),
      nombre(r.couts.commissionFranchise), nombre(r.couts.commissionApporteur), nombre(r.couts.total),
      nombre(r.marge), r.taux == null ? '' : (r.taux * 100).toFixed(1).replace('.', ','),
      STATUT_LABELS[r.statut], QUALITE_MARGE_LABELS[r.qualiteMarge], r.manques.join(', '),
      r.alertes.filter((a) => !ALERTES_GLOBALES.includes(a.code)).map((a) => a.message).join(' | '),
    ].map((v) => cellule(String(v))).join(';'))
    const csv = '\uFEFF' + [entetes.join(';'), ...lignesCsv].join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `rentabilite-${du}-${au}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const Tri = ({ col, children, droite }: { col: Colonne; children: React.ReactNode; droite?: boolean }) => {
    const actif = tri.col === col
    const Icone = !actif ? ChevronsUpDown : tri.dir === 'asc' ? ArrowUp : ArrowDown
    return (
      <th className={cn('table-header px-3 whitespace-nowrap', droite && 'text-right')}>
        <button type="button" onClick={() => trier(col)}
          className={cn('inline-flex items-center gap-1 uppercase tracking-[0.06em] hover:text-surface-600', actif && 'text-surface-700', droite && 'flex-row-reverse')}>
          {children}
          <Icone className="h-3 w-3" />
        </button>
      </th>
    )
  }

  return (
    <div className="space-y-4">
      {(!fraisDisponibles || !tvaFormateurDisponible) && (
        <div className="rounded-xl bg-info-50 text-info-600 px-4 py-3 text-xs space-y-1">
          {!fraisDisponibles && <p className="flex items-start gap-2"><Info className="h-4 w-4 shrink-0" />{MESSAGE_MIGRATION_FRAIS}</p>}
          {!tvaFormateurDisponible && <p className="flex items-start gap-2"><Info className="h-4 w-4 shrink-0" />{MESSAGE_TVA_FORMATEUR}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tuile
          icon={<ReceiptEuro className="h-5 w-5 text-brand-600" />} iconBg="bg-brand-50"
          label="CA prévu" value={euroRond(totaux.ca)} valueColor="text-surface-900"
          sub={`facturé ${euroRond(totaux.facture)} · reste à facturer ${euroRond(totaux.aFacturer)}`}
        />
        <Tuile
          icon={<Scale className="h-5 w-5 text-surface-600" />} iconBg="bg-surface-100"
          label="Coûts" value={euroRond(totaux.couts)} valueColor="text-surface-900"
          sub={`formateurs ${euroRond(totaux.formateur)} · frais ${euroRond(totaux.frais)} · commissions ${euroRond(totaux.commissions)}`}
        />
        <Tuile
          icon={<TrendingUp className="h-5 w-5 text-success-600" />} iconBg="bg-success-50"
          label={tauxGlobal == null ? 'Marge' : `Marge · ${pourcent(tauxGlobal)}`}
          value={totaux.nbComplets ? euroRond(totaux.marge) : 'Non calculable'}
          valueColor={couleurMarge(statutGlobal)}
          sub={`sur ${totaux.nbComplets} session${totaux.nbComplets > 1 ? 's' : ''} complète${totaux.nbComplets > 1 ? 's' : ''}`}
        />
        <Tuile
          icon={<AlertCircle className="h-5 w-5 text-warning-600" />} iconBg="bg-warning-50"
          label="À compléter" value={String(totaux.nbIncompletes)} valueColor="text-surface-900"
          sub={`${euroRond(totaux.caSansCout)} de CA sans coût connu`}
        />
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        {/* Pastilles : défilement horizontal bord à bord sur mobile, cibles de 40 px */}
        <div className="flex gap-1 overflow-x-auto -mx-5 px-5 lg:mx-0 lg:px-0 max-md:max-md:[scrollbar-width:none] md:[scrollbar-width:thin] md:[scrollbar-width:thin] max-md:max-md:[&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:h-1.5 md:[&::-webkit-scrollbar-thumb]:rounded-full md:[&::-webkit-scrollbar-thumb]:bg-surface-300">
          {options.map((opt) => (
            <button key={opt.value} type="button" onClick={() => setFiltre(opt.value)}
              className={cn(
                'min-h-10 sm:min-h-0 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all duration-150',
                filtre === opt.value
                  ? 'bg-surface-900 text-white shadow-xs'
                  : 'bg-white text-surface-500 border border-surface-200/80 hover:border-surface-300 hover:text-surface-700',
              )}>
              {opt.label}
              <span className={cn('ml-1.5', filtre === opt.value ? 'text-white/60' : 'text-surface-400')}>{opt.count}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 lg:ml-auto">
          <div className="flex items-center gap-2.5 bg-white rounded-xl px-3.5 sm:py-2 border border-surface-200/80 hover:border-surface-300 transition-colors flex-1 max-w-md lg:w-72">
            <Search className="h-3.5 w-3.5 text-surface-400 shrink-0" />
            <input type="text" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Référence, client, intitulé"
              className="h-10 sm:h-auto bg-transparent text-sm text-surface-700 placeholder:text-surface-400 focus:outline-none flex-1 min-w-0" />
          </div>
          <button type="button" onClick={exporter} disabled={!visibles.length}
            className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1.5 shrink-0 disabled:opacity-50 min-h-10 sm:min-h-0">
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Exporter (CSV)</span><span className="sm:hidden">CSV</span>
          </button>
        </div>
      </div>

      {visibles.length === 0 ? (
        <div className="card flex flex-col items-center justify-center text-center py-14 px-6">
          <div className="h-12 w-12 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
            <PieChart className="h-5 w-5 text-surface-400" />
          </div>
          <h3 className="text-sm font-heading font-semibold text-surface-700 mb-1">Aucune session dans cette sélection</h3>
          <p className="text-sm text-surface-400 max-w-sm">Élargissez la période ou changez de filtre.</p>
        </div>
      ) : (
        <>
        {/* Liste mobile : une carte par session, l'essentiel de la marge lisible sans défilement horizontal */}
        <div className="card overflow-hidden md:hidden">
          <div className="divide-y divide-surface-100">
            {visibles.map((r) => {
              const alertes = r.alertes.filter((a) => !ALERTES_GLOBALES.includes(a.code))
              const pire = alertes.some((a) => a.niveau === 'critique') ? 'text-danger-600' : alertes.some((a) => a.niveau === 'attention') ? 'text-warning-700' : 'text-surface-400'
              return (
                <div key={r.uniteId} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <a href={lienUnite(r)} className="min-w-0 flex-1 min-h-10 flex flex-col justify-center">
                      <div className="font-medium text-surface-900 text-sm truncate">{r.reference || r.titre}</div>
                      {r.reference && <p className="text-xs text-surface-500 truncate">{r.titre}</p>}
                      {r.client && <p className="text-xs text-surface-400 truncate">{r.client}</p>}
                    </a>
                    <div className="text-right shrink-0">
                      <div className={cn('text-sm font-semibold tabular-nums whitespace-nowrap', couleurMarge(r.statut))}>
                        {r.marge != null ? euro(r.marge) : 'À compléter'}
                      </div>
                      <div className={cn('text-xs tabular-nums', couleurMarge(r.statut))}>marge {pourcent(r.taux)}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-x-2 gap-y-1 flex-wrap text-xs text-surface-500">
                    <Badge variant={STATUT_BADGE[r.statut]}>{STATUT_LABELS[r.statut]}</Badge>
                    <span className="tabular-nums">{dateFr(r.date)}</span>
                    {r.badges.map((b) => (
                      <span key={b} className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-medium', BADGE_UNITE[b].classe)}>{BADGE_UNITE[b].label}</span>
                    ))}
                    {alertes.length > 0 && (
                      <span className={cn('inline-flex items-center gap-1', pire)} title={alertes.map((a) => a.message).join('\n')}>
                        <AlertTriangle className="h-3 w-3" />
                        {alertes.length} alerte{alertes.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div className="min-w-0">
                      <dt className="text-surface-400">CA prévu</dt>
                      <dd className="tabular-nums font-medium text-surface-800 whitespace-nowrap">{r.recette.prevu == null ? <span className="text-warning-700 font-normal">Non renseigné</span> : euro(r.recette.prevu)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-surface-400">Formateur</dt>
                      <dd className="tabular-nums text-surface-700 whitespace-nowrap">{r.couts.formateurInconnu ? <span className="text-warning-700">Non renseigné</span> : euro(r.couts.formateur)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-surface-400">Frais + comm.</dt>
                      <dd className="tabular-nums text-surface-700 whitespace-nowrap">{commissions(r) == null ? <span className="text-warning-700">À compléter</span> : euro(r.couts.frais + (commissions(r) || 0))}</dd>
                    </div>
                  </dl>
                </div>
              )
            })}
          </div>
          <div className="bg-surface-50/80 border-t border-surface-200 px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-surface-900">Total · {visibles.length} ligne{visibles.length > 1 ? 's' : ''}</div>
              <div className="text-2xs text-surface-400">Marge et taux hors sessions à compléter</div>
            </div>
            <div className="text-right shrink-0">
              <div className={cn('text-sm font-semibold tabular-nums whitespace-nowrap', couleurMarge(statutGlobal))}>{euro(totaux.marge)}</div>
              <div className={cn('text-xs tabular-nums', couleurMarge(statutGlobal))}>marge {pourcent(tauxGlobal)}</div>
            </div>
          </div>
        </div>

        <div className="card overflow-hidden hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-50/80">
                <tr>
                  <Tri col="session">Session</Tri>
                  <Tri col="date">Date</Tri>
                  <th className="table-header px-3">Type</th>
                  <Tri col="ca" droite>CA prévu</Tri>
                  <Tri col="formateur" droite>Formateur</Tri>
                  <Tri col="frais" droite>Frais</Tri>
                  <Tri col="commissions" droite>Commissions</Tri>
                  <Tri col="marge" droite>Marge</Tri>
                  <Tri col="taux" droite>Taux</Tri>
                  <Tri col="gravite">Statut</Tri>
                </tr>
              </thead>
              <tbody>
                {visibles.map((r) => {
                  const alertes = r.alertes.filter((a) => !ALERTES_GLOBALES.includes(a.code))
                  const pire = alertes.some((a) => a.niveau === 'critique') ? 'text-danger-600' : alertes.some((a) => a.niveau === 'attention') ? 'text-warning-700' : 'text-surface-400'
                  const com = commissions(r)
                  return (
                    <tr key={r.uniteId} className="table-row border-t border-surface-100 align-top">
                      <td className="table-cell px-3">
                        <a href={lienUnite(r)} className="font-medium text-surface-900 hover:text-brand-600 whitespace-nowrap">{r.reference || r.titre}</a>
                        {r.reference && <p className="text-xs text-surface-500 truncate w-44">{r.titre}</p>}
                        {r.client && <p className="text-xs text-surface-400 truncate w-44">{r.client}</p>}
                      </td>
                      <td className="table-cell px-3 whitespace-nowrap tabular-nums text-surface-600">{dateFr(r.date)}</td>
                      <td className="table-cell px-3">
                        <div className="flex flex-wrap gap-1 w-[6.5rem]">
                          {r.badges.map((b) => (
                            <span key={b} className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-medium', BADGE_UNITE[b].classe)}>{BADGE_UNITE[b].label}</span>
                          ))}
                        </div>
                      </td>
                      <td className="table-cell px-3 text-right whitespace-nowrap">
                        {r.recette.prevu == null
                          ? <span className="text-warning-700">Non renseigné</span>
                          : <span className="tabular-nums font-medium text-surface-900">{euro(r.recette.prevu)}</span>}
                        <p className="text-xs text-surface-400 tabular-nums">facturé {euro(r.recette.facture)}</p>
                      </td>
                      <td className="table-cell px-3 text-right whitespace-nowrap tabular-nums">
                        {r.couts.formateurInconnu
                          ? <span className="text-warning-700">Non renseigné</span>
                          : <span className="text-surface-700">{euro(r.couts.formateur)}</span>}
                      </td>
                      <td className="table-cell px-3 text-right whitespace-nowrap tabular-nums text-surface-700">{euro(r.couts.frais)}</td>
                      <td className="table-cell px-3 text-right whitespace-nowrap tabular-nums">
                        {com == null ? <span className="text-warning-700">À compléter</span> : <span className="text-surface-700">{euro(com)}</span>}
                      </td>
                      <td className={cn('table-cell px-3 text-right whitespace-nowrap tabular-nums font-semibold', couleurMarge(r.statut))}>
                        {r.marge != null ? euro(r.marge) : <span className="font-normal text-surface-500">À compléter</span>}
                      </td>
                      <td className={cn('table-cell px-3 text-right whitespace-nowrap tabular-nums', couleurMarge(r.statut))}>{pourcent(r.taux)}</td>
                      <td className="table-cell px-3 whitespace-nowrap">
                        <Badge variant={STATUT_BADGE[r.statut]}>{STATUT_LABELS[r.statut]}</Badge>
                        {alertes.length > 0 && (
                          <span className={cn('mt-1 flex items-center gap-1 text-xs', pire)} title={alertes.map((a) => a.message).join('\n')}>
                            <AlertTriangle className="h-3 w-3" />
                            {alertes.length} alerte{alertes.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-surface-50/80 border-t border-surface-200">
                <tr className="font-semibold text-surface-900">
                  <td className="table-cell px-3" colSpan={3}>
                    Total · {visibles.length} ligne{visibles.length > 1 ? 's' : ''}
                    <p className="text-2xs font-normal text-surface-400">Marge et taux hors sessions à compléter</p>
                  </td>
                  <td className="table-cell px-3 text-right tabular-nums whitespace-nowrap">{euro(totaux.ca)}</td>
                  <td className="table-cell px-3 text-right tabular-nums whitespace-nowrap">{euro(totaux.formateur)}</td>
                  <td className="table-cell px-3 text-right tabular-nums whitespace-nowrap">{euro(totaux.frais)}</td>
                  <td className="table-cell px-3 text-right tabular-nums whitespace-nowrap">{euro(totaux.commissions)}</td>
                  <td className={cn('table-cell px-3 text-right tabular-nums whitespace-nowrap', couleurMarge(statutGlobal))}>
                    {euro(totaux.marge)}
                  </td>
                  <td className={cn('table-cell px-3 text-right tabular-nums whitespace-nowrap', couleurMarge(statutGlobal))}>{pourcent(tauxGlobal)}</td>
                  <td className="table-cell px-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        </>
      )}

      <p className="text-xs text-surface-500">
        Rentable : marge ≥ 30 % du CA. Marge faible : entre 0 et 30 %. Déficitaire : marge négative. À compléter : CA ou coût formateur non renseigné.
        Recettes HT (organisme exonéré de TVA) ; coûts au montant réellement payé, TVA comprise. Un parcours POEI compte pour une ligne.
      </p>
    </div>
  )
}
