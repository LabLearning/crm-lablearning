import * as React from 'react'
import {
  Document, Page, View, Text, Image, StyleSheet, Font,
  Svg, Path, Circle, Line, Polyline, Rect,
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

// ─── Icônes Lucide (SVG, partagées) ──────────────────────────────────────────
// Tracés repris de lucide.dev (viewBox 24, stroke). Rendu via @react-pdf Svg.
const ICONS: Record<string, (c: string) => React.ReactNode> = {
  users: (c) => (<>
    <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx={9} cy={7} r={4} stroke={c} strokeWidth={2} fill="none" />
    <Path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </>),
  target: (c) => (<>
    <Circle cx={12} cy={12} r={10} stroke={c} strokeWidth={2} fill="none" />
    <Circle cx={12} cy={12} r={6} stroke={c} strokeWidth={2} fill="none" />
    <Circle cx={12} cy={12} r={2} stroke={c} strokeWidth={2} fill="none" />
  </>),
  list: (c) => (<>
    <Path d="m3 17 2 2 4-4M3 7l2 2 4-4" stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <Line x1={13} y1={6} x2={21} y2={6} stroke={c} strokeWidth={2} strokeLinecap="round" />
    <Line x1={13} y1={12} x2={21} y2={12} stroke={c} strokeWidth={2} strokeLinecap="round" />
    <Line x1={13} y1={18} x2={21} y2={18} stroke={c} strokeWidth={2} strokeLinecap="round" />
  </>),
  clock: (c) => (<>
    <Circle cx={12} cy={12} r={10} stroke={c} strokeWidth={2} fill="none" />
    <Polyline points="12 6 12 12 16 14" stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </>),
  monitor: (c) => (<>
    <Rect x={2} y={3} width={20} height={14} rx={2} stroke={c} strokeWidth={2} fill="none" />
    <Line x1={8} y1={21} x2={16} y2={21} stroke={c} strokeWidth={2} strokeLinecap="round" />
    <Line x1={12} y1={17} x2={12} y2={21} stroke={c} strokeWidth={2} strokeLinecap="round" />
  </>),
  clipboardCheck: (c) => (<>
    <Rect x={8} y={2} width={8} height={4} rx={1} stroke={c} strokeWidth={2} fill="none" />
    <Path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="m9 14 2 2 4-4" stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </>),
  userCheck: (c) => (<>
    <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx={9} cy={7} r={4} stroke={c} strokeWidth={2} fill="none" />
    <Polyline points="16 11 18 13 22 9" stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </>),
  accessibility: (c) => (<>
    <Circle cx={16} cy={4} r={1} stroke={c} strokeWidth={2} fill="none" />
    <Path d="m18 19 1-7-6 1m-5-4 3-3 5.5 3-2.36 3.5M4.24 14.5a5 5 0 0 0 6.88 6M13.76 17.5a5 5 0 0 0-6.88-6" stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </>),
  banknote: (c) => (<>
    <Rect x={2} y={6} width={20} height={12} rx={2} stroke={c} strokeWidth={2} fill="none" />
    <Circle cx={12} cy={12} r={2} stroke={c} strokeWidth={2} fill="none" />
    <Path d="M6 12h.01M18 12h.01" stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" />
  </>),
  award: (c) => (<>
    <Path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526" stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx={12} cy={8} r={6} stroke={c} strokeWidth={2} fill="none" />
  </>),
  check: (c) => (<Polyline points="20 6 9 17 4 12" stroke={c} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />),
  pin: (c) => (<>
    <Path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx={12} cy={10} r={3} stroke={c} strokeWidth={2} fill="none" />
  </>),
  scale: (c) => (<>
    <Path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Zm-14 0 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </>),
  fileText: (c) => (<>
    <Path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M14 2v4a2 2 0 0 0 2 2h4M16 13H8M16 17H8M10 9H8" stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </>),
  building: (c) => (<>
    <Path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01" stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </>),
  penLine: (c) => (<>
    <Path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </>),
  cap: (c) => (<>
    <Path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M22 10v6M6 12.5V16a6 3 0 0 0 12 0v-3.5" stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </>),
  calendar: (c) => (<>
    <Path d="M8 2v4M16 2v4" stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" />
    <Rect x={3} y={4} width={18} height={18} rx={2} stroke={c} strokeWidth={2} fill="none" />
    <Path d="M3 10h18" stroke={c} strokeWidth={2} fill="none" />
  </>),
}

// Choisit une icône selon les mots-clés du libellé de section
function pickIcon(text: string): string {
  const t = (text || '').toLowerCase()
  const has = (...k: string[]) => k.some((w) => t.includes(w))
  if (has('objectif')) return 'target'
  if (has('public', 'participant', 'stagiaire', 'destinataire', 'bénéficiaire', 'beneficiaire')) return 'users'
  if (has('prérequis', 'prerequis')) return 'clipboardCheck'
  if (has('émetteur', 'emetteur', 'organisme', 'employeur', 'facturer', 'entre les parties', 'entreprise')) return 'building'
  if (has('admission')) return 'userCheck'
  if (has('accessibil', 'handicap')) return 'accessibility'
  if (has('signature')) return 'penLine'
  if (has('prix', 'financ', 'tarif', 'règlement', 'reglement', 'paiement', 'facture')) return 'banknote'
  if (has('évaluation', 'evaluation', 'résultat', 'resultat', 'compétence', 'competence', 'sanction', 'attestation', 'certif')) return 'award'
  if (has('moyen', 'méthode', 'methode', 'pédagog', 'pedagog')) return 'monitor'
  if (has('date', 'horaire', 'durée', 'duree', 'délai', 'delai')) return 'calendar'
  if (has('programme', 'détail', 'detail', 'prestation', 'caractéristique', 'caracteristique', 'formation')) return 'list'
  if (has('article', 'clause', 'litige', 'rgpd', 'confidential', 'statut', 'rémunération', 'remuneration', 'mission', 'obligation', 'objet', 'propriété', 'propriete', 'sollicitation', 'dissimulé', 'dissimule', 'protection', 'qualité', 'qualite', 'résiliation', 'resiliation')) return 'scale'
  return 'fileText'
}

function childText(children: React.ReactNode): string {
  let s = ''
  React.Children.forEach(children, (ch) => { if (typeof ch === 'string' || typeof ch === 'number') s += String(ch) })
  return s
}

export function PdfIcon({ name, size = 12, color = BRAND_GREEN }: { name: string; size?: number; color?: string }) {
  const render = ICONS[name]
  if (!render) return null
  return <Svg width={size} height={size} viewBox="0 0 24 24">{render(color)}</Svg>
}

// Titre de section avec icône (moderne). Si `icon` absent, déduit des mots-clés.
export function PdfSectionTitle({ icon, children, color = BRAND_GREEN }: { icon?: string; children: React.ReactNode; color?: string }) {
  const name = icon || pickIcon(childText(children))
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 9 }}>
      <PdfIcon name={name} size={13} color={color} />
      <Text style={{ fontSize: 10.5, fontFamily: 'Satoshi', fontWeight: 700, color: SURFACE_900, letterSpacing: -0.2 }}>{children}</Text>
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
  stamp?: string | null       // URL du tampon/cachet (côté OF) — affiché dans la zone signature
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
            <View style={{ padding: 10, minHeight: 114 }}>
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
              {/* Tampon de l'organisme : grand, posé par-dessus la zone signature (comme un vrai cachet) */}
              {it.stamp ? <Image src={it.stamp} style={{ position: 'absolute', top: 22, left: 14, width: 170, height: 85, objectFit: 'contain' }} /> : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}
