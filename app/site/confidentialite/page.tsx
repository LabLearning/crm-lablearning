import { LegalPage } from '../LegalPage'

export const metadata = {
  title: 'Politique de confidentialité',
  description: 'Comment Lab Learning collecte, utilise et protège vos données personnelles, et comment exercer vos droits RGPD.',
  alternates: { canonical: '/confidentialite' },
}

export default function Confidentialite() {
  return (
    <LegalPage title="Politique de confidentialité" updated="octobre 2026">
      <p>
        Lab Learning accorde une grande importance à la protection de vos données personnelles. La présente politique
        décrit comment nous collectons, utilisons et protégeons vos données, conformément au Règlement Général sur la
        Protection des Données (RGPD) et à la loi Informatique et Libertés.
      </p>

      <h2>Responsable de traitement</h2>
      <p>
        Lab Learning, SAS, 6b boulevard Berthelot, Bureau 3, 34000 Montpellier. Contact : <a href="mailto:contact@lab-learning.fr">contact@lab-learning.fr</a>.
        Délégué à la protection des données (DPO) : <a href="mailto:dpo@lab-learning.fr">dpo@lab-learning.fr</a>.
      </p>

      <h2>Données collectées</h2>
      <p>Selon votre interaction avec nous, nous pouvons collecter :</p>
      <ul>
        <li>Identité et coordonnées (nom, prénom, email, téléphone, entreprise) ;</li>
        <li>Informations relatives à votre demande de formation ou de financement ;</li>
        <li>Si vous arrivez par une publicité ou par un lien suivi et l&apos;avez accepté dans le bandeau cookies : la
          source, la campagne, l&apos;identifiant de clic, la page et l&apos;heure d&apos;arrivée, joints à votre demande ;</li>
        <li>Données de navigation, avec votre accord (Google Analytics ; voir notre <a href="/cookies">politique cookies</a>).</li>
      </ul>

      <h2>Finalités &amp; bases légales</h2>
      <ul>
        <li><strong>Répondre à vos demandes</strong> (formulaire de contact) : intérêt légitime / mesures précontractuelles ;</li>
        <li><strong>Vous recontacter après une demande faite dans un formulaire de publicité</strong> sur Facebook,
          Instagram (Meta) ou Google : mesures précontractuelles. Meta ou Google nous transmettent les informations
          que vous y avez saisies, avec la publicité d&apos;origine ;</li>
        <li><strong>Vous répondre par téléphone, par e-mail ou par WhatsApp</strong>, aux coordonnées que vous nous avez
          données avec votre demande : mesures précontractuelles ;</li>
        <li><strong>Vous envoyer un modèle gratuit et vous recontacter</strong> au sujet de la formation de votre équipe (demande d&apos;un modèle sur le site) : intérêt légitime ; vous pouvez vous y opposer à tout moment en nous écrivant ;</li>
        <li><strong>Répondre à vos questions par notre assistant Starkk</strong> (bulle de discussion du site) : intérêt légitime. Vos messages sont transmis à un modèle d&apos;intelligence artificielle, hébergé par notre sous-traitant Anthropic, uniquement pour produire la réponse. Ils sont conservés douze mois, avec votre adresse IP, pour améliorer les réponses et prévenir les abus. N&apos;y indiquez aucune information sensible ;</li>
        <li><strong>Gérer les inscriptions et le suivi des formations</strong> : exécution du contrat ;</li>
        <li><strong>Respecter nos obligations</strong> (Qualiopi, comptables, légales) : obligation légale ;</li>
        <li><strong>Mesure d&apos;audience du site</strong> (Google Analytics) : consentement, que vous pouvez retirer à tout moment ;</li>
        <li><strong>Savoir quelles publicités amènent des demandes</strong> (informations d&apos;arrivée jointes à une
          demande faite sur le site) : consentement, donné dans le bandeau cookies. Le retirer arrête leur prise en
          compte pour les demandes suivantes ; pour les retirer d&apos;une demande déjà envoyée, écrivez à
          {' '}<a href="mailto:dpo@lab-learning.fr">dpo@lab-learning.fr</a>.</li>
      </ul>

      <h2>Durée de conservation</h2>
      <ul>
        <li><strong>Demandes de contact et prospects :</strong> 3 ans après le dernier échange ;</li>
        <li><strong>Dossiers de formation</strong> (convention, émargements, évaluations, attestations) : 3 ans à compter
          de la fin de l&apos;année du dernier paiement, conformément aux obligations liées aux financements publics et
          mutualisés (durée étendue en cas de cofinancement européen) ;</li>
        <li><strong>Documents comptables :</strong> 10 ans ;</li>
        <li><strong>Informations d&apos;arrivée jointes à une demande</strong> (publicité, lien suivi) : conservées avec
          la demande, 3 ans après le dernier échange ;</li>
        <li><strong>Empreinte de votre adresse IP</strong> à l&apos;envoi du formulaire de contact : 48 heures, pour
          limiter les envois abusifs ;</li>
        <li><strong>Données de navigation</strong> (Google Analytics) : 13 mois au maximum.</li>
      </ul>

      <h2>Destinataires et sous-traitants</h2>
      <p>
        Vos données sont destinées aux services habilités de Lab Learning et, le cas échéant, aux financeurs de votre
        formation (OPCO, France Travail) dans la stricte mesure exigée par les dispositifs. Elles ne sont jamais
        vendues à des tiers. Nos sous-traitants techniques, liés par des engagements de conformité RGPD :
      </p>
      <ul>
        <li><strong>Vercel</strong> : hébergement du site (clauses contractuelles types pour les transferts hors UE) ;</li>
        <li><strong>Supabase</strong> : base de données, hébergée dans l&apos;Union européenne (région Paris) ;</li>
        <li><strong>Resend</strong> : envoi des emails transactionnels (convocations, attestations) ;</li>
        <li><strong>Meta (formulaires publicitaires Facebook et Instagram)</strong> : recueil des demandes faites dans nos
          publicités, qui nous sont ensuite transmises ; transferts vers les États-Unis encadrés par le cadre de
          protection des données entre l&apos;Union européenne et les États-Unis et par les clauses contractuelles types ;</li>
        <li><strong>Google (formulaires pour prospects Google Ads)</strong> : recueil des demandes faites dans nos
          annonces, qui nous sont ensuite transmises ; transferts vers les États-Unis encadrés par le cadre de protection
          des données entre l&apos;Union européenne et les États-Unis et par les clauses contractuelles types ;</li>
        <li><strong>Meta (WhatsApp)</strong> : notifications WhatsApp, uniquement avec votre consentement, et réponse à
          votre demande par WhatsApp au numéro que vous nous avez donné ;</li>
        <li><strong>Google (Google Analytics)</strong> : mesure d&apos;audience du site, uniquement avec votre accord ; transferts vers les États-Unis encadrés par le cadre de protection des données entre l&apos;Union européenne et les États-Unis ;</li>
        <li><strong>Anthropic</strong> : modèle d&apos;intelligence artificielle de l&apos;assistant Starkk ; ce traitement peut avoir lieu hors de l&apos;Union européenne ;</li>
        <li><strong>Google Workspace</strong> : messagerie et documents internes.</li>
      </ul>

      <h2>Vos droits</h2>
      <p>Vous disposez des droits d’accès, de rectification, d’effacement, de limitation, d’opposition et de portabilité
        de vos données. Pour les exercer : <a href="mailto:dpo@lab-learning.fr">dpo@lab-learning.fr</a>.</p>
      <p>
        Vous pouvez également introduire une réclamation auprès de la CNIL (
        <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">www.cnil.fr</a>).
      </p>

      <h2 id="suppression-donnees">Supprimer vos données</h2>
      <p>
        Pour faire supprimer vos données, y compris celles transmises par un formulaire de publicité Facebook,
        Instagram ou Google, écrivez à <a href="mailto:dpo@lab-learning.fr">dpo@lab-learning.fr</a> en indiquant votre
        nom et l&apos;adresse e-mail ou le téléphone que vous aviez donnés. Nous les supprimons dans un délai d&apos;un mois
        et vous le confirmons, sauf ce que la loi nous oblige à conserver (dossiers de formation, comptabilité). Pour une
        demande venue d&apos;un formulaire de publicité, nous gardons seulement son identifiant technique chez Meta ou
        Google, sans vos coordonnées ni vos réponses, pour qu&apos;elle ne soit pas importée une seconde fois.
      </p>

      <h2>Sécurité</h2>
      <p>
        Lab Learning met en œuvre les mesures techniques et organisationnelles appropriées pour protéger vos données
        contre tout accès, altération ou divulgation non autorisés.
      </p>
    </LegalPage>
  )
}
