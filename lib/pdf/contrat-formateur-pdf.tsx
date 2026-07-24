import * as React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { PdfSectionTitle, PdfDocHeader, PdfDocFooter, PdfSignatureCards, shared, BRAND_GREEN, SURFACE_500, SURFACE_700 } from './components'
import { ProgrammeAnnexePage, hasProgrammeContent } from './programme-annexe'

interface ContratFormateurProps {
  formateur: any
  org: any
  session?: any
  /** Contrat en base : porte le numéro définitif et les signatures apposées */
  contrat?: any
  /** Intervention POEI, quand le contrat ne porte pas sur une session */
  intervention?: any
}

const fmtLong = (d: string | Date) =>
  new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

export function ContratFormateurPDF({ formateur, org, session, contrat, intervention }: ContratFormateurProps) {
  const today = fmtLong(new Date())
  // Le numéro doit rester stable d'un rendu à l'autre : on prend celui du contrat
  // en base, et on ne retombe sur un provisoire que pour un aperçu avant création.
  const numero = contrat?.numero || `CP-${new Date().getFullYear()}-PROJET`
  const signeFormateur = Boolean(contrat?.signature_formateur_date)
  const signeOf = Boolean(contrat?.signature_of_date) || Boolean(org?.tampon_signature_url)
  const dateContrat = contrat?.sent_at ? fmtLong(contrat.sent_at) : today
  // Formation de la mission → annexe programme (session ou intervention POEI)
  const annexeFormation = session?.formation || intervention?.poei?.formation || null

  // La mission porte soit sur une session, soit sur une intervention POEI :
  // on les ramène à une forme commune pour que l'article 2 et la rémunération
  // soient rendus à l'identique dans les deux cas.
  const mission = session
    ? {
        intitule: session.formation?.intitule || session.reference,
        reference: session.reference,
        dateDebut: session.date_debut, dateFin: session.date_fin,
        lieu: session.lieu, duree: session.formation?.duree_heures,
        montant: session.cout_formateur,
      }
    : intervention
      ? {
          intitule: intervention.libelle,
          reference: intervention.poei?.numero || null,
          dateDebut: intervention.date_debut, dateFin: intervention.date_fin,
          lieu: [intervention.lieu, intervention.adresse, [intervention.code_postal, intervention.ville].filter(Boolean).join(' ')].filter(Boolean).join(', '),
          duree: intervention.nb_heures,
          montant: intervention.montant_ht,
        }
      : null

  return (
    <Document>
      <Page size="A4" style={shared.page}>
        <PdfDocHeader
          docTitle="Contrat de prestation"
          numero={numero}
          date={dateContrat}
          statut={signeFormateur ? 'Signé' : 'Formation'}
          org={org}
        />

        <View style={shared.section}>
          <PdfSectionTitle>Entre les parties</PdfSectionTitle>
          <View style={shared.row}><Text style={shared.label}>Le donneur d'ordre :</Text><Text style={shared.value}>{org.name} — {org.legal_name || ''}</Text></View>
          <View style={shared.row}><Text style={shared.label}>SIRET :</Text><Text style={shared.value}>{org.siret || ''}</Text></View>
          <View style={shared.row}><Text style={shared.label}>Adresse :</Text><Text style={shared.value}>{org.address || ''} {org.postal_code || ''} {org.city || ''}</Text></View>
          <View style={shared.row}><Text style={shared.label}>N° d'activité :</Text><Text style={shared.value}>{org.numero_da || ''}</Text></View>
          <View style={{ marginTop: 10 }} />
          <View style={shared.row}><Text style={shared.label}>Le prestataire :</Text><Text style={shared.value}>{formateur.prenom} {formateur.nom}</Text></View>
          <View style={shared.row}><Text style={shared.label}>Email :</Text><Text style={shared.value}>{formateur.email || ''}</Text></View>
          {formateur.siret && <View style={shared.row}><Text style={shared.label}>SIRET :</Text><Text style={shared.value}>{formateur.siret}</Text></View>}
          {formateur.adresse && <View style={shared.row}><Text style={shared.label}>Adresse :</Text><Text style={shared.value}>{formateur.adresse} {formateur.code_postal || ''} {formateur.ville || ''}</Text></View>}
        </View>

        <View style={shared.section}>
          <PdfSectionTitle>Article 1 — Objet</PdfSectionTitle>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            Le donneur d'ordre confie au prestataire, qui l'accepte, la réalisation de prestations de formation professionnelle dans le cadre de son activité d'organisme de formation certifié Qualiopi.
          </Text>
        </View>

        {mission && (
          <View style={shared.section}>
            <PdfSectionTitle>Article 2 — Mission</PdfSectionTitle>
            <View style={shared.row}><Text style={shared.label}>{session ? 'Formation :' : 'Intervention :'}</Text><Text style={shared.value}>{mission.intitule}</Text></View>
            {mission.reference && <View style={shared.row}><Text style={shared.label}>Référence :</Text><Text style={shared.value}>{mission.reference}</Text></View>}
            {mission.dateDebut && <View style={shared.row}><Text style={shared.label}>Dates :</Text><Text style={shared.value}>{fmtLong(mission.dateDebut)}{mission.dateFin ? ` au ${fmtLong(mission.dateFin)}` : ''}</Text></View>}
            {mission.lieu && <View style={shared.row}><Text style={shared.label}>Lieu :</Text><Text style={shared.value}>{mission.lieu}</Text></View>}
            {intervention?.horaires && <View style={shared.row}><Text style={shared.label}>Horaires :</Text><Text style={shared.value}>{intervention.horaires}</Text></View>}
            {mission.duree && <View style={shared.row}><Text style={shared.label}>Durée :</Text><Text style={shared.value}>{mission.duree} heures</Text></View>}
          </View>
        )}

        <View style={shared.section}>
          <PdfSectionTitle>{mission ? 'Article 3' : 'Article 2'} — Obligations du prestataire</PdfSectionTitle>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            Le prestataire s'engage à :{'\n'}
            - Assurer les formations conformément au programme pédagogique validé{'\n'}
            - Respecter les horaires et le lieu de formation convenus{'\n'}
            - Compléter les feuilles d'émargement via la plateforme de l'organisme{'\n'}
            - Pointer ses heures d'arrivée et de départ (avec preuve photo){'\n'}
            - Remettre un rapport de session à l'issue de chaque formation{'\n'}
            - Respecter le règlement intérieur de l'organisme{'\n'}
            - Garantir la confidentialité des informations relatives aux apprenants
          </Text>
        </View>

        <View style={shared.section}>
          <PdfSectionTitle>{mission ? 'Article 4' : 'Article 3'} — Engagement qualité (Qualiopi — art. R.6333-6-2)</PdfSectionTitle>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            En sa qualité de sous-traitant intervenant pour le compte d'un organisme certifié Qualiopi, le prestataire s'engage à respecter, pour les missions confiées, les exigences applicables du Référentiel National Qualité (RNQ), et notamment les indicateurs 4, 6, 8, 10 à 12, 17 à 19, 21 à 25, 27, 31 et 32 :{'\n'}
            - analyse du besoin du bénéficiaire et adaptation des contenus ;{'\n'}
            - modalités d'accueil, de suivi et d'évaluation des acquis ;{'\n'}
            - moyens humains, techniques et pédagogiques adaptés ;{'\n'}
            - actualisation des compétences et veille (légale, métier, pédagogique) ;{'\n'}
            - traitement des appréciations et des réclamations recueillies en séance.{'\n'}
            {`Le prestataire tient à disposition de ${org.name} les justificatifs correspondants en cas d'audit.`}
          </Text>
        </View>

        <View style={shared.section}>
          <PdfSectionTitle>{mission ? 'Article 5' : 'Article 4'} — Lutte contre le travail dissimulé</PdfSectionTitle>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            {`Pour toute prestation d'un montant égal ou supérieur à 5 000 € HT, le prestataire remettra à ${org.name} son attestation de vigilance URSSAF (art. L.8222-1 et D.8222-5 du Code du travail) au moment de la conclusion du contrat puis tous les six mois jusqu'à son terme. Le prestataire atteste être à jour de ses déclarations et paiements sociaux et fiscaux.`}
          </Text>
        </View>

        <View style={shared.section}>
          <PdfSectionTitle>{mission ? 'Article 6' : 'Article 5'} — Rémunération</PdfSectionTitle>
          {mission?.montant != null && Number(mission.montant) > 0 ? (
            <>
              {/* Montant validé à la validation de la session — montant contractuel */}
              <View style={shared.row}><Text style={shared.label}>Montant de la prestation (HT) :</Text><Text style={{ ...shared.value, fontFamily: 'Satoshi', fontWeight: 700 }}>{Number(mission.montant).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[\u202F\u00A0]/g, ' ')} EUR</Text></View>
              <Text style={{ fontSize: 7.5, color: SURFACE_500, marginTop: 2 }}>
                {session
                  ? 'Montant forfaitaire convenu entre les parties et validé pour la présente session.'
                  : 'Montant forfaitaire convenu entre les parties pour la présente intervention.'}
              </Text>
            </>
          ) : (
            <>
              {formateur.tarif_journalier && <View style={shared.row}><Text style={shared.label}>Tarif journalier HT :</Text><Text style={shared.value}>{Number(formateur.tarif_journalier).toLocaleString('fr-FR').replace(/[\u202F\u00A0]/g, " ")} EUR</Text></View>}
              {formateur.tarif_horaire && <View style={shared.row}><Text style={shared.label}>Tarif horaire HT :</Text><Text style={shared.value}>{Number(formateur.tarif_horaire).toLocaleString('fr-FR').replace(/[\u202F\u00A0]/g, " ")} EUR</Text></View>}
              {session ? (
                <Text style={{ fontSize: 7.5, color: SURFACE_500, marginTop: 2 }}>
                  Tarifs indicatifs — le montant définitif de la prestation est arrêté lors de la validation de la session.
                </Text>
              ) : null}
            </>
          )}
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6, marginTop: 6 }}>
            Le paiement sera effectué sur présentation d'une facture du prestataire, dans un délai de 30 jours suivant la fin de la prestation et la remise du rapport de session. La facture devra être accompagnée des justificatifs de réalisation (émargements, rapport).
          </Text>
        </View>

        <View style={shared.section}>
          <PdfSectionTitle>{mission ? 'Article 7' : 'Article 6'} — Propriété intellectuelle</PdfSectionTitle>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            {`Les supports pédagogiques créés dans le cadre de cette prestation restent la propriété de ${org.name}. Le prestataire autorise leur utilisation et reproduction dans le cadre des activités de formation de l'organisme.`}
          </Text>
        </View>

        <View style={shared.section}>
          <PdfSectionTitle>{mission ? 'Article 8' : 'Article 7'} — Statut</PdfSectionTitle>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            Le prestataire exerce son activité en qualité de travailleur indépendant. Le présent contrat ne crée aucun lien de subordination. Le prestataire est responsable de ses déclarations fiscales et sociales.
          </Text>
        </View>

        <View style={shared.section}>
          <PdfSectionTitle>{mission ? 'Article 9' : 'Article 8'} — Non-sollicitation de clientèle et exclusivité commerciale</PdfSectionTitle>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            {`Le prestataire reconnaît expressément que les clients, entreprises bénéficiaires, apprenants et prospects auprès desquels il intervient, ou dont il a connaissance à l'occasion de ses missions, constituent la clientèle propre de ${org.name} et demeurent sa propriété commerciale exclusive.`}{'\n\n'}
            {`En conséquence, pendant toute la durée du présent contrat et pendant vingt-quatre (24) mois suivant la fin de sa dernière mission, le prestataire s'interdit, directement ou indirectement, par personne physique ou morale interposée :`}{'\n'}
            {`- de démarcher, solliciter ou contacter à des fins commerciales ces clients et bénéficiaires ;`}{'\n'}
            {`- de leur proposer, à titre personnel ou pour le compte d'un tiers, des prestations de formation ou de conseil de même nature ou concurrentes ;`}{'\n'}
            {`- de conclure avec eux une convention de formation, un contrat de sous-traitance ou tout accord direct portant sur de telles prestations ;`}{'\n'}
            {`- de se prévaloir auprès d'eux d'une autre qualité que celle d'intervenant mandaté par ${org.name}.`}{'\n\n'}
            {`Le prestataire intervient en qualité de prestataire externe indépendant. Il ne dispose d'aucun mandat de représentation et ne peut engager ${org.name} au-delà de la mission qui lui est confiée. Toute relation commerciale, contractuelle ou financière avec ces clients transite exclusivement par ${org.name}. Toute sollicitation reçue directement d'un client devra lui être signalée sans délai.`}{'\n\n'}
            {`En cas de manquement, le prestataire sera redevable de plein droit d'une indemnité forfaitaire égale au montant hors taxes facturé par ${org.name} au client concerné au cours des douze (12) mois précédant le manquement, sans préjudice de la réparation du préjudice réellement subi et de la résiliation immédiate du présent contrat.`}
          </Text>
        </View>

        <View style={shared.section}>
          <PdfSectionTitle>{mission ? 'Article 10' : 'Article 9'} — Protection des données (RGPD)</PdfSectionTitle>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            {`Le prestataire agit en qualité de sous-traitant au sens de l'article 28 du RGPD pour les traitements de données personnelles des apprenants effectués pour le compte de ${org.name}. Il ne traite ces données que sur instruction documentée du responsable du traitement, garantit la confidentialité, met en œuvre les mesures de sécurité appropriées et supprime ou restitue les données à l'issue de la mission.`}
          </Text>
        </View>

        <View style={shared.section}>
          <PdfSectionTitle>{mission ? 'Article 11' : 'Article 10'} — Durée, résiliation et litiges</PdfSectionTitle>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            Le présent contrat prend effet à sa signature. Il peut être résilié par l'une ou l'autre des parties par lettre recommandée avec accusé de réception moyennant un préavis de 30 jours. En cas de manquement grave de l'une des parties à ses obligations, l'autre partie pourra résilier le contrat sans préavis après mise en demeure restée infructueuse pendant 15 jours.{'\n'}
            {`En cas de litige, et après tentative de règlement amiable, les juridictions du ressort du siège de ${org.name} seront seules compétentes.`}
          </Text>
        </View>

        <View style={{ marginTop: 24 }}>
          <PdfSignatureCards
            faitMention={`Fait à ${org?.city || '___________'}, le ${dateContrat}, en deux exemplaires.`}
            items={[
              {
                title: "Le donneur d'ordre",
                name: org.name,
                mention: 'Représentant légal',
                hint: 'Signature et cachet',
                stamp: org?.tampon_signature_url || null,
                signed: signeOf,
                signedBy: contrat?.signature_of_nom || undefined,
                signedDate: contrat?.signature_of_date ? fmtLong(contrat.signature_of_date) : undefined,
              },
              {
                title: 'Le prestataire',
                name: `${formateur.prenom} ${formateur.nom}`,
                mention: 'Mention « Lu et approuvé »',
                hint: 'Signature précédée de la date',
                // La signature manuscrite capturée est apposée dans le cadre
                stamp: contrat?.signature_formateur_signature_data || null,
                signed: signeFormateur,
                signedBy: contrat?.signature_formateur_nom || undefined,
                signedDate: contrat?.signature_formateur_date ? fmtLong(contrat.signature_formateur_date) : undefined,
              },
            ]}
          />
        </View>

        <PdfDocFooter numero={numero} org={org} />
      </Page>

      {/* Annexe — Programme de formation (fait partie intégrante du contrat) */}
      {hasProgrammeContent(annexeFormation) && (
        <ProgrammeAnnexePage formation={annexeFormation} org={org} numero={numero} rattachement="le présent contrat" />
      )}
    </Document>
  )
}
