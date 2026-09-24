import * as React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { PdfSectionTitle, PdfDocHeader, PdfDocFooter, shared, BRAND_GREEN, SURFACE_200, SURFACE_500, SURFACE_700, SURFACE_900 } from './components'
import { COMPETENCES_FORMATEUR } from '@/lib/evaluation-formateur'

/**
 * Fiche d'évaluation du profil et des compétences d'un formateur —
 * indicateur 21 du RNQ, sur la trame de l'audit blanc d'août 2026.
 *
 * Les faits (identité, domaines, tarif, note des stagiaires) viennent du CRM ;
 * les jugements (notes par compétence, synthèse) viennent de l'évaluation
 * saisie par la direction pédagogique. Une case non notée reste vide.
 */
export function EvaluationFormateurPDF({ formateur, evaluation, org, nbSessions }: {
  formateur: any
  evaluation: any
  org: any
  nbSessions: number
}) {
  const nom = `${formateur.prenom || ''} ${formateur.nom || ''}`.trim()
  const dateEval = evaluation?.date_evaluation
    ? new Date(evaluation.date_evaluation).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const domaines = Array.isArray(formateur.domaines_expertise)
    ? formateur.domaines_expertise.join(', ')
    : String(formateur.domaines_expertise || '')
  const diplomes = Array.isArray(formateur.diplomes) ? formateur.diplomes.map((d: any) => (d && typeof d === 'object' ? d.intitule : d)).filter(Boolean).join(', ') : String(formateur.diplomes || '')

  const lignes: [string, string][] = [
    ['Prénom et nom', nom],
    ['Société / statut', [formateur.siret ? `SIRET ${formateur.siret}` : null, formateur.type_contrat || null].filter(Boolean).join(' — ') || '—'],
    ['Fonction', 'Formateur — prestataire de formation'],
    ['Domaine d’intervention', domaines || '—'],
    ['Domaine d’étude (formation initiale)', diplomes || '—'],
    ['Compétences / certifications', [formateur.qualifications, formateur.certifications].filter(Boolean).map(String).join(' · ') || '—'],
    ['Certification qualité', formateur.numero_da ? `Organisme déclaré — NDA ${formateur.numero_da}` : '—'],
    ['Disponibilités', evaluation?.disponibilites || formateur.zone_intervention || '—'],
    ['Qualité de la documentation pédagogique', evaluation?.qualite_documentation || ''],
    ['Qualité des échanges avec les stagiaires', [evaluation?.qualite_echanges, formateur.note_moyenne ? `note stagiaires ${Number(formateur.note_moyenne).toFixed(1)}/5` : null].filter(Boolean).join(' — ') || ''],
    ['Tarif', formateur.tarif_journalier ? `${Number(formateur.tarif_journalier).toLocaleString('fr-FR')} € HT / jour` : '—'],
    ['Sessions animées pour Lab Learning', String(nbSessions)],
    ['Date d’évaluation', dateEval],
    ['Note d’évaluation (de 1 à 5)', evaluation?.note_globale != null ? `${evaluation.note_globale} / 5` : ''],
  ]

  return (
    <Document>
      <Page size="A4" style={shared.page}>
        <PdfDocHeader docTitle="Évaluation du profil et des compétences" numero={nom} date={dateEval} org={org} />

        <View style={shared.infoBox}>
          <Text style={{ fontSize: 8, color: SURFACE_700, lineHeight: 1.6 }}>
            Fiche établie au titre de l&apos;indicateur 21 du Référentiel national qualité : détermination,
            mobilisation et évaluation des compétences des intervenants.
          </Text>
        </View>

        <View style={shared.section}>
          <PdfSectionTitle>Profil</PdfSectionTitle>
          {lignes.map(([l, v]) => (
            <View key={l} style={{ flexDirection: 'row', paddingVertical: 2.5, borderBottomWidth: 0.4, borderBottomColor: '#efedea' }}>
              <Text style={{ width: 210, fontSize: 8, color: SURFACE_500 }}>{l}</Text>
              <Text style={{ flex: 1, fontSize: 8.5, color: SURFACE_900 }}>{v}</Text>
            </View>
          ))}
        </View>

        <View style={shared.section}>
          <PdfSectionTitle>Compétences évaluées</PdfSectionTitle>
          {COMPETENCES_FORMATEUR.map((c) => {
            const note = evaluation?.notes?.[c.cle]
            return (
              <View key={c.cle} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3, borderBottomWidth: 0.4, borderBottomColor: '#efedea' }}>
                <Text style={{ flex: 1, fontSize: 8.5, color: SURFACE_900, lineHeight: 1.4 }}>{c.label}</Text>
                <View style={{ flexDirection: 'row', gap: 3, width: 88, justifyContent: 'flex-end' }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <View key={n} style={{
                      width: 13, height: 13, borderRadius: 3, borderWidth: 0.6, borderColor: SURFACE_200,
                      backgroundColor: note === n ? BRAND_GREEN : 'transparent',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ fontSize: 7, color: note === n ? '#ffffff' : SURFACE_500 }}>{n}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )
          })}
          {evaluation?.competences_techniques ? (
            <View style={{ flexDirection: 'row', paddingVertical: 3 }}>
              <Text style={{ width: 210, fontSize: 8, color: SURFACE_500 }}>Compétences techniques</Text>
              <Text style={{ flex: 1, fontSize: 8.5, color: SURFACE_900 }}>{evaluation.competences_techniques}</Text>
            </View>
          ) : null}
        </View>

        {evaluation?.synthese ? (
          <View style={shared.section}>
            <PdfSectionTitle>Synthèse</PdfSectionTitle>
            <Text style={{ fontSize: 8.5, color: SURFACE_900, lineHeight: 1.6 }}>{evaluation.synthese}</Text>
          </View>
        ) : null}

        <PdfDocFooter numero={`Évaluation formateur — ${nom}`} org={org} />
      </Page>
    </Document>
  )
}
