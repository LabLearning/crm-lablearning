import { Document, Page, View, Text } from '@react-pdf/renderer'
import { PdfDocHeader, PdfDocFooter, shared, BRAND_GREEN, SURFACE_500, SURFACE_700 } from './components'

interface ContratFormateurProps {
  formateur: any
  org: any
  session?: any
}

export function ContratFormateurPDF({ formateur, org, session }: ContratFormateurProps) {
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const numero = `CP-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`

  return (
    <Document>
      <Page size="A4" style={shared.page}>
        <PdfDocHeader docTitle="Contrat de prestation" numero={numero} date={today} statut="Formation" org={org} />

        <View style={shared.section}>
          <Text style={shared.sectionTitle}>Entre les parties</Text>
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
          <Text style={shared.sectionTitle}>Article 1 — Objet</Text>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            Le donneur d'ordre confie au prestataire, qui l'accepte, la réalisation de prestations de formation professionnelle dans le cadre de son activité d'organisme de formation certifié Qualiopi.
          </Text>
        </View>

        {session && (
          <View style={shared.section}>
            <Text style={shared.sectionTitle}>Article 2 — Mission</Text>
            <View style={shared.row}><Text style={shared.label}>Formation :</Text><Text style={shared.value}>{session.formation?.intitule || session.reference}</Text></View>
            <View style={shared.row}><Text style={shared.label}>Référence :</Text><Text style={shared.value}>{session.reference}</Text></View>
            <View style={shared.row}><Text style={shared.label}>Dates :</Text><Text style={shared.value}>{session.date_debut} au {session.date_fin}</Text></View>
            {session.lieu && <View style={shared.row}><Text style={shared.label}>Lieu :</Text><Text style={shared.value}>{session.lieu}</Text></View>}
            {session.formation?.duree_heures && <View style={shared.row}><Text style={shared.label}>Durée :</Text><Text style={shared.value}>{session.formation.duree_heures} heures</Text></View>}
          </View>
        )}

        <View style={shared.section}>
          <Text style={shared.sectionTitle}>{session ? 'Article 3' : 'Article 2'} — Obligations du prestataire</Text>
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
          <Text style={shared.sectionTitle}>{session ? 'Article 4' : 'Article 3'} — Engagement qualité (Qualiopi — art. R.6333-6-2)</Text>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            En sa qualité de sous-traitant intervenant pour le compte d'un organisme certifié Qualiopi, le prestataire s'engage à respecter, pour les missions confiées, les exigences applicables du Référentiel National Qualité (RNQ), et notamment les indicateurs 4, 6, 8, 10 à 12, 17 à 19, 21 à 25, 27, 31 et 32 :{'\n'}
            - analyse du besoin du bénéficiaire et adaptation des contenus ;{'\n'}
            - modalités d'accueil, de suivi et d'évaluation des acquis ;{'\n'}
            - moyens humains, techniques et pédagogiques adaptés ;{'\n'}
            - actualisation des compétences et veille (légale, métier, pédagogique) ;{'\n'}
            - traitement des appréciations et des réclamations recueillies en séance.{'\n'}
            Le prestataire tient à disposition de {org.name} les justificatifs correspondants en cas d'audit.
          </Text>
        </View>

        <View style={shared.section}>
          <Text style={shared.sectionTitle}>{session ? 'Article 5' : 'Article 4'} — Lutte contre le travail dissimulé</Text>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            Pour toute prestation d'un montant égal ou supérieur à 5 000 € HT, le prestataire remettra à {org.name} son attestation de vigilance URSSAF (art. L.8222-1 et D.8222-5 du Code du travail) au moment de la conclusion du contrat puis tous les six mois jusqu'à son terme. Le prestataire atteste être à jour de ses déclarations et paiements sociaux et fiscaux.
          </Text>
        </View>

        <View style={shared.section}>
          <Text style={shared.sectionTitle}>{session ? 'Article 6' : 'Article 5'} — Rémunération</Text>
          {formateur.tarif_journalier && <View style={shared.row}><Text style={shared.label}>Tarif journalier HT :</Text><Text style={shared.value}>{Number(formateur.tarif_journalier).toLocaleString('fr-FR')} EUR</Text></View>}
          {formateur.tarif_horaire && <View style={shared.row}><Text style={shared.label}>Tarif horaire HT :</Text><Text style={shared.value}>{Number(formateur.tarif_horaire).toLocaleString('fr-FR')} EUR</Text></View>}
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6, marginTop: 6 }}>
            Le paiement sera effectué sur présentation d'une facture du prestataire, dans un délai de 30 jours suivant la fin de la prestation et la remise du rapport de session. La facture devra être accompagnée des justificatifs de réalisation (émargements, rapport).
          </Text>
        </View>

        <View style={shared.section}>
          <Text style={shared.sectionTitle}>{session ? 'Article 7' : 'Article 6'} — Propriété intellectuelle</Text>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            Les supports pédagogiques créés dans le cadre de cette prestation restent la propriété de {org.name}. Le prestataire autorise leur utilisation et reproduction dans le cadre des activités de formation de l'organisme.
          </Text>
        </View>

        <View style={shared.section}>
          <Text style={shared.sectionTitle}>{session ? 'Article 8' : 'Article 7'} — Statut</Text>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            Le prestataire exerce son activité en qualité de travailleur indépendant. Le présent contrat ne crée aucun lien de subordination. Le prestataire est responsable de ses déclarations fiscales et sociales.
          </Text>
        </View>

        <View style={shared.section}>
          <Text style={shared.sectionTitle}>{session ? 'Article 9' : 'Article 8'} — Protection des données (RGPD)</Text>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            Le prestataire agit en qualité de sous-traitant au sens de l'article 28 du RGPD pour les traitements de données personnelles des apprenants effectués pour le compte de {org.name}. Il ne traite ces données que sur instruction documentée du responsable du traitement, garantit la confidentialité, met en œuvre les mesures de sécurité appropriées et supprime ou restitue les données à l'issue de la mission.
          </Text>
        </View>

        <View style={shared.section}>
          <Text style={shared.sectionTitle}>{session ? 'Article 10' : 'Article 9'} — Durée, résiliation et litiges</Text>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            Le présent contrat prend effet à sa signature. Il peut être résilié par l'une ou l'autre des parties par lettre recommandée avec accusé de réception moyennant un préavis de 30 jours. En cas de manquement grave de l'une des parties à ses obligations, l'autre partie pourra résilier le contrat sans préavis après mise en demeure restée infructueuse pendant 15 jours.{'\n'}
            En cas de litige, et après tentative de règlement amiable, les juridictions du ressort du siège de {org.name} seront seules compétentes.
          </Text>
        </View>

        <View style={{ marginTop: 30, flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ width: '45%' }}>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: BRAND_GREEN, marginBottom: 6 }}>Le donneur d'ordre</Text>
            <Text style={{ fontSize: 8, color: SURFACE_500 }}>{org.name}</Text>
            <Text style={{ fontSize: 8, color: SURFACE_500 }}>Date : {today}</Text>
            <View style={{ height: 50, borderBottomWidth: 0.5, borderBottomColor: '#d6d3d1', marginTop: 8 }} />
            <Text style={{ fontSize: 7, color: SURFACE_500, marginTop: 4 }}>Signature et cachet</Text>
          </View>
          <View style={{ width: '45%' }}>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: BRAND_GREEN, marginBottom: 6 }}>Le prestataire</Text>
            <Text style={{ fontSize: 8, color: SURFACE_500 }}>{formateur.prenom} {formateur.nom}</Text>
            <Text style={{ fontSize: 8, color: SURFACE_500 }}>Date : {today}</Text>
            <View style={{ height: 50, borderBottomWidth: 0.5, borderBottomColor: '#d6d3d1', marginTop: 8 }} />
            <Text style={{ fontSize: 7, color: SURFACE_500, marginTop: 4 }}>Signature précédée de "Lu et approuvé"</Text>
          </View>
        </View>

        <PdfDocFooter numero={numero} org={org} />
      </Page>
    </Document>
  )
}
