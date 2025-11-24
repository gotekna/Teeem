import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LinkIcon, PencilIcon, TrashIcon, PlusIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid'
import { api } from '../../api'

const RELATIONSHIP_TYPES = [
  // Employment
  { value: 'employee_of', label: 'Employee of', category: 'Employment' },
  { value: 'contractor_for', label: 'Contractor for', category: 'Employment' },

  // Company roles
  { value: 'director_of', label: 'Director of', category: 'Company Roles' },
  { value: 'shareholder_of', label: 'Shareholder of', category: 'Company Roles' },
  { value: 'authorized_signatory_of', label: 'Authorized Signatory of', category: 'Company Roles' },
  { value: 'beneficial_owner_of', label: 'Beneficial Owner of', category: 'Company Roles' },

  // Trust roles
  { value: 'trustee_of', label: 'Trustee of', category: 'Trust Roles' },
  { value: 'beneficiary_of', label: 'Beneficiary of', category: 'Trust Roles' },
  { value: 'appointor_of', label: 'Appointor of', category: 'Trust Roles' },

  // Ownership
  { value: 'owner_of', label: 'Owner of', category: 'Ownership' },
  { value: 'co_owner_with', label: 'Co-owner with', category: 'Ownership' },

  // Business relationships
  { value: 'partner_in', label: 'Partner in', category: 'Business' },
  { value: 'parent_company', label: 'Parent Company', category: 'Business' },
  { value: 'subsidiary', label: 'Subsidiary', category: 'Business' },

  // Legacy/General
  { value: 'previous_client', label: 'Previous Client', category: 'General' },
  { value: 'referral', label: 'Referral', category: 'General' },
  { value: 'supplier_alternate', label: 'Supplier Alternate', category: 'General' },
  { value: 'related_project', label: 'Related Project', category: 'General' },
  { value: 'family_member', label: 'Family Member', category: 'General' },
  { value: 'other', label: 'Other', category: 'General' }
]

// Helper function to format relationship type as human-readable text
const formatRelationshipType = (type) => {
  const relationship = RELATIONSHIP_TYPES.find(r => r.value === type)
  return relationship ? relationship.label : type
}

export default function ContactRelationshipsSection({ contactId, isEditMode }) {
  const navigate = useNavigate()
  const [relationships, setRelationships] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingRelationship, setEditingRelationship] = useState(null)
  const [newRelationship, setNewRelationship] = useState(null)
  const [allContacts, setAllContacts] = useState([])
  const [contactSearchTerm, setContactSearchTerm] = useState('')
  const [showContactDropdown, setShowContactDropdown] = useState(false)

  useEffect(() => {
    loadRelationships()
    loadAllContacts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showContactDropdown && !event.target.closest('.contact-search-container')) {
        setShowContactDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showContactDropdown])

  const loadRelationships = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/v1/contacts/${contactId}/relationships`)
      setRelationships(response.relationships || [])
    } catch (err) {
      console.error('Failed to load relationships:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadAllContacts = async () => {
    try {
      const response = await api.get('/api/v1/contacts')
      // Filter out the current contact
      const otherContacts = response.contacts.filter(c => c.id !== parseInt(contactId))
      setAllContacts(otherContacts)
    } catch (err) {
      console.error('Failed to load contacts:', err)
    }
  }

  const startEditing = (relationship) => {
    if (!isEditMode) return
    setEditingRelationship({
      ...relationship,
      related_contact_id: relationship.related_contact.id
    })
  }

  const startAdding = () => {
    setNewRelationship({
      related_contact_id: '',
      relationship_type: 'employee_of',
      role_in_relationship: '',
      ownership_percentage: null,
      context: '',
      notes: ''
    })
    setContactSearchTerm('')
  }

  const cancelEditing = () => {
    setEditingRelationship(null)
    setNewRelationship(null)
    setContactSearchTerm('')
    setShowContactDropdown(false)
  }

  const saveRelationship = async (relationship, isNew = false) => {
    try {
      if (isNew) {
        await api.post(`/api/v1/contacts/${contactId}/relationships`, {
          contact_relationship: {
            related_contact_id: relationship.related_contact_id,
            relationship_type: relationship.relationship_type,
            notes: relationship.notes
          }
        })
      } else {
        await api.patch(`/api/v1/contacts/${contactId}/relationships/${relationship.id}`, {
          contact_relationship: {
            relationship_type: relationship.relationship_type,
            notes: relationship.notes
          }
        })
      }

      await loadRelationships()
      cancelEditing()
    } catch (error) {
      console.error('Failed to save relationship:', error)
      alert('Failed to save relationship: ' + error.message)
    }
  }

  const deleteRelationship = async (relationshipId) => {
    if (!confirm('Are you sure you want to delete this relationship? This will remove the relationship from both contacts.')) return

    try {
      await api.delete(`/api/v1/contacts/${contactId}/relationships/${relationshipId}`)
      await loadRelationships()
    } catch (error) {
      console.error('Failed to delete relationship:', error)
      alert('Failed to delete relationship: ' + error.message)
    }
  }

  const selectContact = (contactId, contactName) => {
    if (newRelationship) {
      setNewRelationship({ ...newRelationship, related_contact_id: contactId })
    } else if (editingRelationship) {
      setEditingRelationship({ ...editingRelationship, related_contact_id: contactId })
    }
    setContactSearchTerm(contactName)
    setShowContactDropdown(false)
  }

  const filteredContacts = allContacts.filter(contact => {
    if (!contactSearchTerm) return true
    const searchLower = contactSearchTerm.toLowerCase()
    return (
      contact.full_name?.toLowerCase().includes(searchLower) ||
      contact.email?.toLowerCase().includes(searchLower) ||
      contact.company_name?.toLowerCase().includes(searchLower)
    )
  }).slice(0, 10) // Limit to 10 results

  const renderRelationshipForm = (relationship, onChange) => (
    <div className="space-y-3">
      {/* Contact Selector - only for new relationships */}
      {!relationship.id && (
        <div className="contact-search-container relative">
          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
            Related Contact
          </label>
          <input
            type="text"
            placeholder="Search for a contact..."
            value={contactSearchTerm}
            onChange={(e) => {
              setContactSearchTerm(e.target.value)
              setShowContactDropdown(true)
            }}
            onFocus={() => setShowContactDropdown(true)}
            className="w-full px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          {showContactDropdown && filteredContacts.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {filteredContacts.map(contact => (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => selectContact(contact.id, contact.full_name || contact.company_name)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
                >
                  <div className="font-medium text-gray-900 dark:text-white">
                    {contact.full_name || contact.company_name}
                  </div>
                  {contact.email && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">{contact.email}</div>
                  )}
                  {contact.contact_types && contact.contact_types.length > 0 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {contact.contact_types.join(', ')}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Relationship Type */}
      <div>
        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
          Relationship Type
        </label>
        <select
          value={relationship.relationship_type}
          onChange={(e) => onChange({ ...relationship, relationship_type: e.target.value })}
          className="w-full px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        >
          {RELATIONSHIP_TYPES.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      {/* Role in Relationship */}
      <div>
        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
          Role/Title (Optional)
        </label>
        <input
          type="text"
          placeholder="e.g., Managing Director, Sales Manager..."
          value={relationship.role_in_relationship || ''}
          onChange={(e) => onChange({ ...relationship, role_in_relationship: e.target.value })}
          className="w-full px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>

      {/* Ownership Percentage (show for ownership types) */}
      {['shareholder_of', 'owner_of', 'co_owner_with', 'beneficial_owner_of'].includes(relationship.relationship_type) && (
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
            Ownership Percentage (Optional)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder="e.g., 50.00"
            value={relationship.ownership_percentage || ''}
            onChange={(e) => onChange({ ...relationship, ownership_percentage: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
      )}

      {/* Context */}
      <div>
        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
          Context (Optional)
        </label>
        <input
          type="text"
          placeholder="e.g., 123 Main St property, Project XYZ..."
          value={relationship.context || ''}
          onChange={(e) => onChange({ ...relationship, context: e.target.value })}
          className="w-full px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
          Notes (Optional)
        </label>
        <textarea
          placeholder="Add any additional notes about this relationship..."
          value={relationship.notes || ''}
          onChange={(e) => onChange({ ...relationship, notes: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white resize-none"
        />
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg p-6 mb-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-indigo-600 rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <LinkIcon className="h-5 w-5" />
          Related Contacts
        </h2>
        <button
          onClick={startAdding}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md border border-gray-300 dark:border-gray-600"
        >
          <PlusIcon className="h-4 w-4" />
          Add Relationship
        </button>
      </div>

      {relationships.length === 0 && !newRelationship && (
        <p className="text-sm text-gray-500 dark:text-gray-400">No related contacts</p>
      )}

      <div className="space-y-3">
        {relationships.map((relationship) => (
          <div key={relationship.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            {editingRelationship?.id === relationship.id ? (
              // Edit mode
              <div>
                {renderRelationshipForm(editingRelationship, setEditingRelationship)}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => saveRelationship(editingRelationship)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-green-600 hover:bg-green-700 rounded-md"
                  >
                    <CheckCircleIcon className="h-4 w-4" />
                    Save
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md"
                  >
                    <XCircleIcon className="h-4 w-4" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              // Display mode
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      onClick={() => navigate(`/contacts/${relationship.related_contact.id}`)}
                      className="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      {relationship.related_contact.full_name || relationship.related_contact.company_name}
                    </button>
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200">
                      {formatRelationshipType(relationship.relationship_type)}
                    </span>
                  </div>

                  {relationship.related_contact.email && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      {relationship.related_contact.email}
                    </p>
                  )}

                  {relationship.related_contact.phone && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      {relationship.related_contact.phone}
                    </p>
                  )}

                  {relationship.related_contact.contact_types && relationship.related_contact.contact_types.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {relationship.related_contact.contact_types.map((type, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  )}

                  {relationship.notes && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 p-2 bg-gray-50 dark:bg-gray-900/50 rounded">
                      {relationship.notes}
                    </p>
                  )}
                </div>
                {isEditMode && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEditing(relationship)}
                      className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteRelationship(relationship.id)}
                      className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Add new relationship form */}
        {newRelationship && (
          <div className="border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 bg-indigo-50 dark:bg-indigo-900/10">
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">New Relationship</p>
            {renderRelationshipForm(newRelationship, setNewRelationship)}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => saveRelationship(newRelationship, true)}
                disabled={!newRelationship.related_contact_id}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircleIcon className="h-4 w-4" />
                Add
              </button>
              <button
                onClick={cancelEditing}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md"
              >
                <XCircleIcon className="h-4 w-4" />
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
