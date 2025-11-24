import { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

/**
 * GoldStandardFormModal - Add/Edit form for Gold Standard items
 *
 * Features:
 * - All column types from COLUMN_TYPES (T19.001-T19.021)
 * - Built-in form validation
 * - Proper error handling and display
 * - Responsive design with dark mode support
 *
 * @param {Object} props
 * @param {Object} props.item - Item to edit (null for new item)
 * @param {Function} props.onSave - Callback when form is saved
 * @param {Function} props.onCancel - Callback when form is cancelled
 * @param {number} props.currentUserId - Current user ID for default values
 */
export default function GoldStandardFormModal({ item, onSave, onCancel, currentUserId = 1 }) {
  const [formData, setFormData] = useState(item || {
    single_line_text: '',
    email: '',
    phone: '',
    mobile: '',
    date: '',
    gps_coordinates: '',
    color_picker: '#000000',
    file_upload: '',
    action_buttons: '',
    lookup: '',
    boolean: true,
    percentage: 0,
    choice: 'active',
    currency: 0,
    number: 0,
    whole_number: 0,
    multiple_lines_text: '',
    url: '',
    user: currentUserId,
    multiple_lookups: ''
  })

  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  // Validation rules
  const validate = () => {
    const newErrors = {}

    // Email validation
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format'
    }

    // URL validation
    if (formData.url && !/^https?:\/\/.+/.test(formData.url)) {
      newErrors.url = 'URL must start with http:// or https://'
    }

    // GPS coordinates validation (lat,lng format)
    if (formData.gps_coordinates && !/^-?\d+\.?\d*,-?\d+\.?\d*$/.test(formData.gps_coordinates)) {
      newErrors.gps_coordinates = 'GPS coordinates must be in format: latitude,longitude'
    }

    // Color picker validation (hex format)
    if (formData.color_picker && !/^#[0-9A-Fa-f]{6}$/.test(formData.color_picker)) {
      newErrors.color_picker = 'Color must be in hex format (e.g., #FF0000)'
    }

    // Percentage range validation
    if (formData.percentage != null && (formData.percentage < 0 || formData.percentage > 100)) {
      newErrors.percentage = 'Percentage must be between 0 and 100'
    }

    // Numeric validation
    if (formData.currency != null && formData.currency < 0) {
      newErrors.currency = 'Currency must be non-negative'
    }
    if (formData.number != null && formData.number < 0) {
      newErrors.number = 'Number must be non-negative'
    }
    if (formData.whole_number != null && formData.whole_number < 0) {
      newErrors.whole_number = 'Whole number must be non-negative'
    }

    // Length validations
    if (formData.single_line_text && formData.single_line_text.length > 255) {
      newErrors.single_line_text = 'Text must be 255 characters or less'
    }
    if (formData.multiple_lines_text && formData.multiple_lines_text.length > 10000) {
      newErrors.multiple_lines_text = 'Text must be 10,000 characters or less'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    setIsSaving(true)
    try {
      await onSave(formData)
    } finally {
      setIsSaving(false)
    }
  }

  const updateField = (field, value) => {
    setFormData({ ...formData, [field]: value })
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors({ ...errors, [field]: null })
    }
  }

  const ErrorMessage = ({ field }) => {
    if (!errors[field]) return null
    return <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors[field]}</p>
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {item ? 'Edit Item' : 'Add New Item'}
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {/* Single Line Text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Single Line Text
              </label>
              <input
                type="text"
                value={formData.single_line_text}
                onChange={(e) => updateField('single_line_text', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="e.g., CONC-001"
                maxLength={255}
              />
              <ErrorMessage field="single_line_text" />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="supplier@example.com"
              />
              <ErrorMessage field="email" />
            </div>

            {/* Phone & Mobile */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="(03) 9123 4567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mobile
                </label>
                <input
                  type="tel"
                  value={formData.mobile}
                  onChange={(e) => updateField('mobile', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="0407 397 541"
                />
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => updateField('date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            {/* GPS Coordinates */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                GPS Coordinates
              </label>
              <input
                type="text"
                value={formData.gps_coordinates}
                onChange={(e) => updateField('gps_coordinates', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="-33.8688, 151.2093"
              />
              <ErrorMessage field="gps_coordinates" />
            </div>

            {/* Color Picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Color Picker
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={formData.color_picker}
                  onChange={(e) => updateField('color_picker', e.target.value)}
                  className="h-10 w-20 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.color_picker}
                  onChange={(e) => updateField('color_picker', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono"
                  placeholder="#000000"
                />
              </div>
              <ErrorMessage field="color_picker" />
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                File Upload
              </label>
              <input
                type="text"
                value={formData.file_upload}
                onChange={(e) => updateField('file_upload', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="/uploads/document.pdf"
              />
            </div>

            {/* Lookup */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Lookup
              </label>
              <select
                value={formData.lookup}
                onChange={(e) => updateField('lookup', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Select...</option>
                <option value="Concrete">Concrete</option>
                <option value="Timber">Timber</option>
                <option value="Steel">Steel</option>
                <option value="Plasterboard">Plasterboard</option>
                <option value="Insulation">Insulation</option>
                <option value="Tiles">Tiles</option>
                <option value="Paint">Paint</option>
                <option value="Roofing">Roofing</option>
                <option value="Electrical">Electrical</option>
                <option value="Plumbing">Plumbing</option>
                <option value="Landscaping">Landscaping</option>
              </select>
            </div>

            {/* Choice */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Choice
              </label>
              <select
                value={formData.choice}
                onChange={(e) => updateField('choice', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Boolean */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.boolean}
                onChange={(e) => updateField('boolean', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Boolean
              </label>
            </div>

            {/* Percentage */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Percentage (0-100)
              </label>
              <input
                type="number"
                value={formData.percentage}
                onChange={(e) => updateField('percentage', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="0"
                min="0"
                max="100"
                step="0.1"
              />
              <ErrorMessage field="percentage" />
            </div>

            {/* Currency, Number, and Whole Number */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Currency
                </label>
                <input
                  type="number"
                  value={formData.currency}
                  onChange={(e) => updateField('currency', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
                <ErrorMessage field="currency" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Number
                </label>
                <input
                  type="number"
                  value={formData.number}
                  onChange={(e) => updateField('number', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
                <ErrorMessage field="number" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Whole Number
                </label>
                <input
                  type="number"
                  value={formData.whole_number}
                  onChange={(e) => updateField('whole_number', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="0"
                  min="0"
                  step="1"
                />
                <ErrorMessage field="whole_number" />
              </div>
            </div>

            {/* URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                URL
              </label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) => updateField('url', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="https://example.com/document.pdf"
              />
              <ErrorMessage field="url" />
            </div>

            {/* Multiple Lines Text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Multiple Lines Text
              </label>
              <textarea
                value={formData.multiple_lines_text}
                onChange={(e) => updateField('multiple_lines_text', e.target.value)}
                rows={3}
                maxLength={10000}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
                placeholder="Enter any notes or description..."
              />
              <ErrorMessage field="multiple_lines_text" />
            </div>

            {/* Auto-populated timestamp note */}
            {!item && (
              <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                ID, Created At, and Updated At will be auto-populated when the item is created
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-700 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-600">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              {isSaving ? 'Saving...' : (item ? 'Update Item' : 'Save Item')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
