'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Landmark, KeyRound, Eye, EyeOff, Pencil, Check, Copy, Loader2 } from '@/components/ui/icons'
import { Button, Input, Select, useToast } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import {
  OPCO_COMPTE_STATUS_LABELS, OPCO_COMPTE_STATUS_STYLES, libelleCompteOpco, type OpcoCompteStatus,
} from '@/lib/opco-compte'
import { setClientCompteOpcoAction, revealClientOpcoPasswordAction } from '../actions'

interface Props {
  clientId: string
  opcoNom: string | null
  status: OpcoCompteStatus | null
  date: string | null
  identifiant: string | null
  /** Un mot de passe est enregistré (chiffré côté serveur). */
  aMotDePasse: boolean
  peutModifier: boolean
}

const STATUTS = Object.keys(OPCO_COMPTE_STATUS_LABELS) as OpcoCompteStatus[]

/**
 * Compte OPCO du client : où en est l'ouverture du compte (courrier, validation,
 * actif), depuis quand, et les identifiants du portail. Le mot de passe est
 * chiffré en base et ne s'affiche qu'à la demande, pour les rôles autorisés,
 * avec une trace dans le journal d'audit.
 */
export function ClientCompteOpco({ clientId, opcoNom, status, date, identifiant, aMotDePasse, peutModifier }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const etat: OpcoCompteStatus = status || 'aucun'
  const reactivation = etat === 'inactif'

  const formDepuisProps = () => ({ status: etat, date: date || '', identifiant: identifiant || '', mot_de_passe: '', effacerMdp: false })
  const [edition, setEdition] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(formDepuisProps)
  const [voirSaisie, setVoirSaisie] = useState(false)

  const [mdpRevele, setMdpRevele] = useState<string | null>(null)
  const [revelation, setRevelation] = useState(false)

  function ouvrirEdition() { setForm(formDepuisProps()); setVoirSaisie(false); setEdition(true) }

  function retourEtat(r: { success: boolean; error?: string; data?: any }, message: string) {
    if (!r.success) { toast('error', r.error || 'Erreur'); return false }
    if (r.data?.partiel) toast('warning', `${message}. Date et identifiant attendent la migration 154.`)
    else toast('success', message)
    return true
  }

  async function enregistrerEtat() {
    setSaving(true)
    const r = await setClientCompteOpcoAction(clientId, {
      status: form.status,
      // Date vidée dans le formulaire : effacée (null) ; renseignée : enregistrée
      date: form.date || null,
      identifiant: form.identifiant || null,
      // Champ laissé vide ou blanc : mot de passe inchangé, sauf demande d'effacement
      mot_de_passe: form.effacerMdp ? '' : (form.mot_de_passe.trim() ? form.mot_de_passe : undefined),
    })
    setSaving(false)
    if (retourEtat(r, 'Compte OPCO mis à jour')) { setEdition(false); setMdpRevele(null); router.refresh() }
  }

  async function marquerCree() {
    setSaving(true)
    const aujourdhui = new Date().toISOString().slice(0, 10)
    const r = await setClientCompteOpcoAction(clientId, {
      status: 'actif',
      // Un compte réactivé garde sa date de création d'origine
      date: reactivation ? (date || aujourdhui) : aujourdhui,
      identifiant: identifiant || null,
    })
    setSaving(false)
    if (retourEtat(r, reactivation ? `Compte ${opcoNom || 'OPCO'} réactivé` : `Compte ${opcoNom || 'OPCO'} marqué actif à ce jour`)) router.refresh()
  }

  async function revelerMdp() {
    if (mdpRevele) { setMdpRevele(null); return }
    setRevelation(true)
    const r = await revealClientOpcoPasswordAction(clientId)
    setRevelation(false)
    if (r.success && r.data) setMdpRevele(r.data.mot_de_passe)
    else toast('error', r.error || 'Erreur')
  }

  function copier(texte: string) {
    navigator.clipboard?.writeText(texte)
    toast('success', 'Copié')
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Compte {opcoNom || 'OPCO'}</div>
        {peutModifier && !edition && (
          <button type="button" onClick={ouvrirEdition} className="h-10 w-10 -my-3 -mr-3 flex items-center justify-center rounded-lg text-surface-400 hover:text-surface-700 hover:bg-surface-100" title="Modifier le compte">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {!edition ? (
        <div className="mt-2.5 space-y-2.5">
          <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${OPCO_COMPTE_STATUS_STYLES[etat]}`}>
            <Landmark className="h-3.5 w-3.5" />
            {libelleCompteOpco(etat, opcoNom)}
          </span>
          <div className="text-sm text-surface-700">
            {date
              ? `${etat === 'actif' ? 'Créé le' : 'Depuis le'} ${formatDate(date)}`
              : etat === 'aucun' ? 'Aucun compte ouvert pour cet établissement.' : 'Date non renseignée.'}
          </div>

          {(identifiant || aMotDePasse) && (
            <div className="rounded-xl border border-surface-200 divide-y divide-surface-100 text-sm">
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="text-xs text-surface-500 w-20 sm:w-24 shrink-0">Identifiant</span>
                <span className="font-mono text-surface-900 flex-1 min-w-0 truncate">{identifiant || <span className="text-surface-400 font-sans">non renseigné</span>}</span>
                {identifiant && (
                  <button type="button" onClick={() => copier(identifiant)} className="h-10 w-10 -my-2 -mr-2 flex items-center justify-center rounded-lg text-surface-400 hover:text-surface-700 hover:bg-surface-100 shrink-0" title="Copier">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="text-xs text-surface-500 w-20 sm:w-24 shrink-0">Mot de passe</span>
                <span className="font-mono text-surface-900 flex-1 min-w-0 truncate">
                  {!aMotDePasse ? <span className="text-surface-400 font-sans">non renseigné</span> : mdpRevele ?? '••••••••••'}
                </span>
                {aMotDePasse && peutModifier && (
                  <>
                    <button type="button" onClick={revelerMdp} disabled={revelation} className="h-10 w-10 -my-2 -mr-2 flex items-center justify-center rounded-lg text-surface-400 hover:text-surface-700 hover:bg-surface-100 shrink-0" title={mdpRevele ? 'Masquer' : 'Afficher'}>
                      {revelation ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : mdpRevele ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    {mdpRevele && (
                      <button type="button" onClick={() => copier(mdpRevele)} className="h-10 w-10 -my-2 -mr-2 flex items-center justify-center rounded-lg text-surface-400 hover:text-surface-700 hover:bg-surface-100 shrink-0" title="Copier">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {peutModifier && etat !== 'actif' && (
            <Button size="sm" variant="secondary" onClick={marquerCree} isLoading={saving} icon={<Check className="h-4 w-4" />}>
              {reactivation ? 'Réactiver le compte' : 'Compte créé aujourd’hui'}
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <Select
            id="opco_compte_status" label="État du compte" value={form.status}
            onChange={(e) => {
              const status = e.target.value as OpcoCompteStatus
              // La date suit l'état : nouvel état, date du jour proposée ; retour à l'état courant, date d'origine
              setForm({ ...form, status, date: status !== etat ? new Date().toISOString().slice(0, 10) : (date || '') })
            }}
            options={STATUTS.map((s) => ({ value: s, label: OPCO_COMPTE_STATUS_LABELS[s] }))}
          />
          <Input id="opco_compte_date" type="date" label="Date de l'état (création du compte)" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Input id="opco_compte_identifiant" label="Identifiant de connexion" placeholder="Email ou SIRET utilisé sur le portail" value={form.identifiant} onChange={(e) => setForm({ ...form, identifiant: e.target.value })} />
          <div>
            <div className="relative">
              <Input
                id="opco_compte_mdp" label="Mot de passe" type={voirSaisie ? 'text' : 'password'} autoComplete="new-password"
                placeholder={aMotDePasse && !form.effacerMdp ? 'Inchangé (laisser vide)' : 'Mot de passe du portail'}
                value={form.mot_de_passe} disabled={form.effacerMdp}
                onChange={(e) => setForm({ ...form, mot_de_passe: e.target.value })}
              />
              <button type="button" onClick={() => setVoirSaisie(!voirSaisie)} className="absolute right-0.5 bottom-0.5 h-10 w-10 flex items-center justify-center rounded-lg text-surface-400 hover:text-surface-700" title={voirSaisie ? 'Masquer' : 'Voir'}>
                {voirSaisie ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-surface-500 mt-1 inline-flex items-center gap-1">
              <KeyRound className="h-3 w-3" /> Chiffré en base, lisible seulement depuis cette fiche par les rôles autorisés.
            </p>
            {aMotDePasse && (
              <label className="mt-1.5 flex items-center gap-2 text-xs text-surface-600 cursor-pointer">
                <input type="checkbox" checked={form.effacerMdp} onChange={(e) => setForm({ ...form, effacerMdp: e.target.checked, mot_de_passe: '' })} className="rounded border-surface-300" />
                Effacer le mot de passe enregistré
              </label>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => { setEdition(false); setForm(formDepuisProps()) }}>Annuler</Button>
            <Button size="sm" onClick={enregistrerEtat} isLoading={saving}>Enregistrer</Button>
          </div>
        </div>
      )}
    </div>
  )
}
