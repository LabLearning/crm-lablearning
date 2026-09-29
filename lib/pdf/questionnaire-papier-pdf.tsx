import * as React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import {
  shared, PdfDocHeader, PdfDocFooter,
  BRAND_GREEN, SURFACE_200, SURFACE_400, SURFACE_500, SURFACE_700, SURFACE_900,
} from './components'

export interface QuestionPapier {
  texte: string
  /** choix_unique · choix_multiple · note_1_5 · note_1_10 · nps · texte_libre */
  type: string
  section?: string | null
  choix: string[]
  /** Rang des bonnes réponses dans `choix` (questions de connaissances) */
  correctes?: number[]
}

export interface StagiairePapier {
  nom: string
}

export interface QuestionnairePapier {
  titre: string
  type: string
  questions: QuestionPapier[]
  stagiaires: StagiairePapier[]
  session: {
    reference: string
    formation: string
    client: string
    dates: string
    formateur: string
  }
  org?: any
  editeLe: string
  /** Le corrigé seul, pour le formateur */
  corrige?: boolean
}

const LETTRES = 'ABCDEFGHIJ'

/** Consigne propre à chaque questionnaire, écrite pour le stagiaire. */
const CONSIGNE: Record<string, string> = {
  positionnement:
    "À remplir avec le stagiaire au début de la formation, afin de situer son niveau de départ et d'adapter le déroulé.",
  sortie:
    "À remplir avec le stagiaire au dernier jour, pour mesurer ce qui a été acquis pendant la formation.",
  satisfaction_chaud:
    "À remplir par le stagiaire à l'issue de la formation. Les réponses sont recueillies pour améliorer nos prestations.",
  satisfaction_froid:
    "À remplir par le stagiaire environ trois mois après la formation, pour mesurer l'usage réel des acquis en poste.",
}

const Case = ({ taille = 9 }: { taille?: number }) => (
  <View style={{ width: taille, height: taille, borderWidth: 0.8, borderColor: SURFACE_400, borderRadius: 1.5 }} />
)

/** Lignes vierges pour une réponse rédigée. */
const Lignes = ({ nombre }: { nombre: number }) => (
  <View style={{ marginTop: 5 }}>
    {Array.from({ length: nombre }, (_, i) => (
      <View key={i} style={{ borderBottomWidth: 0.5, borderBottomColor: SURFACE_200, height: 15 }} />
    ))}
  </View>
)

/** Échelle numérotée : le stagiaire entoure ou coche une valeur. */
function Echelle({ de, a }: { de: number; a: number }) {
  const valeurs = Array.from({ length: a - de + 1 }, (_, i) => de + i)
  return (
    <View style={{ flexDirection: 'row', marginTop: 5, gap: 6, flexWrap: 'wrap' }}>
      {valeurs.map((v) => (
        <View key={v} style={{ alignItems: 'center', width: 24 }}>
          <View style={{
            width: 18, height: 18, borderWidth: 0.8, borderColor: SURFACE_400,
            borderRadius: 3, alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 8.5, color: SURFACE_500 }}>{v}</Text>
          </View>
        </View>
      ))}
      <Text style={{ fontSize: 7, color: SURFACE_400, alignSelf: 'flex-end', marginLeft: 4 }}>
        1 = insuffisant · {a} = excellent
      </Text>
    </View>
  )
}

function Question({ q, numero }: { q: QuestionPapier; numero: number }) {
  return (
    <View wrap={false} style={{ marginBottom: 11 }}>
      <View style={{ flexDirection: 'row' }}>
        <Text style={{ fontSize: 9, color: SURFACE_400, width: 16 }}>{numero}.</Text>
        <Text style={{ fontSize: 9.5, color: SURFACE_900, flex: 1 }}>{q.texte}</Text>
      </View>

      <View style={{ marginLeft: 16 }}>
        {(q.type === 'note_1_5' || q.type === 'note_1_10' || q.type === 'nps') && (
          <Echelle de={q.type === 'nps' ? 0 : 1} a={q.type === 'note_1_5' ? 5 : 10} />
        )}

        {(q.type === 'choix_unique' || q.type === 'choix_multiple') && (
          <View style={{ marginTop: 5 }}>
            {q.choix.map((c, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3.5 }}>
                <Case />
                {q.correctes && <Text style={{ fontSize: 8.5, color: SURFACE_500, marginLeft: 6, width: 10 }}>{LETTRES[i]}.</Text>}
                <Text style={{ fontSize: 9, color: SURFACE_900, marginLeft: q.correctes ? 2 : 6, flex: 1 }}>{c}</Text>
              </View>
            ))}
            {/* Un questionnaire sans choix saisis reste utilisable à la main. */}
            {q.choix.length === 0 && <Lignes nombre={2} />}
          </View>
        )}

        {q.type !== 'note_1_5' && q.type !== 'note_1_10' && q.type !== 'nps'
          && q.type !== 'choix_unique' && q.type !== 'choix_multiple' && (
          <Lignes nombre={3} />
        )}
      </View>
    </View>
  )
}

/**
 * Questionnaire vierge à imprimer, un exemplaire par stagiaire.
 *
 * Le formateur mène l'entretien sur ce document et le rapporte rempli : c'est
 * lui la pièce justificative, le CRM n'en conserve que le résultat. L'en-tête
 * est donc pré-rempli — session, formation, stagiaire — pour qu'une feuille
 * ramassée en fin de journée reste rattachable à son dossier.
 */
export function QuestionnairePapierPDF({
  titre, type, questions, stagiaires, session, org, editeLe, corrige,
}: QuestionnairePapier) {
  if (corrige) return <CorrigePDF titre={titre} questions={questions} session={session} org={org} editeLe={editeLe} />
  const consigne = CONSIGNE[type] || "À remplir avec le stagiaire, puis à déposer au dossier de la session."
  // Sans stagiaire rattaché, on imprime tout de même un exemplaire vierge.
  const exemplaires = stagiaires.length > 0 ? stagiaires : [{ nom: '' }]

  // Les questions arrivent groupées par section quand le questionnaire en a.
  const sections: { titre: string | null; questions: QuestionPapier[] }[] = []
  for (const q of questions) {
    const s = q.section || null
    const derniere = sections[sections.length - 1]
    if (derniere && derniere.titre === s) derniere.questions.push(q)
    else sections.push({ titre: s, questions: [q] })
  }

  return (
    <Document>
      {exemplaires.map((st, i) => (
        <Page key={i} size="A4" style={shared.page}>
          <PdfDocHeader docTitle={titre} numero={session.reference} date={session.dates} org={org} />

          {/* Identification — remplie d'avance pour que la feuille reste rattachable */}
          <View style={{
            borderWidth: 0.5, borderColor: SURFACE_200, borderRadius: 4,
            padding: 9, marginBottom: 10,
          }}>
            <View style={{ flexDirection: 'row', marginBottom: 3 }}>
              <Text style={{ fontSize: 8, color: SURFACE_500, width: 62 }}>Stagiaire</Text>
              {st.nom
                ? <Text style={{ fontSize: 9.5, color: SURFACE_900, fontFamily: 'Helvetica-Bold' }}>{st.nom}</Text>
                : <View style={{ flex: 1, borderBottomWidth: 0.5, borderBottomColor: SURFACE_200 }} />}
            </View>
            <View style={{ flexDirection: 'row', marginBottom: 3 }}>
              <Text style={{ fontSize: 8, color: SURFACE_500, width: 62 }}>Formation</Text>
              <Text style={{ fontSize: 9, color: SURFACE_900, flex: 1 }}>{session.formation}</Text>
            </View>
            <View style={{ flexDirection: 'row', marginBottom: 3 }}>
              <Text style={{ fontSize: 8, color: SURFACE_500, width: 62 }}>Entreprise</Text>
              <Text style={{ fontSize: 9, color: SURFACE_900, flex: 1 }}>{session.client}</Text>
            </View>
            <View style={{ flexDirection: 'row' }}>
              <Text style={{ fontSize: 8, color: SURFACE_500, width: 62 }}>Formateur</Text>
              <Text style={{ fontSize: 9, color: SURFACE_900, flex: 1 }}>{session.formateur}</Text>
            </View>
          </View>

          <Text style={{ fontSize: 8.5, color: SURFACE_500, marginBottom: 12, lineHeight: 1.4 }}>{consigne}</Text>

          {sections.map((sec, si) => {
            // Le compteur de questions court sur tout le document, pas par section.
            const depart = sections.slice(0, si).reduce((n, s) => n + s.questions.length, 0)
            return (
              <View key={si}>
                {sec.titre && (
                  <Text style={{
                    fontSize: 9, fontFamily: 'Helvetica-Bold', color: BRAND_GREEN,
                    marginBottom: 7, marginTop: si > 0 ? 6 : 0,
                  }}>
                    {sec.titre}
                  </Text>
                )}
                {sec.questions.map((q, qi) => (
                  <Question key={qi} q={q} numero={depart + qi + 1} />
                ))}
              </View>
            )
          })}

          {questions.length === 0 && (
            <Text style={{ fontSize: 9, color: SURFACE_500 }}>
              Ce questionnaire ne comporte aucune question enregistrée.
            </Text>
          )}

          {/* Signatures — c'est ce qui fait du document une pièce opposable */}
          <View wrap={false} style={{ flexDirection: 'row', gap: 14, marginTop: 16 }}>
            {['Signature du stagiaire', 'Signature du formateur'].map((label) => (
              <View key={label} style={{
                flex: 1, borderWidth: 0.5, borderColor: SURFACE_200,
                borderRadius: 4, padding: 8, height: 62,
              }}>
                <Text style={{ fontSize: 7.5, color: SURFACE_500 }}>{label}</Text>
                <Text style={{ fontSize: 7, color: SURFACE_400, marginTop: 2 }}>Date : ____ / ____ / ________</Text>
              </View>
            ))}
          </View>

          <PdfDocFooter numero={`${session.reference} · édité le ${editeLe}`} org={org} />
        </Page>
      ))}
    </Document>
  )
}

/** Corrigé réservé au formateur : la bonne lettre de chaque question. */
function CorrigePDF({ titre, questions, session, org, editeLe }: Pick<QuestionnairePapier, 'titre' | 'questions' | 'session' | 'org' | 'editeLe'>) {
  const notees = questions.map((q, i) => ({ q, n: i + 1 })).filter(({ q }) => q.correctes && q.correctes.length)
  return (
    <Document>
      <Page size="A4" style={shared.page}>
        <PdfDocHeader docTitle={`Corrigé — ${titre}`} numero={session.reference} date={session.dates} statut="Réservé au formateur" org={org} />
        <Text style={{ fontSize: 8.5, color: SURFACE_500, marginBottom: 12, lineHeight: 1.4 }}>
          À conserver par le formateur, ne pas distribuer. Une bonne réponse vaut un point ; la note se reporte ensuite dans le CRM.
        </Text>
        <View style={{ borderWidth: 0.5, borderColor: SURFACE_200, borderRadius: 4 }}>
          {notees.map(({ q, n }, i) => (
            <View key={n} wrap={false} style={{ flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, borderTopWidth: i ? 0.5 : 0, borderTopColor: SURFACE_200 }}>
              <Text style={{ fontSize: 9, color: SURFACE_400, width: 22 }}>{n}.</Text>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: BRAND_GREEN, width: 44 }}>
                {(q.correctes || []).map((k) => LETTRES[k]).join(', ')}
              </Text>
              <Text style={{ fontSize: 8, color: SURFACE_700, flex: 1 }}>
                {q.correctes!.map((k) => q.choix[k]).join(' / ')}
              </Text>
            </View>
          ))}
        </View>
        <Text style={{ fontSize: 8.5, color: SURFACE_700, marginTop: 12 }}>
          Note sur {notees.length}. Les questions sans bonne réponse (appréciation, texte libre) ne sont pas notées.
        </Text>
        <PdfDocFooter numero={`${session.reference} · corrigé édité le ${editeLe}`} org={org} />
      </Page>
    </Document>
  )
}
