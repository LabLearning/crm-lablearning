import * as React from 'react'
import { Page, View, Text } from '@react-pdf/renderer'
import { PdfSectionTitle, PdfDocHeader, PdfDocFooter, shared, BRAND_GREEN, SURFACE_500, SURFACE_700, SURFACE_900 } from './components'

// Nettoie le HTML éventuel (contenus importés de Dendreo)
function cleanHtml(v: string): string {
  return v
    .replace(/\r\n?/g, '\n')
    .replace(/<\s*(br|\/p|\/li|\/ul|\/ol|\/div|\/h[1-6])[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c, 10)))
    .replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/\n{2,}/g, '\n')
    .trim()
}

function toList(v: any): string[] | null {
  if (v == null) return null
  if (Array.isArray(v)) return v.flatMap((x) => cleanHtml(String(x)).split(/\r?\n/)).map((x) => x.trim()).filter(Boolean)
  const parts = cleanHtml(String(v)).split(/\r?\n|•|;/).map((x) => x.trim()).filter(Boolean)
  return parts.length ? parts : null
}

function Bullets({ items }: { items: string[] }) {
  return (
    <>
      {items.map((it, i) => (
        <View key={i} wrap={false} style={{ flexDirection: 'row', marginBottom: 3 }}>
          <Text style={{ fontSize: 8.5, color: BRAND_GREEN, width: 12 }}>•</Text>
          <Text style={{ fontSize: 8.5, color: SURFACE_700, flex: 1, lineHeight: 1.45 }}>{it}</Text>
        </View>
      ))}
    </>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', marginBottom: 4 }}>
      <Text style={{ fontSize: 8.5, color: SURFACE_500, width: 130 }}>{label}</Text>
      <Text style={{ fontSize: 8.5, color: SURFACE_700, flex: 1, lineHeight: 1.45 }}>{value}</Text>
    </View>
  )
}

/** Y a-t-il de la matière pour une annexe programme ? */
export function hasProgrammeContent(formation: any): boolean {
  if (!formation) return false
  return !!(
    formation.objectifs_pedagogiques || formation.programme_detaille || formation.prerequis ||
    formation.public_vise || formation.methodes_pedagogiques || formation.moyens_techniques ||
    formation.modalites_evaluation
  )
}

/**
 * Page(s) d'annexe « Programme de formation », partagée par la convention et le
 * contrat formateur : intitulé, public/prérequis, objectifs, programme détaillé,
 * moyens et modalités d'évaluation. Rendue en fin de document.
 */
export function ProgrammeAnnexePage({ formation, org, numero, rattachement = 'la présente convention' }: {
  formation: any
  org: any
  numero?: string | null
  rattachement?: string
}) {
  const publicVise = formation.public_vise ? cleanHtml(String(formation.public_vise)) : null
  const prerequis = formation.prerequis ? cleanHtml(String(formation.prerequis)) : null
  const objectifs = toList(formation.objectifs_pedagogiques)
  const programme = toList(formation.programme_detaille)
  const moyens = toList(formation.methodes_pedagogiques) || toList(formation.moyens_techniques)
  const modalitesEval = toList(formation.modalites_evaluation)
  const titre = formation.intitule || 'Formation'

  return (
    <Page size="A4" style={shared.page}>
      <PdfDocHeader docTitle="Annexe — Programme de formation" numero={numero || formation.reference || ''} date={titre} org={org} />

      <View style={shared.section}>
        <PdfSectionTitle>Formation</PdfSectionTitle>
        <Text style={{ fontSize: 9, fontFamily: 'Satoshi', fontWeight: 700, color: SURFACE_900 }}>{titre}</Text>
        <Text style={{ fontSize: 8, color: SURFACE_500, marginTop: 2 }}>
          Annexe à {rattachement}{numero ? ` ${numero}` : ''} — fait partie intégrante.
        </Text>
      </View>

      {(publicVise || prerequis) && (
        <View style={shared.section}>
          <PdfSectionTitle>Public visé et prérequis</PdfSectionTitle>
          {publicVise && <InfoRow label="Public visé" value={publicVise} />}
          {prerequis && <InfoRow label="Prérequis" value={prerequis} />}
        </View>
      )}

      {objectifs && objectifs.length > 0 && (
        <View style={shared.section}>
          <PdfSectionTitle>Objectifs pédagogiques</PdfSectionTitle>
          <Text style={{ fontSize: 8.5, color: SURFACE_700, marginBottom: 6 }}>À l'issue de la formation, les participants seront capables de :</Text>
          <Bullets items={objectifs} />
        </View>
      )}

      {programme && programme.length > 0 && (
        <View style={shared.section}>
          <PdfSectionTitle>Programme de la formation</PdfSectionTitle>
          {programme.map((line, i) => {
            const isModule = /^module|^jour|^partie|^s[ée]quence/i.test(line)
            return (
              <Text key={i} style={{ fontSize: 8.5, color: isModule ? SURFACE_900 : SURFACE_700, fontFamily: 'Satoshi', fontWeight: isModule ? 700 : 400, marginBottom: 2, marginTop: isModule ? 4 : 0, lineHeight: 1.45 }}>
                {isModule ? line : `•  ${line.replace(/^[-•]\s*/, '')}`}
              </Text>
            )
          })}
        </View>
      )}

      {moyens && moyens.length > 0 && (
        <View style={shared.section}>
          <PdfSectionTitle>Moyens et supports pédagogiques</PdfSectionTitle>
          <Bullets items={moyens} />
        </View>
      )}

      {modalitesEval && modalitesEval.length > 0 && (
        <View style={shared.section}>
          <PdfSectionTitle>Modalités d'évaluation des acquis</PdfSectionTitle>
          <Bullets items={modalitesEval} />
        </View>
      )}

      <PdfDocFooter numero={numero || formation.reference || 'PROG'} org={org} />
    </Page>
  )
}
