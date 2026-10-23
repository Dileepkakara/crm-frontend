import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthContext } from './AuthContext'
import { authService } from './authService'
import { clearSession, readSessionId, writeSessionId } from './authStorage'
import { isBackendMode } from '../api/apiClient'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const userId = readSessionId()
    const restore = isBackendMode ? authService.restore() : userId ? authService.getUser(userId) : Promise.resolve(null)
    restore.then((current) => {
      if (active) {
        setUser(current)
        if (!isBackendMode && userId && !current) clearSession()
      }
    }).catch((error) => {
      if (active) console.error('Could not restore the session.', error)
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const handleSessionExpired = () => {
      clearSession()
      setUser(null)
    }
    window.addEventListener('crm:session-expired', handleSessionExpired)
    return () => window.removeEventListener('crm:session-expired', handleSessionExpired)
  }, [])

  const login = useCallback(async (email, password, clientOnly = false) => {
    const current = await authService.login(email, password, clientOnly)
    if (!isBackendMode) writeSessionId(current.id)
    setUser(current)
    return current
  }, [])
  const logout = useCallback(async () => {
    try {
      await authService.logout()
    } finally {
      clearSession()
      setUser(null)
    }
  }, [])
  const changePassword = useCallback(async (passwords) => {
    await authService.changePassword(passwords)
    clearSession()
    setUser(null)
  }, [])
  const value = useMemo(() => ({ user, loading, login, logout, changePassword }), [user, loading, login, logout, changePassword])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
