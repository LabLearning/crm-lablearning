/** Formats d'un montant de tuile : centimes (desktop) ou euro entier (mobile, pour tenir sur une ligne). */
const fmtCents = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
const fmtRond = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`

/**
 * Montant d'une tuile de synthèse : arrondi à l'euro sous `sm` (une tuile de
 * demi-largeur ne peut pas afficher « 683 240,00 € » sans casser), centimes
 * au-delà pour rester cohérent avec les lignes du tableau en dessous.
 */
export function EuroTile({ value }: { value: number }) {
  return (
    <>
      <span className="sm:hidden">{fmtRond(value)}</span>
      <span className="hidden sm:inline">{fmtCents(value)}</span>
    </>
  )
}
