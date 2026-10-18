const year = 2026
const stamp = (month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

export const initialData = {
  leads: [
    { id: 'LD-1048', name: 'Aarav Mehta', company: 'Northstar Foods', email: 'aarav@northstar.example', phone: '+91 98765 43210', source: 'Website', service: 'Web development', budget: 185000, timeline: '2–3 months', priority: 'High', status: 'Qualified', assignee: 'Priya Sharma', followUp: stamp(10, 16), createdAt: stamp(10, 8), notes: 'Looking for a customer ordering portal.' },
    { id: 'LD-1047', name: 'Sana Iyer', company: 'Morrow Living', email: 'sana@morrow.example', phone: '+91 98220 11456', source: 'Referral', service: 'Brand identity', budget: 95000, timeline: '1 month', priority: 'Urgent', status: 'Proposal', assignee: 'Rohan Das', followUp: stamp(10, 15), createdAt: stamp(10, 7), notes: 'Needs a complete brand refresh.' },
    { id: 'LD-1046', name: 'Kabir Rao', company: 'Fieldnote Labs', email: 'kabir@fieldnote.example', phone: '+91 98111 22334', source: 'LinkedIn', service: 'Product design', budget: 240000, timeline: '3–4 months', priority: 'Medium', status: 'Contacted', assignee: 'Priya Sharma', followUp: stamp(10, 18), createdAt: stamp(10, 6), notes: 'Early-stage product discovery.' },
    { id: 'LD-1045', name: 'Mira Kapoor', company: 'Goodwell Health', email: 'mira@goodwell.example', phone: '+91 98900 12788', source: 'Google Ads', service: 'Mobile app', budget: 325000, timeline: '4 months', priority: 'High', status: 'New', assignee: 'Aditi Nair', followUp: stamp(10, 17), createdAt: stamp(10, 5), notes: 'Patient wellness mobile app.' },
    { id: 'LD-1044', name: 'Dev Malhotra', company: 'Cedar & Stone', email: 'dev@cedarstone.example', phone: '+91 98190 07891', source: 'Event', service: 'E-commerce', budget: 210000, timeline: '2 months', priority: 'Low', status: 'Won', assignee: 'Rohan Das', followUp: stamp(10, 20), createdAt: stamp(10, 2), notes: 'Online storefront and catalog.' },
    { id: 'LD-1043', name: 'Tara Bose', company: 'Orbit Education', email: 'tara@orbit.example', phone: '+91 99001 88990', source: 'Website', service: 'Web development', budget: 150000, timeline: '6 weeks', priority: 'Medium', status: 'Lost', assignee: 'Aditi Nair', followUp: stamp(9, 30), createdAt: stamp(9, 28), notes: 'Timing deferred until next quarter.' },
  ],
  clients: [
    { id: 'CL-208', name: 'Dev Malhotra', company: 'Cedar & Stone', email: 'dev@cedarstone.example', phone: '+91 98190 07891', status: 'Active', leadId: 'LD-1044', since: stamp(9, 22) },
    { id: 'CL-207', name: 'Nisha Varma', company: 'Juniper Works', email: 'nisha@juniper.example', phone: '+91 98450 32911', status: 'Active', leadId: 'LD-1039', since: stamp(9, 14) },
    { id: 'CL-206', name: 'Arjun Sen', company: 'Brightpath Finance', email: 'arjun@brightpath.example', phone: '+91 98300 44119', status: 'Active', leadId: 'LD-1035', since: stamp(8, 30) },
    { id: 'CL-205', name: 'Leela Fernandes', company: 'Paper & Pine', email: 'leela@paperpine.example', phone: '+91 98201 12098', status: 'Prospect', leadId: 'LD-1031', since: stamp(8, 18) },
  ],
  followups: [
    { id: 'FU-308', leadId: 'LD-1047', contact: 'Sana Iyer', company: 'Morrow Living', dueDate: stamp(10, 15), type: 'Proposal review', assignee: 'Rohan Das', status: 'Due today', notes: 'Walk through revised scope.' },
    { id: 'FU-307', leadId: 'LD-1048', contact: 'Aarav Mehta', company: 'Northstar Foods', dueDate: stamp(10, 16), type: 'Discovery call', assignee: 'Priya Sharma', status: 'Upcoming', notes: 'Confirm integrations.' },
    { id: 'FU-306', leadId: 'LD-1046', contact: 'Kabir Rao', company: 'Fieldnote Labs', dueDate: stamp(10, 14), type: 'Check-in', assignee: 'Priya Sharma', status: 'Overdue', notes: 'Share product design case study.' },
    { id: 'FU-305', leadId: 'LD-1045', contact: 'Mira Kapoor', company: 'Goodwell Health', dueDate: stamp(10, 17), type: 'Intro call', assignee: 'Aditi Nair', status: 'Upcoming', notes: 'Discuss initial requirements.' },
  ],
  quotations: [
    { id: 'QT-2026-031', client: 'Morrow Living', clientId: 'CL-205', leadId: 'LD-1047', title: 'Brand identity refresh', issueDate: stamp(10, 10), validUntil: stamp(10, 24), amount: 95000, version: 2, status: 'Sent', owner: 'Rohan Das' },
    { id: 'QT-2026-030', client: 'Cedar & Stone', clientId: 'CL-208', leadId: 'LD-1044', title: 'E-commerce storefront', issueDate: stamp(10, 3), validUntil: stamp(10, 20), amount: 210000, version: 1, status: 'Accepted', owner: 'Rohan Das' },
    { id: 'QT-2026-029', client: 'Northstar Foods', clientId: '', leadId: 'LD-1048', title: 'Ordering portal discovery', issueDate: stamp(10, 1), validUntil: stamp(10, 18), amount: 185000, version: 1, status: 'Draft', owner: 'Priya Sharma' },
  ],
  agreements: [
    { id: 'WO-2026-014', client: 'Cedar & Stone', clientId: 'CL-208', quotationId: 'QT-2026-030', project: 'Cedar online store', version: 1, createdAt: stamp(10, 5), status: 'Accepted', acceptedAt: stamp(10, 7) },
    { id: 'WO-2026-013', client: 'Juniper Works', clientId: 'CL-207', quotationId: 'QT-2026-027', project: 'Juniper brand system', version: 1, createdAt: stamp(9, 28), status: 'Pending approval', acceptedAt: '' },
  ],
  invoices: [
    { id: 'INV-2026-042', client: 'Cedar & Stone', clientId: 'CL-208', project: 'Cedar online store', issueDate: stamp(10, 1), dueDate: stamp(10, 16), total: 84000, status: 'Issued' },
    { id: 'INV-2026-041', client: 'Juniper Works', clientId: 'CL-207', project: 'Juniper brand system', issueDate: stamp(9, 24), dueDate: stamp(10, 8), total: 72000, status: 'Overdue' },
    { id: 'INV-2026-040', client: 'Brightpath Finance', clientId: 'CL-206', project: 'Brightpath dashboard', issueDate: stamp(9, 22), dueDate: stamp(10, 7), total: 126000, status: 'Partially Paid' },
    { id: 'INV-2026-039', client: 'Paper & Pine', clientId: 'CL-205', project: 'Paper & Pine identity', issueDate: stamp(9, 18), dueDate: stamp(10, 2), total: 45000, status: 'Paid' },
  ],
  payments: [
    { id: 'PAY-2026-071', invoiceId: 'INV-2026-040', clientId: 'CL-206', client: 'Brightpath Finance', project: 'Brightpath dashboard', date: stamp(10, 1), amount: 60000, method: 'Bank Transfer', status: 'Recorded', recordedBy: 'Aditi Nair' },
    { id: 'PAY-2026-070', invoiceId: 'INV-2026-039', clientId: 'CL-205', client: 'Paper & Pine', project: 'Paper & Pine identity', date: stamp(9, 28), amount: 45000, method: 'UPI', status: 'Recorded', recordedBy: 'Priya Sharma' },
    { id: 'PAY-2026-069', invoiceId: 'INV-2026-042', clientId: 'CL-208', client: 'Cedar & Stone', project: 'Cedar online store', date: stamp(10, 8), amount: 28000, method: 'Bank Transfer', status: 'Recorded', recordedBy: 'Aditi Nair' },
  ],
  projects: [
    { id: 'PR-126', name: 'Cedar online store', client: 'Cedar & Stone', clientId: 'CL-208', quotationId: 'QT-2026-030', manager: 'Rohan Das', startDate: stamp(10, 1), deadline: stamp(12, 12), progress: 38, status: 'In Progress' },
    { id: 'PR-125', name: 'Juniper brand system', client: 'Juniper Works', clientId: 'CL-207', quotationId: 'QT-2026-027', manager: 'Priya Sharma', startDate: stamp(9, 20), deadline: stamp(11, 10), progress: 64, status: 'In Progress' },
    { id: 'PR-124', name: 'Brightpath dashboard', client: 'Brightpath Finance', clientId: 'CL-206', quotationId: 'QT-2026-026', manager: 'Aditi Nair', startDate: stamp(8, 12), deadline: stamp(10, 28), progress: 82, status: 'In Review' },
  ],
  tasks: [
    { id: 'TS-512', title: 'Approve homepage wireframes', project: 'Cedar online store', projectId: 'PR-126', assignee: 'Dev Malhotra', priority: 'High', dueDate: stamp(10, 16), status: 'In Review' },
    { id: 'TS-511', title: 'Prepare product photography brief', project: 'Cedar online store', projectId: 'PR-126', assignee: 'Rohan Das', priority: 'Medium', dueDate: stamp(10, 19), status: 'In Progress' },
    { id: 'TS-510', title: 'Share logo exploration', project: 'Juniper brand system', projectId: 'PR-125', assignee: 'Priya Sharma', priority: 'High', dueDate: stamp(10, 15), status: 'To Do' },
    { id: 'TS-509', title: 'QA responsive dashboard', project: 'Brightpath dashboard', projectId: 'PR-124', assignee: 'Aditi Nair', priority: 'Urgent', dueDate: stamp(10, 13), status: 'Blocked' },
    { id: 'TS-508', title: 'Finalize icon set', project: 'Juniper brand system', projectId: 'PR-125', assignee: 'Dev Malhotra', priority: 'Low', dueDate: stamp(10, 17), status: 'Completed' },
  ],
  users: [
    { id: 'US-001', name: 'Priya Sharma', email: 'priya@designblocks.example', role: 'Sales Manager', department: 'Sales', status: 'Active' },
    { id: 'US-002', name: 'Rohan Das', email: 'rohan@designblocks.example', role: 'Sales Executive', department: 'Sales', status: 'Active' },
    { id: 'US-003', name: 'Aditi Nair', email: 'aditi@designblocks.example', role: 'Project Manager', department: 'Delivery', status: 'Active' },
    { id: 'US-004', name: 'Dev Malhotra', email: 'dev.team@designblocks.example', role: 'Designer', department: 'Delivery', status: 'Active' },
  ],
  notifications: [
    { id: 'NT-205', title: 'Follow-up due today', body: 'Proposal review with Sana Iyer · Morrow Living', date: stamp(10, 15), category: 'Follow-ups', read: false, href: '/follow-ups' },
    { id: 'NT-204', title: 'Invoice approaching due date', body: 'INV-2026-042 · Cedar & Stone', date: stamp(10, 14), category: 'Finance', read: false, href: '/invoices' },
    { id: 'NT-203', title: 'New lead assigned to you', body: 'Mira Kapoor · Goodwell Health', date: stamp(10, 12), category: 'Leads', read: true, href: '/leads' },
    { id: 'NT-202', title: 'Milestone ready for review', body: 'Brightpath dashboard · QA handoff', date: stamp(10, 11), category: 'Projects', read: true, href: '/projects' },
  ],
}

export const resourceLabels = {
  leads: 'Leads', followups: 'Follow-ups', clients: 'Clients', quotations: 'Quotations',
  agreements: 'Work orders & agreements', invoices: 'Invoices', payments: 'Payments',
  projects: 'Projects', tasks: 'Tasks', users: 'Users', notifications: 'Notifications',
}
