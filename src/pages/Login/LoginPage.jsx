import { useState } from 'react'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { DEMO_ACCOUNTS } from '../../auth/mockUsers'
import { useAuth } from '../../auth/useAuth'
import { ROLE_CONFIG } from '../../config/roles'
import { getHomeRoute } from '../../services/permissionsService'
import { Button } from '../../components/common/UI'
import { isBackendMode } from '../../api/apiClient'

export default function LoginPage() {
  const { user, loading, login } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (loading) return <div className="loading-screen"><span className="spinner" />Restoring session…</div>
  if (user) return <Navigate to={user.mustChangePassword ? '/change-password' : getHomeRoute(user)} replace />

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (!email.trim() || !password) { setError('Enter your email and password.'); return }
    setBusy(true)
    try {
      const signedIn = await login(email, password)
      navigate(location.state?.from || getHomeRoute(signedIn), { replace: true })
    } catch (cause) {
      setError(cause.message || 'Could not sign in to the workspace.')
    } finally { setBusy(false) }
  }

  return <main className="auth-page auth-login-page">
    <div className="auth-login-layout">
      <aside className="auth-login-story">
        <div className="auth-login-logo"><img src="/design-blocks-logo.png" alt="Design Blocks" /></div>
        <div className="auth-login-message">
          <span>YOUR WORK, IN SYNC</span>
          <h2>Make room for<br />great work.</h2>
          <p>One clear view of your clients, projects, and everything moving your business forward.</p>
        </div>
        <div className="auth-login-note"><span className="auth-login-note-mark"><ShieldCheck size={18} /></span><span><strong>Built around your workflow</strong><small>From first conversation to final delivery.</small></span></div>
      </aside>
      <section className="auth-card auth-login-panel">
        <div className="auth-intro"><span>{isBackendMode ? 'SECURE WORKSPACE' : 'DEMO WORKSPACE'}</span><h1>Welcome back</h1><p>{isBackendMode ? 'Sign in with the account credentials provided by your administrator.' : 'Sign in or choose a demo account to explore your workspace.'}</p></div>
        <form className="auth-form" onSubmit={submit}>
          <label className="form-field"><span>Email address</span><input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@designblocks.demo" /></label>
          <label className="form-field"><span>Password</span><span className="auth-password-wrap"><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isBackendMode ? 'Enter your password' : 'Enter demo password'} /><button type="button" className="auth-password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button type="submit" disabled={busy} className="auth-submit">{busy ? 'Signing in…' : 'Sign in'}</Button>
        </form>
        {!isBackendMode && <section className="demo-accounts" aria-labelledby="demo-accounts-title">
          <div className="demo-accounts-heading"><div><h2 id="demo-accounts-title">Explore with a demo account</h2><p>Pick a role to prefill the sign-in form</p></div><ShieldCheck size={19} /></div>
          <div className="demo-account-list">{DEMO_ACCOUNTS.map((account) => <div className="demo-account" key={account.id}>
            <div><strong>{ROLE_CONFIG[account.role].label}</strong><small>{account.email}</small><small>Password: {account.password}</small></div>
            <button type="button" onClick={() => { setEmail(account.email); setPassword(account.password); setError('') }}>Use</button>
          </div>)}</div>
        </section>}
        {!isBackendMode && <p className="auth-disclaimer">Demo only. This frontend uses mock authentication and is not a production security control.</p>}
      </section>
    </div>
  </main>
}
