import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import {
  BuildingOfficeIcon,
  UserGroupIcon,
  BanknotesIcon,
  TruckIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  ClockIcon,
  PencilIcon,
  ArrowLeftIcon,
  UsersIcon,
  ArrowsRightLeftIcon,
  CurrencyDollarIcon,
  DocumentDuplicateIcon,
  FolderIcon,
  HeartIcon
} from '@heroicons/react/24/outline'
import { api } from '../api'
import CompanyFinancialTab from '../components/corporate/CompanyFinancialTab'
import CompanyAssetsTab from '../components/corporate/CompanyAssetsTab'
import CompanyComplianceTab from '../components/corporate/CompanyComplianceTab'
import CompanyDocumentsTab from '../components/corporate/CompanyDocumentsTab'
import CompanyActivityTab from '../components/corporate/CompanyActivityTab'
import CompanyShareholdingsTab from '../components/corporate/CompanyShareholdingsTab'
import CompanyLoansTab from '../components/corporate/CompanyLoansTab'
import CompanyDividendsTab from '../components/corporate/CompanyDividendsTab'
import CompanyMinutesTab from '../components/corporate/CompanyMinutesTab'
import CompanyDirectorsTab from '../components/corporate/CompanyDirectorsTab'
import CompanyHealthTab from '../components/corporate/CompanyHealthTab'

export default function CompanyDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'overview'

  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const [overviewSubTab, setOverviewSubTab] = useState('info')

  const tabs = [
    { id: 'overview', name: 'Overview', icon: BuildingOfficeIcon },
    { id: 'advice', name: 'ADVICE', icon: ClipboardDocumentCheckIcon, docTab: 'ADVICE' },
    { id: 'asic', name: 'ASIC', icon: DocumentTextIcon, docTab: 'ASIC' },
    { id: 'assets-docs', name: 'ASSETS', icon: TruckIcon, docTab: 'ASSETS' },
    { id: 'ato', name: 'ATO', icon: DocumentTextIcon, docTab: 'ATO' },
    { id: 'bank', name: 'BANK', icon: BanknotesIcon, docTab: 'BANK' },
    { id: 'company', name: 'COMPANY', icon: BuildingOfficeIcon, docTab: 'COMPANY' },
    { id: 'dividends-docs', name: 'DIVIDENDS', icon: CurrencyDollarIcon, docTab: 'DIVIDENDS' },
    { id: 'financials', name: 'FINANCIALS', icon: DocumentTextIcon, docTab: 'FINANCIALS' },
    { id: 'general', name: 'GENERAL', icon: FolderIcon, docTab: 'GENERAL' },
    { id: 'insurance', name: 'INSURANCE', icon: HeartIcon, docTab: 'INSURANCE' },
    { id: 'loans-docs', name: 'LOANS', icon: ArrowsRightLeftIcon, docTab: 'LOANS' },
    { id: 'minutes-docs', name: 'MINUTES', icon: DocumentDuplicateIcon, docTab: 'MINUTES' },
    { id: 'registry', name: 'REGISTRY', icon: DocumentTextIcon, docTab: 'REGISTRY' },
    { id: 'trust', name: 'TRUST', icon: UsersIcon, docTab: 'TRUST' },
    { id: 'documents', name: 'Documents', icon: DocumentTextIcon },
    { id: 'activity', name: 'Activity', icon: ClockIcon }
  ]

  const overviewSubTabs = [
    { id: 'info', name: 'Information' },
    { id: 'health', name: 'Health' },
    { id: 'directors', name: 'Directors' },
    { id: 'shareholdings', name: 'Shareholdings' }
  ]

  const isNewCompany = !id

  useEffect(() => {
    if (id) {
      loadCompany()
    } else {
      setLoading(false)
    }
  }, [id])

  const loadCompany = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/v1/companies/${id}`)
      setCompany(response.company)
    } catch (error) {
      console.error('Failed to load company:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTabChange = (tabId) => {
    setSearchParams({ tab: tabId })
  }

  // Get SharePoint URL for company folder
  const getSharePointUrl = () => {
    // Use company's specific SharePoint folder URL if available
    if (company.sharepoint_folder_url) {
      return company.sharepoint_folder_url
    }
    // Fallback to general Corporate File folder
    return `https://gotekna-my.sharepoint.com/personal/robert_tekna_com_au/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Frobert%5Ftekna%5Fcom%5Fau%2FDocuments%2FAccounts%20%2D%20Internal%2FCorporate%20File`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading company...</div>
      </div>
    )
  }

  if (!company && !isNewCompany) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Company not found</div>
      </div>
    )
  }

  // TODO: Add new company form when isNewCompany is true
  if (isNewCompany) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/corporate/companies')}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Companies
        </button>
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">New Company</h1>
          <p className="text-gray-500">Company creation form coming soon...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Fixed Header with Tabs */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          {/* Back Button */}
          <button
            onClick={() => navigate('/corporate/companies')}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Companies
          </button>

          {/* Header */}
          <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <BuildingOfficeIcon className="h-10 w-10 text-gray-400 mr-4" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
                <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                  {company.formatted_acn && (
                    <span>ACN: {company.formatted_acn}</span>
                  )}
                  {company.formatted_abn && (
                    <span>ABN: {company.formatted_abn}</span>
                  )}
                  {(company.company_group || company.group_name) && (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                      {typeof company.company_group === 'string'
                        ? company.company_group.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                        : (company.company_group?.name || company.group_name || '')}
                    </span>
                  )}
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    company.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {company.status}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={getSharePointUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 shadow-sm ring-1 ring-inset ring-blue-200 hover:bg-blue-100"
              >
                <FolderIcon className="h-4 w-4 mr-2" />
                SharePoint
              </a>
              <button
                onClick={() => navigate(`/corporate/companies/${id}/edit`)}
                className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              >
                <PencilIcon className="h-4 w-4 mr-2" />
                Edit
              </button>
            </div>
          </div>
        </div>
      </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 -mb-px mt-4">
            <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`
                      group inline-flex items-center border-b-2 py-4 px-1 text-sm font-medium
                      ${isActive
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      }
                    `}
                  >
                    <Icon
                      className={`
                        -ml-0.5 mr-2 h-5 w-5
                        ${isActive ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'}
                      `}
                    />
                    {tab.name}
                  </button>
                )
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-none p-6">
        {/* Tab Content */}
        <div className="bg-white shadow rounded-lg p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Overview Sub-tabs */}
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                {overviewSubTabs.map((subTab) => (
                  <button
                    key={subTab.id}
                    onClick={() => setOverviewSubTab(subTab.id)}
                    className={`
                      border-b-2 py-2 px-1 text-sm font-medium
                      ${overviewSubTab === subTab.id
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      }
                    `}
                  >
                    {subTab.name}
                  </button>
                ))}
              </nav>
            </div>

            {/* Overview Sub-tab Content */}
            {overviewSubTab === 'info' && <OverviewTab company={company} />}
            {overviewSubTab === 'health' && <CompanyHealthTab company={company} onUpdate={loadCompany} />}
            {overviewSubTab === 'directors' && <CompanyDirectorsTab company={company} onUpdate={loadCompany} />}
            {overviewSubTab === 'shareholdings' && <CompanyShareholdingsTab company={company} onUpdate={loadCompany} />}
          </div>
        )}

        {/* Document Category Tabs - each shows CompanyDocumentsTab filtered to that category */}
        {tabs.find(t => t.id === activeTab)?.docTab && (
          <CompanyDocumentsTab
            company={company}
            onUpdate={loadCompany}
            initialTab={tabs.find(t => t.id === activeTab).docTab}
          />
        )}

        {/* All Documents Tab */}
        {activeTab === 'documents' && <CompanyDocumentsTab company={company} onUpdate={loadCompany} />}

        {/* Activity Tab */}
        {activeTab === 'activity' && <CompanyActivityTab company={company} />}
        </div>
      </div>
    </div>
  )
}

// Placeholder tab components (we'll create full versions later)
function OverviewTab({ company }) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Company Information</h3>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-medium text-gray-500">Legal Name</dt>
          <dd className="mt-1 text-sm text-gray-900">{company.name}</dd>
        </div>
        {company.date_incorporated && (
          <div>
            <dt className="text-sm font-medium text-gray-500">Date Incorporated</dt>
            <dd className="mt-1 text-sm text-gray-900">{new Date(company.date_incorporated).toLocaleDateString()}</dd>
          </div>
        )}
        {company.registered_office_address && (
          <div>
            <dt className="text-sm font-medium text-gray-500">Registered Office</dt>
            <dd className="mt-1 text-sm text-gray-900">{company.registered_office_address}</dd>
          </div>
        )}
        {company.principal_place_of_business && (
          <div>
            <dt className="text-sm font-medium text-gray-500">Principal Place of Business</dt>
            <dd className="mt-1 text-sm text-gray-900">{company.principal_place_of_business}</dd>
          </div>
        )}
        {company.is_trustee && (
          <div>
            <dt className="text-sm font-medium text-gray-500">Trust Name</dt>
            <dd className="mt-1 text-sm text-gray-900">{company.trust_name || 'N/A'}</dd>
          </div>
        )}
        {company.gst_registration_status && (
          <div>
            <dt className="text-sm font-medium text-gray-500">GST Status</dt>
            <dd className="mt-1 text-sm text-gray-900">{company.gst_registration_status}</dd>
          </div>
        )}
      </dl>

      {company.current_directors && company.current_directors.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-500 mb-2">Current Directors</h4>
          <ul className="space-y-2">
            {company.current_directors.map((director) => (
              <li key={director.id} className="text-sm text-gray-900">
                {director.full_name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

