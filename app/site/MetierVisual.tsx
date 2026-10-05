import { metierStyle } from './metier'

/**
 * Bandeau visuel d'une catégorie métier : photo réelle + teinte métier +
 * scrim pour la lisibilité, avec icône et libellé. Repli sur un dégradé
 * illustré si la photo est absente.
 */
export function MetierVisual({ nom, label, className = '', height = 'h-32' }: { nom: string; label?: string; className?: string; height?: string }) {
  const s = metierStyle(nom)
  const Icon = s.Icon
  return (
    <div className={`relative overflow-hidden ${height} ${className}`} style={{ background: `linear-gradient(135deg, ${s.from}, ${s.to})` }}>
      {s.img ? (
        <>
          <img loading="lazy" src={s.img} alt={label ? `Formation ${label.toLowerCase()}` : ''} aria-hidden={label ? undefined : true} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(155deg, ${s.from}B3 0%, ${s.to}40 55%, transparent 100%)` }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 opacity-[0.18]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '14px 14px' }} />
          <div className="absolute -right-5 -bottom-6 text-white/20"><Icon className="h-32 w-32" strokeWidth={1.25} /></div>
        </>
      )}
      <div className="absolute inset-0 p-5 flex flex-col justify-between">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm ring-1 ring-white/25 self-start">
          <Icon className="h-5 w-5 text-white" />
        </span>
        {label ? <span className="font-heading font-semibold text-white text-lg leading-tight tracking-heading drop-shadow-md">{label}</span> : null}
      </div>
    </div>
  )
}
