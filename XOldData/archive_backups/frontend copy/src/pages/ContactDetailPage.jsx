import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../api'
import {
  EnvelopeIcon,
  PhoneIcon,
  GlobeAltIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline'

export default function ContactDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [contact, setContact] = useState(null)
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadContact()
    loadSuppliers()
  }, [id])

  const loadContact = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/v1/contacts/${id}`)
      setContact(response.contact)
    } catch (err) {
      setError('Failed to load contact')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadSuppliers = async () => {
    try {
      const response = await api.get('/api/v1/suppliers')
      // Filter suppliers that are linked to this contact
      const linkedSuppliers = response.suppliers.filter(s => s.contact_id === parseInt(id))
      setSuppliers(linkedSuppliers)
    } catch (err) {
      console.error('Failed to load suppliers:', err)
    }
  }

  const deleteContact = async () => {
    if (!confirm('Are you sure you want to delete this contact? This will unlink all associated suppliers.')) return

    try {
      await api.delete(`/api/v1/contacts/${id}`)
      navigate('/suppliers')
    } catch (err) {
      alert('Failed to delete contact')
      console.error(err)
    }
  }

  const getMatchBadge = (supplier) => {
    if (supplier.is_verified) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircleIcon className="h-3 w-3" />
          Verified
        </span>
      )
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
        <ExclamationTriangleIcon className="h-3 w-3" />
        Needs Review
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600 dark:text-gray-400">Loading contact...</div>
      </div>
    )
  }

  if (error || !contact) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="text-red-600 dark:text-red-400 mb-4">{error || 'Contact not found'}</div>
          <Link to="/suppliers" className="text-blue-600 hover:text-blue-700 dark:text-blue-400">
            Back to Suppliers
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/suppliers')}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 mb-4"
        >
          <ArrowLeftIcon className="h-5 w-5" />
          Back to Suppliers
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {contact.full_name || contact.first_name || 'Unnamed Contact'}
            </h1>
            {contact.parent && (
              <p className="text-gray-600 dark:text-gray-400">
                Parent: {contact.parent}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/contacts/${id}/edit`)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <PencilIcon className="h-5 w-5" />
              Edit
            </button>
            <button
              onClick={deleteContact}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              <TrashIcon className="h-5 w-5" />
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Contact Information</h2>

            <div className="space-y-4">
              {contact.email && (
                <div className="flex items-start gap-3">
                  <EnvelopeIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                    <a href={`mailto:${contact.email}`} className="text-blue-600 hover:text-blue-700 dark:text-blue-400">
                      {contact.email}
                    </a>
                  </div>
                </div>
              )}

              {contact.mobile_phone && (
                <div className="flex items-start gap-3">
                  <PhoneIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Mobile Phone</p>
                    <a href={`tel:${contact.mobile_phone}`} className="text-gray-900 dark:text-white">
                      {contact.mobile_phone}
                    </a>
                  </div>
                </div>
              )}

              {contact.office_phone && (
                <div className="flex items-start gap-3">
                  <PhoneIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Office Phone</p>
                    <a href={`tel:${contact.office_phone}`} className="text-gray-900 dark:text-white">
                      {contact.office_phone}
                    </a>
                  </div>
                </div>
              )}

              {contact.website && (
                <div className="flex items-start gap-3">
                  <GlobeAltIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Website</p>
                    <a
                      href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      {contact.website}
                    </a>
                  </div>
                </div>
              )}

              {!contact.email && !contact.mobile_phone && !contact.office_phone && !contact.website && (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No contact information available</p>
              )}
            </div>
          </div>

          {/* Business Details */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Business Details</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {contact.tax_number && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Tax Number (ABN)</p>
                  <p className="text-gray-900 dark:text-white font-medium">{contact.tax_number}</p>
                </div>
              )}

              {contact.xero_id && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Xero ID</p>
                  <p className="text-gray-900 dark:text-white font-mono text-sm">{contact.xero_id}</p>
                </div>
              )}

              {contact.sync_with_xero !== null && contact.sync_with_xero !== undefined && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Sync with Xero</p>
                  <p className="text-gray-900 dark:text-white font-medium">
                    {contact.sync_with_xero ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
              )}

              {contact.branch !== null && contact.branch !== undefined && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Branch</p>
                  <p className="text-gray-900 dark:text-white font-medium">
                    {contact.branch ? 'Yes' : 'No'}
                  </p>
                </div>
              )}
            </div>

            {!contact.tax_number && !contact.xero_id && contact.sync_with_xero === null && contact.branch === null && (
              <p className="text-gray-500 dark:text-gray-400 text-sm">No business details available</p>
            )}
          </div>

          {/* Linked Suppliers */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Linked Suppliers ({suppliers.length})
            </h2>

            {suppliers.length > 0 ? (
              <div className="space-y-3">
                {suppliers.map((supplier) => (
                  <div key={supplier.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-750 rounded-lg">
                    <div className="flex-1">
                      <Link
                        to="/suppliers"
                        className="text-gray-900 dark:text-white font-medium hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {supplier.name}
                      </Link>
                      <div className="flex items-center gap-2 mt-1">
                        {getMatchBadge(supplier)}
                        {supplier.confidence_score && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {(supplier.confidence_score * 100).toFixed(1)}% match
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {supplier.pricebook_items?.length || 0} items
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-sm">No suppliers linked to this contact</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Location & Region */}
          {(contact.contact_region || contact.contact_region_id) && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-2 mb-4">
                <MapPinIcon className="h-5 w-5 text-gray-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Location</h2>
              </div>

              <div className="space-y-3">
                {contact.contact_region && (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Region</p>
                    <p className="text-gray-900 dark:text-white font-medium">{contact.contact_region}</p>
                  </div>
                )}

                {contact.contact_region_id && (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Region ID</p>
                    <p className="text-gray-900 dark:text-white font-mono text-sm">{contact.contact_region_id}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* System Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-2 mb-4">
              <BuildingOfficeIcon className="h-5 w-5 text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">System Info</h2>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Contact ID</p>
                <p className="text-gray-900 dark:text-white font-mono text-sm">#{contact.id}</p>
              </div>

              {contact.sys_type_id && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">System Type ID</p>
                  <p className="text-gray-900 dark:text-white font-mono text-sm">{contact.sys_type_id}</p>
                </div>
              )}

              {contact.drive_id && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Drive ID</p>
                  <p className="text-gray-900 dark:text-white font-mono text-sm break-all">{contact.drive_id}</p>
                </div>
              )}

              {contact.folder_id && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Folder ID</p>
                  <p className="text-gray-900 dark:text-white font-mono text-sm break-all">{contact.folder_id}</p>
                </div>
              )}

              {contact.deleted && (
                <div>
                  <p className="text-sm text-red-500 dark:text-red-400 font-medium">Marked as Deleted</p>
                </div>
              )}

              {contact.created_at && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Created</p>
                  <p className="text-gray-900 dark:text-white text-sm">
                    {new Date(contact.created_at).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Stats</h2>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">Total Suppliers</span>
                <span className="text-lg font-semibold text-gray-900 dark:text-white">{suppliers.length}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">Verified</span>
                <span className="text-lg font-semibold text-green-600 dark:text-green-400">
                  {suppliers.filter(s => s.is_verified).length}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">Needs Review</span>
                <span className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">
                  {suppliers.filter(s => !s.is_verified).length}
                </span>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">Total Items</span>
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  {suppliers.reduce((sum, s) => sum + (s.pricebook_items?.length || 0), 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
