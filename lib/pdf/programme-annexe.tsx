import * as React from 'react'
import { Page, View, Text } from '@react-pdf/renderer'
import { PdfSectionTitle, PdfDocHeader, PdfDocFooter, shared, BRAND_GREEN, SURFACE_500, SURFACE_700, SURFACE_900 } from './components'
import { structurerProgramme } from '@/lib/programme-structure'
import { ProgrammeStructurePdf } from './programme-structure-pdf'

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
