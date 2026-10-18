import { useMemo } from 'react'
import { useAuth } from './useAuth'
import { canAccessRoute, hasAllPermissions, hasAnyPermission, hasPermission } from '../services/permissionsService'

export function usePermissions() {
  const { user } = useAuth()
  return useMemo(() => ({
    hasPermission: (permission) => hasPermission(user, permission),
    hasAnyPermission: (permissions) => hasAnyPermission(user, permissions),
    hasAllPermissions: (permissions) => hasAllPermissions(user, permissions),
    canAccessRoute: (path) => canAccessRoute(user, path),
  }), [user])
}
