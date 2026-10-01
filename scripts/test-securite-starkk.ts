/**
 * Tests de sécurité des actions de Starkk, sur la vraie base (lecture, plus
 * quelques lignes d'audit de test supprimées à la fin ; aucune action exécutée).
 *
 *   npx tsx --tsconfig tsconfig.json scripts/test-securite-starkk.ts
 *
 * Couvre : jeton signé (falsification, expiration, autre compte), permission
 * par action et listes de rôles de l'interface, portefeuille du commercial,
 * périmètre de l'organisation, exécution unique (y compris en rafale), gardes
 * métier (transitions de statut, POEI, feuille d'émargement validée).
 * Quelques cas s'appuient sur des sessions réelles : s'ils changent d'état,
 * mettre à jour les identifiants.
 */
import fs from 'fs'
// Variables d'environnement du projet (avant tout import du code)
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  if (!l.includes('=') || l.startsWith('#')) continue
  const i = l.indexOf('=')
  process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^"|"$/g, '')
}
const ORG = 'ff747dfe-c034-44d8-98d7-e53892263fb5'
const USER = '16a538a0-ca4e-42f1-b2a0-354aea73ca46'
let echecs = 0
const ok = (cond: boolean, nom: string, info?: unknown) => { console.log(cond ? 'OK  ' : 'ÉCHEC', nom, cond ? '' : JSON.stringify(info)); if (!cond) echecs++ }

async function main() {
  const P = await import('@/lib/assistant/propositions')
  const { createServiceRoleClient } = await import('@/lib/supabase/server')
  const sb = await createServiceRoleClient()

  // 1. Signature et vérification
  const { id, jeton } = P.signerProposition({ type: 'action_relancer_facture', params: { facture_id: 'x', libelle: 'test' }, org: ORG, user: USER })
  let v = P.verifierProposition(jeton, { orgId: ORG, userId: USER })
  ok(v.ok && v.proposition.id === id && v.proposition.type === 'action_relancer_facture', 'jeton valide accepté', v)
  v = P.verifierProposition(jeton, { orgId: ORG, userId: '00000000-0000-4000-8000-000000000000' })
  ok(!v.ok && v.statut === 403, 'autre utilisateur refusé (403)', v)
  v = P.verifierProposition(jeton, { orgId: '00000000-0000-4000-8000-000000000000', userId: USER })
  ok(!v.ok && v.statut === 403, 'autre organisation refusée (403)', v)

  // 2. Falsifications
  const [charge, sig] = jeton.split('.')
  const contenu = JSON.parse(Buffer.from(charge, 'base64url').toString('utf8'))
  const chargeModifiee = Buffer.from(JSON.stringify({ ...contenu, params: { facture_id: 'autre' } })).toString('base64url')
  v = P.verifierProposition(`${chargeModifiee}.${sig}`, { orgId: ORG, userId: USER })
  ok(!v.ok && v.statut === 400, 'paramètres modifiés refusés', v)
  const typeModifie = Buffer.from(JSON.stringify({ ...contenu, type: 'action_marquer_paiement' })).toString('base64url')
  v = P.verifierProposition(`${typeModifie}.${sig}`, { orgId: ORG, userId: USER })
  ok(!v.ok && v.statut === 400, 'type modifié refusé', v)
  v = P.verifierProposition(`${charge}.${sig.slice(0, -2)}AA`, { orgId: ORG, userId: USER })
  ok(!v.ok && v.statut === 400, 'signature modifiée refusée', v)
  for (const mauvais of [undefined, 42, '', 'abc', 'a.b.c', `${charge}.`, `.${sig}`, `${charge}.${sig}.x`]) {
    v = P.verifierProposition(mauvais as any, { orgId: ORG, userId: USER })
    ok(!v.ok && v.statut === 400, `jeton malformé refusé (${String(mauvais).slice(0, 12)})`, v)
  }
  // Clé différente (STARKK_SECRET posé après signature) : refus
  process.env.STARKK_SECRET = 'autre-secret'
  v = P.verifierProposition(jeton, { orgId: ORG, userId: USER })
  ok(!v.ok && v.statut === 400, 'jeton signé avec une autre clé refusé', v)
  delete process.env.STARKK_SECRET

  // 3. Expiration
  const maintenant = Date.now
  Date.now = () => maintenant() + 25 * 3600 * 1000
  v = P.verifierProposition(jeton, { orgId: ORG, userId: USER })
  ok(!v.ok && v.statut === 410, 'jeton de plus de 24 h refusé (410)', v)
  Date.now = maintenant

  // 4. Permissions par action
  const { data: perms } = await sb.from('permissions').select('*').eq('organization_id', ORG)
  const de = (role: string) => (perms || []).filter((p: any) => p.role === role) as any[]
  ok(P.actionAutorisee('action_marquer_paiement', 'super_admin', []), 'super_admin autorisé même sans ligne de permission')
  ok(P.actionAutorisee('action_creer_session', 'gestionnaire', []), 'gestionnaire autorisé')
  ok(P.actionAutorisee('action_relancer_facture', 'commercial', de('commercial')), 'commercial (CRUD partout) autorisé')
  ok(P.actionAutorisee('action_creer_devis', 'directeur_commercial', de('directeur_commercial')), 'directeur commercial peut créer un devis')
  ok(P.actionAutorisee('action_modifier_client', 'directeur_commercial', de('directeur_commercial')), 'directeur commercial peut modifier un client')
  ok(!P.actionAutorisee('action_marquer_paiement', 'directeur_commercial', de('directeur_commercial')), 'directeur commercial ne peut pas enregistrer un paiement')
  ok(!P.actionAutorisee('action_changer_statut_session', 'directeur_commercial', de('directeur_commercial')), 'directeur commercial ne peut pas changer un statut de session (lecture seule)')
  ok(!P.actionAutorisee('action_envoyer_convention', 'directeur_commercial', de('directeur_commercial')), 'directeur commercial ne peut pas envoyer une convention')
  ok(!P.actionAutorisee('action_inexistante', 'super_admin', []), 'action inconnue refusée même au super_admin')
  ok(!P.actionAutorisee('action_creer_session', 'commercial', []), 'rôle restreint sans ligne de permission refusé')


  // 4 bis. Listes de rôles de l'interface et portefeuille commercial
  ok(!P.actionAutorisee('action_enregistrer_accord_pec', 'commercial', de('commercial')), 'commercial ne peut pas enregistrer un accord de prise en charge (réservé dans l’interface)')
  ok(!P.actionAutorisee('action_envoyer_convocation', 'commercial', de('commercial')), 'commercial ne se voit plus proposer la convocation (refusée par l’interface)')
  ok(!P.actionAutorisee('action_generer_facture_opco', 'commercial', de('commercial')), 'commercial ne se voit plus proposer la facture OPCO')
  ok(P.actionAutorisee('action_enregistrer_accord_pec', 'gestionnaire', []), 'gestionnaire garde l’accord de prise en charge')
  ok(P.actionAutorisee('action_envoyer_convention', 'commercial', de('commercial')), 'commercial garde l’envoi de convention')
  const { data: com } = await sb.from('users').select('id, role').eq('role', 'commercial').eq('organization_id', ORG).limit(1).maybeSingle()
  if (com) {
    const { data: siens } = await sb.from('clients').select('id').eq('organization_id', ORG).eq('assigned_to', com.id).limit(1)
    const { data: autres } = await sb.from('clients').select('id').eq('organization_id', ORG).neq('assigned_to', com.id).limit(1)
    const autre = autres?.[0]?.id
    if (autre && !(await P.clientDansPortefeuille(autre, ORG, com.id))) {
      const c1 = await P.controlerAction({ type: 'action_modifier_client', params: { client_id: autre, champs: { ville: 'X' } }, orgId: ORG, user: com, permissions: de('commercial') })
      ok(!c1.ok && c1.statut === 403, 'commercial refusé sur un client hors portefeuille', c1)
      const O = await import('@/lib/assistant/outils')
      const lu = await O.executerOutil('detail_client', { client_id: autre }, ORG, com)
      ok(!!lu?.erreur && !lu?.client, 'fiche client hors portefeuille refusée au commercial (lecture)', lu)
      const luAdmin = await O.executerOutil('detail_client', { client_id: autre }, ORG, { id: USER, role: 'super_admin' })
      ok(!!luAdmin?.client, 'même fiche lisible par un super_admin', luAdmin?.erreur)
    } else console.log('     (pas de client hors portefeuille pour le test)')
    if (siens?.[0]) {
      const c2 = await P.controlerAction({ type: 'action_modifier_client', params: { client_id: siens[0].id, champs: { ville: 'X' } }, orgId: ORG, user: com, permissions: de('commercial') })
      ok(c2.ok, 'commercial autorisé sur son propre client', c2)
    } else console.log('     (le commercial n’a aucun client assigné : cas « son client » non testé)')
  }
  const sa = await P.controlerAction({ type: 'action_modifier_client', params: { client_id: '11111111-1111-4111-8111-111111111111' }, orgId: ORG, user: { id: USER, role: 'super_admin' }, permissions: [] })
  ok(!sa.ok && sa.statut === 404, 'cible inconnue : 404 même pour un super_admin', sa)
  // Garde d'executerAction : une session inconnue est refusée avant tout effet
  const A = await import('@/lib/assistant/actions-outils')
  const ex = await A.executerAction('action_envoyer_convocation', { session_id: '11111111-1111-4111-8111-111111111111' }, ORG, USER)
  ok(!ex.success && /introuvable/i.test(ex.message), 'executerAction refuse une session hors organisation avant tout effet', ex)


  // 7. Gardes métier d'executerAction (refus avant toute écriture)
  const T = await import('@/lib/assistant/actions-outils')
  const st1 = await T.executerAction('action_changer_statut_session', { session_id: '79db99e3-418f-431c-9bac-540c924f7cdd', statut: 'en_cours' }, ORG, USER)
  ok(!st1.success && /ne change plus/.test(st1.message), 'session terminée : retour en cours refusé', st1)
  const st2 = await T.executerAction('action_changer_statut_session', { session_id: '61611e70-50ef-4b36-b2ec-d9a651816775', statut: 'terminee' }, ORG, USER)
  ok(!st2.success && /POEI/.test(st2.message), 'session support POEI (intervention) refusée', st2)
  const st3 = await T.executerAction('action_changer_statut_session', { session_id: 'fc887c2b-eb9d-4b97-8ee4-e6eed7956ab7', statut: 'terminee' }, ORG, USER)
  ok(!st3.success && /POEI/.test(st3.message), 'session chapeau POEI refusée', st3)
  ok(!P.actionAutorisee('action_poser_presence', 'commercial', de('commercial')), 'pointage refusé au commercial (comme l’interface)')
  ok(P.actionAutorisee('action_poser_presence', 'gestionnaire', []), 'pointage permis au gestionnaire')
  // Verrou : uniquement si un échec du garde ne changerait rien en base
  const SID = '10d0ac71-80eb-498c-97a6-0d994ca4db98', AID = '0b9428b2-4fb7-4a70-bc98-8224d2936989', JOUR = '2026-08-18'
  const { data: lignes } = await sb.from('emargements').select('id, creneau, est_present, motif_absence, signature_data').eq('session_id', SID).eq('apprenant_id', AID).eq('date', JOUR)
  const { data: fv } = await sb.from('emargement_feuilles').select('creneau').eq('session_id', SID).eq('date', JOUR).not('validated_at', 'is', null)
  const verrouillee = (c: string) => (fv || []).some((v: any) => v.creneau === c || v.creneau === 'journee' || c === 'journee')
  const sansRisque = (lignes || []).every((l: any) => l.signature_data || verrouillee(l.creneau) || (l.est_present === true && l.motif_absence === null))
  if (sansRisque && (lignes || []).some((l: any) => !l.signature_data && verrouillee(l.creneau))) {
    const avant = JSON.stringify(lignes)
    const pr = await T.executerAction('action_poser_presence', { session_id: SID, apprenant_id: AID, date: JOUR, present: true }, ORG, USER)
    const { data: apres } = await sb.from('emargements').select('id, creneau, est_present, motif_absence, signature_data').eq('session_id', SID).eq('apprenant_id', AID).eq('date', JOUR)
    const touchees = (lignes || []).filter((l: any) => !l.signature_data && !verrouillee(l.creneau)).length
    ok(touchees ? pr.success : (!pr.success && /feuille validée/.test(pr.message)), 'créneau d’une feuille validée non modifiable', pr)
    ok(JSON.stringify(apres) === avant, 'aucune ligne modifiée en base', { avant, apres })
  } else console.log('     (cas du verrou non testé : un échec pourrait modifier une ligne)')
  // Détails affichés sur la carte
  // 8. Schéma strict : la carte affiche exactement ce qui sera exécuté
  const N = (t: string, b: any) => P.normaliserParams(t, b)
  const UUIDT = '11111111-1111-4111-8111-111111111111'
  let n: any = N('action_modifier_client', { client_id: UUIDT, champs: { email: 'pirate@exemple.fr', '0': '', '1': '' } })
  ok(!n.ok && /non modifiable/.test(n.message), 'champs : clé non autorisée refusée (pas de modification cachée)', n)
  n = N('action_modifier_client', { client_id: UUIDT, champs: { email: 'pas-un-email' } })
  ok(!n.ok, 'champs : email invalide refusé', n)
  n = N('action_modifier_client', { client_id: UUIDT, champs: { email: 'A@B.fr', ville: 'Lyon', telephone: '0601020304', adresse: '1 rue X', code_postal: '69001', financeur_type: 'opco' } })
  const lignesCli = n.ok ? P.detailsAffiches('action_modifier_client', n.params) : []
  ok(n.ok && lignesCli.length === 1 && ['email → A@B.fr', 'ville → Lyon', 'téléphone → 0601020304', 'adresse → 1 rue X', 'code postal → 69001', 'financeur → opco'].every((x) => lignesCli[0].includes(x)), 'champs : les 6 modifications affichées, aucune tronquée', lignesCli)
  n = N('action_generer_facture_opco', { session_id: UUIDT, forcer: 'false' })
  ok(n.ok && n.params.forcer === false && !P.detailsAffiches('action_generer_facture_opco', n.params).some((l) => l.startsWith('Forcer')), 'forcer "false" : non forcé, rien d’affiché, cohérent', n)
  n = N('action_generer_facture_opco', { session_id: UUIDT, forcer: 'non' })
  ok(!n.ok, 'forcer ambigu refusé', n)
  n = N('action_generer_facture_opco', { session_id: UUIDT, forcer: true })
  ok(n.ok && P.detailsAffiches('action_generer_facture_opco', n.params).includes('Forcer malgré une facturation Dendreo : oui'), 'forcer true affiché', n)
  n = N('action_changer_statut_session', { session_id: UUIDT, statut: ['annulee'] })
  ok(!n.ok, 'statut en tableau refusé', n)
  n = N('action_poser_presence', { session_id: UUIDT, apprenant_id: UUIDT })
  ok(!n.ok && /present manquant/.test(n.message), 'pointage sans présent/absent refusé', n)
  n = N('action_poser_presence', { session_id: UUIDT, apprenant_id: UUIDT, present: false, motif: 'Malade', date: '2026-03-12' })
  ok(n.ok && JSON.stringify(P.detailsAffiches('action_poser_presence', n.params)) === JSON.stringify(['Pointage : absent', 'Motif : Malade', 'Date : 12 mars 2026']), 'pointage affiché exactement', P.detailsAffiches('action_poser_presence', (n as any).params))
  n = N('action_marquer_paiement', { facture_id: UUIDT, mode: 'virement', montant: 0 })
  ok(!n.ok, 'montant à 0 refusé', n)
  n = N('action_marquer_paiement', { facture_id: UUIDT, mode: 'virement', montant: '1250,5', date_paiement: '2026-09-30', reference: 'VIR 123', inconnu: 'x' })
  ok(n.ok && n.params.montant === 1250.5 && !('inconnu' in n.params) && P.detailsAffiches('action_marquer_paiement', n.params).length === 4, 'paiement : montant, mode, référence, date affichés ; clé inconnue écartée', n)
  n = N('action_creer_session', { formation_id: UUIDT, date_debut: '2026-10-14', date_fin: '2026-10-15', lieu: 'Lyon', prix_ht: 1400 })
  ok(n.ok && ['Début : 14 octobre 2026', 'Fin : 15 octobre 2026', 'Lieu : Lyon'].every((x) => P.detailsAffiches('action_creer_session', n.params).includes(x)), 'création de session : dates et lieu affichés', n)
  n = N('action_creer_session', { formation_id: UUIDT, date_debut: '14/10/2026' })
  ok(!n.ok, 'date mal formée refusée', n)


  // 9. Valeurs figées à la proposition et règles métier
  const fg = await P.figerParams('action_relancer_signatures', {}, ORG)
  if (fg.ok) {
    const per = await P.verifierPerimetre(fg.params, ORG)
    ok(Array.isArray(fg.params.convention_ids) && fg.params.convention_ids.length > 0 && fg.params.convention_ids.length <= 10 && per.ok && /convention/.test(per.cibles[0] || ''), 'relance des signatures : liste figée et affichée', { fg, per })
    console.log('     cibles :', per.ok ? per.cibles : per)
  } else ok(fg.statut === 422, 'relance des signatures : aucune convention en attente', fg)
  const { data: fPayable } = await sb.from('factures').select('id, montant_restant').eq('organization_id', ORG).in('status', ['emise', 'envoyee', 'payee_partiellement', 'en_retard']).gt('montant_restant', 0).limit(1).maybeSingle()
  if (fPayable) {
    const fp = await P.figerParams('action_marquer_paiement', { facture_id: fPayable.id, mode: 'virement' }, ORG)
    ok(fp.ok && fp.params.montant === Math.round(Number(fPayable.montant_restant) * 100) / 100, 'paiement sans montant : reste dû figé et affiché', fp)
    const trop = await T.refusMetier('action_marquer_paiement', { facture_id: fPayable.id, montant: Number(fPayable.montant_restant) + 10 }, ORG)
    ok(!!trop && /dépasse/.test(trop), 'paiement supérieur au reste dû refusé', trop)
  }
  const { data: fPayee } = await sb.from('factures').select('id').eq('organization_id', ORG).eq('status', 'payee').limit(1).maybeSingle()
  if (fPayee) {
    const r = await T.refusMetier('action_marquer_paiement', { facture_id: fPayee.id, montant: 10 }, ORG)
    ok(!!r && /Aucun paiement/.test(r), 'paiement sur facture déjà payée refusé', r)
  }
  const { data: sValidee } = await sb.from('sessions').select('id').eq('organization_id', ORG).eq('status', 'validee').is('poei_intervention_id', null).limit(1).maybeSingle()
  if (sValidee) {
    const r = await T.refusMetier('action_changer_statut_session', { session_id: sValidee.id, statut: 'annulee' }, ORG)
    ok(r === null, 'session validée : annulation permise', r)
  } else console.log('     (aucune session validée pour tester l’annulation)')
  const prep = await P.preparerProposition({ type: 'action_changer_statut_session', brut: { session_id: '79db99e3-418f-431c-9bac-540c924f7cdd', statut: 'en_cours' }, orgId: ORG, user: { id: USER, role: 'super_admin' }, permissions: [] })
  ok(!prep.ok && prep.statut === 422, 'transition impossible refusée dès la proposition (avant la carte)', prep)
  // 10. Droits de lecture des outils
  ok(!P.outilAutorise('analyse_financiere', 'directeur_commercial', de('directeur_commercial')), 'directeur commercial : analyse financière masquée (pas de lecture factures)')
  ok(P.outilAutorise('detail_client', 'directeur_commercial', de('directeur_commercial')), 'directeur commercial : fiche client lisible')
  ok(P.outilAutorise('analyse_financiere', 'commercial', de('commercial')), 'commercial Lab Learning : analyse financière lisible (droits CRUD)')
  const OL = await import('@/lib/assistant/outils')
  const refusLecture = await OL.executerOutil('analyse_financiere', {}, ORG, { id: USER, role: 'directeur_commercial', permissions: de('directeur_commercial') })
  ok(!!refusLecture?.erreur, 'outil de lecture refusé sans le droit de lecture du module', refusLecture)


  // 11. Cohérence : chaque action a sa règle, son schéma et son titre
  const A2 = await import('@/lib/assistant/actions-outils')
  const manques = [...A2.NOMS_ACTIONS].filter((t) => !P.TITRES_ACTIONS[t] || !P.actionAutorisee(t, 'super_admin', []) || (P.normaliserParams(t, {}) as any).message === 'Action inconnue.')
  ok(manques.length === 0, 'chaque action a sa règle de permission, son schéma et son titre fixe', manques)
  const titres = new Set(Object.values(P.TITRES_ACTIONS))
  ok(titres.size === Object.keys(P.TITRES_ACTIONS).length, 'deux actions n’ont jamais le même titre')
  // 12. Facture de session : montant et destinataire figés, changement détecté
  const { data: sFact } = await sb.from('sessions').select('id').eq('organization_id', ORG).not('client_id', 'is', null).or('montant_finance_opco.gt.0,prix_ht.gt.0').limit(1).maybeSingle()
  if (sFact) {
    const fo = await P.figerParams('action_generer_facture_opco', { session_id: sFact.id }, ORG)
    ok(fo.ok && fo.params.montant_ht === undefined && /^(opco|client):/.test(fo.params.destinataire) && P.detailsAffiches('action_generer_facture_opco', fo.params).some((l) => l.startsWith('Adressée à : ')) && P.detailsAffiches('action_generer_facture_opco', fo.params).some((l) => l.includes('celui de l’accord de prise en charge à la confirmation')), 'facture : destinataire figé, montant pris à la confirmation (accord du plan compris)', fo)
    console.log('     détails :', fo.ok ? P.detailsAffiches('action_generer_facture_opco', fo.params) : fo)
    const change = await T.refusMetier('action_generer_facture_opco', { session_id: sFact.id, destinataire: 'opco:00000000-0000-4000-8000-000000000000' }, ORG)
    ok(!!change && /destinataire/.test(change), 'facture : destinataire changé depuis la proposition refusé', change)
  }
  // 13. Pointage voué à l'échec refusé dès la proposition
  const ptg = await T.refusMetier('action_poser_presence', { session_id: '10d0ac71-80eb-498c-97a6-0d994ca4db98', apprenant_id: '0b9428b2-4fb7-4a70-bc98-8224d2936989', date: '2026-08-18', present: true }, ORG)
  ok(!!ptg && /feuille validée/.test(ptg), 'pointage sur feuille validée refusé dès la proposition', ptg)


  // 14. Correctifs du quatrième tour
  const sansCreneau = await T.refusMetier('action_poser_presence', { session_id: '10d0ac71-80eb-498c-97a6-0d994ca4db98', apprenant_id: 'fda97d3c-7ac6-4978-86b0-0ff5af0090da', present: true }, ORG)
  ok(sansCreneau === null, 'pointage sans créneau existant (inscription dans le même plan) : accepté à la proposition', sansCreneau)
  const inconnue = await P.figerParams('action_generer_facture_opco', { session_id: '11111111-1111-4111-8111-111111111111' }, ORG)
  ok(!inconnue.ok && inconnue.statut === 404, 'facture sur session inconnue : 404 (pas « aucun client ni OPCO »)', inconnue)
  const fm = P.normaliserParams('action_generer_facture_opco', { session_id: UUIDT, montant_ht: 1500 })
  ok(fm.ok && P.detailsAffiches('action_generer_facture_opco', { ...(fm as any).params, montant_reference: 1800 }).some((l) => l.replace(/\s/g, ' ') === 'Montant HT facturé : 1 500,00 €'), 'facture : montant donné par le modèle affiché tel quel', fm)

  // 5. Périmètre
  const { data: s } = await sb.from('sessions').select('id').eq('organization_id', ORG).limit(1).single()
  const { data: f } = await sb.from('factures').select('id').eq('organization_id', ORG).limit(1).single()
  const { data: aps } = await sb.from('apprenants').select('id').eq('organization_id', ORG).limit(4)
  let p = await P.verifierPerimetre({ session_id: s!.id, facture_id: f!.id }, ORG)
  ok(p.ok && p.cibles.length === 2, 'session + facture de l’organisation acceptées, cibles lisibles', p)
  console.log('     cibles :', p.ok ? p.cibles : p)
  p = await P.verifierPerimetre({ session_id: '11111111-1111-4111-8111-111111111111' }, ORG)
  ok(!p.ok, 'UUID inconnu refusé', p)
  p = await P.verifierPerimetre({ session_id: s!.id }, '00000000-0000-4000-8000-000000000000')
  ok(!p.ok, 'session d’une autre organisation refusée', p)
  p = await P.verifierPerimetre({ client_id: "x' or 1=1" }, ORG)
  ok(!p.ok, 'identifiant non UUID refusé', p)
  p = await P.verifierPerimetre({ apprenant_ids: (aps || []).map((a: any) => a.id) }, ORG)
  ok(p.ok && p.cibles.length === 1, 'liste de stagiaires acceptée', p)
  console.log('     cibles :', p.ok ? p.cibles : p)
  p = await P.verifierPerimetre({ apprenant_ids: [...(aps || []).map((a: any) => a.id), '11111111-1111-4111-8111-111111111111'] }, ORG)
  ok(!p.ok, 'liste contenant un stagiaire inconnu refusée', p)
  p = await P.verifierPerimetre({ apprenant_ids: 'pas-une-liste' }, ORG)
  ok(!p.ok, 'apprenant_ids non tableau refusé', p)
  p = await P.verifierPerimetre({ raison_sociale: 'Test', libelle: 'x' }, ORG)
  ok(p.ok && p.cibles.length === 0, 'action sans cible (création) acceptée', p)

  // 6. Exécution unique (ligne d'audit de test, supprimée ensuite)
  const prop = { id: (await import('crypto')).randomUUID(), type: 'action_relancer_facture', params: { facture_id: f!.id, libelle: 'TEST sécurité Starkk (à ignorer)' }, org: ORG, user: USER, exp: Date.now() + 1000 }
  const r1 = await P.reserverExecution({ proposition: prop, acteurId: USER })
  const r2 = await P.reserverExecution({ proposition: prop, acteurId: USER })
  const [r3, r4] = await Promise.all([P.reserverExecution({ proposition: { ...prop, id: (await import('crypto')).randomUUID() }, acteurId: USER }), Promise.resolve('n/a')])
  ok(r1 === 'ok', 'première confirmation réservée', r1)
  ok(r2 === 'deja', 'seconde confirmation refusée (déjà confirmée)', r2)
  await P.consignerResultat({ proposition: prop, resultat: { success: true, message: 'test' } })
  const { data: ligne } = await sb.from('audit_logs').select('id, action, entity_id, details, user_id').eq('id', prop.id).single()
  ok(ligne?.details?.statut === 'executee' && ligne?.entity_id === f!.id && ligne?.user_id === USER, 'résultat consigné sur la ligne d’audit', ligne)
  const relu = await P.lireResultat(prop.id, ORG)
  ok(relu?.statut === 'executee' && relu?.success === true && relu?.message === 'test', 'seconde confirmation : le résultat consigné est renvoyé', relu)
  ok((await P.lireResultat(prop.id, '00000000-0000-4000-8000-000000000000')) === null, 'résultat illisible depuis une autre organisation')
  await P.consignerResultat({ proposition: prop, resultat: { success: true, message: 'Lien : https://crm.lab-learning.fr/portail/abcdef0123456789abcdef/mes-emargements' } })
  const { data: masque } = await sb.from('audit_logs').select('details').eq('id', prop.id).single()
  ok(String((masque as any)?.details?.message).includes('/portail/[lien masqué]/mes-emargements'), 'lien personnel d’émargement masqué dans le journal', masque)
  // Concurrence : 5 confirmations simultanées du même jeton, une seule passe
  const prop2 = { ...prop, id: (await import('crypto')).randomUUID() }
  const rafale = await Promise.all(Array.from({ length: 5 }, () => P.reserverExecution({ proposition: prop2, acteurId: USER })))
  ok(rafale.filter((x) => x === 'ok').length === 1 && rafale.filter((x) => x === 'deja').length === 4, '5 confirmations simultanées : une seule réservée', rafale)
  // Nettoyage des lignes de test
  const ids = [prop.id, prop2.id]
  const { data: r3row } = await sb.from('audit_logs').select('id').eq('details->params->>libelle', 'TEST sécurité Starkk (à ignorer)')
  const aSupprimer = Array.from(new Set([...ids, ...(r3row || []).map((x: any) => x.id)]))
  const { error: errDel } = await sb.from('audit_logs').delete().in('id', aSupprimer)
  ok(!errDel, `nettoyage des ${aSupprimer.length} lignes de test`, errDel)
  void r3; void r4

  console.log(echecs ? `\n${echecs} échec(s)` : '\nTous les tests passent')
  process.exit(echecs ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
