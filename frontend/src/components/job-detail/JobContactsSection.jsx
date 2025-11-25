import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UserIcon,
  PlusIcon,
  TrashIcon,
  StarIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'
import { api } from '../../api'

export default function JobContactsSection({ jobId, contacts: initialContacts, onUpdate, triggerAddContact, onAddContactTriggered }) {
  const navigate = useNavigate()
  const searchInputRef = useRef(null)
  const [contacts, setContacts] = useState(initialContacts || [])
  const [loading, setLoading] = useState(false)
  const [showAddContact, setShowAddContact] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)

  // Load contacts if not provided
  useEffect(() => {
    if (!initialContacts) {
      loadContacts()
    }
  }, [jobId, initialContacts])

  // Handle trigger from parent to open add contact modal
  useEffect(() => {
    if (triggerAddContact) {
      setShowAddContact(true)
      onAddContactTriggered?.()
    }
  }, [triggerAddContact])

  // Auto-focus search input when add contact modal opens
  useEffect(() => {
    if (showAddContact && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }, [showAddContact])

  const loadContacts = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/v1/jobs/${jobId}/construction_contacts`)
      setContacts(response.construction_contacts || [])
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

      // Filter out contacts already added to this job
      const existingContactIds = contacts.map(c => c.contact_id)
      const filtered = (response.contacts || []).filter(
        contact => !existingContactIds.includes(contact.id)
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
      searchContacts(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleAddContact = async (contactId) => {
    try {
      setError(null)
      const response = await api.post(`/api/v1/jobs/${jobId}/construction_contacts`, {
        construction_contact: {
          contact_id: contactId,
          primary: contacts.length === 0, // Make first contact primary
          role: ''
        }
      })

      setContacts([...contacts, response])
      setShowAddContact(false)
      setSearchQuery('')
      setSearchResults([])
      onUpdate?.()
    } catch (err) {
      console.error('Failed to add contact:', err)
      setError('Failed to add contact')
    }
  }

  const handleRemoveContact = async (constructionContactId) => {
    if (contacts.length === 1) {
      alert('Cannot remove the last contact. At least one contact is required.')
      return
    }

    if (!confirm('Are you sure you want to remove this contact from the job?')) return

    try {
      setError(null)
      await api.delete(`/api/v1/jobs/${jobId}/construction_contacts/${constructionContactId}`)
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
        `/api/v1/jobs/${jobId}/construction_contacts/${constructionContactId}`,
        {
          construction_contact: {
            primary: true
          }
        }
      )

      // Update all contacts - set the updated one as primary, others as not primary
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

  if (loading && !initialContacts) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-5 sm:p-6 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center">
            <UserGroupIcon className="h-5 w-5 mr-2 text-gray-400" />
            Client Details
          </h3>
          <button
            onClick={() => setShowAddContact(true)}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Contact
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Add Contact Search */}
        {showAddContact && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">Add Contact to Job</h4>
              <button
                onClick={() => {
                  setShowAddContact(false)
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
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
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

        {/* Contacts List */}
        {contacts.length === 0 ? (
          <div className="text-center py-6">
            <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No contacts</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Get started by adding a contact to this job.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {contacts.map(contact => (
              <div
                key={contact.id}
                className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                {/* Primary Star */}
                <button
                  onClick={() => !contact.primary && handleSetPrimary(contact.id)}
                  className={`flex-shrink-0 mt-0.5 ${
                    contact.primary
                      ? 'text-yellow-500 cursor-default'
                      : 'text-gray-300 dark:text-gray-600 hover:text-yellow-500 dark:hover:text-yellow-500'
                  }`}
                  title={contact.primary ? 'Primary contact' : 'Set as primary contact'}
                >
                  {contact.primary ? (
                    <StarIconSolid className="h-5 w-5" />
                  ) : (
                    <StarIcon className="h-5 w-5" />
                  )}
                </button>

                {/* Contact Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => navigate(`/contacts/${contact.contact_id}`)}
                        className="font-medium text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                      >
                        {getContactDisplayName(contact.contact)}
                      </button>
                      {contact.primary && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400">
                          Primary
                        </span>
                      )}

                      {/* Email and Mobile */}
                      <div className="mt-2 space-y-1">
                        {contact.contact.email && (
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            <span className="font-medium">Email:</span> {contact.contact.email}
                          </div>
                        )}
                        {contact.contact.mobile_phone && (
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            <span className="font-medium">Mobile:</span> {contact.contact.mobile_phone}
                          </div>
                        )}
                      </div>

                      {/* Relationships */}
                      {contact.relationships_count > 0 && (
                        <button
                          onClick={() => navigate(`/contacts/${contact.contact_id}`)}
                          className="mt-1 inline-flex items-center text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                        >
                          <UserGroupIcon className="h-3 w-3 mr-1" />
                          {contact.relationships_count} relationship{contact.relationships_count !== 1 ? 's' : ''}
                        </button>
                      )}
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleRemoveContact(contact.id)}
                      disabled={contacts.length === 1}
                      className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
                        contacts.length === 1
                          ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
                          : 'text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                      }`}
                      title={contacts.length === 1 ? 'Cannot remove last contact' : 'Remove contact'}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {contacts.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <StarIconSolid className="inline h-3 w-3 text-yellow-500 mr-1" />
              Click the star to set the primary contact for this job.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
