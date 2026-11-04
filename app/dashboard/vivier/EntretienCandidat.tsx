'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PhoneCall, Save, Loader2 } from '@/components/ui/icons'
import { useToast } from '@/components/ui'
import {
  CRITERES, DECISIONS, DUREES_HEBDO, NOTE_MAX, REPONSES_FERMEES, TYPES_CONTRAT,
  CONCLUSION, PRESENTATION_FORMATION, RAPPEL_RECRUTEUR,
  entretienVide, libelleContrat, phraseAccueil, questionsEntretien, totalEntretien,
  type ContexteEntretien, type Entretien, type Partie,
} from '@/lib/entretien-candidat'
import { enregistrerEntretienCandidatAction } from './actions'

const PARTIES: { id: Partie; titre: string }[] = [
  { id: 'motivation', titre: 'Motivation' },
  { id: 'experience', titre: 'Expérience et compétences' },
  { id: 'disponibilites', titre: 'Disponibilités et attentes' },
  { id: 'formation', titre: 'Formation préalable de 4 semaines' },
]

function Pastilles<T extends string | number>({ options, valeur, onChoix, libelle }: {
  options: readonly T[]; valeur: T | null | undefined; onChoix: (v: T) => void; libelle?: (v: T) => string
}) {
  return (
    <div className="inline-flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={String(o)} type="button" onClick={() => onChoix(o)}
          className={`min-h-[36px] rounded-lg px-3 text-xs font-semibold transition-colors ${valeur === o ? 'bg-surface-900 text-white' : 'border border-surface-200 bg-white text-surface-600 hover:border-surface-300'}`}>
          {libelle ? libelle(o) : String(o)}
        </button>
      ))}
    </div>
  )
}

function Partie({ numero, titre, children }: { numero: number; titre: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t border-surface-100 pt-5">
      <h3 className="flex items-center gap-2 font-heading text-sm font-bold text-surface-900">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700">{numero}</span>
        {titre}
      </h3>
      {children}
    </section>
  )
}

/**
 * Entretien de présélection téléphonique d'un candidat du vivier
 * (lib/entretien-candidat.ts) : la trame d'appel, les réponses, les notes et
 * la décision, sur une seule page.
 */
export function EntretienCandidat({ candidat, contexte, onDone }: {
  candidat: { id: string; prenom: string; nom: string; disponibilite: string | null; entretien?: any }
  contexte: ContexteEntretien
  onDone: () => void
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [pending, start] = useTransition()
  const [e, setE] = useState<Entretien>(() => candidat.entretien
    ? {
      ...entretienVide(), ...candidat.entretien,
      disponibilite: candidat.entretien.disponibilite || candidat.disponibilite || '',
      observations: { ...entretienVide().observations, ...(candidat.entretien.observations || {}) },
      notes: { ...entretienVide().notes, ...(candidat.entretien.notes || {}) },
    }
    : entretienVide({ disponibilite: candidat.disponibilite || '' }))

  const maj = (patch: Partial<Entretien>) => setE((x) => ({ ...x, ...patch }))
  const repondre = (id: string, v: string) => setE((x) => ({ ...x, reponses: { ...x.reponses, [id]: v } }))
  const observer = (p: Partie, v: string) => setE((x) => ({ ...x, observations: { ...x.observations, [p]: v } }))
  const noter = (id: string, n: number) => setE((x) => ({ ...x, notes: { ...x.notes, [id]: x.notes[id] === n ? null : n } }))

  const questions = questionsEntretien(contexte, e)
  const { total, notes, max } = totalEntretien(e)
  const intitule = `${contexte.enseigne ? `${contexte.enseigne}${contexte.ville ? ` ${contexte.ville}` : ''} – ` : ''}${contexte.poste} (H/F) – ${libelleContrat(e)}`

  function enregistrer() {
    start(async () => {
      const r = await enregistrerEntretienCandidatAction(candidat.id, e)
      if (r.success) { toast('success', 'Entretien enregistré'); router.refresh(); onDone() }
      else toast('error', r.error || 'Enregistrement impossible')
    })
  }

  return (
    <div className="space-y-5">
      {/* En-tête de la fiche */}
      <div className="rounded-xl bg-surface-50 p-4">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-surface-500">
          <PhoneCall className="h-3.5 w-3.5" /> Fiche de présélection téléphonique
        </div>
        <div className="mt-1 font-heading text-sm font-bold text-surface-900">{intitule}</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-surface-600">Candidat(e)
            <input className="input-base mt-1" value={`${candidat.prenom} ${candidat.nom}`} readOnly />
          </label>
          <label className="block text-xs font-medium text-surface-600">Date
            <input type="date" className="input-base mt-1" value={e.date} onChange={(ev) => maj({ date: ev.target.value })} />
          </label>
          <label className="block text-xs font-medium text-surface-600">Recruteur
            <input className="input-base mt-1" value={e.recruteur} placeholder="Votre nom (rempli à l’enregistrement si vide)" onChange={(ev) => maj({ recruteur: ev.target.value })} />
          </label>
          <label className="block text-xs font-medium text-surface-600">Disponibilité
            <input className="input-base mt-1" value={e.disponibilite} onChange={(ev) => maj({ disponibilite: ev.target.value })} />
          </label>
          <label className="block text-xs font-medium text-surface-600 sm:col-span-2">Expérience
            <input className="input-base mt-1" value={e.experience} placeholder="En quelques mots" onChange={(ev) => maj({ experience: ev.target.value })} />
          </label>
        </div>
      </div>

      {/* Contrat proposé : plusieurs choix possibles selon l'établissement */}
      <div className="space-y-2.5">
        <div className="text-xs font-semibold text-surface-700">Contrat proposé</div>
        <div className="flex flex-wrap items-center gap-3">
          <Pastilles options={TYPES_CONTRAT} valeur={e.contrat_type} onChoix={(v) => maj({ contrat_type: v })} />
          <Pastilles options={DUREES_HEBDO} valeur={e.contrat_heures} onChoix={(v) => maj({ contrat_heures: v })} libelle={(v) => `${v} h`} />
        </div>
        <label className="block text-xs font-medium text-surface-600">Prise de poste prévue
          <input className="input-base mt-1" value={e.prise_de_poste} placeholder="ex. à l’ouverture prévue en novembre 2026" onChange={(ev) => maj({ prise_de_poste: ev.target.value })} />
        </label>
      </div>

      <Partie numero={1} titre="Accueil et présentation">
        <blockquote className="rounded-xl border-l-4 border-brand-300 bg-brand-50/50 px-4 py-3 text-sm italic text-surface-700">« {phraseAccueil(contexte)} »</blockquote>
      </Partie>

      {PARTIES.map((p, i) => (
        <Partie key={p.id} numero={i + 2} titre={p.titre}>
          {p.id === 'formation' && (
            <div className="space-y-2">
              <p className="text-sm text-surface-600">À présenter : {PRESENTATION_FORMATION}</p>
              <label className="inline-flex items-center gap-2 text-xs text-surface-600">
                <input type="checkbox" checked={e.formation_sans_objet} onChange={(ev) => maj({ formation_sans_objet: ev.target.checked })} className="rounded border-surface-300" />
                Sans objet pour ce candidat
              </label>
            </div>
          )}
          {!(p.id === 'formation' && e.formation_sans_objet) && (
            <>
              <ul className="space-y-2.5">
                {questions[p.id].map((q) => (
                  <li key={q.id} className="space-y-1.5">
                    <div className="text-sm text-surface-800">{q.texte}</div>
                    {q.forme === 'fermee' && (
                      <Pastilles options={REPONSES_FERMEES.map((r) => r.value)} valeur={e.reponses[q.id] as any}
                        onChoix={(v) => repondre(q.id, e.reponses[q.id] === v ? '' : v)}
                        libelle={(v) => REPONSES_FERMEES.find((r) => r.value === v)?.label || v} />
                    )}
                    {q.forme === 'courte' && (
                      <input className="input-base" value={e.reponses[q.id] || ''} placeholder="Réponse" onChange={(ev) => repondre(q.id, ev.target.value)} />
                    )}
                  </li>
                ))}
              </ul>
              <label className="block text-xs font-medium text-surface-600">Observations
                <textarea className="input-base mt-1 min-h-[72px]" value={e.observations[p.id]} onChange={(ev) => observer(p.id, ev.target.value)} />
              </label>
            </>
          )}
        </Partie>
      ))}

      <Partie numero={6} titre="Évaluation du candidat">
        <p className="text-xs text-surface-500">Chaque critère de 1 à {NOTE_MAX} : 1 = insuffisant, {NOTE_MAX} = très satisfaisant.</p>
        <div className="divide-y divide-surface-100 rounded-xl border border-surface-200">
          {CRITERES.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
              <span className="text-sm text-surface-800">{c.label}</span>
              <Pastilles options={[1, 2, 3, 4] as const} valeur={e.notes[c.id] as any} onChoix={(n) => noter(c.id, n)} />
            </div>
          ))}
          <div className="flex items-center justify-between px-3 py-2.5 bg-surface-50">
            <span className="text-sm font-bold text-surface-900">Total</span>
            <span className="text-sm font-bold tabular-nums text-surface-900">{total} / {max}{notes < CRITERES.length && <span className="ml-1.5 text-xs font-normal text-surface-400">({notes} sur {CRITERES.length} notés)</span>}</span>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-surface-600">Points forts
            <textarea className="input-base mt-1 min-h-[64px]" value={e.points_forts} onChange={(ev) => maj({ points_forts: ev.target.value })} />
          </label>
          <label className="block text-xs font-medium text-surface-600">Points à approfondir
            <textarea className="input-base mt-1 min-h-[64px]" value={e.points_a_approfondir} onChange={(ev) => maj({ points_a_approfondir: ev.target.value })} />
          </label>
        </div>
      </Partie>

      <Partie numero={7} titre="Décision après l’appel">
        <div className="grid gap-2 sm:grid-cols-3">
          {DECISIONS.map((d) => (
            <button key={d.value} type="button" onClick={() => maj({ decision: e.decision === d.value ? null : d.value })}
              className={`rounded-xl border p-3 text-left transition-colors ${e.decision === d.value
                ? d.value === 'retenir' ? 'border-emerald-500 bg-emerald-50' : d.value === 'approfondir' ? 'border-amber-500 bg-amber-50' : 'border-danger-500 bg-danger-50'
                : 'border-surface-200 bg-white hover:border-surface-300'}`}>
              <div className="text-sm font-semibold text-surface-900">{d.label}</div>
              <div className="mt-0.5 text-xs text-surface-500">{d.detail}</div>
            </button>
          ))}
        </div>
        <div className="rounded-xl bg-surface-50 px-4 py-3 text-sm text-surface-700">
          <span className="font-semibold">Conclusion à communiquer : </span><span className="italic">« {CONCLUSION} »</span>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs leading-relaxed text-amber-900">
          <span className="font-semibold">Rappel recruteur : </span>{RAPPEL_RECRUTEUR}
        </div>
      </Partie>

      <div className="sticky bottom-0 -mx-1 flex justify-end gap-2 border-t border-surface-100 bg-white/95 px-1 pt-3 pb-1 backdrop-blur">
        <button type="button" onClick={onDone} className="min-h-[40px] rounded-lg border border-surface-200 px-4 text-sm font-medium text-surface-600 hover:bg-surface-50">Fermer</button>
        <button type="button" onClick={enregistrer} disabled={pending} className="btn-primary inline-flex min-h-[40px] items-center gap-1.5 px-4 text-sm disabled:opacity-60">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer l’entretien
        </button>
      </div>
    </div>
  )
}
