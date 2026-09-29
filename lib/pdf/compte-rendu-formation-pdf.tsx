import * as React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import {
  PdfDocHeader, PdfDocFooter, PdfSectionTitle, shared,
  BRAND_ULTRA_LIGHT, SURFACE_50, SURFACE_200, SURFACE_400, SURFACE_500, SURFACE_700, SURFACE_900,
} from './components'
import { LIBELLES_ACQUIS, LIBELLES_OBJECTIF, libelleDemiJournee, type CompteRendu } from '../compte-rendu'

/**
 * Compte rendu de formation rédigé par le formateur, pour le dossier de la
 * session (preuve de réalisation, amélioration continue). Un ancien rapport
 * en texte libre est rendu rubrique par rubrique.
 */
export interface EnteteCompteRendu {
  reference: string
  formation: string
  client: string | null
  periode: string | null
  lieu: string | null
  duree: string | null
  formateur: string | null
  transmisLe: string | null
  statut: string
}

const P = ({ children, couleur = SURFACE_700 }: { children: React.ReactNode; couleur?: string }) => (
  <Text style={{ fontSize: 8.6, color: couleur, lineHeight: 1.5 }}>{children}</Text>
)
const Ligne = ({ label, valeur }: { label: string; valeur?: string | null }) =>
  valeur && valeur.trim() ? (
    <View style={{ flexDirection: 'row', marginBottom: 4 }} wrap={false}>
      <Text style={{ fontSize: 8.3, color: SURFACE_500, width: 125 }}>{label}</Text>
      <Text style={{ fontSize: 8.6, color: SURFACE_900, flex: 1, lineHeight: 1.45 }}>{valeur}</Text>
    </View>
  ) : null
const Pastille = ({ texte, fond, couleur }: { texte: string; fond: string; couleur: string }) => (
  <Text style={{ alignSelf: 'flex-start', fontSize: 7.2, fontWeight: 700, color: couleur, backgroundColor: fond, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3 }}>{texte}</Text>
)
const TONS: Record<string, { fond: string; couleur: string }> = {
  atteint: { fond: '#E3F4EA', couleur: '#1F6B45' }, acquis: { fond: '#E3F4EA', couleur: '#1F6B45' },
  partiel: { fond: '#FCF1DC', couleur: '#8A5A0B' }, en_cours: { fond: '#FCF1DC', couleur: '#8A5A0B' },
  non_atteint: { fond: '#FBE4E2', couleur: '#9B2C22' }, non_acquis: { fond: '#FBE4E2', couleur: '#9B2C22' },
}

export function CompteRenduFormationPDF({ org, entete, cr, ancien }: {
  org: any
  entete: EnteteCompteRendu
  cr: CompteRendu | null
  /** Ancien rapport en texte libre, quand il n'y a pas de compte rendu détaillé */
  ancien?: [string, string | null][]
}) {
  return (
    <Document title={`Compte rendu de formation ${entete.reference}`} author={org?.name || 'Lab Learning'}>
      <Page size="A4" style={shared.page}>
        <PdfDocHeader docTitle="Compte rendu de formation" numero={entete.reference} date={entete.transmisLe ? `Transmis le ${entete.transmisLe}` : undefined} statut={entete.statut} org={org} />

        <View style={[shared.section, { backgroundColor: BRAND_ULTRA_LIGHT, borderRadius: 6, padding: 12 }]}>
          <Ligne label="Formation" valeur={entete.formation} />
          <Ligne label="Entreprise" valeur={entete.client} />
          <Ligne label="Dates" valeur={entete.periode} />
          <Ligne label="Durée" valeur={entete.duree} />
          <Ligne label="Lieu" valeur={entete.lieu} />
          <Ligne label="Formateur" valeur={entete.formateur} />
        </View>

        {cr ? (
          <>
            <View style={shared.section}>
              <View minPresenceAhead={70}><PdfSectionTitle icon="calendar">Déroulé de la formation</PdfSectionTitle></View>
              {cr.deroule.map((d) => (
                <View key={`${d.date}-${d.creneau}`} wrap={false} style={{ borderLeftWidth: 2, borderLeftColor: SURFACE_200, paddingLeft: 9, marginBottom: 8 }}>
                  <Text style={{ fontSize: 8.6, fontWeight: 700, color: SURFACE_900, marginBottom: 2 }}>
                    {libelleDemiJournee(d).replace(/^./, (c) => c.toUpperCase())}
                  </Text>
                  <P couleur={d.contenu.trim() ? SURFACE_700 : SURFACE_400}>{d.contenu.trim() || 'Non décrit'}</P>
                  {d.methodes.length > 0 && <Text style={{ fontSize: 7.6, color: SURFACE_500, marginTop: 2 }}>Méthodes : {d.methodes.join(', ')}</Text>}
                </View>
              ))}
            </View>

            {cr.objectifs.length > 0 && (
              <View style={shared.section}>
                <View minPresenceAhead={70}><PdfSectionTitle icon="target">Atteinte des objectifs</PdfSectionTitle></View>
                {cr.objectifs.map((o, i) => (
                  <View key={i} wrap={false} style={{ flexDirection: 'row', gap: 8, marginBottom: 5, alignItems: 'flex-start' }}>
                    <View style={{ width: 92 }}>
                      {o.niveau
                        ? <Pastille texte={LIBELLES_OBJECTIF[o.niveau]} {...TONS[o.niveau]} />
                        : <Pastille texte="Non évalué" fond={SURFACE_50} couleur={SURFACE_400} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <P couleur={SURFACE_900}>{o.objectif}</P>
                      {o.commentaire ? <Text style={{ fontSize: 7.6, color: SURFACE_500 }}>{o.commentaire}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={shared.section} wrap={false}>
              <PdfSectionTitle icon="users">Le groupe</PdfSectionTitle>
              <Ligne label="Niveau à l’entrée" valeur={cr.groupe.niveau} />
              <Ligne label="Participation" valeur={cr.groupe.participation} />
              <Ligne label="Dynamique" valeur={cr.groupe.dynamique} />
              <Ligne label="Assiduité" valeur={cr.groupe.assiduite} />
            </View>

            <View style={shared.section}>
              {/* Le titre ne reste jamais seul en bas de page */}
              <View wrap={false}>
                <PdfSectionTitle icon="clipboardCheck">Évaluation des acquis</PdfSectionTitle>
                <Ligne label="Modalités" valeur={cr.evaluation.modalites.join(', ')} />
                <Ligne label="Résultats d’ensemble" valeur={cr.evaluation.synthese} />
              </View>
              {cr.stagiaires.length > 0 && (
                <View style={{ borderWidth: 0.5, borderColor: SURFACE_200, borderRadius: 6, marginTop: 4 }}>
                  {cr.stagiaires.map((s, i) => (
                    <View key={s.apprenant_id} wrap={false} style={{ flexDirection: 'row', gap: 8, paddingVertical: 5, paddingHorizontal: 9, borderTopWidth: i ? 0.5 : 0, borderTopColor: SURFACE_200 }}>
                      <Text style={{ fontSize: 8.4, color: SURFACE_900, width: 150 }}>{s.nom}</Text>
                      <View style={{ width: 118 }}>
                        {s.acquis
                          ? <Pastille texte={LIBELLES_ACQUIS[s.acquis]} {...TONS[s.acquis]} />
                          : <Pastille texte="Non évalué" fond={SURFACE_50} couleur={SURFACE_400} />}
                      </View>
                      <Text style={{ fontSize: 7.8, color: SURFACE_500, flex: 1 }}>{s.commentaire}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={shared.section} wrap={false}>
              <PdfSectionTitle icon="building">Conditions de réalisation</PdfSectionTitle>
              <Ligne label="Salle et équipements" valeur={cr.conditions.salle} />
              <Ligne label="Précisions" valeur={cr.conditions.commentaire} />
              <Ligne label="Difficultés ou incidents" valeur={cr.conditions.difficultes} />
            </View>

            <View style={shared.section} wrap={false}>
              <PdfSectionTitle icon="award">Bilan et suites</PdfSectionTitle>
              <Ligne label="Points positifs" valeur={cr.bilan.points_positifs} />
              <Ligne label="Retours des stagiaires" valeur={cr.bilan.retours_stagiaires} />
              <Ligne label="Besoins détectés" valeur={cr.bilan.besoins_detectes} />
              <Ligne label="Recommandations" valeur={cr.bilan.recommandations} />
              <Ligne label="Commentaires" valeur={cr.bilan.commentaires} />
            </View>
          </>
        ) : (
          <View style={shared.section}>
            <PdfSectionTitle icon="fileText">Rapport du formateur</PdfSectionTitle>
            {(ancien || []).filter(([, v]) => v && v.trim()).map(([l, v]) => (
              <View key={l} wrap={false} style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 8.6, fontWeight: 700, color: SURFACE_900, marginBottom: 2 }}>{l}</Text>
                <P>{v}</P>
              </View>
            ))}
          </View>
        )}

        <Text style={{ fontSize: 7.6, color: SURFACE_500, marginTop: 6 }}>
          {entete.formateur ? `Compte rendu rédigé par ${entete.formateur}` : 'Compte rendu rédigé par le formateur'}
          {entete.transmisLe ? `, transmis le ${entete.transmisLe}.` : '.'}
        </Text>
        <PdfDocFooter numero={`Compte rendu · ${entete.reference}`} org={org} />
      </Page>
    </Document>
  )
}
