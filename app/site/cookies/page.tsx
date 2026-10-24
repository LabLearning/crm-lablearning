import { LegalPage } from '../LegalPage'
import { GererCookies } from './GererCookies'

export const metadata = {
  title: 'Politique de gestion des cookies',
  description: 'Les cookies utilisés par le site Lab Learning et comment gérer votre consentement.',
  alternates: { canonical: '/cookies' },
}

export default function Cookies() {
  return (
    <LegalPage title="Politique de gestion des cookies" updated="octobre 2026">
      <p>
        Un cookie est un petit fichier déposé sur votre terminal lors de la visite d’un site. Cette politique explique
        quels cookies nous utilisons et comment les gérer.
      </p>

      <h2>Cookies utilisés</h2>
      <ul>
        <li><strong>Cookies strictement nécessaires</strong> : indispensables au fonctionnement du site (navigation,
          sécurité). Ils ne requièrent pas votre consentement.</li>
        <li><strong>Cookies de mesure d’audience</strong>, déposés <strong>seulement si vous les acceptez</strong> :
          Google Analytics (Google Ireland Limited) mesure les pages vues, la durée des visites, le type d’appareil et
          la ville approximative, pour savoir quelles pages vous sont utiles. Cookies <code>_ga</code> (distingue les
          visiteurs) et <code>_ga_LJ1SBNWZJV</code> (suit la visite en cours), conservés 13 mois au plus. Google
          Analytics ne garde pas votre adresse IP. Aucune donnée n’est utilisée pour de la publicité. Les données
          peuvent être traitées aux États-Unis par Google LLC, certifiée au cadre de protection des données entre
          l’Union européenne et les États-Unis.</li>
        <li><strong>Aucun cookie publicitaire</strong> n’est déposé par ce site. Avec votre accord seulement, si vous
          arrivez par une publicité ou par un lien suivi (publication, lettre d’information), les paramètres présents
          dans l’adresse de la page (source, campagne, identifiant de clic Google ou Meta) sont joints à votre demande
          si vous remplissez un formulaire pendant cette visite, pour savoir ce qui vous a amené. Ils ne sont
          enregistrés sur votre appareil ni par un cookie ni autrement.</li>
      </ul>

      <h2>Consentement</h2>
      <p>
        Lors de votre première visite, un bandeau vous permet d’accepter ou de refuser, ensemble ou séparément (bouton
        « Choisir »), la mesure d’audience et la prise en compte de la publicité qui vous a amené. Refuser est aussi
        simple qu’accepter, et le site fonctionne de la même façon. Votre choix est mémorisé sur votre appareil pendant
        six mois, puis vous est redemandé. Vous pouvez le modifier ou le retirer à tout moment ; si vous retirez votre
        accord à la mesure d’audience, elle s’arrête et ses cookies sont effacés :
      </p>
      <p><GererCookies /></p>

      <h2>Gérer les cookies</h2>
      <p>
        Vous pouvez configurer votre navigateur pour bloquer ou supprimer les cookies. Le blocage de certains cookies
        peut toutefois affecter votre expérience de navigation. La procédure varie selon le navigateur (Chrome, Firefox,
        Safari, Edge) : consultez la rubrique d’aide de votre navigateur.
      </p>

      <h2>En savoir plus</h2>
      <p>
        Pour toute question relative aux cookies ou à vos données : <a href="mailto:dpo@lab-learning.fr">dpo@lab-learning.fr</a>.
        Voir aussi notre <a href="/confidentialite">politique de confidentialité</a>.
      </p>
    </LegalPage>
  )
}
