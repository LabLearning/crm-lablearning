'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import {
  Download, Eye, Send, Loader2, FileText, ClipboardCheck, Award, BookOpen, ShieldCheck, Printer,
} from '@/components/ui/icons'
import { envoyerPackHygieneFormateurAction } from './pack-hygiene-actions'

type PieceId = 'pms' | 'affichages' | 'livret' | 'reglement' | 'programme' | 'emargement' | 'attestations' | 'diplome'

/** Même liste que la route /api/pdf/pack-hygiene (ordre du classeur). */
const PIECES: { id: PieceId; titre: string; sousTitre: string; bloc: 'apporter' | 'remettre'; icon: any }[] = [
  { id: 'pms', titre: 'Plan de maîtrise sanitaire', sousTitre: 'Personnalisé au nom de l’établissement, plan de formation du personnel pré-rempli avec les stagiaires', bloc: 'apporter', icon: ShieldCheck },
  { id: 'affichages', titre: 'Affichages obligatoires', sousTitre: 'Allergènes, lavage des mains, tenue en cuisine, origine des viandes', bloc: 'apporter', icon: ClipboardCheck },
  { id: 'livret', titre: 'Livret d’accueil', sousTitre: 'Remis à chaque stagiaire', bloc: 'apporter', icon: BookOpen },
  { id: 'reglement', titre: 'Règlement intérieur', sousTitre: 'Applicable pendant la formation', bloc: 'apporter', icon: FileText },
  { id: 'programme', titre: 'Programme de formation', sousTitre: 'Objectifs, contenu, modalités', bloc: 'apporter', icon: FileText },
  { id: 'emargement', titre: 'Feuilles d’émargement', sousTitre: 'Vierges, par demi-journée', bloc: 'apporter', icon: ClipboardCheck },
  { id: 'attestations', titre: 'Attestations d’hygiène alimentaire', sousTitre: 'Une par stagiaire', bloc: 'remettre', icon: Award },
  { id: 'diplome', titre: 'Diplôme de l’établissement', sousTitre: 'À afficher dans l’établissement', bloc: 'remettre', icon: Award },
]

interface Props {
  sessionId: string
  etablissement: string | null
  franchiseNom: string | null
  formateur: { prenom?: string | null; nom?: string | null; email?: string | null } | null
}

export function SessionPackHygiene({ sessionId, etablissement, franchiseNom, formateur }: Props) {
  const { toast } = useToast()
  const router = useRouter()
  const [busy, setBusy] = useState<'preview' | 'send' | null>(null)
  const [apercu, setApercu] = useState<{ to: string; subject: string; html: string } | null>(null)
  const base = `/api/pdf/pack-hygiene/${sessionId}`

  async function previsualiser() {
    setBusy('preview')
    const r = await envoyerPackHygieneFormateurAction(sessionId, { preview: true })
    setBusy(null)
    if (r.success && r.data?.html) setApercu({ to: r.data.to || '', subject: r.data.subject || '', html: r.data.html })
    else toast('error', r.error || 'Erreur')
  }
  async function envoyer() {
    setBusy('send')
    const r = await envoyerPackHygieneFormateurAction(sessionId)
    setBusy(null)
    if (r.success) { toast('success', `Pack envoyé à ${r.data?.to} (${r.data?.tailleKo} Ko)`); setApercu(null); router.refresh() }
    else toast('error', r.error || 'Erreur')
  }

  const Bloc = ({ titre, aide, ids }: { titre: string; aide: string; ids: PieceId[] }) => (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100">
        <h3 className="text-sm font-heading font-semibold text-surface-900">{titre}</h3>
        <p className="text-xs text-surface-500 mt-0.5">{aide}</p>
      </div>
      <div className="divide-y divide-surface-100">
        {PIECES.filter((p) => ids.includes(p.id)).map((p) => {
          const Icon = p.icon
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="h-9 w-9 rounded-xl bg-surface-100 flex items-center justify-center shrink-0"><Icon className="h-4 w-4 text-brand-600" /></span>
              <div className="flex-1 min-w-[200px]">
                <div className="text-sm font-semibold text-surface-900">{p.titre}</div>
                <div className="text-xs text-surface-500">{p.sousTitre}</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <a href={`${base}?doc=${p.id}`} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-surface-200 text-xs font-medium text-surface-700 hover:bg-surface-50">
                  <Eye className="h-3.5 w-3.5" /> Aperçu
                </a>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap items-center gap-4">
        <span className="h-11 w-11 rounded-2xl bg-brand-50 flex items-center justify-center shrink-0"><ShieldCheck className="h-5 w-5 text-brand-600" /></span>
        <div className="flex-1 min-w-[240px]">
          <div className="text-sm font-heading font-semibold text-surface-900">
            Pack Hygiène {etablissement ? `pour ${etablissement}` : ''}
          </div>
          <div className="text-xs text-surface-500 mt-0.5">
            {franchiseNom ? `Documents aux couleurs de ${franchiseNom}` : 'Documents à l’image de l’organisme'} · le classeur s’imprime d’un coup, dans l’ordre du sommaire, avec un intercalaire par pièce.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={`${base}?doc=classeur`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-500 text-white text-xs font-semibold hover:bg-brand-600">
            <Printer className="h-3.5 w-3.5" /> Classeur à imprimer (PDF)
          </a>
          <a href={`${base}?doc=zip`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-surface-200 text-xs font-medium text-surface-700 hover:bg-surface-50">
            <Download className="h-3.5 w-3.5" /> Tout télécharger (ZIP)
          </a>
          <button onClick={previsualiser} disabled={!formateur?.email || busy !== null}
            title={formateur?.email ? `Envoyer le classeur à ${formateur.prenom || ''} ${formateur.nom || ''}` : 'Aucun formateur avec email sur la session'}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-surface-200 text-xs font-medium text-surface-700 hover:bg-surface-50 disabled:opacity-40 disabled:cursor-not-allowed">
            {busy === 'preview' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Envoyer au formateur
          </button>
        </div>
      </div>

      <Bloc titre="À apporter le premier jour" aide="Le formateur imprime et constitue le classeur avant la formation."
        ids={['pms', 'affichages', 'livret', 'reglement', 'programme', 'emargement']} />
      <Bloc titre="À remettre en fin de formation" aide="Pré-remplis avec les stagiaires inscrits ; remis le dernier jour."
        ids={['attestations', 'diplome']} />

      <Modal isOpen={apercu !== null} onClose={() => setApercu(null)} title="Aperçu de l’envoi au formateur" size="lg">
        {apercu && (
          <div className="space-y-3">
            <div className="text-xs text-surface-500">À : <span className="font-medium text-surface-800">{apercu.to}</span> · Objet : <span className="font-medium text-surface-800">{apercu.subject}</span> · Pièce jointe : le classeur PDF complet</div>
            <iframe srcDoc={apercu.html} className="w-full h-[460px] rounded-xl border border-surface-200 bg-white" title="Aperçu de l’email" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setApercu(null)} className="px-3 py-2 rounded-lg border border-surface-200 text-xs font-medium text-surface-700 hover:bg-surface-50">Annuler</button>
              <button onClick={envoyer} disabled={busy !== null}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-500 text-white text-xs font-semibold hover:bg-brand-600 disabled:opacity-40">
                {busy === 'send' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Confirmer l’envoi
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
