import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/useApp'
import { useAuth } from '../../auth/useAuth'
import { Button } from '../common/UI'

export default function ChangePasswordForm({ forced = false, onCancel }) {
  const { changePassword, user } = useAuth()
  const { notify } = useApp()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (newPassword.length < 12) {
      setError('Use a new password with at least 12 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('The new password and confirmation do not match.')
      return
    }
    setSaving(true)
    try {
      await changePassword({ currentPassword, newPassword })
      notify('Password changed. Sign in again with your new password.')
      navigate(user?.role === 'client' ? '/client-login' : '/login', { replace: true })
    } catch (cause) {
      setError(cause.message || 'Could not change your password.')
    } finally {
      setSaving(false)
    }
  }

  return <form className="record-form" onSubmit={submit}>
    {forced && <p className="form-note">Your administrator provided a temporary password. Change it before continuing to the CRM.</p>}
    <label className="form-field"><span>Current password *</span><input type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
    <label className="form-field"><span>New password *</span><input type="password" autoComplete="new-password" minLength={12} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
    <label className="form-field"><span>Confirm new password *</span><input type="password" autoComplete="new-password" minLength={12} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-actions">
      {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>}
      <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Change password'}</Button>
    </div>
  </form>
}
