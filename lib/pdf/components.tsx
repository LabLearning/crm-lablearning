import * as React from 'react'
import {
  Document, Page, View, Text, Image, StyleSheet, Font,
} from '@react-pdf/renderer'

// ─── Polices plateforme (Satoshi titres + General Sans corps, via Fontshare) ──
// Mêmes familles que l'UI (cf. app/globals.css) pour des PDF cohérents.
const CDN = 'https://cdn.fontshare.com/wf'
Font.register({
  family: 'Satoshi',
  fonts: [
    { src: `${CDN}/TTX2Z3BF3P6Y5BQT3IV2VNOK6FL22KUT/7QYRJOI3JIMYHGY6CH7SOIFRQLZOLNJ6/KFIAZD4RUMEZIYV6FQ3T3GP5PDBDB6JY.ttf`, fontWeight: 400 },
    { src: `${CDN}/P2LQKHE6KA6ZP4AAGN72KDWMHH6ZH3TA/ZC32TK2P7FPS5GFTL46EU6KQJA24ZYDB/7AHDUZ4A7LFLVFUIFSARGIWCRQJHISQP.ttf`, fontWeight: 500 },
    { src: `${CDN}/LAFFD4SDUCDVQEXFPDC7C53EQ4ZELWQI/PXCT3G6LO6ICM5I3NTYENYPWJAECAWDD/GHM6WVH6MILNYOOCXHXB5GTSGNTMGXZR.ttf`, fontWeight: 700 },
    { src: `${CDN}/NHPGVFYUXYXE33DZ75OIT4JFGHITX5PE/PSUTMASCDJTVPERDYJZPN23BVUFUCQIF/J64QX5IPOHK56I2KYUNBQ5M2XWZEYKYX.ttf`, fontWeight: 900 },
  ],
})
// NB : on utilise Satoshi pour titres ET corps. Le webfont TTF de General Sans
// (Fontshare) est mal décodé par react-pdf (glyphes brouillés) ; Satoshi rend
// parfaitement et reste une police de la plateforme → PDF nets et cohérents.
// Évite les coupures de mots disgracieuses dans les PDF
Font.registerHyphenationCallback((word) => [word])

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
    fontFamily: 'Satoshi',
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
    fontFamily: 'Satoshi', fontWeight: 700,
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
    fontFamily: 'Satoshi', fontWeight: 700,
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
    fontFamily: 'Satoshi', fontWeight: 700,
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
  // Titre de section moderne : Satoshi bold, casse normale, sans lettres espacées
  sectionTitle: {
    fontSize: 10.5,
    fontFamily: 'Satoshi', fontWeight: 700,
    color: SURFACE_900,
    letterSpacing: -0.2,
    marginBottom: 9,
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
    fontSize: 8,
    fontFamily: 'Satoshi', fontWeight: 600,
    color: '#ffffff',
    letterSpacing: 0.1,
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
    fontFamily: 'Satoshi', fontWeight: 700,
    color: BRAND_GREEN,
    width: 120,
    textAlign: 'right',
    marginRight: 12,
  },
  totalTTCValue: {
    fontSize: 10,
    fontFamily: 'Satoshi', fontWeight: 700,
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
    fontFamily: 'Satoshi', fontWeight: 700,
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
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
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

// ─── Cartes de signature (partagées : convention, contrats…) ─────────────────
export interface SignatoryCard {
  title: string            // "Pour l'organisme — Lab Learning"
  name?: string            // nom du signataire
  mention?: string         // "Lu et approuvé, bon pour accord"
  hint?: string            // texte de la zone vide (def. "Signature et cachet")
  signed?: boolean
  signedBy?: string | null
  signedDate?: string | null  // déjà formatée
}

export function PdfSignatureCards({ items, faitMention }: { items: SignatoryCard[]; faitMention?: string }) {
  return (
    <View wrap={false}>
      {faitMention ? (
        <Text style={{ fontSize: 9, color: SURFACE_700, marginTop: 6, marginBottom: 12 }}>{faitMention}</Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 16 }}>
        {items.map((it, i) => (
          <View key={i} style={{ flex: 1, borderWidth: 0.5, borderColor: SURFACE_200, borderRadius: 6, overflow: 'hidden' }}>
            <View style={{ backgroundColor: SURFACE_50, paddingVertical: 6, paddingHorizontal: 10, borderBottomWidth: 0.5, borderBottomColor: SURFACE_200 }}>
              <Text style={{ fontSize: 8, fontFamily: 'Satoshi', fontWeight: 700, color: SURFACE_900 }}>{it.title}</Text>
            </View>
            <View style={{ padding: 10, minHeight: 96 }}>
              {it.name ? <Text style={{ fontSize: 8.5, fontFamily: 'Satoshi', fontWeight: 700, color: SURFACE_900 }}>{it.name}</Text> : null}
              {it.mention ? <Text style={{ fontSize: 7.5, color: SURFACE_500, marginBottom: 8 }}>{it.mention}</Text> : null}
              {it.signed ? (
                <View style={{ backgroundColor: BRAND_LIGHT, padding: 7, borderRadius: 4, marginTop: 4 }}>
                  <Text style={{ fontSize: 8, color: BRAND_GREEN, fontFamily: 'Satoshi', fontWeight: 700 }}>Signé électroniquement</Text>
                  {it.signedBy ? <Text style={{ fontSize: 7.5, color: SURFACE_700 }}>{it.signedBy}</Text> : null}
                  {it.signedDate ? <Text style={{ fontSize: 7, color: SURFACE_400 }}>Le {it.signedDate}</Text> : null}
                </View>
              ) : (
                <Text style={{ fontSize: 7, color: SURFACE_400, marginTop: 4 }}>{it.hint || 'Signature et cachet'}</Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}
