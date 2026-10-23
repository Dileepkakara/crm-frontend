import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, MessageSquareText, Printer, Send, ShieldCheck } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiFor } from '../../api/resourcesApi'
import { useApp } from '../../context/useApp'
import { Badge, Button, PageHeader } from '../../components/common/UI'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { useAuth } from '../../auth/useAuth'
import { usePermissions } from '../../auth/usePermissions'
import { canAccessRecord } from '../../services/permissionsService'
import { isBackendMode } from '../../api/apiClient'

function formatDetailValue(key, value) {
  if (key === 'handover' && value && typeof value === 'object') {
    const received = value.clientReceived ? 'Client receipt confirmed' : 'Client receipt not confirmed'
    const confirmedAt = value.confirmedAt ? ` · ${formatDate(String(value.confirmedAt).slice(0, 10))}` : ''
    const confirmedBy = value.confirmedBy ? ` by ${value.confirmedBy}` : ''
    return `${received}${confirmedBy}${confirmedAt} · ${value.notes || ''}`
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (key.toLowerCase().includes('date') || key === 'closedAt') return formatDate(String(value || '').slice(0, 10))
  if (typeof value === 'number' && /(amount|total|budget)/i.test(key)) return formatCurrency(value)
  return String(value || '—')
}

export default function RecordDetailsPage() {
  const { resource, id } = useParams()
  const navigate = useNavigate()
  const { notify } = useApp()
  const { user } = useAuth()
  const { hasPermission: can } = usePermissions()
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [savingComment, setSavingComment] = useState(false)

  useEffect(() => {
    let active = true
    if (!apiFor[resource]) {
      const timer = window.setTimeout(() => {
        if (active) {
          setLoading(false)
          notify(`Unknown record type: ${resource}`, 'error')
        }
      }, 0)
      return () => { active = false; window.clearTimeout(timer) }
    }
    apiFor[resource].get(id).then((data) => {
      if (active && canAccessRecord(resource, data, user)) setRecord(data)
      else if (active) notify('This record is outside your account access.', 'error')
    })
      .catch((error) => { if (active) notify(error.message, 'error') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [resource, id, notify, user])

  if (loading) return <div className="loading-screen"><span className="spinner" />Loading record…</div>
  if (!record) return <div className="page"><Link to={`/${resource}`} className="back-link"><ArrowLeft size={16} /> Back</Link><div className="empty-state">Record not found.</div></div>

  const printableFields = {
    followups: ['id', 'contact', 'company', 'leadId', 'dueDate', 'type', 'status', 'assignee', 'notes'],
    quotations: ['id', 'title', 'client', 'clientId', 'issueDate', 'validUntil', 'amount', 'version', 'status', 'owner'],
    agreements: ['id', 'client', 'clientId', 'quotationId', 'project', 'version', 'createdAt', 'acceptedAt', 'status'],
    projects: ['id', 'name', 'client', 'manager', 'startDate', 'deadline', 'progress', 'status', 'handover', 'closedAt', 'closedBy'],
    tasks: ['id', 'title', 'project', 'assignee', 'priority', 'dueDate', 'status', 'description', 'notes'],
  }
  const printFields = (printableFields[resource] || []).filter((key) => record[key] !== undefined && record[key] !== null && record[key] !== '')
  const canPrintRecord = printFields.length > 0
  async function addInternalComment(event) {
    event.preventDefault()
    const text = comment.trim()
    if (resource !== 'tasks' || !can('tasks.comment.internal') || !canAccessRecord(resource, record, user)) {
      notify('Your role cannot add internal task comments.', 'error')
      return
    }
    if (!text) return
    setSavingComment(true)
    try {
      const savedComment = isBackendMode
        ? await apiFor.tasks.addComment(record.id, text)
        : {
          id: `COMMENT-${Date.now()}`,
          author: user.name,
          createdAt: new Date().toISOString(),
          text,
        }
      const updated = isBackendMode
        ? { ...record, internalComments: [...(record.internalComments || []), savedComment] }
        : await apiFor.tasks.update(record.id, {
          internalComments: [...(record.internalComments || []), savedComment],
        })
      setRecord(updated)
      setComment('')
      notify('Internal comment added.')
    } catch (error) {
      notify(error.message || 'Could not add the internal comment.', 'error')
    } finally {
      setSavingComment(false)
    }
  }

  return <div className="page">
    <div className="no-print">
    <Link to={`/${resource}`} className="back-link"><ArrowLeft size={16} /> Back to {resource}</Link>
    <PageHeader eyebrow={`${resource.toUpperCase()} · ${record.id}`} title={record.name || record.title || record.client || record.id} description={record.company || record.project || record.email || 'Demo record details.'}
      actions={<>{canPrintRecord && <Button className="no-print" variant="secondary" onClick={() => window.print()}><Printer size={15} /> Print</Button>}<Button className="no-print" variant="secondary" onClick={() => navigate(`/${resource}`)}>Return to list <ArrowRight size={15} /></Button></>} />
    <section className="panel generic-detail-panel"><div className="panel-heading"><div><h2>Record details</h2><p>Related information currently stored in the CRM</p></div>{record.status && <Badge>{record.status}</Badge>}</div>
      <div className="facts-grid generic-facts">{Object.entries(record).filter(([key]) => key !== 'internalComments').map(([key, value]) => <div key={key}><small>{key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())}</small><strong>{formatDetailValue(key, value)}</strong></div>)}</div>
    </section>
    {resource === 'tasks' && can('tasks.comment.internal') && <section className="panel task-comments-panel">
      <div className="panel-heading"><div><h2><MessageSquareText size={17} /> Internal comments</h2><p>Visible only to authorized internal demo roles.</p></div></div>
      {(record.internalComments || []).map((item) => <article className="task-comment" key={item.id}>
        <div><strong>{item.author}</strong><small>{new Date(item.createdAt).toLocaleString()}</small></div><p>{item.text}</p>
      </article>)}
      <form className="task-comment-form" onSubmit={addInternalComment}>
        <label className="form-field"><span>Add an internal note</span><textarea rows="3" maxLength="500" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Share a task update with the delivery team…" /></label>
        <Button type="submit" disabled={savingComment || !comment.trim()}><Send size={15} /> {savingComment ? 'Saving…' : 'Add comment'}</Button>
      </form>
    </section>}
    {!isBackendMode && <div className="prototype-callout"><ShieldCheck size={17} /><span>This view uses fictional demo data. Production access controls and backend authorization are not implemented.</span></div>}
    </div>
    {canPrintRecord && <section className="print-only print-document">
      <header className="print-document-header"><div className="brand-mark">D</div><div><strong>Design Blocks</strong><span>{resource.replaceAll('-', ' ')}</span></div></header>
      <h1>{resource.replaceAll('-', ' ').replace(/^./, (letter) => letter.toUpperCase())} details</h1>
      <h2>{record.name || record.title || record.contact || record.client || record.id}</h2>
      <dl className="print-facts">{printFields.map((key) => <div key={key}><dt>{key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())}</dt><dd>{formatDetailValue(key, record[key])}</dd></div>)}</dl>
    </section>}
  </div>
}
