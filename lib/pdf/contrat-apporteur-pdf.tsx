import * as React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { PdfDocHeader, PdfDocFooter, PdfSignatureCards, shared, BRAND_GREEN, SURFACE_500, SURFACE_700 } from './components'

interface ContratApporteurProps {
  apporteur: any
  org: any
}

export function ContratApporteurPDF({ apporteur, org }: ContratApporteurProps) {
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const numero = `CA-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`

  return (
    <Document>
      <Page size="A4" style={shared.page}>
        <PdfDocHeader docTitle="Contrat d'apporteur d'affaires" numero={numero} date={today} org={org} />

        <View style={shared.section}>
          <Text style={shared.sectionTitle}>Entre les parties</Text>
          <View style={shared.row}><Text style={shared.label}>L'organisme :</Text><Text style={shared.value}>{org.name} — {org.legal_name || ''}</Text></View>
          <View style={shared.row}><Text style={shared.label}>SIRET :</Text><Text style={shared.value}>{org.siret || 'Non renseigné'}</Text></View>
          <View style={shared.row}><Text style={shared.label}>Adresse :</Text><Text style={shared.value}>{org.address || ''} {org.postal_code || ''} {org.city || ''}</Text></View>
          <View style={{ marginTop: 10 }} />
          <View style={shared.row}><Text style={shared.label}>L'apporteur :</Text><Text style={shared.value}>{apporteur.prenom} {apporteur.nom}</Text></View>
          <View style={shared.row}><Text style={shared.label}>Email :</Text><Text style={shared.value}>{apporteur.email || ''}</Text></View>
          <View style={shared.row}><Text style={shared.label}>Téléphone :</Text><Text style={shared.value}>{apporteur.telephone || ''}</Text></View>
          {apporteur.siret && <View style={shared.row}><Text style={shared.label}>SIRET :</Text><Text style={shared.value}>{apporteur.siret}</Text></View>}
        </View>

        <View style={shared.section}>
          <Text style={shared.sectionTitle}>Article 1 — Objet du contrat</Text>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            Le présent contrat a pour objet de définir les conditions dans lesquelles l'Apporteur d'affaires s'engage à présenter des prospects susceptibles de devenir clients de l'Organisme pour ses formations professionnelles.
          </Text>
        </View>

        <View style={shared.section}>
          <Text style={shared.sectionTitle}>Article 2 — Obligations de l'apporteur</Text>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            L'Apporteur s'engage à :{'\n'}
            - Identifier et présenter des prospects qualifiés via la plateforme de l'Organisme{'\n'}
            - Fournir des informations exactes sur les prospects présentés{'\n'}
            - Respecter l'image et les valeurs de l'Organisme{'\n'}
            - Ne pas prendre d'engagements au nom de l'Organisme, ne pas négocier ni signer en son nom{'\n'}
            - Respecter la confidentialité des informations communiquées
          </Text>
        </View>

        <View style={shared.section}>
          <Text style={shared.sectionTitle}>Article 3 — Rémunération</Text>
          <View style={shared.row}><Text style={shared.label}>Taux de commission :</Text><Text style={shared.value}>{apporteur.taux_commission || 10}%</Text></View>
          <View style={shared.row}><Text style={shared.label}>Base de calcul :</Text><Text style={shared.value}>Montant HT des formations effectivement réalisées</Text></View>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6, marginTop: 6 }}>
            La commission est due uniquement pour les affaires effectivement conclues et réalisées. Le paiement intervient après encaissement intégral par l'Organisme du montant de la formation.
          </Text>
        </View>

        <View style={shared.section}>
          <Text style={shared.sectionTitle}>Article 4 — Durée</Text>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            Le présent contrat est conclu pour une durée indéterminée à compter de sa date de signature. Chaque partie peut y mettre fin par lettre recommandée avec accusé de réception, moyennant un préavis de 30 jours. Les commissions dues pour les affaires en cours restent acquises.
          </Text>
        </View>

        <View style={shared.section}>
          <Text style={shared.sectionTitle}>Article 5 — Confidentialité</Text>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            L'Apporteur s'engage à garder strictement confidentielles toutes les informations commerciales, financières et techniques dont il aurait connaissance dans le cadre du présent contrat. Cette obligation perdure 2 ans après la fin du contrat.
          </Text>
        </View>

        <View style={shared.section}>
          <Text style={shared.sectionTitle}>Article 6 — Statut</Text>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            L'Apporteur exerce son activité en toute indépendance. Le présent contrat ne crée aucun lien de subordination entre les parties. L'Apporteur est seul responsable de ses obligations fiscales et sociales.{'\n'}
            Les parties conviennent expressément que l'Apporteur n'est pas un agent commercial au sens des articles L.134-1 et suivants du Code de commerce : il n'a ni mandat de représentation permanente, ni pouvoir de négocier ou de conclure des contrats au nom et pour le compte de l'Organisme. Son intervention se limite à la mise en relation.
          </Text>
        </View>

        <View style={shared.section}>
          <Text style={shared.sectionTitle}>Article 7 — Non-sollicitation</Text>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            Pendant la durée du contrat et pendant une période de 12 mois suivant sa cessation, l'Apporteur s'interdit de solliciter, directement ou indirectement, les clients qu'il a apportés à l'Organisme pour leur proposer des prestations équivalentes pour son propre compte ou pour celui d'un tiers concurrent.
          </Text>
        </View>

        <View style={shared.section}>
          <Text style={shared.sectionTitle}>Article 8 — Protection des données (RGPD)</Text>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            Chacune des parties s'engage à traiter les données personnelles auxquelles elle a accès dans le respect du Règlement (UE) 2016/679 (RGPD) et de la loi Informatique et Libertés. L'Apporteur garantit avoir recueilli, auprès des prospects qu'il transmet, les consentements et informations nécessaires à la communication de leurs données à l'Organisme et au traitement à des fins de prospection commerciale.
          </Text>
        </View>

        <View style={shared.section}>
          <Text style={shared.sectionTitle}>Article 9 — Litiges</Text>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            Le présent contrat est régi par le droit français. En cas de différend, et après tentative de règlement amiable, les juridictions du ressort du siège de l'Organisme seront seules compétentes.
          </Text>
        </View>

        <View style={{ marginTop: 24 }}>
          <PdfSignatureCards
            faitMention={`Fait à ${org?.city || '___________'}, le ${today}, en deux exemplaires.`}
            items={[
              { title: "L'Organisme", name: org.name, mention: 'Représentant légal', hint: 'Signature et cachet' },
              { title: "L'Apporteur", name: `${apporteur.prenom} ${apporteur.nom}`, mention: 'Mention « Lu et approuvé »', hint: 'Signature précédée de la date' },
            ]}
          />
        </View>

        <PdfDocFooter numero={numero} org={org} />
      </Page>
    </Document>
  )
}
