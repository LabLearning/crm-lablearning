'use client'

import { useMemo, useState } from 'react'
import {
  ReceiptEuro, Scale, TrendingUp, AlertCircle, AlertTriangle, Info, Download,
  ChevronsUpDown, ArrowUp, ArrowDown, PieChart,
} from '@/components/ui/icons'
import { Badge, FilterPills, SearchBar, StatCard } from '@/components/ui'
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<ReceiptEuro className="h-5 w-5 text-brand-600" />} iconBg="bg-brand-50"
          label="CA prévu" value={euroRond(totaux.ca)} valueColor="text-surface-900 tabular-nums !text-xl"
          sub={`facturé ${euroRond(totaux.facture)} · reste à facturer ${euroRond(totaux.aFacturer)}`}
        />
        <StatCard
          icon={<Scale className="h-5 w-5 text-surface-600" />} iconBg="bg-surface-100"
          label="Coûts" value={euroRond(totaux.couts)} valueColor="text-surface-900 tabular-nums !text-xl"
          sub={`formateurs ${euroRond(totaux.formateur)} · frais ${euroRond(totaux.frais)} · commissions ${euroRond(totaux.commissions)}`}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-success-600" />} iconBg="bg-success-50"
          label={tauxGlobal == null ? 'Marge' : `Marge · ${pourcent(tauxGlobal)}`}
          value={totaux.nbComplets ? euroRond(totaux.marge) : 'Non calculable'}
          valueColor={cn(couleurMarge(statutGlobal), 'tabular-nums !text-xl')}
          sub={`sur ${totaux.nbComplets} session${totaux.nbComplets > 1 ? 's' : ''} complète${totaux.nbComplets > 1 ? 's' : ''}`}
        />
        <StatCard
          icon={<AlertCircle className="h-5 w-5 text-warning-600" />} iconBg="bg-warning-50"
          label="À compléter" value={String(totaux.nbIncompletes)} valueColor="text-surface-900 tabular-nums !text-xl"
          sub={`${euroRond(totaux.caSansCout)} de CA sans coût connu`}
        />
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <FilterPills options={options} value={filtre} onChange={setFiltre} />
        <div className="flex items-center gap-2 lg:ml-auto">
          <SearchBar value={recherche} onChange={setRecherche} placeholder="Référence, client, intitulé" className="lg:w-72" />
          <button type="button" onClick={exporter} disabled={!visibles.length}
            className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1.5 shrink-0 disabled:opacity-50">
            <Download className="h-3.5 w-3.5" />
            Exporter (CSV)
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
        <div className="card overflow-hidden">
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
                            <span key={b} className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-medium', BADGE_UNITE[b].classe)}>{BADGE_UNITE[b].label}</span>
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
      )}

      <p className="text-xs text-surface-500">
        Rentable : marge ≥ 30 % du CA. Marge faible : entre 0 et 30 %. Déficitaire : marge négative. À compléter : CA ou coût formateur non renseigné.
        Recettes HT (organisme exonéré de TVA) ; coûts au montant réellement payé, TVA comprise. Un parcours POEI compte pour une ligne.
      </p>
    </div>
  )
}
