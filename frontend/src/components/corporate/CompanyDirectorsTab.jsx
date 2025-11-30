import { useState, useEffect } from 'react'
import {
  PlusIcon,
  UserGroupIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'
import api from '../../api'

const POSITION_OPTIONS = [
  { value: 'director', label: 'Director' },
  { value: 'secretary', label: 'Secretary' },
  { value: 'public_officer', label: 'Public Officer' },
  { value: 'director_secretary', label: 'Director / Secretary' },
  { value: 'director_public_officer', label: 'Director / Public Officer' },
  { value: 'secretary_public_officer', label: 'Secretary / Public Officer' },
  { value: 'director_secretary_public_officer', label: 'Director / Secretary / Public Officer' },
  { value: 'chairman', label: 'Chairman' }
]

export default function CompanyDirectorsTab({ company, onUpdate }) {
  const [directors, setDirectors] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingDirector, setEditingDirector] = useState(null)
  const [contacts, setContacts] = useState([])
  const [activeView, setActiveView] = useState('current')

  useEffect(() => {
    loadData()
  }, [company.id])

  const loadData = async () => {
    try {
      setLoading(true)
      const [directorsRes, contactsRes] = await Promise.all([
        api.get(`/api/v1/companies/${company.id}/directors`),
        api.get('/api/v1/contacts?per_page=1000')
      ])
      setDirectors(directorsRes.directors || [])
      setContacts(contactsRes.contacts || [])
    } catch (error) {
      console.error('Failed to load directors:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleResignDirector = async (directorId) => {
    const resignationDate = prompt('Enter resignation date (YYYY-MM-DD):', new Date().toISOString().split('T')[0])
    if (!resignationDate) return

    try {
      await api.delete(`/api/v1/companies/${company.id}/directors/${directorId}`, {
        data: { resignation_date: resignationDate }
      })
      await loadData()
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error('Failed to resign director:', error)
      alert('Failed to record resignation')
    }
  }

  const handleSaveDirector = async (formData) => {
    try {
      if (editingDirector) {
        // Update existing director - need a new endpoint for this
        await api.put(`/api/v1/companies/${company.id}/directors/${editingDirector.id}`, formData)
      } else {
        await api.post(`/api/v1/companies/${company.id}/add_director`, formData)
      }
      setShowForm(false)
      setEditingDirector(null)
      await loadData()
      if (onUpdate) onUpdate()
    } catch (error) {
      throw error
    }
  }

  // Filter by role type
  const isDirectorPosition = (pos) => ['director', 'director_secretary', 'director_public_officer', 'director_secretary_public_officer', 'chairman'].includes(pos)
  const isSecretaryPosition = (pos) => ['secretary', 'director_secretary', 'secretary_public_officer', 'director_secretary_public_officer'].includes(pos)
  const isPublicOfficerPosition = (pos) => ['public_officer', 'director_public_officer', 'secretary_public_officer', 'director_secretary_public_officer'].includes(pos)

  const currentDirectors = directors.filter(d => d.is_current && isDirectorPosition(d.position))
  const formerDirectors = directors.filter(d => !d.is_current && isDirectorPosition(d.position))
  const currentSecretaries = directors.filter(d => d.is_current && isSecretaryPosition(d.position))
  const formerSecretaries = directors.filter(d => !d.is_current && isSecretaryPosition(d.position))
  const currentPublicOfficers = directors.filter(d => d.is_current && isPublicOfficerPosition(d.position))
  const formerPublicOfficers = directors.filter(d => !d.is_current && isPublicOfficerPosition(d.position))

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading directors...</div>
  }

  // Show form view
  if (showForm) {
    return (
      <DirectorForm
        director={editingDirector}
        contacts={contacts}
        existingDirectorIds={directors.filter(d => d.is_current).map(d => d.contact?.id).filter(Boolean)}
        onSave={handleSaveDirector}
        onCancel={() => { setShowForm(false); setEditingDirector(null) }}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-500">Directors</div>
          <div className="text-2xl font-bold text-gray-900">{currentDirectors.length}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-500">Secretary</div>
          <div className="text-2xl font-bold text-gray-900">{currentSecretaries.length}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-500">Public Officer</div>
          <div className="text-2xl font-bold text-gray-900">{currentPublicOfficers.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveView('current')}
            className={`py-2 px-1 border-b-2 text-sm font-medium ${
              activeView === 'current'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Current
          </button>
          <button
            onClick={() => setActiveView('former')}
            className={`py-2 px-1 border-b-2 text-sm font-medium ${
              activeView === 'former'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Former
          </button>
        </nav>
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <button
          onClick={() => { setEditingDirector(null); setShowForm(true) }}
          className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          Add Officer
        </button>
      </div>

      {/* Content - Three Sections */}
      {activeView === 'current' ? (
        <div className="space-y-8">
          {/* Directors Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
              <UserGroupIcon className="h-5 w-5 mr-2 text-indigo-500" />
              Directors ({currentDirectors.length})
            </h3>
            {currentDirectors.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">No current directors</p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentDirectors.map((d) => (
                  <DirectorCard
                    key={d.id}
                    director={d}
                    isCurrent={true}
                    onEdit={() => { setEditingDirector(d); setShowForm(true) }}
                    onResign={() => handleResignDirector(d.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Secretary Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
              <UserGroupIcon className="h-5 w-5 mr-2 text-green-500" />
              Secretary ({currentSecretaries.length})
            </h3>
            {currentSecretaries.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">No current secretary</p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentSecretaries.map((d) => (
                  <DirectorCard
                    key={d.id}
                    director={d}
                    isCurrent={true}
                    onEdit={() => { setEditingDirector(d); setShowForm(true) }}
                    onResign={() => handleResignDirector(d.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Public Officer Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
              <UserGroupIcon className="h-5 w-5 mr-2 text-amber-500" />
              Public Officer ({currentPublicOfficers.length})
            </h3>
            {currentPublicOfficers.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">No current public officer</p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentPublicOfficers.map((d) => (
                  <DirectorCard
                    key={d.id}
                    director={d}
                    isCurrent={true}
                    onEdit={() => { setEditingDirector(d); setShowForm(true) }}
                    onResign={() => handleResignDirector(d.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Former Directors Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
              <UserGroupIcon className="h-5 w-5 mr-2 text-gray-400" />
              Former Directors ({formerDirectors.length})
            </h3>
            {formerDirectors.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">No former directors</p>
              </div>
            ) : (
              <div className="space-y-3">
                {formerDirectors.map((d) => (
                  <DirectorCard
                    key={d.id}
                    director={d}
                    isCurrent={false}
                    onEdit={() => { setEditingDirector(d); setShowForm(true) }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Former Secretary Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
              <UserGroupIcon className="h-5 w-5 mr-2 text-gray-400" />
              Former Secretary ({formerSecretaries.length})
            </h3>
            {formerSecretaries.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">No former secretaries</p>
              </div>
            ) : (
              <div className="space-y-3">
                {formerSecretaries.map((d) => (
                  <DirectorCard
                    key={d.id}
                    director={d}
                    isCurrent={false}
                    onEdit={() => { setEditingDirector(d); setShowForm(true) }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Former Public Officer Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
              <UserGroupIcon className="h-5 w-5 mr-2 text-gray-400" />
              Former Public Officer ({formerPublicOfficers.length})
            </h3>
            {formerPublicOfficers.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">No former public officers</p>
              </div>
            ) : (
              <div className="space-y-3">
                {formerPublicOfficers.map((d) => (
                  <DirectorCard
                    key={d.id}
                    director={d}
                    isCurrent={false}
                    onEdit={() => { setEditingDirector(d); setShowForm(true) }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DirectorCard({ director, isCurrent, onEdit, onResign }) {
  const contact = director.contact || {}
  const positionLabel = POSITION_OPTIONS.find(p => p.value === director.position)?.label || director.position || 'Director'

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const formatPhone = (phone) => {
    if (!phone) return '-'
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '')
    // Format as 0000 000 000 for Australian mobiles
    if (digits.length === 10 && digits.startsWith('0')) {
      return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
    }
    // Return original if not a standard Australian mobile
    return phone
  }

  return (
    <div className={`bg-white border rounded-lg p-4 hover:border-indigo-300 ${isCurrent ? 'border-gray-200' : 'border-gray-100 bg-gray-50'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center">
            {isCurrent ? (
              <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
            ) : (
              <XCircleIcon className="h-5 w-5 text-gray-400 mr-2" />
            )}
            <h4 className="text-sm font-medium text-gray-900">
              {contact.full_name || contact.display_name || 'Unknown'}
            </h4>
            <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              isCurrent ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {positionLabel}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-gray-500">
            <div>
              <span className="font-medium">Appointed:</span> {formatDate(director.appointment_date)}
            </div>
            {director.resignation_date && (
              <div>
                <span className="font-medium">Resigned:</span> {formatDate(director.resignation_date)}
              </div>
            )}
            {contact.email && (
              <div>
                <span className="font-medium">Email:</span> {contact.email}
              </div>
            )}
            {contact.mobile_phone && (
              <div>
                <span className="font-medium">Phone:</span> {formatPhone(contact.mobile_phone)}
              </div>
            )}
            {contact.date_of_birth && (
              <div>
                <span className="font-medium">DOB:</span> {formatDate(contact.date_of_birth)}
              </div>
            )}
            {contact.director_id && (
              <div>
                <span className="font-medium">Director ID:</span> {contact.director_id}
              </div>
            )}
          </div>
          {director.notes && (
            <div className="mt-2 text-xs text-gray-500 italic">{director.notes}</div>
          )}
        </div>
        <div className="flex items-center space-x-2 ml-4">
          <button
            onClick={onEdit}
            className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          {isCurrent && onResign && (
            <button
              onClick={onResign}
              className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-red-50"
              title="Record Resignation"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function DirectorForm({ director, contacts, existingDirectorIds, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    contact_id: director?.contact?.id || director?.contact_id || '',
    position: director?.position || 'director',
    appointment_date: director?.appointment_date || new Date().toISOString().split('T')[0],
    resignation_date: director?.resignation_date || '',
    notes: director?.notes || ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  // Filter contacts that aren't already current directors (unless editing that director)
  const availableContacts = contacts.filter(c => {
    if (director && c.id === director.contact?.id) return true
    return !existingDirectorIds.includes(c.id)
  })

  // Filter by search term
  const filteredContacts = availableContacts.filter(c => {
    if (!searchTerm) return true
    const name = (c.full_name || c.name || '').toLowerCase()
    return name.includes(searchTerm.toLowerCase())
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave(formData)
    } catch (err) {
      setError(err.response?.data?.errors?.join(', ') || err.response?.data?.error || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-gray-50 rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        {director ? 'Edit Director' : 'Add Director'}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-gray-700">Contact</label>
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          <select
            value={formData.contact_id}
            onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })}
            required
            className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            size={Math.min(filteredContacts.length + 1, 8)}
          >
            <option value="">Select a contact...</option>
            {filteredContacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name || c.name} {c.email ? `(${c.email})` : ''}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {filteredContacts.length} contacts available
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Position</label>
          <select
            value={formData.position}
            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            {POSITION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Appointment Date</label>
            <input
              type="date"
              value={formData.appointment_date}
              onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Resignation Date</label>
            <input
              type="date"
              value={formData.resignation_date}
              onChange={(e) => setFormData({ ...formData, resignation_date: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">Leave blank if still current</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="Optional notes about this director..."
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
