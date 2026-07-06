import * as React from 'react'
import { Document, Page, View, Text, Image } from '@react-pdf/renderer'
import { PdfSectionTitle, PdfDocHeader, PdfDocFooter, shared, BRAND_GREEN, SURFACE_500, SURFACE_700, SURFACE_900 } from './components'

interface AttestationEntreeProps {
  apprenant: any
  formation: any
  org: any
  dateDebut?: string | null
  dateFin?: string | null
  dureeHeures?: number | null
  lieu?: string | null
  formateurNom?: string | null
  // Contexte POEI / France Travail (optionnel)
  poei?: {
    identifiant_ft?: string | null
    poste_vise?: string | null
    employeur?: string | null
  } | null
}

function frDate(d?: string | null): string {
  if (!d) return '___________'
  try { return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) } catch { return String(d) }
}

export function AttestationEntreePDF({ apprenant, formation, org, dateDebut, dateFin, dureeHeures, lieu, formateurNom, poei }: AttestationEntreeProps) {
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const numero = `ATE-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`

  return (
    <Document>
      <Page size="A4" style={shared.page}>
        <PdfDocHeader docTitle="Attestation d'entrée en formation" numero={numero} date={today} org={org} />

        <View style={shared.section}>
          {/* Chaîne unique : les interpolations en segments provoquent des chevauchements/espaces avalés */}
          <Text style={{ fontSize: 10, color: SURFACE_700, lineHeight: 1.8, marginBottom: 10 }}>
            {`Je soussigné(e), représentant(e) de ${org.name}, organisme de formation${org.numero_da ? ` (n° de déclaration d'activité ${org.numero_da})` : ''}, atteste que :`}
          </Text>
        </View>

        <View style={shared.infoBox}>
          <Text style={{ fontSize: 10, fontFamily: 'Satoshi', fontWeight: 700, color: SURFACE_900, marginBottom: 4 }}>
            {apprenant.civilite ? `${apprenant.civilite} ` : ''}{apprenant.prenom} {apprenant.nom}
          </Text>
          {apprenant.date_naissance && <Text style={shared.infoBoxText}>{`Né(e) le ${frDate(apprenant.date_naissance)}`}</Text>}
          {poei?.identifiant_ft && <Text style={shared.infoBoxText}>{`Identifiant France Travail : ${poei.identifiant_ft}`}</Text>}
          {apprenant.entreprise && <Text style={shared.infoBoxText}>{`Entreprise : ${apprenant.entreprise}`}</Text>}
        </View>

        <View style={shared.section}>
          <Text style={{ fontSize: 10, color: SURFACE_700, lineHeight: 1.8 }}>
            {`est bien entré(e) en formation à compter du ${frDate(dateDebut)}, pour suivre la formation suivante :`}
          </Text>
        </View>

        <View style={shared.section}>
          <PdfSectionTitle>Formation</PdfSectionTitle>
          <View style={shared.row}><Text style={shared.label}>Intitulé :</Text><Text style={{ ...shared.value, fontFamily: 'Satoshi', fontWeight: 700 }}>{formation.intitule}</Text></View>
          {formation.reference && <View style={shared.row}><Text style={shared.label}>Référence :</Text><Text style={shared.value}>{formation.reference}</Text></View>}
          <View style={shared.row}><Text style={shared.label}>Durée :</Text><Text style={shared.value}>{dureeHeures || formation.duree_heures || 0} heures</Text></View>
          <View style={shared.row}><Text style={shared.label}>Dates :</Text><Text style={shared.value}>Du {frDate(dateDebut)} au {frDate(dateFin)}</Text></View>
          {lieu && <View style={shared.row}><Text style={shared.label}>Lieu :</Text><Text style={shared.value}>{lieu}</Text></View>}
          {formateurNom && <View style={shared.row}><Text style={shared.label}>Formateur :</Text><Text style={shared.value}>{formateurNom}</Text></View>}
        </View>

        {poei && (poei.poste_vise || poei.employeur) && (
          <View style={shared.section}>
            <PdfSectionTitle>Cadre POEI (Préparation Opérationnelle à l'Emploi)</PdfSectionTitle>
            {poei.employeur && <View style={shared.row}><Text style={shared.label}>Employeur :</Text><Text style={shared.value}>{poei.employeur}</Text></View>}
            {poei.poste_vise && <View style={shared.row}><Text style={shared.label}>Poste visé :</Text><Text style={shared.value}>{poei.poste_vise}</Text></View>}
          </View>
        )}

        <View style={shared.section}>
          <Text style={{ fontSize: 9, color: SURFACE_700, lineHeight: 1.8 }}>
            La présente attestation est délivrée pour servir et valoir ce que de droit, notamment auprès de
            France Travail et de l'organisme financeur.
          </Text>
        </View>

        <View style={{ marginTop: 30 }}>
          <Text style={{ fontSize: 8, color: SURFACE_500 }}>{`Fait à ${org.city || org.ville || '___________'}, le ${today}`}</Text>
          <View style={{ marginTop: 15 }}>
            <Text style={{ fontSize: 8, fontFamily: 'Satoshi', fontWeight: 700, color: BRAND_GREEN, marginBottom: 6 }}>{`Pour ${org.name}`}</Text>
            <View style={{ height: 90, width: 220 }}>
              <View style={{ position: 'absolute', bottom: 18, left: 0, height: 0.5, backgroundColor: '#d6d3d1', width: 200 }} />
              {/* Cachet de l'organisme posé sur la zone signature */}
              {org.tampon_signature_url ? (
                <Image src={org.tampon_signature_url} style={{ position: 'absolute', top: 0, left: 10, width: 170, height: 85, objectFit: 'contain' }} />
              ) : null}
            </View>
            <Text style={{ fontSize: 7, color: SURFACE_500, marginTop: 4 }}>Signature et cachet</Text>
          </View>
        </View>

        <PdfDocFooter numero={numero} org={org} />
      </Page>
    </Document>
  )
}
