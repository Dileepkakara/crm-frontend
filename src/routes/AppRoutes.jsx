import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import ProtectedRoute from './ProtectedRoute'
import RoleRoute from './RoleRoute'
import { apiFor } from '../api/resourcesApi'

const DashboardPage = lazy(() => import('../pages/Dashboard/DashboardPage'))
const LeadsPage = lazy(() => import('../pages/Leads/LeadsPage'))
const LeadDetailsPage = lazy(() => import('../pages/Leads/LeadDetailsPage'))
const FollowUpsPage = lazy(() => import('../pages/FollowUps/FollowUpsPage'))
const ClientsPage = lazy(() => import('../pages/Clients/ClientsPage'))
const ClientDetailsPage = lazy(() => import('../pages/Clients/ClientDetailsPage'))
const QuotationsPage = lazy(() => import('../pages/Quotations/QuotationsPage'))
const AgreementsPage = lazy(() => import('../pages/Agreements/AgreementsPage'))
const InvoicesPage = lazy(() => import('../pages/Invoices/InvoicesPage'))
const InvoiceDetailsPage = lazy(() => import('../pages/Invoices/InvoiceDetailsPage'))
const PaymentsPage = lazy(() => import('../pages/Payments/PaymentsPage'))
const ProjectsPage = lazy(() => import('../pages/Projects/ProjectsPage'))
const TasksPage = lazy(() => import('../pages/Tasks/TasksPage'))
const ClientPortalPage = lazy(() => import('../pages/ClientPortal/ClientPortalPage'))
const ReportsPage = lazy(() => import('../pages/Reports/ReportsPage'))
const NotificationsPage = lazy(() => import('../pages/Notifications/NotificationsPage'))
const UsersPage = lazy(() => import('../pages/Users/UsersPage'))
const SettingsPage = lazy(() => import('../pages/Settings/SettingsPage'))
const RecordDetailsPage = lazy(() => import('../pages/RecordDetails/RecordDetailsPage'))
const NotFoundPage = lazy(() => import('../pages/NotFound/NotFoundPage'))
const LoginPage = lazy(() => import('../pages/Login/LoginPage'))
const ChangePasswordPage = lazy(() => import('../pages/ChangePassword/ChangePasswordPage'))

const loading = <div className="loading-screen"><span className="spinner" />Loading workspace…</div>
const allow = (permission, page) => <RoleRoute permission={permission}>{page}</RoleRoute>

function GenericRecordRoute() {
  const { resource } = useParams()
  if (!apiFor[resource]) return <NotFoundPage />
  return <RoleRoute><RecordDetailsPage /></RoleRoute>
}

export default function AppRoutes() {
  return <Suspense fallback={loading}><Routes>
    <Route path="login" element={<LoginPage />} />
    <Route path="change-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />
    <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="dashboard" element={allow('dashboard.view', <DashboardPage />)} />
      <Route path="leads" element={allow(['leads.view.all', 'leads.view.assigned'], <LeadsPage />)} />
      <Route path="leads/:id" element={allow(['leads.view.all', 'leads.view.assigned'], <LeadDetailsPage />)} />
      <Route path="follow-ups" element={allow('followups.view', <FollowUpsPage />)} />
      <Route path="followups" element={<Navigate to="/follow-ups" replace />} />
      <Route path="clients" element={allow('clients.view', <ClientsPage />)} />
      <Route path="clients/:id" element={allow('clients.view', <ClientDetailsPage />)} />
      <Route path="quotations" element={allow(['quotations.view', 'quotations.view.own'], <QuotationsPage />)} />
      <Route path="agreements" element={allow(['agreements.view', 'agreements.view.own'], <AgreementsPage />)} />
      <Route path="invoices" element={allow(['invoices.view', 'invoices.view.own'], <InvoicesPage />)} />
      <Route path="invoices/:id" element={allow(['invoices.view', 'invoices.view.own'], <InvoiceDetailsPage />)} />
      <Route path="payments" element={allow(['payments.view', 'payments.view.own'], <PaymentsPage />)} />
      <Route path="projects" element={allow(['projects.view', 'projects.view.assigned'], <ProjectsPage />)} />
      <Route path="tasks" element={allow(['tasks.view', 'tasks.view.assigned'], <TasksPage />)} />
      <Route path="client-portal" element={allow('clientPortal.view.own', <ClientPortalPage />)} />
      <Route path="portal" element={<Navigate to="/client-portal" replace />} />
      <Route path="reports" element={allow(['reports.view', 'reports.view.sales', 'reports.view.financial'], <ReportsPage />)} />
      <Route path="notifications" element={allow('notifications.view', <NotificationsPage />)} />
      <Route path="users" element={allow('users.view', <UsersPage />)} />
      <Route path="settings" element={allow('settings.manage', <SettingsPage />)} />
      <Route path=":resource/:id" element={<GenericRecordRoute />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </Routes></Suspense>
}
