import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, CircleDollarSign, FileText, FolderKanban, Plus, Printer, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { apiFor } from '../../api/resourcesApi'
import { useApp } from '../../context/useApp'
import { Badge, Button, PageHeader, StatCard } from '../../components/common/UI'
import { formatCurrency, formatDate, getInvoicePaid } from '../../utils/formatters'
import { useAuth } from '../../auth/useAuth'
import { usePermissions } from '../../auth/usePermissions'
import { ROLE_CONFIG } from '../../config/roles'
import { filterRecordsForUser } from '../../services/permissionsService'
import { apiClient, isBackendMode } from '../../api/apiClient'

const chartColors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

export default function DashboardPage() {
  const [records, setRecords] = useState({})
  const [loading, setLoading] = useState(true)
  const [refreshError, setRefreshError] = useState('')
  const { notify } = useApp()
  const { user } = useAuth()
  const { hasPermission: can } = usePermissions()
  const refresh = useCallback(async ({ silent = false } = {}) => {
    try {
      if (isBackendMode) {
        const { data } = await apiClient.get('dashboard')
        setRecords({ summary: data })
        setRefreshError('')
        return
      }
      const keys = ['leads', 'followups', 'clients', 'quotations', 'invoices', 'payments', 'projects', 'tasks']
      const values = await Promise.all(keys.map((key) => apiFor[key].list()))
      setRecords(Object.fromEntries(keys.map((key, index) => [key, filterRecordsForUser(key, values[index], user)])))
      setRefreshError('')
    } catch (error) {
      const message = error.message || 'Could not load dashboard data.'
      setRefreshError(message)
      if (!silent) notify(message, 'error')
    } finally { setLoading(false) }
  }, [notify, user])
  useEffect(() => {
    let active = true
    const initialTimer = window.setTimeout(() => { if (active) void refresh() }, 0)
    const refreshWhenVisible = () => {
      if (active && document.visibilityState === 'visible') void refresh({ silent: true })
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
  }, [refresh])

  const data = useMemo(() => {
    if (records.summary) {
      const summary = records.summary
      const status = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'].map((name) => ({
        name, value: summary.leads?.byStatus?.[name] || 0,
      }))
      return {
        sources: summary.leadSources || [],
        status,
        outstanding: summary.finance?.outstanding || 0,
        projectStatus: Object.entries(summary.projects?.byStatus || {}).map(([name, value]) => ({ name, value })),
        won: summary.leads?.byStatus?.Won || 0,
        recent: summary.recent?.leads || [],
        followups: summary.recent?.followups || [],
        invoices: summary.recent?.invoices || [],
        projects: summary.recent?.projects || [],
      }
    }
    const leads = records.leads || []
    const sources = Object.entries(leads.reduce((all, lead) => {
      all[lead.source || 'Other'] = (all[lead.source || 'Other'] || 0) + 1
      return all
    }, {})).map(([name, value]) => ({ name, value }))
    const status = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'].map((name) => ({
      name, value: leads.filter((lead) => lead.status === name).length,
    }))
    const invoices = records.invoices || []
    const outstanding = invoices.reduce((total, invoice) =>
      total + Math.max(0, Number(invoice.total || 0) - getInvoicePaid(invoice.id, records.payments || [])), 0)
    const projectStatus = ['In Progress', 'In Review', 'Planning', 'Completed'].map((name) => ({
      name, value: (records.projects || []).filter((project) => project.status === name).length,
    })).filter((item) => item.value)
    return {
      sources, status, outstanding, projectStatus,
      won: leads.filter((lead) => lead.status === 'Won').length,
      recent: leads.slice(0, 4),
      followups: (records.followups || []).slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 4),
      invoices: invoices.filter((invoice) => invoice.status !== 'Paid').slice(0, 4),
      projects: (records.projects || []),
    }
  }, [records])
  const summary = records.summary

  if (loading) return <div className="loading-screen"><span className="spinner" />Loading your workspace…</div>
  return <div className="page dashboard-page">
    <PageHeader title={`Welcome, ${user?.name?.split(' ')[0] || 'team'}`} description={`${user?.roleLabel || ROLE_CONFIG[user?.role]?.label || 'Your'} overview of today’s work.`}
      actions={<><Button className="no-print" variant="secondary" onClick={() => window.print()}><Printer size={16} /> Print</Button><Button className="no-print" variant="secondary" onClick={() => notify('Showing the current demo reporting period.', 'info')}><CalendarDays size={16} /> This month</Button>{can('leads.create') && <Link className="button button-primary no-print" to="/leads"><Plus size={17} /> Add lead</Link>}</>} />
    {refreshError && <div className="resource-load-error" role="alert"><span>{refreshError}</span><Button type="button" variant="secondary" onClick={() => refresh()}>Retry</Button></div>}
    <div className="stat-grid">
      {can('leads.view.all') || can('leads.view.assigned') ? <StatCard label="My leads" value={summary ? summary.leads?.total || 0 : records.leads?.length || 0} change={can('leads.view.all') ? 'Team enquiries' : 'Assigned enquiries'} icon={UsersRound} color="blue" /> : null}
      {can('leads.view.all') || can('leads.view.assigned') ? <StatCard label="New leads" value={summary ? summary.leads?.byStatus?.New || 0 : records.leads?.filter((lead) => lead.status === 'New').length || 0} change="Ready for follow-up" icon={ArrowUpRight} color="violet" /> : null}
      {can('projects.view') || can('projects.view.assigned') ? <StatCard label="Active projects" value={summary ? Object.entries(summary.projects?.byStatus || {}).filter(([status]) => !['Completed', 'Cancelled'].includes(status)).reduce((total, [, count]) => total + count, 0) : records.projects?.filter((project) => !['Completed', 'Cancelled'].includes(project.status)).length || 0} change={`${summary ? summary.tasks?.open || 0 : records.tasks?.filter((task) => task.status !== 'Completed').length || 0} open tasks`} icon={FolderKanban} color="green" /> : null}
      {(can('quotations.view') || can('quotations.view.own')) && (can('reports.view.financial')
        ? <StatCard label="Quotation pipeline" value={formatCurrency(summary ? summary.quotations?.pipeline || 0 : (records.quotations || []).filter((quote) => ['Sent', 'Viewed', 'Draft'].includes(quote.status)).reduce((sum, quote) => sum + Number(quote.amount || 0), 0))} change={summary ? `Accepted ${summary.quotations?.byStatus?.Accepted || 0} · Rejected ${summary.quotations?.byStatus?.Rejected || 0}` : 'Draft & sent quotations'} icon={CircleDollarSign} color="amber" />
        : <StatCard label="Open quotations" value={summary ? summary.quotations?.openCount || 0 : (records.quotations || []).filter((quote) => ['Sent', 'Viewed', 'Draft'].includes(quote.status)).length} change={summary ? `Accepted ${summary.quotations?.byStatus?.Accepted || 0} · Rejected ${summary.quotations?.byStatus?.Rejected || 0}` : 'Draft & sent quotations'} icon={FileText} color="amber" />)}
      {can('invoices.view') || can('payments.view') ? <StatCard label="Outstanding" value={formatCurrency(data.outstanding)} change="Across unpaid invoices" icon={ArrowDownRight} color="rose" /> : null}
      {can('followups.view') ? <StatCard label="Overdue follow-ups" value={summary ? summary.followups?.overdue || 0 : records.followups?.filter((item) => item.status === 'Overdue').length || 0} change="Needs attention" icon={CalendarDays} color="orange" /> : null}
      {can('tasks.view.assigned') && <StatCard label="My tasks" value={summary ? summary.tasks?.total || 0 : records.tasks?.length || 0} change={`${summary ? summary.tasks?.inProgress || 0 : records.tasks?.filter((task) => task.status === 'In Progress').length || 0} in progress`} icon={CalendarDays} color="orange" />}
      {can('payments.view') && <StatCard label="Payments received" value={formatCurrency(summary ? summary.finance?.paymentsReceived || 0 : (records.payments || []).filter((payment) => payment.status !== 'Refunded').reduce((sum, payment) => sum + Number(payment.amount || 0), 0))} change="Recorded receipts" icon={CircleDollarSign} color="green" />}
    </div>

    <div className="dashboard-grid">
      {can('leads.view.all') || can('leads.view.assigned') ? <section className="panel chart-panel trend-panel"><div className="panel-heading"><div><h2>Lead pipeline</h2><p>Current enquiry status at a glance</p></div><Link to="/leads" className="text-link">View leads <ArrowRight size={14} /></Link></div>
        <div className="chart-body"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.status} margin={{ top: 12, right: 10, left: -22, bottom: 0 }}><CartesianGrid vertical={false} stroke="#eef2f7" /><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} /><Tooltip cursor={{ fill: '#f8fafc' }} /><Bar dataKey="value" name="Leads" fill="#2563eb" radius={[5, 5, 0, 0]} barSize={33} /></BarChart></ResponsiveContainer></div>
        <div className="chart-legend">{data.status.filter((item) => item.value).map((item, index) => <span key={item.name}><i style={{ background: chartColors[index] }} />{item.name}<b>{item.value}</b></span>)}</div>
      </section> : null}
      {can('leads.view.all') || can('leads.view.assigned') ? <section className="panel chart-panel source-panel"><div className="panel-heading"><div><h2>Lead sources</h2><p>Where enquiries are coming from</p></div></div>
        <div className="source-chart">{data.sources.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.sources} dataKey="value" nameKey="name" innerRadius={57} outerRadius={83} paddingAngle={3} stroke="none">{data.sources.map((source, index) => <Cell key={source.name} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer> : <span className="muted">No lead data</span>}
          <div className="donut-center"><strong>{summary ? summary.leads?.total || 0 : records.leads?.length || 0}</strong><small>leads</small></div></div>
        <div className="source-legend">{data.sources.map((source, index) => <span key={source.name}><i style={{ background: chartColors[index % chartColors.length] }} />{source.name}<b>{source.value}</b></span>)}</div>
      </section> : null}
      {(can('leads.view.all') || can('leads.view.assigned')) && <section className="panel activity-panel"><div className="panel-heading"><div><h2>Recent leads</h2><p>Your latest incoming enquiries</p></div><Link to="/leads" className="text-link">All leads <ArrowRight size={14} /></Link></div>
        {data.recent.map((lead) => <Link className="compact-row" to={`/leads/${lead.id}`} key={lead.id}><div className="avatar avatar-soft">{lead.name.split(' ').map((part) => part[0]).join('')}</div><div className="compact-info"><strong>{lead.name}</strong><small>{lead.company} · {lead.service}</small></div><div className="compact-meta"><Badge>{lead.status}</Badge><small>{formatDate(lead.createdAt)}</small></div></Link>)}
      </section>}
      {can('followups.view') && <section className="panel activity-panel"><div className="panel-heading"><div><h2>Upcoming follow-ups</h2><p>Keep momentum with your prospects</p></div><Link to="/follow-ups" className="text-link">View all <ArrowRight size={14} /></Link></div>
        {data.followups.map((item) => <div className="compact-row" key={item.id}><div className="date-tile"><strong>{new Date(`${item.dueDate}T00:00:00`).getDate()}</strong><small>{new Date(`${item.dueDate}T00:00:00`).toLocaleString('en', { month: 'short' })}</small></div><div className="compact-info"><strong>{item.contact}</strong><small>{item.type} · {item.company}</small></div><Badge>{item.status}</Badge></div>)}
      </section>}
      {(can('projects.view') || can('projects.view.assigned')) && <section className="panel project-panel"><div className="panel-heading"><div><h2>Project health</h2><p>Delivery progress across active work</p></div><Link to="/projects" className="text-link">All projects <ArrowRight size={14} /></Link></div>
        {data.projects.map((project) => <div className="project-progress-row" key={project.id}><div className="project-row-title"><div><strong>{project.name}</strong><small>{project.client} · Due {formatDate(project.deadline)}</small></div><Badge>{project.status}</Badge></div><div className="progress-track"><span style={{ width: `${project.progress}%` }} /></div><small className="progress-caption">{project.progress}% complete</small></div>)}
      </section>}
      {(can('invoices.view') || can('payments.view')) && <section className="panel invoices-panel"><div className="panel-heading"><div><h2>Outstanding invoices</h2><p>Keep an eye on incoming payments</p></div><Link to="/invoices" className="text-link">All invoices <ArrowRight size={14} /></Link></div>
        {data.invoices.map((invoice) => { const balance = invoice.balance ?? Math.max(0, invoice.total - getInvoicePaid(invoice.id, records.payments || [])); return <div className="invoice-row" key={invoice.id}><div><strong>{invoice.id}</strong><small>{invoice.client} · Due {formatDate(invoice.dueDate)}</small></div><div><strong>{formatCurrency(balance)}</strong><Badge>{invoice.status}</Badge></div></div> })}
      </section>}
    </div>
  </div>
}
