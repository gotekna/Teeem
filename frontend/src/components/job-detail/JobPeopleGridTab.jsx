import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UserIcon,
  BuildingOfficeIcon,
  BriefcaseIcon,
  EnvelopeIcon,
  PhoneIcon,
  LinkIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  StarIcon,
  HomeIcon,
} from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'
import { api } from '../../api'

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

// Role badge colors
const getRoleBadgeClasses = (role) => {
  const colorMap = {
    client: 'bg-indigo-100 text-indigo-800',
    client_representative: 'bg-blue-100 text-blue-800',
    client_broker: 'bg-cyan-100 text-cyan-800',
    client_bank: 'bg-slate-100 text-slate-800',
  }
  return colorMap[role] || 'bg-gray-100 text-gray-800'
}

const getRoleLabel = (role) => {
  const labels = {
    client: 'Client',
    client_representative: 'Representative',
    client_broker: 'Broker',
    client_bank: 'Bank',
  }
  return labels[role] || role
}

// Contact Card Component
function ContactCard({ contact, isPrimary, showStar, onSetPrimary, navigate }) {
  const [expanded, setExpanded] = useState(false)
  const [jobCount, setJobCount] = useState(null)

  const displayName = contact.contact?.full_name || contact.contact?.company_name || 'Unknown'
  const email = contact.contact?.email
  const mobile = contact.contact?.mobile_phone
  const relationships = contact.relationships || []
  const relationshipsCount = contact.relationships_count || 0

  // Fetch job count for this contact on mount
  useEffect(() => {
    const fetchJobCount = async () => {
      if (!contact.contact_id) return
      try {
        const jobsResponse = await api.get('/api/v1/jobs', {
          params: { contact_id: contact.contact_id, per_page: 1 }
        })
        setJobCount(jobsResponse.pagination?.total_count ?? jobsResponse.total_count ?? jobsResponse.jobs?.length ?? 0)
      } catch {
        setJobCount(null)
      }
    }
    fetchJobCount()
  }, [contact.contact_id])

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
      {/* Header with name and role */}
      <div className="flex items-start gap-2">
        {showStar && (
          <button
            onClick={() => !isPrimary && onSetPrimary?.(contact.id)}
            className={`flex-shrink-0 mt-0.5 ${
              isPrimary
                ? 'text-yellow-500 cursor-default'
                : 'text-gray-300 hover:text-yellow-500'
            }`}
            title={isPrimary ? 'Primary client' : 'Set as primary'}
          >
            {isPrimary ? (
              <StarIconSolid className="h-5 w-5" />
            ) : (
              <StarIcon className="h-5 w-5" />
            )}
          </button>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => navigate(`/contacts/${contact.contact_id}`)}
              className="font-medium text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 truncate block"
            >
              {displayName}
            </button>
            {/* Job count with house icon */}
            {jobCount !== null && (
              <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 flex-shrink-0" title={`${jobCount} job${jobCount !== 1 ? 's' : ''}`}>
                <HomeIcon className="h-4 w-4" />
                <span className="font-medium">{jobCount}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1 mt-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRoleBadgeClasses(contact.role)}`}>
              {getRoleLabel(contact.role)}
            </span>
            {isPrimary && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                Primary
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Contact Details */}
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

      {/* Relationships */}
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

// Relationship Item - displays a single relationship with job count
function RelationshipItem({ rel, navigate }) {
  const [jobCount, setJobCount] = useState(null)
  const contactId = rel.related_contact?.id || rel.related_contact_id

  useEffect(() => {
    const fetchJobCount = async () => {
      if (!contactId) return
      try {
        const jobsResponse = await api.get('/api/v1/jobs', {
          params: { contact_id: contactId, per_page: 1 }
        })
        setJobCount(jobsResponse.pagination?.total_count ?? jobsResponse.total_count ?? jobsResponse.jobs?.length ?? 0)
      } catch {
        setJobCount(null)
      }
    }
    fetchJobCount()
  }, [contactId])

  return (
    <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => navigate(`/contacts/${contactId}`)}
          className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
        >
          {rel.related_contact?.full_name || rel.related_contact?.company_name || 'Unknown'}
        </button>
        {jobCount !== null && (
          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400 flex-shrink-0" title={`${jobCount} job${jobCount !== 1 ? 's' : ''}`}>
            <HomeIcon className="h-3.5 w-3.5" />
            <span className="font-medium">{jobCount}</span>
          </div>
        )}
      </div>
      <div className="text-gray-500 dark:text-gray-400 mt-0.5">
        {rel.direction === 'incoming'
          ? `is ${formatRelationshipType(rel.relationship_type).toLowerCase()}`
          : formatRelationshipType(rel.relationship_type)
        }
      </div>
      {rel.related_contact && (rel.related_contact.email || rel.related_contact.mobile_phone) && (
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
  )
}

// Related Contact Card - shows a contact from the relationships with expandable details
// clientContactIds = IDs of contacts already shown as clients (to exclude from nested relationships)
function RelatedContactCard({ item, navigate, clientContactIds = [], currentJobId }) {
  const [expanded, setExpanded] = useState(false)
  const [relationships, setRelationships] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [jobCount, setJobCount] = useState(null)

  // Fetch job count for this contact on mount
  useEffect(() => {
    const fetchJobCount = async () => {
      try {
        const response = await api.get(`/api/v1/contacts/${item.contact_id}/jobs_count`)
        setJobCount(response.count ?? response.jobs_count ?? 0)
      } catch (err) {
        // If endpoint doesn't exist, try fetching jobs directly
        try {
          const jobsResponse = await api.get('/api/v1/jobs', {
            params: { contact_id: item.contact_id, per_page: 1 }
          })
          setJobCount(jobsResponse.pagination?.total_count ?? jobsResponse.total_count ?? jobsResponse.jobs?.length ?? 0)
        } catch {
          setJobCount(null)
        }
      }
    }
    fetchJobCount()
  }, [item.contact_id])

  const loadDetails = async () => {
    if (loaded) return

    try {
      setLoading(true)

      // Fetch both relationships and jobs in parallel
      const [contactResponse, jobsResponse] = await Promise.all([
        api.get(`/api/v1/contacts/${item.contact_id}`),
        api.get('/api/v1/jobs', {
          params: { contact_id: item.contact_id, per_page: 10 }
        })
      ])

      // The contact API returns { success: true, contact: {...} }
      const contactData = contactResponse.contact || contactResponse

      // Get only outgoing relationships (to avoid duplicates from incoming)
      // and filter out the contact we came from (item.fromContactId)
      const outgoingRels = (contactData.outgoing_relationships || contactData.relationships || [])
        .filter(rel => rel.direction !== 'incoming') // Only outgoing
        .filter(rel => {
          const relContactId = rel.related_contact?.id || rel.related_contact_id
          return relContactId !== item.fromContactId // Filter out the parent contact
        })
      setRelationships(outgoingRels)

      // Filter out the current job from the jobs list
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
    if (!expanded && !loaded) {
      loadDetails()
    }
    setExpanded(!expanded)
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border p-4 shadow-sm ${
      item.isAlsoClient
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
        {item.isAlsoClient && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-200 flex-shrink-0">
            Also Client
          </span>
        )}
      </div>

      {/* How they're related to the client on this job */}
      <div className="mt-1 flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {formatRelationshipType(item.relationshipType)}
        </span>
        {/* Job count with house icon */}
        {jobCount !== null && (
          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400" title={`${jobCount} job${jobCount !== 1 ? 's' : ''}`}>
            <HomeIcon className="h-4 w-4" />
            <span className="font-medium">{jobCount}</span>
          </div>
        )}
      </div>

      {/* Contact details */}
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

      {/* Expandable details - relationships and jobs */}
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={handleExpand}
          className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
        >
          {expanded ? (
            <ChevronDownIcon className="h-3.5 w-3.5" />
          ) : (
            <ChevronRightIcon className="h-3.5 w-3.5" />
          )}
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
                {/* Relationships Section */}
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
                        <RelationshipItem
                          key={rel.id}
                          rel={rel}
                          navigate={navigate}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Jobs Section */}
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
                        <div
                          key={job.id}
                          className="p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs"
                        >
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
          params: {
            contact_id: contactId,
            per_page: 10
          }
        })
        // Filter out the current job
        const otherJobs = (response.jobs || []).filter(job => job.id !== parseInt(currentJobId))
        setJobs(otherJobs)
      } catch (err) {
        console.error('Failed to load related jobs:', err)
        setJobs([])
      } finally {
        setLoading(false)
      }
    }

    if (contactId) {
      fetchJobs()
    }
  }, [contactId, currentJobId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 italic">
        No previous jobs
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {jobs.map(job => (
        <div
          key={job.id}
          className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm"
        >
          <button
            onClick={() => navigate(`/jobs/${job.id}`)}
            className="font-medium text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 text-left"
          >
            {job.title}
          </button>
          <div className="mt-1 space-y-0.5">
            {job.ted_number && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                #{job.ted_number}
              </div>
            )}
            {job.status && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Status: {job.status}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// Collapsible Client Row - shows client header that expands to full details
function CollapsibleClientRow({ client, relatedContacts, clientContactIds, jobId, onSetPrimary, navigate }) {
  const [expanded, setExpanded] = useState(false)
  const [jobCount, setJobCount] = useState(null)

  const displayName = client.contact?.full_name || client.contact?.company_name || 'Unknown'
  const email = client.contact?.email
  const mobile = client.contact?.mobile_phone
  const isPrimary = client.primary

  // Fetch job count on mount
  useEffect(() => {
    const fetchJobCount = async () => {
      if (!client.contact_id) return
      try {
        const jobsResponse = await api.get('/api/v1/jobs', {
          params: { contact_id: client.contact_id, per_page: 1 }
        })
        setJobCount(jobsResponse.pagination?.total_count ?? jobsResponse.total_count ?? jobsResponse.jobs?.length ?? 0)
      } catch {
        setJobCount(null)
      }
    }
    fetchJobCount()
  }, [client.contact_id])

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Collapsible Header */}
      <div
        className="bg-gray-50 dark:bg-gray-800 px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {/* Expand/Collapse Icon */}
          {expanded ? (
            <ChevronDownIcon className="h-5 w-5 text-gray-500 flex-shrink-0" />
          ) : (
            <ChevronRightIcon className="h-5 w-5 text-gray-500 flex-shrink-0" />
          )}

          {/* Primary Star */}
          {client.role === 'client' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (!isPrimary) onSetPrimary?.(client.id)
              }}
              className={`flex-shrink-0 ${
                isPrimary
                  ? 'text-yellow-500 cursor-default'
                  : 'text-gray-300 hover:text-yellow-500'
              }`}
              title={isPrimary ? 'Primary client' : 'Set as primary'}
            >
              {isPrimary ? (
                <StarIconSolid className="h-5 w-5" />
              ) : (
                <StarIcon className="h-5 w-5" />
              )}
            </button>
          )}

          {/* Client Name */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/contacts/${client.contact_id}`)
            }}
            className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
          >
            {displayName}
          </button>

          {/* Primary Badge */}
          {isPrimary && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
              Primary
            </span>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Contact Info */}
          <div className="hidden sm:flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            {email && (
              <a
                href={`mailto:${email}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 hover:text-indigo-600"
              >
                <EnvelopeIcon className="h-4 w-4" />
                <span className="hidden md:inline">{email}</span>
              </a>
            )}
            {mobile && (
              <a
                href={`tel:${mobile}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 hover:text-indigo-600"
              >
                <PhoneIcon className="h-4 w-4" />
                <span>{mobile}</span>
              </a>
            )}
          </div>

          {/* Job Count */}
          {jobCount !== null && (
            <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400" title={`${jobCount} job${jobCount !== 1 ? 's' : ''}`}>
              <HomeIcon className="h-4 w-4" />
              <span className="font-medium">{jobCount}</span>
            </div>
          )}
        </div>

        {/* Mobile contact info */}
        <div className="sm:hidden flex items-center gap-4 mt-2 ml-8 text-xs text-gray-600 dark:text-gray-400">
          {email && (
            <a href={`mailto:${email}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
              <EnvelopeIcon className="h-3.5 w-3.5" />
              {email}
            </a>
          )}
          {mobile && (
            <a href={`tel:${mobile}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
              <PhoneIcon className="h-3.5 w-3.5" />
              {mobile}
            </a>
          )}
        </div>
      </div>

      {/* Expanded Content - 3 column layout */}
      {expanded && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          {/* Column Headers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
              <BuildingOfficeIcon className="h-4 w-4 text-gray-500" />
              <h4 className="font-medium text-sm text-gray-900 dark:text-white">Client Details</h4>
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

          {/* 3-column grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Column 1: Client Details */}
            <div>
              <ContactCard
                contact={client}
                isPrimary={isPrimary}
                showStar={false}
                navigate={navigate}
              />
            </div>

            {/* Column 2: Related Contacts */}
            <div className="space-y-3">
              {relatedContacts.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">No related contacts</p>
              ) : (
                relatedContacts.map(item => (
                  <RelatedContactCard
                    key={item.id}
                    item={item}
                    navigate={navigate}
                    clientContactIds={clientContactIds}
                    currentJobId={jobId}
                  />
                ))
              )}
            </div>

            {/* Column 3: Related Jobs */}
            <ClientRelatedJobs
              contactId={client.contact_id}
              currentJobId={jobId}
              navigate={navigate}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function JobPeopleGridTab({ jobId, onUpdate }) {
  const navigate = useNavigate()
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadContacts()
  }, [jobId])

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

  const handleSetPrimary = async (contactId) => {
    try {
      await api.put(`/api/v1/jobs/${jobId}/job_contacts/${contactId}`, {
        job_contact: { primary: true }
      })
      setContacts(contacts.map(c => ({
        ...c,
        primary: c.id === contactId
      })))
      onUpdate?.()
    } catch (err) {
      console.error('Failed to set primary:', err)
    }
  }

  // Categorize contacts - only 'client' role goes in Clients column
  // Other roles (representative, broker, bank) are related parties, not clients themselves
  const clients = contacts.filter(c => c.role === 'client' && c.contact)

  // Get all related contacts from relationships (for the Contacts column)
  // These are contacts that the clients on this job are related TO
  const relatedContacts = []
  const seenContactIds = new Set(clients.map(c => c.contact_id))

  clients.forEach(client => {
    (client.relationships || []).forEach(rel => {
      // Only add if not already a client on this job
      if (!seenContactIds.has(rel.related_contact.id)) {
        seenContactIds.add(rel.related_contact.id)
        relatedContacts.push({
          id: `rel-${rel.id}`,
          contact: rel.related_contact,
          contact_id: rel.related_contact.id,
          relationshipType: rel.relationship_type,
          fromContact: client.contact?.full_name || client.contact?.company_name,
          fromContactId: client.contact_id
        })
      }
    })
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    )
  }

  // Get related contacts for a specific client - show ALL relationships
  const getRelatedContactsForClient = (client) => {
    return (client.relationships || []).map(rel => ({
      id: `rel-${rel.id}`,
      contact: rel.related_contact,
      contact_id: rel.related_contact.id,
      relationshipType: rel.relationship_type,
      fromContact: client.contact?.full_name || client.contact?.company_name,
      fromContactId: client.contact_id,
      // Flag if this contact is also a client on this job
      isAlsoClient: clients.some(c => c.contact_id === rel.related_contact.id)
    }))
  }

  return (
    <div className="space-y-4">
      {/* Clients Header */}
      <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
        <BuildingOfficeIcon className="h-5 w-5 text-gray-500" />
        <h3 className="font-semibold text-gray-900 dark:text-white">Clients</h3>
        <span className="ml-auto bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium px-2 py-0.5 rounded-full">
          {clients.length}
        </span>
      </div>

      {/* Client Rows - each client is collapsible */}
      {clients.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">No clients assigned</p>
      ) : (
        clients.map((client) => (
          <CollapsibleClientRow
            key={client.id}
            client={client}
            relatedContacts={getRelatedContactsForClient(client)}
            clientContactIds={clients.map(c => c.contact_id)}
            jobId={jobId}
            onSetPrimary={handleSetPrimary}
            navigate={navigate}
          />
        ))
      )}

      {/* Help text */}
      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-4">
        <StarIconSolid className="h-3 w-3 text-yellow-500" />
        Click the star to set the primary client for this job.
      </div>
    </div>
  )
}
