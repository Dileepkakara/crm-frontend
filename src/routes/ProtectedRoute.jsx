import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="loading-screen" role="status" aria-label="Loading"><span className="spinner" aria-hidden="true" /></div>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }
  return children
}
