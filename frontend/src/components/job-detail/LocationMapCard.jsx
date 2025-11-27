import { useState, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapPinIcon, PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { api } from '../../api'

// Fix for default marker icon in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Component to handle map clicks in edit mode
function MapClickHandler({ isEditMode, onMapClick }) {
  useMapEvents({
    click(e) {
      if (isEditMode) {
        onMapClick(e.latlng)
      }
    },
  })
  return null
}

// Component to update map center when position changes
function MapUpdater({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom())
    }
  }, [center, map])
  return null
}

export default function LocationMapCard({ jobId, location, latitude, longitude, onLocationUpdate }) {
  const [mapPosition, setMapPosition] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [tempPosition, setTempPosition] = useState(null)
  const [saving, setSaving] = useState(false)
  const [searchAddress, setSearchAddress] = useState('')
  const [searchSuburb, setSearchSuburb] = useState('')
  const [addressSuggestions, setAddressSuggestions] = useState([])
  const [suburbSuggestions, setSuburbSuggestions] = useState([])
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false)
  const [showSuburbSuggestions, setShowSuburbSuggestions] = useState(false)
  const [searchingAddress, setSearchingAddress] = useState(false)
  const [searchingSuburb, setSearchingSuburb] = useState(false)
  const [lotNumber, setLotNumber] = useState('')
  const [streetNumber, setStreetNumber] = useState('')
  const [streetAddress, setStreetAddress] = useState('')
  const [showLotNumberPrompt, setShowLotNumberPrompt] = useState(false)
  const [pendingSaveData, setPendingSaveData] = useState(null)
  const [extractedNumber, setExtractedNumber] = useState('')
  const [numberType, setNumberType] = useState('lot') // 'lot' or 'street'

  useEffect(() => {
    // If we have saved coordinates, use them
    if (latitude && longitude) {
      setMapPosition([parseFloat(latitude), parseFloat(longitude)])
      setLoading(false)
    } else if (location) {
      // Otherwise, geocode the address
      geocodeAddress(location)
    } else {
      // No location or coordinates - default to Brisbane
      setMapPosition([-27.4698, 153.0251])
      setLoading(false)
    }
  }, [location, latitude, longitude])

  // Scroll modal into view when it opens
  useEffect(() => {
    if (showLotNumberPrompt) {
      setTimeout(() => {
        const modal = document.querySelector('.lot-number-modal')
        if (modal) {
          // Get modal position relative to viewport
          const rect = modal.getBoundingClientRect()
          const isFullyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight

          if (!isFullyVisible) {
            // Scroll so modal is centered in viewport
            const absoluteTop = window.pageYOffset + rect.top
            const middle = absoluteTop - (window.innerHeight / 2) + (rect.height / 2)
            window.scrollTo({ top: middle, behavior: 'smooth' })
          }
        }
      }, 100)
    }
  }, [showLotNumberPrompt])

  // Debounced address search
  useEffect(() => {
    if (!searchAddress) return
    const timer = setTimeout(() => {
      searchForAddress(searchAddress)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchAddress])

  // Debounced suburb search
  useEffect(() => {
    if (!searchSuburb) return
    const timer = setTimeout(() => {
      searchForSuburb(searchSuburb)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchSuburb])

  // Mapbox geocoding helper
  const searchAddressMapbox = async (query, options = {}) => {
    const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN

    if (!MAPBOX_TOKEN || MAPBOX_TOKEN === 'your_mapbox_access_token_here') {
      // Silently skip - will fallback to Nominatim
      return null
    }

    const { country = 'au', limit = 10, types = 'address,place' } = options

    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      country,
      limit: limit.toString(),
      types,
      proximity: '153.0251,-27.4698', // Brisbane
      autocomplete: 'true',
    })

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.status}`)
    }

    const data = await response.json()

    return data.features.map(feature => ({
      id: feature.id,
      text: feature.text,
      placeName: feature.place_name,
      center: feature.center,
      address: {
        houseNumber: feature.address || '',
        street: feature.text || '',
        suburb: feature.context?.find(c => c.id.startsWith('place.'))?.text || '',
        city: feature.context?.find(c => c.id.startsWith('place.'))?.text || '',
        state: feature.context?.find(c => c.id.startsWith('region.'))?.text || '',
        postcode: feature.context?.find(c => c.id.startsWith('postcode.'))?.text || '',
      },
      relevance: feature.relevance,
    }))
  }

  const geocodeAddress = async (address) => {
    setLoading(true)
    setError(null)

    try {
      // Try Mapbox first
      const results = await searchAddressMapbox(address, { limit: 1 })

      if (results && results.length > 0) {
        const [lon, lat] = results[0].center
        setMapPosition([lat, lon])
      } else {
        setError('Location not found on map - Click Edit to place pin manually')
        setMapPosition([-27.4698, 153.0251])
      }
    } catch (err) {
      console.error('Error geocoding address:', err)
      // Fallback to Nominatim
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(address)}, Australia&format=json&limit=1`
        )
        const data = await response.json()

        if (data && data.length > 0) {
          setMapPosition([parseFloat(data[0].lat), parseFloat(data[0].lon)])
        } else {
          setError('Location not found on map - Click Edit to place pin manually')
          setMapPosition([-27.4698, 153.0251])
        }
      } catch {
        setError('Unable to load map - Click Edit to place pin manually')
        setMapPosition([-27.4698, 153.0251])
      }
    } finally {
      setLoading(false)
    }
  }

  const searchForAddress = async (query) => {
    if (query.length < 3) {
      setAddressSuggestions([])
      setShowAddressSuggestions(false)
      return
    }

    setSearchingAddress(true)
    try {
      // Try Mapbox first
      const results = await searchAddressMapbox(query, {
        country: 'au',
        limit: 10,
        types: 'address,place',
      })

      console.log('✅ Mapbox search found:', results.length, 'results')
      console.log('First result:', results[0])

      // Filter to only show results with proper Australian addresses
      const validAddresses = results.filter(result => {
        const addr = result.address
        const hasSuburb = !!(addr.suburb || addr.city)
        const hasPostcode = !!addr.postcode
        return hasSuburb && hasPostcode
      })

      // Sort by relevance (Mapbox provides relevance score)
      const sorted = validAddresses.sort((a, b) => {
        return (b.relevance || 0) - (a.relevance || 0)
      })

      const suggestionsToShow = sorted.slice(0, 8)
      console.log('Setting suggestions:', suggestionsToShow)
      setAddressSuggestions(suggestionsToShow)
      setShowAddressSuggestions(suggestionsToShow.length > 0)
      console.log('Show suggestions set to:', suggestionsToShow.length > 0)
    } catch (err) {
      console.warn('⚠️ Mapbox search failed, falling back to Nominatim:', err.message)

      // Fallback to Nominatim (old method)
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(query)}&` +
          `format=json&` +
          `addressdetails=1&` +
          `countrycodes=au&` +
          `limit=10`
        )
        const data = await response.json()

        // Convert Nominatim format to match Mapbox format
        const converted = data
          .filter(item => {
            const isAustralian = item.address?.country === 'Australia' ||
                                item.address?.country_code === 'au' ||
                                item.display_name?.includes('Australia')
            const hasSuburb = !!(item.address?.suburb || item.address?.city || item.address?.town)
            const hasPostcode = !!item.address?.postcode
            return isAustralian && hasSuburb && hasPostcode
          })
          .map(item => ({
            id: item.place_id,
            placeName: item.display_name,
            center: [parseFloat(item.lon), parseFloat(item.lat)],
            address: {
              houseNumber: item.address?.house_number || '',
              street: item.address?.road || '',
              suburb: item.address?.suburb || item.address?.city || item.address?.town || '',
              state: item.address?.state || '',
              postcode: item.address?.postcode || '',
            }
          }))

        setAddressSuggestions(converted.slice(0, 8))
        setShowAddressSuggestions(converted.length > 0)
      } catch (fallbackErr) {
        console.error('Nominatim fallback also failed:', fallbackErr)
        setError('Address search temporarily unavailable. Please try again.')
      }
    } finally {
      setSearchingAddress(false)
    }
  }

  const searchForSuburb = async (query) => {
    if (query.length < 2) {
      setSuburbSuggestions([])
      setShowSuburbSuggestions(false)
      return
    }

    setSearchingSuburb(true)
    try {
      // Try Mapbox for suburb search
      const results = await searchAddressMapbox(query, {
        country: 'au',
        limit: 8,
        types: 'place',
      })
      setSuburbSuggestions(results)
      setShowSuburbSuggestions(results.length > 0)
    } catch (err) {
      console.warn('Mapbox suburb search failed:', err.message)
      // Fallback to Nominatim
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(query)}, Australia&format=json&addressdetails=1&limit=8&featuretype=city`
        )
        const data = await response.json()

        const converted = data.map(item => ({
          id: item.place_id,
          placeName: item.display_name,
          center: [parseFloat(item.lon), parseFloat(item.lat)],
          address: {
            suburb: item.address?.suburb || item.address?.city || '',
            state: item.address?.state || '',
          }
        }))

        setSuburbSuggestions(converted)
        setShowSuburbSuggestions(converted.length > 0)
      } catch (fallbackErr) {
        console.error('Nominatim suburb search also failed:', fallbackErr)
      }
    } finally {
      setSearchingSuburb(false)
    }
  }

  // Helper to parse address components from Mapbox result
  const parseAddressComponents = (suggestion) => {
    const addr = suggestion.address || {}
    return {
      lotNumber: addr.houseNumber || '',
      street: addr.street || suggestion.text || '',
      suburb: addr.suburb || addr.city || '',
      state: addr.state || '',
      postcode: addr.postcode || '',
      fullAddress: suggestion.placeName || ''
    }
  }

  // Helper to validate required address components
  const validateAddress = (components) => {
    const errors = []
    // Street address is optional - we'll prompt user to enter it manually
    if (!components.suburb) errors.push('suburb')
    if (!components.postcode) errors.push('postcode')
    return {
      isValid: errors.length === 0,
      missingFields: errors,
      hasLotNumber: !!components.lotNumber
    }
  }

  // Helper to format address for job title
  // Format: "Lot 160 (33) Alperton Road Burbank QLD" or "Lot 160 Alperton Road Burbank QLD"
  const formatAddressForTitle = (lotNumber, streetNumber, street, suburb, state) => {
    const parts = []

    // Handle lot and street numbers
    if (lotNumber && streetNumber) {
      // Both: "Lot 160 (33)"
      parts.push(`Lot ${lotNumber} (${streetNumber})`)
    } else if (lotNumber) {
      // Just lot: "Lot 160"
      parts.push(`Lot ${lotNumber}`)
    } else if (streetNumber) {
      // Just street number: "33"
      parts.push(streetNumber)
    }

    // Only include street if provided (it's optional)
    if (street && street.trim()) {
      parts.push(street)
    }

    if (suburb) {
      parts.push(suburb)
    }

    if (state) {
      // Abbreviate state names
      const stateAbbr = {
        'Queensland': 'QLD',
        'New South Wales': 'NSW',
        'Victoria': 'VIC',
        'South Australia': 'SA',
        'Western Australia': 'WA',
        'Tasmania': 'TAS',
        'Northern Territory': 'NT',
        'Australian Capital Territory': 'ACT'
      }
      parts.push(stateAbbr[state] || state)
    }

    return parts.join(' ')
  }

  // Save location with validation and title update
  const saveLocationWithValidation = async (locationData) => {
    const { location, latitude, longitude, lotNumber: lot, streetNumber: streetNum, street, suburb, state, updateTitle = true } = locationData

    setSaving(true)
    try {
      console.log('Saving location to backend:', { location, latitude, longitude })

      const updateData = {
        location,
        latitude,
        longitude
      }

      // If we have lot number or street number, update the title with full address
      if (updateTitle && (lot || streetNum)) {
        const newTitle = formatAddressForTitle(lot, streetNum, street, suburb, state)
        updateData.title = newTitle
        console.log('Also updating job title to:', newTitle)
      }

      const response = await api.patch(`/api/v1/jobs/${jobId}`, {
        construction: updateData
      })
      console.log('Save successful, response:', response)

      // Notify parent component
      if (onLocationUpdate) {
        onLocationUpdate({
          location,
          latitude,
          longitude,
          ...(updateData.title && { title: updateData.title })
        })
      }

      setIsEditMode(false)
      setShowLotNumberPrompt(false)
      setPendingSaveData(null)
      setLotNumber('')
      setStreetNumber('')
      setStreetAddress('')
      setExtractedNumber('')
      setNumberType('lot')
      setError(null)
    } catch (err) {
      console.error('Error saving location:', err)
      console.error('Error details:', err.response?.data || err.message)
      setError('Failed to save location. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleAddressSelect = async (suggestion) => {
    console.log('handleAddressSelect called with:', suggestion.placeName)
    // Mapbox returns [longitude, latitude] in center array
    const [lon, lat] = suggestion.center
    setTempPosition([lat, lon])
    setMapPosition([lat, lon])
    setSearchAddress(suggestion.placeName)
    setShowAddressSuggestions(false)

    // Parse and validate address
    const components = parseAddressComponents(suggestion)
    const validation = validateAddress(components)

    console.log('Address components:', components)
    console.log('Validation:', validation)

    // Check if address is missing required fields (suburb and postcode)
    if (!validation.isValid) {
      setError(`Cannot save: Missing ${validation.missingFields.join(' and ')}. Please select a complete address.`)
      return
    }

    // Pre-fill street address if available from search results
    if (components.street) {
      setStreetAddress(components.street)
    } else {
      setStreetAddress('')
    }

    // Extract and store the number for user to classify
    if (components.lotNumber) {
      setExtractedNumber(components.lotNumber)
      setNumberType('lot') // Default to lot number
      setLotNumber(components.lotNumber)
      setStreetNumber('')
    } else {
      setExtractedNumber('')
      setLotNumber('')
      setStreetNumber('')
    }

    // Store the address data for later save, but don't save yet
    // Allow user to enter lot number and street address, then adjust pin position
    setPendingSaveData({
      location: suggestion.placeName, // Fixed: use placeName instead of display_name
      latitude: lat,
      longitude: lon,
      street: components.street || '', // May be empty - user will enter it
      suburb: components.suburb,
      state: components.state,
      lotNumber: components.lotNumber || '', // Pre-fill if available
      hasLotNumber: !!components.lotNumber // True if we extracted a lot number
    })

    // Always prompt for lot number and street address
    setShowLotNumberPrompt(true)
    setError(null)
  }

  // Handle number type change (lot vs street)
  const handleNumberTypeChange = (type) => {
    setNumberType(type)
    if (extractedNumber) {
      if (type === 'lot') {
        setLotNumber(extractedNumber)
        setStreetNumber('')
      } else {
        setStreetNumber(extractedNumber)
        setLotNumber('')
      }
    }
  }

  // Handle lot number and street address submission from prompt
  const handleLotNumberSubmit = () => {
    // Must have at least lot number OR street number
    if (!lotNumber.trim() && !streetNumber.trim()) {
      setError('Please enter either a lot number or street number')
      return
    }

    // Street address is REQUIRED when manually entering
    const street = streetAddress.trim() || pendingSaveData?.street
    if (!street) {
      setError('Please enter a street address')
      return
    }

    // Validate that street includes a street type (Street, Road, Court, etc.)
    const streetTypes = [
      'street', 'st', 'road', 'rd', 'avenue', 'ave', 'court', 'ct',
      'drive', 'dr', 'lane', 'ln', 'place', 'pl', 'crescent', 'cres',
      'terrace', 'tce', 'circuit', 'cct', 'boulevard', 'blvd', 'parade',
      'way', 'close', 'grove', 'parade', 'highway', 'hwy', 'esplanade'
    ]

    const streetLower = street.toLowerCase()
    const hasStreetType = streetTypes.some(type =>
      streetLower.endsWith(' ' + type) || streetLower.endsWith(type)
    )

    if (!hasStreetType) {
      setError('Please include the street type (e.g., "Main Street", "Main Road", "Main Court")')
      return
    }

    if (!pendingSaveData) {
      setError('No pending address data')
      return
    }

    // Update pending save data with the lot number, street number, and street address
    setPendingSaveData({
      ...pendingSaveData,
      lotNumber: lotNumber.trim(),
      streetNumber: streetNumber.trim(),
      street: street, // Use entered street or keep existing
      hasLotNumber: !!(lotNumber.trim() || streetNumber.trim())
    })

    // Close the prompt and let user adjust pin before saving
    setShowLotNumberPrompt(false)
    setError(null)

    // Clear address search and suggestions
    setSearchAddress('')
    setAddressSuggestions([])
    setShowAddressSuggestions(false)
  }

  const handleSuburbSelect = (suggestion) => {
    // Mapbox returns [longitude, latitude] in center array
    const [lon, lat] = suggestion.center
    setMapPosition([lat, lon])
    setSearchSuburb(suggestion.placeName)
    setShowSuburbSuggestions(false)
    setError(null)
  }

  const handleEditClick = () => {
    setIsEditMode(true)
    setTempPosition(mapPosition)
    setSearchAddress('')
    setSearchSuburb('')
  }

  const handleCancelEdit = () => {
    setIsEditMode(false)
    setTempPosition(null)
    setError(null)
    setSearchAddress('')
    setSearchSuburb('')
    setAddressSuggestions([])
    setSuburbSuggestions([])
    setShowAddressSuggestions(false)
    setShowSuburbSuggestions(false)
    setShowLotNumberPrompt(false)
    setPendingSaveData(null)
    setLotNumber('')
    setStreetNumber('')
    setStreetAddress('')
    setExtractedNumber('')
    setNumberType('lot')
  }

  const handleMapClick = useCallback((latlng) => {
    setTempPosition([latlng.lat, latlng.lng])
    setError(null)
  }, [])

  const handleSave = async () => {
    if (!tempPosition) {
      setError('Please click on the map to place the pin')
      return
    }

    // If we have pending save data (from address selection), use it with validation
    if (pendingSaveData) {
      // Check if we have at least one: lot number OR street number
      if (!pendingSaveData.lotNumber && !pendingSaveData.streetNumber) {
        setError('Please enter either a lot number or street number before saving')
        setShowLotNumberPrompt(true)
        return
      }

      // Save with full address data and title update
      await saveLocationWithValidation({
        location: pendingSaveData.location,
        latitude: tempPosition[0], // Use the adjusted position
        longitude: tempPosition[1],
        lotNumber: pendingSaveData.lotNumber,
        streetNumber: pendingSaveData.streetNumber,
        street: pendingSaveData.street,
        suburb: pendingSaveData.suburb,
        state: pendingSaveData.state
      })
    } else {
      // Manual pin placement without address selection - just save coordinates
      setSaving(true)
      try {
        await api.patch(`/api/v1/jobs/${jobId}`, {
          construction: {
            latitude: tempPosition[0],
            longitude: tempPosition[1]
          }
        })

        setMapPosition(tempPosition)
        setIsEditMode(false)
        setTempPosition(null)
        setError(null)

        // Notify parent component if callback provided
        if (onLocationUpdate) {
          onLocationUpdate({
            latitude: tempPosition[0],
            longitude: tempPosition[1]
          })
        }
      } catch (err) {
        console.error('Error saving location:', err)
        setError('Failed to save location. Please try again.')
      } finally {
        setSaving(false)
      }
    }
  }

  const displayPosition = isEditMode && tempPosition ? tempPosition : mapPosition

  // If no location and no saved coordinates, show default Brisbane location
  const hasNoLocation = !location && !latitude && !longitude

  return (
    <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 flex-1">
            <MapPinIcon className={`h-6 w-6 ${hasNoLocation ? 'text-gray-400' : 'text-green-600 dark:text-green-400'}`} />
            <div className="flex-1">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                Job Location
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {location || 'No location set - Click to add location pin'}
              </p>
            </div>
          </div>

          {!isEditMode ? (
            <button
              onClick={handleEditClick}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <PencilIcon className="h-4 w-4 mr-2" />
              {hasNoLocation ? 'Add Pin' : 'Edit Pin'}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleCancelEdit}
                disabled={saving}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                <XMarkIcon className="h-4 w-4 mr-2" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !tempPosition}
                className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                <CheckIcon className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {isEditMode && (
          <>
            <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Edit Mode:</strong> Search for an address or suburb below, then click on the map to fine-tune the pin location.
                This is useful for new estates where roads may not exist yet.
              </p>
            </div>

            {/* Lot Number and Street Address Prompt Modal */}
            {showLotNumberPrompt && (
              <div className="lot-number-modal mb-3 p-4 bg-white dark:bg-gray-800 rounded-lg border-2 border-indigo-500 dark:border-indigo-400 shadow-lg">
                <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                  Classify Address Number
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {extractedNumber ? (
                    <>We found the number <strong>{extractedNumber}</strong> in the address. Please choose whether this is a lot number or street number.</>
                  ) : (
                    <>Please enter either a lot number or street number, and the street address.</>
                  )}
                </p>

                <div className="space-y-3">
                  {/* Number Type Selector - only show if we extracted a number */}
                  {extractedNumber && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                        The number "{extractedNumber}" is a:
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="radio"
                            value="lot"
                            checked={numberType === 'lot'}
                            onChange={() => handleNumberTypeChange('lot')}
                            className="mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Lot Number</span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="radio"
                            value="street"
                            checked={numberType === 'street'}
                            onChange={() => handleNumberTypeChange('street')}
                            className="mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Street Number</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Lot Number Field */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Lot Number {!extractedNumber && <span className="text-gray-500">(at least one required)</span>}
                    </label>
                    <input
                      type="text"
                      value={lotNumber}
                      onChange={(e) => setLotNumber(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (lotNumber.trim() || streetNumber.trim())) {
                          // Move to street address field or submit if filled
                          const streetInput = document.getElementById('street-address-input')
                          if (streetInput && !streetAddress.trim()) {
                            streetInput.focus()
                          } else {
                            handleLotNumberSubmit()
                          }
                        }
                      }}
                      placeholder="e.g., 123"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      autoFocus={!extractedNumber}
                    />
                  </div>

                  {/* Street Number Field */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Street Number {!extractedNumber && <span className="text-gray-500">(at least one required)</span>}
                    </label>
                    <input
                      type="text"
                      value={streetNumber}
                      onChange={(e) => setStreetNumber(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (lotNumber.trim() || streetNumber.trim())) {
                          // Move to street address field or submit if filled
                          const streetInput = document.getElementById('street-address-input')
                          if (streetInput && !streetAddress.trim()) {
                            streetInput.focus()
                          } else {
                            handleLotNumberSubmit()
                          }
                        }
                      }}
                      placeholder="e.g., 33"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Street Address Field */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Street Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="street-address-input"
                      type="text"
                      value={streetAddress}
                      onChange={(e) => setStreetAddress(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (lotNumber.trim() || streetNumber.trim()) && streetAddress.trim()) {
                          handleLotNumberSubmit()
                        }
                      }}
                      placeholder="e.g., Alperton Road, Main Street, Smith Court"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Preview of job title */}
                  {pendingSaveData && (lotNumber.trim() || streetNumber.trim()) && streetAddress.trim() && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Job title will be:</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatAddressForTitle(
                          lotNumber.trim(),
                          streetNumber.trim(),
                          streetAddress.trim() || pendingSaveData.street,
                          pendingSaveData.suburb,
                          pendingSaveData.state
                        )}
                      </p>
                    </div>
                  )}

                  {/* Buttons */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleLotNumberSubmit}
                      disabled={!(lotNumber.trim() || streetNumber.trim()) || (!streetAddress.trim() && !pendingSaveData?.street)}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      <CheckIcon className="h-4 w-4 mr-2" />
                      Continue
                    </button>
                    <button
                      onClick={() => {
                        setShowLotNumberPrompt(false)
                        setPendingSaveData(null)
                        setLotNumber('')
                        setStreetNumber('')
                        setStreetAddress('')
                        setExtractedNumber('')
                        setNumberType('lot')
                      }}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <XMarkIcon className="h-4 w-4 mr-2" />
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Search fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Address Search */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Search Address
                </label>
                <input
                  type="text"
                  value={searchAddress}
                  onChange={(e) => setSearchAddress(e.target.value)}
                  placeholder="e.g., 123 Main Street, Brisbane"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {searchingAddress && (
                  <div className="absolute right-3 top-10 text-gray-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-600 border-t-transparent"></div>
                  </div>
                )}
                {showAddressSuggestions && (
                  <div
                    className="absolute z-[9999] w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {(() => {
                      console.log('Rendering dropdown - showAddressSuggestions:', showAddressSuggestions, 'suggestions count:', addressSuggestions.length)
                      return null
                    })()}
                    {addressSuggestions.length > 0 ? (
                      addressSuggestions.map((suggestion, index) => (
                        <button
                          key={suggestion.id || index}
                          type="button"
                          onClick={() => handleAddressSelect(suggestion)}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          {suggestion.placeName}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        No addresses found. Try a different search.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Suburb Search */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Search Suburb
                </label>
                <input
                  type="text"
                  value={searchSuburb}
                  onChange={(e) => setSearchSuburb(e.target.value)}
                  placeholder="e.g., Brisbane, Burbank"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {searchingSuburb && (
                  <div className="absolute right-3 top-10 text-gray-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-600 border-t-transparent"></div>
                  </div>
                )}
                {showSuburbSuggestions && suburbSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {suburbSuggestions.map((suggestion, index) => (
                      <button
                        key={suggestion.id || index}
                        type="button"
                        onClick={() => handleSuburbSelect(suggestion)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        {suggestion.placeName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="mb-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">{error}</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-64 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading map...</p>
            </div>
          </div>
        )}

        {displayPosition && !loading && (
          <div className="rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
            <MapContainer
              center={displayPosition}
              zoom={15}
              style={{ height: '350px', width: '100%', cursor: isEditMode ? 'crosshair' : 'grab' }}
              scrollWheelZoom={true}
              zoomControl={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker position={displayPosition} />
              <MapClickHandler isEditMode={isEditMode} onMapClick={handleMapClick} />
              <MapUpdater center={displayPosition} />
            </MapContainer>
            <div className="bg-gray-50 dark:bg-gray-700 px-4 py-2 flex items-center justify-between">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {isEditMode
                  ? 'Click on the map to place the pin'
                  : 'Click and drag to explore • Scroll to zoom'}
              </p>
              {latitude && longitude && (
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  {parseFloat(latitude).toFixed(6)}, {parseFloat(longitude).toFixed(6)}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
