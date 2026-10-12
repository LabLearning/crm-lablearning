'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ReceiptEuro, FileText, Clock, Download, Landmark, Loader2 } from '@/components/ui/icons'
import { PoeiSection } from './PoeiSection'
import { Button, useToast, Modal, Input } from '@/components/ui'
import { generateFacturesPerCandidatPoeiAction, setAffacturageFacturesPoeiAction, setCandidatNumeroEngagementAction, setPoeiAgenceFtAction } from '../actions'
import { AgenceFtSelect } from '../AgenceFtSelect'
import { ligneFactureCandidat, heuresPrevues } from '@/lib/poei-candidat'
import { reglementDossier } from '@/lib/poei-reglement'
import { cn } from '@/lib/utils'

interface Candidat {
  id: string
  numero_engagement?: string | null
  statut?: string | null
  date_debut?: string | null
  date_fin?: string | null
  duree_heures?: number | string | null
  date_abandon?: string | null
  heures_effectuees?: number | string | null
  apprenant?: { id: string; prenom: string | null; nom: string | null } | null
}
interface FactureInfo {
  id: string; numero: string | null; status: string; montant_ttc: number | null
  /** Réglée à l'organisme : ni mention de cession ni coordonnées du factor sur le PDF */
  sans_affacturage?: boolean
  /** Renseigné dès que la créance a été cédée : le règlement ne change plus */
  affacturage_status?: string | null
}
/** Réglage de l'organisme : le factor n'est imprimé que s'il est actif et nommé. */
interface Affacturage { actif: boolean; societe: string | null; ribOrganisme: boolean }
interface Projet { duree_heures?: number | string | null; montant_horaire?: number | string | null; date_debut?: string | null; date_fin?: string | null }

const heuresFr = (h: number) => `${h.toLocaleString('fr-FR')} h`
const eurosFr = (v: number) => `${v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €`

const FACT_STATUS: Record<string, { label: string; cls: string }> = {
  brouillon: { label: 'Brouillon', cls: 'bg-surface-100 text-surface-600' },
  emise: { label: 'Émise', cls: 'bg-blue-100 text-blue-700' },
  envoyee: { label: 'Envoyée', cls: 'bg-indigo-100 text-indigo-700' },
  payee_partiellement: { label: 'Payée en partie', cls: 'bg-amber-100 text-warning-700' },
  payee: { label: 'Payée', cls: 'bg-emerald-100 text-success-700' },
  en_retard: { label: 'En retard', cls: 'bg-rose-100 text-danger-700' },
  annulee: { label: 'Annulée', cls: 'bg-surface-100 text-surface-400' },
}

interface Agence { id: string; nom: string; ville?: string | null }

/** Un des deux règlements possibles des factures du dossier. */
function ChoixReglement({ nom, coche, occupe, titre, detail, onChoisir }: {
  nom: string; coche: boolean; occupe: boolean; titre: string; detail: string; onChoisir: () => void
}) {
  return (
    <label className={cn(
      'flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors',
      coche ? 'border-brand-400 bg-brand-50/60' : 'border-surface-200 hover:bg-surface-50',
      occupe ? 'opacity-60 cursor-wait' : 'cursor-pointer',
    )}>
      <input type="radio" name={nom} checked={coche} disabled={occupe} onChange={onChoisir}
        className="mt-0.5 h-4 w-4 shrink-0 accent-brand-500" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-surface-900">{titre}</span>
        <span className="block text-xs text-surface-500 mt-0.5">{detail}</span>
      </span>
    </label>
  )
}

/** N° d'engagement France Travail d'un candidat, saisi puis reporté sur sa facture. */
function EngagementCandidat({ candidatId, valeur, verrouille }: { candidatId: string; valeur: string; verrouille: boolean }) {
  const { toast } = useToast()
  const router = useRouter()
  const [v, setV] = useState(valeur)
  const [busy, setBusy] = useState(false)

  async function save() {
    if (v.trim() === valeur.trim()) return
    setBusy(true)
    const r = await setCandidatNumeroEngagementAction(candidatId, v)
    setBusy(false)
    if (r.success) { toast('success', 'N° d’engagement enregistré'); router.refresh() }
    else { toast('error', r.error || 'Erreur'); setV(valeur) }
  }

  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={save}
      disabled={verrouille || busy}
      placeholder="N° engagement"
      title={verrouille ? 'Facture déjà émise : numéro figé' : 'N° d’engagement France Travail de ce candidat'}
      className={`input-base !py-2 sm:!py-1 !px-2 text-xs font-mono w-full sm:w-36 ${!v ? 'border-amber-300 bg-warning-50/40' : ''} disabled:opacity-60`}
    />
  )
}

export function PoeiFacturation({
  poeiId, sessionId, sessionTerminee, candidats, facturesByCandidat, agences = [], currentAgenceId = null,
  signatures = {}, projet = {}, organisme = 'l’organisme', affacturage,
}: {
  poeiId: string
  /** Durée et taux du projet : ce que vaut la facture de chaque candidat. */
  projet?: Projet
  sessionId: string | null
  sessionTerminee: boolean
  candidats: Candidat[]
  signatures?: Record<string, { signed_at: string | null; sent_at: string | null }>
  facturesByCandidat: Record<string, FactureInfo>
  agences?: Agence[]
  currentAgenceId?: string | null
  /** Nom de l'organisme, pour dire à qui la facture est réglée */
  organisme?: string
  affacturage?: Affacturage
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [gen, setGen] = useState(false)
  const [agenceId, setAgenceId] = useState<string>(currentAgenceId || '')
  // Règlement choisi pour la première génération. Rien n'est coché d'avance :
  // tant qu'aucune facture n'existe, le choix ne vit que dans cet écran, et
  // un choix perdu (changement d'onglet) ne doit pas retomber sur un compte.
  const [choixPremiere, setChoixPremiere] = useState<boolean | null>(null)
  // 'tout' pendant la bascule du dossier, l'identifiant du candidat pour une seule facture
  const [bascule, setBascule] = useState<string | null>(null)
  // Tant que la page n'est pas relue, ce qui est affiché date d'avant le geste
  const [relecture, relire] = useTransition()
  const occupe = !!bascule || gen || relecture

  // Règlement des factures du dossier : au factor ou à l'organisme. Il se lit
  // sur les factures (lib/poei-reglement) : cédées, soldées ou annulées, elles
  // ne changent plus et ne comptent pas dans le choix affiché.
  const toutesFactures = Object.values(facturesByCandidat)
  const duDossier = reglementDossier(toutesFactures)
  const nbCedees = toutesFactures.filter((f) => f.affacturage_status).length
  const reglement = duDossier !== 'aucun' ? duDossier : choixPremiere === null ? 'aucun' : choixPremiere ? 'direct' : 'factor'
  const resteAFacturer = candidats.some((c) => !facturesByCandidat[c.id])

  async function choisirReglement(direct: boolean) {
    if (occupe) return
    // Aucune facture encore : le choix est retenu pour la génération
    if (duDossier === 'aucun') { setChoixPremiere(direct); return }
    if ((direct ? 'direct' : 'factor') === duDossier) return
    setBascule('tout')
    const r = await setAffacturageFacturesPoeiAction(poeiId, direct)
    setBascule(null)
    if (!r.success) { toast('error', r.error || 'Erreur'); return }
    const n = r.data?.modifiees || 0
    toast('success', direct
      ? `${n} facture${n > 1 ? 's' : ''} réglée${n > 1 ? 's' : ''} à ${organisme}, sans affacturage`
      : `${n} facture${n > 1 ? 's' : ''} remise${n > 1 ? 's' : ''} à l’affacturage`)
    relire(() => router.refresh())
  }

  async function basculerFacture(candidatId: string, direct: boolean) {
    if (occupe) return
    setBascule(candidatId)
    const r = await setAffacturageFacturesPoeiAction(poeiId, direct, candidatId)
    setBascule(null)
    if (!r.success) { toast('error', r.error || 'Erreur'); return }
    toast('success', direct ? `Facture réglée à ${organisme}, sans affacturage` : 'Facture remise à l’affacturage')
    relire(() => router.refresh())
  }

  async function generate() {
    if (occupe) return
    // Première génération d'un organisme qui cède ses créances : le règlement se choisit, il ne se devine pas
    if (affacturage?.actif && duDossier === 'aucun' && choixPremiere === null && resteAFacturer) {
      toast('error', 'Choisissez d’abord le règlement des factures : au factor, ou en direct')
      return
    }
    setGen(true)
    // Dès qu'il a des factures, le dossier porte lui-même son règlement : le serveur le relit
    const r = await generateFacturesPerCandidatPoeiAction(
      poeiId,
      duDossier === 'aucun' && choixPremiere !== null ? { sansAffacturage: choixPremiere } : undefined,
    )
    setGen(false)
    if (r.success) {
      const { created, updated, skipped, supprimees, orphelinesEmises } = (r.data || {}) as
        { created: number; updated: number; skipped: number; supprimees?: number; orphelinesEmises?: number }
      const parts: string[] = []
      if (created) parts.push(`${created} générée${created > 1 ? 's' : ''}`)
      if (updated) parts.push(`${updated} mise${updated > 1 ? 's' : ''} à jour`)
      if (skipped) parts.push(`${skipped} déjà émise${skipped > 1 ? 's' : ''}`)
      if (supprimees) parts.push(`${supprimees} supprimée${supprimees > 1 ? 's' : ''} (candidat retiré)`)
      if (orphelinesEmises) {
        toast('error', `${orphelinesEmises} facture(s) émise(s) concernent un candidat retiré du dossier, à annuler manuellement`)
      }
      toast('success', parts.length ? `Factures : ${parts.join(', ')}` : 'Aucune facture modifiée')
      relire(() => router.refresh())
    } else toast('error', r.error || 'Erreur')
  }

  const nbFactures = Object.keys(facturesByCandidat).length
  // Ce que vaut la facture de chaque candidat : ses heures effectuées dès
  // qu'elles sont déclarées (abandon ou non), sa durée prévue sinon.
  const aTaux = Number(projet.montant_horaire) > 0
  const lignes = new Map(candidats.map((c) => [c.id, ligneFactureCandidat(c, projet)]))
  const totalAFacturer = Math.round(candidats.reduce((t, c) => t + (lignes.get(c.id)?.montantHt || 0), 0) * 100) / 100

  return (
    <PoeiSection
      icone={ReceiptEuro}
      titre="Facturation"
      sous="Une facture par candidat, adressée à France Travail."
      actions={sessionTerminee ? (
        <>
          {nbFactures > 0 && (
            <a href={`/api/pdf/poei-factures/${poeiId}`}
              className="btn-secondary inline-flex items-center gap-1.5 !py-1.5 !px-3 text-sm">
              <Download className="h-4 w-4" /> Toutes les factures (ZIP)
            </a>
          )}
          <Button onClick={generate} isLoading={gen} disabled={!!bascule || relecture} size="sm" icon={<ReceiptEuro className="h-4 w-4" />}>
            {nbFactures > 0 ? 'Mettre à jour les factures' : 'Générer les factures'}
          </Button>
        </>
      ) : undefined}
    >
      <div className="card p-4 sm:p-5 space-y-4">

      {/* Destinataire des factures : l'agence France Travail, créable ici */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
        <AgenceFtSelect
          agences={agences}
          value={agenceId}
          onChange={async (id) => {
            setAgenceId(id)
            const r = await setPoeiAgenceFtAction(poeiId, id || null)
            if (r.success) { toast('success', id ? 'Agence facturée enregistrée' : 'Agence retirée'); router.refresh() }
            else toast('error', r.error || 'Erreur')
          }}
        />
        {!agenceId && (
          <p className="text-xs text-warning-700 bg-warning-50 border border-warning-100 rounded-xl px-3 py-2 sm:mt-6">
            Sans agence, les factures ne peuvent pas être adressées à France Travail.
          </p>
        )}
      </div>

      {/* À qui France Travail règle : le factor (cession de créance) ou
          l'organisme en direct. Sans affacturage actif, tout est déjà direct.
          Le bloc n'apparaît que s'il y a quelque chose à régler : des factures
          dont le règlement peut changer, ou des factures à générer. */}
      {affacturage?.actif && (duDossier !== 'aucun' || (sessionTerminee && resteAFacturer)) && (
        <fieldset className="space-y-2" aria-busy={occupe}>
          <legend className="text-sm font-medium text-surface-700 mb-1.5 flex items-center gap-2">
            Règlement des factures
            {bascule === 'tout' && <Loader2 className="h-3.5 w-3.5 animate-spin text-surface-400" aria-hidden="true" />}
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <ChoixReglement
              nom={`reglement-${poeiId}`}
              coche={reglement === 'factor'}
              occupe={occupe}
              titre={`À ${affacturage.societe}, par affacturage`}
              detail="La facture porte la cession de créance et les coordonnées bancaires du factor."
              onChoisir={() => choisirReglement(false)}
            />
            <ChoixReglement
              nom={`reglement-${poeiId}`}
              coche={reglement === 'direct'}
              occupe={occupe}
              titre={`À ${organisme}, en direct`}
              detail="La facture porte le RIB de l’organisme, sans aucune mention d’affacturage."
              onChoisir={() => choisirReglement(true)}
            />
          </div>
          {reglement === 'mixte' && (
            <p className="text-xs text-surface-500">
              Les factures de ce dossier n’ont pas toutes le même règlement. Choisissez-en un pour les aligner, ou réglez-les une à une ci-dessous.
              {resteAFacturer && ` Tant qu’elles diffèrent, une facture créée va à ${affacturage.societe}.`}
            </p>
          )}
          {duDossier === 'aucun' && resteAFacturer && (
            <p className={cn('text-xs', choixPremiere === null ? 'text-warning-700' : 'text-surface-500')}>
              {choixPremiere === null
                ? 'À choisir avant de générer les factures.'
                : 'Ce règlement sera porté par les factures à leur génération. Il se change ensuite ici.'}
            </p>
          )}
          {nbCedees > 0 && (
            <p className="text-xs text-surface-500">
              {nbCedees} facture{nbCedees > 1 ? 's' : ''} déjà cédée{nbCedees > 1 ? 's' : ''} au factor : {nbCedees > 1 ? 'elles ne changent' : 'elle ne change'} pas.
            </p>
          )}
          {(reglement === 'direct' || reglement === 'mixte') && !affacturage.ribOrganisme && (
            <p className="text-xs text-warning-700 bg-warning-50 border border-warning-100 rounded-xl px-3 py-2">
              Le RIB de l’organisme n’est pas renseigné dans les paramètres : la facture sortirait sans coordonnées bancaires.
            </p>
          )}
        </fieldset>
      )}

      {!sessionTerminee ? (
        <div className="flex items-center gap-2 rounded-xl bg-surface-50 border border-surface-200/70 px-4 py-3 text-sm text-surface-500">
          <Clock className="h-4 w-4 shrink-0" />
          <span>Les factures pourront être générées une fois la <strong className="text-surface-700">session terminée</strong>.</span>
        </div>
      ) : candidats.length === 0 ? (
        <div className="text-sm text-surface-500">Aucun candidat.</div>
      ) : (
        <div className="rounded-xl border border-surface-200 divide-y divide-surface-100 overflow-hidden">
          {candidats.map((c) => {
            const nom = `${c.apprenant?.prenom || ''} ${c.apprenant?.nom || ''}`.trim() || 'Candidat'
            const fac = facturesByCandidat[c.id]
            const st = fac ? (FACT_STATUS[fac.status] || FACT_STATUS.brouillon) : null
            const ligne = lignes.get(c.id)!
            const prevues = heuresPrevues(c, projet)
            // Une facture existante qui ne vaut plus les heures réalisées
            const ecart = !!fac && aTaux && fac.status !== 'annulee' && fac.montant_ttc != null
              && Math.abs(Number(fac.montant_ttc) - ligne.montantHt) > 0.005
            return (
              <div key={c.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-surface-900 truncate">{nom}</div>
                  {fac && (
                    <div className="text-xs text-surface-500 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${st!.cls}`}>{st!.label}</span>
                      {fac.numero && <span>{fac.numero}</span>}
                      {fac.montant_ttc != null && <span className="tabular-nums">{Number(fac.montant_ttc).toLocaleString('fr-FR')} €</span>}
                      {affacturage?.actif && (fac.affacturage_status ? (
                        <span className="rounded-md bg-surface-100 text-surface-600 px-1.5 py-0.5 text-[11px] font-semibold">Cédée au factor</span>
                      ) : (
                        <>
                          {fac.sans_affacturage && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-info-50 text-info-600 px-1.5 py-0.5 text-[11px] font-semibold">
                              <Landmark className="h-3 w-3" /> Sans affacturage
                            </span>
                          )}
                          <button type="button" onClick={() => basculerFacture(c.id, !fac.sans_affacturage)}
                            disabled={occupe} aria-busy={bascule === c.id}
                            className="inline-flex items-center gap-1 min-h-[40px] sm:min-h-0 text-brand-600 hover:text-brand-700 font-medium hover:underline disabled:opacity-50">
                            {bascule === c.id && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                            {fac.sans_affacturage ? 'Remettre à l’affacturage' : 'Passer sans affacturage'}
                          </button>
                        </>
                      ))}
                    </div>
                  )}
                  {aTaux && (!fac || ecart) && (
                    <div className={`text-xs mt-0.5 ${ecart ? 'text-warning-700' : 'text-surface-500'}`}>
                      {ecart ? 'Heures réalisées : ' : 'À facturer : '}
                      <span className="tabular-nums">
                        {heuresFr(ligne.heures)}{ligne.partielle && prevues ? ` sur ${heuresFr(prevues)}` : ''} · {eurosFr(ligne.montantHt)}
                      </span>
                      {ecart && (fac!.status === 'brouillon' ? ' — mettez les factures à jour' : ' — facture déjà émise, prévoir un avoir')}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto">
                  <EngagementCandidat
                    candidatId={c.id}
                    valeur={c.numero_engagement || ''}
                    verrouille={!!fac && fac.status !== 'brouillon'}
                  />
                  {fac ? (
                    <a href={`/api/pdf/facture/${fac.id}`} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-2.5 py-1.5 min-h-[40px] sm:min-h-0 text-xs font-medium text-surface-700 hover:bg-surface-50 shrink-0 whitespace-nowrap">
                      <FileText className="h-3.5 w-3.5" /> Facture
                    </a>
                  ) : (
                    <span className="text-xs text-surface-300 px-2.5 shrink-0 whitespace-nowrap">Pas de facture</span>
                  )}
                </div>
              </div>
            )
          })}
          {aTaux && (
            <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-surface-50 text-sm">
              <span className="text-surface-600">Total à facturer, sur les heures réalisées</span>
              <span className="font-semibold text-surface-900 tabular-nums">{eurosFr(totalAFacturer)}</span>
            </div>
          )}
        </div>
      )}
      </div>
    </PoeiSection>
  )
}
