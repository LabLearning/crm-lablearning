'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCap, Plus, Trash2, Loader2, CalendarCheck, CalendarClock, Presentation, ArrowRight, FileSignature, Users, MapPin } from 'lucide-react'
import { Button, Badge, Select, useToast } from '@/components/ui'
import {
  getLeadFormationsAction, addLeadFormationAction, deleteLeadFormationAction,
  confirmLeadFormationDateAction, proposeLeadFormationDateAction,
  setLeadFormationParticipantsAction, generateConventionForFormationAction,
  getLeadParticipantsAction, addLeadParticipantAction,
} from './actions'
import { Input } from '@/components/ui'
import { formatDate } from '@/lib/utils'

const MANAGER_ROLES = ['super_admin', 'gestionnaire', 'directeur_commercial']
const PLANIF_LABELS: Record<string, string> = { a_planifier: 'À planifier', date_confirmee: 'Date confirmée', autre_date_proposee: 'Autre date proposée', convention_generee: 'Convention générée' }
const PLANIF_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'info'> = { a_planifier: 'warning', date_confirmee: 'success', autre_date_proposee: 'default', convention_generee: 'info' }

interface CatalogFormation { id: string; intitule: string }
interface Formateur { id: string; prenom: string; nom: string; zone_intervention?: string | null }
interface Participant { id: string; prenom: string | null; nom: string }
interface LeadFormation {
  id: string; formation_id: string | null; date_souhaitee: string | null; date_confirmee: string | null
  formateur_id: string | null; session_id: string | null; convention_id: string | null; planification_status: string | null
  lieu: string | null
  formation?: { intitule: string | null } | null
  assignments?: { lead_participant_id: string }[]
}

export function LeadFormationsCard({ leadId, catalog, formateurs, currentUserRole, companyAddress }: {
  leadId: string; catalog: CatalogFormation[]; formateurs: Formateur[]; currentUserRole: string; companyAddress?: string
}) {
  const { toast } = useToast()
  const [formations, setFormations] = useState<LeadFormation[]>([])
  const [pool, setPool] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [adding, setAdding] = useState(false)
  const isManager = MANAGER_ROLES.includes(currentUserRole)

  useEffect(() => {
    let active = true
    Promise.all([getLeadFormationsAction(leadId), getLeadParticipantsAction(leadId)]).then(([f, p]) => {
      if (!active) return
      if (f.success) setFormations((f.data as LeadFormation[]) || [])
      if (p.success) setPool((p.data as Participant[]) || [])
      setLoading(false)
    })
    return () => { active = false }
  }, [leadId])

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setAdding(true)
    const res = await addLeadFormationAction(leadId, new FormData(e.currentTarget))
    if (res.success && res.data) { setFormations((f) => [...f, res.data as LeadFormation]); setShowAdd(false); toast('success', 'Formation ajoutée') }
    else toast('error', res.error || 'Erreur')
    setAdding(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Retirer cette formation du lead ?')) return
    const res = await deleteLeadFormationAction(id)
    if (res.success) setFormations((f) => f.filter((x) => x.id !== id))
    else toast('error', res.error || 'Erreur')
  }

  function updateOne(updated: LeadFormation) {
    setFormations((list) => list.map((x) => x.id === updated.id ? updated : x))
  }

  // Ajoute un participant au pool (depuis une formation) et le retourne
  async function addPoolParticipant(fd: FormData): Promise<Participant | null> {
    const res = await addLeadParticipantAction(leadId, fd)
    if (res.success && res.data) {
      const np = res.data as Participant
      setPool((p) => [...p, np])
      return np
    }
    toast('error', res.error || 'Erreur')
    return null
  }

  const catalogOptions = [{ value: '', label: '— Choisir une formation —' }, ...catalog.map((c) => ({ value: c.id, label: c.intitule }))]

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-brand-500 shrink-0" />
          <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Formations demandées <span className="text-surface-400">({formations.length})</span></span>
        </div>
        {!showAdd && <Button size="sm" variant="secondary" onClick={() => setShowAdd(true)} icon={<Plus className="h-3.5 w-3.5" />}>Ajouter</Button>}
      </div>

      {companyAddress && (
        <div className="flex items-start gap-1.5 text-xs text-surface-500 rounded-lg bg-surface-50 px-3 py-2">
          <MapPin className="h-3.5 w-3.5 text-surface-400 shrink-0 mt-0.5" />
          <span>Adresse société : <strong className="text-surface-700">{companyAddress}</strong> — utile pour choisir un formateur proche.</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-surface-400 py-2"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
      ) : (
        <>
          {formations.length === 0 && !showAdd && (
            <p className="text-xs text-surface-400">Aucune formation. Ajoutez les formations souhaitées par le client — chacune aura sa session et sa convention.</p>
          )}

          <div className="space-y-2.5">
            {formations.map((lf) => (
              <FormationRow key={lf.id} lf={lf} pool={pool} formateurs={formateurs} isManager={isManager}
                onChange={updateOne} onDelete={() => handleDelete(lf.id)} onAddParticipant={addPoolParticipant} />
            ))}
          </div>

          {showAdd && (
            <form onSubmit={handleAdd} className="rounded-xl bg-surface-50 p-3 space-y-2.5">
              <Select name="formation_id" label="Formation" options={catalogOptions} />
              <div>
                <label className="block text-2xs text-surface-400 mb-0.5">Date souhaitée</label>
                <input type="date" name="date_souhaitee" className="input-base w-full" />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => setShowAdd(false)}>Annuler</Button>
                <Button type="submit" size="sm" isLoading={adding}>Ajouter</Button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  )
}

function FormationRow({ lf, pool, formateurs, isManager, onChange, onDelete, onAddParticipant }: {
  lf: LeadFormation; pool: Participant[]; formateurs: Formateur[]; isManager: boolean
  onChange: (lf: LeadFormation) => void; onDelete: () => void
  onAddParticipant: (fd: FormData) => Promise<Participant | null>
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [date, setDate] = useState(lf.date_confirmee || lf.date_souhaitee || '')
  const [formateurId, setFormateurId] = useState(lf.formateur_id || '')
  const [busy, setBusy] = useState<string | null>(null)
  const [assigned, setAssigned] = useState<Set<string>>(new Set((lf.assignments || []).map((a) => a.lead_participant_id)))
  const [showAddPart, setShowAddPart] = useState(false)
  const [addingPart, setAddingPart] = useState(false)

  async function quickAddParticipant(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setAddingPart(true)
    const np = await onAddParticipant(new FormData(e.currentTarget))
    if (np) {
      const next = new Set(assigned); next.add(np.id); setAssigned(next)
      await setLeadFormationParticipantsAction(lf.id, Array.from(next))
      setShowAddPart(false)
    }
    setAddingPart(false)
  }

  const status = lf.planification_status || 'a_planifier'
  const confirmed = (status === 'date_confirmee' || status === 'convention_generee') && !!lf.session_id
  const conventionGenerated = status === 'convention_generee' || !!lf.convention_id

  async function confirm() {
    if (!date) { toast('error', 'Choisissez une date'); return }
    if (!formateurId) { toast('error', 'Choisissez un formateur'); return }
    setBusy('confirm')
    const fd = new FormData(); fd.set('date', date); fd.set('formateur_id', formateurId)
    const res = await confirmLeadFormationDateAction(lf.id, fd)
    if (res.success) { toast('success', 'Date confirmée — session créée'); router.refresh() }
    else toast('error', res.error || 'Erreur')
    setBusy(null)
  }
  async function propose() {
    if (!date) { toast('error', 'Choisissez une date'); return }
    setBusy('propose')
    const fd = new FormData(); fd.set('date', date)
    const res = await proposeLeadFormationDateAction(lf.id, fd)
    if (res.success) { toast('success', 'Autre date proposée'); router.refresh() }
    else toast('error', res.error || 'Erreur')
    setBusy(null)
  }
  async function generate() {
    setBusy('gen')
    const res = await generateConventionForFormationAction(lf.id)
    if (res.success) { toast('success', 'Convention générée — client & inscriptions créés'); router.refresh() }
    else toast('error', res.error || 'Erreur')
    setBusy(null)
  }
  async function toggleParticipant(pid: string) {
    const next = new Set(assigned)
    if (next.has(pid)) next.delete(pid); else next.add(pid)
    setAssigned(next)
    await setLeadFormationParticipantsAction(lf.id, Array.from(next))
  }

  const formateurOptions = [{ value: '', label: '— Formateur —' }, ...formateurs.map((f) => ({ value: f.id, label: `${f.prenom} ${f.nom}${f.zone_intervention ? ` — ${f.zone_intervention}` : ''}` }))]

  return (
    <div className="rounded-xl border border-surface-200/70 p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-surface-900 truncate">{lf.formation?.intitule || 'Formation'}</div>
          {lf.date_souhaitee && <div className="text-2xs text-surface-400">Souhaitée : {formatDate(lf.date_souhaitee, { day: 'numeric', month: 'short', year: 'numeric' })}</div>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant={PLANIF_VARIANTS[status] || 'default'}>{PLANIF_LABELS[status] || status}</Badge>
          {!conventionGenerated && <button onClick={onDelete} className="text-surface-300 hover:text-danger-600" title="Retirer"><Trash2 className="h-3.5 w-3.5" /></button>}
        </div>
      </div>

      {/* Participants affectés à cette formation */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1 text-2xs text-surface-400"><Users className="h-3 w-3" /> Participants ({assigned.size})</div>
          {!conventionGenerated && (
            <button type="button" onClick={() => setShowAddPart((v) => !v)} className="text-2xs font-medium text-brand-600 hover:text-brand-700 inline-flex items-center gap-0.5">
              <Plus className="h-3 w-3" /> Ajouter
            </button>
          )}
        </div>
        {pool.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {pool.map((p) => {
              const on = assigned.has(p.id)
              return (
                <button key={p.id} type="button" disabled={conventionGenerated} onClick={() => toggleParticipant(p.id)}
                  className={`px-2 py-0.5 rounded-full text-2xs font-medium transition-colors ${on ? 'bg-brand-500 text-white' : 'bg-surface-100 text-surface-500 hover:bg-surface-200'} ${conventionGenerated ? 'opacity-60 cursor-default' : ''}`}>
                  {`${p.prenom || ''} ${p.nom}`.trim()}
                </button>
              )
            })}
          </div>
        ) : (
          !showAddPart && <p className="text-2xs text-surface-400">Aucun participant. Cliquez « Ajouter » pour en créer, ou saisissez-les dans « Participants prévus » puis cochez-les ici.</p>
        )}

        {showAddPart && (
          <form onSubmit={quickAddParticipant} className="mt-2 rounded-lg bg-surface-50 p-2 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Input name="prenom" placeholder="Prénom" />
              <Input name="nom" placeholder="Nom *" />
            </div>
            <Input name="email" type="email" placeholder="Email" />
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => setShowAddPart(false)}>Annuler</Button>
              <Button type="submit" size="sm" isLoading={addingPart}>Ajouter à cette formation</Button>
            </div>
            <p className="text-2xs text-surface-400">Détails complets (date de naissance, n° sécu…) modifiables dans « Participants prévus ».</p>
          </form>
        )}
      </div>

      {/* Planification */}
      {conventionGenerated ? (
        <a href="/dashboard/conventions" className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium">
          <FileSignature className="h-3.5 w-3.5" /> Convention générée <ArrowRight className="h-3 w-3" />
        </a>
      ) : confirmed ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-success-700">
            <CalendarCheck className="h-3.5 w-3.5 shrink-0" /> Session créée le {lf.date_confirmee ? formatDate(lf.date_confirmee, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
            <a href="/dashboard/sessions" className="text-brand-600 hover:text-brand-700 inline-flex items-center gap-0.5"><Presentation className="h-3 w-3" /> voir</a>
          </div>
          {isManager && (
            <Button size="sm" onClick={generate} isLoading={busy === 'gen'} icon={<FileSignature className="h-3.5 w-3.5" />}>
              Générer la convention &amp; convertir en client
            </Button>
          )}
        </div>
      ) : !isManager ? (
        <p className="text-xs text-surface-500">En attente de confirmation par un gestionnaire.</p>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 items-end">
            <div>
              <label className="block text-2xs text-surface-400 mb-0.5">Date de session</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-base w-full" />
            </div>
            <Select label="Formateur (zone)" options={formateurOptions} value={formateurId} onChange={(e) => setFormateurId(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={confirm} isLoading={busy === 'confirm'} icon={<CalendarCheck className="h-3.5 w-3.5" />}>Confirmer &amp; créer la session</Button>
            <Button size="sm" variant="secondary" onClick={propose} isLoading={busy === 'propose'} icon={<CalendarClock className="h-3.5 w-3.5" />}>Autre date</Button>
          </div>
        </div>
      )}
    </div>
  )
}
