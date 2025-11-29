import { useState, useEffect } from 'react'
import api from '../../api'

export default function AssetForm({ asset, onSave, onCancel }) {
  const [companies, setCompanies] = useState([])
  const [formData, setFormData] = useState({
    company_id: asset?.company_id || '',
    description: asset?.description || '',
    abbreviation: asset?.abbreviation || '',
    asset_type: asset?.asset_type || 'vehicle',
    make: asset?.make || '',
    model: asset?.model || '',
    year: asset?.year || '',
    vin: asset?.vin || '',
    registration: asset?.registration || '',
    purchase_date: asset?.purchase_date || '',
    purchase_price: asset?.purchase_price || '',
    current_value: asset?.current_value || '',
    depreciation_rate: asset?.depreciation_rate || '',
    status: asset?.status || 'active',
    disposal_date: asset?.disposal_date || '',
    disposal_value: asset?.disposal_value || '',
    notes: asset?.notes || ''
  })

  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const assetTypes = ['vehicle', 'equipment', 'property', 'other']
  const statuses = ['active', 'disposed', 'sold', 'written_off']

  useEffect(() => {
    loadCompanies()
  }, [])

  const loadCompanies = async () => {
    try {
      const response = await api.get('/api/v1/companies')
      setCompanies(response.companies || [])
    } catch (error) {
      console.error('Failed to load companies:', error)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }))
    }
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.company_id) {
      newErrors.company_id = 'Company is required'
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required'
    }

    if (formData.abbreviation && !/^[A-Z0-9\-]+$/.test(formData.abbreviation)) {
      newErrors.abbreviation = 'Must be uppercase letters, numbers, or hyphens'
    }

    if (formData.purchase_price && isNaN(parseFloat(formData.purchase_price))) {
      newErrors.purchase_price = 'Must be a valid number'
    }

    if (formData.current_value && isNaN(parseFloat(formData.current_value))) {
      newErrors.current_value = 'Must be a valid number'
    }

    if (formData.depreciation_rate && isNaN(parseFloat(formData.depreciation_rate))) {
      newErrors.depreciation_rate = 'Must be a valid number'
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
      setErrors({ submit: error.message || 'Failed to save asset' })
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
            <label htmlFor="company_id" className="block text-sm font-medium text-gray-700">
              Company *
            </label>
            <select
              name="company_id"
              id="company_id"
              required
              value={formData.company_id}
              onChange={handleChange}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                errors.company_id ? 'border-red-300' : ''
              }`}
            >
              <option value="">Select company...</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            {errors.company_id && <p className="mt-1 text-sm text-red-600">{errors.company_id}</p>}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description *
            </label>
            <input
              type="text"
              name="description"
              id="description"
              required
              value={formData.description}
              onChange={handleChange}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                errors.description ? 'border-red-300' : ''
              }`}
            />
            {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="abbreviation" className="block text-sm font-medium text-gray-700">
              Abbreviation
            </label>
            <input
              type="text"
              name="abbreviation"
              id="abbreviation"
              value={formData.abbreviation}
              onChange={handleChange}
              placeholder="e.g., NEV, SHARES-TH"
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                errors.abbreviation ? 'border-red-300' : ''
              }`}
            />
            <p className="mt-1 text-xs text-gray-500">
              Short code for document naming (uppercase letters, numbers, or hyphens)
            </p>
            {errors.abbreviation && <p className="mt-1 text-sm text-red-600">{errors.abbreviation}</p>}
          </div>

          <div>
            <label htmlFor="asset_type" className="block text-sm font-medium text-gray-700">
              Asset Type
            </label>
            <select
              name="asset_type"
              id="asset_type"
              value={formData.asset_type}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              {assetTypes.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
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
        </div>
      </div>

      {/* Vehicle Details */}
      {formData.asset_type === 'vehicle' && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Vehicle Details</h3>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="make" className="block text-sm font-medium text-gray-700">
                Make
              </label>
              <input
                type="text"
                name="make"
                id="make"
                value={formData.make}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="model" className="block text-sm font-medium text-gray-700">
                Model
              </label>
              <input
                type="text"
                name="model"
                id="model"
                value={formData.model}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="year" className="block text-sm font-medium text-gray-700">
                Year
              </label>
              <input
                type="number"
                name="year"
                id="year"
                min="1900"
                max="2100"
                value={formData.year}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="registration" className="block text-sm font-medium text-gray-700">
                Registration
              </label>
              <input
                type="text"
                name="registration"
                id="registration"
                value={formData.registration}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="vin" className="block text-sm font-medium text-gray-700">
                VIN
              </label>
              <input
                type="text"
                name="vin"
                id="vin"
                value={formData.vin}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Financial Information */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Financial Information</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="purchase_date" className="block text-sm font-medium text-gray-700">
              Purchase Date
            </label>
            <input
              type="date"
              name="purchase_date"
              id="purchase_date"
              value={formData.purchase_date}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="purchase_price" className="block text-sm font-medium text-gray-700">
              Purchase Price
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                name="purchase_price"
                id="purchase_price"
                step="0.01"
                value={formData.purchase_price}
                onChange={handleChange}
                className={`block w-full rounded-md border-gray-300 pl-7 pr-12 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                  errors.purchase_price ? 'border-red-300' : ''
                }`}
              />
            </div>
            {errors.purchase_price && <p className="mt-1 text-sm text-red-600">{errors.purchase_price}</p>}
          </div>

          <div>
            <label htmlFor="current_value" className="block text-sm font-medium text-gray-700">
              Current Value
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                name="current_value"
                id="current_value"
                step="0.01"
                value={formData.current_value}
                onChange={handleChange}
                className={`block w-full rounded-md border-gray-300 pl-7 pr-12 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                  errors.current_value ? 'border-red-300' : ''
                }`}
              />
            </div>
            {errors.current_value && <p className="mt-1 text-sm text-red-600">{errors.current_value}</p>}
          </div>

          <div>
            <label htmlFor="depreciation_rate" className="block text-sm font-medium text-gray-700">
              Depreciation Rate (%)
            </label>
            <input
              type="number"
              name="depreciation_rate"
              id="depreciation_rate"
              step="0.01"
              min="0"
              max="100"
              value={formData.depreciation_rate}
              onChange={handleChange}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                errors.depreciation_rate ? 'border-red-300' : ''
              }`}
            />
            {errors.depreciation_rate && <p className="mt-1 text-sm text-red-600">{errors.depreciation_rate}</p>}
          </div>

          {formData.status !== 'active' && (
            <>
              <div>
                <label htmlFor="disposal_date" className="block text-sm font-medium text-gray-700">
                  Disposal Date
                </label>
                <input
                  type="date"
                  name="disposal_date"
                  id="disposal_date"
                  value={formData.disposal_date}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="disposal_value" className="block text-sm font-medium text-gray-700">
                  Disposal Value
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    name="disposal_value"
                    id="disposal_value"
                    step="0.01"
                    value={formData.disposal_value}
                    onChange={handleChange}
                    className="block w-full rounded-md border-gray-300 pl-7 pr-12 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
            </>
          )}
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
          {loading ? 'Saving...' : asset ? 'Update Asset' : 'Create Asset'}
        </button>
      </div>
    </form>
  )
}
