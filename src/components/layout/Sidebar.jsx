import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { navigationSections } from './navigation'
import { useAuth } from '../../auth/useAuth'
import { usePermissions } from '../../auth/usePermissions'
import { getRoleLabel } from '../../services/permissionsService'
import { isBackendMode } from '../../api/apiClient'

export default function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const location = useLocation()
  const { user, logout } = useAuth()
  const { hasAnyPermission } = usePermissions()
  const visibleSections = navigationSections.map((section) => ({
    ...section,
    links: section.links.filter(([, , , permission]) => Array.isArray(permission) ? hasAnyPermission(permission) : hasAnyPermission([permission])),
  })).filter((section) => section.links.length)
  return <>
    {mobileOpen && <button className="drawer-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'sidebar-mobile-open' : ''}`}>
      <div className="brand">
        <img className="brand-mark brand-mark-image" src="/design-blocks-logo.png" alt="Design Blocks logo" />
        <div className="brand-copy"><strong>DESIGN BLOCKS</strong><span>CRM & PROJECT MANAGEMENT</span></div>
        <button className="collapse-button" title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
      <nav className="sidebar-nav">{visibleSections.map((section) => <div className="nav-section" key={section.title}>
        <div className="nav-section-title">{section.title}</div>
        {section.links.map(([label, to, Icon]) => <NavLink key={to} to={to} end={to === '/dashboard'} title={collapsed ? label : undefined}
          className={({ isActive }) => `nav-link ${isActive || location.pathname.startsWith(`${to}/`) || (to === '/dashboard' && location.pathname === '/') ? 'active' : ''}`}
          onClick={() => setMobileOpen(false)}>
          <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
        </NavLink>)}
      </div>)}</nav>
      <div className="sidebar-bottom">
        <div className="demo-tip"><span className="live-dot" /><div><strong>{isBackendMode ? 'Connected workspace' : 'Demo workspace'}</strong><small>{isBackendMode ? 'Live CRM data' : 'Sample data only'}</small></div></div>
        <div className="sidebar-profile"><div className="avatar avatar-blue">{user?.initials || user?.name?.split(/\s+/).map((part) => part[0]).join('').slice(0, 2)}</div><div className="profile-copy"><strong>{user?.name}</strong><small>{getRoleLabel(user?.role, user?.roleLabel)}</small></div><button className="sidebar-logout" type="button" title="Sign out" aria-label="Sign out" onClick={logout}><LogOut size={16} /></button></div>
      </div>
    </aside>
  </>
}
