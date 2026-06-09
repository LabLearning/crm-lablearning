import * as React from 'react'
import {
  Document, Page, View, Text, Image, StyleSheet, Font,
} from '@react-pdf/renderer'

// ─── Branding ────────────────────────────────────────────────────────────────
export const BRAND_GREEN = '#195144'
export const BRAND_GREEN_DARK = '#103a30'
export const BRAND_LIGHT = '#e8f3f0'
export const BRAND_ULTRA_LIGHT = '#f4faf7'  // teinte vert très légère pour cartes
export const SURFACE_50 = '#fafafa'
export const SURFACE_100 = '#f5f5f4'
export const SURFACE_200 = '#e7e5e4'
export const SURFACE_400 = '#a8a29e'
export const SURFACE_500 = '#78716C'
export const SURFACE_700 = '#44403C'
export const SURFACE_900 = '#1C1917'

// ─── Shared Styles ────────────────────────────────────────────────────────────
export const shared = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: SURFACE_900,
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 45,
  },
  // Header : barre fine verte en-dessous (pas un trait épais 2pt qui fait "vieux PDF")
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
    paddingBottom: 16,
    borderBottomWidth: 0.7,
    borderBottomColor: SURFACE_200,
  },
  orgName: {
    fontSize: 17,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_GREEN,
    letterSpacing: -0.3,
  },
  orgTagline: {
    fontSize: 8,
    color: SURFACE_500,
    marginTop: 3,
  },
  qualiopiTag: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_GREEN,
    backgroundColor: BRAND_LIGHT,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,  // pill shape
    marginTop: 5,
    letterSpacing: 0.3,
  },
  docTitle: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: SURFACE_900,
    textAlign: 'right',
    letterSpacing: -0.4,
  },
  docMeta: {
    fontSize: 8,
    color: SURFACE_500,
    textAlign: 'right',
    marginTop: 3,
  },
  // Section : plus d'air et titre sans border-bottom (cleaner)
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_GREEN,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    fontSize: 8.5,
    color: SURFACE_500,
    width: 115,
  },
  value: {
    fontSize: 8.5,
    color: SURFACE_900,
    flex: 1,
    lineHeight: 1.45,
  },
  // Table : header vert foncé, lignes mieux respirées, alternées subtiles
  table: {
    marginBottom: 12,
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: BRAND_GREEN,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableHeaderCell: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: SURFACE_200,
  },
  tableRowAlt: {
    backgroundColor: SURFACE_50,
  },
  tableCell: {
    fontSize: 8.5,
    color: SURFACE_700,
  },
  // Totals
  totalsBox: {
    alignItems: 'flex-end',
    marginBottom: 18,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 3,
  },
  totalLabel: {
    fontSize: 8,
    color: SURFACE_500,
    width: 120,
    textAlign: 'right',
    marginRight: 12,
  },
  totalValue: {
    fontSize: 8,
    color: SURFACE_900,
    width: 80,
    textAlign: 'right',
  },
  totalTTCLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_GREEN,
    width: 120,
    textAlign: 'right',
    marginRight: 12,
  },
  totalTTCValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_GREEN,
    width: 80,
    textAlign: 'right',
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 45,
    right: 45,
    borderTopWidth: 0.5,
    borderTopColor: SURFACE_200,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 7,
    color: SURFACE_400,
  },
  // Info box : carte teintée plus douce, sans border-left brutal
  infoBox: {
    backgroundColor: BRAND_ULTRA_LIGHT,
    borderWidth: 0.5,
    borderColor: BRAND_LIGHT,
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  infoBoxText: {
    fontSize: 8.5,
    color: SURFACE_700,
    lineHeight: 1.5,
  },
  // Nouveau : carte neutre avec fond gris très clair
  card: {
    backgroundColor: SURFACE_50,
    borderWidth: 0.5,
    borderColor: SURFACE_200,
    borderRadius: 6,
    padding: 12,
    marginBottom: 14,
  },
  // Nouveau : pill / badge pour statuts
  pill: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    backgroundColor: BRAND_LIGHT,
    color: BRAND_GREEN,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
})

// ─── Shared Header Component ─────────────────────────────────────────────────
export function PdfDocHeader({
  docTitle,
  numero,
  date,
  statut,
  org,
}: {
  docTitle: string
  numero: string
  date: string
  statut?: string
  /** Si fourni, utilise le logo de l'org (logo_url) et son nom ; sinon fallback Lab Learning */
  org?: { name?: string; logo_url?: string | null; numero_da?: string | null; is_qualiopi?: boolean }
}) {
  const orgName = org?.name || 'Lab Learning'
  const isQualiopi = org?.is_qualiopi !== false
  return (
    <View style={shared.header}>
      <View>
        {/* Logo OF (image si dispo, sinon nom en texte) */}
        {org?.logo_url ? (
          <Image src={org.logo_url} style={{ height: 38, width: 95, objectFit: 'contain', marginBottom: 6 }} />
        ) : (
          <Text style={shared.orgName}>{orgName}</Text>
        )}
        {org?.numero_da && <Text style={shared.orgTagline}>N° déclaration d'activité : {org.numero_da}</Text>}
        {isQualiopi && <Text style={shared.qualiopiTag}>Certifié Qualiopi</Text>}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={shared.docTitle}>{docTitle}</Text>
        {numero && <Text style={shared.docMeta}>Réf. {numero}</Text>}
        <Text style={shared.docMeta}>{date}</Text>
        {statut && <View style={{ marginTop: 6 }}><Text style={shared.pill}>{statut}</Text></View>}
      </View>
    </View>
  )
}

// ─── Shared Footer ────────────────────────────────────────────────────────────
export function PdfDocFooter({ numero, org }: { numero: string; org?: { name?: string; email?: string | null; email_contact?: string | null } }) {
  const orgName = org?.name || 'Lab Learning'
  const orgEmail = org?.email_contact || org?.email || 'digital@lab-learning.fr'
  return (
    <View style={shared.footer} fixed>
      <Text style={shared.footerText}>{orgName} · {orgEmail}</Text>
      {numero && <Text style={shared.footerText}>{numero}</Text>}
      <Text
        style={shared.footerText}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  )
}
