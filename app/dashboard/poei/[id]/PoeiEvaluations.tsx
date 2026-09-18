'use client'

import { useState, useMemo } from 'react'
import { ClipboardCheck, CheckCircle2, Clock, Download, Minus, Plus, PenLine, Send, Loader2, Building2, Eye } from '@/components/ui/icons'
import { Badge, Button, Modal, useToast } from '@/components/ui'
import { sendSignatureEmployeurAction } from '../certificat-signature-actions'
import { GrilleEvaluation } from '@/components/poei/GrilleEvaluation'
import { grilleProgress } from '@/lib/poei-grille'
import { formatDate } from '@/lib/utils'
import { PoeiSection, PoeiVide, PoeiDefilable } from './PoeiSection'

interface Cand { id: string; apprenant_id: string | null; nom: string }
interface Grille { id: string; apprenant_id: string; semaine: number | null; statut: string; date_evaluation: string; items: any; [k: string]: any }

export function PoeiEvaluations({ poeiId, candidats, grilles, signatureEmployeur = null }: {
  poeiId: string
  candidats: Cand[]
  grilles: Grille[]
  /** Signature de l'employeur sur l'attestation : envoyée, signée, ou à demander. */
  signatureEmployeur?: { sent_at?: string | null; signed_at?: string | null; signataire_nom?: string | null } | null
}) {
  const [open, setOpen] = useState<{ apprenantId: string; nom: string; semaine: number | null } | null>(null)
  const { toast } = useToast()
  const [envoiSig, setEnvoiSig] = useState(false)
  const [apercuSig, setApercuSig] = useState<{ html: string; subject?: string; to?: string } | null>(null)
  const [signatureEnvoyee, setSignatureEnvoyee] = useState(false)

  // On montre le mail avant qu'il parte : destinataire, objet, rendu complet.
  async function ouvrirApercuEmployeur() {
    setEnvoiSig(true)
    const r = await sendSignatureEmployeurAction(poeiId, { preview: true })
    setEnvoiSig(false)
    if (r.success && (r as any).data?.html) {
      setApercuSig({ html: (r as any).data.html, subject: (r as any).data.subject, to: (r as any).data.email })
    } else {
      toast('error', r.error || "Impossible de générer l'aperçu")
    }
  }

  async function confirmerEnvoiEmployeur() {
    setEnvoiSig(true)
    const r = await sendSignatureEmployeurAction(poeiId)
    setEnvoiSig(false)
    if (r.success) {
      toast('success', `Lien de signature envoyé à ${(r as any).data?.email}`)
      setApercuSig(null)
      setSignatureEnvoyee(true)
    } else toast('error', r.error || 'Erreur')
  }

  // semaines déjà utilisées + prochaine
  const semaines = useMemo(() => {
    const s = new Set<number>()
    for (const g of grilles) if (g.semaine != null) s.add(g.semaine)
    return [...s].sort((a, b) => a - b)
  }, [grilles])
  // La première grille doit pouvoir naître d'ici : sans ce point d'entrée, le
  // formateur lisait « En attente du formateur » sur son propre espace, sans
  // aucun moyen d'agir.
  const prochaineSemaine = (semaines[semaines.length - 1] ?? 0) + 1
  const gridOf = (aid: string, sem: number | null) => grilles.find((g) => g.apprenant_id === aid && g.semaine === sem)

  if (candidats.length === 0) {
    return <PoeiVide icone={ClipboardCheck} texte="Ajoutez des candidats au dossier pour suivre leurs évaluations." />
  }

  return (
    <PoeiSection
      icone={ClipboardCheck}
      titre="Évaluations des candidats"
      sous="Remplies par le formateur depuis son espace, semaine après semaine puis en bilan final."
      actions={(
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:flex-wrap [&>a]:w-full sm:[&>a]:w-auto [&>button]:w-full sm:[&>button]:w-auto">
          {/*
            La signature de l'employeur couvre l'attestation de chaque candidat :
            un seul lien, une seule signature, reportée sur tous les documents.
          */}
          {signatureEmployeur?.signed_at ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg px-2.5 py-1.5">
              <Building2 className="h-3.5 w-3.5" />
              Employeur : signé{signatureEmployeur.signataire_nom ? ` par ${signatureEmployeur.signataire_nom}` : ''}
            </span>
          ) : (
            <button onClick={ouvrirApercuEmployeur} disabled={envoiSig}
              className="btn-secondary inline-flex items-center gap-1.5 !py-1.5 !px-3 text-sm disabled:opacity-60">
              {envoiSig && !apercuSig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              {signatureEmployeur?.sent_at || signatureEnvoyee ? 'Relancer la signature employeur' : 'Faire signer l\u2019employeur'}
            </button>
          )}
          {grilles.length > 0 && (
            <a href={`/api/pdf/poei-grilles/${poeiId}`} target="_blank" rel="noreferrer"
              className="btn-secondary inline-flex items-center gap-1.5 !py-1.5 !px-3 text-sm">
              <Download className="h-4 w-4" /> Télécharger tout (PDF)
            </a>
          )}
        </div>
      )}
    >

      <div className="card overflow-hidden">
        <PoeiDefilable>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50/60 text-left">
                <th className="px-4 py-2.5 text-[11px] font-semibold text-surface-500 uppercase tracking-wider">Candidat</th>
                {semaines.map((s) => <th key={s} className="px-3 py-2.5 text-[11px] font-semibold text-surface-500 uppercase tracking-wider text-center whitespace-nowrap">S{s}</th>)}
                <th className="px-3 py-2.5 text-[11px] font-semibold text-surface-500 uppercase tracking-wider text-center whitespace-nowrap">S{prochaineSemaine}</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold text-surface-500 uppercase tracking-wider text-center">Évaluation finale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {candidats.map((c) => {
                if (!c.apprenant_id) return (
                  <tr key={c.id}>
                    <td className="px-4 py-3 text-surface-800">{c.nom}</td>
                    <td colSpan={semaines.length + 2} className="px-4 py-3 text-xs text-surface-400">Candidat non rattaché à une fiche apprenant</td>
                  </tr>
                )
                const aid = c.apprenant_id
                const fin = gridOf(aid, null)
                return (
                  <tr key={c.id} className="hover:bg-surface-50/60 transition-colors">
                    <td className="px-4 py-2 font-medium text-surface-800 whitespace-nowrap">{c.nom}</td>
                    {semaines.map((s) => {
                      const g = gridOf(aid, s)
                      const p = g ? grilleProgress(g.items) : null
                      return (
                        <td key={s} className="px-3 py-2 text-center">
                          {g ? (
                            <button onClick={() => setOpen({ apprenantId: aid, nom: c.nom, semaine: s })}
                              className={`inline-flex flex-col items-center justify-center gap-0.5 px-2 py-1 min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 rounded-lg text-[11px] transition-colors ${g.statut === 'validee' ? 'bg-success-50 text-success-700 hover:bg-emerald-100' : 'bg-warning-50 text-warning-700 hover:bg-amber-100'}`}>
                              {g.statut === 'validee' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                              {p && <span className="tabular-nums">{p.pctAcquis}%</span>}
                            </button>
                          ) : (
                            <Minus className="h-3.5 w-3.5 text-surface-200 mx-auto" />
                          )}
                        </td>
                      )
                    })}
                    {/* Ouvrir la semaine suivante pour ce candidat */}
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => setOpen({ apprenantId: aid, nom: c.nom, semaine: prochaineSemaine })}
                        title={`Évaluer la semaine ${prochaineSemaine}`}
                        className="h-10 w-10 sm:h-auto sm:w-auto sm:p-1.5 inline-flex items-center justify-center rounded-lg text-surface-300 hover:text-brand-600 hover:bg-brand-50 transition-colors">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-2">
                        {fin?.avis_final && (
                          <span className={`hidden sm:inline text-[11px] font-medium ${fin.avis_final.includes('DÉFAVORABLE') ? 'text-danger-600' : fin.avis_final.includes('RÉSERVES') ? 'text-warning-600' : 'text-success-700'}`}>
                            {fin.avis_final.replace('AVIS ', '')}
                          </span>
                        )}
                        {fin ? (
                          <button onClick={() => setOpen({ apprenantId: aid, nom: c.nom, semaine: null })}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[40px] sm:min-h-0 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${fin.statut === 'validee' ? 'bg-success-50 text-success-700 hover:bg-emerald-100' : 'bg-warning-50 text-warning-700 hover:bg-amber-100'}`}>
                            {fin.statut === 'validee' ? <><CheckCircle2 className="h-3.5 w-3.5" /> Validée</> : <><Clock className="h-3.5 w-3.5" /> Brouillon</>}
                          </button>
                        ) : (
                          <button onClick={() => setOpen({ apprenantId: aid, nom: c.nom, semaine: null })}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[40px] sm:min-h-0 rounded-lg text-xs font-medium whitespace-nowrap bg-surface-100 text-surface-600 hover:bg-surface-200 transition-colors">
                            <PenLine className="h-3.5 w-3.5" /> Remplir
                          </button>
                        )}
                        {fin && (
                          <a href={`/api/pdf/poei-grilles/${poeiId}?apprenant=${aid}&semaine=`} target="_blank" rel="noreferrer"
                            title="Télécharger la grille en PDF"
                            className="h-10 w-10 sm:h-8 sm:w-8 inline-flex items-center justify-center rounded-lg text-surface-400 hover:text-brand-600 hover:bg-brand-50 transition-colors">
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </PoeiDefilable>
      </div>

      <Modal isOpen={!!apercuSig} onClose={() => setApercuSig(null)} title="Aperçu de l'email" size="lg">
        {apercuSig && (
          <div className="space-y-3">
            <div className="text-xs text-surface-500">
              <div><span className="font-semibold text-surface-700">À :</span> {apercuSig.to}</div>
              <div><span className="font-semibold text-surface-700">Objet :</span> {apercuSig.subject}</div>
            </div>
            <div className="rounded-xl border border-surface-200 overflow-hidden bg-white">
              <iframe title="Aperçu email" srcDoc={apercuSig.html} className="w-full h-[60vh] sm:h-[460px]" style={{ border: 0 }} />
            </div>
            <div className="flex flex-wrap justify-end gap-3 pt-1">
              <Button variant="secondary" onClick={() => setApercuSig(null)}>Annuler</Button>
              <Button onClick={confirmerEnvoiEmployeur} isLoading={envoiSig} icon={<Send className="h-4 w-4" />}>
                Confirmer l'envoi
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!open} onClose={() => setOpen(null)} size="lg"
        title={open ? `${open.nom}, ${open.semaine === null ? 'Évaluation finale' : `Semaine ${open.semaine}`}` : ''}>
        {open && (
          <div className="max-h-[75vh] overflow-y-auto pr-1">
            <GrilleEvaluation poeiId={poeiId} apprenantId={open.apprenantId} apprenantNom={open.nom}
              semaine={open.semaine} initial={gridOf(open.apprenantId, open.semaine)} onSaved={() => setOpen(null)} />
          </div>
        )}
      </Modal>
    </PoeiSection>
  )
}
