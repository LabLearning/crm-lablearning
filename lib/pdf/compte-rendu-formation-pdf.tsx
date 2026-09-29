import * as React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import {
  PdfDocHeader, PdfDocFooter, PdfSectionTitle, shared,
  BRAND_ULTRA_LIGHT, SURFACE_50, SURFACE_200, SURFACE_400, SURFACE_500, SURFACE_700, SURFACE_900,
} from './components'
import { LIBELLES_ACQUIS, LIBELLES_OBJECTIF, LIBELLES_STATUT_DEMI_JOURNEE, libelleDemiJournee, type CompteRendu } from '../compte-rendu'
import type { AuditEtablissement } from '../audit-hygiene-synthese'

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
    <View style={{ flexDirection: 'row', marginBottom: 4 }} wrap={(valeur || '').length > 300}>
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

export function CompteRenduFormationPDF({ org, entete, cr, ancien, audits }: {
  org: any
  entete: EnteteCompteRendu
  cr: CompteRendu | null
  /** Ancien rapport en texte libre, quand il n'y a pas de compte rendu détaillé */
  ancien?: [string, string | null][]
  /** Audits hygiène de l'établissement autour de la session */
  audits?: { entree: AuditEtablissement | null; sortie: AuditEtablissement | null } | null
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
                <View key={`${d.date}-${d.creneau}`} wrap={d.contenu.length > 600} style={{ borderLeftWidth: 2, borderLeftColor: SURFACE_200, paddingLeft: 9, marginBottom: 8 }}>
                  <Text style={{ fontSize: 8.6, fontWeight: 700, color: SURFACE_900, marginBottom: 2 }}>
                    {libelleDemiJournee(d).replace(/^./, (c) => c.toUpperCase())}
                  </Text>
                  <P couleur={!d.statut && d.contenu.trim() ? SURFACE_700 : SURFACE_400}>{d.statut ? LIBELLES_STATUT_DEMI_JOURNEE[d.statut] : d.contenu.trim() || 'Non décrit'}</P>
                  {!d.statut && d.methodes.length > 0 && <Text style={{ fontSize: 7.6, color: SURFACE_500, marginTop: 2 }}>Méthodes : {d.methodes.join(', ')}</Text>}
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

            <View style={shared.section}>
              <View minPresenceAhead={50}><PdfSectionTitle icon="users">Le groupe</PdfSectionTitle></View>
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
                      <Text style={{ fontSize: 8.4, color: SURFACE_900, width: 150 }}>{s.nom}{s.retire ? ' (inscription annulée)' : ''}</Text>
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

            <View style={shared.section}>
              <View minPresenceAhead={50}><PdfSectionTitle icon="building">Conditions de réalisation</PdfSectionTitle></View>
              <Ligne label="Salle et équipements" valeur={cr.conditions.salle} />
              <Ligne label="Précisions" valeur={cr.conditions.commentaire} />
              <Ligne label="Difficultés ou incidents" valeur={cr.conditions.difficultes} />
            </View>

            <View style={shared.section}>
              <View minPresenceAhead={50}><PdfSectionTitle icon="award">Bilan et suites</PdfSectionTitle></View>
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

        {audits && (audits.entree || audits.sortie) ? <SectionAudits audits={audits} /> : null}

        <Text style={{ fontSize: 7.6, color: SURFACE_500, marginTop: 6 }}>
          {entete.formateur ? `Compte rendu rédigé par ${entete.formateur}` : 'Compte rendu rédigé par le formateur'}
          {entete.transmisLe ? `, transmis le ${entete.transmisLe}.` : '.'}
        </Text>
        <PdfDocFooter numero={`Compte rendu · ${entete.reference}`} org={org} />
      </Page>
    </Document>
  )
}

// ─── Fiche papier à remplir à la main ────────────────────────────────────────

/** Case à cocher dessinée (les glyphes de case ne sont pas dans la police). */
const Case = ({ label }: { label: string }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 10, marginBottom: 4 }}>
    <View style={{ width: 8, height: 8, borderWidth: 0.8, borderColor: SURFACE_500, borderRadius: 1.5 }} />
    <Text style={{ fontSize: 7.8, color: SURFACE_700 }}>{label}</Text>
  </View>
)
const Cases = ({ options }: { options: string[] }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{options.map((o) => <Case key={o} label={o} />)}</View>
)
/** Lignes d'écriture. */
const Lignes = ({ n }: { n: number }) => (
  <View>{Array.from({ length: n }).map((_, i) => <View key={i} style={{ height: 18, borderBottomWidth: 0.6, borderBottomColor: '#BCC6D0' }} />)}</View>
)
const Question = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <View style={{ marginBottom: 8 }} wrap={false}>
    <Text style={{ fontSize: 8.4, fontWeight: 700, color: SURFACE_900, marginBottom: 3 }}>{label}</Text>
    {children}
  </View>
)

/**
 * Compte rendu vierge, sur la structure du formulaire en ligne : le formateur
 * le remplit à la main pendant ou après la session, puis le reporte (ou le
 * dépose au dossier). Demi-journées, objectifs et stagiaires sont imprimés.
 */
export function CompteRenduPapierPDF({ org, entete, cr, listes }: {
  org: any
  entete: EnteteCompteRendu
  /** Compte rendu vierge de la session (demi-journées, objectifs, stagiaires) */
  cr: CompteRendu
  listes: { methodes: string[]; modalites: string[]; niveaux: string[]; participations: string[]; salles: string[] }
}) {
  return (
    <Document title={`Compte rendu à remplir ${entete.reference}`} author={org?.name || 'Lab Learning'}>
      <Page size="A4" style={shared.page}>
        <PdfDocHeader docTitle="Compte rendu de formation" numero={entete.reference} statut="À remplir par le formateur" org={org} />

        <View style={[shared.section, { backgroundColor: BRAND_ULTRA_LIGHT, borderRadius: 6, padding: 12 }]}>
          <Ligne label="Formation" valeur={entete.formation} />
          <Ligne label="Entreprise" valeur={entete.client} />
          <Ligne label="Dates" valeur={entete.periode} />
          <Ligne label="Durée" valeur={entete.duree} />
          <Ligne label="Lieu" valeur={entete.lieu} />
          <Ligne label="Formateur" valeur={entete.formateur} />
        </View>

        <View style={shared.section}>
          <View minPresenceAhead={150}><PdfSectionTitle icon="calendar">Déroulé de la formation</PdfSectionTitle></View>
          <Text style={{ fontSize: 7.8, color: SURFACE_500, marginBottom: 6 }}>Pour chaque demi-journée : ce que vous avez fait avec le groupe, et comment.</Text>
          {cr.deroule.map((d) => (
            <View key={`${d.date}-${d.creneau}`} wrap={false} style={{ borderWidth: 0.5, borderColor: SURFACE_200, borderRadius: 6, padding: 9, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <Text style={{ fontSize: 8.8, fontWeight: 700, color: SURFACE_900 }}>{libelleDemiJournee(d).replace(/^./, (c) => c.toUpperCase())}</Text>
                <View style={{ flexDirection: 'row' }}><Case label="Autre formateur" /><Case label="Pas de formation" /></View>
              </View>
              <Lignes n={4} />
              <Text style={{ fontSize: 7.4, color: SURFACE_500, marginTop: 5, marginBottom: 3 }}>Méthodes utilisées</Text>
              <Cases options={listes.methodes} />
            </View>
          ))}
        </View>

        <View style={shared.section}>
          <View minPresenceAhead={150}><PdfSectionTitle icon="target">Objectifs de la formation</PdfSectionTitle></View>
          {cr.objectifs.map((o, i) => (
            <View key={i} wrap={false} style={{ borderBottomWidth: 0.5, borderBottomColor: SURFACE_200, paddingVertical: 5 }}>
              <Text style={{ fontSize: 8.4, color: SURFACE_900, marginBottom: 3 }}>{o.objectif}</Text>
              <Cases options={['Atteint', 'Partiellement atteint', 'Non atteint']} />
              <Text style={{ fontSize: 7.2, color: SURFACE_400 }}>Si partiel ou non atteint, pourquoi :</Text>
              <Lignes n={1} />
            </View>
          ))}
          <Question label="Autres objectifs travaillés"><Lignes n={2} /></Question>
        </View>

        <View style={shared.section}>
          <View minPresenceAhead={150}><PdfSectionTitle icon="users">Le groupe</PdfSectionTitle></View>
          <Question label="Niveau du groupe à l’entrée"><Cases options={listes.niveaux} /></Question>
          <Question label="Participation"><Cases options={listes.participations} /></Question>
          <Question label="Dynamique et ambiance"><Lignes n={2} /></Question>
          <Question label="Assiduité (retards, absences, départs anticipés)"><Lignes n={2} /></Question>
        </View>

        <View style={shared.section}>
          <View minPresenceAhead={150}><PdfSectionTitle icon="clipboardCheck">Évaluation des acquis</PdfSectionTitle></View>
          <Question label="Modalités d’évaluation"><Cases options={listes.modalites} /></Question>
          <Question label="Résultats d’ensemble"><Lignes n={2} /></Question>
          <Text style={{ fontSize: 8.4, fontWeight: 700, color: SURFACE_900, marginBottom: 4 }}>Acquis de chaque stagiaire</Text>
          <View style={{ borderWidth: 0.5, borderColor: SURFACE_200, borderRadius: 6 }}>
            <View style={{ flexDirection: 'row', backgroundColor: SURFACE_50, paddingVertical: 4, paddingHorizontal: 8 }}>
              <Text style={{ fontSize: 7.2, color: SURFACE_500, width: 130 }}>Stagiaire</Text>
              <Text style={{ fontSize: 7.2, color: SURFACE_500, width: 44, textAlign: 'center' }}>Acquis</Text>
              <Text style={{ fontSize: 7.2, color: SURFACE_500, width: 44, textAlign: 'center' }}>En cours</Text>
              <Text style={{ fontSize: 7.2, color: SURFACE_500, width: 50, textAlign: 'center' }}>Non acquis</Text>
              <Text style={{ fontSize: 7.2, color: SURFACE_500, flex: 1, paddingLeft: 6 }}>Commentaire</Text>
            </View>
            {[...cr.stagiaires, ...Array.from({ length: 2 }).map((_, i) => ({ apprenant_id: `vide-${i}`, nom: '', retire: false }))].map((s: any) => (
              <View key={s.apprenant_id} wrap={false} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 22, paddingHorizontal: 8, borderTopWidth: 0.5, borderTopColor: SURFACE_200 }}>
                <Text style={{ fontSize: 8.2, color: SURFACE_900, width: 130 }}>{s.nom}{s.retire ? ' (annulé)' : ''}</Text>
                {[44, 44, 50].map((w, k) => (
                  <View key={k} style={{ width: w, alignItems: 'center' }}>
                    <View style={{ width: 9, height: 9, borderWidth: 0.8, borderColor: SURFACE_500, borderRadius: 1.5 }} />
                  </View>
                ))}
                <View style={{ flex: 1, height: 14, marginLeft: 6, borderBottomWidth: 0.6, borderBottomColor: '#BCC6D0' }} />
              </View>
            ))}
          </View>
        </View>

        <View style={shared.section}>
          <View minPresenceAhead={150}><PdfSectionTitle icon="building">Conditions de réalisation</PdfSectionTitle></View>
          <Question label="Salle et équipements"><Cases options={listes.salles} /></Question>
          <Question label="Précisions sur les locaux et le matériel"><Lignes n={2} /></Question>
          <Question label="Difficultés ou incidents"><Lignes n={2} /></Question>
        </View>

        <View style={shared.section}>
          <View minPresenceAhead={150}><PdfSectionTitle icon="award">Bilan et suites</PdfSectionTitle></View>
          <Question label="Points positifs"><Lignes n={2} /></Question>
          <Question label="Retours des stagiaires"><Lignes n={2} /></Question>
          <Question label="Besoins détectés (autres salariés à former, formation complémentaire…)"><Lignes n={2} /></Question>
          <Question label="Recommandations"><Lignes n={2} /></Question>
        </View>

        <View wrap={false} style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
          <View style={{ flex: 1, borderWidth: 0.5, borderColor: SURFACE_200, borderRadius: 6, padding: 10, height: 70 }}>
            <Text style={{ fontSize: 7.8, color: SURFACE_500 }}>Date</Text>
          </View>
          <View style={{ flex: 2, borderWidth: 0.5, borderColor: SURFACE_200, borderRadius: 6, padding: 10, height: 70 }}>
            <Text style={{ fontSize: 7.8, color: SURFACE_500 }}>Signature du formateur</Text>
          </View>
        </View>

        <PdfDocFooter numero={`Compte rendu · ${entete.reference}`} org={org} />
      </Page>
    </Document>
  )
}

// ─── Audit hygiène de l'établissement ───────────────────────────────────────

const jourAudit = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '')

function ResumeAudit({ titre, a }: { titre: string; a: AuditEtablissement }) {
  return (
    <View wrap={false} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 0.5, borderColor: SURFACE_200, borderRadius: 6, padding: 9, marginBottom: 6 }}>
      <View style={{ width: 58, alignItems: 'center' }}>
        <Text style={{ fontSize: 16, fontWeight: 700, color: SURFACE_900 }}>{a.score != null ? `${a.score} %` : '—'}</Text>
        {a.mention ? <Text style={{ fontSize: 6.6, color: SURFACE_500, textAlign: 'center' }}>{a.mention}</Text> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 8.6, fontWeight: 700, color: SURFACE_900 }}>{titre}{a.numRapport ? ` · ${a.numRapport}` : ''}</Text>
        <Text style={{ fontSize: 7.8, color: SURFACE_700, marginTop: 1.5 }}>
          {[jourAudit(a.date), a.auditeur ? `par ${a.auditeur}` : null].filter(Boolean).join(' ')}
        </Text>
        <Text style={{ fontSize: 7.6, color: SURFACE_500, marginTop: 1.5 }}>
          {a.conformes} conformes · {a.partiels} partiels · {a.nonConformes} non conformes
        </Text>
      </View>
    </View>
  )
}

/**
 * L'audit hygiène fait à l'entrée (et à la sortie) de l'établissement : ses
 * écarts nourrissent le compte rendu et la suite à donner.
 */
function SectionAudits({ audits }: { audits: { entree: AuditEtablissement | null; sortie: AuditEtablissement | null } }) {
  const { entree, sortie } = audits
  const reference = sortie || entree!
  return (
    <View style={shared.section}>
      <View minPresenceAhead={120}><PdfSectionTitle icon="clipboardCheck">Audit hygiène de l’établissement</PdfSectionTitle></View>
      {entree ? <ResumeAudit titre="Audit d’entrée" a={entree} /> : null}
      {sortie ? <ResumeAudit titre="Audit de sortie" a={sortie} /> : (
        <Text style={{ fontSize: 7.8, color: SURFACE_500, marginBottom: 6 }}>Audit de sortie : en cours d’importation.</Text>
      )}
      {entree && sortie && entree.score != null && sortie.score != null ? (
        <Text style={{ fontSize: 8.2, color: SURFACE_700, marginBottom: 6 }}>
          Évolution : {entree.score} % à {sortie.score} % ({sortie.score - entree.score >= 0 ? '+' : ''}{sortie.score - entree.score} points).
        </Text>
      ) : null}
      {reference.ecarts.length > 0 ? (
        <View style={{ borderWidth: 0.5, borderColor: SURFACE_200, borderRadius: 6, marginTop: 2 }}>
          <View style={{ flexDirection: 'row', backgroundColor: SURFACE_50, paddingVertical: 4, paddingHorizontal: 8 }}>
            <Text style={{ fontSize: 7.2, color: SURFACE_500, width: 120 }}>Écarts relevés {sortie ? '(sortie)' : '(entrée)'}</Text>
            <Text style={{ fontSize: 7.2, color: SURFACE_500, flex: 1 }}>Observation de l’auditeur</Text>
          </View>
          {reference.ecarts.map((e, i) => (
            <View key={i} wrap={false} style={{ flexDirection: 'row', gap: 6, paddingVertical: 4.5, paddingHorizontal: 8, borderTopWidth: 0.5, borderTopColor: SURFACE_200 }}>
              <View style={{ width: 114 }}>
                <Text style={{ fontSize: 7.8, color: SURFACE_900 }}>{e.section} · {e.ref}</Text>
                <Pastille texte={e.niveau === 'non_conforme' ? 'Non conforme' : 'Partiel'} {...(e.niveau === 'non_conforme' ? TONS.non_atteint : TONS.partiel)} />
              </View>
              <Text style={{ fontSize: 7.8, color: SURFACE_700, flex: 1, lineHeight: 1.4 }}>{e.observation || 'Sans observation'}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {reference.documentsManquants.length > 0 ? (
        <View style={{ marginTop: 6 }} wrap={false}>
          <Text style={{ fontSize: 8.2, fontWeight: 700, color: SURFACE_900, marginBottom: 2 }}>Documents obligatoires manquants</Text>
          {reference.documentsManquants.map((d, i) => (
            <Text key={i} style={{ fontSize: 7.8, color: SURFACE_700, lineHeight: 1.4 }}>- {d}</Text>
          ))}
        </View>
      ) : null}
    </View>
  )
}
