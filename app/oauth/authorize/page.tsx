import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { estLocale, utilisateurAutorise, verifierDemande } from '@/lib/connecteur-claude/oauth'
import { Lock, ShieldCheck, Sparkles, XCircle, CheckCircle2 } from '@/components/ui/icons'
import { autoriserClaudeAction, refuserClaudeAction } from './actions'

export const dynamic = 'force-dynamic'

/**
 * Page d'autorisation du connecteur Claude (OAuth) : Claude y envoie le super
 * administrateur, qui accepte ou refuse que Claude lise le CRM en son nom.
 */

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-surface-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <img src="/logo-lablearning.svg" alt="Lab Learning" className="h-9" />
        </div>
        <div className="card p-6 sm:p-7">{children}</div>
      </div>
    </main>
  )
}

function Ecran({ titre, texte }: { titre: string; texte: string }) {
  return (
    <Cadre>
      <div className="flex items-center gap-2 mb-2">
        <XCircle className="h-5 w-5 text-danger-600" />
        <h1 className="text-lg font-heading font-bold text-surface-900">{titre}</h1>
      </div>
      <p className="text-sm text-surface-600">{texte}</p>
      <Link href="/dashboard" className="inline-block mt-5 text-sm font-medium text-brand-600 hover:text-brand-700">Retour au CRM</Link>
    </Cadre>
  )
}

export default async function AutoriserClaude({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const p: Record<string, string> = {}
  for (const [k, v] of Object.entries(searchParams || {})) {
    const valeur = Array.isArray(v) ? v[0] : v
    if (typeof valeur === 'string') p[k] = valeur
  }
  const service = await createServiceRoleClient()
  const v = await verifierDemande(service, p)
  if (!v.ok) {
    // Adresse de retour sûre : l'erreur repart vers Claude ; sinon elle s'affiche ici
    if (v.redirection) redirect(v.redirection)
    return <Ecran titre="Connexion impossible" texte={v.erreur} />
  }

  const { data: { user } } = await (await createServerSupabaseClient()).auth.getUser()
  if (!user) redirect(`/login?suite=${encodeURIComponent(`/oauth/authorize?${new URLSearchParams(p).toString()}`)}`)
  const verif = await utilisateurAutorise(service, user.id)
  if (verif.etat === 'indisponible') return <Ecran titre="Service momentanément indisponible" texte="Le CRM ne répond pas pour l'instant. Réessayez dans un instant depuis Claude." />
  if (verif.etat === 'refuse') return <Ecran titre="Accès réservé" texte="Seul un super administrateur peut brancher Claude sur le CRM, car Claude y lit toutes les données." />
  const u = verif.user
  const { data: org } = await service.from('organizations').select('name').eq('id', u.organization_id).single()
  const retour = new URL(v.demande.redirect_uri)
  const hote = retour.hostname
  const local = estLocale(retour)

  const caches = (
    <>
      {['response_type', 'client_id', 'redirect_uri', 'code_challenge', 'code_challenge_method', 'state', 'scope', 'resource'].map((k) => (
        <input key={k} type="hidden" name={k} value={p[k] ?? ''} />
      ))}
    </>
  )

  return (
    <Cadre>
      <div className="flex items-center gap-3 mb-4">
        <div className="h-11 w-11 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
          <Sparkles className="h-5 w-5 text-brand-600" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-heading font-bold text-surface-900 leading-tight">Autoriser Claude à lire le CRM</h1>
          <p className="text-xs text-surface-500 mt-0.5">{v.demande.client_name} demande l&apos;accès à {org?.name || 'votre organisme'}</p>
        </div>
      </div>

      <ul className="space-y-2.5 text-sm text-surface-700">
        <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" /><span>Claude pourra lire toutes les données du CRM, en votre nom.</span></li>
        <li className="flex gap-2"><ShieldCheck className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" /><span>Lecture seule : il ne crée, ne modifie et n&apos;envoie rien. Chaque lecture est inscrite au journal.</span></li>
        <li className="flex gap-2"><Lock className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" /><span>Accès, mots de passe, signatures et numéros sensibles ne lui sont jamais transmis.</span></li>
      </ul>

      {local ? (
        // Retour vers un programme de cet ordinateur (Claude Code) : n'importe quel programme local peut prendre ce nom
        <div className="mt-5 rounded-xl bg-warning-50 border border-warning-100 px-3 py-2.5 text-xs text-warning-700">
          Le code sera remis à un programme de cet ordinateur ({retour.host}). N&apos;autorisez que si vous venez de lancer la connexion depuis Claude Code : un autre programme peut prendre ce nom.
        </div>
      ) : (
        <div className="mt-5 rounded-xl bg-surface-50 border border-surface-100 px-3 py-2.5 text-xs text-surface-600">
          Après votre accord, vous serez renvoyé vers <span className="font-semibold text-surface-900">{hote}</span>. Vous pourrez couper cet accès à tout moment dans Paramètres.
        </div>
      )}

      <div className="mt-5 flex flex-col-reverse sm:flex-row gap-2">
        <form action={refuserClaudeAction} className="sm:flex-1">
          {caches}
          <button type="submit" className="w-full px-4 py-2.5 rounded-xl border border-surface-200 text-sm font-medium text-surface-700 hover:bg-surface-50">Refuser</button>
        </form>
        <form action={autoriserClaudeAction} className="sm:flex-1">
          {caches}
          <button type="submit" className="btn-primary w-full py-2.5">Autoriser</button>
        </form>
      </div>
      <p className="mt-4 text-[11px] text-surface-400 text-center">Connecté en tant que {u.first_name || user.email}</p>
    </Cadre>
  )
}
