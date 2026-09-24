'use client'

import { useState } from 'react'
import { Button, Modal, useToast } from '@/components/ui'
import { Link2, Copy, Check, Send, RefreshCw, ExternalLink, AlertTriangle } from '@/components/ui/icons'
import { envoyerLienInscriptionAction, regenererLienInscriptionAction } from './inscription-actions'

/**
 * Lien général d'inscription des formateurs : le même pour tous. On le copie
 * pour l'envoyer par WhatsApp ou SMS, ou on l'envoie par mail depuis le CRM.
 */
export function LienInscriptionButton({ token: tokenInitial, appUrl, peutRegenerer }: {
  token: string | null
  appUrl: string
  peutRegenerer: boolean
}) {
  const { toast } = useToast()
  const [ouvert, setOuvert] = useState(false)
  const [token, setToken] = useState(tokenInitial)
  const [copie, setCopie] = useState(false)
  const [email, setEmail] = useState('')
  const [prenom, setPrenom] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [regen, setRegen] = useState(false)
  const lien = token ? `${appUrl}/devenir-formateur/${token}` : null

  async function copier() {
    if (!lien) return
    try {
      await navigator.clipboard.writeText(lien)
      setCopie(true)
      setTimeout(() => setCopie(false), 1800)
    } catch {
      toast('error', 'Copie impossible : sélectionnez le lien à la main')
    }
  }

  async function envoyer(e: React.FormEvent) {
    e.preventDefault()
    setEnvoi(true)
    const r = await envoyerLienInscriptionAction(email, prenom)
    setEnvoi(false)
    if (!r.success) { toast('error', r.error || 'Échec de l’envoi'); return }
    toast('success', `Lien envoyé à ${email}`)
    setEmail(''); setPrenom('')
  }

  async function regenerer() {
    if (!confirm('Créer un nouveau lien ? L’ancien lien cessera aussitôt de fonctionner, y compris pour les formateurs qui ne l’ont pas encore rempli.')) return
    setRegen(true)
    const r = await regenererLienInscriptionAction()
    setRegen(false)
    if (!r.success || !r.data) { toast('error', r.error || 'Échec'); return }
    setToken(r.data.token)
    toast('success', 'Nouveau lien créé')
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOuvert(true)} icon={<Link2 className="h-4 w-4" />} className="w-full sm:w-auto">
        Lien d&apos;inscription
      </Button>
      <Modal isOpen={ouvert} onClose={() => setOuvert(false)} title="Lien d'inscription formateur"
        description="Un seul lien pour tous : le formateur remplit sa fiche, son CV et ses tarifs, et elle arrive ici marquée « à vérifier ».">
        {!lien ? (
          <p className="flex items-start gap-2 rounded-lg bg-warning-50 px-3 py-3 text-sm text-warning-700">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            Le lien n&apos;existe pas encore : la migration 160 doit être appliquée dans Supabase.
          </p>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="section-label">Le lien</div>
              <div className="flex items-stretch gap-2">
                <input readOnly value={lien} onFocus={(e) => e.currentTarget.select()} className="input-base flex-1 min-w-0 font-mono text-xs" />
                <Button onClick={copier} icon={copie ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>
                  {copie ? 'Copié' : 'Copier'}
                </Button>
              </div>
              <a href={lien} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline">
                Voir le formulaire <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            <form onSubmit={envoyer} className="space-y-2 border-t border-surface-100 pt-4">
              <div className="section-label">Envoyer par mail</div>
              <div className="grid sm:grid-cols-[1fr_1.4fr] gap-2">
                <input className="input-base" placeholder="Prénom (facultatif)" value={prenom} onChange={(e) => setPrenom(e.target.value)} />
                <input className="input-base" type="email" required placeholder="email@formateur.fr" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Button type="submit" isLoading={envoi} icon={<Send className="h-4 w-4" />} className="w-full sm:w-auto">Envoyer le lien</Button>
              <p className="text-xs text-surface-400">L&apos;envoi apparaît dans l&apos;historique des mails.</p>
            </form>

            {peutRegenerer && (
              <div className="border-t border-surface-100 pt-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-surface-500">Lien diffusé trop largement ? Remplacez-le.</p>
                <Button variant="ghost" size="sm" onClick={regenerer} isLoading={regen} icon={<RefreshCw className="h-3.5 w-3.5" />}>
                  Nouveau lien
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}
