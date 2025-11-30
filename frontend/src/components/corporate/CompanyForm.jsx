import { useState } from 'react'
import { XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import api from '../../api'

export default function CompanyForm({ company, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: company?.name || '',
    company_group: company?.company_group || '',
    acn: company?.acn || '',
    abn: company?.abn || '',
    tfn: company?.tfn || '',
    status: company?.status || 'active',
    date_incorporated: company?.date_incorporated || '',
    registered_office_address: company?.registered_office_address || '',
    principal_place_of_business: company?.principal_place_of_business || '',
    is_trustee: company?.is_trustee || false,
    trust_name: company?.trust_name || '',
    gst_registration_status: company?.gst_registration_status || '',
    asic_username: company?.asic_username || '',
    asic_password: company?.asic_password || '',
    asic_recovery_question: company?.asic_recovery_question || '',
    asic_recovery_answer: company?.asic_recovery_answer || '',
    asic_last_review_date: company?.asic_last_review_date || '',
    asic_next_review_date: company?.asic_next_review_date || '',
    notes: company?.notes || ''
  })

  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupResult, setLookupResult] = useState(null)

  const groups = ['tekna', 'team_harder', 'promise', 'charity', 'other']
  const statuses = ['active', 'struck_off', 'in_liquidation', 'dormant']
  const gstStatuses = ['registered', 'not_registered', 'pending']

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }))
    }
  }

  // Look up company details from ABR (Australian Business Register)
  const handleLookup = async () => {
    const abn = formData.abn?.replace(/\s/g, '')
    const acn = formData.acn?.replace(/\s/g, '')

    if (!abn && !acn) {
      setErrors(prev => ({ ...prev, lookup: 'Enter an ABN or ACN to lookup' }))
      return
    }

    setLookupLoading(true)
    setLookupResult(null)
    setErrors(prev => ({ ...prev, lookup: null }))

    try {
      const response = await api.post('/api/v1/asic/auto_populate', { abn, acn })

      if (response.data.success && response.data.form_data) {
        const data = response.data.form_data

        // Auto-populate form fields with lookup data
        setFormData(prev => ({
          ...prev,
          name: data.name || prev.name,
          abn: data.abn || prev.abn,
          acn: data.acn || prev.acn,
          gst_registration_status: data.gst_registration_status || prev.gst_registration_status,
          registered_office_address: data.registered_address || prev.registered_office_address,
          status: data.status || prev.status
        }))

        setLookupResult({
          success: true,
          message: `Found: ${data.name}`,
          trading_names: data.trading_names,
          raw_data: data.raw_data
        })
      }
    } catch (error) {
      console.error('Lookup error:', error)
      const errorMsg = error.response?.data?.error || 'Lookup failed. Please check the ABN/ACN and try again.'
      setErrors(prev => ({ ...prev, lookup: errorMsg }))
    } finally {
      setLookupLoading(false)
    }
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Company name is required'
    }

    if (!formData.company_group) {
      newErrors.company_group = 'Company group is required'
    }

    if (formData.acn && !/^\d{9}$/.test(formData.acn.replace(/\s/g, ''))) {
      newErrors.acn = 'ACN must be 9 digits'
    }

    if (formData.abn && !/^\d{11}$/.test(formData.abn.replace(/\s/g, ''))) {
      newErrors.abn = 'ABN must be 11 digits'
    }

    if (formData.tfn && !/^\d{9}$/.test(formData.tfn.replace(/\s/g, ''))) {
      newErrors.tfn = 'TFN must be 9 digits'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    setLoading(true)
    try {
      await onSave(formData)
    } catch (error) {
      console.error('Form submission error:', error)
      setErrors({ submit: error.message || 'Failed to save company' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Information */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Company Name *
            </label>
            <input
              type="text"
              name="name"
              id="name"
              required
              value={formData.name}
              onChange={handleChange}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                errors.name ? 'border-red-300' : ''
              }`}
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="company_group" className="block text-sm font-medium text-gray-700">
              Company Group *
            </label>
            <select
              name="company_group"
              id="company_group"
              required
              value={formData.company_group}
              onChange={handleChange}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                errors.company_group ? 'border-red-300' : ''
              }`}
            >
              <option value="">Select group...</option>
              {groups.map((group) => (
                <option key={group} value={group}>
                  {group.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </option>
              ))}
            </select>
            {errors.company_group && <p className="mt-1 text-sm text-red-600">{errors.company_group}</p>}
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700">
              Status
            </label>
            <select
              name="status"
              id="status"
              value={formData.status}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="acn" className="block text-sm font-medium text-gray-700">
              ACN
            </label>
            <input
              type="text"
              name="acn"
              id="acn"
              placeholder="123 456 789"
              value={formData.acn}
              onChange={handleChange}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                errors.acn ? 'border-red-300' : ''
              }`}
            />
            {errors.acn && <p className="mt-1 text-sm text-red-600">{errors.acn}</p>}
          </div>

          <div>
            <label htmlFor="abn" className="block text-sm font-medium text-gray-700">
              ABN
            </label>
            <div className="mt-1 flex rounded-md shadow-sm">
              <input
                type="text"
                name="abn"
                id="abn"
                placeholder="12 345 678 901"
                value={formData.abn}
                onChange={handleChange}
                className={`block w-full rounded-l-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                  errors.abn ? 'border-red-300' : ''
                }`}
              />
              <button
                type="button"
                onClick={handleLookup}
                disabled={lookupLoading}
                className="inline-flex items-center rounded-r-md border border-l-0 border-gray-300 bg-gray-50 px-3 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                title="Lookup company details from ABR"
              >
                {lookupLoading ? (
                  <svg className="animate-spin h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <MagnifyingGlassIcon className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.abn && <p className="mt-1 text-sm text-red-600">{errors.abn}</p>}
            {errors.lookup && <p className="mt-1 text-sm text-red-600">{errors.lookup}</p>}
          </div>

          {/* Lookup Result */}
          {lookupResult && (
            <div className="sm:col-span-2">
              <div className={`rounded-md p-3 ${lookupResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <p className={`text-sm font-medium ${lookupResult.success ? 'text-green-800' : 'text-red-800'}`}>
                  {lookupResult.message}
                </p>
                {lookupResult.trading_names && (
                  <p className="mt-1 text-sm text-green-700">
                    Trading names: {lookupResult.trading_names}
                  </p>
                )}
                {lookupResult.raw_data?.entity_type && (
                  <p className="mt-1 text-sm text-green-700">
                    Entity type: {lookupResult.raw_data.entity_type}
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="tfn" className="block text-sm font-medium text-gray-700">
              TFN
            </label>
            <input
              type="text"
              name="tfn"
              id="tfn"
              placeholder="123 456 789"
              value={formData.tfn}
              onChange={handleChange}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                errors.tfn ? 'border-red-300' : ''
              }`}
            />
            {errors.tfn && <p className="mt-1 text-sm text-red-600">{errors.tfn}</p>}
            <p className="mt-1 text-xs text-gray-500">Stored encrypted</p>
          </div>

          <div>
            <label htmlFor="date_incorporated" className="block text-sm font-medium text-gray-700">
              Date Incorporated
            </label>
            <input
              type="date"
              name="date_incorporated"
              id="date_incorporated"
              value={formData.date_incorporated}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="gst_registration_status" className="block text-sm font-medium text-gray-700">
              GST Registration Status
            </label>
            <select
              name="gst_registration_status"
              id="gst_registration_status"
              value={formData.gst_registration_status}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">Select status...</option>
              {gstStatuses.map((status) => (
                <option key={status} value={status}>
                  {status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Addresses */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Addresses</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="registered_office_address" className="block text-sm font-medium text-gray-700">
              Registered Office Address
            </label>
            <textarea
              name="registered_office_address"
              id="registered_office_address"
              rows={3}
              value={formData.registered_office_address}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="principal_place_of_business" className="block text-sm font-medium text-gray-700">
              Principal Place of Business
            </label>
            <textarea
              name="principal_place_of_business"
              id="principal_place_of_business"
              rows={3}
              value={formData.principal_place_of_business}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>
      </div>

      {/* Trust Information */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Trust Information</h3>
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              name="is_trustee"
              id="is_trustee"
              checked={formData.is_trustee}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="is_trustee" className="ml-2 block text-sm text-gray-900">
              This company acts as a trustee
            </label>
          </div>

          {formData.is_trustee && (
            <div>
              <label htmlFor="trust_name" className="block text-sm font-medium text-gray-700">
                Trust Name
              </label>
              <input
                type="text"
                name="trust_name"
                id="trust_name"
                value={formData.trust_name}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          )}
        </div>
      </div>

      {/* ASIC Information */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">ASIC Information</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="asic_username" className="block text-sm font-medium text-gray-700">
              ASIC Username
            </label>
            <input
              type="text"
              name="asic_username"
              id="asic_username"
              value={formData.asic_username}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="asic_password" className="block text-sm font-medium text-gray-700">
              ASIC Password
            </label>
            <input
              type="password"
              name="asic_password"
              id="asic_password"
              value={formData.asic_password}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">Stored encrypted</p>
          </div>

          <div>
            <label htmlFor="asic_recovery_question" className="block text-sm font-medium text-gray-700">
              Recovery Question
            </label>
            <input
              type="text"
              name="asic_recovery_question"
              id="asic_recovery_question"
              value={formData.asic_recovery_question}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="asic_recovery_answer" className="block text-sm font-medium text-gray-700">
              Recovery Answer
            </label>
            <input
              type="password"
              name="asic_recovery_answer"
              id="asic_recovery_answer"
              value={formData.asic_recovery_answer}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">Stored encrypted</p>
          </div>

          <div>
            <label htmlFor="asic_last_review_date" className="block text-sm font-medium text-gray-700">
              Last ASIC Review Date
            </label>
            <input
              type="date"
              name="asic_last_review_date"
              id="asic_last_review_date"
              value={formData.asic_last_review_date}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="asic_next_review_date" className="block text-sm font-medium text-gray-700">
              Next ASIC Review Date
            </label>
            <input
              type="date"
              name="asic_next_review_date"
              id="asic_next_review_date"
              value={formData.asic_next_review_date}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Notes</h3>
        <div>
          <textarea
            name="notes"
            id="notes"
            rows={4}
            value={formData.notes}
            onChange={handleChange}
            placeholder="Additional notes..."
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end space-x-3">
        {errors.submit && (
          <p className="text-sm text-red-600 mr-auto">{errors.submit}</p>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? 'Saving...' : company ? 'Update Company' : 'Create Company'}
        </button>
      </div>
    </form>
  )
}
