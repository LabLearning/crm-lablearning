import type { Article, CategorieArticle } from './types'
import a01 from './contenu/chaine-du-froid-restauration-rapide-erreurs.json'
import a02 from './contenu/temperatures-conservation-aliments-cuisine.json'
import a03 from './contenu/plan-nettoyage-desinfection-cuisine.json'
import a04 from './contenu/hygiene-des-mains-cuisine.json'
import a05 from './contenu/pms-explique-equipier.json'
import a06 from './contenu/releves-temperature-bonnes-pratiques.json'
import a07 from './contenu/allergenes-former-equipe-salle.json'
import a08 from './contenu/vente-a-emporter-livraison-hygiene.json'
import a09 from './contenu/huile-de-friture-controle-renouvellement.json'
import a10 from './contenu/sandwicherie-snacking-hygiene.json'
import a11 from './contenu/gaspillage-alimentaire-restaurant.json'
import a12 from './contenu/chaleur-ete-cuisine-hygiene.json'
import a13 from './contenu/hygiene-boucherie-comptoir-laboratoire.json'
import a14 from './contenu/allergenes-boulangerie-patisserie-vitrine.json'
import a15 from './contenu/origine-viande-restaurant-affichage.json'
import a16 from './contenu/buches-patisseries-fetes-chaine-du-froid.json'
import a17 from './contenu/galette-des-rois-allergenes-conservation.json'
import a18 from './contenu/boucherie-hachage-risque-microbien.json'
import a19 from './contenu/plan-de-developpement-des-competences-restaurant.json'
import a20 from './contenu/agefice-formation-dirigeant-non-salarie.json'
import a21 from './contenu/qualiopi-certification-formation-salaries.json'
import a22 from './contenu/formation-presentiel-ou-en-ligne-restauration.json'
import a23 from './contenu/demande-prise-en-charge-akto-etapes.json'
import a24 from './contenu/choisir-organisme-formation-restaurant.json'
import a25 from './contenu/alim-confiance-niveau-hygiene-restaurant.json'
import a26 from './contenu/prevenir-accidents-cuisine-coupures-brulures.json'
import a27 from './contenu/permis-exploitation-restaurant.json'
import a28 from './contenu/formation-securite-nouveaux-salaries.json'
import a29 from './contenu/gestes-postures-cuisine-mal-de-dos.json'
import a30 from './contenu/farine-asthme-boulanger-prevention.json'
import a31 from './contenu/integrer-nouvel-equipier-restauration-rapide.json'
import a32 from './contenu/pics-activite-fetes-fin-annee-equipe.json'
import a33 from './contenu/manager-restauration-rapide-competences.json'
import a34 from './contenu/accueil-client-service-en-salle.json'
import a35 from './contenu/ouvrir-franchise-former-equipe-avant-ouverture.json'
import a36 from './contenu/entretien-professionnel-salaries-restaurant.json'

export type { Article, CategorieArticle } from './types'

/** Tous les articles écrits, parus ou en attente de leur date, du plus récent au plus ancien. */
export const ARTICLES: Article[] = ([
  a01, a02, a03, a04, a05, a06, a07, a08, a09, a10, a11, a12,
  a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24,
  a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36,
] as unknown as Article[]).sort((x, y) => y.publieLe.localeCompare(x.publieLe) || x.titre.localeCompare(y.titre, 'fr'))

export const CATEGORIES_ARTICLES: CategorieArticle[] = [
  'Hygiène alimentaire', 'Restauration rapide', 'Métiers de bouche', 'Réglementation',
  'Sécurité au travail', 'Financement', 'Formation', 'Équipe et management',
]

/** Le jour qu'il est à Paris, au format AAAA-MM-JJ : un article paraît à minuit, heure de Paris. */
export function jourParis(maintenant = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(maintenant)
}

export const estParu = (a: Article, jour = jourParis()) => a.publieLe <= jour
/** Les articles parus, du plus récent au plus ancien. */
export const articlesParus = (jour = jourParis()) => ARTICLES.filter((a) => estParu(a, jour))
export const articleParSlug = (slug: string) => ARTICLES.find((a) => a.slug === slug) || null
/** Jour de la prochaine parution, ou null quand la file est vide. */
export const prochaineParution = (jour = jourParis()) =>
  ARTICLES.map((a) => a.publieLe).filter((d) => d > jour).sort()[0] || null

/** Identifiant d'adresse d'une catégorie : « Équipe et management » → « equipe-et-management ». */
export const slugCategorie = (c: string) =>
  c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
