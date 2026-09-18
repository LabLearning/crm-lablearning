'use client'

import { useState } from 'react'
import { Mail, CheckCircle2, XCircle, ChevronDown, ChevronRight, Paperclip } from '@/components/ui/icons'
import { cn } from '@/lib/utils'

interface EmailLog {
  id: string
  to_email: string | null
  to_name: string | null
  subject: string | null
  template: string | null
  status: string | null
  error: string | null
  sent_at: string | null
  created_at: string
}

const TEMPLATE_LABELS: Record<string, string> = {
  attestation_entree: "Attestation d'entrée",
  poei_groupe: 'Mail groupé',
  evaluation_formateur: 'Évaluation formateur (référent)',
  hygiene_poei: 'Attestations hygiène + diplôme',
  convocation: 'Convocation',
  livret_accueil: "Livret d'accueil",
}

function fmtDateHeure(d: string | null): string {
  if (!d) return '—'
  try {
    const dt = new Date(d)
    return `${dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })} à ${dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  } catch { return '—' }
}

export function PoeiEmailHistory({ logs }: { logs: EmailLog[] }) {
  const [open, setOpen] = useState(false)

  if (logs.length === 0) return null

  const envoyes = logs.filter((l) => l.status === 'sent').length
  const echecs = logs.length - envoyes
  // Regroupe par envoi (même objet + même minute = une campagne)
  const dernier = logs[0]

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 sm:px-5 py-3.5 text-left hover:bg-surface-50/60 transition-colors"
      >
        {open ? <ChevronDown className="h-4 w-4 text-surface-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-surface-400 shrink-0" />}
        <Mail className="h-4 w-4 text-brand-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-surface-900">
            Historique des emails
            <span className="ml-2 text-xs font-normal text-surface-400">
              {envoyes} envoyé{envoyes > 1 ? 's' : ''}{echecs > 0 && ` · ${echecs} échec${echecs > 1 ? 's' : ''}`}
            </span>
          </div>
          <div className="text-xs text-surface-500 truncate">
            Dernier : {fmtDateHeure(dernier.sent_at || dernier.created_at)}
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-surface-100 divide-y divide-surface-100 max-h-96 overflow-y-auto">
          {logs.map((l) => {
            const ok = l.status === 'sent'
            return (
              <div key={l.id} className="flex items-start gap-3 px-4 sm:px-5 py-3">
                <div className="mt-0.5 shrink-0">
                  {ok
                    ? <CheckCircle2 className="h-4 w-4 text-success-500" />
                    : <XCircle className="h-4 w-4 text-danger-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-surface-900 break-words sm:truncate">{l.subject || '(sans objet)'}</div>
                  <div className="text-xs text-surface-500 break-words sm:truncate">
                    {l.to_name ? `${l.to_name}, ` : ''}{l.to_email}
                  </div>
                  {!ok && l.error && (
                    <div className="text-xs text-danger-600 mt-0.5 truncate" title={l.error}>Erreur : {l.error}</div>
                  )}
                  {/* Sur téléphone, date et type passent sous le sujet plutôt qu'à droite */}
                  <div className="flex sm:hidden flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                    <span className="text-xs text-surface-600 tabular-nums">{fmtDateHeure(l.sent_at || l.created_at)}</span>
                    {l.template && (
                      <span className={cn(
                        'inline-block px-1.5 py-0.5 rounded text-[11px] font-medium',
                        l.template === 'poei_groupe' ? 'bg-brand-50 text-brand-700' : 'bg-surface-100 text-surface-500',
                      )}>
                        {TEMPLATE_LABELS[l.template] || l.template}
                      </span>
                    )}
                  </div>
                </div>
                <div className="hidden sm:block text-right shrink-0">
                  <div className="text-xs text-surface-600 tabular-nums">{fmtDateHeure(l.sent_at || l.created_at)}</div>
                  {l.template && (
                    <span className={cn(
                      'inline-block mt-1 px-1.5 py-0.5 rounded text-[11px] font-medium',
                      l.template === 'poei_groupe' ? 'bg-brand-50 text-brand-700' : 'bg-surface-100 text-surface-500',
                    )}>
                      {TEMPLATE_LABELS[l.template] || l.template}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
