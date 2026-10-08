'use client'

import { useRef, useState, useEffect } from 'react'
import { Pen, CheckCircle2, RotateCcw, FileText } from '@/components/ui/icons'
import { signConventionPublicAction, signalerOuvertureConventionAction } from '@/app/dashboard/conventions/signature-actions'
import { texteConsentement } from '@/lib/consentement-convention'
import { cadreSigne, MESSAGE_SIGNATURE_VIDE } from '@/lib/signature-encre'

interface ConventionInfo {
  id: string
  numero: string | null
  objet: string | null
  type: string | null
  nombre_stagiaires: number | null
  duree_heures: number | null
  lieu: string | null
  dates_formation: string | null
  montant_ht: number | null
  taux_tva: number | null
  montant_ttc: number | null
  status: string
  /** Horodatage réel de la signature (jamais la date portée sur la convention) */
  signature_client_signed_at: string | null
  signature_client_nom: string | null
  organization: { name: string; logo_url: string | null } | null
  client: { type?: string | null; raison_sociale: string | null; adresse: string | null; code_postal: string | null; ville: string | null; siret: string | null } | null
  formation: { intitule: string | null } | null
}

export function ConventionSignatureClient({ convention, token }: { convention: ConventionInfo; token: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [signataireNom, setSignataireNom] = useState('')
  const [consentement, setConsentement] = useState(false)
  // La case dit « j'ai pris connaissance de la convention » : elle ne se coche
  // qu'après l'ouverture du document complet. Mémorisé pour l'onglet, car
  // certains navigateurs rechargent la page au retour du PDF.
  const [documentOuvert, setDocumentOuvert] = useState(false)
  const cleLecture = `ll_convention_lue_${convention.id}`
  const lienDocument = `/api/pdf/convention/${convention.id}?token=${encodeURIComponent(token)}`
  useEffect(() => {
    try { if (sessionStorage.getItem(cleLecture) === '1') setDocumentOuvert(true) } catch { /* stockage indisponible */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const noterLecture = () => {
    setDocumentOuvert(true)
    try { sessionStorage.setItem(cleLecture, '1') } catch { /* stockage indisponible */ }
  }
  const particulier = convention.client?.type === 'particulier'
  const nomDocument = particulier ? 'le contrat' : 'la convention'
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signed, setSigned] = useState(['signee_client', 'signee_complete'].includes(convention.status))

  // Preuve d'ouverture : envoyée par le navigateur une fois la page affichée
  useEffect(() => {
    if (!signed) signalerOuvertureConventionAction(token).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    ctx.beginPath()
    ctx.moveTo(x, y)
    setDrawing(true)
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing) return
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = getCoords(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasDrawn(true)
  }

  function stopDraw() {
    setDrawing(false)
  }

  function clearSignature() {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  async function handleSubmit() {
    if (!signataireNom.trim()) { setError('Veuillez saisir votre nom complet'); return }
    if (!hasDrawn) { setError('Veuillez signer dans le cadre'); return }
    // Un point ou un trait de quelques millimètres n'est pas une signature
    if (!cadreSigne(canvasRef.current)) { setError(MESSAGE_SIGNATURE_VIDE); return }
    if (!consentement) { setError(`Cochez la case indiquant que vous avez pris connaissance de ${nomDocument}.`); return }
    setError(null); setSubmitting(true)
    try {
      const dataUrl = canvasRef.current!.toDataURL('image/png')
      const r = await signConventionPublicAction(token, { nom: signataireNom, signatureDataUrl: dataUrl, consentement }, { userAgent: navigator.userAgent })
      if (r.success) setSigned(true)
      else setError(r.error || 'Erreur')
    } catch {
      setError('La connexion a été interrompue. Rechargez la page : si la convention apparaît signée, votre signature est bien enregistrée.')
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
          <h1 className="text-2xl font-heading font-bold text-surface-900">Convention signée</h1>
          <p className="text-sm text-surface-600">
            Merci, votre signature a bien été enregistrée. {convention.organization?.name} va prendre le relais
            pour la suite (transmission OPCO et préparation de la session).
          </p>
          <p className="text-xs text-surface-500">
            Signataire : <strong>{convention.signature_client_nom || signataireNom}</strong>
            {convention.signature_client_signed_at && (
              <>, le {new Date(convention.signature_client_signed_at).toLocaleDateString('fr-FR', { dateStyle: 'long' as any, timeZone: 'Europe/Paris' })}</>
            )}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <FileText className="h-5 w-5 text-brand-600" />
          </div>
          <div>
            <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">{(convention as any).client?.type === 'particulier' ? 'Contrat de formation' : 'Convention de formation'}</div>
            <h1 className="text-xl font-heading font-bold text-surface-900">{convention.numero || 'Convention'}</h1>
          </div>
        </div>
        <p className="text-sm text-surface-700">{convention.objet}</p>
        <a
          href={lienDocument}
          target="_blank"
          rel="noreferrer"
          onClick={noterLecture}
          className="btn-secondary mt-4 inline-flex items-center gap-2"
        >
          <FileText className="h-4 w-4" /> Lire {particulier ? 'le contrat complet' : 'la convention complète'} (PDF)
        </a>
      </div>

      {/* Détails */}
      <div className="card p-6 space-y-3">
        <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Détails de la formation</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {convention.formation?.intitule && (
            <><div className="text-surface-500">Formation</div><div className="font-medium">{convention.formation.intitule}</div></>
          )}
          {convention.dates_formation && (
            <><div className="text-surface-500">Dates</div><div className="font-medium">{convention.dates_formation}</div></>
          )}
          {convention.duree_heures && (
            <><div className="text-surface-500">Durée</div><div className="font-medium">{convention.duree_heures} heures</div></>
          )}
          {convention.nombre_stagiaires && (
            <><div className="text-surface-500">Stagiaires</div><div className="font-medium">{convention.nombre_stagiaires}</div></>
          )}
          {convention.lieu && (
            <><div className="text-surface-500">Lieu</div><div className="font-medium">{convention.lieu}</div></>
          )}
          {convention.montant_ht !== null && (
            <>
              <div className="text-surface-500">Montant HT</div>
              <div className="font-medium">{Number(convention.montant_ht).toLocaleString('fr-FR')} €</div>
              <div className="text-surface-500">TVA ({convention.taux_tva}%)</div>
              <div className="font-medium">{(Number(convention.montant_ttc || 0) - Number(convention.montant_ht)).toLocaleString('fr-FR')} €</div>
              <div className="text-surface-700 font-semibold pt-1 border-t border-surface-100">Montant TTC</div>
              <div className="font-bold text-brand-700 pt-1 border-t border-surface-100">{Number(convention.montant_ttc || 0).toLocaleString('fr-FR')} €</div>
            </>
          )}
        </div>
      </div>

      {/* Client */}
      {convention.client && (
        <div className="card p-6 space-y-2">
          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Client</div>
          <div className="font-medium text-surface-900">{convention.client.raison_sociale}</div>
          {convention.client.siret && <div className="text-xs text-surface-500">SIRET {convention.client.siret}</div>}
          {convention.client.adresse && (
            <div className="text-sm text-surface-700">
              {convention.client.adresse}<br />
              {convention.client.code_postal} {convention.client.ville}
            </div>
          )}
        </div>
      )}

      {/* Signature */}
      <div className="card p-6 space-y-4">
        <div>
          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Signature</div>
          <div className="text-sm text-surface-600 mt-1">
            Signez dans le cadre ci-dessous pour valider la convention. Cette signature engage votre entreprise.
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1.5">Nom et prénom du signataire *</label>
          <input
            type="text"
            value={signataireNom}
            onChange={(e) => setSignataireNom(e.target.value)}
            className="input-base"
            placeholder="Ex: Jean Dupont, Gérant"
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

        <div>
          <label className={`flex items-start gap-3 rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 ${documentOuvert ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
            <input
              type="checkbox"
              checked={consentement}
              disabled={!documentOuvert}
              onChange={(e) => setConsentement(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-surface-300 accent-brand-600"
            />
            <span className="text-sm text-surface-700">{texteConsentement(particulier)}</span>
          </label>
          {!documentOuvert && (
            <p className="mt-2 text-xs text-surface-600">
              Ouvrez d’abord {particulier ? 'le contrat complet' : 'la convention complète'} pour pouvoir cocher cette case :{' '}
              <a href={lienDocument} target="_blank" rel="noreferrer" onClick={noterLecture} className="font-semibold text-brand-600 underline">
                lire {nomDocument} (PDF)
              </a>
            </p>
          )}
        </div>

        {error && <div className="rounded-xl bg-danger-50 border border-danger-200 px-4 py-3 text-sm text-danger-700">{error}</div>}

        <button
          onClick={handleSubmit}
          disabled={submitting || !hasDrawn || !signataireNom.trim() || !consentement}
          className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Signature en cours…' : 'Signer la convention'}
        </button>
      </div>
    </div>
  )
}
