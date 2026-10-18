import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { canAccessRoute, getHomeRoute, hasAnyPermission, hasPermission } from '../services/permissionsService'

export default function RoleRoute({ children, permission, anyPermission }) {
  const { user } = useAuth()
  const location = useLocation()
  const allowed = permission
    ? (Array.isArray(permission) ? hasAnyPermission(user, permission) : hasPermission(user, permission))
    : anyPermission
      ? hasAnyPermission(user, anyPermission)
      : canAccessRoute(user, location.pathname)
  if (!allowed) return <Navigate to={getHomeRoute(user)} replace state={{ deniedFrom: location.pathname }} />
  return children
}
