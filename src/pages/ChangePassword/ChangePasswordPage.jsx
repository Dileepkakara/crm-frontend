import { useAuth } from '../../auth/useAuth'
import ChangePasswordForm from '../../components/auth/ChangePasswordForm'
import { PageHeader } from '../../components/common/UI'

export default function ChangePasswordPage() {
  const { user } = useAuth()
  return <main className="auth-page auth-change-password-page">
    <section className="auth-card auth-change-password-card">
      <header className="auth-brand"><img src="/design-blocks-logo.png" alt="Design Blocks" /></header>
      <PageHeader eyebrow="ACCOUNT SECURITY" title="Change your password" description={`Signed in as ${user?.email || 'your account'}.`} />
      <ChangePasswordForm forced={user?.mustChangePassword} />
    </section>
  </main>
}
