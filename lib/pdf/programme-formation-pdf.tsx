import * as React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import {
  PdfDocHeader, PdfDocFooter, PdfSectionTitle, PdfIcon, shared,
  BRAND_GREEN, BRAND_LIGHT, BRAND_ULTRA_LIGHT, SURFACE_50, SURFACE_200, SURFACE_500, SURFACE_700, SURFACE_900,
} from './components'

interface ProgrammeFormationProps { formation: any; org: any; session?: any }

function fmtLong(s: string | null | undefined): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}
function fmtHeure(t: string | null | undefined): string {
  if (!t) return ''
  const [h, m] = String(t).split(':')
  return `${parseInt(h, 10)}h${(m ?? '00').padStart(2, '0')}`
}
function dureeCreneau(d?: string | null, f?: string | null): string {
  if (!d || !f) return ''
  const [dh, dm] = d.split(':').map((x) => parseInt(x, 10))
  const [fh, fm] = f.split(':').map((x) => parseInt(x, 10))
  const mins = (fh * 60 + fm) - (dh * 60 + dm)
  if (mins <= 0) return ''
  const h = Math.floor(mins / 60), m = mins % 60
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

// Retire tout caractère de puce en tête de ligne (•, ·, -, *), même combinés
// comme "• ·", pour éviter les doubles puces (le PDF ajoute déjà sa propre puce).
function stripBullet(s: string): string {
  return s.replace(/^(?:\s*[•·*\-•·]+)+\s*/, '').trim()
}

// Parse le programme_detaille en semaines → modules (objectif + contenu)
function parseProgramme(text: string) {
  const weeks: { titre: string; duree: string; modules: { titre: string; duree: string; objectif: string; bullets: string[] }[] }[] = []
  let week: any = null
  let mod: any = null
  for (const raw of (text || '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    if (/^Semaine/i.test(line)) {
      const parts = line.split(/\s+[—–-]\s+Durée\s*:\s*/i)
      week = { titre: parts[0].trim(), duree: (parts[1] || '').trim(), modules: [] }
      weeks.push(week); mod = null
    } else if (/^Module/i.test(line)) {
      const m = line.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
      mod = { titre: (m ? m[1] : line).trim(), duree: m ? m[2].trim() : '', objectif: '', bullets: [] }
      if (!week) { week = { titre: '', duree: '', modules: [] }; weeks.push(week) }
      week.modules.push(mod)
    } else if (/^Objectif/i.test(line)) {
      if (mod) mod.objectif = line.replace(/^Objectif\s*:\s*/i, '').trim()
    } else if (mod) {
      // Toute autre ligne sous un module = puce de contenu (puces normalisées)
      const cleaned = stripBullet(line)
      // Ignore le libellé "Contenu :" (ce n'est pas une puce)
      if (cleaned && !/^contenu\s*:?\s*$/i.test(cleaned)) mod.bullets.push(cleaned)
    }
  }
  return weeks
}

function Chip({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: SURFACE_50, borderWidth: 0.5, borderColor: SURFACE_200, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 9 }}>
      <PdfIcon name={icon} size={10} color={BRAND_GREEN} />
      <Text style={{ fontSize: 8, color: SURFACE_700, fontFamily: 'Satoshi', fontWeight: 500 }}>{children}</Text>
    </View>
  )
}

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 3.5 }}>
      <View style={{ marginTop: 1 }}><PdfIcon name="check" size={9} color={BRAND_GREEN} /></View>
      <Text style={{ fontSize: 8.5, color: SURFACE_700, flex: 1, lineHeight: 1.45 }}>{children}</Text>
    </View>
  )
}

function DureePill({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: BRAND_LIGHT, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 7 }}>
      <Text style={{ fontSize: 7.5, color: BRAND_GREEN, fontFamily: 'Satoshi', fontWeight: 700 }}>{children}</Text>
    </View>
  )
}

const MODALITE = (m: string) => m === 'presentiel' ? 'Présentiel' : m === 'distanciel' ? 'Distanciel' : 'Mixte'

export function ProgrammeFormationPDF({ formation, org, session }: ProgrammeFormationProps) {
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const jours: any[] = session && Array.isArray(session.horaires_jours) ? session.horaires_jours : []
  const sessionLieu = session ? [session.lieu, session.adresse, [session.code_postal, session.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ') : ''
  const sessionFormateur = session?.formateur ? `${session.formateur.prenom || ''} ${session.formateur.nom || ''}`.trim() : ''
  const weeks = parseProgramme(formation.programme_detaille || '')
  const objectifs: string[] = Array.isArray(formation.objectifs_pedagogiques) ? formation.objectifs_pedagogiques : []
  const refHandicap = [org?.referent_handicap_nom, org?.referent_handicap_email, org?.referent_handicap_telephone].filter(Boolean).join(' · ')
  const contact = [org?.email_contact || org?.email, org?.telephone_contact || org?.phone].filter(Boolean).join(' · ')

  return (
    <Document title={`Programme — ${formation.intitule || ''}`} author={org?.name || 'Lab Learning'}>
      <Page size="A4" style={shared.page}>
        <PdfDocHeader docTitle="Programme de formation" numero={formation.reference || ''} date={today} org={org} />

        {/* Titre + chips */}
        <View style={{ marginBottom: 18 }}>
          <Text style={{ fontSize: 16, fontFamily: 'Satoshi', fontWeight: 700, color: SURFACE_900, letterSpacing: -0.3 }}>{formation.intitule}</Text>
          {formation.sous_titre ? <Text style={{ fontSize: 9.5, color: SURFACE_500, marginTop: 3 }}>{formation.sous_titre}</Text> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            <Chip icon="clock">{formation.duree_heures} h{formation.duree_jours ? ` · ${formation.duree_jours} j` : ''}</Chip>
            <Chip icon="monitor">{MODALITE(formation.modalite)}</Chip>
            {formation.categorie ? <Chip icon="list">{formation.categorie}</Chip> : null}
            {formation.is_poei ? <Chip icon="userCheck">Éligible POEI</Chip> : null}
          </View>
        </View>

        {/* Organisation de la session (uniquement si programme tiré d'une session) */}
        {session ? (
          <View style={shared.section}>
            <PdfSectionTitle icon="calendar">Organisation de la session</PdfSectionTitle>
            <View style={shared.row}><Text style={shared.label}>Dates</Text><Text style={shared.value}>du {fmtLong(session.date_debut)} au {fmtLong(session.date_fin)}</Text></View>
            {sessionLieu ? <View style={shared.row}><Text style={shared.label}>Lieu</Text><Text style={shared.value}>{sessionLieu}</Text></View> : null}
            {sessionFormateur ? <View style={shared.row}><Text style={shared.label}>Formateur</Text><Text style={shared.value}>{sessionFormateur}</Text></View> : null}
            {jours.length > 0 ? (
              <View style={{ ...shared.table, marginTop: 6 }}>
                <View style={shared.tableHeader}>
                  <Text style={{ ...shared.tableHeaderCell, width: '34%' }}>Jour</Text>
                  <Text style={{ ...shared.tableHeaderCell, width: '40%' }}>Horaires</Text>
                  <Text style={{ ...shared.tableHeaderCell, width: '26%' }}>Durée</Text>
                </View>
                {jours.flatMap((j: any, idx: number) => {
                  const cr = [{ d: j.matin_debut, f: j.matin_fin }, { d: j.aprem_debut, f: j.aprem_fin }].filter((c) => c.d && c.f)
                  return cr.map((c, ci) => (
                    <View key={`${idx}-${ci}`} style={{ ...shared.tableRow, ...((idx + ci) % 2 === 1 ? shared.tableRowAlt : {}) }}>
                      <Text style={{ ...shared.tableCell, width: '34%' }}>{ci === 0 ? fmtLong(j.date) : ''}</Text>
                      <Text style={{ ...shared.tableCell, width: '40%' }}>{fmtHeure(c.d)} - {fmtHeure(c.f)}</Text>
                      <Text style={{ ...shared.tableCell, width: '26%' }}>{dureeCreneau(c.d, c.f)}</Text>
                    </View>
                  ))
                })}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Public visé */}
        {formation.public_vise ? (
          <View style={shared.section}>
            <PdfSectionTitle icon="users">Public visé</PdfSectionTitle>
            <Text style={{ fontSize: 8.5, color: SURFACE_700, lineHeight: 1.5 }}>{formation.public_vise}</Text>
          </View>
        ) : null}

        {/* Objectifs */}
        {objectifs.length > 0 ? (
          <View style={shared.section}>
            <PdfSectionTitle icon="target">Objectifs pédagogiques</PdfSectionTitle>
            <Text style={{ fontSize: 8, color: SURFACE_500, marginBottom: 6 }}>À l'issue de la formation, le participant sera capable de :</Text>
            {objectifs.map((o, i) => <CheckItem key={i}>{o}</CheckItem>)}
          </View>
        ) : null}

        {/* Prérequis */}
        {formation.prerequis ? (
          <View style={shared.section}>
            <PdfSectionTitle icon="clipboardCheck">Prérequis</PdfSectionTitle>
            <Text style={{ fontSize: 8.5, color: SURFACE_700, lineHeight: 1.5 }}>{formation.prerequis}</Text>
          </View>
        ) : null}

        {/* Programme détaillé */}
        {weeks.length > 0 ? (
          <View style={shared.section}>
            <PdfSectionTitle icon="list">Programme détaillé</PdfSectionTitle>
            {weeks.map((w, wi) => (
              <View key={wi} style={{ marginBottom: 12 }}>
                {/* Bande semaine */}
                <View wrap={false} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: BRAND_GREEN, borderRadius: 5, paddingVertical: 6, paddingHorizontal: 10, marginBottom: 7 }}>
                  <Text style={{ fontSize: 9, fontFamily: 'Satoshi', fontWeight: 700, color: '#ffffff', flex: 1 }}>{w.titre || `Semaine ${wi + 1}`}</Text>
                  {w.duree ? <View style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingVertical: 2, paddingHorizontal: 7 }}><Text style={{ fontSize: 7.5, color: '#ffffff', fontFamily: 'Satoshi', fontWeight: 700 }}>{w.duree}</Text></View> : null}
                </View>
                {/* Modules */}
                {w.modules.map((m, mi) => (
                  <View key={mi} wrap={false} style={{ marginBottom: 7, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: BRAND_LIGHT }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                      <Text style={{ fontSize: 8.5, fontFamily: 'Satoshi', fontWeight: 700, color: SURFACE_900, flex: 1 }}>{m.titre}</Text>
                      {m.duree ? <DureePill>{m.duree}</DureePill> : null}
                    </View>
                    {m.objectif ? <Text style={{ fontSize: 8, color: SURFACE_500, marginBottom: 3, lineHeight: 1.4 }}>{m.objectif}</Text> : null}
                    {m.bullets.map((b, bi) => (
                      <View key={bi} style={{ flexDirection: 'row', gap: 5, marginBottom: 1.5 }}>
                        <Text style={{ fontSize: 7.5, color: BRAND_GREEN }}>•</Text>
                        <Text style={{ fontSize: 7.5, color: SURFACE_700, flex: 1, lineHeight: 1.35 }}>{b}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : (formation.programme_detaille ? (
          <View style={shared.section}>
            <PdfSectionTitle icon="list">Programme détaillé</PdfSectionTitle>
            <Text style={{ fontSize: 8.5, color: SURFACE_700, lineHeight: 1.6 }}>{formation.programme_detaille}</Text>
          </View>
        ) : null)}

        {/* Méthodes & moyens */}
        {(formation.methodes_pedagogiques || formation.moyens_techniques) ? (
          <View style={shared.section}>
            <PdfSectionTitle icon="monitor">Méthodes et moyens pédagogiques</PdfSectionTitle>
            {formation.methodes_pedagogiques ? <Text style={{ fontSize: 8.5, color: SURFACE_700, lineHeight: 1.5, marginBottom: 5 }}>{formation.methodes_pedagogiques}</Text> : null}
            {formation.moyens_techniques ? <Text style={{ fontSize: 8.5, color: SURFACE_700, lineHeight: 1.5 }}>{formation.moyens_techniques}</Text> : null}
          </View>
        ) : null}

        {/* Évaluation */}
        <View style={shared.section}>
          <PdfSectionTitle icon="award">Modalités d'évaluation et de suivi</PdfSectionTitle>
          <Text style={{ fontSize: 8.5, color: SURFACE_700, lineHeight: 1.5 }}>
            {formation.modalites_evaluation || 'Évaluation des acquis par QCM et mise en situation pratique. Évaluation de satisfaction en fin de formation.'}
          </Text>
        </View>

        {/* Admission */}
        {formation.modalites_admission ? (
          <View style={shared.section}>
            <PdfSectionTitle icon="userCheck">Modalités d'admission</PdfSectionTitle>
            <Text style={{ fontSize: 8.5, color: SURFACE_700, lineHeight: 1.5 }}>{formation.modalites_admission}</Text>
          </View>
        ) : null}

        {/* Tarifs */}
        {(formation.tarif_inter_ht || formation.tarif_intra_ht) ? (
          <View style={shared.section}>
            <PdfSectionTitle icon="banknote">Tarifs</PdfSectionTitle>
            {formation.tarif_inter_ht ? <View style={shared.row}><Text style={shared.label}>Inter-entreprise</Text><Text style={shared.value}>{Number(formation.tarif_inter_ht).toLocaleString('fr-FR')} € HT / personne</Text></View> : null}
            {formation.tarif_intra_ht ? <View style={shared.row}><Text style={shared.label}>Intra-entreprise</Text><Text style={shared.value}>{Number(formation.tarif_intra_ht).toLocaleString('fr-FR')} € HT / groupe</Text></View> : null}
          </View>
        ) : null}

        {/* Accessibilité & contact */}
        <View style={{ ...shared.infoBox, marginTop: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <PdfIcon name="accessibility" size={12} color={BRAND_GREEN} />
            <Text style={{ fontSize: 9, fontFamily: 'Satoshi', fontWeight: 700, color: BRAND_GREEN }}>Accessibilité & informations pratiques</Text>
          </View>
          <Text style={{ ...shared.infoBoxText, marginBottom: 2 }}>
            <Text style={{ fontFamily: 'Satoshi', fontWeight: 700 }}>Délai d'accès : </Text>
            {org?.delai_acces || "Inscription jusqu'à 7 jours ouvrés avant le démarrage, selon les places disponibles."}
          </Text>
          <Text style={{ ...shared.infoBoxText, marginBottom: 2 }}>
            <Text style={{ fontFamily: 'Satoshi', fontWeight: 700 }}>Situation de handicap : </Text>
            {formation.accessibilite_handicap || "Formation accessible aux personnes en situation de handicap ; contactez notre référent pour étudier les adaptations."}
            {refHandicap ? ` (${refHandicap})` : ''}
          </Text>
          {contact ? <Text style={shared.infoBoxText}><Text style={{ fontFamily: 'Satoshi', fontWeight: 700 }}>Contact : </Text>{contact}</Text> : null}
        </View>

        <PdfDocFooter numero={formation.reference || 'PROG'} org={org} />
      </Page>
    </Document>
  )
}
