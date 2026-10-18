import { ROLES } from '../config/roles'

export const DEMO_PASSWORD = 'BlocksDemo!2026'

export const DEFAULT_MOCK_USERS = [
  { id: 'USR-001', name: 'Alex Morgan', email: 'admin@designblocks.demo', role: ROLES.SUPER_ADMIN, status: 'Active', teamId: 'leadership', initials: 'AM' },
  { id: 'USR-002', name: 'Jordan Lee', email: 'director@designblocks.demo', role: ROLES.DIRECTOR, status: 'Active', teamId: 'leadership', initials: 'JL' },
  { id: 'USR-003', name: 'Priya Sharma', email: 'manager@designblocks.demo', role: ROLES.SALES_MANAGER, status: 'Active', teamId: 'sales', initials: 'PS' },
  { id: 'USR-004', name: 'Aditi Nair', email: 'sales@designblocks.demo', role: ROLES.SALES_EXECUTIVE, status: 'Active', teamId: 'sales', assignedLeadIds: ['LD-1045', 'LD-1043'], assignedClientIds: ['CL-206'], initials: 'AN' },
  { id: 'USR-005', name: 'Morgan Patel', email: 'accounts@designblocks.demo', role: ROLES.ACCOUNTS, status: 'Active', teamId: 'accounts', assignedClientIds: ['CL-208', 'CL-207', 'CL-206', 'CL-205'], initials: 'MP' },
  { id: 'USR-006', name: 'Rohan Das', email: 'pm@designblocks.demo', role: ROLES.PROJECT_MANAGER, status: 'Active', teamId: 'delivery', assignedProjectIds: ['PR-126', 'PR-125'], initials: 'RD' },
  { id: 'USR-007', name: 'Dev Malhotra', email: 'designer@designblocks.demo', role: ROLES.DEVELOPER, status: 'Active', teamId: 'delivery', assignedProjectIds: ['PR-126'], assignedTaskIds: ['TS-512'], initials: 'DM' },
  { id: 'USR-008', name: 'Dev Malhotra', email: 'client@designblocks.demo', role: ROLES.CLIENT, status: 'Active', clientId: 'CL-208', assignedProjectIds: ['PR-126'], initials: 'DM' },
]

export const DEMO_ACCOUNTS = DEFAULT_MOCK_USERS.map((user) => ({
  id: user.id, name: user.name, email: user.email, role: user.role, password: DEMO_PASSWORD,
}))
