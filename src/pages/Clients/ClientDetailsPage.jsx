import { useEffect, useState } from 'react'
import { ArrowLeft, Printer } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { apiFor } from '../../api/resourcesApi'
import { useApp } from '../../context/useApp'
import { Badge, Button, PageHeader } from '../../components/common/UI'
import { formatDate } from '../../utils/formatters'
import { useAuth } from '../../auth/useAuth'
import { canAccessRecord } from '../../services/permissionsService'

export default function ClientDetailsPage() {
  const { id } = useParams()
  const { notify } = useApp()
  const { user } = useAuth()
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    apiFor.clients.get(id)
      .then((record) => {
        if (active && canAccessRecord('clients', record, user)) setClient(record)
        else if (active) notify('This client is outside your account access.', 'error')
      })
      .catch((error) => { if (active) notify(error.message, 'error') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, notify, user])

  if (loading) return <div className="loading-screen"><span className="spinner" />Loading client…</div>
  if (!client) return <div className="page"><Link to="/clients" className="back-link"><ArrowLeft size={16} /> Back to clients</Link><div className="empty-state">Client record not found.</div></div>

  return <div className="page">
    <div className="no-print">
      <Link to="/clients" className="back-link"><ArrowLeft size={16} /> Back to clients</Link>
      <PageHeader title={client.name} description={client.company || 'Client details'}
        actions={<Button variant="secondary" onClick={() => window.print()}><Printer size={16} /> Print</Button>} />
      <section className="panel generic-detail-panel">
        <div className="panel-heading"><div><h2>Client details</h2><p>Contact and account information</p></div><Badge>{client.status}</Badge></div>
        <div className="facts-grid generic-facts">
          <div><small>Client ID</small><strong>{client.id}</strong></div>
          <div><small>Company</small><strong>{client.company || '—'}</strong></div>
          <div><small>Email</small><strong>{client.email || '—'}</strong></div>
          <div><small>Phone</small><strong>{client.phone || '—'}</strong></div>
          <div><small>Client since</small><strong>{formatDate(client.since)}</strong></div>
        </div>
      </section>
    </div>
    <section className="print-only print-document">
      <header className="print-document-header"><div className="brand-mark">D</div><div><strong>Design Blocks</strong><span>CRM &amp; Project Management</span></div></header>
      <h1>Client details</h1><h2>{client.name}</h2>
      <dl className="print-facts">
        {[['Client ID', client.id], ['Company', client.company], ['Email', client.email], ['Phone', client.phone], ['Status', client.status], ['Client since', formatDate(client.since)]].map(([label, value]) => value && <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
    </section>
  </div>
}
