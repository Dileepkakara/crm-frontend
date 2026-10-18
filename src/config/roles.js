export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  DIRECTOR: 'director',
  SALES_MANAGER: 'sales_manager',
  SALES_EXECUTIVE: 'sales_executive',
  ACCOUNTS: 'accounts',
  PROJECT_MANAGER: 'project_manager',
  DEVELOPER: 'developer',
  CLIENT: 'client',
}

export const ROLE_CONFIG = {
  [ROLES.SUPER_ADMIN]: { label: 'Super Admin', description: 'Full access to CRM modules, users, roles, and system settings.' },
  [ROLES.DIRECTOR]: { label: 'Director / Management', description: 'Business-wide dashboards, reports, approvals, and performance.' },
  [ROLES.SALES_MANAGER]: { label: 'Sales Manager', description: 'Sales team leads, assignments, follow-ups, quotations, and reports.' },
  [ROLES.SALES_EXECUTIVE]: { label: 'Sales Executive', description: 'Assigned leads, follow-ups, client records, and own quotations.' },
  [ROLES.ACCOUNTS]: { label: 'Accounts Team', description: 'Invoices, payments, billing clients, and accounting reports.' },
  [ROLES.PROJECT_MANAGER]: { label: 'Project Manager', description: 'Assigned projects, delivery tasks, milestones, and client coordination.' },
  [ROLES.DEVELOPER]: { label: 'Developer / Designer', description: 'Assigned projects and tasks, with task updates and internal comments.' },
  [ROLES.CLIENT]: { label: 'Client', description: 'Own client portal, projects, quotations, agreements, and invoices.' },
}

export const ROLE_OPTIONS = Object.entries(ROLE_CONFIG).map(([value, config]) => ({ value, ...config }))
