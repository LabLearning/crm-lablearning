'use server'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { emettreCode, utilisateurAutorise, verifierDemande } from '@/lib/connecteur-claude/oauth'
import { logAudit } from '@/lib/audit'

// Accord ou refus de la page /oauth/authorize. La demande est revérifiée de
// bout en bout : les champs cachés du formulaire ne sont jamais crus.

const CHAMPS = ['response_type', 'client_id', 'redirect_uri', 'code_challenge', 'code_challenge_method', 'state', 'scope', 'resource']
const lire = (f: FormData) => Object.fromEntries(CHAMPS.map((k) => [k, String(f.get(k) ?? '')]))

export async function autoriserClaudeAction(formulaire: FormData) {
  const service = await createServiceRoleClient()
  const v = await verifierDemande(service, lire(formulaire))
  if (!v.ok) redirect(v.redirection || '/dashboard/settings')
  const { data: { user } } = await (await createServerSupabaseClient()).auth.getUser()
  const u = await utilisateurAutorise(service, user?.id)
  if (u.etat !== 'ok') {
    // Panne de la base ou compte sans le droit : rien n'est émis, l'erreur repart vers Claude
    const e = new URL(v.demande.redirect_uri)
    e.searchParams.set('error', u.etat === 'indisponible' ? 'temporarily_unavailable' : 'access_denied')
    if (v.demande.state) e.searchParams.set('state', v.demande.state)
    redirect(e.toString())
  }
  const retour = await emettreCode(service, v.demande, u.user)
  if (!retour) {
    const e = new URL(v.demande.redirect_uri)
    e.searchParams.set('error', 'server_error')
    if (v.demande.state) e.searchParams.set('state', v.demande.state)
    redirect(e.toString())
  }
  await logAudit({ action: 'autoriser_claude', entity_type: 'connecteur', details: { application: v.demande.client_name, retour: new URL(v.demande.redirect_uri).hostname } })
  redirect(retour)
}

export async function refuserClaudeAction(formulaire: FormData) {
  const service = await createServiceRoleClient()
  const v = await verifierDemande(service, lire(formulaire))
  if (!v.ok) redirect(v.redirection || '/dashboard/settings')
  const e = new URL(v.demande.redirect_uri)
  e.searchParams.set('error', 'access_denied')
  e.searchParams.set('error_description', 'accès refusé')
  if (v.demande.state) e.searchParams.set('state', v.demande.state)
  redirect(e.toString())
}
