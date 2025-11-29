import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  UserCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  PhotoIcon,
  IdentificationIcon,
  ArrowUpTrayIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid'

// Public API client (no auth required)
const publicApi = {
  async get(url) {
    const apiBase = import.meta.env.VITE_API_URL || 'https://teeem-rob-dev-cfbdfa15b107.herokuapp.com'
    const response = await fetch(`${apiBase}${url}`, {
      headers: { 'Content-Type': 'application/json' }
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Request failed')
    }
    return response.json()
  },
  async post(url, data) {
    const apiBase = import.meta.env.VITE_API_URL || 'https://teeem-rob-dev-cfbdfa15b107.herokuapp.com'
    const response = await fetch(`${apiBase}${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || error.errors?.join(', ') || 'Request failed')
    }
    return response.json()
  }
}

// File upload component
function FileUpload({ label, field, value, onChange, required }) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(value)

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // For now, just create a local preview URL
    // In production, this would upload to Cloudinary or SharePoint
    setUploading(true)
    try {
      // Create a data URL for preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result)
        // In production, this would be the uploaded URL
        onChange(field, `pending-upload:${file.name}`)
      }
      reader.readAsDataURL(file)
    } finally {
      setUploading(false)
    }
  }

  const clearFile = () => {
    setPreview(null)
    onChange(field, null)
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {preview ? (
        <div className="relative inline-block">
          {preview.startsWith('data:image') || preview.match(/\.(jpg|jpeg|png|gif)$/i) ? (
            <img
              src={preview}
              alt={label}
              className="h-32 w-auto rounded-lg border border-gray-300 object-cover"
            />
          ) : (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-300">
              <DocumentTextIcon className="h-8 w-8 text-gray-400" />
              <span className="text-sm text-gray-600">{value?.replace('pending-upload:', '')}</span>
            </div>
          )}
          <button
            type="button"
            onClick={clearFile}
            className="absolute -top-2 -right-2 p-1 bg-red-100 rounded-full text-red-600 hover:bg-red-200"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-center w-full">
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              {uploading ? (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
              ) : (
                <>
                  <ArrowUpTrayIcon className="w-8 h-8 mb-2 text-gray-400" />
                  <p className="text-sm text-gray-500">Click to upload</p>
                  <p className="text-xs text-gray-400">PNG, JPG, or PDF</p>
                </>
              )}
            </div>
            <input
              type="file"
              className="hidden"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>
        </div>
      )}
    </div>
  )
}

export default function DirectorOnboardingPage() {
  const { accessToken } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [request, setRequest] = useState(null)
  const [requiredFields, setRequiredFields] = useState([])

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    mobile_phone: '',
    date_of_birth: '',
    place_of_birth: '',
    birth_state: '',
    birth_country: '',
    residential_address: '',
    director_id: '',
    drivers_licence: '',
    passport_number: '',
    drivers_licence_front_url: '',
    drivers_licence_back_url: '',
    passport_url: '',
    photo_url: '',
    director_id_confirmation_url: ''
  })

  const loadRequest = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const data = await publicApi.get(`/api/v1/director_onboarding_requests/public/${accessToken}`)

      setRequest(data.request)
      setRequiredFields(data.required_fields || [])

      // Pre-fill form with existing data
      setFormData(prev => ({
        ...prev,
        first_name: data.request.first_name || '',
        last_name: data.request.last_name || '',
        email: data.request.email || '',
        mobile_phone: data.request.mobile_phone || '',
        date_of_birth: data.request.date_of_birth || '',
        place_of_birth: data.request.place_of_birth || '',
        birth_state: data.request.birth_state || '',
        birth_country: data.request.birth_country || '',
        residential_address: data.request.residential_address || '',
        director_id: data.request.director_id || '',
        drivers_licence: data.request.drivers_licence || '',
        passport_number: data.request.passport_number || '',
        drivers_licence_front_url: data.request.drivers_licence_front_url || '',
        drivers_licence_back_url: data.request.drivers_licence_back_url || '',
        passport_url: data.request.passport_url || '',
        photo_url: data.request.photo_url || '',
        director_id_confirmation_url: data.request.director_id_confirmation_url || ''
      }))

      if (data.request.status === 'submitted' || data.request.status === 'approved') {
        setSubmitted(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    loadRequest()
  }, [loadRequest])

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    handleChange(name, value)
  }

  const getFieldConfig = (fieldName) => {
    return requiredFields.find(f => f.field === fieldName) || {}
  }

  const isFieldRequired = (fieldName) => {
    return getFieldConfig(fieldName).required === true
  }

  const validateForm = () => {
    const errors = []

    requiredFields.forEach(field => {
      if (field.required && !formData[field.field]) {
        errors.push(`${field.label} is required`)
      }
    })

    if (formData.email && !formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      errors.push('Please enter a valid email address')
    }

    return errors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const errors = validateForm()
    if (errors.length > 0) {
      setError(errors.join('. '))
      return
    }

    try {
      setSubmitting(true)
      setError(null)

      await publicApi.post(
        `/api/v1/director_onboarding_requests/public/${accessToken}/submit`,
        { director_onboarding_request: formData }
      )

      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Error state (invalid/expired link)
  if (error && !request) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-red-500 mx-auto" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Link Invalid or Expired</h1>
          <p className="mt-2 text-gray-600">{error}</p>
          <p className="mt-4 text-sm text-gray-500">
            Please contact your administrator to receive a new onboarding link.
          </p>
        </div>
      </div>
    )
  }

  // Submitted state
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <CheckCircleSolid className="h-16 w-16 text-green-500 mx-auto" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Thank You!</h1>
          <p className="mt-2 text-gray-600">
            Your information has been submitted for review.
          </p>
          <p className="mt-4 text-sm text-gray-500">
            You will be notified once your submission has been processed.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
              <UserCircleIcon className="h-8 w-8 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Director Onboarding</h1>
              {request.company_name && (
                <p className="text-gray-600">{request.company_name}</p>
              )}
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              Please complete this form with your personal details and identification documents.
              All information is securely stored and used for corporate compliance purposes.
            </p>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <UserCircleIcon className="h-5 w-5 text-gray-400" />
              Personal Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Mobile Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="mobile_phone"
                  value={formData.mobile_phone}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Date of Birth <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Place of Birth
                </label>
                <input
                  type="text"
                  name="place_of_birth"
                  value={formData.place_of_birth}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Birth State
                </label>
                <input
                  type="text"
                  name="birth_state"
                  value={formData.birth_state}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Birth Country
                </label>
                <input
                  type="text"
                  name="birth_country"
                  value={formData.birth_country}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Residential Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="residential_address"
                  value={formData.residential_address}
                  onChange={handleInputChange}
                  required
                  rows={2}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Identification Numbers */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <IdentificationIcon className="h-5 w-5 text-gray-400" />
              Identification Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Director ID Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="director_id"
                  value={formData.director_id}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., 036 123 456"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Your ASIC Director Identification Number
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Drivers Licence Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="drivers_licence"
                  value={formData.drivers_licence}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Passport Number
                </label>
                <input
                  type="text"
                  name="passport_number"
                  value={formData.passport_number}
                  onChange={handleInputChange}
                  className="mt-1 block w-full sm:w-1/2 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Document Uploads */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DocumentTextIcon className="h-5 w-5 text-gray-400" />
              Document Uploads
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FileUpload
                label="Drivers Licence (Front)"
                field="drivers_licence_front_url"
                value={formData.drivers_licence_front_url}
                onChange={handleChange}
                required={true}
              />

              <FileUpload
                label="Drivers Licence (Back)"
                field="drivers_licence_back_url"
                value={formData.drivers_licence_back_url}
                onChange={handleChange}
                required={true}
              />

              <FileUpload
                label="Photo (Headshot)"
                field="photo_url"
                value={formData.photo_url}
                onChange={handleChange}
                required={true}
              />

              <FileUpload
                label="Passport Photo Page"
                field="passport_url"
                value={formData.passport_url}
                onChange={handleChange}
                required={false}
              />

              <FileUpload
                label="Director ID Confirmation"
                field="director_id_confirmation_url"
                value={formData.director_id_confirmation_url}
                onChange={handleChange}
                required={false}
              />
            </div>
          </div>

          {/* Consent & Submit */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="mb-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  required
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-600">
                  I confirm that all information provided is accurate and I consent to this data being
                  stored and used for corporate compliance purposes. I understand that providing false
                  information may result in legal consequences.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-5 w-5" />
                  Submit Information
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Powered by TEEEM</p>
        </div>
      </div>
    </div>
  )
}
