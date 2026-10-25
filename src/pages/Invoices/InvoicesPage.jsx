import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Download, FileDown, Search, X } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { usePermissions } from '../../auth/usePermissions'
import { apiFor, scopeResourceRecords } from '../../api/resourcesApi'
import { useApp } from '../../context/useApp'
import { Badge, Button, PageHeader } from '../../components/common/UI'
import ClientSearchSelect from '../../components/common/ClientSearchSelect'
import SalesDocument from '../SalesFinance/SalesDocument'
import { canAccessRecord } from '../../services/permissionsService'
import { readPreferences } from '../../services/storageService'
import { loadCompanySettings } from '../../api/companySettingsApi'
import { formatCurrency, formatDate, getInvoicePaid } from '../../utils/formatters'
import { amountInWords } from '../../utils/amountInWords'
import { apiClient, isBackendMode } from '../../api/apiClient'

const today = () => new Date().toISOString().slice(0, 10)
const blankItem = () => ({ description: '', quantity: '1', rate: '' })
const blankForm = (preferences = {}) => ({
  id: `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
  clientId: '', client: '', billingName: '', billingAddress: '', customerGstin: '',
  contactEmail: '', contactPhone: '', project: '', issueDate: today(), dueDate: '',
  items: [blankItem()], discount: '0', gstEnabled: false, sgstEnabled: true, cgstEnabled: true,
  sgstRate: '', cgstRate: '', terms: '',
  preserveLegacyTotal: false,
  companyGstin: preferences.companyGstin || preferences.gstin || '',
  companyAddress: preferences.companyAddress || '',
  bankDetails: preferences.bankDetails || '',
})

function formFromSource(source, preferences, clients) {
  const next = blankForm(preferences)
  if (!source?.record) return next
  const sourceRecord = source.record
  const quotation = source.kind === 'agreement'
    ? sourceRecord.quotationSnapshot || sourceRecord.acceptedSnapshot?.quotationSnapshot || {}
    : sourceRecord.acceptedSnapshot || sourceRecord
  const sourceItems = quotation.items?.length ? quotation.items : quotation.lineItems || []
  const clientId = sourceRecord.clientId || quotation.clientId || ''
  const client = clients.find((item) => item.id === clientId)
  return {
    ...next,
    sourceContractTotal: Number(quotation.total ?? quotation.amount) || 0,
    clientId,
    client: client?.company || client?.name || sourceRecord.client || quotation.client || '',
    billingName: quotation.billingName || client?.name || '',
    billingAddress: quotation.billingAddress || client?.address || '',
    customerGstin: quotation.customerGstin || client?.gstin || '',
    contactEmail: quotation.contactEmail || client?.email || '',
    contactPhone: quotation.contactPhone || client?.phone || '',
    project: source.kind === 'agreement' ? sourceRecord.project : quotation.title || '',
    agreementId: source.kind === 'agreement' ? sourceRecord.id : '',
    quotationId: source.kind === 'quotation' ? sourceRecord.id : sourceRecord.quotationId || '',
    items: sourceItems.map((item) => ({
      description: item.description || '',
      quantity: String(item.quantity ?? 1),
      rate: String(item.rate ?? ''),
    })),
    discount: String(quotation.discount ?? 0),
    gstEnabled: Boolean(quotation.gstEnabled),
    sgstEnabled: quotation.sgstEnabled ?? true,
    cgstEnabled: quotation.cgstEnabled ?? true,
    sgstRate: String(quotation.sgstRate ?? ''),
    cgstRate: String(quotation.cgstRate ?? ''),
    terms: quotation.terms || '',
    status: 'Draft',
  }
}

function sourceClientName(source, clients) {
  if (!source?.record) return ''
  const sourceRecord = source.record
  const quotation = source.kind === 'agreement'
    ? sourceRecord.quotationSnapshot || sourceRecord.acceptedSnapshot?.quotationSnapshot || {}
    : sourceRecord.acceptedSnapshot || sourceRecord
  const client = clients.find((item) => item.id === sourceRecord.clientId)
  return client?.company || client?.name || sourceRecord.client || quotation.client || ''
}

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
  const lineItems = record.items || record.lineItems || []
  const legacy = lineItems.length === 0 && !(record.description && record.quantity !== undefined && record.rate !== undefined)
  return {
    ...blankForm(preferences), ...record, id: record.id,
    sourceContractTotal: Number(record.sourceSnapshot?.quotation?.total ?? record.sourceSnapshot?.agreement?.total) || 0,
    items: lineItems.length ? lineItems.map((item) => ({
      description: item.description || '', quantity: String(item.quantity ?? 1), rate: String(item.rate ?? ''),
    })) : legacy ? [blankItem()] : [{ description: record.description, quantity: String(record.quantity), rate: String(record.rate) }],
    discount: String(record.discount ?? 0),
    sgstRate: String(record.sgstRate ?? (record.taxRate ? Number(record.taxRate) / 2 : '')),
    cgstRate: String(record.cgstRate ?? (record.taxRate ? Number(record.taxRate) / 2 : '')),
    preserveLegacyTotal: legacy,
  }
}

function isUntouchedLegacy(form) {
  return form.preserveLegacyTotal && form.items.every((item) => !item.description.trim() && item.rate === '')
}

export default function InvoicesPage() {
  const { user } = useAuth()
  const { hasPermission: can } = usePermissions()
  const { notify } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const [preferences, setPreferences] = useState(() => isBackendMode ? {} : readPreferences())
  const [records, setRecords] = useState([])
  const [clients, setClients] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All statuses')
  const [form, setForm] = useState(() => location.state?.invoiceSource
    ? formFromSource(location.state.invoiceSource, preferences, [])
    : null)
  const [clientQuery, setClientQuery] = useState(() => sourceClientName(location.state?.invoiceSource, []))
  const [editing, setEditing] = useState(null)
  const [preview, setPreview] = useState(null)
  const [previewSaved, setPreviewSaved] = useState(false)
  const [previewPayments, setPreviewPayments] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [issuing, setIssuing] = useState('')
  const [printing, setPrinting] = useState(false)
  const [pdfLoading, setPdfLoading] = useState('')
  const totals = useMemo(() => isUntouchedLegacy(form || {})
    ? { subtotal: 0, discount: 0, taxableValue: 0, tax: Number(editing?.tax) || 0, total: Number(editing?.total ?? editing?.amount) || 0 }
    : calculate(form || blankForm()), [form, editing])

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      if (isBackendMode && user?.role === 'client') {
        const [{ data: portal }, companySettings] = await Promise.all([
          apiClient.get('portal'), loadCompanySettings(),
        ])
        setPreferences(companySettings)
        setRecords(portal.invoices)
        setClients([portal.client])
        setPayments(portal.payments)
        setLoadError('')
        return
      }
      const [invoiceRecords, clientRecords, paymentRecords, companySettings] = await Promise.all([
        apiFor.invoices.list(), apiFor.clients.list(), apiFor.payments.list(), loadCompanySettings(),
      ])
      setPreferences(companySettings)
      setRecords(scopeResourceRecords('invoices', invoiceRecords, user))
      setClients(scopeResourceRecords('clients', clientRecords, user))
      setPayments(paymentRecords)
      setLoadError('')
    } catch (cause) {
      const message = cause.message || 'Could not load invoices.'
      setLoadError(message)
      if (!silent) notify(message, 'error')
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
    const interval = window.setInterval(refreshWhenVisible, 30_000)
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
  useEffect(() => {
    if (!printing) return undefined
    const finish = () => setPrinting(false)
    const previousTitle = document.title
    document.title = `${preview?.number || preview?.id || 'Invoice'}`
    window.addEventListener('afterprint', finish)
    const timer = window.setTimeout(() => window.print(), 80)
    return () => {
      window.removeEventListener('afterprint', finish)
      window.clearTimeout(timer)
      document.title = previousTitle
    }
  }, [printing, preview])

  const visibleRecords = records.filter((record) =>
    (status === 'All statuses' || record.status === status)
    && `${record.id} ${record.client} ${record.project}`.toLowerCase().includes(search.toLowerCase()))

  function startCreate(source = null) {
    setEditing(null)
    setForm(formFromSource(source, preferences, clients))
    setClientQuery(sourceClientName(source, clients))
    setError('')
  }
  useEffect(() => {
    if (location.state?.invoiceSource) navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])
  function startEdit(record) {
    if (!can('invoices.manage') || !canAccessRecord('invoices', record, user)) {
      notify('Your role cannot edit this invoice.', 'error')
      return
    }
    setEditing(record)
    setForm(toForm(record, preferences))
    const client = clients.find((item) => item.id === record.clientId)
    setClientQuery(client?.company || client?.name || record.client || '')
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
  function handleClientSearch(query) {
    setClientQuery(query)
    if (form.clientId) selectClient('')
  }
  function chooseClient(client) {
    selectClient(client.id)
    setClientQuery(client.company || client.name || '')
  }
  function makeDocument() {
    const legacy = isUntouchedLegacy(form)
    const documentForm = { ...form }
    delete documentForm.sourceContractTotal
    if (legacy) return { ...editing, ...documentForm, status: editing?.status || form.status || 'Draft', items: undefined, lineItems: undefined, preserveLegacyTotal: undefined }
    const calculated = calculate(form)
    return {
      ...documentForm, status: editing?.status || form.status || 'Draft', preserveLegacyTotal: undefined,
      items: form.items.map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity),
        rate: Number(item.rate),
        amount: Number(item.quantity) * Number(item.rate),
      })),
      subtotal: calculated.subtotal,
      discount: calculated.discount,
      taxableValue: calculated.taxableValue,
      tax: calculated.tax,
      sgstRate: Number(form.sgstRate) || 0,
      cgstRate: Number(form.cgstRate) || 0,
      sgstAmount: calculated.sgstAmount,
      cgstAmount: calculated.cgstAmount,
      total: calculated.total,
      amount: calculated.total,
    }
  }
  function openPreview() {
    if (!form.clientId || !form.project.trim() || !form.issueDate || !form.dueDate) {
      setError('Select a client, add a project description, and complete the issue and due dates.')
      return
    }
    if (!isUntouchedLegacy(form) && (!form.items.length || form.items.some((item) =>
      !item.description.trim() || Number(item.quantity) <= 0 || item.rate === ''
      || !Number.isFinite(Number(item.rate)) || Number(item.rate) < 0))) {
      setError('Enter a description, positive quantity, and valid unit price for each invoice item.')
      return
    }
    setError('')
    setPreview(makeDocument())
    setPreviewSaved(false)
    setPreviewPayments(editing ? payments.filter((payment) => payment.invoiceId === editing.id) : [])
  }
  async function saveInvoice(event) {
    event.preventDefault()
    if (!can('invoices.manage')) { notify('Your role cannot save invoices.', 'error'); return }
    if (!form.clientId || !form.project.trim() || !form.issueDate || !form.dueDate) {
      setError('Select a client, add a project description, and complete the issue and due dates.')
      return
    }
    if (!isUntouchedLegacy(form) && (!form.items.length || form.items.some((item) =>
      !item.description.trim() || Number(item.quantity) <= 0 || item.rate === ''
      || !Number.isFinite(Number(item.rate)) || Number(item.rate) < 0))) {
      setError('Enter a description, positive quantity, and valid unit price for each invoice item.')
      return
    }
    if (sourceLocked && form.sourceContractTotal > 0) {
      const allocated = records
        .filter((record) => record.id !== editing?.id
          && record.status !== 'Cancelled'
          && (form.quotationId ? record.quotationId === form.quotationId : record.agreementId === form.agreementId))
        .reduce((sum, record) => sum + Number(record.total ?? record.amount ?? 0), 0)
      const remaining = Math.max(0, form.sourceContractTotal - allocated)
      if (calculate(form).total > remaining + 0.005) {
        setError(`This invoice exceeds the remaining accepted contract amount of ${formatCurrency(remaining)}.`)
        return
      }
    }
    setSaving(true)
    try {
      const document = makeDocument()
      const saved = editing
        ? await apiFor.invoices.update(editing.id, document)
        : await apiFor.invoices.create(document)
      await load()
      setForm(null)
      setEditing(null)
      setPreview(saved)
      setPreviewSaved(true)
      setPreviewPayments(payments.filter((payment) => payment.invoiceId === saved.id))
      notify(editing ? 'Invoice draft updated.' : 'Draft invoice saved. Issue it when ready.')
    } catch (cause) {
      notify(cause.message || 'Could not save this invoice.', 'error')
    } finally {
      setSaving(false)
    }
  }
  async function issueDraft(record) {
    setIssuing(record.id)
    try {
      const saved = await apiFor.invoices.issue(record.id)
      await load()
      setPreview(saved)
      setPreviewSaved(true)
      setPreviewPayments(payments.filter((payment) => payment.invoiceId === saved.id))
      notify('Invoice issued.')
    } catch (cause) {
      notify(cause.message || 'Could not issue this invoice.', 'error')
    } finally {
      setIssuing('')
    }
  }
  function printRecord(record) {
    setPreview(record)
    setPreviewSaved(true)
    setPreviewPayments(payments.filter((payment) => payment.invoiceId === record.id))
    setPrinting(true)
  }
  async function downloadPdfRecord(record) {
    setPdfLoading(record.id)
    notify('In the print dialog, select Save as PDF to download this invoice.')
    try {
      const savedRecord = await apiFor.invoices.get(record.id)
      setPreview(savedRecord)
      setPreviewSaved(true)
      setPreviewPayments(payments.filter((payment) => payment.invoiceId === savedRecord.id))
      setPrinting(true)
    } catch (cause) {
      notify(cause.message || 'Could not load the saved invoice for PDF.', 'error')
    } finally {
      setPdfLoading('')
    }
  }
  function exportCsv() {
    const rows = [
      ['Invoice no.', 'Client', 'Project / service', 'Issue date', 'Due date', 'Total', 'Amount paid', 'Balance due', 'Status'],
      ...visibleRecords.map((record) => {
        const total = Number(record.total ?? record.amount) || 0
        const paid = getInvoicePaid(record.id, payments)
        return [
          record.id, record.client, record.project, formatDate(record.issueDate), formatDate(record.dueDate),
          formatCurrency(total), formatCurrency(paid), formatCurrency(Math.max(0, total - paid)), record.status,
        ]
      }),
    ]
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'invoices-demo-export.csv'
    link.click()
    URL.revokeObjectURL(url)
    notify('CSV export downloaded.')
  }

  const sourceLocked = Boolean(form?.quotationId || form?.agreementId)
  const sourceInvoices = sourceLocked
    ? records.filter((record) => record.id !== editing?.id
      && record.status !== 'Cancelled'
      && (form.quotationId ? record.quotationId === form.quotationId : record.agreementId === form.agreementId))
    : []
  const sourceAllocated = sourceInvoices.reduce((sum, record) => sum + Number(record.total ?? record.amount ?? 0), 0)
  const sourceRemaining = Math.max(0, (Number(form?.sourceContractTotal) || 0) - sourceAllocated)
  if (preview) {
    const paid = getInvoicePaid(preview.id, previewPayments)
    const total = Number(preview.total ?? preview.amount) || 0
    return <div className={`page sales-document-page invoice-document-page${printing ? ' is-printing' : ''}`}>
      <PageHeader title="Invoice preview" description="Review the selected invoice and its recorded payments before printing." />
      <SalesDocument kind="Invoice" record={preview}
        client={clients.find((item) => item.id === preview.clientId)} preferences={preferences}
        paid={paid} balance={Math.max(0, total - paid)} payments={previewPayments}
        onBack={() => { setPreview(null); setPreviewSaved(false) }} onPrint={() => setPrinting(true)}
        onDownloadPdf={previewSaved ? async () => {
          notify('In the print dialog, select Save as PDF to download this invoice.')
          setPdfLoading(preview.id)
          try {
            setPreview(await apiFor.invoices.get(preview.id))
            setPrinting(true)
          } catch (cause) {
            notify(cause.message || 'Could not load the saved invoice for PDF.', 'error')
          } finally {
            setPdfLoading('')
          }
        } : undefined}
        onEdit={can('invoices.manage') ? () => { startEdit(preview); setPreview(null); setPreviewSaved(false) } : undefined}
        canEdit={can('invoices.manage')} />
    </div>
  }

  if (!can('invoices.view') && !can('invoices.view.own') && !can('invoices.manage')) return <div className="page"><div className="sales-module-empty">You do not have access to invoices.</div></div>
  if (form) return <div className="page sales-document-page">
    <PageHeader title={editing ? `Edit invoice ${editing.id}` : 'Create invoice'} description="Create an invoice document. Payments remain recorded in the Payments module." />
    <div className="sales-builder-brand" aria-label="Design Blocks">
      <span>Design</span> <strong>Blocks</strong>
    </div>
    <form className="sales-module-form sales-builder-form" onSubmit={saveInvoice}>
      <section className="sales-module-section"><h2>1. Invoice details</h2><div className="sales-module-fields">
        <label className="form-field"><span>Invoice number</span><input value={form.id} onChange={(event) => setForm({ ...form, id: event.target.value })} placeholder="Enter invoice number" /></label>
        <label className="form-field"><span>Invoice date</span><input type="date" value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })} /></label>
        <label className="form-field"><span>Due date</span><input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label>
      </div></section>
      {sourceLocked && <p className="form-note">
        This is a separate invoice linked to accepted {form.quotationId ? `quotation ${form.quotationId}` : `work order ${form.agreementId}`}.
        Adjust the service lines, quantities, prices, discount, tax, and terms for this billing (for example, an advance invoice of ₹20,000).
        {form.sourceContractTotal > 0 && <> Accepted contract: {formatCurrency(form.sourceContractTotal)}; previously invoiced: {formatCurrency(sourceAllocated)}; remaining: {formatCurrency(sourceRemaining)}.</>}
        {' '}The client and project stay linked to the accepted source; the API checks the contract limit when saving.
      </p>}
      <fieldset className="sales-source-locked" disabled={sourceLocked}>
      <section className="sales-module-section"><h2>2. Recipient details</h2><div className="sales-module-fields">
        <ClientSearchSelect clients={clients} selectedId={form.clientId} query={clientQuery}
          onQueryChange={handleClientSearch} onSelect={chooseClient} />
        <label className="form-field"><span>Bill to</span><input value={form.billingName} onChange={(event) => setForm({ ...form, billingName: event.target.value })} placeholder="Enter name" /></label>
        <label className="form-field"><span>Address</span><input value={form.billingAddress} onChange={(event) => setForm({ ...form, billingAddress: event.target.value })} placeholder="Enter address" /></label>
        <label className="form-field"><span>Customer GSTIN</span><input value={form.customerGstin} onChange={(event) => setForm({ ...form, customerGstin: event.target.value })} placeholder="Enter customer GSTIN" /></label>
        <label className="form-field"><span>Contact email</span><input type="email" value={form.contactEmail} onChange={(event) => setForm({ ...form, contactEmail: event.target.value })} placeholder="Enter email address" /></label>
        <label className="form-field"><span>Contact phone</span><input value={form.contactPhone} onChange={(event) => setForm({ ...form, contactPhone: event.target.value })} placeholder="Enter phone number" /></label>
        <label className="form-field"><span>Project / service</span><input value={form.project} onChange={(event) => setForm({ ...form, project: event.target.value })} placeholder="Enter project or service" /></label>
      </div></section>
      </fieldset>
      <section className="sales-module-section"><div className="sales-module-toolbar"><h2>3. Items</h2><Button className="sales-builder-add" type="button" onClick={() => setForm({ ...form, preserveLegacyTotal: false, items: [...form.items, blankItem()] })}>Add item</Button></div>
        {isUntouchedLegacy(form) && <p className="form-note">This existing invoice has a recorded total but no item breakdown. It will be preserved unless you add itemized details.</p>}
        <div className="sales-module-items">{form.items.map((item, index) => <div className="sales-module-item" key={index}>
          <label className="form-field"><span>Description</span><input placeholder="Enter item description" value={item.description} onChange={(event) => setForm({ ...form, preserveLegacyTotal: false, items: form.items.map((row, i) => i === index ? { ...row, description: event.target.value } : row) })} /></label>
          <label className="form-field"><span>Quantity</span><input type="number" min="0.01" step="any" value={item.quantity} onChange={(event) => setForm({ ...form, preserveLegacyTotal: false, items: form.items.map((row, i) => i === index ? { ...row, quantity: event.target.value } : row) })} placeholder="Enter quantity" /></label>
          <label className="form-field"><span>Unit price</span><input type="number" min="0" step="0.01" value={item.rate} onChange={(event) => setForm({ ...form, preserveLegacyTotal: false, items: form.items.map((row, i) => i === index ? { ...row, rate: event.target.value } : row) })} placeholder="Enter unit price" /></label>
          <Button type="button" variant="secondary" disabled={form.items.length === 1} onClick={() => setForm({ ...form, preserveLegacyTotal: false, items: form.items.filter((_, i) => i !== index) })}>Remove</Button>
        </div>)}</div>
      </section>
      <section className="sales-module-section"><h2>4. GST info and totals</h2><div className="sales-module-gst">
        <label><input type="checkbox" checked={form.gstEnabled} onChange={(event) => setForm({ ...form, gstEnabled: event.target.checked })} /> Apply GST</label>
        {form.gstEnabled && <>
          <label><input type="checkbox" checked={form.sgstEnabled} onChange={(event) => setForm({ ...form, sgstEnabled: event.target.checked })} /> SGST</label>
          <label><input type="checkbox" checked={form.cgstEnabled} onChange={(event) => setForm({ ...form, cgstEnabled: event.target.checked })} /> CGST</label>
          <label className="form-field"><span>SGST rate (%)</span><input type="number" min="0" max="100" step="0.01" value={form.sgstRate} disabled={!form.sgstEnabled} onChange={(event) => setForm({ ...form, sgstRate: event.target.value })} placeholder="Enter SGST rate" /></label>
          <label className="form-field"><span>CGST rate (%)</span><input type="number" min="0" max="100" step="0.01" value={form.cgstRate} disabled={!form.cgstEnabled} onChange={(event) => setForm({ ...form, cgstRate: event.target.value })} placeholder="Enter CGST rate" /></label>
        </>}
        <label className="form-field"><span>Discount (₹)</span><input type="number" min="0" step="0.01" value={form.discount} onChange={(event) => setForm({ ...form, discount: event.target.value })} placeholder="Enter discount amount" /></label>
      </div><div className="sales-doc-summary"><div className="sales-doc-words"><strong>Amount in words</strong><span>{amountInWords(totals.total)}</span></div><dl>
        <div><dt>Subtotal</dt><dd>{formatCurrency(totals.subtotal || totals.total)}</dd></div>{totals.discount > 0 && <div><dt>Discount</dt><dd>− {formatCurrency(totals.discount)}</dd></div>}
        <div><dt>Taxable Value</dt><dd>{formatCurrency(totals.taxableValue || totals.total)}</dd></div>
        {form.gstEnabled && form.sgstEnabled && <div><dt>SGST ({Number(form.sgstRate) || 0}%)</dt><dd>{formatCurrency(totals.sgstAmount)}</dd></div>}
        {form.gstEnabled && form.cgstEnabled && <div><dt>CGST ({Number(form.cgstRate) || 0}%)</dt><dd>{formatCurrency(totals.cgstAmount)}</dd></div>}
        <div className="sales-doc-total"><dt>Total Price</dt><dd>{formatCurrency(totals.total)}</dd></div>
      </dl>      </div></section>
      <section className="sales-module-section"><h2>5. Terms and conditions</h2><label className="form-field"><span>Terms</span><textarea rows="3" value={form.terms} onChange={(event) => setForm({ ...form, terms: event.target.value })} placeholder="Enter payment terms and additional conditions" /></label></section>
      <section className="sales-module-section"><h2>6. Company and bank details</h2><div className="sales-module-fields">
        <label className="form-field"><span>Company name</span><input value={preferences.companyName || 'Design Blocks'} readOnly /></label>
        <label className="form-field"><span>Company logo</span><div className="sales-module-logo"><img src="/design-blocks-logo.png" alt="Design Blocks logo" /></div></label>
        <label className="form-field"><span>Company GSTIN</span><input value={form.companyGstin} onChange={(event) => setForm({ ...form, companyGstin: event.target.value })} placeholder="Enter company GSTIN" /></label>
        <label className="form-field field-wide"><span>Company address</span><textarea rows="2" value={form.companyAddress} onChange={(event) => setForm({ ...form, companyAddress: event.target.value })} placeholder="Enter company address" /></label>
        <label className="form-field field-wide"><span>Bank details (optional)</span><textarea rows="3" value={form.bankDetails} onChange={(event) => setForm({ ...form, bankDetails: event.target.value })} placeholder="Enter only verified business bank details." /></label>
      </div></section>
      {error && <p className="sales-module-error" role="alert">{error}</p>}
      <div className="sales-module-actions"><Button type="button" variant="secondary" onClick={() => { void openPreview() }}>Preview</Button><Button type="button" variant="secondary" onClick={() => { setForm(null); setEditing(null) }}>Back to invoices</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save invoice'}</Button></div>
    </form>
  </div>

  return <div className="page invoices-page">
    <PageHeader title="Invoices" description="Create, review, and print client invoices."
      actions={<>
        <Button variant="secondary" disabled={loading || visibleRecords.length === 0} onClick={exportCsv}><Download size={16} /> Export</Button>
        {can('invoices.manage') && <Button onClick={startCreate}>Create invoice</Button>}
      </>} />
    <section className="panel records-panel">
      <div className="table-toolbar quotation-toolbar">
        <label className="list-search"><Search size={18} aria-hidden="true" /><input aria-label="Search invoices" placeholder="Search invoice or client…" value={search} onChange={(event) => setSearch(event.target.value)} />
          {search && <button className="list-search-clear" type="button" aria-label="Clear invoice search" onClick={() => setSearch('')}><X size={17} /></button>}
        </label>
        <select aria-label="Filter invoices by status" value={status} onChange={(event) => setStatus(event.target.value)}>{['All statuses', 'Draft', 'Issued', 'Overdue', 'Partially Paid', 'Paid', 'Cancelled'].map((value) => <option key={value}>{value}</option>)}</select>
      </div>
      {loadError && <div className="resource-load-error" role="alert"><span>{loadError}</span><Button type="button" variant="secondary" onClick={() => load()}>Retry</Button></div>}
      {loading ? <div className="loading-inline" role="status"><span className="spinner" aria-hidden="true" />Loading invoices…</div> : visibleRecords.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Invoice no.</th><th>Client</th><th>Project / service</th><th>Issue date</th><th>Due date</th><th>Total</th><th>Amount paid</th><th>Balance due</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{visibleRecords.map((record) => {
          const paid = getInvoicePaid(record.id, payments)
          const total = Number(record.total ?? record.amount) || 0
          return <tr key={record.id}><td>{record.id}</td><td>{record.client}</td><td>{record.project}</td><td>{formatDate(record.issueDate)}</td><td>{formatDate(record.dueDate)}</td><td>{formatCurrency(total)}</td><td>{formatCurrency(paid)}</td><td>{formatCurrency(Math.max(0, total - paid))}</td><td><Badge>{record.status}</Badge>{record.clientDecision?.status && <small className="invoice-client-decision">Client: {record.clientDecision.status}</small>}</td><td><div className="sales-module-row-actions quotation-row-actions invoice-row-actions"><button onClick={() => { setPreview(record); setPreviewSaved(true); setPreviewPayments(payments.filter((payment) => payment.invoiceId === record.id)) }}>View</button><button onClick={() => printRecord(record)}>Print</button><button aria-label={`Download PDF for invoice ${record.id}`} disabled={Boolean(pdfLoading)} onClick={() => downloadPdfRecord(record)}><FileDown size={16} />{pdfLoading === record.id ? 'Preparing…' : 'PDF'}</button>{can('invoices.manage') && record.status === 'Draft' && <button disabled={Boolean(issuing)} onClick={() => issueDraft(record)}>{issuing === record.id ? 'Issuing…' : 'Issue'}</button>}{can('invoices.manage') && <button onClick={() => startEdit(record)}>Edit</button>}</div></td></tr>
        })}</tbody></table></div> : <div className="sales-module-empty">No invoices found.</div>}
    </section>
  </div>
}
