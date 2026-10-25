import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Search, ShieldCheck, X } from 'lucide-react'
import { apiFor } from '../../api/resourcesApi'
import { clientSignupApi } from '../../api/clientSignupApi'
import { Button, Modal, PageHeader } from '../../components/common/UI'
import { useApp } from '../../context/useApp'

function formatSubmittedAt(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

export default function ClientSignupRequestsPage() {
  const { notify } = useApp()
  const [requests, setRequests] = useState([])
  const [clients, setClients] = useState([])
  const [status, setStatus] = useState('Pending')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [decision, setDecision] = useState(null)
  const [existingClientId, setExistingClientId] = useState('')
  const [reason, setReason] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [credentials, setCredentials] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [requestRecords, clientRecords] = await Promise.all([
        clientSignupApi.list(status),
        apiFor.clients.list(),
      ])
      setRequests(requestRecords)
      setClients(clientRecords)
    } catch (cause) {
      notify(cause.message || 'Could not load client signup requests.', 'error')
    } finally {
      setLoading(false)
    }
  }, [notify, status])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const visibleRequests = requests.filter((request) =>
    `${request.name} ${request.company} ${request.email} ${request.phone}`.toLowerCase().includes(query.toLowerCase()))

  function openDecision(request, action) {
    const matchingClient = clients.find((client) => client.email?.toLowerCase() === request.email.toLowerCase())
    setDecision({ request, action })
    setExistingClientId(matchingClient?.id || '')
    setReason('')
    setError('')
  }

  async function submitDecision(event) {
    event.preventDefault()
    if (!decision || working) return
    setWorking(true)
    setError('')
    try {
      if (decision.action === 'approve') {
        const result = await clientSignupApi.approve(decision.request.id, existingClientId)
        setCredentials(result.credentials)
        notify('Client access approved. Share the temporary password through a safe channel.')
      } else {
        await clientSignupApi.reject(decision.request.id, reason)
        notify('Client signup request rejected.')
      }
      setDecision(null)
      await load()
    } catch (cause) {
      setError(cause.message || 'Could not update the signup request.')
    } finally {
      setWorking(false)
    }
  }

  async function copyTemporaryPassword() {
    try {
      await navigator.clipboard.writeText(credentials.temporaryPassword)
      notify('Temporary password copied. Deliver it to the client through a safe channel.')
    } catch (cause) {
      notify(cause.message || 'Could not copy the temporary password. Select and copy it manually.', 'error')
    }
  }

  return <div className="page">
    <PageHeader title="Client signup requests" description="Review client access requests. Approved clients receive a one-time temporary password and must change it at first sign in." />
    <div className="prototype-callout"><ShieldCheck size={17} /> Temporary passwords are shown once after approval and are never sent by email or saved in the request record.</div>
    <section className="panel records-panel">
      <div className="table-toolbar quotation-toolbar">
        <label className="list-search"><Search size={18} aria-hidden="true" /><input aria-label="Search client signup requests" placeholder="Search name, company, email, or phone…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <select aria-label="Filter client signup requests" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option>Pending</option><option>Approved</option><option>Rejected</option><option>All</option>
        </select>
      </div>
      {loading ? <div className="loading-inline"><span className="spinner" /> Loading requests…</div>
        : <div className="table-scroll"><table className="data-table"><thead><tr><th>Contact</th><th>Company</th><th>Email / phone</th><th>Submitted</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{visibleRequests.map((request) => <tr key={request.id}>
            <td><strong className="table-primary">{request.name}</strong></td><td>{request.company}</td>
            <td>{request.email}<br /><small>{request.phone}</small></td><td>{formatSubmittedAt(request.createdAt)}</td>
            <td><span className={`badge badge-${request.status.toLowerCase()}`}>{request.status}</span></td>
            <td>{request.status === 'Pending' && <div className="row-actions">
              <button title="Approve request" aria-label={`Approve request from ${request.name}`} onClick={() => openDecision(request, 'approve')}><Check size={16} /></button>
              <button title="Reject request" aria-label={`Reject request from ${request.name}`} className="danger-action" onClick={() => openDecision(request, 'reject')}><X size={16} /></button>
            </div>}</td>
          </tr>)}</tbody></table></div>}
      {!loading && !visibleRequests.length && <div className="empty-state"><strong>No signup requests found</strong><span>Try another status or search term.</span></div>}
    </section>

    {decision && <Modal title={decision.action === 'approve' ? 'Approve client access' : 'Reject signup request'}
      description={decision.action === 'approve' ? `Approve ${decision.request.name} and create or link a client account?` : `Reject the request from ${decision.request.name}?`}
      onClose={() => !working && setDecision(null)}>
      <form className="record-form" onSubmit={submitDecision}>
        {decision.action === 'approve'
          ? <label className="form-field"><span>Link to an existing client (optional)</span>
            <select value={existingClientId} onChange={(event) => setExistingClientId(event.target.value)}>
              <option value="">Create a new client record unless an exact email match exists</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name} · {client.company} · {client.email}</option>)}
            </select>
            <small className="muted">Existing records must match the request identity. Inactive client records must be reactivated first.</small>
          </label>
          : <label className="form-field"><span>Reason (optional)</span><textarea rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Enter reason for rejection" /></label>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions"><Button type="button" variant="secondary" disabled={working} onClick={() => setDecision(null)}>Cancel</Button>
          <Button type="submit" disabled={working}>{working ? 'Saving…' : decision.action === 'approve' ? 'Approve and create access' : 'Reject request'}</Button></div>
      </form>
    </Modal>}

    {credentials && <Modal title="Client access approved" description="This temporary password is shown only now. Deliver it to the client using a safe, administrator-mediated channel." onClose={() => setCredentials(null)}>
      <div className="record-form client-credential-panel" role="status">
        <p><strong>Sign-in page:</strong> <code>{window.location.origin}/client-login</code></p>
        <label className="form-field"><span>Email address</span><input readOnly value={credentials.email} /></label>
        <label className="form-field"><span>Temporary password</span><input readOnly value={credentials.temporaryPassword} /></label>
        <p className="form-note">The client must change this password before accessing the portal. Closing this dialog discards the password; it cannot be retrieved from the CRM.</p>
        <div className="modal-actions"><Button type="button" variant="secondary" onClick={copyTemporaryPassword}><Copy size={15} /> Copy password</Button><Button type="button" onClick={() => setCredentials(null)}>Done</Button></div>
      </div>
    </Modal>}
  </div>
}
