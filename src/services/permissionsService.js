import { ROLE_PERMISSIONS, ROUTE_PERMISSIONS } from '../config/permissions'
import { ROLE_CONFIG, ROLES } from '../config/roles'

export function hasPermission(user, permission) {
  if (Array.isArray(user?.permissions)) return user.permissions.includes(permission)
  return Boolean(user && ROLE_PERMISSIONS[user.role]?.includes(permission))
}

export function hasAnyPermission(user, permissions = []) {
  const required = typeof permissions === 'string'
    ? [permissions]
    : Array.isArray(permissions) ? permissions : []
  return required.some((permission) => hasPermission(user, permission))
}

export function hasAllPermissions(user, permissions = []) {
  const required = typeof permissions === 'string'
    ? [permissions]
    : Array.isArray(permissions) ? permissions : []
  return required.every((permission) => hasPermission(user, permission))
}

export function canAccessRoute(user, pathname) {
  if (!user) return false
  const path = pathname === '/' ? '/dashboard' : pathname
  const exactRoute = Object.keys(ROUTE_PERMISSIONS).sort((a, b) => b.length - a.length)
    .find((route) => path === route || path.startsWith(`${route}/`))
  if (exactRoute) return hasAnyPermission(user, ROUTE_PERMISSIONS[exactRoute])
  const resource = path.split('/')[1]
  if (resource === 'leads') return hasAnyPermission(user, ['leads.view.all', 'leads.view.assigned'])
  if (resource === 'clients') return hasPermission(user, 'clients.view')
  if (resource === 'projects') return hasAnyPermission(user, ['projects.view', 'projects.view.assigned'])
  if (resource === 'tasks') return hasAnyPermission(user, ['tasks.view', 'tasks.view.assigned'])
  if (resource === 'invoices') return hasAnyPermission(user, ['invoices.view', 'invoices.view.own'])
  if (resource === 'quotations') return hasAnyPermission(user, ['quotations.view', 'quotations.view.own'])
  if (resource === 'agreements') return hasAnyPermission(user, ['agreements.view', 'agreements.view.own'])
  if (resource === 'payments') return hasAnyPermission(user, ['payments.view', 'payments.view.own'])
  if (resource === 'followups' || resource === 'follow-ups') return hasPermission(user, 'followups.view')
  return false
}

export function getHomeRoute(user) {
  if (!user) return '/login'
  const homeRoutes = {
    [ROLES.SUPER_ADMIN]: '/dashboard',
    [ROLES.DIRECTOR]: '/dashboard',
    [ROLES.SALES_MANAGER]: '/leads',
    [ROLES.SALES_EXECUTIVE]: '/leads',
    [ROLES.ACCOUNTS]: '/invoices',
    [ROLES.PROJECT_MANAGER]: '/projects',
    [ROLES.DEVELOPER]: '/tasks',
    [ROLES.CLIENT]: '/client-portal',
  }
  if (homeRoutes[user.role]) return homeRoutes[user.role]
  const routes = [
    ['/dashboard', ['dashboard.view']],
    ['/leads', ['leads.view.all', 'leads.view.assigned']],
    ['/follow-ups', ['followups.view']],
    ['/clients', ['clients.view']],
    ['/quotations', ['quotations.view', 'quotations.view.own']],
    ['/agreements', ['agreements.view', 'agreements.view.own']],
    ['/invoices', ['invoices.view', 'invoices.view.own']],
    ['/payments', ['payments.view', 'payments.view.own']],
    ['/projects', ['projects.view', 'projects.view.assigned']],
    ['/tasks', ['tasks.view', 'tasks.view.assigned']],
    ['/client-portal', ['clientPortal.view.own']],
    ['/reports', ['reports.view', 'reports.view.sales', 'reports.view.financial']],
    ['/users', ['users.view']],
    ['/notifications', ['notifications.view']],
    ['/settings', ['settings.manage']],
  ]
  return routes.find(([, permissions]) => hasAnyPermission(user, permissions))?.[0] || '/dashboard'
}

export function getRoleLabel(role, roleLabel) {
  return roleLabel || ROLE_CONFIG[role]?.label || role || 'Unknown role'
}

export function canAccessRecord(resource, record, user) {
  if (!record || !user) return false
  if (user.role === ROLES.CLIENT) {
    if (resource === 'clients') return record.id === user.clientId
    return record.clientId === user.clientId
  }
  if (resource === 'clients' && [ROLES.SALES_EXECUTIVE, ROLES.ACCOUNTS].includes(user.role)) {
    return user.assignedClientIds?.includes(record.id)
      || (user.role === ROLES.SALES_EXECUTIVE && user.assignedLeadIds?.includes(record.leadId))
      || record.name === user.name
  }
  if (hasPermission(user, `${resource}.view.all`) || hasPermission(user, `${resource}.view`)) return true
  if (resource === 'leads' && hasPermission(user, 'leads.view.assigned')) {
    return user.assignedLeadIds?.includes(record.id) || record.assignee === user.name
  }
  if (resource === 'projects' && hasPermission(user, 'projects.view.assigned')) {
    return user.assignedProjectIds?.includes(record.id) || record.manager === user.name
  }
  if (resource === 'tasks' && hasPermission(user, 'tasks.view.assigned')) {
    if (user.role === ROLES.PROJECT_MANAGER) {
      return user.assignedProjectIds?.includes(record.projectId)
        || user.assignedTaskIds?.includes(record.id)
        || record.assignee === user.name
    }
    return user.assignedTaskIds?.includes(record.id) || record.assignee === user.name
  }
  if (resource === 'quotations' && hasPermission(user, 'quotations.view.own')) {
    return record.owner === user.name || user.assignedLeadIds?.includes(record.leadId)
  }
  if (resource === 'agreements' && hasPermission(user, 'agreements.view.own')) return record.clientId === user.clientId
  if (resource === 'invoices' && hasPermission(user, 'invoices.view.own')) return record.clientId === user.clientId
  if (resource === 'payments' && hasPermission(user, 'payments.view.own')) return record.clientId === user.clientId
  if (resource === 'followups' && hasPermission(user, 'followups.view')) {
    return user.role === ROLES.SALES_MANAGER || user.assignedLeadIds?.includes(record.leadId) || record.assignee === user.name
  }
  if (resource === 'clients' && hasPermission(user, 'clients.view')) return true
  return false
}

export function filterRecordsForUser(resource, records, user) {
  if (!user) return []
  return records.filter((record) => canAccessRecord(resource, record, user))
}

export function canManageResource(user, resource) {
  const permissions = {
    leads: ['leads.create', 'leads.update', 'leads.delete', 'leads.assign'],
    followups: ['followups.create', 'followups.update', 'followups.delete'],
    clients: ['clients.manage'],
    quotations: ['quotations.create', 'quotations.approve'],
    agreements: ['agreements.approve'],
    invoices: ['invoices.manage'],
    payments: ['payments.manage'],
    projects: ['projects.manage'],
    tasks: ['tasks.create', 'tasks.update', 'tasks.delete', 'tasks.update.assigned'],
    users: ['users.manage'],
    notifications: ['notifications.view'],
  }
  return hasAnyPermission(user, permissions[resource] || [])
}
