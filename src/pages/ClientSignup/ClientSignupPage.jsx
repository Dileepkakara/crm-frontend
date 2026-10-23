import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/common/UI'
import { isBackendMode } from '../../api/apiClient'
import { clientSignupApi } from '../../api/clientSignupApi'

const emptyForm = { name: '', company: '', email: '', phone: '', address: '' }

export default function ClientSignupPage() {
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await clientSignupApi.submit(form)
      setSubmitted(true)
    } catch (cause) {
      setError(cause.message || 'Could not submit your request.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="auth-page client-signup-page">
    <section className="auth-card client-signup-card">
      <div className="auth-intro">
        <span>DESIGN BLOCKS CLIENT PORTAL</span>
        <h1>Request portal access</h1>
        <p>Submit your details for review. Portal access is enabled only after a Design Blocks administrator approves your request.</p>
      </div>
      {!isBackendMode
        ? <p className="form-note">Client access requests are unavailable while the CRM is in demo mode.</p>
        : submitted
          ? <div className="client-signup-success" role="status">
            <strong>Request submitted</strong>
            <p>Your request is awaiting administrator approval. You can return to client sign in after Design Blocks contacts you.</p>
            <Link to="/client-login">Return to client sign in</Link>
          </div>
          : <form className="auth-form" onSubmit={submit}>
            <label className="form-field"><span>Your name *</span><input autoComplete="name" required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label className="form-field"><span>Company *</span><input autoComplete="organization" required maxLength={160} value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} /></label>
            <label className="form-field"><span>Email address *</span><input type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            <label className="form-field"><span>Phone number *</span><input type="tel" autoComplete="tel" required maxLength={40} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
            <label className="form-field"><span>Address (optional)</span><textarea autoComplete="street-address" maxLength={1000} rows={3} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <Button type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit access request'}</Button>
          </form>}
      <p className="auth-disclaimer">Already have an account? <Link to="/client-login">Client sign in</Link></p>
    </section>
  </main>
}
