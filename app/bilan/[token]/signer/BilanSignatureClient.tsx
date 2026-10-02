'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Eraser, PenTool, ShieldCheck } from '@/components/ui/icons'
import { Button } from '@/components/ui'
import { signerBilanAction } from './actions'
import { AvisFormationStagiaire } from '@/components/poei/AvisFormationStagiaire'

export function BilanSignatureClient({ token, orgNom, logo, nomStagiaire, lignes, avisInitial, noteInitiale = '', dejaSigne, certificatASigner = false, apercu = false }: {
  token: string
  orgNom: string
  logo: string | null
  nomStagiaire: string
  /** Les rubriques du bilan telles qu'elles seront imprimées */
  lignes: { libelle: string; valeur: string }[]
  avisInitial: string
  noteInitiale?: string
  dejaSigne: boolean
  /** Le certificat de réalisation n'est pas encore signé : la même signature le couvre */
  certificatASigner?: boolean
  /** Lien d'aperçu de l'équipe : rien ne s'enregistre */
  apercu?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [nom, setNom] = useState(nomStagiaire)
  const [avis, setAvis] = useState(avisInitial)
  const [note, setNote] = useState(noteInitiale)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(dejaSigne)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
    ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1c1917'
  }, [done])

  const pos = (e: any) => {
    const c = canvasRef.current!, r = c.getBoundingClientRect()
    const p = e.touches?.[0] || e
    return { x: (p.clientX - r.left) * (c.width / r.width), y: (p.clientY - r.top) * (c.height / r.height) }
  }
  const start = (e: any) => { e.preventDefault(); const ctx = canvasRef.current!.getContext('2d')!; const { x, y } = pos(e); ctx.beginPath(); ctx.moveTo(x, y); setDrawing(true); setHasDrawn(true) }
  const move = (e: any) => { if (!drawing) return; e.preventDefault(); const ctx = canvasRef.current!.getContext('2d')!; const { x, y } = pos(e); ctx.lineTo(x, y); ctx.stroke() }
  const end = () => setDrawing(false)
  const clear = () => { const c = canvasRef.current!; const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); setHasDrawn(false) }

  async function submit() {
    setErr(null)
    if (!note) { setErr('Merci d’indiquer votre appréciation de la formation.'); return }
    if (!hasDrawn) { setErr('Merci de signer dans le cadre.'); return }
    if (!nom.trim()) { setErr("Merci d'indiquer votre nom."); return }
    setSaving(true)
    const r = await signerBilanAction(token, canvasRef.current!.toDataURL('image/png'), nom.trim(), { note, avis })
    if (r.success) setDone(true)
    else setErr(r.error || 'Une erreur est survenue. Merci de réessayer.')
    setSaving(false)
  }

  if (done) {
    return (
      <div className="max-w-lg mx-auto px-5 py-16 text-center">
        <div className="h-16 w-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-heading font-bold text-surface-900">{certificatASigner ? 'Documents signés' : 'Bilan signé'}</h1>
        <p className="text-surface-500 mt-2">
          {certificatASigner
            ? 'Merci. Votre certificat de réalisation, votre attestation de compétences et votre bilan de fin de formation ont bien été signés.'
            : 'Merci. Votre bilan de fin de formation a bien été signé.'}
        </p>
        {apercu && (
          <p className="mt-5 rounded-xl bg-warning-50 border border-warning-200 px-4 py-3 text-sm text-warning-700">
            Aperçu : c&apos;est l&apos;écran que voit le stagiaire après avoir signé. Rien n&apos;a été enregistré.
          </p>
        )}
        <p className="text-xs text-surface-400 mt-6">{orgNom}</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      {apercu && (
        <div className="mb-6 rounded-xl bg-warning-50 border border-warning-200 px-4 py-3 text-sm text-warning-700">
          Aperçu réservé à l&apos;équipe : voici la page que reçoit {nomStagiaire || 'le stagiaire'}. Vous pouvez la tester jusqu&apos;au bout, rien n&apos;est enregistré.
        </div>
      )}
      <div className="text-center mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {logo && <img src={logo} alt="" className="h-12 mx-auto mb-4 object-contain" />}
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 bg-brand-50 rounded-full px-3 py-1">
          <ShieldCheck className="h-3.5 w-3.5" /> Signature électronique
        </div>
        <h1 className="text-2xl font-heading font-bold text-surface-900 mt-3">{certificatASigner ? 'Vos documents de fin de formation' : 'Bilan de fin de formation'}</h1>
        <p className="text-surface-500 mt-1 text-sm">
          {certificatASigner
            ? 'Une seule signature pour votre certificat de réalisation, votre attestation de compétences et votre bilan de fin de formation. Relisez les informations, donnez votre avis, puis signez.'
            : 'Relisez votre bilan, donnez votre avis sur la formation, puis signez dans le cadre ci-dessous.'}
        </p>
      </div>

      <div className="card p-5 mb-5 space-y-2.5 text-sm">
        {lignes.map((l) => (
          <div key={l.libelle} className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4 border-b border-surface-100 pb-2 last:border-0">
            <span className="text-surface-500 sm:shrink-0">{l.libelle}</span>
            <span className="font-medium text-surface-900 sm:text-right whitespace-pre-line break-words">{l.valeur}</span>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <label className="block text-sm font-medium text-surface-700 mb-1">Nom et prénom</label>
        <input className="input-base mb-4" value={nom} onChange={(e) => setNom(e.target.value)} />

        <AvisFormationStagiaire note={note} avis={avis} onNote={(v) => { setNote(v); setErr(null) }} onAvis={setAvis} />

        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-surface-700 flex items-center gap-1.5"><PenTool className="h-4 w-4 text-brand-500" /> Votre signature</label>
          <button onClick={clear} className="text-xs text-surface-500 hover:text-danger-600 inline-flex items-center gap-1 min-h-[40px] sm:min-h-0"><Eraser className="h-3.5 w-3.5" /> Effacer</button>
        </div>
        <canvas
          ref={canvasRef} width={640} height={200}
          className="w-full h-44 rounded-xl border-2 border-dashed border-surface-300 bg-white touch-none cursor-crosshair"
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        />

        {err && (
          <div className="mt-4 rounded-xl bg-danger-50 border border-danger-200 px-4 py-3 text-sm text-danger-700">{err}</div>
        )}

        <Button className="w-full mt-5" onClick={submit} isLoading={saving} icon={<CheckCircle2 className="h-4 w-4" />}>
          {certificatASigner ? 'Signer mes documents' : 'Signer mon bilan'}
        </Button>
        <p className="text-2xs text-surface-400 mt-3 text-center">
          {certificatASigner
            ? 'En signant, vous attestez avoir suivi la formation et vous signez votre certificat de réalisation, votre attestation de compétences et votre bilan de fin de formation, qui sera transmis à France Travail.'
            : 'En signant, vous confirmez avoir relu les informations de ce bilan et votre avis sur la formation. Il sera transmis à France Travail.'}
        </p>
      </div>
    </div>
  )
}
