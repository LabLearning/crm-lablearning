'use client'

import { useRef, useState, useEffect } from 'react'
import { Pen, CheckCircle2, RotateCcw, FileText, Calendar, MapPin } from '@/components/ui/icons'
import { signContratFormateurPublicAction } from '@/app/dashboard/sessions/confirm-actions'
import { cadreSigne, MESSAGE_SIGNATURE_VIDE } from '@/lib/signature-encre'

interface ContratInfo {
  id: string
  numero: string | null
  tarif_journalier: number | null
  nombre_jours: number | null
  montant_ht: number | null
  status: string
  signature_formateur_date: string | null
  signature_formateur_nom: string | null
  organization: { name: string; logo_url: string | null } | null
  formateur: { prenom: string; nom: string; email: string | null } | null
  session: {
    reference: string | null
    date_debut: string
    date_fin: string
    lieu: string | null
    formation: { intitule: string | null } | null
  } | null
}

export function ContratFormateurSignatureClient({ contrat, token }: { contrat: ContratInfo; token: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [signataireNom, setSignataireNom] = useState(
    contrat.formateur ? `${contrat.formateur.prenom} ${contrat.formateur.nom}` : ''
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signed, setSigned] = useState(['signe_formateur', 'signe_complete'].includes(contrat.status))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = '#1C1917'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  function getCoords(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      const t = e.touches[0]
      return { x: (t.clientX - rect.left) * (canvas.width / rect.width), y: (t.clientY - rect.top) * (canvas.height / rect.height) }
    }
    return { x: (e.clientX - rect.left) * (canvas.width / rect.width), y: (e.clientY - rect.top) * (canvas.height / rect.height) }
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = getCoords(e)
    ctx.beginPath(); ctx.moveTo(x, y); setDrawing(true)
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing) return
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = getCoords(e)
    ctx.lineTo(x, y); ctx.stroke(); setHasDrawn(true)
  }

  function stopDraw() { setDrawing(false) }

  function clearSignature() {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  async function handleSubmit() {
    if (!signataireNom.trim()) { setError('Veuillez saisir votre nom'); return }
    if (!hasDrawn) { setError('Veuillez signer dans le cadre'); return }
    // Un point ou un trait de quelques millimètres n'est pas une signature
    if (!cadreSigne(canvasRef.current)) { setError(MESSAGE_SIGNATURE_VIDE); return }
    setError(null); setSubmitting(true)
    try {
      const dataUrl = canvasRef.current!.toDataURL('image/png')
      const r = await signContratFormateurPublicAction(token, { nom: signataireNom, signatureDataUrl: dataUrl }, { userAgent: navigator.userAgent })
      if (r.success) setSigned(true)
      else setError(r.error || 'Erreur')
    } catch {
      // Réseau coupé pendant l'envoi : on ne sait pas si la signature est arrivée
      setError('La connexion a été interrompue. Rechargez la page : si le document apparaît signé, votre signature est bien enregistrée.')
    } finally {
      setSubmitting(false)
    }
  }

  if (signed) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="card p-8 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-surface-900">Contrat signé</h1>
          <p className="text-sm text-surface-600">
            Merci, votre signature a bien été enregistrée. La mission est confirmée
            de votre côté.
          </p>
          <p className="text-xs text-surface-500">
            Signataire : <strong>{contrat.signature_formateur_nom || signataireNom}</strong>
          </p>
        </div>
      </div>
    )
  }

  const formationName = contrat.session?.formation?.intitule || 'Formation'

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <FileText className="h-5 w-5 text-brand-600" />
          </div>
          <div>
            <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Contrat de prestation</div>
            <h1 className="text-xl font-heading font-bold text-surface-900">{contrat.numero || 'Contrat'}</h1>
          </div>
        </div>
        <p className="text-sm text-surface-700">
          Mission de formation — <strong>{formationName}</strong>
        </p>
      </div>

      {/* Détails */}
      <div className="card p-6 space-y-3">
        <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Détails de la mission</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div className="text-surface-500 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />Période</div>
          <div className="font-medium">
            {contrat.session && `du ${new Date(contrat.session.date_debut).toLocaleDateString('fr-FR')} au ${new Date(contrat.session.date_fin).toLocaleDateString('fr-FR')}`}
          </div>
          {contrat.session?.lieu && (
            <>
              <div className="text-surface-500 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />Lieu</div>
              <div className="font-medium">{contrat.session.lieu}</div>
            </>
          )}
          {contrat.tarif_journalier && (
            <>
              <div className="text-surface-500">Tarif journalier</div>
              <div className="font-medium">{Number(contrat.tarif_journalier).toLocaleString('fr-FR')} € HT</div>
            </>
          )}
          {contrat.nombre_jours && (
            <>
              <div className="text-surface-500">Nombre de jours</div>
              <div className="font-medium">{contrat.nombre_jours}</div>
            </>
          )}
          {contrat.montant_ht !== null && (
            <>
              <div className="text-surface-700 font-semibold pt-1 border-t border-surface-100">Montant total HT</div>
              <div className="font-bold text-brand-700 pt-1 border-t border-surface-100">
                {Number(contrat.montant_ht).toLocaleString('fr-FR')} €
              </div>
            </>
          )}
        </div>
      </div>

      {/* Signature */}
      <div className="card p-6 space-y-4">
        <div>
          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Signature</div>
          <div className="text-sm text-surface-600 mt-1">
            Signez dans le cadre ci-dessous pour valider votre contrat de prestation.
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1.5">Nom et prénom *</label>
          <input
            type="text"
            value={signataireNom}
            onChange={(e) => setSignataireNom(e.target.value)}
            className="input-base"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-surface-700">Signature *</label>
            {hasDrawn && (
              <button type="button" onClick={clearSignature} className="text-xs text-surface-500 hover:text-surface-800 flex items-center gap-1">
                <RotateCcw className="h-3 w-3" /> Effacer
              </button>
            )}
          </div>
          <div className="rounded-xl border-2 border-dashed border-surface-300 bg-white">
            <canvas
              ref={canvasRef}
              width={800}
              height={200}
              className="w-full h-48 touch-none cursor-crosshair rounded-xl"
              onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
              onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
            />
          </div>
          {!hasDrawn && (
            <div className="text-xs text-surface-400 mt-1 text-center flex items-center justify-center gap-1">
              <Pen className="h-3 w-3" /> Tracez votre signature ci-dessus
            </div>
          )}
        </div>

        {error && <div className="rounded-xl bg-danger-50 border border-danger-200 px-4 py-3 text-sm text-danger-700">{error}</div>}

        <button
          onClick={handleSubmit}
          disabled={submitting || !hasDrawn || !signataireNom.trim()}
          className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Signature en cours…' : 'Signer le contrat'}
        </button>
      </div>
    </div>
  )
}
