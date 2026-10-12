/**
 * Règlement des factures d'un dossier POEI : au factor (cession de créance) ou
 * à l'organisme en direct (factures.sans_affacturage, migration 153).
 *
 * Le choix n'est pas stocké sur le dossier : il se lit sur ses factures. Cette
 * lecture est faite ici une seule fois, pour l'écran (ce qui est coché) comme
 * pour le serveur (le règlement d'une facture créée ensuite) : les deux ne
 * peuvent pas diverger.
 */

interface FactureReglement {
  status?: string | null
  sans_affacturage?: boolean | null
  affacturage_status?: string | null
}

/** « aucun » : pas encore de facture dont le règlement puisse se lire. */
export type ReglementPoei = 'factor' | 'direct' | 'mixte' | 'aucun'

/**
 * Les factures dont le règlement peut encore changer, et qui disent donc celui
 * du dossier : ni cédées au factor (il attend son paiement), ni soldées, ni
 * annulées.
 */
export function facturesReglables<T extends FactureReglement>(factures: T[]): T[] {
  return factures.filter((f) => !f.affacturage_status && f.status !== 'payee' && f.status !== 'annulee')
}

export function reglementDossier(factures: FactureReglement[]): ReglementPoei {
  const reglables = facturesReglables(factures)
  if (reglables.length === 0) return 'aucun'
  const directes = reglables.filter((f) => !!f.sans_affacturage).length
  if (directes === reglables.length) return 'direct'
  return directes === 0 ? 'factor' : 'mixte'
}
