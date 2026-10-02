import * as React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import {
  PdfDocHeader, PdfDocFooter, PdfSectionTitle, PdfIcon, shared,
  BRAND_GREEN, BRAND_LIGHT, BRAND_ULTRA_LIGHT, SURFACE_50, SURFACE_200, SURFACE_500, SURFACE_700, SURFACE_900,
} from './components'
import { structurerProgramme } from '@/lib/programme-structure'
import { ProgrammeStructurePdf } from './programme-structure-pdf'

interface ProgrammeFormationProps {
  formation: any; org: any; session?: any
  /** Parcours POEI : dates, durée, entreprise et planning des interventions */
  poei?: any
  /**
   * Programme joint en annexe d'un contrat (convention, contrat formateur) : même
   * contenu que le programme téléchargé seul, sans la grille tarifaire (le prix
   * est celui du contrat), avec la mention de rattachement.
   */
  annexe?: { numero?: string | null; /** « Annexe à la convention CV-… », « Annexe au présent contrat » */ mention: string }
}

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

// Caractères de puce à retirer : puces standard + puces de police Symbol/Wingdings
// collées depuis Word (zone Private Use U+F000–U+F0FF, ex. U+F0B7 qui s'affiche "·").
const BULLET_CHARS = '\\u2022\\u00b7\\u2219\\u25cf\\u25aa\\u25e6\\u2043\\u2013\\u2014\\uf000-\\uf0ff*\\-'
const LEADING_BULLETS = new RegExp(`^(?:\\s*[${BULLET_CHARS}]+)+\\s*`)

// Retire toute puce en tête de ligne (même combinées comme "• ·") pour éviter
// les doubles puces (le PDF ajoute déjà sa propre puce).
function stripBullet(s: string): string {
  return s.replace(LEADING_BULLETS, '').trim()
}

// Nettoie un champ texte multi-ligne : supprime les puces parasites de Word
// (Private Use) partout, pour les sections rendues en texte brut.
function cleanText(s: string | null | undefined): string {
  return (s || '').replace(/[-]/g, '').replace(/[ \t]{2,}/g, ' ')
}

// ── Champs HTML (import Dendreo / éditeur riche) ──
const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ', '&quot;': '"',
  '&#39;': "'", '&apos;': "'", '&eacute;': 'é', '&egrave;': 'è', '&agrave;': 'à', '&ccedil;': 'ç',
}
function decodeEntities(s: string): string {
  return s.replace(/&[a-z#0-9]+;/gi, (m) => HTML_ENTITIES[m.toLowerCase()] ?? ' ')
}

// Fusionne les lignes de continuation : une ligne qui commence en minuscule
// (ou par une parenthèse) alors que la précédente ne finit pas sa phrase est
// la suite de la même phrase, coupée par l'export Word/Dendreo.
function mergeContinuations(lines: string[]): string[] {
  const out: string[] = []
  const endsSentence = (s: string) => /[.!?:)\]]$/.test(s)
  const isUpper = (s: string) => s === s.toUpperCase() && /[A-ZÀ-Ý]/.test(s)
  for (const line of lines) {
    const prev = out[out.length - 1]
    const startsLower = /^[a-zà-ÿ(]/.test(line)
    if (
      prev && !endsSentence(prev) && !/^jour\s*\d/i.test(prev) &&
      (startsLower || (isUpper(prev) && isUpper(line)))
    ) {
      out[out.length - 1] = `${prev} ${line}`
    } else {
      out.push(line)
    }
  }
  return out
}

// Transforme un champ (HTML ou texte brut) en liste d'items propres.
// Gère le HTML Dendreo où une même phrase est éclatée sur plusieurs balises :
//   <ul><li class="p1">Comprendre la méthode</li></ul><p class="p1">HACCP.</p>
// → un <li> ouvre un nouvel item, tout le texte qui suit (p, texte nu)
//   s'accroche à l'item courant jusqu'au <li> suivant.
function fieldItems(s: string | null | undefined): string[] {
  const raw = (s || '').replace(/\r\n?/g, '\n').trim()
  if (!raw) return []

  if (/<[a-z][^>]*>/i.test(raw)) {
    const hasLi = /<li\b/i.test(raw)
    if (hasLi) {
      const items: string[] = []
      let current = ''
      for (const token of raw.split(/(<[^>]+>)/)) {
        if (!token) continue
        if (token.startsWith('<')) {
          if (/^<li\b/i.test(token)) {
            if (current.trim()) items.push(current.trim())
            current = ''
          }
        } else {
          const text = decodeEntities(token).replace(/\s+/g, ' ').trim()
          if (text) current += (current ? ' ' : '') + text
        }
      }
      if (current.trim()) items.push(current.trim())
      return items.map((i) => stripBullet(cleanText(i))).filter(Boolean)
    }
    // HTML sans liste : paragraphes → lignes
    const text = decodeEntities(
      raw.replace(/<\/(p|div|h[1-6])>|<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ')
    )
    return mergeContinuations(text.split('\n').map((l) => stripBullet(cleanText(l)).trim()).filter(Boolean))
  }

  // Texte brut : lignes non vides, puces normalisées
  return mergeContinuations(raw.split('\n').map((l) => stripBullet(cleanText(l)).trim()).filter(Boolean))
}

// Rendu d'un champ : liste à puces si plusieurs items, texte simple sinon
function FieldText({ value, fallback }: { value: string | null | undefined; fallback?: string }) {
  const items = fieldItems(value)
  if (items.length === 0) {
    return fallback ? <Text style={{ fontSize: 8.5, color: SURFACE_700, lineHeight: 1.5 }}>{fallback}</Text> : null
  }
  if (items.length === 1) {
    return <Text style={{ fontSize: 8.5, color: SURFACE_700, lineHeight: 1.5 }}>{items[0]}</Text>
  }
  return (
    <View>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 5, marginBottom: 2 }}>
          <Text style={{ fontSize: 8.5, color: BRAND_GREEN }}>•</Text>
          <Text style={{ fontSize: 8.5, color: SURFACE_700, flex: 1, lineHeight: 1.45 }}>{item}</Text>
        </View>
      ))}
    </View>
  )
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

/** Programme téléchargé seul. */
export function ProgrammeFormationPDF(props: ProgrammeFormationProps) {
  return (
    <Document title={`Programme — ${props.formation?.intitule || ''}`} author={props.org?.name || 'Lab Learning'}>
      <ProgrammeFormationPage {...props} />
    </Document>
  )
}

/** La page du programme, identique seule ou en annexe d'un contrat. */
export function ProgrammeFormationPage({ formation, org, session, poei, annexe }: ProgrammeFormationProps) {
  const jours: any[] = session && Array.isArray(session.horaires_jours) ? session.horaires_jours : []
  const sessionLieu = session ? [session.lieu, session.adresse, [session.code_postal, session.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ') : ''
  // Jours ou semaines, modules, séquences horaires, ateliers : découpage commun à tous les affichages
  const weeks = structurerProgramme(formation.programme_detaille)
  const objectifs: string[] = Array.isArray(formation.objectifs_pedagogiques)
    ? formation.objectifs_pedagogiques.flatMap((o: any) => fieldItems(String(o ?? '')))
    : fieldItems(formation.objectifs_pedagogiques)
  const refHandicap = [org?.referent_handicap_nom, org?.referent_handicap_email, org?.referent_handicap_telephone].filter(Boolean).join(' · ')
  const contact = [org?.email_contact || org?.email, org?.telephone_contact || org?.phone].filter(Boolean).join(' · ')

  return (
      <Page size="A4" style={shared.page}>
        {/* Aucune date sur le programme (ni émission, ni conception, ni mise à jour) : seule la version l'identifie */}
        <PdfDocHeader docTitle={annexe ? 'Annexe — Programme de formation' : 'Programme de formation'} numero={annexe?.numero || formation.reference || ''} org={org} />

        {annexe || formation.version ? (
          <Text style={{ fontSize: 7.5, color: SURFACE_500 as any, marginTop: -4, marginBottom: 8 }}>
            {[
              annexe ? `${annexe.mention}, dont elle fait partie intégrante` : null,
              formation.version ? `${annexe ? 'programme version' : 'Version'} ${formation.version}` : null,
            ].filter(Boolean).join(' · ')}
          </Text>
        ) : null}

        {/* Titre + chips */}
        <View style={{ marginBottom: 18 }}>
          <Text style={{ fontSize: 16, fontFamily: 'Satoshi', fontWeight: 700, color: SURFACE_900, letterSpacing: -0.3 }}>{formation.intitule}</Text>
          {formation.sous_titre ? <Text style={{ fontSize: 9.5, color: SURFACE_500, marginTop: 3 }}>{formation.sous_titre}</Text> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {formation.duree_heures ? <Chip icon="clock">{formation.duree_heures} h{formation.duree_jours ? ` · ${formation.duree_jours} j` : ''}</Chip> : null}
            {formation.modalite ? <Chip icon="monitor">{MODALITE(formation.modalite)}</Chip> : null}
            {formation.categorie ? <Chip icon="list">{formation.categorie}</Chip> : null}
          </View>
        </View>

        {/* Organisation du parcours POEI : dates, durée, entreprise, planning des interventions */}
        {poei ? (
          <View style={shared.section}>
            <PdfSectionTitle icon="calendar">Organisation du parcours POEI</PdfSectionTitle>
            {poei.numero ? <View style={shared.row}><Text style={shared.label}>Parcours</Text><Text style={shared.value}>{poei.numero}</Text></View> : null}
            {poei.date_debut ? (
              <View style={shared.row}><Text style={shared.label}>Dates</Text><Text style={shared.value}>
                {poei.date_fin && poei.date_fin !== poei.date_debut ? `du ${fmtLong(poei.date_debut)} au ${fmtLong(poei.date_fin)}` : `le ${fmtLong(poei.date_debut)}`}
              </Text></View>
            ) : null}
            {poei.duree_heures ? <View style={shared.row}><Text style={shared.label}>Durée du parcours</Text><Text style={shared.value}>{Number(poei.duree_heures).toLocaleString('fr-FR')} heures</Text></View> : null}
            {poei.client ? <View style={shared.row}><Text style={shared.label}>Entreprise</Text><Text style={shared.value}>{poei.client.nom_commercial || poei.client.raison_sociale}{poei.client.ville ? `, ${poei.client.ville}` : ''}</Text></View> : null}
            {poei.poste_vise ? <View style={shared.row}><Text style={shared.label}>Poste visé</Text><Text style={shared.value}>{poei.poste_vise}</Text></View> : null}
            {(poei.interventions || []).length > 0 ? (
              <View style={{ ...shared.table, marginTop: 6 }}>
                <View style={shared.tableHeader}>
                  <Text style={{ ...shared.tableHeaderCell, width: '30%' }}>Module</Text>
                  <Text style={{ ...shared.tableHeaderCell, width: '22%' }}>Dates</Text>
                  <Text style={{ ...shared.tableHeaderCell, width: '10%' }}>Durée</Text>
                  <Text style={{ ...shared.tableHeaderCell, width: '20%' }}>Lieu</Text>
                  <Text style={{ ...shared.tableHeaderCell, width: '18%' }}>Formateur</Text>
                </View>
                {poei.interventions.map((iv: any, idx: number) => {
                  const f = Array.isArray(iv.formateur) ? iv.formateur[0] : iv.formateur
                  const court = (d: string) => new Date(`${String(d).slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
                  const dates = iv.date_debut ? (iv.date_fin && iv.date_fin !== iv.date_debut ? `${court(iv.date_debut)} au ${court(iv.date_fin)}` : court(iv.date_debut)) : 'À planifier'
                  const lieu = [iv.lieu, iv.ville].filter(Boolean).join(', ')
                  return (
                    <View key={idx} wrap={false} style={{ ...shared.tableRow, ...(idx % 2 === 1 ? shared.tableRowAlt : {}) }}>
                      <View style={{ width: '30%' }}>
                        <Text style={shared.tableCell}>{iv.libelle || `Module ${idx + 1}`}</Text>
                        {iv.horaires ? <Text style={{ ...shared.tableCell, fontSize: 6.8, color: SURFACE_500 as any }}>{iv.horaires}</Text> : null}
                      </View>
                      <Text style={{ ...shared.tableCell, width: '22%' }}>{dates}</Text>
                      <Text style={{ ...shared.tableCell, width: '10%' }}>{iv.nb_heures ? `${Number(iv.nb_heures).toLocaleString('fr-FR')} h` : ''}</Text>
                      <Text style={{ ...shared.tableCell, width: '20%' }}>{lieu}</Text>
                      <Text style={{ ...shared.tableCell, width: '18%' }}>{f ? `${f.prenom || ''} ${f.nom || ''}`.trim() : 'À affecter'}</Text>
                    </View>
                  )
                })}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Organisation de la session (uniquement si programme tiré d'une session) */}
        {!poei && session ? (
          <View style={shared.section}>
            <PdfSectionTitle icon="calendar">Organisation de la session</PdfSectionTitle>
            <View style={shared.row}><Text style={shared.label}>Dates</Text><Text style={shared.value}>du {fmtLong(session.date_debut)} au {fmtLong(session.date_fin)}</Text></View>
            {sessionLieu ? <View style={shared.row}><Text style={shared.label}>Lieu</Text><Text style={shared.value}>{sessionLieu}</Text></View> : null}
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
            <FieldText value={formation.public_vise} />
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
            <FieldText value={formation.prerequis} />
          </View>
        ) : null}

        {/* Programme détaillé */}
        {weeks.length > 0 ? (
          <View style={shared.section}>
            <PdfSectionTitle icon="list">Programme détaillé</PdfSectionTitle>
            <ProgrammeStructurePdf groupes={weeks} />
          </View>
        ) : (formation.programme_detaille ? (
          <View style={shared.section}>
            <PdfSectionTitle icon="list">Programme détaillé</PdfSectionTitle>
            <FieldText value={formation.programme_detaille} />
          </View>
        ) : null)}

        {/* Méthodes & moyens — évite le doublon si les 2 champs se recouvrent */}
        {(() => {
          const methItems = fieldItems(formation.methodes_pedagogiques)
          const moyItems = fieldItems(formation.moyens_techniques)
          const norm = (s: string) => s.replace(/\s+/g, ' ').toLowerCase()
          const showMoy = moyItems.length > 0 && !norm(methItems.join(' ')).includes(norm(moyItems.join(' ')))
          const items = [...methItems, ...(showMoy ? moyItems : [])]
          if (items.length === 0) return null
          return (
            <View style={shared.section}>
              <PdfSectionTitle icon="monitor">Méthodes et moyens pédagogiques</PdfSectionTitle>
              {items.length === 1 ? (
                <Text style={{ fontSize: 8.5, color: SURFACE_700, lineHeight: 1.5 }}>{items[0]}</Text>
              ) : (
                <View>
                  {items.map((item, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 5, marginBottom: 2 }}>
                      <Text style={{ fontSize: 8.5, color: BRAND_GREEN }}>•</Text>
                      <Text style={{ fontSize: 8.5, color: SURFACE_700, flex: 1, lineHeight: 1.45 }}>{item}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )
        })()}

        {/* Évaluation */}
        <View style={shared.section}>
          <PdfSectionTitle icon="award">Modalités d'évaluation et de suivi</PdfSectionTitle>
          <FieldText value={formation.modalites_evaluation} fallback="Évaluation des acquis par QCM et mise en situation pratique. Évaluation de satisfaction en fin de formation." />
        </View>

        {/* Admission */}
        {formation.modalites_admission ? (
          <View style={shared.section}>
            <PdfSectionTitle icon="userCheck">Modalités d'admission</PdfSectionTitle>
            <FieldText value={formation.modalites_admission} />
          </View>
        ) : null}

        {/* Tarifs du catalogue : pas en annexe d'un contrat, qui fixe lui-même le prix */}
        {!annexe && (formation.tarif_inter_ht || formation.tarif_intra_ht) ? (
          <View style={shared.section}>
            <PdfSectionTitle icon="banknote">Tarifs</PdfSectionTitle>
            {formation.tarif_inter_ht ? <View style={shared.row}><Text style={shared.label}>Inter-entreprise</Text><Text style={shared.value}>{Number(formation.tarif_inter_ht).toLocaleString('fr-FR').replace(/[\u202F\u00A0]/g, " ")} € HT / personne</Text></View> : null}
            {formation.tarif_intra_ht ? <View style={shared.row}><Text style={shared.label}>Intra-entreprise</Text><Text style={shared.value}>{Number(formation.tarif_intra_ht).toLocaleString('fr-FR').replace(/[\u202F\u00A0]/g, " ")} € HT / groupe</Text></View> : null}
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
            {fieldItems(formation.accessibilite_handicap).join(' ') || "Formation accessible aux personnes en situation de handicap ; contactez notre référent pour étudier les adaptations."}
            {refHandicap ? ` (${refHandicap})` : ''}
          </Text>
          {contact ? <Text style={shared.infoBoxText}><Text style={{ fontFamily: 'Satoshi', fontWeight: 700 }}>Contact : </Text>{contact}</Text> : null}
        </View>

        <PdfDocFooter numero={annexe?.numero || formation.reference || 'PROG'} org={org} />
      </Page>
  )
}
