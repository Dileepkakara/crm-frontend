import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { usePermissions } from '../../auth/usePermissions'
import { apiFor, scopeResourceRecords } from '../../api/resourcesApi'
import { useApp } from '../../context/useApp'
import { Button, PageHeader } from '../../components/common/UI'
import ClientSearchSelect from '../../components/common/ClientSearchSelect'
import SalesDocument from '../SalesFinance/SalesDocument'
import { filterRecordsForUser } from '../../services/permissionsService'
import { readPreferences } from '../../services/storageService'
import { loadCompanySettings } from '../../api/companySettingsApi'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { amountInWords } from '../../utils/amountInWords'
import { apiClient, isBackendMode } from '../../api/apiClient'

const today = () => new Date().toISOString().slice(0, 10)
const nextNumber = () => `QT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
const defaultTerms = 'Quotation prices are valid for 20 days from the date of issue.\nAny increase in project scope will result in an additional cost.'
const blankItem = () => ({ description: '', quantity: '1', rate: '' })
const blankForm = (preferences = {}) => ({
  id: '', clientId: '', client: '', billingName: '', billingAddress: '', customerGstin: '',
  contactEmail: '', contactPhone: '', title: '', issueDate: today(), validUntil: '',
  items: [blankItem()], discount: '0', gstEnabled: false, sgstEnabled: true, cgstEnabled: true,
  sgstRate: '', cgstRate: '', terms: defaultTerms,
  companyGstin: preferences.companyGstin || preferences.gstin || '',
  companyAddress: preferences.companyAddress || '',
  bankDetails: preferences.bankDetails || '',
})

function calculate(form) {
  const subtotal = form.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.rate || 0), 0)
  const discount = Math.min(subtotal, Math.max(0, Number(form.discount) || 0))
  const taxableValue = subtotal - discount
  const sgstAmount = form.gstEnabled && form.sgstEnabled ? Math.round(taxableValue * (Number(form.sgstRate) || 0)) / 100 : 0
  const cgstAmount = form.gstEnabled && form.cgstEnabled ? Math.round(taxableValue * (Number(form.cgstRate) || 0)) / 100 : 0
  const tax = Math.round((sgstAmount + cgstAmount) * 100) / 100
  return { subtotal, discount, taxableValue, sgstAmount, cgstAmount, tax, total: Math.round((taxableValue + tax) * 100) / 100 }
}

function toForm(record, preferences) {
  const sourceItems = record.items || record.lineItems || []
  const preserveLegacyTotal = sourceItems.length === 0
  return {
    ...blankForm(preferences),
    ...record,
    id: record.id,
    preserveLegacyTotal,
    items: sourceItems.map((item) => ({
      description: item.description || '',
      quantity: String(item.quantity ?? 1),
      rate: String(item.rate ?? ''),
    })).length ? sourceItems.map((item) => ({
      description: item.description || '',
      quantity: String(item.quantity ?? 1),
      rate: String(item.rate ?? ''),
    })) : [blankItem()],
    discount: String(record.discount ?? 0),
    sgstRate: String(record.sgstRate ?? ''),
    cgstRate: String(record.cgstRate ?? ''),
  }
}

export default function QuotationsPage() {
  const { user } = useAuth()
  const { hasPermission: can } = usePermissions()
  const { notify } = useApp()
  const [records, setRecords] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All statuses')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blankForm)
  const [clientQuery, setClientQuery] = useState('')
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [transitioning, setTransitioning] = useState('')
  const [preferences, setPreferences] = useState(() => isBackendMode ? {} : readPreferences())
  const totals = useMemo(() => form.preserveLegacyTotal
    ? { subtotal: 0, discount: Number(editing?.discount) || 0, taxableValue: 0, sgstAmount: 0, cgstAmount: 0, tax: Number(editing?.tax) || 0, total: Number(editing?.amount ?? editing?.total) || 0 }
    : calculate(form), [form, editing])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (isBackendMode && user?.role === 'client') {
        const [{ data: portal }, companySettings] = await Promise.all([
          apiClient.get('portal'), loadCompanySettings(),
        ])
        setPreferences(companySettings)
        setRecords(portal.quotations)
        setClients([portal.client])
        return
      }
      const [quotes, clientRecords, companySettings] = await Promise.all([
        apiFor.quotations.list(), apiFor.clients.list(), loadCompanySettings(),
      ])
      setPreferences(companySettings)
      setRecords(scopeResourceRecords('quotations', quotes, user))
      setClients(scopeResourceRecords('clients', clientRecords, user))
    } catch (cause) {
      notify(cause.message || 'Could not load quotations.', 'error')
    } finally {
      setLoading(false)
    }
  }, [notify, user])
  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])
  useEffect(() => {
    if (!printing) return undefined
    const finish = () => setPrinting(false)
    window.addEventListener('afterprint', finish)
    const timer = window.setTimeout(() => window.print(), 80)
    return () => { window.removeEventListener('afterprint', finish); window.clearTimeout(timer) }
  }, [printing])

  const visibleRecords = records.filter((record) =>
    (status === 'All statuses' || record.status === status)
    && `${record.id} ${record.client} ${record.title}`.toLowerCase().includes(search.toLowerCase()))

  function startCreate() {
    setEditing(null)
    setForm({ ...blankForm(preferences), id: nextNumber(), validUntil: '' })
    setClientQuery('')
    setError('')
  }
  function startEdit(record) {
    if (!can('quotations.create') || !filterRecordsForUser('quotations', [record], user).length) {
      notify('Your role cannot edit this quotation.', 'error')
      return
    }
    setEditing(record)
    setForm(toForm(record, preferences))
    const client = clients.find((item) => item.id === record.clientId)
    setClientQuery(client?.company || client?.name || record.client || '')
    setError('')
  }
  function updateClient(clientId) {
    const client = clients.find((item) => item.id === clientId)
    setForm((current) => ({
      ...current, clientId, client: client?.company || client?.name || '',
      billingName: client?.name || '', billingAddress: client?.address || '',
      customerGstin: client?.gstin || '', contactEmail: client?.email || '',
      contactPhone: client?.phone || '',
    }))
  }
  function handleClientSearch(query) {
    setClientQuery(query)
    if (form.clientId) updateClient('')
  }
  function chooseClient(client) {
    updateClient(client.id)
    setClientQuery(client.company || client.name || '')
  }
  function makeDocument(statusValue = 'Draft') {
    const preserveLegacyTotal = form.preserveLegacyTotal
      && form.items.every((item) => !item.description.trim() && item.rate === '')
    if (preserveLegacyTotal) {
      const document = { ...form, status: statusValue, preserveLegacyTotal: undefined }
      delete document.items
      return {
        ...document,
        ...(editing?.amount !== undefined ? { amount: editing.amount } : {}),
        ...(editing?.total !== undefined ? { total: editing.total } : {}),
        ...(editing?.subtotal !== undefined ? { subtotal: editing.subtotal } : {}),
        ...(editing?.tax !== undefined ? { tax: editing.tax } : {}),
      }
    }
    const values = calculate(form)
    return {
      ...form,
      preserveLegacyTotal: undefined,
      id: form.id || nextNumber(),
      status: statusValue,
      owner: editing?.owner || user.name,
      items: form.items.map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity),
        rate: Number(item.rate),
        amount: Number(item.quantity) * Number(item.rate),
      })),
      ...values,
      amount: values.total,
      total: values.total,
    }
  }
  async function saveDraft(event) {
    event.preventDefault()
    if (!can('quotations.create')) { notify('Your role cannot save quotations.', 'error'); return }
    const preservingLegacy = form.preserveLegacyTotal
      && form.items.every((item) => !item.description.trim() && item.rate === '')
    if (!form.clientId || !form.issueDate || !form.validUntil || !form.items.length
      || (!preservingLegacy && form.items.some((item) =>
        !item.description.trim() || Number(item.quantity) <= 0 || item.rate === ''
        || !Number.isFinite(Number(item.rate)) || Number(item.rate) < 0))) {
      setError('Select a client, complete the dates, and enter a description, positive quantity, and valid unit price for each item.')
      return
    }
    setSaving(true)
    try {
      const document = makeDocument(editing?.status || 'Draft')
      const saved = editing
        ? await apiFor.quotations.update(editing.id, document)
        : await apiFor.quotations.create(document)
      await load()
      setEditing(null)
      setForm(blankForm())
      setPreview(saved)
      notify(editing ? 'Quotation updated.' : 'Quotation draft saved.')
    } catch (cause) {
      notify(cause.message || 'Could not save the quotation.', 'error')
    } finally {
      setSaving(false)
    }
  }
  async function changeStatus(record, action) {
    setTransitioning(`${record.id}:${action}`)
    try {
      const updated = action === 'send' ? await apiFor.quotations.send(record.id)
        : action === 'approve' ? await apiFor.quotations.approve(record.id)
          : await apiFor.quotations.reject(record.id)
      setRecords((current) => current.map((item) => item.id === record.id ? updated : item))
      notify(action === 'send' ? 'Quotation sent to the client portal.' : `Quotation ${action === 'approve' ? 'accepted' : 'rejected'}.`)
    } catch (cause) {
      notify(cause.message || `Could not ${action} this quotation.`, 'error')
    } finally {
      setTransitioning('')
    }
  }
  function openPreview() {
    if (!form.clientId) { setError('Select a client before previewing the quotation.'); return }
    const preservingLegacy = form.preserveLegacyTotal
      && form.items.every((item) => !item.description.trim() && item.rate === '')
    if (!preservingLegacy && (!form.items.length || form.items.some((item) =>
      !item.description.trim() || Number(item.quantity) <= 0 || item.rate === ''
      || !Number.isFinite(Number(item.rate)) || Number(item.rate) < 0))) {
      setError('Enter a description, positive quantity, and valid unit price for each item.')
      return
    }
    setError('')
    setPreview(makeDocument(editing?.status || 'Draft'))
  }
  function printPreview() { setPrinting(true) }
  function printRecord(record) {
    setPreview(record)
    setPrinting(true)
  }
  function exportCsv() {
    const rows = [
      ['Quotation no.', 'Title', 'Client', 'Issue date', 'Valid until', 'Amount', 'Version', 'Status'],
      ...visibleRecords.map((record) => [
        record.id, record.title, record.client, formatDate(record.issueDate), formatDate(record.validUntil),
        formatCurrency(record.amount ?? record.total), record.version, record.status,
      ]),
    ]
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'quotations-demo-export.csv'
    link.click()
    URL.revokeObjectURL(url)
    notify('CSV export downloaded.')
  }

  if (preview) return <div className={`page sales-document-page quotation-document-page${printing ? ' is-printing' : ''}`}>
    <PageHeader title="Quotation preview" description="Review this demo quotation before printing." />
    <SalesDocument kind="Quotation" record={preview}
      client={clients.find((item) => item.id === preview.clientId)} preferences={preferences}
      onBack={() => setPreview(null)} onPrint={printPreview}
      onEdit={can('quotations.create') ? () => { startEdit(preview); setPreview(null) } : undefined}
      canEdit={can('quotations.create')} />
  </div>

  if (!can('quotations.view') && !can('quotations.view.own')) return <div className="page"><div className="sales-module-empty">You do not have access to quotations.</div></div>
  if (form.id) return <div className="page sales-document-page">
    <PageHeader title={editing ? `Edit quotation ${editing.id}` : 'Create quotation'} description="Complete the document details. Missing company or client details are left blank." />
    <div className="sales-builder-brand" aria-label="Design Blocks">
      <span>Design</span> <strong>Blocks</strong>
    </div>
    <form className="sales-module-form sales-builder-form" onSubmit={saveDraft}>
      <section className="sales-module-section"><h2>1. Quotation details</h2><div className="sales-module-fields">
        <label className="form-field"><span>Quotation number</span><input value={form.id} onChange={(event) => setForm({ ...form, id: event.target.value })} /></label>
        <label className="form-field"><span>Quotation date</span><input type="date" value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })} /></label>
        <label className="form-field"><span>Valid until</span><input type="date" value={form.validUntil} onChange={(event) => setForm({ ...form, validUntil: event.target.value })} /></label>
      </div></section>
      <section className="sales-module-section"><h2>2. Recipient details</h2><div className="sales-module-fields">
        <ClientSearchSelect clients={clients} selectedId={form.clientId} query={clientQuery}
          onQueryChange={handleClientSearch} onSelect={chooseClient} />
        <label className="form-field"><span>Bill to</span><input value={form.billingName} onChange={(event) => setForm({ ...form, billingName: event.target.value })} /></label>
        <label className="form-field"><span>Address</span><input value={form.billingAddress} onChange={(event) => setForm({ ...form, billingAddress: event.target.value })} /></label>
        <label className="form-field"><span>Customer GSTIN</span><input value={form.customerGstin} onChange={(event) => setForm({ ...form, customerGstin: event.target.value })} /></label>
        <label className="form-field"><span>Email</span><input type="email" value={form.contactEmail} onChange={(event) => setForm({ ...form, contactEmail: event.target.value })} /></label>
        <label className="form-field"><span>Phone</span><input value={form.contactPhone} onChange={(event) => setForm({ ...form, contactPhone: event.target.value })} /></label>
        <label className="form-field"><span>Quotation title</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
      </div></section>
      <section className="sales-module-section"><div className="sales-module-toolbar"><h2>3. Items</h2><Button className="sales-builder-add" type="button" onClick={() => setForm({ ...form, preserveLegacyTotal: false, items: [...form.items, blankItem()] })}>Add item</Button></div>
        {form.preserveLegacyTotal && <p className="form-note">This existing quotation has a recorded total but no item breakdown. It will be preserved unless item details are added.</p>}
        <div className="sales-module-items">{form.items.map((item, index) => <div className="sales-module-item" key={index}>
          <label className="form-field"><span>Description</span><input placeholder="Enter item description" value={item.description} onChange={(event) => setForm({ ...form, preserveLegacyTotal: false, items: form.items.map((row, i) => i === index ? { ...row, description: event.target.value } : row) })} /></label>
          <label className="form-field"><span>Quantity</span><input type="number" min="0.01" step="any" value={item.quantity} onChange={(event) => setForm({ ...form, preserveLegacyTotal: false, items: form.items.map((row, i) => i === index ? { ...row, quantity: event.target.value } : row) })} /></label>
          <label className="form-field"><span>Unit price</span><input type="number" min="0" step="0.01" value={item.rate} onChange={(event) => setForm({ ...form, preserveLegacyTotal: false, items: form.items.map((row, i) => i === index ? { ...row, rate: event.target.value } : row) })} /></label>
          <Button type="button" variant="secondary" disabled={form.items.length === 1} onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== index) })}>Remove</Button>
        </div>)}</div>
      </section>
      <section className="sales-module-section"><h2>4. GST info and totals</h2>
        <div className="sales-module-gst"><label><input type="checkbox" checked={form.gstEnabled} onChange={(event) => setForm({ ...form, gstEnabled: event.target.checked })} /> Apply GST</label>
          {form.gstEnabled && <><label><input type="checkbox" checked={form.sgstEnabled} onChange={(event) => setForm({ ...form, sgstEnabled: event.target.checked, cgstEnabled: event.target.checked ? form.cgstEnabled : false })} /> SGST</label>
            <label><input type="checkbox" checked={form.cgstEnabled} onChange={(event) => setForm({ ...form, cgstEnabled: event.target.checked, sgstEnabled: event.target.checked ? form.sgstEnabled : false })} /> CGST</label>
            <label className="form-field"><span>SGST rate (%)</span><input type="number" min="0" max="100" step="0.01" value={form.sgstRate} disabled={!form.sgstEnabled} onChange={(event) => setForm({ ...form, sgstRate: event.target.value })} /></label>
            <label className="form-field"><span>CGST rate (%)</span><input type="number" min="0" max="100" step="0.01" value={form.cgstRate} disabled={!form.cgstEnabled} onChange={(event) => setForm({ ...form, cgstRate: event.target.value })} /></label></>}
          <label className="form-field"><span>Discount (₹)</span><input type="number" min="0" step="0.01" value={form.discount} onChange={(event) => setForm({ ...form, discount: event.target.value })} /></label>
        </div>
        <div className="sales-doc-summary"><div className="sales-doc-words"><strong>Amount in words</strong><span>{amountInWords(totals.total)}</span></div><dl><div><dt>Subtotal</dt><dd>{formatCurrency(totals.subtotal || totals.total)}</dd></div><div><dt>Taxable value</dt><dd>{formatCurrency(totals.taxableValue || totals.total)}</dd></div><div><dt>GST</dt><dd>{formatCurrency(totals.tax)}</dd></div><div className="sales-doc-total"><dt>Grand total</dt><dd>{formatCurrency(totals.total)}</dd></div></dl></div>
      </section>
      <section className="sales-module-section"><h2>5. Terms and conditions</h2><label className="form-field"><span>Terms</span><textarea rows="3" value={form.terms} onChange={(event) => setForm({ ...form, terms: event.target.value })} placeholder="Add validity period, payment terms, and any additional conditions." /></label></section>
      <section className="sales-module-section"><h2>6. Company and bank details</h2><div className="sales-module-fields">
        <label className="form-field"><span>Company name</span><input value={preferences.companyName || 'Design Blocks'} readOnly /></label>
        <label className="form-field"><span>Company logo</span><div className="sales-module-logo"><span className="sales-doc-brand">D</span><span>Existing Design Blocks brand mark</span></div></label>
        <label className="form-field"><span>Company GSTIN</span><input value={form.companyGstin} onChange={(event) => setForm({ ...form, companyGstin: event.target.value })} /></label>
        <label className="form-field field-wide"><span>Company address</span><textarea rows="2" value={form.companyAddress} onChange={(event) => setForm({ ...form, companyAddress: event.target.value })} /></label>
        <label className="form-field field-wide"><span>Bank details (optional)</span><textarea rows="3" value={form.bankDetails} onChange={(event) => setForm({ ...form, bankDetails: event.target.value })} placeholder="Enter only verified business bank details." /></label>
      </div></section>
      {error && <p className="sales-module-error" role="alert">{error}</p>}
      <div className="sales-module-actions"><Button type="button" variant="secondary" onClick={openPreview}>Preview</Button><Button type="button" variant="secondary" onClick={() => { setForm(blankForm()); setEditing(null) }}>Back to quotations</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</Button></div>
    </form>
  </div>

  return <div className="page">
    <PageHeader title="Quotations" description="Create, review, and print client quotations."
      actions={<>
        <Button variant="secondary" disabled={loading || visibleRecords.length === 0} onClick={exportCsv}><Download size={16} /> Export</Button>
        {can('quotations.create') && <Button onClick={startCreate}>Create quotation</Button>}
      </>} />
    <section className="panel records-panel">
      <div className="table-toolbar"><input className="sales-module-search" aria-label="Search quotations" placeholder="Search quotation or client…" value={search} onChange={(event) => setSearch(event.target.value)} /><select aria-label="Filter quotations by status" value={status} onChange={(event) => setStatus(event.target.value)}>{['All statuses', 'Draft', 'Sent', 'Viewed', 'Accepted', 'Rejected', 'Expired', 'Revised'].map((value) => <option key={value}>{value}</option>)}</select></div>
      {loading ? <div className="loading-inline">Loading quotations…</div> : visibleRecords.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Quotation no.</th><th>Client</th><th>Date</th><th>Valid until</th><th>Total amount</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{visibleRecords.map((record) => <tr key={record.id}><td>{record.id}</td><td>{record.client}</td><td>{formatDate(record.issueDate)}</td><td>{formatDate(record.validUntil)}</td><td>{formatCurrency(record.amount ?? record.total)}</td><td>{record.status}</td><td><div className="sales-module-row-actions"><button onClick={() => setPreview(record)}>View</button><button onClick={() => printRecord(record)}>Print</button>
          {can('quotations.create') && record.status === 'Draft' && <button disabled={Boolean(transitioning)} onClick={() => changeStatus(record, 'send')}>Send</button>}
          {(user?.role === 'client' || can('quotations.approve')) && ['Sent', 'Viewed'].includes(record.status) && <>
            <button disabled={Boolean(transitioning)} onClick={() => changeStatus(record, 'approve')}>Accept</button>
            <button disabled={Boolean(transitioning)} onClick={() => changeStatus(record, 'reject')}>Reject</button>
          </>}
          {can('quotations.create') && record.status === 'Draft' && <button onClick={() => startEdit(record)}>Edit</button>}
        </div></td></tr>)}</tbody></table></div> : <div className="sales-module-empty">No quotations found.</div>}
    </section>
  </div>
}
