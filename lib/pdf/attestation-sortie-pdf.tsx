import * as React from 'react'
import { Document, Page, View, Text, Image } from '@react-pdf/renderer'
import { PdfSectionTitle, PdfDocHeader, PdfDocFooter, shared, BRAND_GREEN, SURFACE_500, SURFACE_700, SURFACE_900 } from './components'

/**
 * Attestation de sortie anticipée (abandon) — modèle France Travail : dates
 * d'entrée et de sortie effectives, heures réalisées sur heures prévues,
 * motif. Complète l'attestation d'entrée et l'attestation de fin.
 */
interface AttestationSortieProps {
  apprenant: any
  formation: any
  org: any
  dateDebut?: string | null
  dateSortie?: string | null
  dureeHeures?: number | null
  heuresEffectuees?: number | null
  motif?: string | null
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

export function AttestationSortiePDF({ apprenant, formation, org, dateDebut, dateSortie, dureeHeures, heuresEffectuees, motif, poei }: AttestationSortieProps) {
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const numero = `ATS-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`
  const prevues = Number(dureeHeures || formation?.duree_heures || 0)
  const realisees = heuresEffectuees != null ? Number(heuresEffectuees) : null
  // Au-delà des heures prévues, un pourcentage ne dirait plus rien (même règle que le rapport d'abandon)
  const assiduite = realisees != null && prevues > 0 && realisees <= prevues ? Math.round((realisees / prevues) * 100) : null

  return (
    <Document>
      <Page size="A4" style={shared.page}>
        <PdfDocHeader docTitle="Attestation de sortie de formation" numero={numero} org={org} />

        <View style={shared.section}>
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
        </View>

        <View style={shared.section}>
          <Text style={{ fontSize: 10, color: SURFACE_700, lineHeight: 1.8 }}>
            {`entré(e) en formation le ${frDate(dateDebut)}, est sorti(e) de façon anticipée de la formation suivante le ${frDate(dateSortie)} :`}
          </Text>
        </View>

        <View style={shared.section}>
          <PdfSectionTitle>Formation</PdfSectionTitle>
          <View style={shared.row}><Text style={shared.label}>Intitulé :</Text><Text style={{ ...shared.value, fontFamily: 'Satoshi', fontWeight: 700 }}>{formation.intitule}</Text></View>
          {formation.reference && <View style={shared.row}><Text style={shared.label}>Référence :</Text><Text style={shared.value}>{formation.reference}</Text></View>}
          <View style={shared.row}><Text style={shared.label}>Durée prévue :</Text><Text style={shared.value}>{prevues} heures</Text></View>
          <View style={shared.row}><Text style={shared.label}>Date d&apos;entrée :</Text><Text style={shared.value}>{frDate(dateDebut)}</Text></View>
          <View style={shared.row}><Text style={shared.label}>Date de sortie :</Text><Text style={{ ...shared.value, fontFamily: 'Satoshi', fontWeight: 700 }}>{frDate(dateSortie)}</Text></View>
        </View>

        <View style={shared.section}>
          <PdfSectionTitle>Réalisation</PdfSectionTitle>
          <View style={shared.row}>
            <Text style={shared.label}>Heures réalisées :</Text>
            <Text style={{ ...shared.value, fontFamily: 'Satoshi', fontWeight: 700 }}>
              {realisees != null ? `${realisees.toLocaleString('fr-FR')} heures sur ${prevues} heures prévues` : `___ heures sur ${prevues} heures prévues`}
            </Text>
          </View>
          {assiduite != null && (
            <View style={shared.row}><Text style={shared.label}>Assiduité :</Text><Text style={shared.value}>{assiduite} %</Text></View>
          )}
          {motif && (
            <View style={shared.row}><Text style={shared.label}>Motif de sortie :</Text><Text style={shared.value}>{motif}</Text></View>
          )}
        </View>

        {poei && (poei.poste_vise || poei.employeur) && (
          <View style={shared.section}>
            <PdfSectionTitle>Cadre POEI (Préparation Opérationnelle à l&apos;Emploi)</PdfSectionTitle>
            {poei.employeur && <View style={shared.row}><Text style={shared.label}>Employeur :</Text><Text style={shared.value}>{poei.employeur}</Text></View>}
            {poei.poste_vise && <View style={shared.row}><Text style={shared.label}>Poste visé :</Text><Text style={shared.value}>{poei.poste_vise}</Text></View>}
          </View>
        )}

        <View style={shared.section}>
          <Text style={{ fontSize: 9, color: SURFACE_700, lineHeight: 1.8 }}>
            Les heures de formation sont facturées au prorata du temps de présence effectif, conformément
            aux règles de la convention POEI. La présente attestation est délivrée pour servir et valoir ce
            que de droit, notamment auprès de France Travail et de l&apos;organisme financeur.
          </Text>
        </View>

        <View style={{ marginTop: 30 }}>
          <Text style={{ fontSize: 8, color: SURFACE_500 }}>{`Fait à ${org.city || org.ville || '___________'}, le ${today}`}</Text>
          <View style={{ marginTop: 15 }}>
            <Text style={{ fontSize: 8, fontFamily: 'Satoshi', fontWeight: 700, color: BRAND_GREEN, marginBottom: 6 }}>{`Pour ${org.name}`}</Text>
            <View style={{ height: 90, width: 220 }}>
              <View style={{ position: 'absolute', bottom: 18, left: 0, height: 0.5, backgroundColor: '#CBD3DB', width: 200 }} />
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
