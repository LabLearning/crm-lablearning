'use client'

import { AlertTriangle, FileDown, Info } from '@/components/ui/icons'
import { Button, Modal } from '@/components/ui'
import type { CategorieSensible, MentionSensible } from '@/lib/rapport-france-travail'

/** Un point à relire avant qu'un rapport parte chez France Travail. */
export type PointRelecture =
  | { genre: 'sensible'; mentions: MentionSensible[] }
  | { genre: 'manque'; texte: string }

const AVIS: Record<CategorieSensible, { sujet: string; conseil: string }> = {
  'santé': {
    sujet: 'la santé de la personne',
    conseil: 'France Travail n’a pas à en connaître le détail : « pour raisons de santé » suffit.',
  },
  justice: {
    sujet: 'une affaire de police ou de justice',
    conseil: 'Ne la mentionnez que si les faits ne se comprennent pas sans elle.',
  },
  convictions: {
    sujet: 'les convictions, l’engagement syndical ou l’orientation sexuelle de la personne',
    conseil: 'Ce n’est pas une information à transmettre à France Travail.',
  },
  'vie privée': {
    sujet: 'la vie privée ou les origines de la personne',
    conseil: 'Ne le mentionnez que si les faits ne se comprennent pas sans cela ; pour un départ, « pour raisons personnelles » suffit.',
  },
}

/**
 * Signale ce qu'un texte libre dit de trop pour un tiers : santé, justice,
 * convictions, vie privée. C'est une aide à la relecture : elle ne lit pas à la
 * place du gestionnaire, qui garde la décision.
 */
export function AvisMentionsSensibles({ mentions }: { mentions: MentionSensible[] }) {
  if (!mentions.length) return null
  const categories = [...new Set(mentions.map((m) => m.categorie))]
  return (
    <div className="rounded-xl border border-warning-100 bg-warning-50 px-3.5 py-3 text-sm text-warning-700" role="alert">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <div className="space-y-1.5 min-w-0">
          {categories.map((categorie) => {
            const termes = mentions.filter((m) => m.categorie === categorie).map((m) => `« ${m.terme} »`).join(', ')
            return (
              <p key={categorie}>
                Le texte évoque {AVIS[categorie].sujet} ({termes}). {AVIS[categorie].conseil}
              </p>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * Dernière relecture avant le téléchargement d'un rapport : ce qui manque au
 * dossier et ce que le texte dit de trop. Rien n'est bloqué, le gestionnaire
 * corrige ou télécharge en connaissance de cause.
 */
export function RelectureAvantEnvoi({
  ouvert, titre, points, libelleCorriger, onCorriger, onTelecharger, onFermer, occupe = false,
}: {
  ouvert: boolean
  titre: string
  points: PointRelecture[]
  libelleCorriger: string
  onCorriger: () => void
  onTelecharger: () => void
  onFermer: () => void
  /** Un tirage est déjà en cours : le bouton attend, plutôt que de fermer la fenêtre sans rien tirer */
  occupe?: boolean
}) {
  const sensibles = points.flatMap((p) => (p.genre === 'sensible' ? p.mentions : []))
  const manques = points.flatMap((p) => (p.genre === 'manque' ? [p.texte] : []))
  return (
    <Modal isOpen={ouvert} onClose={onFermer} title={titre} size="md"
      description="Ce document part chez France Travail : il reprend le texte tel qu’il est saisi.">
      <div className="space-y-3">
        <AvisMentionsSensibles mentions={sensibles} />
        {manques.length > 0 && (
          <ul className="space-y-2">
            {manques.map((texte) => (
              <li key={texte} className="flex items-start gap-2.5 text-sm text-surface-700">
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-surface-400" />
                <span>{texte}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onCorriger}>{libelleCorriger}</Button>
          <Button type="button" onClick={onTelecharger} disabled={occupe} icon={<FileDown className="h-4 w-4" />}>
            {sensibles.length ? 'Télécharger quand même' : 'Télécharger le rapport'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
