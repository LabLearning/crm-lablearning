import * as React from 'react'
import { View, Text } from '@react-pdf/renderer'
import { BRAND_GREEN, BRAND_LIGHT, BRAND_ULTRA_LIGHT, SURFACE_500, SURFACE_700, SURFACE_900 } from './components'
import type { GroupeProgramme } from '@/lib/programme-structure'

/**
 * Programme détaillé mis en page : bande par jour ou semaine, modules et
 * séquences avec leur horaire, objectif, puces, ateliers mis en évidence.
 * Même rendu sur le programme de formation et sur l'annexe des conventions.
 */
const majuscule = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t)

export function ProgrammeStructurePdf({ groupes }: { groupes: GroupeProgramme[]; compact?: boolean }) {
  const f = 7.5
  return (
    <View>
      {groupes.map((g, gi) => {
        const bande = (
          <>
            {g.titre ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: BRAND_GREEN, borderRadius: 5, paddingVertical: 6, paddingHorizontal: 10, marginBottom: 6 }}>
                <Text style={{ fontSize: 9, fontFamily: 'Satoshi', fontWeight: 700, color: '#ffffff', flex: 1 }}>{g.titre}</Text>
                {g.duree ? (
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingVertical: 2, paddingHorizontal: 7 }}>
                    <Text style={{ fontSize: 7.5, color: '#ffffff', fontFamily: 'Satoshi', fontWeight: 700 }}>{g.duree}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            {g.objectif ? <Text style={{ fontSize: 8, color: SURFACE_700, marginBottom: 4, lineHeight: 1.4 }}>{`Objectif : ${g.objectif}`}</Text> : null}
            {g.notes.map((n, ni) => (
              <Text key={ni} style={{ fontSize: 8, color: SURFACE_500, marginBottom: 2, lineHeight: 1.4 }}>{n}</Text>
            ))}
          </>
        )
        return (
          <View key={gi} style={{ marginBottom: 10 }}>
            {g.blocs.length === 0 ? <View wrap={false}>{bande}</View> : null}
            {g.blocs.map((b, bi) => {
              const entete = (
                <View style={{ paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: BRAND_LIGHT }}>
                  {b.titre ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                      <Text style={{ fontSize: 8.5, fontFamily: 'Satoshi', fontWeight: 700, color: SURFACE_900, flex: 1 }}>{b.titre}</Text>
                      {b.duree ? (
                        <View style={{ backgroundColor: BRAND_LIGHT, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 7 }}>
                          <Text style={{ fontSize: 7.5, color: BRAND_GREEN, fontFamily: 'Satoshi', fontWeight: 700 }}>{b.duree}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                  {b.objectif ? <Text style={{ fontSize: 8, color: SURFACE_500, marginBottom: 3, lineHeight: 1.4 }}>{majuscule(b.objectif)}</Text> : null}
                  {b.lignes[0] ? <LignePdf l={b.lignes[0]} f={f} /> : null}
                </View>
              )
              return (
                <View key={bi} style={{ marginBottom: 7 }}>
                  {/*
                    Ni la bande du jour ni le titre d'un module ne restent seuls en bas de page :
                    la bande tient avec le premier module, le titre avec sa première ligne.
                  */}
                  <View wrap={false}>
                    {bi === 0 ? bande : null}
                    {entete}
                  </View>
                  {b.lignes.length > 1 ? (
                    <View style={{ paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: BRAND_LIGHT }}>
                      {b.lignes.slice(1).map((l, li) => <LignePdf key={li} l={l} f={f} />)}
                    </View>
                  ) : null}
                </View>
              )
            })}
          </View>
        )
      })}
    </View>
  )
}

function LignePdf({ l, f }: { l: GroupeProgramme['blocs'][number]['lignes'][number]; f: number }) {
  if (l.type === 'activite') {
    return (
      <View wrap={false} style={{ backgroundColor: BRAND_ULTRA_LIGHT, borderRadius: 4, paddingVertical: 4, paddingHorizontal: 7, marginTop: 3, marginBottom: 2 }}>
        <Text style={{ fontSize: f, color: SURFACE_700, lineHeight: 1.4 }}>
          <Text style={{ fontFamily: 'Satoshi', fontWeight: 700, color: BRAND_GREEN }}>{`${l.label} : `}</Text>
          {l.texte}
        </Text>
      </View>
    )
  }
  return (
    <View style={{ flexDirection: 'row', gap: 5, marginBottom: 1.5 }}>
      <Text style={{ fontSize: f, color: BRAND_GREEN }}>•</Text>
      <Text style={{ fontSize: f, color: SURFACE_700, flex: 1, lineHeight: 1.35 }}>{l.texte}</Text>
    </View>
  )
}
