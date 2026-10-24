import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Pencil, Plus, Search, ShieldCheck, ToggleLeft, ToggleRight, Trash2, UsersRound, X } from 'lucide-react'
import { authService } from '../../auth/authService'
import { useAuth } from '../../auth/useAuth'
import { usePermissions } from '../../auth/usePermissions'
import { ROLE_OPTIONS, ROLES } from '../../config/roles'
import { useApp } from '../../context/useApp'
import { Button, Modal, PageHeader } from '../../components/common/UI'
import { apiFor } from '../../api/resourcesApi'
import { isBackendMode } from '../../api/apiClient'
import { rolesApi } from '../../api/rolesApi'
import RolesManagement from './RolesManagement'

const emptyUser = { name: '', email: '', phone: '', password: '', role: ROLES.SALES_EXECUTIVE, status: 'Active', teamId: '', department: '', clientId: '' }
const NEW_CLIENT_OPTION = '__new_client__'

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const { hasPermission } = usePermissions()
  const { notify } = useApp()
  const [users, setUsers] = useState([])
  const [clients, setClients] = useState([])
  const [roles, setRoles] = useState(ROLE_OPTIONS.map((role) => ({
    id: role.value, key: role.value, name: role.label, description: role.description,
    status: 'Active', permissions: [], builtIn: true,
  })))
  const [permissionCatalog, setPermissionCatalog] = useState([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [editing, setEditing] = useState(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [form, setForm] = useState(emptyUser)
  const [error, setError] = useState('')
  const [passwordTarget, setPasswordTarget] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deletingUser, setDeletingUser] = useState(false)

  const load = useCallback(async () => {
    try {
      const [userRecords, clientRecords, roleCatalog] = await Promise.all([
        authService.listUsers(),
        apiFor.clients.list(),
        isBackendMode && hasPermission('roles.manage') ? rolesApi.list() : Promise.resolve(null),
      ])
      setUsers(userRecords)
      setClients(clientRecords)
      if (roleCatalog) {
        const builtInRoles = ROLE_OPTIONS.map((option) => {
          const configuredRole = roleCatalog.roles.find((role) => role.key === option.value)
          return {
            ...(configuredRole || {
              id: option.value,
              key: option.value,
              description: option.description,
              status: 'Active',
              permissions: [],
              builtIn: true,
            }),
            ...(option.value === ROLES.CLIENT ? { name: 'Client portal' } : {}),
          }
        })
        setRoles([...builtInRoles, ...roleCatalog.roles.filter((role) => !ROLE_OPTIONS.some((option) => option.value === role.key))])
        setPermissionCatalog(roleCatalog.permissions)
      }
    }
    catch (cause) { notify(cause.message || 'Could not load demo users.', 'error') }
  }, [hasPermission, notify])
  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])
  const visibleUsers = users.filter((person) =>
    (statusFilter === 'All statuses' || person.status === statusFilter)
    && `${person.name} ${person.email} ${person.role} ${roles.find((role) => role.key === person.role)?.name || person.roleLabel || ''}`.toLowerCase().includes(query.toLowerCase()))

  function openEditor(person = null) {
    setEditing(person)
    setEditorOpen(true)
    setForm(person ? { ...person } : { ...emptyUser })
    setError('')
  }
  async function save(event) {
    event.preventDefault()
    if (!form.name.trim() || !form.email.trim()) { setError('Name and email are required.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError('Enter a valid email address.'); return }
    if (!editing && users.some((person) => person.email.toLowerCase() === form.email.trim().toLowerCase())) {
      setError('A user account already exists with this email.')
      return
    }
    if (!roles.some((option) => option.key === form.role && option.status === 'Active')) { setError('Select an active role.'); return }
    if (form.role === ROLES.CLIENT && !form.clientId) { setError('Select an existing client or choose to enter a new client.'); return }
    if (form.role === ROLES.CLIENT && form.clientId === NEW_CLIENT_OPTION && !form.clientCompany?.trim()) {
      setError('Enter the client company name.')
      return
    }
    if (form.role === ROLES.CLIENT && form.clientId === NEW_CLIENT_OPTION && !form.phone?.trim()) {
      setError('Enter a phone number for the new client record.')
      return
    }
    if (isBackendMode && !editing && form.password.length < 12) { setError('Set an initial password of at least 12 characters.'); return }
    if (editing?.id === currentUser.id && form.role !== currentUser.role) { setError('You cannot change your own role.'); return }
    try {
      let clientId = form.clientId
      if (form.role === ROLES.CLIENT && clientId === NEW_CLIENT_OPTION) {
        const emailMatches = clients.filter((client) => client.email?.toLowerCase() === form.email.trim().toLowerCase())
        if (emailMatches.length > 1) {
          setError('More than one client uses this email. Select the correct existing client from the list.')
          return
        }
        if (emailMatches.length === 1) {
          clientId = emailMatches[0].id
        } else {
          const client = await apiFor.clients.create({
            name: form.name.trim(),
            company: form.clientCompany.trim(),
            email: form.email.trim().toLowerCase(),
            phone: form.phone.trim(),
            status: 'Active',
          })
          clientId = client.id
          setClients((current) => [...current, client])
        }
        setForm((current) => ({ ...current, clientId }))
      }
      const userForm = { ...form }
      delete userForm.clientCompany
      await authService.saveUser({
        ...userForm,
        name: form.name.trim(),
        ...(form.role === ROLES.CLIENT ? { clientId } : {}),
        assignedLeadIds: typeof form.assignedLeadIds === 'string' ? form.assignedLeadIds.split(',').map((item) => item.trim()).filter(Boolean) : form.assignedLeadIds,
        assignedProjectIds: typeof form.assignedProjectIds === 'string' ? form.assignedProjectIds.split(',').map((item) => item.trim()).filter(Boolean) : form.assignedProjectIds,
        ...(form.role === ROLES.CLIENT ? {} : { clientId: undefined }),
        ...(form.role === ROLES.SALES_EXECUTIVE && !form.assignedLeadIds ? { assignedLeadIds: [] } : {}),
      })
      setEditorOpen(false)
      notify(editing ? 'User updated.' : 'User created.')
      await load()
    } catch (cause) { setError(cause.message || 'Could not save the demo user.') }
  }
  async function toggleStatus(person) {
    try {
      await authService.removeUser(person.id, currentUser.id)
      notify(`Demo account ${person.status === 'Active' ? 'deactivated' : 'activated'}.`)
      await load()
    } catch (cause) { notify(cause.message, 'error') }
  }
  async function resetPassword(event) {
    event.preventDefault()
    if (newPassword.length < 12) {
      setPasswordError('Use a password with at least 12 characters.')
      return
    }
    setSavingPassword(true)
    setPasswordError('')
    try {
      await authService.setPassword(passwordTarget.id, newPassword)
      setPasswordTarget(null)
      setNewPassword('')
      notify('Password reset. The user must sign in again.')
    } catch (cause) {
      setPasswordError(cause.message || 'Could not reset the password.')
    } finally {
      setSavingPassword(false)
    }
  }
  async function deleteUser() {
    if (!deleteTarget || deletingUser) return
    setDeletingUser(true)
    try {
      await authService.deleteUser(deleteTarget.id)
      setDeleteTarget(null)
      notify(`${deleteTarget.name}'s account was permanently deleted.`)
      await load()
    } catch (cause) {
      notify(cause.message || 'Could not delete the user account.', 'error')
    } finally {
      setDeletingUser(false)
    }
  }

  return <div className="page">
    <PageHeader title="Users & access" description={isBackendMode ? 'Manage employee accounts, client access, and assigned CRM roles.' : 'Manage local demo accounts and their assigned CRM roles.'}
      actions={hasPermission('users.manage') && <Button onClick={() => openEditor()}><Plus size={16} /> {isBackendMode ? 'Create user' : 'Create demo user'}</Button>} />
    {!isBackendMode && <div className="prototype-callout"><ShieldCheck size={17} /> Demo users and role changes are stored in this browser only. This is not production user provisioning.</div>}
    <section className="panel records-panel">
      <div className="table-toolbar quotation-toolbar"><label className="list-search"><Search size={18} aria-hidden="true" /><input aria-label="Search users" placeholder="Search name, email, or role…" value={query} onChange={(event) => setQuery(event.target.value)} />
          {query && <button className="list-search-clear" type="button" aria-label="Clear user search" onClick={() => setQuery('')}><X size={17} /></button>}
        </label>
        <select aria-label="Filter users by account status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option><option>Active</option><option>Inactive</option></select></div>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th className="no-print">Actions</th></tr></thead>
        <tbody>{visibleUsers.map((person) => <tr key={person.id}><td><strong className="table-primary">{person.name}</strong></td><td>{person.email}</td><td>{roles.find((role) => role.key === person.role)?.name || person.roleLabel || 'Invalid role'}</td><td><span className={`badge badge-${person.status.toLowerCase()}`}>{person.status}</span></td>
          <td className="no-print">{hasPermission('users.manage') && <div className="row-actions"><button title="Edit user" aria-label={`Edit ${person.name}`} onClick={() => openEditor(person)}><Pencil size={16} /></button>{isBackendMode && <button title="Reset password" aria-label={`Reset password for ${person.name}`} onClick={() => { setPasswordTarget(person); setNewPassword(''); setPasswordError('') }}><KeyRound size={16} /></button>}<button title={person.status === 'Active' ? 'Deactivate user' : 'Activate user'} aria-label={`${person.status === 'Active' ? 'Deactivate' : 'Activate'} ${person.name}`} className={person.status === 'Active' ? 'danger-action' : ''} onClick={() => toggleStatus(person)}>{person.status === 'Active' ? <ToggleRight size={17} /> : <ToggleLeft size={17} />}</button>{currentUser.role === ROLES.SUPER_ADMIN && <button title={person.id === currentUser.id ? 'You cannot delete your own account' : 'Delete user'} aria-label={`Delete ${person.name}`} className="danger-action" disabled={person.id === currentUser.id} onClick={() => setDeleteTarget(person)}><Trash2 size={16} /></button>}</div>}</td>
        </tr>)}</tbody></table></div>
      {!visibleUsers.length && <div className="empty-state"><UsersRound size={24} /><strong>No demo users found</strong><span>Change the search term or create a user.</span></div>}
    </section>
    {isBackendMode && hasPermission('roles.manage') && <RolesManagement roles={roles} permissions={permissionCatalog} onChanged={load} notify={notify} />}
    {editorOpen && <Modal title={editing ? 'Edit user' : isBackendMode ? 'Create user' : 'Create demo user'} description={isBackendMode ? 'Set the account role and initial sign-in password.' : 'These changes affect only mock accounts in this browser.'} onClose={() => setEditorOpen(false)}>
      <form className="record-form" onSubmit={save}><div className="form-grid">
        <label className="form-field"><span>Name *</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label className="form-field"><span>Email *</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label className="form-field"><span>Phone number</span><input type="tel" value={form.phone || ''} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
        <label className="form-field"><span>Department</span><input value={form.department || ''} onChange={(event) => setForm({ ...form, department: event.target.value })} /></label>
        <label className="form-field"><span>Team ID</span><input value={form.teamId || ''} onChange={(event) => setForm({ ...form, teamId: event.target.value })} /></label>
        {isBackendMode && !editing && <label className="form-field"><span>Temporary password *</span><input type="password" autoComplete="new-password" minLength={12} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /><small className="muted">The new user will be required to change it after signing in.</small></label>}
        <label className="form-field"><span>Role *</span><select value={form.role} disabled={editing?.id === currentUser.id} onChange={(event) => setForm({ ...form, role: event.target.value })}>{roles.filter((option) => option.status === 'Active').map((option) => <option key={option.key} value={option.key}>{option.name}</option>)}</select></label>
        {isBackendMode && <label className="form-field"><span>Account status</span><select value={form.status || 'Active'} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Active</option><option>Inactive</option></select></label>}
        {form.role === ROLES.CLIENT && <>
          <label className="form-field field-full"><span>Client portal account *</span><select value={form.clientId || ''} onChange={(event) => setForm({ ...form, clientId: event.target.value })}>
            <option value="">Select an existing client…</option>
            {clients.map((client) => <option value={client.id} key={client.id}>{client.name} · {client.company}</option>)}
            <option value={NEW_CLIENT_OPTION}>Other — enter a new client manually</option>
          </select><small className="muted">Link to an existing client, or create a client record and portal account together.</small></label>
          {form.clientId === NEW_CLIENT_OPTION && <label className="form-field field-full"><span>Client company *</span><input value={form.clientCompany || ''} onChange={(event) => setForm({ ...form, clientCompany: event.target.value })} /></label>}
        </>}
        {!isBackendMode && !editing && <p className="form-note field-full">New mock accounts use the shared demo password displayed on the sign-in page. Passwords are not saved in this user list.</p>}
        {form.role === ROLES.SALES_EXECUTIVE && <label className="form-field field-full"><span>Assigned lead IDs (comma separated)</span><input value={(form.assignedLeadIds || []).join(', ')} onChange={(event) => setForm({ ...form, assignedLeadIds: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} placeholder="e.g. LD-1048, LD-1047" /></label>}
        {form.role === ROLES.PROJECT_MANAGER && <label className="form-field field-full"><span>Assigned project IDs (comma separated)</span><input value={(form.assignedProjectIds || []).join(', ')} onChange={(event) => setForm({ ...form, assignedProjectIds: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} placeholder="e.g. PR-126" /></label>}
        {form.role === ROLES.DEVELOPER && <label className="form-field field-full"><span>Assigned task IDs (comma separated)</span><input value={(form.assignedTaskIds || []).join(', ')} onChange={(event) => setForm({ ...form, assignedTaskIds: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} placeholder="e.g. TS-512" /></label>}
      </div>{error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setEditorOpen(false)}>Cancel</Button><Button type="submit">{editing ? 'Save changes' : 'Create user'}</Button></div>
      </form>
    </Modal>}
    {passwordTarget && <Modal title={`Reset password for ${passwordTarget.name}`} description="The new password is saved as a hash. Existing sessions for this user will be revoked." onClose={() => setPasswordTarget(null)}>
      <form className="record-form" onSubmit={resetPassword}>
        <label className="form-field"><span>New password *</span><input type="password" autoComplete="new-password" minLength={12} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
        {passwordError && <p className="form-error" role="alert">{passwordError}</p>}
        <div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setPasswordTarget(null)}>Cancel</Button><Button type="submit" disabled={savingPassword}>{savingPassword ? 'Saving…' : 'Reset password'}</Button></div>
      </form>
    </Modal>}
    {deleteTarget && <Modal title={`Delete ${deleteTarget.name}'s account?`} description="This permanently removes the user's login account. Existing CRM records and audit history are retained." onClose={() => { if (!deletingUser) setDeleteTarget(null) }}>
      <div className="record-form">
        <p>This action cannot be undone. The user will immediately lose access, and their name may remain in existing record and audit history.</p>
        <div className="modal-actions"><Button type="button" variant="secondary" disabled={deletingUser} onClick={() => setDeleteTarget(null)}>Cancel</Button><Button type="button" variant="danger" disabled={deletingUser} onClick={() => void deleteUser()}>{deletingUser ? 'Deleting…' : 'Delete account'}</Button></div>
      </div>
    </Modal>}
  </div>
}
