import * as React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { PdfDocHeader, PdfDocFooter, shared, BRAND_GREEN, BRAND_LIGHT, SURFACE_500, SURFACE_700 } from './components'

interface ProgrammeFormationProps {
  formation: any
  org: any
}

export function ProgrammeFormationPDF({ formation, org }: ProgrammeFormationProps) {
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <Document>
      <Page size="A4" style={shared.page}>
        <PdfDocHeader docTitle="Programme de formation" numero={formation.reference || ''} date={today} org={org} />

        {/* Titre formation */}
        <View style={{ marginBottom: 20, backgroundColor: BRAND_LIGHT, padding: 14, borderRadius: 4 }}>
          <Text style={{ fontSize: 14, fontFamily: 'Satoshi', fontWeight: 700, color: BRAND_GREEN }}>{formation.intitule}</Text>
          {formation.sous_titre && <Text style={{ fontSize: 9, color: SURFACE_700, marginTop: 4 }}>{formation.sous_titre}</Text>}
        </View>

        {/* Infos clés */}
        <View style={shared.section}>
          <Text style={shared.sectionTitle}>Informations générales</Text>
          <View style={shared.row}><Text style={shared.label}>Durée :</Text><Text style={shared.value}>{formation.duree_heures} heures{formation.duree_jours ? ` (${formation.duree_jours} jours)` : ''}</Text></View>
          <View style={shared.row}><Text style={shared.label}>Modalité :</Text><Text style={shared.value}>{formation.modalite === 'presentiel' ? 'Présentiel' : formation.modalite === 'distanciel' ? 'Distanciel' : 'Mixte (présentiel + distanciel)'}</Text></View>
          {formation.categorie && <View style={shared.row}><Text style={shared.label}>Catégorie :</Text><Text style={shared.value}>{formation.categorie}</Text></View>}
          {formation.public_vise && <View style={shared.row}><Text style={shared.label}>Public visé :</Text><Text style={shared.value}>{formation.public_vise}</Text></View>}
          {formation.prerequis && <View style={shared.row}><Text style={shared.label}>Prérequis :</Text><Text style={shared.value}>{formation.prerequis}</Text></View>}
          {formation.accessibilite_handicap && <View style={shared.row}><Text style={shared.label}>Accessibilité :</Text><Text style={shared.value}>{formation.accessibilite_handicap}</Text></View>}
        </View>

        {/* Objectifs */}
        {formation.objectifs_pedagogiques && formation.objectifs_pedagogiques.length > 0 && (
          <View style={shared.section}>
            <Text style={shared.sectionTitle}>Objectifs pédagogiques</Text>
            <Text style={{ fontSize: 8, color: SURFACE_500, marginBottom: 6 }}>À l'issue de la formation, le stagiaire sera capable de :</Text>
            {formation.objectifs_pedagogiques.map((obj: string, i: number) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: 3, paddingLeft: 6 }}>
                <Text style={{ fontSize: 8, color: BRAND_GREEN, marginRight: 6 }}>-</Text>
                <Text style={{ fontSize: 8, color: SURFACE_700, flex: 1, lineHeight: 1.5 }}>{obj}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Programme détaillé */}
        {formation.programme_detaille && (
          <View style={shared.section}>
            <Text style={shared.sectionTitle}>Programme détaillé</Text>
            <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
              {formation.programme_detaille}
            </Text>
          </View>
        )}

        {/* Compétences */}
        {formation.competences_visees && formation.competences_visees.length > 0 && (
          <View style={shared.section}>
            <Text style={shared.sectionTitle}>Compétences visées</Text>
            {formation.competences_visees.map((comp: string, i: number) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: 3, paddingLeft: 6 }}>
                <Text style={{ fontSize: 8, color: BRAND_GREEN, marginRight: 6 }}>-</Text>
                <Text style={{ fontSize: 8, color: SURFACE_700, flex: 1, lineHeight: 1.5 }}>{comp}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Pédagogie */}
        <View style={shared.section}>
          <Text style={shared.sectionTitle}>Moyens pédagogiques et techniques</Text>
          {formation.methodes_pedagogiques && (
            <View style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 8, fontFamily: 'Satoshi', fontWeight: 700, color: SURFACE_700, marginBottom: 3 }}>Méthodes pédagogiques :</Text>
              <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>{formation.methodes_pedagogiques}</Text>
            </View>
          )}
          {formation.moyens_techniques && (
            <View style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 8, fontFamily: 'Satoshi', fontWeight: 700, color: SURFACE_700, marginBottom: 3 }}>Moyens techniques :</Text>
              <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>{formation.moyens_techniques}</Text>
            </View>
          )}
        </View>

        {/* Évaluation */}
        <View style={shared.section}>
          <Text style={shared.sectionTitle}>Modalités d'évaluation</Text>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            {formation.modalites_evaluation || 'Évaluation des acquis par QCM et mise en situation pratique. Évaluation de satisfaction en fin de formation.'}
          </Text>
        </View>

        {/* Admission */}
        {(formation as any).modalites_admission && (
          <View style={shared.section}>
            <Text style={shared.sectionTitle}>Modalités d'admission</Text>
            <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>{(formation as any).modalites_admission}</Text>
          </View>
        )}

        {/* Certification */}
        {formation.est_certifiante && (
          <View style={shared.section}>
            <Text style={shared.sectionTitle}>Certification</Text>
            {formation.code_rncp && <View style={shared.row}><Text style={shared.label}>Code RNCP :</Text><Text style={shared.value}>{formation.code_rncp}</Text></View>}
            {formation.code_rs && <View style={shared.row}><Text style={shared.label}>Code RS :</Text><Text style={shared.value}>{formation.code_rs}</Text></View>}
            {formation.certificateur && <View style={shared.row}><Text style={shared.label}>Certificateur :</Text><Text style={shared.value}>{formation.certificateur}</Text></View>}
          </View>
        )}

        {/* Tarifs */}
        <View style={shared.section}>
          <Text style={shared.sectionTitle}>Tarifs</Text>
          {formation.tarif_inter_ht && <View style={shared.row}><Text style={shared.label}>Inter-entreprise :</Text><Text style={shared.value}>{Number(formation.tarif_inter_ht).toLocaleString('fr-FR')} EUR HT / personne</Text></View>}
          {formation.tarif_intra_ht && <View style={shared.row}><Text style={shared.label}>Intra-entreprise :</Text><Text style={shared.value}>{Number(formation.tarif_intra_ht).toLocaleString('fr-FR')} EUR HT / groupe</Text></View>}
        </View>

        {/* Accessibilité & informations pratiques (Qualiopi Ind. 1) */}
        <View style={shared.section}>
          <Text style={shared.sectionTitle}>Accessibilité et informations pratiques</Text>
          <View style={shared.row}>
            <Text style={shared.label}>Délais d'accès :</Text>
            <Text style={shared.value}>{org.delai_acces || formation.delai_acces || 'Inscription jusqu\'à quelques jours avant le démarrage, selon les places disponibles.'}</Text>
          </View>
          <View style={shared.row}>
            <Text style={shared.label}>Accessibilité PSH :</Text>
            <Text style={shared.value}>
              {formation.accessibilite_handicap || 'Formation accessible aux personnes en situation de handicap. Pour tout besoin d\'adaptation, contactez notre référent handicap.'}
            </Text>
          </View>
          {(org.referent_handicap_nom || org.referent_handicap_email || org.referent_handicap_telephone) && (
            <View style={shared.row}>
              <Text style={shared.label}>Référent handicap :</Text>
              <Text style={shared.value}>
                {[org.referent_handicap_nom, org.referent_handicap_email, org.referent_handicap_telephone].filter(Boolean).join(' · ')}
              </Text>
            </View>
          )}
          <View style={shared.row}>
            <Text style={shared.label}>Contact :</Text>
            <Text style={shared.value}>{[org.email_contact || org.email, org.telephone_contact || org.phone].filter(Boolean).join(' · ') || '—'}</Text>
          </View>
        </View>

        <View style={shared.infoBox}>
          <Text style={shared.infoBoxText}>
            {org.name} — Organisme de formation{org.is_qualiopi !== false ? ' certifié Qualiopi' : ''}{'\n'}
            N° de déclaration d'activité : {org.numero_da || 'En cours'}
          </Text>
        </View>

        <PdfDocFooter numero={formation.reference || 'PROG'} org={org} />
      </Page>
    </Document>
  )
}
