# WhatsApp — Listing complet des messages à automatiser

Tous les messages sont **catégorie « Utilitaire »** côté Meta (transactionnels, liés à un
événement) — validation rapide, coût réduit. Chaque template est à créer **une fois** dans
le Gestionnaire WhatsApp, puis le CRM l'envoie automatiquement aux destinataires **opt-in**.

Légende état : ✅ plomberie CRM prête · 🔧 à brancher · 🆕 nouvelle logique

---

## 1. Convocation & rappels de formation → APPRENANT

| Template | Déclencheur | Variables | État |
|---|---|---|---|
| `convocation_j3` | J-3 avant la formation (cron) | civilité+nom · formation · date début · date fin · lieu | ✅ branché |
| `rappel_j1` | La veille (cron) | prénom · formation · horaire · lieu | 🔧 |
| `lien_emargement` | Le matin J / par demi-journée | prénom · formation · + bouton lien émargement | 🆕 |

## 2. Signatures électroniques → CLIENT / FORMATEUR
*(bouton URL dynamique « Signer »)*

| Template | Déclencheur | Destinataire | Variables | État |
|---|---|---|---|---|
| `signature_convention` | Convention générée / envoyée | Client signataire | nom · formation · + bouton lien signature | 🔧 |
| `signature_contrat_formateur` | Contrat formateur émis | Formateur | nom · formation · dates · + bouton lien | 🔧 |
| `signature_devis` | Devis envoyé (optionnel) | Client | nom · objet · montant · + bouton lien | 🆕 |

## 3. Mission formateur → FORMATEUR

| Template | Déclencheur | Variables | État |
|---|---|---|---|
| `mission_proposee` | Session créée, mission proposée | nom · formation · dates · lieu · + bouton accepter | 🔧 |
| `fiche_mission_j3` | J-3 (rappel mission) | nom · formation · date · nb participants | ✅ (notif) → 🔧 WhatsApp |

## 4. Questionnaires & évaluations → APPRENANT
*(bouton URL « Compléter »)*

| Template | Déclencheur | Variables | État |
|---|---|---|---|
| `questionnaire_positionnement` | Confirmation session (avant) | prénom · formation · + bouton lien | 🔧 |
| `evaluation_sortie` | Fin de formation | prénom · formation · + bouton lien | 🔧 |
| `satisfaction_chaud` | Fin de formation | prénom · formation · + bouton lien | 🔧 |
| `satisfaction_froid` | J+90 (cron existant) | prénom · formation · + bouton lien | ✅ (cron) → 🔧 WhatsApp |

## 5. Documents & attestations → APPRENANT / CLIENT

| Template | Déclencheur | Variables | État |
|---|---|---|---|
| `attestation_dispo` | Attestation de formation générée | prénom · formation · + bouton télécharger | 🆕 |
| `documents_dispo` | Documents mis à disposition (portail) | prénom · + bouton accéder | 🆕 |

## 6. Facturation → CLIENT

| Template | Déclencheur | Variables | État |
|---|---|---|---|
| `facture_emise` | Facture émise | raison sociale · n° facture · montant · + bouton | 🔧 |
| `relance_facture` | Échéance dépassée (cron) | raison sociale · n° facture · montant · échéance · + bouton | 🆕 |
| `paiement_recu` | Paiement encaissé | raison sociale · montant · n° facture | 🆕 |

## 7. Franchise / Apporteur (optionnel)

| Template | Déclencheur | Destinataire | État |
|---|---|---|---|
| `commission_versee` | Commission payée | Franchise / Apporteur | 🔧 (notif existe) |
| `incident_signale` | Incident sur un établissement | Franchise | 🔧 (notif existe) |

---

## Prérequis transverses
- **Champ WhatsApp + opt-in** : déjà sur clients/contacts/apprenants. **À ajouter : formateurs.**
- **Numéro WhatsApp Business dédié** Lab Learning + **token permanent** (prod).
- Chaque template avec lien = **bouton URL dynamique** (le token est passé en variable du bouton).
- Tout envoi respecte l'**opt-in** du destinataire (RGPD + Meta).

## Ordre de déploiement conseillé
1. ✅ **Convocation J-3** (en cours) — valider la chaîne en réel
2. **Signatures** (convention + contrat formateur) — fort impact taux de signature
3. **Questionnaires & satisfaction** (Qualiopi) — relances de complétion
4. **Facturation** (facture émise + relance impayés)
5. **Attestations / documents**
6. Reste (rappel J-1, émargement, franchise…)
