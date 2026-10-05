import * as React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { shared } from './components' // side-effect: enregistre les polices (Satoshi)
import { FACTURE_MODELES, type FactureModele } from './facture-modeles'
import { dureeFr, lignesDetail, type DetailPrestation } from '@/lib/facture-formateur-detail'

/**
 * Facture de prestation émise PAR un formateur À l'organisme (Lab Learning).
 * L'émetteur est le formateur — AUCUN branding Lab Learning : l'OF n'apparaît
 * qu'en « Facturé à ». Trois modèles de style au choix du formateur.
 *
 * Chaque modèle porte le détail de la prestation (formation, dates, durée,
 * client, lieu, stagiaires) quand la facture est rattachée à une session.
 */
export { FACTURE_MODELES, type FactureModele }

function fmt(n: number | string | null | undefined): string {
  if (n == null) return '—'
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[  ]/g, ' ')
}
function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface Parts {
  emetteurNom: string
  emetteurLignes: string[]
  ofNom: string
  ofLignes: string[]
  numAffiche: string
  dateEmission: string
  objet: string | null
  /** Lignes « libellé, valeur » du détail de la prestation ; vide sans session rattachée. */
  detail: [string, string][]
  /** Ligne facturée : « Prestation de formation · 3 jours × 300,00 € ». */
  designation: string
  montantHt: any
  montantTva: any
  montantTtc: any
  tauxTva: number
  mentionTva: string
}

function buildParts(facture: any, formateur: any, org: any, d: DetailPrestation | null): Parts {
  const f = formateur || {}
  const emetteurNom = [f.civilite, f.prenom, f.nom].filter(Boolean).join(' ').trim() || 'Formateur'
  const emetteurLignes = [
    f.adresse,
    [f.code_postal, f.ville].filter(Boolean).join(' ') || null,
    f.siret ? `SIRET : ${f.siret}` : null,
    f.numero_da ? `N° déclaration d'activité : ${f.numero_da}` : null,
    f.email,
  ].filter(Boolean) as string[]

  const ofNom = org?.legal_name || org?.name || 'Lab Learning'
  const ofLignes = [
    org?.address,
    [org?.postal_code, org?.city].filter(Boolean).join(' ') || null,
    org?.siret ? `SIRET : ${org.siret}` : null,
    org?.numero_tva_intra ? `TVA : ${org.numero_tva_intra}` : null,
  ].filter(Boolean) as string[]

  const tauxTva = Number(facture.taux_tva || 0)
  // Le prix par jour n'est écrit que lorsqu'il tombe juste : pas de « 2,5 jours × 466,67 € »
  const calcul = d?.jours && d.tarifJour && Number.isInteger(d.jours) && Number.isInteger(d.tarifJour * 100) && Math.abs(d.jours * d.tarifJour - Number(facture.montant_ht || 0)) < 0.01
    ? `${d.jours} ${d.jours > 1 ? 'jours' : 'jour'} × ${fmt(d.tarifJour)} €`
    : d ? dureeFr(d) : null
  return {
    emetteurNom, emetteurLignes, ofNom, ofLignes,
    numAffiche: facture.reference_externe || facture.numero,
    dateEmission: fmtDate(facture.date_emission || facture.created_at),
    objet: facture.objet || null,
    detail: d ? lignesDetail(d) : (facture.session?.reference ? [['Session', String(facture.session.reference)]] : []),
    designation: ['Prestation de formation', calcul].filter(Boolean).join(' · '),
    montantHt: facture.montant_ht, montantTva: facture.montant_tva, montantTtc: facture.montant_ttc,
    tauxTva,
    mentionTva: tauxTva === 0
      ? "TVA non applicable (art. 293 B ou 261-4-4° a du CGI, selon le régime de l'émetteur)."
      : 'TVA acquittée sur les encaissements (prestations de services).',
  }
}

/** Le détail de la prestation, une ligne par information : commun aux trois modèles. */
function DetailLignes({ lignes, couleurLibelle }: { lignes: [string, string][]; couleurLibelle: string }) {
  return (
    <View>
      {lignes.map(([libelle, valeur]) => (
        <View key={libelle} style={{ flexDirection: 'row', marginBottom: 2.5 }}>
          <Text style={{ width: 62, fontSize: 8, color: couleurLibelle }}>{libelle}</Text>
          <Text style={{ flex: 1, fontSize: 9, lineHeight: 1.35 }}>{valeur}</Text>
        </View>
      ))}
    </View>
  )
}

// ─────────────────────────── Modèle « Épuré » ───────────────────────────
const ep = StyleSheet.create({
  page: { padding: 48, fontFamily: 'Satoshi', fontSize: 9, color: '#0F1720' },
  name: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  meta: { fontSize: 9, color: '#6B7885' },
  small: { fontSize: 8, color: '#6B7885', lineHeight: 1.5 },
  rule: { borderTopWidth: 1, borderTopColor: '#0F1720', marginVertical: 20 },
  ruleThin: { borderTopWidth: 0.5, borderTopColor: '#CBD3DB', marginVertical: 14 },
  label: { fontSize: 7, letterSpacing: 1, textTransform: 'uppercase', color: '#9AA6B2', marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  totLabel: { fontSize: 9, color: '#4E5A67' },
  totVal: { fontSize: 9 },
  ttcLabel: { fontSize: 12, fontWeight: 700 },
  ttcVal: { fontSize: 12, fontWeight: 700 },
})
function ModeleEpure({ p }: { p: Parts }) {
  return (
    <Page size="A4" style={ep.page}>
      <View style={ep.row}>
        <View style={{ maxWidth: 300 }}>
          <Text style={ep.name}>{p.emetteurNom}</Text>
          {p.emetteurLignes.map((l, i) => <Text key={i} style={ep.small}>{l}</Text>)}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>FACTURE</Text>
          <Text style={ep.meta}>N° {p.numAffiche}</Text>
          <Text style={ep.meta}>{p.dateEmission}</Text>
        </View>
      </View>

      <View style={ep.rule} />

      <View style={{ marginBottom: 4 }}>
        <Text style={ep.label}>Facturé à</Text>
        <Text style={{ fontSize: 10, fontWeight: 700 }}>{p.ofNom}</Text>
        {p.ofLignes.map((l, i) => <Text key={i} style={ep.small}>{l}</Text>)}
      </View>

      {p.objet ? (
        <>
          <View style={ep.ruleThin} />
          <Text style={ep.label}>Objet</Text>
          <Text style={{ fontSize: 9 }}>{p.objet}</Text>
        </>
      ) : null}

      {p.detail.length > 0 ? (
        <>
          <View style={ep.ruleThin} />
          <Text style={ep.label}>Détail de la prestation</Text>
          <DetailLignes lignes={p.detail} couleurLibelle="#6B7885" />
        </>
      ) : null}

      <View style={ep.ruleThin} />
      <View style={{ ...ep.row, marginBottom: 8 }}>
        <Text style={{ fontSize: 9, color: '#4E5A67' }}>{p.designation}</Text>
        <Text style={{ fontSize: 9 }}>{fmt(p.montantHt)} €</Text>
      </View>

      <View style={{ marginLeft: 'auto', width: 220, marginTop: 6 }}>
        <View style={{ ...ep.row, marginBottom: 3 }}><Text style={ep.totLabel}>Total HT</Text><Text style={ep.totVal}>{fmt(p.montantHt)} €</Text></View>
        <View style={{ ...ep.row, marginBottom: 6 }}><Text style={ep.totLabel}>TVA ({fmt(p.tauxTva)}%)</Text><Text style={ep.totVal}>{fmt(p.montantTva)} €</Text></View>
        <View style={{ borderTopWidth: 1, borderTopColor: '#0F1720', paddingTop: 6, ...ep.row }}>
          <Text style={ep.ttcLabel}>Total TTC</Text><Text style={ep.ttcVal}>{fmt(p.montantTtc)} €</Text>
        </View>
      </View>

      <View style={{ position: 'absolute', bottom: 40, left: 48, right: 48 }}>
        <View style={{ borderTopWidth: 0.5, borderTopColor: '#CBD3DB', paddingTop: 8 }}>
          <Text style={ep.small}>{p.mentionTva}</Text>
          <Text style={ep.small}>Facture émise dans le cadre d'une sous-traitance pédagogique.</Text>
        </View>
      </View>
    </Page>
  )
}

// ─────────────────────────── Modèle « Classique » ───────────────────────
const cl = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Satoshi', fontSize: 9, color: '#0F1720' },
  box: { borderWidth: 1, borderColor: '#0F1720', padding: 14 },
  boxLight: { borderWidth: 1, borderColor: '#CBD3DB', padding: 12 },
  h: { fontSize: 20, fontWeight: 700, letterSpacing: 1 },
  small: { fontSize: 8, color: '#4E5A67', lineHeight: 1.5 },
  label: { fontSize: 7, letterSpacing: 1, textTransform: 'uppercase', color: '#6B7885', marginBottom: 4 },
  th: { flexDirection: 'row', backgroundColor: '#0F1720', paddingVertical: 6, paddingHorizontal: 8 },
  thc: { color: '#ffffff', fontSize: 8, fontWeight: 700 },
  td: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#E1E6EB' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
})
function ModeleClassique({ p }: { p: Parts }) {
  return (
    <Page size="A4" style={cl.page}>
      <View style={{ ...cl.box, flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ maxWidth: 280 }}>
          <Text style={{ fontSize: 12, fontWeight: 700, marginBottom: 3 }}>{p.emetteurNom}</Text>
          {p.emetteurLignes.map((l, i) => <Text key={i} style={cl.small}>{l}</Text>)}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={cl.h}>FACTURE</Text>
          <Text style={{ fontSize: 9, marginTop: 4 }}>N° {p.numAffiche}</Text>
          <Text style={{ fontSize: 9, color: '#4E5A67' }}>Date : {p.dateEmission}</Text>
        </View>
      </View>

      <View style={{ marginTop: 14, ...cl.boxLight }}>
        <Text style={cl.label}>Facturé à</Text>
        <Text style={{ fontSize: 10, fontWeight: 700 }}>{p.ofNom}</Text>
        {p.ofLignes.map((l, i) => <Text key={i} style={cl.small}>{l}</Text>)}
      </View>

      {p.objet ? (
        <View style={{ marginTop: 14 }}>
          <Text style={cl.label}>Objet</Text>
          <Text style={{ fontSize: 9 }}>{p.objet}</Text>
        </View>
      ) : null}

      {p.detail.length > 0 ? (
        <View style={{ marginTop: 14, ...cl.boxLight }}>
          <Text style={cl.label}>Détail de la prestation</Text>
          <DetailLignes lignes={p.detail} couleurLibelle="#4E5A67" />
        </View>
      ) : null}

      <View style={{ marginTop: 14, borderWidth: 1, borderColor: '#0F1720' }}>
        <View style={cl.th}>
          <Text style={{ ...cl.thc, flex: 4 }}>Désignation</Text>
          <Text style={{ ...cl.thc, width: 90, textAlign: 'right' }}>Montant HT</Text>
        </View>
        <View style={cl.td}>
          <Text style={{ flex: 4, fontSize: 9 }}>{p.designation}</Text>
          <Text style={{ width: 90, textAlign: 'right', fontSize: 9 }}>{fmt(p.montantHt)} €</Text>
        </View>
        <View style={{ padding: 8 }}>
          <View style={{ marginLeft: 'auto', width: 200 }}>
            <View style={{ ...cl.row, marginBottom: 3 }}><Text style={{ fontSize: 9, color: '#4E5A67' }}>Total HT</Text><Text style={{ fontSize: 9 }}>{fmt(p.montantHt)} €</Text></View>
            <View style={{ ...cl.row, marginBottom: 5 }}><Text style={{ fontSize: 9, color: '#4E5A67' }}>TVA ({fmt(p.tauxTva)}%)</Text><Text style={{ fontSize: 9 }}>{fmt(p.montantTva)} €</Text></View>
            <View style={{ ...cl.row, borderTopWidth: 1, borderTopColor: '#0F1720', paddingTop: 5 }}>
              <Text style={{ fontSize: 12, fontWeight: 700 }}>Total TTC</Text><Text style={{ fontSize: 12, fontWeight: 700 }}>{fmt(p.montantTtc)} €</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={{ position: 'absolute', bottom: 36, left: 40, right: 40 }}>
        <Text style={cl.small}>{p.mentionTva}</Text>
        <Text style={cl.small}>Facture émise dans le cadre d'une sous-traitance pédagogique.</Text>
      </View>
    </Page>
  )
}

// ─────────────────────────── Modèle « Moderne » ─────────────────────────
const ACCENT = '#4338ca' // indigo — volontairement distinct du vert Lab Learning
const mo = StyleSheet.create({
  page: { fontFamily: 'Satoshi', fontSize: 9, color: '#0F1720' },
  band: { backgroundColor: ACCENT, paddingHorizontal: 40, paddingVertical: 28, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  bandName: { color: '#ffffff', fontSize: 16, fontWeight: 700 },
  bandSmall: { color: '#c7d2fe', fontSize: 8, lineHeight: 1.5, marginTop: 3 },
  bandTitle: { color: '#ffffff', fontSize: 20, fontWeight: 700, letterSpacing: 2 },
  body: { paddingHorizontal: 40, paddingTop: 22 },
  label: { fontSize: 7, letterSpacing: 1, textTransform: 'uppercase', color: ACCENT, fontWeight: 700, marginBottom: 4 },
  small: { fontSize: 8, color: '#4E5A67', lineHeight: 1.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  card: { backgroundColor: '#f5f3ff', borderRadius: 8, padding: 14, marginLeft: 'auto', width: 240, marginTop: 18 },
})
function ModeleModerne({ p }: { p: Parts }) {
  return (
    <Page size="A4" style={mo.page}>
      <View style={mo.band}>
        <View style={{ maxWidth: 300 }}>
          <Text style={mo.bandName}>{p.emetteurNom}</Text>
          {p.emetteurLignes.map((l, i) => <Text key={i} style={mo.bandSmall}>{l}</Text>)}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={mo.bandTitle}>FACTURE</Text>
          <Text style={{ color: '#e0e7ff', fontSize: 9, marginTop: 4 }}>N° {p.numAffiche}</Text>
          <Text style={{ color: '#c7d2fe', fontSize: 9 }}>{p.dateEmission}</Text>
        </View>
      </View>

      <View style={mo.body}>
        <View style={{ marginBottom: 16 }}>
          <Text style={mo.label}>Facturé à</Text>
          <Text style={{ fontSize: 10, fontWeight: 700 }}>{p.ofNom}</Text>
          {p.ofLignes.map((l, i) => <Text key={i} style={mo.small}>{l}</Text>)}
        </View>

        {p.objet ? (
          <View style={{ marginBottom: 16 }}>
            <Text style={mo.label}>Objet</Text>
            <Text style={{ fontSize: 9 }}>{p.objet}</Text>
          </View>
        ) : null}

        {p.detail.length > 0 ? (
          <View style={{ marginBottom: 16 }}>
            <Text style={mo.label}>Détail de la prestation</Text>
            <DetailLignes lignes={p.detail} couleurLibelle="#4E5A67" />
          </View>
        ) : null}

        <View style={{ borderTopWidth: 2, borderTopColor: ACCENT, paddingTop: 10 }}>
          <View style={{ ...mo.row, marginBottom: 6 }}>
            <Text style={{ fontSize: 9, color: '#4E5A67' }}>{p.designation}</Text>
            <Text style={{ fontSize: 9 }}>{fmt(p.montantHt)} €</Text>
          </View>
        </View>

        <View style={mo.card}>
          <View style={{ ...mo.row, marginBottom: 4 }}><Text style={{ fontSize: 9, color: '#4E5A67' }}>Total HT</Text><Text style={{ fontSize: 9 }}>{fmt(p.montantHt)} €</Text></View>
          <View style={{ ...mo.row, marginBottom: 6 }}><Text style={{ fontSize: 9, color: '#4E5A67' }}>TVA ({fmt(p.tauxTva)}%)</Text><Text style={{ fontSize: 9 }}>{fmt(p.montantTva)} €</Text></View>
          <View style={{ ...mo.row, borderTopWidth: 1, borderTopColor: '#ddd6fe', paddingTop: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>Total TTC</Text>
            <Text style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>{fmt(p.montantTtc)} €</Text>
          </View>
        </View>
      </View>

      <View style={{ position: 'absolute', bottom: 36, left: 40, right: 40 }}>
        <Text style={mo.small}>{p.mentionTva}</Text>
        <Text style={mo.small}>Facture émise dans le cadre d'une sous-traitance pédagogique.</Text>
      </View>
    </Page>
  )
}

export function FactureFormateurPDF({ facture, formateur, org, modele = 'epure', detail = null }: {
  facture: any; formateur: any; org?: any; modele?: FactureModele
  /** Détail de la prestation (lib/facture-formateur-detail) ; absent pour une facture sans session. */
  detail?: DetailPrestation | null
}) {
  const p = buildParts(facture, formateur, org, detail)
  // Ref shared pour garantir le chargement des polices même si l'arbre ne l'utilise pas.
  void shared
  return (
    <Document title={`Facture ${p.numAffiche}`} author={p.emetteurNom}>
      {modele === 'classique' ? <ModeleClassique p={p} />
        : modele === 'moderne' ? <ModeleModerne p={p} />
        : <ModeleEpure p={p} />}
    </Document>
  )
}
