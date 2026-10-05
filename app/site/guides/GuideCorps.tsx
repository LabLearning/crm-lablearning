import Link from 'next/link'
import type { Bloc, SectionGuide } from '@/lib/guides'

/** **gras** et [texte](lien) : la seule mise en forme admise dans un paragraphe de guide. */
export function Riche({ texte }: { texte: string }) {
  const morceaux = texte.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).filter(Boolean)
  return (
    <>
      {morceaux.map((m, i) => {
        if (m.startsWith('**')) return <strong key={i} className="font-semibold text-[#14110F]">{m.slice(2, -2)}</strong>
        const lien = m.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
        if (lien) {
          const [, libelle, href] = lien
          return href.startsWith('/')
            ? <Link key={i} href={href} className="font-semibold text-[#205040] underline decoration-[#205040]/30 underline-offset-2 hover:decoration-[#205040]">{libelle}</Link>
            : <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#205040] underline decoration-[#205040]/30 underline-offset-2 hover:decoration-[#205040]">{libelle}</a>
        }
        return <span key={i}>{m}</span>
      })}
    </>
  )
}

function BlocGuide({ bloc }: { bloc: Bloc }) {
  if (bloc.type === 'p') return <p className="text-[17px] leading-[1.75] text-[#44403C]"><Riche texte={bloc.texte} /></p>
  if (bloc.type === 'liste') {
    const Liste = bloc.ordonnee ? 'ol' : 'ul'
    return (
      <Liste className={`space-y-2 pl-5 text-[17px] leading-[1.7] text-[#44403C] ${bloc.ordonnee ? 'list-decimal' : 'list-disc'} marker:text-[#205040]`}>
        {bloc.items.map((it, i) => <li key={i} className="pl-1"><Riche texte={it} /></li>)}
      </Liste>
    )
  }
  if (bloc.type === 'encadre') {
    const attention = bloc.ton === 'attention'
    return (
      <aside className={`rounded-2xl p-5 ${attention ? 'bg-[#FEF3E2] ring-1 ring-[#EA580C]/20' : 'bg-[#205040]/[0.05] ring-1 ring-[#205040]/15'}`}>
        <div className="font-heading font-bold text-[#14110F]">{bloc.titre}</div>
        <p className="mt-1.5 text-[15px] leading-relaxed text-[#44403C]"><Riche texte={bloc.texte} /></p>
      </aside>
    )
  }
  return (
    <div className="overflow-x-auto rounded-2xl ring-1 ring-black/5">
      <table className="w-full min-w-[520px] text-left text-[15px]">
        <thead className="bg-[#F6F4EF] text-[#14110F]">
          <tr>{bloc.entetes.map((e) => <th key={e} scope="col" className="px-4 py-3 font-heading font-semibold">{e}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-black/5 bg-white text-[#44403C]">
          {bloc.lignes.map((l, i) => (
            <tr key={i}>{l.map((c, j) => <td key={j} className="px-4 py-3 align-top"><Riche texte={c} /></td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function GuideCorps({ sections }: { sections: SectionGuide[] }) {
  return (
    <div className="space-y-12">
      {sections.map((s) => (
        <section key={s.id} id={s.id} className="scroll-mt-24">
          <h2 className="ll-display text-2xl md:text-[1.9rem] text-[#14110F] text-balance">{s.titre}</h2>
          <div className="mt-5 space-y-5">
            {s.blocs.map((b, i) => <BlocGuide key={i} bloc={b} />)}
          </div>
        </section>
      ))}
    </div>
  )
}
