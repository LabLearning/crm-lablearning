'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

export async function updateOrganizationAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  if (session.user.role !== 'super_admin') {
    return { success: false, error: 'Accès non autorisé' }
  }

  const get = (key: string) => {
    const v = formData.get(key)
    if (v === null || v === '') return null
    return String(v)
  }

  const updates = {
    name: get('name') || session.organization.name,
    legal_name: get('legal_name'),
    siret: get('siret'),
    address: get('address'),
    postal_code: get('postal_code'),
    city: get('city'),
    phone: get('phone') || get('telephone_contact'),
    email: get('email') || get('email_contact'),
    website: get('website'),
    numero_da: get('numero_da'),
    is_qualiopi: formData.get('is_qualiopi') === 'true',
    // Étendus
    forme_juridique: get('forme_juridique'),
    capital_social: formData.get('capital_social') ? Number(formData.get('capital_social')) : null,
    code_ape: get('code_ape'),
    code_naf: get('code_ape'),  // souvent identique
    numero_tva_intra: get('numero_tva_intra'),
    rcs: get('rcs'),
    representant_legal_civilite: get('representant_legal_civilite'),
    representant_legal_prenom: get('representant_legal_prenom'),
    representant_legal_nom: get('representant_legal_nom'),
    representant_legal_fonction: get('representant_legal_fonction'),
    qualiopi_certificateur: get('qualiopi_certificateur'),
    qualiopi_certificat_numero: get('qualiopi_certificat_numero'),
    qualiopi_date_obtention: get('qualiopi_date_obtention'),
    qualiopi_date_expiration: get('qualiopi_date_expiration'),
    numero_datadock: get('numero_datadock'),
    banque_nom: get('banque_nom'),
    banque_iban: get('banque_iban'),
    banque_bic: get('banque_bic'),
    banque_titulaire: get('banque_titulaire'),
    email_contact: get('email_contact'),
    telephone_contact: get('telephone_contact'),
    referent_handicap_nom: get('referent_handicap_nom'),
    referent_handicap_email: get('referent_handicap_email'),
    referent_handicap_telephone: get('referent_handicap_telephone'),
    delai_acces: get('delai_acces'),
  }

  const supabase = await createServiceRoleClient()
  const { error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', session.organization.id)
  if (error) return { success: false, error: error.message }

  await logAudit({ action: 'update', entity_type: 'organization', entity_id: session.organization.id })
  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard')
  return { success: true }
}
