import * as React from 'react'
import { View, Text } from '@react-pdf/renderer'
import { BRAND_GREEN, BRAND_LIGHT, BRAND_ULTRA_LIGHT, SURFACE_500, SURFACE_700, SURFACE_900 } from './components'
import type { GroupeProgramme } from '@/lib/programme-structure'
import { textePdf } from './texte-pdf'

/**
 * Programme détaillé mis en page : bande par jour ou semaine, modules et
 * séquences avec leur horaire, objectif, puces, ateliers mis en évidence.
 * Même rendu sur le programme de formation et sur l'annexe des conventions.
 *
 * Tout est rendu à plat, en blocs insécables posés directement dans la
 * section : une bande, un titre de module ou une ligne qui ne tient plus en
 * bas de page passe entier à la page suivante. Pas de vues imbriquées
 * (jour > module > lignes) : react-pdf garde sur la page un module dont le
 * premier bloc ne tient pas quand ce module ouvre son jour, et l'écrase dans
 * la place restante (texte superposé, programme de la POEI RS Food, 27/10/2026).
 * `titre` (le titre de la section) tient avec le premier bloc.
 * L'espace entre modules est une marge HAUTE : react-pdf envoie à la page
 * suivante un bloc qui tient mais dont la marge basse dépasse le bas de page.
 */
const majuscule = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t)

// Filet vert à gauche d'un module : repris sur chaque bloc, sans marge entre eux, il reste continu
const CADRE = { paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: BRAND_LIGHT }

export function ProgrammeStructurePdf({ groupes, titre }: { groupes: GroupeProgramme[]; titre?: React.ReactNode; compact?: boolean }) {
  const f = 7.5
  const blocs: React.ReactNode[] = []
  groupes.forEach((g, gi) => {
    const bande = (
      <>
        {g.titre ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: BRAND_GREEN, borderRadius: 5, paddingVertical: 6, paddingHorizontal: 10, marginBottom: 6 }}>
            <Text style={{ fontSize: 9, fontFamily: 'Satoshi', fontWeight: 700, color: '#ffffff', flex: 1 }}>{textePdf(g.titre)}</Text>
            {g.duree ? (
              <View style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingVertical: 2, paddingHorizontal: 7 }}>
                <Text style={{ fontSize: 7.5, color: '#ffffff', fontFamily: 'Satoshi', fontWeight: 700 }}>{textePdf(g.duree)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {g.objectif ? <Text style={{ fontSize: 8, color: SURFACE_700, marginBottom: 4, lineHeight: 1.4 }}>{`Objectif : ${textePdf(g.objectif)}`}</Text> : null}
        {g.notes.map((n, ni) => (
          <Text key={ni} style={{ fontSize: 8, color: SURFACE_500, marginBottom: 2, lineHeight: 1.4 }}>{textePdf(n)}</Text>
        ))}
      </>
    )
    const debut = gi === 0 ? titre : null
    // Avant un module : 7 ; avant un nouveau jour ou une nouvelle semaine : 17 ; rien avant le tout premier
    const avant = (bi: number) => (gi === 0 && bi === 0 ? undefined : { marginTop: bi === 0 ? 17 : 7 })
    if (g.blocs.length === 0) {
      blocs.push(<View key={`${gi}`} wrap={false} style={avant(0)}>{debut}{bande}</View>)
      return
    }
    g.blocs.forEach((b, bi) => {
      // Ni la bande du jour ni le titre d'un module ne restent seuls en bas de page :
      // la bande tient avec le premier module, le titre avec sa première ligne
      blocs.push(
        <View key={`${gi}-${bi}`} wrap={false} style={avant(bi)}>
          {bi === 0 ? debut : null}
          {bi === 0 ? bande : null}
          <View style={CADRE}>
            {b.titre ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                <Text style={{ fontSize: 8.5, fontFamily: 'Satoshi', fontWeight: 700, color: SURFACE_900, flex: 1 }}>{textePdf(b.titre)}</Text>
                {b.duree ? (
                  <View style={{ backgroundColor: BRAND_LIGHT, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 7 }}>
                    <Text style={{ fontSize: 7.5, color: BRAND_GREEN, fontFamily: 'Satoshi', fontWeight: 700 }}>{textePdf(b.duree)}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            {b.objectif ? <Text style={{ fontSize: 8, color: SURFACE_500, marginBottom: 3, lineHeight: 1.4 }}>{majuscule(textePdf(b.objectif))}</Text> : null}
            {b.lignes[0] ? <LignePdf l={b.lignes[0]} f={f} /> : null}
          </View>
        </View>,
      )
      b.lignes.slice(1).forEach((l, li) => {
        blocs.push(
          <View key={`${gi}-${bi}-${li}`} wrap={false} style={CADRE}>
            <LignePdf l={l} f={f} />
          </View>,
        )
      })
    })
  })
  return <>{blocs}</>
}

function LignePdf({ l, f }: { l: GroupeProgramme['blocs'][number]['lignes'][number]; f: number }) {
  if (l.type === 'activite') {
    return (
      <View style={{ backgroundColor: BRAND_ULTRA_LIGHT, borderRadius: 4, paddingVertical: 4, paddingHorizontal: 7, marginTop: 3, marginBottom: 2 }}>
        <Text style={{ fontSize: f, color: SURFACE_700, lineHeight: 1.4 }}>
          <Text style={{ fontFamily: 'Satoshi', fontWeight: 700, color: BRAND_GREEN }}>{`${textePdf(l.label)} : `}</Text>
          {textePdf(l.texte)}
        </Text>
      </View>
    )
  }
  return (
    <View style={{ flexDirection: 'row', gap: 5, marginBottom: 1.5 }}>
      <Text style={{ fontSize: f, color: BRAND_GREEN }}>•</Text>
      <Text style={{ fontSize: f, color: SURFACE_700, flex: 1, lineHeight: 1.35 }}>{textePdf(l.texte)}</Text>
    </View>
  )
}
