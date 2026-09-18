'use client'

import { useState, useRef } from 'react'
import { Save, Building2, ShieldCheck, UserCircle, Landmark, Stamp, Upload, ExternalLink, X, BookOpen, FileText } from '@/components/ui/icons'
import { Button, Input, useToast } from '@/components/ui'
import { updateOrganizationAction } from './actions'
import type { Organization } from '@/lib/types'

interface ExtendedOrganization extends Organization {
  forme_juridique?: string | null
  capital_social?: number | null
  code_ape?: string | null
  code_naf?: string | null
  numero_tva_intra?: string | null
  rcs?: string | null
  representant_legal_civilite?: string | null
  representant_legal_prenom?: string | null
  representant_legal_nom?: string | null
  representant_legal_fonction?: string | null
  tampon_signature_url?: string | null
  tampon_signature_filename?: string | null
  livret_accueil_url?: string | null
  livret_accueil_filename?: string | null
  qualiopi_certificateur?: string | null
  qualiopi_certificat_numero?: string | null
  qualiopi_date_obtention?: string | null
  qualiopi_date_expiration?: string | null
  numero_datadock?: string | null
  banque_nom?: string | null
  banque_iban?: string | null
  banque_bic?: string | null
  banque_titulaire?: string | null
  affacturage_actif?: boolean | null
  affacturage_societe?: string | null
  affacturage_compte?: string | null
  affacturage_iban?: string | null
  affacturage_bic?: string | null
  affacturage_mention?: string | null
  email_contact?: string | null
  telephone_contact?: string | null
  referent_handicap_nom?: string | null
  referent_handicap_email?: string | null
  referent_handicap_telephone?: string | null
  delai_acces?: string | null
}

interface SettingsFormProps {
  organization: ExtendedOrganization
  canEdit: boolean
}

export function SettingsForm({ organization, canEdit }: SettingsFormProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [isQualiopi, setIsQualiopi] = useState(organization.is_qualiopi)
  const [tamponUrl, setTamponUrl] = useState(organization.tampon_signature_url || '')
  const [tamponFilename, setTamponFilename] = useState(organization.tampon_signature_filename || '')
  const [uploadingTampon, setUploadingTampon] = useState(false)
  const tamponRef = useRef<HTMLInputElement>(null)
  const [logoUrl, setLogoUrl] = useState((organization as any).logo_url || '')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoRef = useRef<HTMLInputElement>(null)
  const [livretUrl, setLivretUrl] = useState(organization.livret_accueil_url || '')
  const [livretFilename, setLivretFilename] = useState(organization.livret_accueil_filename || '')
  const [uploadingLivret, setUploadingLivret] = useState(false)
  const livretRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canEdit) return
    setIsLoading(true)
    setErrors({})
    const fd = new FormData(e.currentTarget)
    fd.set('is_qualiopi', String(isQualiopi))
    const result = await updateOrganizationAction(fd)
    if (result.success) toast('success', 'Paramètres enregistrés')
    else if (result.errors) setErrors(result.errors)
    else toast('error', result.error || 'Erreur')
    setIsLoading(false)
  }

  async function handleUploadTampon(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast('error', 'Fichier trop lourd (max 5 Mo)'); return }
    setUploadingTampon(true)
    const fd = new FormData()
    fd.set('file', file)
    try {
      const res = await fetch('/api/organization/upload-tampon', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok && data.success) {
        setTamponUrl(data.url)
        setTamponFilename(data.filename)
        toast('success', 'Tampon enregistré')
      } else toast('error', data.error || 'Erreur upload')
    } catch { toast('error', 'Erreur réseau') }
    setUploadingTampon(false)
    if (tamponRef.current) tamponRef.current.value = ''
  }

  async function removeTampon() {
    if (!confirm('Supprimer le tampon ?')) return
    await fetch('/api/organization/upload-tampon', { method: 'DELETE' })
    setTamponUrl('')
    setTamponFilename('')
    toast('success', 'Tampon supprimé')
  }

  async function handleUploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast('error', 'Fichier trop lourd (max 5 Mo)'); return }
    setUploadingLogo(true)
    const fd = new FormData()
    fd.set('file', file)
    try {
      const res = await fetch('/api/organization/upload-logo', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok && data.success) { setLogoUrl(data.url); toast('success', 'Logo enregistré') }
      else toast('error', data.error || 'Erreur upload')
    } catch { toast('error', 'Erreur réseau') }
    setUploadingLogo(false)
    if (logoRef.current) logoRef.current.value = ''
  }

  async function removeLogo() {
    if (!confirm('Supprimer le logo ?')) return
    await fetch('/api/organization/upload-logo', { method: 'DELETE' })
    setLogoUrl('')
    toast('success', 'Logo supprimé')
  }

  async function handleUploadLivret(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { toast('error', 'Fichier trop lourd (max 10 Mo)'); return }
    setUploadingLivret(true)
    const fd = new FormData()
    fd.set('file', file)
    try {
      const res = await fetch('/api/organization/upload-livret', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok && data.success) {
        setLivretUrl(data.url)
        setLivretFilename(data.filename)
        toast('success', "Livret d'accueil enregistré")
      } else toast('error', data.error || 'Erreur upload')
    } catch { toast('error', 'Erreur réseau') }
    setUploadingLivret(false)
    if (livretRef.current) livretRef.current.value = ''
  }

  async function removeLivret() {
    if (!confirm("Supprimer le livret d'accueil ?")) return
    await fetch('/api/organization/upload-livret', { method: 'DELETE' })
    setLivretUrl('')
    setLivretFilename('')
    toast('success', 'Livret supprimé')
  }

  const SectionHeader = ({ icon: Icon, title, subtitle }: any) => (
    <div className="flex items-start sm:items-center gap-3 mb-5">
      <div className="h-9 w-9 rounded-xl bg-surface-100 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-surface-600" />
      </div>
      <div className="min-w-0">
        <h2 className="text-sm font-heading font-semibold text-surface-900 tracking-tight">{title}</h2>
        {subtitle && <p className="text-[13px] sm:text-xs text-surface-500">{subtitle}</p>}
      </div>
    </div>
  )

  /** Sommaire des sections : onglets défilants (utile sur téléphone, le formulaire est long) */
  const SECTIONS = [
    { id: 'identite', label: 'Identité' },
    { id: 'representant', label: 'Représentant' },
    { id: 'logo', label: 'Logo' },
    { id: 'tampon', label: 'Tampon' },
    { id: 'livret', label: "Livret d'accueil" },
    { id: 'handicap', label: 'Accessibilité' },
    { id: 'qualifications', label: 'Qualifications' },
    { id: 'banque', label: 'Banque' },
    { id: 'affacturage', label: 'Affacturage' },
  ]

  /** Actions d'un fichier déjà déposé (voir, remplacer, supprimer) : cibles de 40 px sur téléphone */
  const lienFichier = 'inline-flex items-center gap-1 text-[13px] sm:text-xs min-h-[40px] sm:min-h-0 px-1 -mx-1 rounded-lg'

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
      <nav aria-label="Sections des paramètres" className="tabs-scroll -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
        {SECTIONS.map((sec) => (
          <a key={sec.id} href={`#${sec.id}`}
            className="inline-flex items-center min-h-[40px] sm:min-h-[36px] px-3.5 rounded-full border border-surface-200 bg-white text-[13px] sm:text-xs font-semibold text-surface-600 hover:border-brand-300 hover:text-brand-700 active:bg-brand-50 transition-colors">
            {sec.label}
          </a>
        ))}
      </nav>

      {/* Identité légale */}
      <section id="identite" className="card p-4 sm:p-6 scroll-mt-20">
        <SectionHeader icon={Building2} title="Identité de l'organisme" subtitle="Informations légales et coordonnées" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input id="name" name="name" label="Nom commercial *" defaultValue={organization.name} error={errors.name?.[0]} disabled={!canEdit} />
          <Input id="legal_name" name="legal_name" label="Raison sociale" defaultValue={organization.legal_name || ''} disabled={!canEdit} />
          <Input id="siret" name="siret" label="SIRET" placeholder="14 chiffres" defaultValue={organization.siret || ''} disabled={!canEdit} />
          <Input id="numero_da" name="numero_da" label="N° Déclaration d'activité" placeholder="11 75 XXXXX 75" defaultValue={organization.numero_da || ''} disabled={!canEdit} />
          <Input id="forme_juridique" name="forme_juridique" label="Forme juridique" placeholder="SAS, SARL, SCI..." defaultValue={organization.forme_juridique || ''} disabled={!canEdit} />
          <Input id="capital_social" name="capital_social" type="number" label="Capital social (€)" defaultValue={organization.capital_social?.toString() || ''} disabled={!canEdit} />
          <Input id="code_ape" name="code_ape" label="Code APE/NAF" placeholder="85.59A" defaultValue={organization.code_ape || organization.code_naf || ''} disabled={!canEdit} />
          <Input id="numero_tva_intra" name="numero_tva_intra" label="N° TVA intracommunautaire" defaultValue={organization.numero_tva_intra || ''} disabled={!canEdit} />
          <Input id="rcs" name="rcs" label="RCS" placeholder="RCS Paris 123 456 789" defaultValue={organization.rcs || ''} disabled={!canEdit} />
          <Input id="website" name="website" label="Site web" placeholder="https://" defaultValue={organization.website || ''} disabled={!canEdit} />
          <Input id="email_contact" name="email_contact" type="email" label="Email contact" defaultValue={organization.email_contact || organization.email || ''} disabled={!canEdit} />
          <Input id="telephone_contact" name="telephone_contact" label="Téléphone" defaultValue={organization.telephone_contact || organization.phone || ''} disabled={!canEdit} />
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input id="address" name="address" label="Adresse" defaultValue={organization.address || ''} disabled={!canEdit} />
          <Input id="postal_code" name="postal_code" label="Code postal" defaultValue={organization.postal_code || ''} disabled={!canEdit} />
          <Input id="city" name="city" label="Ville" defaultValue={organization.city || ''} disabled={!canEdit} />
        </div>
      </section>

      {/* Représentant légal */}
      <section id="representant" className="card p-4 sm:p-6 scroll-mt-20">
        <SectionHeader icon={UserCircle} title="Représentant légal" subtitle="Personne qui signe officiellement les documents" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input id="representant_legal_civilite" name="representant_legal_civilite" label="Civilité" placeholder="M. / Mme" defaultValue={organization.representant_legal_civilite || ''} disabled={!canEdit} />
          <Input id="representant_legal_prenom" name="representant_legal_prenom" label="Prénom" defaultValue={organization.representant_legal_prenom || ''} disabled={!canEdit} />
          <Input id="representant_legal_nom" name="representant_legal_nom" label="Nom" defaultValue={organization.representant_legal_nom || ''} disabled={!canEdit} />
          <Input id="representant_legal_fonction" name="representant_legal_fonction" label="Fonction" placeholder="Président, Gérant..." defaultValue={organization.representant_legal_fonction || ''} disabled={!canEdit} />
        </div>
      </section>

      {/* Logo de l'organisme */}
      <section id="logo" className="card p-4 sm:p-6 scroll-mt-20">
        <SectionHeader icon={Building2} title="Logo de l'organisme" subtitle="Affiché dans le header des emails (invitations, accès portails, signatures) et sur les documents." />

        {logoUrl ? (
          <div className="flex flex-col sm:flex-row items-start gap-4 p-4 rounded-xl bg-surface-50 border border-surface-200">
            <div className="bg-[#205040] p-3 rounded-lg shrink-0">
              <img src={logoUrl} alt="Logo" className="h-12 w-auto max-w-[160px] object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-surface-900 break-words">Logo enregistré</div>
              <div className="text-[13px] sm:text-xs text-surface-500 mt-1">
                Apparaît sur fond vert dans l'en-tête des emails : privilégiez un PNG blanc ou clair sur fond transparent.
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 sm:mt-3">
                <a href={logoUrl} target="_blank" rel="noreferrer" className={`${lienFichier} text-brand-600 hover:underline`}>
                  <ExternalLink className="h-3 w-3" /> Voir en plein
                </a>
                {canEdit && (
                  <>
                    <button type="button" onClick={() => logoRef.current?.click()} className={`${lienFichier} text-surface-500 hover:text-surface-800`}>
                      <Upload className="h-3 w-3" /> Remplacer
                    </button>
                    <button type="button" onClick={removeLogo} className={`${lienFichier} text-danger-500 hover:text-danger-700`}>
                      <X className="h-3 w-3" /> Supprimer
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : canEdit ? (
          <button
            type="button"
            onClick={() => logoRef.current?.click()}
            disabled={uploadingLogo}
            className="w-full p-5 sm:p-6 rounded-xl border-2 border-dashed border-surface-300 hover:border-brand-300 hover:bg-brand-50/40 transition-colors flex flex-col items-center text-center gap-2 disabled:opacity-50"
          >
            <Building2 className="h-6 w-6 text-surface-400" />
            <div className="text-sm font-medium text-surface-700">
              {uploadingLogo ? 'Upload en cours…' : 'Uploader le logo (PNG / SVG)'}
            </div>
            <div className="text-[13px] sm:text-xs text-surface-500">PNG transparent recommandé · hauteur ~128 px · 5 Mo max</div>
          </button>
        ) : (
          <div className="text-sm text-surface-500">Aucun logo configuré</div>
        )}

        <input
          ref={logoRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="hidden"
          onChange={handleUploadLogo}
        />
      </section>

      {/* Tampon + Signature */}
      <section id="tampon" className="card p-4 sm:p-6 scroll-mt-20">
        <SectionHeader icon={Stamp} title="Tampon et signature" subtitle="Image apposée automatiquement comme signature de l'OF sur conventions, contrats, factures..." />

        {tamponUrl ? (
          <div className="flex flex-col sm:flex-row items-start gap-4 p-4 rounded-xl bg-surface-50 border border-surface-200">
            <div className="bg-white p-3 rounded-lg border border-surface-200 shrink-0">
              <img src={tamponUrl} alt="Tampon" className="h-24 w-auto max-w-[192px] object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-surface-900 break-words">{tamponFilename || 'tampon.png'}</div>
              <div className="text-[13px] sm:text-xs text-surface-500 mt-1">
                Sera appliqué automatiquement sur tous les documents officiels Lab Learning.
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 sm:mt-3">
                <a href={tamponUrl} target="_blank" rel="noreferrer" className={`${lienFichier} text-brand-600 hover:underline`}>
                  <ExternalLink className="h-3 w-3" /> Voir en plein
                </a>
                {canEdit && (
                  <>
                    <button type="button" onClick={() => tamponRef.current?.click()} className={`${lienFichier} text-surface-500 hover:text-surface-800`}>
                      <Upload className="h-3 w-3" /> Remplacer
                    </button>
                    <button type="button" onClick={removeTampon} className={`${lienFichier} text-danger-500 hover:text-danger-700`}>
                      <X className="h-3 w-3" /> Supprimer
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : canEdit ? (
          <button
            type="button"
            onClick={() => tamponRef.current?.click()}
            disabled={uploadingTampon}
            className="w-full p-5 sm:p-6 rounded-xl border-2 border-dashed border-surface-300 hover:border-brand-300 hover:bg-brand-50/40 transition-colors flex flex-col items-center text-center gap-2 disabled:opacity-50"
          >
            <Stamp className="h-6 w-6 text-surface-400" />
            <div className="text-sm font-medium text-surface-700">
              {uploadingTampon ? 'Upload en cours…' : 'Uploader le tampon + signature (PNG)'}
            </div>
            <div className="text-[13px] sm:text-xs text-surface-500">PNG sur fond transparent recommandé · 5 Mo max</div>
          </button>
        ) : (
          <div className="text-sm text-surface-500">Aucun tampon configuré</div>
        )}

        <input
          ref={tamponRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={handleUploadTampon}
        />
      </section>

      {/* Livret d'accueil */}
      <section id="livret" className="card p-4 sm:p-6 scroll-mt-20">
        <SectionHeader icon={BookOpen} title="Livret d'accueil" subtitle="PDF envoyé automatiquement aux apprenants la veille de leur formation (J-1), par WhatsApp et notification." />

        {livretUrl ? (
          <div className="flex flex-col sm:flex-row items-start gap-4 p-4 rounded-xl bg-surface-50 border border-surface-200">
            <div className="bg-white p-3 rounded-lg border border-surface-200 shrink-0">
              <FileText className="h-10 w-10 text-rose-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-surface-900 break-words">{livretFilename || 'livret-accueil.pdf'}</div>
              <div className="text-[13px] sm:text-xs text-surface-500 mt-1">
                Joint au message WhatsApp et accessible dans la notification de l'apprenant, J-1 avant la session.
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 sm:mt-3">
                <a href={livretUrl} target="_blank" rel="noreferrer" className={`${lienFichier} text-brand-600 hover:underline`}>
                  <ExternalLink className="h-3 w-3" /> Ouvrir le PDF
                </a>
                {canEdit && (
                  <>
                    <button type="button" onClick={() => livretRef.current?.click()} className={`${lienFichier} text-surface-500 hover:text-surface-800`}>
                      <Upload className="h-3 w-3" /> Remplacer
                    </button>
                    <button type="button" onClick={removeLivret} className={`${lienFichier} text-danger-500 hover:text-danger-700`}>
                      <X className="h-3 w-3" /> Supprimer
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : canEdit ? (
          <button
            type="button"
            onClick={() => livretRef.current?.click()}
            disabled={uploadingLivret}
            className="w-full p-5 sm:p-6 rounded-xl border-2 border-dashed border-surface-300 hover:border-brand-300 hover:bg-brand-50/40 transition-colors flex flex-col items-center text-center gap-2 disabled:opacity-50"
          >
            <BookOpen className="h-6 w-6 text-surface-400" />
            <div className="text-sm font-medium text-surface-700">
              {uploadingLivret ? 'Upload en cours…' : "Uploader le livret d'accueil (PDF)"}
            </div>
            <div className="text-[13px] sm:text-xs text-surface-500">Document unique pour toutes les formations · 10 Mo max</div>
          </button>
        ) : (
          <div className="text-sm text-surface-500">Aucun livret configuré</div>
        )}

        <input
          ref={livretRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleUploadLivret}
        />
      </section>

      {/* Accessibilité handicap (Qualiopi) */}
      <section id="handicap" className="card p-4 sm:p-6 scroll-mt-20">
        <SectionHeader icon={ShieldCheck} title="Accessibilité et référent handicap" subtitle="Exigence Qualiopi : coordonnées affichées sur le programme, la convocation et la convention" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input id="referent_handicap_nom" name="referent_handicap_nom" label="Référent handicap (nom)" defaultValue={organization.referent_handicap_nom || ''} disabled={!canEdit} />
          <Input id="referent_handicap_email" name="referent_handicap_email" type="email" label="Email du référent" defaultValue={organization.referent_handicap_email || ''} disabled={!canEdit} />
          <Input id="referent_handicap_telephone" name="referent_handicap_telephone" label="Téléphone du référent" defaultValue={organization.referent_handicap_telephone || ''} disabled={!canEdit} />
        </div>
        <div className="mt-4">
          <Input id="delai_acces" name="delai_acces" label="Délai d'accès aux formations" placeholder="Ex : inscription possible jusqu'à 7 jours avant le démarrage" defaultValue={organization.delai_acces || ''} disabled={!canEdit} />
        </div>
      </section>

      {/* Qualifications */}
      <section id="qualifications" className="card p-4 sm:p-6 scroll-mt-20">
        <SectionHeader icon={ShieldCheck} title="Qualifications" subtitle="Certifications et numéros officiels de l'OF" />

        <label className="flex items-center gap-3 cursor-pointer group mb-4 min-h-[40px]">
          <div className="relative">
            <input type="checkbox" checked={isQualiopi} onChange={(e) => setIsQualiopi(e.target.checked)} disabled={!canEdit} className="sr-only peer" />
            <div className="w-10 h-[22px] bg-surface-200 rounded-full peer-checked:bg-surface-900 transition-colors" />
            <div className="absolute top-[3px] left-[3px] w-4 h-4 bg-white rounded-full shadow-xs transition-transform peer-checked:translate-x-[18px]" />
          </div>
          <span className="text-sm text-surface-700 font-medium">Organisme certifié Qualiopi</span>
        </label>

        {isQualiopi && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input id="qualiopi_certificateur" name="qualiopi_certificateur" label="Certificateur" placeholder="Bureau Veritas, AFNOR, ISQ..." defaultValue={organization.qualiopi_certificateur || ''} disabled={!canEdit} />
            <Input id="qualiopi_certificat_numero" name="qualiopi_certificat_numero" label="N° certificat Qualiopi" defaultValue={organization.qualiopi_certificat_numero || ''} disabled={!canEdit} />
            <Input id="qualiopi_date_obtention" name="qualiopi_date_obtention" type="date" label="Date d'obtention" defaultValue={organization.qualiopi_date_obtention || ''} disabled={!canEdit} />
            <Input id="qualiopi_date_expiration" name="qualiopi_date_expiration" type="date" label="Date d'expiration" defaultValue={organization.qualiopi_date_expiration || ''} disabled={!canEdit} />
          </div>
        )}

        <div className="mt-4">
          <Input id="numero_datadock" name="numero_datadock" label="N° Datadock (legacy)" defaultValue={organization.numero_datadock || ''} disabled={!canEdit} />
        </div>
      </section>

      {/* Coordonnées bancaires */}
      <section id="banque" className="card p-4 sm:p-6 scroll-mt-20">
        <SectionHeader icon={Landmark} title="Coordonnées bancaires" subtitle="Apparaîtront sur les factures émises" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input id="banque_nom" name="banque_nom" label="Banque" placeholder="BNP Paribas, Crédit Agricole..." defaultValue={organization.banque_nom || ''} disabled={!canEdit} />
          <Input id="banque_titulaire" name="banque_titulaire" label="Titulaire du compte" defaultValue={organization.banque_titulaire || ''} disabled={!canEdit} />
          <Input id="banque_iban" name="banque_iban" label="IBAN" placeholder="FR76 1234 5678 9012 3456 7890 123" defaultValue={organization.banque_iban || ''} disabled={!canEdit} />
          <Input id="banque_bic" name="banque_bic" label="BIC / SWIFT" defaultValue={organization.banque_bic || ''} disabled={!canEdit} />
        </div>
      </section>

      {/* Affacturage */}
      <section id="affacturage" className="card p-4 sm:p-6 scroll-mt-20">
        <SectionHeader
          icon={Landmark}
          title="Affacturage"
          subtitle="Quand les créances sont cédées à un factor, c'est son compte qui doit figurer sur les factures, pas celui de l'organisme"
        />
        <label className="flex items-start gap-3 mb-4 cursor-pointer min-h-[40px]">
          <input
            type="checkbox"
            name="affacturage_actif"
            defaultChecked={!!organization.affacturage_actif}
            disabled={!canEdit}
            className="h-5 w-5 mt-0.5 shrink-0 rounded border-surface-300 accent-[#205040]"
          />
          <span className="text-sm text-surface-700">
            Les factures sont cédées à un factor : imprimer ses coordonnées et la clause de subrogation
          </span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input id="affacturage_societe" name="affacturage_societe" label="Société d'affacturage" placeholder="Bibby Factor" defaultValue={organization.affacturage_societe || ''} disabled={!canEdit} />
          <Input id="affacturage_compte" name="affacturage_compte" label="Compte (libellé imprimé)" placeholder="LCL N° 30002 01958 0000062140E 87" defaultValue={organization.affacturage_compte || ''} disabled={!canEdit} />
          <Input id="affacturage_iban" name="affacturage_iban" label="IBAN du factor" placeholder="FR77 3000 2019 5800 0006 2140 E87" defaultValue={organization.affacturage_iban || ''} disabled={!canEdit} />
          <Input id="affacturage_bic" name="affacturage_bic" label="BIC / SWIFT du factor" placeholder="CRLYFRPP" defaultValue={organization.affacturage_bic || ''} disabled={!canEdit} />
        </div>
        <div className="mt-4">
          <label htmlFor="affacturage_mention" className="block text-sm font-medium text-surface-700 mb-1.5">
            Clause imprimée sur la facture
          </label>
          <textarea
            id="affacturage_mention"
            name="affacturage_mention"
            rows={3}
            disabled={!canEdit}
            defaultValue={organization.affacturage_mention || ''}
            placeholder="Laissez vide pour la clause type : « Pour être libératoire, votre règlement doit être effectué directement à l'ordre de … »"
            className="input-base w-full text-sm"
          />
        </div>
      </section>

      {canEdit && (
        <div className="flex justify-end sticky bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:bottom-4 z-10 mr-14 sm:mr-0">
          <Button type="submit" isLoading={isLoading} icon={<Save className="h-4 w-4" />} className="shadow-lg w-full sm:w-auto">
            Enregistrer les modifications
          </Button>
        </div>
      )}
    </form>
  )
}
