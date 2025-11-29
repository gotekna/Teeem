import { useState, useEffect } from 'react'
import { XMarkIcon, MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline'
import { api } from '../../api'

export default function ApprovalModal({ proposal, onApprove, onCancel, processing }) {
  const data = proposal.extracted_data || {}
  const email = proposal.email || {}
  const [externalSalesContacts, setExternalSalesContacts] = useState([])
  const [referralContact, setReferralContact] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchMode, setSearchMode] = useState(null) // 'external_sales' or 'referral'
  const [jobTitle, setJobTitle] = useState(data.job_title || '')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    // Initialize with AI-detected contacts
    if (data.external_sales?.length > 0) {
      setExternalSalesContacts(data.external_sales.filter(s => s.contact_exists))
    }
    if (data.referral_contact?.contact_exists) {
      setReferralContact(data.referral_contact)
    }
  }, [])

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

  const handleRemoveExternalSales = (contactId) => {
    setExternalSalesContacts(externalSalesContacts.filter(c => c.contact_id !== contactId))
  }

  const handleRemoveReferral = () => {
    setReferralContact(null)
  }

  const handleSubmit = () => {
    const userEdits = {}

    // Add job title if changed
    if (jobTitle && jobTitle !== data.job_title) {
      userEdits.job_title = jobTitle
    }

    // Add notes if provided
    if (notes) {
      userEdits.notes = notes
    }

    // Add external sales contact IDs
    if (externalSalesContacts.length > 0) {
      userEdits.external_sales_contact_ids = externalSalesContacts.map(c => c.contact_id)
    }

    // Add referral contact ID
    if (referralContact?.contact_id) {
      userEdits.referral_contact_id = referralContact.contact_id
    }

    onApprove(proposal.id, userEdits)
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Review & Approve Proposal</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-500">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Job Title (Editable) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job Title / Address
            </label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Enter full address or project title"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
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

          {/* Notes / Additional Info */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about job type, status, or other details from attachments..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* AI Extracted Details */}
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">AI Extracted Details</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Job Type:</span>
                <span className="ml-2 font-medium">{data.job_type || 'Not specified'}</span>
              </div>
              <div>
                <span className="text-gray-500">Urgency:</span>
                <span className="ml-2 font-medium">{data.urgency || 'Not specified'}</span>
              </div>
              <div>
                <span className="text-gray-500">Value:</span>
                <span className="ml-2 font-medium">
                  {data.contract_value ? `$${data.contract_value.toLocaleString()}` : 'Not specified'}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Confidence:</span>
                <span className="ml-2 font-medium">{Math.round((data.confidence_score || 0) * 100)}%</span>
              </div>
            </div>
          </div>

          {/* Customer */}
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Customer</h4>
            <div className="text-sm text-gray-600">
              {data.customer?.name} ({data.customer?.email})
            </div>
          </div>

          {/* Internal Sales (Read-only) */}
          {data.internal_sales && (
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Internal Sales Person</h4>
              <div className="text-sm text-gray-600">
                {data.internal_sales.user_name} ({data.internal_sales.user_email})
              </div>
            </div>
          )}

          {/* External Sales (Editable) */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">External Sales (Optional)</h4>
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
                  <div key={idx} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
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
              <div className="text-sm text-gray-500 italic">None selected</div>
            )}
          </div>

          {/* Referral (Editable) */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">Referral Contact (Optional)</h4>
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
              <div className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
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
              <div className="text-sm text-gray-500 italic">None selected</div>
            )}
          </div>

          {/* Contact Search */}
          {searchMode && (
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Search Contacts for {searchMode === 'external_sales' ? 'External Sales' : 'Referral'}
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
                      onClick={() => searchMode === 'external_sales' ? handleAddExternalSales(contact) : handleSetReferral(contact)}
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
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
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
