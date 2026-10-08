'use client'

import { useRef, useState, useEffect } from 'react'
import { CheckCircle2, Eraser, FileText, PenTool, ShieldCheck } from '@/components/ui/icons'
import { Button } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { signMandatAction } from './actions'
import { cadreSigne, MESSAGE_SIGNATURE_VIDE } from '@/lib/signature-encre'

/** Signature du mandat POEI par le gérant — même construction que la
 *  signature des certificats : résumé, lecture du PDF, cadre de signature. */
export function MandatSignatureClient({ mandat, token, gerantNom, nbCandidats }: {
  mandat: any
  token: string
  gerantNom: string | null
  nbCandidats: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [nom, setNom] = useState(gerantNom || '')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(!!mandat.signed_at)
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

  const poei = mandat.poei || {}
  const client = poei.client || {}
  const pdfUrl = `/api/pdf/mandat-poei/${poei.id}?token=${token}`

  async function submit() {
    setErr(null)
    if (!hasDrawn) { setErr('Merci de signer dans le cadre.'); return }
    // Un simple appui dans le cadre ne trace rien : on vérifie qu'il y a bien un tracé
    if (!cadreSigne(canvasRef.current)) { setErr(MESSAGE_SIGNATURE_VIDE); return }
    if (!nom.trim()) { setErr("Merci d'indiquer votre nom."); return }
    setSaving(true)
    try {
      const data = canvasRef.current!.toDataURL('image/png')
      const r = await signMandatAction(token, data, nom.trim())
      if (r.success) setDone(true)
      else setErr(r.error || 'Une erreur est survenue. Merci de réessayer.')
    } catch {
      // Réseau coupé pendant l'envoi : on ne sait pas si la signature est arrivée
      setErr('La connexion a été interrompue. Rechargez la page : si le document apparaît signé, votre signature est bien enregistrée.')
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <div className="max-w-lg mx-auto px-5 py-16 text-center">
        <div className="h-16 w-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-heading font-bold text-surface-900">Mandat signé</h1>
        <p className="text-surface-500 mt-2">
          Merci. Le mandat est signé : {mandat.organization?.name || 'Lab Learning'} peut désormais réaliser les
          démarches de la demande de POEI auprès de France Travail au nom de votre entreprise.
        </p>
        <a href={pdfUrl} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium mt-5">
          <FileText className="h-4 w-4" /> Télécharger le mandat signé
        </a>
        <p className="text-xs text-surface-400 mt-6">{mandat.organization?.name || 'Lab Learning'}</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      <div className="text-center mb-8">
        {mandat.organization?.logo_url && <img src={mandat.organization.logo_url} alt="" className="h-12 mx-auto mb-4 object-contain" />}
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 bg-brand-50 rounded-full px-3 py-1">
          <ShieldCheck className="h-3.5 w-3.5" /> Signature électronique
        </div>
        <h1 className="text-2xl font-heading font-bold text-surface-900 mt-3">Mandat POEI</h1>
        <p className="text-surface-500 mt-1 text-sm">
          En qualité de gérant de l&apos;entreprise, lisez le mandat puis signez dans le cadre ci-dessous.
        </p>
      </div>

      <div className="card p-5 mb-5 space-y-2.5 text-sm">
        {[
          ['Entreprise mandante', client.nom_commercial || client.raison_sociale],
          ['Organisme mandataire', mandat.organization?.name || 'Lab Learning'],
          ['Formation', poei.formation?.intitule],
          ['Candidats concernés', nbCandidats ? `${nbCandidats} candidat${nbCandidats > 1 ? 's' : ''}` : null],
          ['Période', poei.date_debut ? `${formatDate(poei.date_debut, { day: 'numeric', month: 'short', year: 'numeric' })}${poei.date_fin ? ` → ${formatDate(poei.date_fin, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}` : null],
          ['Objet', "Démarches de la demande d'aide POEI réalisées par l'organisme de formation, au nom de l'entreprise, à titre gratuit"],
        ].filter(([, v]) => v).map(([l, v]) => (
          <div key={l as string} className="flex justify-between gap-4 border-b border-surface-100 pb-2 last:border-0">
            <span className="text-surface-500 shrink-0">{l}</span>
            <span className="font-medium text-surface-900 text-right">{v}</span>
          </div>
        ))}
        <a href={pdfUrl} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium pt-1">
          <FileText className="h-4 w-4" /> Lire le mandat complet (PDF)
        </a>
      </div>

      <div className="card p-5">
        <label className="block text-sm font-medium text-surface-700 mb-1">Nom et prénom du gérant</label>
        <input className="input-base mb-4" value={nom} onChange={(e) => setNom(e.target.value)} />

        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-surface-700 flex items-center gap-1.5"><PenTool className="h-4 w-4 text-brand-500" /> Votre signature</label>
          <button onClick={clear} className="text-xs text-surface-500 hover:text-danger-600 inline-flex items-center gap-1"><Eraser className="h-3.5 w-3.5" /> Effacer</button>
        </div>
        <canvas
          ref={canvasRef} width={640} height={200}
          className="w-full h-44 rounded-xl border-2 border-dashed border-surface-300 bg-white touch-none cursor-crosshair"
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        />
        {mandat.date_emission && (
          <p className="text-xs text-surface-400 mt-2">
            Le mandat est daté du {formatDate(mandat.date_emission, { day: 'numeric', month: 'long', year: 'numeric' })} (date d&apos;émission).
          </p>
        )}

        {err && (
          <div className="mt-4 rounded-xl bg-danger-50 border border-danger-200 px-4 py-3 text-sm text-danger-700">{err}</div>
        )}

        <Button className="w-full mt-5" onClick={submit} isLoading={saving} icon={<CheckCircle2 className="h-4 w-4" />}>
          Signer le mandat
        </Button>
        <p className="text-2xs text-surface-400 mt-3 text-center">
          En signant, vous donnez mandat exprès et spécial à l&apos;organisme de formation pour réaliser les démarches
          de la demande de POEI auprès de France Travail au nom de votre entreprise, dans les limites définies par la
          convention de mandat.
        </p>
      </div>
    </div>
  )
}
