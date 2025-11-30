import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRightIcon,
  ChevronDownIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline'
import { api } from '../api'
import Toast from '../components/Toast'

// Shape icons matching the family trust diagram
// Rectangle for Company
const CompanyIcon = ({ className = "h-5 w-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="5" width="18" height="14" rx="1" />
  </svg>
)

// Triangle for Trust
const TrustIcon = ({ className = "h-5 w-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 3L22 20H2L12 3Z" strokeLinejoin="round" />
  </svg>
)

// Circle/Oval for Person
const PersonIcon = ({ className = "h-5 w-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <ellipse cx="12" cy="12" rx="9" ry="7" />
  </svg>
)

// Diamond for Superfund
const SuperfundIcon = ({ className = "h-5 w-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2L22 12L12 22L2 12L12 2Z" strokeLinejoin="round" />
  </svg>
)

// Get the appropriate icon for an entity type
const getEntityIcon = (entityType, className = "h-5 w-5") => {
  switch (entityType?.toLowerCase()) {
    case 'trust':
      return <TrustIcon className={className} />
    case 'superfund':
      return <SuperfundIcon className={className} />
    case 'person':
      return <PersonIcon className={className} />
    case 'company':
    default:
      return <CompanyIcon className={className} />
  }
}

// Get color class for entity type
const getEntityColor = (entityType, isTrustee = false) => {
  if (isTrustee) return 'text-purple-600'
  switch (entityType?.toLowerCase()) {
    case 'trust':
      return 'text-rose-500'
    case 'superfund':
      return 'text-amber-600'
    case 'person':
      return 'text-teal-600'
    case 'company':
    default:
      return 'text-blue-600'
  }
}

// Recursive component to render company hierarchy tree
function CompanyTreeNode({ company, level = 0, expandedNodes, toggleNode, navigate }) {
  const isExpanded = expandedNodes.has(company.id)
  const hasChildren = company.children && company.children.length > 0
  const paddingLeft = level * 24

  return (
    <div>
      {/* Company row */}
      <div
        className={`flex items-center py-2 px-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 ${
          level === 0 ? 'bg-gray-50 font-medium' : ''
        }`}
        style={{ paddingLeft: `${paddingLeft + 12}px` }}
      >
        {/* Expand/Collapse button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (hasChildren) toggleNode(company.id)
          }}
          className={`mr-2 p-0.5 rounded ${hasChildren ? 'hover:bg-gray-200' : 'invisible'}`}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDownIcon className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRightIcon className="h-4 w-4 text-gray-500" />
            )
          ) : (
            <span className="h-4 w-4" />
          )}
        </button>

        {/* Entity icon - shape based on type */}
        <div className={`flex-shrink-0 mr-3 ${getEntityColor(company.entity_type, company.is_trustee)}`}>
          {getEntityIcon(company.entity_type)}
        </div>

        {/* Company details */}
        <div
          className="flex-1 min-w-0"
          onClick={() => navigate(`/corporate/companies/${company.id}`)}
        >
          <div className="flex items-center gap-2">
            <span className={`truncate ${level === 0 ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
              {company.name}
            </span>
            {company.abbreviation && (
              <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                {company.abbreviation}
              </span>
            )}
            {company.is_trustee && (
              <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded">
                Trustee
              </span>
            )}
            {/* Show ATF (As Trustee For) when trustee and collapsed or always */}
            {company.is_trustee && company.trust_name && (
              <span className="text-xs text-purple-600 dark:text-purple-400 italic">
                ATF {company.trust_name}
              </span>
            )}
            {/* Show "of Trust" for trust entities that are children of trustees */}
            {company.is_trust_of_trustee && (
              <span className="text-xs text-rose-500 dark:text-rose-400 italic">
                (Trust)
              </span>
            )}
          </div>
          {company.acn && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              ACN: {company.acn}
            </div>
          )}
        </div>

        {/* Ownership percentage (if child) */}
        {level > 0 && company.ownership_percentage && (
          <div className="text-sm text-gray-500 mr-4">
            {company.ownership_percentage}%
          </div>
        )}

        {/* Quick stats */}
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {company.shareholders && company.shareholders.length > 0 && (
            <span className="flex items-center gap-1">
              <UserGroupIcon className="h-3.5 w-3.5" />
              {company.shareholders.length}
            </span>
          )}
          {company.investments && company.investments.length > 0 && (
            <span className="flex items-center gap-1">
              <CurrencyDollarIcon className="h-3.5 w-3.5" />
              {company.investments.length}
            </span>
          )}
        </div>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {company.children.map((child) => (
            <CompanyTreeNode
              key={child.id}
              company={child}
              level={level + 1}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
              navigate={navigate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function CompanyGroupsPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [structure, setStructure] = useState(null)
  const [expandedNodes, setExpandedNodes] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [toast, setToast] = useState(null)
  const [viewMode, setViewMode] = useState('tree') // 'tree' or 'table'

  useEffect(() => {
    loadGroups()
  }, [])

  useEffect(() => {
    if (selectedGroup) {
      loadStructure(selectedGroup.id)
    }
  }, [selectedGroup])

  const loadGroups = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/v1/company_groups')
      const groupsList = response.data || []
      setGroups(groupsList)

      // Auto-select first active group
      const activeGroup = groupsList.find(g => g.active) || groupsList[0]
      if (activeGroup) {
        setSelectedGroup(activeGroup)
      }
    } catch (error) {
      console.error('Failed to load company groups:', error)
      setToast({ message: 'Failed to load company groups', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const loadStructure = async (groupId) => {
    try {
      const response = await api.get(`/api/v1/company_groups/${groupId}/structure`)
      setStructure(response.data)

      // Expand all top-level companies by default
      const topLevelIds = new Set(response.data.companies?.map(c => c.id) || [])
      setExpandedNodes(topLevelIds)
    } catch (error) {
      console.error('Failed to load structure:', error)
      setToast({ message: 'Failed to load group structure', type: 'error' })
    }
  }

  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }

  const expandAll = () => {
    if (!structure?.companies) return

    const getAllIds = (companies) => {
      let ids = []
      companies.forEach(c => {
        ids.push(c.id)
        if (c.children) {
          ids = ids.concat(getAllIds(c.children))
        }
      })
      return ids
    }

    setExpandedNodes(new Set(getAllIds(structure.companies)))
  }

  const collapseAll = () => {
    setExpandedNodes(new Set())
  }

  // Filter companies based on search
  const filterCompanies = (companies, query) => {
    if (!query) return companies

    return companies.map(company => {
      const matches =
        company.name?.toLowerCase().includes(query.toLowerCase()) ||
        company.abbreviation?.toLowerCase().includes(query.toLowerCase()) ||
        company.acn?.includes(query)

      const filteredChildren = company.children ? filterCompanies(company.children, query) : []

      if (matches || filteredChildren.length > 0) {
        return { ...company, children: filteredChildren }
      }
      return null
    }).filter(Boolean)
  }

  const filteredCompanies = structure?.companies ? filterCompanies(structure.companies, searchQuery) : []

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading company groups...</div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Company Groups</h1>
            <p className="mt-1 text-sm text-gray-500">
              View ownership structure and hierarchy
            </p>
          </div>
          <button
            onClick={() => navigate('/corporate/companies/new')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="h-5 w-5" />
            Add Company
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Group selector */}
        <div className="w-64 border-r border-gray-200 bg-gray-50 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-medium text-gray-900 mb-3">Groups</h2>
            <div className="space-y-1">
              {groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => setSelectedGroup(group)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedGroup?.id === group.id
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{group.name}</span>
                    <span className="text-xs text-gray-500">{group.companies_count}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Stats for selected group */}
          {structure?.stats && (
            <div className="p-4 border-t border-gray-200">
              <h2 className="text-sm font-medium text-gray-900 mb-3">Statistics</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Companies</span>
                  <span className="font-medium">{structure.stats.total_companies}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Top Level</span>
                  <span className="font-medium">{structure.stats.top_level_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Trustees</span>
                  <span className="font-medium text-purple-600">{structure.stats.trustees_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Trusts</span>
                  <span className="font-medium text-purple-600">{structure.stats.trusts_count}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main content - Structure tree */}
        <div className="flex-1 overflow-hidden flex flex-col bg-white">
          {/* Toolbar */}
          <div className="border-b border-gray-200 px-4 py-3 flex items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search companies..."
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* View controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={expandAll}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
              >
                Collapse All
              </button>
            </div>
          </div>

          {/* Tree view */}
          <div className="flex-1 overflow-y-auto">
            {selectedGroup ? (
              filteredCompanies.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {filteredCompanies.map((company) => (
                    <CompanyTreeNode
                      key={company.id}
                      company={company}
                      level={0}
                      expandedNodes={expandedNodes}
                      toggleNode={toggleNode}
                      navigate={navigate}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-500">
                  {searchQuery ? 'No companies match your search' : 'No companies in this group'}
                </div>
              )
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-500">
                Select a group to view its structure
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="border-t border-gray-200 px-4 py-3 bg-gray-50">
            <div className="flex items-center gap-6 text-xs text-gray-600">
              <span className="font-medium text-gray-500">Legend:</span>
              <div className="flex items-center gap-1.5">
                <CompanyIcon className="h-4 w-4 text-blue-600" />
                <span>Company</span>
              </div>
              <div className="flex items-center gap-1.5">
                <TrustIcon className="h-4 w-4 text-rose-500" />
                <span>Trust</span>
              </div>
              <div className="flex items-center gap-1.5">
                <SuperfundIcon className="h-4 w-4 text-amber-600" />
                <span>Superfund</span>
              </div>
              <div className="flex items-center gap-1.5">
                <PersonIcon className="h-4 w-4 text-teal-600" />
                <span>Person</span>
              </div>
              <div className="border-l border-gray-300 h-4 mx-1" />
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px]">Trustee</span>
                <span>Acts as trustee</span>
              </div>
              <div className="flex items-center gap-1.5">
                <UserGroupIcon className="h-4 w-4" />
                <span>Shareholders</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CurrencyDollarIcon className="h-4 w-4" />
                <span>Investments</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
