import { useEffect, useMemo, useState } from 'react'
import { Download, Printer, ShieldCheck } from 'lucide-react'
import { apiFor } from '../../api/resourcesApi'
import { useApp } from '../../context/useApp'
import { useAuth } from '../../auth/useAuth'
import { usePermissions } from '../../auth/usePermissions'
import { Button, PageHeader } from '../../components/common/UI'
import { filterRecordsForUser } from '../../services/permissionsService'
import { formatCurrency, getInvoicePaid } from '../../utils/formatters'
import { apiClient, isBackendMode } from '../../api/apiClient'

export default function ReportsPage() {
  const { notify } = useApp()
  const { user } = useAuth()
  const { hasPermission: can } = usePermissions()
  const canSales = can('reports.view.sales')
  const canFinancial = can('reports.view.financial')
  const canDelivery = can('projects.view') || can('projects.view.assigned') || can('tasks.view')
  const [data, setData] = useState(null)

  useEffect(() => {
    if (isBackendMode) {
      apiClient.get('reports').then(({ data: summary }) => setData({ summary }))
        .catch((error) => notify(error.message, 'error'))
      return
    }
    const keys = [
      ...(canSales ? ['leads', 'quotations'] : []),
      ...(canFinancial ? ['invoices', 'payments'] : []),
      ...(canDelivery ? ['projects', 'tasks'] : []),
    ]
    Promise.all(keys.map((key) => apiFor[key].list()))
      .then((values) => setData(Object.fromEntries(keys.map((key, index) =>
        [key, filterRecordsForUser(key, values[index], user)]))))
      .catch((error) => notify(error.message, 'error'))
  }, [canDelivery, canFinancial, canSales, notify, user])

  const report = useMemo(() => {
    if (!data) return null
    if (data.summary) {
      const summary = data.summary
      const sales = summary.sales
      const financial = summary.financial
      const delivery = summary.delivery
      const quoteStatuses = sales?.quotations.byStatus || {}
      const quoteCount = Object.values(quoteStatuses).reduce((sum, count) => sum + count, 0)
      return {
        leadTotal: sales?.leads.total || 0,
        leadStatus: sales?.leads.byStatus || {},
        conversions: sales?.conversionPercent || 0,
        pipeline: sales?.quotations.pipeline || 0,
        quotationAcceptance: quoteCount ? Math.round((quoteStatuses.Accepted || 0) / quoteCount * 100) : 0,
        outstanding: financial?.outstanding || 0,
        openInvoices: financial?.openInvoices || 0,
        projectCompletion: delivery?.completionPercent || 0,
        activeProjects: Object.entries(delivery?.projects.byStatus || {})
          .filter(([status]) => !['Completed', 'Cancelled'].includes(status))
          .reduce((sum, [, count]) => sum + count, 0),
        tasksCompleted: delivery?.tasks.completed || 0,
        tasksTotal: delivery?.tasks.total || 0,
      }
    }
    const leads = data.leads || []
    const quotations = data.quotations || []
    const invoices = data.invoices || []
    const payments = data.payments || []
    const projects = data.projects || []
    const tasks = data.tasks || []
    return {
      leadTotal: leads.length,
      leadStatus: leads.reduce((summary, lead) => {
        summary[lead.status] = (summary[lead.status] || 0) + 1
        return summary
      }, {}),
      outstanding: invoices.reduce((sum, invoice) =>
        sum + Math.max(0, invoice.total - getInvoicePaid(invoice.id, payments)), 0),
      conversions: leads.length ? Math.round(leads.filter((lead) => lead.status === 'Won').length / leads.length * 100) : 0,
      pipeline: quotations.filter((quote) => ['Draft', 'Sent', 'Viewed'].includes(quote.status))
        .reduce((sum, quote) => sum + quote.amount, 0),
      projectCompletion: projects.length
        ? Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / projects.length)
        : 0,
      quotationAcceptance: quotations.length ? Math.round(quotations.filter((quote) => quote.status === 'Accepted').length / quotations.length * 100) : 0,
      activeProjects: projects.filter((project) => !['Completed', 'Cancelled'].includes(project.status)).length,
      tasksCompleted: tasks.filter((task) => task.status === 'Completed').length,
      tasksTotal: tasks.length,
      openInvoices: invoices.filter((invoice) => !['Paid', 'Cancelled', 'Draft'].includes(invoice.status)).length,
    }
  }, [data])

  return <div className="page">
    <PageHeader title="Reports" description="A role-scoped view of sales activity, financial health, and delivery progress."
      actions={<><Button className="no-print" variant="secondary" onClick={() => window.print()}><Printer size={16} /> Print</Button><Button className="no-print" variant="secondary" onClick={() => notify('Report export is available from each module’s Export action.', 'info')}><Download size={16} /> Export guide</Button></>} />
    {!report ? <div className="loading-inline"><span className="spinner" />Loading reports…</div> : <>
      <div className="report-metrics">
        {canSales && <><div><small>Lead conversion</small><strong>{report.conversions}%</strong><span>Won leads / all leads</span></div><div><small>Sales pipeline</small><strong>{formatCurrency(report.pipeline)}</strong><span>Draft and sent quotes</span></div></>}
        {canFinancial && <div><small>Outstanding balance</small><strong>{formatCurrency(report.outstanding)}</strong><span>Issued invoice balances</span></div>}
        {canDelivery && <div><small>Project completion</small><strong>{report.projectCompletion}%</strong><span>Average assigned project progress</span></div>}
      </div>
      <div className="report-grid">
        {canSales && <section className="panel"><div className="panel-heading"><div><h2>Lead status distribution</h2><p>Number of leads at each stage</p></div></div>
          {['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'].map((status) => {
            const count = report.leadStatus[status] || 0
            const width = report.leadTotal ? count / report.leadTotal * 100 : 0
            return <div className="report-bar-row" key={status}><span>{status}</span><div className="report-bar-track"><i style={{ width: `${width}%` }} /></div><b>{count}</b></div>
          })}
        </section>}
        {(canSales || canDelivery || canFinancial) && <section className="panel"><div className="panel-heading"><div><h2>Workspace snapshot</h2><p>Activity available to your role</p></div></div>
          <div className="snapshot-list">
            {canDelivery && <><div><span>Active projects</span><strong>{report.activeProjects}</strong></div><div><span>Tasks completed</span><strong>{report.tasksCompleted} / {report.tasksTotal}</strong></div></>}
            {canSales && <div><span>Quotation acceptance</span><strong>{report.quotationAcceptance}%</strong></div>}
            {canFinancial && <div><span>Open invoices</span><strong>{report.openInvoices}</strong></div>}
          </div>
        </section>}
      </div>
      {!isBackendMode && <p className="prototype-callout"><ShieldCheck size={17} /> Analytics use fictional demo data and are limited by your demo account role; this is not financial reporting.</p>}
    </>}
  </div>
}
