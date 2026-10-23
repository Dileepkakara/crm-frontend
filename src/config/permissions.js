import { ROLES } from './roles'

const all = [
  'dashboard.view', 'leads.view.all', 'leads.view.assigned', 'leads.create', 'leads.update', 'leads.delete', 'leads.assign',
  'followups.view', 'followups.create', 'followups.update', 'followups.delete',
  'clients.view', 'clients.manage',
  'quotations.view', 'quotations.view.own', 'quotations.create', 'quotations.approve',
  'agreements.view', 'agreements.view.own', 'agreements.approve',
  'invoices.view', 'invoices.view.own', 'invoices.manage',
  'payments.view', 'payments.view.own', 'payments.manage',
  'projects.view', 'projects.view.assigned', 'projects.manage',
  'tasks.view', 'tasks.view.assigned', 'tasks.create', 'tasks.update', 'tasks.update.assigned', 'tasks.delete', 'tasks.comment.internal',
  'reports.view', 'reports.view.sales', 'reports.view.financial',
  'users.view', 'users.manage', 'clients.signup.manage', 'settings.manage', 'notifications.view',
  'clientPortal.view.own',
]

export const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: all,
  [ROLES.DIRECTOR]: [
    'dashboard.view', 'leads.view.all', 'followups.view', 'clients.view', 'quotations.view', 'quotations.approve',
    'agreements.view', 'agreements.approve', 'invoices.view', 'payments.view', 'projects.view', 'tasks.view',
    'reports.view', 'reports.view.sales', 'reports.view.financial', 'users.view', 'notifications.view',
  ],
  [ROLES.SALES_MANAGER]: [
    'dashboard.view', 'leads.view.all', 'leads.create', 'leads.update', 'leads.assign', 'followups.view', 'followups.create',
    'followups.update', 'clients.view', 'quotations.view', 'quotations.create', 'quotations.approve',
    'reports.view', 'reports.view.sales', 'notifications.view',
  ],
  [ROLES.SALES_EXECUTIVE]: [
    'dashboard.view', 'leads.view.assigned', 'leads.create', 'leads.update', 'followups.view', 'followups.create',
    'followups.update', 'clients.view', 'quotations.view.own', 'quotations.create', 'notifications.view',
  ],
  [ROLES.ACCOUNTS]: [
    'dashboard.view', 'clients.view', 'invoices.view', 'invoices.manage', 'payments.view', 'payments.manage',
    'reports.view', 'reports.view.financial', 'notifications.view',
  ],
  [ROLES.PROJECT_MANAGER]: [
    'dashboard.view', 'clients.view', 'projects.view.assigned', 'projects.manage', 'tasks.view.assigned', 'tasks.create',
    'tasks.update', 'tasks.delete', 'reports.view', 'notifications.view',
  ],
  [ROLES.DEVELOPER]: [
    'dashboard.view', 'projects.view.assigned', 'tasks.view.assigned', 'tasks.update.assigned',
    'tasks.comment.internal', 'notifications.view',
  ],
  [ROLES.CLIENT]: [
    'clientPortal.view.own', 'quotations.view.own', 'agreements.view.own', 'invoices.view.own',
    'payments.view.own', 'projects.view.assigned',
  ],
}

export const ROUTE_PERMISSIONS = {
  '/dashboard': 'dashboard.view',
  '/leads': ['leads.view.all', 'leads.view.assigned'],
  '/follow-ups': 'followups.view',
  '/clients': 'clients.view',
  '/quotations': ['quotations.view', 'quotations.view.own'],
  '/agreements': ['agreements.view', 'agreements.view.own'],
  '/invoices': ['invoices.view', 'invoices.view.own'],
  '/payments': ['payments.view', 'payments.view.own'],
  '/projects': ['projects.view', 'projects.view.assigned'],
  '/tasks': ['tasks.view', 'tasks.view.assigned'],
  '/client-portal': 'clientPortal.view.own',
  '/reports': ['reports.view', 'reports.view.sales', 'reports.view.financial'],
  '/users': 'users.view',
  '/client-signup-requests': 'clients.signup.manage',
  '/notifications': 'notifications.view',
  '/settings': 'settings.manage',
}
