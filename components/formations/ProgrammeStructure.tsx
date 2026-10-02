import type { GroupeProgramme } from '@/lib/programme-structure'

/**
 * Programme détaillé mis en forme : jours ou semaines, modules et séquences
 * avec leur horaire, objectif, puces, ateliers. Même découpage que les PDF
 * (lib/programme-structure). `ton` : fiche du CRM ou page du site public.
 */
export function ProgrammeStructure({ groupes, ton = 'crm' }: { groupes: GroupeProgramme[]; ton?: 'crm' | 'site' }) {
  const site = ton === 'site'
  const c = site
    ? { texte: 'text-[#57534E]', titre: 'text-[#0B221B]', doux: 'text-[#78716C]', bande: 'bg-[#205040] text-white', pastille: 'bg-[#E6F4EC] text-[#205040]', filet: 'border-[#D6EBE1]', atelier: 'bg-[#EEF6F2]', accent: 'text-[#205040]' }
    : { texte: 'text-surface-600', titre: 'text-surface-900', doux: 'text-surface-500', bande: 'bg-brand-500 text-white', pastille: 'bg-brand-50 text-brand-600', filet: 'border-brand-100', atelier: 'bg-brand-50/60', accent: 'text-brand-600' }
  const majuscule = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t)
  return (
    <div className="space-y-5">
      {groupes.map((g, gi) => (
        <section key={gi} className="space-y-3">
          {g.titre && (
            <div className={`flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 ${c.bande}`}>
              <h3 className="text-sm font-semibold leading-snug">{g.titre}</h3>
              {g.duree && <span className="shrink-0 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold tabular-nums">{g.duree}</span>}
            </div>
          )}
          {g.objectif && <p className={`text-sm ${c.texte}`}>Objectif : {g.objectif}</p>}
          {g.notes.map((n, ni) => <p key={ni} className={`text-sm ${c.doux}`}>{n}</p>)}
          {g.blocs.map((b, bi) => (
            <div key={bi} className={`border-l-2 pl-3.5 ${c.filet}`}>
              {b.titre && (
                <div className="flex items-start justify-between gap-3">
                  <h4 className={`text-sm font-semibold leading-snug ${c.titre}`}>{b.titre}</h4>
                  {b.duree && <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${c.pastille}`}>{b.duree}</span>}
                </div>
              )}
              {b.objectif && <p className={`mt-0.5 text-sm ${c.doux}`}>{majuscule(b.objectif)}</p>}
              {b.lignes.length > 0 && (
                <ul className="mt-1.5 space-y-1">
                  {b.lignes.map((l, li) => l.type === 'activite' ? (
                    <li key={li} className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${c.atelier} ${c.texte}`}>
                      <span className={`font-semibold ${c.accent}`}>{l.label} : </span>{l.texte}
                    </li>
                  ) : (
                    <li key={li} className={`relative pl-4 text-sm leading-relaxed ${c.texte} before:absolute before:left-0 before:top-[0.6em] before:h-1 before:w-1 before:rounded-full ${site ? 'before:bg-[#5CD9A0]' : 'before:bg-brand-400'}`}>
                      {l.texte}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
