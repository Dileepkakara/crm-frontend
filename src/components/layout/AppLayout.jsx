import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return <div className="app-shell">
    <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
    <div className={`main-column ${collapsed ? 'main-collapsed' : ''}`}>
      <Topbar onMenu={() => setMobileOpen(true)} />
      <main className="main-content"><Outlet /></main>
    </div>
  </div>
}
