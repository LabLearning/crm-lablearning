'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Download, Eye, FileSignature, Loader2, Send } from '@/components/ui/icons'
import { Button, Modal, useToast } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { envoyerMandatAction } from '../mandat-actions'

/**
 * Mandat POEI, l'entreprise mandate l'OF pour la demande d'aide France
 * Travail. La carte suit l'état (à faire signer / envoyé / signé), ouvre le
 * PDF, et envoie le lien de signature au gérant avec aperçu du mail avant
 * envoi, même construction que la signature employeur de l'attestation.
 */
export function PoeiMandat({ poeiId, mandat }: {
  poeiId: string
  mandat: { sent_at?: string | null; signed_at?: string | null; signataire_nom?: string | null; date_emission?: string | null } | null
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [envoi, setEnvoi] = useState(false)
  const [apercu, setApercu] = useState<{ html: string; subject?: string; to?: string } | null>(null)

  async function ouvrirApercu() {
    setEnvoi(true)
    const r = await envoyerMandatAction(poeiId, { preview: true })
    setEnvoi(false)
    if (r.success && r.data?.html) {
      setApercu({ html: r.data.html, subject: r.data.subject, to: r.data.email })
    } else toast('error', r.error || "Impossible de générer l'aperçu")
  }

  async function confirmerEnvoi() {
    setEnvoi(true)
    const r = await envoyerMandatAction(poeiId)
    setEnvoi(false)
    if (r.success) {
      toast('success', `Lien de signature envoyé à ${r.data?.email}`)
      setApercu(null)
      router.refresh()
    } else toast('error', r.error || 'Erreur')
  }

  return (
    <div className="card px-4 py-3 flex items-center gap-3 flex-wrap">
      <FileSignature className={`h-4 w-4 shrink-0 ${mandat?.signed_at ? 'text-success-500' : 'text-surface-400'}`} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-heading font-semibold text-surface-900">Mandat POEI</div>
        <div className="text-xs text-surface-500">
          L&apos;entreprise mandate l&apos;organisme pour la demande d&apos;aide France Travail, signé par le gérant
        </div>
      </div>

      {mandat?.signed_at ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg px-2.5 py-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Signé le {formatDate(mandat.signed_at, { day: 'numeric', month: 'short', year: 'numeric' })}
          {mandat.signataire_nom ? ` par ${mandat.signataire_nom}` : ''}
        </span>
      ) : mandat?.sent_at ? (
        <span className="text-xs font-medium text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">
          Envoyé le {formatDate(mandat.sent_at, { day: 'numeric', month: 'short', year: 'numeric' })}, en attente de signature
        </span>
      ) : null}

      <div className="flex items-center gap-2 w-full sm:w-auto">
        {!mandat?.signed_at && (
          <button onClick={ouvrirApercu} disabled={envoi}
            className="btn-secondary inline-flex items-center gap-1.5 !py-1.5 !px-3 text-sm disabled:opacity-60 flex-1 sm:flex-none">
            {envoi && !apercu ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            {mandat?.sent_at ? 'Relancer le gérant' : 'Faire signer le gérant'}
          </button>
        )}
        <a href={`/api/pdf/mandat-poei/${poeiId}`} target="_blank" rel="noreferrer"
          className="btn-secondary inline-flex items-center gap-1.5 !py-1.5 !px-3 text-sm flex-1 sm:flex-none">
          <Download className="h-4 w-4" /> PDF
        </a>
      </div>

      <Modal isOpen={!!apercu} onClose={() => setApercu(null)} size="lg" title="Aperçu avant envoi, Mandat POEI">
        {apercu && (
          <div className="space-y-3">
            <div className="text-xs text-surface-500">
              <div><span className="font-semibold text-surface-700">À :</span> {apercu.to}</div>
              <div><span className="font-semibold text-surface-700">Objet :</span> {apercu.subject}</div>
            </div>
            <div className="rounded-xl border border-surface-200 overflow-hidden bg-white">
              <iframe title="Aperçu email" srcDoc={apercu.html} className="w-full h-[60vh] sm:h-[460px]" style={{ border: 0 }} />
            </div>
            <div className="flex flex-wrap justify-end gap-3 pt-1">
              <Button variant="secondary" onClick={() => setApercu(null)}>Annuler</Button>
              <Button onClick={confirmerEnvoi} isLoading={envoi} icon={<Send className="h-4 w-4" />}>
                Confirmer l&apos;envoi
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
