/**
 * Affiché dès le clic sur un onglet de l'espace franchise, le temps que la
 * page se charge : sans lui, rien ne bougeait et le bouton semblait inerte.
 */
export default function FranchiseLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Chargement">
      <div className="space-y-2">
        <div className="h-8 w-60 bg-surface-200/60 rounded-xl" />
        <div className="h-4 w-80 max-w-full bg-surface-100 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-5 space-y-2">
            <div className="h-3 w-16 bg-surface-100 rounded" />
            <div className="h-6 w-20 bg-surface-200/60 rounded" />
          </div>
        ))}
      </div>
      <div className="card p-6 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-surface-100 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
