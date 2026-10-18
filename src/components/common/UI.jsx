import { X } from 'lucide-react'

export function Button({ children, variant = 'primary', className = '', ...props }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{children}</button>
}

export function Badge({ children, tone }) {
  const value = tone || String(children || '').toLowerCase().replaceAll(' ', '-')
  return <span className={`badge badge-${value}`}>{children}</span>
}

export function PageHeader({ eyebrow = 'DESIGN BLOCKS CRM', title, description, actions }) {
  return (
    <div className="page-heading">
      <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}

export function Modal({ title, description, onClose, children, wide = false }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header className="modal-header"><div><h2 id="modal-title">{title}</h2>{description && <p>{description}</p>}</div>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></header>
        {children}
      </section>
    </div>
  )
}

export function StatCard({ label, value, change, icon: Icon, color = 'blue' }) {
  return <article className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon stat-${color}`}>{Icon && <Icon size={18} />}</span></div>
    <strong>{value}</strong>{change && <small>{change}</small>}</article>
}

export function EmptyState({ title = 'Nothing here yet', description = 'Try changing your filters or add a new record.' }) {
  return <div className="empty-state"><div className="empty-mark">DB</div><strong>{title}</strong><span>{description}</span></div>
}
