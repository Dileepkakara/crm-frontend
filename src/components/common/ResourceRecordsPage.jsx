import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Eye, GitBranch, Pencil, Plus, Printer, Search, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { apiFor, scopeResourceRecords } from '../../api/resourcesApi'
import { useApp } from '../../context/useApp'
import { Badge, Button, EmptyState, Modal, PageHeader } from './UI'
import { formatCurrency, formatDate, getInvoicePaid } from '../../utils/formatters'
import { useAuth } from '../../auth/useAuth'
import { usePermissions } from '../../auth/usePermissions'
import { canAccessRecord, canManageResource } from '../../services/permissionsService'
import { isBackendMode } from '../../api/apiClient'

const configs = {
  leads: { title: 'Leads', description: 'Manage and track business enquiries from one place.', action: 'Add lead', search: 'Search by name, company, email, phone or lead ID…', statuses: ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'], columns: [['id', 'Lead ID'], ['name', 'Contact'], ['company', 'Company'], ['service', 'Service'], ['source', 'Source'], ['status', 'Status'], ['priority', 'Priority'], ['assignee', 'Owner'], ['followUp', 'Next follow-up']], fields: [['name', 'Client name', 'text', true], ['company', 'Company name', 'text', true], ['phone', 'Phone number', 'tel', true], ['email', 'Email address', 'email', true], ['source', 'Lead source', 'select', true, ['Website', 'Referral', 'LinkedIn', 'Google Ads', 'Event', 'Other']], ['service', 'Service required', 'select', true, ['Web development', 'Brand identity', 'Product design', 'Mobile app', 'E-commerce', 'Other']], ['budget', 'Estimated budget (₹)', 'number', true], ['timeline', 'Expected timeline', 'text', false], ['priority', 'Priority', 'select', true, ['Low', 'Medium', 'High', 'Urgent']], ['assignee', 'Assigned employee', 'select', true, ['Priya Sharma', 'Rohan Das', 'Aditi Nair']], ['followUp', 'Next follow-up', 'date', false], ['notes', 'Notes', 'textarea', false]], summary: ['Total leads', 'New', 'Contacted', 'Qualified'] },
  followups: { title: 'Follow-ups', description: 'Stay on top of every conversation and next step.', action: 'Schedule follow-up', search: 'Search contact, company or lead…', statuses: ['Upcoming', 'Due today', 'Overdue', 'Completed'], columns: [['contact', 'Contact'], ['company', 'Company'], ['type', 'Follow-up type'], ['dueDate', 'Due date'], ['assignee', 'Owner'], ['status', 'Status']], fields: [['contact', 'Contact name', 'text', true], ['company', 'Company', 'text', true], ['leadId', 'Related lead ID', 'text', false], ['type', 'Follow-up type', 'select', true, ['Intro call', 'Discovery call', 'Proposal review', 'Check-in', 'Email']], ['dueDate', 'Due date', 'date', true], ['assignee', 'Assigned employee', 'select', true, ['Priya Sharma', 'Rohan Das', 'Aditi Nair']], ['status', 'Status', 'select', true, ['Upcoming', 'Due today', 'Overdue', 'Completed']], ['notes', 'Notes', 'textarea', false]] },
  clients: { title: 'Clients', description: 'A trusted home for your client relationships and account details.', action: 'Add client', search: 'Search by client, company or email…', statuses: ['Active', 'Prospect', 'Inactive'], columns: [['id', 'Client ID'], ['name', 'Contact'], ['company', 'Company'], ['email', 'Email'], ['phone', 'Phone'], ['status', 'Status'], ['since', 'Client since']], fields: [['name', 'Contact name', 'text', true], ['company', 'Company name', 'text', true], ['email', 'Email address', 'email', true], ['phone', 'Phone number', 'tel', true], ['status', 'Status', 'select', true, ['Active', 'Prospect', 'Inactive']]] },
  quotations: { title: 'Quotations', description: 'Create clear proposals and keep every version in one place.', action: 'Create quotation', search: 'Search quotation, client or title…', statuses: ['Draft', 'Sent', 'Viewed', 'Accepted', 'Rejected', 'Expired', 'Revised'], columns: [['id', 'Quote no.'], ['title', 'Title'], ['client', 'Client'], ['issueDate', 'Issue date'], ['validUntil', 'Valid until'], ['amount', 'Amount'], ['version', 'Version'], ['status', 'Status']], fields: [['client', 'Client', 'text', true], ['clientId', 'Client ID (optional)', 'text', false], ['leadId', 'Related lead ID', 'text', false], ['title', 'Quotation title', 'text', true], ['issueDate', 'Issue date', 'date', true], ['validUntil', 'Valid until', 'date', true], ['amount', 'Total amount (₹)', 'number', true], ['version', 'Version', 'number', true], ['status', 'Status', 'select', true, ['Draft', 'Sent', 'Viewed', 'Accepted', 'Rejected'] ]], money: ['amount'] },
  agreements: { title: 'Work orders & agreements', description: 'Keep approved scope and commercial terms close to delivery.', action: 'Create work order', search: 'Search document or client…', statuses: ['Draft', 'Pending approval', 'Accepted'], columns: [['id', 'Document no.'], ['client', 'Client'], ['quotationId', 'Quotation'], ['project', 'Project'], ['version', 'Version'], ['createdAt', 'Created'], ['status', 'Approval']], fields: [['client', 'Client', 'text', true], ['clientId', 'Client ID', 'text', false], ['quotationId', 'Related quotation', 'text', true], ['project', 'Project name', 'text', true], ['version', 'Version', 'number', true], ['status', 'Approval status', 'select', true, ['Draft', 'Pending approval', 'Accepted']]] },
  invoices: { title: 'Invoices', description: 'Track issued invoices, due dates, and balances in one view.', action: 'Create invoice', search: 'Search invoice, client or project…', statuses: ['Draft', 'Issued', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'], columns: [['id', 'Invoice no.'], ['client', 'Client'], ['project', 'Project'], ['issueDate', 'Issued'], ['dueDate', 'Due date'], ['total', 'Total'], ['balance', 'Balance due'], ['status', 'Status']], fields: [['client', 'Client', 'text', true], ['clientId', 'Client ID', 'text', false], ['project', 'Project', 'text', true], ['issueDate', 'Issue date', 'date', true], ['dueDate', 'Due date', 'date', true], ['discount', 'Discount (₹)', 'number', false], ['tax', 'Tax (₹)', 'number', false], ['total', 'Total amount (₹)', 'number', true], ['status', 'Status', 'select', true, ['Draft', 'Issued', 'Overdue']]], money: ['total'] },
  payments: { title: 'Payments', description: 'A transparent record of demo payments and invoice balances.', action: 'Record payment', search: 'Search payment reference or client…', statuses: ['Recorded', 'Pending', 'Refunded'], columns: [['id', 'Reference'], ['client', 'Client'], ['invoiceId', 'Invoice'], ['project', 'Project'], ['date', 'Payment date'], ['amount', 'Amount'], ['method', 'Method'], ['status', 'Status']], fields: [['invoiceId', 'Invoice ID', 'select', true, []], ['client', 'Client', 'text', true], ['project', 'Project', 'text', false], ['date', 'Payment date', 'date', true], ['amount', 'Amount (₹)', 'number', true], ['method', 'Payment method', 'select', true, ['Bank Transfer', 'UPI', 'Cash', 'Card', 'Other']]], money: ['amount'] },
  projects: { title: 'Projects', description: 'Keep client work, project health, and delivery dates visible.', action: 'Create project', search: 'Search project, client or manager…', statuses: ['Planning', 'Not Started', 'In Progress', 'On Hold', 'In Review', 'Completed', 'Cancelled'], columns: [['id', 'Project ID'], ['name', 'Project'], ['client', 'Client'], ['manager', 'Project manager'], ['startDate', 'Start date'], ['deadline', 'Deadline'], ['progress', 'Progress'], ['status', 'Status']], fields: [['name', 'Project name', 'text', true], ['client', 'Client', 'text', true], ['clientId', 'Client ID', 'text', false], ['quotationId', 'Related quotation', 'text', false], ['manager', 'Project manager', 'select', true, ['Priya Sharma', 'Rohan Das', 'Aditi Nair']], ['startDate', 'Start date', 'date', true], ['deadline', 'Deadline', 'date', true], ['progress', 'Progress (%)', 'number', true], ['status', 'Status', 'select', true, ['Planning', 'Not Started', 'In Progress', 'On Hold', 'In Review', 'Completed']]] },
  tasks: { title: 'Tasks', description: 'Coordinate work, ownership, and deadlines across active projects.', action: 'Create task', search: 'Search task, project or assignee…', statuses: ['To Do', 'In Progress', 'In Review', 'Completed', 'Blocked'], columns: [['id', 'Task ID'], ['title', 'Task'], ['project', 'Project'], ['assignee', 'Assignee'], ['priority', 'Priority'], ['dueDate', 'Due date'], ['status', 'Status']], fields: [['title', 'Task title', 'text', true], ['project', 'Project', 'select', true, []], ['description', 'Description', 'textarea', false], ['assignee', 'Assigned employee', 'select', true, ['Priya Sharma', 'Rohan Das', 'Aditi Nair', 'Dev Malhotra']], ['priority', 'Priority', 'select', true, ['Low', 'Medium', 'High', 'Urgent']], ['dueDate', 'Due date', 'date', true], ['status', 'Status', 'select', true, ['To Do', 'In Progress', 'In Review', 'Completed', 'Blocked']]] },
  users: { title: 'Users & access', description: 'Review demo team members, roles, and workspace access.', action: 'Add user', search: 'Search by name or email…', statuses: ['Active', 'Inactive'], columns: [['id', 'Employee ID'], ['name', 'Name'], ['email', 'Email'], ['role', 'Role'], ['department', 'Department'], ['status', 'Status']], fields: [['name', 'Full name', 'text', true], ['email', 'Email address', 'email', true], ['role', 'Role', 'select', true, ['Super Admin', 'Director', 'Sales Manager', 'Sales Executive', 'Accounts', 'Project Manager', 'Developer', 'Designer']], ['department', 'Department', 'text', true], ['status', 'Status', 'select', true, ['Active', 'Inactive']]] },
  notifications: { title: 'Notifications', description: 'Your in-app updates across sales, finance, and delivery.', action: 'Mark all read', search: 'Search notifications…', statuses: ['Unread', 'Read'], columns: [['title', 'Notification'], ['body', 'Details'], ['category', 'Category'], ['date', 'Date'], ['read', 'State']], fields: [] },
}

const emptyValues = (config) => Object.fromEntries(config.fields.map(([key]) => [key, '']))
const statusKey = (value) => String(value || '').toLowerCase().replaceAll(' ', '-')

function getPayableInvoiceOptions(invoices, currentInvoiceId) {
  return invoices
    .filter((invoice) => invoice.id === currentInvoiceId
      ? !['Draft', 'Cancelled'].includes(invoice.status)
      : !['Draft', 'Cancelled', 'Paid'].includes(invoice.status))
    .map(({ id, client, clientId, project }) => ({ id, client, clientId, project }))
}

function displayValue(record, key, resource, payments) {
  const value = record[key]
  if (resource === 'invoices' && key === 'balance') return formatCurrency(Math.max(0, Number(record.total || 0) - getInvoicePaid(record.id, payments)))
  if (resource === 'invoices' && key === 'total') return formatCurrency(value)
  if (resource === 'payments' && key === 'amount') return formatCurrency(value)
  if (key.toLowerCase().includes('date') || ['followUp', 'since', 'createdAt', 'issueDate', 'validUntil'].includes(key)) return formatDate(value)
  if (key === 'amount' || key === 'total') return formatCurrency(value)
  if (key === 'progress') return `${Number(value || 0)}%`
  if (key === 'read') return value ? 'Read' : 'Unread'
  return value || '—'
}

export default function ResourceRecordsPage({ resource }) {
  const config = configs[resource]
  const api = apiFor[resource]
  const { notify } = useApp()
  const { user } = useAuth()
  const { hasPermission: can } = usePermissions()
  const navigate = useNavigate()
  const [records, setRecords] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All statuses')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)
  const [sort, setSort] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [form, setForm] = useState({})
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [invoiceOptions, setInvoiceOptions] = useState([])
  const [taskProjectOptions, setTaskProjectOptions] = useState([])
  const [assigneeOptions, setAssigneeOptions] = useState([])
  const [invoiceItems, setInvoiceItems] = useState([])
  const [revising, setRevising] = useState(null)
  const [revisionReason, setRevisionReason] = useState('')

  const load = useCallback(async () => {
    try {
      const result = await api.list()
      setRecords(scopeResourceRecords(resource, result, user))
      if (resource === 'invoices') setPayments(await apiFor.payments.list())
    } catch (error) { notify(error.message || 'Could not load records.', 'error') }
    finally { setLoading(false) }
  }, [api, notify, resource, user])
  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim()
    let result = records.filter((row) => (!term || Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(term)))
      && (status === 'All statuses' || (resource === 'notifications' ? (row.read ? 'Read' : 'Unread') === status : row.status === status))
      && (!unreadOnly || row.read === false))
    if (sort) result = result.slice().sort((a, b) => String(a[sort] || '').localeCompare(String(b[sort] || ''), undefined, { numeric: true }))
    return result
  }, [records, search, status, sort, unreadOnly, resource])
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const shown = filtered.slice((page - 1) * pageSize, page * pageSize)
  const invoiceHasLineDetails = resource === 'invoices' && invoiceItems.some((item) =>
    String(item.description ?? '').trim() || String(item.quantity ?? '').trim() || String(item.rate ?? '').trim())
  const invoiceLineComplete = invoiceHasLineDetails
    && invoiceItems.length > 0
    && invoiceItems.every((item) => String(item.description ?? '').trim() && item.quantity !== '' && item.rate !== '')
  const calculatedInvoiceTotal = Math.max(0, invoiceItems.reduce((sum, item) =>
    sum + Number(item.quantity || 0) * Number(item.rate || 0), 0) - Number(form.discount || 0) + Number(form.tax || 0))

  async function loadTaskProjectOptions() {
    const projects = await apiFor.projects.list()
    const visibleProjects = scopeResourceRecords('projects', projects, user)
    setTaskProjectOptions(visibleProjects)
    return visibleProjects
  }

  async function openCreate() {
    const createPermission = {
      leads: 'leads.create', followups: 'followups.create', clients: 'clients.manage', quotations: 'quotations.create',
      agreements: 'agreements.approve', invoices: 'invoices.manage', payments: 'payments.manage', projects: 'projects.manage',
      tasks: 'tasks.create',
    }[resource]
    if (!createPermission || !can(createPermission)) { notify('Your role cannot create this record.', 'error'); return }
    if (isBackendMode && ['leads', 'followups', 'projects', 'tasks'].includes(resource)) {
      try {
        const assignPermission = {
          leads: 'leads.assign',
          followups: 'followups.create',
          projects: 'projects.manage',
          tasks: 'tasks.create',
        }[resource]
        const canAssign = can(assignPermission)
        setAssigneeOptions(canAssign
          ? await apiFor.users.listAssignees()
          : [{ id: user.id, name: user.name }])
      } catch (error) {
        notify(error.message || 'Could not load active team members.', 'error')
        return
      }
    }
    if (resource === 'notifications') {
      apiFor.notifications.markAllRead()
        .then(() => { notify('All notifications marked as read.'); load() })
        .catch((error) => notify(error.message, 'error'))
      return
    }
    if (resource === 'payments') {
      try {
        const invoices = await apiFor.invoices.list()
        setInvoiceOptions(getPayableInvoiceOptions(invoices))
      } catch (error) {
        notify(error.message || 'Could not load invoices.', 'error')
        return
      }
    }
    if (resource === 'tasks') {
      try { await loadTaskProjectOptions() }
      catch (error) { notify(error.message || 'Could not load assigned projects.', 'error'); return }
    }
    if (resource === 'invoices') setInvoiceItems([{ description: '', quantity: '', rate: '' }])
    setEditing(null); setForm(emptyValues(config)); setErrors({}); setModal(true)
  }
  async function openEdit(record) {
    if (!canManageResource(user, resource)
      || (resource === 'tasks' && !can('tasks.update') && !can('tasks.update.assigned'))
      || !canAccessRecord(resource, record, user)) { notify('Your role cannot edit this record.', 'error'); return }
    if (resource === 'payments') {
      try {
        const invoices = await apiFor.invoices.list()
        setInvoiceOptions(getPayableInvoiceOptions(invoices, record.invoiceId))
      } catch (error) {
        notify(error.message || 'Could not load invoices.', 'error')
        return
      }
    }
    if (isBackendMode && ['leads', 'followups', 'projects', 'tasks'].includes(resource)) {
      const assignPermission = {
        leads: 'leads.assign',
        followups: 'followups.create',
        projects: 'projects.manage',
        tasks: 'tasks.create',
      }[resource]
      try {
        setAssigneeOptions(can(assignPermission)
          ? await apiFor.users.listAssignees()
          : [{ id: user.id, name: user.name }])
      } catch (error) {
        notify(error.message || 'Could not load active team members.', 'error')
        return
      }
    }
    if (resource === 'tasks') {
      try { await loadTaskProjectOptions() }
      catch (error) { notify(error.message || 'Could not load assigned projects.', 'error'); return }
    }
    setEditing(record)
    if (resource === 'invoices') {
      setInvoiceItems((record.lineItems || (record.description ? [record] : [])).map((item) => ({
        description: item.description || '',
        quantity: item.quantity ?? '',
        rate: item.rate ?? '',
      })))
    }
    setForm(Object.fromEntries(config.fields.map(([key]) => [key, record[key] ?? ''])))
    setErrors({}); setModal(true)
  }
  async function saveRecord(event) {
    event.preventDefault()
    const updatePermission = {
      leads: 'leads.update', followups: 'followups.update', clients: 'clients.manage', quotations: 'quotations.create',
      agreements: 'agreements.approve', invoices: 'invoices.manage', payments: 'payments.manage', projects: 'projects.manage',
      tasks: 'tasks.update',
    }[resource]
    const allowedToUpdate = resource === 'tasks'
      ? can('tasks.update') || can('tasks.update.assigned')
      : Boolean(updatePermission && can(updatePermission))
    if (!allowedToUpdate) { notify('Your role cannot save changes to this record.', 'error'); return }
    if (editing && !canAccessRecord(resource, editing, user)) { notify('You cannot modify a record outside your assignment.', 'error'); return }
    const nextErrors = {}
    for (const [key, label, type, required] of config.fields) {
      const value = form[key]
      if (required && !String(value ?? '').trim() && !(resource === 'invoices' && key === 'total' && invoiceLineComplete)) nextErrors[key] = `${label} is required.`
      else if (type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) nextErrors[key] = 'Enter a valid email address.'
      else if (type === 'tel' && value && !/^[+\d][\d\s()-]{7,}$/.test(value)) nextErrors[key] = 'Enter a valid phone number.'
      else if (type === 'number' && value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0)) nextErrors[key] = 'Enter a valid non-negative number.'
    }
    if (resource === 'invoices' && (invoiceHasLineDetails || form.discount !== '' || form.tax !== '') && !invoiceLineComplete) {
      nextErrors.lineItems = 'Complete every line item, including description, quantity, and rate, or remove its details.'
    }
    if (resource === 'invoices' && invoiceLineComplete && invoiceItems.some((item) =>
      !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0 || !Number.isFinite(Number(item.rate)) || Number(item.rate) < 0)) {
      nextErrors.lineItems = 'Quantity must be greater than zero and rate must be a valid non-negative amount.'
    }
    if (resource === 'tasks' && !taskProjectOptions.some((project) => project.name === form.project)) {
      nextErrors.project = 'Select a project assigned to your role.'
    }
    if (resource === 'leads' && !editing && records.some((row) => row.email?.toLowerCase() === form.email?.toLowerCase() || row.phone === form.phone)) {
      nextErrors.email = 'A lead with this email or phone already exists.'
    }
    if (resource === 'payments') {
      const invoice = (await apiFor.invoices.list()).find((item) => item.id === form.invoiceId)
      if (!invoice) nextErrors.invoiceId = 'Select a valid invoice.'
      else {
        const current = editing ? payments.find((payment) => payment.id === editing.id) : null
        const remaining = Math.max(0, invoice.total - getInvoicePaid(invoice.id, payments) + (current?.invoiceId === invoice.id ? Number(current.amount || 0) : 0))
        if (Number(form.amount) > remaining) nextErrors.amount = 'Payment exceeds the remaining invoice balance.'
      }
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setSaving(true)
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key,
        ['budget', 'amount', 'total', 'version', 'progress', 'quantity', 'rate', 'discount', 'tax'].includes(key) && value !== '' ? Number(value) : value]))
      if (resource === 'invoices' && invoiceLineComplete) {
        const lineItems = invoiceItems.map((item) => {
          const quantity = Number(item.quantity)
          const rate = Number(item.rate)
          return { description: String(item.description).trim(), quantity, rate, amount: quantity * rate }
        })
        const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0)
        const discount = Number(form.discount) || 0
        const tax = Number(form.tax) || 0
        payload.lineItems = lineItems
        payload.subtotal = subtotal
        payload.discount = discount
        payload.tax = tax
        payload.total = Math.max(0, subtotal - discount + tax)
      }
      if (resource === 'leads' && !editing) {
        payload.createdAt = new Date().toISOString().slice(0, 10)
        payload.status = 'New'
      }
      if (resource === 'leads' && !can('leads.assign')) payload.assignee = editing?.assignee || user.name
      if (resource === 'quotations' && !can('quotations.view')) payload.owner = user.name
      if (resource === 'tasks') payload.projectId = taskProjectOptions.find((project) => project.name === payload.project)?.id
      if (resource === 'payments' && !editing) {
        const invoice = (await apiFor.invoices.list()).find((item) => item.id === payload.invoiceId)
        payload.client = invoice?.client || payload.client
        payload.clientId = invoice?.clientId || payload.clientId
        payload.project = invoice?.project || payload.project
        payload.status = 'Recorded'
        payload.recordedBy = 'Priya Sharma'
      }
      const savedRecord = editing ? await api.update(editing.id, payload) : await api.create(payload)
      if (resource === 'payments' && !isBackendMode) {
        const invoice = (await apiFor.invoices.list()).find((item) => item.id === payload.invoiceId)
        if (invoice) {
          const paid = getInvoicePaid(invoice.id, await apiFor.payments.list())
          await apiFor.invoices.update(invoice.id, { status: paid >= invoice.total ? 'Paid' : 'Partially Paid' })
        }
      }
      if (resource === 'tasks' && can('projects.manage')) await syncProjectProgress(payload.project)
      if (!isBackendMode && resource === 'leads' && payload.status === 'Won') {
        const clients = await apiFor.clients.list()
        if (!clients.some((client) => client.leadId === savedRecord.id)) {
          await apiFor.clients.create({ name: payload.name, company: payload.company, email: payload.email, phone: payload.phone, status: 'Active', leadId: savedRecord.id, since: new Date().toISOString().slice(0, 10) })
        }
      }
      if (resource === 'notifications') setUnreadOnly(false)
      setModal(false); notify(editing ? 'Record updated.' : `${config.title.slice(0, -1)} added.`); await load()
    } catch (error) { notify(error.message || 'Could not save this record.', 'error') }
    finally { setSaving(false) }
  }
  async function updateStatus(record, nextStatus) {
    const updatePermission = {
      leads: 'leads.update', followups: 'followups.update', quotations: 'quotations.approve', agreements: 'agreements.approve',
      invoices: 'invoices.manage', payments: 'payments.manage', projects: 'projects.manage', tasks: 'tasks.update',
      notifications: 'notifications.view',
    }[resource]
    const permitted = resource === 'tasks' && user?.role === 'developer'
      ? can('tasks.update.assigned') && canAccessRecord(resource, record, user)
      : Boolean(updatePermission && can(updatePermission) && canAccessRecord(resource, record, user))
    if (!permitted) { notify('Your role cannot change this record’s status.', 'error'); return }
    try {
      if (isBackendMode && resource === 'leads' && nextStatus === 'Won') {
        await apiFor.leads.convert(record.id)
      } else if (isBackendMode && resource === 'quotations') {
        if (nextStatus === 'Sent') await apiFor.quotations.send(record.id)
        else if (nextStatus === 'Accepted') await apiFor.quotations.approve(record.id)
        else if (nextStatus === 'Rejected') await apiFor.quotations.reject(record.id)
        else throw new Error('This quotation status can only be changed through its supported workflow.')
      } else if (isBackendMode && resource === 'agreements') {
        if (nextStatus === 'Pending approval') await apiFor.agreements.submit(record.id)
        else if (nextStatus === 'Accepted') await apiFor.agreements.accept(record.id)
        else throw new Error('This work order status can only be changed through its supported workflow.')
      } else if (isBackendMode && resource === 'invoices') {
        if (nextStatus !== 'Issued') throw new Error('Invoice payment status is managed by the payment workflow.')
        await apiFor.invoices.issue(record.id)
      } else if (isBackendMode && resource === 'payments') {
        if (nextStatus !== 'Refunded') throw new Error('Recorded payments can only be changed through the refund workflow.')
        const reason = window.prompt('Reason for refund:')
        if (!reason?.trim()) return
        await apiFor.payments.refund(record.id, reason.trim())
      } else if (resource === 'leads' && nextStatus === 'Won') {
        const clients = await apiFor.clients.list()
        if (!clients.some((client) => client.leadId === record.id)) {
          await apiFor.clients.create({ name: record.name, company: record.company, email: record.email, phone: record.phone, status: 'Active', leadId: record.id, since: new Date().toISOString().slice(0, 10) })
        }
        await api.update(record.id, { status: nextStatus })
      } else {
        await api.update(record.id, resource === 'notifications' ? { read: nextStatus === 'Read' } : { status: nextStatus })
      }
      if (resource === 'tasks' && can('projects.manage')) await syncProjectProgress(record.project)
      notify(resource === 'notifications' ? 'Notification state updated.' : resource === 'leads' && nextStatus === 'Won' ? 'Lead converted and linked to a client.' : 'Status updated.')
      await load()
    } catch (error) { notify(error.message, 'error') }
  }
  async function syncProjectProgress(projectName) {
    if (!projectName) return
    const [tasks, projects] = await Promise.all([apiFor.tasks.list(), apiFor.projects.list()])
    const project = projects.find((item) => item.name === projectName)
    const related = tasks.filter((task) => task.project === projectName)
    if (project && related.length) {
      const progress = Math.round(related.filter((task) => task.status === 'Completed').length / related.length * 100)
      await apiFor.projects.update(project.id, { progress })
    }
  }
  async function createRevision(event) {
    event.preventDefault()
    if (!revisionReason.trim()) { notify('Add a brief reason for this quotation revision.', 'error'); return }
    try {
      const revision = await apiFor.quotations.revise(revising.id, revisionReason.trim())
      setRevising(null); setRevisionReason(''); notify(`Revision ${revision.version} created; prior quotation preserved.`); await load()
    } catch (error) { notify(error.message || 'Could not create quotation revision.', 'error') }
  }
  async function deleteRecord() {
    const permission = resource === 'leads' ? 'leads.delete' : resource === 'tasks' ? 'tasks.delete' : resource === 'followups' ? 'followups.delete' : null
    if (!permission || !can(permission) || !canAccessRecord(resource, deleting, user)) { notify('Your role cannot delete this record.', 'error'); return }
    try { await api.remove(deleting.id); setDeleting(null); notify('Record deleted.'); await load() }
    catch (error) { notify(error.message, 'error') }
  }
  function exportCsv() {
    const headers = config.columns.map(([, label]) => label)
    const lines = [headers, ...filtered.map((row) => config.columns.map(([key]) => displayValue(row, key, resource, payments)))]
    const csv = lines.map((line) => line.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    link.download = `${resource}-demo-export.csv`; link.click(); URL.revokeObjectURL(link.href)
    notify('CSV export downloaded.')
  }

  const supportsPrintList = ['quotations', 'invoices', 'agreements'].includes(resource)
  const summary = config.summary ? config.summary.map((item) => ({
    label: item === 'Total leads' ? item : `${item} leads`,
    value: item === 'Total leads' ? records.length : records.filter((record) => record.status === item).length,
  })) : []
  const invoiceFinancialFields = ['discount', 'tax', 'total', 'status']
  const formFields = resource === 'invoices'
    ? config.fields.filter(([key]) => !invoiceFinancialFields.includes(key))
    : config.fields
  const invoiceTotalsFields = resource === 'invoices'
    ? config.fields.filter(([key]) => invoiceFinancialFields.includes(key))
    : []

  return <div className={`page${resource === 'followups' ? ' followups-page' : ''}${supportsPrintList ? ' resource-print-page' : ''}`}>
    <PageHeader title={config.title} description={config.description} actions={<>
      <Button variant="secondary" onClick={exportCsv}><Download size={16} /> Export</Button>
      {supportsPrintList && <Button className="no-print" variant="secondary" disabled={loading || filtered.length === 0} onClick={() => window.print()}><Printer size={16} /> Print list</Button>}
      {resource === 'followups' && <Button className="no-print" variant="secondary" disabled={loading || filtered.length === 0} onClick={() => window.print()}><Printer size={16} /> Print filtered list</Button>}
      {({
        leads: can('leads.create'), followups: can('followups.create'), clients: can('clients.manage'), quotations: can('quotations.create'),
        agreements: can('agreements.approve'), invoices: can('invoices.manage'), payments: can('payments.manage'),
        projects: can('projects.manage'), tasks: can('tasks.create'),
      }[resource]) && <Button onClick={openCreate}><Plus size={17} /> {config.action}</Button>}
    </>} />
    {summary.length > 0 && <div className="mini-stats">{summary.map((item) => <div key={item.label}><small>{item.label}</small><strong>{item.value}</strong></div>)}</div>}
    <section className="panel records-panel">
      <div className="table-toolbar"><div className="table-search"><Search size={16} /><input placeholder={config.search} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></div>
        <div className="table-filters">
          {resource === 'notifications' && <button className={`filter-chip ${unreadOnly ? 'filter-chip-active' : ''}`} onClick={() => { setUnreadOnly(!unreadOnly); setPage(1) }}>Unread only</button>}
          {config.statuses?.length > 0 && <select aria-label="Filter by status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option>All statuses</option>{config.statuses.map((value) => <option key={value}>{value}</option>)}</select>}
          <select aria-label="Sort records" value={sort} onChange={(event) => setSort(event.target.value)}><option value="">Sort: default</option>{config.columns.filter(([key]) => key !== 'status').slice(0, 6).map(([key, label]) => <option value={key} key={key}>By {label}</option>)}</select>
        </div></div>
      {loading ? <div className="loading-inline"><span className="spinner" />Loading records…</div> : filtered.length === 0
        ? <EmptyState title={search || status !== 'All statuses' ? 'No matching records' : `No ${config.title.toLowerCase()} yet`} description="Try clearing your search or create a new record to get started." />
        : <><div className="table-scroll"><table className="data-table"><thead><tr>{config.columns.map(([key, label]) => <th key={key}>{label}</th>)}<th className="actions-cell">Actions</th></tr></thead>
          <tbody>{shown.map((record) => <tr key={record.id} className={resource === 'notifications' && !record.read ? 'unread-row' : ''}>
            {config.columns.map(([key]) => <td key={key}>{key === 'status' && can({
              leads: 'leads.update', followups: 'followups.update', clients: 'clients.manage', quotations: 'quotations.approve',
              agreements: 'agreements.approve', invoices: 'invoices.manage', payments: 'payments.manage',
              projects: 'projects.manage', tasks: user?.role === 'developer' ? 'tasks.update.assigned' : 'tasks.update',
              notifications: 'notifications.view',
            }[resource]) ? <select className={`status-select status-${statusKey(record[key])}`} aria-label={`Change status for ${record.id}`} value={record[key] || ''} onChange={(event) => updateStatus(record, event.target.value)}>{config.statuses.map((value) => <option key={value}>{value}</option>)}</select>
              : key === 'status' ? <span className={`badge badge-${statusKey(record[key])}`}>{record[key]}</span>
              : key === 'read' ? <button className={`read-state ${record.read ? '' : 'is-unread'}`} onClick={() => updateStatus(record, record.read ? 'Unread' : 'Read')}>{record.read ? 'Read' : 'Unread'}</button>
              : key === 'name' || key === 'title' ? <strong className="table-primary">{record[key]}</strong>
              : key === 'priority' ? <Badge>{record[key]}</Badge>
              : <span className={key === 'id' ? 'id-text' : ''}>{displayValue(record, key, resource, payments)}</span>}</td>)}
            <td className="actions-cell"><div className="row-actions"><button title="View details" aria-label={`View ${record.id}`} onClick={() => navigate(`/${resource}/${record.id}`)}><Eye size={16} /></button>
              {resource === 'quotations' && can('quotations.create') && <button title="Create revision" aria-label={`Revise ${record.id}`} onClick={() => { setRevising(record); setRevisionReason('') }}><GitBranch size={16} /></button>}
              {canManageResource(user, resource) && (resource !== 'tasks' || can('tasks.update')) && <button title="Edit" aria-label={`Edit ${record.id}`} onClick={() => openEdit(record)}><Pencil size={16} /></button>}
              {can(resource === 'leads' ? 'leads.delete' : resource === 'tasks' ? 'tasks.delete' : resource === 'followups' ? 'followups.delete' : '') && <button title="Delete" aria-label={`Delete ${record.id}`} className="danger-action" onClick={() => setDeleting(record)}><Trash2 size={16} /></button>}</div></td>
          </tr>)}</tbody></table></div>
          <div className="table-footer"><span>Showing <b>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)}</b> of <b>{filtered.length}</b> records</span>
            <div className="pagination"><select aria-label="Rows per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }}><option value={8}>8 / page</option><option value={15}>15 / page</option><option value={25}>25 / page</option></select>
              <button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button><span>{page} / {pageCount}</span><button aria-label="Next page" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>›</button></div></div></>}
    </section>
    {resource === 'followups' && <section className="print-only filtered-followups-print">
      <header className="print-document-header"><div className="brand-mark">D</div><div><strong>Design Blocks</strong><span>Follow-up list</span></div></header>
      <h1>Follow-ups</h1>
      <table className="print-invoice-table"><thead><tr><th>Contact</th><th>Company</th><th>Lead</th><th>Scheduled</th><th>Type</th><th>Status</th><th>Assigned to</th><th>Notes</th></tr></thead>
        <tbody>{filtered.map((item) => <tr key={item.id}><td>{item.contact || '—'}</td><td>{item.company || '—'}</td><td>{item.leadId || '—'}</td><td>{formatDate(item.dueDate)}</td><td>{item.type || '—'}</td><td>{item.status || '—'}</td><td>{item.assignee || '—'}</td><td>{item.notes || '—'}</td></tr>)}</tbody>
      </table>
    </section>}
    {supportsPrintList && <section className="print-only resource-list-print">
      <header className="print-document-header"><div className="brand-mark">D</div><div><strong>Design Blocks</strong><span>CRM &amp; Project Management</span></div></header>
      <h1>{config.title}</h1>
      <p>Printed {formatDate(new Date().toISOString().slice(0, 10))}</p>
      <table className="print-invoice-table"><thead><tr>{config.columns.map(([, label]) => <th key={label}>{label}</th>)}</tr></thead>
        <tbody>{filtered.map((record) => <tr key={record.id}>{config.columns.map(([key]) => <td key={key}>{displayValue(record, key, resource, payments)}</td>)}</tr>)}</tbody>
      </table>
    </section>}
    {modal && <Modal title={editing ? `Edit ${config.title.slice(0, -1).toLowerCase()}` : config.action} description={isBackendMode ? 'Changes are validated and saved by the CRM server.' : 'Changes are saved to this browser’s demo workspace.'} onClose={() => setModal(false)} wide={config.fields.length > 7}>
      <form className="record-form" onSubmit={saveRecord} noValidate>
        <div className="form-grid">{formFields.map(([key, label, type, required, options]) => <label key={key} className={`form-field ${type === 'textarea' ? 'field-full' : ''}`}>
          <span>{label}{required && <b> *</b>}</span>
          {type === 'textarea' ? <textarea rows="3" value={form[key] || ''} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
            : type === 'select' ? <select value={form[key] || ''} onChange={(event) => {
              const value = event.target.value
              const invoice = key === 'invoiceId' ? invoiceOptions.find((item) => item.id === value) : null
            const project = resource === 'tasks' && key === 'project' ? taskProjectOptions.find((item) => item.name === value) : null
            setForm({ ...form, [key]: value, ...(invoice ? { client: invoice.client, clientId: invoice.clientId || '', project: invoice.project } : {}), ...(project ? { projectId: project.id } : {}) })
            }}><option value="">Select…</option>{(key === 'invoiceId'
              ? invoiceOptions.map(({ id, client }) => [id, client ? `${id} — ${client}` : id])
              : resource === 'tasks' && key === 'project'
                ? taskProjectOptions.map((project) => [project.name, project.name])
                : isBackendMode && ['assignee', 'manager'].includes(key)
                  ? assigneeOptions.map((person) => [person.name, person.name])
                  : (options || []).map((value) => [value, value]))
              .map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              : <input type={type} min={type === 'number' ? '0' : undefined} step={type === 'number' ? (key === 'quantity' ? 'any' : ['rate', 'discount', 'tax'].includes(key) ? '0.01' : '1') : undefined} readOnly={resource === 'invoices' && key === 'total' && Boolean(invoiceLineComplete)} value={resource === 'invoices' && key === 'total' && invoiceLineComplete ? calculatedInvoiceTotal : form[key] ?? ''} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />}
          {errors[key] && <small className="field-error">{errors[key]}</small>}
        </label>)}</div>
        {resource === 'invoices' && <section className="invoice-line-editor">
          <div className="invoice-line-editor-heading"><div><strong>Line items</strong><small>Invoice totals are calculated from quantity × rate.</small></div>
            <Button type="button" variant="secondary" onClick={() => setInvoiceItems((items) => [...items, { description: '', quantity: '', rate: '' }])}><Plus size={15} /> Add line</Button>
          </div>
          {invoiceItems.map((item, index) => <div className="invoice-line-form-row" key={index}>
            <label className="form-field"><span>Description</span><input value={item.description} onChange={(event) => setInvoiceItems((items) => items.map((current, itemIndex) => itemIndex === index ? { ...current, description: event.target.value } : current))} /></label>
            <label className="form-field"><span>Quantity</span><input aria-label={`Quantity for line ${index + 1}`} type="number" min="0" step="any" value={item.quantity} onChange={(event) => setInvoiceItems((items) => items.map((current, itemIndex) => itemIndex === index ? { ...current, quantity: event.target.value } : current))} /></label>
            <label className="form-field"><span>Rate (₹)</span><input aria-label={`Rate for line ${index + 1}`} type="number" min="0" step="0.01" value={item.rate} onChange={(event) => setInvoiceItems((items) => items.map((current, itemIndex) => itemIndex === index ? { ...current, rate: event.target.value } : current))} /></label>
            <div className="invoice-line-amount"><span>Amount</span><strong>{formatCurrency(Number(item.quantity || 0) * Number(item.rate || 0))}</strong></div>
            <button type="button" className="icon-button invoice-line-remove" aria-label={`Remove line item ${index + 1}`} onClick={() => setInvoiceItems((items) => items.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={16} /></button>
          </div>)}
          {errors.lineItems && <small className="field-error">{errors.lineItems}</small>}
          <div className="invoice-line-subtotal"><span>Calculated invoice total</span><strong>{formatCurrency(calculatedInvoiceTotal)}</strong></div>
        </section>}
        {resource === 'invoices' && <div className="form-grid">{invoiceTotalsFields.map(([key, label, type, required, options]) => <label key={key} className={`form-field ${type === 'textarea' ? 'field-full' : ''}`}>
          <span>{label}{required && <b> *</b>}</span>
          {type === 'select' ? <select value={form[key] || ''} onChange={(event) => setForm({ ...form, [key]: event.target.value })}><option value="">Select…</option>{(options || []).map((value) => <option key={value}>{value}</option>)}</select>
            : <input type={type} min={type === 'number' ? '0' : undefined} step={type === 'number' ? (['discount', 'tax'].includes(key) ? '0.01' : '1') : undefined} readOnly={key === 'total' && Boolean(invoiceLineComplete)} value={key === 'total' && invoiceLineComplete ? calculatedInvoiceTotal : form[key] ?? ''} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />}
          {errors[key] && <small className="field-error">{errors[key]}</small>}
        </label>)}</div>}
        {resource === 'payments' && <p className="form-note">Internal payment record only. No bank or payment provider verification is performed.</p>}
        {resource === 'invoices' && <p className="form-note">Enter a description, quantity, and rate to calculate the total automatically. Discount and tax are monetary amounts. Existing invoice totals are preserved when line-item details are unavailable. Prototype invoice only; verify legal and tax compliance before production use.</p>}
        <div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setModal(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : config.action}</Button></div>
      </form>
    </Modal>}
    {deleting && <Modal title="Delete this record?" description={`${deleting.id} will be removed from ${isBackendMode ? 'the CRM database' : 'this demo workspace'}.`} onClose={() => setDeleting(null)}>
      <div className="confirm-actions"><Button variant="secondary" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="danger" onClick={deleteRecord}>Delete record</Button></div>
    </Modal>}
    {revising && <Modal title={`Revise quotation ${revising.id}`} description="A new draft version is created; the previous version and its approval status remain unchanged." onClose={() => setRevising(null)}>
      <form className="record-form" onSubmit={createRevision}><label className="form-field"><span>Reason for revision *</span><textarea rows="3" value={revisionReason} onChange={(event) => setRevisionReason(event.target.value)} placeholder="Describe what changed in this version…" /></label>
        <div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setRevising(null)}>Cancel</Button><Button type="submit"><GitBranch size={15} /> Create new version</Button></div></form>
    </Modal>}
  </div>
}
