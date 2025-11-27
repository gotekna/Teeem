import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UserIcon,
  PlusIcon,
  TrashIcon,
  StarIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  WrenchScrewdriverIcon,
  CalculatorIcon,
  CurrencyDollarIcon,
  ClipboardDocumentListIcon,
  LinkIcon,
  EnvelopeIcon,
  PhoneIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  HomeIcon,
  BriefcaseIcon,
  HomeModernIcon,
  BuildingStorefrontIcon,
  WrenchIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'
import { api } from '../../api'

// Role definitions with labels and icons - grouped by category
const ROLE_GROUPS = [
  {
    key: 'client',
    label: 'Client Roles',
    icon: BuildingOfficeIcon,
    roles: [
      { key: 'client', label: 'Client', icon: BuildingOfficeIcon, color: 'indigo' },
      { key: 'client_representative', label: 'Client Representative', icon: UserIcon, color: 'blue' },
      { key: 'client_broker', label: 'Client Broker', icon: UserIcon, color: 'cyan' },
      { key: 'client_bank', label: 'Client Bank', icon: BuildingOfficeIcon, color: 'slate' },
    ]
  },
  {
    key: 'external',
    label: 'External Team',
    icon: UserGroupIcon,
    roles: [
      { key: 'external_sales', label: 'External Sales', icon: CurrencyDollarIcon, color: 'pink' },
    ]
  },
  {
    key: 'internal',
    label: 'Internal Team',
    icon: UserGroupIcon,
    roles: [
      { key: 'supervisor', label: 'Supervisor', icon: WrenchScrewdriverIcon, color: 'orange' },
      { key: 'site_coordinator', label: 'Site Coordinator', icon: ClipboardDocumentListIcon, color: 'amber' },
      { key: 'estimator', label: 'Estimator', icon: CalculatorIcon, color: 'green' },
      { key: 'internal_sales', label: 'Internal Sales', icon: CurrencyDollarIcon, color: 'purple' },
      { key: 'coordinator', label: 'Client Coordinator', icon: ClipboardDocumentListIcon, color: 'teal' },
    ]
  }
]

// Flat list of all roles for lookups
const ROLE_TYPES = ROLE_GROUPS.flatMap(g => g.roles)

const getRoleConfig = (roleKey) => {
  return ROLE_TYPES.find(r => r.key === roleKey) || { label: roleKey || 'Contact', icon: UserIcon, color: 'gray' }
}

const getRoleBadgeClasses = (color) => {
  const colorMap = {
    indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-400',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400',
    cyan: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-400',
    slate: 'bg-slate-100 dark:bg-slate-900/30 text-slate-800 dark:text-slate-400',
    orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400',
    pink: 'bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-400',
    teal: 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-400',
    gray: 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-400',
  }
  return colorMap[color] || colorMap.gray
}

// Format relationship type for display
const formatRelationshipType = (type) => {
  const typeLabels = {
    employee_of: 'Employee of',
    contractor_for: 'Contractor for',
    director_of: 'Director of',
    shareholder_of: 'Shareholder of',
    authorized_signatory_of: 'Authorized Signatory of',
    beneficial_owner_of: 'Beneficial Owner of',
    trustee_of: 'Trustee of',
    beneficiary_of: 'Beneficiary of',
    appointor_of: 'Appointor of',
    owner_of: 'Owner of',
    co_owner_with: 'Co-owner with',
    partner_in: 'Partner in',
    parent_company: 'Parent Company',
    subsidiary: 'Subsidiary',
    previous_client: 'Previous Client',
    referral: 'Referral',
    supplier_alternate: 'Supplier Alternate',
    related_project: 'Related Project',
    family_member: 'Family Member',
    other: 'Related to'
  }
  return typeLabels[type] || type?.replace(/_/g, ' ') || 'Related to'
}

// Internal team roles that use users instead of contacts
const INTERNAL_ROLES = ['supervisor', 'site_coordinator', 'estimator', 'internal_sales', 'coordinator']

// Job type icon mapping - maps icon names from API to actual icon components
const ICON_COMPONENTS = {
  'HomeIcon': HomeIcon,
  'BuildingOfficeIcon': BuildingOfficeIcon,
  'UserGroupIcon': UserGroupIcon,
  'HomeModernIcon': HomeModernIcon,
  'WrenchIcon': WrenchIcon,
  'BuildingStorefrontIcon': BuildingStorefrontIcon,
  'SparklesIcon': SparklesIcon,
  'BriefcaseIcon': BriefcaseIcon,
}

const getIconComponent = (iconName) => {
  return ICON_COMPONENTS[iconName] || BriefcaseIcon
}

// Job counts by type component
function JobCountsByType({ contactId }) {
  const [jobCounts, setJobCounts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchJobCounts = async () => {
      if (!contactId) {
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        const response = await api.get('/api/v1/jobs', {
          params: { contact_id: contactId, per_page: 100 }
        })
        const jobs = response.jobs || []

        // Group jobs by type (using type id as key to handle same name correctly)
        const countsByType = {}
        jobs.forEach(job => {
          const typeId = job.job_type?.id || 'unassigned'
          const typeName = job.job_type?.name || 'Unassigned'
          const typeIcon = job.job_type?.icon || 'BriefcaseIcon'
          if (!countsByType[typeId]) {
            countsByType[typeId] = { name: typeName, icon: typeIcon, count: 0 }
          }
          countsByType[typeId].count++
        })

        // Convert to array for rendering, sorted by count descending
        const countsArray = Object.values(countsByType)
          .map(({ name, icon, count }) => ({
            name,
            count,
            Icon: getIconComponent(icon)
          }))
          .sort((a, b) => b.count - a.count)

        setJobCounts(countsArray)
      } catch {
        setJobCounts([])
      } finally {
        setLoading(false)
      }
    }
    fetchJobCounts()
  }, [contactId])

  if (loading) {
    return <div className="animate-pulse h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
  }

  if (jobCounts.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {jobCounts.map(({ name, count, Icon }) => (
        <div
          key={name}
          className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400"
          title={`${count} ${name} job${count !== 1 ? 's' : ''}`}
        >
          <Icon className="h-4 w-4" />
          <span className="font-medium">{count}</span>
        </div>
      ))}
    </div>
  )
}

// Contact Card Component - shows detailed contact info in expanded view
function ContactCard({ contact, roleConfig, isPrimary, navigate }) {
  const [expanded, setExpanded] = useState(false)

  const displayName = contact.contact?.full_name || contact.contact?.company_name || 'Unknown'
  const email = contact.contact?.email
  const mobile = contact.contact?.mobile_phone
  const relationships = contact.relationships || []
  const relationshipsCount = contact.relationships_count || 0

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => navigate(`/contacts/${contact.contact_id}`)}
              className="font-medium text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 truncate block"
            >
              {displayName}
            </button>
            <JobCountsByType contactId={contact.contact_id} />
          </div>

          <div className="flex flex-wrap gap-1 mt-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRoleBadgeClasses(roleConfig.color)}`}>
              {roleConfig.label}
            </span>
            {isPrimary && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                Primary
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1">
        {email && (
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <EnvelopeIcon className="h-3.5 w-3.5 flex-shrink-0" />
            <a href={`mailto:${email}`} className="hover:text-indigo-600 truncate">
              {email}
            </a>
          </div>
        )}
        {mobile && (
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <PhoneIcon className="h-3.5 w-3.5 flex-shrink-0" />
            <a href={`tel:${mobile}`} className="hover:text-indigo-600">
              {mobile}
            </a>
          </div>
        )}
      </div>

      {relationshipsCount > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
          >
            {expanded ? (
              <ChevronDownIcon className="h-3.5 w-3.5" />
            ) : (
              <ChevronRightIcon className="h-3.5 w-3.5" />
            )}
            <LinkIcon className="h-3.5 w-3.5" />
            {relationshipsCount} Relationship{relationshipsCount !== 1 ? 's' : ''}
          </button>

          {expanded && relationships.length > 0 && (
            <div className="mt-2 space-y-2">
              {relationships.map((rel) => (
                <div
                  key={rel.id}
                  className="p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs"
                >
                  <div className="text-gray-500 dark:text-gray-400">
                    {formatRelationshipType(rel.relationship_type)}
                  </div>
                  <button
                    onClick={() => navigate(`/contacts/${rel.related_contact.id}`)}
                    className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
                  >
                    {rel.related_contact.full_name || rel.related_contact.company_name}
                  </button>
                  {(rel.related_contact.email || rel.related_contact.mobile_phone) && (
                    <div className="mt-1 text-gray-500 dark:text-gray-400 space-y-0.5">
                      {rel.related_contact.email && (
                        <div className="flex items-center gap-1">
                          <EnvelopeIcon className="h-3 w-3" />
                          {rel.related_contact.email}
                        </div>
                      )}
                      {rel.related_contact.mobile_phone && (
                        <div className="flex items-center gap-1">
                          <PhoneIcon className="h-3 w-3" />
                          {rel.related_contact.mobile_phone}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Related Contact Card - shows contact from relationships with expandable details
function RelatedContactCard({ item, navigate, currentJobId }) {
  const [expanded, setExpanded] = useState(false)
  const [relationships, setRelationships] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const loadDetails = async () => {
    if (loaded) return
    try {
      setLoading(true)
      const [contactResponse, jobsResponse] = await Promise.all([
        api.get(`/api/v1/contacts/${item.contact_id}`),
        api.get('/api/v1/jobs', { params: { contact_id: item.contact_id, per_page: 10 } })
      ])
      const contactData = contactResponse.contact || contactResponse
      const outgoingRels = (contactData.outgoing_relationships || contactData.relationships || [])
        .filter(rel => rel.direction !== 'incoming')
        .filter(rel => {
          const relContactId = rel.related_contact?.id || rel.related_contact_id
          return relContactId !== item.fromContactId
        })
      setRelationships(outgoingRels)
      const allJobs = jobsResponse.jobs || []
      const otherJobs = allJobs.filter(job => job.id !== parseInt(currentJobId))
      setJobs(otherJobs)
      setLoaded(true)
    } catch (err) {
      console.error('Failed to load contact details:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleExpand = () => {
    if (!expanded && !loaded) loadDetails()
    setExpanded(!expanded)
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border p-4 shadow-sm ${
      item.isAlsoOnJob
        ? 'border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
        : 'border-gray-200 dark:border-gray-700'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={() => navigate(`/contacts/${item.contact_id}`)}
          className="font-medium text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 block text-left"
        >
          {item.contact.full_name || item.contact.company_name}
        </button>
        {item.isAlsoOnJob && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-200 flex-shrink-0">
            Also on Job
          </span>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {formatRelationshipType(item.relationshipType)}
        </span>
        <JobCountsByType contactId={item.contact_id} />
      </div>

      <div className="mt-2 space-y-1">
        {item.contact.email && (
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <EnvelopeIcon className="h-3.5 w-3.5 flex-shrink-0" />
            <a href={`mailto:${item.contact.email}`} className="hover:text-indigo-600 truncate">
              {item.contact.email}
            </a>
          </div>
        )}
        {item.contact.mobile_phone && (
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <PhoneIcon className="h-3.5 w-3.5 flex-shrink-0" />
            <a href={`tel:${item.contact.mobile_phone}`} className="hover:text-indigo-600">
              {item.contact.mobile_phone}
            </a>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={handleExpand}
          className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
        >
          {expanded ? <ChevronDownIcon className="h-3.5 w-3.5" /> : <ChevronRightIcon className="h-3.5 w-3.5" />}
          <LinkIcon className="h-3.5 w-3.5" />
          View Details
        </button>

        {expanded && (
          <div className="mt-2 space-y-3">
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-600"></div>
                Loading...
              </div>
            ) : (
              <>
                <div>
                  <div className="flex items-center gap-1 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <LinkIcon className="h-3 w-3" />
                    Relationships
                  </div>
                  {relationships.length === 0 ? (
                    <p className="text-xs text-gray-500 italic pl-4">No other relationships</p>
                  ) : (
                    <div className="space-y-2">
                      {relationships.map((rel) => (
                        <div key={rel.id} className="p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs">
                          <button
                            onClick={() => navigate(`/contacts/${rel.related_contact?.id || rel.related_contact_id}`)}
                            className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
                          >
                            {rel.related_contact?.full_name || rel.related_contact?.company_name || 'Unknown'}
                          </button>
                          <div className="text-gray-500 dark:text-gray-400 mt-0.5">
                            {formatRelationshipType(rel.relationship_type)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-1 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <BriefcaseIcon className="h-3 w-3" />
                    Previous Jobs
                  </div>
                  {jobs.length === 0 ? (
                    <p className="text-xs text-gray-500 italic pl-4">No previous jobs</p>
                  ) : (
                    <div className="space-y-2">
                      {jobs.map((job) => (
                        <div key={job.id} className="p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs">
                          <button
                            onClick={() => navigate(`/jobs/${job.id}`)}
                            className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
                          >
                            {job.title}
                          </button>
                          <div className="mt-0.5 text-gray-500 dark:text-gray-400 flex items-center gap-2">
                            {job.ted_number && <span>#{job.ted_number}</span>}
                            {job.status && <span className="capitalize">{job.status}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Client Related Jobs - fetches and displays jobs for a specific contact
function ClientRelatedJobs({ contactId, currentJobId, navigate }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        setLoading(true)
        const response = await api.get('/api/v1/jobs', {
          params: { contact_id: contactId, per_page: 10 }
        })
        const otherJobs = (response.jobs || []).filter(job => job.id !== parseInt(currentJobId))
        setJobs(otherJobs)
      } catch (err) {
        console.error('Failed to load related jobs:', err)
        setJobs([])
      } finally {
        setLoading(false)
      }
    }
    if (contactId) fetchJobs()
  }, [contactId, currentJobId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (jobs.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 italic">No previous jobs</p>
  }

  return (
    <div className="space-y-3">
      {jobs.map(job => (
        <div key={job.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          <button
            onClick={() => navigate(`/jobs/${job.id}`)}
            className="font-medium text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 text-left"
          >
            {job.title}
          </button>
          <div className="mt-1 space-y-0.5">
            {job.ted_number && <div className="text-xs text-gray-500 dark:text-gray-400">#{job.ted_number}</div>}
            {job.status && <div className="text-xs text-gray-500 dark:text-gray-400">Status: {job.status}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

// Collapsible Row - shows header that expands to full details with 3-column layout
function CollapsiblePersonRow({ contact, roleConfig, relatedContacts, allContactIds, jobId, onSetPrimary, onRemove, navigate }) {
  const [expanded, setExpanded] = useState(false)

  // For users (internal team), we don't have contact data
  const isUser = !!contact.user && !contact.contact
  const displayName = isUser
    ? (contact.user?.name || contact.user?.email || 'Unknown User')
    : (contact.contact?.full_name || contact.contact?.company_name || 'Unknown')
  const email = isUser ? contact.user?.email : contact.contact?.email
  const mobile = isUser ? null : contact.contact?.mobile_phone
  const isPrimary = contact.primary

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Collapsible Header */}
      <div
        className="bg-gray-50 dark:bg-gray-800 px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDownIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
          ) : (
            <ChevronRightIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
          )}

          {/* Primary Star - only for clients */}
          {contact.role === 'client' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (!isPrimary) onSetPrimary?.(contact.id)
              }}
              className={`flex-shrink-0 ${
                isPrimary ? 'text-yellow-500 cursor-default' : 'text-gray-300 hover:text-yellow-500'
              }`}
              title={isPrimary ? 'Primary client' : 'Set as primary'}
            >
              {isPrimary ? <StarIconSolid className="h-4 w-4" /> : <StarIcon className="h-4 w-4" />}
            </button>
          )}

          {/* Name */}
          {isUser ? (
            <span className="font-medium text-sm text-gray-900 dark:text-white">{displayName}</span>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/contacts/${contact.contact_id}`)
              }}
              className="font-medium text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
            >
              {displayName}
            </button>
          )}

          {isPrimary && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
              Primary
            </span>
          )}

          <div className="flex-1" />

          {/* Contact Info */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
            {email && (
              <a href={`mailto:${email}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 hover:text-indigo-600">
                <EnvelopeIcon className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">{email}</span>
              </a>
            )}
            {mobile && (
              <a href={`tel:${mobile}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 hover:text-indigo-600">
                <PhoneIcon className="h-3.5 w-3.5" />
                <span className="hidden md:inline">{mobile}</span>
              </a>
            )}
          </div>

          {/* Job Counts by Type */}
          {!isUser && <JobCountsByType contactId={contact.contact_id} />}

          {/* Delete Button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemove?.(contact.id)
            }}
            className="flex-shrink-0 p-1 rounded transition-colors text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            title="Remove from job"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded Content - 3 column layout (only for contacts, not users) */}
      {expanded && !isUser && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
              {roleConfig.icon ? <roleConfig.icon className="h-4 w-4 text-gray-500" /> : <UserIcon className="h-4 w-4 text-gray-500" />}
              <h4 className="font-medium text-sm text-gray-900 dark:text-white">{roleConfig.label} Details</h4>
            </div>
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
              <UserIcon className="h-4 w-4 text-gray-500" />
              <h4 className="font-medium text-sm text-gray-900 dark:text-white">Related Contacts</h4>
              <span className="ml-auto bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium px-2 py-0.5 rounded-full">
                {relatedContacts.length}
              </span>
            </div>
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
              <BriefcaseIcon className="h-4 w-4 text-gray-500" />
              <h4 className="font-medium text-sm text-gray-900 dark:text-white">Related Jobs</h4>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <ContactCard
                contact={contact}
                roleConfig={roleConfig}
                isPrimary={isPrimary}
                navigate={navigate}
              />
            </div>

            <div className="space-y-3">
              {relatedContacts.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">No related contacts</p>
              ) : (
                relatedContacts.map(item => (
                  <RelatedContactCard
                    key={item.id}
                    item={item}
                    navigate={navigate}
                    currentJobId={jobId}
                  />
                ))
              )}
            </div>

            <ClientRelatedJobs
              contactId={contact.contact_id}
              currentJobId={jobId}
              navigate={navigate}
            />
          </div>
        </div>
      )}

      {/* Expanded Content for Users - simpler view */}
      {expanded && isUser && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p><span className="font-medium">Role:</span> {roleConfig.label}</p>
            {email && <p><span className="font-medium">Email:</span> {email}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function JobPeopleTab({ jobId, onUpdate }) {
  const navigate = useNavigate()
  const searchInputRef = useRef(null)
  const [contacts, setContacts] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [addingRole, setAddingRole] = useState(null) // Which role type we're adding
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)

  const isInternalRole = (role) => INTERNAL_ROLES.includes(role)

  useEffect(() => {
    loadContacts()
    loadUsers()
  }, [jobId])

  // Auto-focus search input when adding (only for non-internal roles)
  useEffect(() => {
    if (addingRole && !isInternalRole(addingRole) && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }, [addingRole])

  // Auto-select if only one user for internal roles
  useEffect(() => {
    if (addingRole && isInternalRole(addingRole) && users.length === 1) {
      // Check if this user isn't already assigned to this role
      const alreadyAssigned = contacts.some(c => c.user_id === users[0].id && c.role === addingRole)
      if (!alreadyAssigned) {
        handleAddUser(users[0].id)
      }
    }
  }, [addingRole, users])

  const loadUsers = async () => {
    try {
      const response = await api.get('/api/v1/users')
      setUsers(response.users || response || [])
    } catch (err) {
      console.error('Failed to load users:', err)
    }
  }

  const loadContacts = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/v1/jobs/${jobId}/job_contacts`)
      setContacts(response.job_contacts || [])
    } catch (err) {
      console.error('Failed to load contacts:', err)
      setError('Failed to load contacts')
    } finally {
      setLoading(false)
    }
  }

  const searchContacts = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([])
      return
    }

    try {
      setSearching(true)
      const response = await api.get('/api/v1/contacts', {
        params: {
          search: query,
          per_page: 10
        }
      })

      // Filter out contacts already added with the same role
      const existingForRole = contacts
        .filter(c => c.role === addingRole)
        .map(c => c.contact_id)
      const filtered = (response.contacts || []).filter(
        contact => !existingForRole.includes(contact.id)
      )
      setSearchResults(filtered)
    } catch (err) {
      console.error('Failed to search contacts:', err)
    } finally {
      setSearching(false)
    }
  }

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (addingRole) {
        searchContacts(searchQuery)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, addingRole])

  const handleAddContact = async (contactId) => {
    try {
      setError(null)
      const isFirstClient = addingRole === 'client' &&
        !contacts.some(c => c.role === 'client')

      const response = await api.post(`/api/v1/jobs/${jobId}/job_contacts`, {
        job_contact: {
          contact_id: contactId,
          primary: isFirstClient, // First client is primary
          role: addingRole
        }
      })

      setContacts([...contacts, response])
      setAddingRole(null)
      setSearchQuery('')
      setSearchResults([])
      onUpdate?.()
    } catch (err) {
      console.error('Failed to add contact:', err)
      setError(err.response?.data?.error || err.response?.data?.errors?.join(', ') || 'Failed to add contact')
    }
  }

  const handleAddUser = async (userId) => {
    try {
      setError(null)

      const response = await api.post(`/api/v1/jobs/${jobId}/job_contacts`, {
        job_contact: {
          user_id: userId,
          primary: false, // Internal team members are never primary
          role: addingRole
        }
      })

      setContacts([...contacts, response])
      setAddingRole(null)
      onUpdate?.()
    } catch (err) {
      console.error('Failed to add user:', err)
      setError(err.response?.data?.error || err.response?.data?.errors?.join(', ') || 'Failed to add user')
    }
  }

  const handleRemoveContact = async (constructionContactId) => {
    const contact = contacts.find(c => c.id === constructionContactId)
    const clientContacts = contacts.filter(c => c.role === 'client')

    if (contact?.role === 'client' && clientContacts.length === 1) {
      alert('Cannot remove the last client. At least one client is required.')
      return
    }

    if (!confirm('Are you sure you want to remove this person from the job?')) return

    try {
      setError(null)
      await api.delete(`/api/v1/jobs/${jobId}/job_contacts/${constructionContactId}`)
      setContacts(contacts.filter(c => c.id !== constructionContactId))
      onUpdate?.()
    } catch (err) {
      console.error('Failed to remove contact:', err)
      setError(err.response?.data?.error || 'Failed to remove contact')
    }
  }

  const handleSetPrimary = async (constructionContactId) => {
    try {
      setError(null)
      await api.put(
        `/api/v1/jobs/${jobId}/job_contacts/${constructionContactId}`,
        {
          job_contact: {
            primary: true
          }
        }
      )

      setContacts(contacts.map(c => ({
        ...c,
        primary: c.id === constructionContactId
      })))
      onUpdate?.()
    } catch (err) {
      console.error('Failed to set primary contact:', err)
      setError('Failed to set primary contact')
    }
  }

  const getContactDisplayName = (contact) => {
    return contact.full_name ||
           contact.company_name ||
           `${contact.first_name || ''} ${contact.last_name || ''}`.trim() ||
           'Unnamed Contact'
  }

  const getContactSubtitle = (contact) => {
    const parts = []
    if (contact.company_name && contact.full_name !== contact.company_name) {
      parts.push(contact.company_name)
    }
    if (contact.email) parts.push(contact.email)
    if (contact.mobile_phone) parts.push(contact.mobile_phone)
    return parts.join(' • ')
  }

  // Group contacts by role
  const contactsByRole = ROLE_TYPES.reduce((acc, role) => {
    acc[role.key] = contacts.filter(c => c.role === role.key)
    return acc
  }, {})

  // Contacts without a role
  const unassignedContacts = contacts.filter(c => !c.role || !ROLE_TYPES.find(r => r.key === c.role))

  // Get all contact IDs on this job (for flagging "Also on Job" in relationships)
  const allJobContactIds = contacts.filter(c => c.contact_id).map(c => c.contact_id)

  // Get related contacts for a specific person - show ALL relationships
  const getRelatedContactsForPerson = (person) => {
    return (person.relationships || []).map(rel => ({
      id: `rel-${rel.id}`,
      contact: rel.related_contact,
      contact_id: rel.related_contact.id,
      relationshipType: rel.relationship_type,
      fromContact: person.contact?.full_name || person.contact?.company_name,
      fromContactId: person.contact_id,
      // Flag if this contact is also on this job
      isAlsoOnJob: allJobContactIds.includes(rel.related_contact.id)
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Add Person Modal - shows users for internal roles, search for external */}
      {addingRole && !isInternalRole(addingRole) && (
        <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-base font-semibold text-gray-900 dark:text-white">
              Add {getRoleConfig(addingRole).label}
            </h4>
            <button
              onClick={() => {
                setAddingRole(null)
                setSearchQuery('')
                setSearchResults([])
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts by name, email, or company..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Search Results */}
          {searching && (
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center py-2">
              Searching...
            </div>
          )}

          {!searching && searchResults.length > 0 && (
            <div className="mt-2 max-h-60 overflow-y-auto space-y-1">
              {searchResults.map(contact => (
                <button
                  key={contact.id}
                  onClick={() => handleAddContact(contact.id)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <div className="font-medium text-sm text-gray-900 dark:text-white">
                    {getContactDisplayName(contact)}
                  </div>
                  {getContactSubtitle(contact) && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {getContactSubtitle(contact)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center py-2">
              No contacts found
            </div>
          )}

          {searchQuery.length > 0 && searchQuery.length < 2 && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center py-2">
              Type at least 2 characters to search
            </div>
          )}
        </div>
      )}

      {/* Internal Team User Selection - shows list of users */}
      {addingRole && isInternalRole(addingRole) && users.length > 1 && (
        <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-base font-semibold text-gray-900 dark:text-white">
              Select {getRoleConfig(addingRole).label}
            </h4>
            <button
              onClick={() => setAddingRole(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-1">
            {users
              .filter(user => !contacts.some(c => c.user_id === user.id && c.role === addingRole))
              .map(user => (
                <button
                  key={user.id}
                  onClick={() => handleAddUser(user.id)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <div className="font-medium text-sm text-gray-900 dark:text-white">
                    {user.name || user.email}
                  </div>
                  {user.name && user.email && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {user.email}
                    </div>
                  )}
                </button>
              ))}
            {users.filter(user => !contacts.some(c => c.user_id === user.id && c.role === addingRole)).length === 0 && (
              <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                All users have already been assigned this role
              </div>
            )}
          </div>
        </div>
      )}

      {/* People by Individual Role - each role gets its own section with header */}
      {ROLE_GROUPS.map((group) => {
        const isClientGroup = group.key === 'client'
        const isExternalGroup = group.key === 'external'

        // For client and external groups, show each role separately with its own header
        if (isClientGroup || isExternalGroup) {
          return group.roles.map(role => {
            const roleContacts = (contactsByRole[role.key] || []).map(c => ({ ...c, roleConfig: role }))

            // For client roles, skip if empty. For external roles, always show header
            if (roleContacts.length === 0 && isClientGroup) return null

            const RoleIcon = role.icon
            return (
              <div key={role.key} className="space-y-2">
                {/* Role Header */}
                <div className="flex items-center gap-2 pb-1 border-b border-gray-200 dark:border-gray-700">
                  <RoleIcon className="h-4 w-4 text-gray-500" />
                  <h3 className="font-medium text-sm text-gray-900 dark:text-white">{role.label}</h3>
                  <span className={`${getRoleBadgeClasses(role.color)} text-xs font-medium px-1.5 py-0.5 rounded-full`}>
                    {roleContacts.length}
                  </span>
                  <button
                    onClick={() => {
                      setAddingRole(role.key)
                      setSearchQuery('')
                      setSearchResults([])
                    }}
                    className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    Add
                  </button>
                </div>

                {/* Empty state for external roles */}
                {roleContacts.length === 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">No {role.label.toLowerCase()} assigned</p>
                )}

                {/* Collapsible rows for each contact */}
                {roleContacts.map(contact => (
                  <CollapsiblePersonRow
                    key={contact.id}
                    contact={contact}
                    roleConfig={contact.roleConfig}
                    relatedContacts={getRelatedContactsForPerson(contact)}
                    allContactIds={allJobContactIds}
                    jobId={jobId}
                    onSetPrimary={handleSetPrimary}
                    onRemove={handleRemoveContact}
                    navigate={navigate}
                  />
                ))}
              </div>
            )
          })
        }

        // For internal group, show as 4-column grid with role boxes
        const GroupIcon = group.icon
        return (
          <div key={group.key} className="space-y-2">
            {/* Group Header */}
            <div className="flex items-center gap-2 pb-1 border-b border-gray-200 dark:border-gray-700">
              <GroupIcon className="h-4 w-4 text-gray-500" />
              <h3 className="font-medium text-sm text-gray-900 dark:text-white">{group.label}</h3>
            </div>

            {/* 4-column grid for internal team roles */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {group.roles.map(role => {
                const roleContacts = (contactsByRole[role.key] || []).map(c => ({ ...c, roleConfig: role }))
                const RoleIcon = role.icon

                return (
                  <div
                    key={role.key}
                    className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-2"
                  >
                    {/* Role Header */}
                    <div className="flex items-center gap-1 mb-1 pb-1 border-b border-gray-100 dark:border-gray-700">
                      <RoleIcon className="h-3.5 w-3.5 text-gray-500" />
                      <h4 className="font-medium text-xs text-gray-900 dark:text-white">{role.label}</h4>
                      <button
                        onClick={() => setAddingRole(role.key)}
                        className="ml-auto p-0.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 rounded transition-colors"
                        title={`Add ${role.label}`}
                      >
                        <PlusIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Empty state */}
                    {roleContacts.length === 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 italic">Not assigned</p>
                    )}

                    {/* Person(s) in this role */}
                    <div className="space-y-1">
                      {roleContacts.map(contact => (
                        <div key={contact.id} className="flex items-start justify-between gap-1">
                          {/* Name & Email */}
                          <div className="min-w-0 flex-1">
                            {contact.user ? (
                              <span className="font-medium text-xs text-gray-900 dark:text-white block truncate">
                                {contact.user.name || contact.user.email}
                              </span>
                            ) : (
                              <button
                                onClick={() => navigate(`/contacts/${contact.contact_id}`)}
                                className="font-medium text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 block truncate"
                              >
                                {getContactDisplayName(contact.contact)}
                              </button>
                            )}
                            {(contact.user?.email || contact.contact?.email) && (
                              <a href={`mailto:${contact.user?.email || contact.contact?.email}`} className="text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 truncate block">
                                {contact.user?.email || contact.contact?.email}
                              </a>
                            )}
                          </div>
                          {/* Delete Button */}
                          <button
                            onClick={() => handleRemoveContact(contact.id)}
                            className="flex-shrink-0 p-0.5 rounded transition-colors text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                            title="Remove from job"
                          >
                            <TrashIcon className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Unassigned Contacts (legacy) */}
      {unassignedContacts.length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center mb-4">
              <UserGroupIcon className="h-5 w-5 mr-2 text-gray-400" />
              Other Contacts ({unassignedContacts.length})
            </h3>

            <div className="space-y-3">
              {unassignedContacts.map(contact => (
                <div
                  key={contact.id}
                  className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => navigate(`/contacts/${contact.contact_id}`)}
                          className="font-medium text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                        >
                          {getContactDisplayName(contact.contact)}
                        </button>

                        <div className="mt-2 space-y-1">
                          {contact.contact?.email && (
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              <span className="font-medium">Email:</span> {contact.contact.email}
                            </div>
                          )}
                          {contact.contact?.mobile_phone && (
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              <span className="font-medium">Mobile:</span> {contact.contact.mobile_phone}
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleRemoveContact(contact.id)}
                        className="flex-shrink-0 p-1.5 rounded-lg transition-colors text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Remove from job"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {contacts.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="px-4 py-8 text-center">
            <UserGroupIcon className="mx-auto h-8 w-8 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No people added</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Use the + Add buttons above to add people.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
