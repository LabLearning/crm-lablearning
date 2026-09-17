'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Landmark, KeyRound, Eye, EyeOff, Trash2, Pencil, Check, Copy, ExternalLink } from '@/components/ui/icons'
import { Button, Input, Select, Modal, useToast } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import {
  OPCO_COMPTE_STATUS_LABELS, OPCO_COMPTE_STATUS_STYLES, libelleCompteOpco, type OpcoCompteStatus,
} from '@/lib/opco-compte'
import {
  setClientCompteOpcoAction, saveClientOpcoSecretAction, revealClientOpcoSecretAction, deleteClientOpcoSecretAction,
} from '../actions'

interface Props {
  clientId: string
  opcoNom: string | null
  status: OpcoCompteStatus | null
  date: string | null
  identifiant: string | null
  /** Des identifiants chiffrés existent dans le coffre. */
  aCoffre: boolean
  indice: string | null
  peutModifier: boolean
}

const STATUTS = Object.keys(OPCO_COMPTE_STATUS_LABELS) as OpcoCompteStatus[]

/**
 * Compte OPCO du client : où en est l'ouverture du compte (courrier, validation,
 * actif), depuis quand, avec quel identifiant. Le mot de passe du portail vit
 * dans un coffre chiffré par une phrase secrète connue de l'équipe, jamais
 * stockée : sans elle, personne ne le relit, pas même la base.
 */
export function ClientCompteOpco({ clientId, opcoNom, status, date, identifiant, aCoffre, indice, peutModifier }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const etat: OpcoCompteStatus = status || 'aucun'

  const [edition, setEdition] = useState(false)
  const [saving, setSaving] = useState(false)
  const formDepuisProps = () => ({ status: etat, date: date || '', identifiant: identifiant || '' })
  const [form, setForm] = useState(formDepuisProps)
  function ouvrirEdition() { setForm(formDepuisProps()); setEdition(true) }
  const reactivation = etat === 'inactif'

  const [coffreOuvert, setCoffreOuvert] = useState<'enregistrer' | 'afficher' | 'supprimer' | null>(null)
  const [phrase, setPhrase] = useState('')
  const [secret, setSecret] = useState({ identifiant: identifiant || '', mot_de_passe: '', url: '', notes: '', indice: '' })
  const [revele, setRevele] = useState<any>(null)
  const [voirMdp, setVoirMdp] = useState(false)
  const [busy, setBusy] = useState(false)

  function retourEtat(r: { success: boolean; error?: string; data?: any }, message: string) {
    if (!r.success) { toast('error', r.error || 'Erreur'); return false }
    if (r.data?.partiel) toast('warning', `${message}. Date et identifiant attendent la migration 154.`)
    else toast('success', message)
    return true
  }

  async function enregistrerEtat() {
    setSaving(true)
    const r = await setClientCompteOpcoAction(clientId, { status: form.status, date: form.date || null, identifiant: form.identifiant || null })
    setSaving(false)
    if (retourEtat(r, 'Compte OPCO mis à jour')) { setEdition(false); router.refresh() }
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

  async function coffreEnregistrer() {
    setBusy(true)
    const r = await saveClientOpcoSecretAction(clientId, secret, phrase, secret.indice || undefined)
    if (!r.success) { setBusy(false); toast('error', r.error || 'Erreur'); return }
    // L'identifiant saisi ici est aussi repris en clair sur la fiche
    let avertissement: string | null = null
    if (secret.identifiant && secret.identifiant !== identifiant) {
      const r2 = await setClientCompteOpcoAction(clientId, { status: etat, date: date || null, identifiant: secret.identifiant })
      if (!r2.success) avertissement = r2.error || "L'identifiant n'a pas pu être repris sur la fiche"
      else if ((r2.data as any)?.partiel) avertissement = "L'identifiant en clair attend la migration 154"
    }
    setBusy(false)
    if (avertissement) toast('warning', `Mot de passe enregistré dans le coffre. ${avertissement}`)
    else toast('success', 'Identifiants enregistrés dans le coffre')
    fermerCoffre(); router.refresh()
  }

  async function coffreAfficher() {
    setBusy(true)
    const r = await revealClientOpcoSecretAction(clientId, phrase)
    setBusy(false)
    if (r.success) setRevele(r.data)
    else toast('error', r.error || 'Erreur')
  }

  async function coffreSupprimer() {
    setBusy(true)
    const r = await deleteClientOpcoSecretAction(clientId, phrase)
    setBusy(false)
    if (r.success) { toast('success', 'Identifiants supprimés'); fermerCoffre(); router.refresh() }
    else toast('error', r.error || 'Erreur')
  }

  function fermerCoffre() {
    setCoffreOuvert(null); setPhrase(''); setRevele(null); setVoirMdp(false)
    setSecret({ identifiant: identifiant || '', mot_de_passe: '', url: '', notes: '', indice: '' })
  }

  function copier(texte: string) {
    navigator.clipboard?.writeText(texte)
    toast('success', 'Copié')
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Compte {opcoNom || 'OPCO'}</div>
        {peutModifier && !edition && (
          <button type="button" onClick={ouvrirEdition} className="text-surface-400 hover:text-surface-700" title="Modifier l'état du compte">
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
          {identifiant && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-surface-500">Identifiant</span>
              <span className="font-mono text-surface-900">{identifiant}</span>
              <button type="button" onClick={() => copier(identifiant)} className="text-surface-400 hover:text-surface-700" title="Copier">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {peutModifier && etat !== 'actif' && (
            <Button size="sm" variant="secondary" onClick={marquerCree} isLoading={saving} icon={<Check className="h-4 w-4" />}>
              {reactivation ? 'Réactiver le compte' : 'Compte créé aujourd\u2019hui'}
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
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => { setEdition(false); setForm(formDepuisProps()) }}>Annuler</Button>
            <Button size="sm" onClick={enregistrerEtat} isLoading={saving}>Enregistrer</Button>
          </div>
        </div>
      )}

      {/* Coffre : mot de passe du portail */}
      {peutModifier && (
        <div className="mt-4 pt-3 border-t border-surface-100">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs text-surface-500 inline-flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" />
              {aCoffre ? 'Mot de passe du portail dans le coffre chiffré' : 'Aucun mot de passe enregistré'}
            </div>
            <div className="flex items-center gap-1.5">
              {aCoffre ? (
                <>
                  <button type="button" onClick={() => setCoffreOuvert('afficher')} className="text-xs font-medium text-brand-600 hover:underline">Afficher</button>
                  <span className="text-surface-300">·</span>
                  <button type="button" onClick={() => setCoffreOuvert('enregistrer')} className="text-xs font-medium text-brand-600 hover:underline">Remplacer</button>
                  <span className="text-surface-300">·</span>
                  <button type="button" onClick={() => setCoffreOuvert('supprimer')} className="text-xs font-medium text-danger-600 hover:underline">Supprimer</button>
                </>
              ) : (
                <button type="button" onClick={() => setCoffreOuvert('enregistrer')} className="text-xs font-medium text-brand-600 hover:underline">Enregistrer les identifiants</button>
              )}
            </div>
          </div>
        </div>
      )}

      <Modal isOpen={coffreOuvert === 'enregistrer'} onClose={fermerCoffre} size="md" title="Identifiants du portail OPCO"
        description="Chiffrés avec une phrase secrète que vous choisissez et qui n'est jamais stockée : sans elle, impossible de les relire.">
        <div className="space-y-3">
          <Input id="secret_identifiant" label="Identifiant" value={secret.identifiant} onChange={(e) => setSecret({ ...secret, identifiant: e.target.value })} />
          <Input id="secret_mdp" label="Mot de passe" type={voirMdp ? 'text' : 'password'} value={secret.mot_de_passe} onChange={(e) => setSecret({ ...secret, mot_de_passe: e.target.value })} />
          <Input id="secret_url" label="Adresse du portail" placeholder="https://" value={secret.url} onChange={(e) => setSecret({ ...secret, url: e.target.value })} />
          <Input id="secret_notes" label="Notes" placeholder="Question secrète, référent AKTO…" value={secret.notes} onChange={(e) => setSecret({ ...secret, notes: e.target.value })} />
          <div className="rounded-xl border border-surface-200 bg-surface-50 p-3 space-y-3">
            <Input id="secret_phrase" label="Phrase secrète de l'équipe" type="password" value={phrase} onChange={(e) => setPhrase(e.target.value)} />
            <Input id="secret_indice" label="Indice pour la retrouver (facultatif)" value={secret.indice} onChange={(e) => setSecret({ ...secret, indice: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={fermerCoffre}>Annuler</Button>
            <Button onClick={coffreEnregistrer} isLoading={busy} disabled={!phrase}>Enregistrer</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={coffreOuvert === 'afficher'} onClose={fermerCoffre} size="md" title="Identifiants du portail OPCO"
        description={indice ? `Indice : ${indice}` : undefined}>
        {!revele ? (
          <div className="space-y-3">
            <Input id="phrase_afficher" label="Phrase secrète de l'équipe" type="password" value={phrase} onChange={(e) => setPhrase(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && phrase) coffreAfficher() }} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={fermerCoffre}>Annuler</Button>
              <Button onClick={coffreAfficher} isLoading={busy} disabled={!phrase} icon={<Eye className="h-4 w-4" />}>Afficher</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {[
              ['Identifiant', revele.identifiant],
              ['Mot de passe', revele.mot_de_passe],
              ['Portail', revele.url],
              ['Notes', revele.notes],
            ].filter(([, v]) => v).map(([label, valeur]) => (
              <div key={label} className="flex items-center gap-2 rounded-xl border border-surface-200 px-3 py-2">
                <span className="text-xs text-surface-500 w-24 shrink-0">{label}</span>
                <span className="font-mono text-sm text-surface-900 flex-1 min-w-0 truncate">
                  {label === 'Mot de passe' && !voirMdp ? '••••••••••' : String(valeur)}
                </span>
                {label === 'Mot de passe' && (
                  <button type="button" onClick={() => setVoirMdp(!voirMdp)} className="text-surface-400 hover:text-surface-700" title={voirMdp ? 'Masquer' : 'Voir'}>
                    {voirMdp ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                )}
                {label === 'Portail' ? (
                  <a href={String(valeur)} target="_blank" rel="noreferrer" className="text-surface-400 hover:text-surface-700" title="Ouvrir">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : (
                  <button type="button" onClick={() => copier(String(valeur))} className="text-surface-400 hover:text-surface-700" title="Copier">
                    <Copy className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <div className="flex justify-end"><Button variant="secondary" onClick={fermerCoffre}>Fermer</Button></div>
          </div>
        )}
      </Modal>

      <Modal isOpen={coffreOuvert === 'supprimer'} onClose={fermerCoffre} size="sm" title="Supprimer les identifiants"
        description="La phrase secrète est demandée pour prouver l'accès. Cette suppression est définitive.">
        <div className="space-y-3">
          <Input id="phrase_supprimer" label="Phrase secrète de l'équipe" type="password" value={phrase} onChange={(e) => setPhrase(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={fermerCoffre}>Annuler</Button>
            <Button variant="danger" onClick={coffreSupprimer} isLoading={busy} disabled={!phrase} icon={<Trash2 className="h-4 w-4" />}>Supprimer</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
