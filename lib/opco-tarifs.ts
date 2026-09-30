/**
 * Barèmes de prise en charge OPCO par branche — la source des tarifs publics.
 *
 * Les formations Lab Learning sont calées sur les montants de prise en charge
 * des OPCO : le prix affiché EST le barème de la branche, pas un tarif
 * catalogue arbitraire. Reprend la configuration du simulateur budget
 * (grilles AKTO et OPCO EP 2026) sous une forme utilisable côté serveur.
 *
 * Les clés suivent formations.branches ; une formation transverse ou sans
 * branche reste « sur devis » — lui inventer un barème serait faux.
 */

export interface BaremeBranche {
  label: string
  opco: 'AKTO' | 'OPCO EP'
  /** Tarif horaire par stagiaire, quand la branche fonctionne ainsi. */
  tauxHoraire?: number
  /** Forfait journalier par groupe, quand la branche fonctionne ainsi. */
  forfaitJour?: number
  /** Fourchette horaire pour les branches à taux par catégorie de formation. */
  tauxHoraireMin?: number
  tauxHoraireMax?: number
}

export const BAREMES_BRANCHES: Record<string, BaremeBranche> = {
  'restauration-rapide': {
    label: 'Restauration rapide', opco: 'AKTO', tauxHoraire: 25,
  },
  'restaurant-hcr': {
    label: 'Hôtellerie-restauration (HCR)', opco: 'AKTO', forfaitJour: 1000,
  },
  'boucherie-charcuterie': {
    label: 'Boucherie-charcuterie', opco: 'OPCO EP', tauxHoraireMin: 20, tauxHoraireMax: 60,
  },
  'boulangerie-patisserie': {
    label: 'Boulangerie-pâtisserie', opco: 'OPCO EP', tauxHoraireMin: 25, tauxHoraireMax: 50,
  },
}

export interface LigneTarif {
  branche: string
  opco: string
  montant: string
  detail: string
}

const euros = (n: number) => `${n.toLocaleString('fr-FR')} € HT`

/**
 * Les lignes de tarif d'une formation, une par branche desservie.
 *
 * Le montant est celui que l'OPCO prend en charge pour la durée de la
 * formation ; c'est l'argument commercial central — le reste à charge de
 * l'établissement est nul ou marginal.
 */
export function tarifsOpcoPourFormation(f: {
  branches?: string[] | null
  duree_heures?: number | null
  duree_jours?: number | null
}): LigneTarif[] {
  const heures = Number(f.duree_heures || 0)
  const jours = Number(f.duree_jours || 0) || (heures ? Math.ceil(heures / 7) : 0)
  const lignes: LigneTarif[] = []

  for (const cle of f.branches || []) {
    const b = BAREMES_BRANCHES[cle]
    if (!b) continue

    if (b.tauxHoraire && heures) {
      lignes.push({
        branche: b.label, opco: b.opco,
        montant: `${euros(b.tauxHoraire * heures)} / stagiaire`,
        detail: `${b.tauxHoraire} €/h · barème ${b.opco}`,
      })
    } else if (b.forfaitJour && jours) {
      lignes.push({
        branche: b.label, opco: b.opco,
        montant: `${euros(b.forfaitJour * jours)} / groupe`,
        detail: `forfait ${b.forfaitJour.toLocaleString('fr-FR')} €/jour · barème ${b.opco}`,
      })
    } else if (b.tauxHoraireMin && b.tauxHoraireMax && heures) {
      lignes.push({
        branche: b.label, opco: b.opco,
        montant: `${euros(b.tauxHoraireMin * heures)} à ${euros(b.tauxHoraireMax * heures)} / stagiaire`,
        detail: `${b.tauxHoraireMin} à ${b.tauxHoraireMax} €/h selon le thème · barème ${b.opco}`,
      })
    }
  }
  return lignes
}
