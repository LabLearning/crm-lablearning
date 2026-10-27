'use client'

import { useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Mail, Phone, Building2, MapPin, IdCard, Briefcase, Accessibility, Cake } from '@/components/ui/icons'
import { CopyButton } from '@/components/ui/CopyButton'

/**
 * Aperçu rapide d'un apprenant au survol : les informations administratives
 * clés (naissance, n° sécu, adresse, contrat, handicap) sans quitter la page.
 * Un champ absent s'affiche « Manquant » en rouge — contrôle de complétude
 * du dossier d'un coup d'œil. Rendu en portal position fixed : jamais coupé
 * par un conteneur en overflow. La fiche reste ouverte sous la souris : le
 * téléphone et l'e-mail s'y cliquent et s'y copient, le nom aussi.
 * `complements` : des lignes propres à un module (la POEI : identifiant
 * France Travail, poste visé, heures…), ajoutées à la fin.
 */
interface ApprenantApercu {
  civilite?: string | null
  prenom?: string | null
  nom?: string | null
  email?: string | null
  telephone?: string | null
  entreprise?: string | null
  date_naissance?: string | null
  lieu_naissance?: string | null
  numero_securite_sociale?: string | null
  adresse?: string | null
  code_postal?: string | null
  ville?: string | null
  type_contrat?: string | null
  poste?: string | null
  situation_handicap?: boolean | null
  type_handicap?: string | null
  besoins_adaptation?: string | null
}

const LARGEUR = 320
const HAUTEUR_ESTIMEE = 330

function Manquant() {
  return <span className="text-red-500 font-medium">Manquant</span>
}

function Ligne({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-3.5 w-3.5 text-surface-400 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <span className="text-[10px] uppercase tracking-wider text-surface-400 font-semibold block">{label}</span>
        <span className="text-xs text-surface-700 break-words">{children}</span>
      </div>
    </div>
  )
}

export interface ComplementFiche { icon: any; label: string; valeur: React.ReactNode }

export function ApprenantHoverCard({ apprenant, children, complements = [] }: { apprenant: ApprenantApercu; children: React.ReactNode; complements?: ComplementFiche[] }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ancreRef = useRef<HTMLSpanElement>(null)

  // Chaque ligne ajoutée allonge la fiche : elle s'ouvre au-dessus du nom quand la place manque en dessous
  const hauteur = HAUTEUR_ESTIMEE + complements.length * 46
  const ouvrir = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const r = ancreRef.current?.getBoundingClientRect()
      if (!r) return
      const left = Math.min(Math.max(8, r.left), window.innerWidth - LARGEUR - 8)
      const top = r.bottom + hauteur > window.innerHeight - 8 ? Math.max(8, r.top - hauteur - 6) : r.bottom + 6
      setPos({ top, left })
    }, 250)
  }, [hauteur])

  const fermer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setPos(null), 150)
  }, [])

  const a = apprenant
  const naissance = a.date_naissance
    ? `${new Date(a.date_naissance).toLocaleDateString('fr-FR')}${a.lieu_naissance ? ` à ${a.lieu_naissance}` : ''}`
    : null
  const adresse = [a.adresse, [a.code_postal, a.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')

  return (
    // Au clavier aussi : la fiche s'ouvre quand le lien du nom prend le focus
    <span ref={ancreRef} onMouseEnter={ouvrir} onMouseLeave={fermer} onFocus={ouvrir} onBlur={fermer} className="inline-flex min-w-0">
      {children}
      {pos && typeof document !== 'undefined' && createPortal(
        <div
          onMouseEnter={ouvrir}
          onMouseLeave={fermer}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: LARGEUR, zIndex: 80, maxHeight: 'calc(100vh - 16px)' }}
          className="overflow-y-auto rounded-xl border border-surface-200 bg-white shadow-xl p-4 space-y-2.5"
        >
          <div className="flex items-center gap-2.5 pb-2 border-b border-surface-100">
            <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
              <span className="text-[11px] font-bold text-blue-600">{(a.prenom?.[0] || '')}{(a.nom?.[0] || '')}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-0.5 text-sm font-semibold text-surface-900">
                <span className="truncate">{a.civilite ? `${a.civilite} ` : ''}{a.prenom} {a.nom}</span>
                <CopyButton valeur={[a.prenom, a.nom].filter(Boolean).join(' ')} libelle="le prénom et le nom" />
              </div>
              {a.entreprise && (
                <div className="text-[11px] text-surface-500 truncate flex items-center gap-1">
                  <Building2 className="h-3 w-3 shrink-0" />{a.entreprise}
                </div>
              )}
            </div>
          </div>

          <Ligne icon={Cake} label="Naissance">{naissance || <Manquant />}</Ligne>
          <Ligne icon={IdCard} label="N° sécurité sociale">{a.numero_securite_sociale || <Manquant />}</Ligne>
          <Ligne icon={MapPin} label="Adresse">{adresse || <Manquant />}</Ligne>
          <Ligne icon={Briefcase} label="Contrat / poste">
            {[a.type_contrat, a.poste].filter(Boolean).join(' · ') || <Manquant />}
          </Ligne>
          <Ligne icon={Mail} label="Email">
            {a.email
              ? <span className="inline-flex max-w-full items-center gap-0.5"><a href={`mailto:${a.email}`} className="min-w-0 break-all hover:text-brand-600 hover:underline">{a.email}</a><CopyButton valeur={a.email} libelle="l’email" /></span>
              : <Manquant />}
          </Ligne>
          <Ligne icon={Phone} label="Téléphone">
            {a.telephone
              ? <span className="inline-flex items-center gap-0.5"><a href={`tel:${a.telephone.replace(/[^\d+]/g, '')}`} className="hover:text-brand-600 hover:underline">{a.telephone}</a><CopyButton valeur={a.telephone} format="telephone" libelle="le téléphone" /></span>
              : <Manquant />}
          </Ligne>
          {complements.map((c) => <Ligne key={c.label} icon={c.icon} label={c.label}>{c.valeur}</Ligne>)}
          {a.situation_handicap ? (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 px-2.5 py-2">
              <Accessibility className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                <span className="font-semibold">Situation de handicap</span>
                {a.type_handicap ? ` — ${a.type_handicap}` : ''}
                {a.besoins_adaptation ? <span className="block text-[11px] mt-0.5">{a.besoins_adaptation}</span> : null}
              </div>
            </div>
          ) : null}
        </div>,
        document.body,
      )}
    </span>
  )
}
