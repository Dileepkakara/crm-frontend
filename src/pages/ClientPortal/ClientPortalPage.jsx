import { useEffect, useState } from 'react'
import { Check, ShieldCheck, X } from 'lucide-react'
import { apiFor } from '../../api/resourcesApi'
import { useApp } from '../../context/useApp'
import { Badge, Button, PageHeader } from '../../components/common/UI'
import { formatCurrency, formatDate, getInvoicePaid } from '../../utils/formatters'
import { useAuth } from '../../auth/useAuth'
import { ROLES } from '../../config/roles'
import { apiClient, isBackendMode } from '../../api/apiClient'

export default function ClientPortalPage() {
  const { notify } = useApp()
  const { user } = useAuth()
  const isClient = user?.role === ROLES.CLIENT
  const [clients, setClients] = useState([])
  const [selected, setSelected] = useState('')
  const [data, setData] = useState({ quotations: [], invoices: [], projects: [], agreements: [], payments: [] })
  async function acceptAgreement(id) {
    try {
      const agreement = await apiFor.agreements.accept(id)
      setData((current) => ({
        ...current,
        agreements: current.agreements.map((record) => record.id === id ? agreement : record),
      }))
      notify('Work order acceptance recorded.', 'success')
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  useEffect(() => {
    if (isBackendMode && isClient) {
      apiClient.get('portal').then(({ data: portal }) => {
        setClients([portal.client])
        setSelected(portal.client.id)
        setData({
          quotations: portal.quotations,
          invoices: portal.invoices,
          projects: portal.projects,
          agreements: portal.agreements,
          payments: portal.payments,
        })
      }).catch((error) => notify(error.message, 'error'))
      return
    }
    apiFor.clients.list().then((list) => {
      const availableClients = isClient ? list.filter((client) => client.id === user.clientId) : list
      setClients(availableClients)
      setSelected(isClient ? user.clientId : availableClients[0]?.id || '')
    }).catch((error) => notify(error.message, 'error'))
  }, [notify, isClient, user])

  useEffect(() => {
    if (isBackendMode && isClient) return
    if (!selected) return
    Promise.all(['quotations', 'invoices', 'projects', 'agreements', 'payments'].map((resource) => apiFor[resource].list()))
      .then(([quotations, invoices, projects, agreements, payments]) => {
        const client = clients.find((item) => item.id === selected)
        const match = (record) => record.clientId === selected || (!isClient && (record.client === client?.company || record.client === client?.name))
        const selectedInvoices = invoices.filter(match)
        setData({
          quotations: quotations.filter(match),
          invoices: selectedInvoices,
          projects: projects.filter(match),
          agreements: agreements.filter(match),
          payments: payments.filter((payment) => selectedInvoices.some((invoice) => invoice.id === payment.invoiceId)),
        })
      }).catch((error) => notify(error.message, 'error'))
  }, [selected, clients, notify, isClient])

  const client = clients.find((item) => item.id === selected)
  const totalDue = data.invoices.reduce((sum, invoice) =>
    sum + Math.max(0, invoice.total - getInvoicePaid(invoice.id, data.payments)), 0)

  return <div className="page">
    <PageHeader title={isBackendMode && isClient ? 'Client portal' : 'Client portal preview'} description={isBackendMode && isClient ? 'Review your active work, commercial documents, and invoice balances.' : 'A preview of the future client-facing project space.'}
      actions={!isClient && <label className="client-preview-select"><span>Preview as</span><select value={selected} onChange={(event) => setSelected(event.target.value)}>
        {clients.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.company}</option>)}
      </select></label>} />
    <div className="portal-banner">
      <div className="portal-avatar">{client?.name?.split(' ').map((part) => part[0]).join('')}</div>
      <div><small>CLIENT WORKSPACE PREVIEW</small><h2>{client?.company || 'Select a demo client'}</h2><p>Welcome back, {client?.name || 'client'}. Here’s the latest on your work with Design Blocks.</p></div>
      <Badge tone="information">{isBackendMode && isClient ? 'Secure portal' : 'Preview mode'}</Badge>
    </div>
    <div className="portal-summary">
      <div><small>Active projects</small><strong>{data.projects.length}</strong></div>
      <div><small>Open invoices</small><strong>{data.invoices.filter((invoice) => invoice.status !== 'Paid').length}</strong></div>
      <div><small>Outstanding balance</small><strong>{formatCurrency(totalDue)}</strong></div>
      <div><small>Agreements</small><strong>{data.agreements.length}</strong></div>
    </div>
    <div className="portal-grid">
      <section className="panel"><div className="panel-heading"><div><h2>Project progress</h2><p>Your active work with our team</p></div></div>
        {data.projects.map((project) => <div className="portal-project" key={project.id}>
          <div><strong>{project.name}</strong><Badge>{project.status}</Badge></div>
          <div className="progress-track"><span style={{ width: `${project.progress}%` }} /></div>
          <small>{project.progress}% complete · Target {formatDate(project.deadline)}</small>
        </div>)}
        {!data.projects.length && <p className="muted">No projects are linked to this demo client.</p>}
      </section>
      <section className="panel"><div className="panel-heading"><div><h2>Recent documents</h2><p>Quotations and invoices</p></div></div>
        {[...data.quotations.map((item) => ({ ...item, kind: 'Quotation', total: item.amount })), ...data.invoices.map((item) => ({ ...item, kind: 'Invoice', total: item.total }))].map((item) =>
          <div className="portal-document" key={item.id}>
            <div><strong>{item.id}</strong><small>{item.kind} · {formatDate(item.issueDate)}</small></div>
            <strong>{formatCurrency(item.total)}</strong><Badge>{item.status}</Badge>
          </div>)}
      </section>
    </div>
    {isBackendMode && isClient && data.agreements.filter((agreement) => agreement.status === 'Pending approval').map((agreement) =>
      <section className="panel" key={`accept-${agreement.id}`}>
        <div className="panel-heading"><div><h2>Work order awaiting your approval</h2><p>{agreement.project} · {agreement.id}</p></div>
          <div className="sales-module-actions"><Button onClick={() => acceptAgreement(agreement.id)}><Check size={16} /> Accept work order</Button>
            <Button variant="secondary" onClick={async () => {
              const reason = window.prompt('Reason for rejecting this work order:')
              if (!reason?.trim()) return
              try {
                const rejected = await apiFor.agreements.reject(agreement.id, reason.trim())
                setData((current) => ({ ...current, agreements: current.agreements.map((record) => record.id === rejected.id ? rejected : record) }))
                notify('Work order rejection recorded.')
              } catch (error) { notify(error.message, 'error') }
            }}><X size={16} /> Reject</Button></div>
        </div>
        <p className="muted">Acceptance is an authenticated acknowledgement, not a verified electronic signature.</p>
      </section>)}
    {!isBackendMode && <div className="prototype-callout"><ShieldCheck size={17} /> Preview mode displays only the selected demo client’s linked records. This does not provide production authentication or data security.</div>}
  </div>
}
