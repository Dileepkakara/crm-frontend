import {
  Activity, BarChart3, Bell, Building2, CheckSquare, CircleDollarSign,
  ClipboardList, FileCheck2, FileText, FolderKanban, LayoutDashboard, LifeBuoy,
  Settings, UserRound, UsersRound,
} from 'lucide-react'

export const navigationSections = [
  { title: 'WORKSPACE', links: [
    ['Dashboard', '/dashboard', LayoutDashboard, 'dashboard.view'],
    ['Leads', '/leads', UserRound, ['leads.view.all', 'leads.view.assigned']],
    ['Follow-ups', '/follow-ups', Activity, 'followups.view'],
    ['Clients', '/clients', Building2, 'clients.view'],
  ] },
  { title: 'SALES & FINANCE', links: [
    ['Quotations', '/quotations', FileText, ['quotations.view', 'quotations.view.own']],
    ['Work orders', '/agreements', FileCheck2, ['agreements.view', 'agreements.view.own']],
    ['Invoices', '/invoices', ClipboardList, ['invoices.view', 'invoices.view.own']],
    ['Payments', '/payments', CircleDollarSign, ['payments.view', 'payments.view.own']],
  ] },
  { title: 'DELIVERY', links: [
    ['Projects', '/projects', FolderKanban, ['projects.view', 'projects.view.assigned']],
    ['Tasks', '/tasks', CheckSquare, ['tasks.view', 'tasks.view.assigned']],
    ['Client portal', '/client-portal', LifeBuoy, 'clientPortal.view.own'],
  ] },
  { title: 'INSIGHTS', links: [['Reports', '/reports', BarChart3, ['reports.view', 'reports.view.sales', 'reports.view.financial']]] },
  { title: 'ADMINISTRATION', links: [
    ['Users & access', '/users', UsersRound, 'users.view'],
    ['Client requests', '/client-signup-requests', UsersRound, 'clients.signup.manage'],
    ['Notifications', '/notifications', Bell, 'notifications.view'],
    ['Settings', '/settings', Settings, 'settings.manage'],
  ] },
]

export const routeTitles = Object.fromEntries(
  navigationSections.flatMap(({ links }) => links.map(([label, path]) => [path, label])),
)

export const searchableResources = [
  ['leads', '/leads', 'Leads', ['leads.view.all', 'leads.view.assigned']],
  ['clients', '/clients', 'Clients', ['clients.view']],
  ['quotations', '/quotations', 'Quotations', ['quotations.view', 'quotations.view.own']],
  ['projects', '/projects', 'Projects', ['projects.view', 'projects.view.assigned']],
]
