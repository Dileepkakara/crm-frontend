import { useEffect, useState } from 'react'
import { Building2, RotateCcw, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { apiClient, isBackendMode, resetDemoData } from '../../api/apiClient'
import { useApp } from '../../context/useApp'
import { readPreferences, savePreferences } from '../../services/storageService'
import { Button, PageHeader } from '../../components/common/UI'

export default function SettingsPage() {
  const { notify } = useApp()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState(false)
  const [preferences, setPreferences] = useState(() => isBackendMode
    ? { companyName: '', subtitle: '', currency: 'INR · Indian Rupee' }
    : readPreferences())
  const [saving, setSaving] = useState(false)
  const [settingsLoaded, setSettingsLoaded] = useState(!isBackendMode)

  useEffect(() => {
    if (!isBackendMode) return
    apiClient.get('companySettings').then(({ data }) => {
      setPreferences(data)
      setSettingsLoaded(true)
    })
      .catch((error) => notify(error.message || 'Could not load company settings.', 'error'))
  }, [notify])

  async function saveSettings() {
    if (!isBackendMode) {
      savePreferences(preferences)
      notify('Demo preferences saved in this browser.')
      return
    }
    setSaving(true)
    try {
      const { data } = await apiClient.endpoint('/settings/company', 'PATCH', preferences)
      setPreferences(data)
      notify('Company settings saved.')
    } catch (error) {
      notify(error.message || 'Could not save company settings.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function reset() {
    try {
      await resetDemoData()
      setConfirm(false)
      notify('Demo data reset to the original sample dataset.')
      navigate('/', { replace: true })
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  return <div className="page">
    <PageHeader title="Settings" description={isBackendMode ? 'Manage company identity and document defaults.' : 'Manage demo workspace preferences and sample data.'} />
    <div className="settings-grid">
      <section className="panel settings-section">
        <div className="panel-heading"><span className="settings-section-icon"><Building2 size={20} /></span><div><h2>Company profile</h2><p>Workspace identity shown in this prototype</p></div></div>
        <label className="form-field"><span>Company name</span><input value={preferences.companyName} onChange={(event) => setPreferences({ ...preferences, companyName: event.target.value })} placeholder="Enter company name" /></label>
        <label className="form-field"><span>Workspace subtitle</span><input value={preferences.subtitle} onChange={(event) => setPreferences({ ...preferences, subtitle: event.target.value })} placeholder="Enter workspace subtitle" /></label>
        <label className="form-field"><span>Currency preference</span><select value={preferences.currency} onChange={(event) => setPreferences({ ...preferences, currency: event.target.value })}>
          <option>INR · Indian Rupee</option><option>USD · US Dollar</option>
        </select></label>
        <Button disabled={saving || !settingsLoaded} onClick={saveSettings}>{saving ? 'Saving…' : 'Save preferences'}</Button>
        <small className="muted">{isBackendMode ? 'Settings are stored by the CRM API.' : 'Preferences are prototype-only and are not synchronized.'}</small>
      </section>
      {!isBackendMode && <>
      <section className="panel settings-section">
        <div className="panel-heading"><span className="settings-section-icon settings-section-icon-warning"><RotateCcw size={19} /></span><div><h2>Demo data management</h2><p>Reset local sample changes made during this session</p></div></div>
        <div className="reset-warning"><strong>Reset demo workspace</strong><p>This restores all CRM records to the original fictional dataset. This action cannot be undone.</p>
          <Button variant="danger" onClick={() => setConfirm(true)}><RotateCcw size={15} /> Reset all demo data</Button>
        </div>
        <div className="prototype-callout"><ShieldCheck size={17} /> Never store real passwords, payment details, or sensitive documents in this browser prototype.</div>
      </section>
      </>}
    </div>
    {confirm && <div className="modal-backdrop"><section className="modal" role="alertdialog" aria-modal="true">
      <header className="modal-header"><div><h2>Reset the demo workspace?</h2><p>All browser demo changes will be replaced with the initial sample data.</p></div></header>
      <div className="confirm-actions"><Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button><Button variant="danger" onClick={reset}>Reset demo data</Button></div>
    </section></div>}
  </div>
}
