'use client'

import { useState } from 'react'
import {
  FileSignature,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from '@/components/ui/icons'
import { Badge } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { SignatureModal } from './SignatureModal'

interface ConventionsClientProps {
  token: string
  conventions: any[]
  signataireName: string
}

const statusConfig: Record<
  string,
  {
    label: string
    variant: 'default' | 'info' | 'success' | 'warning' | 'danger'
    icon: React.ReactNode
  }
> = {
  brouillon: {
    label: 'Brouillon',
    variant: 'default',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  envoyee: {
    label: 'En attente de signature',
    variant: 'info',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  signee: {
    label: 'Signee',
    variant: 'success',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  signee_client: {
    label: 'Signee',
    variant: 'success',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  signee_of: {
    label: 'Signee',
    variant: 'success',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  signee_complete: {
    label: 'Signee',
    variant: 'success',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  annulee: {
    label: 'Annulee',
    variant: 'danger',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
}

export function ConventionsClient({
  token,
  conventions,
  signataireName,
}: ConventionsClientProps) {
  const [selectedConvention, setSelectedConvention] = useState<any | null>(
    null
  )
  const [signedIds, setSignedIds] = useState<Set<string>>(new Set())

  const enAttente = conventions.filter(
    (c) => c.status === 'envoyee' && !signedIds.has(c.id)
  )

  function handleSuccess() {
    if (selectedConvention) {
      setSignedIds((prev) => new Set(prev).add(selectedConvention.id))
    }
    setSelectedConvention(null)
  }

  function getEffectiveStatus(conv: any): string {
    if (signedIds.has(conv.id)) return 'signee_client'
    return conv.status
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-heading font-bold text-surface-900 tracking-heading mb-1">
        Conventions
      </h1>
      <p className="text-surface-500 text-sm mb-6">
        Vos conventions de formation
      </p>

      {/* Pending signature banner */}
      {enAttente.length > 0 && (
        <div className="mb-6">
          <div className="card p-4 border-warning-200 border bg-warning-50/30">
            <div className="flex items-center gap-2 text-sm font-medium text-warning-800">
              <AlertTriangle className="h-4 w-4" />
              {enAttente.length} convention(s) en attente de signature
            </div>
          </div>
        </div>
      )}

      {/* Convention list */}
      <div className="space-y-3">
        {conventions.map((conv: any) => {
          const effectiveStatus = getEffectiveStatus(conv)
          const sc = statusConfig[effectiveStatus] || statusConfig.brouillon
          const isJustSigned = signedIds.has(conv.id)

          return (
            <div key={conv.id} className="card p-4 md:p-5">
              <div className="flex items-center gap-2 mb-2 min-w-0">
                <FileSignature className="h-4 w-4 text-surface-400 shrink-0" />
                <span className="text-base font-heading font-semibold text-surface-900 truncate">
                  {conv.formation?.intitule || conv.numero}
                </span>
              </div>

              <div className="text-sm text-surface-500 space-y-0.5 mb-3">
                <div>Ref. : {conv.numero}</div>
                <div>
                  {conv.type === 'inter_entreprise' ? 'Inter-entreprise' : 'Intra-entreprise'}
                </div>
                {conv.session?.date_debut && (
                  <div>
                    {formatDate(conv.session.date_debut, { day: 'numeric', month: 'long', year: 'numeric' })}
                    {conv.session.date_fin && conv.session.date_fin !== conv.session.date_debut
                      ? ' — ' + formatDate(conv.session.date_fin, { day: 'numeric', month: 'long' })
                      : ''}
                  </div>
                )}
                {conv.session?.lieu && <div>{conv.session.lieu}</div>}
                {conv.montant_ht != null && (
                  <div>{Number(conv.montant_ht).toLocaleString('fr-FR')} EUR HT</div>
                )}
                {/* Jour réel de la signature, jamais la date portée (ramenée à la veille de la formation) */}
                {(conv.signature_client_date || isJustSigned) && (
                  <div className="flex items-center gap-1.5 text-success-600 font-medium mt-1">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    {conv.signature_client_signed_at || isJustSigned
                      ? `Signée le ${formatDate(
                          conv.signature_client_signed_at || new Date().toISOString(),
                          { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }
                        )}`
                      : 'Signée'}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <Badge variant={sc.variant}>{sc.label}</Badge>
                {effectiveStatus === 'envoyee' && (
                  <button
                    onClick={() => setSelectedConvention(conv)}
                    className="btn-primary flex items-center gap-1.5 text-sm py-1.5 px-3"
                  >
                    <FileSignature className="h-3.5 w-3.5" />
                    Signer
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {conventions.length === 0 && (
        <div className="card flex flex-col items-center justify-center text-center py-16">
          <FileSignature className="h-8 w-8 text-surface-300 mb-3" />
          <p className="text-sm text-surface-500">
            Aucune convention pour le moment
          </p>
        </div>
      )}

      {/* Signature modal */}
      {selectedConvention && (
        <SignatureModal
          token={token}
          convention={selectedConvention}
          signataireName={signataireName}
          onSuccess={handleSuccess}
          onClose={() => setSelectedConvention(null)}
        />
      )}
    </div>
  )
}
