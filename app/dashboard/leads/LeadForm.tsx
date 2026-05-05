'use client'

import { useState } from 'react'
import { Save, AlertCircle, Award, GraduationCap } from 'lucide-react'
import { Button, Input, Select, CompanySearchInput, OpcoSelector } from '@/components/ui'
import { createLeadAction, updateLeadAction } from './actions'
import { LEAD_SOURCE_LABELS, CLIENT_TYPE_LABELS, FINANCEUR_LABELS } from '@/lib/types/crm'
import type { Lead, ClientType } from '@/lib/types/crm'
import type { User } from '@/lib/types'
import type { SireneCompany } from '@/lib/sirene'

interface Formation {
  id: string
  intitule: string
  prix_ht: number | null
}

interface LeadFormProps {
  lead?: Lead
  users: Pick<User, 'id' | 'first_name' | 'last_name' | 'role'>[]
  formations?: Formation[]
  isApporteur?: boolean
  hideAssign?: boolean
  onSuccess: () => void
  onCancel: () => void
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Admin',
  directeur_commercial: 'Directeur commercial',
  commercial: 'Commercial',
  gestionnaire: 'Gestionnaire',
  comptable: 'Comptable',
  formateur: 'Formateur',
  apporteur_affaires: 'Apporteur d\'affaires',
  apprenant: 'Apprenant',
}

const sourceOptions = Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => ({ value, label }))
const typeOptions = Object.entries(CLIENT_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))
const financeurOptions = [{ value: '', label: 'Aucun' }, ...Object.entries(FINANCEUR_LABELS).map(([v, l]) => ({ value: v, label: l }))]
const tailleOptions = [
  { value: '', label: 'Non renseignée' },
  { value: 'TPE', label: 'TPE (< 10 salariés)' },
  { value: 'PME', label: 'PME (10-249)' },
  { value: 'ETI', label: 'ETI (250-4999)' },
  { value: 'GE', label: 'Grande entreprise (5000+)' },
]
const civiliteOptions = [{ value: '', label: '—' }, { value: 'M.', label: 'M.' }, { value: 'Mme', label: 'Mme' }]

export function LeadForm({ lead, users, formations = [], isApporteur, hideAssign, onSuccess, onCancel }: LeadFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [error, setError] = useState<string | null>(null)

  // Si on édite un lead avec une formation_souhaitee qui matche le catalogue, on présélectionne
  const initialMatchedFormation = lead?.formation_souhaitee
    ? formations.find(f => f.intitule === lead.formation_souhaitee)
    : null
  const [selectedFormation, setSelectedFormation] = useState(
    initialMatchedFormation ? initialMatchedFormation.id : (lead?.formation_souhaitee ? '__custom' : '')
  )
  const [isCustomFormation, setIsCustomFormation] = useState(
    !!lead?.formation_souhaitee && !initialMatchedFormation
  )
  const [customFormationText, setCustomFormationText] = useState(
    initialMatchedFormation ? '' : (lead?.formation_souhaitee || '')
  )

  const [type, setType] = useState<ClientType>(lead?.type || 'entreprise')

  // Entreprise contrôlée pour autocomplete data.gouv
  const [entreprise, setEntreprise] = useState(lead?.entreprise || '')
  const [siret, setSiret] = useState(lead?.siret || '')
  const [sigle, setSigle] = useState(lead?.sigle || '')
  const [codeNaf, setCodeNaf] = useState(lead?.code_naf || '')
  const [secteurActivite, setSecteurActivite] = useState(lead?.secteur_activite || '')
  const [tailleEntreprise, setTailleEntreprise] = useState(lead?.taille_entreprise || '')
  const [formeJuridique, setFormeJuridique] = useState(lead?.forme_juridique || '')
  const [dateCreation, setDateCreation] = useState(lead?.date_creation_entreprise || '')
  const [effectifLibelle, setEffectifLibelle] = useState(lead?.effectif_libelle || '')
  const [tvaIntra, setTvaIntra] = useState(lead?.tva_intra || '')
  const [estQualiopi, setEstQualiopi] = useState(lead?.est_qualiopi || false)
  const [estOrgFormation, setEstOrgFormation] = useState(lead?.est_organisme_formation || false)
  const [adresse, setAdresse] = useState(lead?.adresse || '')
  const [codePostal, setCodePostal] = useState(lead?.code_postal || '')
  const [ville, setVille] = useState(lead?.ville || '')
  const [codeIdcc, setCodeIdcc] = useState(lead?.code_idcc || '')

  // Contact (= dirigeant pré-rempli depuis data.gouv)
  const [contactCivilite, setContactCivilite] = useState(lead?.contact_civilite || '')
  const [contactPrenom, setContactPrenom] = useState(lead?.contact_prenom || '')
  const [contactNom, setContactNom] = useState(lead?.contact_nom || '')
  const [contactQualite, setContactQualite] = useState(lead?.contact_qualite || '')

  function handleCompanyClear() {
    // Reset tous les champs auto-remplis quand l'user retape par-dessus la sélection
    setSiret(''); setSigle(''); setCodeNaf(''); setSecteurActivite('')
    setCodeIdcc(''); setTailleEntreprise(''); setFormeJuridique(''); setDateCreation('')
    setEffectifLibelle(''); setTvaIntra('')
    setEstQualiopi(false); setEstOrgFormation(false)
    setAdresse(''); setCodePostal(''); setVille('')
    setContactCivilite(''); setContactPrenom(''); setContactNom(''); setContactQualite('')
  }

  function handleCompanySelect(c: SireneCompany) {
    setEntreprise(c.raison_sociale)
    if (c.siret) setSiret(c.siret)
    setSigle(c.sigle || '')
    if (c.code_naf) setCodeNaf(c.code_naf)
    if (c.libelle_naf) setSecteurActivite(c.libelle_naf)
    if (c.code_idcc) setCodeIdcc(c.code_idcc)
    if (c.taille_entreprise) setTailleEntreprise(c.taille_entreprise)
    if (c.forme_juridique) setFormeJuridique(c.forme_juridique)
    if (c.date_creation) setDateCreation(c.date_creation)
    if (c.effectif_libelle) setEffectifLibelle(c.effectif_libelle)
    if (c.tva_intra) setTvaIntra(c.tva_intra)
    setEstQualiopi(c.est_qualiopi)
    setEstOrgFormation(c.est_organisme_formation)
    if (c.adresse) setAdresse(c.adresse)
    if (c.code_postal) setCodePostal(c.code_postal)
    if (c.ville) setVille(c.ville)
    // Pré-remplir le contact depuis le dirigeant principal (gérante de l'établissement)
    if (c.dirigeant) {
      if (!contactPrenom) setContactPrenom(c.dirigeant.prenom)
      if (!contactNom) setContactNom(c.dirigeant.nom)
      if (!contactQualite) setContactQualite(c.dirigeant.qualite)
    }
  }

  const userOptions = users.map((u) => ({
    value: u.id,
    label: `${u.first_name} ${u.last_name} — ${ROLE_LABELS[u.role] || u.role}`,
  }))
  const formationOptions = [
    ...formations.map((f) => ({ value: f.id, label: f.intitule })),
    { value: '__custom', label: 'Autre (formation spéciale)' },
  ]

  function handleFormationChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    setSelectedFormation(val)
    setIsCustomFormation(val === '__custom')
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setFieldErrors({})
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.set('type', type)
    formData.set('est_qualiopi', estQualiopi ? 'true' : 'false')
    formData.set('est_organisme_formation', estOrgFormation ? 'true' : 'false')

    // Formation souhaitée : depuis le catalogue ou champ libre
    if (selectedFormation && selectedFormation !== '__custom') {
      const formation = formations.find(f => f.id === selectedFormation)
      if (formation) {
        formData.set('formation_souhaitee', formation.intitule)
        // Pour l'apporteur, calculer le montant depuis la formation × nb stagiaires
        if (isApporteur && formation.prix_ht) {
          const nbStagiaires = parseInt(formData.get('nombre_stagiaires') as string) || 1
          formData.set('montant_estime', String(formation.prix_ht * nbStagiaires))
        }
      }
    } else if (selectedFormation === '__custom') {
      formData.set('formation_souhaitee', customFormationText)
    } else {
      formData.set('formation_souhaitee', '')
    }

    const result = lead
      ? await updateLeadAction(lead.id, formData)
      : await createLeadAction(formData)

    if (result.success) onSuccess()
    else if (result.errors) setFieldErrors(result.errors)
    else setError(result.error || 'Erreur')
    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-xl bg-danger-50 border border-danger-200 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      {/* ── Type ── */}
      <Select
        id="type" name="type" label="Type de prospect *"
        options={typeOptions}
        value={type}
        onChange={(e) => setType(e.target.value as ClientType)}
      />

      {type === 'entreprise' ? (
        <>
          {/* ── Entreprise (autocomplete data.gouv) ── */}
          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Entreprise</div>

          <CompanySearchInput
            id="entreprise" name="entreprise" label="Raison sociale"
            defaultValue={entreprise} onSelect={handleCompanySelect} onClear={handleCompanyClear}
          />

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
            <Input id="siret" name="siret" label="SIRET" value={siret} onChange={(e) => setSiret(e.target.value)} placeholder="14 chiffres" />
            <Input id="sigle" name="sigle" label="Sigle" value={sigle} onChange={(e) => setSigle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input id="forme_juridique" name="forme_juridique" label="Forme juridique" value={formeJuridique} onChange={(e) => setFormeJuridique(e.target.value)} />
            <Input id="date_creation_entreprise" name="date_creation_entreprise" type="date" label="Date de création" value={dateCreation} onChange={(e) => setDateCreation(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input id="code_naf" name="code_naf" label="Code NAF" value={codeNaf} onChange={(e) => setCodeNaf(e.target.value)} />
            <Input id="tva_intra" name="tva_intra" label="N° TVA intra" value={tvaIntra} onChange={(e) => setTvaIntra(e.target.value)} />
          </div>
          <Input id="secteur_activite" name="secteur_activite" label="Secteur d'activité" value={secteurActivite} onChange={(e) => setSecteurActivite(e.target.value)} />
          <div className="grid grid-cols-2 gap-4">
            <Select id="taille_entreprise" name="taille_entreprise" label="Taille" options={tailleOptions} value={tailleEntreprise} onChange={(e) => setTailleEntreprise(e.target.value)} />
            <Input id="effectif_libelle" name="effectif_libelle" label="Effectif" value={effectifLibelle} onChange={(e) => setEffectifLibelle(e.target.value)} />
          </div>

          {/* ── Adresse ── */}
          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider pt-2">Adresse</div>
          <Input id="adresse" name="adresse" label="Adresse" value={adresse} onChange={(e) => setAdresse(e.target.value)} />
          <div className="grid grid-cols-2 gap-4">
            <Input id="code_postal" name="code_postal" label="Code postal" value={codePostal} onChange={(e) => setCodePostal(e.target.value)} />
            <Input id="ville" name="ville" label="Ville" value={ville} onChange={(e) => setVille(e.target.value)} />
          </div>
          <Input id="site_web" name="site_web" label="Site web" defaultValue={lead?.site_web || ''} placeholder="https://" />
        </>
      ) : null}

      {/* ── Contact principal (= gérant pour les entreprises) ── */}
      <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider pt-2">
        {type === 'entreprise' ? 'Contact principal (gérant)' : 'Contact'}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Select id="contact_civilite" name="contact_civilite" label="Civilité" options={civiliteOptions} value={contactCivilite} onChange={(e) => setContactCivilite(e.target.value)} />
        <Input id="contact_prenom" name="contact_prenom" label="Prénom" value={contactPrenom} onChange={(e) => setContactPrenom(e.target.value)} error={fieldErrors.contact_prenom?.[0]} />
        <Input id="contact_nom" name="contact_nom" label="Nom *" value={contactNom} onChange={(e) => setContactNom(e.target.value)} error={fieldErrors.contact_nom?.[0]} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input id="contact_email" name="contact_email" type="email" label="Email" defaultValue={lead?.contact_email || ''} error={fieldErrors.contact_email?.[0]} />
        <Input id="contact_telephone" name="contact_telephone" label="Téléphone" defaultValue={lead?.contact_telephone || ''} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input id="contact_qualite" name="contact_qualite" label="Qualité" value={contactQualite} onChange={(e) => setContactQualite(e.target.value)} placeholder="Gérant, Président de SAS..." />
        <Input id="contact_poste" name="contact_poste" label="Poste / Service" defaultValue={lead?.contact_poste || ''} />
      </div>

      {/* ── Financement / OPCO (entreprise uniquement) ── */}
      {type === 'entreprise' && (
        <>
          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider pt-2">Financement</div>
          <Select id="financeur_type" name="financeur_type" label="Type de financeur" options={financeurOptions} defaultValue={lead?.financeur_type || ''} />
          <Input
            id="code_idcc" name="code_idcc"
            label="Code IDCC (convention collective)"
            value={codeIdcc} onChange={(e) => setCodeIdcc(e.target.value)}
            placeholder="Ex: 1979 pour HCR"
            hint="Si renseigné, prime sur le code NAF pour la détection OPCO"
          />
          <OpcoSelector
            siret={siret}
            codeNaf={codeNaf}
            codeIdcc={codeIdcc}
            defaultOpcoId={lead?.opco_id || undefined}
            defaultStatus={lead?.opco_compte_status || 'aucun'}
            defaultNumeroOpco={lead?.numero_opco || undefined}
          />
        </>
      )}

      {/* ── Recueil du besoin ── */}
      <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider pt-2">
        Recueil du besoin
        <span className="ml-2 text-[10px] font-mono normal-case text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
          DEBUG: formations.length={formations.length}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="formation_id" className="text-sm font-medium text-surface-700">
          Formation souhaitée{isApporteur ? ' *' : ''}
        </label>
        <select
          id="formation_id"
          name="formation_id"
          value={selectedFormation}
          onChange={handleFormationChange}
          className="input-base"
        >
          <option value="">
            {formations.length === 0
              ? 'Aucune formation dans le catalogue — saisie libre uniquement'
              : `Sélectionner une formation (${formations.length} disponible${formations.length > 1 ? 's' : ''})`}
          </option>
          {formations.map(f => (
            <option key={f.id} value={f.id}>{f.intitule}</option>
          ))}
          <option value="__custom">— Autre formation (saisie libre) —</option>
        </select>
      </div>

      {isCustomFormation && (
        <div className="space-y-3">
          {isApporteur && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Cette demande hors catalogue sera transmise au directeur commercial pour validation.</span>
            </div>
          )}
          <Input
            id="formation_souhaitee_custom"
            label={isApporteur ? 'Décrivez la formation souhaitée *' : 'Formation souhaitée (saisie libre)'}
            value={customFormationText}
            onChange={(e) => setCustomFormationText(e.target.value)}
            placeholder="Ex: Formation spécifique en pâtisserie vegan..."
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Input id="nombre_stagiaires" name="nombre_stagiaires" type="number" label="Nombre de participants" defaultValue={lead?.nombre_stagiaires?.toString() || ''} placeholder="1" />
        <Input id="date_souhaitee" name="date_souhaitee" type="date" label="Date souhaitée" defaultValue={lead?.date_souhaitee || ''} />
      </div>

      <div>
        <label htmlFor="commentaire" className="text-sm font-medium text-surface-700">Commentaire</label>
        <textarea id="commentaire" name="commentaire" rows={3} className="input-base resize-none mt-1.5" defaultValue={lead?.commentaire || ''} placeholder="Précisions sur le besoin..." />
      </div>

      {/* ── Suivi ── */}
      {!isApporteur && (
        <>
          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider pt-2">Suivi</div>
          <div className="grid grid-cols-2 gap-4">
            <Select id="source" name="source" label="Source *" options={sourceOptions} defaultValue={lead?.source || 'autre'} error={fieldErrors.source?.[0]} />
            {!hideAssign && (
              <Select id="assigned_to" name="assigned_to" label="Assigné à" options={userOptions} defaultValue={lead?.assigned_to || ''} placeholder="Sélectionner un responsable" />
            )}
          </div>
        </>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" isLoading={isLoading} icon={<Save className="h-4 w-4" />}>
          {lead ? 'Mettre à jour' : isApporteur ? 'Soumettre le lead' : 'Créer le lead'}
        </Button>
      </div>
    </form>
  )
}
