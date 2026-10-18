import { useCallback, useMemo, useState } from 'react'
import { AppContext } from './app-context'

export function AppProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const notify = useCallback((message, tone = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current, { id, message, tone }])
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3600)
  }, [])
  const value = useMemo(() => ({ notify }), [notify])
  return (
    <AppContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => <div className={`toast toast-${toast.tone}`} key={toast.id}>{toast.message}</div>)}
      </div>
    </AppContext.Provider>
  )
}
