# FormaCRM — Guide de mise en production

## Prérequis

- **Node.js** 18+ ([nodejs.org](https://nodejs.org))
- **Compte Supabase** ([supabase.com](https://supabase.com)) — gratuit pour commencer
- **Compte Vercel** ([vercel.com](https://vercel.com)) — gratuit pour commencer
- **Compte Resend** ([resend.com](https://resend.com)) — optionnel, pour les emails

---

## Étape 1 — Créer le projet Supabase

1. Allez sur [supabase.com/dashboard](https://supabase.com/dashboard)
2. Cliquez **New Project**
3. Choisissez un nom : `formacrm`
4. Région : **West EU (Paris)**
5. Mot de passe database : **notez-le**, vous en aurez besoin
6. Cliquez **Create new project** — attendez 2 minutes

### Récupérer les clés API

1. **Settings** > **API** (menu gauche)
2. Copiez ces 3 valeurs :

| Clé | Où la trouver |
|-----|---------------|
| `Project URL` | Section "Project URL" |
| `anon public` | Section "Project API Keys" |
| `service_role` | Section "Project API Keys" (cliquez "Reveal") |

---

## Étape 2 — Cloner et configurer le projet

```bash
# Cloner le projet (ou copier le dossier)
cd votre-dossier-projets

# Installer les dépendances
cd crm-lablearning
npm install

# Créer le fichier de configuration
cp .env.local.example .env.local
```

### Remplir `.env.local`

Ouvrez `.env.local` dans votre éditeur et renseignez :

```env
NEXT_PUBLIC_SUPABASE_URL=https://votre-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...votre-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...votre-service-role-key

NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=FormaCRM
```

---

## Étape 3 — Exécuter les migrations SQL

### Option A : fichier unique (recommandé)

```bash
npm run db:migrate
```

Cela génère `supabase/full_migration.sql`. Ensuite :

1. Ouvrez **Supabase Dashboard** > **SQL Editor**
2. Cliquez **New Query**
3. Collez le contenu de `supabase/full_migration.sql`
4. Cliquez **Run**
5. Vérifiez : aucune erreur en rouge

### Option B : fichier par fichier

Exécutez chaque fichier dans l'ordre dans SQL Editor :

```
001_foundation.sql
002_crm_commercial.sql
003_formations_sessions.sql
004_devis_conventions_dossiers.sql
005_facturation_paiements.sql
006_qcm_evaluations.sql
007_qualiopi_reclamations.sql
008_notifications_emails.sql
009_documents_signatures.sql
010_portails.sql
```

### Vérification

Dans **Supabase Dashboard** > **Table Editor**, vous devriez voir 70+ tables créées.

---

## Étape 4 — Configurer l'authentification Supabase

1. **Supabase Dashboard** > **Authentication** > **Providers**
2. Vérifiez que **Email** est activé
3. **Authentication** > **URL Configuration** :
   - **Site URL** : `http://localhost:3000` (dev) ou `https://votre-domaine.vercel.app` (prod)
   - **Redirect URLs** : ajoutez `http://localhost:3000/auth/callback`

---

## Étape 5 — Lancer en développement

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000)

### Créer le premier compte

1. Cliquez **Créer un compte**
2. Renseignez le nom de l'organisme, votre nom, email, mot de passe
3. Ce premier compte sera automatiquement **Super Admin**

### Initialiser les données Qualiopi + templates email

Après la création du compte, dans **Supabase SQL Editor** :

```sql
DO $$
DECLARE
  org_id UUID;
BEGIN
  SELECT id INTO org_id FROM organizations LIMIT 1;
  PERFORM seed_qualiopi_indicateurs(org_id);
  PERFORM seed_email_templates(org_id);
  RAISE NOTICE 'Données initialisées pour org %', org_id;
END $$;
```

---

## Étape 6 — Déployer sur Vercel

### Via la CLI

```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer
vercel

# Suivre les instructions :
# - Link to existing project? No
# - Project name: formacrm
# - Framework: Next.js
# - Root directory: ./
```

### Configurer les variables d'environnement

Dans **Vercel Dashboard** > votre projet > **Settings** > **Environment Variables** :

| Variable | Valeur |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://votre-id.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | votre anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | votre service role key |
| `NEXT_PUBLIC_APP_URL` | `https://votre-projet.vercel.app` |
| `NEXT_PUBLIC_APP_NAME` | `FormaCRM` |
| `RESEND_API_KEY` | votre clé Resend (optionnel) |

### Mettre à jour Supabase

Dans **Supabase** > **Authentication** > **URL Configuration** :
- **Site URL** : `https://votre-projet.vercel.app`
- **Redirect URLs** : ajoutez `https://votre-projet.vercel.app/auth/callback`

### Redéployer

```bash
vercel --prod
```

---

## Étape 7 — Configurer Resend (emails)

1. Créez un compte sur [resend.com](https://resend.com)
2. Ajoutez votre domaine dans **Domains**
3. Créez une API Key dans **API Keys**
4. Ajoutez `RESEND_API_KEY` dans `.env.local` et Vercel

Sans Resend, les emails sont loggés en console (mode dev).

---

## Étape 8 — Domaine personnalisé (optionnel)

1. **Vercel Dashboard** > **Settings** > **Domains**
2. Ajoutez votre domaine : `app.votre-organisme.fr`
3. Configurez le DNS chez votre registrar (CNAME vers `cname.vercel-dns.com`)
4. Mettez à jour `NEXT_PUBLIC_APP_URL` dans Vercel
5. Mettez à jour les URLs dans Supabase Authentication

---

## Structure des rôles

| Rôle | Accès |
|------|-------|
| **Super Admin** | Tout (premier compte créé) |
| **Gestionnaire** | Dossiers, sessions, apprenants, conventions |
| **Commercial** | Pipeline, leads, devis, clients |
| **Comptable** | Factures, paiements, exports |
| **Formateur** | Ses sessions, émargement, évaluations |
| **Apprenant** | Portail externe uniquement |

---

## Commandes utiles

```bash
npm run dev          # Serveur de développement
npm run build        # Build de production
npm run start        # Serveur de production
npm run lint         # Vérification ESLint
npm run type-check   # Vérification TypeScript
npm run db:migrate   # Générer le SQL de migration complet
npm run db:seed      # Instructions pour le seed initial
```

---

## Checklist de production

- [ ] Projet Supabase créé (région EU Paris)
- [ ] Migrations SQL exécutées (70+ tables)
- [ ] Premier compte Super Admin créé
- [ ] Seed Qualiopi + Templates email exécuté
- [ ] Déployé sur Vercel
- [ ] Variables d'environnement configurées sur Vercel
- [ ] URLs de redirection configurées dans Supabase Auth
- [ ] Resend configuré (optionnel)
- [ ] Domaine personnalisé (optionnel)
