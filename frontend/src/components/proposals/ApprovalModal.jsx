import { useState, useEffect } from 'react'
import { XMarkIcon, MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline'
import { api } from '../../api'

export default function ApprovalModal({ proposal, onApprove, onCancel, processing }) {
  const data = proposal.extracted_data || {}
  const email = proposal.email || {}

  // Contact states
  const [clientContact, setClientContact] = useState(null)
  const [externalSalesContacts, setExternalSalesContacts] = useState([])
  const [referralContact, setReferralContact] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchMode, setSearchMode] = useState(null) // 'client', 'external_sales', or 'referral'

  // Job detail states
  const [jobAddress, setJobAddress] = useState(data.job_title || '')
  const [jobType, setJobType] = useState(null)
  const [jobStatus, setJobStatus] = useState(null)
  const [jobEstimate, setJobEstimate] = useState(data.contract_value || '')
  const [notes, setNotes] = useState('')

  // Dropdown options
  const [jobTypes, setJobTypes] = useState([])
  const [jobStatuses, setJobStatuses] = useState([])
  const [loadingOptions, setLoadingOptions] = useState(false)

  useEffect(() => {
    // Initialize with AI-detected contacts
    if (data.customer?.contact_exists) {
      setClientContact(data.customer)
    }
    if (data.external_sales?.length > 0) {
      setExternalSalesContacts(data.external_sales.filter(s => s.contact_exists))
    }
    if (data.referral_contact?.contact_exists) {
      setReferralContact(data.referral_contact)
    }

    // Load job types and statuses
    loadJobOptions()
  }, [])

  const loadJobOptions = async () => {
    setLoadingOptions(true)
    try {
      const [typesRes, statusesRes] = await Promise.all([
        api.get('/api/v1/job_types'),
        api.get('/api/v1/job_status')
      ])
      setJobTypes(typesRes.job_types || [])
      setJobStatuses(statusesRes.job_statuses || [])

      // Try to match AI-detected job type to system job type
      if (data.job_type && typesRes.job_types) {
        const matchedType = typesRes.job_types.find(t =>
          t.name.toLowerCase().includes(data.job_type.toLowerCase()) ||
          data.job_type.toLowerCase().includes(t.name.toLowerCase())
        )
        if (matchedType) {
          setJobType(matchedType.id)
        }
      }

      // Default to "Enquiry" status if available
      if (statusesRes.job_statuses) {
        const enquiryStatus = statusesRes.job_statuses.find(s => s.name === 'Enquiry')
        if (enquiryStatus) {
          setJobStatus(enquiryStatus.id)
        }
      }
    } catch (error) {
      console.error('Failed to load job options:', error)
    } finally {
      setLoadingOptions(false)
    }
  }

  const searchContacts = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([])
      return
    }

    try {
      const response = await api.get(`/api/v1/contacts?search=${encodeURIComponent(query)}&limit=10`)
      setSearchResults(response.contacts || [])
    } catch (error) {
      console.error('Failed to search contacts:', error)
    }
  }

  const handleSearchChange = (value) => {
    setSearchQuery(value)
    searchContacts(value)
  }

  const handleSetClient = (contact) => {
    setClientContact({
      contact_id: contact.id,
      name: contact.full_name,
      email: contact.email,
      contact_exists: true
    })
    setSearchQuery('')
    setSearchResults([])
    setSearchMode(null)
  }

  const handleAddExternalSales = (contact) => {
    if (!externalSalesContacts.find(c => c.contact_id === contact.id)) {
      setExternalSalesContacts([...externalSalesContacts, {
        contact_id: contact.id,
        name: contact.full_name,
        email: contact.email,
        contact_exists: true
      }])
    }
    setSearchQuery('')
    setSearchResults([])
    setSearchMode(null)
  }

  const handleSetReferral = (contact) => {
    setReferralContact({
      contact_id: contact.id,
      name: contact.full_name,
      email: contact.email,
      contact_exists: true
    })
    setSearchQuery('')
    setSearchResults([])
    setSearchMode(null)
  }

  const handleRemoveClient = () => {
    setClientContact(null)
  }

  const handleRemoveExternalSales = (contactId) => {
    setExternalSalesContacts(externalSalesContacts.filter(c => c.contact_id !== contactId))
  }

  const handleRemoveReferral = () => {
    setReferralContact(null)
  }

  const handleSubmit = () => {
    const userEdits = {}

    // Add client contact ID
    if (clientContact?.contact_id) {
      userEdits.client_contact_id = clientContact.contact_id
    }

    // Add referral contact ID
    if (referralContact?.contact_id) {
      userEdits.referral_contact_id = referralContact.contact_id
    }

    // Add external sales contact IDs
    if (externalSalesContacts.length > 0) {
      userEdits.external_sales_contact_ids = externalSalesContacts.map(c => c.contact_id)
    }

    // Add job address if changed
    if (jobAddress && jobAddress !== data.job_title) {
      userEdits.job_title = jobAddress
    }

    // Add job type
    if (jobType) {
      userEdits.job_type_id = jobType
    }

    // Add job status
    if (jobStatus) {
      userEdits.job_status_id = jobStatus
    }

    // Add job estimate
    if (jobEstimate) {
      userEdits.contract_value = parseFloat(jobEstimate)
    }

    // Add notes if provided
    if (notes) {
      userEdits.notes = notes
    }

    onApprove(proposal.id, userEdits)
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="text-lg font-medium text-gray-900">Review & Approve Proposal</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-500">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Client */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Client</label>
              {!clientContact && (
                <button
                  type="button"
                  onClick={() => setSearchMode('client')}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                >
                  <PlusIcon className="w-4 h-4 mr-1" />
                  Add
                </button>
              )}
            </div>

            {clientContact ? (
              <div className="flex items-center justify-between bg-white px-3 py-2 rounded border border-gray-200">
                <div className="text-sm">
                  <div className="font-medium">{clientContact.name}</div>
                  <div className="text-gray-500 text-xs">{clientContact.email}</div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveClient}
                  className="text-red-600 hover:text-red-800 text-xs"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="text-sm text-gray-500 italic">No client selected</div>
            )}
          </div>

          {/* Referral */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Referral</label>
              {!referralContact && (
                <button
                  type="button"
                  onClick={() => setSearchMode('referral')}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                >
                  <PlusIcon className="w-4 h-4 mr-1" />
                  Add
                </button>
              )}
            </div>

            {referralContact ? (
              <div className="flex items-center justify-between bg-white px-3 py-2 rounded border border-gray-200">
                <div className="text-sm">
                  <div className="font-medium">{referralContact.name}</div>
                  {referralContact.email && (
                    <div className="text-gray-500 text-xs">{referralContact.email}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleRemoveReferral}
                  className="text-red-600 hover:text-red-800 text-xs"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="text-sm text-gray-500 italic">No referral selected</div>
            )}
          </div>

          {/* External Sales */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">External Sales</label>
              <button
                type="button"
                onClick={() => setSearchMode('external_sales')}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
              >
                <PlusIcon className="w-4 h-4 mr-1" />
                Add
              </button>
            </div>

            {externalSalesContacts.length > 0 ? (
              <div className="space-y-2">
                {externalSalesContacts.map((contact, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white px-3 py-2 rounded border border-gray-200">
                    <div className="text-sm">
                      <div className="font-medium">{contact.name}</div>
                      <div className="text-gray-500 text-xs">{contact.email}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveExternalSales(contact.contact_id)}
                      className="text-red-600 hover:text-red-800 text-xs"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500 italic">No external sales selected</div>
            )}
          </div>

          {/* Job Address */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Job Address
            </label>
            <input
              type="text"
              value={jobAddress}
              onChange={(e) => setJobAddress(e.target.value)}
              placeholder="Enter full address"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
            {data.description && (
              <p className="mt-1 text-sm text-gray-500">{data.description}</p>
            )}
            {email.has_attachments && (
              <p className="mt-1 text-xs text-blue-600">
                💡 Check attachments for address (may be in plans/documents)
              </p>
            )}
          </div>

          {/* Job Type */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Job Type
            </label>
            <select
              value={jobType || ''}
              onChange={(e) => setJobType(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
              disabled={loadingOptions}
            >
              <option value="">Select job type...</option>
              {jobTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
            {data.job_type && (
              <p className="mt-1 text-xs text-gray-500">AI detected: {data.job_type}</p>
            )}
          </div>

          {/* Job Status */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Job Status
            </label>
            <select
              value={jobStatus || ''}
              onChange={(e) => setJobStatus(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
              disabled={loadingOptions}
            >
              <option value="">Select job status...</option>
              {jobStatuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </select>
          </div>

          {/* Job Estimate */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Job Estimate
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                value={jobEstimate}
                onChange={(e) => setJobEstimate(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
              />
            </div>
            {data.contract_value && (
              <p className="mt-1 text-xs text-gray-500">
                AI detected: ${data.contract_value.toLocaleString()}
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about the job..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
          </div>

          {/* Contact Search Modal */}
          {searchMode && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Search Contacts for {searchMode === 'client' ? 'Client' : searchMode === 'external_sales' ? 'External Sales' : 'Referral'}
              </h4>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>

              {searchResults.length > 0 && (
                <div className="mt-2 border border-gray-200 rounded-md max-h-60 overflow-y-auto">
                  {searchResults.map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => {
                        if (searchMode === 'client') handleSetClient(contact)
                        else if (searchMode === 'external_sales') handleAddExternalSales(contact)
                        else handleSetReferral(contact)
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="font-medium text-sm">{contact.full_name || contact.company_name}</div>
                      <div className="text-xs text-gray-500">{contact.email}</div>
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setSearchMode(null)
                  setSearchQuery('')
                  setSearchResults([])
                }}
                className="mt-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel search
              </button>
            </div>
          )}

          {/* AI Extracted Details (collapsed at bottom) */}
          <details className="border-t border-gray-200 pt-4">
            <summary className="text-sm font-medium text-gray-700 cursor-pointer mb-2">
              AI Extracted Details
            </summary>
            <div className="grid grid-cols-2 gap-3 text-sm mt-2">
              <div>
                <span className="text-gray-500">Urgency:</span>
                <span className="ml-2 font-medium">{data.urgency || 'Not specified'}</span>
              </div>
              <div>
                <span className="text-gray-500">Confidence:</span>
                <span className="ml-2 font-medium">{Math.round((data.confidence_score || 0) * 100)}%</span>
              </div>
            </div>
          </details>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            disabled={processing}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={processing}
            className="px-4 py-2 bg-green-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {processing ? 'Creating Job...' : 'Approve & Create Job'}
          </button>
        </div>
      </div>
    </div>
  )
}
