import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import AppLayout from './components/layout/AppLayout'
import CopyConsoleButton from './components/CopyConsoleButton'

// Eager load: Critical pages that should load immediately
import Dashboard from './pages/Dashboard'
import AuthCallback from './pages/AuthCallback'
import AutoLoginPage from './pages/AutoLoginPage'
import Login from './pages/Login'

// Lazy load: Everything else (loads on-demand)
const ActiveJobsPage = lazy(() => import('./pages/ActiveJobsPage'))
const XestPage = lazy(() => import('./pages/XestPage'))
const JobDetailPage = lazy(() => import('./pages/JobDetailPage'))
const JobSetupPage = lazy(() => import('./pages/JobSetupPage'))
const PriceBooksPage = lazy(() => import('./pages/PriceBooksPage'))
const PriceBooksPageWithTabs = lazy(() => import('./pages/PriceBooksPageWithTabs'))
const PriceBookItemDetailPage = lazy(() => import('./pages/PriceBookItemDetailPage'))
const ContactsPage = lazy(() => import('./pages/ContactsPage'))
const ContactDetailPage = lazy(() => import('./pages/ContactDetailPage'))
const AccountsPage = lazy(() => import('./pages/AccountsPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const SystemAdminPage = lazy(() => import('./pages/SystemAdminPage'))
const HealthPage = lazy(() => import('./pages/HealthPage'))
const PurchaseOrderDetailPage = lazy(() => import('./pages/PurchaseOrderDetailPage'))
const PurchaseOrderEditPage = lazy(() => import('./pages/PurchaseOrderEditPage'))
const PurchaseOrdersPage = lazy(() => import('./pages/PurchaseOrdersPage'))
const SupplierDetailPage = lazy(() => import('./pages/SupplierDetailPage'))
const SupplierEditPage = lazy(() => import('./pages/SupplierEditPage'))
const SupplierNewPage = lazy(() => import('./pages/SupplierNewPage'))
const ImportPage = lazy(() => import('./pages/ImportPage'))
const TablePage = lazy(() => import('./pages/TablePage'))
const SchemaPage = lazy(() => import('./pages/SchemaPage'))
const TableStandardTest = lazy(() => import('./pages/TableStandardTest'))
const ColumnEditorPage = lazy(() => import('./pages/ColumnEditorPage'))
const XeroCallbackPage = lazy(() => import('./pages/XeroCallbackPage'))
const XeroSyncPage = lazy(() => import('./pages/XeroSyncPage'))
const OutlookPage = lazy(() => import('./pages/OutlookPage'))
const OneDrivePage = lazy(() => import('./pages/OneDrivePage'))
const WorkflowsPage = lazy(() => import('./pages/WorkflowsPage'))
const WorkflowAdminPage = lazy(() => import('./pages/WorkflowAdminPage'))
const PublicHolidaysPage = lazy(() => import('./pages/PublicHolidaysPage'))

// Heavy components: Lazy load with priority (biggest bundle impact)
const MasterSchedulePage = lazy(() => import('./pages/MasterSchedulePage')) // 3,952 lines Gantt!
const SmGanttPage = lazy(() => import('./pages/SmGanttPage')) // SM Gantt v2 (new system)
const SmSetupPage = lazy(() => import('./pages/SmSetupPage')) // SM Gantt setup/admin
const SmResourcesPage = lazy(() => import('./pages/SmResourcesPage')) // SM Gantt Phase 2 - Resources
const SmDashboardPage = lazy(() => import('./pages/SmDashboardPage')) // SM Gantt Phase 2 - Dashboard
const SmFieldPage = lazy(() => import('./pages/SmFieldPage')) // SM Gantt Phase 3 - Mobile Field
const SmAnalyticsPage = lazy(() => import('./pages/SmAnalyticsPage')) // SM Gantt Analytics & AI
const PDFMeasurementTestPage = lazy(() => import('./pages/PDFMeasurementTestPage')) // PDF library
const DocumentsPage = lazy(() => import('./pages/DocumentsPage')) // PDF library
const TrinityPage = lazy(() => import('./pages/TrinityPage')) // Trinity documentation viewer
const AgentTasksPage = lazy(() => import('./pages/AgentTasksPage')) // Agent task manager
const ChatPage = lazy(() => import('./pages/ChatPage')) // AI chat
const TrainingPage = lazy(() => import('./pages/TrainingPage')) // Jitsi video
const TrainingSessionPage = lazy(() => import('./pages/TrainingSessionPage')) // Jitsi video
const MeetingsPage = lazy(() => import('./pages/MeetingsPage')) // Meeting management
const MeetingTypesPage = lazy(() => import('./pages/MeetingTypesPage')) // Meeting types configuration
const SamPage = lazy(() => import('./pages/SamPage')) // Sam page

// Corporate pages
const CorporateDashboardPage = lazy(() => import('./pages/CorporateDashboardPage'))

// Portal pages (subcontractor portal)
const PortalLayout = lazy(() => import('./pages/portal/PortalLayout'))
const PortalLogin = lazy(() => import('./pages/portal/PortalLogin'))
const PortalDashboard = lazy(() => import('./pages/portal/PortalDashboard'))
const PortalQuotes = lazy(() => import('./pages/portal/PortalQuotes'))
const PortalJobs = lazy(() => import('./pages/portal/PortalJobs'))
const PortalSchedule = lazy(() => import('./pages/portal/PortalSchedule'))
const PortalInvoices = lazy(() => import('./pages/portal/PortalInvoices'))
const PortalKudos = lazy(() => import('./pages/portal/PortalKudos'))
const PortalSettings = lazy(() => import('./pages/portal/PortalSettings'))
const PortalPayNow = lazy(() => import('./pages/portal/PortalPayNow'))

// WHS (Workplace Health & Safety) pages
const WhsDashboardPage = lazy(() => import('./pages/WhsDashboardPage'))
const WhsSwmsPage = lazy(() => import('./pages/WhsSwmsPage'))
const WhsInspectionsPage = lazy(() => import('./pages/WhsInspectionsPage'))
const WhsIncidentsPage = lazy(() => import('./pages/WhsIncidentsPage'))
const WhsInductionsPage = lazy(() => import('./pages/WhsInductionsPage'))
const WhsActionItemsPage = lazy(() => import('./pages/WhsActionItemsPage'))
const CompaniesPage = lazy(() => import('./pages/CompaniesPage'))
const CompanyDetailPage = lazy(() => import('./pages/CompanyDetailPage'))
const DirectorsRegistryPage = lazy(() => import('./pages/DirectorsRegistryPage'))
const AssetsPage = lazy(() => import('./pages/AssetsPage'))
const AssetDetailPage = lazy(() => import('./pages/AssetDetailPage'))
const XeroDashboardPage = lazy(() => import('./pages/XeroDashboardPage'))

// Financial pages
const FinancialPage = lazy(() => import('./pages/FinancialPage'))
const FinancialReportsPage = lazy(() => import('./pages/FinancialReportsPage'))

// Designer pages (admin tools)
const DesignerHome = lazy(() => import('./pages/designer/DesignerHome'))
const TableSettings = lazy(() => import('./pages/designer/TableSettings'))
const TableBuilder = lazy(() => import('./pages/designer/TableBuilder'))
const Features = lazy(() => import('./pages/designer/Features'))
const Menus = lazy(() => import('./pages/designer/Menus'))
const Pages = lazy(() => import('./pages/designer/Pages'))
const Experiences = lazy(() => import('./pages/designer/Experiences'))

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
        <Route path="/auto-login" element={<AutoLoginPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/dashboard" element={<AppLayout><Dashboard /></AppLayout>} />
        <Route path="/chat" element={<AppLayout><ChatPage /></AppLayout>} />
        <Route path="/active-jobs" element={<AppLayout><ActiveJobsPage /></AppLayout>} />
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
        <Route path="/whs/swms" element={<AppLayout><WhsSwmsPage /></AppLayout>} />
        <Route path="/whs/inspections" element={<AppLayout><WhsInspectionsPage /></AppLayout>} />
        <Route path="/whs/incidents" element={<AppLayout><WhsIncidentsPage /></AppLayout>} />
        <Route path="/whs/inductions" element={<AppLayout><WhsInductionsPage /></AppLayout>} />
        <Route path="/whs/action-items" element={<AppLayout><WhsActionItemsPage /></AppLayout>} />

        {/* Financial Routes */}
        <Route path="/financial" element={<AppLayout><FinancialPage /></AppLayout>} />
        <Route path="/financial/transactions" element={<Navigate to="/financial" replace />} />
        <Route path="/financial/reports" element={<AppLayout><FinancialReportsPage /></AppLayout>} />
        <Route path="/sam" element={<AppLayout><SamPage /></AppLayout>} />
        <Route path="/price-books" element={<AppLayout><PriceBooksPageWithTabs /></AppLayout>} />
        <Route path="/price-books/:id" element={<AppLayout><PriceBookItemDetailPage /></AppLayout>} />
        <Route path="/contacts" element={<AppLayout><ContactsPage /></AppLayout>} />
        <Route path="/contacts/:id" element={<AppLayout><ContactDetailPage /></AppLayout>} />
        <Route path="/accounts" element={<AppLayout><AccountsPage /></AppLayout>} />
        <Route path="/users" element={<AppLayout><UsersPage /></AppLayout>} />
        <Route path="/health" element={<AppLayout><HealthPage /></AppLayout>} />
        <Route path="/permissions" element={<Navigate to="/admin/system?tab=permissions" replace />} />
        <Route path="/system/performance" element={<Navigate to="/admin/system?tab=performance" replace />} />
        <Route path="/suppliers" element={<Navigate to="/contacts" replace />} />
        <Route path="/suppliers/new" element={<AppLayout><SupplierNewPage /></AppLayout>} />
        <Route path="/suppliers/:id/edit" element={<AppLayout><SupplierEditPage /></AppLayout>} />
        <Route path="/suppliers/:id" element={<AppLayout><SupplierDetailPage /></AppLayout>} />
        <Route path="/purchase-orders" element={<AppLayout><PurchaseOrdersPage /></AppLayout>} />
        <Route path="/purchase-orders/:id/edit" element={<AppLayout><PurchaseOrderEditPage /></AppLayout>} />
        <Route path="/purchase-orders/:id" element={<AppLayout><PurchaseOrderDetailPage /></AppLayout>} />
        <Route path="/import" element={<AppLayout><ImportPage /></AppLayout>} />
        <Route path="/tables/:id" element={<AppLayout><TablePage /></AppLayout>} />
        <Route path="/embed/tables/:id" element={<TablePage embedded />} />
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
