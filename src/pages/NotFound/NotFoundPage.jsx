import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return <div className="page"><div className="empty-state">
    <div className="empty-mark">404</div><strong>Page not found</strong>
    <span>This page isn’t available in this workspace.</span>
    <Link to="/dashboard" className="button button-primary">Return to dashboard</Link>
  </div></div>
}
