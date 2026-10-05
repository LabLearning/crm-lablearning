import { LegalPage } from '../LegalPage'

export const metadata = {
  title: 'Conditions générales de vente',
  description: 'Conditions générales de vente des prestations de formation Lab Learning : inscription, tarifs, annulation, réclamations.',
  alternates: { canonical: '/cgv' },
}

export default function CGV() {
  return (
    <LegalPage title="Conditions générales de vente" updated="août 2026">
      <p>
        Les présentes conditions générales de vente (CGV) régissent les relations entre <strong>Lab Learning</strong>
        {' '}(SAS, 6b boulevard Berthelot, Bureau 3, 34000 Montpellier, SIRET 931 658 561 00036, organisme de formation enregistré
        sous le n° 76 34 13151 34) et ses clients dans le cadre de la vente d’actions de formation professionnelle.
      </p>

      <h2>1. Objet</h2>
      <p>
        Toute commande de formation implique l’acceptation sans réserve des présentes CGV, qui prévalent sur toute
        autre condition, sauf dérogation formelle et écrite de Lab Learning.
      </p>

      <h2>2. Inscription</h2>
      <p>
        L’inscription est effective à réception de la convention (ou du contrat) de formation signée et, le cas échéant,
        de l’accord de prise en charge du financeur. Un devis détaillé est établi préalablement.
      </p>

      <h2>3. Tarifs &amp; financement</h2>
      <p>
        Les tarifs sont indiqués en euros hors taxes ; la TVA applicable est ajoutée le cas échéant. Nos formations
        peuvent être prises en charge par les dispositifs de financement (OPCO, France Travail, plan de développement
        des compétences, POEI). Lab Learning accompagne le client dans le montage du dossier ; l’octroi de la prise en
        charge relève toutefois de la seule décision du financeur.
      </p>

      <h2>4. Modalités de paiement</h2>
      <p>
        Sauf disposition contraire, les factures sont payables à réception. En cas de subrogation de paiement au
        financeur, le client reste responsable du paiement en cas de refus ou de défaut de prise en charge.
      </p>

      <h2>5. Annulation &amp; report</h2>
      <p>
        Toute annulation doit être notifiée par écrit. En cas d’annulation par le client moins de 10 jours ouvrés avant
        le début de la formation, Lab Learning se réserve le droit de facturer tout ou partie du montant, sauf cas de
        force majeure. Lab Learning peut reporter ou annuler une session (nombre insuffisant de participants,
        indisponibilité du formateur…) ; les sommes déjà versées sont alors remboursées ou reportées.
      </p>

      <h2>6. Modalités pédagogiques &amp; évaluation</h2>
      <p>
        Les objectifs, le programme, la durée, les prérequis et les modalités d’évaluation de chaque formation sont
        précisés dans le programme remis avant l’entrée en formation. Une attestation de fin de formation est délivrée
        à l’issue du parcours.
      </p>

      <h2>7. Accessibilité &amp; situation de handicap</h2>
      <p>
        Lab Learning s’engage à étudier toute situation de handicap afin d’adapter, dans la mesure du possible, ses
        formations. Contactez notre référent handicap : <a href="mailto:contact@lab-learning.fr">contact@lab-learning.fr</a>.
      </p>

      <h2>8. Réclamations</h2>
      <p>
        Toute réclamation peut être déposée via notre <a href="/reclamation">formulaire de réclamation</a> ou
        adressée par email à <a href="mailto:contact@lab-learning.fr">contact@lab-learning.fr</a>.
        Elle fait l’objet d’un traitement dans le cadre de notre démarche qualité Qualiopi.
      </p>

      <h2>9. Propriété intellectuelle</h2>
      <p>
        Les supports pédagogiques restent la propriété de Lab Learning. Ils ne peuvent être reproduits ou diffusés
        sans autorisation écrite.
      </p>

      <h2>10. Données personnelles</h2>
      <p>
        Le traitement des données est décrit dans notre <a href="/confidentialite">politique de confidentialité</a>.
      </p>

      <h2>11. Droit applicable</h2>
      <p>
        Les présentes CGV sont soumises au droit français. En cas de litige, et à défaut de résolution amiable, les
        tribunaux compétents seront ceux du ressort du siège social de Lab Learning.
      </p>
    </LegalPage>
  )
}
