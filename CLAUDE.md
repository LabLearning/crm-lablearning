# CLAUDE.md — Contexte projet CRM Formation Lab Learning

## Identite du projet
- **Client** : Lab Learning — organisme de formation professionnelle certifie Qualiopi
- **Contact** : Brahim Ouchrif — digital@lab-learning.fr
- **Secteur** : Formation professionnelle (restauration, boucherie, boulangerie, patisserie, hotellerie)
- **Objectif** : CRM complet couvrant tout le cycle de vie d'une action de formation

## Stack technique
- **Framework** : Next.js 14.2 (App Router)
- **Base de donnees** : Supabase (PostgreSQL) — projet `igfmlzyxufgywxkneese` (West EU Paris)
- **Auth** : Supabase Auth
- **Styling** : Tailwind CSS + design system custom
- **Deploiement** : Vercel (auto-deploy sur push `main`) — URL: `https://crm-formation-five.vercel.app`
- **Repo** : `github.com/LabLearning/crm-formation`

## Identifiants Supabase
- org_id: `ff747dfe-c034-44d8-98d7-e53892263fb5`
- user_id admin: `16a538a0-ca4e-42f1-b2a0-354aea73ca46`
- email admin: `digital@lab-learning.fr`
- org name: `Lab Learning`

## Regles de design strictes
- **ZERO emoji** — uniquement icones Lucide React SVG
- Polices : Satoshi (headings) + General Sans (body) via Fontshare CDN
- Palette : surface-900 (#1C1917) primaire, brand-500 (#6366F1) accent, surface-50 (#FAFAFA) bg
- Classes CSS : `.card`, `.btn-primary`, `.input-base`, `.section-label`, `.stat-card`
- Sidebar : titres colores par section, fond teinte subtil sur les sous-menus
- Sections sidebar : Commercial (bleu), Outils (violet), Formations (emeraude), Administratif (ambre), Finances (rose), Qualite (teal), Systeme (slate)

## Regles de developpement
1. TypeScript strict mais `ignoreBuildErrors: true` dans next.config.js
2. `createServiceRoleClient()` pour TOUTES les requetes Supabase (bypass RLS)
3. `createServerSupabaseClient()` UNIQUEMENT pour `auth.getUser()` (cookies)
4. Composants React reutilisables dans `components/ui/`
5. Server Actions dans `actions.ts` par module
6. Francais pour les labels UI, anglais pour le code
7. Pas de `title` prop sur les icones Lucide (erreur build)
8. Pas de `Pick<Type>` dans les casts — utiliser `as any[]`
9. Chaque push sur `main` declenche un deploy Vercel automatique

## Architecture fichiers
```
app/
  (auth)/              # Login, Register
  dashboard/           # Admin panel (protege par auth)
    leads/             # Pipeline commercial
    clients/           # Fiches clients
    contacts/          # Contacts rattaches
    apporteurs/        # Apporteurs d'affaires
    devis/             # Devis
    formations/        # Catalogue formations
    sessions/          # Sessions de formation
    apprenants/        # Fiches apprenants
    formateurs/        # Fiches formateurs
    conventions/       # Conventions de formation
    dossiers/          # Dossiers de formation
    factures/          # Facturation
    paiements/         # Suivi paiements
    documents/         # Gestion documentaire
    signatures/        # Signatures electroniques
    evaluations/       # Evaluations
    qcm/               # Banque QCM
    qualiopi/          # Conformite Qualiopi
    reclamations/      # Reclamations
    reporting/         # Rapports + data.ts (KPIs)
    portals/           # Gestion tokens portails
    # Outils CRM commercial:
    simulateur/        # Simulateur Budget OPCO (67 formations)
    audit/             # Audit Conformite 3 phases
    prospection/       # Prospection Email (3 templates)
    mailing/           # Mailing avec templates custom
    agenda/            # Agenda CRM
    manager/           # Vue Manager analytique
    suivi-admin/       # Suivi Administratif double pipeline
    commercial/        # Vue Terrain iPad (mobile-first)
    users/             # Gestion utilisateurs
    settings/          # Parametres organisation
    profile/           # Profil utilisateur
  portail/
    [token]/           # Portails externes (sans login Supabase)
      PortalShell.tsx  # Navigation commune
      page.tsx         # Accueil (detecte type: apprenant/formateur/client/apporteur/partenaire)
      formations/      # Portail apprenant: formations
      documents/       # Portail apprenant: documents
      evaluations/     # Portail apprenant: evaluations
      questionnaires/  # Portail apprenant: questionnaires
      sessions/        # Portail formateur: sessions
      apprenants/      # Portail formateur: apprenants
      emargement/      # Portail formateur: emargement
      formations-client/    # Portail client: planning formations
      conventions-client/   # Portail client: conventions
      factures-client/      # Portail client: factures
      leads-apporteur/      # Portail apporteur: leads apportes
      commissions-apporteur/ # Portail apporteur: commissions
      dossiers-partenaire/  # Portail partenaire: dossiers formation
      sessions-partenaire/  # Portail partenaire: sessions
    expired/           # Page lien expire
components/
  ui/                  # Design system (Button, Badge, Modal, Avatar, Input, Select, Toast, Card)
  layout/              # Sidebar, Header, MobileNav, DashboardShell
  auth/                # LoginForm, RegisterForm
lib/
  auth.ts              # getSession() — auth + service role pour data
  portal-auth.ts       # getPortalContext() — auth portails externes
  permissions.ts       # hasPermission(), hasAnyPermission()
  navigation.ts        # Structure sidebar avec sections colorees
  utils.ts             # formatDate, cn, etc.
  email.ts             # sendTemplateEmail (Resend)
  audit.ts             # logAudit()
  supabase/
    server.ts          # createServerSupabaseClient() + createServiceRoleClient()
    client.ts          # Client browser
  types/               # TypeScript interfaces
  validations/         # Schemas Zod
```

## Base de donnees — Tables principales
```sql
-- 10 migrations dans supabase/migrations/
001_foundation:        organizations, users, permissions, audit_logs, invitations
002_crm_commercial:    clients, contacts, leads, lead_interactions, apporteurs_affaires, commissions
003_formations:        formations, formateurs, apprenants, sessions, inscriptions, emargements
004_devis_conventions: devis, devis_lignes, dossiers_formation, conventions
005_facturation:       factures, facture_lignes, paiements
006_qcm:              qcm, qcm_questions, qcm_reponses, qcm_sessions, evaluations_satisfaction
007_qualiopi:          qualiopi_indicateurs, qualiopi_preuves, reclamations, actions_amelioration
008_notifications:     notifications, email_templates, email_logs
009_documents:         documents, signatures
010_portails:          portal_access_tokens
011_partenaires:       ALTER TABLE apporteurs_affaires ADD categorie, nom_enseigne, etc.
```

## Portails — Systeme actuel
- Token unique genere par admin, stocke dans `portal_access_tokens`
- Types supportes : `apprenant`, `formateur`, `client`, `apporteur` (+ partenaire via categorie)
- `lib/portal-auth.ts` → `getPortalContext(token)` retourne le contexte selon le type
- `PortalShell.tsx` detecte le type et affiche la navigation adaptee
- Aucun login Supabase requis — acces par lien unique

### Tokens reels en base (a interroger via portal_access_tokens)
Les tokens sont des hashs SHA256, expirent en 2027, is_active=true. Pour les recuperer:
`SELECT type, token, email FROM portal_access_tokens WHERE is_active = true;`

| Type | Email associe | Note |
|------|---------------|------|
| Apprenant | emilie.bernard@mie-doree.fr | apprenant_id lie |
| Formateur | l.vasseur@lablearning.fr | formateur_id lie |
| Client | BRAHIMOCF@GMAIL.COM | recherche via contact ou client direct |
| Apporteur | brahimouchrif@gmail.com | recherche par email |

## Donnees de test en base
- 6 clients (entreprises: restaurant, boucherie, hotel, patisserie, fast-food, boulangerie)
- 6 contacts (1 par client)
- 10 leads (a differents stades du pipeline)
- 2 apporteurs + 2 partenaires franchise
- 8 formations au catalogue
- 4 formateurs
- 6 sessions (planifiees, confirmees, terminee)
- 12 apprenants
- 18 inscriptions
- 4 devis, 3 conventions, 4 factures, 1 paiement
- 1 commission

## Types d'utilisateurs et acces
| Utilisateur | Acces | Auth |
|-------------|-------|------|
| Admin Lab Learning | Dashboard complet, tous les modules | Supabase Auth (email/mdp) |
| Commercial | Vue Terrain, Leads, Outils (Simulateur, Audit, Prospection) | Supabase Auth (role commercial) |
| Formateur | Portail: ses sessions, emargement, apprenants, evaluations | Token unique (pas de login) |
| Apprenant | Portail: formations, documents, QCM, satisfaction | Token unique |
| Client (entreprise) | Portail: conventions, factures, planning formations | Token unique |
| Apporteur d'affaires | Portail: leads apportes, commissions | Token unique |
| Partenaire franchise | Portail: dashboard riche, dossiers, sessions, CA, commissions | Token unique (categorie=partenaire) |

## Automatisations inter-modules (implementees)
1. Lead "Gagne" → cree auto un dossier dans `dossiers_formation`
2. Fiche lead → bouton "Prospection email" → prefill dans `/prospection`
3. Fiche lead → bouton "Simuler budget" → prefill dans `/simulateur`
4. Fiche lead → bouton "Lancer audit" → prefill dans `/audit`
5. Fiche lead → bouton "Mailing rapide" → prefill dans `/mailing`
6. Prefills via localStorage (ll_prefill_email, ll_prefill_simu, ll_prefill_audit, ll_prefill_mailing)

## Simulateur Budget OPCO
- 67 formations: 13 Restauration Rapide, 15 HCR, 18 Boucherie, 9 Boulangerie, 12 Patisserie
- Config OPCO complete (plafonds, taux horaires par categorie, contraintes)
- Selection par activite, filtrage Conformite/Competences
- Calcul budget temps reel, devis informatif en modal

## Suivi Administratif
- Double pipeline: Organisation (8 statuts) + AKTO (7 statuts)
- 4 vues: Cartes, Tableau, Kanban (switchable Org/AKTO), Pipeline
- Stockage localStorage

---

## CE QUI RESTE A FAIRE (priorite haute)

### 1. Portails — Bugs a fixer
- Les portails retournent parfois erreur 500 (probablement colonnes manquantes ou queries qui plantent)
- Tester chaque portail avec les tokens de test et fixer les erreurs
- Le portail partenaire a des colonnes ajoutees par migration 011 — verifier qu'elles existent en base

### 2. Systeme d'invitation utilisateurs avec email brande
- Quand l'admin cree un utilisateur (commercial, formateur, etc.), l'utilisateur recoit un email brande Lab Learning avec :
  - Son role et ses acces
  - Un lien pour creer son compte (set password)
  - Le design Lab Learning (header vert #195144, logo, footer)
- L'email doit etre envoye via Resend (cle API a configurer)
- Template HTML professionnel

### 3. Impersonation
- L'admin peut "se connecter en tant que" n'importe quel utilisateur pour voir ce qu'il voit
- Bouton sur la fiche utilisateur dans le dashboard admin
- Banner visible "Vous etes connecte en tant que X" avec bouton retour

### 4. Portails a completer
- Portail apprenant : QCM en ligne fonctionnel, signature documents
- Portail formateur : emargement numerique fonctionnel
- Portail client : signature convention en ligne
- Tous les portails : envoi email avec lien d'acces au portail

### 5. Ameliorations futures
- Simulateur: combos conformite, export Excel, creation prospect vers CRM
- Vue Manager: onglets Activite et Dossiers
- Generation PDF (conventions, attestations, factures)
- Notifications temps reel
- Integration Stripe pour paiement en ligne
