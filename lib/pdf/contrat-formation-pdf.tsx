import * as React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { PdfDocHeader, PdfDocFooter, PdfSignatureCards, PdfSectionTitle, shared, BRAND_GREEN, SURFACE_500, SURFACE_700, SURFACE_900 } from './components'

interface ContratFormationProps {
  dossier: any
  client: any
  formation: any
  session: any
  org: any
  formateur?: any
}

const euro = (n: number | null | undefined) =>
  (n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

function Article({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 12 }} wrap={false}>
      <PdfSectionTitle>{titre}</PdfSectionTitle>
      {children}
    </View>
  )
}

const P = ({ children }: { children: React.ReactNode }) => (
  <Text style={{ fontSize: 8.5, color: SURFACE_700, lineHeight: 1.6, marginBottom: 3 }}>{children}</Text>
)

export function ContratFormationPDF({ dossier, client, formation, session, org, formateur }: ContratFormationProps) {
  const formateurNom = formateur ? `${formateur.prenom || ''} ${formateur.nom || ''}`.trim() : ''
  const formateurRefs = formateur
    ? [
        Array.isArray(formateur.diplomes) ? formateur.diplomes.join(', ') : formateur.diplomes,
        Array.isArray(formateur.qualifications) ? formateur.qualifications.join(', ') : formateur.qualifications,
        Array.isArray(formateur.certifications) ? formateur.certifications.join(', ') : formateur.certifications,
      ].filter(Boolean).join(' · ')
    : ''
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const numero = dossier?.numero ? `CF-${dossier.numero}` : `CF-${new Date().getFullYear()}`
  const stagiaire = [client?.civilite, client?.prenom, client?.nom].filter(Boolean).join(' ').trim()
    || client?.raison_sociale || '—'
  const adresseStagiaire = [client?.adresse, [client?.code_postal, client?.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '—'
  const ttc = dossier?.montant_total_ttc ?? formation?.prix_ttc ?? null
  const ht = dossier?.montant_total_ht ?? formation?.prix_ht ?? null
  const acompte = ttc ? Math.round(ttc * 0.3 * 100) / 100 : null
  const dDebut = session?.date_debut ? new Date(session.date_debut).toLocaleDateString('fr-FR') : '—'
  const dFin = session?.date_fin ? new Date(session.date_fin).toLocaleDateString('fr-FR') : dDebut
  const lieu = session?.lieu || session?.ville || org?.city || '—'

  return (
    <Document>
      <Page size="A4" style={shared.page}>
        <PdfDocHeader docTitle="Contrat de formation" numero={numero} date={today} org={org} />

        <View style={shared.section}>
          <Text style={{ fontSize: 8, color: SURFACE_500, lineHeight: 1.6 }}>
            Contrat de formation professionnelle conclu en application des articles L.6353-3 à L.6353-8 du Code du travail
            (formation financée à titre individuel et à ses frais par le stagiaire).
          </Text>
        </View>

        <Article titre="Entre les soussignés">
          <P>
            <Text style={{ fontFamily: 'Satoshi', fontWeight: 700 }}>{org?.name || 'Lab Learning'}</Text>, organisme de formation
            {org?.address ? `, ${org.address}` : ''}{org?.city ? ` ${org.postal_code || ''} ${org.city}` : ''},
            {org?.numero_da ? ` enregistré sous le numéro de déclaration d'activité ${org.numero_da}` : ''}
            {org?.siret ? `, SIRET ${org.siret}` : ''}, représenté par son représentant légal, ci-après « l'organisme »,
          </P>
          <P>et</P>
          <P>
            <Text style={{ fontFamily: 'Satoshi', fontWeight: 700 }}>{stagiaire}</Text>, demeurant {adresseStagiaire}
            {client?.email ? `, ${client.email}` : ''}{client?.telephone ? `, ${client.telephone}` : ''}, ci-après « le stagiaire ».
          </P>
        </Article>

        <Article titre="Article 1 — Objet et nature de la formation">
          <P>
            L'organisme dispense au stagiaire l'action de formation suivante : <Text style={{ fontFamily: 'Satoshi', fontWeight: 700 }}>{formation?.intitule || '—'}</Text>.
            Action de formation au sens de l'article L.6313-1 du Code du travail.
          </P>
          {formation?.objectifs_pedagogiques?.length ? (
            <P>Objectifs : {formation.objectifs_pedagogiques.join(' ; ')}.</P>
          ) : formation?.objectifs ? <P>Objectifs : {formation.objectifs}.</P> : null}
        </Article>

        <Article titre="Article 2 — Durée, dates et lieu">
          <P>Durée : {formation?.duree_heures ? `${formation.duree_heures} heures` : 'précisée au programme'}. Du {dDebut} au {dFin}. Lieu : {lieu}.</P>
          <P>Effectif : formation dispensée en groupe ou en individuel selon la session. Modalités : {session?.modalite || 'présentiel'}.</P>
        </Article>

        <Article titre="Article 3 — Niveau de connaissances préalables">
          <P>{formation?.prerequis || "Aucun prérequis particulier n'est exigé pour suivre cette formation."}</P>
        </Article>

        <Article titre="Article 4 — Encadrement pédagogique">
          <P>
            La formation est assurée par {formateurNom || 'un formateur qualifié de l\'organisme'}.
            {formateurRefs ? ` Diplômes, titres et références : ${formateurRefs}.` : ' Les diplômes, titres et références du formateur sont disponibles sur demande.'}
          </P>
        </Article>

        <Article titre="Article 5 — Modalités d'évaluation et sanction">
          <P>{formation?.modalites_evaluation || "Évaluation des acquis en cours et en fin de formation (QCM et/ou mise en situation pratique)."}</P>
          <P>À l'issue de la formation, une attestation de fin de formation et/ou un certificat de réalisation est remis au stagiaire.</P>
        </Article>

        <Article titre="Article 6 — Dispositions financières">
          <P>
            Le prix de la formation est fixé à {euro(ttc)} TTC{ht != null ? ` (${euro(ht)} HT)` : ''}, pour la totalité de la prestation.
          </P>
          <P>
            Conformément à l'article L.6353-6, aucune somme ne peut être exigée du stagiaire avant l'expiration du délai de
            rétractation de 10 jours. Passé ce délai, un premier versement ne pouvant excéder 30 % du prix
            {acompte != null ? ` (soit ${euro(acompte)})` : ''} pourra être demandé ; le solde est échelonné au fur et à mesure
            du déroulement de l'action de formation.
          </P>
        </Article>

        <Article titre="Article 7 — Délai de rétractation">
          <P>
            À compter de la date de signature du présent contrat, le stagiaire dispose d'un délai de 10 jours pour se rétracter.
            Il en informe l'organisme par lettre recommandée avec accusé de réception. Aucune somme ne peut être exigée ni retenue
            de ce fait (art. L.6353-5 du Code du travail).
          </P>
        </Article>

        <Article titre="Article 8 — Interruption ou abandon de la formation">
          <P>
            En cas de cessation anticipée de la formation du fait de l'organisme, ou d'abandon par le stagiaire pour un autre motif
            que la force majeure dûment reconnue, le présent contrat est résilié. Seules les prestations effectivement dispensées
            sont dues au prorata temporis. En cas d'abandon sans motif valable, l'organisme peut demander un dédit, dans la limite
            de ce que prévoit l'article L.6354-1 ; cette somme n'est pas imputable sur l'obligation de financement.
          </P>
        </Article>

        <Article titre="Article 9 — Litiges">
          <P>
            Si une contestation ou un différend ne peuvent être réglés à l'amiable, le tribunal compétent du ressort du siège de
            l'organisme sera seul compétent.
          </P>
        </Article>

        <View style={{ marginTop: 16 }}>
          <PdfSignatureCards
            faitMention={`Fait à ${org?.city || '___________'}, le ${today}, en deux exemplaires.`}
            items={[
              { title: "Pour l'organisme", name: org?.name || 'Lab Learning', mention: 'Représentant légal', hint: 'Signature et cachet' },
              { title: 'Le stagiaire', mention: 'Mention manuscrite « Lu et approuvé »', hint: 'Signature précédée de la date' },
            ]}
          />
        </View>

        <PdfDocFooter numero={numero} org={org} />
      </Page>
    </Document>
  )
}
