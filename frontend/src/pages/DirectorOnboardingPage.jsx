import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
// Address lookup uses Nominatim (OpenStreetMap) directly - no external utilities needed
import {
  UserCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  PhotoIcon,
  IdentificationIcon,
  ArrowUpTrayIcon,
  XMarkIcon,
  MapPinIcon
} from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid'

// Australian cities with state and country info
const AUSTRALIAN_CITIES = [
  // New South Wales
  { city: 'Sydney', state: 'NSW', country: 'Australia' },
  { city: 'Newcastle', state: 'NSW', country: 'Australia' },
  { city: 'Wollongong', state: 'NSW', country: 'Australia' },
  { city: 'Central Coast', state: 'NSW', country: 'Australia' },
  { city: 'Coffs Harbour', state: 'NSW', country: 'Australia' },
  { city: 'Wagga Wagga', state: 'NSW', country: 'Australia' },
  { city: 'Albury', state: 'NSW', country: 'Australia' },
  { city: 'Port Macquarie', state: 'NSW', country: 'Australia' },
  { city: 'Tamworth', state: 'NSW', country: 'Australia' },
  { city: 'Orange', state: 'NSW', country: 'Australia' },
  { city: 'Dubbo', state: 'NSW', country: 'Australia' },
  { city: 'Bathurst', state: 'NSW', country: 'Australia' },
  { city: 'Lismore', state: 'NSW', country: 'Australia' },
  { city: 'Nowra', state: 'NSW', country: 'Australia' },
  // Victoria
  { city: 'Melbourne', state: 'VIC', country: 'Australia' },
  { city: 'Geelong', state: 'VIC', country: 'Australia' },
  { city: 'Ballarat', state: 'VIC', country: 'Australia' },
  { city: 'Bendigo', state: 'VIC', country: 'Australia' },
  { city: 'Shepparton', state: 'VIC', country: 'Australia' },
  { city: 'Mildura', state: 'VIC', country: 'Australia' },
  { city: 'Warrnambool', state: 'VIC', country: 'Australia' },
  { city: 'Wodonga', state: 'VIC', country: 'Australia' },
  { city: 'Traralgon', state: 'VIC', country: 'Australia' },
  { city: 'Frankston', state: 'VIC', country: 'Australia' },
  // Queensland
  { city: 'Brisbane', state: 'QLD', country: 'Australia' },
  { city: 'Gold Coast', state: 'QLD', country: 'Australia' },
  { city: 'Sunshine Coast', state: 'QLD', country: 'Australia' },
  { city: 'Townsville', state: 'QLD', country: 'Australia' },
  { city: 'Cairns', state: 'QLD', country: 'Australia' },
  { city: 'Toowoomba', state: 'QLD', country: 'Australia' },
  { city: 'Mackay', state: 'QLD', country: 'Australia' },
  { city: 'Rockhampton', state: 'QLD', country: 'Australia' },
  { city: 'Bundaberg', state: 'QLD', country: 'Australia' },
  { city: 'Hervey Bay', state: 'QLD', country: 'Australia' },
  { city: 'Gladstone', state: 'QLD', country: 'Australia' },
  { city: 'Ipswich', state: 'QLD', country: 'Australia' },
  { city: 'Redcliffe', state: 'QLD', country: 'Australia' },
  { city: 'Burbank', state: 'QLD', country: 'Australia' },
  // South Australia
  { city: 'Adelaide', state: 'SA', country: 'Australia' },
  { city: 'Mount Gambier', state: 'SA', country: 'Australia' },
  { city: 'Whyalla', state: 'SA', country: 'Australia' },
  { city: 'Murray Bridge', state: 'SA', country: 'Australia' },
  { city: 'Port Augusta', state: 'SA', country: 'Australia' },
  { city: 'Port Lincoln', state: 'SA', country: 'Australia' },
  { city: 'Victor Harbor', state: 'SA', country: 'Australia' },
  { city: 'Glenelg', state: 'SA', country: 'Australia' },
  // Western Australia
  { city: 'Perth', state: 'WA', country: 'Australia' },
  { city: 'Mandurah', state: 'WA', country: 'Australia' },
  { city: 'Bunbury', state: 'WA', country: 'Australia' },
  { city: 'Geraldton', state: 'WA', country: 'Australia' },
  { city: 'Kalgoorlie', state: 'WA', country: 'Australia' },
  { city: 'Albany', state: 'WA', country: 'Australia' },
  { city: 'Broome', state: 'WA', country: 'Australia' },
  { city: 'Rockingham', state: 'WA', country: 'Australia' },
  { city: 'Fremantle', state: 'WA', country: 'Australia' },
  // Tasmania
  { city: 'Hobart', state: 'TAS', country: 'Australia' },
  { city: 'Launceston', state: 'TAS', country: 'Australia' },
  { city: 'Devonport', state: 'TAS', country: 'Australia' },
  { city: 'Burnie', state: 'TAS', country: 'Australia' },
  { city: 'Kingston', state: 'TAS', country: 'Australia' },
  { city: 'Ulverstone', state: 'TAS', country: 'Australia' },
  // Northern Territory
  { city: 'Darwin', state: 'NT', country: 'Australia' },
  { city: 'Alice Springs', state: 'NT', country: 'Australia' },
  { city: 'Katherine', state: 'NT', country: 'Australia' },
  { city: 'Palmerston', state: 'NT', country: 'Australia' },
  // ACT
  { city: 'Canberra', state: 'ACT', country: 'Australia' },
  { city: 'Queanbeyan', state: 'ACT', country: 'Australia' },
]

// State name mapping
const STATE_NAMES = {
  'NSW': 'New South Wales',
  'VIC': 'Victoria',
  'QLD': 'Queensland',
  'SA': 'South Australia',
  'WA': 'Western Australia',
  'TAS': 'Tasmania',
  'NT': 'Northern Territory',
  'ACT': 'Australian Capital Territory'
}

// Place of Birth autocomplete component
function PlaceOfBirthAutocomplete({ value, onChange, onSelectPlace }) {
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (e) => {
    const query = e.target.value
    onChange(query)

    if (query.length >= 2) {
      const filtered = AUSTRALIAN_CITIES.filter(place =>
        place.city.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
      setSuggestions(filtered)
      setShowSuggestions(true)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const handleSelect = (place) => {
    onChange(place.city)
    onSelectPlace(place)
    setSuggestions([])
    setShowSuggestions(false)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={() => value.length >= 2 && suggestions.length > 0 && setShowSuggestions(true)}
        placeholder="Start typing a city name..."
        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {suggestions.map((place, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSelect(place)}
              className="w-full text-left px-4 py-2 hover:bg-indigo-50 transition-colors border-b border-gray-100 last:border-b-0"
            >
              <div className="font-medium text-gray-900">{place.city}</div>
              <div className="text-sm text-gray-500">{STATE_NAMES[place.state] || place.state}, {place.country}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Address autocomplete component using Nominatim (OpenStreetMap) for better Australian address coverage
function AddressAutocompleteField({ value, onChange }) {
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceTimer = useRef(null)
  const wrapperRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Use Nominatim (OpenStreetMap) for better Australian residential address coverage
  const fetchSuggestions = async (query) => {
    if (query.length < 3) {
      setSuggestions([])
      return
    }

    setLoading(true)
    try {
      // Using Nominatim for geocoding - free and better residential address coverage
      const url = `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(query)}, Australia&` +
        `format=json&` +
        `addressdetails=1&` +
        `limit=10`

      const response = await fetch(url)
      const data = await response.json()
      setSuggestions(data || [])
      setShowSuggestions(true)
    } catch (error) {
      console.error('Error fetching address suggestions:', error)
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const newValue = e.target.value
    onChange(newValue)

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(newValue)
    }, 300)
  }

  // Format Nominatim address nicely
  const formatNominatimAddress = (suggestion) => {
    const parts = []
    const addr = suggestion.address

    if (addr.house_number && addr.road) {
      parts.push(`${addr.house_number} ${addr.road}`)
    } else if (addr.road) {
      parts.push(addr.road)
    }

    if (addr.suburb || addr.neighbourhood) {
      parts.push(addr.suburb || addr.neighbourhood)
    }

    if (addr.state && addr.postcode) {
      parts.push(`${addr.state} ${addr.postcode}`)
    }

    return parts.length > 0 ? parts.join(', ') : suggestion.display_name
  }

  const handleSelect = (suggestion) => {
    // Format address using Nominatim data
    const formattedAddress = formatNominatimAddress(suggestion)
    onChange(formattedAddress)
    setSuggestions([])
    setShowSuggestions(false)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder="Start typing your address..."
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 pr-10"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-600 border-t-transparent"></div>
          </div>
        )}
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.place_id}
              type="button"
              onClick={() => handleSelect(suggestion)}
              className="w-full text-left px-4 py-2 hover:bg-indigo-50 transition-colors border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-start gap-2">
                <MapPinIcon className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {formatNominatimAddress(suggestion)}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {suggestion.display_name}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

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
    drivers_licence_expiry: '',
    passport_number: '',
    passport_expiry: '',
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
        drivers_licence_expiry: data.request.drivers_licence_expiry || '',
        passport_number: data.request.passport_number || '',
        passport_expiry: data.request.passport_expiry || '',
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
                <PlaceOfBirthAutocomplete
                  value={formData.place_of_birth}
                  onChange={(value) => handleChange('place_of_birth', value)}
                  onSelectPlace={(place) => {
                    // Only auto-fill birth_state and birth_country if they are empty
                    // This prevents overwriting manually entered values
                    if (!formData.birth_state) {
                      handleChange('birth_state', STATE_NAMES[place.state] || place.state)
                    }
                    if (!formData.birth_country) {
                      handleChange('birth_country', place.country)
                    }
                  }}
                />
                <p className="mt-1 text-xs text-gray-500">Start typing to see Australian cities</p>
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
                  placeholder="Auto-fills from place of birth"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-gray-50"
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
                  placeholder="Auto-fills from place of birth"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-gray-50"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Residential Address <span className="text-red-500">*</span>
                </label>
                <AddressAutocompleteField
                  value={formData.residential_address}
                  onChange={(value) => handleChange('residential_address', value)}
                />
                <p className="mt-1 text-xs text-gray-500">Start typing and select from suggestions</p>
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

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Drivers Licence Expiry Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="drivers_licence_expiry"
                  value={formData.drivers_licence_expiry}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Passport Number
                </label>
                <input
                  type="text"
                  name="passport_number"
                  value={formData.passport_number}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Passport Expiry Date
                </label>
                <input
                  type="date"
                  name="passport_expiry"
                  value={formData.passport_expiry}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
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
