'use client'

import { useState } from 'react'
import { UserPlus, MoreHorizontal, ShieldAlert, ShieldOff, Mail, UserCog, Clock, RefreshCw, X, Send } from 'lucide-react'
import { Button, Input, Select, Badge, Avatar, Modal, useToast } from '@/components/ui'
import { inviteUserAction, updateUserRoleAction, toggleUserStatusAction, startImpersonationAction, resendInvitationAction, cancelInvitationAction } from './actions'
import { ROLE_LABELS, ROLE_COLORS, STATUS_LABELS, STATUS_COLORS } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'
import type { User, UserRole } from '@/lib/types'

interface Invitation {
  id: string
  email: string
  role: string
  created_at: string
  expires_at: string
  accepted_at: string | null
}

interface Franchise {
  id: string
  nom: string | null
  raison_sociale: string | null
}

interface UsersListProps {
  users: User[]
  invitations: Invitation[]
  franchises?: Franchise[]
  currentUserId: string
  isAdmin: boolean
  isSuperAdmin: boolean
}

const roleOptions = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))

export function UsersList({ users, invitations, franchises = [], currentUserId, isAdmin, isSuperAdmin }: UsersListProps) {
  const { toast } = useToast()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [isInviting, setIsInviting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [inviteRole, setInviteRole] = useState('gestionnaire')

  const franchiseOptions = franchises.map((f) => ({
    value: f.id,
    label: f.nom || f.raison_sociale || 'Franchise',
  }))

  async function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsInviting(true)
    setFieldErrors({})

    const formData = new FormData(e.currentTarget)
    const result = await inviteUserAction(formData)

    if (result.success) {
      toast('success', `Invitation envoyée à ${(result.data as { email: string })?.email}`)
      setInviteOpen(false)
      setInviteRole('gestionnaire')
      ;(e.target as HTMLFormElement).reset()
    } else if (result.errors) {
      setFieldErrors(result.errors)
    } else {
      toast('error', result.error || 'Erreur')
    }

    setIsInviting(false)
  }

  async function handleRoleChange(userId: string, role: string) {
    const result = await updateUserRoleAction(userId, role)
    if (result.success) {
      toast('success', 'Rôle mis à jour')
    } else {
      toast('error', result.error || 'Erreur')
    }
    setActiveMenu(null)
  }

  async function handleToggleStatus(userId: string, currentStatus: string) {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active'
    const result = await toggleUserStatusAction(userId, newStatus as 'active' | 'suspended')
    if (result.success) {
      toast('success', newStatus === 'suspended' ? 'Utilisateur suspendu' : 'Utilisateur réactivé')
    } else {
      toast('error', result.error || 'Erreur')
    }
    setActiveMenu(null)
  }

  async function handleImpersonate(userId: string) {
    const result = await startImpersonationAction(userId)
    if (result.success) {
      window.location.href = '/dashboard'
    } else {
      toast('error', result.error || 'Erreur')
    }
    setActiveMenu(null)
  }

  async function handleResendInvite(invitationId: string) {
    const result = await resendInvitationAction(invitationId)
    if (result.success) {
      toast('success', 'Invitation renvoyee')
    } else {
      toast('error', result.error || 'Erreur')
    }
  }

  async function handleCancelInvite(invitationId: string) {
    const result = await cancelInvitationAction(invitationId)
    if (result.success) {
      toast('success', 'Invitation annulee')
    } else {
      toast('error', result.error || 'Erreur')
    }
  }

  function getInviteStatus(inv: Invitation): { label: string; variant: 'warning' | 'danger' | 'success' } {
    if (inv.accepted_at) return { label: 'Acceptee', variant: 'success' }
    if (new Date(inv.expires_at) < new Date()) return { label: 'Expiree', variant: 'danger' }
    return { label: 'En attente', variant: 'warning' }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Utilisateurs</h1>
          <p className="text-surface-500 mt-1 text-sm">
            {users.length} membre{users.length > 1 ? 's' : ''} dans l&apos;organisme
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => setInviteOpen(true)}
            icon={<UserPlus className="h-4 w-4" />}
          >
            Inviter un utilisateur
          </Button>
        )}
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-100">
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">
                  Utilisateur
                </th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">
                  Rôle
                </th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3 hidden md:table-cell">
                  Statut
                </th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3 hidden lg:table-cell">
                  Dernière connexion
                </th>
                {isAdmin && (
                  <th className="text-right text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-surface-50/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar
                        firstName={user.first_name}
                        lastName={user.last_name}
                        src={user.avatar_url}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-surface-900 truncate">
                          {user.first_name} {user.last_name}
                          {user.id === currentUserId && (
                            <span className="ml-2 text-2xs text-surface-400">(vous)</span>
                          )}
                        </div>
                        <div className="text-xs text-surface-500 truncate">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={ROLE_COLORS[user.role]} dot>
                      {ROLE_LABELS[user.role]}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <Badge variant={STATUS_COLORS[user.status]}>
                      {STATUS_LABELS[user.status]}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell">
                    <span className="text-sm text-surface-500">
                      {user.last_login_at ? formatDateTime(user.last_login_at) : '—'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-right">
                      {user.id !== currentUserId && (
                        <div className="relative inline-block">
                          <button
                            onClick={() => setActiveMenu(activeMenu === user.id ? null : user.id)}
                            className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>

                          {activeMenu === user.id && (
                            <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl border border-surface-200 shadow-elevated py-1.5 z-10 animate-in-scale origin-top-right">
                              {isSuperAdmin && (
                                <>
                                  <div className="px-3 py-1.5 text-2xs font-semibold text-surface-400 uppercase tracking-wider">
                                    Changer le rôle
                                  </div>
                                  {roleOptions.map((opt) => (
                                    <button
                                      key={opt.value}
                                      onClick={() => handleRoleChange(user.id, opt.value)}
                                      className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm transition-colors ${
                                        user.role === opt.value
                                          ? 'text-brand-600 bg-brand-50 font-medium'
                                          : 'text-surface-700 hover:bg-surface-50'
                                      }`}
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                  <div className="border-t border-surface-100 my-1" />
                                </>
                              )}
                              {isSuperAdmin && (
                                <>
                                  <button
                                    onClick={() => handleImpersonate(user.id)}
                                    className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-surface-700 hover:bg-surface-50 transition-colors"
                                  >
                                    <UserCog className="h-4 w-4" />
                                    Aperçu du compte
                                  </button>
                                  <div className="border-t border-surface-100 my-1" />
                                </>
                              )}
                              <button
                                onClick={() => handleToggleStatus(user.id, user.status)}
                                className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm transition-colors ${
                                  user.status === 'active'
                                    ? 'text-danger-600 hover:bg-danger-50'
                                    : 'text-success-600 hover:bg-success-50'
                                }`}
                              >
                                {user.status === 'active' ? (
                                  <>
                                    <ShieldOff className="h-4 w-4" />
                                    Suspendre
                                  </>
                                ) : (
                                  <>
                                    <ShieldAlert className="h-4 w-4" />
                                    Réactiver
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-surface-500">Aucun utilisateur trouvé</p>
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      {isAdmin && invitations.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-heading font-bold text-surface-900 mb-3 flex items-center gap-2">
            <Send className="h-4 w-4 text-surface-400" />
            Invitations en cours
            <span className="text-sm font-normal text-surface-400">({invitations.length})</span>
          </h2>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-100">
                    <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">Email</th>
                    <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">Role</th>
                    <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3 hidden md:table-cell">Envoyee le</th>
                    <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">Statut</th>
                    <th className="text-right text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {invitations.map((inv) => {
                    const status = getInviteStatus(inv)
                    const isExpired = new Date(inv.expires_at) < new Date()
                    return (
                      <tr key={inv.id} className={isExpired ? 'bg-surface-50/50' : 'hover:bg-surface-50/50 transition-colors'}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-surface-100 flex items-center justify-center shrink-0">
                              <Mail className="h-4 w-4 text-surface-400" />
                            </div>
                            <span className="text-sm font-medium text-surface-900">{inv.email}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={ROLE_COLORS[inv.role as UserRole] || 'default'} dot>
                            {ROLE_LABELS[inv.role as UserRole] || inv.role}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 hidden md:table-cell">
                          <span className="text-sm text-surface-500">
                            {formatDateTime(inv.created_at)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleResendInvite(inv.id)}
                              className="p-1.5 rounded-lg text-surface-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                              title="Renvoyer"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleCancelInvite(inv.id)}
                              className="p-1.5 rounded-lg text-surface-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
                              title="Annuler"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      <Modal
        isOpen={inviteOpen}
        onClose={() => { setInviteOpen(false); setFieldErrors({}) }}
        title="Inviter un utilisateur"
        description="Envoyez une invitation par email pour rejoindre votre organisme"
      >
        <form onSubmit={handleInvite} className="space-y-5">
          <Input
            id="invite-email"
            name="email"
            type="email"
            label="Adresse email"
            placeholder="collaborateur@email.fr"
            error={fieldErrors.email?.[0]}
          />

          <Select
            id="invite-role"
            name="role"
            label="Rôle"
            placeholder="Sélectionner un rôle"
            options={roleOptions}
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            error={fieldErrors.role?.[0]}
          />

          {inviteRole === 'franchise' && (
            franchiseOptions.length > 0 ? (
              <Select
                id="invite-franchise"
                name="franchise_id"
                label="Franchise à rattacher"
                placeholder="Sélectionner la franchise"
                options={franchiseOptions}
                error={fieldErrors.franchise_id?.[0]}
              />
            ) : (
              <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Aucune franchise active. Créez d&apos;abord une franchise dans Mon équipe → Franchises (apporteur catégorie « partenaire »).
              </p>
            )
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setInviteOpen(false); setFieldErrors({}) }}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              isLoading={isInviting}
              icon={<Mail className="h-4 w-4" />}
            >
              Envoyer l&apos;invitation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
