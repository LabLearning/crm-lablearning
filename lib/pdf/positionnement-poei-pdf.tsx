import * as React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import {
  PdfSectionTitle, PdfDocHeader, PdfDocFooter, shared,
  BRAND_GREEN, BRAND_LIGHT, SURFACE_50, SURFACE_200, SURFACE_400, SURFACE_500, SURFACE_700, SURFACE_900,
} from './components'
import { DOMAINES, QUESTIONS, NIVEAUX, evaluerPositionnement, type Reponses } from '@/lib/poei-positionnement'

export interface CandidatPositionne {
  nom: string
  prenom: string
  dateNaissance: string | null
  identifiantFt: string | null
  reponses: Reponses
  realiseLe: string | null
  commentaire: string | null
}

export interface PositionnementPdfProps {
  org: any
  poei: {
    numero: string | null
    date_debut: string | null
    date_fin: string | null
    duree_heures: number | null
    poste_vise?: string | null
  }
  employeur: string | null
  candidats: CandidatPositionne[]
  numero: string
}

const jour = (d?: string | null) =>
  d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('fr-FR') : '—'
const pct = (n: number) => `${String(n).replace('.', ',')} %`
const heures = (n: number) => `${String(n).replace('.', ',')} h`

/**
 * Fiche de positionnement à l'entrée, destinée à France Travail.
 *
 * Elle montre, situation de travail par situation de travail, ce que le
 * candidat sait déjà faire, et ce que l'écart au référentiel de compétences
 * justifie en volume d'heures. C'est la pièce qui appuie la demande de prise
 * en charge du parcours.
 */
export function PositionnementPoeiPDF({ org, poei, employeur, candidats, numero }: PositionnementPdfProps) {
  return (
    <Document>
      {candidats.map((c, i) => {
        const r = evaluerPositionnement(c.reponses)
        const dureeParcours = Number(poei.duree_heures) || r.heuresReferentiel
        return (
          <Page key={i} size="A4" style={shared.page}>
            <PdfDocHeader
              docTitle="Positionnement à l'entrée"
              numero={`${numero}-${String(i + 1).padStart(2, '0')}`}
              date={jour(c.realiseLe)}
              org={org}
            />

            <View style={shared.section}>
              <PdfSectionTitle>Candidat et parcours visé</PdfSectionTitle>
              <View style={shared.row}><Text style={shared.label}>Candidat :</Text><Text style={shared.value}>{`${c.prenom} ${String(c.nom).toUpperCase()}`}</Text></View>
              {c.dateNaissance ? <View style={shared.row}><Text style={shared.label}>Né(e) le :</Text><Text style={shared.value}>{jour(c.dateNaissance)}</Text></View> : null}
              {c.identifiantFt ? <View style={shared.row}><Text style={shared.label}>Identifiant France Travail :</Text><Text style={shared.value}>{c.identifiantFt}</Text></View> : null}
              <View style={shared.row}><Text style={shared.label}>Poste visé :</Text><Text style={shared.value}>{poei.poste_vise || 'Équipier polyvalent en restauration rapide'}</Text></View>
              {employeur ? <View style={shared.row}><Text style={shared.label}>Employeur :</Text><Text style={shared.value}>{employeur}</Text></View> : null}
              <View style={shared.row}><Text style={shared.label}>Parcours POEI :</Text><Text style={shared.value}>{`${poei.numero || ''} — ${dureeParcours} heures, du ${jour(poei.date_debut)} au ${jour(poei.date_fin)}`}</Text></View>
            </View>

            {/* Le résultat, tout de suite : c'est ce que le financeur cherche */}
            <View style={{
              backgroundColor: BRAND_LIGHT, borderRadius: 6, padding: 13, marginBottom: 16,
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <View>
                <Text style={{ fontSize: 8, color: SURFACE_500, marginBottom: 3 }}>Niveau constaté à l&apos;entrée</Text>
                <Text style={{ fontSize: 19, fontFamily: 'Montserrat', fontWeight: 700, color: BRAND_GREEN, letterSpacing: -0.3 }}>
                  {pct(r.maitriseGlobale)}
                </Text>
                <Text style={{ fontSize: 8, color: SURFACE_700, marginTop: 2 }}>{r.niveauLibelle}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 8, color: SURFACE_500, marginBottom: 3 }}>Volume de formation justifié</Text>
                <Text style={{ fontSize: 19, fontFamily: 'Montserrat', fontWeight: 700, color: BRAND_GREEN, letterSpacing: -0.3 }}>
                  {heures(r.heuresPreconisees)}
                </Text>
                <Text style={{ fontSize: 8, color: SURFACE_700, marginTop: 2 }}>{`sur les ${dureeParcours} heures du parcours`}</Text>
              </View>
            </View>

            <View style={shared.section}>
              <PdfSectionTitle>Écart au référentiel de compétences</PdfSectionTitle>
              <View style={shared.table}>
                <View style={shared.tableHeader}>
                  <Text style={[shared.tableHeaderCell, { width: '46%' }]}>Domaine de compétences</Text>
                  <Text style={[shared.tableHeaderCell, { width: '18%', textAlign: 'right' }]}>Niveau d&apos;entrée</Text>
                  <Text style={[shared.tableHeaderCell, { width: '18%', textAlign: 'right' }]}>Écart</Text>
                  <Text style={[shared.tableHeaderCell, { width: '18%', textAlign: 'right' }]}>Heures</Text>
                </View>
                {r.domaines.map((d, j) => (
                  <View key={d.code} style={[shared.tableRow, j % 2 === 1 ? shared.tableRowAlt : {}]}>
                    <View style={{ width: '46%', paddingRight: 6 }}>
                      <Text style={[shared.tableCell, { color: SURFACE_900 }]}>{d.libelle}</Text>
                      <Text style={{ fontSize: 7, color: SURFACE_400, marginTop: 1.5 }}>{`${d.heuresReferentiel} h au référentiel`}</Text>
                    </View>
                    <Text style={[shared.tableCell, { width: '18%', textAlign: 'right' }]}>{pct(d.maitrise)}</Text>
                    <Text style={[shared.tableCell, { width: '18%', textAlign: 'right' }]}>{pct(d.ecart)}</Text>
                    <Text style={[shared.tableCell, { width: '18%', textAlign: 'right', fontFamily: 'Satoshi', fontWeight: 700, color: SURFACE_900 }]}>
                      {heures(d.heuresPreconisees)}
                    </Text>
                  </View>
                ))}
                <View style={{
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                  backgroundColor: BRAND_GREEN, paddingVertical: 8, paddingHorizontal: 10,
                }}>
                  <Text style={{ fontSize: 9, fontFamily: 'Satoshi', fontWeight: 700, color: '#ffffff' }}>
                    Volume justifié par le positionnement
                  </Text>
                  <Text style={{ fontSize: 10, fontFamily: 'Satoshi', fontWeight: 700, color: '#ffffff' }}>
                    {heures(r.heuresPreconisees)}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 7.5, color: SURFACE_500, lineHeight: 1.5 }}>
                Le module d&apos;hygiène alimentaire est suivi dans son volume réglementaire quel que soit le niveau
                d&apos;entrée, conformément à l&apos;arrêté du 12 février 2024.
              </Text>
            </View>

            <View style={shared.section} break>
              <PdfSectionTitle>Détail des situations de travail évaluées</PdfSectionTitle>
              <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.55, marginBottom: 8 }}>
                {`Vingt situations de travail, réparties sur les cinq domaines du métier. Chaque situation est cotée de « ${NIVEAUX[0].libelle} » à « ${NIVEAUX[3].libelle} ».`}
              </Text>
              {DOMAINES.map((d) => (
                <View key={d.code} style={{ marginBottom: 10 }} wrap={false}>
                  <View style={{
                    backgroundColor: SURFACE_50, paddingVertical: 5, paddingHorizontal: 9,
                    borderRadius: 3, marginBottom: 3,
                  }}>
                    <Text style={{ fontSize: 8.5, fontFamily: 'Satoshi', fontWeight: 700, color: SURFACE_900 }}>{d.libelle}</Text>
                    <Text style={{ fontSize: 7, color: SURFACE_500, marginTop: 1 }}>{d.objectif}</Text>
                  </View>
                  {QUESTIONS.filter((q) => q.domaine === d.code).map((q) => {
                    const v = c.reponses[q.code]
                    const niv = NIVEAUX.find((n) => n.valeur === v)
                    return (
                      <View key={q.code} style={{
                        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
                        paddingVertical: 3, paddingHorizontal: 9,
                        borderBottomWidth: 0.4, borderBottomColor: SURFACE_200,
                      }}>
                        <Text style={{ fontSize: 8, color: SURFACE_700, width: '72%' }}>{q.intitule}</Text>
                        <Text style={{
                          fontSize: 8, width: '28%', textAlign: 'right',
                          color: niv ? SURFACE_900 : SURFACE_400,
                          fontFamily: 'Satoshi', fontWeight: niv && niv.valeur >= 2 ? 700 : 400,
                        }}>
                          {niv ? niv.libelle : 'Non évalué'}
                        </Text>
                      </View>
                    )
                  })}
                </View>
              ))}
            </View>

            {c.commentaire ? (
              <View style={shared.section} wrap={false}>
                <PdfSectionTitle>Observations</PdfSectionTitle>
                <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>{c.commentaire}</Text>
              </View>
            ) : null}

            <View style={shared.section} wrap={false}>
              <PdfSectionTitle>Conclusion</PdfSectionTitle>
              <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
                {r.heuresPreconisees >= dureeParcours
                  ? `L'évaluation situe ${c.prenom} ${String(c.nom).toUpperCase()} à ${pct(r.maitriseGlobale)} du référentiel de compétences du poste d'équipier polyvalent. L'écart constaté couvre l'intégralité des ${dureeParcours} heures du parcours, sur les cinq domaines du métier.`
                  : `L'évaluation situe ${c.prenom} ${String(c.nom).toUpperCase()} à ${pct(r.maitriseGlobale)} du référentiel de compétences du poste d'équipier polyvalent. L'écart constaté justifie ${heures(r.heuresPreconisees)} de formation sur les ${dureeParcours} heures du parcours.`}
              </Text>
              <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6, marginTop: 6 }}>
                Le parcours est individualisé à partir de ce positionnement : les domaines les moins maîtrisés
                concentrent le temps de formation, les acquis sont consolidés en situation de travail.
              </Text>
              <Text style={{ fontSize: 7.5, color: SURFACE_400, marginTop: 10 }}>
                {`Positionnement réalisé le ${jour(c.realiseLe)} par ${org?.name || 'Lab Learning'}, organisme de formation certifié Qualiopi.`}
              </Text>
            </View>

            <PdfDocFooter numero={`${numero}-${String(i + 1).padStart(2, '0')}`} org={org} />
          </Page>
        )
      })}
    </Document>
  )
}
