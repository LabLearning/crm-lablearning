/**
 * Sérialise des données structurées pour une balise <script type="application/ld+json">.
 * Le chevron ouvrant est échappé : un intitulé venu de la base ne peut pas refermer la balise.
 */
export const jsonLd = (valeur: unknown) => JSON.stringify(valeur).replace(/</g, '\\u003c')
