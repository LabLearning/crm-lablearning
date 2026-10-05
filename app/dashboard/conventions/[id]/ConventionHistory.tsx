import { createServiceRoleClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils'
import { FilePlus2, Send, PenLine, XCircle, RefreshCw, Building2, CheckCircle2, History } from '@/components/ui/icons'

const euros = (n: unknown) => `${Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

const ACTION_META: Record<string, { label: (d: any) => string; Icon: any; cls: string }> = {
  create: { label: () => 'Convention créée', Icon: FilePlus2, cls: 'bg-surface-100 text-surface-600' },
  send_convention_signature: { label: () => 'Envoyée en signature au client', Icon: Send, cls: 'bg-brand-50 text-brand-600' },
  sign_convention: { label: (d) => `Signée par le client${d?.signataire ? ` (${d.signataire})` : ''}`, Icon: PenLine, cls: 'bg-emerald-50 text-emerald-600' },
  cancel_signature_request: { label: () => 'Demande de signature annulée', Icon: XCircle, cls: 'bg-danger-50 text-danger-600' },
  update_status: { label: (d) => `Statut mis à jour${d?.status ? ` → ${d.status}` : ''}`, Icon: RefreshCw, cls: 'bg-surface-100 text-surface-600' },
  update: { label: () => 'Convention modifiée', Icon: RefreshCw, cls: 'bg-surface-100 text-surface-600' },
  corriger_prix_convention: { label: (d) => (d?.avant != null ? `Prix corrigé de ${euros(d.avant)} à ${euros(d?.apres)}, sans avenant` : `Prix fixé à ${euros(d?.apres)}`), Icon: RefreshCw, cls: 'bg-surface-100 text-surface-600' },
  retirer_avenant_correction: { label: (d) => `Avenant n°${d?.avenant ?? ''} retiré : prix corrigé de ${euros(d?.montant_avant)} à ${euros(d?.montant_apres)}`, Icon: RefreshCw, cls: 'bg-surface-100 text-surface-600' },
  akto_envoye: { label: () => 'Dossier envoyé à AKTO', Icon: Building2, cls: 'bg-amber-50 text-amber-700' },
  akto_accord_recu: { label: () => 'Accord de prise en charge AKTO reçu', Icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-600' },
  akto_refuse: { label: () => 'Dossier AKTO refusé', Icon: XCircle, cls: 'bg-danger-50 text-danger-600' },
}

export async function ConventionHistory({ conventionId, organizationId }: { conventionId: string; organizationId: string }) {
  const supabase = await createServiceRoleClient()
  const [{ data: logs }, { data: users }] = await Promise.all([
    supabase.from('audit_logs')
      .select('id, action, created_at, details, user_id')
      .eq('organization_id', organizationId).eq('entity_type', 'convention').eq('entity_id', conventionId)
      .order('created_at', { ascending: false }),
    supabase.from('users').select('id, first_name, last_name').eq('organization_id', organizationId),
  ])

  const userName = new Map((users || []).map((u: any) => [u.id, `${u.first_name || ''} ${u.last_name || ''}`.trim()]))
  // On masque l'événement interne "generate_signature_link" (redondant avec l'envoi)
  const events = (logs || []).filter((l: any) => ACTION_META[l.action])

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
        <History className="h-4 w-4 text-brand-500" />
        <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Historique de la convention</span>
      </div>
      {events.length === 0 ? (
        <div className="text-center py-6 text-sm text-surface-400">Aucun événement enregistré</div>
      ) : (
        <div className="p-4">
          <ol className="relative border-l border-surface-200 ml-3 space-y-4">
            {events.map((e: any) => {
              const meta = ACTION_META[e.action]
              const Icon = meta.Icon
              return (
                <li key={e.id} className="ml-5">
                  <span className={`absolute -left-[13px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white ${meta.cls}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="text-sm font-medium text-surface-800">{meta.label(e.details)}</div>
                  <div className="text-xs text-surface-400">
                    {formatDateTime(e.created_at)}
                    {userName.get(e.user_id) ? ` · ${userName.get(e.user_id)}` : ''}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </div>
  )
}
