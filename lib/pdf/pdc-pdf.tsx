import * as React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

// Formulaire officiel France Travail — Plan de développement de compétences (POEI en tutorat).
// Reproduction fidèle, remplie automatiquement pour un candidat.

const FT_MAGENTA = '#A4126E'
const FT_NAVY = '#1B2A6B'
const INK = '#1A1A2E'
const LINE = '#9aa0b4'
const GREY = '#4b5066'

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: INK, paddingTop: 26, paddingBottom: 30, paddingHorizontal: 34, lineHeight: 1.3 },
  // En-tête
  header: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 14 },
  rf: { width: 96, justifyContent: 'center' },
  rfTitle: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: INK, letterSpacing: 0.2 },
  rfSub: { fontSize: 5.5, color: GREY, fontStyle: 'italic', marginTop: 1 },
  ft: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ftDots: { fontSize: 12, color: FT_MAGENTA, fontFamily: 'Helvetica-Bold' },
  ftText: { fontSize: 12, color: FT_NAVY, fontFamily: 'Helvetica-Bold', letterSpacing: -0.2 },
  banner: { flex: 1, backgroundColor: FT_MAGENTA, borderRadius: 3, paddingVertical: 10, paddingHorizontal: 14, justifyContent: 'center' },
  bannerTitle: { color: '#fff', fontSize: 13, fontFamily: 'Helvetica-Bold', letterSpacing: 0.3 },
  bannerSub: { color: '#fff', fontSize: 9, fontFamily: 'Helvetica-Bold', textAlign: 'right', marginTop: 3 },
  // Bandeau de section
  band: { backgroundColor: FT_NAVY, borderRadius: 4, paddingVertical: 5, marginTop: 12, marginBottom: 8 },
  bandText: { color: '#fff', fontSize: 10, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  // Champ
  row: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 6 },
  label: { fontSize: 9, color: INK },
  fill: { flex: 1, borderBottomWidth: 0.7, borderBottomColor: LINE, marginLeft: 4, paddingBottom: 1, minHeight: 11 },
  fillText: { fontSize: 9, color: FT_NAVY, fontFamily: 'Helvetica-Bold' },
  // Cases à cocher
  civ: { flexDirection: 'row', alignItems: 'center', gap: 5, marginRight: 6 },
  box: { width: 9, height: 9, borderRadius: 5, borderWidth: 0.8, borderColor: GREY, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: FT_NAVY, borderColor: FT_NAVY },
  boxDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff' },
  civLbl: { fontSize: 9, color: INK },
  // Tableau
  table: { borderWidth: 0.8, borderColor: FT_NAVY, borderRadius: 3, marginTop: 6, overflow: 'hidden' },
  thead: { flexDirection: 'row', backgroundColor: '#EEF0F8' },
  th: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: FT_NAVY, textAlign: 'center', paddingVertical: 6, paddingHorizontal: 5, borderRightWidth: 0.6, borderRightColor: '#cfd3e6' },
  tr: { flexDirection: 'row', borderTopWidth: 0.6, borderTopColor: '#cfd3e6', minHeight: 40 },
  td: { fontSize: 8, color: INK, padding: 5, borderRightWidth: 0.6, borderRightColor: '#cfd3e6' },
  cDates: { width: '17%' }, cComp: { width: '43%' }, cH: { width: '13%', textAlign: 'center' }, cObj: { width: '27%' },
  footer: { position: 'absolute', bottom: 16, left: 34, right: 34, textAlign: 'center' },
  footerText: { fontSize: 7.5, color: FT_MAGENTA, fontStyle: 'italic' },
})

function fmtDate(d: string | null | undefined): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Parse programme_detaille -> semaines (réutilise le format "Semaine … — Durée : Xh / Module …")
function parseWeeks(text: string) {
  const weeks: { titre: string; duree: string; modules: string[] }[] = []
  let w: any = null
  for (const raw of (text || '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    if (/^Semaine/i.test(line)) {
      const parts = line.split(/\s+[—–-]\s+Durée\s*:\s*/i)
      w = { titre: parts[0].replace(/^Semaine\s*\d+\s*[—–-]\s*/i, '').trim(), duree: (parts[1] || '').trim(), modules: [] }
      weeks.push(w)
    } else if (/^Module/i.test(line) && w) {
      w.modules.push(line.replace(/^Module\s*\d+\s*[—–-]\s*/i, '').replace(/\s*\([^)]*\)\s*$/, '').trim())
    }
  }
  return weeks
}

function Field({ label, value, flex }: { label: string; value?: string; flex?: number }) {
  return (
    <View style={[s.row, flex ? { flex } : {}]}>
      <Text style={s.label}>{label} :</Text>
      <View style={s.fill}><Text style={s.fillText}>{value || ''}</Text></View>
    </View>
  )
}

function Civ({ civilite }: { civilite?: string | null }) {
  const isMme = (civilite || '').toLowerCase().startsWith('mme')
  const isM = !isMme && (civilite || '').toLowerCase().startsWith('m')
  return (
    <>
      <View style={s.civ}><View style={[s.box, isMme ? s.boxOn : {}]}>{isMme ? <View style={s.boxDot} /> : null}</View><Text style={s.civLbl}>Mme</Text></View>
      <View style={s.civ}><View style={[s.box, isM ? s.boxOn : {}]}>{isM ? <View style={s.boxDot} /> : null}</View><Text style={s.civLbl}>M</Text></View>
    </>
  )
}

export function PdcPDF({ candidat, poei, client, formation, session, org }: any) {
  const c = candidat || {}
  const app = c.apprenant || {}
  const cli = client || {}
  const f = formation || {}
  const sess = session || {}

  const stagiaireNom = `${app.prenom || ''} ${app.nom || ''}`.trim()
  const employeurNom = [cli.civilite, cli.prenom, cli.nom].filter(Boolean).join(' ').trim()
  const clientAdresse = cli.adresse || ''
  const clientCP = cli.code_postal || ''
  const clientVille = cli.ville || ''
  const poste = c.poste_vise || poei?.poste_vise || ''
  const dureeTotale = poei?.duree_heures || f.duree_heures || ''
  const tuteurNom = poei?.tuteur_nom || ''

  // Lignes du tableau = semaines du programme, avec dates calées sur les jours de session
  const weeks = parseWeeks(f.programme_detaille || '')
  const jours: any[] = Array.isArray(sess.horaires_jours) ? sess.horaires_jours : []
  const perWeek = weeks.length > 0 ? Math.ceil(jours.length / weeks.length) : 0
  const rows = weeks.map((w, i) => {
    const slice = perWeek ? jours.slice(i * perWeek, i * perWeek + perWeek) : []
    const dates = slice.length ? `${fmtDate(slice[0].date)} → ${fmtDate(slice[slice.length - 1].date)}` : ''
    return { dates, comp: w.modules.join(' · '), heures: w.duree, obj: w.titre }
  })

  return (
    <Document title={`Plan de développement de compétences — ${stagiaireNom}`} author="France Travail">
      <Page size="A4" style={s.page}>
        {/* En-tête France Travail */}
        <View style={s.header}>
          <View style={s.rf}>
            <Text style={s.rfTitle}>RÉPUBLIQUE{'\n'}FRANÇAISE</Text>
            <Text style={s.rfSub}>Liberté · Égalité · Fraternité</Text>
            <View style={s.ft}><Text style={s.ftDots}>::</Text><Text style={s.ftText}>France Travail</Text></View>
          </View>
          <View style={s.banner}>
            <Text style={s.bannerTitle}>PLAN DE DÉVELOPPEMENT DE COMPÉTENCES</Text>
            <Text style={s.bannerSub}>Aide demandeur d'emploi</Text>
          </View>
        </View>

        {/* Section employeur */}
        <View style={s.band}><Text style={s.bandText}>Sous la responsabilité de l'employeur</Text></View>
        <Field label="Nom, prénom de l'employeur" value={employeurNom} />
        <Field label="Raison sociale et enseigne" value={[cli.raison_sociale, cli.sigle].filter(Boolean).join(' — ')} />
        <Field label="Adresse" value={clientAdresse} />
        <View style={s.row}>
          <Text style={s.label}>Code postal :</Text>
          <View style={[s.fill, { maxWidth: 90 }]}><Text style={s.fillText}>{clientCP}</Text></View>
          <Text style={[s.label, { marginLeft: 10 }]}>Ville :</Text>
          <View style={s.fill}><Text style={s.fillText}>{clientVille}</Text></View>
        </View>
        <Field label="Nom du responsable" value={tuteurNom || employeurNom} />
        <View style={s.row}>
          <Text style={s.label}>Téléphone fixe :</Text>
          <View style={[s.fill, { maxWidth: 130 }]}><Text style={s.fillText}>{cli.telephone || ''}</Text></View>
          <Text style={[s.label, { marginLeft: 10 }]}>Téléphone portable :</Text>
          <View style={s.fill}><Text style={s.fillText}>{cli.whatsapp || ''}</Text></View>
        </View>
        <Field label="Adresse mél." value={cli.email || ''} />

        {/* Section POEI */}
        <View style={s.band}><Text style={s.bandText}>Préparation opérationnelle à l'emploi individuelle en tutorat (POEI)</Text></View>
        <Field label="Au poste / métier" value={poste} />
        <View style={s.row}>
          <Text style={s.label}>Date de début :</Text>
          <View style={[s.fill, { maxWidth: 110 }]}><Text style={s.fillText}>{fmtDate(poei?.date_debut || sess.date_debut)}</Text></View>
          <Text style={[s.label, { marginLeft: 12 }]}>Date de fin :</Text>
          <View style={[s.fill, { maxWidth: 110 }]}><Text style={s.fillText}>{fmtDate(poei?.date_fin || sess.date_fin)}</Text></View>
        </View>
        <View style={s.row}>
          <Text style={s.label}>Durée hebdomadaire :</Text>
          <View style={[s.fill, { maxWidth: 90 }]}><Text style={s.fillText}>{jours.length ? '35 h' : ''}</Text></View>
          <Text style={[s.label, { marginLeft: 12 }]}>Durée totale en heures :</Text>
          <View style={[s.fill, { maxWidth: 90 }]}><Text style={s.fillText}>{dureeTotale ? `${dureeTotale} h` : ''}</Text></View>
        </View>
        <View style={s.row}>
          <Text style={s.label}>Date d'embauche prévue dans l'entreprise le :</Text>
          <View style={[s.fill, { maxWidth: 120 }]}><Text style={s.fillText}>{fmtDate(c.date_embauche_prevue || poei?.date_embauche_prevue)}</Text></View>
        </View>

        <View style={[s.row, { marginTop: 4 }]}>
          <Text style={[s.label, { fontFamily: 'Helvetica-Bold' }]}>Stagiaire : </Text>
          <Civ civilite={app.civilite} />
          <Text style={[s.label, { fontStyle: 'italic', marginLeft: 4 }]}>(nom et prénom) :</Text>
          <View style={s.fill}><Text style={s.fillText}>{stagiaireNom}</Text></View>
        </View>
        <View style={s.row}>
          <Text style={[s.label, { fontFamily: 'Helvetica-Bold' }]}>Tuteur : </Text>
          <Civ civilite={null} />
          <Text style={[s.label, { fontStyle: 'italic', marginLeft: 4 }]}>(nom et prénom) :</Text>
          <View style={s.fill}><Text style={s.fillText}>{tuteurNom}</Text></View>
        </View>
        <Field label="Fonction" value={poei?.tuteur_fonction || ''} />

        {/* Tableau compétences */}
        <View style={s.table}>
          <View style={s.thead}>
            <Text style={[s.th, s.cDates]}>Dates</Text>
            <Text style={[s.th, s.cComp]}>Compétences à acquérir, à développer durant la formation en tutorat</Text>
            <Text style={[s.th, s.cH]}>Nombre d'heures</Text>
            <Text style={[s.th, s.cObj, { borderRightWidth: 0 }]}>Objectif pédagogique</Text>
          </View>
          {(rows.length ? rows : [{ dates: '', comp: '', heures: '', obj: '' }, {}, {}, {}, {}]).map((r: any, i: number) => (
            <View key={i} style={s.tr}>
              <Text style={[s.td, s.cDates]}>{r.dates || ''}</Text>
              <Text style={[s.td, s.cComp]}>{r.comp || ''}</Text>
              <Text style={[s.td, s.cH]}>{r.heures || ''}</Text>
              <Text style={[s.td, s.cObj, { borderRightWidth: 0 }]}>{r.obj || ''}</Text>
            </View>
          ))}
        </View>

        <View style={s.footer}><Text style={s.footerText}>3 exemplaires : 1 pour le stagiaire, 1 pour le tuteur et 1 pour l'employeur</Text></View>
      </Page>
    </Document>
  )
}
