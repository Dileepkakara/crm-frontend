import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, CalendarPlus, Check, CircleUserRound, Clock3, FileText, MessageSquarePlus, Pencil, Phone, Printer, UserRoundCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { apiFor, leadsApi, scopeResourceRecords } from '../../api/resourcesApi'
import { useApp } from '../../context/useApp'
import { Badge, Button, Modal, PageHeader } from '../../components/common/UI'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { useAuth } from '../../auth/useAuth'
import { canAccessRecord } from '../../services/permissionsService'

export default function LeadDetailsPage() {
  const { id } = useParams()
  const { notify } = useApp()
  const { user } = useAuth()
  const [lead, setLead] = useState(null)
  const [followups, setFollowups] = useState([])
  const [quotes, setQuotes] = useState([])
  const [tab, setTab] = useState('Overview')
  const [activity, setActivity] = useState('')
  const [noteEditing, setNoteEditing] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [followupForm, setFollowupForm] = useState({ dueDate: '', type: 'Check-in', notes: '' })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [record, allFollowups, allQuotes] = await Promise.all([
        leadsApi.get(id), apiFor.followups.list(), apiFor.quotations.list(),
      ])
      if (!canAccessRecord('leads', record, user)) {
        notify('This lead is outside your account access.', 'error')
        setLead(null)
        return
      }
      setLead(record)
      setFollowups(scopeResourceRecords('followups', allFollowups, user).filter((item) => item.leadId === id))
      setQuotes(scopeResourceRecords('quotations', allQuotes, user).filter((quote) => quote.leadId === id))
    } catch (error) { notify(error.message || 'Could not load lead details.', 'error') }
    finally { setLoading(false) }
  }, [id, notify, user])
  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function update(changes, message) {
    try { await leadsApi.update(id, changes); notify(message); await load() }
    catch (error) { notify(error.message, 'error') }
  }
  async function addActivity(event) {
    event.preventDefault()
    if (!activity.trim()) return
    try {
      await leadsApi.addActivity(id, { type: 'Note', text: activity.trim() })
      notify('Activity added.')
      setActivity('')
      await load()
    } catch (error) {
      notify(error.message || 'Could not add lead activity.', 'error')
    }
  }
  async function scheduleFollowup(event) {
    event.preventDefault()
    if (!followupForm.dueDate) { notify('Choose a follow-up date.', 'error'); return }
    try {
      await apiFor.followups.create({ leadId: id, contact: lead.name, company: lead.company, assignee: lead.assignee, status: 'Upcoming', ...followupForm })
      await update({ followUp: followupForm.dueDate }, 'Follow-up scheduled.')
      setScheduleOpen(false); setFollowupForm({ dueDate: '', type: 'Check-in', notes: '' })
    } catch (error) { notify(error.message, 'error') }
  }
  async function convertLead() {
    try {
      const result = await leadsApi.convert(id)
      notify(result.created ? 'Lead converted to a client. The original lead has been retained.' : 'This lead is already linked to a client.')
      await load()
    } catch (error) { notify(error.message, 'error') }
  }

  if (loading) return <div className="loading-screen"><span className="spinner" />Loading lead…</div>
  if (!lead) return <div className="page"><Link to="/leads" className="text-link"><ArrowLeft size={16} /> Back to leads</Link><div className="empty-state">Lead record not found.</div></div>
  const tabs = ['Overview', 'Activities', 'Follow-ups', 'Quotations', 'Notes', 'History']
  return <div className="page">
    <div className="no-print">
    <Link to="/leads" className="back-link"><ArrowLeft size={16} /> Back to leads</Link>
    <PageHeader eyebrow={`${lead.id} · Created ${formatDate(lead.createdAt)}`} title={lead.name} description={`${lead.company} · ${lead.service}`}
      actions={<><select className={`status-select status-${lead.status.toLowerCase()}`} aria-label="Lead status" value={lead.status} onChange={(event) => update({ status: event.target.value }, 'Lead status updated.')}>{['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'].map((status) => <option key={status}>{status}</option>)}</select>
        <Button className="no-print" variant="secondary" onClick={() => window.print()}><Printer size={16} /> Print</Button>
        <Button className="no-print" variant="secondary" onClick={convertLead}><Check size={16} /> Convert to client</Button>
        <Button variant="secondary" onClick={() => setScheduleOpen(true)}><CalendarPlus size={16} /> Schedule follow-up</Button>
        <Button onClick={() => { setTab('Activities'); document.getElementById('activity-form')?.focus() }}><MessageSquarePlus size={16} /> Add activity</Button></>} />
    </div>
    <div className="detail-overview-grid no-print">
      <section className="panel lead-profile-panel"><div className="lead-profile-header"><div className="avatar avatar-large avatar-blue">{lead.name.split(' ').map((item) => item[0]).join('')}</div><div><Badge>{lead.status}</Badge><h2>{lead.name}</h2><p>{lead.company}</p></div></div>
        <div className="detail-contact-list"><a href={`mailto:${lead.email}`}><span className="detail-icon"><CircleUserRound size={16} /></span><span><small>Email</small><strong>{lead.email || '—'}</strong></span></a>
          <a href={`tel:${lead.phone}`}><span className="detail-icon"><Phone size={16} /></span><span><small>Phone</small><strong>{lead.phone || '—'}</strong></span></a></div>
        <div className="owner-control"><span><UserRoundCheck size={16} /> Assigned to</span><select aria-label="Assign lead" value={lead.assignee || ''} onChange={(event) => update({ assignee: event.target.value }, 'Lead assignment updated.')}>{['Priya Sharma', 'Rohan Das', 'Aditi Nair'].map((name) => <option key={name}>{name}</option>)}</select></div>
      </section>
      <section className="panel lead-facts-panel"><div className="panel-heading"><div><h2>Lead information</h2><p>Core enquiry details</p></div><span className="source-pill">{lead.source}</span></div>
        <div className="facts-grid"><div><small>Service required</small><strong>{lead.service}</strong></div><div><small>Estimated budget</small><strong>{formatCurrency(lead.budget)}</strong></div><div><small>Priority</small><Badge>{lead.priority}</Badge></div><div><small>Expected timeline</small><strong>{lead.timeline || '—'}</strong></div><div><small>Next follow-up</small><strong>{formatDate(lead.followUp)}</strong></div><div><small>Lead ID</small><strong className="id-text">{lead.id}</strong></div></div>
      </section>
    </div>
    <section className="panel detail-tabs-panel no-print"><div className="detail-tabs" role="tablist">{tabs.map((item) => <button role="tab" aria-selected={tab === item} className={tab === item ? 'detail-tab active' : 'detail-tab'} key={item} onClick={() => setTab(item)}>{item}{item === 'Follow-ups' && followups.length > 0 && <small>{followups.length}</small>}</button>)}</div>
      {tab === 'Overview' && <div className="detail-tab-content"><div className="overview-callout"><Clock3 size={18} /><div><strong>Next step</strong><p>{lead.followUp ? `Follow up with ${lead.name} on ${formatDate(lead.followUp)}.` : 'Schedule a follow-up to keep this opportunity moving.'}</p></div><Button variant="secondary" onClick={() => setScheduleOpen(true)}>Schedule</Button></div>
        <h3>Latest activity</h3>{lead.activities?.length ? <ActivityList items={lead.activities.slice().reverse().slice(0, 3)} /> : <p className="muted">No activity has been logged for this lead yet.</p>}
      </div>}
      {tab === 'Activities' && <div className="detail-tab-content"><form className="activity-form" onSubmit={addActivity}><input id="activity-form" value={activity} onChange={(event) => setActivity(event.target.value)} placeholder="Log a call, email, or meeting…" aria-label="Activity note" /><Button type="submit"><MessageSquarePlus size={15} /> Add activity</Button></form>
        {lead.activities?.length ? <ActivityList items={lead.activities.slice().reverse()} /> : <p className="muted">Your activity timeline will appear here.</p>}</div>}
      {tab === 'Follow-ups' && <div className="detail-tab-content"><div className="section-inline-heading"><h3>Scheduled follow-ups</h3><Button variant="secondary" onClick={() => setScheduleOpen(true)}><CalendarPlus size={15} /> Schedule</Button></div>
        {followups.length ? followups.map((item) => <div className="followup-item" key={item.id}><div><strong>{item.type}</strong><small>{item.notes || item.company}</small></div><span>{formatDate(item.dueDate)}</span><Badge>{item.status}</Badge><button className="complete-followup" aria-label="Mark follow-up complete" onClick={async () => { await apiFor.followups.update(item.id, { status: 'Completed' }); notify('Follow-up completed.'); await load() }}><Check size={16} /></button></div>) : <p className="muted">No follow-ups scheduled yet.</p>}</div>}
      {tab === 'Quotations' && <div className="detail-tab-content">{quotes.length ? quotes.map((quote) => <div className="followup-item" key={quote.id}><FileText size={18} /><div><strong>{quote.title}</strong><small>{quote.id} · Version {quote.version}</small></div><strong>{formatCurrency(quote.amount)}</strong><Badge>{quote.status}</Badge></div>) : <p className="muted">No quotations are linked to this lead yet.</p>}</div>}
      {tab === 'Notes' && <div className="detail-tab-content">{noteEditing
        ? <form className="notes-edit-form" onSubmit={async (event) => { event.preventDefault(); await update({ notes: noteDraft }, 'Lead notes updated.'); setNoteEditing(false) }}>
          <textarea aria-label="Lead notes" rows="4" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} />
          <Button type="submit"><Check size={14} /> Save notes</Button><Button variant="secondary" type="button" onClick={() => setNoteEditing(false)}>Cancel</Button>
        </form>
        : <><p className="lead-notes">{lead.notes || 'No notes have been added.'}</p><button className="text-link" onClick={() => { setNoteDraft(lead.notes || ''); setNoteEditing(true) }}><Pencil size={14} /> Edit notes</button></>}</div>}
      {tab === 'History' && <div className="detail-tab-content"><div className="history-event"><span className="history-dot" /><div><strong>Lead created</strong><small>{formatDate(lead.createdAt)} · Captured from {lead.source}</small></div></div>{(lead.activities || []).map((item, index) => <div className="history-event" key={`${item.date}-${index}`}><span className="history-dot" /><div><strong>{item.text}</strong><small>{new Date(item.date).toLocaleString()} · {item.by}</small></div></div>)}</div>}
    </section>
    <section className="print-only print-document">
      <header className="print-document-header"><div className="brand-mark">D</div><div><strong>Design Blocks</strong><span>CRM &amp; Project Management</span></div></header>
      <h1>Lead details</h1><h2>{lead.name}</h2>
      <dl className="print-facts">
        {[['Lead ID', lead.id], ['Company', lead.company], ['Email', lead.email], ['Phone', lead.phone], ['Lead source', lead.source], ['Lead status', lead.status], ['Assigned employee', lead.assignee], ['Service', lead.service], ['Priority', lead.priority], ['Budget', formatCurrency(lead.budget)], ['Expected timeline', lead.timeline], ['Created', formatDate(lead.createdAt)], ['Next follow-up', formatDate(lead.followUp)]].map(([label, value]) => value && <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      {followups.length > 0 && <><h3>Follow-ups</h3><ul>{followups.map((item) => <li key={item.id}>{item.type} · {formatDate(item.dueDate)} · {item.status} · {item.assignee}{item.notes ? ` · ${item.notes}` : ''}</li>)}</ul></>}
      {lead.notes && <><h3>Notes</h3><p>{lead.notes}</p></>}
    </section>
    {scheduleOpen && <Modal title="Schedule follow-up" description={`Plan the next touchpoint with ${lead.name}.`} onClose={() => setScheduleOpen(false)}>
      <form className="record-form" onSubmit={scheduleFollowup}><div className="form-grid"><label className="form-field"><span>Follow-up type</span><select value={followupForm.type} onChange={(event) => setFollowupForm({ ...followupForm, type: event.target.value })}>{['Intro call', 'Discovery call', 'Proposal review', 'Check-in', 'Email'].map((type) => <option key={type}>{type}</option>)}</select></label>
        <label className="form-field"><span>Due date *</span><input type="date" value={followupForm.dueDate} onChange={(event) => setFollowupForm({ ...followupForm, dueDate: event.target.value })} /></label>
        <label className="form-field field-full"><span>Notes</span><textarea rows="3" value={followupForm.notes} onChange={(event) => setFollowupForm({ ...followupForm, notes: event.target.value })} /></label></div>
        <div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setScheduleOpen(false)}>Cancel</Button><Button type="submit">Save follow-up</Button></div></form>
    </Modal>}
  </div>
}

function ActivityList({ items }) {
  return <div className="activity-timeline">{items.map((item, index) => <div className="history-event" key={`${item.date}-${index}`}><span className="history-dot" /><div><strong>{item.text}</strong><small>{new Date(item.date).toLocaleString()} · {item.by}</small></div></div>)}</div>
}
