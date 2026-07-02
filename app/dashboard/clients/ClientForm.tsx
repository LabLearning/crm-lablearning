'use client'

import { useState } from 'react'
import { Save, Award, GraduationCap, UserCircle, CheckCircle2, UserPlus } from 'lucide-react'
import { Button, Input, Select, CompanySearchInput, OpcoSelector } from '@/components/ui'
import { createClientAction, updateClientAction } from './actions'
import { createContactAction } from '../contacts/actions'
import { CLIENT_TYPE_LABELS, FINANCEUR_LABELS } from '@/lib/types/crm'
import type { Client } from '@/lib/types/crm'
import type { SireneCompany } from '@/lib/sirene'

interface ClientFormProps {
  client?: Client
  onSuccess: () => void
  onCancel: () => void
  users?: { id: string; first_name: string | null; last_name: string | null }[]
  canAssign?: boolean
}

const typeOptions = Object.entries(CLIENT_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))
const financeurOptions = [{ value: '', label: 'Aucun' }, ...Object.entries(FINANCEUR_LABELS).map(([v, l]) => ({ value: v, label: l }))]
const tailleOptions = [
  { value: '', label: 'Non renseignée' },
  { value: 'TPE', label: 'TPE (< 10 salariés)' },
  { value: 'PME', label: 'PME (10-249)' },
  { value: 'ETI', label: 'ETI (250-4999)' },
  { value: 'GE', label: 'Grande entreprise (5000+)' },
]

export function ClientForm({ client, onSuccess, onCancel, users = [], canAssign = false }: ClientFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [clientType, setClientType] = useState(client?.type || 'entreprise')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [error, setError] = useState<string | null>(null)
  // Étape référent (après création d'un client entreprise)
  const [step, setStep] = useState<'client' | 'referent'>('client')
  const [newClientId, setNewClientId] = useState<string | null>(null)

  // Champs entreprise contrôlés
  const [raisonSociale, setRaisonSociale] = useState(client?.raison_sociale || '')
  const [siret, setSiret] = useState(client?.siret || '')
  const [codeNaf, setCodeNaf] = useState(client?.code_naf || '')
  const [secteurActivite, setSecteurActivite] = useState(client?.secteur_activite || '')
  const [codeIdcc, setCodeIdcc] = useState(client?.code_idcc || '')
  const [tailleEntreprise, setTailleEntreprise] = useState(client?.taille_entreprise || '')
  const [adresse, setAdresse] = useState(client?.adresse || '')
  const [codePostal, setCodePostal] = useState(client?.code_postal || '')
  const [ville, setVille] = useState(client?.ville || '')
  // Nouveaux champs enrichis
  const [sigle, setSigle] = useState(client?.sigle || '')
  const [formeJuridique, setFormeJuridique] = useState(client?.forme_juridique || '')
  const [dateCreation, setDateCreation] = useState(client?.date_creation_entreprise || '')
  const [effectifLibelle, setEffectifLibelle] = useState(client?.effectif_libelle || '')
  const [tvaIntra, setTvaIntra] = useState(client?.tva_intra || '')
  const [estQualiopi, setEstQualiopi] = useState(client?.est_qualiopi || false)
  const [estOrgFormation, setEstOrgFormation] = useState(client?.est_organisme_formation || false)
  // Dirigeant (suggéré, créé comme contact à la sauvegarde)
  const [dirigeantPrenom, setDirigeantPrenom] = useState('')
  const [dirigeantNom, setDirigeantNom] = useState('')
  const [dirigeantQualite, setDirigeantQualite] = useState('')

  function handleCompanyClear() {
    // Reset les champs auto-remplis quand l'user retape par-dessus la sélection
    setSiret(''); setCodeNaf(''); setSecteurActivite(''); setCodeIdcc('')
    setTailleEntreprise(''); setSigle(''); setFormeJuridique(''); setDateCreation('')
    setEffectifLibelle(''); setTvaIntra('')
    setEstQualiopi(false); setEstOrgFormation(false)
    setAdresse(''); setCodePostal(''); setVille('')
    setDirigeantPrenom(''); setDirigeantNom(''); setDirigeantQualite('')
  }

  function handleCompanySelect(c: SireneCompany) {
    setRaisonSociale(c.raison_sociale)
    if (c.siret) setSiret(c.siret)
    if (c.code_naf) setCodeNaf(c.code_naf)
    if (c.libelle_naf) setSecteurActivite(c.libelle_naf)
    if (c.code_idcc) setCodeIdcc(c.code_idcc)
    if (c.taille_entreprise) setTailleEntreprise(c.taille_entreprise)
    if (c.adresse) setAdresse(c.adresse)
    if (c.code_postal) setCodePostal(c.code_postal)
    if (c.ville) setVille(c.ville)
    setSigle(c.sigle || '')
    setFormeJuridique(c.forme_juridique || '')
    setDateCreation(c.date_creation || '')
    setEffectifLibelle(c.effectif_libelle || '')
    setTvaIntra(c.tva_intra || '')
    setEstQualiopi(c.est_qualiopi)
    setEstOrgFormation(c.est_organisme_formation)
    if (c.dirigeant) {
      setDirigeantPrenom(c.dirigeant.prenom)
      setDirigeantNom(c.dirigeant.nom)
      setDirigeantQualite(c.dirigeant.qualite)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setFieldErrors({})
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.set('type', clientType)
    formData.set('est_qualiopi', estQualiopi ? 'true' : 'false')
    formData.set('est_organisme_formation', estOrgFormation ? 'true' : 'false')

    const result = client
      ? await updateClientAction(client.id, formData)
      : await createClientAction(formData)

    if (result.success) {
      // Création d'un client entreprise → enchaîner sur la création du référent
      if (!client && clientType === 'entreprise' && (result.data as any)?.id) {
        setNewClientId((result.data as any).id)
        setStep('referent')
        setIsLoading(false)
        return
      }
      onSuccess()
    } else if (result.errors) {
      setFieldErrors(result.errors)
    }
    if (result.error) {
      setError(result.error)
    }
    setIsLoading(false)
  }

  // Étape 2 : référent de l'entreprise (contact lié)
  if (step === 'referent' && newClientId) {
    return (
      <ReferentStep
        clientId={newClientId}
        companyName={raisonSociale}
        defaultPrenom={dirigeantPrenom}
        defaultNom={dirigeantNom}
        defaultPoste={dirigeantQualite}
        onDone={onSuccess}
      />
    )
  }

  const isNewClient = !client
  const showDirigeantSection = isNewClient && clientType === 'entreprise' && (dirigeantNom || dirigeantPrenom)

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-xl bg-danger-50 border border-danger-200 px-4 py-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      <Select
        id="type"
        name="type"
        label="Type de client *"
        options={typeOptions}
        value={clientType}
        onChange={(e) => setClientType(e.target.value as 'entreprise' | 'particulier')}
      />

      {canAssign && (
        <Select
          id="assigned_to"
          name="assigned_to"
          label="Assigné à"
          options={[
            { value: '', label: '— Non assigné —' },
            ...users.map((u) => ({ value: u.id, label: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Utilisateur' })),
          ]}
          defaultValue={client?.assigned_to || ''}
        />
      )}

      {clientType === 'entreprise' ? (
        <>
          <CompanySearchInput
            id="raison_sociale"
            name="raison_sociale"
            label="Raison sociale *"
            defaultValue={raisonSociale}
            error={fieldErrors.raison_sociale?.[0]}
            onSelect={handleCompanySelect}
            onClear={handleCompanyClear}
          />

          {/* Badges Qualiopi / Organisme formation */}
          {(estQualiopi || estOrgFormation) && (
            <div className="flex flex-wrap gap-2">
              {estQualiopi && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700">
                  <Award className="h-3 w-3" /> Certifié Qualiopi
                </span>
              )}
              {estOrgFormation && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-3 py-1 text-xs font-medium text-brand-700">
                  <GraduationCap className="h-3 w-3" /> Organisme de formation
                </span>
              )}
            </div>
          )}

          <input type="hidden" name="est_qualiopi" value={estQualiopi ? 'true' : 'false'} />
          <input type="hidden" name="est_organisme_formation" value={estOrgFormation ? 'true' : 'false'} />

          <div className="grid grid-cols-2 gap-4">
            <Input id="siret" name="siret" label="SIRET" value={siret} onChange={(e) => setSiret(e.target.value)} error={fieldErrors.siret?.[0]} placeholder="14 chiffres" />
            <Input id="sigle" name="sigle" label="Sigle" value={sigle} onChange={(e) => setSigle(e.target.value)} placeholder="Ex: SNCF" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input id="forme_juridique" name="forme_juridique" label="Forme juridique" value={formeJuridique} onChange={(e) => setFormeJuridique(e.target.value)} placeholder="SAS, SARL, SCI..." />
            <Input id="date_creation_entreprise" name="date_creation_entreprise" type="date" label="Date de création" value={dateCreation} onChange={(e) => setDateCreation(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input id="code_naf" name="code_naf" label="Code NAF" value={codeNaf} onChange={(e) => setCodeNaf(e.target.value)} />
            <Input id="tva_intra" name="tva_intra" label="N° TVA intracommunautaire" value={tvaIntra} onChange={(e) => setTvaIntra(e.target.value)} />
          </div>
          <Input id="secteur_activite" name="secteur_activite" label="Secteur d'activité" value={secteurActivite} onChange={(e) => setSecteurActivite(e.target.value)} />
          <div className="grid grid-cols-2 gap-4">
            <Select id="taille_entreprise" name="taille_entreprise" label="Taille" options={tailleOptions} value={tailleEntreprise} onChange={(e) => setTailleEntreprise(e.target.value)} />
            <Input id="effectif_libelle" name="effectif_libelle" label="Effectif" value={effectifLibelle} onChange={(e) => setEffectifLibelle(e.target.value)} placeholder="Ex: 10 à 19 salariés" />
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Select id="civilite" name="civilite" label="Civilité" options={[{ value: '', label: '—' }, { value: 'M.', label: 'M.' }, { value: 'Mme', label: 'Mme' }]} defaultValue={client?.civilite || ''} />
            <Input id="prenom" name="prenom" label="Prénom *" defaultValue={client?.prenom || ''} />
            <Input id="nom" name="nom" label="Nom *" defaultValue={client?.nom || ''} />
          </div>
        </>
      )}

      <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider pt-2">Coordonnées</div>

      <div className="grid grid-cols-2 gap-4">
        <Input id="email" name="email" type="email" label="Email" defaultValue={client?.email || ''} error={fieldErrors.email?.[0]} />
        <Input id="telephone" name="telephone" label="Téléphone" defaultValue={client?.telephone || ''} />
      </div>

      {/* WhatsApp */}
      <div className="rounded-xl border border-surface-200 p-3 bg-surface-50/40">
        <div className="flex items-center gap-2 mb-2">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-600" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.07z"/></svg>
          <span className="text-sm font-medium text-surface-800">WhatsApp</span>
        </div>
        <div className="grid grid-cols-2 gap-4 items-end">
          <Input id="whatsapp" name="whatsapp" label="Numéro WhatsApp" placeholder="06 12 34 56 78" defaultValue={client?.whatsapp || ''} />
          <label className="flex items-center gap-2 text-sm text-surface-700 pb-2.5 cursor-pointer">
            <input type="checkbox" name="whatsapp_opt_in" value="true" defaultChecked={client?.whatsapp_opt_in || false}
              className="h-4 w-4 rounded border-surface-300 text-emerald-600 focus:ring-emerald-500" />
            Accepte les rappels par WhatsApp
          </label>
        </div>
        <p className="text-[11px] text-surface-400 mt-1.5">Consentement requis (RGPD + Meta). Les rappels (convocation J-3, etc.) partiront aussi par WhatsApp si activé.</p>
      </div>

      <Input id="adresse" name="adresse" label="Adresse" value={adresse} onChange={(e) => setAdresse(e.target.value)} />
      <div className="grid grid-cols-2 gap-4">
        <Input id="code_postal" name="code_postal" label="Code postal" value={codePostal} onChange={(e) => setCodePostal(e.target.value)} />
        <Input id="ville" name="ville" label="Ville" value={ville} onChange={(e) => setVille(e.target.value)} />
      </div>

      <Input id="site_web" name="site_web" label="Site web" defaultValue={client?.site_web || ''} placeholder="https://" error={fieldErrors.site_web?.[0]} />

      {/* Section dirigeant — uniquement à la création, si l'API a retourné un dirigeant */}
      {showDirigeantSection && (
        <div className="rounded-xl bg-brand-50/50 border border-brand-200 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <UserCircle className="h-4 w-4 text-brand-600" />
            <div className="text-sm font-medium text-brand-900">Contact gérant (créé automatiquement)</div>
          </div>
          <div className="text-xs text-brand-700">Récupéré depuis Sirene. Tu peux modifier avant de sauvegarder ou laisser vide pour ne pas créer de contact.</div>
          <div className="grid grid-cols-3 gap-3">
            <Input id="dirigeant_prenom" name="dirigeant_prenom" label="Prénom" value={dirigeantPrenom} onChange={(e) => setDirigeantPrenom(e.target.value)} />
            <Input id="dirigeant_nom" name="dirigeant_nom" label="Nom" value={dirigeantNom} onChange={(e) => setDirigeantNom(e.target.value)} />
            <Input id="dirigeant_qualite" name="dirigeant_qualite" label="Qualité" value={dirigeantQualite} onChange={(e) => setDirigeantQualite(e.target.value)} placeholder="Gérant, Président..." />
          </div>
        </div>
      )}

      <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider pt-2">Financement</div>

      <Select id="financeur_type" name="financeur_type" label="Type de financeur" options={financeurOptions} defaultValue={client?.financeur_type || ''} />

      {clientType === 'entreprise' && (
        <>
          <Input
            id="code_idcc"
            name="code_idcc"
            label="Code IDCC (convention collective)"
            value={codeIdcc}
            onChange={(e) => setCodeIdcc(e.target.value)}
            placeholder="Ex: 1979 pour HCR"
            hint="Si renseigné, la convention collective prime sur le code NAF pour la détection OPCO"
          />
          <OpcoSelector
            siret={siret}
            codeNaf={codeNaf}
            codeIdcc={codeIdcc}
            defaultOpcoId={client?.opco_id || undefined}
            defaultStatus={client?.opco_compte_status || 'aucun'}
            defaultNumeroOpco={client?.numero_opco || undefined}
          />
        </>
      )}

      <textarea id="notes" name="notes" rows={3} className="input-base resize-none" placeholder="Notes internes..." defaultValue={client?.notes || ''} />

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" isLoading={isLoading} icon={<Save className="h-4 w-4" />}>
          {client ? 'Mettre à jour' : clientType === 'entreprise' ? 'Créer et ajouter le référent' : 'Créer le client'}
        </Button>
      </div>
    </form>
  )
}

interface ReferentStepProps {
  clientId: string
  companyName: string
  defaultPrenom?: string
  defaultNom?: string
  defaultPoste?: string
  onDone: () => void
}

function ReferentStep({ clientId, companyName, defaultPrenom, defaultNom, defaultPoste, onDone }: ReferentStepProps) {
  const [saving, setSaving] = useState(false)
  const [errs, setErrs] = useState<Record<string, string[]>>({})
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true); setErrs({}); setError(null)
    const fd = new FormData(e.currentTarget)
    fd.set('client_id', clientId)
    fd.set('est_referent_formation', 'true')
    fd.set('est_principal', 'true')
    const r = await createContactAction(fd)
    setSaving(false)
    if (r.success) onDone()
    else if (r.errors) setErrs(r.errors)
    else setError(r.error || 'Erreur')
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-semibold text-emerald-900">Client « {companyName || 'entreprise'} » créé</div>
          <div className="text-xs text-emerald-700 mt-0.5">Ajoutez maintenant le référent (interlocuteur principal de l'entreprise).</div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-danger-50 border border-danger-200 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-surface-400 uppercase tracking-wider">
          <UserCircle className="h-4 w-4 text-surface-400" /> Référent de l'entreprise
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Select id="ref_civilite" name="civilite" label="Civilité" options={[{ value: '', label: '—' }, { value: 'M.', label: 'M.' }, { value: 'Mme', label: 'Mme' }]} />
          <Input id="ref_prenom" name="prenom" label="Prénom *" defaultValue={defaultPrenom || ''} error={errs.prenom?.[0]} />
          <Input id="ref_nom" name="nom" label="Nom *" defaultValue={defaultNom || ''} error={errs.nom?.[0]} />
        </div>

        <Input id="ref_poste" name="poste" label="Poste / fonction" defaultValue={defaultPoste || ''} placeholder="Responsable formation, Gérant..." />

        <div className="grid grid-cols-2 gap-4">
          <Input id="ref_email" name="email" type="email" label="Email" error={errs.email?.[0]} />
          <Input id="ref_telephone" name="telephone" label="Téléphone" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input id="ref_mobile" name="mobile" label="Mobile" />
          <Input id="ref_whatsapp" name="whatsapp" label="WhatsApp" placeholder="06 12 34 56 78" />
        </div>

        <label className="flex items-center gap-2 text-sm text-surface-700 cursor-pointer">
          <input type="checkbox" name="est_signataire" value="true" className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
          Ce référent est le signataire des conventions
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onDone}>Passer cette étape</Button>
          <Button type="submit" isLoading={saving} icon={<UserPlus className="h-4 w-4" />}>Ajouter le référent</Button>
        </div>
      </form>
    </div>
  )
}
