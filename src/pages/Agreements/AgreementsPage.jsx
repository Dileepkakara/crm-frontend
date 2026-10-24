import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { usePermissions } from '../../auth/usePermissions'
import { apiFor, scopeResourceRecords } from '../../api/resourcesApi'
import { useApp } from '../../context/useApp'
import { Badge, Button, PageHeader } from '../../components/common/UI'
import SalesDocument from '../SalesFinance/SalesDocument'
import { canAccessRecord } from '../../services/permissionsService'
import { readPreferences } from '../../services/storageService'
import { loadCompanySettings } from '../../api/companySettingsApi'
import { formatDate } from '../../utils/formatters'
import { apiClient, isBackendMode } from '../../api/apiClient'
import { ROLES } from '../../config/roles'

const today = () => new Date().toISOString().slice(0, 10)
const blankForm = (preferences = {}) => ({
  id: `WO-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
  clientId: '', client: '', billingName: '', billingAddress: '', customerGstin: '',
  contactEmail: '', contactPhone: '', quotationId: '', project: '', scope: '',
  deliverables: '', createdAt: today(), startDate: '', deadline: '',
  paymentMilestones: '', terms: '', status: 'Draft',
  companyGstin: preferences.companyGstin || preferences.gstin || '',
  companyAddress: preferences.companyAddress || '',
  bankDetails: preferences.bankDetails || '',
})

export default function AgreementsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { hasPermission: can } = usePermissions()
  const { notify } = useApp()
  const [records, setRecords] = useState([])
  const [clients, setClients] = useState([])
  const [quotations, setQuotations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All statuses')
  const [form, setForm] = useState(null)
  const [editing, setEditing] = useState(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [working, setWorking] = useState('')
  const [preferences, setPreferences] = useState(() => isBackendMode ? {} : readPreferences())

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      if (isBackendMode && user?.role === ROLES.CLIENT) {
        const [{ data: portal }, companySettings] = await Promise.all([
          apiClient.get('portal'), loadCompanySettings(),
        ])
        setPreferences(companySettings)
        setRecords(portal.agreements)
        setClients([portal.client])
        setQuotations(portal.quotations)
        return
      }
      const [agreements, clientRecords, quoteRecords, companySettings] = await Promise.all([
        apiFor.agreements.list(), apiFor.clients.list(), apiFor.quotations.list(), loadCompanySettings(),
      ])
      setPreferences(companySettings)
      setRecords(scopeResourceRecords('agreements', agreements, user))
      setClients(scopeResourceRecords('clients', clientRecords, user))
      setQuotations(scopeResourceRecords('quotations', quoteRecords, user))
    } catch (cause) {
      if (!silent) notify(cause.message || 'Could not load work orders.', 'error')
    } finally {
      setLoading(false)
    }
  }, [notify, user])
  useEffect(() => {
    let active = true
    const initialTimer = window.setTimeout(() => { if (active) void load() }, 0)
    const refreshWhenVisible = () => {
      if (active && document.visibilityState === 'visible') void load({ silent: true })
    }
    const interval = window.setInterval(refreshWhenVisible, 15_000)
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      active = false
      window.clearTimeout(initialTimer)
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [load])

  async function updateAgreement(record, action) {
    setWorking(`${record.id}:${action}`)
    try {
      if (action === 'submit') await apiFor.agreements.submit(record.id)
      else if (action === 'accept') await apiFor.agreements.accept(record.id)
      else await apiFor.projects.fromAgreement(record.id)
      notify(action === 'submit' ? 'Work order sent to the client portal.' : action === 'accept' ? 'Work order acceptance recorded.' : 'Project created from the accepted work order.')
      await load()
    } catch (error) {
      notify(error.message || 'Could not update the work order.', 'error')
    } finally {
      setWorking('')
    }
  }
  useEffect(() => {
    if (!printing) return undefined
    const finish = () => setPrinting(false)
    window.addEventListener('afterprint', finish)
    const timer = window.setTimeout(() => window.print(), 80)
    return () => { window.removeEventListener('afterprint', finish); window.clearTimeout(timer) }
  }, [printing])

  const visibleRecords = records.filter((record) =>
    (status === 'All statuses' || record.status === status)
    && `${record.id} ${record.client} ${record.project} ${record.quotationId}`.toLowerCase().includes(search.toLowerCase()))

  function startCreate(quotation = null) {
    setEditing(null)
    const next = blankForm(preferences)
    if (quotation) {
      const client = clients.find((item) => item.id === quotation.clientId)
      Object.assign(next, {
        clientId: quotation.clientId || '',
        client: client?.company || quotation.client || '',
        billingName: client?.name || '',
        billingAddress: client?.address || '',
        customerGstin: client?.gstin || '',
        contactEmail: client?.email || '',
        contactPhone: client?.phone || '',
        quotationId: quotation.id,
        project: quotation.title || '',
        scope: (quotation.items || quotation.lineItems || []).map((item) => item.description).filter(Boolean).join('\n'),
      })
    }
    setForm(next)
    setError('')
  }
  function startEdit(record) {
    if (!can('agreements.approve') || !canAccessRecord('agreements', record, user)) {
      notify('Your role cannot edit this work order.', 'error')
      return
    }
    setEditing(record)
    setForm({ ...blankForm(preferences), ...record, createdAt: record.createdAt || today() })
    setError('')
  }
  function selectClient(clientId) {
    const client = clients.find((item) => item.id === clientId)
    setForm((current) => ({
      ...current, clientId, client: client?.company || client?.name || '',
      billingName: client?.name || '', billingAddress: client?.address || '',
      customerGstin: client?.gstin || '', contactEmail: client?.email || '',
      contactPhone: client?.phone || '',
    }))
  }
  function selectQuotation(quotationId) {
    const quotation = quotations.find((item) => item.id === quotationId)
    if (!quotation) { setForm({ ...form, quotationId: '' }); return }
    const client = clients.find((item) => item.id === quotation.clientId)
    setForm({
      ...form,
      quotationId,
      clientId: quotation.clientId || form.clientId,
      client: client?.company || quotation.client || form.client,
      billingName: client?.name || form.billingName,
      billingAddress: client?.address || form.billingAddress,
      customerGstin: client?.gstin || form.customerGstin,
      contactEmail: client?.email || form.contactEmail,
      contactPhone: client?.phone || form.contactPhone,
      project: quotation.title || form.project,
      scope: (quotation.items || quotation.lineItems || []).map((item) => item.description).filter(Boolean).join('\n') || form.scope,
    })
  }
  function makeDocument() { return { ...form, status: editing?.status || form.status || 'Draft' } }
  function openPreview() {
    if (!form.clientId || !form.project.trim()) { setError('Select the client and add a project or service description before previewing.'); return }
    setError('')
    setPreview(makeDocument())
  }
  function printRecord(record) {
    setPreview(record)
    setPrinting(true)
  }
  async function saveDraft(event) {
    event.preventDefault()
    if (!can('agreements.approve')) { notify('Your role cannot save work orders.', 'error'); return }
    if (!form.clientId || !form.project.trim() || !form.createdAt) {
      setError('Select a client and provide a project description and issue date.')
      return
    }
    if (form.quotationId && !quotations.some((quote) => quote.id === form.quotationId)) {
      setError('Select an available quotation or clear the quotation reference.')
      return
    }
    setSaving(true)
    try {
      const document = makeDocument()
      const saved = editing
        ? await apiFor.agreements.update(editing.id, document)
        : await apiFor.agreements.create(document)
      await load()
      setForm(null)
      setEditing(null)
      setPreview(saved)
      notify(editing ? 'Work order updated.' : 'Work order draft saved. No acceptance has been recorded.')
    } catch (cause) {
      notify(cause.message || 'Could not save this work order.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (preview) return <div className={`page sales-document-page work-order-document-page${printing ? ' is-printing' : ''}`}>
    <PageHeader title="Work order preview" description="Review this demo work order before printing." />
    <SalesDocument kind="Work Order" record={preview}
      client={clients.find((item) => item.id === preview.clientId)} preferences={preferences}
      onBack={() => setPreview(null)} onPrint={() => setPrinting(true)}
      onEdit={can('agreements.approve') ? () => { startEdit(preview); setPreview(null) } : undefined}
      canEdit={can('agreements.approve')} />
  </div>

  if (form) return <div className="page sales-document-page">
    <PageHeader title={editing ? `Edit work order ${editing.id}` : 'Create work order'} description="Create a draft linked to a client and, optionally, an approved quotation." />
    <form className="sales-module-form" onSubmit={saveDraft}>
      <section className="sales-module-section"><h2>1. Work order details</h2><div className="sales-module-fields">
        <label className="form-field"><span>Work order number</span><input value={form.id} onChange={(event) => setForm({ ...form, id: event.target.value })} /></label>
        <label className="form-field"><span>Issue date</span><input type="date" value={form.createdAt} onChange={(event) => setForm({ ...form, createdAt: event.target.value })} /></label>
        <label className="form-field"><span>Status</span><input value={form.status} readOnly /></label>
        <label className="form-field"><span>Related quotation</span><select value={form.quotationId} onChange={(event) => selectQuotation(event.target.value)}><option value="">No related quotation</option>{quotations.filter((quote) => quote.status === 'Accepted' || quote.id === editing?.quotationId).map((quote) => <option key={quote.id} value={quote.id}>{quote.id} · {quote.client}</option>)}</select></label>
        <label className="form-field"><span>Client</span><select value={form.clientId} onChange={(event) => selectClient(event.target.value)}><option value="">Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.company || client.name}</option>)}</select></label>
        <label className="form-field"><span>Project / service</span><input value={form.project} onChange={(event) => setForm({ ...form, project: event.target.value })} /></label>
      </div></section>
      <section className="sales-module-section"><h2>2. Client billing details</h2><div className="sales-module-fields">
        <label className="form-field"><span>Bill to</span><input value={form.billingName} onChange={(event) => setForm({ ...form, billingName: event.target.value })} /></label>
        <label className="form-field"><span>GSTIN</span><input value={form.customerGstin} onChange={(event) => setForm({ ...form, customerGstin: event.target.value })} /></label>
        <label className="form-field"><span>Contact email</span><input type="email" value={form.contactEmail} onChange={(event) => setForm({ ...form, contactEmail: event.target.value })} /></label>
        <label className="form-field field-wide"><span>Billing address</span><textarea rows="2" value={form.billingAddress} onChange={(event) => setForm({ ...form, billingAddress: event.target.value })} /></label>
        <label className="form-field"><span>Contact phone</span><input value={form.contactPhone} onChange={(event) => setForm({ ...form, contactPhone: event.target.value })} /></label>
      </div></section>
      <section className="sales-module-section"><h2>3. Scope and deliverables</h2><div className="sales-module-fields">
        <label className="form-field field-wide"><span>Approved scope of work</span><textarea rows="4" value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value })} /></label>
        <label className="form-field field-wide"><span>Deliverables</span><textarea rows="3" value={form.deliverables} onChange={(event) => setForm({ ...form, deliverables: event.target.value })} /></label>
      </div></section>
      <section className="sales-module-section"><h2>4. Project timeline and terms</h2><div className="sales-module-fields">
        <label className="form-field"><span>Start date</span><input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label>
        <label className="form-field"><span>Target completion</span><input type="date" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} /></label>
        <label className="form-field field-wide"><span>Payment milestones</span><textarea rows="2" value={form.paymentMilestones} onChange={(event) => setForm({ ...form, paymentMilestones: event.target.value })} /></label>
        <label className="form-field field-wide"><span>Terms and conditions</span><textarea rows="3" value={form.terms} onChange={(event) => setForm({ ...form, terms: event.target.value })} /></label>
      </div></section>
      <section className="sales-module-section"><h2>Company and bank details</h2><div className="sales-module-fields">
        <label className="form-field"><span>Company name</span><input value={preferences.companyName || 'Design Blocks'} readOnly /></label>
        <label className="form-field"><span>Company logo</span><div className="sales-module-logo"><img src="/design-blocks-logo.png" alt="Design Blocks logo" /></div></label>
        <label className="form-field"><span>Company GSTIN</span><input value={form.companyGstin} onChange={(event) => setForm({ ...form, companyGstin: event.target.value })} /></label>
        <label className="form-field field-wide"><span>Company address</span><textarea rows="2" value={form.companyAddress} onChange={(event) => setForm({ ...form, companyAddress: event.target.value })} /></label>
        <label className="form-field field-wide"><span>Bank details (optional)</span><textarea rows="3" value={form.bankDetails} onChange={(event) => setForm({ ...form, bankDetails: event.target.value })} placeholder="Enter only verified business bank details." /></label>
      </div></section>
      <p className="form-note">Saving or previewing a work order does not constitute client acceptance or an electronic signature.</p>
      {error && <p className="sales-module-error" role="alert">{error}</p>}
      <div className="sales-module-actions"><Button type="button" variant="secondary" onClick={openPreview}>Preview</Button><Button type="button" variant="secondary" onClick={() => { setForm(null); setEditing(null) }}>Back to work orders</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</Button></div>
    </form>
  </div>

  const canView = can('agreements.view') || can('agreements.view.own')
  if (!canView) return <div className="page"><div className="sales-module-empty">You do not have access to work orders.</div></div>
  return <div className="page">
    <PageHeader title="Work orders" description="Review approved scope, delivery terms, and work order documents."
      actions={can('agreements.approve') && <div className="sales-module-actions"><Button onClick={() => startCreate()}>Create work order</Button>
        {quotations.some((quote) => quote.status === 'Accepted') && <select aria-label="Create work order from approved quotation" defaultValue="" onChange={(event) => { const quote = quotations.find((item) => item.id === event.target.value); if (quote) startCreate(quote) }}>
          <option value="">From approved quotation…</option>{quotations.filter((quote) => quote.status === 'Accepted').map((quote) => <option key={quote.id} value={quote.id}>{quote.id}</option>)}
        </select>}</div>} />
    <section className="panel records-panel">
      <div className="table-toolbar quotation-toolbar">
        <label className="list-search"><Search size={18} aria-hidden="true" /><input aria-label="Search work orders" placeholder="Search work order, client, or project…" value={search} onChange={(event) => setSearch(event.target.value)} />
          {search && <button className="list-search-clear" type="button" aria-label="Clear work order search" onClick={() => setSearch('')}><X size={17} /></button>}
        </label>
        <select aria-label="Filter work orders by status" value={status} onChange={(event) => setStatus(event.target.value)}>{['All statuses', 'Draft', 'Pending approval', 'Accepted', 'Rejected'].map((value) => <option key={value}>{value}</option>)}</select>
      </div>
      {loading ? <div className="loading-inline">Loading work orders…</div> : visibleRecords.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Work order no.</th><th>Client</th><th>Quotation</th><th>Project / service</th><th>Issue date</th><th>Start date</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{visibleRecords.map((record) => {
          const quotationSnapshot = record.quotationSnapshot || record.acceptedSnapshot?.quotationSnapshot
          const sourceQuotation = quotations.find((quotation) => quotation.id === record.quotationId) || quotationSnapshot
          const hasInvoiceItems = Boolean(sourceQuotation?.items?.length || sourceQuotation?.lineItems?.length)
          return <tr key={record.id}><td>{record.id}</td><td>{record.client}</td><td>{record.quotationId || '—'}</td><td>{record.project}</td><td>{formatDate(record.createdAt)}</td><td>{formatDate(record.startDate)}</td><td><Badge>{record.status}</Badge></td><td><div className="sales-module-row-actions quotation-row-actions"><button onClick={() => setPreview(record)}>View</button><button onClick={() => printRecord(record)}>Print</button>
          {can('invoices.manage') && record.status === 'Accepted' && hasInvoiceItems && <button onClick={() => navigate('/invoices', { state: { invoiceSource: { kind: 'agreement', record } } })}>Create invoice</button>}
          {can('agreements.approve') && record.status === 'Draft' && <button disabled={Boolean(working)} onClick={() => updateAgreement(record, 'submit')}>Send for approval</button>}
          {user?.role === ROLES.CLIENT && record.status === 'Pending approval' && <button disabled={Boolean(working)} onClick={() => updateAgreement(record, 'accept')}>Accept</button>}
          {can('agreements.approve') && can('projects.manage') && record.status === 'Accepted' && !record.projectId && <button disabled={Boolean(working)} onClick={() => updateAgreement(record, 'project')}>Create project</button>}
          {can('agreements.approve') && record.status === 'Draft' && <button onClick={() => startEdit(record)}>Edit</button>}
        </div></td></tr>
        })}</tbody></table></div> : <div className="sales-module-empty">No work orders found.</div>}
    </section>
  </div>
}
