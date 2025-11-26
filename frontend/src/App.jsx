import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import AppLayout from './components/layout/AppLayout'
import CopyConsoleButton from './components/CopyConsoleButton'

// Helper to handle chunk load errors (stale deployment)
// When Vercel deploys new code, old chunk hashes become invalid
// This auto-refreshes the page once to get the new chunks
const lazyWithRetry = (componentImport) => {
  return lazy(() => {
    const sessionKey = `chunk_retry_${window.location.pathname}`
    return componentImport().catch((error) => {
      // Check if this is a chunk load error
      const isChunkError = error.message?.includes('Failed to fetch dynamically imported module') ||
                          error.message?.includes('Loading chunk') ||
                          error.message?.includes('Loading CSS chunk')

      // Only retry once per session per route to avoid infinite loops
      const hasRetried = sessionStorage.getItem(sessionKey)

      if (isChunkError && !hasRetried) {
        sessionStorage.setItem(sessionKey, 'true')
        console.log('[lazyWithRetry] Chunk load failed, refreshing page to get new deployment...')
        window.location.reload()
        // Return a never-resolving promise since we're reloading
        return new Promise(() => {})
      }

      // Clear retry flag on successful loads for future deployments
      sessionStorage.removeItem(sessionKey)
      throw error
    })
  })
}

// Eager load: Critical pages that should load immediately
import Dashboard from './pages/Dashboard'
import AuthCallback from './pages/AuthCallback'
import AutoLoginPage from './pages/AutoLoginPage'
import Login from './pages/Login'
import Logout from './pages/Logout'

// Lazy load: Everything else (loads on-demand)
// Using lazyWithRetry to handle stale chunks after deployments
const XestPage = lazyWithRetry(() => import('./pages/XestPage'))
const JobDetailPage = lazyWithRetry(() => import('./pages/JobDetailPage'))
const JobSetupPage = lazyWithRetry(() => import('./pages/JobSetupPage'))
const PriceBookItemDetailPage = lazyWithRetry(() => import('./pages/PriceBookItemDetailPage'))
const ContactsPage = lazyWithRetry(() => import('./pages/ContactsPage'))
const ContactDetailPage = lazyWithRetry(() => import('./pages/ContactDetailPage'))
const AccountsPage = lazyWithRetry(() => import('./pages/AccountsPage'))
const UsersPage = lazyWithRetry(() => import('./pages/UsersPage'))
const SystemAdminPage = lazyWithRetry(() => import('./pages/SystemAdminPage'))
const HealthPage = lazyWithRetry(() => import('./pages/HealthPage'))
const PurchaseOrderDetailPage = lazyWithRetry(() => import('./pages/PurchaseOrderDetailPage'))
const PurchaseOrderEditPage = lazyWithRetry(() => import('./pages/PurchaseOrderEditPage'))
const SupplierDetailPage = lazyWithRetry(() => import('./pages/SupplierDetailPage'))
const SupplierEditPage = lazyWithRetry(() => import('./pages/SupplierEditPage'))
const SupplierNewPage = lazyWithRetry(() => import('./pages/SupplierNewPage'))
const ImportPage = lazyWithRetry(() => import('./pages/ImportPage'))
const TablePage = lazyWithRetry(() => import('./pages/TablePage'))
const SchemaPage = lazyWithRetry(() => import('./pages/SchemaPage'))
const TableStandardTest = lazyWithRetry(() => import('./pages/TableStandardTest'))
const ColumnEditorPage = lazyWithRetry(() => import('./pages/ColumnEditorPage'))
const XeroCallbackPage = lazyWithRetry(() => import('./pages/XeroCallbackPage'))
const XeroSyncPage = lazyWithRetry(() => import('./pages/XeroSyncPage'))
const OutlookPage = lazyWithRetry(() => import('./pages/OutlookPage'))
const OneDrivePage = lazyWithRetry(() => import('./pages/OneDrivePage'))
const WorkflowsPage = lazyWithRetry(() => import('./pages/WorkflowsPage'))
const WorkflowAdminPage = lazyWithRetry(() => import('./pages/WorkflowAdminPage'))
const PublicHolidaysPage = lazyWithRetry(() => import('./pages/PublicHolidaysPage'))

// Heavy components: Lazy load with priority (biggest bundle impact)
const MasterSchedulePage = lazyWithRetry(() => import('./pages/MasterSchedulePage')) // 3,952 lines Gantt!
const SmGanttPage = lazyWithRetry(() => import('./pages/SmGanttPage')) // SM Gantt v2 (new system)
const SmSetupPage = lazyWithRetry(() => import('./pages/SmSetupPage')) // SM Gantt setup/admin
const SmResourcesPage = lazyWithRetry(() => import('./pages/SmResourcesPage')) // SM Gantt Phase 2 - Resources
const SmDashboardPage = lazyWithRetry(() => import('./pages/SmDashboardPage')) // SM Gantt Phase 2 - Dashboard
const SmFieldPage = lazyWithRetry(() => import('./pages/SmFieldPage')) // SM Gantt Phase 3 - Mobile Field
const SmAnalyticsPage = lazyWithRetry(() => import('./pages/SmAnalyticsPage')) // SM Gantt Analytics & AI
const PDFMeasurementTestPage = lazyWithRetry(() => import('./pages/PDFMeasurementTestPage')) // PDF library
const DocumentsPage = lazyWithRetry(() => import('./pages/DocumentsPage')) // PDF library
const TrinityPage = lazyWithRetry(() => import('./pages/TrinityPage')) // Trinity documentation viewer
const AgentTasksPage = lazyWithRetry(() => import('./pages/AgentTasksPage')) // Agent task manager
const ChatPage = lazyWithRetry(() => import('./pages/ChatPage')) // AI chat
const TrainingPage = lazyWithRetry(() => import('./pages/TrainingPage')) // Jitsi video
const TrainingSessionPage = lazyWithRetry(() => import('./pages/TrainingSessionPage')) // Jitsi video
const MeetingsPage = lazyWithRetry(() => import('./pages/MeetingsPage')) // Meeting management
const MeetingTypesPage = lazyWithRetry(() => import('./pages/MeetingTypesPage')) // Meeting types configuration
const SamPage = lazyWithRetry(() => import('./pages/SamPage')) // Sam page

// Corporate pages
const CorporateDashboardPage = lazyWithRetry(() => import('./pages/CorporateDashboardPage'))

// Portal pages (subcontractor portal)
const PortalLayout = lazyWithRetry(() => import('./pages/portal/PortalLayout'))
const PortalLogin = lazyWithRetry(() => import('./pages/portal/PortalLogin'))
const PortalDashboard = lazyWithRetry(() => import('./pages/portal/PortalDashboard'))
const PortalQuotes = lazyWithRetry(() => import('./pages/portal/PortalQuotes'))
const PortalJobs = lazyWithRetry(() => import('./pages/portal/PortalJobs'))
const PortalSchedule = lazyWithRetry(() => import('./pages/portal/PortalSchedule'))
const PortalInvoices = lazyWithRetry(() => import('./pages/portal/PortalInvoices'))
const PortalKudos = lazyWithRetry(() => import('./pages/portal/PortalKudos'))
const PortalSettings = lazyWithRetry(() => import('./pages/portal/PortalSettings'))
const PortalPayNow = lazyWithRetry(() => import('./pages/portal/PortalPayNow'))

// WHS (Workplace Health & Safety) pages
const WhsDashboardPage = lazyWithRetry(() => import('./pages/WhsDashboardPage'))
const WhsSwmsPage = lazyWithRetry(() => import('./pages/WhsSwmsPage'))
const WhsInspectionsPage = lazyWithRetry(() => import('./pages/WhsInspectionsPage'))
const WhsIncidentsPage = lazyWithRetry(() => import('./pages/WhsIncidentsPage'))
const WhsInductionsPage = lazyWithRetry(() => import('./pages/WhsInductionsPage'))
const WhsActionItemsPage = lazyWithRetry(() => import('./pages/WhsActionItemsPage'))
const CompaniesPage = lazyWithRetry(() => import('./pages/CompaniesPage'))
const CompanyDetailPage = lazyWithRetry(() => import('./pages/CompanyDetailPage'))
const DirectorsRegistryPage = lazyWithRetry(() => import('./pages/DirectorsRegistryPage'))
const AssetsPage = lazyWithRetry(() => import('./pages/AssetsPage'))
const AssetDetailPage = lazyWithRetry(() => import('./pages/AssetDetailPage'))
const XeroDashboardPage = lazyWithRetry(() => import('./pages/XeroDashboardPage'))

// Financial pages
const FinancialPage = lazyWithRetry(() => import('./pages/FinancialPage'))
const FinancialReportsPage = lazyWithRetry(() => import('./pages/FinancialReportsPage'))

// Designer pages (admin tools)
const DesignerHome = lazyWithRetry(() => import('./pages/designer/DesignerHome'))
const TableSettings = lazyWithRetry(() => import('./pages/designer/TableSettings'))
const TableBuilder = lazyWithRetry(() => import('./pages/designer/TableBuilder'))
const Features = lazyWithRetry(() => import('./pages/designer/Features'))
const Menus = lazyWithRetry(() => import('./pages/designer/Menus'))
const Pages = lazyWithRetry(() => import('./pages/designer/Pages'))
const Experiences = lazyWithRetry(() => import('./pages/designer/Experiences'))

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="flex flex-col items-center gap-4">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      <p className="text-sm text-gray-600 dark:text-gray-400">Loading...</p>
    </div>
  </div>
)

// Component to add _God_LOVES_You_ to all URLs
const URLEnhancer = () => {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    // Check if hash already has the message
    if (!location.hash.includes('_God_LOVES_You_')) {
      const searchPart = location.search || ''
      const newUrl = `${location.pathname}${searchPart}#_God_LOVES_You_`
      navigate(newUrl, { replace: true })
    }
  }, [location.pathname, location.search, location.hash, navigate])

  return null
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <URLEnhancer />
        <CopyConsoleButton />
        <Suspense fallback={<PageLoader />}>
          <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/logout" element={<Logout />} />
        <Route path="/auto-login" element={<AutoLoginPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/dashboard" element={<AppLayout><Dashboard /></AppLayout>} />
        <Route path="/chat" element={<AppLayout><ChatPage /></AppLayout>} />
        <Route path="/jobs" element={<Navigate to="/tables/204/jobs" replace />} />
        <Route path="/active-jobs" element={<Navigate to="/tables/204/jobs" replace />} />
        <Route path="/xest" element={<AppLayout><XestPage /></AppLayout>} />
        <Route path="/documents" element={<AppLayout><DocumentsPage /></AppLayout>} />
        <Route path="/trinity" element={<AppLayout><TrinityPage /></AppLayout>} />
        <Route path="/agents/tasks" element={<AppLayout><AgentTasksPage /></AppLayout>} />
        <Route path="/pdf-measure-test" element={<AppLayout><PDFMeasurementTestPage /></AppLayout>} />
        <Route path="/jobs/:id/setup" element={<AppLayout><JobSetupPage /></AppLayout>} />
        <Route path="/jobs/:id/schedule" element={<AppLayout><MasterSchedulePage /></AppLayout>} />
        <Route path="/jobs/:id/sm-gantt" element={<AppLayout><SmGanttPage /></AppLayout>} />
        <Route path="/jobs/:id/resources" element={<AppLayout><SmResourcesPage /></AppLayout>} />
        <Route path="/admin/sm-setup" element={<AppLayout><SmSetupPage /></AppLayout>} />
        <Route path="/admin/resources" element={<AppLayout><SmResourcesPage /></AppLayout>} />
        <Route path="/admin/sm-dashboard" element={<AppLayout><SmDashboardPage /></AppLayout>} />
        <Route path="/jobs/:id/sm-dashboard" element={<AppLayout><SmDashboardPage /></AppLayout>} />
        <Route path="/jobs/:id/sm-analytics" element={<AppLayout><SmAnalyticsPage /></AppLayout>} />
        <Route path="/jobs/:constructionId/field" element={<SmFieldPage />} />
        <Route path="/jobs/:id/:tab" element={<AppLayout><JobDetailPage /></AppLayout>} />
        <Route path="/jobs/:id" element={<AppLayout><JobDetailPage /></AppLayout>} />
        <Route path="/meetings" element={<AppLayout><MeetingsPage /></AppLayout>} />
        <Route path="/meeting-types" element={<AppLayout><MeetingTypesPage /></AppLayout>} />

        {/* WHS (Workplace Health & Safety) Routes */}
        <Route path="/whs" element={<AppLayout><WhsDashboardPage /></AppLayout>} />
        <Route path="/whs/dashboard" element={<Navigate to="/whs" replace />} />
        <Route path="/whs/swms" element={<Navigate to="/tables/206/whs-swms" replace />} />
        <Route path="/whs/inspections" element={<Navigate to="/tables/209/whs-inspections" replace />} />
        <Route path="/whs/incidents" element={<Navigate to="/tables/210/whs-incidents" replace />} />
        <Route path="/whs/inductions" element={<Navigate to="/tables/208/whs-inductions" replace />} />
        <Route path="/whs/action-items" element={<Navigate to="/tables/207/whs-action-items" replace />} />

        {/* Financial Routes */}
        <Route path="/financial" element={<AppLayout><FinancialPage /></AppLayout>} />
        <Route path="/financial/transactions" element={<Navigate to="/financial" replace />} />
        <Route path="/financial/reports" element={<AppLayout><FinancialReportsPage /></AppLayout>} />
        <Route path="/sam" element={<AppLayout><SamPage /></AppLayout>} />
        <Route path="/price-books" element={<Navigate to="/tables/205/pricebook" replace />} />
        <Route path="/price-books/:id" element={<AppLayout><PriceBookItemDetailPage /></AppLayout>} />
        <Route path="/contacts" element={<Navigate to="/tables/214/contacts" replace />} />
        <Route path="/contacts/:id" element={<AppLayout><ContactDetailPage /></AppLayout>} />
        <Route path="/accounts" element={<AppLayout><AccountsPage /></AppLayout>} />
        <Route path="/users" element={<Navigate to="/tables/212/user-management" replace />} />
        <Route path="/health" element={<AppLayout><HealthPage /></AppLayout>} />
        <Route path="/permissions" element={<Navigate to="/admin/system?tab=permissions" replace />} />
        <Route path="/system/performance" element={<Navigate to="/admin/system?tab=performance" replace />} />
        <Route path="/suppliers" element={<Navigate to="/contacts" replace />} />
        <Route path="/suppliers/new" element={<AppLayout><SupplierNewPage /></AppLayout>} />
        <Route path="/suppliers/:id/edit" element={<AppLayout><SupplierEditPage /></AppLayout>} />
        <Route path="/suppliers/:id" element={<AppLayout><SupplierDetailPage /></AppLayout>} />
        <Route path="/purchase-orders" element={<Navigate to="/tables/217/purchase-orders" replace />} />
        <Route path="/purchase-orders/:id/edit" element={<AppLayout><PurchaseOrderEditPage /></AppLayout>} />
        <Route path="/purchase-orders/:id" element={<AppLayout><PurchaseOrderDetailPage /></AppLayout>} />
        <Route path="/import" element={<AppLayout><ImportPage /></AppLayout>} />
        {/* New format: /tables/{id}/{slug} - shows both ID and slug in URL */}
        <Route path="/tables/:id/:slug" element={<AppLayout><TablePage /></AppLayout>} />
        {/* Legacy format: /tables/{id} - backward compatibility */}
        <Route path="/tables/:id" element={<AppLayout><TablePage /></AppLayout>} />
        <Route path="/embed/tables/:id" element={<TablePage embedded />} />
        <Route path="/embed/tables/:id/:slug" element={<TablePage embedded />} />
        <Route path="/tables/:tableId/columns/new" element={<ColumnEditorPage />} />
        <Route path="/tables/:tableId/columns" element={<ColumnEditorPage />} />
        <Route path="/designer" element={<AppLayout><DesignerHome /></AppLayout>} />
        <Route path="/designer/tables/new" element={<AppLayout><TableBuilder /></AppLayout>} />
        <Route path="/designer/tables/:id" element={<AppLayout><TableSettings /></AppLayout>} />
        <Route path="/designer/menus" element={<AppLayout><Menus /></AppLayout>} />
        <Route path="/designer/pages" element={<AppLayout><Pages /></AppLayout>} />
        <Route path="/designer/experiences" element={<AppLayout><Experiences /></AppLayout>} />
        <Route path="/designer/features" element={
          <AppLayout>
            {({ onOpenGrokChat }) => <Features onOpenGrokChat={onOpenGrokChat} />}
          </AppLayout>
        } />
        <Route path="/admin/system" element={<AppLayout><SystemAdminPage /></AppLayout>} />
        <Route path="/settings/schema" element={<AppLayout><SchemaPage /></AppLayout>} />
        <Route path="/settings/xero/callback" element={<XeroCallbackPage />} />
        <Route path="/table-test" element={<AppLayout><TableStandardTest /></AppLayout>} />
        <Route path="/xero" element={<AppLayout><XeroSyncPage /></AppLayout>} />
        <Route path="/outlook" element={<AppLayout><OutlookPage /></AppLayout>} />
        <Route path="/onedrive" element={<AppLayout><OneDrivePage /></AppLayout>} />
        <Route path="/workflows" element={<AppLayout><WorkflowsPage /></AppLayout>} />
        <Route path="/admin/workflows" element={<AppLayout><WorkflowAdminPage /></AppLayout>} />
        <Route path="/admin/public-holidays" element={<AppLayout><PublicHolidaysPage /></AppLayout>} />
        <Route path="/training" element={<AppLayout><TrainingPage /></AppLayout>} />
        <Route path="/training/:sessionId" element={<TrainingSessionPage />} />

        {/* Corporate routes */}
        <Route path="/corporate" element={<AppLayout><CorporateDashboardPage /></AppLayout>} />
        <Route path="/corporate/dashboard" element={<AppLayout><CorporateDashboardPage /></AppLayout>} />
        <Route path="/corporate/companies" element={<AppLayout><CompaniesPage /></AppLayout>} />
        <Route path="/corporate/companies/new" element={<AppLayout><CompanyDetailPage /></AppLayout>} />
        <Route path="/corporate/companies/:id" element={<AppLayout><CompanyDetailPage /></AppLayout>} />
        <Route path="/corporate/companies/:id/edit" element={<AppLayout><CompanyDetailPage /></AppLayout>} />
        <Route path="/corporate/directors" element={<AppLayout><DirectorsRegistryPage /></AppLayout>} />
        <Route path="/corporate/assets" element={<AppLayout><AssetsPage /></AppLayout>} />
        <Route path="/corporate/assets/new" element={<AppLayout><AssetDetailPage /></AppLayout>} />
        <Route path="/corporate/assets/:id" element={<AppLayout><AssetDetailPage /></AppLayout>} />
        <Route path="/corporate/assets/:id/edit" element={<AppLayout><AssetDetailPage /></AppLayout>} />
        <Route path="/corporate/xero" element={<AppLayout><XeroDashboardPage /></AppLayout>} />

        {/* Portal routes (subcontractor portal) */}
        <Route path="/portal/login" element={<PortalLogin />} />
        <Route path="/portal" element={<PortalLayout />}>
          <Route path="dashboard" element={<PortalDashboard />} />
          <Route path="quotes" element={<PortalQuotes />} />
          <Route path="jobs" element={<PortalJobs />} />
          <Route path="schedule" element={<PortalSchedule />} />
          <Route path="invoices" element={<PortalInvoices />} />
          <Route path="kudos" element={<PortalKudos />} />
          <Route path="settings" element={<PortalSettings />} />
          <Route path="pay-now" element={<PortalPayNow />} />
        </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
