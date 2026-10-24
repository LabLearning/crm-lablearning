'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Mail, MessageSquare, Plus, AlertTriangle, Info, Users, Send, CalendarClock } from '@/components/ui/icons'
import { Button, useToast } from '@/components/ui'
import { cn, formatDate } from '@/lib/utils'
import { STATUTS_CAMPAGNE, type StatutCampagne } from '@/lib/campagnes/regles'
import { creerCampagneAction } from './actions'

export const STYLE_STATUT: Record<StatutCampagne, string> = {
  brouillon: 'bg-surface-100 text-surface-600',
  programmee: 'bg-info-50 text-info-600',
  en_cours: 'bg-warning-50 text-warning-700',
  envoyee: 'bg-success-50 text-success-700',
  annulee: 'bg-surface-100 text-surface-500',
}

interface CampagneResume {
  id: string; nom: string; canal: 'email' | 'sms'; statut: StatutCampagne; objet: string | null
  nb_destinataires: number; nb_envoyes: number; nb_echecs: number; nb_desinscrits: number
  programmee_le: string | null; lancee_le: string | null; terminee_le: string | null; created_at: string
}

export function CampagnesListe({ campagnes, migrationManquante, manquesEmail, manquesSms, webhookBranche, urlWebhook, oppositions }: {
  campagnes: CampagneResume[]
  migrationManquante: boolean
  manquesEmail: string[]
  manquesSms: string[]
  webhookBranche: boolean
  urlWebhook: string
  oppositions: { email: number; sms: number }
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()

  function nouvelle(canal: 'email' | 'sms') {
    startTransition(async () => {
      const r = await creerCampagneAction(canal)
      if (r?.success && r.data) router.push(`/dashboard/campagnes/${r.data.id}`)
      else toast('error', r?.error || 'Pas de réponse du serveur : réessayez')
    })
  }

  const quand = (c: CampagneResume) => c.statut === 'programmee' && c.programmee_le
    ? `Programmée le ${formatDate(c.programmee_le, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
    : c.statut === 'annulee' && c.terminee_le ? `Arrêtée le ${formatDate(c.terminee_le, { day: 'numeric', month: 'short', year: 'numeric' })}`
    : c.terminee_le ? `Envoyée le ${formatDate(c.terminee_le, { day: 'numeric', month: 'short', year: 'numeric' })}`
    : c.lancee_le ? `Lancée le ${formatDate(c.lancee_le, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
    : `Créée le ${formatDate(c.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}`

  return (
    <div className="space-y-5">
      <div className="page-header flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Campagnes</h1>
          <p className="mt-1 text-sm text-surface-500">E-mails et SMS aux prospects et aux clients professionnels, avec désinscription en un clic.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => nouvelle('email')} disabled={pending || migrationManquante} icon={<Mail className="h-3.5 w-3.5" />}>Campagne e-mail</Button>
          <Button size="sm" variant="secondary" onClick={() => nouvelle('sms')} disabled={pending || migrationManquante} icon={<MessageSquare className="h-3.5 w-3.5" />}>Campagne SMS</Button>
        </div>
      </div>

      {migrationManquante && (
        <div className="card flex items-start gap-3 border-warning-100 bg-warning-50 p-4 text-sm text-warning-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span><span className="font-semibold">Migration 168 à appliquer</span> dans l’éditeur SQL de Supabase (après la 167) pour créer les campagnes.</span>
        </div>
      )}

      {!migrationManquante && (manquesEmail.length > 0 || manquesSms.length > 0 || !webhookBranche) && (
        <div className="card space-y-2 border-info-100 bg-info-50/60 p-4 text-sm text-surface-700">
          <div className="flex items-center gap-2 font-semibold text-surface-900"><Info className="h-4 w-4 text-info-600" /> Envoi à brancher chez Brevo</div>
          <p>Les brouillons, l’audience et l’aperçu marchent déjà. Pour envoyer, il manque dans les variables de Vercel :</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {Array.from(new Set([...manquesEmail, ...manquesSms])).map((m) => <li key={m}>{m}</li>)}
            {!webhookBranche && <li>la clé du webhook (BREVO_WEBHOOK_SECRET), puis le webhook déclaré chez Brevo : <code className="break-all text-xs">{urlWebhook}…</code> (désinscriptions, rebonds, STOP)</li>}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-surface-400"><Send className="h-3.5 w-3.5" /> Envoyées</div>
          <div className="mt-1 text-2xl font-heading font-bold text-surface-900 tabular-nums">{campagnes.filter((c) => c.statut === 'envoyee').length}</div>
          <div className="mt-0.5 text-xs text-surface-500 tabular-nums">{campagnes.reduce((n, c) => n + (c.nb_envoyes || 0), 0)} messages partis</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-surface-400"><CalendarClock className="h-3.5 w-3.5" /> À venir</div>
          <div className="mt-1 text-2xl font-heading font-bold text-surface-900 tabular-nums">{campagnes.filter((c) => c.statut === 'programmee' || c.statut === 'en_cours').length}</div>
          <div className="mt-0.5 text-xs text-surface-500">Programmées ou en cours d’envoi</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-surface-400"><Users className="h-3.5 w-3.5" /> Oppositions</div>
          <div className="mt-1 text-2xl font-heading font-bold text-surface-900 tabular-nums">{oppositions.email + oppositions.sms}</div>
          <div className="mt-0.5 text-xs text-surface-500 tabular-nums">E-mail {oppositions.email} · SMS {oppositions.sms} · plus aucune campagne sur ce canal</div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {campagnes.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-medium text-surface-800">Aucune campagne pour l’instant</p>
            <p className="mt-1 text-xs text-surface-500">Créez une campagne e-mail ou SMS : choisissez l’audience, écrivez le message, envoyez-vous un essai.</p>
          </div>
        ) : (
          <ul className="divide-y divide-surface-100">
            {campagnes.map((c) => (
              <li key={c.id}>
                <Link href={`/dashboard/campagnes/${c.id}`} className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-50/70 sm:items-center">
                  <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', c.canal === 'email' ? 'bg-brand-50 text-brand-600' : 'bg-info-50 text-info-600')}>
                    {c.canal === 'email' ? <Mail className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-surface-900">{c.nom}</span>
                    <span className="mt-0.5 block truncate text-xs text-surface-500">{c.canal === 'email' ? (c.objet || 'Sans objet') : 'SMS'} · {quand(c)}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', STYLE_STATUT[c.statut])}>{STATUTS_CAMPAGNE[c.statut]}</span>
                    {c.nb_destinataires > 0 && (
                      <span className="text-[11px] text-surface-400 tabular-nums">
                        {c.nb_envoyes}/{c.nb_destinataires} partis{c.nb_echecs ? ` · ${c.nb_echecs} échecs` : ''}{c.nb_desinscrits ? ` · ${c.nb_desinscrits} désinscrits` : ''}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
