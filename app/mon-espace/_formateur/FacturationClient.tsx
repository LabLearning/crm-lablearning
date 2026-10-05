'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ReceiptEuro, Plus, Paperclip, Loader2, Download, Trash2, CheckCircle2, Clock, XCircle, Calendar, Building2, FileText, Eye, Check } from '@/components/ui/icons'
import { Modal, Button, Input, useToast } from '@/components/ui'
import { formatDate, companyLabel } from '@/lib/utils'
import { submitFactureFormateurAction, deleteFactureFormateurAction, updateFactureModeleAction } from './facturation-actions'
import { FACTURE_MODELES } from '@/lib/pdf/facture-modeles'
import { dureeFr, type DetailPrestation } from '@/lib/facture-formateur-detail'

const STATUT: Record<string, { label: string; cls: string; Icon: any }> = {
  brouillon: { label: 'Brouillon', cls: 'bg-surface-100 text-surface-600', Icon: FileText },
  envoyee: { label: 'En attente de validation', cls: 'bg-amber-50 text-amber-700', Icon: Clock },
  validee: { label: 'Validée', cls: 'bg-sky-50 text-sky-700', Icon: CheckCircle2 },
  payee: { label: 'Payée', cls: 'bg-emerald-50 text-emerald-700', Icon: CheckCircle2 },
  rejetee: { label: 'Rejetée', cls: 'bg-danger-50 text-danger-700', Icon: XCircle },
}
const fmtMontant = (n: any) => `${Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

export function FacturationClient({ token, facturable, factures, fileUrls, details = {}, modele = 'epure' }: {
  token: string | null
  facturable: any[]
  factures: any[]
  fileUrls: Record<string, string>
  /** Détail de la prestation, par identifiant de facture. */
  details?: Record<string, DetailPrestation>
  modele?: string
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [modeleSel, setModeleSel] = useState(modele)
  const [savingModele, setSavingModele] = useState(false)

  async function chooseModele(v: string) {
    if (v === modeleSel) return
    const prev = modeleSel
    setModeleSel(v); setSavingModele(true)
    const r = await updateFactureModeleAction(v, token)
    setSavingModele(false)
    if (r.success) { toast('success', 'Modèle de facture mis à jour'); router.refresh() }
    else { setModeleSel(prev); toast('error', r.error || 'Erreur') }
  }
  const [preset, setPreset] = useState<{ sessionId?: string; montant?: number; objet?: string } | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [montantHt, setMontantHt] = useState(0)
  const [tauxTva, setTauxTva] = useState(0)

  const montantTva = Math.round(montantHt * (tauxTva / 100) * 100) / 100
  const montantTtc = Math.round((montantHt + montantTva) * 100) / 100

  function facturerSession(s: any) {
    const m = Number(s.cout_formateur) || 0
    setPreset({ sessionId: s.id, montant: m, objet: `Prestation de formation — ${s.formation?.intitule || s.reference}` })
    setMontantHt(m); setTauxTva(0); setFile(null); setOpen(true)
  }
  function factureLibre() { setPreset({}); setMontantHt(0); setTauxTva(0); setFile(null); setOpen(true) }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    if (token) fd.set('token', token)
    if (preset?.sessionId) fd.set('session_id', preset.sessionId)
    if (file) fd.set('file', file)
    const r = await submitFactureFormateurAction(fd)
    setLoading(false)
    if (r.success) { toast('success', 'Facture envoyée à Lab Learning'); setOpen(false); router.refresh() }
    else toast('error', r.error || 'Erreur')
  }

  async function remove(f: any) {
    if (!confirm(`Supprimer la facture ${f.numero || ''} ?`)) return
    const r = await deleteFactureFormateurAction(f.id, token)
    if (r.success) { toast('success', 'Facture supprimée'); router.refresh() }
    else toast('error', r.error || 'Erreur')
  }

  return (
    <div className="space-y-6">
      {/* Modèle de facture */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Modèle de mes factures</span>
          {savingModele && <Loader2 className="h-4 w-4 text-surface-400 animate-spin" />}
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {FACTURE_MODELES.map((m) => {
            const active = modeleSel === m.value
            return (
              <div key={m.value}
                className={`rounded-xl border p-3 cursor-pointer transition-colors ${active ? 'border-brand-500 bg-brand-50/40' : 'border-surface-200 hover:border-surface-300'}`}
                onClick={() => chooseModele(m.value)}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-surface-900">{m.label}</span>
                  {active && <span className="h-5 w-5 rounded-full bg-brand-500 flex items-center justify-center"><Check className="h-3 w-3 text-white" /></span>}
                </div>
                <p className="text-xs text-surface-500 mt-0.5">{m.description}</p>
                <a href={`/api/pdf/facture-modele-apercu?modele=${m.value}${token ? `&token=${encodeURIComponent(token)}` : ''}`}
                  target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-brand-600 hover:underline">
                  <Eye className="h-3.5 w-3.5" /> Aperçu
                </a>
              </div>
            )
          })}
        </div>
      </div>

      {/* À facturer */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">À facturer ({facturable.length})</span>
          <Button size="sm" variant="secondary" onClick={factureLibre} icon={<Plus className="h-4 w-4" />}>Facture libre</Button>
        </div>
        {facturable.length === 0 ? (
          <div className="text-center py-8 text-sm text-surface-400">Aucune session en attente de facturation.</div>
        ) : (
          <div className="divide-y divide-surface-100">
            {facturable.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-surface-900 truncate">{s.formation?.intitule || s.intitule || s.reference}</div>
                  <div className="text-xs text-surface-500 flex items-center gap-3 flex-wrap mt-0.5">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(s.date_debut, { day: 'numeric', month: 'short' })} → {formatDate(s.date_fin, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    {s.client?.raison_sociale && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{companyLabel(s.client)}</span>}
                  </div>
                </div>
                <div className="text-sm font-bold shrink-0 text-surface-900">
                  {Number(s.cout_formateur) > 0
                    ? fmtMontant(s.cout_formateur)
                    : <span className="text-xs font-medium text-surface-400">Montant à définir</span>}
                </div>
                <Button size="sm" onClick={() => facturerSession(s)} icon={<ReceiptEuro className="h-4 w-4" />}>Facturer</Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mes factures */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-100">
          <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Mes factures ({factures.length})</span>
        </div>
        {factures.length === 0 ? (
          <div className="text-center py-8 text-sm text-surface-400">Aucune facture envoyée pour le moment.</div>
        ) : (
          <div className="divide-y divide-surface-100">
            {factures.map((f) => {
              const st = STATUT[f.status] || STATUT.envoyee
              const d = details[f.id]
              return (
                <div key={f.id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-surface-900 truncate">
                        {f.objet || f.session?.reference || f.numero || 'Facture'}
                        {f.reference_externe && <span className="text-surface-400 font-normal"> · {f.reference_externe}</span>}
                      </div>
                      <div className="text-xs text-surface-500 mt-0.5">{f.numero} · émise le {formatDate(f.date_emission || f.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    </div>
                    <div className="text-sm font-bold text-surface-900 shrink-0">{fmtMontant(f.montant_ttc)}</div>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${st.cls}`}>
                      <st.Icon className="h-3 w-3" /> {st.label}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={(f.fichier_url && fileUrls[f.fichier_url]) ? fileUrls[f.fichier_url] : `/api/pdf/facture-formateur/${f.id}${token ? `?token=${encodeURIComponent(token)}` : ''}`}
                        target="_blank" rel="noreferrer" title="Télécharger la facture"
                        className="h-8 w-8 flex items-center justify-center rounded-lg text-surface-500 hover:bg-surface-100">
                        <Download className="h-4 w-4" />
                      </a>
                      {!['validee', 'payee'].includes(f.status) && (
                        <button onClick={() => remove(f)} title="Supprimer" className="h-8 w-8 flex items-center justify-center rounded-lg text-surface-400 hover:bg-danger-50 hover:text-danger-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {d && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-surface-500">
                      {d.periode && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{d.periode}{dureeFr(d) ? ` · ${dureeFr(d)}` : ''}</span>}
                      {d.client && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{d.client}{d.clientVille ? `, ${d.clientVille}` : ''}</span>}
                      {d.reference && <span className="font-mono text-[11px] text-surface-400">{d.reference}</span>}
                    </div>
                  )}
                  {f.status === 'rejetee' && f.motif_rejet && (
                    <div className="mt-1.5 text-xs text-danger-600">Motif du rejet : {f.motif_rejet}</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal facturation */}
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Envoyer une facture" size="md">
        <form onSubmit={submit} className="space-y-4">
          <Input id="objet" name="objet" label="Objet" defaultValue={preset?.objet || ''} placeholder="Prestation de formation…" />
          <div className="grid grid-cols-2 gap-3">
            <Input id="montant_ht" name="montant_ht" type="number" step="0.01" label="Montant HT (€) *"
              defaultValue={preset?.montant ? String(preset.montant) : ''}
              onChange={(e) => setMontantHt(Number((e.target.value || '0').replace(',', '.')) || 0)} />
            <Input id="taux_tva" name="taux_tva" type="number" step="0.01" label="Taux TVA (%)" defaultValue="0"
              onChange={(e) => setTauxTva(Number((e.target.value || '0').replace(',', '.')) || 0)} />
          </div>
          {/* Récapitulatif en euros — mis à jour en direct */}
          <div className="rounded-xl bg-surface-50 border border-surface-100 px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between text-sm text-surface-600"><span>Total HT</span><span className="font-medium text-surface-800">{fmtMontant(montantHt)}</span></div>
            <div className="flex items-center justify-between text-sm text-surface-600"><span>TVA ({tauxTva}%)</span><span className="font-medium text-surface-800">{fmtMontant(montantTva)}</span></div>
            <div className="flex items-center justify-between text-base font-bold text-surface-900 pt-1.5 border-t border-surface-200"><span>Total TTC</span><span>{fmtMontant(montantTtc)}</span></div>
          </div>
          <Input id="reference_externe" name="reference_externe" label="Votre n° de facture" placeholder="Votre numérotation (optionnel)" />
          <label className="flex items-center gap-2 rounded-xl border border-dashed border-surface-300 bg-surface-50/60 px-3 py-2.5 text-sm text-surface-500 cursor-pointer hover:border-brand-300 transition-colors">
            <Paperclip className="h-4 w-4 shrink-0" />
            <span className="truncate">{file ? file.name : 'Joindre votre facture PDF (recommandé)'}</span>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          <div className="flex justify-end gap-3 pt-2 border-t border-surface-100">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" isLoading={loading} icon={<ReceiptEuro className="h-4 w-4" />}>Envoyer à Lab Learning</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
