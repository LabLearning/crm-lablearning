'use client'

import { useState } from 'react'
import { Send, CheckCircle2, AlertCircle, Copy, ExternalLink, PenTool, ShieldCheck, Archive } from '@/components/ui/icons'
import { Button, useToast } from '@/components/ui'
import { generateSignatureLinkAction } from '../signature-actions'
import { formatDate } from '@/lib/utils'

interface Props {
  conventionId: string
  status: string
  signatureUrl: string | null
  /** Date portée sur la convention côté client : seul le jour a un sens, pas l'heure. */
  signatureClientDate: string | null
  /** Horodatage réel de la signature électronique du client ; absent si elle a été signée sur papier ou avant qu'il soit enregistré. */
  signatureClientSignedAt: string | null
  signatureClientNom: string | null
  /** Date portée sur la convention côté organisme. */
  signatureOfDate: string | null
  signatureOfNom: string | null
  signatureTokenExpiresAt: string | null
  /** Nom de l'organisme de formation, pour le libellé de sa signature. */
  organismeNom?: string | null
  /** Signée électroniquement par le client : le certificat de signature peut être délivré. */
  certificatDisponible?: boolean
  /** Un exemplaire PDF figé à la signature est archivé : il peut être téléchargé. */
  exemplaireArchive?: boolean
}

/** Horodatage réel d'une signature : date et heure de Paris, quel que soit le fuseau du serveur ou du poste. */
function horodatageParis(d: string): string {
  const heure = new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
  return `${formatDate(d, { month: 'short', timeZone: 'Europe/Paris' })} à ${heure}`
}

/**
 * Date portée sur la convention : le jour seul. Il est enregistré en temps
 * universel, avec l'heure du clic, et le PDF rendu par le serveur l'imprime
 * ainsi ; lu à l'heure de Paris, un clic tardif le ferait glisser au lendemain.
 */
const jourPorte = (d: string) => formatDate(d, { timeZone: 'UTC' })

export function ConventionSignatureBlock({
  conventionId, status, signatureUrl, signatureClientDate, signatureClientSignedAt, signatureClientNom,
  signatureOfDate, signatureOfNom, signatureTokenExpiresAt, organismeNom, certificatDisponible, exemplaireArchive,
}: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [url, setUrl] = useState(signatureUrl)

  const isSigned = ['signee_client', 'signee_of', 'signee_complete'].includes(status)
  const expired = signatureTokenExpiresAt && new Date(signatureTokenExpiresAt) < new Date()

  async function generateLink() {
    setLoading(true)
    const r = await generateSignatureLinkAction(conventionId)
    if (r.success && (r.data as any)?.url) {
      const newUrl = (r.data as any).url
      setUrl(newUrl)
      try {
        await navigator.clipboard.writeText(newUrl)
        toast('success', 'Lien copié dans le presse-papier')
      } catch {
        toast('success', 'Lien généré')
      }
    } else toast('error', r.error || 'Erreur')
    setLoading(false)
  }

  async function copyLink() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast('success', 'Lien copié')
    } catch {
      toast('error', 'Copie impossible')
    }
  }

  if (isSigned) {
    return (
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 uppercase tracking-wider">
            <CheckCircle2 className="h-3.5 w-3.5" /> Signatures
          </div>
          {(certificatDisponible || exemplaireArchive) && (
            <div className="flex flex-wrap items-center gap-2">
              {certificatDisponible && (
                <a href={`/api/pdf/preuve-signature/convention/${conventionId}`}
                  className="btn-secondary text-xs inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" /> Certificat de signature
                </a>
              )}
              {exemplaireArchive && (
                <a href={`/api/pdf/convention/${conventionId}?exemplaire=signe`}
                  title="Fichier figé à l'instant de la signature : c'est son empreinte qui figure sur le certificat."
                  className="btn-secondary text-xs inline-flex items-center gap-1.5">
                  <Archive className="h-3.5 w-3.5" /> Exemplaire signé archivé
                </a>
              )}
            </div>
          )}
        </div>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium text-surface-900">Client</div>
              {signatureClientSignedAt || signatureClientDate ? (
                <div className="text-xs text-surface-600 space-y-0.5">
                  {signatureClientNom && <div>Signé par <strong>{signatureClientNom}</strong></div>}
                  {/* L'horodatage réel n'existe que pour une signature électronique : c'est celui du certificat */}
                  {signatureClientSignedAt && (
                    <div>Signée électroniquement le {horodatageParis(signatureClientSignedAt)} (heure de Paris)</div>
                  )}
                  {signatureClientDate && <div>Date portée sur la convention : {jourPorte(signatureClientDate)}</div>}
                </div>
              ) : <div className="text-xs text-surface-500">En attente</div>}
            </div>
          </div>
          <div className="flex items-start gap-2">
            {signatureOfDate
              ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              : <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            }
            <div>
              <div className="font-medium text-surface-900">{organismeNom ? `${organismeNom} (OF)` : 'Organisme de formation'}</div>
              {signatureOfDate ? (
                <div className="text-xs text-surface-600 space-y-0.5">
                  {signatureOfNom && <div>Signé par <strong>{signatureOfNom}</strong></div>}
                  <div>Date portée sur la convention : {jourPorte(signatureOfDate)}</div>
                </div>
              ) : <div className="text-xs text-amber-700">En attente — à contre-signer côté OF</div>}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-5 space-y-3 bg-amber-50/40 border-amber-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 uppercase tracking-wider">
          <PenTool className="h-3.5 w-3.5" /> Signature électronique
        </div>
      </div>

      {url && !expired ? (
        <div className="space-y-2">
          <div className="text-sm text-amber-900">
            Lien de signature actif (valable jusqu'au {signatureTokenExpiresAt && formatDate(signatureTokenExpiresAt)}).
            Envoyez-le au client par email ou WhatsApp.
          </div>
          <div className="flex gap-2 items-center bg-white border border-amber-200 rounded-lg px-3 py-2">
            <code className="text-xs text-surface-700 truncate flex-1">{url}</code>
            <button onClick={copyLink} className="text-xs text-brand-600 hover:underline flex items-center gap-1 shrink-0">
              <Copy className="h-3 w-3" /> Copier
            </button>
            <a href={url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline flex items-center gap-1 shrink-0">
              <ExternalLink className="h-3 w-3" /> Ouvrir
            </a>
          </div>
          <Button size="sm" variant="secondary" onClick={generateLink} isLoading={loading} icon={<Send className="h-3.5 w-3.5" />}>
            Régénérer un nouveau lien (et copier)
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {expired && (
            <div className="text-sm text-amber-800 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" /> Le lien précédent a expiré.
            </div>
          )}
          <div className="text-sm text-amber-900">
            Aucun lien de signature actif. Génère-en un et envoie-le au client.
          </div>
          <Button onClick={generateLink} isLoading={loading} icon={<Send className="h-4 w-4" />}>
            Générer le lien de signature
          </Button>
        </div>
      )}
    </div>
  )
}
