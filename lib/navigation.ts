import type { NavSection } from '@/lib/types'

export const navigation: NavSection[] = [
  // ── GÉNÉRAL ──────────────────────────────────────────────
  {
    title: 'Général',
    items: [
      { label: 'Tableau de bord', href: '/dashboard', icon: 'LayoutDashboard' },
      { label: 'Tâches', href: '/dashboard/taches', icon: 'CheckSquare' },
      { label: 'Agenda', href: '/dashboard/agenda', icon: 'CalendarDays', module: 'leads' },
    ],
  },
  // ── MON ESPACE (FORMATEUR uniquement) ────────────────────
  {
    title: 'Mon espace',
    items: [
      { label: 'Mon profil', href: '/dashboard/formateur-home/profil', icon: 'UserCheck', module: 'sessions', hideForRoles: ['super_admin', 'gestionnaire', 'directeur_commercial', 'commercial', 'apporteur_affaires', 'apprenant'] },
      { label: 'Planning', href: '/dashboard/formateur-home/planning', icon: 'CalendarDays', module: 'sessions', hideForRoles: ['super_admin', 'gestionnaire', 'directeur_commercial', 'commercial', 'apporteur_affaires', 'apprenant'] },
    ],
  },
  // ── COMMERCIAL ───────────────────────────────────────────
  {
    title: 'Commercial',
    items: [
      { label: 'Leads', href: '/dashboard/leads', icon: 'UserPlus', module: 'leads' },
      { label: 'Clients', href: '/dashboard/clients', icon: 'Building2', module: 'clients' },
    ],
  },
  // ── MON ÉQUIPE ──────────────────────────────────────────
  {
    title: 'Mon équipe',
    items: [
      { label: 'Apporteurs', href: '/dashboard/apporteurs', icon: 'Handshake', module: 'apporteurs' },
      { label: 'Franchises', href: '/dashboard/franchises', icon: 'Store', module: 'apporteurs' },
      { label: 'Formateurs', href: '/dashboard/formateurs', icon: 'Presentation', module: 'formateurs' },
      { label: 'Commerciaux', href: '/dashboard/users?role=commercial', icon: 'Briefcase', module: 'users' },
      { label: 'Gestionnaires', href: '/dashboard/users?role=gestionnaire', icon: 'UserCog', module: 'users' },
    ],
  },
  // ── OUTILS ────────────────────────────────────────────────
  {
    title: 'Outils',
    items: [
      { label: 'Mailing', href: '/dashboard/mailing', icon: 'Mails', module: 'leads' },
      { label: 'Simulateur OPCO', href: '/dashboard/simulateur', icon: 'Calculator', module: 'leads' },
      { label: 'Audit Conformité', href: '/dashboard/audit', icon: 'ClipboardList', module: 'leads' },
      { label: 'Prospection Email', href: '/dashboard/prospection', icon: 'Send', module: 'leads' },
    ],
  },
  // ── FORMATIONS ───────────────────────────────────────────
  {
    title: 'Formations',
    items: [
      { label: 'Catalogue', href: '/dashboard/formations', icon: 'GraduationCap', module: 'formations' },
      { label: 'Sessions', href: '/dashboard/sessions', icon: 'Calendar', module: 'sessions' },
      { label: 'Carte sessions', href: '/dashboard/carte-sessions', icon: 'MapPin', module: 'sessions', hideForRoles: ['commercial', 'apporteur_affaires', 'formateur', 'apprenant'] },
      { label: 'Apprenants', href: '/dashboard/apprenants', icon: 'UserCheck', module: 'apprenants' },
      { label: 'Changements', href: '/dashboard/changements', icon: 'UserCog', module: 'sessions' },
      { label: 'Audits', href: '/dashboard/audits', icon: 'ClipboardCheck', module: 'sessions' },
    ],
  },
  // ── ADMINISTRATIF ────────────────────────────────────────
  {
    title: 'Administratif',
    items: [
      { label: 'Dossiers', href: '/dashboard/dossiers', icon: 'FolderOpen', module: 'conventions' },
      { label: 'Conventions', href: '/dashboard/conventions', icon: 'FileSignature', module: 'conventions' },
      { label: 'POEI', href: '/dashboard/poei', icon: 'Briefcase', module: 'conventions', accent: 'sky' },
    ],
  },
  // ── FINANCES ─────────────────────────────────────────────
  {
    title: 'Finances',
    items: [
      { label: 'Devis', href: '/dashboard/devis', icon: 'FileText', module: 'devis' },
      { label: 'Factures', href: '/dashboard/factures', icon: 'Receipt', module: 'factures' },
      { label: 'Paiements', href: '/dashboard/paiements', icon: 'CreditCard', module: 'paiements' },
      { label: 'Affacturage', href: '/dashboard/affacturage', icon: 'Banknote', module: 'factures' },
    ],
  },
  // ── QUALITÉ ──────────────────────────────────────────────
  {
    title: 'Qualité',
    items: [
      { label: 'Qualiopi', href: '/dashboard/qualiopi', icon: 'ShieldCheck', module: 'qualiopi' },
      { label: 'Réclamations', href: '/dashboard/reclamations', icon: 'MessageSquareWarning', module: 'reclamations' },
      { label: 'Incidents', href: '/dashboard/incidents', icon: 'AlertTriangle', module: 'sessions' },
    ],
  },
  // ── SYSTÈME ──────────────────────────────────────────────
  {
    title: 'Système',
    items: [
      { label: 'Utilisateurs', href: '/dashboard/users', icon: 'Shield', module: 'users' },
      { label: 'Paramètres', href: '/dashboard/settings', icon: 'Settings', module: 'settings' },
    ],
  },
]
