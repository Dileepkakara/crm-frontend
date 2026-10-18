import { useMemo, useState } from 'react'
import { Pencil, Plus, ShieldCheck, ToggleLeft, ToggleRight } from 'lucide-react'
import { rolesApi } from '../../api/rolesApi'
import { Button, Modal } from '../../components/common/UI'

const emptyRole = { name: '', description: '', permissions: [], status: 'Active' }

export default function RolesManagement({ roles, permissions, onChanged, notify }) {
  const [editing, setEditing] = useState(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [form, setForm] = useState(emptyRole)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const groupedPermissions = useMemo(() => permissions.reduce((groups, permission) => {
    if (['users.manage', 'settings.manage', 'roles.manage', 'clientPortal.view.own'].includes(permission.key)) return groups
    groups[permission.group] ||= []
    groups[permission.group].push(permission)
    return groups
  }, {}), [permissions])

  function openEditor(role = null) {
    setEditing(role)
    setEditorOpen(true)
    setForm(role ? {
      name: role.name,
      description: role.description || '',
      permissions: [...role.permissions],
      status: role.status,
    } : { ...emptyRole, permissions: [] })
    setError('')
  }

  function togglePermission(key) {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(key)
        ? current.permissions.filter((permission) => permission !== key)
        : [...current.permissions, key],
    }))
  }

  async function save(event) {
    event.preventDefault()
    if (!form.name.trim()) { setError('Enter a role name.'); return }
    if (!form.permissions.length) { setError('Select at least one permission.'); return }
    setBusy(true)
    setError('')
    try {
      if (editing) await rolesApi.update(editing.key, form)
      else await rolesApi.create(form)
      await onChanged()
      setEditorOpen(false)
      setEditing(null)
      notify(editing ? 'Role updated.' : 'Role created.')
    } catch (cause) {
      setError(cause.message || 'Could not save the role.')
    } finally {
      setBusy(false)
    }
  }

  async function toggleStatus(role) {
    try {
      await rolesApi.update(role.key, { status: role.status === 'Active' ? 'Inactive' : 'Active' })
      await onChanged()
      notify(role.status === 'Active' ? 'Role deactivated.' : 'Role activated.')
    } catch (cause) {
      notify(cause.message || 'Could not update role status.', 'error')
    }
  }

  return <section className="panel records-panel roles-management">
    <div className="section-heading">
      <div><h2>Manage roles</h2><p>Built-in roles keep their system permissions. Custom roles use only the permissions selected here.</p></div>
      <Button onClick={() => openEditor()}><Plus size={16} /> Create role</Button>
    </div>
    <div className="table-scroll"><table className="data-table"><thead><tr><th>Role</th><th>Assigned users</th><th>Status</th><th>Permissions</th><th>Actions</th></tr></thead>
      <tbody>{roles.map((role) => <tr key={role.key}><td><strong className="table-primary">{role.name}</strong><small className="role-description">{role.description}{role.builtIn ? ' · Built-in' : ''}</small></td>
        <td>{role.userCount}</td><td><span className={`badge badge-${role.status.toLowerCase()}`}>{role.status}</span></td>
        <td><span className="role-permission-summary">{role.permissions.map((key) => permissions.find((permission) => permission.key === key)?.label || key).join(', ') || 'No permissions'}</span></td>
        <td>{!role.builtIn && <div className="row-actions"><button title="Edit role" aria-label={`Edit ${role.name}`} onClick={() => openEditor(role)}><Pencil size={16} /></button><button title={role.status === 'Active' ? 'Deactivate role' : 'Activate role'} aria-label={`${role.status === 'Active' ? 'Deactivate' : 'Activate'} ${role.name}`} className={role.status === 'Active' ? 'danger-action' : ''} onClick={() => void toggleStatus(role)}>{role.status === 'Active' ? <ToggleRight size={17} /> : <ToggleLeft size={17} />}</button></div>}</td>
      </tr>)}</tbody></table></div>
    {editorOpen && <Modal title={editing ? 'Edit custom role' : 'Create custom role'} description="Sensitive user, role, and system-settings permissions are reserved for the Super Admin." onClose={() => setEditorOpen(false)}>
      <form className="record-form" onSubmit={save}>
        <div className="form-grid">
          <label className="form-field"><span>Role name *</span><input maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label className="form-field"><span>Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Active</option><option>Inactive</option></select></label>
          <label className="form-field field-full"><span>Description</span><textarea maxLength={500} rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <div className="field-full"><strong>Permissions *</strong>
            {Object.entries(groupedPermissions).map(([group, items]) => <fieldset className="permission-group" key={group}>
              <legend>{group}</legend><div className="permission-options">{items.map((permission) => <label key={permission.key}><input type="checkbox" checked={form.permissions.includes(permission.key)} onChange={() => togglePermission(permission.key)} />{permission.label}</label>)}</div>
            </fieldset>)}
          </div>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setEditorOpen(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create role'}</Button></div>
      </form>
    </Modal>}
    {!permissions.length && <p className="form-note"><ShieldCheck size={15} /> Role permission catalog is unavailable.</p>}
  </section>
}
