'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { Check, Copy, Info, KeyRound, Loader2, Lock, Plus, ShieldAlert, Sparkles } from '@/components/ui/icons'
import {
  creerCleClaudeAction, journalConnecteurClaudeAction, listerClesClaudeAction, listerConnexionsClaudeAction,
  revoquerCleClaudeAction, revoquerConnexionClaudeAction, type CleClaude, type ConnexionClaude, type LectureClaude,
} from './claude-actions'

const LIBELLES_ACTION: Record<string, string> = {
  connecteur_claude: '',
  connecteur_claude_plafond: 'Refusé : plafond d’appels',
  connecteur_claude_refus: 'Refusé : clé révoquée',
}

/** Les derniers appels du connecteur : ce que Claude a lu, et les refus */
function DernieresLectures() {
  const [lignes, setLignes] = useState<LectureClaude[] | null>(null)
  const [ouvert, setOuvert] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function charger() {
    setErreur(null)
    try {
      const r = await journalConnecteurClaudeAction()
      if (r.success) setLignes(r.data || [])
      else setErreur(r.error || 'Lecture impossible')
    } catch { setErreur('Lecture impossible, réessayez') }
  }

  return (
    <div className="rounded-xl border border-surface-200 overflow-hidden">
      <button
        type="button"
        onClick={() => { const suivant = !ouvert; setOuvert(suivant); if (suivant) charger() }}
        aria-expanded={ouvert}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-50"
      >
        <span className="text-sm font-semibold text-surface-900">Dernières lectures de Claude</span>
        <span className="text-xs font-medium text-brand-600">{ouvert ? 'Masquer' : 'Afficher'}</span>
      </button>
      {ouvert && (
        <div className="border-t border-surface-100">
          {erreur && <div className="px-4 py-3 text-xs text-danger-600">{erreur}</div>}
          {lignes === null && !erreur ? (
            <div className="px-4 py-4 text-sm text-surface-400">Chargement…</div>
          ) : lignes && lignes.length === 0 ? (
            <div className="px-4 py-4 text-sm text-surface-400">Aucune lecture pour l&apos;instant.</div>
          ) : (
            <div className="divide-y divide-surface-100 max-h-96 overflow-y-auto">
              {(lignes || []).map((l) => (
                <div key={l.id} className="px-4 py-2.5 text-xs">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-mono text-surface-500">{new Date(l.le).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    <span className="font-semibold text-surface-900">{l.outil || '—'}</span>
                    {l.table && <span className="text-surface-700">{l.table}</span>}
                    {l.lignes != null && <span className="text-surface-500">{l.lignes} ligne{l.lignes > 1 ? 's' : ''}</span>}
                    <span className="text-surface-400">{l.cle}</span>
                  </div>
                  {(LIBELLES_ACTION[l.action] || l.erreur) && (
                    <div className={cn('mt-0.5', l.action === 'connecteur_claude' ? 'text-warning-700' : 'text-danger-600')}>
                      {LIBELLES_ACTION[l.action] || l.erreur}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BoutonCopier({ valeur, libelle = 'Copier' }: { valeur: string; libelle?: string }) {
  const [etat, setEtat] = useState<'repos' | 'copie' | 'echec'>('repos')
  async function copier() {
    try {
      await navigator.clipboard.writeText(valeur)
      setEtat('copie')
    } catch {
      setEtat('echec')
    }
    setTimeout(() => setEtat('repos'), 2000)
  }
  return (
    <button
      type="button"
      onClick={copier}
      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-surface-200 bg-white text-xs font-medium text-surface-700 hover:bg-surface-50"
    >
      {etat === 'copie' ? <Check className="h-3.5 w-3.5 text-brand-600" /> : <Copy className="h-3.5 w-3.5" />}
      {etat === 'copie' ? 'Copié' : etat === 'echec' ? 'Sélectionnez et copiez' : libelle}
    </button>
  )
}

/**
 * Connecteur Claude : clés qui laissent Claude lire tout le CRM, en lecture
 * seule, depuis l'application Claude ou Claude Code (app/api/mcp).
 */
export function ConnecteurClaude({ prenom, appUrl }: { prenom?: string | null; appUrl?: string | null }) {
  const [cles, setCles] = useState<CleClaude[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [nom, setNom] = useState(prenom ? `Claude de ${prenom}` : 'Claude')
  const [creation, setCreation] = useState(false)
  const [nouvelle, setNouvelle] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [adresse, setAdresse] = useState(appUrl ? `${appUrl.replace(/\/$/, '')}/api/mcp` : '')
  const [connexions, setConnexions] = useState<ConnexionClaude[]>([])

  const charger = useCallback(async () => {
    try {
      const [r, c] = await Promise.all([listerClesClaudeAction(), listerConnexionsClaudeAction()])
      if (r.success) setCles(r.data || [])
      else setErreur(r.error || 'Lecture impossible')
      if (c.success) setConnexions(c.data || [])
    } catch { setErreur('Lecture impossible, réessayez') }
  }, [])

  function deconnecter(famille: string) {
    if (!confirm('Déconnecter Claude ? Il faudra autoriser à nouveau depuis l’application.')) return
    setErreur(null)
    start(async () => {
      let r: any = null
      try { r = await revoquerConnexionClaudeAction(famille) } catch { r = null }
      if (r?.success) await charger()
      else setErreur(r?.error || 'Déconnexion impossible, réessayez')
    })
  }

  useEffect(() => {
    if (!appUrl) setAdresse(`${window.location.origin}/api/mcp`)
    charger()
  }, [charger, appUrl])

  function creer() {
    setErreur(null)
    start(async () => {
      let r: any = null
      try { r = await creerCleClaudeAction(nom) } catch { r = null }
      if (r?.success && r.data) {
        setNouvelle(r.data.cle)
        setCreation(false)
        await charger()
      } else setErreur(r?.error || 'Création impossible, réessayez')
    })
  }

  function revoquer(id: string) {
    if (!confirm('Révoquer cette clé ? Claude ne pourra plus lire le CRM avec elle.')) return
    setErreur(null)
    start(async () => {
      let r: any = null
      try { r = await revoquerCleClaudeAction(id) } catch { r = null }
      if (r?.success) await charger()
      else setErreur(r?.error || 'Révocation impossible, réessayez')
    })
  }

  const commande = `claude mcp add --transport http crm-lab-learning ${adresse} --header "Authorization: Bearer ${nouvelle || 'VOTRE_CLE'}"`

  return (
    <div className="card p-5 sm:p-6 mt-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
          <Sparkles className="h-5 w-5 text-brand-600" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-heading font-semibold text-surface-900">Connecteur Claude</h2>
          <p className="text-sm text-surface-600 mt-0.5">
            Claude lit tout le CRM, en lecture seule : il ne crée, ne modifie et n&apos;envoie rien.
            Chaque lecture est inscrite au journal.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-surface-50 border border-surface-100 p-3 text-xs text-surface-600">
        <Lock className="h-4 w-4 text-surface-400 shrink-0 mt-0.5" />
        <span>
          Jamais transmis : jetons d&apos;accès aux portails et aux signatures, clés, mots de passe et comptes OPCO chiffrés,
          images de signature, adresses IP. Masqués : numéro de sécurité sociale et IBAN.
        </span>
      </div>

      <div>
        <div className="text-xs font-semibold text-surface-700 mb-1.5">Adresse du connecteur</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 text-xs bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 font-mono break-all">{adresse}</code>
          <BoutonCopier valeur={adresse} />
        </div>
      </div>

      <div className="rounded-xl border border-surface-200 p-4">
        <div className="text-sm font-semibold text-surface-900">Dans l&apos;application Claude (web, ordinateur, téléphone)</div>
        <ol className="list-decimal pl-4 mt-2 space-y-1 text-xs text-surface-700">
          <li>Personnaliser, puis Connecteurs, puis « Ajouter un connecteur personnalisé ».</li>
          <li>Nom : CRM Lab Learning ; adresse : celle ci-dessus, exactement.</li>
          <li>Gardez « Se connecter maintenant » et « Utiliser l&apos;identité publiée de Claude » (marqués « Détecté »), puis Ajouter.</li>
          <li>Sur la fiche du connecteur, cliquez sur « Connecter » : une page du CRM s&apos;ouvre, cliquez sur « Autoriser ».</li>
          <li>Ouvrez une nouvelle conversation : celles déjà ouvertes ne voient pas le connecteur.</li>
        </ol>
        <div className="mt-2 text-xs text-surface-500">Aucune clé à copier. Seul un super administrateur peut autoriser, car Claude lit toutes les données.</div>
        {connexions.length > 0 && (
          <div className="mt-3 divide-y divide-surface-100 border-t border-surface-100">
            {connexions.map((c) => (
              <div key={c.famille} className="flex items-center gap-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-surface-900 truncate">{c.application} · {c.utilisateur}</div>
                  <div className="text-[11px] text-surface-500">
                    Autorisée le {new Date(c.depuis).toLocaleDateString('fr-FR')}
                    {c.derniere ? ` · dernière lecture le ${new Date(c.derniere).toLocaleDateString('fr-FR')}` : ''}
                  </div>
                </div>
                <button type="button" onClick={() => deconnecter(c.famille)} disabled={pending} className="text-xs font-medium text-danger-600 hover:text-danger-700 shrink-0">
                  Déconnecter
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {nouvelle && (
        <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-brand-700" />
            <span className="text-sm font-semibold text-brand-800">Clé créée : copiez-la maintenant, elle ne sera plus affichée</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 text-xs bg-white border border-brand-200 rounded-lg px-3 py-2 font-mono break-all">{nouvelle}</code>
            <BoutonCopier valeur={nouvelle} />
          </div>
          <div className="text-xs text-surface-700 space-y-2">
            <div>
              <div className="font-semibold">Dans Claude Code</div>
              <div className="flex items-start gap-2 mt-1">
                <code className="flex-1 min-w-0 text-[11px] bg-surface-900 text-surface-100 rounded-lg px-3 py-2 font-mono break-all">{commande}</code>
                <BoutonCopier valeur={commande} />
              </div>
            </div>
          </div>
          <button type="button" onClick={() => setNouvelle(null)} className="text-xs font-medium text-brand-700 hover:underline">J&apos;ai copié la clé</button>
        </div>
      )}

      <div className="rounded-xl border border-surface-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-surface-400" />
            <span className="text-sm font-semibold text-surface-900">Clés pour Claude Code</span>
          </div>
          {!creation && (
            <button type="button" onClick={() => setCreation(true)} className="text-xs font-medium text-brand-600 hover:text-brand-700 inline-flex items-center gap-1">
              <Plus className="h-3.5 w-3.5" /> Créer une clé
            </button>
          )}
        </div>

        {creation && (
          <div className="px-4 py-3 bg-surface-50 border-b border-surface-100 flex flex-col sm:flex-row sm:items-center gap-2">
            <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom de la clé (ex. Claude de Brahim)"
              aria-label="Nom de la clé" className="input-base text-sm flex-1" />
            <div className="flex gap-2">
              <button type="button" onClick={creer} disabled={pending} className="btn-primary px-3 py-2 text-sm inline-flex items-center gap-1.5">
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Créer
              </button>
              <button type="button" onClick={() => setCreation(false)} className="px-3 py-2 rounded-lg border border-surface-200 text-sm text-surface-600">Annuler</button>
            </div>
          </div>
        )}

        {cles === null ? (
          <div className="px-4 py-6 text-center text-sm text-surface-400">Chargement…</div>
        ) : cles.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-surface-400">Aucune clé. Créez-en une pour brancher Claude Code sur le CRM.</div>
        ) : (
          <div className="divide-y divide-surface-100">
            {cles.map((k) => (
              <div key={k.id} className={cn('flex items-center gap-3 px-4 py-3', !k.is_active && 'opacity-50')}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-surface-900 truncate">{k.name}</div>
                  <div className="text-xs text-surface-400 font-mono">{k.key_prefix}••••••••</div>
                  {k.en_sommeil && <div className="text-[11px] text-warning-700 mt-0.5">En sommeil : son auteur est suspendu ou n&apos;est plus super administrateur</div>}
                </div>
                <div className="text-xs text-surface-500 text-right shrink-0">
                  <div>{k.request_count || 0} connexion{(k.request_count || 0) > 1 ? 's' : ''}</div>
                  <div className="text-[10px]">{k.last_used_at ? `Utilisée le ${new Date(k.last_used_at).toLocaleDateString('fr-FR')}` : 'Jamais utilisée'}</div>
                </div>
                {k.is_active ? (
                  <button type="button" onClick={() => revoquer(k.id)} disabled={pending} className="text-xs font-medium text-danger-600 hover:text-danger-700 shrink-0">
                    Révoquer
                  </button>
                ) : (
                  <span className="text-xs text-surface-400 shrink-0">Révoquée</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <DernieresLectures />

      {erreur && (
        <div className="flex items-center gap-2 text-xs text-danger-600">
          <Info className="h-3.5 w-3.5" /> {erreur}
        </div>
      )}
    </div>
  )
}
