'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Sparkles, Check, ChevronDown, ChevronUp, X, ArrowRight,
  Settings, GraduationCap, Building2, UserPlus, Calendar, FileText, Receipt, Users,
} from 'lucide-react'

export interface OnboardingFlags {
  org: boolean
  formations: boolean
  clients: boolean
  leads: boolean
  sessions: boolean
  devis: boolean
  factures: boolean
  team: boolean
}

const STEPS: { key: keyof OnboardingFlags; icon: any; title: string; what: string; how: string; href: string; cta: string }[] = [
  { key: 'org', icon: Settings, title: "Configurer l'organisme", what: "Renseignez l'identité de votre OF : SIRET, représentant légal, logo, RIB et référent handicap.", how: "Ces informations alimentent automatiquement vos conventions, factures et attestations.", href: '/dashboard/settings', cta: 'Paramètres' },
  { key: 'formations', icon: GraduationCap, title: 'Construire le catalogue', what: "Créez vos formations avec objectifs, programme, prérequis et tarifs.", how: "Une formation est réutilisable sur toutes vos sessions, devis et conventions.", href: '/dashboard/formations', cta: 'Catalogue' },
  { key: 'clients', icon: Building2, title: 'Ajouter vos clients', what: "Enregistrez les entreprises clientes (raison sociale, SIRET, contact).", how: "Le client est rattaché aux devis, conventions et sessions intra.", href: '/dashboard/clients', cta: 'Clients' },
  { key: 'leads', icon: UserPlus, title: 'Suivre vos opportunités', what: "Saisissez vos leads et faites-les avancer dans le pipeline commercial.", how: "Un lead « gagné » crée automatiquement un dossier de formation.", href: '/dashboard/leads', cta: 'Leads' },
  { key: 'sessions', icon: Calendar, title: 'Planifier une session', what: "Programmez une session (dates, lieu, formateur) et inscrivez les apprenants.", how: "La session pilote l'émargement, les évaluations et les convocations.", href: '/dashboard/sessions', cta: 'Sessions' },
  { key: 'devis', icon: FileText, title: 'Devis & conventions', what: "Éditez un devis, puis générez la convention de formation à signer en ligne.", how: "Les PDF reprennent vos données OF, formation et session automatiquement.", href: '/dashboard/devis', cta: 'Devis' },
  { key: 'factures', icon: Receipt, title: 'Facturer & encaisser', what: "Émettez la facture et suivez le paiement (relances incluses).", how: "Reliez la facture au dossier OPCO ou au financeur concerné.", href: '/dashboard/factures', cta: 'Factures' },
  { key: 'team', icon: Users, title: 'Inviter votre équipe', what: "Ajoutez vos commerciaux, gestionnaires et formateurs.", how: "Chaque membre reçoit un email d'invitation et accède à son espace adapté.", href: '/dashboard/users', cta: 'Utilisateurs' },
]

export function OnboardingGuide({ flags, firstName }: { flags: OnboardingFlags; firstName?: string }) {
  const [hidden, setHidden] = useState<boolean | null>(null) // null = pas encore lu localStorage
  const [collapsed, setCollapsed] = useState(false)

  const done = STEPS.filter((s) => flags[s.key]).length
  const total = STEPS.length
  const pct = Math.round((done / total) * 100)
  const allDone = done === total

  useEffect(() => {
    const v = typeof window !== 'undefined' ? localStorage.getItem('ll_onboarding_hidden') : null
    setHidden(v === '1')
  }, [])

  function hide() {
    localStorage.setItem('ll_onboarding_hidden', '1')
    setHidden(true)
  }

  if (hidden === null || hidden) return null

  return (
    <div className="card overflow-hidden border-brand-100">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4 p-5 bg-gradient-to-r from-brand-50 to-white">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-brand-500 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-heading font-bold text-surface-900">
              {allDone ? 'Votre CRM est prêt 🎉' : `Prise en main du CRM${firstName ? `, ${firstName}` : ''}`}
            </h2>
            <p className="text-sm text-surface-500 mt-0.5">
              {allDone ? 'Toutes les étapes clés sont configurées. Vous pouvez masquer ce guide.' : 'Suivez ces étapes pour utiliser le CRM de A à Z. Tout est lié : chaque étape alimente la suivante.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setCollapsed((c) => !c)} className="p-1.5 rounded-lg text-surface-400 hover:bg-surface-100" title={collapsed ? 'Déplier' : 'Replier'}>
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          <button onClick={hide} className="p-1.5 rounded-lg text-surface-400 hover:bg-surface-100" title="Masquer le guide">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progression */}
      <div className="px-5 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-surface-100 overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-semibold text-surface-600 tabular-nums">{done}/{total}</span>
        </div>
      </div>

      {/* Étapes */}
      {!collapsed && (
        <div className="divide-y divide-surface-100 border-t border-surface-100">
          {STEPS.map((s, i) => {
            const isDone = flags[s.key]
            const Icon = s.icon
            return (
              <div key={s.key} className="flex items-start gap-3 px-5 py-3.5 hover:bg-surface-50/50 transition-colors">
                <div className={`mt-0.5 h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${isDone ? 'bg-emerald-500' : 'bg-surface-100'}`}>
                  {isDone ? <Check className="h-3.5 w-3.5 text-white" /> : <span className="text-xs font-bold text-surface-400">{i + 1}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-surface-400 shrink-0" />
                    <span className={`text-sm font-semibold ${isDone ? 'text-surface-400 line-through' : 'text-surface-900'}`}>{s.title}</span>
                  </div>
                  <p className="text-xs text-surface-500 mt-1 leading-relaxed">{s.what}</p>
                  <p className="text-xs text-surface-400 mt-0.5 leading-relaxed">{s.how}</p>
                </div>
                <Link href={s.href} className={`shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isDone ? 'text-surface-500 hover:bg-surface-100' : 'bg-brand-500 text-white hover:bg-brand-600'}`}>
                  {isDone ? 'Revoir' : s.cta} <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
