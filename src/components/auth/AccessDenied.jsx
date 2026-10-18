import { ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function AccessDenied() {
  return <main className="auth-page"><section className="access-denied-card">
    <ShieldAlert size={30} /><h1>Access restricted</h1><p>Your demo role does not have permission to view this page.</p>
    <Link className="button button-primary" to="/dashboard">Go to your workspace</Link>
  </section></main>
}
