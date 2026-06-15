// ============================================================
// Types globaux — CRM Formation Qualiopi
// ============================================================

export type UserRole =
  | 'super_admin'
  | 'gestionnaire'
  | 'directeur_commercial'
  | 'commercial'
  | 'apporteur_affaires'
  | 'formateur'
  | 'apprenant'
  | 'franchise'

export type UserStatus = 'active' | 'inactive' | 'invited' | 'suspended'

export type CRMModule =
  | 'leads' | 'clients' | 'contacts' | 'apporteurs'
  | 'formations' | 'sessions' | 'apprenants' | 'formateurs'
  | 'devis' | 'conventions' | 'factures' | 'paiements'
  | 'documents' | 'signatures' | 'qcm' | 'evaluations'
  | 'reclamations' | 'qualiopi' | 'reporting' | 'settings' | 'users'

// ---- Entités ----

export interface Organization {
  id: string
  name: string
  legal_name: string | null
  siret: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  country: string
  phone: string | null
  email: string | null
  website: string | null
  logo_url: string | null
  numero_da: string | null
  is_qualiopi: boolean
  qualiopi_certificate_date: string | null
  primary_color: string
  secondary_color: string
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  organization_id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  avatar_url: string | null
  role: UserRole
  status: UserStatus
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface Permission {
  id: string
  organization_id: string
  role: UserRole
  module: CRMModule
  can_create: boolean
  can_read: boolean
  can_update: boolean
  can_delete: boolean
}

export interface AuditLog {
  id: string
  organization_id: string
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  details: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
  user?: Pick<User, 'first_name' | 'last_name' | 'email'>
}

export interface Invitation {
  id: string
  organization_id: string
  email: string
  role: UserRole
  invited_by: string | null
  token: string
  expires_at: string
  accepted_at: string | null
  created_at: string
}

// ---- Contextes ----

export interface AuthContext {
  user: User | null
  organization: Organization | null
  permissions: Permission[]
  isLoading: boolean
}

// ---- Navigation ----

export interface NavItem {
  label: string
  href: string
  icon: string
  module?: CRMModule
  children?: NavItem[]
  hideForRoles?: string[]
}

export interface NavSection {
  title: string
  items: NavItem[]
}

// ---- API ----

export interface ActionResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  errors?: Record<string, string[]>
  warning?: string
}

// ---- UI ----

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  gestionnaire: 'Gestionnaire',
  directeur_commercial: 'Directeur Commercial',
  commercial: 'Commercial',
  apporteur_affaires: 'Apporteur d\'affaires',
  formateur: 'Formateur',
  apprenant: 'Apprenant',
  franchise: 'Franchise',
}

export const ROLE_COLORS: Record<UserRole, BadgeVariant> = {
  super_admin: 'danger',
  gestionnaire: 'info',
  directeur_commercial: 'info',
  commercial: 'success',
  apporteur_affaires: 'success',
  formateur: 'default',
  apprenant: 'default',
  franchise: 'warning',
}

export const STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Actif',
  inactive: 'Inactif',
  invited: 'Invité',
  suspended: 'Suspendu',
}

export const STATUS_COLORS: Record<UserStatus, BadgeVariant> = {
  active: 'success',
  inactive: 'default',
  invited: 'warning',
  suspended: 'danger',
}
