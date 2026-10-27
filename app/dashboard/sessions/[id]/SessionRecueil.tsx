'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList, Save, CheckCircle2, AlertTriangle, Download, Accessibility, PenLine, Info } from '@/components/ui/icons'
import { Button, Badge, Select, Modal, useToast } from '@/components/ui'
import { themeOf } from '@/lib/branches'
import { formatDate } from '@/lib/utils'
import { reponsesAutoRecueilAction, saveRecueilAction } from './recueil-actions'
import { lireTraceAuto } from '@/lib/recueil-auto'

interface Question { id: string; label: string; type?: string }
interface Template { id: string; theme: string; nom: string; questions: Question[] }
interface Recueil { template_id: string | null; theme: string | null; reponses: Record<string, string>; statut: string; date_recueil: string | null }

const THEME_LABELS: Record<string, string> = {
  hygiene: 'Hygiène & sécurité alimentaire',
  prevention: 'Prévention & sécurité au travail',
  management: 'Management, gestion & performance',
  metier: 'Cœur de métier',
}

// Fiche « Analyse des besoins pour les personnes en situation de handicap »
// (procédure PSH transmise par la consultante qualité) — les intitulés
// reprennent le document d'origine.
const PSH_ADAPTATIONS = [
  'Approche pédagogique adaptée',
  'Remise à niveau',
  'Modification du rythme',
  'Outils adaptés (FOAD…)',
  'Aide à la rédaction',
  'Soutien pédagogique individuel',
  'Cadre adapté',
  'Temps complémentaires',
  "Préparation renforcée à l'épreuve",
]

export function SessionRecueil({ sessionId, formationIntitule, templates, initial }: {
  sessionId: string
  formationIntitule: string
  templates: Template[]
  initial: Recueil | null
}) {
  const { toast } = useToast()
  const router = useRouter()

  const detectedTheme = initial?.theme || themeOf(formationIntitule || '')
  const [theme, setTheme] = useState<string>(detectedTheme)
  const template = useMemo(() => templates.find((t) => t.theme === theme) || null, [templates, theme])
  const [reponses, setReponses] = useState<Record<string, string>>(initial?.reponses || {})
  const [saving, setSaving] = useState(false)
  const [statut, setStatut] = useState<string>(initial?.statut || 'brouillon')
  const [pshOpen, setPshOpen] = useState(false)

  const questions = template?.questions || []
  const filled = questions.filter((q) => (reponses[q.id] || '').trim()).length
  const pshActif = reponses.psh_actif === 'oui'
  const adaptations = (reponses.psh_adaptations || '').split(',').map((x) => x.trim()).filter(Boolean)

  // Rempli par le CRM (à la création du dossier, puis chaque heure jusqu'au début de la session)
  const trace = useMemo(() => lireTraceAuto(initial?.reponses), [initial?.reponses])
  const [prerempli, setPrerempli] = useState(false)
  async function preRemplir() {
    setPrerempli(true)
    const r = await reponsesAutoRecueilAction(sessionId, theme)
    setPrerempli(false)
    if (!r.success || !r.data) { toast('error', r.error || 'Pré-remplissage impossible'); return }
    const auto = r.data.reponses
    setReponses((prev) => {
      const suivantes = { ...prev }
      for (const [id, v] of Object.entries(auto)) if (!String(prev[id] || '').trim()) suivantes[id] = v
      return suivantes
    })
    toast('success', 'Champs vides pré-remplis à partir de la formation, du client et des inscrits : relisez puis enregistrez')
  }

  const setPsh = (cle: string, valeur: string) => setReponses((prev) => ({ ...prev, [cle]: valeur }))
  const toggleAdaptation = (a: string) => {
    const suivantes = adaptations.includes(a) ? adaptations.filter((x) => x !== a) : [...adaptations, a]
    setPsh('psh_adaptations', suivantes.join(', '))
  }

  async function save(newStatut: 'brouillon' | 'complete') {
    if (newStatut === 'complete' && filled < Math.ceil(questions.length / 2)) {
      toast('error', 'Complétez au moins la moitié des champs avant de valider')
      return
    }
    setSaving(true)
    const r = await saveRecueilAction({ sessionId, templateId: template?.id || null, theme, reponses, statut: newStatut })
    if (r.success) { toast('success', newStatut === 'complete' ? 'Recueil du besoin complété' : 'Brouillon enregistré'); setStatut(newStatut); router.refresh() }
    else toast('error', r.error || 'Erreur')
    setSaving(false)
  }

  if (templates.length === 0) {
    return (
      <div className="card p-6 border-warning-200 bg-warning-50/40 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-warning-600 shrink-0 mt-0.5" />
        <div className="text-sm text-surface-700">
          <div className="font-semibold text-surface-900">Modèles de recueil non initialisés</div>
          Applique la migration <code>105_recueil_besoin.sql</code> puis lance le seed des modèles par thème.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-heading font-semibold text-surface-900 flex items-center gap-2"><ClipboardList className="h-5 w-5 text-brand-500" /> Recueil du besoin</h3>
          <p className="text-sm text-surface-500 mt-0.5">Analyse du besoin du commanditaire — indicateur Qualiopi 4.</p>
        </div>
        <div className="flex items-center gap-2">
          {statut === 'complete'
            ? <Badge variant="success">Complété{initial?.date_recueil ? ` le ${formatDate(initial.date_recueil, { day: 'numeric', month: 'short' })}` : ''}</Badge>
            : <Badge variant="warning">Brouillon</Badge>}
          {initial && (
            <a href={`/api/pdf/recueil-besoin/${sessionId}`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-2.5 py-1.5 text-xs font-medium text-surface-700 hover:bg-surface-50">
              <Download className="h-3.5 w-3.5" /> PDF
            </a>
          )}
        </div>
      </div>

      {trace && (
        <div className="flex items-start gap-2.5 rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-3 text-sm text-surface-700">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <span>
            Rempli automatiquement le {formatDate(trace.le, { day: 'numeric', month: 'long', year: 'numeric' })} à partir de la formation, du client et des inscrits.
            Relisez et ajustez si besoin : vos modifications sont gardées, les autres champs suivent le dossier (inscrits, horaires) jusqu’au début de la session.
          </span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Select
          id="theme" label="Modèle (thème détecté automatiquement)"
          value={theme} onChange={(e) => setTheme(e.target.value)}
          options={templates.map((t) => ({ value: t.theme, label: `${THEME_LABELS[t.theme] || t.theme}` }))}
        />
        <div className="text-xs text-surface-400 pt-6 whitespace-nowrap">{filled}/{questions.length} champs</div>
        {filled < questions.length && (
          <div className="pt-6">
            <Button size="sm" variant="secondary" onClick={preRemplir} isLoading={prerempli} icon={<PenLine className="h-3.5 w-3.5" />}>Pré-remplir les champs vides</Button>
          </div>
        )}
      </div>

      {/* Public en situation de handicap : cocher ouvre l'analyse des besoins
          PSH (procédure dédiée) — indicateur 4 et 26. */}
      <div className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-3 ${pshActif ? 'border-brand-300 bg-brand-50/40' : 'border-surface-200'}`}>
        <label className="flex items-center gap-2.5 text-sm text-surface-700 cursor-pointer">
          <input
            type="checkbox" className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
            checked={pshActif}
            onChange={(e) => {
              setPsh('psh_actif', e.target.checked ? 'oui' : '')
              if (e.target.checked) setPshOpen(true)
            }}
          />
          <Accessibility className="h-4 w-4 text-brand-500" />
          Stagiaire(s) en situation de handicap identifié(s)
        </label>
        {pshActif && (
          <button onClick={() => setPshOpen(true)} className="text-xs font-medium text-brand-600 hover:text-brand-700 whitespace-nowrap">
            Ouvrir la procédure PSH
          </button>
        )}
      </div>

      <div className="space-y-4">
        {questions.map((q) => (
          <div key={q.id}>
            <label className="block text-sm font-medium text-surface-700 mb-1">{q.label}</label>
            <textarea
              rows={2} className="input-base resize-none"
              value={reponses[q.id] || ''}
              onChange={(e) => setReponses((prev) => ({ ...prev, [q.id]: e.target.value }))}
              placeholder="…"
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3 pt-1 border-t border-surface-100">
        <Button variant="secondary" onClick={() => save('brouillon')} isLoading={saving} icon={<Save className="h-4 w-4" />}>Enregistrer le brouillon</Button>
        <Button onClick={() => save('complete')} isLoading={saving} icon={<CheckCircle2 className="h-4 w-4" />}>Marquer comme complété</Button>
      </div>

      <Modal isOpen={pshOpen} onClose={() => setPshOpen(false)} title="Procédure PSH — Analyse des besoins" size="lg">
        <div className="space-y-4 text-sm">
          <p className="text-surface-600 leading-relaxed">
            Analyse des besoins pour les personnes en situation de handicap, menée avec le
            <strong> référent handicap</strong> dès l&apos;identification. Les contacts mobilisables
            (RHF Agefiph, Cap emploi, MDPH) sont dans le <a href="/dashboard/qualiopi/handicap" target="_blank" className="text-brand-600 hover:underline">réseau handicap</a>.
          </p>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Contraintes personnelles et professionnelles — mobilité</label>
            <textarea rows={2} className="input-base resize-none" placeholder="Voiture, transports en commun, permis, véhicule, autres contraintes…"
              value={reponses.psh_mobilite || ''} onChange={(e) => setPsh('psh_mobilite', e.target.value)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Contre-indications médicales</label>
              <textarea rows={2} className="input-base resize-none" placeholder="Avez-vous des contre-indications médicales ?"
                value={reponses.psh_contre_indications || ''} onChange={(e) => setPsh('psh_contre_indications', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Statut de travailleur handicapé (RQTH)</label>
              <select className="input-base" value={reponses.psh_rqth || ''} onChange={(e) => setPsh('psh_rqth', e.target.value)}>
                <option value="">Non renseigné</option>
                <option value="oui">Oui</option>
                <option value="non">Non</option>
                <option value="en_cours">Demande en cours</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Besoins spécifiques pendant l&apos;action de formation</label>
            <textarea rows={2} className="input-base resize-none" placeholder="Si oui, lesquels…"
              value={reponses.psh_besoins || ''} onChange={(e) => setPsh('psh_besoins', e.target.value)} />
          </div>

          <div>
            <div className="text-sm font-medium text-surface-700 mb-2">Besoins d&apos;adaptation pédagogique</div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {PSH_ADAPTATIONS.map((a) => (
                <label key={a} className="flex items-center gap-2 text-sm text-surface-700 cursor-pointer">
                  <input type="checkbox" className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                    checked={adaptations.includes(a)} onChange={() => toggleAdaptation(a)} />
                  {a}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Synthèse des compensations à mettre en place ou orientation vers des partenaires</label>
            <textarea rows={3} className="input-base resize-none" placeholder="Compensations retenues, aménagements, orientation RHF / Cap emploi / MDPH…"
              value={reponses.psh_compensations || ''} onChange={(e) => setPsh('psh_compensations', e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-surface-100">
            <Button variant="secondary" onClick={() => setPshOpen(false)}>Fermer</Button>
            <Button onClick={async () => { await save('brouillon'); setPshOpen(false) }} isLoading={saving} icon={<Save className="h-4 w-4" />}>
              Enregistrer l&apos;analyse
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
