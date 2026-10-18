import { apiClient, isBackendMode } from './apiClient'
import { filterRecordsForUser } from '../services/permissionsService'

export const scopeResourceRecords = (resource, records, user) =>
  isBackendMode ? records : filterRecordsForUser(resource, records, user)

export async function listAllResources(resource) {
  const firstPage = await apiClient.get(resource, { page: 1, limit: 100 })
  if (!isBackendMode) return firstPage.data

  const pages = firstPage.meta?.pages || 1
  if (pages <= 1) return firstPage.data

  const remainingPages = await Promise.all(
    Array.from({ length: pages - 1 }, (_, index) =>
      apiClient.get(resource, { page: index + 2, limit: 100 })),
  )
  return [firstPage, ...remainingPages].flatMap((page) => page.data)
}

export const resourceApi = (resource) => ({
  list: () => listAllResources(resource),
  get: async (id) => (await apiClient.get(resource, { id })).data,
  create: async (payload) => (await apiClient.post(resource, payload)).data,
  update: async (id, payload) => (await apiClient.patch(resource, id, payload)).data,
  remove: async (id) => (await apiClient.delete(resource, id)).data,
})

export const leadsApi = {
  ...resourceApi('leads'),
  convert: async (id) => {
    if (isBackendMode) return (await apiClient.action('leads', id, 'convert')).data
    const lead = await resourceApi('leads').get(id)
    const clients = await resourceApi('clients').list()
    const client = clients.find((entry) => entry.leadId === id)
      || await resourceApi('clients').create({
        name: lead.name,
        company: lead.company,
        email: lead.email,
        phone: lead.phone,
        status: 'Active',
        leadId: lead.id,
        since: new Date().toISOString().slice(0, 10),
      })
    await resourceApi('leads').update(id, { status: 'Won' })
    return { client, created: !clients.some((entry) => entry.leadId === id) }
  },
  addActivity: async (id, activity) => {
    if (isBackendMode) {
      return (await apiClient.endpoint(`/leads/${encodeURIComponent(id)}/activities`, 'POST', activity)).data
    }
    const lead = await resourceApi('leads').get(id)
    const savedActivity = {
      ...activity,
      id: `ACT-${Date.now()}`,
      by: activity.by || 'Demo user',
      createdAt: new Date().toISOString(),
    }
    await resourceApi('leads').update(id, {
      activities: [...(lead.activities || []), savedActivity],
    })
    return savedActivity
  },
  search: async (query) => (await resourceApi('leads').list()).filter((lead) =>
    JSON.stringify(lead).toLowerCase().includes(String(query).toLowerCase())),
  assign: async (id, assignee) => (await apiClient.patch('leads', id, { assignee })).data,
  updateStatus: async (id, status) => (await apiClient.patch('leads', id, { status })).data,
}

export const followupsApi = resourceApi('followups')
export const clientsApi = resourceApi('clients')
export const quotationsApi = {
  ...resourceApi('quotations'),
  send: async (id) => isBackendMode
    ? (await apiClient.action('quotations', id, 'send')).data
    : (await apiClient.patch('quotations', id, { status: 'Sent', sentAt: new Date().toISOString() })).data,
  approve: async (id) => isBackendMode
    ? (await apiClient.action('quotations', id, 'approve')).data
    : (await apiClient.patch('quotations', id, { status: 'Accepted', acceptedAt: new Date().toISOString() })).data,
  reject: async (id) => isBackendMode
    ? (await apiClient.action('quotations', id, 'reject')).data
    : (await apiClient.patch('quotations', id, { status: 'Rejected' })).data,
  revise: async (id, reason) => {
    if (isBackendMode) return (await apiClient.action('quotations', id, 'revise', { reason })).data
    const previous = await apiClient.get('quotations', { id })
    const revised = await apiClient.post('quotations', {
      ...previous.data, id: undefined, version: Number(previous.data.version || 1) + 1,
      status: 'Draft', revisionOf: id, revisionReason: reason, revisionDate: new Date().toISOString(),
    })
    return revised.data
  },
}
export const agreementsApi = {
  ...resourceApi('agreements'),
  submit: async (id) => isBackendMode
    ? (await apiClient.action('agreements', id, 'submit')).data
    : (await apiClient.patch('agreements', id, { status: 'Pending approval' })).data,
  accept: async (id) => isBackendMode
    ? (await apiClient.action('agreements', id, 'accept')).data
    : (await apiClient.patch('agreements', id, { status: 'Accepted' })).data,
  reject: async (id, reason) => isBackendMode
    ? (await apiClient.action('agreements', id, 'reject', { reason })).data
    : (await apiClient.patch('agreements', id, { status: 'Rejected' })).data,
}
export const invoicesApi = {
  ...resourceApi('invoices'),
  issue: async (id) => isBackendMode
    ? (await apiClient.action('invoices', id, 'issue')).data
    : (await apiClient.patch('invoices', id, { status: 'Issued' })).data,
}
export const paymentsApi = {
  ...resourceApi('payments'),
  refund: async (id, reason) => isBackendMode
    ? (await apiClient.action('payments', id, 'refund', { reason })).data
    : (await apiClient.patch('payments', id, { status: 'Refunded', refundReason: reason })).data,
}
export const projectsApi = resourceApi('projects')
projectsApi.fromAgreement = async (agreementId) => {
  if (isBackendMode) {
    return (await apiClient.endpoint(`/projects/from-agreement/${encodeURIComponent(agreementId)}`, 'POST')).data
  }
  const agreement = (await apiClient.get('agreements', { id: agreementId })).data
  return projectsApi.create({
    name: agreement.project,
    clientId: agreement.clientId,
    client: agreement.client,
    quotationId: agreement.quotationId,
    agreementId: agreement.id,
    startDate: agreement.startDate,
    deadline: agreement.deadline,
    scope: agreement.scope,
    status: 'Planning',
  })
}
export const tasksApi = {
  ...resourceApi('tasks'),
  addComment: async (id, text) => (await apiClient.action('tasks', id, 'comments', { text })).data,
}
export const usersApi = resourceApi('users')
usersApi.listAssignees = async () => (await apiClient.endpoint('/users/assignees', 'GET')).data
export const notificationsApi = resourceApi('notifications')
notificationsApi.markAllRead = async () => (await apiClient.post('notifications', { __action: 'read-all' })).data
export const reportsApi = {
  getSummary: async () => {
    if (isBackendMode) return (await apiClient.get('reports')).data
    const [leads, quotations, invoices, payments, projects, tasks] = await Promise.all([
      apiFor.leads.list(), apiFor.quotations.list(), apiFor.invoices.list(),
      apiFor.payments.list(), apiFor.projects.list(), apiFor.tasks.list(),
    ])
    return { leads, quotations, invoices, payments, projects, tasks }
  },
}

export const apiFor = {
  leads: leadsApi, followups: followupsApi, clients: clientsApi, quotations: quotationsApi,
  agreements: agreementsApi, invoices: invoicesApi, payments: paymentsApi,
  projects: projectsApi, tasks: tasksApi, users: usersApi, notifications: notificationsApi,
}
