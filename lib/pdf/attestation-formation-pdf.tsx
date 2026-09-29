import * as React from 'react'
import { Document, Page, View, Text, Image } from '@react-pdf/renderer'
import { PdfSectionTitle, PdfDocHeader, PdfDocFooter, shared, BRAND_GREEN, BRAND_LIGHT, SURFACE_500, SURFACE_700, SURFACE_900 } from './components'

interface AttestationFormationProps {
  apprenant: any
  session: any
  formation: any
  org: any
  assiduite?: number
  /** Heures réellement suivies quand le parcours est partiel (abandon, absence). */
  heuresSuivies?: number | null
}

export function AttestationFormationPDF({ apprenant, session, formation, org, assiduite, heuresSuivies }: AttestationFormationProps) {
  // L'attestation est datée de la fin de formation, pas du jour du
  // téléchargement — le document reste cohérent quel que soit le moment où
  // il est réédité.
  const today = new Date(session?.date_fin || Date.now()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const numero = `ATT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`

  // L'attestation tient sur une page : les listes longues passent sur deux
  // colonnes et les modalités d'évaluation en un seul paragraphe
  const objectifs: string[] = (formation.objectifs_pedagogiques || [])
    .map((o: string) => String(o).trim()).filter((o: string) => o && !/:$/.test(o))
  const competences: string[] = (formation.competences_visees || []).map((c: string) => String(c).trim()).filter(Boolean)
  const modalites = String(formation.modalites_evaluation || 'Évaluation des acquis en cours et en fin de formation (QCM, mise en situation pratique).')
    .split(/\r?\n/).map((l) => l.replace(/^[\s\-•*·]+/, '').trim()).filter(Boolean)
    .map((l, i, t) => (i < t.length - 1 && !/[.:;]$/.test(l) ? `${l} ;` : l)).join(' ')
  // Plus le programme est long, plus le texte se resserre
  const volume = objectifs.join(' ').length + competences.join(' ').length + modalites.length
  const taille = volume <= 1100 ? 7.4 : volume <= 1600 ? 6.8 : 6.2
  const interligne = volume <= 1100 ? 1.35 : volume <= 1600 ? 1.28 : 1.2
  const Liste = ({ items }: { items: string[] }) => {
    const deux = items.length > 5
    const moitie = Math.ceil(items.length / 2)
    const colonnes = deux ? [items.slice(0, moitie), items.slice(moitie)] : [items]
    return (
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {colonnes.map((col, k) => (
          <View key={k} style={{ flex: 1 }}>
            {col.map((t, i) => (
              <Text key={i} style={{ fontSize: taille, color: SURFACE_700, lineHeight: interligne, paddingLeft: 8, marginBottom: 1.2 }}>- {t}</Text>
            ))}
          </View>
        ))}
      </View>
    )
  }
  const bloc = { marginBottom: volume <= 1100 ? 10 : 7 }

  return (
    <Document>
      <Page size="A4" style={{ ...shared.page, paddingTop: 36, paddingBottom: 48 }}>
        <PdfDocHeader docTitle="Attestation de fin de formation" numero={numero} org={org} />

        <View style={bloc}>
          <Text style={{ fontSize: 9.5, color: SURFACE_700, lineHeight: 1.45 }}>
            {`Je soussigné(e), représentant(e) de ${org.name}, organisme de formation certifié Qualiopi, atteste que :`}
          </Text>
        </View>

        <View style={shared.infoBox}>
          <Text style={{ fontSize: 10, fontFamily: 'Satoshi', fontWeight: 700, color: SURFACE_900, marginBottom: 4 }}>
            {apprenant.prenom} {apprenant.nom}
          </Text>
          {apprenant.date_naissance ? (
            <Text style={shared.infoBoxText}>
              {`Né(e) le ${new Date(apprenant.date_naissance).toLocaleDateString('fr-FR')}`}
            </Text>
          ) : null}
          {apprenant.entreprise && <Text style={shared.infoBoxText}>Entreprise : {apprenant.entreprise}</Text>}
        </View>

        <View style={bloc}>
          <Text style={{ fontSize: 9.5, color: SURFACE_700, lineHeight: 1.45 }}>
            a suivi la formation suivante :
          </Text>
        </View>

        <View style={bloc}>
          <PdfSectionTitle>Formation suivie</PdfSectionTitle>
          <View style={shared.row}><Text style={shared.label}>Intitulé :</Text><Text style={{ ...shared.value, fontFamily: 'Satoshi', fontWeight: 700 }}>{formation.intitule}</Text></View>
          {formation.reference && <View style={shared.row}><Text style={shared.label}>Référence :</Text><Text style={shared.value}>{formation.reference}</Text></View>}
          {heuresSuivies != null ? (
            <View style={shared.row}><Text style={shared.label}>Durée suivie :</Text><Text style={{ ...shared.value, fontFamily: 'Satoshi', fontWeight: 700 }}>{heuresSuivies.toLocaleString('fr-FR')} heures sur {formation.duree_heures || 0} prévues</Text></View>
          ) : (
            <View style={shared.row}><Text style={shared.label}>Durée :</Text><Text style={shared.value}>{formation.duree_heures || 0} heures</Text></View>
          )}
          <View style={shared.row}><Text style={shared.label}>Dates :</Text><Text style={shared.value}>Du {new Date(session.date_debut).toLocaleDateString('fr-FR')} au {new Date(session.date_fin).toLocaleDateString('fr-FR')}</Text></View>
          {session.lieu && <View style={shared.row}><Text style={shared.label}>Lieu :</Text><Text style={shared.value}>{session.lieu}</Text></View>}
          {session.formateur && <View style={shared.row}><Text style={shared.label}>Formateur :</Text><Text style={shared.value}>{session.formateur.prenom} {session.formateur.nom}</Text></View>}
          {assiduite != null && <View style={shared.row}><Text style={shared.label}>Assiduité :</Text><Text style={shared.value}>{assiduite}%</Text></View>}
        </View>

        {objectifs.length > 0 && (
          <View style={bloc}>
            <PdfSectionTitle>Objectifs pédagogiques atteints</PdfSectionTitle>
            <Liste items={objectifs} />
          </View>
        )}

        {competences.length > 0 && (
          <View style={bloc}>
            <PdfSectionTitle>Compétences acquises</PdfSectionTitle>
            <Liste items={competences} />
          </View>
        )}

        <View style={bloc}>
          <PdfSectionTitle>Modalités d'évaluation</PdfSectionTitle>
          <Text style={{ fontSize: taille, color: SURFACE_700, lineHeight: interligne }}>{modalites}</Text>
        </View>

        <View style={bloc}>
          <PdfSectionTitle>Résultats de l'évaluation des acquis</PdfSectionTitle>
          <Text style={{ fontSize: 7.8, color: SURFACE_700, lineHeight: 1.4 }}>
            {heuresSuivies != null
              ? `Parcours suivi partiellement (${heuresSuivies.toLocaleString('fr-FR')} heures sur ${formation.duree_heures || 0} prévues). Les acquis sont attestés à hauteur du parcours réellement effectué.${assiduite != null ? ` Assiduité constatée : ${assiduite}%.` : ''}`
              : assiduite != null
              ? `Les objectifs pédagogiques de la formation ont été évalués. Acquis validés au regard des objectifs visés. Assiduité constatée : ${assiduite}%.`
              : 'Les objectifs pédagogiques de la formation ont été évalués. Acquis validés au regard des objectifs visés.'}
          </Text>
        </View>

        {/* Date et cachet côte à côte : le bloc reste sur la même page */}
        <View wrap={false} style={{ marginTop: 6, flexDirection: 'row', alignItems: 'flex-start', gap: 20 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 8, color: SURFACE_500 }}>Fait à {org.city || '___________'}, le {today}</Text>
            <Text style={{ fontSize: 8, fontFamily: 'Satoshi', fontWeight: 700, color: BRAND_GREEN, marginTop: 6 }}>Pour {org.name}</Text>
            <Text style={{ fontSize: 7, color: SURFACE_500, marginTop: 2 }}>Signature et cachet</Text>
          </View>
          <View style={{ height: 60, width: 150, position: 'relative' }}>
            {org.tampon_signature_url ? (
              <Image src={org.tampon_signature_url} style={{ position: 'absolute', top: 0, left: 0, width: 150, height: 60, objectFit: 'contain' }} />
            ) : (
              <View style={{ height: 50, borderBottomWidth: 0.5, borderBottomColor: '#CBD3DB', width: 150 }} />
            )}
          </View>
        </View>

        <PdfDocFooter numero={numero} org={org} />
      </Page>
    </Document>
  )
}
