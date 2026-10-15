'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Plus, CheckCircle2, Clock, ShieldAlert, FileDown, Pencil } from '@/components/ui/icons'
import { Button, Modal, Input, Select, useToast } from '@/components/ui'
import { cn, formatDate } from '@/lib/utils'
import { declarerIncidentPoeiAction, changerStatutIncidentPoeiAction, modifierIncidentPoeiAction } from '@/app/dashboard/poei/incident-actions'
import { GRAVITES_INCIDENT, STATUTS_INCIDENT, TYPES_INCIDENT, mentionsSensibles } from '@/lib/rapport-france-travail'
import { telechargerFichier } from '@/lib/telecharger'
import { RelectureAvantEnvoi, type PointRelecture } from './RelectureAvantEnvoi'

export interface IncidentPoei {
  id: string
  date_incident: string
  type: string
  gravite: string
  titre: string
  description: string | null
  mesures_prises: string | null
  statut: string
  apprenant_id: string | null
  formateur_id: string | null
  created_at: string
}

// Libellés partagés avec le rapport PDF (lib/rapport-france-travail) ; seules les couleurs sont d'ici
const TYPES = TYPES_INCIDENT

const CLASSES_GRAVITE: Record<string, string> = {
  mineur: 'bg-surface-100 text-surface-600',
  modere: 'bg-warning-50 text-warning-700',
  majeur: 'bg-danger-50 text-danger-700',
  critique: 'bg-danger-100 text-danger-700',
}
const GRAVITES = GRAVITES_INCIDENT.map((g) => ({ ...g, classe: CLASSES_GRAVITE[g.value] || CLASSES_GRAVITE.mineur }))

const CLASSES_STATUT: Record<string, string> = {
  ouvert: 'bg-danger-50 text-danger-700',
  en_cours: 'bg-warning-50 text-warning-700',
  resolu: 'bg-success-50 text-success-700',
  clos: 'bg-surface-100 text-surface-500',
}
const STATUTS: Record<string, { label: string; classe: string }> = Object.fromEntries(
  Object.entries(STATUTS_INCIDENT).map(([valeur, label]) => [valeur, { label, classe: CLASSES_STATUT[valeur] || CLASSES_STATUT.ouvert }]),
)

/**
 * Incidents d'un dossier POEI. Le formateur déclare depuis son espace, le
 * gestionnaire traite depuis la fiche : c'est le même composant des deux
 * côtés, seul `peutTraiter` change. Le gestionnaire peut aussi corriger un
 * incident et en tirer le rapport transmis à France Travail.
 */
export function PoeiIncidents({
  poeiId, incidents, candidats, peutTraiter, agenceRenseignee = true,
}: {
  poeiId: string
  incidents: IncidentPoei[]
  candidats: { id: string; nom: string }[]
  /** L'équipe interne fait avancer le statut, corrige et produit le rapport ; le formateur déclare seulement. */
  peutTraiter: boolean
  /** L'agence France Travail du dossier est choisie : sans elle, le rapport sort sans destinataire nommé */
  agenceRenseignee?: boolean
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  // Rapport en cours de tirage : un seul à la fois, sans lien avec les changements de statut
  const [tirage, setTirage] = useState<string | null>(null)
  // Incident en cours de correction (même formulaire que la déclaration)
  const [edition, setEdition] = useState<IncidentPoei | null>(null)
  // Incident dont le rapport demande une relecture avant de partir : relu dans la liste du moment, pas dans une copie
  const [aRelireId, setARelireId] = useState<string | null>(null)
  const aRelire = incidents.find((i) => i.id === aRelireId) || null

  const ouverts = incidents.filter((i) => ['ouvert', 'en_cours'].includes(i.statut)).length

  async function declarer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    const donnees = new FormData(e.currentTarget)
    try {
      const r = edition
        ? await modifierIncidentPoeiAction(edition.id, donnees)
        : await declarerIncidentPoeiAction(poeiId, donnees)
      if (!r.success) { toast('error', r.error || 'Erreur'); return }
      const inchange = !!edition && !!(r as any).data?.inchange
      toast('success', inchange ? 'Aucune modification à enregistrer' : edition ? 'Incident modifié' : 'Incident déclaré')
      fermerFormulaire()
      if (!inchange) router.refresh()
    } catch {
      // Coupure de réseau : le texte saisi reste dans le formulaire, on peut recommencer
      toast('error', 'Enregistrement impossible : vérifiez votre connexion')
    } finally {
      setSaving(false)
    }
  }

  function fermerFormulaire() { setOpen(false); setEdition(null) }
  function modifier(i: IncidentPoei) { setARelireId(null); setEdition(i); setOpen(true) }

  /** Ce qu'il vaut mieux relire avant d'envoyer le rapport de cet incident à France Travail. */
  function pointsARelire(i: IncidentPoei): PointRelecture[] {
    const points: PointRelecture[] = []
    const sensibles = mentionsSensibles(i.titre, i.description, i.mesures_prises)
    if (sensibles.length) points.push({ genre: 'sensible', mentions: sensibles })
    // Dates au format AAAA-MM-JJ, à l'heure de Paris
    const jour = i.date_incident?.slice(0, 10) || ''
    if (jour && jour > new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' })) {
      points.push({ genre: 'manque', texte: 'L’incident est daté d’un jour à venir : vérifiez la date avant l’envoi.' })
    } else if (jour && i.created_at && jour > new Date(i.created_at).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' })) {
      points.push({ genre: 'manque', texte: 'L’incident est daté d’après sa déclaration : vérifiez la date avant l’envoi.' })
    }
    if (!i.description?.trim()) points.push({ genre: 'manque', texte: 'Aucune description des faits n’est saisie : le rapport sortira sans cette rubrique.' })
    if (!i.mesures_prises?.trim()) points.push({ genre: 'manque', texte: 'Aucune mesure prise n’est consignée : le rapport sortira sans cette rubrique.' })
    if (!agenceRenseignee) points.push({ genre: 'manque', texte: 'L’agence France Travail du dossier n’est pas choisie (onglet Facturation) : le rapport sortira sans destinataire nommé.' })
    return points
  }

  async function telecharger(i: IncidentPoei) {
    if (tirage) return
    setTirage(i.id)
    try {
      const t = await telechargerFichier(`/api/pdf/rapport-incident/${i.id}`)
      if (t.ok) toast('success', 'Rapport téléchargé')
      else toast('error', t.erreur)
    } catch {
      toast('error', 'Téléchargement impossible : vérifiez votre connexion')
    } finally {
      setTirage(null)
    }
  }
  function rapport(i: IncidentPoei) {
    if (pointsARelire(i).length) setARelireId(i.id)
    else telecharger(i)
  }

  async function changer(id: string, statut: string) {
    if (busy) return
    setBusy(id)
    try {
      const r = await changerStatutIncidentPoeiAction(id, statut)
      if (r.success) { toast('success', 'Incident mis à jour'); router.refresh() }
      else toast('error', r.error || 'Erreur')
    } catch {
      toast('error', 'Mise à jour impossible : vérifiez votre connexion')
    } finally {
      setBusy(null)
    }
  }

  const nomCandidat = (id: string | null) => candidats.find((c) => c.id === id)?.nom || null

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-heading font-semibold text-surface-900 flex items-center gap-2">
            <ShieldAlert className="h-[18px] w-[18px] text-brand-500" />
            Incidents{incidents.length > 0 ? ` (${incidents.length})` : ''}
          </h2>
          <p className="text-sm text-surface-500 mt-0.5">
            Comportement, absence, accident, matériel — tout ce qui doit être tracé et suivi.
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} icon={<Plus className="h-4 w-4" />}>Déclarer un incident</Button>
      </div>

      {ouverts > 0 && (
        <div className="card p-3.5 border-danger-500/30 bg-danger-50/40 flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 text-danger-600 shrink-0" />
          <span className="text-sm text-surface-800">
            {ouverts} incident{ouverts > 1 ? 's' : ''} en attente de traitement
          </span>
        </div>
      )}

      {incidents.length === 0 ? (
        <div className="card p-10 text-center">
          <ShieldAlert className="h-9 w-9 text-surface-300 mx-auto mb-3" />
          <p className="text-sm text-surface-500">Aucun incident déclaré sur ce dossier.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {incidents.map((i) => {
            const g = GRAVITES.find((x) => x.value === i.gravite) || GRAVITES[0]
            const st = STATUTS[i.statut] || STATUTS.ouvert
            const qui = nomCandidat(i.apprenant_id)
            return (
              <div key={i.id} className={cn('card p-4', ['ouvert', 'en_cours'].includes(i.statut) && 'border-danger-500/30')}>
                {/* Le texte garde au moins 18rem : en dessous, les boutons passent à la ligne et se replient */}
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="min-w-[min(100%,18rem)] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-heading font-semibold text-surface-900">{i.titre}</span>
                      <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', g.classe)}>{g.label}</span>
                      <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', st.classe)}>{st.label}</span>
                    </div>
                    <div className="text-xs text-surface-500 mt-1">
                      {formatDate(i.date_incident)}
                      {' · '}{TYPES.find((t) => t.value === i.type)?.label || i.type}
                      {qui ? ` · ${qui}` : ''}
                    </div>
                    {i.description && <p className="text-sm text-surface-700 mt-2 whitespace-pre-line">{i.description}</p>}
                    {i.mesures_prises && (
                      <p className="text-sm text-surface-600 mt-2 whitespace-pre-line">
                        <span className="font-medium">Mesures prises : </span>{i.mesures_prises}
                      </p>
                    )}
                  </div>

                  {peutTraiter && (
                    <div className="flex flex-wrap items-center gap-1.5 max-w-full">
                      <button onClick={() => rapport(i)} disabled={!!tirage}
                        className="btn-secondary inline-flex items-center gap-1.5 !py-1.5 !px-3 text-xs disabled:opacity-50">
                        <FileDown className="h-3.5 w-3.5" /> {tirage === i.id ? 'Préparation…' : 'Rapport France Travail'}
                      </button>
                      <button onClick={() => modifier(i)}
                        className="btn-secondary inline-flex items-center gap-1.5 !py-1.5 !px-3 text-xs">
                        <Pencil className="h-3.5 w-3.5" /> Modifier
                      </button>
                      {i.statut === 'ouvert' && (
                        <button onClick={() => changer(i.id, 'en_cours')} disabled={busy === i.id}
                          className="btn-secondary inline-flex items-center gap-1.5 !py-1.5 !px-3 text-xs disabled:opacity-50">
                          <Clock className="h-3.5 w-3.5" /> Prendre en charge
                        </button>
                      )}
                      {i.statut !== 'clos' && i.statut !== 'resolu' && (
                        <button onClick={() => changer(i.id, 'resolu')} disabled={busy === i.id}
                          className="btn-secondary inline-flex items-center gap-1.5 !py-1.5 !px-3 text-xs disabled:opacity-50">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Résolu
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal isOpen={open} onClose={fermerFormulaire} title={edition ? 'Modifier l’incident' : 'Déclarer un incident'} size="lg"
        description={edition ? 'Ce texte est repris tel quel dans le rapport transmis à France Travail.' : undefined}>
        {/* La clé remonte le formulaire : ses valeurs initiales sont celles de l'incident ouvert */}
        <form key={edition?.id || 'nouveau'} onSubmit={declarer} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input id="titre" name="titre" label="Titre *" placeholder="Ex. Absence non justifiée répétée" required defaultValue={edition?.titre || ''} />
            <Input id="date_incident" name="date_incident" type="date" label="Date de l'incident"
              defaultValue={edition?.date_incident?.slice(0, 10) || new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })} />
            <Select id="type" name="type" label="Type" options={TYPES} defaultValue={edition?.type || 'comportement'} />
            <Select id="gravite" name="gravite" label="Gravité" options={GRAVITES.map((g) => ({ value: g.value, label: g.label }))} defaultValue={edition?.gravite || 'mineur'} />
            <Select
              id="apprenant_id"
              name="apprenant_id"
              label="Candidat concerné"
              options={[
                { value: '', label: '— Aucun en particulier —' },
                ...candidats.map((c) => ({ value: c.id, label: c.nom })),
                // Stagiaire retiré du projet depuis : sans cette option, enregistrer détacherait l'incident de lui
                ...(edition?.apprenant_id && !candidats.some((c) => c.id === edition.apprenant_id)
                  ? [{ value: edition.apprenant_id, label: 'Stagiaire retiré du dossier' }]
                  : []),
              ]}
              defaultValue={edition?.apprenant_id || ''}
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-surface-700 mb-1.5">Ce qui s&apos;est passé</label>
            <textarea id="description" name="description" rows={edition ? 8 : 4} className="input-base w-full resize-y"
              defaultValue={edition?.description || ''}
              placeholder="Décrivez les faits, sans interprétation : ce qui a été observé, quand, avec qui." />
            <p className="text-xs text-surface-500 mt-1.5">
              Ce texte peut être transmis à France Travail. Pas de détail médical : « pour raisons de santé » suffit.
            </p>
          </div>
          <div>
            <label htmlFor="mesures_prises" className="block text-sm font-medium text-surface-700 mb-1.5">{edition ? 'Mesures prises' : 'Mesures déjà prises'}</label>
            <textarea id="mesures_prises" name="mesures_prises" rows={edition ? 4 : 2} className="input-base w-full resize-y"
              defaultValue={edition?.mesures_prises || ''}
              placeholder={edition ? 'Ce qui a été fait : échange avec le stagiaire, l’employeur, le conseiller France Travail…' : 'Ce que vous avez fait sur le moment.'} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={fermerFormulaire}>Annuler</Button>
            <Button type="submit" isLoading={saving} icon={edition ? <Pencil className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}>
              {edition ? 'Enregistrer' : 'Déclarer'}
            </Button>
          </div>
        </form>
      </Modal>

      <RelectureAvantEnvoi
        ouvert={!!aRelire}
        titre="Avant d’envoyer ce rapport"
        points={aRelire ? pointsARelire(aRelire) : []}
        libelleCorriger="Modifier l’incident"
        occupe={!!tirage}
        onCorriger={() => aRelire && modifier(aRelire)}
        onTelecharger={() => { if (!aRelire || tirage) return; telecharger(aRelire); setARelireId(null) }}
        onFermer={() => setARelireId(null)}
      />
    </div>
  )
}
