'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Euro, FileText, GraduationCap, ClipboardCheck, Award, ReceiptEuro,
  Download, Loader2, Check, ShieldCheck,
} from '@/components/ui/icons'
import { useToast } from '@/components/ui'
import { cn } from '@/lib/utils'
import { PoeiSection } from './PoeiSection'
import {
  generateDevisPerCandidatAction,
  generateDevisPrevisionnelPoeiAction,
  generateFacturesPerCandidatPoeiAction,
} from '../actions'

export interface CandidatDoc {
  id: string
  nom: string
  apprenantId: string | null
  devis?: { id: string; numero: string | null } | null
  facture?: { id: string; numero: string | null; status: string } | null
  aGrille?: boolean
  certificatSigne?: boolean
}

/**
 * Tous les documents du dossier, réunis par famille et dans l'ordre du
 * parcours. Ils étaient jusqu'ici dispersés entre l'onglet Candidats (devis,
 * plans de charge, attestations) et l'onglet Facturation (certificats,
 * factures) : on ne savait pas où chercher.
 *
 * Ici on PRODUIT et on TÉLÉCHARGE. L'état de chacun se lit dans Pilotage.
 */
export function PoeiDocuments({
  poeiId, candidats, devisPrevisionnel, formationTerminee,
}: {
  poeiId: string
  candidats: CandidatDoc[]
  devisPrevisionnel?: { id: string; numero: string | null } | null
  formationTerminee: boolean
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = useState<string | null>(null)

  async function lancer(cle: string, fn: () => Promise<any>, succes: string) {
    setBusy(cle)
    const r = await fn()
    setBusy(null)
    if (r?.success) { toast('success', succes); router.refresh() }
    else toast('error', r?.error || 'Erreur')
  }

  const nb = candidats.length
  const nbDevis = candidats.filter((c) => c.devis).length
  const nbFactures = candidats.filter((c) => c.facture).length
  const nbGrilles = candidats.filter((c) => c.aGrille).length
  const nbCertifs = candidats.filter((c) => c.certificatSigne).length

  const familles = [
    {
      cle: 'devis',
      icone: Euro,
      titre: 'Devis',
      sous: 'Adressés à France Travail avant le démarrage',
      compte: `${nbDevis}/${nb}`,
      complet: nb > 0 && nbDevis === nb,
      action: nb > 0
        ? { label: 'Générer les devis manquants', onClick: () => lancer('devis', () => generateDevisPerCandidatAction(poeiId), 'Devis générés') }
        : { label: 'Devis prévisionnel', onClick: () => lancer('devis', () => generateDevisPrevisionnelPoeiAction(poeiId), 'Devis prévisionnel généré') },
      zip: nbDevis > 0 ? `/api/pdf/poei-devis/${poeiId}` : null,
      lien: (c: CandidatDoc) => (c.devis ? { href: `/api/pdf/devis/${c.devis.id}`, texte: c.devis.numero || 'Devis' } : null),
    },
    {
      cle: 'pdc',
      icone: FileText,
      titre: 'Plans de développement des compétences',
      sous: 'Un par candidat, exigé par France Travail',
      compte: `${nb}/${nb}`,
      complet: nb > 0,
      zip: null,
      lien: (c: CandidatDoc) => ({ href: `/api/pdf/pdc/${c.id}`, texte: 'Télécharger' }),
    },
    {
      cle: 'attestation',
      icone: GraduationCap,
      titre: "Attestations d'entrée en formation",
      sous: 'À remettre au candidat au démarrage',
      compte: `${nb}/${nb}`,
      complet: nb > 0,
      zip: null,
      lien: (c: CandidatDoc) =>
        c.apprenantId ? { href: `/api/pdf/attestation-entree/${c.apprenantId}?poei=${poeiId}&candidat=${c.id}`, texte: 'Télécharger' } : null,
    },
    {
      cle: 'hygiene',
      icone: ShieldCheck,
      titre: "Attestations d'hygiène alimentaire",
      sous: 'Module de 14 heures, arrêté du 12 février 2024',
      compte: `${nb}/${nb}`,
      complet: nb > 0,
      zip: nb > 0 ? `/api/pdf/attestation-hygiene?poei=${poeiId}` : null,
      lien: (c: CandidatDoc) => ({ href: `/api/pdf/attestation-hygiene?poei=${poeiId}&candidat=${c.id}`, texte: 'Télécharger' }),
    },
    {
      cle: 'diplome',
      icone: Award,
      titre: "Diplôme de l'établissement",
      sous: "Document d'affichage au nom de l'établissement et de son équipe",
      compte: nb > 0 ? '1' : '0',
      complet: nb > 0,
      zip: nb > 0 ? `/api/pdf/diplome-etablissement/${poeiId}?poei=1` : null,
      lien: () => null,
    },
    {
      cle: 'grilles',
      icone: ClipboardCheck,
      titre: "Grilles d'évaluation",
      sous: 'Remplies par le formateur pendant la formation',
      compte: `${nbGrilles}/${nb}`,
      complet: nb > 0 && nbGrilles === nb,
      zip: nbGrilles > 0 ? `/api/pdf/poei-grilles/${poeiId}` : null,
      lien: () => null,
    },
    {
      cle: 'certificats',
      icone: Award,
      titre: 'Certificats de réalisation',
      sous: 'Signés par les candidats en fin de parcours',
      compte: `${nbCertifs}/${nb}`,
      complet: nb > 0 && nbCertifs === nb,
      zip: nb > 0 ? `/api/pdf/poei-certificats/${poeiId}` : null,
      lien: (c: CandidatDoc) =>
        c.apprenantId ? { href: `/api/pdf/certificat-realisation/${c.apprenantId}?poei=${poeiId}`, texte: 'Télécharger' } : null,
    },
    {
      cle: 'factures',
      icone: ReceiptEuro,
      titre: 'Factures',
      sous: formationTerminee ? 'Une par candidat, adressée à France Travail' : 'Disponibles une fois la formation terminée',
      compte: `${nbFactures}/${nb}`,
      complet: nb > 0 && nbFactures === nb,
      action: formationTerminee && nb > 0
        ? { label: nbFactures > 0 ? 'Mettre à jour les factures' : 'Générer les factures', onClick: () => lancer('factures', () => generateFacturesPerCandidatPoeiAction(poeiId), 'Factures à jour') }
        : undefined,
      zip: nbFactures > 0 ? `/api/pdf/poei-factures/${poeiId}` : null,
      lien: (c: CandidatDoc) => (c.facture ? { href: `/api/pdf/facture/${c.facture.id}`, texte: c.facture.numero || 'Facture' } : null),
    },
  ]

  return (
    <PoeiSection
      icone={FileText}
      titre="Documents du dossier"
      sous="Produits et téléchargés ici ; leur état se lit dans l'onglet Pilotage."
    >
      <div className="space-y-3">
      <div className="card p-4 flex items-center gap-3 flex-wrap">
        <Download className="h-4 w-4 text-brand-600 shrink-0" />
        <div className="min-w-0 flex-1 basis-[calc(100%-2rem)] sm:basis-auto">
          <div className="text-sm font-heading font-semibold text-surface-900">Dossier complet</div>
          <div className="text-xs text-surface-500">Toutes les familles de documents dans une seule archive, un répertoire par type</div>
        </div>
        <a href={`/api/pdf/poei-dossier/${poeiId}`}
          className="btn-primary inline-flex items-center gap-1.5 !py-1.5 !px-3 text-sm w-full sm:w-auto">
          <Download className="h-4 w-4" /> Tout le dossier (ZIP)
        </a>
      </div>

      {devisPrevisionnel && (
        <div className="card p-4 flex items-center gap-3 flex-wrap">
          <Euro className="h-4 w-4 text-surface-500 shrink-0" />
          <span className="text-sm text-surface-700 flex-1 basis-[calc(100%-2rem)] sm:basis-auto">
            Devis prévisionnel {devisPrevisionnel.numero || ''}, établi avant l&apos;identification des candidats
          </span>
          <a href={`/api/pdf/devis/${devisPrevisionnel.id}`} target="_blank" rel="noreferrer"
            className="btn-secondary inline-flex items-center gap-1.5 !py-1.5 !px-3 text-sm w-full sm:w-auto">
            <Download className="h-4 w-4" /> Télécharger
          </a>
        </div>
      )}

      {familles.map((f) => {
        const Icone = f.icone
        return (
          <div key={f.cle} className="card overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-3 flex-wrap border-b border-surface-100">
              <Icone className={cn('h-4 w-4 shrink-0', f.complet ? 'text-success-500' : 'text-surface-400')} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-heading font-semibold text-surface-900">{f.titre}</div>
                <div className="text-xs text-surface-500">{f.sous}</div>
              </div>
              <span className={cn(
                'text-xs font-semibold px-2 py-0.5 rounded-full shrink-0',
                f.complet ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700',
              )}>
                {f.compte}
              </span>
              {(f.action || f.zip) && (
                /* Sur téléphone les boutons se partagent une rangée pleine largeur */
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {f.action && (
                    <button onClick={f.action.onClick} disabled={busy === f.cle}
                      className="btn-secondary inline-flex items-center gap-1.5 !py-1.5 !px-3 text-sm disabled:opacity-50 flex-1 sm:flex-none">
                      {busy === f.cle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      {f.action.label}
                    </button>
                  )}
                  {f.zip && (
                    <a href={f.zip} className="btn-secondary inline-flex items-center gap-1.5 !py-1.5 !px-3 text-sm flex-1 sm:flex-none">
                      <Download className="h-4 w-4" /> Tout (ZIP)
                    </a>
                  )}
                </div>
              )}
            </div>

            {candidats.length > 0 && (
              <div className="px-4 py-2.5 flex flex-wrap gap-x-4 gap-y-0 sm:gap-y-1.5">
                {candidats.map((c) => {
                  const l = f.lien(c)
                  return l ? (
                    <a key={c.id} href={l.href} target="_blank" rel="noreferrer"
                      className="inline-flex items-center min-h-[40px] sm:min-h-0 text-xs text-brand-600 hover:underline whitespace-nowrap">
                      {c.nom}
                    </a>
                  ) : (
                    <span key={c.id} className="inline-flex items-center min-h-[40px] sm:min-h-0 text-xs text-surface-300 whitespace-nowrap">{c.nom}</span>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
      </div>
    </PoeiSection>
  )
}
