'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileDown, Info } from '@/components/ui/icons'
import { Button, Modal, useToast } from '@/components/ui'
import { AvisMentionsSensibles } from '@/components/poei/RelectureAvantEnvoi'
import { libelleTypeIncident, mentionsSensibles } from '@/lib/rapport-france-travail'
import { telechargerFichier } from '@/lib/telecharger'
import { formatDate } from '@/lib/utils'
import { enregistrerMotifAbandonAction } from '../actions'

export interface IncidentDuCandidat {
  id: string
  date_incident: string
  type: string
  titre: string
  description: string | null
  mesures_prises: string | null
  apprenant_id: string | null
}

// Un texte venu d'un formulaire est enregistré avec des retours chariot, que la zone de saisie ne rend pas :
// sans cette mise à plat, le texte paraîtrait modifié dès la première frappe, même remis à l'identique.
const aPlat = (texte: string | null | undefined) => (texte || '').replace(/\r\n?/g, '\n')

export interface AbandonARapporter {
  /** poei_candidats.id */
  id: string
  nom: string
  apprenantId: string | null
  dateAbandon: string | null
  heuresEffectuees: number | null
  motif: string | null
  /** Le stagiaire a déjà signé son bilan de fin de formation, qui imprime ce motif en direct */
  bilanSigne?: boolean
}

/**
 * Préparation du rapport d'abandon transmis à France Travail : le gestionnaire
 * relit le motif (repris tel quel), choisit les incidents à joindre, puis
 * télécharge. Aucun incident n'est joint d'office : leur description est celle
 * du formateur, écrite pour l'équipe et non pour un tiers.
 */
export function PoeiRapportAbandon({
  abandon, incidents, agenceRenseignee, onFermer, peutCorrigerIncidents = true,
}: {
  abandon: AbandonARapporter | null
  /** Incidents du dossier ; seuls ceux de ce stagiaire sont proposés */
  incidents: IncidentDuCandidat[]
  agenceRenseignee: boolean
  onFermer: () => void
  /** Le compte peut corriger un incident (onglet Incidents) ; sinon la consigne renvoie au gestionnaire du dossier */
  peutCorrigerIncidents?: boolean
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [motif, setMotif] = useState('')
  // Dernier motif enregistré au dossier : c'est lui que le PDF imprime tant qu'on n'enregistre pas de nouveau
  const [enregistre, setEnregistre] = useState('')
  const [joints, setJoints] = useState<string[]>([])
  const [occupe, setOccupe] = useState(false)

  // Un autre candidat : on repart de son motif, sans incident coché
  useEffect(() => {
    setMotif(aPlat(abandon?.motif))
    setEnregistre(aPlat(abandon?.motif))
    setJoints([])
  }, [abandon?.id, abandon?.motif])

  if (!abandon) return null

  const siens = incidents.filter((i) => i.apprenant_id && i.apprenant_id === abandon.apprenantId)
  const choisis = siens.filter((i) => joints.includes(i.id))
  const sensibles = mentionsSensibles(motif, ...choisis.flatMap((i) => [i.titre, i.description, i.mesures_prises]))
  const modifie = motif.trim() !== enregistre.trim()

  // Un texte réécrit ne se perd pas sans question ; rien ne se ferme pendant une opération
  function fermer() {
    if (occupe) return
    if (modifie && !window.confirm('Le texte modifié n’est pas enregistré. Fermer quand même ?')) return
    onFermer()
  }

  /** Enregistre le motif seul, sans tirer de rapport (et donc sans ligne de tirage au journal). */
  async function enregistrerSeul() {
    if (!abandon || occupe || !modifie) return
    setOccupe(true)
    try {
      const r = await enregistrerMotifAbandonAction(abandon.id, motif)
      if (!r.success) { toast('error', r.error || 'Enregistrement impossible'); return }
      setEnregistre(motif)
      toast('success', 'Motif enregistré')
      router.refresh()
    } catch {
      toast('error', 'Enregistrement impossible : vérifiez votre connexion')
    } finally {
      setOccupe(false)
    }
  }

  async function telecharger() {
    if (!abandon || occupe) return
    setOccupe(true)
    const aEnregistrer = modifie
    let motifEnregistre = false
    try {
      if (aEnregistrer) {
        const r = await enregistrerMotifAbandonAction(abandon.id, motif)
        if (!r.success) { toast('error', r.error || 'Enregistrement impossible'); return }
        motifEnregistre = true
        setEnregistre(motif)
        router.refresh()
      }
      const parametres = choisis.length ? `?incidents=${choisis.map((i) => i.id).join(',')}` : ''
      const t = await telechargerFichier(`/api/pdf/rapport-abandon/${abandon.id}${parametres}`)
      if (!t.ok) { toast('error', motifEnregistre ? `Motif enregistré. ${t.erreur}` : t.erreur); return }
      toast('success', motifEnregistre ? 'Motif enregistré, rapport téléchargé' : 'Rapport téléchargé')
      onFermer()
    } catch {
      // Coupure de réseau : dire laquelle des deux étapes n'a pas abouti
      toast('error', aEnregistrer && !motifEnregistre
        ? 'Enregistrement impossible : vérifiez votre connexion'
        : `${motifEnregistre ? 'Motif enregistré. ' : ''}Téléchargement impossible : vérifiez votre connexion`)
    } finally {
      setOccupe(false)
    }
  }

  return (
    <Modal isOpen onClose={fermer} size="lg" title={`Rapport d’abandon, ${abandon.nom}`}
      description="Transmis à France Travail. Le texte ci-dessous est repris tel quel : relisez-le avant de télécharger.">
      <div className="space-y-4">
        <p className="text-sm text-surface-600">
          {abandon.dateAbandon ? `Sortie le ${formatDate(abandon.dateAbandon)}` : 'Date de sortie non renseignée'}
          {abandon.heuresEffectuees != null ? ` · ${abandon.heuresEffectuees.toLocaleString('fr-FR')} h réalisées` : ''}
        </p>

        <div>
          <label htmlFor="rapport-motif" className="block text-sm font-medium text-surface-700 mb-1.5">Circonstances de l’abandon</label>
          <textarea id="rapport-motif" rows={9} className="input-base w-full resize-y" value={motif} disabled={occupe}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ce qui a conduit à la sortie, ce qui a été fait (échanges avec le stagiaire, l’employeur, le conseiller France Travail)." />
          <p className="text-xs text-surface-500 mt-1.5">
            Ce texte est aussi celui de l’attestation de sortie et du bilan de fin de formation France Travail (motif de sortie anticipée). Il est enregistré au dossier quand vous téléchargez.
          </p>
          {abandon.bilanSigne && (
            <p className="text-xs text-warning-700 mt-1">Le bilan de ce stagiaire est déjà signé : le motif y changera aussi.</p>
          )}
        </div>

        {siens.length > 0 && (
          <fieldset>
            <legend className="text-sm font-medium text-surface-700 mb-1.5">Incidents à joindre au rapport</legend>
            <div className="rounded-xl border border-surface-200 divide-y divide-surface-100">
              {siens.map((i) => (
                <div key={i.id}>
                  <label className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-surface-50">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-brand-500"
                      checked={joints.includes(i.id)}
                      onChange={(e) => setJoints((liste) => (e.target.checked ? [...liste, i.id] : liste.filter((x) => x !== i.id)))} />
                    <span className="min-w-0">
                      <span className="block text-sm text-surface-900">{i.titre}</span>
                      <span className="block text-xs text-surface-500">{formatDate(i.date_incident)} · {libelleTypeIncident(i.type)}</span>
                    </span>
                  </label>
                  {/* Ce qui partira avec le rapport, sous les yeux avant le téléchargement */}
                  {joints.includes(i.id) && (
                    <div className="mr-3 mb-3 ml-[2.375rem] rounded-lg bg-surface-50 px-3 py-2 text-sm text-surface-700 space-y-1.5">
                      {i.description?.trim()
                        ? <p className="whitespace-pre-line">{i.description}</p>
                        : <p className="text-surface-500">Aucune description n’est saisie pour cet incident.</p>}
                      {i.mesures_prises?.trim() && (
                        <p className="whitespace-pre-line"><span className="font-medium">Mesures prises : </span>{i.mesures_prises}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-surface-500 mt-1.5">
              Aucun n’est joint d’office. La description et les mesures d’un incident coché sont reprises telles quelles : relisez-les ici{peutCorrigerIncidents ? ', corrigez-les dans l’onglet Incidents (enregistrez d’abord le motif).' : ' ; s’ils sont à corriger, voyez avec le gestionnaire du dossier.'}
            </p>
          </fieldset>
        )}

        <AvisMentionsSensibles mentions={sensibles} />
        {(!motif.trim() || !agenceRenseignee) && (
          <ul className="space-y-2">
            {!motif.trim() && (
              <li className="flex items-start gap-2.5 text-sm text-surface-700">
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-surface-400" />
                <span>Sans texte, le rapport sortira sans la rubrique « Circonstances de l’abandon ».</span>
              </li>
            )}
            {!agenceRenseignee && (
              <li className="flex items-start gap-2.5 text-sm text-surface-700">
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-surface-400" />
                <span>L’agence France Travail du dossier n’est pas choisie (onglet Facturation) : le rapport sortira sans destinataire nommé.</span>
              </li>
            )}
          </ul>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={fermer} disabled={occupe}>Annuler</Button>
          {modifie && (
            <Button type="button" variant="secondary" onClick={enregistrerSeul} disabled={occupe}>Enregistrer le motif</Button>
          )}
          <Button type="button" onClick={telecharger} isLoading={occupe} icon={<FileDown className="h-4 w-4" />}>
            {modifie ? 'Enregistrer et télécharger' : sensibles.length ? 'Télécharger quand même' : 'Télécharger le rapport'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
