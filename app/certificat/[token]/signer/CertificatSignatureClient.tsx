'use client'

import { useRef, useState, useEffect } from 'react'
import { CheckCircle2, Eraser, PenTool, ShieldCheck } from '@/components/ui/icons'
import { Button } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { signCertificatAction } from './actions'

/** 63.5 → « 63,5 » */
const heuresFr = (n: number) => String(Math.round(Number(n) * 100) / 100).replace('.', ',')

export function CertificatSignatureClient({ sig, token, nbCandidats = 0, employeurNom = null, heuresCandidat = null }: {
  sig: any
  token: string
  nbCandidats?: number
  employeurNom?: string | null
  /** Heures portées sur le certificat de ce candidat (saisies dans la POEI, sinon durée du parcours). */
  heuresCandidat?: { heures: number; prevues: number } | null
}) {
  // Le représentant de l'employeur signe l'attestation France Travail, une
  // fois pour tous les candidats ; le candidat signe son propre certificat.
  const estEmployeur = sig.role === 'employeur'
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [nom, setNom] = useState(
    sig.role === 'employeur'
      ? (employeurNom || '')
      : `${sig.apprenant?.prenom || ''} ${sig.apprenant?.nom || ''}`.trim(),
  )
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(!!sig.signed_at)
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

  const poei = sig.poei || {}
  const formation = poei.formation || {}
  const client = poei.client || {}
  const dateAffichee = sig.date_signature || poei.date_fin

  async function submit() {
    setErr(null)
    if (!hasDrawn) { setErr('Merci de signer dans le cadre.'); return }
    if (!nom.trim()) { setErr('Merci d\'indiquer votre nom.'); return }
    setSaving(true)
    const data = canvasRef.current!.toDataURL('image/png')
    const r = await signCertificatAction(token, data, nom.trim())
    if (r.success) setDone(true)
    else setErr(r.error || "Une erreur est survenue. Merci de réessayer.")
    setSaving(false)
  }

  if (done) {
    return (
      <div className="max-w-lg mx-auto px-5 py-16 text-center">
        <div className="h-16 w-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-heading font-bold text-surface-900">{estEmployeur ? 'Attestation signée' : 'Certificat signé'}</h1>
        <p className="text-surface-500 mt-2">
          {estEmployeur
            ? `Merci. Votre signature sera portée sur l'attestation de développement de compétences de chaque candidat${dateAffichee ? ` (datée du ${formatDate(dateAffichee, { day: 'numeric', month: 'long', year: 'numeric' })})` : ''}.`
            : `Merci. Votre certificat de réalisation a bien été signé${dateAffichee ? ` (daté du ${formatDate(dateAffichee, { day: 'numeric', month: 'long', year: 'numeric' })})` : ''}.`}
        </p>
        <p className="text-xs text-surface-400 mt-6">{sig.organization?.name || 'Lab Learning'}</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      <div className="text-center mb-8">
        {sig.organization?.logo_url && <img src={sig.organization.logo_url} alt="" className="h-12 mx-auto mb-4 object-contain" />}
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 bg-brand-50 rounded-full px-3 py-1">
          <ShieldCheck className="h-3.5 w-3.5" /> Signature électronique
        </div>
        <h1 className="text-2xl font-heading font-bold text-surface-900 mt-3">
          {estEmployeur ? 'Attestation de développement de compétences' : 'Certificat de réalisation'}
        </h1>
        <p className="text-surface-500 mt-1 text-sm">
          {estEmployeur
            ? 'En qualité de représentant de l\u2019employeur, vérifiez les informations puis signez dans le cadre ci-dessous.'
            : 'Vérifiez les informations puis signez dans le cadre ci-dessous.'}
        </p>
      </div>

      <div className="card p-5 mb-5 space-y-2.5 text-sm">
        {[estEmployeur
            ? ['Candidats concernés', nbCandidats ? `${nbCandidats} candidat${nbCandidats > 1 ? 's' : ''} — une signature couvre toutes les attestations` : null]
            : ['Bénéficiaire', `${sig.apprenant?.prenom || ''} ${sig.apprenant?.nom || ''}`.trim()],
          ['Entreprise', client.nom_commercial || client.raison_sociale || sig.apprenant?.entreprise],
          ['Formation', formation.intitule || poei.poste_vise],
          ['Période', poei.date_debut ? `${formatDate(poei.date_debut, { day: 'numeric', month: 'short', year: 'numeric' })}${poei.date_fin ? ` → ${formatDate(poei.date_fin, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}` : null],
          heuresCandidat
            ? ['Heures effectuées', `${heuresFr(heuresCandidat.heures)} heures${heuresCandidat.prevues && heuresCandidat.heures < heuresCandidat.prevues ? ` sur ${heuresFr(heuresCandidat.prevues)} prévues` : ''}`]
            : ['Durée', poei.duree_heures || formation.duree_heures ? `${poei.duree_heures || formation.duree_heures} heures` : null],
        ].filter(([, v]) => v).map(([l, v]) => (
          <div key={l as string} className="flex justify-between gap-4 border-b border-surface-100 pb-2 last:border-0">
            <span className="text-surface-500 shrink-0">{l}</span>
            <span className="font-medium text-surface-900 text-right">{v}</span>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <label className="block text-sm font-medium text-surface-700 mb-1">Nom et prénom</label>
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
        {dateAffichee && (
          <p className="text-xs text-surface-400 mt-2">
            Le certificat sera daté du {formatDate(dateAffichee, { day: 'numeric', month: 'long', year: 'numeric' })} (dernier jour de la formation).
          </p>
        )}

        {err && (
          <div className="mt-4 rounded-xl bg-danger-50 border border-danger-200 px-4 py-3 text-sm text-danger-700">{err}</div>
        )}

        <Button className="w-full mt-5" onClick={submit} isLoading={saving} icon={<CheckCircle2 className="h-4 w-4" />}>
          {estEmployeur ? "Signer l'attestation" : 'Signer mon certificat'}
        </Button>
        <p className="text-2xs text-surface-400 mt-3 text-center">
          {estEmployeur
            ? 'En signant, vous attestez, en qualité de représentant de l\u2019employeur, l\u2019exactitude des informations portées sur les attestations de développement de compétences des candidats du projet.'
            : 'En signant, vous attestez avoir suivi la formation mentionnée ci-dessus.'}
        </p>
      </div>
    </div>
  )
}
