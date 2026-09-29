'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, Save, Send, Plus, X } from '@/components/ui/icons'
import { useToast } from '@/components/ui'
import { cn } from '@/lib/utils'
import {
  METHODES, MODALITES_EVALUATION, NIVEAUX_GROUPE, PARTICIPATIONS, SALLES,
  LIBELLES_ACQUIS, LIBELLES_OBJECTIF, LIBELLES_STATUT_DEMI_JOURNEE, libelleDemiJournee, manquesCompteRendu,
  type CompteRendu, type Acquis, type NiveauObjectif,
} from '@/lib/compte-rendu'
import { enregistrerCompteRenduAction } from '../actions'

/**
 * Compte rendu de formation : ce qui a été fait demi-journée par demi-journée,
 * l'atteinte des objectifs, le groupe, les acquis de chaque stagiaire, les
 * conditions de réalisation et les suites. Enregistré en brouillon au fil de
 * la saisie, puis transmis au gestionnaire.
 */
export function RapportForm({ sessionId, initial, transmis }: {
  sessionId: string
  initial: CompteRendu
  transmis: boolean
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [cr, setCr] = useState<CompteRendu>(initial)
  const [enCours, setEnCours] = useState<'brouillon' | 'transmettre' | null>(null)
  const [fait, setFait] = useState(transmis)
  const [manques, setManques] = useState<string[]>([])
  const [nouvelObjectif, setNouvelObjectif] = useState('')
  const [modifie, setModifie] = useState(false)
  const [sauveA, setSauveA] = useState<Date | null>(null)
  const enVol = useRef(false)
  // Numéro de la dernière modification : un enregistrement ne vaut « à jour »
  // que si rien n'a été tapé pendant qu'il partait
  const version = useRef(0)
  const dernier = useRef<CompteRendu>(initial)

  const maj = (f: (c: CompteRendu) => CompteRendu) => {
    version.current++
    setCr((c) => { const n = f(structuredClone(c)); dernier.current = n; return n })
    setModifie(true)
  }

  async function sauverBrouillon() {
    if (enVol.current || fait) return
    enVol.current = true
    const v = version.current
    const r = await enregistrerCompteRenduAction(sessionId, dernier.current, false).catch(() => null)
    enVol.current = false
    if (r?.success && version.current === v) { setModifie(false); setSauveA(new Date()) }
  }

  // Brouillon enregistré tout seul, 10 s après la dernière frappe, et quand la
  // page passe en arrière-plan (changement d'onglet, téléphone verrouillé)
  useEffect(() => {
    if (!modifie || fait) return
    const t = setTimeout(sauverBrouillon, 10_000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cr, modifie, fait])
  useEffect(() => {
    const cache = () => { if (document.visibilityState === 'hidden' && modifie) void sauverBrouillon() }
    const quitter = (e: BeforeUnloadEvent) => { if (modifie && !fait) { void sauverBrouillon(); e.preventDefault(); e.returnValue = '' } }
    document.addEventListener('visibilitychange', cache)
    window.addEventListener('beforeunload', quitter)
    return () => { document.removeEventListener('visibilitychange', cache); window.removeEventListener('beforeunload', quitter) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modifie, fait])

  async function envoyer(transmettre: boolean) {
    if (transmettre) {
      const m = manquesCompteRendu(cr)
      setManques(m)
      if (m.length) { toast('error', 'Il manque des éléments avant de transmettre'); return }
    }
    setEnCours(transmettre ? 'transmettre' : 'brouillon')
    const v = version.current
    try {
      const r = await enregistrerCompteRenduAction(sessionId, cr, transmettre)
      if (r.success) {
        if (version.current === v) { setModifie(false); setSauveA(new Date()) }
        if (transmettre) { setFait(true); toast('success', 'Compte rendu transmis au gestionnaire') }
        else toast('success', 'Brouillon enregistré')
        router.refresh()
      } else {
        // Refus du serveur : la saisie est gardée en brouillon, il dit ce qui manque
        const m = (r.data as any)?.manques
        if (Array.isArray(m)) { setManques(m); if (version.current === v) { setModifie(false); setSauveA(new Date()) } }
        toast('error', r.error || 'Erreur')
      }
    } catch {
      toast('error', 'La connexion a été interrompue : réessayez.')
    } finally {
      setEnCours(null)
    }
  }

  if (fait) {
    return (
      <div className="card p-8 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
        <div className="font-heading text-lg font-bold text-surface-900">Compte rendu transmis</div>
        <p className="text-sm text-surface-500 mt-1.5">
          Merci, votre compte rendu est arrivé chez le gestionnaire et rejoint le dossier de la session.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Section titre="Déroulé de la formation" aide="Pour chaque demi-journée : ce que vous avez fait avec le groupe, et comment.">
        {cr.deroule.length === 0 && <p className="text-sm text-surface-500">Aucune demi-journée n’est planifiée pour cette session.</p>}
        <div className="space-y-4">
          {cr.deroule.map((d, i) => (
            <div key={`${d.date}-${d.creneau}`} className="rounded-xl border border-surface-200 p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-surface-900 first-letter:uppercase">{libelleDemiJournee(d)}</div>
                <Choix
                  compact
                  label={`Qui a animé : ${libelleDemiJournee(d)}`}
                  options={[{ v: '', l: 'Animée par moi' }, { v: 'autre_formateur', l: 'Autre formateur' }, { v: 'non_realisee', l: 'Pas de formation' }]}
                  valeur={d.statut || ''}
                  onChange={(v) => maj((c) => { c.deroule[i].statut = (v || undefined) as any; return c })}
                  toujours
                />
              </div>
              {d.statut ? (
                <p className="text-xs text-surface-500 mt-2">{LIBELLES_STATUT_DEMI_JOURNEE[d.statut]} : rien à décrire.</p>
              ) : (
                <>
                  <textarea
                    rows={3}
                    value={d.contenu}
                    onChange={(e) => maj((c) => { c.deroule[i].contenu = e.target.value; return c })}
                    placeholder="Notions abordées, exercices, démonstrations, mises en pratique réalisées…"
                    aria-label={`Contenu, ${libelleDemiJournee(d)}`}
                    className="input-base mt-2 font-normal"
                  />
                  <Puces
                    label="Méthodes utilisées"
                    options={METHODES}
                    valeurs={d.methodes}
                    onChange={(v) => maj((c) => { c.deroule[i].methodes = v; return c })}
                  />
                </>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section titre="Objectifs de la formation" aide="Pour chaque objectif du programme, dites s’il a été atteint par le groupe.">
        {cr.objectifs.length === 0 && (
          <p className="text-sm text-surface-500">La fiche formation ne liste pas d’objectifs : ajoutez ceux que vous avez travaillés.</p>
        )}
        <div className="space-y-3">
          {cr.objectifs.map((o, i) => (
            <div key={i} className="rounded-xl border border-surface-200 p-3">
              <div className="flex items-start gap-2">
                <div className="text-sm text-surface-800 flex-1">{o.objectif}</div>
                {o.perso && (
                  <button type="button" aria-label={`Retirer l’objectif « ${o.objectif} »`}
                    onClick={() => maj((c) => { c.objectifs.splice(i, 1); return c })}
                    className="shrink-0 rounded-md p-1 text-surface-400 hover:bg-surface-100 hover:text-surface-700">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Choix
                options={Object.entries(LIBELLES_OBJECTIF).map(([v, l]) => ({ v, l }))}
                valeur={o.niveau}
                onChange={(v) => maj((c) => { c.objectifs[i].niveau = v as NiveauObjectif; return c })}
                label={`Atteinte : ${o.objectif}`}
              />
              {(o.niveau === 'partiel' || o.niveau === 'non_atteint') && (
                <input
                  value={o.commentaire}
                  onChange={(e) => maj((c) => { c.objectifs[i].commentaire = e.target.value; return c })}
                  placeholder="Pourquoi ? Temps, niveau du groupe, matériel…"
                  className="input-base mt-2 font-normal"
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <input value={nouvelObjectif} onChange={(e) => setNouvelObjectif(e.target.value)}
            placeholder="Ajouter un objectif travaillé" className="input-base font-normal flex-1" />
          <button type="button" disabled={nouvelObjectif.trim().length < 3}
            onClick={() => { const o = nouvelObjectif.trim(); maj((c) => { c.objectifs.push({ objectif: o, niveau: '', commentaire: '', perso: true }); return c }); setNouvelObjectif('') }}
            className="btn-secondary inline-flex items-center gap-1.5 !px-3 text-sm disabled:opacity-50">
            <Plus className="h-4 w-4" /> Ajouter
          </button>
        </div>
      </Section>

      <Section titre="Le groupe">
        <Champ label="Niveau du groupe à l’entrée">
          <Choix options={NIVEAUX_GROUPE.map((v) => ({ v, l: v }))} valeur={cr.groupe.niveau}
            onChange={(v) => maj((c) => { c.groupe.niveau = v; return c })} label="Niveau du groupe" />
        </Champ>
        <Champ label="Participation">
          <Choix options={PARTICIPATIONS.map((v) => ({ v, l: v }))} valeur={cr.groupe.participation}
            onChange={(v) => maj((c) => { c.groupe.participation = v; return c })} label="Participation" />
        </Champ>
        <Texte label="Dynamique et ambiance" rows={2} valeur={cr.groupe.dynamique}
          placeholder="Motivation, entraide, questions posées, stagiaires en difficulté…"
          onChange={(v) => maj((c) => { c.groupe.dynamique = v; return c })} />
        <Texte label="Assiduité" rows={2} valeur={cr.groupe.assiduite}
          placeholder="Retards, absences, départs anticipés (le détail est sur la feuille d’émargement)"
          onChange={(v) => maj((c) => { c.groupe.assiduite = v; return c })} />
      </Section>

      <Section titre="Évaluation des acquis">
        <Puces label="Modalités d’évaluation" options={MODALITES_EVALUATION} valeurs={cr.evaluation.modalites}
          onChange={(v) => maj((c) => { c.evaluation.modalites = v; return c })} />
        <Texte label="Résultats d’ensemble" rows={2} valeur={cr.evaluation.synthese}
          placeholder="Ce que le groupe maîtrise, ce qui reste fragile"
          onChange={(v) => maj((c) => { c.evaluation.synthese = v; return c })} />
        <div>
          <div className="text-sm font-medium text-surface-800 mb-2">Acquis de chaque stagiaire</div>
          {cr.stagiaires.length === 0 && <p className="text-sm text-surface-500">Aucun stagiaire inscrit à cette session.</p>}
          <div className="divide-y divide-surface-100 rounded-xl border border-surface-200">
            {cr.stagiaires.map((s, i) => (
              <div key={s.apprenant_id} className="p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-surface-900">
                    {s.nom}
                    {s.retire && <span className="block text-2xs font-normal text-surface-400">Inscription annulée après émargement, évaluation facultative</span>}
                  </span>
                  <Choix options={Object.entries(LIBELLES_ACQUIS).map(([v, l]) => ({ v, l }))} valeur={s.acquis}
                    onChange={(v) => maj((c) => { c.stagiaires[i].acquis = v as Acquis; return c })} label={`Acquis de ${s.nom}`} compact />
                </div>
                <input value={s.commentaire}
                  onChange={(e) => maj((c) => { c.stagiaires[i].commentaire = e.target.value; return c })}
                  placeholder="Commentaire (facultatif)" className="input-base font-normal !py-2 text-sm" />
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section titre="Conditions de réalisation">
        <Champ label="Salle et équipements">
          <Choix options={SALLES.map((v) => ({ v, l: v }))} valeur={cr.conditions.salle}
            onChange={(v) => maj((c) => { c.conditions.salle = v; return c })} label="Salle et équipements" />
        </Champ>
        <Texte label="Précisions sur les locaux et le matériel" rows={2} valeur={cr.conditions.commentaire}
          placeholder="Cuisine ou labo disponible, matériel fourni par l’établissement, supports utilisés…"
          onChange={(v) => maj((c) => { c.conditions.commentaire = v; return c })} />
        <Texte label="Difficultés ou incidents" rows={2} valeur={cr.conditions.difficultes}
          placeholder="Imprévus, interruptions du service, problème technique…"
          onChange={(v) => maj((c) => { c.conditions.difficultes = v; return c })} />
      </Section>

      <Section titre="Bilan et suites">
        <Texte label="Points positifs" rows={2} valeur={cr.bilan.points_positifs}
          onChange={(v) => maj((c) => { c.bilan.points_positifs = v; return c })} />
        <Texte label="Retours des stagiaires" rows={2} valeur={cr.bilan.retours_stagiaires}
          placeholder="Ce que les stagiaires ont dit de la formation, à chaud"
          onChange={(v) => maj((c) => { c.bilan.retours_stagiaires = v; return c })} />
        <Texte label="Besoins détectés" rows={2} valeur={cr.bilan.besoins_detectes}
          placeholder="Autres salariés à former, formation complémentaire utile, besoin de l’établissement (hygiène, DUERP…)"
          onChange={(v) => maj((c) => { c.bilan.besoins_detectes = v; return c })} />
        <Texte label="Recommandations" rows={2} valeur={cr.bilan.recommandations}
          placeholder="Adaptation du programme, suivi à prévoir…"
          onChange={(v) => maj((c) => { c.bilan.recommandations = v; return c })} />
        <Texte label="Commentaires" rows={2} valeur={cr.bilan.commentaires}
          onChange={(v) => maj((c) => { c.bilan.commentaires = v; return c })} />
      </Section>

      {manques.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          Avant de transmettre, complétez : {manques.join(', ')}.
        </div>
      )}

      {/* Actions en fin de formulaire : le brouillon s'enregistre de lui-même en cours de route */}
      <div className="card px-4 py-3">
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <span className="text-2xs text-surface-400 mr-auto">
            {modifie ? 'Modifications non enregistrées' : sauveA ? `Brouillon enregistré à ${sauveA.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'Brouillon enregistré automatiquement'}
          </span>
          <button type="button" disabled={!!enCours} onClick={() => envoyer(false)}
            className="btn-secondary inline-flex items-center gap-1.5 !py-2 !px-4 text-sm disabled:opacity-60">
            {enCours === 'brouillon' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
          <button type="button" disabled={!!enCours} onClick={() => envoyer(true)}
            className="btn-primary inline-flex items-center gap-1.5 !py-2 !px-4 text-sm disabled:opacity-60">
            {enCours === 'transmettre' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Transmettre
          </button>
        </div>
      </div>
      <p className="text-2xs text-surface-400 text-right">Une fois transmis, le compte rendu n&apos;est plus modifiable depuis votre espace.</p>
    </div>
  )
}

function Section({ titre, aide, children }: { titre: string; aide?: string; children: React.ReactNode }) {
  return (
    <section className="card p-4 sm:p-5 space-y-4">
      <div>
        <h2 className="text-base font-heading font-bold text-surface-900">{titre}</h2>
        {aide && <p className="text-xs text-surface-500 mt-0.5">{aide}</p>}
      </div>
      {children}
    </section>
  )
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm font-medium text-surface-800 mb-1.5">{label}</div>
      {children}
    </div>
  )
}

function Texte({ label, valeur, onChange, rows = 2, placeholder }: {
  label: string; valeur: string; onChange: (v: string) => void; rows?: number; placeholder?: string
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-surface-800">{label}</span>
      <textarea rows={rows} value={valeur} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="input-base mt-1.5 font-normal" />
    </label>
  )
}

/** Choix unique en boutons : un second clic sur le choix actif le retire. */
function Choix({ options, valeur, onChange, label, compact, toujours }: {
  options: { v: string; l: string }[]; valeur: string; onChange: (v: string) => void; label: string; compact?: boolean
  /** Un choix reste toujours actif : pas de retrait au second clic */
  toujours?: boolean
}) {
  return (
    <div role="group" aria-label={label} className={cn('flex flex-wrap gap-1.5', !compact && 'mt-2')}>
      {options.map((o) => (
        <button key={o.v} type="button" aria-pressed={valeur === o.v}
          onClick={() => onChange(valeur === o.v && !toujours ? '' : o.v)}
          className={cn(
            'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors min-h-[36px]',
            valeur === o.v
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-surface-200 bg-white text-surface-700 hover:border-surface-300',
          )}>
          {o.l}
        </button>
      ))}
    </div>
  )
}

/** Choix multiple en puces. */
function Puces({ label, options, valeurs, onChange }: {
  label: string; options: string[]; valeurs: string[]; onChange: (v: string[]) => void
}) {
  return (
    <div className="mt-2.5">
      <div className="text-xs font-medium text-surface-500 mb-1.5">{label}</div>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const actif = valeurs.includes(o)
          return (
            <button key={o} type="button" aria-pressed={actif}
              onClick={() => onChange(actif ? valeurs.filter((x) => x !== o) : [...valeurs, o])}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[34px]',
                actif ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-surface-200 bg-white text-surface-600 hover:border-surface-300',
              )}>
              {o}
            </button>
          )
        })}
      </div>
    </div>
  )
}
