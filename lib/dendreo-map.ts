// Mapping Dendreo → CRM pour la synchronisation temps réel (webhooks).
// Upsert par dendreo_id : insère si absent, met à jour les champs sourcés sinon.
// Entités gérées : entreprise, contact, participant, formateur, module, facture.

import { createServiceRoleClient } from '@/lib/supabase/server'

const ORG = process.env.DENDREO_DEFAULT_ORG || 'ff747dfe-c034-44d8-98d7-e53892263fb5'
const clean = (v: any) => { const s = (v ?? '').toString().trim(); return s || null }
const num = (v: any) => { const n = Number(v); return isNaN(n) ? null : n }
const day = (s: any) => (s ? String(s).slice(0, 10) : null)
const defined = (o: Record<string, any>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))

async function lookupId(sb: any, table: string, dendreoId: any): Promise<string | null> {
  if (!dendreoId || String(dendreoId) === '0') return null
  const { data } = await sb.from(table).select('id').eq('organization_id', ORG).eq('dendreo_id', String(dendreoId)).maybeSingle()
  return data?.id || null
}

interface Mapped { table: string; dendreoId: string; row: Record<string, any>; required: string[] }

async function mapResource(sb: any, resource: string, o: any): Promise<Mapped | null> {
  switch (resource) {
    case 'entreprise': {
      const raison = clean(o.raison_sociale) || clean(o.appellation) || [clean(o.prenom), clean(o.nom)].filter(Boolean).join(' ')
      return { table: 'clients', dendreoId: String(o.id_entreprise), required: ['raison_sociale'], row: defined({
        organization_id: ORG, dendreo_id: String(o.id_entreprise), type: 'entreprise',
        raison_sociale: raison, siret: clean(o.siret), tva_intra: clean(o.num_tva_intra),
        forme_juridique: clean(o.statut_juridique), sigle: clean(o.sigle),
        code_naf: clean(o.ape_code), secteur_activite: clean(o.code_naf && o.code_naf.intitule),
        adresse: clean(o.adresse), code_postal: clean(o.code_postal), ville: clean(o.ville),
        telephone: clean(o.telephone), email: clean(o.email_standard), site_web: clean(o.site_internet),
        pays: clean(o.pays), financeur_type: ({ 'Models\\Opca': 'opco', 'Models\\Entreprise': 'entreprise' } as any)[o.financeur_type] || undefined,
      }) }
    }
    case 'contact': {
      return { table: 'contacts', dendreoId: String(o.id_contact), required: ['nom'], row: defined({
        organization_id: ORG, dendreo_id: String(o.id_contact),
        client_id: await lookupId(sb, 'clients', o.id_entreprise),
        civilite: clean(o.civilite), nom: clean(o.nom), prenom: clean(o.prenom) || '',
        email: clean(o.email), telephone: clean(o.telephone_direct), mobile: clean(o.portable), poste: clean(o.fonction),
      }) }
    }
    case 'participant': {
      return { table: 'apprenants', dendreoId: String(o.id_participant), required: ['nom'], row: defined({
        organization_id: ORG, dendreo_id: String(o.id_participant),
        client_id: await lookupId(sb, 'clients', o.id_entreprise),
        civilite: clean(o.civilite), nom: clean(o.nom), prenom: clean(o.prenom) || '',
        email: clean(o.email), telephone: clean(o.portable), date_naissance: clean(o.date_de_naissance),
        poste: clean(o.fonction), statut_bpf: clean(o.statut_bpf), entreprise: clean(o.catalogue_entreprise),
      }) }
    }
    case 'formateur': {
      const salarie = ['Interne', 'CDI', 'CDD', 'Apprenti'].includes(o.statut)
      return { table: 'formateurs', dendreoId: String(o.id_formateur), required: ['nom'], row: defined({
        organization_id: ORG, dendreo_id: String(o.id_formateur),
        civilite: clean(o.civilite), nom: clean(o.nom), prenom: clean(o.prenom) || '',
        email: clean(o.email_pro) || clean(o.email_perso), telephone: clean(o.telephone_pro) || clean(o.telephone_perso),
        siret: clean(o.siret), numero_da: clean(o.num_da), adresse: clean(o.adresse), code_postal: clean(o.code_postal), ville: clean(o.ville),
        type_contrat: salarie ? 'salarie' : 'sous_traitance', is_active: true,
      }) }
    }
    case 'module': {
      return { table: 'formations', dendreoId: String(o.id_module), required: ['intitule'], row: defined({
        organization_id: ORG, dendreo_id: String(o.id_module),
        reference: clean(o.numero_complet) || clean(o.numero), intitule: clean(o.intitule) || clean(o.intitule_court),
        categorie: clean(o.categorie && o.categorie.intitule),
        duree_heures: num(o.duree_heures) ?? 0, duree_jours: num(o.duree_jours),
        objectifs_pedagogiques: clean(o.objectif) ? [clean(o.objectif)] : undefined,
        prerequis: clean(o.pre_requis), public_vise: clean(o.public_vise),
        methodes_pedagogiques: clean(o.modalites_pedagogiques), moyens_techniques: clean(o.moyens_supports_pedagogiques),
        modalites_evaluation: clean(o.modalites_devaluation), accessibilite_handicap: clean(o.accessibilite),
        programme_detaille: clean(String(o.description || '').replace(/<\s*li[^>]*>/gi, '\n• ').replace(/<\s*\/\s*(p|div|h[1-6]|tr)\s*>/gi, '\n').replace(/<\s*br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').split('\n').map((l) => l.trim()).filter((l) => l && l !== '•').join('\n')),
        tarif_inter_ht: num(o.prix), tarif_intra_ht: num(o.prix_intra), modalites_admission: clean(o.infos_admission), is_active: true,
      }) }
    }
    case 'facture': {
      const clientId = await lookupId(sb, 'clients', o.id_entreprise)
      const ht = num(o.montant_total_ht), ttc = num(o.montant_total_ttc), tva = num(o.montant_total_tva), paye = num(o.montant_paiements) || 0
      const today = new Date().toISOString().slice(0, 10)
      const status = (ttc && paye >= ttc) ? 'payee' : paye > 0 ? 'payee_partiellement' : (day(o.date_echeance) && day(o.date_echeance)! < today) ? 'en_retard' : 'emise'
      return { table: 'factures', dendreoId: String(o.id_facture), required: ['numero'], row: defined({
        organization_id: ORG, dendreo_id: String(o.id_facture),
        numero: clean(o.numero_complet) || clean(o.numero) || `DENDREO-${o.id_facture}`,
        type: (o.id_avoir && o.id_avoir !== '0' && o.id_parent) ? 'avoir' : 'facture',
        client_id: clientId, status,
        date_emission: day(o.date_emission), date_echeance: day(o.date_echeance),
        montant_ht: ht, montant_ttc: ttc, montant_tva: tva, montant_paye: paye,
        montant_restant: ttc != null ? Math.max(0, ttc - paye) : null,
        financeur_nom: !clientId ? clean(o.raison_sociale) : null,
      }) }
    }
    default:
      return null
  }
}

const DBASE = process.env.DENDREO_API_BASE || `https://pro.dendreo.com/${process.env.DENDREO_SLUG || 'lab_learning'}/api`
const DKEY = process.env.DENDREO_API_KEY || ''

async function fetchAction(id: string | number): Promise<any | null> {
  const r = await fetch(`${DBASE}/actions_de_formation.php?id_action_de_formation=${id}&key=${DKEY}`, { headers: { Accept: 'application/json' } })
  if (!r.ok) return null
  const d = await r.json()
  return Array.isArray(d) ? d[0] : d
}
async function formationIdByName(sb: any, intitule: string | null): Promise<string | null> {
  if (!intitule) return null
  const { data } = await sb.from('formations').select('id').eq('organization_id', ORG).ilike('intitule', intitule).limit(1).maybeSingle()
  return data?.id || null
}

/**
 * Synchronise une action de formation : upsert de la session (par dendreo_id) +
 * réconciliation des inscriptions (depuis le tableau participants du détail).
 */
async function syncAction(sb: any, actionId: string): Promise<{ status: 'processed' | 'ignored' | 'error'; error?: string }> {
  const a = await fetchAction(actionId)
  if (!a) return { status: 'error', error: 'action introuvable' }

  const clientId = await lookupId(sb, 'clients', a.id_entreprise)
  const fdid = a.formateurs && a.formateurs[0] && a.formateurs[0].id_formateur
  const formateurId = fdid ? await lookupId(sb, 'formateurs', fdid) : null
  const formationId = await formationIdByName(sb, clean(a.intitule)) || await formationIdByName(sb, clean(a.formation))
  const past = a.date_fin && new Date(a.date_fin) < new Date()

  const { data: sess } = await sb.from('sessions').select('id').eq('organization_id', ORG).eq('dendreo_id', String(actionId)).maybeSingle()
  const base = defined({
    client_id: clientId, formateur_id: formateurId, intitule: clean(a.intitule),
    reference: clean(a.numero_complet) || clean(a.numero),
    date_debut: day(a.date_debut) || day(a.date_effective_debut),
    date_fin: day(a.date_fin) || day(a.date_effective_fin) || day(a.date_debut),
    places_min: num(a.nb_participants_min), places_max: num(a.nb_participants_max),
  })

  if (sess) {
    if (formationId) (base as any).formation_id = formationId
    await sb.from('sessions').update(base).eq('id', sess.id)
  } else {
    if (!formationId) return { status: 'ignored' } // pas de formation correspondante → on n'insère pas
    await sb.from('sessions').insert({
      organization_id: ORG, dendreo_id: String(actionId), formation_id: formationId,
      status: past ? 'terminee' : 'confirmee', type_session: a.mode_organisation === 'intra' ? 'intra' : 'inter',
      notes_internes: '[Dendreo]', ...base,
    })
  }
  const { data: s2 } = await sb.from('sessions').select('id,status').eq('organization_id', ORG).eq('dendreo_id', String(actionId)).maybeSingle()
  if (!s2) return { status: 'error', error: 'session non créée' }

  // Réconciliation des inscriptions
  const parts = Array.isArray(a.participants) ? a.participants : []
  if (parts.length) {
    const { data: existing } = await sb.from('inscriptions').select('apprenant_id').eq('session_id', s2.id)
    const have = new Set((existing || []).map((e: any) => e.apprenant_id))
    const st = s2.status === 'terminee' ? 'complete' : s2.status === 'en_cours' ? 'en_cours' : 'confirme'
    const rows: any[] = []
    for (const p of parts) {
      const apprId = await lookupId(sb, 'apprenants', p.id_participant)
      if (apprId && !have.has(apprId)) rows.push({ organization_id: ORG, session_id: s2.id, apprenant_id: apprId, status: st, date_inscription: day(p.date_add) })
    }
    if (rows.length) await sb.from('inscriptions').insert(rows)
  }
  return { status: 'processed' }
}

/** Applique un événement Dendreo au CRM. Retourne le statut de traitement. */
export async function applyDendreoEvent(resource: string, verb: string, obj: any): Promise<{ status: 'processed' | 'ignored' | 'error'; error?: string }> {
  if (!obj || typeof obj !== 'object') return { status: 'ignored' }
  const sb = await createServiceRoleClient()

  // Actions de formation → session + inscriptions (re-fetch du détail complet)
  if (resource === 'action_de_formation' || resource === 'action') {
    if (verb === 'deleted' || verb === 'delete') return { status: 'ignored' }
    const id = obj.id_action_de_formation || obj.id
    if (!id) return { status: 'ignored' }
    return syncAction(sb, String(id))
  }

  const mapped = await mapResource(sb, resource, obj).catch((e) => { throw e })
  if (!mapped) return { status: 'ignored' } // ressource non gérée

  // Suppression : on ne supprime pas automatiquement (CRM fait foi). Journalisé seulement.
  if (verb === 'deleted' || verb === 'delete') return { status: 'ignored' }

  if (!mapped.dendreoId || mapped.dendreoId === 'undefined') return { status: 'ignored' }
  // champ requis présent ?
  for (const r of mapped.required) if (!mapped.row[r]) return { status: 'ignored' }

  try {
    const { data: existing } = await sb.from(mapped.table).select('id').eq('organization_id', ORG).eq('dendreo_id', mapped.dendreoId).maybeSingle()
    if (existing) {
      const { error } = await sb.from(mapped.table).update(mapped.row).eq('id', existing.id)
      if (error) return { status: 'error', error: error.message }
    } else {
      const { error } = await sb.from(mapped.table).insert(mapped.row)
      if (error) return { status: 'error', error: error.message }
    }
    return { status: 'processed' }
  } catch (e: any) {
    return { status: 'error', error: String(e?.message || e) }
  }
}
