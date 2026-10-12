'use client'

import { useState, useMemo } from 'react'
import {
  Send, Eye, Copy, RotateCcw, Flame, Clock, Snowflake,
  User, Building2, Mail, Phone, Check, Pencil, Plus,
} from '@/components/ui/icons'
import { Button, Badge, Modal, Input, Select, useToast, VilleInput } from '@/components/ui'

// ── Templates de prospection (repris du CRM commercial) ──

interface EmailTemplate {
  id: string
  name: string
  icon: React.ReactNode
  subject: string
  body: string
  color: string
}

const TEMPLATES: EmailTemplate[] = [
  {
    id: 'chaud',
    name: 'Chaud',
    icon: <Flame className="h-4 w-4" />,
    color: 'text-danger-600',
    subject: 'Suite à mon passage dans votre établissement',
    body: `{SALUTATION},

Je vous transmets notre catalogue de formations. {NOM_ORGANISME} accompagne les professionnels sur trois axes :

— Expertise sur site : nos formateurs interviennent directement dans votre établissement
— Sécurité & Rendement : des modules pour sécuriser votre activité et optimiser votre rendement
— Gestion administrative : financement jusqu'à 100% par votre OPCO

Je reste à votre disposition pour planifier un échange.

Bien cordialement,
{COMMERCIAL}`,
  },
  {
    id: 'moyen',
    name: 'Moyen',
    icon: <Clock className="h-4 w-4" />,
    color: 'text-warning-600',
    subject: 'Suite à notre rencontre dans votre établissement',
    body: `{SALUTATION},

Ravi d'avoir pu échanger avec vous lors de mon passage dans votre établissement. Comme évoqué, notre solution est conçue pour sécuriser vos pratiques tout en optimisant le rendement global de vos équipes.

Voici comment nous simplifions la démarche pour vous :

— Sans avance de frais : nous sécurisons la prise en charge intégrale par votre OPCO
— Formation sur site : nos formateurs interviennent chez vous, en s'adaptant à vos contraintes
— Gestion complète : nous pilotons tout le montage administratif

Je reste à votre entière disposition si vous souhaitez faire le point sur votre budget disponible.

Bien cordialement,
{COMMERCIAL}`,
  },
  {
    id: 'froid',
    name: 'Froid',
    icon: <Snowflake className="h-4 w-4" />,
    color: 'text-brand-600',
    subject: 'Notre catalogue de formations',
    body: `{SALUTATION},

{NOM_ORGANISME} accompagne les professionnels de votre secteur pour sécuriser leurs pratiques et optimiser le rendement de leurs équipes, directement sur site.

— Prise en charge jusqu'à 100% par votre OPCO, sans avance de frais
— Formations dispensées sur site, adaptées à vos contraintes
— Gestion administrative complète de votre dossier

Je reste à votre disposition si vous souhaitez en savoir plus.

Bien cordialement,
{COMMERCIAL}`,
  },
]

interface HistoryItem {
  id: string
  date: string
  destinataire: string
  etablissement: string
  templateId: string
  email: string
}

export default function ProspectionEmailPage() {
  const { toast } = useToast()

  // Form
  const [civilite, setCivilite] = useState('')
  const [nom, setNom] = useState('')
  const [etablissement, setEtablissement] = useState('')
  const [email, setEmail] = useState('')
  const [telephone, setTelephone] = useState('')
  const [ville, setVille] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [notes, setNotes] = useState('')

  // Commercial info
  const [commercialNom, setCommercialNom] = useState('')
  const [commercialEmail, setCommercialEmail] = useState('')
  const [orgNom, setOrgNom] = useState('')

  // UI
  const [tab, setTab] = useState<'compose' | 'preview' | 'history'>('compose')
  const [showSettings, setShowSettings] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [customBody, setCustomBody] = useState<string | null>(null)

  // Load settings from localStorage
  useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('ll_prospection_settings')
        if (saved) {
          const s = JSON.parse(saved)
          if (s.commercialNom) setCommercialNom(s.commercialNom)
          if (s.commercialEmail) setCommercialEmail(s.commercialEmail)
          if (s.orgNom) setOrgNom(s.orgNom)
        }
        const hist = localStorage.getItem('ll_prospection_history')
        if (hist) setHistory(JSON.parse(hist))
        // Prefill from lead
        const pf = localStorage.getItem('ll_prefill_email')
        if (pf) {
          const d = JSON.parse(pf)
          if (d.nom) setNom(d.nom)
          if (d.prenom) { /* setNom includes prenom in compose */ }
          if (d.email) setEmail(d.email)
          if (d.telephone) setTelephone(d.telephone)
          if (d.etablissement) setEtablissement(d.etablissement)
          if (d.ville) setVille(d.ville)
          localStorage.removeItem('ll_prefill_email')
        }
      } catch {}
    }
  })

  function saveSettings() {
    localStorage.setItem('ll_prospection_settings', JSON.stringify({ commercialNom, commercialEmail, orgNom }))
    setShowSettings(false)
    toast('success', 'Paramètres enregistrés')
  }

  const currentTemplate = selectedTemplate ? TEMPLATES.find(t => t.id === selectedTemplate) : null

  // Render preview
  const preview = useMemo(() => {
    if (!currentTemplate) return ''
    const body = customBody || currentTemplate.body
    const salutation = civilite ? `${civilite} ${nom}` : nom ? `Bonjour ${nom}` : 'Bonjour'
    return body
      .replace(/\{SALUTATION\}/g, salutation)
      .replace(/\{NOM_ORGANISME\}/g, orgNom || 'Notre organisme')
      .replace(/\{COMMERCIAL\}/g, commercialNom || 'L\'équipe commerciale')
      .replace(/\{EMAIL_COMMERCIAL\}/g, commercialEmail || '')
      .replace(/\{ETABLISSEMENT\}/g, etablissement || '')
  }, [currentTemplate, customBody, civilite, nom, orgNom, commercialNom, commercialEmail, etablissement])

  const previewSubject = useMemo(() => {
    if (!currentTemplate) return ''
    return currentTemplate.subject
      .replace(/\{NOM_ORGANISME\}/g, orgNom || 'Notre organisme')
  }, [currentTemplate, orgNom])

  function handleSend() {
    if (!email || !selectedTemplate) {
      toast('error', 'Email et template requis')
      return
    }

    // Add to history
    const item: HistoryItem = {
      id: `h_${Date.now()}`,
      date: new Date().toISOString(),
      destinataire: nom || email,
      etablissement: etablissement || '',
      templateId: selectedTemplate,
      email,
    }
    const newHistory = [item, ...history].slice(0, 100)
    setHistory(newHistory)
    localStorage.setItem('ll_prospection_history', JSON.stringify(newHistory))

    // Copy to clipboard for manual send
    const fullEmail = `Objet : ${previewSubject}\nÀ : ${email}\n\n${preview}`
    navigator.clipboard.writeText(fullEmail)

    toast('success', 'Email copié dans le presse-papier')

    // Reset form
    setCivilite(''); setNom(''); setEtablissement(''); setEmail('')
    setTelephone(''); setVille(''); setSelectedTemplate(null)
    setCustomBody(null); setNotes('')
  }

  // Stats
  const stats = useMemo(() => {
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString()
    const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString()

    return {
      today: history.filter(h => h.date.startsWith(todayStr)).length,
      week: history.filter(h => h.date >= weekAgo).length,
      month: history.filter(h => h.date >= monthAgo).length,
      total: history.length,
      chaud: history.filter(h => h.templateId === 'chaud').length,
      moyen: history.filter(h => h.templateId === 'moyen').length,
      froid: history.filter(h => h.templateId === 'froid').length,
    }
  }, [history])

  return (
    <div className="animate-fade-in max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Prospection Email</h1>
          <p className="text-surface-500 mt-1 text-sm">Envoyez des emails de prospection avec templates personnalisés</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowSettings(true)} icon={<Pencil className="h-4 w-4" />}>Paramètres</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface-100 rounded-lg p-0.5 w-fit">
        {([
          { id: 'compose', label: 'Composer' },
          { id: 'preview', label: 'Aperçu' },
          { id: 'history', label: `Historique (${history.length})` },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.id ? 'bg-white shadow-xs text-surface-900' : 'text-surface-500 hover:text-surface-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Form */}
          <div className="lg:col-span-3 space-y-5">
            <div className="card p-5 space-y-4">
              <div className="flex items-center gap-2.5 mb-1">
                <div className="h-8 w-8 rounded-lg bg-surface-100 flex items-center justify-center">
                  <User className="h-4 w-4 text-surface-600" />
                </div>
                <span className="text-sm font-heading font-semibold text-surface-900 tracking-tight">Destinataire</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-surface-500 mb-1.5 block">Civilité</label>
                  <select className="input-base" value={civilite} onChange={e => setCivilite(e.target.value)}>
                    <option value="">—</option>
                    <option value="Monsieur">Monsieur</option>
                    <option value="Madame">Madame</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-surface-500 mb-1.5 block">Nom</label>
                  <input className="input-base" value={nom} onChange={e => setNom(e.target.value)} placeholder="Nom du contact" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-surface-500 mb-1.5 block">Établissement</label>
                  <input className="input-base" value={etablissement} onChange={e => setEtablissement(e.target.value)} placeholder="Nom de l'établissement" />
                </div>
                <div>
                  <label className="text-xs font-medium text-surface-500 mb-1.5 block">Ville</label>
                  <VilleInput autonome value={ville} onChange={e => setVille(e.target.value)} placeholder="Ville" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-surface-500 mb-1.5 block">Email *</label>
                  <input className="input-base" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemple.fr" />
                </div>
                <div>
                  <label className="text-xs font-medium text-surface-500 mb-1.5 block">Téléphone</label>
                  <input className="input-base" value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="06 XX XX XX XX" />
                </div>
              </div>
            </div>

            {/* Template selection */}
            <div className="card p-5">
              <div className="text-sm font-heading font-semibold text-surface-900 tracking-tight mb-3">Type d'email</div>
              <div className="grid grid-cols-3 gap-3">
                {TEMPLATES.map(t => (
                  <button key={t.id} onClick={() => { setSelectedTemplate(t.id); setCustomBody(null) }}
                    className={`p-4 rounded-xl text-center transition-all duration-150 ${
                      selectedTemplate === t.id
                        ? 'bg-surface-900 text-white shadow-xs'
                        : 'bg-surface-50 text-surface-600 hover:bg-surface-100'
                    }`}>
                    <div className={`mx-auto mb-2 ${selectedTemplate === t.id ? 'text-white' : t.color}`}>{t.icon}</div>
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className={`text-xs mt-0.5 ${selectedTemplate === t.id ? 'text-white/60' : 'text-surface-400'}`}>Prospection</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom body */}
            {currentTemplate && (
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-heading font-semibold text-surface-900 tracking-tight">Contenu</span>
                  {customBody && (
                    <button onClick={() => setCustomBody(null)} className="text-xs text-surface-400 hover:text-surface-600">
                      Réinitialiser
                    </button>
                  )}
                </div>
                <textarea
                  className="input-base resize-none font-mono text-xs leading-relaxed"
                  rows={12}
                  value={customBody || currentTemplate.body}
                  onChange={e => setCustomBody(e.target.value)}
                />
                <div className="text-xs text-surface-400 mt-2">
                  Variables : {'{SALUTATION}'}, {'{NOM_ORGANISME}'}, {'{COMMERCIAL}'}, {'{ETABLISSEMENT}'}
                </div>
              </div>
            )}

            {/* Send */}
            <div className="flex gap-2">
              <Button onClick={handleSend} icon={<Copy className="h-4 w-4" />} disabled={!email || !selectedTemplate}>
                Copier l'email
              </Button>
              <Button variant="secondary" onClick={() => setTab('preview')} icon={<Eye className="h-4 w-4" />} disabled={!selectedTemplate}>
                Aperçu
              </Button>
            </div>
          </div>

          {/* Stats sidebar */}
          <div className="lg:col-span-2 space-y-4">
            <div className="card p-5">
              <div className="text-sm font-heading font-semibold text-surface-900 tracking-tight mb-3">Statistiques</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Aujourd'hui", value: stats.today },
                  { label: 'Cette semaine', value: stats.week },
                  { label: 'Ce mois', value: stats.month },
                  { label: 'Total', value: stats.total },
                ].map(s => (
                  <div key={s.label} className="p-3 rounded-xl bg-surface-50 text-center">
                    <div className="text-xl font-heading font-bold text-surface-800">{s.value}</div>
                    <div className="text-[11px] text-surface-400">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-surface-100 space-y-1.5">
                {TEMPLATES.map(t => (
                  <div key={t.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-surface-500">
                      <span className={t.color}>{t.icon}</span> {t.name}
                    </span>
                    <span className="font-medium text-surface-800">{stats[t.id as 'chaud' | 'moyen' | 'froid']}</span>
                  </div>
                ))}
              </div>
            </div>

            {!commercialNom && (
              <div className="card p-4 border-warning-200 border">
                <div className="text-xs text-warning-700 font-medium mb-1">Paramètres manquants</div>
                <div className="text-xs text-warning-600">Configurez votre nom commercial dans les paramètres.</div>
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => setShowSettings(true)}>
                  Configurer
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview */}
      {tab === 'preview' && currentTemplate && (
        <div className="card p-8 max-w-2xl mx-auto">
          <div className="mb-4 pb-4 border-b border-surface-100">
            <div className="text-xs text-surface-400 mb-1">Objet</div>
            <div className="text-sm font-semibold text-surface-900">{previewSubject}</div>
            {email && <div className="text-xs text-surface-400 mt-1">À : {email}</div>}
          </div>
          <div className="whitespace-pre-line text-sm text-surface-700 leading-relaxed">
            {preview}
          </div>
        </div>
      )}

      {/* History */}
      {tab === 'history' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-100">
                  <th className="table-header">Date</th>
                  <th className="table-header">Destinataire</th>
                  <th className="table-header">Établissement</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {history.map(h => {
                  const tpl = TEMPLATES.find(t => t.id === h.templateId)
                  return (
                    <tr key={h.id} className="table-row">
                      <td className="table-cell text-sm text-surface-500">
                        {new Date(h.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="table-cell text-sm font-medium text-surface-800">{h.destinataire}</td>
                      <td className="table-cell text-sm text-surface-600">{h.etablissement || '—'}</td>
                      <td className="table-cell">
                        {tpl && <Badge variant={h.templateId === 'chaud' ? 'danger' : h.templateId === 'moyen' ? 'warning' : 'info'}>{tpl.name}</Badge>}
                      </td>
                      <td className="table-cell text-sm text-surface-500">{h.email}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {history.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-14 px-8">
              <div className="h-12 w-12 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
                <Mail className="h-6 w-6 text-surface-400" />
              </div>
              <p className="text-sm text-surface-500">Aucun email envoyé pour le moment</p>
            </div>
          )}
        </div>
      )}

      {/* Settings Modal */}
      <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} title="Paramètres de prospection">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-surface-500 mb-1.5 block">Votre nom</label>
            <input className="input-base" value={commercialNom} onChange={e => setCommercialNom(e.target.value)} placeholder="Prénom Nom" />
          </div>
          <div>
            <label className="text-xs font-medium text-surface-500 mb-1.5 block">Votre email</label>
            <input className="input-base" type="email" value={commercialEmail} onChange={e => setCommercialEmail(e.target.value)} placeholder="vous@organisme.fr" />
          </div>
          <div>
            <label className="text-xs font-medium text-surface-500 mb-1.5 block">Nom de l'organisme</label>
            <input className="input-base" value={orgNom} onChange={e => setOrgNom(e.target.value)} placeholder="Lab Learning" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowSettings(false)}>Annuler</Button>
            <Button onClick={saveSettings} icon={<Check className="h-4 w-4" />}>Enregistrer</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
