'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Save, CheckCircle2, ClipboardCheck, Sparkles, Loader2 } from '@/components/ui/icons'
import { Button, Badge, useToast } from '@/components/ui'
import { GRILLE_SECTIONS, NIVEAUX, APPRECIATIONS, AVIS_FINAL, grilleProgress, type NiveauAcquis } from '@/lib/poei-grille'
import { saveGrilleAction, detaillerBilanAction } from '@/app/dashboard/poei/grille-actions'
import { CHAMPS_BILAN_FT, SIGNATURE_BILAN, avisCentreParDefaut, type BilanFt } from '@/lib/poei-bilan-ft'

type Items = Record<string, { n?: NiveauAcquis; o?: string }>

export function GrilleEvaluation({ poeiId, apprenantId, apprenantNom, semaine, initial, onSaved, dureeBilan = null, bilanFt = null }: {
  poeiId: string
  apprenantId: string
  apprenantNom: string
  semaine: number | null            // null = évaluation finale
  initial?: any
  onSaved?: () => void
  /** Heures du certificat de réalisation : le bilan final porte celles-ci, pas une saisie libre */
  dureeBilan?: { heures: number; prevues: number } | null
  /** Bilan de fin de formation France Travail : ce que le CRM remplit déjà (équipe interne seulement) */
  bilanFt?: BilanFt | null
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [items, setItems] = useState<Items>(initial?.items || {})
  const [app, setApp] = useState<Record<string, string>>(initial?.appreciations || {})
  const [txt, setTxt] = useState({
    points_forts: initial?.points_forts || '', a_renforcer: initial?.a_renforcer || '',
    recommandations: initial?.recommandations || '', avis_final: initial?.avis_final || '',
    motivation_avis: initial?.motivation_avis || '', conclusion: initial?.conclusion || '',
    duree_realisee: initial?.duree_realisee || '', absences: initial?.absences || '',
  })
  const [saving, setSaving] = useState(false)
  const [detailling, setDetailling] = useState(false)
  const isFinale = semaine === null

  // Rédige les cinq rubriques en une passe, à partir des notes du formateur et
  // des constats de la grille. Le texte reste modifiable avant enregistrement.
  async function detaillerBilan() {
    setDetailling(true)
    const r = await detaillerBilanAction({
      poeiId, apprenantId, items, avisFinal: txt.avis_final || null,
      notes: {
        points_forts: txt.points_forts, a_renforcer: txt.a_renforcer,
        recommandations: txt.recommandations, motivation_avis: txt.motivation_avis,
        conclusion: txt.conclusion,
      },
    })
    if (r.success && r.data) {
      setTxt((p) => ({ ...p, ...r.data }))
      toast('success', 'Bilan rédigé — relisez et ajustez si besoin')
    } else toast('error', r.error || 'Erreur')
    setDetailling(false)
  }

  const prog = useMemo(() => grilleProgress(items), [items])

  const setN = (id: string, n: NiveauAcquis) => setItems((p) => ({ ...p, [id]: { ...p[id], n: p[id]?.n === n ? undefined : n } }))
  const setO = (id: string, o: string) => setItems((p) => ({ ...p, [id]: { ...p[id], o } }))

  // Réponses du bilan France Travail : rangées avec les appréciations (clés « ft_ »)
  const F = CHAMPS_BILAN_FT
  const setFt = (cle: string, v: string) => setApp((p) => ({ ...p, [cle]: v }))
  const OuiNonFt = ({ cle }: { cle: string }) => (
    <div className="flex gap-1.5">
      {['Oui', 'Non'].map((o) => (
        <button key={o} type="button" onClick={() => setFt(cle, app[cle] === o ? '' : o)}
          className={`px-3 py-1.5 min-h-[40px] md:min-h-0 rounded-lg text-xs font-medium transition-colors ${app[cle] === o ? 'bg-brand-500 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}>
          {o}
        </button>
      ))}
    </div>
  )

  async function save(statut: 'brouillon' | 'validee') {
    setSaving(true)
    const r = await saveGrilleAction({ poeiId, apprenantId, semaine, items, appreciations: app, statut, ...txt })
    if (r.success) { toast('success', statut === 'validee' ? 'Évaluation validée' : 'Brouillon enregistré'); router.refresh(); onSaved?.() }
    else toast('error', r.error || 'Erreur')
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      {/* En-tête + progression */}
      <div className="rounded-xl border border-surface-200 bg-surface-50/60 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-heading font-semibold text-surface-900 flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-brand-500" />
              {apprenantNom}
            </div>
            <div className="text-xs text-surface-500 mt-0.5">
              {isFinale ? 'Évaluation finale post-formation' : `Suivi hebdomadaire — semaine ${semaine}`}
              {initial?.statut === 'validee' && <Badge variant="success" className="ml-2">Validée</Badge>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-surface-800 tabular-nums">{prog.evalues}/{prog.total} évalués</div>
            <div className="text-xs text-surface-500 tabular-nums">{prog.acquis} acquis · {prog.encours} en cours</div>
          </div>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-surface-200 overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${prog.pctAcquis}%` }} />
        </div>
      </div>

      {/* Sections de compétences */}
      {GRILLE_SECTIONS.map((sec) => (
        <div key={sec.key}>
          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">{sec.titre}</div>
          <div className="card divide-y divide-surface-100">
            {sec.items.map((it, i) => {
              const cur = items[it.id]?.n
              return (
                <div key={it.id} className="px-3 py-2.5">
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 text-2xs font-mono text-surface-400 mt-1 w-6">{i + 1}</span>
                    <div className="flex-1 min-w-0 text-sm text-surface-800">{it.label}</div>
                    <div className="shrink-0 flex gap-1">
                      {NIVEAUX.map((n) => {
                        const on = cur === n.value
                        const cls = n.value === 'A' ? 'bg-emerald-500' : n.value === 'EC' ? 'bg-amber-500' : 'bg-danger-500'
                        return (
                          <button key={n.value} type="button" onClick={() => setN(it.id, n.value)} title={n.label}
                            className={`h-7 w-9 rounded-lg text-2xs font-bold transition-colors ${on ? `${cls} text-white` : 'bg-surface-100 text-surface-500 hover:bg-surface-200'}`}>
                            {n.short}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {cur && (
                    <input value={items[it.id]?.o || ''} onChange={(e) => setO(it.id, e.target.value)}
                      placeholder="Observation (facultatif)…"
                      className="mt-1.5 ml-9 w-[calc(100%-2.25rem)] text-xs px-2 py-1 rounded-lg border border-surface-200 focus:border-brand-400 focus:outline-none" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Appréciation globale + avis : uniquement sur la grille finale */}
      {isFinale && (
        <>
          <div>
            <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Appréciation globale</div>
            <div className="card p-4 space-y-3">
              {APPRECIATIONS.map((a) => (
                <div key={a.key} className="flex flex-wrap items-center gap-2">
                  <div className="text-sm text-surface-700 w-full sm:w-64">{a.label}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {a.options.map((o) => (
                      <button key={o} type="button" onClick={() => setApp((p) => ({ ...p, [a.key]: p[a.key] === o ? '' : o }))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${app[a.key] === o ? 'bg-brand-500 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}>
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap pb-2 border-b border-surface-100">
              <div className="text-xs text-surface-500">
                Rédigez librement (même quelques mots) : l'IA développe les cinq rubriques à partir de la grille.
              </div>
              <button type="button" onClick={detaillerBilan} disabled={detailling}
                className="btn-ia !px-3 !py-2 !text-xs shrink-0">
                {detailling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {detailling ? 'Rédaction…' : 'Détailler le bilan'}
              </button>
            </div>
            {([['points_forts', "Points forts de l'apprenant"], ['a_renforcer', 'Compétences ou comportements restant à renforcer'], ['recommandations', "Recommandations pour la prise de poste ou l'accompagnement"]] as const).map(([k, l]) => (
              <div key={k}>
                <label className="block text-sm font-medium text-surface-700 mb-1">{l}</label>
                <textarea rows={3} className="input-base resize-none" value={(txt as any)[k]}
                  onChange={(e) => setTxt((p) => ({ ...p, [k]: e.target.value }))} />
              </div>
            ))}
          </div>

          <div className="card p-4 space-y-3">
            <div className="text-sm font-medium text-surface-700">Avis final du formateur</div>
            <div className="flex flex-wrap gap-2">
              {AVIS_FINAL.map((a) => (
                <button key={a} type="button" onClick={() => setTxt((p) => ({ ...p, avis_final: p.avis_final === a ? '' : a }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${txt.avis_final === a ? (a.includes('DÉFAVORABLE') ? 'bg-danger-500 text-white' : a.includes('RÉSERVES') ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white') : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}>
                  {a}
                </button>
              ))}
            </div>
            <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">Motivation de l'avis <span className="text-danger-500">*</span></label>
              <textarea rows={3} className="input-base resize-none" value={txt.motivation_avis}
                onChange={(e) => setTxt((p) => ({ ...p, motivation_avis: e.target.value }))} />
            </div>
            <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">Conclusion personnalisée (reprise dans le bilan)</label>
              <textarea rows={4} className="input-base resize-none" value={txt.conclusion}
                onChange={(e) => setTxt((p) => ({ ...p, conclusion: e.target.value }))}
                placeholder="Au terme de la formation, [Prénom Nom] …" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {dureeBilan ? (
                // Une seule source pour les heures : celles du certificat de réalisation
                <div>
                  <label className="block text-xs font-medium text-surface-600 mb-1">Durée portée sur le bilan</label>
                  <div className="input-base bg-surface-50 text-surface-700">
                    {`${dureeBilan.heures.toLocaleString('fr-FR')} h${dureeBilan.heures < dureeBilan.prevues ? ` sur ${dureeBilan.prevues.toLocaleString('fr-FR')} h prévues` : ''}`}
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-surface-500">Celle du certificat de réalisation, à modifier dans l’onglet Documents (bloc Certificats).</p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-surface-600 mb-1">Durée réalisée</label>
                  <input className="input-base" value={txt.duree_realisee} onChange={(e) => setTxt((p) => ({ ...p, duree_realisee: e.target.value }))} placeholder="Ex : 400 h" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-surface-600 mb-1">Absences / retards</label>
                <input className="input-base" value={txt.absences} onChange={(e) => setTxt((p) => ({ ...p, absences: e.target.value }))} placeholder="Ex : aucune" />
              </div>
            </div>
          </div>

          {bilanFt && (
            <div className="card p-4 space-y-4">
              <div>
                <div className="text-sm font-medium text-surface-700">Bilan de fin de formation France Travail</div>
                <p className="mt-0.5 text-xs text-surface-500">
                  Page ajoutée au bilan final, à joindre à la facture sur Chorus Pro. Une case laissée vide reste à compléter à la main sur le document.
                  Le stagiaire relit ce bilan et le signe par lien : bouton « Faire signer » de sa ligne, une fois le bilan enregistré.
                </p>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 rounded-xl bg-surface-50 p-3 text-xs">
                {([
                  ['Organisme', bilanFt.organisme],
                  ['Intitulé de la formation', bilanFt.intitule],
                  ['Demandeur d’emploi', `${bilanFt.prenom} ${bilanFt.nom}`.trim()],
                  ['N° identifiant', bilanFt.identifiant],
                  ['Début (prévu / réel)', [bilanFt.debutPrevue, bilanFt.debutReelle].filter(Boolean).join(' / ')],
                  ['Fin (prévue / réelle)', [bilanFt.finPrevue, bilanFt.finReelle].filter(Boolean).join(' / ')],
                  ['Heures (prévues / réelles)', [bilanFt.heuresPrevues, bilanFt.heuresReelles].filter(Boolean).join(' / ')],
                  ['Métier visé', bilanFt.metier],
                  ['Formation certifiante', bilanFt.certifiante],
                  ['A achevé la formation', bilanFt.acheve],
                  ['Dernier jour de formation', bilanFt.dernierJour],
                  ...(bilanFt.motifSortie ? [['Motif de sortie anticipée', bilanFt.motifSortie]] : []),
                ] as [string, string][]).map(([l, v]) => (
                  <div key={l} className="flex gap-2 min-w-0">
                    <dt className="shrink-0 text-surface-500">{l} :</dt>
                    <dd className={`min-w-0 break-words ${v ? 'text-surface-800' : 'text-amber-600'}`}>{v || 'non renseigné dans le CRM'}</dd>
                  </div>
                ))}
              </dl>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-surface-600 mb-1">Référent de l’organisme de formation</label>
                  <input className="input-base" value={app[F.referent] || ''} onChange={(e) => setFt(F.referent, e.target.value)} placeholder={bilanFt.referent || 'Prénom Nom'} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-600 mb-1">Niveau de qualification atteint en fin de formation</label>
                  <input className="input-base" value={app[F.niveau] || ''} onChange={(e) => setFt(F.niveau, e.target.value)} placeholder="Ex : sans niveau spécifique" />
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Suivi du stagiaire après la formation</div>
                {([
                  ['Reprise d’emploi en cours de formation', F.repriseCours, F.repriseCoursDurable, F.repriseCoursDate],
                  ['Reprise d’emploi dès la fin de formation', F.repriseFin, F.repriseFinDurable, F.repriseFinDate],
                ] as const).map(([titre, reprise, durable, date]) => (
                  <div key={reprise} className="rounded-xl border border-surface-200 p-3 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm text-surface-700">{titre}</div>
                      <OuiNonFt cle={reprise} />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-surface-600">Sur contrat durable (CDD de plus de 6 mois ou CDI)</div>
                      <OuiNonFt cle={durable} />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs text-surface-600">Date de la reprise d’activité</label>
                      <input type="date" className="input-base !w-auto" value={app[date] || ''} onChange={(e) => setFt(date, e.target.value)} />
                    </div>
                  </div>
                ))}
                {!app[F.repriseFin] && bilanFt.repriseFin && (
                  <p className="text-[11px] leading-snug text-surface-500">
                    Sans saisie, le bilan reprend l’état du candidat : reprise dès la fin de formation {bilanFt.repriseFin.toLowerCase()}
                    {bilanFt.repriseFinDurable ? `, contrat durable ${bilanFt.repriseFinDurable.toLowerCase()}` : ''}
                    {bilanFt.repriseFinDate ? `, le ${bilanFt.repriseFinDate}` : ''}.
                  </p>
                )}
                <div className="rounded-xl border border-surface-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-sm text-surface-700">Reprise d’emploi à une date prévisionnelle</label>
                    <input type="date" className="input-base !w-auto" value={app[F.reprisePrevue] || ''} onChange={(e) => setFt(F.reprisePrevue, e.target.value)} />
                  </div>
                  {!app[F.reprisePrevue] && bilanFt.reprisePrevue && (
                    <p className="mt-1.5 text-[11px] leading-snug text-surface-500">Sans saisie, le bilan reprend la date d’embauche prévue de la fiche candidat : {bilanFt.reprisePrevue}.</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-600 mb-1">Avis du stagiaire sur la formation</label>
                <textarea rows={2} className="input-base resize-none disabled:bg-surface-50 disabled:text-surface-600" value={app[F.avisStagiaire] || ''} onChange={(e) => setFt(F.avisStagiaire, e.target.value)}
                  disabled={!!app[SIGNATURE_BILAN.signeLe]}
                  placeholder="Le stagiaire l’écrit lui-même en signant son bilan. Vous pouvez aussi reporter ici ce qu’il a exprimé." />
                {app[SIGNATURE_BILAN.signeLe] && (
                  <p className="mt-1 text-[11px] leading-snug text-surface-500">Bilan signé par le stagiaire le {new Date(app[SIGNATURE_BILAN.signeLe]).toLocaleDateString('fr-FR')} : son avis ne se modifie plus.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-600 mb-1">Avis du centre de formation</label>
                <textarea rows={3} className="input-base resize-none" value={app[F.avisCentre] || ''} onChange={(e) => setFt(F.avisCentre, e.target.value)}
                  placeholder={avisCentreParDefaut(txt.avis_final, txt.motivation_avis) || 'Sans saisie : l’avis final du formateur et sa motivation.'} />
                {!app[F.avisCentre] && (
                  <p className="mt-1 text-[11px] leading-snug text-surface-500">Sans saisie, le bilan reprend l’avis final du formateur et sa motivation.</p>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex justify-end gap-3 pt-1 border-t border-surface-100">
        <Button variant="secondary" onClick={() => save('brouillon')} isLoading={saving} icon={<Save className="h-4 w-4" />}>Enregistrer</Button>
        <Button onClick={() => save('validee')} isLoading={saving} icon={<CheckCircle2 className="h-4 w-4" />}>Valider l'évaluation</Button>
      </div>
    </div>
  )
}
