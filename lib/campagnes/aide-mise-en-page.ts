/**
 * Les blocs de mise en page d'un e-mail de campagne, montrés sous le champ du
 * message (le rendu est dans lib/campagnes/rendu.ts). Module sans dépendance :
 * l'écran l'importe sans embarquer l'envoi des e-mails.
 */
export const AIDE_MISE_EN_PAGE: { code: string; effet: string }[] = [
  { code: '![Description](https://…)', effet: 'image en bandeau' },
  { code: '# Titre', effet: 'grand titre' },
  { code: '## Sous-titre', effet: 'titre de partie' },
  { code: '%% 9 000 € | budget annuel', effet: 'chiffre clé (2 ou 3 à la suite, côte à côte)' },
  { code: '- Élément', effet: 'liste' },
  { code: '1. Étape', effet: 'étapes numérotées' },
  { code: '> Texte', effet: 'encadré' },
  { code: '! Texte', effet: 'alerte' },
  { code: '---', effet: 'séparateur' },
  { code: '**gras**', effet: 'gras, dans n’importe quelle ligne' },
]

