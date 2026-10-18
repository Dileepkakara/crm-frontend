# Design Blocks CRM

A responsive, frontend-only CRM and project lifecycle prototype built inside the existing React + Vite application. It demonstrates lead management, follow-ups, client records, quotations, agreements, invoices, payments, projects, tasks, reports, notifications, role-aware mock accounts, and a client portal.

All sample people, companies, and transactions are fictional. Sign-in and role permissions are local mock behavior only—not production authentication or authorization. The prototype also does not provide legally binding documents, real tax-compliant invoices, payment processing, messaging, or electronic signatures.

## Technology

- React 19 and JavaScript/JSX
- Vite 8
- Tailwind CSS 4 (Vite plugin) with a shared responsive CRM design system
- React Router DOM
- Lucide React icons
- Recharts
- Browser localStorage for mock-mode demo persistence

## Run the application

From this `frontend` directory:

```sh
npm install
npm run dev
npm run lint
npm run build
```

## Architecture

```text
src/
  api/             API endpoint definitions, client, and feature service methods
  components/
    auth/           Access-denied and authentication UI
    common/        Reusable UI and resource-list behavior
    layout/        App shell, sidebar, topbar, and navigation definitions
  context/         Toast notification context
  auth/            Mock login, browser session, and demo user management
  config/          Role definitions and permission maps
  mockData/        Central fictional seed records
  pages/           Dedicated module folders, each containing its page entry point
  routes/          Central route definitions and legacy URL redirects
  services/        Local demo persistence
  utils/           Currency, dates, and invoice balance helpers
```

`App.jsx` composes the providers and router. `routes/AppRoutes.jsx` maps each URL to a page within its module folder and protects the workspace behind mock sign-in. Resource list pages reuse `components/common/ResourceRecordsPage.jsx` for common table, form, filter, and CRUD behavior; module-specific details and print views remain in their module folders. The shared layout is split into `AppLayout.jsx`, `Sidebar.jsx`, and `Topbar.jsx`.

Pages use `api/resourcesApi.js` feature service methods. `api/apiClient.js` chooses the mock adapter or configured HTTP mode, so pages do not directly change seed arrays or access localStorage. Records are stored under `designblocks-crm-demo-v1`; mutations in mock mode survive refreshes in the same browser. **Settings → Reset all demo data** restores the original sample dataset.

The canonical routes are `/dashboard`, `/leads`, `/follow-ups`, `/clients`, `/quotations`, `/agreements`, `/invoices`, `/payments`, `/projects`, `/tasks`, `/client-portal`, `/notifications`, `/reports`, `/users`, and `/settings`. `/` remains an alias for the dashboard; `/followups` and `/portal` redirect to their canonical routes.

## Mock sign-in and roles

The sign-in page includes a “Use” button for each of these fictional demo accounts:

| Role | Demo email |
| --- | --- |
| Super Admin | `admin@designblocks.demo` |
| Director / Management | `director@designblocks.demo` |
| Sales Manager | `manager@designblocks.demo` |
| Sales Executive | `sales@designblocks.demo` |
| Accounts Team | `accounts@designblocks.demo` |
| Project Manager | `pm@designblocks.demo` |
| Developer / Designer | `designer@designblocks.demo` |
| Client | `client@designblocks.demo` |

The shared demo password is displayed on the sign-in page. The session stores only the demo user ID in browser localStorage. User changes made under **Users & access** are also browser-local. Role names and permissions are centralized in `src/config/roles.js` and `src/config/permissions.js`; account assignments are in `src/auth/mockUsers.js`. Client, lead, project, task, and financial record views are scoped to the signed-in demo account where applicable.

This frontend-only RBAC is a demonstration of the user experience, not a security boundary: users can inspect and alter browser data. A production application must authenticate users and enforce permissions, ownership, and record scoping on the backend.

The mock adapter currently implements list, get, create, update, and delete with asynchronous responses. Feature-specific API methods are grouped by resource and can be extended as backend contracts are agreed. Backend integrations should confirm identifier formats, pagination/filter response shapes, role claims, audit fields, and financial rounding rules before implementation.

## API configuration

Mock mode is the default and makes no network requests:

```env
VITE_API_MODE=mock
```

To prepare for a future backend, configure:

```env
VITE_API_MODE=backend
VITE_API_BASE_URL=http://localhost:5000
```

Endpoint paths are centralized in `src/api/endpoints.js`. Backend mode uses HTTP requests and expects JSON responses; authentication and server-side authorization are not implemented.

## Simulated behavior

- CRUD for the resource lists, client/lead assignment, status changes, exports, lead activities and follow-ups.
- Developer/Designer demo accounts can add internal comments to tasks they are assigned; role visibility is also applied to the comment panel.
- Explicit lead conversion links a client while retaining the original lead.
- Quotation, agreement, project, and task records can be managed as demo data.
- Payment entries update the associated invoice’s paid/partial status; balances derive from recorded payment rows.
- Invoice forms support multiple description/quantity/rate rows; totals are calculated as subtotal minus discount plus tax. Older total-only invoices keep their saved total and identify unavailable line-item detail when printed.
- Notification read state, dashboard/report summaries, and client-selected portal data use current mock records.
- Browser-native printing is available for individual invoices, lead/client/record details, filtered follow-ups, dashboard summaries, and reports. Invoice printouts use recorded company preferences and transaction data; older invoices without line-item details clearly show that the breakdown is unavailable.
- Quotations, invoices, and work orders can print either an individual record or the currently filtered module list using the browser’s print dialog.
- Notifications, messaging, client approval, document delivery, and bank/payment verification are not connected to external services. Export is CSV; print-to-PDF uses the browser’s native print dialog.
- Role and portal views are previews only. Production identity, ownership enforcement, and access control must be implemented on the backend.

No real credentials, payment details, or sensitive documents should be entered in the prototype.
