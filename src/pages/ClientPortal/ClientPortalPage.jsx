import { useCallback, useEffect, useState } from 'react'
import { Check, ShieldCheck, X } from 'lucide-react'
import { apiFor } from '../../api/resourcesApi'
import { useApp } from '../../context/useApp'
import { Badge, Button, Modal, PageHeader } from '../../components/common/UI'
import { formatCurrency, formatDate, getInvoicePaid } from '../../utils/formatters'
import { useAuth } from '../../auth/useAuth'
import { ROLES } from '../../config/roles'
import { apiClient, isBackendMode } from '../../api/apiClient'
import SalesDocument from '../SalesFinance/SalesDocument'

function formatDecisionTimestamp(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? formatDate(value) : date.toLocaleString()
}

export default function ClientPortalPage() {
  const { notify } = useApp()
  const { user } = useAuth()
  const isClient = user?.role === ROLES.CLIENT
  const [clients, setClients] = useState([])
  const [selected, setSelected] = useState('')
  const [data, setData] = useState({ quotations: [], invoices: [], projects: [], agreements: [], payments: [] })
  const [portalLoading, setPortalLoading] = useState(true)
  const [portalError, setPortalError] = useState('')
  const [quotationPreview, setQuotationPreview] = useState(null)
  const [pendingDecision, setPendingDecision] = useState(null)
  const [workingDecision, setWorkingDecision] = useState(false)
  const [pendingAgreementDecision, setPendingAgreementDecision] = useState(null)
  const [agreementRejectionReason, setAgreementRejectionReason] = useState('')
  const [workingAgreementDecision, setWorkingAgreementDecision] = useState(false)
  const [pendingInvoiceDecision, setPendingInvoiceDecision] = useState(null)
  const [invoiceRejectionReason, setInvoiceRejectionReason] = useState('')
  const [workingInvoiceDecision, setWorkingInvoiceDecision] = useState(false)
  const [printing, setPrinting] = useState(false)

  const refreshClientPortal = useCallback(async () => {
    const { data: portal } = await apiClient.get('portal')
    setClients([portal.client])
    setSelected(portal.client.id)
    setData({
      quotations: portal.quotations,
      invoices: portal.invoices,
      projects: portal.projects,
      agreements: portal.agreements,
      payments: portal.payments,
    })
  }, [])

  const loadClientPortal = useCallback(async () => {
    setPortalLoading(true)
    setPortalError('')
    try {
      await refreshClientPortal()
    } catch (error) {
      setPortalError(error.message || 'Could not load your client portal.')
      notify(error.message || 'Could not load your client portal.', 'error')
    } finally {
      setPortalLoading(false)
    }
  }, [notify, refreshClientPortal])

  async function decideQuotation() {
    if (!pendingDecision || !isClient || workingDecision) return
    setWorkingDecision(true)
    try {
      const { quotation, action } = pendingDecision
      const updated = action === 'approve'
        ? await apiFor.quotations.approve(quotation.id)
        : await apiFor.quotations.reject(quotation.id)
      if (isBackendMode) {
        setData((current) => ({
          ...current,
          quotations: current.quotations.map((record) => record.id === updated.id ? updated : record),
        }))
        try {
          await refreshClientPortal()
        } catch {
          setPendingDecision(null)
          notify('Your decision was saved, but the portal could not refresh. Reload the page to verify the latest status.', 'error')
          return
        }
      } else {
        setData((current) => ({
          ...current,
          quotations: current.quotations.map((record) => record.id === updated.id ? updated : record),
        }))
      }
      setPendingDecision(null)
      notify(`Quotation ${action === 'approve' ? 'accepted' : 'rejected'}.`)
    } catch (error) {
      notify(error.message || 'Could not record your quotation decision.', 'error')
    } finally {
      setWorkingDecision(false)
    }
  }

  async function decideAgreement() {
    if (!pendingAgreementDecision || !isClient || workingAgreementDecision) return
    if (pendingAgreementDecision.action === 'reject' && !agreementRejectionReason.trim()) {
      notify('Enter a reason for rejecting this work order.', 'error')
      return
    }
    setWorkingAgreementDecision(true)
    try {
      const { agreement, action } = pendingAgreementDecision
      const updated = action === 'accept'
        ? await apiFor.agreements.accept(agreement.id)
        : await apiFor.agreements.reject(agreement.id, agreementRejectionReason.trim())
      setData((current) => ({
        ...current,
        agreements: current.agreements.map((record) => record.id === updated.id ? updated : record),
      }))
      setPendingAgreementDecision(null)
      setAgreementRejectionReason('')
      notify(`Work order ${action === 'accept' ? 'acceptance' : 'rejection'} recorded.`)
    } catch (error) {
      notify(error.message || 'Could not record your work order decision.', 'error')
    } finally {
      setWorkingAgreementDecision(false)
    }
  }

  async function decideInvoice() {
    if (!pendingInvoiceDecision || !isClient || workingInvoiceDecision) return
    if (pendingInvoiceDecision.decision === 'Rejected' && !invoiceRejectionReason.trim()) {
      notify('Enter a reason for rejecting this invoice.', 'error')
      return
    }
    setWorkingInvoiceDecision(true)
    try {
      const updated = await apiFor.invoices.decide(
        pendingInvoiceDecision.invoice.id,
        pendingInvoiceDecision.decision,
        invoiceRejectionReason.trim(),
      )
      setData((current) => ({
        ...current,
        invoices: current.invoices.map((invoice) => invoice.id === updated.id ? updated : invoice),
      }))
      if (isBackendMode) {
        try {
          await refreshClientPortal()
        } catch {
          setPendingInvoiceDecision(null)
          notify('Your decision was saved, but the portal could not refresh. Reload the page to verify the latest status.', 'error')
          return
        }
      }
      setPendingInvoiceDecision(null)
      setInvoiceRejectionReason('')
      notify(`Invoice ${pendingInvoiceDecision.decision.toLowerCase()}.`)
    } catch (error) {
      notify(error.message || 'Could not record your invoice decision.', 'error')
    } finally {
      setWorkingInvoiceDecision(false)
    }
  }

  async function viewQuotation(record) {
    try {
      const savedQuotation = await apiFor.quotations.get(record.id)
      setQuotationPreview(savedQuotation)
    } catch (error) {
      notify(error.message || 'Could not load the saved quotation.', 'error')
    }
  }

  async function retryPortalLoad() {
    if (isBackendMode && isClient) {
      await loadClientPortal()
      return
    }
    setPortalLoading(true)
    setPortalError('')
    try {
      const list = await apiFor.clients.list()
      const availableClients = isClient ? list.filter((item) => item.id === user.clientId) : list
      setClients(availableClients)
      setSelected(isClient ? user.clientId : availableClients[0]?.id || '')
    } catch (error) {
      setPortalError(error.message || 'Could not load client records.')
      notify(error.message || 'Could not load client records.', 'error')
    } finally {
      setPortalLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (isBackendMode && isClient) {
        void loadClientPortal()
        return
      }
      apiFor.clients.list().then((list) => {
        const availableClients = isClient ? list.filter((client) => client.id === user.clientId) : list
        setClients(availableClients)
        setSelected(isClient ? user.clientId : availableClients[0]?.id || '')
        setPortalError('')
      }).catch((error) => {
        setPortalError(error.message || 'Could not load client records.')
        notify(error.message || 'Could not load client records.', 'error')
      }).finally(() => setPortalLoading(false))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [notify, isClient, user, loadClientPortal])

  useEffect(() => {
    if (!printing) return undefined
    const finish = () => setPrinting(false)
    window.addEventListener('afterprint', finish)
    const timer = window.setTimeout(() => window.print(), 80)
    return () => { window.removeEventListener('afterprint', finish); window.clearTimeout(timer) }
  }, [printing])

  useEffect(() => {
    if (isBackendMode && isClient) return
    if (!selected) return
    Promise.all(['quotations', 'invoices', 'projects', 'agreements', 'payments'].map((resource) => apiFor[resource].list()))
      .then(([quotations, invoices, projects, agreements, payments]) => {
        const client = clients.find((item) => item.id === selected)
        const match = (record) => record.clientId === selected || (!isClient && (record.client === client?.company || record.client === client?.name))
        const selectedInvoices = invoices.filter(match)
        setData({
          quotations: quotations.filter((quotation) => match(quotation) && (!isClient || quotation.status !== 'Draft')),
          invoices: selectedInvoices,
          projects: projects.filter(match),
          agreements: agreements.filter(match),
          payments: payments.filter((payment) => selectedInvoices.some((invoice) => invoice.id === payment.invoiceId)),
        })
      }).catch((error) => notify(error.message, 'error'))
  }, [selected, clients, notify, isClient])

  const client = clients.find((item) => item.id === selected)
  const openInvoices = data.invoices.filter((invoice) => !['Draft', 'Paid', 'Cancelled'].includes(invoice.status))
  const activeProjects = data.projects.filter((project) => !['Completed', 'Closed', 'Cancelled'].includes(project.status))
  const totalDue = openInvoices.reduce((sum, invoice) =>
    sum + Math.max(0, Number(invoice.total || invoice.amount || 0) - getInvoicePaid(invoice.id, data.payments)), 0)
  const pendingQuotations = data.quotations.filter((quotation) => ['Sent', 'Viewed'].includes(quotation.status)).length
  const acceptedQuotations = data.quotations.filter((quotation) => quotation.status === 'Accepted').length
  const paymentsMade = data.payments
    .filter((payment) => payment.status === 'Recorded')
    .reduce((total, payment) => total + Number(payment.amount || 0), 0)

  if (quotationPreview) return <div className={`page sales-document-page quotation-document-page${printing ? ' is-printing' : ''}`}>
    <PageHeader title="Quotation preview" description="Review your saved quotation. Use Download PDF to save or print a client-ready copy." />
    <SalesDocument kind="Quotation" record={quotationPreview} client={client}
      onBack={() => setQuotationPreview(null)}
      onPrint={() => setPrinting(true)}
      onDownloadPdf={() => { notify('In the print dialog, select Save as PDF to download this quotation.'); setPrinting(true) }} />
  </div>

  if (portalLoading) return <div className="page"><PageHeader title="Client portal" description="Loading your client-specific workspace." />
    <section className="panel portal-load-state" role="status"><span className="spinner" />Loading your records…</section>
  </div>
  if (portalError) return <div className="page"><PageHeader title={isClient ? 'Client portal' : 'Client portal preview'} description="Your records could not be loaded." />
    <section className="panel portal-load-state" role="alert"><p>{portalError}</p><Button onClick={retryPortalLoad}>Try again</Button></section>
  </div>

  return <div className="page client-portal-page">
    <PageHeader title={isBackendMode && isClient ? 'Client portal' : 'Client portal preview'} description={isBackendMode && isClient ? 'Review your active work, commercial documents, and invoice balances.' : 'A preview of the future client-facing project space.'}
      actions={!isClient && <label className="client-preview-select"><span>Preview as</span><select value={selected} onChange={(event) => setSelected(event.target.value)}>
        {clients.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.company}</option>)}
      </select></label>} />
    <div className="portal-banner">
      <div className="portal-avatar">{client?.name?.split(' ').map((part) => part[0]).join('')}</div>
      <div><small>CLIENT WORKSPACE</small><h2>{client?.company || 'Select a demo client'}</h2><p>Welcome back, {client?.name || 'client'}. Here’s the latest on your work with Design Blocks.</p>
        {client?.email && <p>{client.email}{client.phone ? ` · ${client.phone}` : ''}</p>}
        {client?.address && <p>{client.address}</p>}
      </div>
      <Badge tone="information">{isBackendMode && isClient ? 'Secure portal' : 'Preview mode'}</Badge>
    </div>
    <div className="portal-summary">
      <div><small>Active projects</small><strong>{activeProjects.length}</strong></div>
      <div><small>Pending quotations</small><strong>{pendingQuotations}</strong></div>
      <div><small>Accepted quotations</small><strong>{acceptedQuotations}</strong></div>
      <div><small>Open invoices</small><strong>{openInvoices.length}</strong></div>
      <div><small>Outstanding balance</small><strong>{formatCurrency(totalDue)}</strong></div>
      <div><small>Payments made</small><strong>{formatCurrency(paymentsMade)}</strong></div>
      <div><small>Agreements</small><strong>{data.agreements.length}</strong></div>
    </div>
    <div className="portal-grid">
      <section className="panel portal-section"><div className="panel-heading"><div><h2>Project progress</h2><p>Your active work with our team</p></div></div>
        {data.projects.map((project) => <div className="portal-project-card" key={project.id}>
          <div><strong>{project.name}</strong><Badge>{project.status}</Badge></div>
          <div className="progress-track"><span style={{ width: `${project.progress}%` }} /></div>
          <small>{project.progress}% complete · Target {formatDate(project.deadline)}</small>
          {project.handover && <p className="muted">
            Handover confirmed {formatDecisionTimestamp(project.handover.confirmedAt)}
            {project.handover.clientReceived ? ' · Client receipt recorded' : ''}
            {project.handover.notes ? ` · ${project.handover.notes}` : ''}
          </p>}
        </div>)}
        {!data.projects.length && <p className="muted">No projects are linked to this demo client.</p>}
      </section>
      <section className="panel portal-section"><div className="panel-heading"><div><h2>Recent documents</h2><p>Quotations and invoices. Invoice payment status is updated from recorded payments.</p></div></div>
        {[...data.quotations.map((item) => ({ ...item, kind: 'Quotation', total: item.total ?? item.amount })), ...data.invoices.map((item) => ({
          ...item,
          kind: 'Invoice',
          total: item.total,
          balance: Math.max(0, Number(item.total || 0) - getInvoicePaid(item.id, data.payments)),
        }))].map((item) =>
          <div className="portal-document-card" key={item.id}>
            <div><strong>{item.id}</strong><small>{item.kind} · {formatDate(item.issueDate)}{item.kind === 'Invoice' ? ` · Balance ${formatCurrency(item.balance)} · Status is read-only` : ''}</small></div>
            <strong>{formatCurrency(item.total)}</strong><Badge>{item.status}</Badge>
            {item.kind === 'Invoice' && item.clientDecision?.status && <Badge>{`Client ${item.clientDecision.status}`}</Badge>}
            {item.kind === 'Invoice' && isClient && !item.clientDecision?.status && ['Issued', 'Partially Paid', 'Overdue'].includes(item.status) && <label className="portal-invoice-decision">
              <span>Your decision</span>
              <select
                value=""
                disabled={Boolean(pendingInvoiceDecision) || workingInvoiceDecision}
                onChange={(event) => {
                  if (event.target.value) {
                    setInvoiceRejectionReason('')
                    setPendingInvoiceDecision({ invoice: item, decision: event.target.value })
                  }
                }}>
                <option value="">Choose Accept or Reject</option>
                <option value="Accepted">Accept invoice</option>
                <option value="Rejected">Reject invoice</option>
              </select>
            </label>}
          </div>)}
      </section>
    </div>
    <section className="panel portal-section">
      <div className="panel-heading"><div><h2>Recent payments</h2><p>Payment records linked to your invoices</p></div></div>
      {data.payments.map((payment) => <div className="portal-document-card" key={payment.id}>
        <div><strong>{payment.invoiceId || payment.id}</strong><small>{payment.method} · {formatDate(payment.date)}{payment.reference ? ` · ${payment.reference}` : ''}</small></div>
        <strong>{formatCurrency(payment.amount)}</strong><Badge>{payment.status}</Badge>
      </div>)}
      {!data.payments.length && <p className="muted">No payments have been recorded.</p>}
    </section>
    <section className="panel portal-section portal-quotations-section">
      <div className="panel-heading"><div><h2>Quotations</h2><p>Review the saved quotation details and respond to quotations awaiting your decision.</p></div></div>
      {data.quotations.map((quotation) => {
        const items = quotation.items?.length ? quotation.items : quotation.lineItems || []
        const awaitingDecision = isClient && ['Sent', 'Viewed'].includes(quotation.status)
        const decision = quotation.status === 'Accepted'
          ? quotation.acceptance?.acceptedAt || quotation.acceptedAt
          : quotation.status === 'Rejected' ? quotation.rejection?.rejectedAt || quotation.rejectedAt : null
        return <article className="portal-quotation-card" key={quotation.id}>
          <div><strong>{quotation.number || quotation.id} · {quotation.title}</strong><Badge>{quotation.status}</Badge></div>
          <p className="muted">Issued {formatDate(quotation.issueDate)} · Valid until {formatDate(quotation.validUntil)} · Total {formatCurrency(quotation.total ?? quotation.amount)}</p>
          {items.length > 0 && <div className="table-scroll"><table className="data-table">
            <thead><tr><th>Item</th><th>Quantity</th><th>Unit price</th><th>Amount</th></tr></thead>
            <tbody>{items.map((item, index) => <tr key={`${quotation.id}-item-${index}`}>
              <td>{item.description}</td><td>{item.quantity}</td><td>{formatCurrency(item.rate)}</td>
              <td>{formatCurrency(item.amount ?? Number(item.quantity || 0) * Number(item.rate || 0))}</td>
            </tr>)}</tbody>
          </table></div>}
          <p className="muted">Subtotal {formatCurrency(quotation.subtotal)} · Discount {formatCurrency(quotation.discount)} · Tax {formatCurrency(quotation.tax)}</p>
          {quotation.terms && <p className="muted"><strong>Terms:</strong> {quotation.terms}</p>}
          {decision && <p className="muted">Decision recorded {formatDecisionTimestamp(decision)}.</p>}
          <div className="sales-module-actions portal-quotation-actions">
            <Button variant="secondary" onClick={() => viewQuotation(quotation)}>View / Download PDF</Button>
            {awaitingDecision && <>
              <Button className="portal-accept-button" disabled={workingDecision || Boolean(pendingDecision)} onClick={() => setPendingDecision({ quotation, action: 'approve' })}><Check size={16} /> Accept</Button>
              <Button className="portal-reject-button" disabled={workingDecision || Boolean(pendingDecision)} onClick={() => setPendingDecision({ quotation, action: 'reject' })}><X size={16} /> Reject</Button>
              <label className="portal-status-control">
                <span>Quotation status</span>
                <select
                  aria-label={`Choose status for quotation ${quotation.number || quotation.id}`}
                  value={quotation.status}
                  disabled={workingDecision || Boolean(pendingDecision)}
                  onChange={(event) => {
                    if (event.target.value === 'Accepted') setPendingDecision({ quotation, action: 'approve' })
                    if (event.target.value === 'Rejected') setPendingDecision({ quotation, action: 'reject' })
                  }}>
                  <option value={quotation.status}>{quotation.status}</option>
                  <option value="Accepted">Accept quotation</option>
                  <option value="Rejected">Reject quotation</option>
                </select>
              </label>
            </>}
          </div>
        </article>
      })}
      {!data.quotations.length && <p className="muted">No quotations have been sent to this client.</p>}
    </section>
    {isBackendMode && isClient && <section className="panel portal-section">
      <div className="panel-heading"><div><h2>Work orders</h2><p>Review work orders and respond to those awaiting your approval.</p></div></div>
      {data.agreements.map((agreement) => {
        const awaitingApproval = agreement.status === 'Pending approval'
        return <article className="portal-workorder-card" key={agreement.id}>
          <div className="portal-workorder-heading">
            <div><strong>{agreement.project || agreement.id}</strong><small>{agreement.id}{agreement.quotationId ? ` · Quotation ${agreement.quotationId}` : ''}</small></div>
            <Badge>{agreement.status}</Badge>
          </div>
          <p className="muted">Target completion {formatDate(agreement.deadline)}{agreement.paymentMilestones ? ` · ${agreement.paymentMilestones}` : ''}</p>
          {awaitingApproval && <>
            <div className="sales-module-actions portal-quotation-actions">
              <label className="portal-status-control">
                <span>Work order status</span>
                <select
                  aria-label={`Choose status for work order ${agreement.id}`}
                  value={agreement.status}
                  disabled={Boolean(workingAgreementDecision) || Boolean(pendingAgreementDecision)}
                  onChange={(event) => {
                    if (event.target.value === 'Accepted') setPendingAgreementDecision({ agreement, action: 'accept' })
                    if (event.target.value === 'Rejected') {
                      setAgreementRejectionReason('')
                      setPendingAgreementDecision({ agreement, action: 'reject' })
                    }
                  }}>
                  <option value={agreement.status}>{agreement.status}</option>
                  <option value="Accepted">Accept work order</option>
                  <option value="Rejected">Reject work order</option>
                </select>
              </label>
              <Button className="portal-accept-button" disabled={Boolean(workingAgreementDecision) || Boolean(pendingAgreementDecision)} onClick={() => setPendingAgreementDecision({ agreement, action: 'accept' })}><Check size={16} /> Accept</Button>
              <Button className="portal-reject-button" disabled={Boolean(workingAgreementDecision) || Boolean(pendingAgreementDecision)} onClick={() => {
                setAgreementRejectionReason('')
                setPendingAgreementDecision({ agreement, action: 'reject' })
              }}><X size={16} /> Reject</Button>
            </div>
            <p className="muted">Acceptance is an authenticated acknowledgement, not a verified electronic signature.</p>
          </>}
        </article>
      })}
      {!data.agreements.length && <p className="muted">No work orders are linked to your account yet.</p>}
    </section>}
    {pendingDecision && <Modal
      title={`${pendingDecision.action === 'approve' ? 'Accept' : 'Reject'} quotation ${pendingDecision.quotation.number || pendingDecision.quotation.id}?`}
      description={`This decision will be saved to quotation ${pendingDecision.quotation.id} and reflected in the Design Blocks CRM.`}
      onClose={() => { if (!workingDecision) setPendingDecision(null) }}>
      <div className="portal-decision-modal-content">
        <p>Confirm that you want to {pendingDecision.action === 'approve' ? 'accept' : 'reject'} this quotation. This decision cannot be changed from the client portal.</p>
        <div className="modal-actions">
          <Button variant="secondary" type="button" disabled={workingDecision} onClick={() => setPendingDecision(null)}>Cancel</Button>
          <Button className={pendingDecision.action === 'approve' ? 'portal-accept-button' : 'portal-reject-button'} type="button" disabled={workingDecision} onClick={decideQuotation}>
            {workingDecision ? 'Saving decision…' : `Confirm ${pendingDecision.action === 'approve' ? 'acceptance' : 'rejection'}`}
          </Button>
        </div>
      </div>
    </Modal>}
    {pendingAgreementDecision && <Modal
      title={`${pendingAgreementDecision.action === 'accept' ? 'Accept' : 'Reject'} work order ${pendingAgreementDecision.agreement.id}?`}
      description="Your decision will be saved to this work order and shared with the Design Blocks team."
      onClose={() => {
        if (workingAgreementDecision) return
        setPendingAgreementDecision(null)
        setAgreementRejectionReason('')
      }}>
      <div className="record-form">
        <p>Confirm that you want to {pendingAgreementDecision.action} this work order. Acceptance is an authenticated acknowledgement, not an electronic signature.</p>
        {pendingAgreementDecision.action === 'reject' && <label className="form-field"><span>Reason for rejection</span><textarea rows="3" value={agreementRejectionReason} disabled={workingAgreementDecision} onChange={(event) => setAgreementRejectionReason(event.target.value)} /></label>}
        <div className="modal-actions">
          <Button variant="secondary" type="button" disabled={workingAgreementDecision} onClick={() => {
            setPendingAgreementDecision(null)
            setAgreementRejectionReason('')
          }}>Cancel</Button>
          <Button type="button" variant={pendingAgreementDecision.action === 'accept' ? 'primary' : 'danger'} disabled={workingAgreementDecision || (pendingAgreementDecision.action === 'reject' && !agreementRejectionReason.trim())} onClick={decideAgreement}>
            {workingAgreementDecision ? 'Saving decision…' : `Confirm ${pendingAgreementDecision.action === 'accept' ? 'acceptance' : 'rejection'}`}
          </Button>
        </div>
      </div>
    </Modal>}
    {pendingInvoiceDecision && <Modal
      title={`${pendingInvoiceDecision.decision === 'Accepted' ? 'Accept' : 'Reject'} invoice ${pendingInvoiceDecision.invoice.number || pendingInvoiceDecision.invoice.id}?`}
      description="Your decision is recorded separately from the invoice payment status and shared with the Design Blocks team."
      onClose={() => {
        if (workingInvoiceDecision) return
        setPendingInvoiceDecision(null)
        setInvoiceRejectionReason('')
      }}>
      <div className="record-form">
        <p>The invoice payment status will remain unchanged. Your decision cannot be changed from the client portal.</p>
        {pendingInvoiceDecision.decision === 'Rejected' && <label className="form-field"><span>Reason for rejection</span><textarea rows="3" maxLength={1000} value={invoiceRejectionReason} disabled={workingInvoiceDecision} onChange={(event) => setInvoiceRejectionReason(event.target.value)} /></label>}
        <div className="modal-actions">
          <Button variant="secondary" type="button" disabled={workingInvoiceDecision} onClick={() => {
            setPendingInvoiceDecision(null)
            setInvoiceRejectionReason('')
          }}>Cancel</Button>
          <Button type="button" variant={pendingInvoiceDecision.decision === 'Accepted' ? 'primary' : 'danger'} disabled={workingInvoiceDecision || (pendingInvoiceDecision.decision === 'Rejected' && !invoiceRejectionReason.trim())} onClick={decideInvoice}>
            {workingInvoiceDecision ? 'Saving decision…' : `Confirm ${pendingInvoiceDecision.decision.toLowerCase()}`}
          </Button>
        </div>
      </div>
    </Modal>}
    {!isBackendMode && <div className="prototype-callout"><ShieldCheck size={17} /> Preview mode displays only the selected demo client’s linked records. This does not provide production authentication or data security.</div>}
  </div>
}
