import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapPinIcon } from '@heroicons/react/24/outline'
import { api } from '../../api'

// Fix for default marker icon in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Custom icons for different marker types
const currentProposalIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

const jobIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

const proposalIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

export default function ProposalAreaMapCard({ proposalAddress, proposalId }) {
  const [mapCenter, setMapCenter] = useState([-27.4698, 153.0251]) // Default: Brisbane
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [markers, setMarkers] = useState([])

  useEffect(() => {
    loadMapData()
  }, [proposalAddress, proposalId])

  const geocodeAddress = async (address) => {
    if (!address) return null

    try {
      // Try Mapbox first
      const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoidGVrbmFob21lcyIsImEiOiJjbWh3eXV3anMwNHgzMmpxNnduZDYxZ2MwIn0.ehmEM_PfzuhJW8_VUPBUtQ'

      if (MAPBOX_TOKEN && MAPBOX_TOKEN !== 'your_mapbox_access_token_here') {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?` +
          `access_token=${MAPBOX_TOKEN}&country=au&limit=1`
        )

        if (response.ok) {
          const data = await response.json()
          if (data.features && data.features.length > 0) {
            const [lon, lat] = data.features[0].center
            return { lat, lon }
          }
        }
      }

      // Fallback to Nominatim
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(address)}, Australia&format=json&limit=1`
      )
      const data = await response.json()

      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon)
        }
      }
    } catch (err) {
      console.error('Geocoding error for:', address, err)
    }

    return null
  }

  const loadMapData = async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch all jobs and proposals with addresses
      const [jobsResponse, proposalsResponse] = await Promise.all([
        api.get('/api/v1/jobs?has_location=true&limit=100'),
        api.get('/api/v1/email_job_proposals?limit=100')
      ])

      const jobs = jobsResponse.jobs || []
      const proposals = proposalsResponse.proposals || []

      // Geocode current proposal address
      let currentProposalCoords = null
      if (proposalAddress) {
        currentProposalCoords = await geocodeAddress(proposalAddress)
        if (currentProposalCoords) {
          setMapCenter([currentProposalCoords.lat, currentProposalCoords.lon])
        }
      }

      // Build markers array
      const newMarkers = []

      // Add current proposal marker (highlighted)
      if (currentProposalCoords) {
        newMarkers.push({
          id: `proposal-${proposalId}`,
          type: 'current_proposal',
          lat: currentProposalCoords.lat,
          lon: currentProposalCoords.lon,
          title: proposalAddress,
          subtitle: 'Current Proposal',
          icon: currentProposalIcon
        })
      }

      // Add existing jobs with saved coordinates
      for (const job of jobs) {
        if (job.latitude && job.longitude) {
          newMarkers.push({
            id: `job-${job.id}`,
            type: 'job',
            lat: parseFloat(job.latitude),
            lon: parseFloat(job.longitude),
            title: job.title || job.location || 'Untitled Job',
            subtitle: `Job #${job.id} - ${job.job_status?.name || 'Unknown Status'}`,
            icon: jobIcon,
            url: `/jobs/${job.id}`
          })
        }
      }

      // Add other pending proposals with property addresses
      for (const proposal of proposals) {
        // Skip current proposal
        if (proposal.id === proposalId) continue

        // Only show pending proposals
        if (proposal.status !== 'pending') continue

        const address = proposal.extracted_data?.property_address
        if (address) {
          const coords = await geocodeAddress(address)
          if (coords) {
            newMarkers.push({
              id: `proposal-${proposal.id}`,
              type: 'proposal',
              lat: coords.lat,
              lon: coords.lon,
              title: address,
              subtitle: `Proposal #${proposal.id} - ${proposal.extracted_data?.customer?.name || 'Unknown'}`,
              icon: proposalIcon
            })
          }
        }
      }

      setMarkers(newMarkers)

      if (newMarkers.length === 0 && !currentProposalCoords) {
        setError('No locations to display on map')
      }
    } catch (err) {
      console.error('Error loading map data:', err)
      setError('Failed to load map data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-center h-64 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading area map...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <MapPinIcon className="h-6 w-6 text-gray-400" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Area Map
            </h3>
          </div>
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 flex-1">
            <MapPinIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            <div className="flex-1">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                Area Map
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Showing {markers.length} location{markers.length !== 1 ? 's' : ''} in this area
              </p>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mb-3 flex gap-4 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Current Proposal</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Existing Jobs</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>Other Proposals</span>
          </div>
        </div>

        <div className="rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
          <MapContainer
            center={mapCenter}
            zoom={12}
            style={{ height: '400px', width: '100%' }}
            scrollWheelZoom={true}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {markers.map((marker) => (
              <Marker
                key={marker.id}
                position={[marker.lat, marker.lon]}
                icon={marker.icon}
              >
                <Popup>
                  <div className="text-sm">
                    <div className="font-semibold">{marker.title}</div>
                    <div className="text-gray-600 text-xs mt-1">{marker.subtitle}</div>
                    {marker.url && (
                      <a
                        href={marker.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-xs mt-1 inline-block"
                      >
                        View Job →
                      </a>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
          <div className="bg-gray-50 dark:bg-gray-700 px-4 py-2 flex items-center justify-between">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Click markers for details • Scroll to zoom • Drag to explore
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              {markers.filter(m => m.type === 'job').length} jobs, {markers.filter(m => m.type === 'proposal').length} proposals
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
