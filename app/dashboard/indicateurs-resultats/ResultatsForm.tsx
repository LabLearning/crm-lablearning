'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BarChart3, Save, ExternalLink, AlertTriangle, Sparkles, Globe, Download } from '@/components/ui/icons'
import { Button, Input, Badge, useToast } from '@/components/ui'
import { saveResultatsAction } from './actions'

export function ResultatsForm({ current, tableReady, reussiteCalc, nbEvals, assiduiteCalc, nbAttendees, nbSessionsTerm }: {
  current: any
  tableReady: boolean
  reussiteCalc: number | null
  nbEvals: number
  assiduiteCalc: number | null
  nbAttendees: number
  nbSessionsTerm: number
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [publie, setPublie] = useState<boolean>(!!current?.publie)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    fd.set('publie', publie ? 'true' : 'false')
    const r = await saveResultatsAction(fd)
    if (r.success) { toast('success', 'Indicateurs enregistrés'); router.refresh() }
    else toast('error', r.error || 'Erreur')
    setSaving(false)
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-brand-500" /> Indicateurs de résultats
        </h1>
        <p className="text-surface-500 mt-1 text-sm">Indicateur Qualiopi 2 — <strong>publication obligatoire</strong>. Ces taux doivent être accessibles au public.</p>
      </div>

      {!tableReady && (
        <div className="card p-5 mb-6 border-warning-200 bg-warning-50/40 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning-600 shrink-0 mt-0.5" />
          <div className="text-sm text-surface-700">
            <div className="font-semibold text-surface-900">Migration à appliquer</div>
            Applique <code>106_indicateurs_resultats.sql</code> dans Supabase, puis renseigne tes taux ici.
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <Input name="periode" label="Période" defaultValue={current?.periode || ''} placeholder="Ex : 2025 ou « 12 derniers mois »" />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Input name="taux_reussite" label="Taux de réussite (%)" defaultValue={current?.taux_reussite ?? (reussiteCalc ?? '')} placeholder="ex : 94" />
            {reussiteCalc != null && (
              <div className="mt-1 text-2xs text-brand-600 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Calculé sur {nbEvals} évaluations réelles : <strong>{reussiteCalc}%</strong>
              </div>
            )}
          </div>
          <Input name="taux_satisfaction" label="Taux de satisfaction (%)" defaultValue={current?.taux_satisfaction ?? ''} placeholder="ex : 92 (données papier)" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Input name="taux_assiduite" label="Taux d'assiduité (%)" defaultValue={current?.taux_assiduite ?? (assiduiteCalc ?? '')} placeholder="ex : 96" />
            {assiduiteCalc != null && (
              <div className="mt-1 text-2xs text-brand-600 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Calculé sur {nbAttendees} présences réelles (Dendreo) : <strong>{assiduiteCalc}%</strong>
              </div>
            )}
          </div>
          <Input name="taux_insertion" label="Taux d'insertion / retour à l'emploi (%)" defaultValue={current?.taux_insertion ?? ''} placeholder="ex : 70 (POEI)" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Input name="nb_sessions" label="Nombre de sessions" defaultValue={current?.nb_sessions ?? nbSessionsTerm} />
            <div className="mt-1 text-2xs text-surface-400">Sessions terminées : {nbSessionsTerm}</div>
          </div>
          <Input name="nb_stagiaires" label="Nombre de stagiaires formés" defaultValue={current?.nb_stagiaires ?? ''} />
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1">Commentaire / méthodologie</label>
          <textarea name="commentaire" rows={2} className="input-base resize-none" defaultValue={current?.commentaire || ''}
            placeholder="Ex : Réussite = évaluations des acquis ≥ 10/20 ; satisfaction = questionnaires à chaud…" />
        </div>

        <label className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 cursor-pointer">
          <input type="checkbox" checked={publie} onChange={(e) => setPublie(e.target.checked)} className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
          <span className="flex items-center gap-2 text-sm font-medium text-surface-800"><Globe className="h-4 w-4 text-brand-500" /> Publier sur le site public</span>
          {publie ? <Badge variant="success">Publié</Badge> : <Badge variant="warning">Non publié</Badge>}
        </label>

        <div className="flex items-center justify-between gap-3 pt-2 border-t border-surface-100">
          <div className="flex flex-col gap-1">
            <Link href="https://www.lab-learning.fr/resultats" target="_blank" className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline">
              <ExternalLink className="h-4 w-4" /> Voir la page publique
            </Link>
            <a href="/api/pdf/pointage-papier" className="inline-flex items-center gap-1.5 text-sm text-surface-600 hover:underline">
              <Download className="h-4 w-4" /> Feuille de pointage à confirmer (présences non saisies)
            </a>
          </div>
          <Button type="submit" isLoading={saving} icon={<Save className="h-4 w-4" />}>Enregistrer</Button>
        </div>
      </form>
    </div>
  )
}
